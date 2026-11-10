import type { Surface } from './surface'
import { SPACE } from './tokens'

// A full-width bar filled to a share, with a line of text under it. The terminal shows the text alone.
export function ProgressBar(s: Surface, p: { fraction: number; text: string }) {
  const { Box, Text } = s
  return (
    <Box key="progress" flexDirection="column">
      {s.desktop && (
        <Box key="progress-bar" width="100%" height={SPACE.track} backgroundColor={s.theme.chip} flexDirection="row">
          <Box key="progress-fill" width={`${Math.round(p.fraction * 100)}%`} height={SPACE.track} backgroundColor={s.theme.accent} />
        </Box>
      )}
      <Text dimColor>{p.text}</Text>
    </Box>
  )
}
