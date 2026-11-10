import type { Reviewer, Signal } from '../../types'
import type { Role } from './design'

export type { Reviewer, Signal }

export const FIELDS = 'reviewDecision,latestReviews,reviewRequests,statusCheckRollup,mergeable,isDraft,state,additions,deletions,changedFiles'
const FAILED = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])

type Check = { status?: string; conclusion?: string; state?: string }

// The checks as one state: any failure fails, anything unfinished runs, else passing; none is null.
export const ciOf = (rollup: Check[] | null | undefined): Signal['ci'] => {
  if (!rollup?.length) return null
  const results = rollup.map(c => c.conclusion || c.state || '')
  if (results.some(r => FAILED.has(r))) return 'failing'
  if (rollup.some(c => (c.status && c.status !== 'COMPLETED') || c.state === 'PENDING' || c.state === 'EXPECTED')) return 'running'
  return 'passing'
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

// `gh pr view --json <FIELDS>` read into a Signal; anything it cannot read is null.
export const parseSignal = (text: string): Signal | null => {
  let v: unknown
  try { v = JSON.parse(text) } catch { return null }
  if (!isObj(v)) return null
  const reviewers: Reviewer[] = []
  for (const r of Array.isArray(v.latestReviews) ? v.latestReviews : []) {
    const login = isObj(r) && isObj(r.author) && typeof r.author.login === 'string' ? r.author.login : null
    const review = isObj(r) && r.state === 'APPROVED' ? 'approved' : isObj(r) && r.state === 'CHANGES_REQUESTED' ? 'changes' : null
    if (login && review) reviewers.push({ login, review })
  }
  for (const r of Array.isArray(v.reviewRequests) ? v.reviewRequests : []) {
    const name = isObj(r) ? (r.login ?? r.slug ?? r.name) : null
    if (typeof name === 'string' && !reviewers.some(x => x.login === name)) reviewers.push({ login: name, review: 'pending' })
  }
  const num = (k: string) => (typeof v[k] === 'number' ? v[k] as number : 0)
  const decision = v.reviewDecision
  return {
    ci: ciOf(Array.isArray(v.statusCheckRollup) ? v.statusCheckRollup as Check[] : null),
    review: decision === 'APPROVED' || decision === 'CHANGES_REQUESTED' || decision === 'REVIEW_REQUIRED' ? decision : null,
    reviewers,
    conflicts: v.mergeable === 'CONFLICTING',
    draft: v.isDraft === true,
    state: v.state === 'MERGED' || v.state === 'CLOSED' ? v.state : 'OPEN',
    additions: num('additions'),
    deletions: num('deletions'),
    files: num('changedFiles'),
  }
}

// Whose move it is on an open pull request, in words and a role: on-my-watch's order of precedence.
export const waitingOn = (s: Signal): readonly [string, Role] | null => {
  if (s.state === 'MERGED') return null
  if (s.state === 'CLOSED') return ['Closed', 'muted']
  if (s.conflicts) return ['Conflicts', 'failed']
  if (s.review === 'CHANGES_REQUESTED') return ['Changes requested', 'failed']
  if (s.draft) return ['Draft', 'muted']
  if (s.ci === 'failing') return ['Checks failing', 'failed']
  if (s.review === 'APPROVED') return ['Ready to merge', 'done']
  const pending = s.reviewers.filter(r => r.review === 'pending').map(r => r.login)
  if (pending.length) return [`Waiting on ${pending[0]}${pending.length > 1 ? ` +${pending.length - 1}` : ''}`, 'muted']
  return ['Waiting on review', 'muted']
}

export const CI_ROLE: Record<NonNullable<Signal['ci']>, Role> = { passing: 'done', failing: 'failed', running: 'progress' }
