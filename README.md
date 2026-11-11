# forge

[![Tests](https://github.com/imhalawa/forge/actions/workflows/tests.yml/badge.svg)](https://github.com/imhalawa/forge/actions/workflows/tests.yml)

forge is a [Claude Code](https://code.claude.com) plugin and mod. It takes one ticket from planning to a verified, cleaned-up finish, and you call only one command: `/forge`.

Each time you run it, forge works out where the ticket stands, does the next thing, and asks you only what is yours to decide: one question at a time, with buttons. A side pane shows the whole ticket as a tree, live.

## The life cycle

| Step | What forge does | What you do |
|---|---|---|
| 1. Plan | Investigates the current state, what "done" means and how each part of it is verified. Breaks the work into sub-tasks and pull requests, and creates the sub-tasks in your tracker. | Confirm the problem, the approach and the sub-tasks. |
| 2. Implement | Builds each pull request in its own worktree, test first, one rule at a time, and leaves the change unstaged. Commits only what you staged, opens the pull request, follows its checks and reviews, and fixes what is its own fault. | Review and stage each change in your editor. Approve opening and merging. |
| 3. Deploy | Follows each sub-task through testing, acceptance and production as soon as its pull requests merge, checking the pipeline every 3 minutes. Never approves, starts or re-runs a deploy. | Nothing, unless a deploy fails. |
| 4. Verify | Checks each done criterion in production when a source can prove it, such as a Datadog query. | Check the criteria nothing can prove, with the steps Plan wrote down. |
| 5. Clean up | Removes the worktrees, branches and sessions it made, and leaves the sub-tasks and the ticket in the tracker's done status (Resolved or Done, never Closed). Keeps anything not committed and pushed. | Say yes. |

A missing piece found later goes back to Plan: forge works out the gap, fits it in, and adds sub-tasks and pull requests for it.

## What you see

- **The pane:** a tree of the five steps. Each sub-task has its pull requests under it, with CI, reviewers and size. While a change builds, a section below the tree ticks off its rules. Amber marks what needs you, and nothing else is amber.
- **Cards in the chat:** every report is drawn from a fixed template (review, commit, checks failing, ready to merge, merged, missing piece, deploy failed, verify, clean up, done). Forge fills in the blanks and the mod writes the words, so every card of one kind reads the same.
- **Questions:** always the question dialog, never prose. "Other" always lets you type your own answer.

## Requirements

- Claude Code with mods (the desktop app shows the pane and the cards).
- `git`, and [`gh`](https://cli.github.com) signed in with `gh auth login`.
- Python 3, for the state scripts. They use only the standard library.
- A tracker connected to Claude Code, for tickets and sub-tasks. Jira is the one forge is used with.
- For Deploy, the TeamCity tools in Claude Code. For Verify by forge, the Datadog tools. Without them, forge asks you instead.
- VS Code, where you review and stage each change.

## Quick start

1. Install the plugin:
   ```
   /plugin marketplace add imhalawa/forge
   /plugin install forge@forge
   ```
2. Restart Claude Code.
3. In a repository the ticket touches, run `/forge PROJ-123` (or `/forge:forge PROJ-123`). After that, `/forge` alone carries on with the ticket from the branch you are on.

## Safety

- Never pushes to an `upstream` remote, and never bypasses a merge rule.
- Never merges, opens a pull request or cleans up without your answer.
- Never replies to or resolves a review thread.
- Never removes a worktree or branch with work that isn't committed and pushed.
- No AI attribution in commits, pull requests or comments.

State lives in `~/.claude/forge/<ticket>.json`, one file per ticket.

## Inside

| Part | Where |
|---|---|
| The skills: `forge`, the only one you call, and `plan`, `implement`, `ship`, `deploy`, `verify`, `cleanup` | `skills/` |
| The card templates | `skills/forge/templates.md`, drawn by `hooks/lens/templates.tsx` |
| The pane and the cards | `hooks/register.tsx`, `hooks/lens/` |
| The UI kit, shared with the author's other mods | `hooks/kit/` |
| The state file | `scripts/registry.py` |
| The design | [docs/design.md](docs/design.md) |

`cq-dotnet` and `capture-rule` are the C# code rules forge follows when it writes C#, and a skill that adds a rule you state to them.

## Checks

```bash
python3 -B -m unittest discover -s tests
claude plugin test .
claude plugin validate .
claude plugin eval . --runs 1
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
