import type { Surface } from './surface'

// What shows only while its hover scope is hovered (a row's action), or always when pinned (the selected row).
// The terminal has no pointer, so it always shows there. Hover may only reveal a Box drawn hidden.
export function HoverReveal(s: Surface, key: string, scope: string, pinned: boolean, child: any) {
  const shown = pinned || !s.desktop
  return (
    <s.Box key={key} flexShrink={0} {...(shown ? { display: 'flex' as const } : { display: 'none' as const, hover: { scope, display: 'flex' as const } })}>
      {child}
    </s.Box>
  )
}
