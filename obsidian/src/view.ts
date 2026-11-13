import { ItemView, Notice, setIcon, type WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE = "pi-mirror-workbench";

/** What the pane needs from the plugin; keeps the view free of lifecycle logic. */
export interface WorkbenchHost {
  ensureServer(options?: { force?: boolean }): Promise<string>;
  reindex(): Promise<void>;
  openSettings(): void;
}

type StatusKind = "starting" | "error";

/**
 * The workbench is the real web app in an iframe. Everything it shows — runs,
 * citations, proposals — comes from the local server, so the pane never drifts
 * from what `npm run serve` shows in a browser.
 */
export class PiMirrorView extends ItemView {
  private frame: HTMLIFrameElement | null = null;
  private status: HTMLElement | null = null;
  private currentUrl: string | null = null;
  private connecting = false;

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

    this.addAction("refresh-cw", "Reload the workbench", () => void this.connect(true));
    this.addAction("rotate-ccw", "Reindex this vault", () => void this.host.reindex());
    this.addAction("external-link", "Open in your browser", () => this.openExternal());
    this.addAction("settings", "Pi-Mirror settings", () => this.host.openSettings());

    await this.connect(false);
  }

  override async onClose(): Promise<void> {
    this.frame?.remove();
    this.frame = null;
    this.status?.remove();
    this.status = null;
    this.currentUrl = null;
  }

  /**
   * `force` restarts the server and remounts; without it the pane just reloads
   * the app so it re-reads state (used after reindexing).
   */
  async refresh(force = true): Promise<void> {
    if (!force && this.frame && this.currentUrl) {
      this.frame.src = this.currentUrl;
      return;
    }
    await this.connect(force);
  }

  private async connect(force: boolean): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      if (force) {
        // A restarted server may come back on the same port; drop the old frame
        // so it cannot keep showing the dead connection.
        this.frame?.remove();
        this.frame = null;
        this.currentUrl = null;
      }
      this.showStatus("starting", "Starting the local agent", "First open indexes this vault, which can take a minute.");
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
      this.clearStatus();
      return;
    }
    this.frame?.remove();
    const frame = document.createElement("iframe");
    frame.className = "pi-mirror-frame";
    frame.src = url;
    frame.setAttribute("title", "Pi-Mirror workbench");
    frame.setAttribute("allow", "clipboard-read; clipboard-write");
    frame.addEventListener("load", () => this.clearStatus());
    this.contentEl.appendChild(frame);
    this.frame = frame;
    this.currentUrl = url;
  }

  private clearStatus(): void {
    this.status?.remove();
    this.status = null;
  }

  private showStatus(kind: StatusKind, title: string, detail: string): void {
    this.clearStatus();
    const box = document.createElement("div");
    box.className = `pi-mirror-status is-${kind}`;

    const spinner = document.createElement("div");
    spinner.className = "pi-mirror-spinner";
    setIcon(spinner, kind === "error" ? "alert-triangle" : "loader");
    box.appendChild(spinner);

    const heading = document.createElement("h3");
    heading.textContent = title;
    box.appendChild(heading);

    const copy = document.createElement("p");
    copy.textContent = detail;
    box.appendChild(copy);

    this.contentEl.appendChild(box);
    this.status = box;
  }

  private showError(message: string): void {
    this.showStatus(
      "error",
      "The local agent did not start",
      "Check the server folder and Node path in settings, then try again.",
    );
    const box = this.status;
    if (!box) return;

    const actions = document.createElement("div");
    actions.className = "pi-mirror-actions";

    const retry = document.createElement("button");
    retry.className = "pi-mirror-button mod-cta";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => void this.connect(true));
    actions.appendChild(retry);

    const settings = document.createElement("button");
    settings.className = "pi-mirror-button";
    settings.textContent = "Open settings";
    settings.addEventListener("click", () => this.host.openSettings());
    actions.appendChild(settings);

    box.appendChild(actions);

    const pre = document.createElement("pre");
    pre.className = "pi-mirror-log";
    pre.textContent = message;
    box.appendChild(pre);
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
