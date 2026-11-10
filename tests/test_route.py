import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import route


def run(event):
    sys.stdin = io.StringIO(json.dumps(event))
    out = io.StringIO()
    with redirect_stdout(out):
        route.main()
    return json.loads(out.getvalue())["hookSpecificOutput"]["additionalContext"] if out.getvalue() else None


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.session = f"test-{os.getpid()}-{self._testMethodName}"

    def tearDown(self):
        path = route.seen_path(self.session)
        if os.path.exists(path):
            os.remove(path)

    def edit(self, path):
        return run({"session_id": self.session, "tool_name": "Edit", "tool_input": {"file_path": path}})

    def test_csharp_file_gets_csharp_references(self):
        text = self.edit("/repo/src/Payments/Refund.cs")
        self.assertIn("# Naming", text)
        self.assertNotIn("# Tests", text)

    def test_test_file_gets_test_references(self):
        self.assertIn("# Tests", self.edit("/repo/src/Payments.Tests/RefundTests.cs"))

    def test_build_file_gets_build_only(self):
        text = self.edit("/repo/Directory.Packages.props")
        self.assertIn("# Build", text)
        self.assertNotIn("# Naming", text)

    def test_reference_is_injected_once_per_session(self):
        self.edit("/repo/src/A.cs")
        self.assertIsNone(self.edit("/repo/src/B.cs"))

    def test_test_file_after_code_file_adds_only_tests(self):
        self.edit("/repo/src/A.cs")
        text = self.edit("/repo/tests/ATests.cs")
        self.assertIn("# Tests", text)
        self.assertNotIn("# Naming", text)

    def test_other_files_are_ignored(self):
        self.assertIsNone(self.edit("/repo/README.md"))

    def test_review_skill_gets_review_mode(self):
        text = run({"session_id": self.session, "tool_name": "Skill", "tool_input": {"skill": "code-review"}})
        self.assertIn("review mode", text)

    def test_other_skill_is_ignored(self):
        self.assertIsNone(run({"session_id": self.session, "tool_name": "Skill", "tool_input": {"skill": "forge:lanes"}}))


if __name__ == "__main__":
    unittest.main()
