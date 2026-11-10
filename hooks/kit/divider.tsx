import { SIZE } from './tokens'
import type { Surface } from './surface'

// A thin vertical line between groups of controls. The terminal leaves it out.
export function Divider(s: Surface, key: string, height: number = SIZE.divider) {
  const { Box, Svg } = s
  return s.desktop && (
    <Box key={key} flexShrink={0}><Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE.rule}" height="${height}"><rect width="${SIZE.rule}" height="${height}" fill="${s.theme.border}"/></svg>`} alt="separator" width={SIZE.rule} height={height} /></Box>
  )
}
