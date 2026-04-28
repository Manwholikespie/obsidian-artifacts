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
import type { NodePath, PluginObj } from "@babel/core";
import type * as BabelTypes from "@babel/types";
import { MODULES_KEY, knownModules } from "./modules";

const t = Babel.packages.types;

const GET_FN = "_artifactGet";

interface ArtifactWindow extends Window {
  [GET_FN]?: (name: string) => unknown;
  [MODULES_KEY]?: Record<string, unknown>;
}

function getArtifactWindow(): ArtifactWindow {
  return window as ArtifactWindow;
}

function getModuleCall(source: string): BabelTypes.CallExpression {
  return t.callExpression(t.memberExpression(t.identifier("window"), t.identifier(GET_FN)), [
    t.stringLiteral(source),
  ]);
}

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
function importRewriter(): PluginObj {
  return {
    visitor: {
      ImportDeclaration(path: NodePath<BabelTypes.ImportDeclaration>) {
        const source: string = path.node.source.value;
        if (
          source.startsWith(".") ||
          source.startsWith("/") ||
          source.startsWith("http://") ||
          source.startsWith("https://")
        ) {
          return;
        }

        const specifiers = path.node.specifiers;

        // Namespace import: `import * as Foo from 'bar'`
        const nsSpec = specifiers.find((s) => t.isImportNamespaceSpecifier(s));
        if (nsSpec) {
          path.replaceWith(
            t.variableDeclaration("const", [
              t.variableDeclarator(t.identifier(nsSpec.local.name), getModuleCall(source)),
            ])
          );
          return;
        }

        // Named + default imports: destructure out of the module object
        const properties = specifiers.flatMap((spec): BabelTypes.ObjectProperty[] => {
          if (t.isImportDefaultSpecifier(spec)) {
            return [
              t.objectProperty(
                t.identifier("default"),
                t.identifier(spec.local.name),
                false,
                false
              ),
            ];
          }
          if (t.isImportSpecifier(spec)) {
            const importedKey = t.isIdentifier(spec.imported)
              ? t.identifier(spec.imported.name)
              : t.stringLiteral(spec.imported.value);
            const importedName =
              spec.imported.type === "Identifier" ? spec.imported.name : spec.imported.value;
            const localName = spec.local.name;
            const shorthand = t.isIdentifier(spec.imported) && importedName === localName;
            return [t.objectProperty(importedKey, t.identifier(localName), false, shorthand)];
          }
          return [];
        });

        path.replaceWith(
          t.variableDeclaration("const", [
            t.variableDeclarator(t.objectPattern(properties), getModuleCall(source)),
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
  const w = getArtifactWindow();
  if (w[GET_FN]) return;
  w[GET_FN] = (name: string): unknown => {
    const registry = w[MODULES_KEY];
    if (!registry || !(name in registry)) {
      const supported = Array.from(knownModules).sort().join(", ");
      throw new Error(
        `Module '${name}' is not available in the Artifacts plugin.\n\n` +
          `Supported modules: ${supported}\n\n` +
          `For other libraries, use an esm.sh URL directly: ` +
          `import foo from "https://esm.sh/foo"`
      );
    }
    return registry[name];
  };
}

export function uninstallGetter(): void {
  const w = getArtifactWindow();
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
      [Babel.availablePresets.react, { runtime: "automatic" }],
      [
        Babel.availablePresets.typescript,
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
    plugins: [Babel.availablePlugins.artifactImportRewriter],
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
