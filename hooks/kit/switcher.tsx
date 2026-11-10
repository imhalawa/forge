import { SPACE } from './tokens'
import type { Surface } from './surface'

// A segmented switch: the options sit in a track (a rounded border on the chip fill), the chosen one raised on the
// surface color in full text, the others dimmed. The desktop pads a bordered Box by itself, which made the track three
// lines high: no padding above or below keeps it one line, and the smallest step at the sides. Terminal: the chosen
// option is the primary button.
export function Switcher(s: Surface, group: string, options: readonly (readonly [string, string])[], chosen: string, set: (v: string) => unknown) {
  const { Box, Button, desktop, hotkey } = s
  return (
    <Box key={`segments:${group}`} flexDirection="row" alignItems="center"
      {...(desktop && { borderStyle: 'round', borderColor: s.theme.border, backgroundColor: s.theme.chip, paddingX: SPACE.trackX, paddingY: 0 })}>
      {options.map(([value, label]) => {
        const isChosen = value === chosen
        const button = <Button key={`${group}:${value}`} plain={isChosen && !desktop ? undefined : true} variant={isChosen && !desktop ? 'primary' : undefined}
          dimColor={desktop && !isChosen ? true : undefined} hotkey={hotkey(`${group}:${value}`)} label={label} onPress={() => set(value)} />
        return isChosen && desktop
          ? <Box key={`chosen:${group}`} backgroundColor={s.theme.surface}>{button}</Box>
          : button
      })}
    </Box>
  )
}
