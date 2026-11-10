"""Parent ticket key helpers: read the key from a branch name and check commit subjects carry it."""
import re
import sys

BRANCH_KEY = re.compile(r"^([A-Z][A-Z0-9]+-\d+)-")


def parent_key(branch):
    match = BRANCH_KEY.match(branch.rsplit("/", 1)[-1])
    return match.group(1) if match else None


def missing_parent_key(subjects, key):
    accepted = re.compile(rf"^{re.escape(key)}[ :]")
    return [subject for subject in subjects if not accepted.match(subject)]


def main(argv):
    if len(argv) == 2 and argv[0] == "branch":
        key = parent_key(argv[1])
        if key:
            print(key)
            return 0
        return 1
    if len(argv) >= 2 and argv[0] == "check":
        subjects = argv[2:] if len(argv) > 2 else [line for line in sys.stdin.read().splitlines() if line.strip()]
        bad = missing_parent_key(subjects, argv[1])
        for subject in bad:
            print(subject)
        return 1 if bad else 0
    print("usage: keys.py branch <name> | keys.py check <key> [<subject>...] (no subjects: one per line on stdin)", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
