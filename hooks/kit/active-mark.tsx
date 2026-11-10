import type { Surface } from './surface'
import { SPACE } from './tokens'

// What is chosen or on (a tab, a scope, a filter) carries a thin accent underline over its selection fill: the fill
// alone is too faint against the pane to tell on from off. Placed absolutely, so it moves nothing; drawn inside the
// chosen Box, which must be `position="relative"`. The terminal leaves it out: there the primary button marks it.
export const ActiveMark = (s: Surface, key: string) => s.desktop && (
  <s.Box key={`mark:${key}`} position="absolute" bottom={0} left={0} width="100%" height={SPACE.mark} backgroundColor={s.theme.accent} />
)
