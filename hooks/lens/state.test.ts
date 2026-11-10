import { expect, test } from 'claude-code/testing'

import type { ForgeReport } from '../../types'
import { apply, counts, EMPTY } from './state'

type State = NonNullable<ForgeReport['state']>

const base = { ticket: 'PROJ-1', needsYou: false, title: 't', line: 'l' }
const plan = (title: string, state: State): ForgeReport => ({ ...base, kind: 'planning', title, state })
const lane = (name: string, state: State, needsYou = false): ForgeReport =>
  ({ ...base, kind: 'progress', lane: name, state, needsYou })
const conductor = (kind: ForgeReport['kind'], needsYou = false): ForgeReport => ({ ...base, kind, needsYou })
const started = (title = 't', ticket = 'PROJ-1'): ForgeReport => ({ ...base, ticket, kind: 'started', title })
// A run opens with the conductor's `started` report; lane reports count only after it.
const fold = (reports: ForgeReport[]) => reports.reduce(apply, EMPTY)
const run = (reports: ForgeReport[]) => fold([started(), ...reports])
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

test('planning reports fill the three stages', () =>
  expect(apply(EMPTY, plan('Problem', 'review')).planning).toHaveLength(1))

test('lane report upserts by lane', () =>
  expect(Object.keys(run([lane('wt-1', 'building'), lane('wt-1', 'review')]).lanes)).toEqual(['wt-1']))

test('latest report wins even after merged', () =>
  expect(run([lane('wt-1', 'merged'), lane('wt-1', 'merged')]).lanes['wt-1']?.state).toBe('merged'))

test('needsYou tracks lanes waiting on the user', () =>
  expect(run([lane('wt-1', 'review', true), lane('wt-2', 'stopped', true), lane('wt-1', 'open')]).needsYou)
    .toEqual(['wt-2']))

test('a conductor report needing the user is tracked as conductor', () =>
  expect(fold([conductor('merge-ready', true)]).needsYou).toEqual(['conductor']))

test('counts', () =>
  expect(counts(run([lane('a', 'merged'), lane('b', 'building'), lane('c', 'review', true)])))
    .toEqual({ merged: 1, total: 3, building: 1, needsYou: 1 }))

test('feed keeps the last 50', () =>
  expect(run(range(60).map(i => lane(`wt-${i}`, 'building'))).feed).toHaveLength(50))

test('malformed optional fields do not throw', () => {
  const bad = { ...lane('wt-1', 'building'), facts: 'x', sections: null, pr: 7 } as unknown as ForgeReport
  expect(() => run([bad])).not.toThrow()
  expect(run([bad]).lanes['wt-1']?.facts).toBeUndefined()
})

test('a malformed lane or state is treated as a conductor report', () => {
  const bad = { ...base, kind: 'progress', lane: 5, state: 'nope' } as unknown as ForgeReport
  expect(Object.keys(fold([bad]).lanes)).toEqual([])
})

test('a planning stage is replaced in place', () => {
  const planning = fold([plan('Problem', 'review'), plan('Problem', 'confirmed')]).planning
  expect(planning).toHaveLength(1)
  expect(planning?.[0]?.state).toBe('confirmed')
})

test('planning keeps the three stages in first-seen order', () =>
  expect(fold([plan('Problem', 'review'), plan('Approach', 'pending'), plan('Sub-tasks', 'pending'),
    plan('Problem', 'confirmed')]).planning?.map(s => s.title)).toEqual(['Problem', 'Approach', 'Sub-tasks']))

test('the stage is the step when there is one', () =>
  expect(fold([{ ...plan('a', 'review'), step: 'Problem' }, { ...plan('b', 'confirmed'), step: 'Problem' }])
    .planning).toHaveLength(1))

test('planning never overwrites the ticket title', () => {
  const s = fold([conductor('started'), plan('Problem', 'review')])
  expect(s.title).toBe('t')
  expect(fold([plan('Problem', 'review')]).title).toBeUndefined()
})

test('a conductor report clears its own needsYou', () =>
  expect(fold([conductor('merge-ready', true), conductor('merged')]).needsYou).toEqual([]))

test('malformed pr and sections are dropped', () => {
  for (const bad of [{ pr: { number: 'x' } }, { pr: null }, { sections: null }, { sections: [{ label: 1, items: [] }] }]) {
    const r = run([{ ...lane('wt-1', 'building'), ...bad } as unknown as ForgeReport]).lanes['wt-1']
    expect(r?.pr).toBeUndefined()
    expect(r?.sections).toBeUndefined()
  }
})

test('the ticket title comes from the conductor\'s started report only', () => {
  const s = fold([{ ...conductor('started'), title: 'Retry failed refunds' },
    { ...conductor('restacked'), title: 'Stack rebased' }, { ...conductor('delivered'), title: 'PROJ-123 delivered' }])
  expect(s.title).toBe('Retry failed refunds')
  expect(fold([{ ...conductor('progress'), title: 'Lanes running' }]).title).toBeUndefined()
})

test('a later started report retitles the ticket', () =>
  expect(fold([started('Old summary'), started('New summary')]).title).toBe('New summary'))

test('a new ticket takes its own title', () =>
  expect(fold([{ ...conductor('started'), title: 'a' }, { ...conductor('started'), ticket: 'PROJ-2', title: 'b' }]).title)
    .toBe('b'))

test('the session id is kept, and a blank one dropped', () => {
  expect(run([{ ...lane('wt-1', 'building'), session: 'sess-1' }]).lanes['wt-1']?.session).toBe('sess-1')
  expect(run([{ ...lane('wt-1', 'building'), session: '' }]).lanes['wt-1']?.session).toBeUndefined()
})

test('a new ticket starts a fresh view', () => {
  const s = fold([
    { ...conductor('started'), title: 'A' },
    { ...lane('wt-1', 'review', true), ask: 'Review wt-1' },
    { ...conductor('delivered') },
    { ...plan('Problem', 'review'), ticket: 'PROJ-2', step: 'Problem' },
    { ...conductor('started'), ticket: 'PROJ-2', title: 'B' },
  ])
  expect(s.ticket).toBe('PROJ-2')
  expect(s.title).toBe('B')
  expect(s.lanes).toEqual({})
  expect(s.needsYou).toEqual([])
  expect(s.delivered).toBeUndefined()
  expect(s.planning?.map(p => p.step)).toEqual(['Problem'])
  expect(s.feed.every(r => r.ticket === 'PROJ-2')).toBe(true)
})

test('an empty started title keeps the one before', () =>
  expect(fold([started('Real'), started('')]).title).toBe('Real'))

test('an empty step falls back to the title', () =>
  expect(fold([{ ...plan('Problem', 'review'), step: '' }, plan('Problem', 'confirmed')]).planning).toHaveLength(1))

// The conductor's latest report

test('the conductor\'s latest report is kept apart from the feed', () => {
  const s = run([{ ...conductor('merge-ready', true), ask: 'Merge PR #41' }, ...range(60).map(i => lane(`wt-${i}`, 'building'))])
  expect(s.feed.some(r => !r.lane)).toBe(false)
  expect(s.conductor?.kind).toBe('merge-ready')
  expect(s.needsYou).toEqual(['conductor'])
  expect(counts(s).needsYou).toBe(1)
})

test('a delivered conductor report clears every call', () => {
  const s = run([lane('wt-1', 'review', true), conductor('merge-ready', true), conductor('delivered')])
  expect(s.needsYou).toEqual([])
  expect(s.delivered).toBe(true)
})

test('a call sent again keeps its place', () =>
  expect(run([lane('wt-1', 'review', true), lane('wt-2', 'stopped', true), lane('wt-1', 'review', true)]).needsYou)
    .toEqual(['wt-1', 'wt-2']))

// Switching tickets

test('a lane report before any conductor report is ignored', () =>
  expect(fold([lane('wt-1', 'building')])).toEqual(EMPTY))

test('a lane report for another ticket is ignored', () => {
  const s = run([lane('wt-1', 'building'), { ...lane('wt-9', 'review', true), ticket: 'PROJ-2' }])
  expect(s.ticket).toBe('PROJ-1')
  expect(Object.keys(s.lanes)).toEqual(['wt-1'])
  expect(s.needsYou).toEqual([])
})

test('only a conductor report switches the ticket', () => {
  const s = run([lane('wt-1', 'building'), started('B', 'PROJ-2'), { ...lane('wt-1', 'review'), ticket: 'PROJ-2' }])
  expect(s.ticket).toBe('PROJ-2')
  expect(s.title).toBe('B')
  expect(s.lanes['wt-1']?.state).toBe('review')
})
