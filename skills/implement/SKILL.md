---
name: implement
description: Use when forge starts building a sub-task's PRs (a worktree and a background session each), restarts one whose session is gone or that resumes on the user's answer, or when a forge-started session builds its PR test first.
argument-hint: start <PRs> | restart <lane id> [<user's answer>] | build
user-invocable: false
---

Implement builds each PR of the plan in its own worktree, test first, and leaves the change unstaged for the user to review. Follow `forge:forge`'s rules for everything the user sees. The scripts run as `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/<name>"` (in a brief, written as absolute paths). The state file is the path `registry.py where <parent-key>` prints; change a PR in work with `registry.py <state file> patch <lane id>` or create one with `upsert`, the JSON on stdin through a quoted heredoc.

A PR in work (a lane entry) has: `id` (`wt-<n>`), `subTask`, `pr` (the plan row's key), `repo`, `branch` (`<parent-key>-<slug>`), `base` (the branch its PR targets), `baseRef` and `baseSha` (the ref and commit it is cut from; its own work is `<baseSha>..HEAD` and the worktree's changes), `worktree`, `runner` (`{kind, id}` or `null`), `dependsOn` (the lane ids of its base PRs), `state`, `prNumber`, `prUrl`, and once set `finding` (`{summary, evidence, options}`), `stoppedFrom`, `deferredAt`, `seen`, `notes`, and while it builds `rules` (`{done: [indices], now: index | null}`, the criteria by index).

**Remotes.** In the PR's `repo`: `<remote>` is `upstream` when it exists and names a different `owner/repo` from `origin` (a fork), else `origin`. Pushes go to `origin` only.

## Start (`start <PRs>`)

For each PR passed, in plan order, so a base PR's branch exists before the PR built on it:
1. In its repo, check `git status --porcelain` is empty in the main checkout; if not, it is a finding (name the files; choices: "Commit them", "Stash them", "Leave them"), and touch nothing. Fetch `<remote>` (and `origin`).
2. Branch `<parent-key>-<slug>` (the row's `slug`, else up to 4 words of its `name` in kebab case). Base: the default branch (`baseRef` `refs/remotes/<remote>/<default>`), or its base PR's branch (`refs/heads/<that branch>`). Create `git worktree add <repo>/.worktrees/<branch> -b <branch> <baseRef>`; reuse a branch with nothing past its base; a branch with work past its base is a finding.
3. A PR whose base PRs are not all built yet (at `review` or later): record it `pending` with `dependsOn`, and start nothing. At most 4 PRs build at once (`registry.py <state file> slots`); one over waits `pending` too.
4. Otherwise start it: rebase a stacked PR onto its base (onto the default branch if the base has merged, clearing `dependsOn`), set `baseSha` to `git rev-parse <baseRef>`, then build and run the full suite. A red suite is a finding (the failing tests as evidence; choices "Try again" and "Leave it"): start no session, record `state: stopped`, `stoppedFrom: baseline`. Green: start the session (below), record `state: building` with its `runner`, and set the sub-task in progress, assigned to the user.

Say in one line which PRs started and which wait, by `name`.

## Restart (`restart <lane id> [<answer>]`)

Never continue the old session. Add the worktree if it is missing (`git worktree add <worktree> <branch>`), and start a fresh session with the brief, adding what is done so far (`git -C <worktree> status --porcelain` and `git log <baseSha>..HEAD`) and "You replace a session that stopped; continue from the worktree." With an answer, add the finding and "The user answered: <answer, in their words>. Apply it first." and set `state` to its `stoppedFrom`, clearing `finding`. A PR stopped on a red baseline restarts at Start step 4.

## The session

Start one session per PR with `start_session` (`initiation: user_asked`, `context: fresh`, `cwd: <worktree>`, `use_worktree: false`, title `<parent-key> <name>`), after checking that `git -C <worktree> rev-parse --show-toplevel` prints the worktree (forge's **Sessions** rule), or, without it, a background agent told to `cd <worktree> &&` every command. Its brief is its only context: the parent key, the sub-task key and title, this PR's `name` and criteria in full, the worktree, branch, base and `baseSha`, the state file path and its lane id, the plugin root, and: "Run `forge:implement build`. Never call `forge_report`, never push, never commit."

## Build (`build`, in the PR's session)

1. Read this PR's criteria from the brief and its plan row; the row wins if they differ. A criterion no test can check is a finding: the plan needs fixing.
2. For each criterion, in order, with the test-driven development skill when installed. Before it, patch `{"rules": {"done": [<indices done>], "now": <its index>}}`. After it passes, patch `done` with its index and `now: null`, reply `Rule <n> of <total> holds.`, and end your turn: forge's main chat shows it and messages you "Continue with rule <n+1>". On that message, go on with the next criterion. After the last one, go on to step 3 without pausing.
   1. If it needs work outside this PR (files or behaviour the plan gave another PR, or none), that is a missing piece or a plan change: a finding.
   2. Write its test like the repo's own tests. Run it; it must fail for the expected reason. If it passes before any code and existing code already does what it asks, that is a finding (the file and line; choices "Narrow it", "Drop it", "Plan again").
   3. Write the least code that passes it, then refactor, and run the affected tests.
3. Follow `forge:cq-dotnet` for C#. Run the `code-review` skill at high effort with `--fix`; skip a finding that contradicts a criterion and say why.
4. Run the full suite. Red is a finding.
An agreed change (forge's **Agreements** rule) arrives as a message from forge's main chat with the new criteria and rules. Apply it at once, test first: change the tests to the new wording, then the code, the schema snapshots and every doc in the repo that states the old one (`git grep` for it), run the suite, and reply with each file changed. Then go on.
5. Leave every change unstaged: never commit, stage or stash. If something was committed or staged, undo it with `git reset --mixed <baseSha>`, which keeps the changes.
6. Hand back: patch `{"state": "review"}`. A finding instead: patch `{"state": "stopped", "stoppedFrom": "building", "finding": {...}}`. Reply with one line per criterion and its test, then end.
