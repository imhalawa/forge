---
name: deploy
description: Use when forge has a sub-task whose pull requests are all merged and needs it followed through testing, acceptance and production.
argument-hint: <parent key> | watch <parent key>
user-invocable: false
---

Deploy follows each sub-task to production. The pipelines run testing, acceptance and production in a chain on their own: forge never approves, starts or promotes a deploy; it only reads where each one is. Follow `forge:forge`'s rules for everything the user sees. Write what you read with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/registry.py" <state file> merge deploy`, JSON on stdin through a quoted heredoc: `{"<sub-task>": {"testing": "done", "acceptance": "running", "production": "pending"}}`, with `failed` for a failed deploy.

A sub-task is in an environment only when every one of its merged PRs is deployed there, on every deploy track its repo has. Deploy counts sub-tasks, never PRs. A sub-task with no PR has no deploy: it is done when the tracker says so.

**Where each repo deploys from** is the user's own map, `~/.claude/forge/pipelines.json`, never a guess or a search by name:

```json
{ "<repo folder name>": [ { "server": "<the TeamCity tools' server>", "project": "<project id>", "track": "<name, when the repo has more than one>", "note": "<how to find the project, when it differs per app>" } ] }
```

A repo with no entry is a finding: ask which TeamCity server and project id it deploys from (the dialog's "Other" takes the typed ids), and write the answer into the map, so it is asked once. A repo with more than one track (an API and a Lambda, say) is in an environment only when every track is.

1. For each sub-task whose PRs are all merged and that is not yet `done` in production (a sub-task with a PR still open waits; it does not hold back the others), for each of its PRs: find the commit it merged as (`gh pr view <n> --json mergeCommit`) and, for each of its repo's tracks in the map, that project's deploy builds per environment, on the map's server. A build contains the PR when the merge commit is its revision or an ancestor of it (`git -C <repo> fetch` then `git merge-base --is-ancestor <merge commit> <build revision>`): a later build carries it too. Read, per environment, whether a deploy that contains it finished, runs, waits in the queue, or failed.
2. Write each sub-task's environments: `done` when every one of its PRs is deployed there, `running` while one is, `failed` when one failed, else `pending`.
3. Then, the first that applies:
   - A deploy failed: send the `deploy-failed` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: the failed step and its reason, each environment's state) and ask with "Plan a fix" (a missing piece: back to Plan) and "I'll handle it" (change nothing). Never re-run it.
   - Merged, but no build contains it, and nothing runs or waits in the queue for over 30 minutes after the merge: nobody started the deploy, and forge never starts one. A finding: "Merged but not deployed: <sub-task title>", line "No deploy has started for it in <environment>. Forge never starts one.", choices "I started it" (watch again) and "Leave it". Never count it as deployed.
   - Something still deploys: make sure the watcher runs (below), say in one line which sub-tasks are where, and stop.
   - Every sub-task is done in production: say so in one line. Forge goes on to Verify. Some are, others still build or merge: stop; forge comes back to them.

A project in the map with no deploy builds is a finding too: ask whether the map is right.

## The watcher

The pipelines move on their own, so forge checks them regularly. One watcher per ticket, a session of its own: start it with `start_session` (`initiation: user_asked`, `context: fresh`, `cwd:` the main checkout of the plan's first repo (a git repository; check it with `git -C <repo> rev-parse --show-toplevel`), `use_worktree: false`, title `<parent-key> deploys`) when a sub-task's last PR merges and no watcher runs (`watchers.deploy` is unset, or its session is gone), and record it with `merge watchers` and `{"deploy": {"kind": "session", "id": "<id>"}}`. Its brief: the parent key, the state file, the plugin root, and "Run `forge:deploy watch <parent key>`. Never call `forge_report`, never approve, start or re-run a deploy."

## Watch (`watch <parent key>`, in the watcher's session)

Every 3 minutes, run steps 1 and 2 above for every sub-task whose PRs are all merged and that is not `done` in production. The pane redraws from what you write, so a deploy that moves needs nothing more. End your turn, with one line, only when:
- a deploy failed: `Deploy failed: <sub-task> in <environment>.` Forge's main chat shows the `deploy-failed` card;
- a sub-task reached production: `<sub-task> is live in production.` Forge's main chat goes on to Verify once every sub-task is.

On the main chat's message `Keep watching`, go on. Stop, with `merge watchers` and `{"deploy": null}`, when every sub-task is `done` in production, or none is left to deploy: every sub-task with merged PRs is live, and the others still build. Forge starts a new watcher after the next merge.
