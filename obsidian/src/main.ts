import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { FileSystemAdapter, Notice, Platform, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, PiMirrorSettingTab, type PiMirrorSettings } from "./settings";
import { ServerProcess, checkServerLayout, describeIndex, runIndex, type ServerConfig } from "./server";
import { openExternalUrl, PiMirrorView, VIEW_TYPE, type WorkbenchHost } from "./view";

type AgentState = "idle" | "starting" | "indexing" | "running" | "error";

const STATE_LABEL: Record<AgentState, string> = {
  idle: "stopped",
  starting: "starting…",
  indexing: "indexing…",
  running: "running",
  error: "stopped with an error",
};

export default class PiMirrorPlugin extends Plugin implements WorkbenchHost {
  override settings: PiMirrorSettings = { ...DEFAULT_SETTINGS };

  private server: ServerProcess | null = null;
  private connecting: Promise<string> | null = null;
  private statusBar: HTMLElement | null = null;
  private state: AgentState = "idle";

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new PiMirrorSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new PiMirrorView(leaf, this));

    this.addRibbonIcon("sparkles", "Pi-Mirror workbench", () => void this.activateView());

    this.addCommand({
      id: "open-workbench",
      name: "Open the workbench",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "restart-agent",
      name: "Restart the local agent",
      callback: () => void this.restartServer(),
    });
    this.addCommand({
      id: "reindex-vault",
      name: "Reindex this vault",
      callback: () => void this.reindex(),
    });
    this.addCommand({
      id: "stop-agent",
      name: "Stop the local agent",
      callback: () => void this.stopServer(),
    });
    this.addCommand({
      id: "open-in-browser",
      name: "Open the workbench in your browser",
      callback: () => this.openInBrowser(),
    });

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("pi-mirror-statusbar");
    this.statusBar.setAttribute("aria-label", "Open the Pi-Mirror workbench");
    this.statusBar.setAttribute("title", "Open the Pi-Mirror workbench");
    this.statusBar.addEventListener("click", () => void this.activateView());
    this.updateStatus("idle");

    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.openOnStartup || !Platform.isDesktopApp) return;
      void this.activateView();
    });
  }

  override onunload(): void {
    // Obsidian disables plugins without awaiting, so make sure the child dies
    // even though we cannot await the shutdown here.
    void this.stopServer();
  }

  // ---------------------------------------------------------------- settings

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<PiMirrorSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  describeServer(): string {
    if (this.server?.url) return `Running at ${this.server.url} (${STATE_LABEL[this.state]}).`;
    if (this.connecting) return "Starting the local agent…";
    return "Not running. Open the workbench, or press Restart.";
  }

  updateStatus(state: AgentState): void {
    this.state = state;
    if (!this.statusBar) return;
    const port = this.server?.url ? new URL(this.server.url).port : null;
    this.statusBar.setText(
      state === "running" && port ? `Pi-Mirror · :${port}` : `Pi-Mirror · ${STATE_LABEL[state]}`,
    );
    this.statusBar.setAttribute("data-state", state);
  }

  // ------------------------------------------------------------------ server

  async ensureServer(options: { force?: boolean } = {}): Promise<string> {
    if (options.force && this.server) await this.stopServer();
    if (this.server?.url) return this.server.url;
    if (this.connecting) return this.connecting;

    this.connecting = this.startServer();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async startServer(): Promise<string> {
    const config = this.buildConfig();

    if (this.settings.indexOnOpen && !existsSync(config.dbPath)) {
      this.updateStatus("indexing");
      new Notice("Pi-Mirror: indexing this vault for the first time…", 8000);
      try {
        const result = await runIndex(config);
        new Notice(`Pi-Mirror: ${describeIndex(result.stdout)}.`);
      } catch (error) {
        new Notice(`Pi-Mirror: indexing failed — ${message(error)}. Starting with an empty index.`, 12000);
      }
    }

    this.updateStatus("starting");
    const server = new ServerProcess(config);
    this.server = server;
    server.onExit = (info) => {
      if (this.server === server) this.server = null;
      this.updateStatus(info.expected ? "idle" : "error");
      if (!info.expected) {
        new Notice("Pi-Mirror: the local agent stopped unexpectedly. Open the workbench pane for details.", 10000);
      }
    };

    try {
      const url = await server.start();
      this.updateStatus("running");
      return url;
    } catch (error) {
      if (this.server === server) this.server = null;
      this.updateStatus("error");
      throw error;
    }
  }

  async stopServer(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) await server.stop();
    this.updateStatus("idle");
  }

  async restartServer(): Promise<void> {
    await this.stopServer();
    try {
      await this.ensureServer();
      new Notice("Pi-Mirror: restarted.");
    } catch (error) {
      new Notice(`Pi-Mirror: restart failed — ${message(error)}`, 12000);
    }
    await this.refreshViews(false);
  }

  async reindex(): Promise<void> {
    let config: ServerConfig;
    try {
      config = this.buildConfig();
    } catch (error) {
      new Notice(`Pi-Mirror: ${message(error)}`, 12000);
      return;
    }

    const wasRunning = Boolean(this.server);
    if (wasRunning) await this.stopServer();
    this.updateStatus("indexing");
    try {
      const result = await runIndex(config);
      new Notice(`Pi-Mirror: ${describeIndex(result.stdout)}.`);
    } catch (error) {
      new Notice(`Pi-Mirror: indexing failed — ${message(error)}`, 12000);
    } finally {
      this.updateStatus("idle");
    }
    if (wasRunning) {
      try {
        await this.ensureServer();
      } catch {
        /* the pane will report it */
      }
    }
    await this.refreshViews(false);
  }

  // ------------------------------------------------------------------- views

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE)[0];
    let leaf = existing ?? null;
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }

  async refreshViews(force: boolean): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof PiMirrorView) await view.refresh(force);
    }
  }

  openSettings(): void {
    const app = this.app as unknown as {
      setting?: { open(): void; openTabById(id: string): void };
    };
    app.setting?.open();
    app.setting?.openTabById(this.manifest.id);
  }

  openInBrowser(): void {
    const url = this.server?.url;
    if (!url) {
      new Notice("Pi-Mirror: start the workbench first.");
      return;
    }
    openExternalUrl(url);
  }

  // ------------------------------------------------------------------ config

  private vaultRoot(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Pi-Mirror needs the desktop app: this vault has no filesystem root.");
    }
    return adapter.getBasePath();
  }

  private pluginDir(): string {
    return this.manifest.dir ?? resolve(this.vaultRoot(), ".obsidian", "plugins", this.manifest.id);
  }

  /** Cheap state for the browser check: does a usable checkout exist? */
  private resolveCheckout(): string {
    const configured = this.settings.serverDir.trim();
    const candidates = [configured, process.env.PI_MIRROR_HOME ?? "", resolve(homedir(), "pi-mirror")];

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (checkServerLayout(candidate).ok) return resolve(candidate);
    }

    if (configured) {
      const problems = checkServerLayout(configured).problems;
      throw new Error(`The Pi-Mirror checkout at ${configured} is not ready:\n${problems.join("\n")}`);
    }
    throw new Error(
      'No Pi-Mirror checkout configured.\n\nOpen Settings → Pi-Mirror and set "Server folder" to the checkout ' +
        'that contains dist/ and web/. If it is a fresh clone, run "npm install" and "npm run build" there once.',
    );
  }

  private buildConfig(): ServerConfig {
    return {
      serverDir: this.resolveCheckout(),
      vaultRoot: this.vaultRoot(),
      dbPath: resolve(this.pluginDir(), "pi-mirror.db"),
      nodePath: this.settings.nodePath,
      port: this.settings.port,
    };
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
