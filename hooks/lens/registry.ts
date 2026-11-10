import type { Lane, Registries, Registry } from '../../types'

export const POLL_MS = 5000
export const NO_REGISTRIES: Registries = { files: {} }

// What this module asks of the host: git, the registry folder, and the repo's origin.
export type Io = {
  home: () => Promise<string | undefined>
  cwd: () => Promise<string>
  process: { run: (argv: readonly string[]) => Promise<{ exitCode: number; stdout: string }> }
  fs: {
    list: (path: string) => Promise<{ name: string; kind: string }[]>
    stat: (path: string) => Promise<{ mtimeMs: number }>
    read: (path: string) => Promise<string>
  }
  session: { repo: () => Promise<{ root: string; remote: string | null } | null> }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isStr = (v: unknown): v is string => typeof v === 'string'

// A registry with the fields the lens draws from; anything else is not one.
export const parseRegistry = (text: string): Registry | undefined => {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isObj(value) || !Array.isArray(value.lanes)) return undefined
  const lanes = value.lanes.filter((l): l is Lane =>
    isObj(l) && isStr(l.id) && isStr(l.pr) && isStr(l.subTask) && isStr(l.branch) && isStr(l.state))
  const plan = isObj(value.plan) && Array.isArray(value.plan.prs)
    ? {
      ...value.plan,
      prs: value.plan.prs.filter(r => isObj(r) && isStr(r.pr) && isStr(r.subTask)),
    } as Registry['plan']
    : undefined
  const record = <T>(v: unknown) => (isObj(v) ? v as T : undefined)
  return {
    parent: isStr(value.parent) ? value.parent : null, plan, lanes,
    deploy: record<Registry['deploy']>(value.deploy), verify: record<Registry['verify']>(value.verify),
    cleanup: record<Registry['cleanup']>(value.cleanup), gaps: record<Registry['gaps']>(value.gaps),
  }
}

const git = async (io: Io, args: string[]): Promise<string | undefined> => {
  const out = await io.process.run(['git', ...args]).catch(() => undefined)
  return out && out.exitCode === 0 ? out.stdout.trim() || undefined : undefined
}

// Where registries live, and where the session is: every ticket's registry sits in ~/.claude/forge,
// whatever folder the conductor ran in; an older one may still sit in the repo's git common dir.
export const discover = async (io: Io): Promise<Omit<Registries, 'files'>> => {
  const home = await io.home().catch(() => undefined)
  const common = await git(io, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  const dirs = [home && `${home}/.claude/forge`, common && `${common}/forge`].filter((d): d is string => !!d)
  const branch = common ? await git(io, ['branch', '--show-current']) : undefined
  const repo = common ? await io.session.repo().catch(() => null) : null
  const place = repo?.root ?? await io.cwd().catch(() => undefined)
  return { dirs, place, branch, remote: repo?.remote ?? null }
}

// Reads each registry whose file changed since `prev`; a file that does not parse keeps its last copy.
export const scan = async (io: Io, prev: Registries): Promise<Registries> => {
  if (!prev.dirs?.length) return prev
  const files: Registries['files'] = {}
  for (const dir of prev.dirs) {
    const entries = await io.fs.list(dir).catch(() => [])
    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
      const key = entry.name.slice(0, -'.json'.length)
      // The first folder wins: the home registry over an older copy in the repo.
      if (files[key]) continue
      const path = `${dir}/${entry.name}`
      const before = prev.files[key]
      const stat = await io.fs.stat(path).catch(() => undefined)
      if (!stat) continue
      if (before && before.path === path && before.mtimeMs === stat.mtimeMs) {
        files[key] = before
        continue
      }
      const registry = parseRegistry(await io.fs.read(path).catch(() => ''))
      if (registry) files[key] = { path, mtimeMs: stat.mtimeMs, registry }
      else if (before) files[key] = before
    }
  }
  return { ...prev, files }
}

const same = (a: Registries, b: Registries) =>
  a.dirs?.join() === b.dirs?.join() && a.place === b.place && a.branch === b.branch && a.remote === b.remote
  && Object.keys(a.files).length === Object.keys(b.files).length
  && Object.entries(a.files).every(([k, f]) => b.files[k]?.mtimeMs === f.mtimeMs)

export const changed = (a: Registries, b: Registries) => !same(a, b)

// A branch named `<parent>-empty-the-iam-stack` reads "Empty the iam stack" until the plan names the PR.
export const humanize = (branch: string | undefined, parent: string): string | undefined => {
  const slug = branch?.startsWith(`${parent}-`) ? branch.slice(parent.length + 1) : branch
  if (!slug) return undefined
  const words = slug.replace(/-+/gu, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// What a PR does, in words: the plan's name, else its branch read as words.
export const nameOf = (registry: Registry, key: string, lane: Lane): string =>
  registry.plan?.prs.find(r => r.pr === lane.pr)?.name ?? humanize(lane.branch, key) ?? lane.pr

// The states that hand a PR to the person, and the sentence the notification says, in plain words.
const ALERTS: Record<string, (name: string, n?: number | null) => string> = {
  review: name => `${name} is ready for your review.`,
  stopped: name => `${name} stopped: forge needs your answer.`,
  call: (name, n) => `${name}${n ? ` (#${n})` : ''} is ready to merge.`,
  merged: (name, n) => `${name}${n ? ` (#${n})` : ''} merged.`,
}

// A PR that moved into an alert state since the last read, in a run that touches this session.
// A registry read for the first time alerts nothing: the tree shows what was already there.
export const transitions = (before: Registries, after: Registries): { key: string; text: string }[] =>
  relevant(after).flatMap(([key, file]) => {
    const old = before.files[key]
    if (!old) return []
    const was = new Map(old.registry.lanes.map(l => [l.id, l.state]))
    return file.registry.lanes.flatMap(l => {
      const say = ALERTS[l.state]
      return say && was.has(l.id) && was.get(l.id) !== l.state
        ? [{ key, text: say(nameOf(file.registry, key, l), l.prNumber) }] : []
    })
  })

const FINAL = new Set(['merged', 'dropped'])
export const NEEDS_YOU = new Set(['review', 'stopped', 'call'])

// The plan's PRs, each with its lane when it has one; a dropped PR's later lane wins.
export const prsOf = (registry: Registry): { pr: string; subTask: string; lane?: Lane }[] => {
  const rows = registry.plan?.prs ?? []
  const laneOf = (pr: string) => {
    const all = registry.lanes.filter(l => l.pr === pr)
    return all.find(l => l.state !== 'dropped') ?? all.at(-1)
  }
  const planned = rows.map(r => ({ pr: r.pr, subTask: r.subTask, lane: laneOf(r.pr) }))
  // A lane whose PR is not in the plan (an old plan) still shows.
  const extra = registry.lanes
    .filter(l => !rows.some(r => r.pr === l.pr))
    .map(l => ({ pr: l.pr, subTask: l.subTask, lane: l }))
  return [...planned, ...extra]
}

export const isActive = (registry: Registry): boolean => {
  const prs = prsOf(registry)
  return prs.length > 0 && prs.some(p => !p.lane || !FINAL.has(p.lane.state))
}

const under = (path: string | undefined, root: string) => !!path && (path === root || path.startsWith(`${root}/`))

// A run touches a place when one of its repos or worktrees is the place, sits under it (a folder of
// clones), or holds it (a worktree of the repo). A registry read from the repo itself always does.
export const touches = (path: string, registry: Registry, place?: string): boolean => {
  if (!place) return false
  // Only the session's own repo has its legacy folder read.
  if (path.includes('/.git/forge/')) return true
  const paths = [
    ...registry.lanes.flatMap(l => [l.repo, l.worktree]),
    ...(registry.plan?.prs ?? []).map(r => r.repo),
  ].filter((p): p is string => !!p)
  return paths.some(p => under(p, place) || under(place, p))
}

// The registries of runs in flight that touch where the session is.
export const relevant = (regs: Registries): [string, Registries['files'][string]][] =>
  Object.entries(regs.files).filter(([, f]) => isActive(f.registry) && touches(f.path, f.registry, regs.place))

// Ticket keys in a text, in order, once each: "PROJ-123".
export const keysIn = (text: string): string[] => [...new Set(text.match(/\b[A-Z][A-Z0-9]+-\d+\b/gu) ?? [])]

// The one run a text names: the single key in it that has a state file. None, or more than one, names none.
export const namedRun = (regs: Registries, text: string): string | undefined => {
  const known = keysIn(text).filter(k => regs.files[k])
  return known.length === 1 ? known[0] : undefined
}

// The registry the views draw: the ticket this session works on (the one it named or reported), else the ticket in
// the branch's name, else the run here written last.
export const current = (regs: Registries, ticket?: string): { key: string; registry: Registry } | undefined => {
  const own = ticket ? regs.files[ticket] : undefined
  if (ticket && own) return { key: ticket, registry: own.registry }
  const fromBranch = regs.branch ? keysIn(regs.branch).find(k => regs.files[k]) : undefined
  if (fromBranch) return { key: fromBranch, registry: regs.files[fromBranch]!.registry }
  const [found] = relevant(regs)
    .sort(([, a], [, b]) => b.mtimeMs - a.mtimeMs)
  return found && { key: found[0], registry: found[1].registry }
}
