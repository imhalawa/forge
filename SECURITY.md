# Security

Please report security problems privately, not in a public issue.

Send it through the [contact page](https://traceintime.com/contact/) with:

- What the problem is and what it could expose.
- How to reproduce it.
- The forge version.

Please wait for a fix before sharing details in public.

forge runs `git` and `gh` with your own sign-in, works only in the repositories its plan names, and keeps its state in `~/.claude/forge/`. It never pushes to an `upstream` remote, never merges without your answer, and never removes work that isn't pushed. A problem that lets it reach further than that, or leak what it keeps, is a security problem.
