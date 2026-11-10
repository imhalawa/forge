"""Lane registry: the plan and the lanes of one parent ticket, and the order to restack them after a merge."""
import contextlib
import fcntl
import json
import os
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Iterator

# States whose lane holds no lane slot: it has no runner and needs none.
SLOTLESS_STATES = {"merged", "pending", "dropped"}


def registry_path(common_dir: str, key: str) -> str:
    return os.path.join(common_dir, "forge", f"{key}.json")


def home_dir() -> str:
    """Where every ticket's registry lives, whatever folder or repo the session runs in."""
    return os.environ.get("FORGE_REGISTRY_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "forge")


def legacy_path(key: str, cwd: str | None = None) -> str | None:
    """The registry an older forge wrote in the git common dir of the repo at cwd, if cwd is in one."""
    try:
        out = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                             cwd=cwd, capture_output=True, text=True, check=False)
    except OSError:
        return None
    common = out.stdout.strip()
    return registry_path(common, key) if out.returncode == 0 and common else None


def where(key: str, cwd: str | None = None) -> str:
    """The ticket's registry path; an older registry found in the repo at cwd is moved there first."""
    path = os.path.join(home_dir(), f"{key}.json")
    old = legacy_path(key, cwd)
    if not os.path.exists(path) and old and os.path.exists(old):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        shutil.move(old, path)
    return path


def load(path: str) -> dict:
    try:
        with open(path) as handle:
            return json.load(handle)
    except FileNotFoundError:
        return {"parent": None, "maxLanes": 4, "lanes": []}
    except json.JSONDecodeError as error:
        raise ValueError(f"corrupt registry {path}: {error}") from error


def save(path: str, registry: dict) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=directory, prefix=os.path.basename(path) + ".", suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w") as handle:
            json.dump(registry, handle, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)


@contextlib.contextmanager
def locked(path: str) -> Iterator[None]:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path + ".lock", "w") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def upsert(registry: dict, lane: dict) -> dict:
    lanes = registry["lanes"]
    for index, existing in enumerate(lanes):
        if existing["id"] == lane["id"]:
            lanes[index] = lane
            break
    else:
        lanes.append(lane)
    return registry


def patch(registry: dict, lane_id: str, fields: dict) -> dict:
    if fields.get("id", lane_id) != lane_id:
        raise ValueError(f"patch cannot change the id of {lane_id}")
    for lane in registry["lanes"]:
        if lane["id"] == lane_id:
            lane.update(fields)
            return registry
    raise ValueError(f"unknown lane {lane_id}")


def set_plan(registry: dict, plan: dict) -> dict:
    if not isinstance(plan, dict) or not isinstance(plan.get("prs"), list):
        raise ValueError("a plan is an object with a prs list")
    # forge-lens draws these: the parent's title, the tracker's base URL, and each sub-task's title.
    parent = plan.get("parent")
    if parent is not None and not (isinstance(parent, dict) and isinstance(parent.get("key"), str)):
        raise ValueError("a plan's parent is an object with a key")
    if plan.get("trackerUrl") is not None and not isinstance(plan["trackerUrl"], str):
        raise ValueError("a plan's trackerUrl is a string")
    if any(not isinstance(row.get("title", ""), str) for row in plan["prs"] if isinstance(row, dict)):
        raise ValueError("a row's title is a string")
    done = plan.get("done")
    if done is not None and not (isinstance(done, list) and all(isinstance(d, dict) and isinstance(d.get("criterion"), str) for d in done)):
        raise ValueError("a plan's done is a list of {criterion, by, source, how}")
    registry["plan"] = plan
    return registry


def fill(registry: dict, facts: dict) -> list[str]:
    """Sets only the fields the registry lacks, from what the tracker and the PRs say; returns what it set."""
    filled = []
    plan = registry.get("plan")
    if isinstance(plan, dict):
        parent = facts.get("parent")
        if isinstance(parent, dict) and isinstance(parent.get("key"), str) and not plan.get("parent"):
            plan["parent"] = parent
            filled.append("parent")
        if isinstance(facts.get("trackerUrl"), str) and not plan.get("trackerUrl"):
            plan["trackerUrl"] = facts["trackerUrl"]
            filled.append("trackerUrl")
        titles = facts.get("titles") or {}
        for row in plan.get("prs", []):
            title = titles.get(row.get("subTask"))
            if isinstance(title, str) and not row.get("title"):
                row["title"] = title
                filled.append(f"title {row.get('pr')}")
    for lane in registry["lanes"]:
        for field, value in (facts.get("lanes") or {}).get(lane.get("id"), {}).items():
            if field in ("prUrl", "repo", "prNumber") and value is not None and not lane.get(field):
                lane[field] = value
                filled.append(f"{field} {lane['id']}")
    return filled


MERGEABLE = {"deploy", "verify", "cleanup", "gaps", "watchers"}


def merge(registry: dict, key: str, value: dict) -> dict:
    """Merges `value` into one of the life-cycle records, two levels deep, so a write for one sub-task or one
    environment keeps the others: deploy {sub-task: {env: state}}, verify {index: state}, cleanup {sub-task: {...}},
    gaps {index: {gap, found, state, subTasks}}, watchers {deploy: {kind, id} | null}."""
    if key not in MERGEABLE:
        raise ValueError(f"merge takes one of {sorted(MERGEABLE)}, not {key}")
    if not isinstance(value, dict):
        raise ValueError("merge takes a JSON object")
    record = registry.setdefault(key, {})
    for name, inner in value.items():
        if isinstance(inner, dict) and isinstance(record.get(name), dict):
            record[name].update(inner)
        else:
            record[name] = inner
    return registry


def holds_slot(lane: dict) -> bool:
    state = lane.get("state")
    if state in SLOTLESS_STATES:
        return False
    # A lane stopped because its PR was closed unmerged has no runner; one stopped for a finding keeps its slot.
    return not (state == "stopped" and lane.get("prClosed"))


def free_slots(registry: dict) -> int:
    return registry["maxLanes"] - sum(1 for lane in registry["lanes"] if holds_slot(lane))


def restack_order(registry: dict, merged_id: str) -> list[dict]:
    merged = next((lane for lane in registry["lanes"] if lane["id"] == merged_id), None)
    if merged is None:
        raise ValueError(f"unknown lane {merged_id}")
    dependents = [lane for lane in registry["lanes"] if merged_id in lane.get("dependsOn", [])]
    dependents.sort(key=lambda lane: lane["id"])
    return [{"id": lane["id"], "branch": lane["branch"], "newBase": merged["base"]} for lane in dependents]


USAGE = (
    "usage: registry.py where <parent-key> | <path> slots | restack <id> | upsert [<json>] | patch <id> | set-plan | fill"
    " | merge deploy|verify|cleanup|gaps\n"
    "  upsert without <json>, patch, set-plan, fill and merge read the JSON from stdin"
)
ARITY = {"slots": (2,), "restack": (3,), "upsert": (2, 3), "patch": (3,), "set-plan": (2,), "fill": (2,), "merge": (3,)}


def read_json(text: str) -> dict:
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON: {error}") from error
    if not isinstance(value, dict):
        raise ValueError("expected a JSON object")
    return value


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[0] == "where":
        try:
            print(where(argv[1]))
        except OSError as error:
            print(str(error), file=sys.stderr)
            return 1
        return 0
    if len(argv) < 2 or argv[1] not in ARITY or len(argv) not in ARITY[argv[1]]:
        print(USAGE, file=sys.stderr)
        return 2
    path, command = argv[0], argv[1]
    try:
        if command == "slots":
            print(free_slots(load(path)))
        elif command == "restack":
            print(json.dumps(restack_order(load(path), argv[2])))
        else:
            payload = read_json(argv[2] if command == "upsert" and len(argv) == 3 else sys.stdin.read())
            with locked(path):
                registry = load(path)
                if command == "upsert":
                    upsert(registry, payload)
                elif command == "patch":
                    patch(registry, argv[2], payload)
                elif command == "fill":
                    print(json.dumps(fill(registry, payload)))
                elif command == "merge":
                    merge(registry, argv[2], payload)
                else:
                    set_plan(registry, payload)
                save(path, registry)
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
