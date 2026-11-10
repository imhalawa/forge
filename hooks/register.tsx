import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ForgeReport, LensState, Registries } from '../types'
import { card } from './lens/card'
import { pane, PANE } from './lens/pane'
import {
  changed, current, discover, type Io, NO_REGISTRIES, POLL_MS, relevant, scan, transitions,
} from './lens/registry'
import { accepts, apply, clean, EMPTY, KINDS, STATES } from './lens/state'
import { complete, TEMPLATES } from './lens/templates'
import { FIELDS as SIGNAL_FIELDS, parseSignal, type Signal } from './lens/signals'
import type { View } from './lens/tree'

const TOOL = 'mcp__forge__forge_report'
export const COMMAND = 'forge-pane'

const FIELDS = ['ticket', 'lane', 'kind', 'needsYou', 'ask', 'title', 'line', 'facts', 'sections',
  'evidence', 'choices', 'state', 'pr', 'step', 'session', 'template', 'fill'] as const

const labelled = (a: string, b: string) => ({
  type: 'object',
  properties: { [a]: { type: 'string' }, [b]: { type: 'string' } },
  required: [a, b],
})

export const forgeReportSchema = {
  type: 'object',
  properties: {
    ticket: { type: 'string', description: 'The parent ticket\'s key, the one /forge works on, e.g. "PROJ-123"; never a sub-task\'s key' },
    lane: {
      type: 'string',
      description: 'Exactly "<lane id> · <PR>" from the lane registry, e.g. "wt-2 · S1·2"; absent for the conductor and for planning',
    },
    kind: { type: 'string', enum: KINDS },
    needsYou: { type: 'boolean' },
    ask: { type: 'string', description: 'When needsYou: the one line for the band and the Now box, e.g. "Merge PR #41"' },
    title: { type: 'string', description: 'One line; on the conductor\'s `started` report, the parent ticket\'s summary' },
    line: { type: 'string', description: 'One sentence' },
    facts: {
      type: 'array',
      description: 'Pairs of label and value: branch, base, PR, why first',
      items: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, items: { type: 'array', items: { type: 'string' }, maxItems: 3 } },
        required: ['label', 'items'],
      },
    },
    evidence: { type: 'array', description: 'file:line, query and result, diff, log', items: labelled('label', 'text') },
    choices: { type: 'array', description: 'What happens on each answer', items: labelled('label', 'then') },
    state: { type: 'string', enum: STATES },
    pr: {
      type: 'object',
      properties: {
        number: { type: 'number' },
        base: { type: 'string' },
        checks: { type: 'array', description: '[passed, total]', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        approvals: { type: 'number' },
        fixed: { type: 'number' },
      },
      required: ['number', 'base'],
    },
    step: {
      type: 'string',
      description: 'The current step, e.g. "criterion 2 of 3"; on a planning report, exactly "Problem", "Approach" or "Sub-tasks"',
    },
    session: { type: 'string', description: "the lane runner's session or agent id" },
    template: {
      type: 'string', enum: TEMPLATES,
      description: 'The card template (skills/forge/templates.md). With it, send its blanks as `fill`, and leave out kind, needsYou, state, title and line: the card writes them.',
    },
    fill: { type: 'object', description: "The template's blanks, as templates.md lists them" },
  },
  required: ['ticket'],
}

export const lens = atom({ plugin: 'forge', key: 'lens' } as const, EMPTY)
export const registries = atom({ plugin: 'forge', key: 'registries' } as const, NO_REGISTRIES)
export const signals = atom({ plugin: 'forge', key: 'signals' } as const, {} as Record<string, Signal>)

// gh and the system opener live outside the engine's PATH on a Mac.
const TOOL_PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
const SIGNAL_MS = 60_000

// The PR links of the runs the views draw: what GitHub is asked about.
const prUrls = (regs: Registries): string[] =>
  relevant(regs).flatMap(([, f]) => f.registry.lanes.flatMap(l => (l.prUrl && l.state !== 'merged' && l.state !== 'dropped' ? [l.prUrl] : [])))

// The registry the views draw, with the remote its PR links need.
const viewOf = (regs: Registries, state: LensState): View | undefined => {
  const c = current(regs, state.ticket)
  return c && { ...c, remote: regs.remote, place: regs.place }
}

// A lane's own worktree: the session working there is not told about the run it is part of.
const inLane = (regs: Registries) =>
  !!regs.branch && Object.values(regs.files).some(f => f.registry.lanes.some(l => l.branch === regs.branch))

let stopWatch: (() => void) | undefined

const isReport = (value: unknown): value is ForgeReport => {
  const r = value as Partial<ForgeReport> | null
  return !!r && typeof r.ticket === 'string' && typeof r.title === 'string' && typeof r.line === 'string'
    && typeof r.needsYou === 'boolean' && (KINDS as readonly string[]).includes(String(r.kind))
}

const openPane = ($: { ui: { open: (p: { id: string; title: string }) => Promise<unknown> } }) =>
  $.ui.open({ id: PANE, title: 'Forge' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'forge_report',
      description: "Report forge's state to forge-lens. Only the /forge conductor calls it, never a lane runner: "
        + 'a `started` report at the start of each run, one report per lane on every rebuild, and one per change of phase, gate, finding or merge.',
      inputSchema: forgeReportSchema,
      isDeferred: false,
    })
    await $.command.register({ name: COMMAND, description: 'Open the forge-lens pane' })
    // The host calls the registry reader needs, each spelled at its call site.
    const io: Io = {
      home: () => $.env.get('HOME'),
      cwd: () => $.session.cwd(),
      process: { run: argv => $.process.run(argv) },
      fs: { list: path => $.fs.list(path), stat: path => $.fs.stat(path), read: path => $.fs.read(path) },
      session: { repo: () => $.session.repo() },
    }
    const regs = await scan(io, { ...NO_REGISTRIES, ...await discover(io).catch(() => ({})) }).catch(() => NO_REGISTRIES)
    await update($, registries, () => regs)
    // A run in flight where this session works: show its tree, once, as the session opens.
    if (e.isInteractive !== false && relevant(regs).length > 0 && !inLane(regs)) await openPane($).catch(() => undefined)
    // The registry moves without the conductor: a lane at review, a stop, a merge. Read it again on a timer.
    if (regs.dirs?.length) {
      stopWatch?.()
      const timer = $.clock.every(POLL_MS, () => {
        void (async () => {
          const before = await read($, registries)
          const after = await scan(io, before)
          if (!changed(before, after)) return
          await update($, registries, () => after)
          if (!inLane(after)) {
            // A toast cannot carry a button, so only the OS notification: it brings the person back to the chat.
            for (const { key, text } of transitions(before, after)) {
              await $.ui.notify(text, { title: `Forge · ${key}` }).catch(() => undefined)
            }
          }
          $.ui.invalidate('ui.render')
        })().catch(() => undefined)
      })
      // What GitHub says about each PR: checks, reviewers, size. Once now, then every minute.
      const ask = async () => {
        const fresh: Record<string, Signal> = { ...await read($, signals) }
        for (const url of prUrls(await read($, registries))) {
          const out = await $.process.run(['gh', 'pr', 'view', url, '--json', SIGNAL_FIELDS], { env: { PATH: TOOL_PATH } }).catch(() => null)
          const s = out && out.exitCode === 0 ? parseSignal(out.stdout) : null
          if (s) fresh[url] = s
        }
        await update($, signals, () => fresh)
        $.ui.invalidate('ui.render')
      }
      void ask().catch(() => undefined)
      const asking = $.clock.every(SIGNAL_MS, () => { void ask().catch(() => undefined) })
      stopWatch = () => { timer.cancel(); asking.cancel() }
    }
    return next(e)
  })

  // The person's own open: placed at any width.
  on('command.run', { command: COMMAND }, async $ => {
    const opened = await openPane($)
    return { text: (opened as { isPlaced?: boolean }).isPlaced === false ? 'The forge pane waits for room.' : 'Forge pane opened.' }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const raw = e as unknown as Record<string, unknown>
    const done = complete(Object.fromEntries(FIELDS.filter(k => raw[k] !== undefined).map(k => [k, raw[k]])))
    if ('problems' in done) {
      return { result: `forge_report: the ${String(raw.template)} card's blanks are wrong: ${done.problems.join('; ')}. Send it again with them right.`, isError: true }
    }
    const input = done.report
    if (!isReport(input)) {
      return { result: 'forge_report needs a template and its fill, or ticket, kind, needsYou, title and line.', isError: true }
    }
    let before: LensState = EMPTY
    let taken = true
    const after = await update($, lens, state => {
      before = state
      taken = accepts(state, clean(input))
      return apply(state, input)
    })
    if (!taken) {
      return { result: `forge-lens shows ${before.ticket ?? 'no ticket'}; send the conductor's report for ${input.ticket} first. Carry on.` }
    }
    // A new ticket is a fresh view: open the pane for it.
    if (before.ticket !== after.ticket) await openPane($).catch(() => undefined)
    return { result: `Reported ${input.kind} for ${input.lane ?? input.ticket}.` }
  }).catch(() => ({ result: 'forge-lens could not store the report; carry on.', isError: true }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const state = await read($, lens)
    return pane(state, { surface: e.surface, t: $.ui.resolve(e) }, viewOf(await read($, registries), state), {
      signals: await read($, signals),
      // The review action: the editor's URL through the system opener.
      open: (command: string[]) => $.process.run(command, { env: { PATH: TOOL_PATH } }).catch(() => undefined),
    })
  })

  // A forge_report row draws as its card; any other row, or a broken or cut report, is the engine's.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const raw = e.props.input
    const done = raw && typeof raw === 'object' ? complete(raw as Record<string, unknown>) : null
    const input = done && 'report' in done ? done.report : null
    if (e.props.tool !== TOOL || e.props.isErrored || e.props.isInterrupted || !isReport(input)) return next(e)
    return card(clean(input), { surface: e.surface, t: $.ui.resolve(e) }, e.props.isExpanded === true)
  })

  // The card says it all: a report's "Reported ..." line under it is left out; an error still shows.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== TOOL || e.props.isErrored || e.props.isExpanded) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
