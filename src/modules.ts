// Module registry: every library that artifact code can `import` from.
// Populated at plugin load time and exposed via window._artifactModules.
// The Babel importRewriter rewrites `import { x } from 'foo'` into
// `const { x } = window._artifactModules['foo']`.

import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixLabel from "@radix-ui/react-label";
import * as RadixSeparator from "@radix-ui/react-separator";
import * as RadixSlot from "@radix-ui/react-slot";
import * as RadixTabs from "@radix-ui/react-tabs";
import * as Cva from "class-variance-authority";
import clsx from "clsx";
import * as D3 from "d3";
import * as DateFns from "date-fns";
import * as LodashEs from "lodash-es";
import * as LucideReact from "lucide-react";
import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as Recharts from "recharts";
import { twMerge } from "tailwind-merge";
import * as ShadAlert from "./shadcn/alert";
import * as ShadBadge from "./shadcn/badge";
// shadcn primitives (our own pre-compiled bundle)
import * as ShadButton from "./shadcn/button";
import * as ShadCard from "./shadcn/card";
import * as ShadDialog from "./shadcn/dialog";
import * as ShadInput from "./shadcn/input";
import * as ShadLabel from "./shadcn/label";
import * as ShadSeparator from "./shadcn/separator";
import * as ShadTabs from "./shadcn/tabs";
import * as ShadTextarea from "./shadcn/textarea";
import * as ShadcnUtils from "./shadcn/utils";

export const MODULES_KEY = "_artifactModules";

export const moduleRegistry: Record<string, unknown> = {
  // React core — artifacts share the same React instance as the plugin
  react: React,
  "react-dom": ReactDOM,
  "react-dom/client": ReactDOMClient,
  "react/jsx-runtime": JsxRuntime,

  // Icons
  "lucide-react": LucideReact,

  // Charts, data, utils
  recharts: Recharts,
  d3: D3,
  lodash: LodashEs,
  "lodash-es": LodashEs,
  "date-fns": DateFns,

  // Class utilities
  clsx: { default: clsx, clsx },
  "tailwind-merge": { twMerge },
  "class-variance-authority": Cva,

  // Radix (shadcn dependencies, also available directly)
  "@radix-ui/react-slot": RadixSlot,
  "@radix-ui/react-dialog": RadixDialog,
  "@radix-ui/react-tabs": RadixTabs,
  "@radix-ui/react-separator": RadixSeparator,
  "@radix-ui/react-label": RadixLabel,

  // shadcn/ui — exposed under the standard shadcn paths so Claude-generated
  // code with `import { Button } from "@/components/ui/button"` works as-is
  "@/components/ui/button": ShadButton,
  "@/components/ui/card": ShadCard,
  "@/components/ui/input": ShadInput,
  "@/components/ui/label": ShadLabel,
  "@/components/ui/badge": ShadBadge,
  "@/components/ui/separator": ShadSeparator,
  "@/components/ui/alert": ShadAlert,
  "@/components/ui/dialog": ShadDialog,
  "@/components/ui/tabs": ShadTabs,
  "@/components/ui/textarea": ShadTextarea,
  "@/lib/utils": ShadcnUtils,
};

// Names that should be rewritten to window._artifactModules lookups.
// Anything else is left alone by the Babel rewriter, which means:
//   - Relative imports (./foo) pass through
//   - Absolute URLs (https://esm.sh/three) pass through
//   - Unknown bare imports are reported as compile errors so the user
//     knows to either use a supported library or an esm.sh URL
export const knownModules = new Set(Object.keys(moduleRegistry));

/**
 * Attaches the module registry to window._artifactModules. Safe to call
 * multiple times; later calls are no-ops if the registry is already present.
 */
export function installModuleRegistry(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[MODULES_KEY]) return;
  w[MODULES_KEY] = moduleRegistry;
}

export function uninstallModuleRegistry(): void {
  const w = window as unknown as Record<string, unknown>;
  delete w[MODULES_KEY];
}
