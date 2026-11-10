---
name: cq-dotnet
description: Use when writing, changing, or reviewing C# code, C# tests, or .NET build files.
user-invocable: false
---

Read only the references that cover the files in hand.

| Files | References |
|---|---|
| `*.cs` | [simplicity](references/simplicity.md), [types](references/types.md), [collections](references/collections.md), [naming](references/naming.md), [syntax](references/syntax.md), [nullability](references/nullability.md), [errors and async](references/errors-and-async.md), [logging and comments](references/logging-and-comments.md), [apis](references/apis.md) |
| Tests: `*Tests*/**/*.cs`, `test/**`, `tests/**` | the `*.cs` references, then [tests](references/tests.md), which wins where they differ |
| `*.csproj`, `*.props`, `*.targets`, `*.sln`, `*.slnx`, `.editorconfig`, `global.json` | [build](references/build.md) |

When writing: follow every rule in the matching references. They win over the repo's existing style.

When reviewing: check every rule in the matching references against the changed lines only. Report one row per broken rule, then stop:

| File:line | Rule | Fix |
|---|---|---|
