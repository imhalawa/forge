"""Routes a write or a review to the code-quality references that cover it.

Writes: injects each matching reference once per session, before the first edit it covers.
Reviews: when a review skill starts, names the review mode and every reference.
"""
import fnmatch
import json
import os
import sys
import tempfile

REFERENCES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "skills", "cq-dotnet", "references")
CSHARP = ["simplicity", "types", "collections", "naming", "syntax", "nullability", "errors-and-async", "logging-and-comments", "apis"]
ROUTES = [
    (["*/test/*.cs", "*/tests/*.cs", "*Tests*/*.cs"], CSHARP + ["tests"]),
    (["*.cs"], CSHARP),
    (["*.csproj", "*.props", "*.targets", "*.sln", "*.slnx", "*/.editorconfig", "*/global.json"], ["build"]),
]
REVIEW_SKILLS = ("code-review", "review")


def references_for(path):
    for patterns, references in ROUTES:
        if any(fnmatch.fnmatch(path, pattern) for pattern in patterns):
            return references
    return []


def seen_path(session_id):
    return os.path.join(tempfile.gettempdir(), f"forge-{session_id}.json")


def unseen(session_id, references):
    path = seen_path(session_id)
    seen = set(json.load(open(path))) if os.path.exists(path) else set()
    new = [reference for reference in references if reference not in seen]
    json.dump(sorted(seen | set(new)), open(path, "w"))
    return new


def read(reference):
    return open(os.path.join(REFERENCES, f"{reference}.md")).read()


def context(event):
    tool = event.get("tool_name", "")
    tool_input = event.get("tool_input", {})
    if tool == "Skill":
        skill = tool_input.get("skill", "")
        if not skill.split(":")[-1] in REVIEW_SKILLS:
            return None
        return ("For .NET files in this review, also check the changed lines against the forge:cq-dotnet "
                "skill's references, in its review mode: one row per broken rule with file:line, rule and fix.")
    path = tool_input.get("file_path", "")
    new = unseen(event.get("session_id", "unknown"), references_for(path))
    if not new:
        return None
    rules = "\n\n".join(read(reference) for reference in new)
    return f"code-quality rules for {os.path.basename(path)}. Follow them in this edit and every later one:\n\n{rules}"


def main():
    text = context(json.load(sys.stdin))
    if text:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": text}}))


if __name__ == "__main__":
    main()
