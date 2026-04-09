// Singleton Twind setup. Twind is a runtime Tailwind implementation —
// it scans `class` attributes in the DOM and generates CSS on the fly
// into a shared stylesheet, so we don't need a build step for Tailwind
// and we don't need to ship multiple megabytes of pre-compiled CSS.
//
// We `install()` globally so a single MutationObserver on the document
// processes any Tailwind class names that show up anywhere — including
// inside our artifact containers. Obsidian's own class names (like
// `cm-line`, `mod-cta`) are rejected by Twind's matcher instantly, so
// the overhead is negligible.

import { defineConfig, install } from "@twind/core";
import presetAutoprefix from "@twind/preset-autoprefix";
import presetTailwind from "@twind/preset-tailwind";

let installed = false;

// shadcn/ui default theme — lets our pre-built shadcn primitives render
// correctly out of the box and keeps Claude-generated artifacts that
// reference `bg-primary`, `text-muted-foreground`, etc. looking right.
const config = defineConfig({
  presets: [presetAutoprefix(), presetTailwind()],
  theme: {
    extend: {
      colors: {
        border: "hsl(240 5.9% 90%)",
        input: "hsl(240 5.9% 90%)",
        ring: "hsl(240 5.9% 10%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(240 10% 3.9%)",
        primary: {
          DEFAULT: "hsl(240 5.9% 10%)",
          foreground: "hsl(0 0% 98%)",
        },
        secondary: {
          DEFAULT: "hsl(240 4.8% 95.9%)",
          foreground: "hsl(240 5.9% 10%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(0 0% 98%)",
        },
        muted: {
          DEFAULT: "hsl(240 4.8% 95.9%)",
          foreground: "hsl(240 3.8% 46.1%)",
        },
        accent: {
          DEFAULT: "hsl(240 4.8% 95.9%)",
          foreground: "hsl(240 5.9% 10%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(240 10% 3.9%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(240 10% 3.9%)",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
    },
  },
});

let activeInstance: ReturnType<typeof install> | null = null;

/**
 * Install the global Twind instance. Idempotent — subsequent calls are no-ops.
 * Call at plugin load.
 */
export function installTwind(): void {
  if (installed) return;
  activeInstance = install(config);
  installed = true;
}

/**
 * Tear down Twind, clearing generated styles. Call on plugin unload.
 */
export function destroyTwind(): void {
  if (!installed) return;
  activeInstance?.destroy();
  activeInstance = null;
  installed = false;
}
