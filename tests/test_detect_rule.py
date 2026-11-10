import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
import detect_rule


def run(prompt):
    sys.stdin = io.StringIO(json.dumps({"prompt": prompt}))
    out = io.StringIO()
    with redirect_stdout(out):
        detect_rule.main()
    return json.loads(out.getvalue())["hookSpecificOutput"]["additionalContext"] if out.getvalue() else None


class DetectRuleTests(unittest.TestCase):
    def test_rule_shaped_prompt_points_at_capture_rule(self):
        self.assertIn("forge:capture-rule", run("From now on, seal every class"))

    def test_correction_points_at_capture_rule(self):
        self.assertIn("forge:capture-rule", run("Use records instead of classes for payloads"))

    def test_plain_request_adds_nothing(self):
        self.assertIsNone(run("Fix the failing build"))

    def test_slash_command_adds_nothing(self):
        self.assertIsNone(run("/code-review always"))


if __name__ == "__main__":
    unittest.main()
