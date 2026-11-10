import type { ElementTable, RenderSurface } from 'claude-code'

import type { ForgeReport, LensState } from '../../types'
import { CONDUCTOR } from './state'

// The theme's blue: the one accent, and it means "your call".
export const ACCENT = 'suggestion'

// What a view draws with: the surface, and the table `$.ui.resolve(e)` hands out for it.
type Table = Pick<ElementTable<'terminal'>, 'Box' | 'Text'> & Partial<Pick<ElementTable<'terminal'>, 'Link'>>
  & Partial<Pick<ElementTable<'desktop'>, 'Svg'>>
export type Ui = { surface: RenderSurface; t: Table }

export type Call = { key: string; ask: string }

export const latest = (state: LensState, key: string): ForgeReport | undefined =>
  key === CONDUCTOR ? state.conductor : state.lanes[key]

// Everything waiting on the person, in needsYou order, as the pane's Now box lists it.
export const calls = (state: LensState): Call[] =>
  state.needsYou.flatMap(key => {
    const r = latest(state, key)
    return r ? [{ key, ask: r.ask ?? r.title }] : []
  })
