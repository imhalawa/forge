# Forge card templates

Forge's chat cards are drawn from fixed templates. The model fills in the blanks; the mod writes the sentences. Every card is drawn in full. A card never shows facts or evidence. Amber marks a card that needs the user; no tag repeats it.

Each template below is agreed with the user one at a time, with its drawing.

## review (agreed 2026-11-10)

Sent when a change is built and waits for the user to review and stage it.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Review the {name} |
| Line | {files} files ready to stage in {repo}. (1 file: "1 file ready …") |
| Section | **Rules**: every rule of the change, one bullet each, in full |
| Question | Open it in your editor? |
| Buttons | Open editor · Later |

| Blank | Comes from | Rule |
|---|---|---|
| name | the plan row's short name | at most 4 words |
| files | changed files in the worktree | a number |
| repo | the repo folder's name | filled by the mod |
| rules | the plan row's `rules` | each "When <condition>, <every outcome>.", no test names |

"Open editor" opens the worktree in the `editor` setting. "Later" leaves it; the card comes back on the next `/forge`.

## commit (agreed 2026-11-10)

Sent when the user has staged files: what the pull request will hold, before forge commits.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Open a pull request for the {name} |
| Line | {staged} files staged in {repo}. |
| Tree | The pull request's title; under it the commit's message; under that each staged file with `+added −removed` |
| Question | Commit the staged files and open the pull request? |
| Buttons | Open PR · Later |

| Blank | Comes from |
|---|---|
| prTitle | `<parent-key> <name in the repo's PR style>` |
| commit | `<parent-key> <what the change does, in the repo's commit style>` |
| files | `git diff --cached --numstat` |

Unstaged files are never shown; they stay in the worktree, out of the pull request.

## rule-start and rule-done (agreed 2026-11-10)

Sent in the main chat, one rule at a time, while a change is built: when a rule starts, and when it holds. The pane's lower section lists every rule of the change with its state, live.

| Part | rule-start | rule-done |
|---|---|---|
| Icon | running (blue) | done (green) |
| Title | Building rule {n} of {total} in the {name} | Rule {n} of {total} holds in the {name} |
| Line | the rule, in full | the rule, in full |
| Question | none | none |

The building session pauses after each rule; the main chat posts rule-done, then rule-start for the next rule, and tells the session to go on.

## Pane: building section (agreed 2026-11-10)

Below the tree, one section per change being built: "Building the {name}", "{done} of {total}" on the right, then every rule in full with ✓ done, a spinner for the rule being built, a grey circle for not started. It goes away when the change waits for review.

## checks-failing (agreed 2026-11-10)

Sent when a check fails on an open pull request. Built from a heading, a paragraph and a tree; colour only on icons; every text at 14px; no tinted rows or inner panels.

| Case | When | Icon | Title | Paragraph | Question |
|---|---|---|---|---|---|
| A | the base passes the same check | failed (red) | {check} fail(s) on the {name} | Forge is fixing them and pushes when they pass. | none |
| B | the base fails it the same way | waiting (grey clock) | {check} fails on {base} too | Forge runs it again once {base} passes. | none |
| C | the base has no run to compare | needs you (amber) | {check} fails, cause unknown | {Why forge can't compare}. | Fix the {check}? · Fix it · Leave it |

{base} is the base's real name: the default branch, or the change this one builds on.

**The tree.** Each failing check is a node: its state icon, its name (linked to its run when forge can reach it), and "· {count}" when more than one test fails. Under it, one row per failure: the location in mono (file, and line when there is one) and the reason on the next line. Every part of a row but the reason is optional: a compile error or a timeout has no location. Failures in one file with one reason, as the check's output gives it, group under the file with "· {count}"; otherwise each is its own row. Every failure is listed; nothing is cut. Below the tree, one wrapping row of the other checks, icon and name only: passed, running, waiting, skipped, cancelled, each its own icon shape, the state as its alt text.

Desktop draws the kit's tree lines; the terminal draws text tree lines. Colours are theme keys, never fixed values.

## merge (agreed 2026-11-10)

Sent when a pull request meets every merge rule.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Ready to merge: the {name} |
| Paragraph | Every merge rule is met in {repo} #{number} (a link to the pull request). |
| List | Each merge rule with a ✓ and its numbers: "{passed} of {total} checks passed", "Approved by {who}, {got} of {needed} needed", "Every review thread resolved", "Up to date with {base}, no conflicts" |
| Section | **When it merges**: the merge method ("Squashed into one commit on {base}"), each change built on this one that moves ("The {name} moves onto {base} and its pull request targets {base}"), and the sub-task that moves to done |
| Question | Merge the {name}? · Merge · Later |

A rule the repo does not have (no required approvals) is left out, never shown as met.

## merged (agreed 2026-11-10)

Sent once a pull request merges, by forge or outside it.

| Case | Icon | Title | Paragraph | List | Question |
|---|---|---|---|---|---|
| All went through | merged (purple) | Merged: the {name} | {repo} #{number} (link) is on {base}. | ✓ each step done: the merge method, each change moved onto {base} ("its checks run again"), the sub-task done | none |
| A later change conflicts | needs you (amber) | Merged, but the {later name} conflicts with {base} | Its pull request now targets {base}, but its commits don't apply cleanly. | ✓ steps done; ✗ "The {later name} conflicts in" with each file under it in mono | Resolve the {later name}'s conflicts yourself? · I'll resolve it · Leave it |
| Merged outside forge | merged (purple) | Merged on GitHub: the {name} | Forge saw it merge and carried on from there. | ✓ the steps forge did after it | none |

## missing (agreed 2026-11-10)

Sent when the ticket needs something no sub-task covers, found while building, deploying or verifying.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Missing: {what} |
| Paragraph | Found while {building the name / deploying / verifying}. Without it, {effect}. |
| Section | **Needs it**: each rule and done criterion that depends on it, in full, a rule icon or a target icon before each |
| Section | **Where it lives**: each repo, with "· no sub-task covers this repo" when none does; under it each location in mono (file, and line when known) and what the code does there now |
| Question | Plan the missing piece and add it to {ticket}? · Plan it · Not needed |

Every part of "Where it lives" but the repo is optional.

Dropped: deploy-approve. The pipelines run testing, acceptance and production in a chain; nobody approves a deploy, and forge only follows it.

## deploy-failed (agreed 2026-11-10)

Sent when a sub-task's deploy fails in an environment.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | {Environment} deploy failed: {sub-task key} |
| Paragraph | {Sub-task title} is live in {environments done}. The chain stopped at {environment}, so {next environments} won't start. |
| Section | **What failed**: the deploy, linked to its run; under it the failing step and its reason |
| Section | **Environments**: testing, acceptance, production, each with its state icon |
| Question | The {environment} deploy for {sub-task key} failed. What next? · Plan a fix · I'll handle it |

Forge never re-runs a deploy. "Plan a fix" is a missing piece (back to Plan); "I'll handle it" leaves it to the user, and forge reads the chain again on the next run.

## verify-ask (agreed 2026-11-10)

Sent when a done criterion is the user's to check in production.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Check in production: done criterion {n} of {total} |
| Paragraph | the criterion, in full |
| Section | **How to check**: the steps from the plan's `how`, one bullet each, links kept |
| Section | **Done criteria**: every criterion with its state icon, "checked by forge in {source}" or "yours"; only the one waiting is amber |
| Question | Does done criterion {n} hold in production? · It holds · It doesn't |

"It doesn't" is a finding in the user's words.

## verify-failed (agreed 2026-11-10)

Sent when forge's own production check of a done criterion fails.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Doesn't hold in production: done criterion {n} of {total} |
| Paragraph | the criterion, in full |
| Section | **What forge found**: the result in plain numbers since the production deploy, with a link to the source ("Open in Datadog"); never the query |
| Section | **Done criteria**: every criterion with its state icon and who checks it |
| Question | Done criterion {n} doesn't hold. What next? · Plan a fix · Accept it |

## cleanup (agreed 2026-11-10)

Sent once every done criterion holds; forge asks before removing anything.

| Part | Text |
|---|---|
| Icon | needs you (amber) |
| Title | Clean up {ticket} |
| Paragraph | Every done criterion holds in production. Forge removes what it made for this ticket and leaves it done in the tracker. |
| Section | **Removes**: a tree by repo; under each, each worktree in mono with "Worktree, its branch here and on GitHub" (or what applies); then "{n} building sessions, archived" |
| Section | **Keeps** (only when something is kept): a tree by repo; under each, the worktree with an amber icon and why ("2 changed files not committed. Forge never removes work that isn't pushed.") |
| Section | **Marks done**: the sub-tasks, then the ticket, each one not yet in the done status; never Closed |
| Question | Remove these and mark {ticket} done? · Clean up · Keep them |

## done (agreed 2026-11-10)

The last card of a run; no question.

| Part | Text |
|---|---|
| Icon | done (green) |
| Title | {ticket} is done |
| Paragraph | {Ticket title} is live in production since {time}, every done criterion holds, and everything forge made is cleaned up. |
| Section | **Sub-tasks**: each sub-task (linked) with its merged pull requests under it (linked, by short name) |
| Section | **Done criteria**: each with a ✓ and who checked it ("forge, {source}" or "you") |

## Sending a card

Send every card with `forge_report` as `{"ticket": "<parent key>", "lane": "<lane id> · <PR>" (when it is a PR's), "template": "<name>", "fill": {…}}`. Leave out kind, needsYou, state, title and line: the card writes them from the template. A wrong or missing blank is refused with its path ("rules must be a list"); send it again with it right. Free-form reports (title, line, sections) are only for planning cards and for what no template covers.

The blanks of each template, as the mod checks them. `str` is text, `num` a number, `bool` true or false, a trailing `?` optional, `[...]` one of those words, `{ arr: X }` a list of X, `{ obj: X }` an object, `opt: true` optional:

```
review: { name: 'str', repo: 'str', files: 'num', rules: { arr: 'str' }, nothingStaged: 'bool?', worktree: 'str?' },
commit: { name: 'str', repo: 'str', prTitle: 'str', commit: 'str', files: { arr: { path: 'str', added: 'num', removed: 'num' } } },
'rule-start': { name: 'str', n: 'num', total: 'num', rule: 'str' },
'rule-done': { name: 'str', n: 'num', total: 'num', rule: 'str' },
'checks-failing': {
  name: 'str', case: ['ours', 'base', 'unknown'], base: 'str?', why: 'str?',
  failing: { arr: { check: 'str', link: 'str?', count: 'num?', failures: { arr: { location: 'str?', reason: 'str', count: 'num?' } } } },
  others: { arr: { check: 'str', state: ['passed', 'running', 'waiting', 'skipped', 'cancelled'] }, opt: true },
},
merge: {
  name: 'str', repo: 'str', number: 'num', link: 'str?', base: 'str', checks: { obj: { passed: 'num', total: 'num' } },
  approvals: { obj: { who: { arr: 'str' }, got: 'num', needed: 'num' }, opt: true },
  method: ['squash', 'merge', 'rebase'], moves: { arr: 'str', opt: true }, subTask: 'str?',
},
merged: {
  name: 'str', repo: 'str', number: 'num', link: 'str?', base: 'str', case: ['clean', 'conflict', 'outside'],
  method: ['squash', 'merge', 'rebase'], moves: { arr: 'str', opt: true }, subTask: 'str?',
  conflict: { obj: { name: 'str', files: { arr: 'str' } }, opt: true },
},
missing: {
  what: 'str', found: ['building', 'deploying', 'verifying'], foundIn: 'str?', effect: 'str', ticket: 'str',
  needs: { arr: { kind: ['rule', 'done'], text: 'str' } },
  where: { arr: { repo: 'str', covered: 'bool?', locations: { arr: { location: 'str?', reason: 'str' }, opt: true } } },
},
'deploy-failed': {
  subTask: 'str', title: 'str', env: ['testing', 'acceptance', 'production'], link: 'str?', step: 'str', reason: 'str',
  envs: { obj: { testing: ['done', 'running', 'failed', 'pending'], acceptance: ['done', 'running', 'failed', 'pending'], production: ['done', 'running', 'failed', 'pending'] } },
},
'verify-ask': {
  n: 'num', total: 'num', criterion: 'str', steps: { arr: 'str' },
  criteria: { arr: { text: 'str', state: ['passed', 'failed', 'pending'], by: 'str' } },
},
'verify-failed': {
  n: 'num', total: 'num', criterion: 'str', found: 'str', source: 'str', link: 'str?',
  criteria: { arr: { text: 'str', state: ['passed', 'failed', 'pending'], by: 'str' } },
},
cleanup: {
  ticket: 'str', sessions: 'num?', closes: { arr: 'str' },
  removes: { arr: { repo: 'str', worktrees: { arr: { name: 'str', what: 'str' } } } },
  keeps: { arr: { repo: 'str', worktrees: { arr: { name: 'str', why: 'str' } } }, opt: true },
},
done: {
  ticket: 'str', title: 'str', since: 'str',
  subTasks: { arr: { key: 'str', title: 'str', link: 'str?', prs: { arr: { number: 'num', name: 'str', link: 'str?' } } } },
  criteria: { arr: { text: 'str', by: 'str' } },
},
```

## Rules for every card and question (agreed 2026-11-10)

- In a forge run, everything the user reads is a card from a template. Prose only as one sentence after a card.
- Every question goes through the question dialog, whose "Other" option always lets the user type an answer. Never ask in prose ("tell me and I'll …"): it has no buttons and no text box.
