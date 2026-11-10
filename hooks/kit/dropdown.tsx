import { IconButton } from './icon-button'
import { icon, type IconName } from './icons'
import type { Surface } from './surface'
import { SIZE, SPACE, TYPE } from './tokens'

export type DropdownOption = { value: string; label: string; icon?: IconName; meta?: string }

export type DropdownProps = {
  key: string
  value: string
  options: DropdownOption[]
  open: boolean
  onToggle: () => unknown
  onPick: (value: string) => unknown
  // Where the menu card floats, in cells from the top left of the Box the caller draws it in.
  at?: { top: number; left: number }
}

// A dropdown whose entries carry an icon (drawn muted, named by the entry) and a count, which the app's Select can't
// draw. It returns two parts: the trigger, one line high, for the toolbar; and the menu card, which the caller draws last in the pane so it floats
// over what comes after it. The card is placed absolutely, so its rounded border moves nothing.
// A click on empty space raises no event. A backdrop of invisible buttons was tried: in the app it hid the pane under
// it and took every click, so the caller closes the menu on its other presses and on scroll instead.
// The terminal has no pointer to float a card for: there the trigger steps to the next entry.
export function Dropdown(s: Surface, p: DropdownProps) {
  const { Box, Text, Button, Svg } = s
  const glyph = (key: string, o: DropdownOption) => o.icon &&
    <Box key={`icon:${key}`} flexShrink={0}><Svg source={icon(o.icon, s.theme.muted)} alt={o.label} width={SIZE.icon} height={SIZE.icon} /></Box>
  const chosen = p.options.find(o => o.value === p.value) ?? p.options[0]
  const label = chosen?.label ?? p.value
  if (!s.desktop) {
    const next = p.options[(p.options.findIndex(o => o.value === p.value) + 1) % p.options.length]
    return { trigger: <Button key={p.key} plain label={`${label} ▸`} onPress={() => next && p.onPick(next.value)} />, menu: null }
  }
  const trigger = (
    <Box key={`dropdown:${p.key}`} flexDirection="row" alignItems="center" columnGap={SPACE.gap} paddingX={SPACE.inset} flexShrink={1} minWidth={0}
      backgroundColor={p.open ? s.theme.selection : s.theme.chip}>
      {chosen && glyph(`dropdown:${p.key}`, chosen)}
      <Button key={p.key} plain onPress={p.onToggle}><Text wrap="truncate-end">{label}</Text></Button>
      {IconButton(s, `toggle:${p.key}`, 'chevron-down', s.theme.muted, 'Open the list', p.onToggle)}
    </Box>
  )
  const card = (
    <Box key={`menu:${p.key}`} position="absolute" top={p.at?.top ?? 1} left={p.at?.left ?? 0} flexDirection="column"
      borderStyle="round" borderColor={s.theme.border} backgroundColor={s.theme.surface}>
      {p.options.map(o => {
        const picked = o.value === p.value
        return (
          <Box key={`option:${p.key}:${o.value}`} flexDirection="row" alignItems="center" columnGap={SPACE.gap} paddingX={SPACE.inset}
            backgroundColor={picked ? s.theme.selection : undefined}>
            {glyph(`option:${p.key}:${o.value}`, o)}
            <Box flexGrow={1} minWidth={0}>
              <Button key={`pick:${p.key}:${o.value}`} plain onPress={() => p.onPick(o.value)}><Text wrap="truncate-end">{o.label}</Text></Button>
            </Box>
            {o.meta && <Text {...TYPE.meta}>{o.meta}</Text>}
            {picked && <Text color={s.theme.accent}>✓</Text>}
          </Box>
        )
      })}
    </Box>
  )
  return { trigger, menu: p.open ? card : null }
}
