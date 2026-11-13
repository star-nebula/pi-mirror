/**
 * Process and health plumbing for the Pi-Mirror workspace.
 *
 * Deliberately free of `obsidian` imports: this module is unit-tested with
 * plain Node (see ../../tests/obsidian-server.test.ts) and reused unchanged by
 * the plugin entry point.
 *
 * The workspace is a real local server process, not a reimplementation: the
 * renderer cannot load `better-sqlite3` (a native module), so the plugin spawns
 * the compiled Node server and hosts its URL in a pane.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ServerConfig {
  /** Repo checkout that contains `dist/` and `web/`. */
  serverDir: string;
  vaultRoot: string;
  dbPath: string;
  nodePath?: string;
  port?: number;
  webRoot?: string;
  /** CSP `frame-ancestors` value handed to the server. */
  frameAncestors?: string;
  env?: Record<string, string>;
}

export interface HealthReport {
  ok: boolean;
  version?: string;
  vaultRoot?: string;
  features?: string[];
}

/** Where the compiled entry points live inside the checkout. */
export const SERVER_ENTRY = ["dist", "server", "index.js"] as const;
export const CLI_ENTRY = ["dist", "cli.js"] as const;

export const DEFAULT_FRAME_ANCESTORS = "'self' app://obsidian.md";

export function serverEntry(serverDir: string): string {
  return resolve(serverDir, ...SERVER_ENTRY);
}

export function cliEntry(serverDir: string): string {
  return resolve(serverDir, ...CLI_ENTRY);
}

export interface LayoutCheck {
  ok: boolean;
  /** Human-readable list of what is missing. */
  problems: string[];
}

/** A checkout is usable when the server, CLI and web assets are all present. */
export function checkServerLayout(serverDir: string): LayoutCheck {
  if (!serverDir.trim()) {
    return { ok: false, problems: ["Server folder is empty."] };
  }
  const problems: string[] = [];
  if (!existsSync(serverEntry(serverDir))) {
    problems.push(`missing ${serverEntry(serverDir)} — run "npm run build" in the checkout`);
  }
  if (!existsSync(cliEntry(serverDir))) {
    problems.push(`missing ${cliEntry(serverDir)} — run "npm run build" in the checkout`);
  }
  const web = resolve(serverDir, "web", "index.html");
  if (!existsSync(web)) {
    problems.push(`missing ${web} — the checkout looks incomplete`);
  }
  return { ok: problems.length === 0, problems };
}

const WORKSPACE_LINE = /Pi-Mirror workspace:\s*(https?:\/\/[^\s]+)/;

/** Pull the workspace URL out of the server's boot banner. */
export function parseWorkspaceUrl(text: string): string | null {
  const match = WORKSPACE_LINE.exec(text);
  return match?.[1] ?? null;
}

function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** Poll `/api/health` until the workspace answers or the deadline passes. */
export async function waitForHealth(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<HealthReport> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(4_000) });
      if (response.ok) {
        const body = (await response.json()) as HealthReport;
        if (body && body.ok !== false) return body;
        lastError = "health endpoint reported not ok";
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(intervalMs);
  }
  throw new Error(`Pi-Mirror did not become healthy at ${url} within ${timeoutMs}ms (${lastError})`);
}

export interface ExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  /** True when the plugin itself called stop(). */
  expected: boolean;
}

export class ServerProcess {
  url: string | null = null;
  lastError: string | null = null;
  onExit: ((info: ExitInfo) => void) | null = null;

  private child: ChildProcess | null = null;
  private stderrTail = "";
  private stdoutTail = "";
  private stopping = false;

  constructor(private readonly config: ServerConfig) {}

  get running(): boolean {
    const child = this.child;
    return child !== null && child.exitCode === null && child.signalCode === null;
  }

  get configSnapshot(): ServerConfig {
    return this.config;
  }

  async start(timeoutMs = 45_000): Promise<string> {
    if (this.url && this.running) return this.url;
    if (this.child) await this.stop();

    const entry = serverEntry(this.config.serverDir);
    if (!existsSync(entry)) {
      throw new Error(
        `Pi-Mirror server not built: ${entry} is missing.\n` +
          `Run "npm run build" in ${this.config.serverDir} (once), then reopen the pane.`,
      );
    }

    this.stderrTail = "";
    this.stdoutTail = "";
    this.lastError = null;
    this.stopping = false;

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...this.config.env,
      PI_MIRROR_VAULT: this.config.vaultRoot,
      PI_MIRROR_DB: this.config.dbPath,
      PI_MIRROR_PORT: String(this.config.port ?? 4317),
      PI_MIRROR_WEB: this.config.webRoot ?? resolve(this.config.serverDir, "web"),
      PI_MIRROR_FRAME_ANCESTORS: this.config.frameAncestors ?? DEFAULT_FRAME_ANCESTORS,
    };

    const child = spawn(this.config.nodePath?.trim() || "node", [entry], {
      cwd: this.config.serverDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    return await new Promise<string>((resolveStart, rejectStart) => {
      let settled = false;
      let timer: NodeJS.Timeout | null = null;

      const finish = (error: Error | null, url?: string) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (error) {
          this.lastError = error.message;
          void this.stop();
          rejectStart(error);
        } else if (url) {
          resolveStart(url);
        }
      };

      timer = setTimeout(() => {
        const detail = this.stderrTail.trim() || this.stdoutTail.trim();
        finish(
          new Error(
            `Pi-Mirror server did not print a URL within ${timeoutMs}ms.` +
              (detail ? `\n\n${detail.slice(-1200)}` : "\n\nIt may be blocked by a missing dependency install."),
          ),
        );
      }, timeoutMs);

      child.stdout?.on("data", (chunk: string) => {
        this.stdoutTail = (this.stdoutTail + chunk).slice(-8000);
        const url = parseWorkspaceUrl(this.stdoutTail);
        if (url && !this.url) {
          this.url = url;
          finish(null, url);
        }
      });

      child.stderr?.on("data", (chunk: string) => {
        this.stderrTail = (this.stderrTail + chunk).slice(-8000);
      });

      child.once("error", (error: NodeJS.ErrnoException) => {
        const hint =
          error.code === "ENOENT"
            ? `Node executable not found: ${this.config.nodePath ?? "node"}. Set the path in Pi-Mirror settings.`
            : error.message;
        finish(new Error(hint));
      });

      child.once("exit", (code, signal) => {
        const wasExpected = this.stopping;
        this.url = null;
        this.child = null;
        const detail = this.stderrTail.trim();
        finish(
          new Error(
            `Pi-Mirror server exited (code ${code ?? "null"}${signal ? `, ${signal}` : ""}) before it was ready.` +
              (detail ? `\n\n${detail.slice(-1200)}` : ""),
          ),
        );
        this.onExit?.({ code, signal, stderr: detail, expected: wasExpected });
      });
    });
  }

  async stop(timeoutMs = 5_000): Promise<void> {
    const child = this.child;
    this.child = null;
    this.url = null;
    this.stopping = true;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    const exited = new Promise<void>((done) => child.once("exit", () => done()));

    if (process.platform === "win32" && child.pid) {
      // The server may have children; kill the tree so nothing is left listening.
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }

    await Promise.race([
      exited,
      delay(timeoutMs).then(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }),
    ]);
  }
}

export interface IndexResult {
  stdout: string;
  stderr: string;
}

export interface IndexSummary {
  files: number;
  chunks: number;
  skipped: number;
  durationMs: number;
}

/** `pi-mirror index` prints one JSON object; read it without trusting stdout shape. */
export function parseIndexOutput(stdout: string): IndexSummary | null {
  const start = stdout.indexOf("{");
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(stdout.slice(start)) as Partial<IndexSummary>;
    if (typeof parsed.files !== "number" || typeof parsed.chunks !== "number") return null;
    return {
      files: parsed.files,
      chunks: parsed.chunks,
      skipped: typeof parsed.skipped === "number" ? parsed.skipped : 0,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
    };
  } catch {
    return null;
  }
}

export function describeIndex(stdout: string): string {
  const summary = parseIndexOutput(stdout);
  return summary ? `${summary.files} notes · ${summary.chunks} chunks` : "index rebuilt";
}

/** Build the note index with the real CLI, inside the same vault and DB. */
export async function runIndex(
  config: Pick<ServerConfig, "serverDir" | "vaultRoot" | "dbPath" | "nodePath" | "env">,
  options: { timeoutMs?: number } = {},
): Promise<IndexResult> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const entry = cliEntry(config.serverDir);
  if (!existsSync(entry)) {
    throw new Error(`Pi-Mirror CLI not built: ${entry} is missing. Run "npm run build" in ${config.serverDir}.`);
  }

  return await new Promise<IndexResult>((resolveRun, rejectRun) => {
    const child = spawn(config.nodePath?.trim() || "node", [entry, "index", config.vaultRoot, "--db", config.dbPath], {
      cwd: config.serverDir,
      env: { ...process.env, ...config.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      rejectRun(new Error(`Indexing did not finish within ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-8000);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectRun(
        new Error(
          error.code === "ENOENT"
            ? `Node executable not found: ${config.nodePath ?? "node"}. Set the path in Pi-Mirror settings.`
            : error.message,
        ),
      );
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`Indexing failed (exit ${code ?? "null"}).\n\n${stderr.trim() || stdout.trim()}`));
    });
  });
}
