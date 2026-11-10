import { expect, test } from 'claude-code/testing'

import { ICONS, icon } from './icons'
import { STATES } from './state'

type Node = { type: string; props: Record<string, unknown> }
const make = (type: string) => (props: Record<string, unknown>) => ({ type, props }) as never
const h = { Box: make('Box'), Text: make('Text'), Svg: make('Svg') } as never

const textOf = (n: unknown): string => {
  const { children } = (n as Node).props
  return Array.isArray(children) ? children.join('') : String(children ?? '')
}

test('every state has an icon', () => expect(Object.keys(ICONS).sort()).toEqual([...STATES].sort()))

test('table matches the spec', () => {
  expect(ICONS.failed).toMatchObject({ tabler: 'circle-x', glyph: '✗', tone: 'danger' })
  expect(ICONS.call).toMatchObject({ tabler: 'hand-click', glyph: '▶', tone: 'accent' })
  expect(ICONS.pending).toMatchObject({ tabler: 'circle-dashed', glyph: '○', tone: 'neutral' })
  expect(ICONS.building).toMatchObject({ tabler: 'hammer', glyph: '◐', tone: 'neutral' })
  expect(ICONS.queue).toMatchObject({ tabler: 'clock', glyph: '…', tone: 'neutral' })
  expect(ICONS.waits).toMatchObject({ tabler: 'link', glyph: '↳', tone: 'neutral' })
  expect(ICONS.stopped).toMatchObject({ tabler: 'alert-triangle', glyph: '!', tone: 'accent' })
  expect(ICONS.review).toMatchObject({ tabler: 'eye', glyph: '◉', tone: 'accent' })
  expect(ICONS.open).toMatchObject({ tabler: 'git-pull-request', glyph: '⇡', tone: 'neutral' })
  expect(ICONS.ci).toMatchObject({ tabler: 'loader-2', glyph: '~', tone: 'neutral' })
  expect(ICONS.passed).toMatchObject({ tabler: 'circle-check', glyph: '✓', tone: 'success' })
  expect(ICONS.changes).toMatchObject({ tabler: 'message-exclamation', glyph: '?', tone: 'neutral' })
  expect(ICONS.fixed).toMatchObject({ tabler: 'message-check', glyph: '✓', tone: 'neutral' })
  expect(ICONS.approved).toMatchObject({ tabler: 'thumb-up', glyph: '+', tone: 'success' })
  expect(ICONS.merged).toMatchObject({ tabler: 'git-merge', glyph: '⊕', tone: 'success' })
  expect(ICONS.rebased).toMatchObject({ tabler: 'git-branch', glyph: '⑂', tone: 'neutral' })
  expect(ICONS.done).toMatchObject({ tabler: 'flag', glyph: '⚑', tone: 'success' })
  expect(ICONS.confirmed).toMatchObject({ tabler: 'circle-check', glyph: '✓', tone: 'success' })
})

test('every svg is Tabler outline markup', () => {
  for (const s of STATES) {
    const { svg } = ICONS[s]
    expect(svg).toContain('viewBox="0 0 24 24"')
    expect(svg).toContain('stroke="currentColor"')
    expect(svg).toContain('stroke-width="2"')
  }
})

test('terminal draws a glyph', () => expect(textOf(icon('merged', 'terminal', h))).toBe('⊕'))

test('desktop, vscode and mobile draw an Svg', () => {
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const n = icon('failed', surface, h) as unknown as Node
    expect(n.type).toBe('Svg')
    expect(n.props.alt).toBe('circle-x')
    expect(String(n.props.source)).not.toContain('currentColor')
  }
})
