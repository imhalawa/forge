import { expect, mock, test } from 'claude-code/testing'

import type { ForgeReport, LensState } from '../../types'
import { conductor, lane, laneOf, REGISTRY, SCENARIOS } from './fixtures'
import { pane } from './pane'
import { apply, EMPTY } from './state'
import { ciOf, parseSignal, type Signal, waitingOn } from './signals'
import { editorCommand } from './tracker'
import type { View } from './tree'

// A table of plain-data elements, so a view's tree can be read without a surface.
// A drawn tree (`ui.drawn()`) carries its children beside the props instead.
type Node = { type: string; props: Record<string, unknown>; children?: unknown }
const make = (type: string) => (props: Record<string, unknown>) => ({ type, props }) as never
const table = { Box: make('Box'), Text: make('Text'), Svg: make('Svg'), Link: make('Link'), Button: make('Button') } as never
const ui = { surface: 'desktop', t: table } as const
const uiTerminal = { surface: 'terminal', t: table } as const

const kids = (n: Node): unknown[] => {
  const c = n.children ?? n.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1)
}
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && 'type' in v

// A Text's strings and its links' labels, in order.
const inline = (k: unknown): string => {
  if (typeof k === 'string' || typeof k === 'number') return String(k)
  if (isNode(k) && k.type === 'Link') return kids(k).map(inline).join('') || String(k.props.label ?? k.props.href)
  if (isNode(k) && k.type === 'Text') return kids(k).map(inline).join('')
  return ''
}

// Each Text is a line, a row Box joins its children into one, a column Box stacks them.
const lines = (v: unknown): string[] => {
  if (typeof v === 'string' || typeof v === 'number') return [String(v)]
  if (!isNode(v)) return []
  if (v.type === 'Svg') return []
  if (v.type === 'Text') return [kids(v).map(inline).join('')]
  const inner = kids(v).map(lines)
  if (v.props?.flexDirection === 'row') {
    const one = inner.flat().filter(Boolean).join(' ')
    return one ? [one] : []
  }
  return inner.flat()
}
const text = (v: unknown) => lines(v).join(' ')
const find = (v: unknown, ok: (n: Node) => boolean): Node[] =>
  isNode(v) ? [...(ok(v) ? [v] : []), ...kids(v).flatMap(k => find(k, ok))] : []
const rows = (v: unknown) =>
  find(v, n => String(n.props.key ?? '').startsWith('row:')).map(n => lines(n)[0])

const fold = (reports: ForgeReport[]): LensState => reports.reduce(apply, EMPTY)
const needing = (r: ForgeReport, ask: string): ForgeReport => ({ ...r, needsYou: true, ask })

// The pane

test('pane lane row has icon, name, word, full branch, signals', () => {
  const tree = pane(fold(SCENARIOS[9]), ui)
  expect(rows(tree)[0]).toBe('wt-1 · S1·1 · Your call')
  expect(lines(tree)).toContain('base main · #41 · 7/7 · 2 approvals · all merge rules met')
})

test('pane never truncates the branch', () =>
  expect(lines(pane(fold(SCENARIOS[9]), ui))).toContain('PROJ-123-refund-metric'))

test('planning pane shows three stages', () =>
  expect(rows(pane(fold(SCENARIOS[1]), ui))).toEqual(['Problem · Your review', 'Approach · next', 'Sub-tasks · next']))

test('terminal pane uses glyphs', () =>
  expect(lines(pane(fold(SCENARIOS[9]), uiTerminal))[3]).toMatch(/^▶ wt-1 · S1·1/))

test('pane head: ticket, then the count', () => {
  const l = lines(pane(fold(SCENARIOS[9]), ui))
  expect(l[0]).toBe('PROJ-123 · Refund metric')
  expect(l[1]).toBe('0 of 4 merged · 1 needs you')
})

test('pane Now box lists every call, outlined in the accent', () => {
  const tree = pane(fold([...SCENARIOS[5], needing(lane('wt-1', 'review', 'review'), 'Review wt-1')]), ui)
  const [now] = find(tree, n => n.props.key === 'now')
  expect(now?.props.borderColor).toBe('suggestion')
  expect(now?.props.paddingY).toBe(0)
  expect(lines(now)).toEqual(['Narrow criterion 2?', 'Review wt-1'])
})

test('only a lane needing you is outlined, with paddingY 0', () => {
  const outlined = find(pane(fold(SCENARIOS[9]), ui), n => n.props.borderStyle !== undefined)
  expect(outlined.map(n => String(n.props.key))).toEqual(['now', 'row:wt-1 · S1·1'])
  for (const n of outlined) {
    expect(n.props.borderColor).toBe('suggestion')
    expect(n.props.paddingY).toBe(0)
  }
})

test('signals show comments fixed and the step', () =>
  expect(lines(pane(fold(SCENARIOS[7]), ui))).toContain('base main · #41 · 5/7 · 1 comment fixed · checks running'))

test('a lane without a PR shows its base and step', () =>
  expect(lines(pane(fold(SCENARIOS[4]), ui))).toContain('base main · criterion 1 of 3'))

test('the pane with no run', () =>
  expect(lines(pane(EMPTY, ui))).toEqual(['No forge run in this session']))

test('the pane once delivered', () =>
  expect(lines(pane(fold(SCENARIOS[11]), ui))[1]).toBe('4 of 4 merged · delivered'))

test('the pane head keeps the first title', () =>
  expect(lines(pane(fold([conductor('started', 'Retry failed refunds'), conductor('delivered', 'PROJ-123 delivered')]), ui))[0])
    .toBe('PROJ-123 · Retry failed refunds'))

test('a lane row shows its session on the signals line', () =>
  expect(lines(pane(fold([conductor('started', 'x'), lane('wt-1', 'progress', 'building', { step: 'criterion 1 of 3', session: 'sess-7f2' })]), ui)))
    .toContain('base main · criterion 1 of 3 · session sess-7f2'))

test('Now box rows are keyed by who needs you', () => {
  const tree = pane(fold([...SCENARIOS[5], needing(lane('wt-1', 'review', 'review'), 'Review wt-1')]), ui)
  expect(find(tree, n => String(n.props.key ?? '').startsWith('call:')).map(n => n.props.key))
    .toEqual(['call:wt-2 · S1·2', 'call:wt-1 · S1·1'])
})

test('planning leaves out the merged count', () => {
  expect(lines(pane(fold(SCENARIOS[1]), ui))[1]).toBe('1 needs you')
  const quiet = lines(pane(fold(SCENARIOS[1].slice(0, 4)), ui))
  expect(quiet.some(l => l.includes('merged'))).toBe(false)
  expect(quiet).not.toContain('')
})

test('every scenario draws on both tables', () => {
  for (const reports of Object.values(SCENARIOS)) {
    for (const u of [ui, uiTerminal]) {
      expect(() => pane(fold(reports), u)).not.toThrow()
    }
  }
})

// The hooks

const TOOL = 'mcp__forge__forge_report'
const BAND = {
  plugin: 'forge',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const PANE = {
  plugin: 'forge',
  component: 'Pane',
  requestId: 'forge',
  props: { title: 'Forge', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type Seen = { status: (string | undefined)[]; toasts: string[]; sounds: unknown[]; opened: unknown[] }
type On = Parameters<Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>>[1]
const watch = (on: On): Seen => {
  const seen: Seen = { status: [], toasts: [], sounds: [], opened: [] }
  on('ui.status', (_, e) => { seen.status.push(e.text); return { value: undefined } })
  on('ui.toast', (_, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('audio.play', (_, e) => { seen.sounds.push(e.clip); return { value: undefined } })
  on('ui.open', (_, e) => { seen.opened.push(e.id); return { value: { isPlaced: true } } })
  return seen
}
const report = ($: { tool: { call: (e: never) => Promise<unknown> } }, r: ForgeReport) =>
  $.tool.call({ tool: TOOL, ...r } as never)

test('the pane opens on the first report only', async ($, on) => {
  const seen = watch(on)
  for (const r of SCENARIOS[4]) await report($, r)
  expect(seen.opened).toEqual(['forge'])
})

test('the session reaches the pane through forge_report', async ($, on) => {
  watch(on)
  await report($, conductor('started', 'x'))
  await report($, lane('wt-1', 'progress', 'building', { session: 'sess-7f2' }))
  const p = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(lines(await p.drawn())).toContain('base main · session sess-7f2')
  await p.unmount()
})

const engineStart = (on: On) => {
  const registered: { tools: unknown[]; commands: unknown[] } = { tools: [], commands: [] }
  on('tool.register', (_, e) => { registered.tools.push(e); return { value: { tool: TOOL } } })
  on('command.register', (_, e) => { registered.commands.push(e); return { value: { command: e.name } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return registered
}

test('forge_report is in the prompt\'s tool list, and /forge-pane is registered', async ($, on) => {
  watch(on)
  const registered = engineStart(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(registered.tools).toEqual([expect.objectContaining({ name: 'forge_report', isDeferred: false })])
  expect(registered.commands).toEqual([expect.objectContaining({ name: 'forge-pane' })])
})

test('/forge-pane opens the pane', async ($, on) => {
  const seen = watch(on)
  engineStart(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const { text: out } = await $.command.run({ command: 'forge-pane' } as never) as { text?: string }
  expect(seen.opened).toEqual(['forge'])
  expect(out).toBe('Forge pane opened.')
})

test('the pane opens again when the ticket changes', async ($, on) => {
  const seen = watch(on)
  await report($, conductor('started', 'A'))
  await report($, lane('wt-1', 'progress', 'building'))
  await report($, { ...conductor('started', 'B'), ticket: 'PROJ-9' })
  expect(seen.opened).toEqual(['forge', 'forge'])
})

test('a lane report for a ticket not on view changes nothing', async ($, on) => {
  const seen = watch(on)
  await report($, conductor('started', 'A'))
  const out = await report($, { ...needing(lane('wt-1', 'review', 'review'), 'Review wt-1'), ticket: 'PROJ-9' }) as { result: string }
  expect(out.result).toMatch(/shows PROJ-123/)
  expect(seen.toasts).toEqual([])
  const p = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(lines(await p.drawn())).not.toContain('PROJ-123-refund-metric')
  await p.unmount()
})

// The conductor's snapshot: one report per lane on every rebuild, the row it asks on needing you.
// The tracker, from the registry

const VIEW: View = { key: 'PROJ-1', registry: REGISTRY, remote: 'git@github.com:o/r.git' }
const withLane = (id: string, state: string, extra: Record<string, unknown> = {}): View =>
  ({ ...VIEW, registry: { ...REGISTRY, lanes: REGISTRY.lanes.map(l => (l.id === id ? { ...l, state, ...extra } : l)) } })
const links = (v: unknown) => find(v, n => n.type === 'Link').map(n => n.props.href)

test('the tracker is the five steps: Plan, Implement, Deploy, Verify, Clean up', () =>
  expect(lines(pane(EMPTY, uiTerminal, VIEW))).toEqual([
    '▮ PROJ-1 Retire the old card readers',
    '├─ ☰ Plan',
    '│ ├─ ✓ Investigate',
    '│ └─ ✓ Break down',
    '├─ ‹› Implement 1 of 3 merged',
    '│ ├─ ◐ PROJ-2 Remove config',
    '│ │ ├─ ⊕ #41 Remove the config',
    '│ │ └─ ○ Remove the config docs',
    '│ └─ ◐ PROJ-3 Remove scope',
    '│   └─ ◐ Wt 2',
    '├─ ⇪ Deploy 0 of 2 live',
    '│ ├─ ○ PROJ-2 Remove config T ○  A ○  P ○',
    '│ └─ ○ PROJ-3 Remove scope T ○  A ○  P ○',
    '├─ ⛉ Verify',
    '└─ ⌫ Clean up',
    '  ├─ ○ Worktrees removed 0 of 2 sub-tasks',
    '  ├─ ○ Local and remote branches deleted 0 of 2 sub-tasks',
    '  ├─ ○ Stale refs pruned',
    '  ├─ ○ Sessions archived 0 of 2 sub-tasks',
    '  └─ ○ Sub-tasks closed 0 of 2 sub-tasks',
  ]))

test('Deploy counts sub-tasks by environment; Verify checks each done criterion and asks you for yours', () => {
  const registry = {
    ...REGISTRY,
    plan: { ...REGISTRY.plan!, done: [
      { criterion: 'No service calls the scope', by: 'forge', source: 'Datadog' },
      { criterion: 'The settings page still loads', by: 'you' },
    ] },
    deploy: { 'PROJ-2': { testing: 'done', acceptance: 'done', production: 'done' }, 'PROJ-3': { testing: 'done', acceptance: 'done', production: 'done' } },
    verify: { 0: 'passed' },
  } as never
  const l = lines(pane(EMPTY, uiTerminal, { ...VIEW, registry }))
  expect(l).toContain('├─ ⇪ Deploy')
  expect(l).toContain('│ ├─ ✓ PROJ-2 Remove config T ✓  A ✓  P ✓')
  expect(l).toContain('├─ ⛉ Verify 1 of 2 hold')
  expect(l).toContain('│ ├─ ✓ No service calls the scope forge · Datadog')
  expect(l).toContain('│ └─ ! The settings page still loads you')
})

test('a PR without a name reads its branch in words', () =>
  expect(lines(pane(EMPTY, uiTerminal, VIEW))).toContain('│   └─ ◐ Wt 2'))

test('a change waiting on your review says what to do, in amber, with a review link', () => {
  const tree = pane(EMPTY, uiTerminal, withLane('wt-2', 'review', { worktree: '/r/.worktrees/PROJ-1-wt-2' }))
  expect(lines(tree)).toContain('│ └─ ! PROJ-3 Remove scope')
  expect(lines(tree)).toContain('│   └─ ◉ Review and stage the change')
  const review = find(tree, n => n.type === 'Button' && n.props.label === 'Review in the editor')
  expect(review).toHaveLength(1)
  const amber = find(tree, n => n.type === 'Text' && n.props.color === 'warning').map(n => text(n))
  expect(amber).toEqual(expect.arrayContaining(['PROJ-3 Remove scope', 'Review and stage the change']))
})

test('the ticket, the sub-tasks and the PR numbers are links', () =>
  expect(links(pane(EMPTY, ui, VIEW))).toEqual([
    'https://example.atlassian.net/browse/PROJ-1',
    'https://example.atlassian.net/browse/PROJ-2',
    'https://github.com/o/r/pull/41',
    'https://example.atlassian.net/browse/PROJ-3',
    'https://example.atlassian.net/browse/PROJ-2',
    'https://example.atlassian.net/browse/PROJ-3',
  ]))

test('nothing but the tree: no call box, no branches, no codes', () => {
  const l = lines(pane(fold(SCENARIOS[9]), uiTerminal, VIEW)).join('\n')
  expect(l).not.toMatch(/Your call|S1·1|S2·1|PROJ-1-wt-1|session|base main/)
})

test('a waiting PR is dim, a dropped one is gone', () => {
  const registry = { ...REGISTRY, lanes: [...REGISTRY.lanes, laneOf('wt-3', 'S1·2', 'PROJ-2', 'pending', { dependsOn: ['wt-2'] })] }
  const tree = pane(EMPTY, uiTerminal, { ...VIEW, registry })
  expect(lines(tree)).toContain('│ │ └─ ◷ Remove the config docs')
  expect(lines(pane(EMPTY, uiTerminal, withLane('wt-2', 'dropped')))).not.toContain('│   └─ ◐ Wt 2')
})

test('once everything merged, Implement is done and its count is gone', () => {
  const registry = { ...REGISTRY, plan: { ...REGISTRY.plan!, prs: REGISTRY.plan!.prs.slice(0, 1) }, lanes: REGISTRY.lanes.slice(0, 1) }
  const l = lines(pane(EMPTY, uiTerminal, { ...VIEW, registry }))
  expect(l).toContain('├─ ‹› Implement')
  expect(l).toContain('├─ ⇪ Deploy 0 of 1 live')
})

test('a PR row carries on-my-watch signals: whose move, checks, reviewers, size', () => {
  const url = 'https://github.com/o/r/pull/41'
  const registry = { ...REGISTRY, lanes: REGISTRY.lanes.map(l => (l.id === 'wt-1' ? { ...l, state: 'passed', prUrl: url } : l)) }
  const signals = { [url]: { ci: 'passing', review: 'APPROVED', reviewers: [{ login: 'sam', review: 'approved' }], conflicts: false, draft: false, state: 'OPEN', additions: 90, deletions: 109, files: 17 } as const }
  const l = lines(pane(EMPTY, uiTerminal, { ...VIEW, registry }, { signals: signals as never }))
  expect(l.join('\n')).toContain('Ready to merge ● ✓sam 17 files +90 −109')
})

test('waiting on: conflicts first, then changes, then ready, then who is asked', () => {
  const base: Signal = { ci: 'passing', review: null, reviewers: [], conflicts: false, draft: false, state: 'OPEN', additions: 0, deletions: 0, files: 0 }
  expect(waitingOn({ ...base, conflicts: true, review: 'APPROVED' })).toEqual(['Conflicts', 'failed'])
  expect(waitingOn({ ...base, review: 'APPROVED' })).toEqual(['Ready to merge', 'done'])
  expect(waitingOn({ ...base, reviewers: [{ login: 'payments-team', review: 'pending' }] })).toEqual(['Waiting on payments-team', 'muted'])
  expect(waitingOn({ ...base, ci: 'failing', review: 'APPROVED' })).toEqual(['Checks failing', 'failed'])
})

test('gh output reads into a signal', () => {
  const s = parseSignal(JSON.stringify({
    reviewDecision: 'APPROVED', latestReviews: [{ author: { login: 'sam' }, state: 'APPROVED' }],
    reviewRequests: [{ slug: 'payments-team' }], statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
    mergeable: 'MERGEABLE', isDraft: false, state: 'OPEN', additions: 3, deletions: 1, changedFiles: 2,
  }))
  expect(s).toMatchObject({ ci: 'passing', review: 'APPROVED', files: 2 })
  expect(s?.reviewers).toEqual([{ login: 'sam', review: 'approved' }, { login: 'payments-team', review: 'pending' }])
  expect(ciOf([{ status: 'IN_PROGRESS' }])).toBe('running')
  expect(ciOf([{ status: 'COMPLETED', conclusion: 'FAILURE' }])).toBe('failing')
})

test('the editor opens the whole worktree as a project, never one file', () => {
  expect(editorCommand('/w/x')).toEqual(['open', '-a', 'Visual Studio Code', '/w/x'])
  expect(editorCommand('/w/x', 'cursor')).toEqual(['open', '-a', 'Cursor', '/w/x'])
  expect(editorCommand('/w/x', 'idea')).toEqual(['open', '-a', 'IntelliJ IDEA', '/w/x'])
  expect(editorCommand('/w/x', 'code -n {path}')).toEqual(['code', '-n', '/w/x'])
  expect(editorCommand('/w/x', 'none')).toBeNull()
})

test('the tracker draws on both tables', () => {
  for (const u of [ui, uiTerminal]) expect(() => pane(EMPTY, u, withLane('wt-2', 'stopped'))).not.toThrow()
})

// The registry reaches the session: the reminder, the watcher, the views

const COMMON = '/repo/.git'
const serve = (on: On, files: Record<string, { mtimeMs: number; text: string }>, branch = 'main') => {
  on('process.run', (_, e) => {
    const args = e.argv.join(' ')
    const stdout = args.includes('git-common-dir') ? `${COMMON}\n` : args.includes('show-current') ? `${branch}\n` : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.repo', () => ({ value: { root: '/repo', remote: 'git@github.com:o/r.git', internal: false, name: 'o/r', id: 'o/r' } }))
  on('fs.list', () => ({ value: Object.keys(files).map(name => ({ name, kind: 'file', size: 1, mtimeMs: 1, isLink: false })) }))
  on('fs.stat', (_, e) => ({ value: { kind: 'file', size: 1, mtimeMs: files[e.path.split('/').at(-1)!]!.mtimeMs, isLink: false } }))
  on('fs.read', (_, e) => ({ value: files[e.path.split('/').at(-1)!]!.text }))
}
const json = (view: View) => JSON.stringify(view.registry)

test('a session opened where a run is in flight opens its tree, with no toast or status text', async ($, on) => {
  const seen = watch(on)
  engineStart(on)
  serve(on, { 'PROJ-1.json': { mtimeMs: 1, text: json(withLane('wt-2', 'review')) } })
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  expect(seen.opened).toEqual(['forge'])
  expect(seen.toasts).toEqual([])
  expect(seen.status).toEqual([])
})

test('a session working inside the run opens nothing', async ($, on) => {
  const seen = watch(on)
  engineStart(on)
  serve(on, { 'PROJ-1.json': { mtimeMs: 1, text: json(VIEW) } }, 'PROJ-1-wt-2')
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  expect(seen.opened).toEqual([])
})

test('a finished run, or none, opens nothing', async ($, on) => {
  const seen = watch(on)
  engineStart(on)
  const done = { ...REGISTRY, plan: { prs: REGISTRY.plan!.prs.slice(0, 1) }, lanes: REGISTRY.lanes.slice(0, 1) }
  serve(on, { 'PROJ-1.json': { mtimeMs: 1, text: JSON.stringify(done) } })
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  expect(seen.opened).toEqual([])
})

test('a conductor outside any repo reads the run from the home folder', async ($, on) => {
  const seen = watch(on)
  engineStart(on)
  mock.env(on, { HOME: '/home/me' })
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.cwd', () => ({ value: '/w' }))
  const registry = { ...withLane('wt-2', 'review').registry }
  registry.lanes = registry.lanes.map(l => ({ ...l, repo: '/w/shared/aws', prUrl: `https://github.com/c/aws/pull/${l.prNumber ?? 0}` }))
  const files = { 'PROJ-1.json': { mtimeMs: 1, text: JSON.stringify(registry) } }
  const listed: string[] = []
  on('fs.list', (_, e) => { listed.push(e.path); return { value: Object.keys(files).map(name => ({ name, kind: 'file', size: 1, mtimeMs: 1, isLink: false })) } })
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false } }))
  on('fs.read', () => ({ value: files['PROJ-1.json'].text }))
  await $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })
  expect(listed).toEqual(['/home/me/.claude/forge'])
  expect(seen.opened).toEqual(['forge'])
  const p = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(lines(await p.drawn()).join('\n')).toContain('Review and stage the change')
  await p.unmount()
})

test('a PR reaching review sends one notification in plain words, and no toast', async ($, on) => {
  const seen = watch(on)
  const notified: string[] = []
  on('ui.notify', (_, e) => { notified.push(e.text); return { value: { isSent: true, channel: 'terminal_bell' } } })
  engineStart(on)
  const clock = mock.clock(on)
  const files = { 'PROJ-1.json': { mtimeMs: 1, text: json(VIEW) } }
  serve(on, files)
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  files['PROJ-1.json'] = { mtimeMs: 2, text: json(withLane('wt-2', 'review')) }
  await clock.advance(5000)
  expect(notified).toEqual(['Wt 2 is ready for your review.'])
  await clock.advance(5000)
  expect(notified).toHaveLength(1)
  expect(seen.toasts).toEqual([])
  const p = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(lines(await p.drawn()).join('\n')).toContain('Review and stage the change')
  await p.unmount()
})

test('a building change gets a lower section: every rule in full, ticked off as it goes', () => {
  const plan = { ...REGISTRY.plan!, prs: REGISTRY.plan!.prs.map((r, i) => (i === 0 ? { ...r, name: 'quantity rule', rules: ['When a, then b.', 'When c, then d.', 'When e, then f.'] } : r)) }
  const lanes = REGISTRY.lanes.map((l, i) => (i === 0 ? { ...l, state: 'building', rules: { done: [0], now: 1 } } : l))
  const l = lines(pane(EMPTY, uiTerminal, { ...VIEW, registry: { ...REGISTRY, plan, lanes } }))
  const at = l.indexOf('‹› Building the quantity rule 1 of 3')
  expect(at).toBeGreaterThan(0)
  expect(l.slice(at + 1, at + 4)).toEqual(['✓ When a, then b.', '◐ When c, then d.', '○ When e, then f.'])
})

test('no change building, no lower section', () =>
  expect(lines(pane(EMPTY, uiTerminal, VIEW)).some(x => x.includes('Building the'))).toBe(false))
