// Reading-mode code block processor for ```artifact blocks.
//
// The processor creates the chrome (header + expand button), parses the
// info-string metadata, and hands off to the renderer for the actual
// React mount. For `mode="preview"` blocks it skips the mount entirely
// and renders a compact card that opens the pane on click.

import { type MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type ArtifactPlugin from "./main";
import { type MountHandle, mountArtifact } from "./renderer";

export interface ArtifactMetadata {
  title: string;
  height: number;
  mode: "inline" | "preview";
  id: string | null;
}

const DEFAULT_HEIGHT = 400;

/**
 * Parse an info-string like `title="Dot product" height="380" mode="preview"`.
 * Values may be double-quoted, single-quoted, or bare. Unknown keys are
 * ignored, not rejected — this keeps the format forgiving as it evolves.
 */
export function parseInfoString(infoString: string): Partial<ArtifactMetadata> {
  const out: Partial<ArtifactMetadata> = {};
  const pattern = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(infoString)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    switch (key) {
      case "title":
        out.title = value;
        break;
      case "height": {
        const n = parseInt(value, 10);
        if (!Number.isNaN(n) && n > 0) out.height = n;
        break;
      }
      case "mode":
        if (value === "inline" || value === "preview") out.mode = value;
        break;
      case "id":
        out.id = value;
        break;
    }
  }
  return out;
}

/**
 * Read the original ```artifact info-string out of the source document.
 * Obsidian's code-block processor API only gives us the contents of the
 * fence, not the info-string, so we look up the original markdown via
 * ctx.getSectionInfo.
 */
function readInfoString(el: HTMLElement, ctx: MarkdownPostProcessorContext): string {
  const info = ctx.getSectionInfo(el);
  if (!info) return "";
  const lines = info.text.split("\n");
  const openingLine = lines[info.lineStart] ?? "";
  const match = openingLine.match(/^```+\s*artifact\b\s*(.*)$/);
  return match ? match[1].trim() : "";
}

function withDefaults(meta: Partial<ArtifactMetadata>): ArtifactMetadata {
  return {
    title: meta.title ?? "Artifact",
    height: meta.height ?? DEFAULT_HEIGHT,
    mode: meta.mode ?? "inline",
    id: meta.id ?? null,
  };
}

/**
 * MarkdownRenderChild wrapping a mounted artifact so that Obsidian can
 * properly tear it down when the block is removed (view change, edit, etc.).
 */
class ArtifactRenderChild extends MarkdownRenderChild {
  private handle: MountHandle | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly mountTarget: HTMLElement
  ) {
    super(containerEl);
  }

  async onload() {
    try {
      this.handle = await mountArtifact(this.mountTarget, this.source);
    } catch (err) {
      console.error("[artifact] mount failed", err);
    }
  }

  onunload() {
    this.handle?.unmount();
    this.handle = null;
  }
}

/**
 * Registers the ```artifact code block processor on the plugin.
 */
export function registerInlineProcessor(plugin: ArtifactPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("artifact", (source, el, ctx) => {
    const infoString = readInfoString(el, ctx);
    const meta = withDefaults(parseInfoString(infoString));

    const block = el.createDiv({ cls: "artifact-block" });
    block.setAttribute("data-mode", meta.mode);

    const header = block.createDiv({ cls: "artifact-header" });
    header.createSpan({ cls: "artifact-title", text: meta.title });

    const expandBtn = header.createEl("button", {
      cls: "artifact-expand",
      attr: {
        type: "button",
        title: "Open in side pane",
        "aria-label": "Open in side pane",
      },
    });
    expandBtn.textContent = "⤢";
    expandBtn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      plugin.openInPane({
        source,
        metadata: meta,
        sourcePath: ctx.sourcePath,
      });
    });

    if (meta.mode === "preview") {
      // Compact card — no React mount. Click to expand.
      block.addClass("artifact-preview-mode");
      const body = block.createDiv({ cls: "artifact-preview-body" });
      body.createSpan({
        cls: "artifact-preview-hint",
        text: "Click to open in side pane",
      });
      block.addEventListener("click", () => {
        plugin.openInPane({
          source,
          metadata: meta,
          sourcePath: ctx.sourcePath,
        });
      });
      return;
    }

    // Inline mode — mount the React component inside a bounded body.
    const body = block.createDiv({ cls: "artifact-body" });
    body.style.setProperty("--artifact-max-height", `${meta.height}px`);

    const child = new ArtifactRenderChild(block, source, body);
    ctx.addChild(child);
  });
}
