import { expect, test } from 'claude-code/testing'

import type { ForgeReport, LensState } from '../../types'
import { card } from './card'
import { SCENARIOS } from './fixtures'
import { pane } from './pane'
import { apply, EMPTY } from './state'

// A table of plain-data elements, so a view's tree can be read without a surface.
type Node = { type: string; props: Record<string, unknown>; children?: unknown }
const make = (type: string) => (props: Record<string, unknown>) => ({ type, props }) as never
const table = { Box: make('Box'), Text: make('Text'), Svg: make('Svg'), Code: make('Code') } as never
const ui = { surface: 'desktop', t: table } as const

const kids = (n: Node): unknown[] => {
  const c = n.children ?? n.props?.children
  return (Array.isArray(c) ? c : [c]).flat(Infinity as 1)
}
const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null && 'type' in v

const lines = (v: unknown): string[] => {
  if (typeof v === 'string' || typeof v === 'number') return [String(v)]
  if (!isNode(v) || v.type === 'Svg' || v.type === 'Code') return []
  if (v.type === 'Text') return [kids(v).filter(k => typeof k === 'string' || typeof k === 'number').join('')]
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

const fold = (reports: ForgeReport[]): LensState => reports.reduce(apply, EMPTY)
const nowBox = (s: LensState) => find(pane(s, ui as never), n => n.props.key === 'now')[0]

// [scenario, band, status line, Now box (null when absent), last card's title]
// The last card is the last report folded: in 9 and 10 that is wt-4, not the headline card.
type N = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
const CASES: [N, string | null, string][] = [
  [1, 'Confirm the problem', 'Problem · Your review'],
  [2, 'Close PROJ-123? The refund metric already exists', 'The story may not be needed'],
  [3, 'Approve the 4 sub-tasks', 'Sub-tasks · Your review'],
  [4, null, 'wt-3 · S2·1 · waits'],
  [5, 'Narrow criterion 2?', 'Something new in wt-2'],
  [6, 'Review wt-1 and raise PR', 'wt-1 · S1·1 is ready for your review'],
  [7, null, 'PR #41 · comment fixed'],
  [8, null, 'PR #43 · check failed, not this change'],
  [9, 'Merge PR #41', 'wt-4 · S2·2 · waits'],
  [10, null, 'wt-4 · S2·2 · rebased'],
  [11, null, 'Refund metric'],
]

for (const [n, now, title] of CASES) {
  test(`scenario ${n}`, () => {
    const state = fold(SCENARIOS[n])
    const box = nowBox(state)
    if (now === null) expect(box).toBeUndefined()
    else expect(text(box)).toBe(now)
    const last = state.feed.at(-1) as ForgeReport
    expect(last.title).toBe(title)
    expect(text(card(last, ui as never, true))).toContain(title)
  })
}

// The headline card of a scenario: its title, a choice's consequence, and the PR number where it has one.
const HEADLINES: [N, string, string[], number?][] = [
  [2, 'The story may not be needed', ['Close it — Forge stops and leaves a comment on PROJ-123']],
  [5, 'Something new in wt-2', ['Narrow it — Forge rewrites criterion 2 and goes on']],
  [6, 'wt-1 · S1·1 is ready for your review', ['Raise it — Forge opens PR #41 against main']],
  [9, 'PR #41 · ready to merge', ['Merge — Forge merges PR #41 and rebases wt-3 onto main'], 41],
  [10, 'Stack rebased onto main', ['PR #43 and PR #44 now sit on main after PR #41 merged.'], 43],
]

for (const [n, title, has, prNumber] of HEADLINES) {
  test(`scenario ${n} headline card`, () => {
    const state = fold(SCENARIOS[n])
    const r = state.feed.find(x => x.title === title)
    expect(r).toBeDefined()
    const drawn = text(card(r as ForgeReport, ui as never, true))
    expect(drawn).toContain(title)
    for (const t of has) expect(drawn).toContain(t)
    if (prNumber !== undefined) {
      expect(r?.pr?.number).toBe(prNumber)
      // The PR number is a signal on the lane's row in the pane.
      expect(text(pane(state, ui as never))).toContain(`#${prNumber}`)
    }
  })
}
