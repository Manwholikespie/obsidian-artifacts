import { type App, PluginSettingTab, Setting } from "obsidian";
import type ArtifactPlugin from "./main";

export interface ArtifactPluginSettings {
  defaultHeight: number;
}

export const DEFAULT_SETTINGS: ArtifactPluginSettings = {
  defaultHeight: 400,
};

export class ArtifactSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ArtifactPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Default inline height")
      .setDesc(
        "Maximum height (in pixels) for inline artifacts that don't specify their own. " +
          "Artifacts taller than this will scroll inside the container."
      )
      .addText((text) =>
        text
          .setPlaceholder("400")
          .setValue(String(this.plugin.settings.defaultHeight))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!Number.isNaN(n) && n > 0) {
              this.plugin.settings.defaultHeight = n;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
