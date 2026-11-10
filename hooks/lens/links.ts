// The GitHub repository a remote names, `owner/repo`, from its SSH or HTTPS URL; null for any other host.
export const githubRepo = (remote: string | null | undefined): string | null => {
  if (!remote) return null
  const m = /^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https:\/\/(?:[^@/]+@)?github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/u
    .exec(remote.trim())
  return m?.[1] ?? null
}

export const prUrl = (remote: string | null | undefined, n: number): string | null => {
  const repo = githubRepo(remote)
  return repo ? `https://github.com/${repo}/pull/${n}` : null
}

// A ticket's page under the tracker's base URL, as the plan recorded it.
export const ticketUrl = (trackerUrl: string | undefined, key: string): string | null =>
  trackerUrl && /^https:\/\//u.test(trackerUrl) ? `${trackerUrl.replace(/\/+$/u, '')}/browse/${key}` : null
