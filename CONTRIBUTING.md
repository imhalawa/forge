# Contributing

Thanks for helping. forge is young, so bug reports are as welcome as code.

## Report a problem

- [Open an issue](https://github.com/imhalawa/forge/issues/new/choose) and pick a template.
- Include your OS, your Claude Code version, and the forge version.
- Remove anything private first: ticket keys, repository names, URLs, code.
- Report security problems privately. See [SECURITY.md](SECURITY.md).

## Change the code

1. Fork the repository and create a branch from `main`.
2. Read [the design](docs/design.md) for how the parts fit.
3. Write a failing test first, then the change that makes it pass.
4. Run every check:
   ```bash
   python3 -B -m unittest discover -s tests
   claude plugin test .
   claude plugin validate .
   ```
5. Open a pull request against `main` and fill in the template.

## Keep it small

- One change per pull request.
- No new dependencies unless there is no other way. The scripts use only the Python standard library.
- Example data stays made up: `acme/*` repositories, `PROJ-123` tickets and plain first names.

## Conduct

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).
