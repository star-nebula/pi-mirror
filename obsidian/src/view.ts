import { ItemView, Notice, setIcon, type WorkspaceLeaf } from "obsidian";
import { isReadyMessage } from "./protocol";

export const VIEW_TYPE = "pi-mirror-workbench";

/** What the pane needs from the plugin; keeps the view free of lifecycle logic. */
export interface WorkbenchHost {
  ensureServer(options?: { force?: boolean }): Promise<string>;
  reindex(): Promise<void>;
  openSettings(): void;
}

type PanelKind = "loading" | "error" | "slow";

interface PanelAction {
  label: string;
  run: () => void;
  cta?: boolean;
}

/**
 * The workbench is the real web app in an iframe. Everything it shows — runs,
 * citations, proposals — comes from the local server, so the pane never drifts
 * from what `npm run serve` shows in a browser.
 *
 * The app posts `pi-mirror:ready` once it has booted. Without that signal a
 * blocked or broken frame looks identical to a slow one, so a watchdog turns
 * it into a panel that says what to try instead of leaving a blank leaf.
 */
export class PiMirrorView extends ItemView {
  private frame: HTMLIFrameElement | null = null;
  private panel: HTMLElement | null = null;
  private currentUrl: string | null = null;
  private connecting = false;
  private ready = false;
  private watchdog: number | null = null;

  private readonly onMessage = (event: MessageEvent): void => {
    if (!isReadyMessage(event.data, event.origin, this.currentUrl)) return;
    this.markReady();
  };

  constructor(leaf: WorkspaceLeaf, private readonly host: WorkbenchHost) {
    super(leaf);
  }

  override getViewType(): string {
    return VIEW_TYPE;
  }

  override getDisplayText(): string {
    return "Pi-Mirror";
  }

  override getIcon(): string {
    return "sparkles";
  }

  override async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("pi-mirror-host");
    window.addEventListener("message", this.onMessage);

    this.addAction("refresh-cw", "Reload the workbench", () => void this.connect(true));
    this.addAction("rotate-ccw", "Reindex this vault", () => void this.host.reindex());
    this.addAction("external-link", "Open in your browser", () => this.openExternal());
    this.addAction("settings", "Pi-Mirror settings", () => this.host.openSettings());

    await this.connect(false);
  }

  override async onClose(): Promise<void> {
    window.removeEventListener("message", this.onMessage);
    this.dropFrame();
  }

  /**
   * `force` restarts the server and remounts; without it the pane just reloads
   * the app so it re-reads state (used after reindexing).
   */
  async refresh(force = true): Promise<void> {
    if (!force && this.frame && this.currentUrl) {
      this.ready = false;
      this.frame.src = this.currentUrl;
      this.armWatchdog(15_000);
      return;
    }
    await this.connect(force);
  }

  private async connect(force: boolean): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      this.ready = false;
      this.clearWatchdog();
      if (force) this.dropFrame();

      this.showPanel(
        "loading",
        "Starting the local agent",
        "First open indexes this vault, which can take a minute.",
        [],
      );
      const url = await this.host.ensureServer({ force });
      this.mountFrame(url);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    } finally {
      this.connecting = false;
    }
  }

  private mountFrame(url: string): void {
    if (this.frame && this.currentUrl === url) {
      // Same process, fresh document.
      this.ready = false;
      this.frame.src = url;
      this.armWatchdog(15_000);
      return;
    }

    this.dropFrame();
    this.showPanel("loading", "Loading the workbench", "The local agent is up; the pane is connecting to it.", []);

    const frame = document.createElement("iframe");
    frame.className = "pi-mirror-frame";
    frame.src = url;
    frame.setAttribute("title", "Pi-Mirror workbench");
    frame.setAttribute("allow", "clipboard-read; clipboard-write");
    frame.addEventListener("load", () => this.armWatchdog(15_000));
    this.contentEl.appendChild(frame);

    this.frame = frame;
    this.currentUrl = url;
    // If the document never even loads (blocked before navigation), the load
    // event never fires; this longer net still produces a readable panel.
    this.armWatchdog(45_000);
  }

  private markReady(): void {
    this.ready = true;
    this.clearWatchdog();
    this.clearPanel();
  }

  private armWatchdog(ms: number): void {
    this.clearWatchdog();
    this.watchdog = window.setTimeout(() => {
      this.watchdog = null;
      if (this.ready) return;
      this.showSlowPanel();
    }, ms);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) {
      window.clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  private dropFrame(): void {
    this.clearWatchdog();
    this.frame?.remove();
    this.frame = null;
    this.clearPanel();
    this.currentUrl = null;
    this.ready = false;
  }

  // ------------------------------------------------------------------ panels

  private clearPanel(): void {
    this.panel?.remove();
    this.panel = null;
  }

  private showPanel(kind: PanelKind, title: string, detail: string, actions: PanelAction[]): void {
    this.clearPanel();
    const box = document.createElement("div");
    box.className = `pi-mirror-status is-${kind}`;

    const glyph = document.createElement("div");
    glyph.className = "pi-mirror-spinner";
    setIcon(glyph, kind === "error" ? "alert-triangle" : kind === "slow" ? "help-circle" : "loader");
    box.appendChild(glyph);

    const heading = document.createElement("h3");
    heading.textContent = title;
    box.appendChild(heading);

    const copy = document.createElement("p");
    copy.textContent = detail;
    box.appendChild(copy);

    if (actions.length > 0) {
      const row = document.createElement("div");
      row.className = "pi-mirror-actions";
      for (const action of actions) {
        const button = document.createElement("button");
        button.className = action.cta ? "pi-mirror-button mod-cta" : "pi-mirror-button";
        button.textContent = action.label;
        button.addEventListener("click", action.run);
        row.appendChild(button);
      }
      box.appendChild(row);
    }

    this.contentEl.appendChild(box);
    this.panel = box;
  }

  private showError(message: string): void {
    this.showPanel(
      "error",
      "The local agent did not start",
      "Check the server folder and Node path in settings, then try again.",
      [
        { label: "Try again", run: () => void this.connect(true), cta: true },
        { label: "Open settings", run: () => this.host.openSettings() },
      ],
    );
    const box = this.panel;
    if (!box) return;
    const log = document.createElement("pre");
    log.className = "pi-mirror-log";
    log.textContent = message;
    box.appendChild(log);
  }

  private showSlowPanel(): void {
    this.showPanel(
      "slow",
      "The pane is not rendering the workbench",
      "The local agent is running, but the app inside this pane never reported ready. " +
        "Obsidian may have blocked the frame, or this checkout serves an older web build.",
      [
        { label: "Open in browser", run: () => this.openExternal() },
        { label: "Try again", run: () => void this.connect(true), cta: true },
        { label: "Show the frame anyway", run: () => this.clearPanel() },
      ],
    );
  }

  private openExternal(): void {
    const url = this.currentUrl;
    if (!url) {
      new Notice("Pi-Mirror is not running yet.");
      return;
    }
    openExternalUrl(url);
  }
}

/** Obsidian desktop exposes Electron's shell; fall back to a plain tab. */
export function openExternalUrl(url: string): void {
  try {
    const electron = (window as unknown as { require?: (id: string) => unknown }).require?.("electron") as
      | { shell?: { openExternal?: (target: string) => Promise<void> } }
      | undefined;
    if (electron?.shell?.openExternal) {
      void electron.shell.openExternal(url);
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(url, "_blank", "noopener");
}
