import { SIZE } from './tokens'
import type { Surface } from './surface'

// The selected row's accent edge on the left.
export function SelectedEdge(s: Surface, id: string, selected: boolean) {
  const { Box, Svg } = s
  return s.desktop && selected && (
    <Box key={`edge:${id}`} position="absolute" left={0} top={0}>
      <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE.edge}" height="${SIZE.guide}"><rect width="${SIZE.edge}" height="${SIZE.guide}" fill="${s.theme.accent}"/></svg>`} alt="Selected" width={SIZE.edge} height={SIZE.guide} />
    </Box>
  )
}
