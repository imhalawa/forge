import { MetaCell, NameCell } from './cells'
import { Guides, type Guide } from './guides'
import { scopeOf } from './hover-scope'
import { HoverReveal } from './hover-reveal'
import { IconButton } from './icon-button'
import { OutcomeIcon } from './outcome-icon'
import { SelectedEdge } from './selected-edge'
import type { Surface } from './surface'
import { SPACE, TYPE } from './tokens'

export type TreeRowProps = {
  // `key` names the row's parts (`chevron:…`, `select:…`, `name:…`); `id` is what selection compares.
  kind: string
  id: string
  name: string
  depth: number
  levels: Guide[]
  icon?: string
  meta: string
  // `name`: the count reads with the name, right after it; `end` (default): a time, lined up at the row's end.
  metaAt?: 'name' | 'end'
  bold?: boolean
  selected: boolean
  chevron?: { open: boolean; onToggle: () => unknown }
  onSelect: () => unknown
  // Why it failed, on one line after the name; and what sits before the count or time (a duration bar, a tag).
  reason?: string | null
  extras?: any
  // Always shown at the row's end (a run group), or else a hover action shown on hover and when selected.
  trailing?: any
  action?: { key: string; icon: 'run' | 'cancel'; label: string; always: boolean; onPress: () => unknown }
}

// One tree row: guides with the |- connector, an optional chevron, the outcome icon, the name, the count or time, and
// the row's action. A bold name is plain text, since a Button draws its own weight; any other name is the Button that
// selects its row.
export function TreeRow(s: Surface, key: string, p: TreeRowProps) {
  const { Box, Text, Button } = s
  const rowKey = `${p.kind}:${key}`
  return (
    <Box key={rowKey} flexDirection="row" alignItems="center" columnGap={SPACE.gap} paddingLeft={p.depth} position="relative" overflow="hidden"
      hover={{ scope: scopeOf(rowKey), ...(s.desktop && !p.selected && { backgroundColor: s.theme.hover }) }} backgroundColor={s.desktop && p.selected ? s.theme.selection : undefined}>
      {Guides(s, key, p.levels, !p.chevron)}
      {SelectedEdge(s, p.id, p.selected)}
      {p.chevron
        ? IconButton(s, `chevron:${key}`, p.chevron.open ? 'chevron-down' : 'chevron-right', s.theme.muted, p.chevron.open ? `Close ${p.name}` : `Open ${p.name}`, p.chevron.onToggle)
        : <Box key={`indent:${p.id}`} width={SPACE.indent} flexShrink={0} />}
      {OutcomeIcon(s, key, p.icon)}
      {NameCell(s, key, p.bold
        ? <Text {...TYPE.strong} wrap="truncate-end">{p.name}</Text>
        : <Button key={`select:${key}`} plain onPress={p.onSelect}><Text wrap="truncate-end">{p.name}</Text></Button>)}
      {p.reason && <Box key={`reason:${key}`} flexShrink={2} minWidth={0} overflow="hidden"><Text color="error" wrap="truncate-end">{p.reason}</Text></Box>}
      {p.metaAt === 'name' && MetaCell(s, key, p.meta)}
      <Box flexGrow={1} />
      {p.extras}
      {p.metaAt !== 'name' && MetaCell(s, key, p.meta)}
      {p.trailing ?? (p.action && HoverReveal(s, `action:${key}`, scopeOf(rowKey), p.action.always || p.selected,
        IconButton(s, p.action.key, p.action.icon, p.action.icon === 'cancel' ? s.theme.accent : s.theme.pass, p.action.label, p.action.onPress)))}
    </Box>
  )
}
