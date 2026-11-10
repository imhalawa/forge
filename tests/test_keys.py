import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from keys import missing_parent_key, parent_key


class KeysTests(unittest.TestCase):
    def test_key_from_plain_branch(self):
        self.assertEqual(parent_key("PROJ-123-retry-policy"), "PROJ-123")

    def test_key_after_prefix(self):
        self.assertEqual(parent_key("feature/PROJ-123-x"), "PROJ-123")

    def test_no_key(self):
        for branch in ("main", "proj-123-x", "PROJ-x", "123-x"):
            self.assertIsNone(parent_key(branch))

    def test_subjects_need_parent_key(self):
        subjects = ["PROJ-123 Add backoff", "PROJ-123: Cap retries", "PROJ-124 Alert", "Fix typo"]
        self.assertEqual(missing_parent_key(subjects, "PROJ-123"), ["PROJ-124 Alert", "Fix typo"])

    def test_key_is_not_a_prefix_match(self):
        self.assertEqual(missing_parent_key(["PROJ-1234 x"], "PROJ-123"), ["PROJ-1234 x"])

    def check_stdin(self, text):
        script = os.path.join(os.path.dirname(__file__), "..", "scripts", "keys.py")
        return subprocess.run([sys.executable, script, "check", "PROJ-123"], input=text, capture_output=True, text=True)

    def test_check_reads_subjects_from_stdin(self):
        result = self.check_stdin("PROJ-123 Add retry\nPROJ-124 Alert\n")
        self.assertEqual(result.stdout, "PROJ-124 Alert\n")
        self.assertEqual(result.returncode, 1)

    def test_check_stdin_all_good(self):
        result = self.check_stdin("PROJ-123 Add retry\n\nPROJ-123: Cap retries\n")
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
