---
name: verify
description: Use when forge has every sub-task of a ticket live in production and needs each done criterion checked there.
argument-hint: <parent key>
user-invocable: false
---

Verify checks that what "done" means holds in production. Follow `forge:forge`'s rules for everything the user sees. The criteria are the state file's `plan.done`, by index. Write each result with `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/registry.py" <state file> merge verify` and `{"<index>": "passed"}` (or `failed`), JSON on stdin through a quoted heredoc.

For each criterion not yet `passed`, in order:
- **By forge**, with its `source` and `how`. For Datadog, use the Datadog tools on post-deploy events since the production deploy: monitors, logs, APM spans, events and metrics, as `how` says. For another source (AWS, a log), run its check. It holds: `passed`. It does not: `failed`, and the `verify-failed` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: the result in plain numbers with a link to the source, every criterion's state; the query stays in `evidence`), with the choices "Plan a fix" (a missing piece: back to Plan) and "Accept it".
- **By the user**: send the `verify-ask` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: the criterion in full, the steps from its `how`, every criterion's state) and ask "Does done criterion <n> hold in production?" with "It holds" and "It doesn't". "It doesn't" is the same finding, in their words.

A criterion whose source cannot be read (no access, no data yet) is not `failed`: say what is missing in one line, and ask the user instead.

When every criterion is `passed`, say so in one line. Forge goes on to Clean up.
