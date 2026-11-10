import type { Surface } from './surface'
import { SIZE } from './tokens'

// A small bar for a time as a share of the slowest beside it, so slow rows stand out in a column. Desktop only.
export function DurationBar(s: Surface, key: string, share: number, hex?: string) {
  const { Box, Svg } = s
  const { width, height } = SIZE.bar
  const filled = Math.max(1, Math.round(width * Math.min(1, share)))
  return s.desktop && (
    <Box key={`duration:${key}`} flexShrink={0}>
      <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${height / 2}" fill="${s.theme.chip}"/><rect width="${filled}" height="${height}" rx="${height / 2}" fill="${hex ?? s.theme.muted}"/></svg>`} alt={`${Math.round(share * 100)}% of the slowest`} width={width} height={height} />
    </Box>
  )
}
