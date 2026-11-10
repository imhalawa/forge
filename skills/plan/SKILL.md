---
name: plan
description: Use when forge needs a ticket planned (investigated and broken into sub-tasks), a missing piece fitted into the plan, one sub-task planned again, or a lost state file rebuilt.
argument-hint: <ticket key> | gap <index> | replan <sub-task key> | rebuild <ticket key>
user-invocable: false
---

Plan is forge's first step: Investigate, then Break down. Follow `forge:forge`'s rules for everything the user sees. Each stage ends with the user's confirmation through the question dialog, and shows nothing of the next. Change nothing in the tracker until the user approves the sub-tasks. The state file is the path `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/registry.py" where <parent-key>` prints.

Every fact you rely on has a source: a ticket field, a comment with its author and date, a file and line on the default branch, or a query and its result. A value no source gives (a limit, a name, a rate) is a question, never a guess. A fact you searched for and did not find is unverified; say where you looked. Facts and sources go into the card's `evidence`, never into its `title`, `line` or the question.

## Investigate

1. Read the ticket, its comments, its links and its sub-tasks. A later comment by the reporter wins over the earlier text. If it already has sub-tasks, say so and stop: forge works from them.
2. Check the problem still happens, with the source the ticket names or the repo's usual one. If it no longer does (for example no events in 30 days), show that as the card "The problem is gone" and ask "Close the story?" with "Close it" (draft a comment with the proof for the user to post; change nothing) and "Plan anyway".
3. Write the problem as one card: `title` the problem in a sentence; `sections` **Who is hit** (one concrete case), **Done when** (one item per outcome that must hold in production) and **Out of scope** (each with its reason). Ask "Is this the problem?" with "Yes" and "Correct it". Apply corrections and ask again until they confirm.
4. Ask the open questions, most blocking first, one at a time, each with its options and the default first (or saying none has a source).
5. For each outcome under **Done when**, settle how it is verified in production: by forge, when a source can prove it (a Datadog monitor or query, an AWS resource, a log search), with the check in one line; or by the user, when nothing can, with the steps they follow as `how` (one step per line, where to go and what must show). Ask the user to confirm the list.

## Break down

6. Read the code the problem touches, in every repo it reaches. Write the approach as one card: what changes, where and why, one item per change. Ask "Is this the approach?" with "Yes" and "Correct it", until they confirm.
7. Split the approach into sub-tasks, in the order they must merge. Each has a title, its acceptance criteria as `Given / When / Then`, each criterion again as a plain rule (one sentence, "When <condition>, <every outcome>.", every outcome named, no test names, e.g. "When the quantity is 0 or below, the product is not eligible, the out-of-range count goes up, and the product system is not asked."), the automated test that checks each, and the sub-tasks it waits on. Split a sub-task too big to review at once into small PRs, each building and passing its tests on its own base. For each PR give a `name` (what it does, at most 5 words, verb first), its `repo` (the local clone's absolute root; ask for one you cannot find), and its base: the default branch, or the PR it builds on. A sub-task that waits on one other sub-task bases its first PR on that sub-task's last PR; one that waits on two or more starts from the default branch after all of them merge.
8. Check the breakdown, and fix every failure before showing it:
   - every **Done when** outcome maps to a sub-task, a criterion and a test;
   - every criterion can be checked by an automated test;
   - every value has a source;
   - no sub-task does work the ticket does not need;
   - every PR builds and passes on its base, and the waits have no cycle.
   Show the sub-tasks as one card: one section per sub-task, its PRs as items by `name`; the checks as a checklist (one section per check, its one item `Pass` or `Fail: <why>`). Ask "Create these sub-tasks?" with "Create them" and "Change them". Apply changes and check again until they approve.
9. Create the sub-tasks under the ticket in plan order, with the tracker's own skill when one is installed, and each wait as a "blocks" link. Then write the plan with `registry.py <state file> set-plan`:
   `{"parent": {"key", "title", "type": "story"|"bug"|"task"}, "trackerUrl", "done": [{"criterion", "by": "forge"|"you", "source", "how"}], "prs": [{"pr": "S<n>·<m>", "name", "subTask", "title", "repo", "base": "<default>" | "S<n>·<m>", "criteria": [...], "rules": [...], "dependsOn": [...], "slug"}]}`.
   `pr` is forge's own key for the row and is never shown. Say in one line which sub-tasks were created and by what.

## A gap (`gap <index>`)

A later step found a missing piece. Read the whole plan, every PR in work, and `gaps.<index>`. Run Investigate and Break down for the missing piece only, with everything already built as a confirmed fact: what is missing and what "done" adds for it (append to `done`), how it fits with the existing sub-tasks (what it waits on, what must wait on it), and its new sub-tasks and PRs, each `slug` naming no existing branch. Never change a merged PR: a change to merged work is a new sub-task. A new PR that must land before an open one becomes its base. On approval, create the new sub-tasks with their links, write the whole plan back with `set-plan` (every existing row as it was, the new rows in place), and `registry.py merge gaps` with `{"<index>": {"state": "planned", "subTasks": [...]}}`.

## One sub-task again (`replan <sub-task key>`)

A finding showed the plan for one sub-task is wrong. Run Break down for that sub-task only, with the finding as a confirmed fact; keep every other row. On approval, update the sub-task in the tracker, write the plan back with its rows replaced and new `slug`s, and set each of its PRs in work that is not merged to `dropped`.

## A lost state file (`rebuild <ticket key>`)

Sub-tasks exist but the state file has no plan. Rebuild it without asking: one row per sub-task (`S<n>·1` in tracker order) with its title, a `name` from its summary, its repo, its criteria from the sub-task's acceptance criteria, and its waits from its links; the parent and tracker URL. Then one PR in work per `<parent-key>-*` branch with a worktree or a PR, tied to its sub-task by its PR's or branch's title, in state `merged`, `open`, `review` (a change and no PR) or `building`. A branch you cannot tie to a sub-task is a finding. Say in one line what you rebuilt it from.

## forge-lens

Send each card through `forge_report` as `kind: planning`, no `lane`, `step` `Problem`, `Approach` or `Sub-tasks`: `state: review` and `needsYou: true` while you ask, with `ask` the question's words and `choices`; `state: confirmed` once the user confirms.
