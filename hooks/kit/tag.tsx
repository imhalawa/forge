import type { Surface } from './surface'
import { SPACE, TONE, TYPE, type Tone } from './tokens'

// A small label beside a row's name, one line high: its tone's fill on the desktop, colored text in the terminal.
export function Tag(s: Surface, key: string, text: string, tone: Tone) {
  const { Box, Text } = s
  return (
    <Box key={key} flexShrink={0} paddingX={SPACE.inset} backgroundColor={s.desktop ? s.theme[TONE[tone].fill] : undefined}>
      <Text {...TYPE.caption} color={TONE[tone].text}>{text}</Text>
    </Box>
  )
}
