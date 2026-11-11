---
name: cleanup
description: Use when forge has a ticket verified in production and needs everything the run left behind removed, and the sub-tasks and ticket left done in the tracker.
argument-hint: <parent key>
user-invocable: false
---

Clean up removes what the run made and leaves its tickets done. Follow `forge:forge`'s rules for everything the user sees. It deletes things, so ask first, once. Check each worktree first (step 1's checks), then send the `cleanup` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: what it removes and keeps, by repo, and the tickets it marks done) and ask "Remove these and mark <parent key> done?" with "Clean up" and "Keep them".

On "Clean up", for each PR in the state file, in its repo (`git -C <repo>`), never from inside the worktree:
1. **Worktree:** remove it with `git worktree remove` only when `git -C <worktree> status --porcelain` is empty and the branch has nothing unpushed (`git rev-list --count origin/<branch>..<branch>` is 0). Otherwise keep it and name it.
2. **Branches:** a worktree kept in step 1 keeps its branch too, here and on `origin`: skip this step for it. Otherwise delete the local branch (`git branch -D`; a squash merge leaves it unmerged to git), and the one on `origin` (`git push origin --delete <branch>`) only when no open PR targets it (`gh pr list --base <branch> --state open` is empty). Never touch `upstream`.
3. **Session:** archive its session if it still exists.

Also remove any `<parent-key>-*` worktree or branch the state file does not name, with the same checks, and name each one. Then `git remote prune origin` and `git worktree prune` in every repo. Last, the tracker, following forge's **Done status** rule: each sub-task, then the ticket, already in a done status (Merge moved the sub-tasks there) stays where it is; one that is not goes to `plan.doneStatus`, with the transition looked up for that issue. Never close an issue: Closed is not done here, unless the user asks for it.

Write what is done with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/registry.py" <state file> merge cleanup`: `{"<sub-task>": {"worktrees": true, "branches": true, "sessions": true, "closed": true}}` per sub-task whose PRs are all cleaned and which is in a done status, and `{"pruned": true}`. Reply with what was removed and what was kept, one line each.

On "Keep them", change nothing and stop.
