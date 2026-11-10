import { icon, type IconName } from './icons'
import { OUTCOMES } from './theme'
import { SIZE } from './tokens'
import type { Surface } from './surface'

// An outcome icon: the design's SVG on the desktop, a colored symbol in the terminal.
export function OutcomeIcon(s: Surface, key: string, name: string | undefined) {
  const { Box, Text, Svg } = s
  const o = OUTCOMES[name ?? ''] ?? OUTCOMES.queued!
  const hex = s.theme[o.role]
  return s.desktop
    ? <Box key={`icon:outcome:${key}`} flexShrink={0}><Svg source={icon((name ?? 'queued') as IconName, hex)} alt={o.alt} width={SIZE.icon} height={SIZE.icon} /></Box>
    : <Text key={`icon:outcome:${key}`} color={o.theme}>{o.mark}</Text>
}
