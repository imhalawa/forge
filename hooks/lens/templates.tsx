import type { RenderElement } from 'claude-code'

import type { ForgeReport } from '../../types'
import { makeKit } from '../kit'
import type { Ui } from './band'
import { glyph, type IconName, type Role } from './design'

// Forge's card templates (skills/forge/templates.md). The model fills in the blanks; the sentences are written here,
// so every card of one kind reads the same. A card is built from five elements: a heading, a paragraph, sections of
// rows, trees, and (outside the card) the app's question dialog.

// ---- Blanks -------------------------------------------------------------------------------------------------------

// What a blank must be. A string token is a type, a trailing `?` makes it optional; a list of strings is an enum;
// `{ arr }` is a list whose items match its spec; `{ obj }` is an object; `opt` makes either optional.
type Spec = 'str' | 'str?' | 'num' | 'num?' | 'bool?' | readonly string[] | { arr: Spec | Shape; opt?: boolean }
  | { obj: Shape; opt?: boolean }
type Shape = { readonly [key: string]: Spec }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const problems = (spec: Spec | Shape, v: unknown, at: string): string[] => {
  if (typeof spec === 'string') {
    const optional = spec.endsWith('?')
    if (v === undefined || v === null) return optional ? [] : [`${at} is missing`]
    const type = spec.replace('?', '')
    if (type === 'str') return typeof v === 'string' && v.trim() !== '' ? [] : [`${at} must be text`]
    if (type === 'num') return typeof v === 'number' && Number.isFinite(v) ? [] : [`${at} must be a number`]
    return typeof v === 'boolean' ? [] : [`${at} must be true or false`]
  }
  if (Array.isArray(spec)) return spec.includes(v as string) ? [] : [`${at} must be one of ${spec.join(', ')}`]
  if ('arr' in spec) {
    if (v === undefined || v === null) return spec.opt ? [] : [`${at} is missing`]
    if (!Array.isArray(v)) return [`${at} must be a list`]
    return v.flatMap((item, i) => problems(spec.arr as Spec | Shape, item, `${at}[${i}]`))
  }
  if ('obj' in spec) {
    if (v === undefined || v === null) return spec.opt ? [] : [`${at} is missing`]
    return problems(spec.obj, v, at)
  }
  if (!isObj(v)) return [`${at} must be an object`]
  return Object.entries(spec as Shape).flatMap(([k, s]) => problems(s, v[k], at ? `${at}.${k}` : k))
}

const CHECK_STATES = ['passed', 'running', 'waiting', 'skipped', 'cancelled'] as const
const ENV_STATES = ['done', 'running', 'failed', 'pending'] as const
const CRITERION_STATES = ['passed', 'failed', 'pending'] as const
const ENVS = ['testing', 'acceptance', 'production'] as const

const SHAPES = {
  review: { name: 'str', repo: 'str', files: 'num', rules: { arr: 'str' }, nothingStaged: 'bool?', worktree: 'str?' },
  commit: { name: 'str', repo: 'str', prTitle: 'str', commit: 'str', files: { arr: { path: 'str', added: 'num', removed: 'num' } } },
  'rule-start': { name: 'str', n: 'num', total: 'num', rule: 'str' },
  'rule-done': { name: 'str', n: 'num', total: 'num', rule: 'str' },
  'checks-failing': {
    name: 'str', case: ['ours', 'base', 'unknown'], base: 'str?', why: 'str?',
    failing: { arr: { check: 'str', link: 'str?', count: 'num?', failures: { arr: { location: 'str?', reason: 'str', count: 'num?' } } } },
    others: { arr: { check: 'str', state: CHECK_STATES }, opt: true },
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
    subTask: 'str', title: 'str', env: ENVS, link: 'str?', step: 'str', reason: 'str',
    envs: { obj: { testing: ENV_STATES, acceptance: ENV_STATES, production: ENV_STATES } },
  },
  'verify-ask': {
    n: 'num', total: 'num', criterion: 'str', steps: { arr: 'str' },
    criteria: { arr: { text: 'str', state: CRITERION_STATES, by: 'str' } },
  },
  'verify-failed': {
    n: 'num', total: 'num', criterion: 'str', found: 'str', source: 'str', link: 'str?',
    criteria: { arr: { text: 'str', state: CRITERION_STATES, by: 'str' } },
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
} as const satisfies Record<string, Shape>

export type TemplateName = keyof typeof SHAPES
export const TEMPLATES = Object.keys(SHAPES) as TemplateName[]

// What is wrong with a fill, one line each; empty when it is right.
export const checkFill = (template: string, fill: unknown): string[] =>
  template in SHAPES ? problems(SHAPES[template as TemplateName], fill, '') : [`template must be one of ${TEMPLATES.join(', ')}`]

// ---- Words --------------------------------------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fill = Record<string, any>

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
// "Tests fail", "Lint fails": a check named in the plural takes the plural verb.
const fails = (check: string) => (/[^s]s$/iu.test(check) ? 'fail' : 'fails')
const and = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const sentence = (s: string) => (/[.!?]$/u.test(s.trim()) ? s.trim() : `${s.trim()}.`)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const METHOD: Record<string, (base: string) => string> = {
  squash: base => `Squashed into one commit on ${base}`,
  merge: base => `Merged into ${base} with a merge commit`,
  rebase: base => `Rebased onto ${base}`,
}

// ---- Elements -----------------------------------------------------------------------------------------------------

type Para = { text: string; link?: { label: string; href?: string } }
type Row = { key: string; icon?: IconName; role?: Role; text: string; mono?: boolean; dim?: boolean; note?: string
  link?: string; count?: number; sub?: string; children?: Row[]; plus?: [number, number] }
type Section = { label?: string; rows: Row[]; wrap?: boolean }

export type Drawn = {
  icon: IconName; role?: Role; title: string; para: Para
  sections: Section[]
  needsYou: boolean; kind: ForgeReport['kind']; state: NonNullable<ForgeReport['state']>
}

const LEVEL = 3

const rowLine = (r: Row, ui: Ui, depth: number, last: boolean, path: string): RenderElement[] => {
  const { Box, Text, Link } = ui.t
  const kit = makeKit(ui.t, ui.surface)
  const key = `${path}:${r.key}`
  const label = r.link && Link ? <Link href={r.link} label={r.text} /> : r.text
  const gutter = depth > 0 && !kit.desktop ? `${'   '.repeat(depth - 1)}${last ? '└─ ' : '├─ '}` : ''
  const me = (
    <Box key={`row:${key}`} flexDirection="row" columnGap={1} alignItems="flex-start" position="relative" overflow="hidden"
      paddingLeft={kit.desktop ? depth * LEVEL : 0}>
      {kit.desktop && depth > 0 && kit.guides(key, [{ at: (depth - 1) * LEVEL, end: last }], true)}
      {gutter && <Text color="subtle" mono>{gutter}</Text>}
      {r.icon && glyph(r.icon, ui.surface, ui.t, r.role)}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Text mono={r.mono} dimColor={r.dim}>
          {label}
          {r.count !== undefined && r.count > 1 && <Text dimColor>{` · ${r.count}`}</Text>}
          {r.note && <Text dimColor>{` · ${r.note}`}</Text>}
          {r.plus && <Text color="success">{`  +${r.plus[0]}`}</Text>}
          {r.plus && <Text color="error">{` −${r.plus[1]}`}</Text>}
        </Text>
        {r.sub && <Text dimColor>{r.sub}</Text>}
      </Box>
    </Box>
  )
  const kids = r.children ?? []
  return [me, ...kids.flatMap((c, i) => rowLine(c, ui, depth + 1, i === kids.length - 1, key))]
}

// The row of other checks: icons and names in one line that wraps.
const wrapRow = (rows: Row[], ui: Ui, key: string): RenderElement => {
  const { Box, Text } = ui.t
  return (
    <Box key={`wrap:${key}`} flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
      {rows.map(r => (
        <Box key={`item:${key}:${r.key}`} flexDirection="row" columnGap={1}>
          {r.icon && glyph(r.icon, ui.surface, ui.t, r.role)}
          <Text dimColor>{r.text}</Text>
        </Box>
      ))}
    </Box>
  )
}

export const drawCard = (d: Drawn, ui: Ui): RenderElement => {
  const { Box, Text, Link } = ui.t
  const indent = 3
  const link = d.para.link
  return (
    <Box flexDirection="column">
      <Box key="title" flexDirection="row" columnGap={1} alignItems="flex-start">
        {glyph(d.icon, ui.surface, ui.t, d.role)}
        <Box flexGrow={1} flexShrink={1} minWidth={0}><Text weight="medium">{d.title}</Text></Box>
      </Box>
      <Box key="line" paddingLeft={indent}>
        <Text>
          {link ? d.para.text.split('{link}')[0] : d.para.text}
          {link && (link.href && Link ? <Link href={link.href} label={link.label} /> : link.label)}
          {link ? d.para.text.split('{link}')[1] ?? '' : ''}
        </Text>
      </Box>
      {d.sections.map((s, i) => (
        <Box key={`section:${i}`} flexDirection="column" paddingLeft={indent} marginTop={1}>
          {s.label && <Text weight="medium">{s.label}</Text>}
          {s.wrap ? wrapRow(s.rows, ui, `s${i}`) : s.rows.flatMap((r, j) => rowLine(r, ui, 0, j === s.rows.length - 1, `s${i}`))}
        </Box>
      ))}
    </Box>
  )
}

// ---- Templates ----------------------------------------------------------------------------------------------------

const ruleRows = (rules: string[], key: string): Row[] => rules.map((text, i) => ({ key: `${key}${i}`, icon: 'point', text }))

const CHECK_ICON: Record<string, [IconName, Role?]> = {
  passed: ['done'], running: ['progress'], waiting: ['waiting'], skipped: ['skipped'], cancelled: ['cancelled'],
}
const STEP_ICON: Record<string, [IconName, Role?]> = {
  done: ['done'], passed: ['done'], running: ['progress'], failed: ['failed'], pending: ['pending'],
}

const criteriaRows = (f: Fill): Row[] =>
  (f.criteria as Fill[]).map((c, i) => {
    const current = i === f.n - 1
    const [icon, role] = current && c.state === 'pending' ? ['you', undefined] as [IconName, undefined] : STEP_ICON[c.state]!
    return { key: `c${i}`, icon, role, text: c.text, note: c.by, dim: !current }
  })

const BUILD: Record<TemplateName, (f: Fill) => Drawn> = {
  review: f => ({
    icon: 'you', title: `Review the ${f.name}`, needsYou: true, kind: 'review', state: 'review',
    para: { text: f.nothingStaged ? `Nothing is staged yet for the ${f.name} in ${f.repo}.` : `${plural(f.files, 'file')} ready to stage in ${f.repo}.` },
    sections: [{ label: 'Rules', rows: ruleRows(f.rules, 'r') }],
  }),
  commit: f => ({
    icon: 'you', title: `Open a pull request for the ${f.name}`, needsYou: true, kind: 'review', state: 'review',
    para: { text: `${plural(f.files.length, 'file')} staged in ${f.repo}.` },
    sections: [{
      rows: [{
        key: 'pr', icon: 'pr', text: f.prTitle,
        children: [{
          key: 'commit', icon: 'commit', text: f.commit,
          children: (f.files as Fill[]).map((x, i) => ({ key: `f${i}`, text: x.path, mono: true, plus: [x.added, x.removed] as [number, number] })),
        }],
      }],
    }],
  }),
  'rule-start': f => ({
    icon: 'progress', title: `Building rule ${f.n} of ${f.total} in the ${f.name}`, needsYou: false, kind: 'progress', state: 'building',
    para: { text: f.rule }, sections: [],
  }),
  'rule-done': f => ({
    icon: 'done', title: `Rule ${f.n} of ${f.total} holds in the ${f.name}`, needsYou: false, kind: 'progress', state: 'building',
    para: { text: f.rule }, sections: [],
  }),
  'checks-failing': f => {
    const failing = f.failing as Fill[]
    const names = failing.map(c => c.check as string)
    const one = names[0]!
    const base = f.base ?? 'the base'
    const many = failing.reduce((n, c) => n + (c.count ?? (c.failures as Fill[]).reduce((m, x) => m + (x.count ?? 1), 0)), 0) > 1
    const heads: Record<string, Pick<Drawn, 'icon' | 'title' | 'needsYou' | 'state'> & { para: string }> = {
      ours: { icon: 'failed', title: `${and(names)} ${names.length > 1 ? 'fail' : fails(one)} on the ${f.name}`, needsYou: false, state: 'failed',
        para: `Forge is fixing ${many ? 'them' : 'it'} and pushes when ${many ? 'they pass' : 'it passes'}.` },
      base: { icon: 'waiting', title: `${and(names)} ${names.length > 1 ? 'fail' : fails(one)} on ${base} too`, needsYou: false, state: 'failed',
        para: `Forge runs ${names.length > 1 ? 'them' : 'it'} again once ${base} passes.` },
      unknown: { icon: 'you', title: `${and(names)} ${names.length > 1 ? 'fail' : fails(one)}, cause unknown`, needsYou: true, state: 'stopped',
        para: f.why ? sentence(f.why) : `${cap(base)} never ran ${names.length > 1 ? 'them' : 'it'}, so forge can't compare.` },
    }
    const h = heads[f.case]!
    const tree: Row[] = failing.map((c, i) => ({
      key: `k${i}`, icon: 'failed', text: c.check, link: c.link, count: c.count,
      children: (c.failures as Fill[]).map((x, j) => (x.location
        ? { key: `x${j}`, text: x.location, mono: true, count: x.count, sub: sentence(x.reason) }
        : { key: `x${j}`, text: sentence(x.reason), dim: true, count: x.count })),
    }))
    const others = (f.others ?? []) as Fill[]
    return {
      ...h, kind: 'ci', para: { text: h.para },
      sections: [
        { rows: tree },
        ...(others.length ? [{ wrap: true, rows: others.map((o, i) => ({ key: `o${i}`, icon: CHECK_ICON[o.state]![0], text: o.check })) }] : []),
      ],
    }
  },
  merge: f => {
    const rules: Row[] = [
      { key: 'checks', icon: 'done', text: `${f.checks.passed} of ${f.checks.total} checks passed` },
      ...(f.approvals ? [{ key: 'approvals', icon: 'done' as IconName, text: `Approved by ${and(f.approvals.who)}, ${f.approvals.got} of ${f.approvals.needed} needed` }] : []),
      { key: 'threads', icon: 'done', text: 'Every review thread resolved' },
      { key: 'base', icon: 'done', text: `Up to date with ${f.base}, no conflicts` },
    ]
    const after: Row[] = [
      { key: 'method', icon: 'merged', role: 'muted', text: METHOD[f.method]!(f.base) },
      ...((f.moves ?? []) as string[]).map((m, i) => ({ key: `m${i}`, icon: 'ship' as IconName, text: `The ${m} moves onto ${f.base} and its pull request targets ${f.base}` })),
      ...(f.subTask ? [{ key: 'sub', icon: 'ticket' as IconName, text: `${f.subTask} moves to done` }] : []),
    ]
    return {
      icon: 'you', title: `Ready to merge: the ${f.name}`, needsYou: true, kind: 'merge-ready', state: 'call',
      para: { text: 'Every merge rule is met in {link}.', link: { label: `${f.repo} #${f.number}`, href: f.link } },
      sections: [{ rows: rules }, { label: 'When it merges', rows: after }],
    }
  },
  merged: f => {
    const conflict = f.case === 'conflict' ? f.conflict as Fill | undefined : undefined
    const moves = ((f.moves ?? []) as string[]).filter(m => m !== conflict?.name)
    const rows: Row[] = [
      ...(f.case !== 'outside' ? [{ key: 'method', icon: 'done' as IconName, text: METHOD[f.method]!(f.base) }] : []),
      ...moves.map((m, i) => ({ key: `m${i}`, icon: 'done' as IconName, text: `The ${m} moved onto ${f.base}; its checks run again` })),
      ...(conflict ? [{
        key: 'conflict', icon: 'failed' as IconName, text: `The ${conflict.name} conflicts in`,
        children: (conflict.files as string[]).map((x, i) => ({ key: `c${i}`, text: x, mono: true })),
      }] : []),
      ...(f.subTask ? [{ key: 'sub', icon: 'done' as IconName, text: `${f.subTask} is done` }] : []),
    ]
    const heads = {
      clean: { icon: 'merged' as IconName, title: `Merged: the ${f.name}`, para: { text: `{link} is on ${f.base}.`, link: { label: `${f.repo} #${f.number}`, href: f.link } }, needsYou: false },
      conflict: { icon: 'you' as IconName, title: `Merged, but the ${conflict?.name ?? 'next change'} conflicts with ${f.base}`,
        para: { text: 'Its pull request now targets {base}, but its commits don\'t apply cleanly.'.replace('{base}', f.base) }, needsYou: true },
      outside: { icon: 'merged' as IconName, title: `Merged on GitHub: the ${f.name}`, para: { text: 'Forge saw it merge and carried on from there.' }, needsYou: false },
    }
    const h = heads[f.case as keyof typeof heads]
    return { ...h, kind: 'merged', state: h.needsYou ? 'stopped' : 'merged', sections: [{ rows }] }
  },
  missing: f => ({
    icon: 'you', title: `Missing: ${f.what}`, needsYou: true, kind: 'finding', state: 'stopped',
    para: { text: `Found while ${f.found === 'building' && f.foundIn ? `building the ${f.foundIn}` : f.found}. Without it, ${sentence(f.effect)}` },
    sections: [
      { label: 'Needs it', rows: (f.needs as Fill[]).map((x, i) => ({ key: `n${i}`, icon: (x.kind === 'rule' ? 'point' : 'target') as IconName, text: x.text })) },
      {
        label: 'Where it lives',
        rows: (f.where as Fill[]).map((w, i) => ({
          key: `w${i}`, icon: 'folder', text: w.repo, mono: true, note: w.covered === false ? 'no sub-task covers this repo' : undefined,
          children: ((w.locations ?? []) as Fill[]).map((l, j) => (l.location
            ? { key: `l${j}`, text: l.location, mono: true, sub: sentence(l.reason) }
            : { key: `l${j}`, text: sentence(l.reason), dim: true })),
        })),
      },
    ],
  }),
  'deploy-failed': f => {
    const env = f.env as typeof ENVS[number]
    const live = ENVS.filter(e => f.envs[e] === 'done')
    const later = ENVS.slice(ENVS.indexOf(env) + 1)
    const where = live.length ? `${f.title} is live in ${and(live)}.` : `${f.title} isn't live anywhere yet.`
    const stop = later.length ? ` The chain stopped at ${env}, so ${and(later)} won't start.` : ` The chain stopped at ${env}.`
    return {
      icon: 'you', title: `${cap(env)} deploy failed: ${f.subTask}`, needsYou: true, kind: 'finding', state: 'failed',
      para: { text: where + stop },
      sections: [
        { label: 'What failed', rows: [{ key: 'deploy', icon: 'failed', text: `Deploy to ${env}`, link: f.link,
          children: [{ key: 'step', text: f.step, sub: sentence(f.reason) }] }] },
        { label: 'Environments', rows: ENVS.map(e => ({ key: e, icon: STEP_ICON[f.envs[e]]![0], text: cap(e), dim: f.envs[e] === 'pending' })) },
      ],
    }
  },
  'verify-ask': f => ({
    icon: 'you', title: `Check in production: done criterion ${f.n} of ${f.total}`, needsYou: true, kind: 'finding', state: 'call',
    para: { text: f.criterion },
    sections: [
      { label: 'How to check', rows: ruleRows(f.steps, 's') },
      { label: 'Done criteria', rows: criteriaRows(f) },
    ],
  }),
  'verify-failed': f => ({
    icon: 'you', title: `Doesn't hold in production: done criterion ${f.n} of ${f.total}`, needsYou: true, kind: 'finding', state: 'failed',
    para: { text: f.criterion },
    sections: [
      { label: 'What forge found', rows: [{ key: 'found', icon: 'failed', text: sentence(f.found),
        children: f.link ? [{ key: 'open', text: `Open in ${f.source}`, link: f.link }] : [] }] },
      { label: 'Done criteria', rows: criteriaRows(f) },
    ],
  }),
  cleanup: f => {
    const keeps = (f.keeps ?? []) as Fill[]
    return {
      icon: 'you', title: `Clean up ${f.ticket}`, needsYou: true, kind: 'finding', state: 'call',
      para: { text: 'Every done criterion holds in production. Forge removes what it made for this ticket and closes it.' },
      sections: [
        { label: 'Removes', rows: [
          ...(f.removes as Fill[]).map((r, i) => ({ key: `r${i}`, icon: 'folder' as IconName, text: r.repo, mono: true,
            children: (r.worktrees as Fill[]).map((w, j) => ({ key: `w${j}`, icon: 'worktree' as IconName, text: w.name, mono: true, sub: w.what })) })),
          ...(f.sessions ? [{ key: 'sessions', icon: 'session' as IconName, text: `${plural(f.sessions, 'building session')}, archived` }] : []),
        ] },
        ...(keeps.length ? [{ label: 'Keeps', rows: keeps.map((r, i) => ({ key: `k${i}`, icon: 'folder' as IconName, text: r.repo, mono: true,
          children: (r.worktrees as Fill[]).map((w, j) => ({ key: `w${j}`, icon: 'worktree' as IconName, role: 'you' as Role, text: w.name, mono: true, sub: sentence(w.why) })) })) }] : []),
        { label: 'Closes', rows: [{ key: 'closes', icon: 'ticket', text: and(f.closes) }] },
      ],
    }
  },
  done: f => ({
    icon: 'done', title: `${f.ticket} is done`, needsYou: false, kind: 'delivered', state: 'done',
    para: { text: `${f.title} is live in production since ${f.since}, every done criterion holds, and everything forge made is cleaned up.` },
    sections: [
      { label: 'Sub-tasks', rows: (f.subTasks as Fill[]).map((s, i) => ({ key: `s${i}`, icon: 'done', text: `${s.key} ${s.title}`, link: s.link,
        children: (s.prs as Fill[]).map((p, j) => ({ key: `p${j}`, icon: 'merged' as IconName, text: `#${p.number} the ${p.name}`, link: p.link })) })) },
      { label: 'Done criteria', rows: (f.criteria as Fill[]).map((c, i) => ({ key: `c${i}`, icon: 'done', text: c.text, note: c.by })) },
    ],
  }),
}

// The card a template draws from its blanks; checked first with checkFill.
export const drawn = (template: TemplateName, fill: Fill): Drawn => BUILD[template](fill)
export const templateCard = (template: TemplateName, fill: Fill, ui: Ui): RenderElement => drawCard(drawn(template, fill), ui)

// A report sent as a template and its blanks, with what the lens keeps from every report filled in from the template:
// its kind, whether it needs the person, its state, its title and its line. A report with no template is left as it is;
// a template with wrong blanks returns what is wrong.
export const complete = (input: Record<string, unknown>): { report: Record<string, unknown> } | { problems: string[] } => {
  if (input.template === undefined) return { report: input }
  const wrong = checkFill(String(input.template), input.fill)
  if (wrong.length) return { problems: wrong }
  const d = drawn(input.template as TemplateName, input.fill as Fill)
  const line = d.para.link ? d.para.text.replace('{link}', d.para.link.label) : d.para.text
  return { report: { ...input, kind: d.kind, needsYou: d.needsYou, state: d.state, title: d.title, line } }
}
