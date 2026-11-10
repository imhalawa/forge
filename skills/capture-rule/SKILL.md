---
name: capture-rule
description: Use when the user states a new code rule or style correction to keep, such as "always seal classes" or "use records instead of classes for payloads", to add it to the forge:cq-dotnet references.
argument-hint: <the rule, in the user's words>
user-invocable: false
---

The rules live in the language skills next to this one, one reference file per aspect: `<this skill's base directory>/../<language>/references/*.md`.

1. Write the rule as one sentence: the behaviour to follow first, then a "Never ..." guardrail only if one is needed. It must name one thing a reviewer can check in a diff.
2. Pick the language skill and the one reference whose aspect covers the rule. If none does, propose a new reference named after the aspect.
3. Read every reference of that language skill. For each rule on the same subject, give a verdict: unrelated, duplicate, or conflict.
4. If any rule is a duplicate or a conflict, show the new rule and each one it matches, side by side. Ask the user to keep the old one, replace it, or merge them into one bullet. Write nothing until they answer.
5. Add the rule as one bullet in the chosen reference, in the voice and length of the bullets around it, with a short inline example if its neighbours have one. Apply the user's answer from step 4 to the old rules. For a new reference, add it to the language skill's table.
6. Report in at most three lines: the rule and its file, the verdicts, and what changed in the old rules.
