import type { ForgeReport, LensState } from '../../types'

export const CONDUCTOR = 'conductor'
export const FEED_LIMIT = 50

export const KINDS = ['planning', 'started', 'progress', 'finding', 'review', 'raised',
  'comment', 'ci', 'merge-ready', 'merged', 'restacked', 'delivered'] as const satisfies readonly ForgeReport['kind'][]
export const STATES = ['pending', 'building', 'queue', 'waits', 'stopped', 'review', 'call',
  'open', 'ci', 'passed', 'failed', 'changes', 'fixed', 'approved',
  'merged', 'rebased', 'done', 'confirmed'] as const satisfies readonly NonNullable<ForgeReport['state']>[]

export const EMPTY: LensState = { lanes: {}, feed: [], needsYou: [] }

const isStr = (v: unknown): v is string => typeof v === 'string'
const isPair = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(isStr)
const listOf = <T>(v: unknown, ok: (x: unknown) => boolean) =>
  Array.isArray(v) && v.every(ok) ? (v as T[]) : undefined
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

// Drops any optional field of the wrong shape, so a bad report cannot break a view.
export const clean = (r: ForgeReport): ForgeReport => {
  const x = r as Record<string, unknown>
  const pr = x.pr
  const okPr = isObj(pr) && typeof pr.number === 'number' && isStr(pr.base)
  return {
    ticket: r.ticket,
    kind: r.kind,
    needsYou: r.needsYou,
    title: r.title,
    line: r.line,
    lane: isStr(x.lane) && x.lane !== '' ? x.lane : undefined,
    ask: isStr(x.ask) ? x.ask : undefined,
    step: isStr(x.step) ? x.step : undefined,
    session: isStr(x.session) && x.session !== '' ? x.session : undefined,
    template: isStr(x.template) ? x.template : undefined,
    fill: isObj(x.fill) ? x.fill : undefined,
    state: (STATES as readonly unknown[]).includes(x.state) ? r.state : undefined,
    facts: listOf(x.facts, isPair),
    sections: listOf(x.sections, s => isObj(s) && isStr(s.label) && !!listOf(s.items, isStr)),
    evidence: listOf(x.evidence, e => isObj(e) && isStr(e.label) && isStr(e.text)),
    choices: listOf(x.choices, c => isObj(c) && isStr(c.label) && isStr(c.then)),
    pr: okPr ? {
      number: pr.number as number,
      base: pr.base as string,
      checks: Array.isArray(pr.checks) && pr.checks.length === 2 && pr.checks.every(n => typeof n === 'number')
        ? (pr.checks as [number, number]) : undefined,
      approvals: typeof pr.approvals === 'number' ? pr.approvals : undefined,
      fixed: typeof pr.fixed === 'number' ? pr.fixed : undefined,
    } : undefined,
  }
}

const STAGE_LIMIT = 3
// An empty step falls back to the title, as a missing one does.
const stageOf = (r: ForgeReport) => r.step || r.title

// A planning stage is replaced in place, keeping the order it first appeared in.
const upsertStage = (stages: ForgeReport[], r: ForgeReport): ForgeReport[] => {
  const at = stages.findIndex(s => stageOf(s) === stageOf(r))
  if (at >= 0) return stages.map((s, i) => (i === at ? r : s))
  return [...stages, r].slice(0, STAGE_LIMIT)
}

// Only the conductor (a report with no lane) switches the ticket; a lane's report counts only for the
// ticket on view, so a lane of another run never draws into this one.
// A PR's report belongs to the ticket on view. With none on view yet (a new session, a reload), the report itself
// says which ticket this is, so nothing waits on a `started` report.
export const accepts = (state: LensState, r: ForgeReport): boolean =>
  !r.lane || !state.ticket || state.ticket === r.ticket

export const apply = (prev: LensState, input: ForgeReport): LensState => {
  const r = clean(input)
  if (!accepts(prev, r)) return prev
  // A new ticket starts a fresh view: nothing of the old one leaks into it.
  const state = prev.ticket && prev.ticket !== r.ticket ? { ...EMPTY, ticket: r.ticket } : prev
  const key = r.lane ?? CONDUCTOR
  // Who already waits keeps their place, so a snapshot sent again does not reorder the calls.
  const waits = r.needsYou
    ? (state.needsYou.includes(key) ? state.needsYou : [...state.needsYou, key])
    : state.needsYou.filter(k => k !== key)
  const delivered = !r.lane && r.kind === 'delivered'
  return {
    ticket: r.ticket,
    // The ticket's title is the conductor's `started` report's: the parent ticket's summary.
    title: !r.lane && r.kind === 'started' && r.title ? r.title : state.title,
    planning: r.kind === 'planning' && !r.lane ? upsertStage(state.planning ?? [], r) : state.planning,
    conductor: r.lane ? state.conductor : r,
    lanes: r.lane ? { ...state.lanes, [r.lane]: r } : state.lanes,
    feed: [...state.feed, r].slice(-FEED_LIMIT),
    // Once delivered, nothing waits on the person any more.
    needsYou: delivered ? [] : waits,
    delivered: delivered ? true : state.delivered,
  }
}

export const counts = (state: LensState) => {
  const lanes = Object.values(state.lanes)
  return {
    merged: lanes.filter(l => l.state === 'merged').length,
    total: lanes.length,
    building: lanes.filter(l => l.state === 'building').length,
    needsYou: state.needsYou.length,
  }
}
