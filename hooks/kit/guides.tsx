import { SIZE } from './tokens'
import type { Surface } from './surface'

// One guide: the cell it sits at, and whether it ends on this row (the row is its parent's last child).
export type Guide = { at: number; end?: boolean }

// Indentation guides: 1 px lines under each parent's chevron, drawn tall and clipped by the row, so they run on
// unbroken from row to row. The terminal leaves them out.
// The deepest guide, the row's parent's, turns into the row with a short horizontal connector: |-. On the parent's
// last child it stops there, a └, so no line hangs below the branch. On a leaf the connector runs on across the
// empty chevron space to the check mark. Lines sit on whole pixels with crisp edges, so 1 px draws solid.
export function Guides(s: Surface, row: string, levels: Guide[], leaf = false) {
  const { Box, Svg } = s
  return (s.desktop ? levels : []).map((g, i) => {
    const reach = leaf ? 36 : 14
    const last = i === levels.length - 1
    // As wide as the line it draws, no wider: a positioned Svg paints over the row, so a wide one would sit on its
    // text and take the clicks meant for its links.
    const width = last ? Math.ceil(9 + reach) : 10
    const d = last ? `M8.5 0v${g.end ? 10.5 : SIZE.guide}${g.end ? '' : 'M8.5 10.5'}h${reach}` : `M8.5 0v${SIZE.guide}`
    return (
      <Box key={`guide:${row}:${g.at}`} position="absolute" left={g.at} top={0}>
        <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${SIZE.guide}"><path d="${d}" stroke="${s.theme.border}" stroke-width="${SIZE.rule}" fill="none" shape-rendering="crispEdges"/></svg>`} alt="guide" width={width} height={SIZE.guide} />
      </Box>
    )
  })
}
