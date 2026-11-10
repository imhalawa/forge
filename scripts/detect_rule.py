"""Points the agent at forge:capture-rule when a prompt may state a rule or a correction."""
import json
import re
import sys

PATTERNS = [
    r"\bfrom now on\b",
    r"\bgoing forward\b",
    r"\b(always|never)\b",
    r"\bdon'?t (like|want|ever|use)\b",
    r"\bi (prefer|hate|dislike)\b",
    r"\b(add|make|save|capture|keep)\b.{0,20}\brules?\b",
    r"\bstop (doing|using|adding|writing)\b",
    r"\binstead of\b",
    r"\bnot how\b",
]
CONTEXT = ("forge: this prompt may state a code rule or a style correction for C#, tests, or build files. "
           "If it does, invoke the forge:capture-rule skill with it before anything else.")


def is_rule_shaped(prompt):
    text = prompt.lower()
    return any(re.search(pattern, text) for pattern in PATTERNS)


def main():
    prompt = json.load(sys.stdin).get("prompt", "")
    if prompt.lstrip().startswith("/") or not is_rule_shaped(prompt):
        return
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": CONTEXT}}))


if __name__ == "__main__":
    main()
