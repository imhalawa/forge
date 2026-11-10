import { expect, test } from 'claude-code/testing'

import type { Registries, Registry } from '../../types'
import { REGISTRY } from './fixtures'
import { githubRepo, prUrl, ticketUrl } from './links'
import {
  current, type Io, isActive, NO_REGISTRIES, nameOf, parseRegistry, relevant, scan, transitions,
} from './registry'

const regs = (registry: Registry, mtimeMs = 1): Registries =>
  ({ dirs: ['/r/.git/forge'], place: '/r', files: { 'PROJ-1': { path: '/r/.git/forge/PROJ-1.json', mtimeMs, registry } } })

const withLane = (registry: Registry, id: string, state: string): Registry =>
  ({ ...registry, lanes: registry.lanes.map(l => (l.id === id ? { ...l, state } : l)) })

// parse

test('a registry parses its lanes and plan', () => {
  const r = parseRegistry(JSON.stringify(REGISTRY))
  expect(r?.lanes).toHaveLength(2)
  expect(r?.plan?.prs).toHaveLength(3)
})

test('bad JSON, or no lanes, is not a registry', () => {
  expect(parseRegistry('{')).toBeUndefined()
  expect(parseRegistry('{"plan": {}}')).toBeUndefined()
})

test('a lane missing its fields is left out', () =>
  expect(parseRegistry('{"lanes": [{"id": "wt-1"}]}')?.lanes).toEqual([]))

// transitions

test('a lane moving to review alerts once', () => {
  const before = regs(REGISTRY)
  const after = regs(withLane(REGISTRY, 'wt-2', 'review'), 2)
  expect(transitions(before, after)).toEqual([{ key: 'PROJ-1', text: 'Wt 2 is ready for your review.' }])
  expect(transitions(after, after)).toEqual([])
})

test('a stop and a merge alert too; building does not', () => {
  expect(transitions(regs(REGISTRY), regs(withLane(REGISTRY, 'wt-2', 'stopped'))))
    .toEqual([{ key: 'PROJ-1', text: 'Wt 2 stopped: forge needs your answer.' }])
  expect(transitions(regs(withLane(REGISTRY, 'wt-2', 'review')), regs(REGISTRY))).toEqual([])
})

test('a registry read for the first time alerts nothing', () =>
  expect(transitions(NO_REGISTRIES, regs(withLane(REGISTRY, 'wt-2', 'review')))).toEqual([]))

// summary, reminder, status

test('a run with an unstarted PR is active; all merged is not', () => {
  expect(isActive(REGISTRY)).toBe(true)
  const done = { ...REGISTRY, plan: { prs: REGISTRY.plan!.prs.slice(0, 1) }, lanes: REGISTRY.lanes.slice(0, 1) }
  expect(isActive(done)).toBe(false)
})

test('current prefers the ticket on view, else the active registry', () => {
  expect(current(regs(REGISTRY), 'PROJ-1')?.key).toBe('PROJ-1')
  expect(current(regs(REGISTRY))?.key).toBe('PROJ-1')
  expect(current(regs(REGISTRY), 'PROJ-9')?.key).toBe('PROJ-1')
  expect(current(NO_REGISTRIES)).toBeUndefined()
})

// scan

const fakeIo = (files: Record<string, { mtimeMs: number; text: string }>, reads: string[]): Io => ({
  home: async () => undefined,
  cwd: async () => '/r',
  process: { run: async () => ({ exitCode: 1, stdout: '' }) },
  fs: {
    list: async () => Object.keys(files).map(name => ({ name, kind: 'file' })),
    stat: async path => ({ mtimeMs: files[path.split('/').at(-1)!]!.mtimeMs }),
    read: async path => {
      reads.push(path)
      return files[path.split('/').at(-1)!]!.text
    },
  },
  session: { repo: async () => null },
})

test('scan reads a registry only when its file changed', async () => {
  const reads: string[] = []
  const files = { 'PROJ-1.json': { mtimeMs: 1, text: JSON.stringify(REGISTRY) }, 'PROJ-1.json.lock': { mtimeMs: 1, text: '' } }
  const first = await scan(fakeIo(files, reads), { dirs: ['/r/.git/forge'], files: {} })
  expect(Object.keys(first.files)).toEqual(['PROJ-1'])
  await scan(fakeIo(files, reads), first)
  expect(reads).toEqual(['/r/.git/forge/PROJ-1.json'])
  files['PROJ-1.json'] = { mtimeMs: 2, text: JSON.stringify(withLane(REGISTRY, 'wt-2', 'review')) }
  const third = await scan(fakeIo(files, reads), first)
  expect(reads).toHaveLength(2)
  expect(third.files['PROJ-1']?.registry.lanes[1]?.state).toBe('review')
})

test('a registry caught mid-write keeps its last good copy', async () => {
  const files = { 'PROJ-1.json': { mtimeMs: 1, text: JSON.stringify(REGISTRY) } }
  const first = await scan(fakeIo(files, []), { dirs: ['/r/.git/forge'], files: {} })
  files['PROJ-1.json'] = { mtimeMs: 2, text: '{"lanes": [' }
  const second = await scan(fakeIo(files, []), first)
  expect(second.files['PROJ-1']?.registry.lanes).toHaveLength(2)
})

test('no folder, no scan', async () =>
  expect(await scan(fakeIo({}, []), NO_REGISTRIES)).toEqual(NO_REGISTRIES))

// where a run is shown

const HOME_PATH = '/home/me/.claude/forge/PROJ-1.json'
const homeRegs = (place: string): Registries => ({
  dirs: ['/home/me/.claude/forge'],
  place,
  files: { 'PROJ-1': { path: HOME_PATH, mtimeMs: 1, registry: {
    ...REGISTRY, lanes: REGISTRY.lanes.map(l => ({ ...l, repo: '/w/shared/aws', worktree: `/w/shared/aws/.worktrees/${l.branch}` })),
  } } },
})

test('a run in the home folder shows in the repo its lanes change', () =>
  expect(relevant(homeRegs('/w/shared/aws')).map(([k]) => k)).toEqual(['PROJ-1']))

test('a run shows in the folder that holds its clones, and in a lane worktree', () => {
  expect(relevant(homeRegs('/w')).map(([k]) => k)).toEqual(['PROJ-1'])
  expect(relevant(homeRegs('/w/shared/aws/.worktrees/PROJ-1-wt-2')).map(([k]) => k)).toEqual(['PROJ-1'])
})

test('a run is not shown in an unrelated repo', () => {
  expect(relevant(homeRegs('/w/payments-backend/api'))).toEqual([])
  expect(current(homeRegs('/w/payments-backend/api'))).toBeUndefined()
  expect(transitions(homeRegs('/elsewhere'), homeRegs('/elsewhere'))).toEqual([])
})

test('the home registry wins over an older copy in the repo', async () => {
  const io: Io = { ...fakeIo({ 'PROJ-1.json': { mtimeMs: 1, text: JSON.stringify(REGISTRY) } }, []) }
  const regs = await scan(io, { dirs: ['/home/me/.claude/forge', '/r/.git/forge'], files: {} })
  expect(regs.files['PROJ-1']?.path).toBe('/home/me/.claude/forge/PROJ-1.json')
})

test('a PR is named by the plan, else by its branch in words', () => {
  expect(nameOf(REGISTRY, 'PROJ-1', REGISTRY.lanes[0]!)).toBe('Remove the config')
  expect(nameOf(REGISTRY, 'PROJ-1', REGISTRY.lanes[1]!)).toBe('Wt 2')
})

// links

test('GitHub remotes give the repo, SSH and HTTPS alike', () => {
  expect(githubRepo('git@github.com:acme/payments.git')).toBe('acme/payments')
  expect(githubRepo('https://github.com/acme/payments')).toBe('acme/payments')
  expect(githubRepo('https://token@github.com/acme/payments.git/')).toBe('acme/payments')
  expect(githubRepo('ssh://git@github.com/acme/payments.git')).toBe('acme/payments')
})

test('any other host gives no link', () => {
  expect(githubRepo('git@gitlab.com:a/b.git')).toBeNull()
  expect(prUrl(null, 4)).toBeNull()
})

test('a PR link and a ticket link', () => {
  expect(prUrl('git@github.com:o/r.git', 4242)).toBe('https://github.com/o/r/pull/4242')
  expect(ticketUrl('https://example.atlassian.net/', 'PROJ-2')).toBe('https://example.atlassian.net/browse/PROJ-2')
  expect(ticketUrl(undefined, 'PROJ-2')).toBeNull()
  expect(ticketUrl('javascript:alert(1)', 'PROJ-2')).toBeNull()
})
