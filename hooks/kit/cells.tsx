import type { Surface } from './surface'
import { TYPE } from './tokens'

// A row's two text cells. In a narrow pane the name gives way and cuts off; the count or time on the right never
// shrinks or wraps.
export const NameCell = (s: Surface, key: string, child: any) =>
  <s.Box key={`name:${key}`} flexShrink={1} minWidth={0} overflow="hidden">{child}</s.Box>

export const MetaCell = (s: Surface, key: string, text: string) =>
  <s.Box key={`meta:${key}`} flexShrink={0}><s.Text {...TYPE.meta} wrap="truncate-end">{text}</s.Text></s.Box>
