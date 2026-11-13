import { App, PluginSettingTab, Setting } from "obsidian";
import type PiMirrorPlugin from "./main";
import { checkServerLayout } from "./server";

export interface PiMirrorSettings {
  /** Checkout that contains `dist/` and `web/`. Empty until the user sets it. */
  serverDir: string;
  nodePath: string;
  port: number;
  /** Index the vault the first time the pane opens (DB missing). */
  indexOnOpen: boolean;
  /** Open the workbench pane when Obsidian starts. */
  openOnStartup: boolean;
}

export const DEFAULT_SETTINGS: PiMirrorSettings = {
  serverDir: "",
  nodePath: "node",
  port: 4317,
  indexOnOpen: true,
  openOnStartup: true,
};

export class PiMirrorSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: PiMirrorPlugin) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      cls: "pi-mirror-settings-intro",
      text:
        "Pi-Mirror runs a local agent over this vault. The pane hosts the workspace server that ships with " +
        "the pi-mirror checkout, so the same code serves the browser and Obsidian.",
    });

    new Setting(containerEl)
      .setName("Open the workbench")
      .setDesc("Opens the workbench pane in this vault. The same entry sits on the ribbon and in the status bar.")
      .addButton((button) =>
        button
          .setButtonText("Open")
          .setCta()
          .onClick(() => this.plugin.activateView()),
      );

    new Setting(containerEl)
      .setName("Server folder")
      .setDesc("Path to the pi-mirror checkout: the folder containing dist/ and web/.")
      .addText((text) => {
        text
          .setPlaceholder("E:/Projects/personal/pi-mirror")
          .setValue(this.plugin.settings.serverDir)
          .onChange(async (value) => {
            this.plugin.settings.serverDir = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.addClass("pi-mirror-wide-input");
        text.inputEl.addEventListener("blur", () => this.display());
      });

    const layout = checkServerLayout(this.plugin.settings.serverDir);
    containerEl.createEl("p", {
      cls: layout.ok ? "pi-mirror-hint is-ok" : "pi-mirror-hint is-bad",
      text: layout.ok ? "Server found and built." : layout.problems.join(" · "),
    });

    new Setting(containerEl)
      .setName("Node executable")
      .setDesc('Used to start the server. "node" resolves from PATH; use an absolute path if Obsidian cannot find it.')
      .addText((text) =>
        text
          .setPlaceholder("node")
          .setValue(this.plugin.settings.nodePath)
          .onChange(async (value) => {
            this.plugin.settings.nodePath = value.trim() || "node";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Port")
      .setDesc("Preferred port on 127.0.0.1. If it is taken, the server picks the next free one.")
      .addText((text) => {
        text.inputEl.type = "number";
        text
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const port = Number.parseInt(value, 10);
            if (Number.isFinite(port) && port > 0 && port < 65_536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Index the vault on first open")
      .setDesc("Builds the note index once, so ask and draft can cite your notes. Reindex any time from this tab.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.indexOnOpen).onChange(async (value) => {
          this.plugin.settings.indexOnOpen = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Open on startup")
      .setDesc("Opens the workbench pane when Obsidian starts, so the agent is where you already work.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (value) => {
          this.plugin.settings.openOnStartup = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Agent").setHeading();

    const status = this.plugin.describeServer();
    containerEl.createEl("p", { cls: "pi-mirror-hint", text: status });

    new Setting(containerEl)
      .setName("Controls")
      .setDesc("Restarting picks up a rebuilt checkout. Reindexing keeps existing drafts.")
      .addButton((button) =>
        button.setButtonText("Restart").onClick(async () => {
          await this.plugin.restartServer();
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Reindex vault").onClick(async () => {
          button.setDisabled(true);
          await this.plugin.reindex();
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText("Open in browser").onClick(() => this.plugin.openInBrowser()),
      );

    containerEl.createEl("p", {
      cls: "pi-mirror-hint",
      text:
        "The agent reads Knowledge, Output and Projects. It never edits a note directly: drafts come back as " +
        "proposals that you apply, and publishing needs its own consent.",
    });
  }
}
