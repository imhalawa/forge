// The kit's design tokens: every color, text style, size and gap a component draws with. Components and mods take
// values from here, never literals, so panes look alike and stay compact.
//
// Compact: a row is one line. A border adds a line above and below, so nothing inside a row carries one; a fill
// marks state instead.

// Colors come in two layers. PALETTE names each raw color once. A Theme gives each role a component draws with
// (a selected row, a guide, a passed icon) a color; LIGHT is the design's (docs/ui/design-spec.md). A mod passes its
// own Theme, or some roles of one, to makeKit, and every component draws with it: SVG strokes and fills included.
// shortcut: a pane can't tell the person's light or dark theme, so the kit draws LIGHT until a mod passes another.
export const PALETTE = {
  white: '#FFFFFF', paper: '#F6F5F1', stone: '#ECEAE4', mist: '#F2F1EE', line: '#DDDAD3', gray: '#5E5D57',
  blue: '#4C6EF5', blueTint: '#E8EEFE', clay: '#A8502F', red: '#C23A50', redTint: '#FBEDEE',
  amber: '#9A6B00', amberTint: '#FBF5E6', green: '#2B8A3E',
} as const

export type Theme = {
  surface: string     // the pane, and a raised segment in a track
  panel: string       // the details split
  bar: string         // the status bar
  chip: string        // a chip, a track, an empty bar
  border: string      // guides and dividers
  selection: string   // the selected row, a chosen chip
  hover: string       // a hovered row
  muted: string       // secondary icons and bars
  accent: string      // focus and progress: the selected edge, Stop, a running test
  pass: string
  fail: string
  warn: string
  claude: string      // actions that ask Claude
  failFill: string
  warnFill: string
  onFill: string      // text on a strong fill, such as a count badge
}

export const LIGHT: Theme = {
  surface: PALETTE.white, panel: PALETTE.paper, bar: PALETTE.stone, chip: PALETTE.mist, border: PALETTE.line,
  selection: PALETTE.blueTint, hover: PALETTE.paper,   // the design names no hover color: the panel's
  muted: PALETTE.gray, accent: PALETTE.blue, pass: PALETTE.green, fail: PALETTE.red, warn: PALETTE.amber,
  claude: PALETTE.clay, failFill: PALETTE.redTint, warnFill: PALETTE.amberTint, onFill: PALETTE.white,
}

// Fills that follow the person's theme, light or dark: the app's own theme keys.
export const TINT = { fail: 'diffRemovedDimmed', pass: 'diffAddedDimmed' } as const

// A state's text color (an app theme key) and the Theme role that fills it on the desktop.
export const TONE = {
  fail: { text: 'error', fill: 'failFill' },
  warn: { text: 'warning', fill: 'warnFill' },
  info: { text: 'suggestion', fill: 'selection' },
  muted: { text: 'inactive', fill: 'chip' },
} as const satisfies Record<string, { text: string; fill: keyof Theme }>
export type Tone = keyof typeof TONE

// Text styles, one per role; spread onto a Text: `<Text {...TYPE.meta}>`.
export const TYPE = {
  body: {},
  strong: { weight: 'bold' },                       // a tree's top names
  title: { weight: 'semibold' },                    // a card's or the details' title
  label: { size: 'caption', weight: 'semibold' },   // section heads, count badges
  caption: { size: 'caption' },                     // tags
  meta: { dimColor: true, tabular: true },          // counts and times, lined up in a column
  code: { mono: true },
} as const

// Desktop sizes in px.
export const SIZE = {
  icon: 16,          // outcome and button icons
  rule: 1,           // guides and dividers
  edge: 3,           // the selected row's left edge
  divider: 18,       // a divider's height
  guide: 400,        // a guide's drawn length, clipped by its row (forge: 400, so a wrapped row keeps its line)
  bar: { width: 40, height: 6 },   // a duration bar
} as const

// Gaps, padding and line heights in cells (a cell is one character wide, one line high).
export const SPACE = {
  gap: 1,            // between items in a row
  inset: 1,          // padding inside a bar, card or chip
  indent: 2,         // a missing chevron's width
  track: 0.25,       // a ribbon's or progress bar's height
  trackX: 'xs',      // a track's side padding: the surface's smallest step (0 hugs the text, 1 cell is too wide)
  mark: 0.125,       // the chosen option's accent underline, about 2 px
} as const
