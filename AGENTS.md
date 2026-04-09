# obsidian-artifact — agent notes

Obsidian community plugin that renders Claude-style React artifacts inline inside notes, with click-to-expand in a right-side pane.

## Commands

```sh
bun install      # install deps
bun run dev      # watch + incremental rebuild
bun run build    # typecheck then production bundle → main.js
bun run typecheck
bun run lint     # biome lint
bun run format   # biome format --write
bun run check    # biome format + lint + organize imports, writing fixes
```

`main.js`, `manifest.json`, `styles.css` are the release artifacts. Local install copies them to `<Vault>/.obsidian/plugins/obsidian-artifact/`.

## Invariants — don't break these

- **`VIEW_TYPE_ARTIFACT`** is persisted in workspace state. Never rename it.
- **`openInPane` reuses the first existing artifact leaf** (`workspace.getLeavesOfType(VIEW_TYPE_ARTIFACT)[0]`). Don't make it always create a new leaf — that regresses the single-pane UX.
- **`bundler.ts` runs Babel twice**: pass 1 does react + typescript, pass 2 runs the importRewriter on the output. Collapsing them to one pass breaks `react/jsx-runtime` import rewriting because the react preset inserts that import during pass 1.
- **No network calls at runtime.** Transpiled modules are loaded via `data:` URLs, never `blob:` or `https:`. An esm.sh escape hatch would need an explicit opt-in setting.
- **Register all cleanup via `this.register*`** so plugin reload doesn't leak listeners, React roots, or observers.

## Adding a library

```sh
bun add some-package
```

```ts
// src/modules.ts
import * as SomePackage from "some-package";
export const moduleRegistry = {
	// …
	"some-package": SomePackage,
};
```

The Babel rewriter picks it up automatically — no other files change.

## Adding a shadcn primitive

1. Copy the component source from https://ui.shadcn.com/docs/components/<name> into `src/shadcn/<name>.tsx`.
2. Fix imports to use `./utils` for `cn` and relative paths for other shadcn files.
3. Register in `modules.ts` under `@/components/ui/<name>`.

## Releasing

1. `bun pm version patch|minor|major` — runs `version-bump.mjs` automatically, syncs `manifest.json` + `versions.json`.
2. `git push && git push --tags`.
3. GitHub release whose tag exactly matches `manifest.json`'s `version` (no leading `v`). Attach `main.js`, `manifest.json`, `styles.css` as individual assets.
