import type { Theme } from './tokens'

// Each outcome icon: the Theme role that colors it, a theme key for terminal text, its words, and a symbol any font has.
export const OUTCOMES: Record<string, { role: keyof Theme; theme: string; alt: string; mark: string }> = {
  failed: { role: 'fail', theme: 'error', alt: 'Failed', mark: '✕' },
  passed: { role: 'pass', theme: 'success', alt: 'Passed', mark: '✓' },
  flaky: { role: 'warn', theme: 'warning', alt: 'Flaky', mark: '◐' },
  skipped: { role: 'muted', theme: 'inactive', alt: 'Skipped', mark: '–' },
  'not-run-yet': { role: 'muted', theme: 'inactive', alt: 'Not run yet', mark: '○' },
  queued: { role: 'muted', theme: 'inactive', alt: 'Queued', mark: '◷' },
  running: { role: 'accent', theme: 'suggestion', alt: 'Running', mark: '◌' },
}
