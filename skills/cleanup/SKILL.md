---
name: cleanup
description: Use when forge has a ticket verified in production and needs everything the run left behind removed, and the sub-tasks and ticket closed.
argument-hint: <parent key>
user-invocable: false
---

Clean up removes what the run made and closes its tickets. Follow `forge:forge`'s rules for everything the user sees. It deletes things, so ask first, once. Check each worktree first (step 1's checks), then send the `cleanup` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: what it removes and keeps, by repo, and the tickets it closes) and ask "Remove these and close <parent key>?" with "Clean up" and "Keep them".

On "Clean up", for each PR in the state file, in its repo (`git -C <repo>`), never from inside the worktree:
1. **Worktree:** remove it with `git worktree remove` only when `git -C <worktree> status --porcelain` is empty and the branch has nothing unpushed (`git rev-list --count origin/<branch>..<branch>` is 0). Otherwise keep it and name it.
2. **Branches:** a worktree kept in step 1 keeps its branch too, here and on `origin`: skip this step for it. Otherwise delete the local branch (`git branch -D`; a squash merge leaves it unmerged to git), and the one on `origin` (`git push origin --delete <branch>`) only when no open PR targets it (`gh pr list --base <branch> --state open` is empty). Never touch `upstream`.
3. **Session:** archive its session if it still exists.

Also remove any `<parent-key>-*` worktree or branch the state file does not name, with the same checks, and name each one. Then `git remote prune origin` and `git worktree prune` in every repo, and close each sub-task, then the ticket, in the tracker.

Write what is done with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/registry.py" <state file> merge cleanup`: `{"<sub-task>": {"worktrees": true, "branches": true, "sessions": true, "closed": true}}` per sub-task whose PRs are all cleaned and which is closed, and `{"pruned": true}`. Reply with what was removed and what was kept, one line each.

On "Keep them", change nothing and stop.
