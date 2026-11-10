import { expect, test } from 'claude-code/testing'

import { card } from './card'
import { checkFill, complete, drawn, TEMPLATES, type TemplateName } from './templates'

type Node = { type: string; props: Record<string, unknown>; children?: unknown }
const make = (type: string) => (props: Record<string, unknown>) => ({ type, props }) as never
const table = { Box: make('Box'), Text: make('Text'), Svg: make('Svg'), Code: make('Code'), Link: make('Link') } as never
const desktop = { surface: 'desktop', t: table } as const
const terminal = { surface: 'terminal', t: table } as const

const kids = (n: Node): unknown[] => {
  const c = n.children ?? n.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1)
}
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && 'type' in v
// The words of a Text, nested Texts and Links included.
const words = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (!isNode(v)) return ''
  if (v.type === 'Link') return String(v.props.label ?? v.props.href)
  if (v.type === 'Svg') return ''
  return kids(v).map(words).join('')
}
// Each Text is a line; a row Box joins its parts; Svgs draw nothing in words.
const lines = (v: unknown): string[] => {
  if (!isNode(v)) return typeof v === 'string' ? [v] : []
  if (v.type === 'Text' || v.type === 'Link') return [words(v)]
  if (v.type === 'Svg') return []
  const inner = kids(v).map(lines)
  if (v.props?.flexDirection === 'row') {
    const one = inner.flat().filter(Boolean).join(' ')
    return one ? [one] : []
  }
  return inner.flat()
}
const find = (v: unknown, ok: (n: Node) => boolean): Node[] =>
  isNode(v) ? [...(ok(v) ? [v] : []), ...kids(v).flatMap(k => find(k, ok))] : []

const RULES = [
  'When the quantity is 0 or below, the product is not eligible, and the product system is not asked.',
  'Every log line written while judging a request includes the quantity.',
]
const CRITERIA = [
  { text: 'Out-of-range answers are counted', state: 'passed', by: 'forge, Datadog' },
  { text: 'No discount for a basket over the limit', state: 'pending', by: 'you' },
]

export const FILLS: Record<TemplateName, Record<string, unknown>> = {
  review: { name: 'quantity rule', repo: 'orders-api', files: 6, rules: RULES },
  commit: {
    name: 'quantity rule', repo: 'orders-api', prTitle: 'PROJ-200 Judge eligibility on price × quantity',
    commit: 'PROJ-200 Judge eligibility on price × quantity',
    files: [{ path: 'Eligibility/EligibilityRule.cs', added: 48, removed: 12 }, { path: 'Eligibility/EligibilityRuleTests.cs', added: 131, removed: 0 }],
  },
  'rule-start': { name: 'quantity rule', n: 3, total: 6, rule: RULES[0] },
  'rule-done': { name: 'quantity rule', n: 3, total: 6, rule: RULES[0] },
  'checks-failing': {
    name: 'quantity rule', case: 'ours',
    failing: [{ check: 'Tests', link: 'https://tc/4812', count: 38, failures: [
      { location: 'src/EligibilityRuleTests.cs', reason: 'The rule is called without a quantity', count: 35 },
      { location: 'src/FederatedSchemaTests.cs:21', reason: 'The schema snapshot no longer matches' },
      { reason: 'Stopped after 30 minutes without a result' },
    ] }],
    others: [{ check: 'Build', state: 'passed' }, { check: 'Docs', state: 'skipped' }],
  },
  merge: {
    name: 'quantity rule', repo: 'orders-api', number: 212, link: 'https://gh/212', base: 'main',
    checks: { passed: 5, total: 5 }, approvals: { who: ['Sam'], got: 1, needed: 1 }, method: 'squash',
    moves: ['schema change'], subTask: 'PROJ-201',
  },
  merged: {
    name: 'quantity rule', repo: 'orders-api', number: 212, base: 'main', case: 'conflict', method: 'squash',
    moves: ['schema change'], subTask: 'PROJ-201', conflict: { name: 'schema change', files: ['schema/orders.graphql'] },
  },
  missing: {
    what: 'the checkout page never sends a quantity', found: 'building', foundIn: 'quantity rule',
    effect: 'every order is judged as one item', ticket: 'PROJ-200',
    needs: [{ kind: 'rule', text: RULES[0] }, { kind: 'done', text: 'A basket of 3 over the limit is refused' }],
    where: [{ repo: 'checkout-web', covered: false, locations: [{ location: 'src/checkout/eligibility.ts:41', reason: 'Calls the check with the price only' }] }],
  },
  'deploy-failed': {
    subTask: 'PROJ-201', title: 'Judge eligibility on price × quantity', env: 'acceptance', link: 'https://tc/9',
    step: 'Health check', reason: "The service didn't answer on /health within 5 minutes",
    envs: { testing: 'done', acceptance: 'failed', production: 'pending' },
  },
  'verify-ask': {
    n: 2, total: 2, criterion: 'A basket of 3 items over the limit is not offered the discount.',
    steps: ['Add 3 of one item above 700 to the basket.', 'Go to checkout. The discount must not be listed.'], criteria: CRITERIA,
  },
  'verify-failed': {
    n: 1, total: 2, criterion: 'Requests over every price range are counted as out of range.',
    found: '0 counted since the deploy at 15:10, while 2,140 requests were judged', source: 'Datadog', link: 'https://dd/q',
    criteria: [{ ...CRITERIA[0], state: 'failed' }, CRITERIA[1]],
  },
  cleanup: {
    ticket: 'PROJ-200', sessions: 2, closes: ['PROJ-201', 'PROJ-202', 'PROJ-200'],
    removes: [{ repo: 'orders-api', worktrees: [{ name: 'PROJ-200-quantity-rule', what: 'Worktree, its branch here and on GitHub' }] }],
    keeps: [{ repo: 'checkout-web', worktrees: [{ name: 'PROJ-200-send-quantity', why: '2 changed files not committed' }] }],
  },
  done: {
    ticket: 'PROJ-200', title: 'Add quantity to the eligibility check', since: '15:10',
    subTasks: [{ key: 'PROJ-201', title: 'Judge eligibility', prs: [{ number: 212, name: 'quantity rule' }] }],
    criteria: [{ text: 'Out-of-range answers are counted', by: 'forge, Datadog' }],
  },
}

const report = (template: TemplateName, fill = FILLS[template]) => {
  const done = complete({ ticket: 'PROJ-200', template, fill })
  if (!('report' in done)) throw new Error(done.problems.join('; '))
  return done.report as never
}

test('every template has a sample fill that passes its own check', () => {
  expect(Object.keys(FILLS).sort()).toEqual([...TEMPLATES].sort())
  for (const t of TEMPLATES) expect(checkFill(t, FILLS[t])).toEqual([])
})

test('every template draws on the desktop and the terminal, title first', () => {
  for (const t of TEMPLATES) {
    for (const ui of [desktop, terminal]) expect(lines(card(report(t), ui))[0]!.endsWith(drawn(t, FILLS[t] as never).title)).toBe(true)
  }
})

test('a wrong fill says what is wrong, by path', () => {
  expect(checkFill('review', { name: 'x', repo: 'y', rules: 'no' })).toEqual(['files is missing', 'rules must be a list'])
  expect(checkFill('merge', { ...FILLS.merge, method: 'fast' })).toEqual(['method must be one of squash, merge, rebase'])
  expect(checkFill('nope', {})[0]).toContain('template must be one of')
  expect('problems' in complete({ ticket: 'T', template: 'review', fill: {} })).toBe(true)
})

test('the template writes kind, needsYou, state, title and line', () => {
  expect(report('merge')).toMatchObject({
    kind: 'merge-ready', needsYou: true, state: 'call', title: 'Ready to merge: the quantity rule',
    line: 'Every merge rule is met in orders-api #212.',
  })
  expect(report('rule-done')).toMatchObject({ needsYou: false, title: 'Rule 3 of 6 holds in the quantity rule' })
})

test('review: the rules in full; nothing staged says so', () => {
  const l = lines(card(report('review'), terminal))
  expect(l).toContain('6 files ready to stage in orders-api.')
  for (const r of RULES) expect(l.some(x => x.includes(r))).toBe(true)
  expect(lines(card(report('review', { ...FILLS.review, nothingStaged: true, worktree: 'PROJ-1-x' }), terminal)))
    .toContain('Nothing is staged yet in PROJ-1-x.')
})

test('commit: a tree from the PR to each staged file with its lines', () => {
  const l = lines(card(report('commit'), terminal)).join('\n')
  expect(l).toContain('PROJ-200 Judge eligibility on price × quantity')
  expect(l).toContain('Eligibility/EligibilityRule.cs  +48 −12')
  expect(l).toContain('└─ ')
})

test('checks failing: the case in the title, every failure listed, a reason with no location', () => {
  const l = lines(card(report('checks-failing'), terminal))
  expect(l[0]).toBe('✗ Tests fail on the quantity rule')
  expect(l.join('\n')).toContain('src/EligibilityRuleTests.cs · 35')
  expect(l.join('\n')).toContain('Stopped after 30 minutes without a result.')
  expect(drawn('checks-failing', { ...FILLS['checks-failing'], case: 'base', base: 'main', failing: [{ check: 'Lint', failures: [{ reason: 'x' }] }] } as never).title)
    .toBe('Lint fails on main too')
  expect(drawn('checks-failing', { ...FILLS['checks-failing'], case: 'unknown' } as never)).toMatchObject({ needsYou: true, title: 'Tests fail, cause unknown' })
})

test('merged with a conflict lists the files and needs the person', () => {
  const d = drawn('merged', FILLS.merged as never)
  expect(d).toMatchObject({ needsYou: true, title: 'Merged, but the schema change conflicts with main' })
  expect(lines(card(report('merged'), terminal)).join('\n')).toContain('schema/orders.graphql')
})

test('deploy failed names where it is live and what will not start', () =>
  expect(lines(card(report('deploy-failed'), terminal)))
    .toContain('Judge eligibility on price × quantity is live in testing. The chain stopped at acceptance, so production won\'t start.'))

test('verify-ask marks only the criterion waiting on the person as theirs', () => {
  const tree = card(report('verify-ask'), desktop)
  const svgs = find(tree, n => n.type === 'Svg').map(n => String(n.props.alt))
  expect(svgs.filter(a => a === 'Needs you')).toHaveLength(2) // the heading and criterion 2
})

test('no text in a template card is set below the body size', () => {
  for (const t of TEMPLATES) {
    for (const n of find(card(report(t), desktop), x => x.type === 'Text')) expect(n.props.size ?? 'body').toBe('body')
  }
})

test('links are links: the check, the pull request, the source', () => {
  const hrefs = (t: TemplateName) => find(card(report(t), desktop), n => n.type === 'Link').map(n => n.props.href)
  expect(hrefs('checks-failing')).toEqual(['https://tc/4812'])
  expect(hrefs('merge')).toEqual(['https://gh/212'])
  expect(hrefs('verify-failed')).toEqual(['https://dd/q'])
})
