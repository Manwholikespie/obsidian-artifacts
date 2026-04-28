// Right-pane ItemView that renders an artifact at full size.
//
// Opened by clicking the expand button on an inline artifact or by
// clicking a preview-mode card. The view persists its state (source +
// metadata) via setState/getState so Obsidian can restore it after a
// reload, which we want for workspace persistence.

import { ItemView, type ViewStateResult } from "obsidian";
import type { ArtifactMetadata } from "./inline-processor";
import { type MountHandle, mountArtifact } from "./renderer";

export const VIEW_TYPE_ARTIFACT = "artifact-view";

export interface ArtifactViewState {
  source: string;
  metadata: ArtifactMetadata;
  sourcePath: string;
}

function isArtifactViewState(value: unknown): value is ArtifactViewState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.source === "string" &&
    typeof v.sourcePath === "string" &&
    typeof v.metadata === "object" &&
    v.metadata !== null
  );
}

export class ArtifactView extends ItemView {
  private state: ArtifactViewState | null = null;
  private handle: MountHandle | null = null;
  private mountEl: HTMLElement | null = null;

  getViewType(): string {
    return VIEW_TYPE_ARTIFACT;
  }

  getDisplayText(): string {
    // Always "Artifacts" — the sidebar tab represents the pane identity
    // (matching the plugin name), not the specific artifact loaded into
    // it. The current artifact's title is shown in the pane header
    // inside the view body.
    return "Artifacts";
  }

  getIcon(): string {
    return "shapes";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("artifact-pane");

    const header = container.createDiv({ cls: "artifact-pane-header" });
    header.createSpan({
      cls: "artifact-pane-title",
      text: this.state?.metadata.title ?? "Artifact",
    });

    this.mountEl = container.createDiv({ cls: "artifact-pane-body" });

    if (this.state) {
      await this.remount();
    }
  }

  onClose(): Promise<void> {
    this.handle?.unmount();
    this.handle = null;
    this.mountEl = null;
    return Promise.resolve();
  }

  // Obsidian calls this with the persisted state on workspace restore,
  // and we call it ourselves when opening the view from the inline
  // expand button via leaf.setViewState.
  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    if (isArtifactViewState(state)) {
      this.state = state;

      // Update the pane header / tab title
      const titleEl = this.containerEl.querySelector(".artifact-pane-title");
      if (titleEl) titleEl.textContent = state.metadata.title;

      if (this.mountEl) {
        await this.remount();
      }
    }
    return super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    const base = super.getState();
    if (this.state) {
      return { ...base, ...this.state };
    }
    return base;
  }

  private async remount(): Promise<void> {
    if (!this.mountEl || !this.state) return;
    this.handle?.unmount();
    this.mountEl.empty();
    this.handle = await mountArtifact(this.mountEl, this.state.source);
  }
}
