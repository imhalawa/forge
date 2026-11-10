## What

<!-- One or two lines on the change. -->

## Why

<!-- The problem it solves. Link the issue: Fixes #… -->

## Checks

- [ ] A test covers the change.
- [ ] `python3 -B -m unittest discover -s tests` passes.
- [ ] `claude plugin test .` passes.
- [ ] `claude plugin validate .` passes.
- [ ] A changed skill keeps its evals passing (`claude plugin eval .`).
- [ ] No private data: ticket keys, names, URLs or code from real systems.
