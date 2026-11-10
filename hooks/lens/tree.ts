import type { ForgeReport, Lane, LensState, Registry } from '../../types'
import { prUrl, ticketUrl } from './links'
import { NEEDS_YOU, prsOf } from './registry'
import { STATES } from './state'

type State = NonNullable<ForgeReport['state']>

// The registry the views draw, with what links need.
export type View = { key: string; registry: Registry; remote?: string | null; place?: string }

export type PrNode = {
  pr: string
  lane?: string                 // "wt-2 · S1·2", the report key
  state: State
  dropped: boolean
  needsYou: boolean
  branch?: string
  base?: string
  number?: number
  url?: string | null
  report?: ForgeReport
}

export type SubNode = { key: string; title?: string; url: string | null; prs: PrNode[]; merged: number; total: number }

const AT_REVIEW = new Set(['review', 'call', 'open', 'ci', 'passed', 'failed', 'changes', 'fixed', 'approved', 'merged'])

// The registry state as the pane names it, the way the conductor maps it for its reports.
export const stateOf = (lane: Lane | undefined, lanes: Lane[]): State => {
  if (!lane) return 'pending'
  if (lane.state === 'dropped') return 'stopped'
  if (lane.state === 'pending') {
    const bases = (lane.dependsOn ?? []).map(id => lanes.find(l => l.id === id))
    return bases.some(b => !b || !AT_REVIEW.has(b.state)) ? 'waits' : 'queue'
  }
  return (STATES as readonly string[]).includes(lane.state) ? lane.state as State : 'building'
}

// Sub-tasks in plan order, each with its PRs; the registry gives the state, the conductor's report
// for the same lane adds what only it reads (checks, approvals, the step, the ask).
export const tree = (view: View, lens: LensState): SubNode[] => {
  const { registry, remote } = view
  const titles = new Map((registry.plan?.prs ?? []).map(r => [r.subTask, r.title]))
  const trackerUrl = registry.plan?.trackerUrl
  const subs = new Map<string, SubNode>()
  for (const { pr, subTask, lane } of prsOf(registry)) {
    const key = lane ? `${lane.id} · ${lane.pr}` : undefined
    const report = key ? lens.lanes[key] : undefined
    const number = report?.pr?.number ?? lane?.prNumber ?? undefined
    const node: PrNode = {
      pr,
      lane: key,
      state: stateOf(lane, registry.lanes),
      dropped: lane?.state === 'dropped',
      needsYou: !!lane && (NEEDS_YOU.has(lane.state) || lens.needsYou.includes(key!)),
      branch: lane?.branch,
      base: report?.pr?.base ?? lane?.base,
      number,
      // The lane's own URL; the session's origin only for a lane in the session's own repo.
      url: lane?.prUrl ?? (number && (!lane?.repo || lane.repo === view.place) ? prUrl(remote, number) : null),
      report,
    }
    const sub = subs.get(subTask)
      ?? { key: subTask, title: titles.get(subTask), url: ticketUrl(trackerUrl, subTask), prs: [], merged: 0, total: 0 }
    sub.prs.push(node)
    if (!node.dropped) sub.total += 1
    if (node.state === 'merged') sub.merged += 1
    subs.set(subTask, sub)
  }
  return [...subs.values()]
}
