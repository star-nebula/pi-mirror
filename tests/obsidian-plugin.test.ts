import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_FRAME_ANCESTORS,
  ServerProcess,
  checkServerLayout,
  cliEntry,
  describeIndex,
  parseIndexOutput,
  parseWorkspaceUrl,
  runIndex,
  serverEntry,
  waitForHealth,
} from "../obsidian/src/server.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = 4517;

interface StatePayload {
  counts: { notes: number; chunks: number };
  features: { id: string }[];
}

let workspace: string;
let dbPath: string;

function temp(name: string): string {
  return join(workspace, name);
}

/** Newest mtime under `dir`, so a stale `dist/` cannot pass the tests. */
function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

beforeAll(() => {
  // The plugin runs the compiled server, exactly like a user would.
  const entry = serverEntry(repoRoot);
  const stale = existsSync(entry) && newestMtime(resolve(repoRoot, "src")) > statSync(entry).mtimeMs;
  if (!existsSync(entry) || stale) {
    if (stale) console.log("dist/ is older than src/ — rebuilding before the integration test");
    // Same two steps as `npm run build`, without depending on a shell.
    execFileSync(process.execPath, [resolve(repoRoot, "node_modules", "typescript", "lib", "tsc.js")], {
      cwd: repoRoot,
      stdio: "inherit",
      timeout: 300_000,
    });
    execFileSync(process.execPath, [resolve(repoRoot, "scripts", "copy-assets.mjs")], {
      cwd: repoRoot,
      stdio: "inherit",
      timeout: 300_000,
    });
  }
  workspace = mkdtempSync(join(tmpdir(), "pi-mirror-plugin-"));
  cpSync(resolve(repoRoot, "demo", "vault"), join(workspace, "vault"), { recursive: true });
  dbPath = temp("pi-mirror.db");
}, 300_000);

afterAll(() => {
  if (workspace) rmSync(workspace, { recursive: true, force: true });
});

describe("workspace banner", () => {
  it("reads the URL the server prints", () => {
    expect(parseWorkspaceUrl("Pi-Mirror workspace: http://127.0.0.1:4317\nvault: x\n")).toBe(
      "http://127.0.0.1:4317",
    );
    expect(parseWorkspaceUrl("noise\nPi-Mirror workspace: http://127.0.0.1:4321\r\n")).toBe(
      "http://127.0.0.1:4321",
    );
    expect(parseWorkspaceUrl("starting…")).toBeNull();
  });
});

describe("checkout layout", () => {
  it("accepts this checkout once it is built", () => {
    const layout = checkServerLayout(repoRoot);
    expect(layout.ok).toBe(true);
    expect(layout.problems).toEqual([]);
  });

  it("explains what is missing instead of throwing", () => {
    expect(checkServerLayout("  ").ok).toBe(false);
    const missing = checkServerLayout(temp("nowhere"));
    expect(missing.ok).toBe(false);
    expect(missing.problems.join(" ")).toContain("npm run build");
  });
});

describe("index output", () => {
  it("parses the CLI's JSON and degrades to a plain label", () => {
    const summary = parseIndexOutput('{"vault":"/v","db":"/d","files":12,"chunks":40,"skipped":3,"durationMs":9}');
    expect(summary).toEqual({ files: 12, chunks: 40, skipped: 3, durationMs: 9 });
    expect(describeIndex('{"files":12,"chunks":40}')).toBe("12 notes · 40 chunks");
    expect(describeIndex("not json")).toBe("index rebuilt");
  });
});

describe("indexing the vault", () => {
  it("builds the database through the real CLI", async () => {
    const result = await runIndex({ serverDir: repoRoot, vaultRoot: temp("vault"), dbPath });
    const summary = parseIndexOutput(result.stdout);
    expect(summary?.files).toBeGreaterThan(0);
    expect(summary?.chunks).toBeGreaterThanOrEqual(summary?.files ?? 0);
    expect(existsSync(cliEntry(repoRoot))).toBe(true);
    expect(statSync(dbPath).size).toBeGreaterThan(0);
  });
});

describe("server process", () => {
  const running: ServerProcess[] = [];

  afterAll(async () => {
    await Promise.all(running.map((server) => server.stop()));
  });

  function makeServer(port: number, frameAncestors?: string): ServerProcess {
    const server = new ServerProcess({
      serverDir: repoRoot,
      vaultRoot: temp("vault"),
      dbPath,
      port,
      frameAncestors,
    });
    running.push(server);
    return server;
  }

  it("starts, answers health and serves the workspace to Obsidian", async () => {
    const server = makeServer(PORT, DEFAULT_FRAME_ANCESTORS);
    const url = await server.start();
    expect(server.running).toBe(true);
    expect(server.url).toBe(url);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const health = await waitForHealth(url);
    expect(health.ok).not.toBe(false);
    expect(health.features).toContain("studio");

    const state = (await (await fetch(`${url}/api/state`)).json()) as StatePayload;
    expect(state.counts.notes).toBeGreaterThan(0);
    expect(state.features.map((feature) => feature.id)).toContain("library");

    const page = await fetch(`${url}/`);
    expect(page.status).toBe(200);
    const csp = page.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'self' app://obsidian.md");
    expect(csp).not.toContain("frame-ancestors 'none'");
    // X-Frame-Options cannot name an app:// origin, so it must be absent here.
    expect(page.headers.get("x-frame-options")).toBeNull();
    expect(await page.text()).toContain("<title>");
  }, 60_000);

  it("picks another port when the preferred one is taken", async () => {
    const first = running[0];
    expect(first?.url).toBeTruthy();
    const firstPort = Number(new URL(first!.url!).port);

    const second = makeServer(PORT, "'none'");
    const secondUrl = await second.start();
    const secondPort = Number(new URL(secondUrl).port);
    expect(secondPort).not.toBe(firstPort);
    expect(serverEntry(repoRoot)).toContain("index.js");
  }, 60_000);

  it("keeps the strict framing default outside Obsidian", async () => {
    const strict = running.find((server) => server.url && server !== running[0]);
    expect(strict?.url).toBeTruthy();
    const page = await fetch(`${strict!.url!}/`);
    expect(page.headers.get("x-frame-options")).toBe("DENY");
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  }, 30_000);

  it("stops cleanly and can be started again", async () => {
    const server = running[0]!;
    const url = server.url!;
    await server.stop();
    expect(server.running).toBe(false);
    expect(server.url).toBeNull();
    await expect(fetch(`${url}/api/health`)).rejects.toThrow();

    const restarted = await server.start();
    expect(restarted).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const health = await waitForHealth(restarted);
    expect(health.ok).not.toBe(false);

    await server.stop();
    await server.stop(); // idempotent
    expect(server.running).toBe(false);
  }, 60_000);

  it("reports a missing build instead of hanging", async () => {
    const server = new ServerProcess({
      serverDir: temp("nowhere"),
      vaultRoot: temp("vault"),
      dbPath: temp("other.db"),
    });
    await expect(server.start(2_000)).rejects.toThrow(/not built/);
    expect(server.running).toBe(false);
  });
});
