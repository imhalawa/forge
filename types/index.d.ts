export type ForgeReport = {
  ticket: string                // the parent ticket's key, "PROJ-123", from every report
  lane?: string                 // "<lane id> · <PR>", "wt-2 · S1·2"; absent for the conductor
  kind: 'planning' | 'started' | 'progress' | 'finding' | 'review' | 'raised'
      | 'comment' | 'ci' | 'merge-ready' | 'merged' | 'restacked' | 'delivered'
  needsYou: boolean
  ask?: string                  // when needsYou: the one line for the band and the Now box, e.g. "Merge PR #41"
  title: string                 // one line
  line: string                  // one sentence
  facts?: [string, string][]    // branch, base, PR, why first…
  sections?: { label: string; items: string[] }[]   // 3 items at most each
  evidence?: { label: string; text: string }[]      // file:line, query and result, diff, log
  choices?: { label: string; then: string }[]       // what happens on each
  state?: 'pending' | 'building' | 'queue' | 'waits' | 'stopped' | 'review' | 'call'
        | 'open' | 'ci' | 'passed' | 'failed' | 'changes' | 'fixed' | 'approved'
        | 'merged' | 'rebased' | 'done' | 'confirmed'   // one icon each, see below
  pr?: { number: number; base: string; checks?: [passed: number, total: number];
         approvals?: number; fixed?: number }
  step?: string                 // "criterion 2 of 3"; in planning, "Problem" | "Approach" | "Sub-tasks"
  session?: string              // the lane runner's session or agent id
  template?: string             // a card template's name (skills/forge/templates.md); the card is drawn from it
  fill?: Record<string, unknown> // the template's blanks
}

export type LensState = {
  ticket?: string
  title?: string
  planning?: ForgeReport[]
  conductor?: ForgeReport       // the conductor's latest report (no lane)
  lanes: Record<string, ForgeReport>
  feed: ForgeReport[]
  needsYou: string[]
  delivered?: boolean          // the conductor reported `delivered`
}

// The lane registry, `<git-common-dir>/forge/<parent>.json`, as plan, lanes and implement write it.
export type PlanRow = {
  pr: string                    // "S1·2"
  subTask: string               // the sub-task's key
  title?: string                // the sub-task's title
  base: string                  // the default branch, or the PR it stacks on
  criteria?: string[]
  // Each criterion again as a plain rule, same order: what the person reads on a card.
  rules?: string[]
  dependsOn?: string[]
  slug?: string
  name?: string                 // what the PR does, in words: "Empty the IAM stack"
  repo?: string                 // the local clone's root, absolute
  hold?: string                 // why it must not merge yet; forge never asks to merge a held PR
  mergeAfter?: { pr: string; deployedTo: Environment } // merge only once that PR is deployed there
}

export type Lane = {
  id: string                    // "wt-2"
  subTask: string
  pr: string
  branch: string
  base: string
  state: string                 // the registry state, `dropped` included
  prNumber?: number | null
  dependsOn?: string[]
  runner?: { kind: string; id: string } | null
  readyAt?: string | null
  repo?: string                 // the local clone's root, absolute
  worktree?: string
  prUrl?: string | null
  rules?: { done: number[]; now: number | null }   // while it builds: the plan row's rules, by index
}

export type Registry = {
  parent?: string | null
  plan?: {
    prs: PlanRow[]
    parent?: { key: string; title?: string; type?: 'story' | 'bug' | 'task' }
    trackerUrl?: string         // "https://example.atlassian.net"
    done?: DoneCriterion[]      // what must hold in production, and how it is checked
    tasks?: { key: string; title?: string; status?: string }[] // sub-tasks with no pull request, from the tracker
  }
  lanes: Lane[]
  deploy?: Record<string, Partial<Record<Environment, StepState>>>   // per sub-task
  verify?: Record<string, StepState>                                  // per done criterion, by index
  cleanup?: Record<string, CleanupState | boolean>                    // per sub-task, and `pruned`
  gaps?: Record<string, Gap>                                          // missing pieces found after planning, by index
  watchers?: { deploy?: { kind: string; id: string } | null }        // the session that follows deploys
}

export type Environment = 'testing' | 'acceptance' | 'production'
// A missing piece found after planning: what it is, which step found it, and the sub-tasks that fill it.
export type Gap = { gap: string; found?: 'implement' | 'deploy' | 'verify'; state: 'planning' | 'planned'; subTasks?: string[] }
export type StepState = 'pending' | 'running' | 'done' | 'failed' | 'passed' | 'waiting' // waiting: merged, and nobody started its deploy
export type DoneCriterion = { criterion: string; by: 'forge' | 'you'; source?: string; how?: string }
export type CleanupState = { worktrees?: boolean; branches?: boolean; sessions?: boolean; closed?: boolean }

// Every registry of the repo the session runs in, by parent key, as last read.
export type Registries = {
  dirs?: string[]               // where registries are read: ~/.claude/forge, then the repo's legacy <common>/forge
  place?: string                // the session's repo root, else its folder: what a run must touch to be shown
  remote?: string | null        // origin's URL
  branch?: string               // the session's branch
  files: Record<string, { path: string; mtimeMs: number; registry: Registry }>
}

// What GitHub says about one pull request, as on-my-watch reads it: its checks, each reviewer's last say, its size.
export type Reviewer = { login: string; review: 'approved' | 'changes' | 'pending' }
export type Signal = {
  ci: 'passing' | 'failing' | 'running' | null
  review: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  reviewers: Reviewer[]
  conflicts: boolean
  draft: boolean
  state: 'OPEN' | 'MERGED' | 'CLOSED'
  additions: number
  deletions: number
  files: number
}

declare module 'claude-code' {
  interface PluginState {
    forge: { lens: LensState; registries: Registries; signals: Record<string, Signal>; folds: Record<string, boolean> }
  }
}
