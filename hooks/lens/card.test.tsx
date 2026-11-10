import { expect, test } from 'claude-code/testing'

import type { ForgeReport } from '../../types'
import { ACCENT } from './band'
import { card } from './card'
import { conductor, lane, SCENARIOS } from './fixtures'

// A table of plain-data elements, so a card's tree can be read without a surface.
type Node = { type: string; props: Record<string, unknown>; children?: unknown }
const make = (type: string) => (props: Record<string, unknown>) => ({ type, props }) as never
const table = { Box: make('Box'), Text: make('Text'), Svg: make('Svg'), Code: make('Code'), Button: make('Button') } as never
const ui = { surface: 'desktop', t: table } as const
const uiTerminal = { surface: 'terminal', t: table } as const

const kids = (n: Node): unknown[] => {
  const c = n.children ?? n.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1)
}
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && 'type' in v

// Each Text is a line, a Code is one line per source line, a row Box joins its children into one.
const lines = (v: unknown): string[] => {
  if (typeof v === 'string' || typeof v === 'number') return [String(v)]
  if (!isNode(v)) return []
  if (v.type === 'Svg') return []
  if (v.type === 'engine') return ['engine']
  if (v.type === 'Code') return String(v.props.source).split('\n')
  if (v.type === 'Text') return [kids(v).filter(k => typeof k === 'string' || typeof k === 'number').join('')]
  const inner = kids(v).map(lines)
  if (v.props?.flexDirection === 'row') {
    const one = inner.flat().filter(Boolean).join(' ')
    return one ? [one] : []
  }
  return inner.flat()
}
const find = (v: unknown, ok: (n: Node) => boolean): Node[] =>
  isNode(v) ? [...(ok(v) ? [v] : []), ...kids(v).flatMap(k => find(k, ok))] : []

// The card's blocks, by the key each top-level child carries (`section:Changed` is a section).
const blocks = (v: unknown) =>
  isNode(v) ? kids(v).filter(isNode).map(n => String(n.props.key ?? '').split(':')[0]) : []
const buttons = (v: unknown) => find(v, n => n.type === 'Button')
// The surface's count: a row to a line, one more for each 40 columns it comes to.
const rowCount = (v: unknown) => lines(v).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 40)), 0)

const asking = (n: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11) => SCENARIOS[n].findLast(r => r.needsYou)!
const withItems = (n: number): ForgeReport =>
  conductor('progress', 'Many items', { sections: [{ label: 'Changed', items: Array.from({ length: n }, (_, i) => `file${i + 1}.cs`) }] })
const withEvidenceLines = (n: number): ForgeReport =>
  conductor('progress', 'Long log', { evidence: [{ label: 'dotnet test', text: Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n') }] })

// The card

test('a card is always drawn in full, expanded or not', () =>
  expect(blocks(card(SCENARIOS[6].at(-1)!, ui))).toEqual(blocks(card(SCENARIOS[6].at(-1)!, ui, true))))

test('a card shows the title, the line, its sections and choices, never facts or evidence', () =>
  expect(blocks(card(SCENARIOS[6].at(-1)!, ui, true))).toEqual(['title', 'line', 'section', 'section', 'choices']))

// Scenario 9 ends on wt-4, which waits; its call is the merge-ready report.
test('a call card has no tag and no outline: its amber icon says it', () => {
  const tree = card(asking(9), ui) as unknown as Node
  expect(tree.props.borderStyle).toBeUndefined()
  expect(lines(tree)[0]).toBe('PR #41 · ready to merge')
  expect(lines(tree).join(' ')).not.toContain('Your call')
})

test('fyi card has no outline and no tag', () => {
  const tree = card(SCENARIOS[7].at(-1)!, ui) as unknown as Node
  expect(tree.props.borderStyle).toBeUndefined()
  expect(lines(tree).join(' ')).not.toContain('Your call')
})

test('fyi card has no buttons', () => expect(buttons(card(SCENARIOS[7].at(-1)!, ui))).toEqual([]))

test('a section lists every item as a bullet, never "+n more"', () => {
  const l = lines(card(withItems(5), ui, true))
  expect(l.filter(x => x.startsWith('• ') && x.includes('file'))).toHaveLength(5)
  expect(l.some(x => x.includes('more'))).toBe(false)
})

test('evidence never shows on a card', () => {
  const tree = card(asking(2), ui, true)
  expect(find(tree, n => n.type === 'Code')).toEqual([])
  expect(lines(tree)).not.toContain('src/Refunds/RefundHandler.cs:48')
})

test('each choice shows its consequence', () =>
  expect(lines(card(SCENARIOS[5].at(-1)!, ui, true))).toContain('Narrow it — Forge rewrites criterion 2 and goes on'))

test('facts never show on a card', () =>
  expect(lines(card(SCENARIOS[6].at(-1)!, ui, true))).not.toContain('branch PROJ-123-refund-metric'))

test('a card with only a title and line has two blocks', () =>
  expect(blocks(card(conductor('started', 'Refund metric'), ui))).toEqual(['title', 'line']))

test('the terminal card uses the needs-you glyph', () =>
  expect(lines(card(asking(9), uiTerminal))[0]).toBe('! PR #41 · ready to merge'))

test('verdict sections become one checklist under the sentence', () => {
  const r = conductor('planning', 'Sub-tasks: 1 sub-task, 2 stacked PRs', {
    needsYou: true, ask: 'Approve the sub-tasks?', line: 'Add the rule first, then the schema arguments on top.',
    sections: [
      { label: 'Requirements mapped', items: ['Pass'] },
      { label: 'Automated checks', items: ['Pass: criterion 10 is checked by TeamCity steps'] },
      { label: 'Scope', items: ['Fail: one criterion is out of scope'] },
      { label: 'Notes', items: ['Not a verdict'] },
    ],
  })
  expect(lines(card(r, uiTerminal))).toEqual([
    '! Sub-tasks: 1 sub-task, 2 stacked PRs',
    'Add the rule first, then the schema arguments on top.',
    '✓ Requirements mapped',
    '✓ Automated checks',
    '✗ Scope',
    'Notes',
    '• Not a verdict',
  ])
})

test('no Text in a card truncates', () => {
  for (const t of find(card(SCENARIOS[6].at(-1)!, ui), n => n.type === 'Text')) expect(t.props.wrap ?? 'wrap').toBe('wrap')
})

test('only the accent and the icon carry colour', () => {
  const coloured = find(card(asking(5), uiTerminal), n => n.props.color !== undefined || n.props.borderColor !== undefined)
  for (const n of coloured) expect([ACCENT, 'suggestion', 'warning']).toContain(n.props.color ?? n.props.borderColor)
})

test('every scenario report draws a card on both tables', () => {
  for (const reports of Object.values(SCENARIOS)) {
    for (const r of reports) for (const u of [ui, uiTerminal]) expect(() => card(r, u)).not.toThrow()
  }
})

// The hooks

const TOOL = 'mcp__forge__forge_report'
const ROW = (input: unknown, tool = TOOL) => ({
  plugin: 'forge',
  component: 'ToolUse',
  requestId: 'toolu_1',
  props: { tool_use_id: 'toolu_1', tool, input, isRunning: false, isErrored: false, isInterrupted: false },
}) as const
const asked = (...texts: string[]) => ({
  plugin: 'forge',
  component: 'AskUserQuestion',
  requestId: 'toolu_q',
  props: {
    tool: 'AskUserQuestion',
    questions: texts.map(question => ({ question, header: 'Forge', multiSelect: false,
      options: [{ label: 'Yes', description: 'yes' }, { label: 'Not now', description: 'later' }] })),
  },
}) as const
const ASK = asked('Merge PR #41?')

const engine = (on: (...a: never[]) => unknown) =>
  (on as (event: string, hook: ($: any, e: any) => unknown) => void)('ui.render', ($, e) => {
    // The question dialog is the engine's own node; any other row a Text standing for it.
    if (e.component === 'AskUserQuestion') return { type: 'engine', ref: 0 }
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
const quiet = (on: (...a: never[]) => unknown) => {
  const o = on as (event: string, hook: (...a: any[]) => unknown) => void
  o('ui.status', () => ({ value: undefined }))
  o('ui.toast', () => ({ value: undefined }))
  o('audio.play', () => ({ value: undefined }))
  o('ui.open', () => ({ value: { isPlaced: true } }))
}
const report = ($: { tool: { call: (e: never) => Promise<unknown> } }, r: ForgeReport) =>
  $.tool.call({ tool: TOOL, ...r } as never)

test('a forge_report row draws its card on every surface', async ($, on) => {
  engine(on)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const row = await $.ui.mount({ ...ROW(SCENARIOS[5].at(-1)), surface } as never)
    expect(lines(await row.drawn()).join(' ')).toContain('Something new in wt-2')
    await row.unmount()
  }
})

test('another tool row is left to the engine', async ($, on) => {
  engine(on)
  const row = await $.ui.mount({ ...ROW({ command: 'ls' }, 'Bash'), surface: 'desktop' } as never)
  expect(lines(await row.drawn())).toEqual(['engine'])
  await row.unmount()
})

test('a forge_report row with a broken input is left to the engine', async ($, on) => {
  engine(on)
  const row = await $.ui.mount({ ...ROW({ ticket: 'PROJ-123' }), surface: 'desktop' } as never)
  expect(lines(await row.drawn())).toEqual(['engine'])
  await row.unmount()
})

test('an interrupted forge_report row is left to the engine', async ($, on) => {
  engine(on)
  const r = ROW(SCENARIOS[5].at(-1))
  const row = await $.ui.mount({ ...r, props: { ...r.props, isInterrupted: true }, surface: 'desktop' } as never)
  expect(lines(await row.drawn())).toEqual(['engine'])
  await row.unmount()
})

const RESULT = (tool = TOOL, isErrored = false) => ({
  plugin: 'forge',
  component: 'ToolResult',
  requestId: 'toolu_1',
  props: { tool_use_id: 'toolu_1', tool, output: 'Reported finding for wt-2 · S1·2.', isErrored },
}) as const

test('a forge_report result draws nothing under its card', async ($, on) => {
  engine(on)
  const row = await $.ui.mount({ ...RESULT(), surface: 'desktop' } as never)
  expect(lines(await row.drawn())).toEqual([])
  await row.unmount()
})

test('an errored forge_report result, or another tool\'s, is the engine\'s', async ($, on) => {
  engine(on)
  for (const r of [RESULT(TOOL, true), RESULT('Bash')]) {
    const row = await $.ui.mount({ ...r, surface: 'desktop' } as never)
    expect(lines(await row.drawn())).toEqual(['engine'])
    await row.unmount()
  }
})


const RULE_DONE = { ticket: 'PROJ-123', template: 'rule-done', fill: { name: 'quantity rule', n: 1, total: 2, rule: 'When a, then b.' } }

test('a forge_report row sent as a template draws its template card', async ($, on) => {
  engine(on)
  const row = await $.ui.mount({ ...ROW(RULE_DONE), surface: 'desktop' } as never)
  expect(lines(await row.drawn()).join(' ')).toContain('Rule 1 of 2 holds in the quantity rule')
  await row.unmount()
})

test('forge_report takes a template with right blanks, and refuses wrong ones by name', async ($, on) => {
  quiet(on)
  const ok = await $.tool.call({ tool: TOOL, ...RULE_DONE } as never) as { isError?: boolean }
  expect(ok.isError).toBeFalsy()
  const bad = await $.tool.call({ tool: TOOL, ticket: 'PROJ-123', template: 'rule-done', fill: { name: 'x' } } as never) as { result: string; isError?: boolean }
  expect(bad.isError).toBe(true)
  expect(bad.result).toContain('n is missing')
})

test('the prompt hook passes every prompt on unchanged', async ($, on) => {
  quiet(on)
  ;(on as (event: string, hook: (...a: any[]) => unknown) => void)('prompt.submit', (_$: unknown, e: { text: string }) => ({ text: e.text }))
  for (const text of ['/forge PROJ-123', 'compare PROJ-1 with PROJ-2', 'hello']) {
    expect(await $.prompt.submit({ text } as never)).toMatchObject({ text })
  }
})
