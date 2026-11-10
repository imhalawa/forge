import type { ForgeReport, Lane, Registry } from '../../types'

// The spec's eleven scenarios, as the reports forge sends for each.
// One ticket, PROJ-123, in two stacks: S1·1 and S1·2 on main, S2·1 and S2·2 stacked.

type State = NonNullable<ForgeReport['state']>
type Extra = Partial<ForgeReport>

const TICKET = 'PROJ-123'
const TITLE = 'Refund metric'

const LANES = {
  'wt-1': { name: 'wt-1 · S1·1', branch: 'PROJ-123-refund-metric', base: 'main', pr: 41 },
  'wt-2': { name: 'wt-2 · S1·2', branch: 'PROJ-123-refund-api', base: 'main', pr: 42 },
  'wt-3': { name: 'wt-3 · S2·1', branch: 'PROJ-123-refund-events', base: 'main', pr: 43 },
  'wt-4': { name: 'wt-4 · S2·2', branch: 'PROJ-123-refund-dashboard', base: 'PROJ-123-refund-events', pr: 44 },
} as const
type Wt = keyof typeof LANES

export const conductor = (kind: ForgeReport['kind'], title: string, extra: Extra = {}): ForgeReport =>
  ({ ticket: TICKET, kind, needsYou: false, title, line: title, ...extra })

const stage = (step: 'Problem' | 'Approach' | 'Sub-tasks', state: State, extra: Extra = {}): ForgeReport =>
  conductor('planning', step, { step, state, ...extra })

export const lane = (wt: Wt, kind: ForgeReport['kind'], state: State, extra: Extra = {}): ForgeReport => {
  const l = LANES[wt]
  return {
    ticket: TICKET, lane: l.name, kind, state, needsYou: false,
    title: `${l.name} · ${state}`, line: `${l.name} is ${state}.`,
    facts: [['branch', l.branch], ['base', l.base]],
    ...extra,
  }
}

const pr = (wt: Wt, more: Partial<NonNullable<ForgeReport['pr']>> = {}) =>
  ({ number: LANES[wt].pr, base: LANES[wt].base, ...more })

const started = conductor('started', TITLE)
const pendingStages = [stage('Problem', 'pending'), stage('Approach', 'pending'), stage('Sub-tasks', 'pending')]

const working = [
  started,
  lane('wt-1', 'started', 'building', { step: 'criterion 1 of 3' }),
  lane('wt-2', 'started', 'building', { step: 'criterion 1 of 2' }),
  lane('wt-3', 'progress', 'waits', { step: 'waits on wt-1' }),
]

export const SCENARIOS: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11, ForgeReport[]> = {
  // 1. Confirm the problem
  1: [
    started,
    ...pendingStages,
    stage('Problem', 'review', {
      needsYou: true,
      ask: 'Confirm the problem',
      title: 'Problem · Your review',
      line: 'Refunds are not counted, so the payments dashboard over-reports revenue.',
      facts: [['ticket', 'PROJ-123'], ['source', 'Jira']],
      choices: [
        { label: 'Confirm', then: 'Forge drafts the approach' },
        { label: 'Correct it', then: 'Forge rewrites the problem with your words' },
      ],
    }),
  ],

  // 2. The story may not be needed
  2: [
    started,
    ...pendingStages,
    stage('Problem', 'stopped', {
      needsYou: true,
      ask: 'Close PROJ-123? The refund metric already exists',
      title: 'The story may not be needed',
      line: 'payments.refund.count is already emitted and charted.',
      evidence: [
        { label: 'src/Refunds/RefundHandler.cs:48', text: 'metrics.Increment("payments.refund.count");' },
        { label: 'Datadog query', text: 'sum:payments.refund.count{*} → 1,284 in the last 7 days' },
      ],
      choices: [
        { label: 'Close it', then: 'Forge stops and leaves a comment on PROJ-123' },
        { label: 'Go on', then: 'Forge plans the story as written' },
      ],
    }),
  ],

  // 3. Approve the sub-tasks
  3: [
    started,
    stage('Problem', 'confirmed'),
    stage('Approach', 'confirmed'),
    stage('Sub-tasks', 'review', {
      needsYou: true,
      ask: 'Approve the 4 sub-tasks',
      title: 'Sub-tasks · Your review',
      line: 'Two stacks: the metric and its API first, then the events and the dashboard.',
      sections: [
        { label: 'Stack 1', items: ['S1·1 Emit the refund metric', 'S1·2 Expose refunds in the API'] },
        { label: 'Stack 2', items: ['S2·1 Publish refund events', 'S2·2 Chart refunds on the dashboard'] },
      ],
      choices: [
        { label: 'Approve', then: 'Forge creates the sub-tasks and starts 4 lanes' },
        { label: 'Change them', then: 'Forge redrafts with your notes' },
      ],
    }),
  ],

  // 4. Working on its own
  4: working,

  // 5. Something new while building
  5: [
    ...working,
    lane('wt-2', 'finding', 'stopped', {
      needsYou: true,
      ask: 'Narrow criterion 2?',
      title: 'Something new in wt-2',
      line: 'Criterion 2 asks for partial refunds, which the API does not model yet.',
      step: 'criterion 2 of 2',
      evidence: [{ label: 'src/Refunds/Refund.cs:12', text: 'public decimal Amount { get; } // full amount only' }],
      choices: [
        { label: 'Narrow it', then: 'Forge rewrites criterion 2 and goes on' },
        { label: 'Keep it', then: 'Forge adds a sub-task for partial refunds' },
      ],
    }),
  ],

  // 6. Review and raise a PR
  6: [
    ...working,
    lane('wt-1', 'review', 'review', {
      needsYou: true,
      ask: 'Review wt-1 and raise PR',
      title: 'wt-1 · S1·1 is ready for your review',
      line: 'All 3 criteria pass; the metric is emitted on every refund.',
      step: 'criterion 3 of 3',
      facts: [['branch', 'PROJ-123-refund-metric'], ['base', 'main'], ['commits', '3']],
      sections: [
        { label: 'Changed', items: ['RefundHandler.cs', 'RefundMetrics.cs', 'RefundHandlerTests.cs'] },
        { label: 'Criteria', items: ['Counts full refunds', 'Counts partial refunds', 'Tags by provider'] },
      ],
      evidence: [{ label: 'dotnet test', text: 'Passed! 42 passed, 0 failed' }],
      choices: [
        { label: 'Raise it', then: 'Forge opens PR #41 against main' },
        { label: 'Change it', then: 'Forge applies your notes and asks again' },
      ],
    }),
  ],

  // 7. Review comment fixed
  7: [
    ...working,
    lane('wt-1', 'raised', 'open', { pr: pr('wt-1'), step: 'waiting for review' }),
    lane('wt-1', 'comment', 'fixed', {
      title: 'PR #41 · comment fixed',
      line: 'Renamed the tag to provider, as the reviewer asked, and pushed.',
      pr: pr('wt-1', { checks: [5, 7], fixed: 1 }),
      step: 'checks running',
    }),
  ],

  // 8. CI fails, not caused by this change
  8: [
    started,
    lane('wt-1', 'raised', 'open', { pr: pr('wt-1', { checks: [7, 7] }) }),
    lane('wt-2', 'progress', 'building', { step: 'criterion 2 of 2' }),
    lane('wt-3', 'ci', 'failed', {
      title: 'PR #43 · check failed, not this change',
      line: 'The integration suite timed out on main too; Forge re-runs it.',
      pr: pr('wt-3', { checks: [6, 7] }),
      step: 're-running integration',
      evidence: [{ label: 'main, build 1882', text: 'IntegrationTests timed out after 600s' }],
    }),
  ],

  // 9. Ready to merge
  9: [
    started,
    lane('wt-1', 'merge-ready', 'call', {
      needsYou: true,
      ask: 'Merge PR #41',
      title: 'PR #41 · ready to merge',
      line: 'Checks passed and two approvals; every merge rule is met.',
      pr: pr('wt-1', { checks: [7, 7], approvals: 2 }),
      step: 'all merge rules met',
      choices: [
        { label: 'Merge', then: 'Forge merges PR #41 and rebases wt-3 onto main' },
        { label: 'Wait', then: 'Forge holds PR #41 and carries on' },
      ],
    }),
    lane('wt-2', 'raised', 'open', { pr: pr('wt-2', { checks: [7, 7], approvals: 1 }) }),
    lane('wt-3', 'ci', 'ci', { pr: pr('wt-3', { checks: [4, 7] }) }),
    lane('wt-4', 'progress', 'waits', { step: 'waits on wt-3' }),
  ],

  // 10. Stack rebased
  10: [
    started,
    lane('wt-1', 'merged', 'merged', { pr: pr('wt-1', { checks: [7, 7], approvals: 2 }) }),
    lane('wt-2', 'raised', 'open', { pr: pr('wt-2', { checks: [7, 7], approvals: 1 }) }),
    lane('wt-3', 'restacked', 'rebased', {
      title: 'Stack rebased onto main',
      line: 'PR #43 and PR #44 now sit on main after PR #41 merged.',
      pr: pr('wt-3', { checks: [0, 7] }),
      step: 'checks running',
    }),
    lane('wt-4', 'restacked', 'rebased', { pr: pr('wt-4', { checks: [0, 7] }) }),
  ],

  // 11. Delivered
  11: [
    started,
    lane('wt-1', 'merged', 'merged', { pr: pr('wt-1', { checks: [7, 7], approvals: 2 }) }),
    lane('wt-2', 'merged', 'merged', { pr: pr('wt-2', { checks: [7, 7], approvals: 2 }) }),
    lane('wt-3', 'merged', 'merged', { pr: pr('wt-3', { checks: [7, 7], approvals: 2 }) }),
    lane('wt-4', 'merged', 'merged', { pr: pr('wt-4', { checks: [7, 7], approvals: 2 }) }),
    conductor('delivered', TITLE, { state: 'done', line: 'All 4 PRs merged; the parent stays open for you.' }),
  ],
}

// A registry of one run: PROJ-1, two sub-tasks, three PRs, one merged and one building.
export const laneOf = (id: string, pr: string, subTask: string, state: string, extra: Partial<Lane> = {}): Lane =>
  ({ id, pr, subTask, branch: `PROJ-1-${id}`, base: 'main', state, ...extra })

export const REGISTRY: Registry = {
  parent: 'PROJ-1',
  plan: {
    parent: { key: 'PROJ-1', title: 'Retire the old card readers' },
    trackerUrl: 'https://example.atlassian.net',
    prs: [
      { pr: 'S1·1', subTask: 'PROJ-2', title: 'Remove config', name: 'Remove the config', base: 'main' },
      { pr: 'S1·2', subTask: 'PROJ-2', title: 'Remove config', name: 'Remove the config docs', base: 'S1·1' },
      { pr: 'S2·1', subTask: 'PROJ-3', title: 'Remove scope', base: 'main' },
    ],
  },
  lanes: [
    laneOf('wt-1', 'S1·1', 'PROJ-2', 'merged', { prNumber: 41 }),
    laneOf('wt-2', 'S2·1', 'PROJ-3', 'building'),
  ],
}
