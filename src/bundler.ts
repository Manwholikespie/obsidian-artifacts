// Babel-standalone based transpiler. Takes raw artifact source (JSX/TSX with
// bare `import` statements) and returns an executable ES module as a data URL.
//
// Two passes:
//   1. React preset (jsx-runtime "automatic") + TypeScript preset
//   2. Our importRewriter plugin, which rewrites bare imports to
//      `window._artifactGet('name')` lookups against the shared registry.
//
// Two passes is the cleanest way to ensure the importRewriter sees ALL
// imports, including the `react/jsx-runtime` imports that the react preset
// inserts during the first pass.

import * as Babel from "@babel/standalone";
import { MODULES_KEY, knownModules } from "./modules";

// Babel standalone exposes `packages`, `availablePresets`, and
// `availablePlugins` at runtime but omits them from its type definitions.
// We type through a local `any` alias rather than sprinkling casts
// throughout the file. (noExplicitAny is disabled in biome.json for this
// project specifically because of this Babel interop.)
type BabelAny = any;
const b = Babel as unknown as BabelAny;
const t = b.packages.types;

const GET_FN = "_artifactGet";

/**
 * Babel plugin that rewrites:
 *   import Default, { Named, Aliased as A } from 'pkg';
 *     → const { default: Default, Named, Aliased: A } = window._artifactGet('pkg');
 *
 *   import * as NS from 'pkg';
 *     → const NS = window._artifactGet('pkg');
 *
 * Relative imports (./foo) and absolute URL imports (https://…) are left
 * untouched — they pass through to the native browser module loader.
 */
function importRewriter() {
  return {
    visitor: {
      ImportDeclaration(path: BabelAny) {
        const source: string = path.node.source.value;
        if (
          source.startsWith(".") ||
          source.startsWith("/") ||
          source.startsWith("http://") ||
          source.startsWith("https://")
        ) {
          return;
        }

        const specifiers: BabelAny[] = path.node.specifiers;

        // Namespace import: `import * as Foo from 'bar'`
        const nsSpec = specifiers.find((s) => t.isImportNamespaceSpecifier(s));
        if (nsSpec) {
          path.replaceWith(
            t.variableDeclaration("const", [
              t.variableDeclarator(
                t.identifier(nsSpec.local.name),
                t.callExpression(t.memberExpression(t.identifier("window"), t.identifier(GET_FN)), [
                  t.stringLiteral(source),
                ])
              ),
            ])
          );
          return;
        }

        // Named + default imports: destructure out of the module object
        const properties = specifiers
          .map((spec: BabelAny) => {
            if (t.isImportDefaultSpecifier(spec)) {
              return t.objectProperty(
                t.identifier("default"),
                t.identifier(spec.local.name),
                false,
                false
              );
            }
            if (t.isImportSpecifier(spec)) {
              const importedName =
                spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
              const localName = spec.local.name;
              const shorthand = importedName === localName;
              return t.objectProperty(
                t.identifier(importedName),
                t.identifier(localName),
                false,
                shorthand
              );
            }
            return null;
          })
          .filter(Boolean);

        path.replaceWith(
          t.variableDeclaration("const", [
            t.variableDeclarator(
              t.objectPattern(properties),
              t.callExpression(t.memberExpression(t.identifier("window"), t.identifier(GET_FN)), [
                t.stringLiteral(source),
              ])
            ),
          ])
        );
      },
    },
  };
}

let pluginRegistered = false;
function ensurePluginRegistered() {
  if (pluginRegistered) return;
  Babel.registerPlugin("artifactImportRewriter", importRewriter);
  pluginRegistered = true;
}

/**
 * Install window._artifactGet — the runtime helper that user code calls.
 * Throws a readable error when a user imports something not in the registry.
 */
export function installGetter(): void {
  const w = window as unknown as BabelAny;
  if (w[GET_FN]) return;
  w[GET_FN] = (name: string): unknown => {
    const registry = w[MODULES_KEY];
    if (!registry?.[name]) {
      const supported = Array.from(knownModules).sort().join(", ");
      throw new Error(
        `Module '${name}' is not available in the Artifact plugin.\n\n` +
          `Supported modules: ${supported}\n\n` +
          `For other libraries, use an esm.sh URL directly: ` +
          `import foo from "https://esm.sh/foo"`
      );
    }
    return registry[name];
  };
}

export function uninstallGetter(): void {
  const w = window as unknown as BabelAny;
  delete w[GET_FN];
}

/**
 * Transpile artifact source code into an executable JS module string.
 * Throws on syntax errors with Babel's (usually useful) error messages.
 */
export function transpile(code: string): string {
  ensurePluginRegistered();

  // Pass 1: react preset (automatic runtime) + typescript preset.
  // This strips TypeScript, converts JSX to _jsx calls, and inserts
  // `import { jsx } from 'react/jsx-runtime'` at the top of the module.
  const pass1 = Babel.transform(code, {
    sourceType: "module",
    presets: [
      [b.availablePresets.react, { runtime: "automatic" }],
      [
        b.availablePresets.typescript,
        { onlyRemoveTypeImports: true, allExtensions: true, isTSX: true },
      ],
    ],
  }).code;

  if (!pass1) {
    throw new Error("Babel pass 1 returned no code");
  }

  // Pass 2: importRewriter only. Sees all imports including jsx-runtime.
  const pass2 = Babel.transform(pass1, {
    sourceType: "module",
    plugins: [b.availablePlugins.artifactImportRewriter],
  }).code;

  if (!pass2) {
    throw new Error("Babel pass 2 returned no code");
  }

  return pass2;
}

/**
 * Dynamically import a compiled artifact module. Returns the module namespace,
 * from which the caller typically reads `.default` (the artifact component).
 *
 * Uses a data URL so we don't leak blob URLs and so sourcemaps are embedded.
 * A cache-buster comment ensures every call returns a fresh module, which
 * matters when the user edits their artifact and we re-transpile.
 */
export async function importModule(compiledJs: string): Promise<Record<string, unknown>> {
  const withBuster = `// cache-bust: ${Math.random()}\n${compiledJs}`;
  const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(withBuster)}`;
  return (await import(/* @vite-ignore */ dataUrl)) as Record<string, unknown>;
}
