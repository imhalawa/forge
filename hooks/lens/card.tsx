import type { ElementTable, RenderElement } from 'claude-code'

import type { ForgeReport } from '../../types'
import type { Ui } from './band'
import { glyph } from './design'
import { STATE_ICON } from './tracker'
import { checkFill, templateCard, type TemplateName } from './templates'

export type CardUi = Ui & { t: Ui['t'] & Pick<ElementTable<'terminal'>, 'Code'> }


type State = NonNullable<ForgeReport['state']>

// A report without a state still gets an icon from the fixed set.
export const stateOf = (r: ForgeReport): State =>
  r.state ?? (r.needsYou ? 'call' : r.kind === 'delivered' ? 'done' : 'building')

export const consequence = (c: { label: string; then: string }) => `${c.label} — ${c.then}`

// A section whose one item is a verdict ("Pass", "Fail: …") is a check: the card shows it as a ticked row.
const VERDICT = /^(pass|passes|passed|ok|fail|fails|failed)\b/iu
const isVerdict = (s: { items: string[] }) => s.items.length === 1 && VERDICT.test(s.items[0]!)
export const checks = (r: ForgeReport): { label: string; ok: boolean }[] =>
  (r.sections ?? []).flatMap(s => (isVerdict(s)
    ? [{ label: s.label, ok: /^(pass|passes|passed|ok)\b/iu.test(s.items[0]!) }] : []))

// The checks as one tidy list: a tick or a cross, then what was checked.
const checklist = (list: { label: string; ok: boolean }[], ui: CardUi): RenderElement => {
  const { Box, Text } = ui.t
  return (
    <Box key="checks" flexDirection="column" marginTop={1}>
      {list.map(c => (
        <Box key={`check:${c.label}`} flexDirection="row" gap={1}>
          {glyph(c.ok ? 'check' : 'cross', ui.surface, ui.t)}
          <Text dimColor={c.ok}>{c.label}</Text>
        </Box>
      ))}
    </Box>
  )
}

// The head of the card: its icon and its title. The amber icon alone says it waits on the person.
const title = (r: ForgeReport, ui: CardUi): RenderElement => {
  const { Box, Text } = ui.t
  return (
    <Box key="title" flexDirection="row" gap={1}>
      {r.needsYou ? glyph('you', ui.surface, ui.t) : glyph(STATE_ICON[stateOf(r)], ui.surface, ui.t)}
      <Text weight="medium">{r.title}</Text>
    </Box>
  )
}

const section = (s: { label: string; items: string[] }, i: number, ui: CardUi): RenderElement => {
  const { Box, Text } = ui.t
  // The full view hides nothing: every item, each a bullet.
  return (
    <Box key={`section:${i}`} flexDirection="column" marginTop={1}>
      <Text bold>{s.label}</Text>
      {s.items.map(item => <Text>{`• ${item}`}</Text>)}
    </Box>
  )
}

// Choices are words, not buttons: the person answers through forge's question.
const choices = (list: NonNullable<ForgeReport['choices']>, ui: CardUi): RenderElement => {
  const { Box, Text } = ui.t
  return (
    <Box key="choices" flexDirection="column" marginTop={1}>
      {list.map(c => <Text>{consequence(c)}</Text>)}
    </Box>
  )
}

// Every card is drawn in full, whether or not the row is expanded (ctrl+o): the person reads it all in one place.
export const card = (r: ForgeReport, ui: CardUi, _full = true): RenderElement =>
  r.template && r.fill && checkFill(r.template, r.fill).length === 0
    ? templateCard(r.template as TemplateName, r.fill, ui)
    : detail(r, ui)

// The title, one sentence, the checks, the sections, then what each answer does. Facts and evidence stay in the
// report, never on the card: forge's working-out is not for the person to read.
const detail = (r: ForgeReport, ui: CardUi): RenderElement => {
  const { Box, Text } = ui.t
  return (
    <Box flexDirection="column">
      {title(r, ui)}
      <Box key="line"><Text>{r.line}</Text></Box>
      {checks(r).length > 0 && checklist(checks(r), ui)}
      {(r.sections ?? []).filter(s => !isVerdict(s)).map((s, i) => section(s, i, ui))}
      {r.choices && r.choices.length > 0 && choices(r.choices, ui)}
    </Box>
  )
}
