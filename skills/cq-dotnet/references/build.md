# Build

- .NET 10, C# 14, no preview features. Pin the SDK in `global.json` and exact versions in `Directory.Packages.props`.
- Nullable enabled, warnings as errors, deterministic builds, locked restore in CI.
- Tune analyzer rules one at a time, never a whole category. Suppress narrowly, with a written justification.
- A vulnerable transitive package is fixed by updating the package that brings it in. Never a pin on the vulnerable package itself.
- Run `cdk synth` after any change under `cdk/` and fix what it reports before raising the PR. Never raise a CDK change on a green build and tests alone.
