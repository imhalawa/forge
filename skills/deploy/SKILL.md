---
name: deploy
description: Use when forge has a sub-task whose pull requests are all merged and needs it followed through testing, acceptance and production.
argument-hint: <parent key> | watch <parent key>
user-invocable: false
---

Deploy follows each sub-task to production. The pipelines run testing, acceptance and production in a chain on their own: forge never approves, starts or promotes a deploy; it only reads where each one is. Follow `forge:forge`'s rules for everything the user sees. Write what you read with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/registry.py" <state file> merge deploy`, JSON on stdin through a quoted heredoc: `{"<sub-task>": {"testing": "done", "acceptance": "running", "production": "pending"}}`, with `failed` for a failed deploy.

A sub-task is in an environment only when every one of its merged PRs is deployed there. Deploy counts sub-tasks, never PRs.

1. For each sub-task whose PRs are all merged and that is not yet `done` in production (a sub-task with a PR still open waits; it does not hold back the others), for each of its PRs: find the commit it merged as (`gh pr view <n> --json mergeCommit`) and its repo's deploy builds in TeamCity (the TeamCity tools: the repo's pipeline, its deploy builds per environment). Read, per environment, whether a deploy that contains that commit finished, runs, waits, or failed.
2. Write each sub-task's environments: `done` when every one of its PRs is deployed there, `running` while one is, `failed` when one failed, else `pending`.
3. Then, the first that applies:
   - A deploy failed: send the `deploy-failed` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: the failed step and its reason, each environment's state) and ask with "Plan a fix" (a missing piece: back to Plan) and "I'll handle it" (change nothing). Never re-run it.
   - Something still deploys: make sure the watcher runs (below), say in one line which sub-tasks are where, and stop.
   - Every sub-task is done in production: say so in one line. Forge goes on to Verify. Some are, others still build or merge: stop; forge comes back to them.

A repo with no deploy build in TeamCity is a finding: ask where it deploys from.

## The watcher

The pipelines move on their own, so forge checks them regularly. One watcher per ticket, a session of its own: start it with `start_session` (`initiation: user_asked`, `context: fresh`, `use_worktree: false`, title `<parent-key> deploys`) when a sub-task's last PR merges and no watcher runs (`watchers.deploy` is unset, or its session is gone), and record it with `merge watchers` and `{"deploy": {"kind": "session", "id": "<id>"}}`. Its brief: the parent key, the state file, the plugin root, and "Run `forge:deploy watch <parent key>`. Never call `forge_report`, never approve, start or re-run a deploy."

## Watch (`watch <parent key>`, in the watcher's session)

Every 3 minutes, run steps 1 and 2 above for every sub-task whose PRs are all merged and that is not `done` in production. The pane redraws from what you write, so a deploy that moves needs nothing more. End your turn, with one line, only when:
- a deploy failed: `Deploy failed: <sub-task> in <environment>.` Forge's main chat shows the `deploy-failed` card;
- a sub-task reached production: `<sub-task> is live in production.` Forge's main chat goes on to Verify once every sub-task is.

On the main chat's message `Keep watching`, go on. Stop, with `merge watchers` and `{"deploy": null}`, when every sub-task is `done` in production, or none is left to deploy: every sub-task with merged PRs is live, and the others still build. Forge starts a new watcher after the next merge.
