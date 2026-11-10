# kit

A copy of the claude-dotnet-devkit `ui-kit` (`ui-kit/src`, at devkit commit `dc583b0`), the shared UI components
for Claude Code mods. Forge's loader reads only files inside the plugin, and loads them unbundled, so the kit is
copied here with its `.ts` import extensions dropped. Change it in the devkit first, then copy it again.

One local change: `SIZE.guide` is 400 (the devkit's is 48), because forge's rows wrap and a guide must reach past
three lines. Each guide is also drawn only as wide as its line, so it never covers a row's links.
