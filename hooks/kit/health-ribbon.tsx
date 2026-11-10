import type { Surface } from './surface'
import { SPACE } from './tokens'

export type RibbonSegment = { key: string; count: number; hex: string }

// A thin full-width bar split into segments by count, with a line summing it up under it. The terminal shows the line.
export function HealthRibbon(s: Surface, p: { segments: RibbonSegment[]; summary: string }) {
  const { Box, Text } = s
  return (
    <Box key="ribbon" flexDirection="column">
      {s.desktop && (
        <Box key="ribbon-bar" width="100%" height={SPACE.track} flexDirection="row" backgroundColor={s.theme.chip}>
          {/* Each segment grows by its count: no percentages, which a pane takes only whole. */}
          {p.segments.map(seg => <Box key={`ribbon:${seg.key}`} flexGrow={seg.count} height={SPACE.track} backgroundColor={seg.hex} />)}
        </Box>
      )}
      <Text dimColor>{p.summary}</Text>
    </Box>
  )
}
