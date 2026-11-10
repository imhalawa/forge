import { LIGHT, type Theme } from './tokens'

// The elements one surface offers, and whether it is the desktop: SVG there, symbols and letter keys in the terminal.
export type Surface = ReturnType<typeof surfaceOf>

// `letters` maps a control's key to the letter that presses it in the terminal; `theme` overrides LIGHT's roles.
export function surfaceOf(ui: any, surface: string, letters: Record<string, string> = {}, theme: Partial<Theme> = {}) {
  const { Box, Text, Button, Link } = ui
  const Svg = 'Svg' in ui && surface !== 'terminal' ? ui.Svg : undefined
  const Select = 'Select' in ui && surface !== 'terminal' ? ui.Select : undefined
  const Input = 'Input' in ui ? ui.Input : undefined
  const desktop = Boolean(Svg)
  // Letter keys belong to the keyboard-driven terminal; on the desktop their badges only add noise.
  const hotkey = (key: string) => (desktop ? undefined : letters[key])
  return { Box, Text, Button, Link, Svg, Select, Input, desktop, hotkey, theme: { ...LIGHT, ...theme } as Theme }
}
