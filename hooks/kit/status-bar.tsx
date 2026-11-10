import type { Surface } from './surface'
import { SPACE } from './tokens'

export type StatusItem = { key: string; icon: any; label: string }

// A pane's bottom row: items (an icon and a label each) on the left, a note on the right. One row high when pinned.
export function StatusBar(s: Surface, p: { items: StatusItem[]; note: string; pinned: boolean }) {
  const { Box, Text } = s
  return (
    <Box key="status-bar" height={p.pinned ? 1 : undefined} flexShrink={0} flexDirection="row" alignItems="center" columnGap={SPACE.gap} paddingX={SPACE.inset} backgroundColor={s.desktop ? s.theme.bar : undefined}>
      {p.items.flatMap(i => [i.icon, <Text key={`n:${i.key}`}>{i.label}</Text>])}
      <Box flexGrow={1} />
      <Text dimColor>{p.note}</Text>
    </Box>
  )
}
