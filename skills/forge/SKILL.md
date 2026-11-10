---
name: forge
description: Use when the user wants a ticket taken from planning to a clean, verified finish, or wants to continue that work. The only forge command the user calls.
argument-hint: [ticket key or link]
---

Forge takes one ticket through five steps: Plan, Implement, Deploy, Verify, Clean up. Each `/forge` works out where the ticket stands, does the next thing, and asks the user only what is theirs to decide. The user calls nothing else: every other forge skill is yours to call. Keep no state of your own: the state file is the truth.

The scripts run as `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/<name>"`. The state file is the path `registry.py where <parent-key>` prints. Change it only through `registry.py`, with the JSON on stdin through a quoted heredoc (`<<'EOF'`): `patch <lane id>` for a PR in work, `merge deploy|verify|cleanup|gaps` for the life-cycle records, `set-plan` and `fill` for the plan.

## Rules for everything the user sees

These hold for this skill and for every skill you call.

- **Words.** Write for someone who has never seen forge's insides. Name a PR by what it does, then its repo and number: "Remove the API scope (auth-api #42)", using the plan row's `name`. In chat (questions, cards, replies), never use shorthand: no codes, abbreviations or nicknames (not `S<n>·<m>`, "the S1·1 lane", "acc", "prod" or "PR 1"); write plain words; call a background session "the session building <name>". Never write a branch, a base, a session or a lane id, or the words lane, runner, watcher, raise, adopt, conductor, registry, slot, baseline, restack or stack. Never write how you checked (commits, SHAs, bases, forks, builds, tools, searches, "verified"): that goes into a report's `evidence` only.
- **Agreements.** When the user agrees a change to what a PR does (a contract, a rule, a name, an error code), carrying it everywhere is forge's job, not a question. Without asking, in the same turn, update every place that states it:
  1. the plan row: `registry.py <state file> row <pr>` with the new `criteria` and `rules`, in full, one plain rule per criterion (the same count);
  2. the tracker sub-task: its scope and acceptance criteria;
  3. the code, its tests, schema snapshots and the repo's docs (README, docs folder) that state it: in the PR's session while it builds or waits for review, as an unstaged change the user reviews with the rest; once the PR is open, test first, committed and pushed by the PR's follow session;
  4. the PR's title and description, when the PR is open (`gh pr edit`).
  Search each repo the plan names for the old wording (`git grep`), so nothing that states it is missed. Then send one card that names each place updated, one row each, and anything that could not be updated with why. Ask only when the agreement itself is unclear, never whether to update.
- **Review state.** Never say a PR needs review, needs someone, or is ready to merge from memory or from the plan. Every time you mention a PR's review or merge, for PRs forge opened and PRs made outside it alike, read it first: `gh pr view <n> --repo <owner/repo> --json reviewDecision,reviews,latestReviews,reviewRequests,mergeStateStatus,commits`, and the CODEOWNERS entry that owns each changed path (`gh pr diff <n> --name-only`; the last matching line of `.github/CODEOWNERS`, `CODEOWNERS` or `docs/CODEOWNERS` on the base branch). Then say the real state, in plain words:
  - who approved, and on which commit: the latest one, or an earlier one;
  - an approval a later push dismissed: "Sam's approval was dismissed by the push at 14:52";
  - who is still needed: the code owners for the changed paths that have not approved, and any requested reviewer;
  - nothing at all needed when GitHub's decision is `APPROVED` and every check passed: then the PR is ready to merge.
- **Holds.** The user can hold a PR ("don't merge it yet") or make it wait on a deploy ("merge it after the private stack is in production"). Write it on its plan row with `registry.py <state file> row <pr>`: `{"hold": "<why, in their words>"}`, or `{"mergeAfter": {"pr": "<the other PR>", "deployedTo": "production"}}`; `{"hold": null}` lifts it. Forge never asks to merge a held PR, and asks for a `mergeAfter` one only once the other PR's sub-task is `done` there in `deploy`.
- **Questions.** Ask with the question dialog (`AskUserQuestion`), one question at a time, one option per answer, each 1 to 3 words. The question says, in one sentence, what happens on the main answer, and names the change by what it does: "Fix the 13 review notes on Judge eligibility on price × quantity?", never "Send these 13 fixes back to the S1·1 lane?" (shorthand for the session that built it). Check every `ask`, `title`, `line`, option and blank against **Words** before you send it: no worktree paths, branch names or file-opening steps in what the user reads; name the change, and offer "Open editor", which opens the whole project. Never ask in prose: no "tell me when…", "let me know and I'll…" or a question mark outside the dialog, since prose has no buttons and no text box. The dialog's "Other" always lets the user type an answer instead; take a typed answer as their words. When the dialog comes back unanswered because the user sent a chat message instead ("[User did not answer … sent a message instead]"), that message is their answer: act on it, and never read the question's own text back as an answer. Never offer "request changes": the user edits code themselves.
- **Replies.** After a card, at most one sentence on what you did. Never repeat the card, list next steps, or restate links it shows.
- **Sessions.** Every session forge starts gets `cwd` set to a folder that is a git repository, never the folder this chat runs in: a PR's session to its worktree, the deploy watcher to the main checkout of the plan's first repo. Before `start_session`, check it: `git -C <folder> rev-parse --show-toplevel` must print that folder. A worktree is made by forge before the session starts (`implement start`), never by the session. If the check fails, make or repair the worktree first; never start the session somewhere else.
- **Cards.** Everything the user reads in a forge run is a card, drawn from its template in `${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`, sent as `forge_report` with `template` and `fill` (see its **Sending a card**) (review, commit, rule-start, rule-done, checks-failing, merge, merged, missing, deploy-failed, verify-ask, verify-failed, cleanup, done): never a status, a failure or a next step in prose. With the `forge_report` tool, send every finding, call and step change through it (see **forge-lens**), with the finding as `title`, what it means for the user as `line`, and how you know as `evidence`.

## Each run

1. **Find the ticket.** Reduce the argument to its parent key (a sub-task's key becomes its parent's). Without one, take the key in the current branch name (`keys.py branch "$(git branch --show-current)"`), else the one run in `~/.claude/forge/` whose repos include this folder. If none, ask which ticket, and stop.
2. **Read the state.** The ticket, its sub-tasks with their status and links, from the tracker. The state file. Every repo the plan names (`git -C <repo>`): its `<parent-key>-*` branches and worktrees, and the PRs from them. For each PR in work, whether its session still runs: the session list shows it running or idle; anything else, or an agent this session did not start, is gone. On the first read of a run, send the `started` report.
3. **Repair the state**, without asking:
   - Sub-tasks exist but the state file is missing or has no `plan`: rebuild it with `plan rebuild`.
   - Fill what the state file lacks with `registry.py fill`: the parent's title and type, the tracker URL, each sub-task's title, each PR's `name` (`{"names": {"<pr>": "<what it does, at most 5 words>"}}`), URL, number and repo. Every sub-task in the tracker counts, not only the plan's: a sub-task with no pull request (done by hand, or by another team) goes in as `{"tasks": [{"key", "title", "status"}]}`, its status refreshed on every run. Say what you filled in one line.
   - **Adopt pull requests opened by hand.** Search each repo the plan names, and each sub-task's repo, for PRs whose title or branch carries the parent key or a sub-task key (`gh pr list --repo <owner/repo> --state all --search "<key>"`). One that no PR in work names gets a lane with `registry.py upsert`: its `subTask` from the key, its repo, branch, `prNumber`, `prUrl`, and `state` `merged`, `open` or `stopped` (closed). Name it in one line; it shows in the pane from then on.
4. **Do the first thing that applies**, then go back to 2. Stop only when the user must answer, or when everything left is running.

   | State | Do |
   |---|---|
   | No sub-tasks | `plan <key>` |
   | A gap is being planned (`gaps.<n>.state` is `planning`) | `plan gap <n>` |
   | A PR was merged or closed outside forge | `ship merged <lane>` |
   | A PR in work stopped on a finding the user has not answered | Show the finding and ask (see **Findings**) |
   | A PR meets every merge rule (`call`) and its plan row has no `hold` and no `mergeAfter` still waiting | `ship merge <lane>` |
   | A built change waits for the user (`review`) | `ship review <lane>` |
   | A PR is ready to build and none of its base PRs is unbuilt, and a slot is free | `implement start <PRs>` |
   | A PR in work has lost its session | `implement restart <lane>` while it builds, `ship follow <lane>` once its PR is open |
   | A sub-task has every one of its PRs merged and is not live in production | `deploy`, which starts the deploy watcher if none runs (other sub-tasks keep building, merging and deploying on their own) |
   | A sub-task with no pull request is open, and everything else has moved as far as it can | Ask whether it is done ("Is <key> <title> done?" with "It's done" and "Not yet"); on "It's done", close it in the tracker |
   | Every sub-task is live (one with no PR: done in the tracker) and `plan.done` is missing or empty | A finding: "No done criteria" (choices "Plan them", which runs `plan replan` for them, and "Skip verify"). Never treat a missing list as passed |
   | Every sub-task is live and a done criterion is not checked | `verify` |
   | Every done criterion holds (or the user chose "Skip verify"), every sub-task is done, and the run is not cleaned up | `cleanup` |
   | Everything is clean | Say the ticket is done, and send the `delivered` report |
   | PRs are building or being followed | One line per PR in work: what it does and where it is. Then wait |

   A finding holds back only the PRs that depend on it: after showing it, go on with the rows for PRs that do not. Skip a PR whose `deferredAt` is later than this run's start; say it waits until the next `/forge`.
5. **When a session forge started ends a turn** (a note from a session in a PR's `runner`):
   - It is building and its note says `Rule <n> of <total> holds.`: send the `rule-done` card (`fill`: the PR's `name`, `n`, `total`, and `rule` the plan row's `rules[<n-1>]` in full). If a rule is left, send the `rule-start` card for rule <n+1> the same way and message the session `Continue with rule <n+1>`. Then stop: the pane shows the rest.
   - It is the deploy watcher (`watchers.deploy`): run steps 2 to 4 again (a failure is a `deploy-failed` card; every sub-task live goes on to Verify), then message it `Keep watching` unless it stopped.
   - Otherwise, run steps 2 to 4 again, as if the user typed `/forge`: the next question is asked without them calling.

   When a PR's session starts building, send the rule-start card for rule 1.

## Findings

A finding is something a step's rules do not cover. Show it as a card and ask, with its choices:

- **A missing piece**: something the ticket needs is in no sub-task (a caller nobody listed, a config the deploy needs, a criterion that cannot hold without more work). Send the `missing` card (`${CLAUDE_PLUGIN_ROOT}/skills/forge/templates.md`: what needs it, where it lives), choices "Plan it" (back to Plan: work it out, fit it in, add sub-tasks and PRs) and "Not needed". On "Plan it", record it with `merge gaps` (`{"<next index>": {"gap": "<what>", "found": "implement", "deploy" or "verify", "state": "planning"}}`) and run `plan gap <index>`. PRs that do not depend on it keep going.
- **A plan change**: a fact contradicts the plan (a guide, a reviewer, the code). Title "Plan change: <what>", sections `Now`, `Proposed` and `Why`, choices "Change the plan" (`plan replan <sub-task>`) and "Keep the plan". Never change the plan any other way.
- **Anything else**: the step's own finding, with its own choices. Pass the user's answer, in their words, to `implement restart <lane>` (while building) or `ship follow <lane>` (once open), which resumes the PR in the state it stopped from. "Drop" sets the PR `dropped`; its worktree and branch stay until Clean up.

You build nothing yourself: no worktree, branch, commit or code outside the skills above.

## forge-lens

Only this session calls `forge_report`; the sessions you start never do. Every report has `ticket` the parent key.
- `started`, once a run: no `lane`, `kind: started`, `title` the ticket's summary.
- One report per PR in work on every read: `lane` exactly `<lane id> · <PR>`, its state, `title` and `line` in the words above, `session` its runner, `pr` `{number, base}` once open. `needsYou: true` only on the one you ask about, with `ask` the same words as your question and `choices` `{label, then}`.
- A finding, a call, and a step finished: one report each, as above.
- Once everything is clean: no `lane`, the `done` card.
