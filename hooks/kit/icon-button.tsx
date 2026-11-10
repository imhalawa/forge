import { icon, type IconName } from './icons'
import { SIZE, TYPE } from './tokens'
import type { Surface } from './surface'

// An icon you press: on the desktop an invisible Button lies over the SVG; the terminal presses a labelled Button.
// The icon's alt names the control: a Button's label is drawn as text, so the invisible Button carries none.
// A badge counts on the icon.
export function IconButton(s: Surface, key: string, name: IconName, hex: string, alt: string, onPress: () => unknown, letter?: string, badge?: string) {
  const { Box, Text, Button, Svg } = s
  if (!s.desktop) return <Button key={key} plain hotkey={letter} label={alt} onPress={onPress} />
  return (
    <Box key={`icon:${key}`} position="relative" flexShrink={0}>
      <Svg source={icon(name, hex)} alt={alt} width={SIZE.icon} height={SIZE.icon} />
      {badge && (
        <Box key={`badge:${key}`} position="absolute" top={-1} left={1}>
          <Text {...TYPE.label} color={s.theme.onFill} backgroundColor={s.theme.fail}>{badge}</Text>
        </Box>
      )}
      <Box position="absolute" top={0} left={0}>
        <Button key={key} plain onPress={onPress}><Text color="transparent">{' '}</Text></Button>
      </Box>
    </Box>
  )
}
