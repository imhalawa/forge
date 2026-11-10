import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { ForgeReport } from '../../types'

type State = NonNullable<ForgeReport['state']>
type Tone = 'neutral' | 'accent' | 'success' | 'danger'
type Icon = { tabler: string; svg: string; glyph: string; tone: Tone }

// Tabler Icons by Paweł Kuna, MIT (see LICENSE-tabler). Outline set, 24x24.
const svg = (body: string) =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>'

const circle = '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>'
const dot = (x: number, y: number) => `<path d="M${x} ${y}m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>`

const row = (tabler: string, body: string, glyph: string, tone: Tone): Icon => ({ tabler, svg: svg(body), glyph, tone })

const CHECK = row('circle-check', circle + '<path d="M9 12l2 2l4 -4"/>', '✓', 'success')

export const ICONS: Record<State, Icon> = {
  pending: row('circle-dashed',
    '<path d="M8.56 3.69a9 9 0 0 0 -2.92 1.95"/><path d="M3.69 8.56a9 9 0 0 0 -.69 3.44"/>' +
    '<path d="M3.69 15.44a9 9 0 0 0 1.95 2.92"/><path d="M8.56 20.31a9 9 0 0 0 3.44 .69"/>' +
    '<path d="M15.44 20.31a9 9 0 0 0 2.92 -1.95"/><path d="M20.31 15.44a9 9 0 0 0 .69 -3.44"/>' +
    '<path d="M20.31 8.56a9 9 0 0 0 -1.95 -2.92"/><path d="M15.44 3.69a9 9 0 0 0 -3.44 -.69"/>', '○', 'neutral'),
  building: row('hammer',
    '<path d="M11.414 10l-7.383 7.418a2.091 2.091 0 0 0 0 2.967a2.11 2.11 0 0 0 2.976 0l7.407 -7.385"/>' +
    '<path d="M18.121 15.293l2.586 -2.586a1 1 0 0 0 0 -1.414l-7.586 -7.586a1 1 0 0 0 -1.414 0l-2.586 2.586a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0z"/>',
    '◐', 'neutral'),
  queue: row('clock', circle + '<path d="M12 7v5l3 3"/>', '…', 'neutral'),
  waits: row('link',
    '<path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/>' +
    '<path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/>', '↳', 'neutral'),
  stopped: row('alert-triangle',
    '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/>' +
    '<path d="M12 16h.01"/>', '!', 'accent'),
  review: row('eye',
    '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/>' +
    '<path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>', '◉', 'accent'),
  call: row('hand-click',
    '<path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5"/>' +
    '<path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5"/>' +
    '<path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47"/>' +
    '<path d="M5 3l-1 -1"/><path d="M4 7h-1"/><path d="M14 3l1 -1"/><path d="M15 6h1"/>', '▶', 'accent'),
  open: row('git-pull-request',
    dot(6, 18) + dot(6, 6) + dot(18, 18) + '<path d="M6 8l0 8"/><path d="M11 6h5a2 2 0 0 1 2 2v8"/><path d="M14 9l-3 -3l3 -3"/>',
    '⇡', 'neutral'),
  // Never spinning: the arc is drawn still.
  ci: row('loader-2', '<path d="M12 3a9 9 0 1 0 9 9"/>', '~', 'neutral'),
  passed: CHECK,
  failed: row('circle-x', circle + '<path d="M10 10l4 4m0 -4l-4 4"/>', '✗', 'danger'),
  changes: row('message-exclamation',
    '<path d="M4 21v-13a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-9l-4 4"/><path d="M12 8v3"/><path d="M12 14v.01"/>',
    '?', 'neutral'),
  fixed: row('message-check',
    '<path d="M11.5 17h-4.5l-4 4v-13a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5"/><path d="M15 19l2 2l4 -4"/>', '✓', 'neutral'),
  approved: row('thumb-up',
    '<path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3"/>',
    '+', 'success'),
  merged: row('git-merge',
    dot(7, 18) + dot(7, 6) + dot(17, 12) + '<path d="M7 8l0 8"/><path d="M7 8a4 4 0 0 0 4 4h4"/>', '⊕', 'success'),
  rebased: row('git-branch',
    dot(7, 18) + dot(7, 6) + dot(17, 6) + '<path d="M7 8l0 8"/><path d="M9 18h6a2 2 0 0 0 2 -2v-5"/><path d="M14 14l3 -3l3 3"/>',
    '⑂', 'neutral'),
  done: row('flag', '<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z"/><path d="M5 21v-7"/>', '⚑', 'success'),
  confirmed: CHECK,
}

// The terminal's colour names follow the person's theme; the drawings need a fixed stroke.
// Accent means "needs you", drawn amber: the one colour that asks for attention.
const THEME = { neutral: 'inactive', accent: 'warning', success: 'success', danger: 'error' } as const
const STROKE = { neutral: '#6b7280', accent: '#d97706', success: '#16a34a', danger: '#dc2626' } as const

type Table = Pick<ElementTable<'terminal'>, 'Text'> & Partial<Pick<ElementTable<'desktop'>, 'Svg'>>

// `t` is the table `$.ui.resolve(e)` hands out for the surface.
export const icon = (state: State, surface: RenderSurface, t: Table, size = 16): RenderElement => {
  const { tabler, svg: source, glyph, tone } = ICONS[state]
  if (surface === 'terminal' || !t.Svg) return t.Text({ color: THEME[tone], children: glyph })
  return t.Svg({ source: source.replaceAll('currentColor', STROKE[tone]), alt: tabler, width: size, height: size })
}

// Marks that are not a state: the ticket at the root, and a change that waits for the person's review.
export const MARKS = {
  ticket: row('bookmark', '<path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z"/>', '⊡', 'neutral'),
  change: row('file-diff',
    '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>' +
    '<path d="M12 10l0 4"/><path d="M10 12l4 0"/><path d="M10 17l4 0"/>', '±', 'accent'),
  review: ICONS.review,
  attention: row('alert-circle', circle + '<path d="M12 8v4"/><path d="M12 16h.01"/>', '!', 'accent'),
} as const

export const mark = (name: keyof typeof MARKS, surface: RenderSurface, t: Table, size = 16): RenderElement => {
  const { tabler, svg: source, glyph, tone } = MARKS[name]
  if (surface === 'terminal' || !t.Svg) return t.Text({ color: THEME[tone], children: glyph })
  return t.Svg({ source: source.replaceAll('currentColor', STROKE[tone]), alt: tabler, width: size, height: size })
}
