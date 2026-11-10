import type { RenderElement } from 'claude-code'

import type { CleanupState, Environment, ForgeReport, LensState, StepState } from '../../types'
import { HoverReveal, makeKit, scopeOf, type Guide } from '../kit'
import type { Ui } from './band'
import { avatarSvg, glyph, type IconName, ROLES, type Role } from './design'
import { ticketUrl } from './links'
import { humanize } from './registry'
import { CI_ROLE, type Signal, waitingOn } from './signals'
import { manualDone, type PrNode, tree, type View } from './tree'

type State = NonNullable<ForgeReport['state']>

// A lane's state as one of forge's icons. Its colour is the icon's role.
export const STATE_ICON: Record<State, IconName> = {
  pending: 'pending', building: 'progress', queue: 'waiting', waits: 'waiting', stopped: 'you', review: 'review',
  call: 'you', open: 'progress', ci: 'progress', passed: 'done', failed: 'failed', changes: 'progress', fixed: 'progress',
  approved: 'done', merged: 'merged', rebased: 'progress', done: 'done', confirmed: 'done',
}

// One row of the pane. Every label sits on the title's line as muted text (`count`) or on lines of its own under it
// (`note`, the PR's `signal`): nothing is drawn in a column at the right, so no width splits a label.
export type Node = {
  key: string
  icon: IconName
  role?: Role
  ref?: { text: string; href?: string | null }
  title: string
  tone?: 'you' | 'dim'
  strong?: boolean
  count?: string                // muted, after the title: "8 of 8 merged"
  note?: string                 // muted, under the title
  // A row that folds: its children show only while it is open. `open` is its default, before the person toggles it.
  fold?: { open: boolean }
  // A row's one action: open its worktree (`target`), or run `press`; `icon` defaults to the editor's.
  action?: { label: string; target?: string[]; press?: () => unknown; icon?: 'open-in-editor' | 'refresh'; always: boolean }
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

// A title's leading "[Component] " is a label, not the title: it moves to the muted line under it.
export const splitPrefix = (title: string): { prefix?: string; rest: string } => {
  const m = /^\s*\[([^\]]+)\]\s*(.+)$/u.exec(title)
  return m ? { prefix: m[1]!.trim(), rest: m[2]! } : { rest: title }
}

// Break points a narrow pane can use in long unbroken words (paths, team names, export names): after `/`, `-`, `_`
// and `.`, and before a capital that follows a small letter. Invisible; words of 16 letters or fewer stay whole.
const ZWSP = '​'
export const breakable = (text: string): string =>
  text.replace(/\S{17,}/gu, word => word.replace(/([/\-_.])/gu, `$1${ZWSP}`).replace(/([a-z])([A-Z])/gu, `$1${ZWSP}$2`))

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
  // A held PR, or one that merges only after another is deployed, waits: forge does not ask to merge it.
  const after = row?.mergeAfter && view.registry.plan?.prs.find(r => r.pr === row.mergeAfter!.pr)
  const held = n.state !== 'merged' && (row?.hold || after)
    ? (row?.hold ? `Held: ${row.hold}` : `Merges after ${after?.name ?? row!.mergeAfter!.pr} is in ${row!.mergeAfter!.deployedTo}`) : undefined
  if (held) {
    return { key: n.pr, icon: 'waiting', ref, title: name, tone: 'dim', note: held, signal: n.url ? signals[n.url] : undefined, children: [] }
  }
  return {
    key: n.pr, icon: STATE_ICON[n.state], ref, title: name,
    tone: n.needsYou ? 'you' : WAITING.has(n.state) ? 'dim' : undefined,
    action: target ? { label: 'Open in the editor', target, always: false } : undefined,
    signal: n.url ? signals[n.url] : undefined, children: [],
  }
}

const ENVS: [Environment, string][] = [['testing', 'T'], ['acceptance', 'A'], ['production', 'P']]
const STATE_MARK: Record<StepState, string> = { pending: '○', running: '◐', done: '✓', passed: '✓', failed: '✗', waiting: '○' }
const stepIcon = (s: StepState | undefined): IconName =>
  s === 'done' || s === 'passed' ? 'done' : s === 'running' ? 'progress' : s === 'failed' ? 'failed' : s === 'waiting' ? 'you' : 'pending'
const count = (n: number, of: number, what: string) => `${n} of ${of} ${what}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// A sub-task's title with its "[repo]" prefix moved under it.
const titled = (title: string | undefined, note?: string): Pick<Node, 'title' | 'note'> => {
  const { prefix, rest } = splitPrefix(title ?? '')
  const notes = [prefix, note].filter(Boolean)
  return { title: rest, note: notes.length ? notes.join(' · ') : undefined }
}

// The run as its five steps: Plan, Implement, Deploy, Verify, Clean up. Each step folds; the one in progress opens.
// Implement holds the sub-tasks and their PRs; Deploy and Clean up count sub-tasks; Verify checks each done criterion.
export const nodes = (state: LensState, view: View, editor = 'vscode', signals: Record<string, Signal> = {}, refresh?: () => unknown): Node => {
  const reg = view.registry
  const subs = tree(view, state)
  const prs = subs.flatMap(s => s.prs).filter(n => !n.dropped)
  const merged = prs.filter(n => n.state === 'merged').length
  const planned = (reg.plan?.prs.length ?? 0) > 0 || subs.length > 0
  // A sub-task with no pull request counts as much as one with: the run is not past a step while it is open.
  const manual = subs.filter(s => s.manual)
  const manualOpen = manual.filter(s => !manualDone(s)).length
  const coded = subs.filter(s => !s.manual)
  const implemented = (prs.length > 0 || manual.length > 0) && merged === prs.length && manualOpen === 0

  const tasks: Node[] = subs.map(s => {
    if (s.manual) {
      const finished = manualDone(s)
      return {
        key: s.key, icon: finished ? 'done' : 'pending', ref: { text: s.key, href: s.url }, ...titled(s.title, 'No pull request'),
        tone: finished ? undefined : 'dim', children: [],
      }
    }
    const live = s.prs.filter(n => !n.dropped)
    const needs = live.some(n => n.needsYou)
    const done = live.length > 0 && live.every(n => n.state === 'merged')
    return {
      key: s.key, icon: needs ? 'you' : done ? 'done' : live.some(n => n.lane) ? 'progress' : 'pending',
      ref: { text: s.key, href: s.url }, ...titled(s.title), tone: needs ? 'you' : undefined,
      children: live.map(n => prNode(n, view, live.length === 1, editor, signals)),
    }
  })

  // Deploy: a sub-task is in an environment once every one of its PRs is deployed there. Sub-tasks live in production
  // fold into one row; the rest show, a deploy nobody started in amber.
  const deployRow = (s: (typeof coded)[number]): Node => {
    const envs = reg.deploy?.[s.key] ?? {}
    const marks = ENVS.map(([env, short]) => `${short}${STATE_MARK[envs[env] ?? 'pending']}`).join(' ')
    const waiting = ENVS.find(([env]) => envs[env] === 'waiting')
    const started = Object.values(envs).some(v => v && v !== 'pending' && v !== 'waiting')
    const t = titled(s.title)
    if (waiting) {
      return {
        key: `deploy:${s.key}`, icon: 'you', ref: { text: s.key, href: s.url }, title: t.title, tone: 'you',
        note: [t.note, `Merged, no deploy started in ${waiting[0]}`, `Start it in TeamCity · ${marks}`].filter(Boolean).join('\n'), children: [],
      }
    }
    return {
      key: `deploy:${s.key}`, icon: stepIcon(envs.production ?? (started ? 'running' : 'pending')),
      ref: { text: s.key, href: s.url }, title: t.title, tone: started ? undefined : 'dim',
      note: [t.note, marks].filter(Boolean).join(' · '), children: [],
    }
  }
  const liveSubs = coded.filter(s => reg.deploy?.[s.key]?.production === 'done')
  const moving = coded.filter(s => reg.deploy?.[s.key]?.production !== 'done')
  const live = liveSubs.length
  const deployed = coded.length > 0 && live === coded.length && manualOpen === 0
  const deployRows: Node[] = [
    ...moving.map(deployRow),
    ...(liveSubs.length ? [{
      key: 'deploy:live', icon: 'done' as IconName, title: `${plural(live, 'sub-task')} live in production`, tone: 'dim' as const,
      fold: { open: false }, children: liveSubs.map(deployRow),
    }] : []),
  ]

  // Verify: each done criterion from Plan, checked in production by forge or by the person.
  const criteria = reg.plan?.done ?? []
  const verifyRows: Node[] = criteria.map((c, i) => {
    const st = reg.verify?.[String(i)]
    // The person checks it: Plan writes `you`; `user` is read the same way.
    const theirs = c.by === 'you' || (c.by as string) === 'user'
    const yours = theirs && deployed && st !== 'passed' && st !== 'failed'
    return {
      key: `verify:${i}`, icon: yours ? 'you' : stepIcon(st), title: c.criterion,
      tone: yours ? 'you' : !st || st === 'pending' ? 'dim' : undefined,
      note: theirs ? 'Yours to check' : `Forge checks it${c.source ? ` in ${c.source}` : ''}`, children: [],
    }
  })
  // No done criteria is not a pass: Plan must settle them before anything is verified.
  if (criteria.length === 0 && deployed) {
    verifyRows.push({ key: 'verify:none', icon: 'you', title: 'No done criteria yet: Plan settles them', tone: 'you', children: [] })
  }
  const passed = criteria.filter((_, i) => reg.verify?.[String(i)] === 'passed').length
  const verified = criteria.length > 0 && passed === criteria.length
  const yoursOpen = verifyRows.filter(r => r.icon === 'you').length

  // Clean up: a sub-task is clean once its worktrees, branches and sessions are gone and it is closed.
  const clean = (k: keyof CleanupState) => subs.filter(s => {
    const c = reg.cleanup?.[s.key]
    return typeof c === 'object' && c[k] === true
  }).length
  const total = subs.length
  const cleanStage = (key: string, title: string, n: number): Node => ({
    key, icon: n === total && total > 0 ? 'done' : n > 0 ? 'progress' : 'pending', title,
    tone: n === 0 ? 'dim' : undefined, count: `${n} of ${total}`, children: [],
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

  // A step: its state icon (amber when something in it needs the person), its name, and its count inline. It folds;
  // the step in progress, or one that needs the person, opens.
  const needsIn = (rows: Node[]): boolean => rows.some(r => r.tone === 'you' || needsIn(r.children))
  const step = (key: string, title: string, done: boolean, current: boolean, more: Partial<Node> = {}): Node => {
    const children = more.children ?? []
    const needs = needsIn(children)
    return {
      key, icon: needs ? 'you' : done ? 'done' : current ? 'progress' : 'pending', title, strong: current || needs,
      tone: !done && !current && !needs ? 'dim' : undefined, fold: { open: (current || needs) && children.length > 0 }, ...more, children,
    }
  }
  const sub = (key: string, title: string, done: boolean): Node =>
    ({ key, icon: done ? 'done' : 'pending', title, tone: done ? undefined : 'dim', children: [] })
  // A missing piece found after planning sends the run back to Plan until its sub-tasks exist.
  const gaps = Object.entries(reg.gaps ?? {}).sort(([a], [b]) => Number(a) - Number(b))
  const gapPlanning = gaps.some(([, g]) => g.state === 'planning')
  const gapRows: Node[] = gaps.map(([i, g]) => ({
    key: `gap:${i}`, icon: g.state === 'planning' ? 'progress' : 'done', title: `Missing: ${g.gap}`,
    note: g.subTasks?.length ? `${plural(g.subTasks.length, 'sub-task')} added` : undefined, children: [],
  }))
  const type = reg.plan?.parent?.type ?? 'story'
  const head = splitPrefix(state.title ?? reg.plan?.parent?.title ?? '')
  return {
    key: view.key, icon: type, ref: { text: view.key, href: ticketUrl(reg.plan?.trackerUrl, view.key) },
    title: head.rest, note: head.prefix, strong: true,
    action: refresh ? { label: 'Refresh', press: refresh, icon: 'refresh', always: true } : undefined,
    children: [
      step('plan', 'Plan', planned && !gapPlanning, !planned || gapPlanning, {
        count: total > 0 ? plural(total, 'sub-task') : undefined,
        children: [sub('plan:investigate', 'Investigate', planned), sub('plan:breakdown', 'Break down', planned), ...gapRows],
      }),
      step('implement', 'Implement', implemented, planned && !implemented, {
        count: prs.length ? count(merged, prs.length, 'merged') : undefined, children: tasks,
      }),
      step('deploy', 'Deploy', deployed, (implemented && !deployed) || (live > 0 && !deployed), {
        count: coded.length > 0 ? count(live, coded.length, 'live') : undefined, children: deployRows,
      }),
      step('verify', 'Verify', verified, deployed && !verified, {
        count: yoursOpen > 0 ? `${yoursOpen} needs you` : criteria.length > 0 ? count(passed, criteria.length, 'hold') : undefined,
        children: verifyRows,
      }),
      step('cleanup', 'Clean up', cleaned, verified && !cleaned, { children: cleanRows }),
    ],
  }
}

// The terminal's tree edge as text, `│ ├─`; the desktop draws the kit's guides instead.
const gutter = (lasts: boolean[]): string =>
  lasts.map((last, i) => (i === lasts.length - 1 ? (last ? '└─' : '├─') : (last ? '  ' : '│ '))).join('')

// Each tree level is 3 cells deep; a row's guides sit at its open ancestors' cells.
const LEVEL = 3

type Flat = { n: Node; lasts: boolean[]; depth: number; guides: Guide[]; open: boolean }

// Whether a folding row is open: the person's toggle, else its default.
const isOpen = (n: Node, folds: Record<string, boolean>): boolean => folds[n.key] ?? n.fold?.open ?? true

// The rows to draw. The header's children (the steps) sit at the left edge with no tree line; under an open row its
// children follow, with tree lines.
const flatten = (n: Node, folds: Record<string, boolean>, lasts: boolean[] = [], root = true): Flat[] => {
  const open = isOpen(n, folds)
  const self: Flat = { n, lasts, depth: lasts.length * LEVEL, guides: [], open }
  if (!open) return [self]
  if (root) return [self, ...n.children.flatMap(c => flatten(c, folds, [], false))]
  return [self, ...n.children.flatMap((c, i) => flatten(c, folds, [...lasts, i === n.children.length - 1], false))]
}

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

// What GitHub says about a PR, on lines under its name: whose move it is, its checks, its reviewers and its size.
// The pieces wrap as whole groups; past four reviewers the rest count as "+n".
const signalLine = (k: string, s: Signal, ui: Ui): RenderElement => {
  const { Box, Text } = ui.t
  const Svg = ui.t.Svg!
  const desktop = ui.surface !== 'terminal' && !!ui.t.Svg
  const status = waitingOn(s)
  const shown = s.reviewers.slice(0, 4)
  const more = s.reviewers.length - shown.length
  return (
    <Box key={`signal:${k}`} flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
      {status && <Text color={ROLES[status[1]].theme} weight="medium">{breakable(status[0])}</Text>}
      {s.ci && glyph('dot', ui.surface, ui.t, CI_ROLE[s.ci])}
      {desktop
        ? shown.map(r => <Box key={`who:${k}:${r.login}`} flexShrink={0}><Svg source={avatarSvg(r.login, r.review)} alt={`${r.login} ${r.review}`} width={18} height={18} /></Box>)
        : shown.filter(r => r.review !== 'pending').map(r => <Text key={`who:${k}:${r.login}`} dimColor>{`${r.review === 'approved' ? '✓' : '✗'}${r.login}`}</Text>)}
      {more > 0 && <Text dimColor>{`+${more}`}</Text>}
      {s.files > 0 && <Text dimColor>{`${s.files} file${s.files === 1 ? '' : 's'}`}</Text>}
      {s.files > 0 && <Text color="success">{`+${s.additions}`}</Text>}
      {s.files > 0 && <Text color="error">{`−${s.deletions}`}</Text>}
    </Box>
  )
}

const line = (r: Flat, ui: Ui, open: (command: string[]) => unknown, toggle: (key: string, open: boolean) => unknown): RenderElement => {
  const { n } = r
  const { Box, Text, Link } = ui.t
  const kit = makeKit(ui.t, ui.surface)
  const desktop = kit.desktop
  const soft = (text: string) => (desktop ? breakable(text) : text)
  const ref = n.ref && (n.ref.href && Link ? <Link href={n.ref.href}>{n.ref.text}</Link> : n.ref.text)
  const color = n.tone === 'you' ? ROLES.you.theme : undefined
  const rowKey = `row:${n.key}`
  // The kit's hover: the row tints under the pointer, and a secondary action shows only then.
  const scope = scopeOf(rowKey)
  // A folding row's chevron: always there while open; on the desktop, otherwise only under the pointer.
  const chevron = n.fold && n.children.length > 0 && HoverReveal(kit, `fold:${n.key}`, scope, r.open,
    kit.control(`toggle:${n.key}`, r.open ? 'chevron-down' : 'chevron-right', ROLES.muted.hex, r.open ? 'Fold' : 'Open', () => toggle(n.key, r.open)))
  return (
    <Box key={rowKey} flexDirection="row" alignItems="flex-start" columnGap={1} position="relative" overflow="hidden"
      paddingLeft={desktop ? r.depth : 0} hover={desktop ? { scope, backgroundColor: kit.theme.hover } : undefined}>
      {desktop ? kit.guides(n.key, r.guides) : r.lasts.length > 0 && <Text color="subtle" mono>{gutter(r.lasts)}</Text>}
      {chevron}
      {glyph(n.icon, ui.surface, ui.t, n.role)}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text color={color} dimColor={n.tone === 'dim'} weight={n.strong ? 'medium' : undefined}>
          {ref && <Text dimColor={n.tone !== 'you'}>{ref}</Text>}
          {ref ? ` ${soft(n.title)}` : soft(n.title)}
          {n.count && <Text dimColor weight="regular">{` · ${n.count}`}</Text>}
        </Text>
        {n.note && n.note.split('\n').map((l, i) => <Text key={`note:${n.key}:${i}`} dimColor>{soft(l)}</Text>)}
        {n.signal && signalLine(n.key, n.signal, ui)}
      </Box>
      {n.action && HoverReveal(kit, `action:${n.key}`, scope, n.action.always,
        kit.control(`${n.action.icon ?? 'editor'}:${n.key}`, n.action.icon ?? 'open-in-editor',
          n.action.icon === 'refresh' ? ROLES.muted.hex : n.action.always ? ROLES.you.hex : ROLES.muted.hex, n.action.label,
          () => (n.action!.press ? n.action!.press() : n.action!.target && open(n.action!.target))))}
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
          <Box flexGrow={1} flexShrink={1} minWidth={0}>
            <Text weight="medium">{`Building the ${name}`}<Text dimColor weight="regular">{` · ${done.size} of ${rules.length}`}</Text></Text>
          </Box>
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
  editor?: string; signals?: Record<string, Signal>; open?: (command: string[]) => unknown; refresh?: () => unknown
  folds?: Record<string, boolean>; toggle?: (key: string, open: boolean) => unknown
} = {}): RenderElement => {
  const { Box } = ui.t
  const rows = withGuides(flatten(nodes(state, view, opts.editor, opts.signals, opts.refresh), opts.folds ?? {}))
  const toggle = opts.toggle ?? (() => undefined)
  return (
    <Box flexDirection="column" rowGap={0}>
      {rows.map(r => line(r, ui, opts.open ?? (() => undefined), toggle))}
      {building(view, ui)}
    </Box>
  )
}
