import type { RenderElement } from 'claude-code'

import type { CleanupState, Environment, ForgeReport, LensState, StepState } from '../../types'
import { HoverReveal, makeKit, scopeOf, type Guide } from '../kit'
import type { Ui } from './band'
import { avatarSvg, glyph, type IconName, ROLES, type Role } from './design'
import { ticketUrl } from './links'
import { humanize } from './registry'
import { CI_ROLE, type Signal, waitingOn } from './signals'
import { type PrNode, tree, type View } from './tree'

type State = NonNullable<ForgeReport['state']>

// A lane's state as one of forge's icons. Its colour is the icon's role.
export const STATE_ICON: Record<State, IconName> = {
  pending: 'pending', building: 'progress', queue: 'waiting', waits: 'waiting', stopped: 'you', review: 'review',
  call: 'you', open: 'progress', ci: 'progress', passed: 'done', failed: 'failed', changes: 'progress', fixed: 'progress',
  approved: 'done', merged: 'merged', rebased: 'progress', done: 'done', confirmed: 'done',
}

// One row of the tracker: what it is, the reference that links to it, and the one action it needs.
export type Node = {
  key: string
  icon: IconName
  role?: Role
  ref?: { text: string; href?: string | null }
  title: string
  tone?: 'you' | 'dim'
  strong?: boolean
  right?: string
  action?: { label: string; target: string[]; always: boolean }
  signal?: Signal
  children: Node[]
}

// The command that opens a worktree in the editor, as a project: the whole folder, never one file. A known editor
// opens through its app; any other setting is a command with `{path}` in it ("code -n {path}"); "none" opens nothing.
const APPS: Record<string, string> = { vscode: 'Visual Studio Code', cursor: 'Cursor', zed: 'Zed', idea: 'IntelliJ IDEA' }
export const editorCommand = (path: string, editor = 'vscode'): string[] | null => {
  if (editor === 'none' || !path) return null
  if (editor.includes('{path}')) return editor.trim().split(/\s+/u).map(w => w.replaceAll('{path}', path))
  const app = APPS[editor]
  return app ? ['open', '-a', app, path] : null
}

const WAITING: ReadonlySet<State> = new Set(['pending', 'waits', 'queue'])

const prNode = (n: PrNode, view: View, only: boolean, editor: string, signals: Record<string, Signal>): Node => {
  const row = view.registry.plan?.prs.find(r => r.pr === n.pr)
  const lane = view.registry.lanes.find(l => l.pr === n.pr && l.state !== 'dropped')
  const name = row?.name ?? humanize(n.branch, view.key) ?? n.pr
  const ref = n.number ? { text: `#${n.number}`, href: n.url } : undefined
  // A change not yet a PR, waiting on the person's review: say what to do, and offer the editor.
  if (n.state === 'review' && !n.number) {
    const target = lane?.worktree ? editorCommand(lane.worktree, editor) : null
    return {
      key: n.pr, icon: 'review', title: only ? 'Review and stage the change' : `Review and stage: ${name}`,
      tone: 'you', action: target ? { label: 'Review in the editor', target, always: true } : undefined, children: [],
    }
  }
  // An open lane's worktree opens in the editor from a hover action; a merged one has no worktree left.
  const target = lane?.worktree && n.state !== 'merged' ? editorCommand(lane.worktree, editor) : null
  return {
    key: n.pr, icon: STATE_ICON[n.state], ref, title: name,
    tone: n.needsYou ? 'you' : WAITING.has(n.state) ? 'dim' : undefined,
    action: target ? { label: 'Open in the editor', target, always: false } : undefined,
    signal: n.url ? signals[n.url] : undefined, children: [],
  }
}

const ENVS: [Environment, string][] = [['testing', 'T'], ['acceptance', 'A'], ['production', 'P']]
const STATE_MARK: Record<StepState, string> = { pending: '○', running: '◐', done: '✓', passed: '✓', failed: '✗' }
const stepIcon = (s: StepState | undefined): IconName =>
  s === 'done' || s === 'passed' ? 'done' : s === 'running' ? 'progress' : s === 'failed' ? 'failed' : 'pending'
const count = (n: number, of: number, what: string) => `${n} of ${of} ${what}`

// The run as its five steps: Plan, Implement, Deploy, Verify, Clean up. Implement holds the sub-tasks and their PRs;
// Deploy and Clean up count sub-tasks; Verify checks each done criterion.
export const nodes = (state: LensState, view: View, editor = 'vscode', signals: Record<string, Signal> = {}): Node => {
  const reg = view.registry
  const subs = tree(view, state)
  const prs = subs.flatMap(s => s.prs).filter(n => !n.dropped)
  const merged = prs.filter(n => n.state === 'merged').length
  const planned = (reg.plan?.prs.length ?? 0) > 0
  const implemented = prs.length > 0 && merged === prs.length

  const tasks: Node[] = subs.map(s => {
    const live = s.prs.filter(n => !n.dropped)
    const needs = live.some(n => n.needsYou)
    const done = live.length > 0 && live.every(n => n.state === 'merged')
    return {
      key: s.key, icon: needs ? 'you' : done ? 'done' : live.some(n => n.lane) ? 'progress' : 'pending',
      ref: { text: s.key, href: s.url }, title: s.title ?? '', tone: needs ? 'you' : undefined,
      children: live.map(n => prNode(n, view, live.length === 1, editor, signals)),
    }
  })

  // Deploy: a sub-task is in an environment once every one of its PRs is deployed there.
  const deployRows: Node[] = subs.map(s => {
    const envs = reg.deploy?.[s.key] ?? {}
    const prod = envs.production
    return {
      key: `deploy:${s.key}`, icon: stepIcon(prod ?? (Object.values(envs).some(v => v && v !== 'pending') ? 'running' : 'pending')),
      ref: { text: s.key, href: s.url }, title: s.title ?? '', tone: !envs.testing || envs.testing === 'pending' ? 'dim' : undefined,
      right: ENVS.map(([env, short]) => `${short} ${STATE_MARK[envs[env] ?? 'pending']}`).join('  '), children: [],
    }
  })
  const live = subs.filter(s => reg.deploy?.[s.key]?.production === 'done').length
  const deployed = subs.length > 0 && live === subs.length

  // Verify: each done criterion from Plan, checked in production by forge or by the person.
  const criteria = reg.plan?.done ?? []
  const verifyRows: Node[] = criteria.map((c, i) => {
    const st = reg.verify?.[String(i)]
    const yours = c.by === 'you' && deployed && st !== 'passed' && st !== 'failed'
    return {
      key: `verify:${i}`, icon: yours ? 'you' : stepIcon(st), title: c.criterion,
      tone: yours ? 'you' : !st || st === 'pending' ? 'dim' : undefined,
      right: c.by === 'you' ? 'you' : ['forge', c.source].filter(Boolean).join(' · '), children: [],
    }
  })
  const passed = criteria.filter((_, i) => reg.verify?.[String(i)] === 'passed').length
  const verified = criteria.length > 0 && passed === criteria.length

  // Clean up: a sub-task is clean once its worktrees, branches and sessions are gone and it is closed.
  const clean = (k: keyof CleanupState) => subs.filter(s => {
    const c = reg.cleanup?.[s.key]
    return typeof c === 'object' && c[k] === true
  }).length
  const total = subs.length
  const cleanStage = (key: string, title: string, n: number): Node => ({
    key, icon: n === total && total > 0 ? 'done' : n > 0 ? 'progress' : 'pending', title,
    tone: n === 0 ? 'dim' : undefined, right: count(n, total, 'sub-tasks'), children: [],
  })
  const pruned = reg.cleanup?.pruned === true
  const cleanRows: Node[] = [
    cleanStage('cleanup:worktrees', 'Worktrees removed', clean('worktrees')),
    cleanStage('cleanup:branches', 'Local and remote branches deleted', clean('branches')),
    { key: 'cleanup:prune', icon: pruned ? 'done' : 'pending', title: 'Stale refs pruned', tone: pruned ? undefined : 'dim', children: [] },
    cleanStage('cleanup:sessions', 'Sessions archived', clean('sessions')),
    cleanStage('cleanup:closed', 'Sub-tasks closed', clean('closed')),
  ]
  const cleaned = total > 0 && clean('worktrees') === total && clean('branches') === total && clean('closed') === total

  // A step's icon is its own; its colour says done, current or not started.
  const step = (key: string, icon: IconName, title: string, done: boolean, current: boolean, more: Partial<Node> = {}): Node => ({
    key, icon, role: done ? 'done' : current ? 'progress' : 'muted', title, strong: current,
    tone: !done && !current ? 'dim' : undefined, children: [], ...more,
  })
  const sub = (key: string, icon: IconName, title: string, done: boolean): Node =>
    ({ key, icon: done ? 'done' : 'pending', title, tone: done ? undefined : 'dim', children: [] })
  // A missing piece found after planning sends the run back to Plan until its sub-tasks exist.
  const gaps = Object.entries(reg.gaps ?? {}).sort(([a], [b]) => Number(a) - Number(b))
  const gapPlanning = gaps.some(([, g]) => g.state === 'planning')
  const gapRows: Node[] = gaps.map(([i, g]) => ({
    key: `gap:${i}`, icon: g.state === 'planning' ? 'progress' : 'done', title: `Missing: ${g.gap}`,
    right: g.subTasks?.length ? `${g.subTasks.length} sub-task${g.subTasks.length === 1 ? '' : 's'}` : undefined, children: [],
  }))
  const type = reg.plan?.parent?.type ?? 'story'
  return {
    key: view.key, icon: type, ref: { text: view.key, href: ticketUrl(reg.plan?.trackerUrl, view.key) },
    title: state.title ?? reg.plan?.parent?.title ?? '', strong: true,
    children: [
      step('plan', 'plan', 'Plan', planned && !gapPlanning, !planned || gapPlanning, {
        children: [sub('plan:investigate', 'investigate', 'Investigate', planned), sub('plan:breakdown', 'breakdown', 'Break down', planned), ...gapRows],
      }),
      step('implement', 'build', 'Implement', implemented, planned && !implemented, {
        right: planned && !implemented ? count(merged, prs.length, 'merged') : undefined, children: tasks,
      }),
      step('deploy', 'deploy', 'Deploy', deployed, implemented && !deployed || (live > 0 && !deployed), {
        right: total > 0 && !deployed ? count(live, total, 'live') : undefined, children: deployRows,
      }),
      step('verify', 'verify', 'Verify', verified, deployed && !verified, {
        right: criteria.length > 0 && !verified ? count(passed, criteria.length, 'hold') : undefined, children: verifyRows,
      }),
      step('cleanup', 'cleanup', 'Clean up', cleaned, verified && !cleaned, { children: cleanRows }),
    ],
  }
}

// The terminal's tree edge as text, `│ ├─`; the desktop draws the kit's guides instead.
const gutter = (lasts: boolean[]): string =>
  lasts.map((last, i) => (i === lasts.length - 1 ? (last ? '└─' : '├─') : (last ? '  ' : '│ '))).join('')

// Each tree level is 3 cells deep; a row's guides sit at its open ancestors' cells.
const LEVEL = 3

type Flat = { n: Node; lasts: boolean[]; depth: number; guides: Guide[] }

const flatten = (n: Node, lasts: boolean[] = []): Flat[] => [
  { n, lasts, depth: lasts.length * LEVEL, guides: [] },
  ...n.children.flatMap((c, i) => flatten(c, [...lasts, i === n.children.length - 1])),
]

// A guide at an ancestor's cell runs on below a row while a later sibling at that level follows; on the last one
// it ends in a └. The devkit's rule, on forge's rows.
const withGuides = (rows: Flat[]): Flat[] =>
  rows.map(r => ({
    ...r,
    guides: r.lasts.flatMap((last, level) => {
      const at = level * LEVEL
      const deepest = level === r.lasts.length - 1
      if (deepest) return [{ at, end: last }]
      return last ? [] : [{ at }]
    }),
  }))

// What GitHub says about a PR, on the line under its name: whose move it is, its checks, its reviewers and its size.
const signalLine = (k: string, s: Signal, ui: Ui): RenderElement => {
  const { Box, Text } = ui.t
  const Svg = ui.t.Svg!
  const desktop = ui.surface !== 'terminal' && !!ui.t.Svg
  const status = waitingOn(s)
  return (
    <Box key={`signal:${k}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
      {status && <Text color={ROLES[status[1]].theme} weight="medium">{status[0]}</Text>}
      {s.ci && glyph('dot', ui.surface, ui.t, CI_ROLE[s.ci])}
      {desktop
        ? s.reviewers.map(r => <Box key={`who:${k}:${r.login}`} flexShrink={0}><Svg source={avatarSvg(r.login, r.review)} alt={`${r.login} ${r.review}`} width={18} height={18} /></Box>)
        : s.reviewers.filter(r => r.review !== 'pending').map(r => <Text key={`who:${k}:${r.login}`} dimColor>{`${r.review === 'approved' ? '✓' : '✗'}${r.login}`}</Text>)}
      {s.files > 0 && <Text dimColor>{`${s.files} file${s.files === 1 ? '' : 's'}`}</Text>}
      {s.files > 0 && <Text color="success">{`+${s.additions}`}</Text>}
      {s.files > 0 && <Text color="error">{`−${s.deletions}`}</Text>}
    </Box>
  )
}

const line = (r: Flat, ui: Ui, open: (command: string[]) => unknown): RenderElement => {
  const { n } = r
  const { Box, Text, Link } = ui.t
  const kit = makeKit(ui.t, ui.surface)
  const desktop = kit.desktop
  const ref = n.ref && (n.ref.href && Link ? <Link href={n.ref.href}>{n.ref.text}</Link> : n.ref.text)
  const color = n.tone === 'you' ? ROLES.you.theme : undefined
  const rowKey = `row:${n.key}`
  // The kit's hover: the row tints under the pointer, and a secondary action shows only then.
  const scope = scopeOf(rowKey)
  return (
    <Box key={rowKey} flexDirection="row" alignItems="flex-start" columnGap={1} position="relative" overflow="hidden"
      paddingLeft={desktop ? r.depth : 0} hover={desktop ? { scope, backgroundColor: kit.theme.hover } : undefined}>
      {desktop ? kit.guides(n.key, r.guides) : r.lasts.length > 0 && <Text color="subtle" mono>{gutter(r.lasts)}</Text>}
      {glyph(n.icon, ui.surface, ui.t, n.role)}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text color={color} dimColor={n.tone === 'dim'} weight={n.strong ? 'medium' : undefined}>
          {ref && <Text dimColor={n.tone !== 'you'}>{ref}</Text>}
          {ref ? ` ${n.title}` : n.title}
        </Text>
        {n.signal && signalLine(n.key, n.signal, ui)}
      </Box>
      {n.right && <Text dimColor>{n.right}</Text>}
      {n.action && HoverReveal(kit, `action:${n.key}`, scope, n.action.always,
        kit.control(`editor:${n.key}`, 'open-in-editor', n.action.always ? ROLES.you.hex : ROLES.muted.hex, n.action.label, () => open(n.action!.target)))}
    </Box>
  )
}

// Below the tree, one section per change being built: every rule in full, ticked off as the build goes.
export const building = (view: View, ui: Ui): RenderElement[] => {
  const { Box, Text } = ui.t
  return view.registry.lanes.filter(l => l.state === 'building').flatMap(l => {
    const row = view.registry.plan?.prs.find(r => r.pr === l.pr)
    const rules = row?.rules ?? row?.criteria ?? []
    if (rules.length === 0) return []
    const done = new Set(l.rules?.done ?? [])
    const now = l.rules?.now ?? null
    const name = row?.name ?? humanize(l.branch, view.key) ?? l.pr
    return [(
      <Box key={`building:${l.id}`} flexDirection="column" marginTop={1}>
        <Box key={`building-head:${l.id}`} flexDirection="row" columnGap={1}>
          {glyph('build', ui.surface, ui.t, 'progress')}
          <Box flexGrow={1} flexShrink={1} minWidth={0}><Text weight="medium">{`Building the ${name}`}</Text></Box>
          <Text dimColor>{`${done.size} of ${rules.length}`}</Text>
        </Box>
        {rules.map((rule, i) => (
          <Box key={`rule:${l.id}:${i}`} flexDirection="row" columnGap={1} alignItems="flex-start">
            {glyph(done.has(i) ? 'done' : now === i ? 'progress' : 'pending', ui.surface, ui.t)}
            <Box flexGrow={1} flexShrink={1} minWidth={0}><Text dimColor={now !== i}>{rule}</Text></Box>
          </Box>
        ))}
      </Box>
    )]
  })
}

export const tracker = (state: LensState, view: View, ui: Ui, opts: {
  editor?: string; signals?: Record<string, Signal>; open?: (command: string[]) => unknown
} = {}): RenderElement => {
  const { Box } = ui.t
  const rows = withGuides(flatten(nodes(state, view, opts.editor, opts.signals)))
  return (
    <Box flexDirection="column" rowGap={0}>
      {rows.map(r => line(r, ui, opts.open ?? (() => undefined)))}
      {building(view, ui)}
    </Box>
  )
}
