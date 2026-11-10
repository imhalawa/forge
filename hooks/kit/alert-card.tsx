import type { Surface } from './surface'
import { SPACE, TINT, TYPE } from './tokens'

export type CardAction = { key: string; label: string; onPress: () => unknown }

// A card that stands in for content that could not be drawn: a red title, what happened, a line of code, actions.
export function AlertCard(s: Surface, p: { title: string; body: string; code?: string | null; actions: CardAction[] }) {
  const { Box, Text, Button } = s
  return (
    <Box key="state" flexDirection="column" gap={SPACE.gap} padding={SPACE.inset} backgroundColor={TINT.fail}>
      <Text {...TYPE.title} color="error">{p.title}</Text>
      <Text dimColor>{p.body}</Text>
      {p.code && <Text {...TYPE.code}>{p.code}</Text>}
      <Box key="state-actions" flexDirection="row" columnGap={SPACE.gap}>
        {p.actions.map(a => <Button key={a.key} label={a.label} onPress={a.onPress} />)}
      </Box>
    </Box>
  )
}
