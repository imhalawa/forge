import type { IconName } from './icons'
import type { Theme } from './tokens'
import { MetaCell, NameCell } from './cells'
import { Divider } from './divider'
import { Guides, type Guide } from './guides'
import { IconButton } from './icon-button'
import { OutcomeIcon } from './outcome-icon'
import { SelectedEdge } from './selected-edge'
import { surfaceOf } from './surface'
import { Switcher } from './switcher'

export { scopeOf } from './hover-scope'
export { ActiveMark } from './active-mark'
export { AlertCard, type CardAction } from './alert-card'
export { HoverReveal } from './hover-reveal'
export { Notice } from './notice'
export { ProgressBar } from './progress-bar'
export { ScrollArea } from './scroll-area'
export { StatusBar, type StatusItem } from './status-bar'
export { TreeRow, type TreeRowProps } from './tree-row'
export type { Surface } from './surface'
export { OUTCOMES } from './theme'
export { LIGHT, PALETTE, SIZE, SPACE, TINT, TONE, TYPE, type Theme, type Tone } from './tokens'
export { DurationBar } from './duration-bar'
export { Dropdown, type DropdownOption, type DropdownProps } from './dropdown'
export { FilterChips, type Chip } from './filter-chips'
export { HealthRibbon, type RibbonSegment } from './health-ribbon'
export { SearchField } from './search-field'
export { Tag } from './tag'
export type { IconName } from './icons'
export type { Guide } from './guides'

// The kit: one surface's elements with every primitive bound to it, so a component takes one argument for drawing.
export type Kit = ReturnType<typeof makeKit>

export function makeKit(ui: any, surface: string, letters: Record<string, string> = {}, theme: Partial<Theme> = {}) {
  const s = surfaceOf(ui, surface, letters, theme)
  return {
    ...s,
    outcome: (key: string, name: string | undefined) => OutcomeIcon(s, key, name),
    control: (key: string, name: IconName, hex: string, alt: string, onPress: () => unknown, letter?: string, badge?: string) =>
      IconButton(s, key, name, hex, alt, onPress, letter, badge),
    switcher: (group: string, options: readonly (readonly [string, string])[], chosen: string, set: (v: string) => unknown) =>
      Switcher(s, group, options, chosen, set),
    divider: (key: string, height?: number) => Divider(s, key, height),
    guides: (row: string, levels: Guide[], leaf?: boolean) => Guides(s, row, levels, leaf),
    edge: (id: string, selected: boolean) => SelectedEdge(s, id, selected),
    named: (key: string, child: any) => NameCell(s, key, child),
    meta: (key: string, text: string) => MetaCell(s, key, text),
  }
}
