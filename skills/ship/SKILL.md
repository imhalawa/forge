---
name: ship
description: Use when forge has a built change waiting for the user's review, a pull request to follow through checks and reviews, a pull request that meets every merge rule, or one merged or closed outside forge.
argument-hint: review <lane id> | follow <lane id> | merge <lane id> | merged <lane id>
user-invocable: false
---

Ship takes a built change to a merged pull request. Follow `forge:forge`'s rules for everything the user sees. The scripts run as `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/<name>"` (in a brief, as absolute paths). Change a PR in work only with `registry.py <state file> patch <lane id>`, the changed fields as JSON on stdin through a quoted heredoc.

Never push to `upstream`. Never reply to, comment on or resolve a review thread. Never bypass a merge rule (`--admin`, a skipped check). No AI attribution in a commit, title or body.

**Remotes.** In the PR's repo: same repo when there is no `upstream` or it names the same `owner/repo` as `origin` (`<remote>` is `origin`); a fork otherwise (`<remote>` is `upstream`, the PR lives in upstream's repo, and `<fork-owner>` is origin's owner). Pass `--repo <owner/repo>` to every `gh` call. `<target>` is what the branch rebases onto: `<remote>/<default>`, or for a PR built on another `origin/<base>` (the default branch once that base has merged).

## Review (`review <lane id>`)

The user reviews and stages; forge commits. Read the change: `git -C <worktree> diff --stat` (unstaged) and `git -C <worktree> diff --cached --stat` (staged). Send the card that fits and ask its question:

- **Nothing staged:** the `review` card (`fill`: `name`, `repo`, `files` changed, `rules` the plan row's rules), then "Open it in your editor?" with "Open editor" and "Later". On "Open editor", open the whole worktree as a project, never a single file: `open -a "Visual Studio Code" <worktree>` by default (the `editor` setting: `cursor`, `zed` and `idea` open their app the same way; a command with `{path}` runs with the worktree in its place), run once, and stop: the next `/forge` finds what they staged.
- **Something staged:** the `commit` card (`fill`: `name`, `repo`, `prTitle`, `commit`, and each staged file from `git diff --cached --numstat`), then "Commit the staged files and open the pull request?" with "Open PR" and "Later". The card shows the PR title, the commit message and each staged file; unstaged files are not shown and stay in the worktree, out of the PR.

The same holds when the user answers "Open PR", says they staged, or a commit finds nothing staged: read the worktree again and send the card that fits, never a prose reply. Nothing staged is the review card again with `nothingStaged: true` ("Nothing is staged yet for the <name> in <repo>."), with "Open editor" under it. On "Later", patch `deferredAt` to now and stop. On "Open PR":
1. Commit exactly what is staged, never `-a`: `git -C <worktree> commit -m "<parent-key> <what the change does, in the repo's commit style>"`.
2. Fetch, then rebase with `--autostash`: `git -C <worktree> rebase --onto <target> <baseSha>` when a base PR's branch was rewritten (`git merge-base --is-ancestor <baseSha> <target>` exits 1), else `git -C <worktree> rebase <target>`. Set `baseSha` to `git rev-parse <target>`. A conflict: `rebase --abort`, and a finding (the files; choices "I'll resolve it" and "Leave it").
3. Build and run the full suite. Red: patch `state: building` and send the failing tests to the PR's session to fix (`implement restart <lane>` with them as the answer).
4. Check every subject starts with the parent key and no body credits an AI (`keys.py check <parent-key>` on `git log <baseSha>..HEAD --format=%s`); reword any that fail without an editor.
5. Push to `origin` (`--force-with-lease` only over a rewrite). Open the PR with its title `<parent-key> <name in the repo's PR style>` and a body from the repo's PR template: what changed and why, the parent ticket and sub-task, and each criterion with its test. By shape:
   - same repo: `gh pr create --base <default or base branch> --head <branch>`;
   - fork, not built on another: `gh pr create --repo <upstream> --base <default> --head <fork-owner>:<branch>`;
   - fork, built on another: a draft into `<default>` with the line `Depends on #<base PR>; review only the commits after <base sha>`, and `prDraftOf` the base lane.
6. Patch `state: open`, `prNumber`, `prUrl`, `deferredAt: null`, and move the sub-task to the tracker's review status. Start following it (`follow`, below, in the PR's session: message it if it runs, else start a fresh one with the follow brief, `cwd: <worktree>` and `use_worktree: false`, after the same check as `implement`'s). Say in one line where the PR is.

## Follow (`follow <lane id>`, in the PR's session)

Its brief carries the PR number, repo, worktree, branch, base, `baseSha`, state file and lane id. Poll about every minute while checks run, every few minutes after; until the PR merges or closes. At `call` (every merge rule met, waiting on the user), poll every 30 minutes for at most 2 hours, then end with one line; forge starts a new follow when something changes. A PR whose plan row has a `hold`, or whose `deferredAt` is set, ends its follow at once: nothing it reads can move it on, and forge follows it again once the hold is lifted. Each poll:
1. `gh pr view <n> --json state,mergeStateStatus,reviewDecision`. Merged: end. Closed: patch `state: stopped`, `stoppedFrom`, `prClosed: true` and a finding (choices "Reopened it" and "Drop it"), and end.
2. **Checks** (`gh pr checks <n>`): while they run, `ci`. A failed one: read its log and the base's latest run of the same check. The base fails it the same way: not ours; change nothing, state `failed`, and re-run it once the base is green. The base passes it: ours; write a failing test that shows it, fix, run the suite, commit with the parent key, push, state `fixed`. No base run to compare: a finding. Each case sends its `checks-failing` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`): the case in the title, what forge does in one sentence, and every failure with its location when it has one and its reason.
3. **Comments**, from review comments, reviews and conversation comments, each above its mark in `seen`, oldest first, moving the mark past each. Check each against the code, the criteria and the house rules:
   - valid (a real fault that agrees with every criterion): fix it test first, commit, push, state `fixed`;
   - invalid (wrong about the code, or against a criterion): change nothing, add a note `{at, kind: "rejected", text}`;
   - a question for the user: change nothing, add a note `{kind: "question"}`.
   Before any fix, fast-forward to `origin/<branch>` if someone pushed; a diverged branch is a finding. Never reply or resolve.
3b. **An agreed change**, a message from forge's main chat with the new criteria and rules: fast-forward first, then change the tests to the new wording, the code, the schema snapshots and every doc in the repo that states the old one (`git grep` for it), test first; run the suite, commit with the parent key, push, and update the PR's description to match (`gh pr edit --body`). Reply with each file changed.
4. **State**, the first that applies: `changes` (fixing a comment), `failed`, `fixed`, `ci`, `call` (every merge rule met), `approved`, `passed`. Every merge rule is met when the PR targets the default branch (every base PR merged), has its required approvals, every check passed, every thread resolved, and `mergeStateStatus` is `CLEAN`.

## Merge (`merge <lane id>`)

Check the plan row first: a `hold` means stop, and say in one line that it is held and why. A `mergeAfter` means stop until `deploy.<the other PR's sub-task>.<deployedTo>` is `done`; say in one line what it waits on. Then check the rules again from the PR and the branch protection. Any not met: say which and what is missing, and stop. All met: send the `merge` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`): each rule met with its numbers, and what merging does next. Ask "Merge the <name>?" with "Merge" and "Later". On "Merge":
1. Merge with the method the repo allows and its history shows (squash, merge commit or rebase), without `--delete-branch`. If the repo deletes branches on merge, first point each PR built on this one at this one's base (`gh pr edit --base`).
2. Patch `state: merged`. For each PR built on it (`registry.py restack <lane id>`): rebase its own commits onto the new base (`git rebase --onto <remote>/<newBase> <baseSha>`), push with `--force-with-lease`, point its PR at the new base (a fork draft: drop its "Depends on" line and mark it ready), patch `base`, `baseRef`, `baseSha`, `dependsOn` and `state: ci`, and tell its session. A dirty worktree or a conflict: point its PR at the new base anyway, then a finding.
3. Move the sub-task to the tracker's done status once all its PRs are merged, and run `deploy <parent key>`: it reads where the sub-task is and starts the deploy watcher. Send the `merged` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`): each step done, or the conflict with its files and the question.

## Merged outside forge (`merged <lane id>`)

Read the PR. Merged: run Merge from step 2. Closed unmerged: patch `state: stopped`, `prClosed: true` and a finding with "Reopened it" and "Drop it".
