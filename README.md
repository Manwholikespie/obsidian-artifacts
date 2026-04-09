# obsidian-artifact

Render Claude-style React artifacts inline in your Obsidian notes, with click-to-expand in a right-side pane — the same way Claude Desktop handles artifacts.

Drop a ` ```artifact ` fenced code block into any note and the plugin transpiles the JSX on the fly and mounts it with React 18. The library surface matches Claude's own artifact sandbox, so code you copy from a Claude chat pastes in and Just Works.

````markdown
```artifact title="Counter" height="220"
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Button onClick={() => setCount(c => c + 1)}>
      Clicked {count} times
    </Button>
  );
}
```
````

Click the `⤢` button in the header of any artifact to open it in a right-side pane at full size.

## Info-string flags

All optional:

| Flag | Description |
|---|---|
| `title="..."` | Shown in the header; becomes the pane tab label when expanded. |
| `height="380"` | Inline height in px (default 400). Tall artifacts scroll inside the container. |
| `mode="inline"` \| `"preview"` | `preview` renders a compact card that opens in the pane on click — nice for artifacts too large to live comfortably inline. |

## Supported libraries

Bundled into the plugin and importable with bare specifiers, matching Claude's sandbox:

| Package | Notes |
|---|---|
| `react`, `react-dom`, `react/jsx-runtime` | React 18 |
| `lucide-react` | Full icon set |
| `recharts` | Charts |
| `d3` | Full d3 |
| `lodash`, `lodash-es` | Utility |
| `date-fns` | Dates |
| `clsx`, `tailwind-merge`, `class-variance-authority` | Class utilities |
| `@/components/ui/{button,card,input,label,badge,separator,alert,dialog,tabs,textarea}` | shadcn/ui primitives |
| `@/lib/utils` | The shadcn `cn()` helper |
| `@radix-ui/react-{slot,dialog,tabs,separator,label}` | shadcn's Radix deps, also available directly |

Tailwind is handled by [Twind](https://twind.style/) — a runtime Tailwind compiler. Any Tailwind utility class you write is generated into a shared stylesheet on the fly, no build step. The default theme matches shadcn/ui's light mode.

For anything not on the list, use an `esm.sh` URL:

```tsx
import { Something } from "https://esm.sh/some-package";
```

## Installing

Once published to the community catalog, install from **Settings → Community plugins → Browse → Artifact**. Until then, grab the latest release from GitHub, unzip into `<Vault>/.obsidian/plugins/obsidian-artifact/`, and enable it in community plugins.

## Building from source

```sh
bun install
bun run build
```

Produces `main.js`. Copy it along with `manifest.json` and `styles.css` into `<Vault>/.obsidian/plugins/obsidian-artifact/`.

For iterative development: `bun run dev` watches and rebuilds, then toggle the plugin off and on in community plugins settings to pick up changes.

## License

MIT
