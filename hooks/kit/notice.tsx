import type { Surface } from './surface'

// One quiet line where there is nothing else to draw.
export const Notice = (s: Surface, key: string, text: string) =>
  <s.Box key={key} flexDirection="row" alignItems="center"><s.Text dimColor>{text}</s.Text></s.Box>
