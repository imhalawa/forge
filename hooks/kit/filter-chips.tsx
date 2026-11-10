import { ActiveMark } from './active-mark'
import type { Surface } from './surface'
import { SPACE } from './tokens'

export type Chip = { key: string; icon: any; label: string; active: boolean; onToggle: () => unknown }

// Chips that turn a filter on and off, one line high: an active chip has the selection fill and the accent underline
// (ActiveMark), the others neither. Terminal: the chosen chip is the primary button.
export function FilterChips(s: Surface, chips: Chip[]) {
  const { Box, Button } = s
  return (
    <Box key="filters" flexDirection="row" alignItems="center" columnGap={SPACE.gap} flexWrap="wrap">
      {chips.map(c => (
        <Box key={`filter:${c.key}`} flexDirection="row" alignItems="center" columnGap={SPACE.gap} paddingX={SPACE.inset} flexShrink={0}
          position="relative" backgroundColor={s.desktop && c.active ? s.theme.selection : undefined}>
          {c.icon}
          <Button key={`filter-button:${c.key}`} plain variant={c.active && !s.desktop ? 'primary' : undefined} label={c.label} onPress={c.onToggle} />
          {c.active && ActiveMark(s, `filter:${c.key}`)}
        </Box>
      ))}
    </Box>
  )
}
