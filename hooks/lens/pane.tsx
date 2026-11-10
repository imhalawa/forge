import type { RenderElement } from 'claude-code'

import type { ForgeReport, LensState } from '../../types'
import { ACCENT, calls, type Ui } from './band'
import { icon } from './icons'
import { counts } from './state'
import { tracker } from './tracker'
import type { View } from './tree'

export const PANE = 'forge'

type State = NonNullable<ForgeReport['state']>

// The spec's status words, one per state.
export const WORDS: Record<State, string> = {
  pending: 'Not started',
  building: 'Building',
  queue: 'In queue',
  waits: 'Waits on base',
  stopped: 'Stopped: something new',
  review: 'Your review',
  call: 'Your call',
  open: 'PR open',
  ci: 'Checks running',
  passed: 'Checks passed',
  failed: 'Check failed',
  changes: 'Changes requested',
  fixed: 'Comment fixed',
  approved: 'Approved',
  merged: 'Merged',
  rebased: 'Rebased',
  done: 'Delivered',
  confirmed: 'Confirmed',
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const fact = (r: ForgeReport, label: string) => r.facts?.find(([l]) => l === label)?.[1]

// base, PR, checks passed of total, approvals, comments fixed, the current step.
export const signals = (r: ForgeReport): string => {
  const pr = r.pr
  const base = pr?.base ?? fact(r, 'base')
  return [
    base && `base ${base}`,
    pr && `#${pr.number}`,
    pr?.checks && `${pr.checks[0]}/${pr.checks[1]}`,
    pr?.approvals !== undefined && plural(pr.approvals, 'approval'),
    pr?.fixed ? plural(pr.fixed, 'comment fixed', 'comments fixed') : undefined,
    r.step,
    r.session && `session ${r.session}`,
  ].filter(Boolean).join(' · ')
}

const head = (state: LensState): string => {
  const c = counts(state)
  return [
    c.total > 0 && `${c.merged} of ${c.total} merged`,
    c.building > 0 && `${c.building} building`,
    c.needsYou > 0 && `${c.needsYou} needs you`,
    state.delivered && 'delivered',
  ].filter(Boolean).join(' · ')
}

type Row = { key: string; name: string; word: string; state: State; needsYou: boolean; branch?: string; signals?: string }

const laneRow = (r: ForgeReport): Row => {
  const state = r.state ?? 'pending'
  const sig = signals(r)
  return {
    key: r.lane ?? '', name: r.lane ?? '', word: WORDS[state], state, needsYou: r.needsYou,
    branch: fact(r, 'branch'), signals: sig || undefined,
  }
}

// A planning stage not reached yet reads "next".
const stageRow = (r: ForgeReport): Row => {
  const state = r.state ?? 'pending'
  const name = r.step ?? r.title
  return { key: name, name, word: state === 'pending' ? 'next' : WORDS[state], state, needsYou: r.needsYou }
}

const row = (r: Row, ui: Ui): RenderElement => {
  const { Box, Text } = ui.t
  // A border takes a column each side; the unbordered rows pad one more to line up.
  const frame = r.needsYou
    ? { borderStyle: 'round', borderColor: ACCENT, paddingX: 1, paddingY: 0 }
    : { paddingX: 2 }
  return (
    <Box key={`row:${r.key}`} flexDirection="column" {...frame}>
      <Box flexDirection="row" gap={1}>
        {icon(r.state, ui.surface, ui.t)}
        <Text>{`${r.name} · ${r.word}`}</Text>
      </Box>
      {r.branch && <Text>{r.branch}</Text>}
      {r.signals && <Text dimColor>{r.signals}</Text>}
    </Box>
  )
}

const now = (state: LensState, ui: Ui): RenderElement | null => {
  const { Box, Text } = ui.t
  const list = calls(state)
  if (list.length === 0) return null
  return (
    <Box key="now" flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={1} paddingY={0}>
      {list.map((c, i) => (
        <Box key={`call:${c.key}`} flexDirection="row" gap={1}>
          <Text>{c.ask}</Text>
        </Box>
      ))}
    </Box>
  )
}

export const pane = (state: LensState, ui: Ui, view?: View, opts?: Parameters<typeof tracker>[3]): RenderElement => {
  const { Box, Text } = ui.t
  if (view && (view.registry.plan?.prs.length || view.registry.lanes.length)) return tracker(state, view, ui, opts)
  if (!state.ticket) return <Box flexDirection="column"><Text dimColor>No forge run in this session</Text></Box>
  const lanes = Object.values(state.lanes)
  const rows = lanes.length > 0 ? lanes.map(laneRow) : (state.planning ?? []).map(stageRow)
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>{state.title ? `${state.ticket} · ${state.title}` : state.ticket}</Text>
        {head(state) ? <Text dimColor>{head(state)}</Text> : null}
      </Box>
      {now(state, ui)}
      <Box flexDirection="column" gap={1}>
        {rows.map(r => row(r, ui))}
      </Box>
    </Box>
  )
}
