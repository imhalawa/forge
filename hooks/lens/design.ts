import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

// Forge's design system: one colour per meaning, and one icon per thing, drawn in that colour.
// Desktop draws the SVG; the terminal draws the glyph in the role's theme key.

// A role is a meaning, never a decoration. Amber is only "needs you".
export const ROLES = {
  you: { hex: '#C77D0A', theme: 'warning' },        // needs you
  progress: { hex: '#4C6EF5', theme: 'suggestion' }, // in progress, checks running
  done: { hex: '#2B8A3E', theme: 'success' },        // done, passing, approved
  merged: { hex: '#8250DF', theme: 'merged' },       // merged
  failed: { hex: '#C23A50', theme: 'error' },        // failed, blocked, changes asked
  muted: { hex: '#8A8984', theme: 'inactive' },      // not started, waiting
} as const
export type Role = keyof typeof ROLES

const STROKE = 'fill="none" stroke="C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
const ring = '<circle cx="8" cy="8" r="5.5"/>'

// Each icon: its drawing in colour `C`, its role, the terminal glyph, and its words for a screen reader.
export const ICONS = {
  story: { svg: `<g ${STROKE}><path d="M4.5 2.5h7v11l-3.5-2.5-3.5 2.5z"/></g>`, role: 'done', glyph: '▮', alt: 'Story' },
  bug: { svg: `<g ${STROKE}><rect x="5" y="4.5" width="6" height="8" rx="3"/><path d="M8 7v5M3 7.5h2M11 7.5h2M3.5 11h1.5M11 11h1.5M6 4.5l-1-2M10 4.5l1-2"/></g>`, role: 'failed', glyph: '✱', alt: 'Bug' },
  task: { svg: `<g ${STROKE}><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M5.5 8.2l1.8 1.8 3.2-3.6"/></g>`, role: 'progress', glyph: '☑', alt: 'Task' },
  investigate: { svg: `<g ${STROKE}><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4l3.1 3.1"/></g>`, role: 'muted', glyph: '⌕', alt: 'Investigate' },
  breakdown: { svg: `<g ${STROKE}><path d="M3 3.5h4M3 8h10M3 12.5h7"/></g>`, role: 'muted', glyph: '≡', alt: 'Break down' },
  build: { svg: `<g ${STROKE}><path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4"/></g>`, role: 'muted', glyph: '‹›', alt: 'Build' },
  ship: { svg: `<g ${STROKE}><path d="M8 13.5V3M4 7l4-4 4 4"/></g>`, role: 'muted', glyph: '↑', alt: 'Ship' },
  deploy: { svg: `<g ${STROKE}><path d="M5 12.5H4.2a2.7 2.7 0 0 1-.3-5.4 4.1 4.1 0 0 1 8 .4 2.5 2.5 0 0 1 .1 5H11"/><path d="M8 13.5V8.5M6 10.5l2-2 2 2"/></g>`, role: 'muted', glyph: '⇪', alt: 'Deploy' },
  plan: { svg: `<g ${STROKE}><rect x="3" y="2.5" width="10" height="11" rx="1.5"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/></g>`, role: 'muted', glyph: '☰', alt: 'Plan' },
  verify: { svg: `<g ${STROKE}><path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z"/><path d="M5.8 8.2l1.6 1.6 2.9-3.2"/></g>`, role: 'muted', glyph: '⛉', alt: 'Verify' },
  cleanup: { svg: `<g ${STROKE}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9M7 7v4M9 7v4"/></g>`, role: 'muted', glyph: '⌫', alt: 'Clean up' },
  pending: { svg: `<g ${STROKE} stroke-dasharray="2.2 2.1">${ring}</g>`, role: 'muted', glyph: '○', alt: 'Not started' },
  progress: { svg: `<g ${STROKE}><circle cx="8" cy="8" r="5.5" stroke-opacity=".25"/><path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5"/></g>`, role: 'progress', glyph: '◐', alt: 'In progress' },
  you: { svg: `<g ${STROKE}>${ring}<path d="M8 5v3.4"/></g><circle cx="8" cy="11" r=".9" fill="C"/>`, role: 'you', glyph: '!', alt: 'Needs you' },
  review: { svg: `<g ${STROKE}><path d="M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4z"/><circle cx="8" cy="8" r="1.6"/></g>`, role: 'you', glyph: '◉', alt: 'Your review' },
  waiting: { svg: `<g ${STROKE}>${ring}<path d="M8 5v3.2l2 1.3"/></g>`, role: 'muted', glyph: '◷', alt: 'Waiting' },
  blocked: { svg: `<g ${STROKE}>${ring}<path d="M4.2 11.8l7.6-7.6"/></g>`, role: 'failed', glyph: '⊘', alt: 'Blocked' },
  done: { svg: `<g ${STROKE}>${ring}<path d="M5.6 8.2l1.7 1.7 3.1-3.4"/></g>`, role: 'done', glyph: '✓', alt: 'Done' },
  merged: { svg: `<g ${STROKE}><circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/><circle cx="11.5" cy="8" r="1.5"/><path d="M5 5v6M5 5.5c0 2 1.5 2.5 5 2.5"/></g>`, role: 'merged', glyph: '⊕', alt: 'Merged' },
  failed: { svg: `<g ${STROKE}>${ring}<path d="M6 6l4 4M10 6l-4 4"/></g>`, role: 'failed', glyph: '✗', alt: 'Failed' },
  check: { svg: `<g ${STROKE}><path d="M3.5 8.5l3 3 6-7"/></g>`, role: 'done', glyph: '✓', alt: 'Passes' },
  cross: { svg: `<g ${STROKE}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></g>`, role: 'failed', glyph: '✗', alt: 'Fails' },
  dot: { svg: '<circle cx="8" cy="8" r="4" fill="C"/>', role: 'muted', glyph: '●', alt: 'Checks' },
  skipped: { svg: `<g ${STROKE}>${ring}<path d="M5.5 8h5"/></g>`, role: 'muted', glyph: '⊖', alt: 'Skipped' },
  cancelled: { svg: `<g ${STROKE}>${ring}<path d="M4.2 11.8l7.6-7.6"/></g>`, role: 'muted', glyph: '⊘', alt: 'Cancelled' },
  folder: { svg: `<g ${STROKE}><path d="M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z"/></g>`, role: 'muted', glyph: '▤', alt: 'Repo' },
  worktree: { svg: `<g ${STROKE}><path d="M4 4.5h3l1 1h4v5.5h-8z"/><path d="M2.5 6.5v6h8"/></g>`, role: 'muted', glyph: '▥', alt: 'Worktree' },
  ticket: { svg: `<g ${STROKE}><path d="M2.5 5.5v-1h11v1a1.5 1.5 0 0 0 0 3v3h-11v-3a1.5 1.5 0 0 0 0-3z"/></g>`, role: 'muted', glyph: '▭', alt: 'Ticket' },
  commit: { svg: `<g ${STROKE}><circle cx="8" cy="8" r="2.5"/><path d="M1.5 8h4M10.5 8h4"/></g>`, role: 'muted', glyph: '◦', alt: 'Commit' },
  pr: { svg: `<g ${STROKE}><circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="12.5" r="1.5"/><path d="M4.5 5v6M11.5 11V6.5a2 2 0 0 0-2-2H7.5M9 3l-1.5 1.5L9 6"/></g>`, role: 'progress', glyph: '⇡', alt: 'Pull request' },
  point: { svg: '<circle cx="8" cy="8" r="1.8" fill="C"/>', role: 'muted', glyph: '•', alt: '' },
  target: { svg: `<g ${STROKE}>${ring}<circle cx="8" cy="8" r="2.5"/></g>`, role: 'muted', glyph: '◎', alt: 'Done when' },
  session: { svg: `<g ${STROKE}><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></g>`, role: 'muted', glyph: '▢', alt: 'Session' },
  editor: { svg: `<g ${STROKE}><path d="M6 4L2.5 8 6 12M10 4l3.5 4-3.5 4"/></g>`, role: 'you', glyph: '‹›', alt: 'Review in the editor' },
} as const satisfies Record<string, { svg: string; role: Role; glyph: string; alt: string }>
export type IconName = keyof typeof ICONS

// The SVG source of one icon in a role's colour (its own role unless told otherwise).
export const svgOf = (name: IconName, role: Role = ICONS[name].role): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${ICONS[name].svg.replaceAll('"C"', `"${ROLES[role].hex}"`)}</svg>`

type Table = Pick<ElementTable<'terminal'>, 'Text'> & Partial<Pick<ElementTable<'desktop'>, 'Svg'>>

// An icon on any surface: the SVG on the desktop, the glyph in the role's theme key in the terminal.
export const glyph = (name: IconName, surface: RenderSurface, t: Table, role: Role = ICONS[name].role): RenderElement =>
  surface === 'terminal' || !t.Svg
    ? t.Text({ color: ROLES[role].theme, children: ICONS[name].glyph })
    : t.Svg({ source: svgOf(name, role), alt: ICONS[name].alt, width: 16, height: 16 })

// A reviewer: their initial in a grey disc, with a green tick or a red cross when they reviewed.
export const avatarSvg = (login: string, review: 'approved' | 'changes' | 'pending'): string => {
  const badge = review === 'approved'
    ? `<circle cx="15" cy="15" r="4.5" fill="${ROLES.done.hex}" stroke="#fff"/><path d="M13 15.2l1.4 1.4 2.6-2.8" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : review === 'changes'
      ? `<circle cx="15" cy="15" r="4.5" fill="${ROLES.failed.hex}" stroke="#fff"/><path d="M13.4 13.4l3.2 3.2M16.6 13.4l-3.2 3.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`
      : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20"><circle cx="9" cy="9" r="8" fill="${ROLES.muted.hex}"/>`
    + `<text x="9" y="12.5" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#fff">${login.slice(0, 1).toUpperCase()}</text>${badge}</svg>`
}
