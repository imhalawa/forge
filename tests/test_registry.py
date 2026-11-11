import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from registry import fill, free_slots, merge, load, patch, patch_row, registry_path, restack_order, save, set_plan, upsert

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "scripts", "registry.py")


def run(*args, stdin=None, cwd=None, env=None):
    return subprocess.run([sys.executable, SCRIPT, *args], input=stdin, capture_output=True, text=True,
                          cwd=cwd, env={**os.environ, **(env or {})})

REG = {
    "parent": "PROJ-123",
    "maxLanes": 4,
    "lanes": [
        {"id": "wt-1", "branch": "PROJ-123-base", "base": "main", "dependsOn": [], "state": "building"},
        {"id": "wt-2", "branch": "PROJ-123-retry-cases", "base": "PROJ-123-base", "dependsOn": ["wt-1"], "state": "building"},
        {"id": "wt-3", "branch": "PROJ-123-y", "base": "PROJ-123-retry-cases", "dependsOn": ["wt-2"], "state": "pending"},
        {"id": "wt-5", "branch": "PROJ-123-x", "base": "PROJ-123-base", "dependsOn": ["wt-1"], "state": "building"},
    ],
}


def reg_with_states(states):
    lanes = [{"id": f"wt-{i}", "state": state} for i, state in enumerate(states, 1)]
    return {"parent": None, "maxLanes": 4, "lanes": lanes}


class RegistryTests(unittest.TestCase):
    def test_missing_file_is_empty_registry(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(load(os.path.join(tmp, "none.json")), {"parent": None, "maxLanes": 4, "lanes": []})

    def test_corrupt_file_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            with open(path, "w") as handle:
                handle.write("{")
            with self.assertRaises(ValueError):
                load(path)

    def test_save_is_atomic(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, REG)
            self.assertEqual(load(path), REG)
            self.assertEqual([name for name in os.listdir(tmp) if not name.endswith(".lock")], ["r.json"])

    def test_save_creates_parent_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "forge", "r.json")
            save(path, REG)
            self.assertEqual(load(path), REG)

    def test_failed_save_keeps_existing_file_and_leaves_no_temp(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, REG)
            with self.assertRaises(TypeError):
                save(path, {"lanes": [object()]})
            self.assertEqual(load(path), REG)
            self.assertEqual(os.listdir(tmp), ["r.json"])

    def test_concurrent_upserts_keep_every_lane(self):
        script = os.path.join(os.path.dirname(__file__), "..", "scripts", "registry.py")
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            procs = [
                subprocess.Popen([sys.executable, script, path, "upsert", json.dumps({"id": f"wt-{n}", "state": "building"})])
                for n in range(1, 9)
            ]
            self.assertEqual([proc.wait() for proc in procs], [0] * 8)
            self.assertEqual(sorted(lane["id"] for lane in load(path)["lanes"]), [f"wt-{n}" for n in range(1, 9)])

    def test_path(self):
        self.assertEqual(registry_path("/r/.git", "PROJ-123"), "/r/.git/forge/PROJ-123.json")

    def test_free_slots(self):
        self.assertEqual(free_slots(reg_with_states(["building", "review", "merged", "pending"])), 2)

    def test_dropped_and_closed_lanes_hold_no_slot(self):
        reg = reg_with_states(["dropped", "stopped", "stopped", "building"])
        reg["lanes"][2]["prClosed"] = True
        self.assertEqual(free_slots(reg), 2)

    def test_patch_merges_fields_into_the_entry(self):
        reg = {"parent": None, "maxLanes": 4, "lanes": [{"id": "wt-1", "state": "building", "branch": "b"}]}
        patch(reg, "wt-1", {"state": "stopped", "stoppedFrom": "building"})
        self.assertEqual(reg["lanes"], [{"id": "wt-1", "state": "stopped", "branch": "b", "stoppedFrom": "building"}])

    def test_patch_unknown_id_raises(self):
        with self.assertRaisesRegex(ValueError, "wt-9"):
            patch(reg_with_states(["building"]), "wt-9", {"state": "review"})

    def test_patch_cannot_change_the_id(self):
        with self.assertRaisesRegex(ValueError, "id"):
            patch(reg_with_states(["building"]), "wt-1", {"id": "wt-2"})

    def test_concurrent_patches_of_different_fields_all_survive(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, {"parent": "PROJ-1", "maxLanes": 4, "lanes": [{"id": "wt-1", "state": "building"}]})
            procs = [
                subprocess.Popen([sys.executable, SCRIPT, path, "patch", "wt-1"], stdin=subprocess.PIPE, text=True)
                for _ in range(8)
            ]
            for n, proc in enumerate(procs):
                proc.stdin.write(json.dumps({f"field{n}": n}))
                proc.stdin.close()
            self.assertEqual([proc.wait() for proc in procs], [0] * 8)
            lane = load(path)["lanes"][0]
            self.assertEqual({key: lane[key] for key in lane if key.startswith("field")}, {f"field{n}": n for n in range(8)})
            self.assertEqual(lane["state"], "building")

    def test_patch_from_stdin_round_trips_an_apostrophe(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, {"parent": "PROJ-1", "maxLanes": 4, "lanes": [{"id": "wt-1", "state": "building"}]})
            finding = {"summary": "The client's retry already exists", "options": ["keep it, don't add one"]}
            result = run(path, "patch", "wt-1", stdin=json.dumps({"state": "stopped", "finding": finding}))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(load(path)["lanes"][0]["finding"], finding)

    def test_patch_cli_unknown_id_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, REG)
            result = run(path, "patch", "wt-9", stdin='{"state": "review"}')
            self.assertEqual(result.returncode, 1)
            self.assertIn("wt-9", result.stderr)

    def test_upsert_reads_stdin_without_an_argument(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            result = run(path, "upsert", stdin=json.dumps({"id": "wt-1", "finding": "it's red"}))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(load(path)["lanes"], [{"id": "wt-1", "finding": "it's red"}])

    def test_set_plan_writes_the_plan_and_keeps_the_lanes(self):
        plan = {"prs": [{"pr": "S1\u00b71", "subTask": "PROJ-124", "base": "main", "criteria": ["Given a 503, when sent, then it's retried"], "dependsOn": []}]}
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, REG)
            result = run(path, "set-plan", stdin=json.dumps(plan))
            self.assertEqual(result.returncode, 0, result.stderr)
            saved = load(path)
            self.assertEqual(saved["plan"], plan)
            self.assertEqual(saved["lanes"], REG["lanes"])

    def test_set_plan_keeps_the_parent_tracker_and_titles(self):
        plan = {
            "parent": {"key": "PROJ-123", "title": "Retry failed refunds"},
            "trackerUrl": "https://example.atlassian.net",
            "prs": [{"pr": "S1\u00b71", "subTask": "PROJ-124", "title": "Retry on 503", "base": "main", "criteria": [], "dependsOn": []}],
        }
        self.assertEqual(set_plan(reg_with_states([]), plan)["plan"], plan)

    def test_set_plan_rejects_a_title_that_is_not_text(self):
        with self.assertRaisesRegex(ValueError, "title"):
            set_plan(reg_with_states([]), {"prs": [{"pr": "S1\u00b71", "subTask": "PROJ-124", "title": 4}]})
        with self.assertRaisesRegex(ValueError, "parent"):
            set_plan(reg_with_states([]), {"prs": [], "parent": "PROJ-123"})

    def test_where_is_the_home_folder_whatever_the_cwd(self):
        with tempfile.TemporaryDirectory() as home, tempfile.TemporaryDirectory() as plain:
            result = run("where", "PROJ-123", cwd=plain, env={"FORGE_REGISTRY_DIR": home})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), os.path.join(home, "PROJ-123.json"))

    def test_where_moves_a_registry_left_in_the_repo(self):
        with tempfile.TemporaryDirectory() as home, tempfile.TemporaryDirectory() as repo:
            subprocess.run(["git", "init", "-q", repo], check=True)
            old = os.path.join(repo, ".git", "forge", "PROJ-123.json")
            save(old, REG)
            result = run("where", "PROJ-123", cwd=repo, env={"FORGE_REGISTRY_DIR": home})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(load(os.path.join(home, "PROJ-123.json")), REG)
            self.assertFalse(os.path.exists(old))

    def test_where_never_overwrites_the_home_registry(self):
        with tempfile.TemporaryDirectory() as home, tempfile.TemporaryDirectory() as repo:
            subprocess.run(["git", "init", "-q", repo], check=True)
            save(os.path.join(repo, ".git", "forge", "PROJ-123.json"), REG)
            save(os.path.join(home, "PROJ-123.json"), reg_with_states(["merged"]))
            run("where", "PROJ-123", cwd=repo, env={"FORGE_REGISTRY_DIR": home})
            self.assertEqual(load(os.path.join(home, "PROJ-123.json")), reg_with_states(["merged"]))

    def test_fill_sets_only_what_is_missing(self):
        reg = {
            "plan": {"prs": [{"pr": "S1\u00b71", "subTask": "PROJ-124"}, {"pr": "S2\u00b71", "subTask": "PROJ-125", "title": "Kept"}]},
            "lanes": [{"id": "wt-1", "prNumber": 41}, {"id": "wt-2", "prUrl": "https://github.com/o/r/pull/42"}],
        }
        filled = fill(reg, {
            "parent": {"key": "PROJ-123", "title": "Retry"},
            "trackerUrl": "https://example.atlassian.net",
            "titles": {"PROJ-124": "Retry on 503", "PROJ-125": "Replaced?"},
            "lanes": {"wt-1": {"prUrl": "https://github.com/o/r/pull/41", "repo": "/r"},
                      "wt-2": {"prUrl": "https://github.com/o/r/pull/99"}},
        })
        self.assertEqual(filled, ["parent", "trackerUrl", "title S1\u00b71", "prUrl wt-1", "repo wt-1"])
        self.assertEqual(reg["plan"]["prs"][1]["title"], "Kept")
        self.assertEqual(reg["lanes"][1]["prUrl"], "https://github.com/o/r/pull/42")

    def test_fill_through_the_command_prints_what_it_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, {"plan": {"prs": []}, "lanes": []})
            result = run(path, "fill", stdin=json.dumps({"trackerUrl": "https://example.atlassian.net"}))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), ["trackerUrl"])
            self.assertEqual(load(path)["plan"]["trackerUrl"], "https://example.atlassian.net")

    def test_merge_keeps_other_sub_tasks_and_environments(self):
        reg = {"lanes": []}
        merge(reg, "deploy", {"PROJ-2": {"testing": "done"}})
        merge(reg, "deploy", {"PROJ-2": {"acceptance": "running"}, "PROJ-3": {"testing": "done"}})
        self.assertEqual(reg["deploy"], {"PROJ-2": {"testing": "done", "acceptance": "running"}, "PROJ-3": {"testing": "done"}})
        merge(reg, "verify", {"0": "passed"})
        self.assertEqual(reg["verify"], {"0": "passed"})

    def test_merge_records_a_gap_then_its_sub_tasks(self):
        reg = {"lanes": []}
        merge(reg, "gaps", {"0": {"gap": "The cart page still reads the old flag", "found": "implement", "state": "planning"}})
        merge(reg, "gaps", {"0": {"state": "planned", "subTasks": ["PROJ-203"]}})
        self.assertEqual(reg["gaps"]["0"], {"gap": "The cart page still reads the old flag", "found": "implement", "state": "planned", "subTasks": ["PROJ-203"]})

    def test_merge_records_the_deploy_watcher_then_clears_it(self):
        reg = {"lanes": []}
        merge(reg, "watchers", {"deploy": {"kind": "session", "id": "local_1"}})
        self.assertEqual(reg["watchers"]["deploy"], {"kind": "session", "id": "local_1"})
        merge(reg, "watchers", {"deploy": None})
        self.assertIsNone(reg["watchers"]["deploy"])

    def test_fill_picks_the_done_status_once(self):
        reg = {"lanes": [], "plan": {"prs": []}}
        self.assertEqual(fill(reg, {"doneStatus": "Resolved"}), ["doneStatus"])
        self.assertEqual(fill(reg, {"doneStatus": "Closed"}), [])
        self.assertEqual(reg["plan"]["doneStatus"], "Resolved")

    def test_fill_sets_a_missing_pr_name_and_keeps_a_given_one(self):
        reg = {"lanes": [], "plan": {"prs": [{"pr": "S1·1", "subTask": "PROJ-2"}, {"pr": "S1·2", "subTask": "PROJ-2", "name": "Kept"}]}}
        self.assertEqual(fill(reg, {"names": {"S1·1": "Empty the stack", "S1·2": "Other"}}), ["name S1·1"])
        self.assertEqual([r.get("name") for r in reg["plan"]["prs"]], ["Empty the stack", "Kept"])

    def test_fill_keeps_sub_tasks_without_a_pr_and_their_status(self):
        reg = {"lanes": [], "plan": {"prs": [{"pr": "S1·1", "subTask": "PROJ-2"}]}}
        fill(reg, {"tasks": [{"key": "PROJ-2", "status": "open"}, {"key": "PROJ-3", "title": "Archive the pipeline", "status": "open"}]})
        self.assertEqual(reg["plan"]["tasks"], [{"key": "PROJ-3", "title": "Archive the pipeline", "status": "open"}])
        self.assertEqual(fill(reg, {"tasks": [{"key": "PROJ-3", "status": "done"}]}), ["status PROJ-3"])
        self.assertEqual(reg["plan"]["tasks"][0]["status"], "done")

    def test_row_holds_a_pr_and_orders_a_deploy_first(self):
        reg = {"lanes": [], "plan": {"prs": [{"pr": "S1·1", "subTask": "P"}, {"pr": "S1·2", "subTask": "P"}]}}
        patch_row(reg, "S1·2", {"hold": "Wait for the platform team", "mergeAfter": {"pr": "S1·1", "deployedTo": "production"}})
        self.assertEqual(reg["plan"]["prs"][1]["mergeAfter"], {"pr": "S1·1", "deployedTo": "production"})
        patch_row(reg, "S1·2", {"hold": None})
        self.assertNotIn("hold", reg["plan"]["prs"][1])
        with self.assertRaisesRegex(ValueError, "row takes only"):
            patch_row(reg, "S1·2", {"base": "main"})
        with self.assertRaisesRegex(ValueError, "mergeAfter is"):
            patch_row(reg, "S1·2", {"mergeAfter": {"pr": "S9·9", "deployedTo": "production"}})

    def test_row_takes_an_agreed_change_to_criteria_and_rules(self):
        reg = {"lanes": [], "plan": {"prs": [{"pr": "S1·1", "subTask": "P", "criteria": ["old"], "rules": ["When old, then x."]}]}}
        patch_row(reg, "S1·1", {"criteria": ["Given quantity 0, then INVALID_QUANTITY"], "rules": ["When the quantity is 0, the answer is INVALID_QUANTITY."]})
        self.assertEqual(reg["plan"]["prs"][0]["rules"], ["When the quantity is 0, the answer is INVALID_QUANTITY."])
        with self.assertRaisesRegex(ValueError, "same length"):
            patch_row(reg, "S1·1", {"rules": ["a", "b"]})
        with self.assertRaisesRegex(ValueError, "list of text"):
            patch_row(reg, "S1·1", {"criteria": "one"})

    def test_merge_takes_only_life_cycle_records(self):
        with self.assertRaisesRegex(ValueError, "merge takes one of"):
            merge({"lanes": []}, "lanes", {})

    def test_merge_through_the_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "r.json")
            save(path, {"lanes": []})
            result = run(path, "merge", "cleanup", stdin=json.dumps({"pruned": True}))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(load(path)["cleanup"], {"pruned": True})

    def test_set_plan_keeps_the_done_criteria(self):
        plan = {"prs": [], "done": [{"criterion": "No service calls the API", "by": "forge", "source": "datadog", "how": "APM spans for 7 days"}]}
        self.assertEqual(set_plan(reg_with_states([]), plan)["plan"]["done"], plan["done"])
        with self.assertRaisesRegex(ValueError, "done"):
            set_plan(reg_with_states([]), {"prs": [], "done": ["no"]})

    def test_set_plan_rejects_a_plan_without_prs(self):
        with self.assertRaisesRegex(ValueError, "prs"):
            set_plan(reg_with_states([]), {"rows": []})

    def test_upsert_adds_then_replaces_by_id(self):
        reg = reg_with_states(["building"])
        upsert(reg, {"id": "wt-2", "state": "review"})
        upsert(reg, {"id": "wt-1", "state": "merged"})
        self.assertEqual([(l["id"], l["state"]) for l in reg["lanes"]], [("wt-1", "merged"), ("wt-2", "review")])

    def test_restack_fan_out(self):
        self.assertEqual(
            restack_order(REG, "wt-1"),
            [
                {"id": "wt-2", "branch": "PROJ-123-retry-cases", "newBase": "main"},
                {"id": "wt-5", "branch": "PROJ-123-x", "newBase": "main"},
            ],
        )

    def test_restack_chain_moves_only_direct_dependent(self):
        self.assertEqual([d["id"] for d in restack_order(REG, "wt-2")], ["wt-3"])

    def test_restack_unknown_id_raises(self):
        with self.assertRaisesRegex(ValueError, "wt-9"):
            restack_order(REG, "wt-9")


if __name__ == "__main__":
    unittest.main()
