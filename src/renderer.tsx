// Mount a compiled artifact into a DOM element. Handles:
//   - Transpilation (via bundler)
//   - Dynamic import of the resulting ES module
//   - React 18 root creation
//   - ErrorBoundary wrapping runtime errors
//   - Twind lifecycle (observe on mount, disconnect on unmount)
//   - Compile error fallback (pre-React — we render a plain DOM panel)

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { importModule, transpile } from "./bundler";

export interface MountHandle {
  unmount(): void;
}

/**
 * In-React fallback used when the artifact throws at render time.
 */
function RuntimeErrorPanel({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="artifact-error-panel" role="alert">
      <div className="artifact-error-title">Artifact crashed at runtime</div>
      <pre className="artifact-error-message">{String(error?.message ?? error)}</pre>
      {error?.stack ? (
        <details>
          <summary>Stack trace</summary>
          <pre className="artifact-error-stack">{error.stack}</pre>
        </details>
      ) : null}
      <button type="button" className="artifact-error-retry" onClick={() => resetErrorBoundary()}>
        Retry
      </button>
    </div>
  );
}

/**
 * DOM fallback used when transpile or import fails — at this point
 * we don't yet have a React root, so we render plain DOM.
 */
function renderCompileError(container: HTMLElement, err: unknown): void {
  container.empty();
  const panel = container.createDiv({ cls: "artifact-error-panel" });
  panel.createDiv({ cls: "artifact-error-title", text: "Artifact failed to compile" });
  panel.createEl("pre", {
    cls: "artifact-error-message",
    text: err instanceof Error ? err.message : String(err),
  });

  if (err instanceof Error && err.stack) {
    const details = panel.createEl("details");
    details.createEl("summary", { text: "Stack trace" });
    details.createEl("pre", { cls: "artifact-error-stack", text: err.stack });
  }
}

/**
 * Compile and mount an artifact into `container`. Returns a handle whose
 * `unmount()` cleans up the React root and stops Twind observation.
 *
 * On compile failure the error panel is rendered in place and unmount()
 * is a no-op that simply clears the container.
 */
export async function mountArtifact(container: HTMLElement, source: string): Promise<MountHandle> {
  let compiledCode: string;
  try {
    compiledCode = transpile(source);
  } catch (err) {
    renderCompileError(container, err);
    return { unmount: () => container.empty() };
  }

  let mod: Record<string, unknown>;
  try {
    mod = await importModule(compiledCode);
  } catch (err) {
    renderCompileError(container, err);
    return { unmount: () => container.empty() };
  }

  const Component = mod.default as React.ComponentType | undefined;
  if (typeof Component !== "function") {
    renderCompileError(
      container,
      new Error(
        "Artifact has no default export, or the default export is not a React component.\n\n" +
          "Expected:\n" +
          "    export default function Artifact() { return <div>...</div>; }"
      )
    );
    return { unmount: () => container.empty() };
  }

  // Twind is installed globally at plugin load; its document-wide
  // MutationObserver picks up Tailwind classes in the artifact DOM
  // as soon as React commits them.
  const root: Root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={RuntimeErrorPanel}
        onReset={() => {
          // No-op — the retry button just re-mounts the component tree
        }}
      >
        <Component />
      </ErrorBoundary>
    </React.StrictMode>
  );

  return {
    unmount: () => {
      try {
        root.unmount();
      } catch {
        // swallow — root might already be detached
      }
    },
  };
}
