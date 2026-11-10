import type { Surface } from './surface'

// A one-line search field: `onChange` runs on every keystroke, so a list can narrow as the person types.
export function SearchField(s: Surface, p: { key: string; placeholder: string; value: string; onChange: (text: string) => unknown }) {
  const { Box, Input } = s
  return (
    <Box key={`field:${p.key}`} flexGrow={1} minWidth={0}>
      <Input key={p.key} placeholder={p.placeholder} value={p.value} onInput={(text: string) => p.onChange(text)} onSubmit={(text: string) => p.onChange(text)} />
    </Box>
  )
}
