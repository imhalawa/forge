import type { Surface } from './surface'

// A part of a pane as tall as it is given, clipped, its content moved up by how far it is scrolled. Without a window
// (no row budget) the content flows in a plain column.
// Not scrolled, the content stays in the flow: the pointer over an absolute Box counts as over its parent, so rows
// in one could never be hovered. A list that draws only its visible rows passes offset 0 and keeps its hovers.
export function ScrollArea(s: Surface, key: string, content: any[], window?: { height: number; offset: number }) {
  const { Box } = s
  if (!window) return <Box key={key} flexDirection="column" flexGrow={1}>{content}</Box>
  const placed = window.offset > 0 ? { position: 'absolute' as const, top: -window.offset, left: 0, right: 0 } : {}
  return (
    <Box key={key} width="100%" height={window.height} overflow="hidden" position="relative" flexShrink={0}>
      <Box key={`${key}-window`} width="100%" flexDirection="column" {...placed}>{content}</Box>
    </Box>
  )
}
