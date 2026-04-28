import { Plugin, type WorkspaceLeaf } from "obsidian";
import { installGetter, uninstallGetter } from "./bundler";
import { registerInlineProcessor } from "./inline-processor";
import { installModuleRegistry, uninstallModuleRegistry } from "./modules";
import { ArtifactView, type ArtifactViewState, VIEW_TYPE_ARTIFACT } from "./pane-view";
import { type ArtifactPluginSettings, ArtifactSettingTab, DEFAULT_SETTINGS } from "./settings";
import { destroyTwind, installTwind } from "./twind-setup";

export default class ArtifactPlugin extends Plugin {
  settings!: ArtifactPluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Install the shared module registry + the runtime getter.
    // These live on `window` so user code can reach them via the
    // rewritten imports that Babel emits.
    installModuleRegistry();
    installGetter();

    // Install Twind's global runtime Tailwind processor.
    installTwind();

    // Register the code block processor for ```artifact blocks.
    registerInlineProcessor(this);

    // Register the right-pane ItemView for expanded artifacts.
    this.registerView(VIEW_TYPE_ARTIFACT, (leaf: WorkspaceLeaf) => new ArtifactView(leaf));

    this.addSettingTab(new ArtifactSettingTab(this.app, this));
  }

  onunload(): void {
    uninstallGetter();
    uninstallModuleRegistry();
    destroyTwind();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<ArtifactPluginSettings> | null
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Open an artifact in the right-side pane. Behavior:
   *   - If an artifact view already exists anywhere in the workspace,
   *     reuse it: replace its state with the new artifact and reveal it.
   *     This matches Claude Desktop's single-pane behavior — opening a
   *     second artifact replaces the first rather than stacking tabs.
   *   - Otherwise, create a new right-side leaf and mount the view there.
   *
   * No artifact leaf is created at plugin load, so the sidebar has zero
   * footprint until the user explicitly opens something.
   */
  async openInPane(state: ArtifactViewState): Promise<void> {
    const { workspace } = this.app;

    const existing = workspace.getLeavesOfType(VIEW_TYPE_ARTIFACT);
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      // Reuse the first (and typically only) artifact leaf. If the
      // user has manually cloned it, the extras stay where they are.
      leaf = existing[0];
    } else {
      const newLeaf = workspace.getRightLeaf(false);
      if (!newLeaf) {
        // Fall back to a vertical split if the right sidebar isn't
        // available (e.g. the user has closed the right sidebar).
        leaf = workspace.getLeaf("split", "vertical");
      } else {
        leaf = newLeaf;
      }
    }

    await leaf.setViewState({
      type: VIEW_TYPE_ARTIFACT,
      active: true,
      state: state as unknown as Record<string, unknown>,
    });
    await workspace.revealLeaf(leaf);
  }
}
