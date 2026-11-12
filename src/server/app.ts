import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultDbPath, openDb, type DB } from "../db/sqlite.js";
import { askPersona, draftAsPersona, type PersonaAnswer } from "../persona/agent.js";
import { guardWithDb } from "../persona/guard-db.js";
import { runStudioAgent, type StudioAgentOptions } from "../studio/agent.js";
import type { ReferenceService, ResearchService } from "../studio/services.js";
import { readCounts, readProfile } from "./data.js";
import {
  FeatureError,
  type FeaturePlugin,
  type FeatureRequest,
  type FeatureRoute,
  type FeatureRuntime,
  type HistoryEntry,
} from "../features/contract.js";
import { featureDescriptor, listFeatures } from "../features/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const VERSION = "0.1.0";

export type PersonaRunner = (options: { vaultRoot: string; dbPath: string; profileId?: string }, input: string) => Promise<PersonaAnswer>;

export interface WorkspaceOptions {
  vaultRoot: string;
  dbPath?: string;
  port?: number;
  host?: string;
  webRoot?: string;
  /** Feature plugins to compose. Defaults to the live registry. */
  features?: FeaturePlugin[];
  /** Injectable for tests and for embedding a different agent. */
  ask?: PersonaRunner;
  draft?: PersonaRunner;
  studio?: (options: StudioAgentOptions) => Promise<void>;
}

export interface WorkspaceHandle {
  url: string;
  port: number;
  vaultRoot: string;
  features: string[];
  close(): Promise<void>;
}

interface BuiltRoute extends FeatureRoute {
  feature: string;
}

interface WorkspaceContext {
  vaultRoot: string;
  dbPath: string;
  webRoot: string;
  db: DB;
  history: HistoryEntry[];
  features: FeaturePlugin[];
  routes: BuiltRoute[];
  runtime: FeatureRuntime;
  startedAt: string;
}

function resolveWebRoot(explicit?: string): string {
  const candidates = explicit
    ? [resolve(explicit)]
    : [resolve(here, "..", "..", "web"), resolve(here, "..", "web"), resolve(process.cwd(), "web")];
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "index.html"))) return candidate;
  }
  throw new Error(
    `Pi-Mirror web assets not found. Looked in: ${candidates.join(", ")}. Run from the repo or set PI_MIRROR_WEB.`,
  );
}

interface PiModel {
  model: string | null;
  provider: string | null;
}

function readPiModel(): PiModel {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? resolve(home, ".pi", "agent");
  try {
    const settings = JSON.parse(readFileSync(resolve(agentDir, "settings.json"), "utf8")) as {
      defaultModel?: string;
      defaultProvider?: string;
    };
    return { model: settings.defaultModel ?? null, provider: settings.defaultProvider ?? null };
  } catch {
    return { model: null, provider: null };
  }
}

function readJsonBody(req: IncomingMessage, limit = 1024 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new FeatureError(413, "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size === 0) {
        resolvePromise({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new FeatureError(400, "Request body must be a JSON object."));
          return;
        }
        resolvePromise(parsed as Record<string, unknown>);
      } catch {
        reject(new FeatureError(400, "Request body is not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

const STATIC_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function serveStatic(res: ServerResponse, webRoot: string, pathname: string): void {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const abs = resolve(webRoot, rel);
  if (abs !== webRoot && !abs.startsWith(webRoot + sep)) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const type = STATIC_TYPES[extname(abs).toLowerCase()];
  if (!type || !existsSync(abs)) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const body = readFileSync(abs);
  res.writeHead(200, {
    "content-type": type,
    "content-length": body.length,
    "cache-control": "no-store",
  });
  res.end(body);
}

function securityHeaders(res: ServerResponse): void {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
}

function hostAllowed(req: IncomingMessage, port: number): boolean {
  const host = req.headers.host;
  if (!host) return false;
  const allowed = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
  return allowed.includes(host.toLowerCase());
}

async function listen(server: Server, requestedPort: number, host: string): Promise<number> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const port = requestedPort + attempt;
    try {
      await new Promise<void>((resolveListen, rejectListen) => {
        const onError = (error: NodeJS.ErrnoException) => {
          server.off("listening", onListening);
          rejectListen(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolveListen();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
      const address = server.address();
      return typeof address === "object" && address ? address.port : port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No free port found between ${requestedPort} and ${requestedPort + 24}.`);
}

function buildContext(options: WorkspaceOptions, features: FeaturePlugin[], webRoot: string): WorkspaceContext {
  const vaultRoot = resolve(options.vaultRoot);
  const dbPath = options.dbPath ?? defaultDbPath();
  const db = openDb(dbPath);
  const history: HistoryEntry[] = [];
  const services = new Map<string, unknown>();
  let busy = false;
  let studioRunning = false;

  const runtime: FeatureRuntime = {
    db,
    vaultRoot,
    dbPath,
    history,
    async ask(question: string) {
      if (busy) {
        throw new FeatureError(429, "Another persona turn is still running. Wait for it to finish.");
      }
      busy = true;
      try {
        const answer = await (options.ask ?? askPersona)(
          { vaultRoot, dbPath, profileId: readProfile(db)?.id },
          question,
        );
        const entry: HistoryEntry = {
          id: randomUUID(),
          question,
          answer: answer.answer,
          sources: answer.sources,
          model: answer.model,
          error: answer.error,
          at: new Date().toISOString(),
        };
        history.unshift(entry);
        history.length = Math.min(history.length, 30);
        return { answer, entry };
      } finally {
        busy = false;
      }
    },
    async draft(brief: string) {
      if (busy) {
        throw new FeatureError(429, "The persona agent is still answering. Try again in a moment.");
      }
      busy = true;
      try {
        return await (options.draft ?? draftAsPersona)(
          { vaultRoot, dbPath, profileId: readProfile(db)?.id },
          brief,
        );
      } finally {
        busy = false;
      }
    },
    guard(text: string) {
      return guardWithDb(db, text);
    },
    async startStudio(input) {
      if (studioRunning) {
        throw new FeatureError(429, "A Studio run is already active. Wait for it to finish.");
      }
      studioRunning = true;
      try {
        await (options.studio ?? runStudioAgent)({
          db,
          vaultRoot,
          runId: input.runId,
          goal: input.goal,
          platform: input.platform,
          audience: input.audience,
          research: services.get("research") as ResearchService | undefined,
          references: services.get("references") as ReferenceService | undefined,
        });
      } finally {
        studioRunning = false;
      }
    },
    studioBusy() {
      return studioRunning;
    },
    service<T>(name: string): T | undefined {
      return services.get(name) as T | undefined;
    },
  };

  for (const feature of features) {
    if (!feature.services) continue;
    for (const [name, service] of Object.entries(feature.services(runtime))) {
      if (services.has(name)) {
        throw new Error(`Two feature plugins registered the service "${name}".`);
      }
      services.set(name, service);
    }
  }

  const routes: BuiltRoute[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    for (const route of feature.routes(runtime)) {
      const key = `${route.method} ${route.path}`;
      if (seen.has(key)) throw new Error(`Two feature plugins registered ${key}.`);
      seen.add(key);
      routes.push({ ...route, feature: feature.id });
    }
  }

  return {
    vaultRoot,
    dbPath,
    webRoot,
    db,
    history,
    features,
    routes,
    runtime,
    startedAt: new Date().toISOString(),
  };
}

function statePayload(ctx: WorkspaceContext): Record<string, unknown> {
  const model = readPiModel();
  const payload: Record<string, unknown> = {
    meta: {
      vaultRoot: ctx.vaultRoot,
      demo: /(^|[\\/])demo([\\/]|$)/.test(ctx.vaultRoot),
      model: model.model,
      provider: model.provider,
      startedAt: ctx.startedAt,
      version: VERSION,
    },
    features: ctx.features.map(featureDescriptor),
    counts: readCounts(ctx.db),
  };

  for (const feature of ctx.features) {
    if (!feature.state) continue;
    Object.assign(payload, feature.state(ctx.runtime));
  }
  return payload;
}

export async function startWorkspace(options: WorkspaceOptions): Promise<WorkspaceHandle> {
  const features = options.features ?? listFeatures();
  const webRoot = resolveWebRoot(options.webRoot ?? process.env.PI_MIRROR_WEB);
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? Number(process.env.PI_MIRROR_PORT ?? 4317);
  const ctx = buildContext(options, features, webRoot);

  let boundPort = 0;
  const server = createServer((req, res) => {
    securityHeaders(res);
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    const pathname = url.pathname;

    // Host check blocks DNS-rebinding: only loopback names for this port are served.
    if (!hostAllowed(req, boundPort)) {
      sendJson(res, 403, { error: "host not allowed" });
      return;
    }

    if (!pathname.startsWith("/api/")) {
      if (req.method === "GET" || req.method === "HEAD") {
        serveStatic(res, webRoot, pathname);
        return;
      }
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }

    void handleApi(req, res, ctx, url).catch((error: unknown) => {
      if (res.headersSent) return;
      if (error instanceof FeatureError) {
        sendJson(res, error.status, { ok: false, error: error.message });
        return;
      }
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  });

  const port = await listen(server, requestedPort, host);
  boundPort = port;
  let closed = false;

  return {
    url: `http://${host}:${port}`,
    port,
    vaultRoot: ctx.vaultRoot,
    features: features.map((feature) => feature.id),
    async close() {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolveClose) => {
        server.close(() => resolveClose());
        server.closeAllConnections?.();
      });
      ctx.db.close();
    },
  };
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
  url: URL,
): Promise<void> {
  const method = req.method ?? "GET";
  const pathname = url.pathname;

  if (pathname === "/api/health" && method === "GET") {
    sendJson(res, 200, {
      ok: true,
      version: VERSION,
      startedAt: ctx.startedAt,
      features: ctx.features.map((feature) => feature.id),
    });
    return;
  }

  if (pathname === "/api/features" && method === "GET") {
    sendJson(res, 200, ctx.features.map(featureDescriptor));
    return;
  }

  if (pathname === "/api/state" && method === "GET") {
    sendJson(res, 200, statePayload(ctx));
    return;
  }

  const route = ctx.routes.find((candidate) => candidate.method === method && candidate.path === pathname);
  if (!route) {
    sendJson(res, 404, {
      ok: false,
      error: `No loaded feature plugin handles ${method} ${pathname}.`,
      features: ctx.features.map((feature) => feature.id),
    });
    return;
  }

  const body = method === "POST" ? await readJsonBody(req) : {};
  const request: FeatureRequest = {
    ...ctx.runtime,
    method,
    url,
    body,
  };
  const result = await route.handler(request);
  sendJson(res, result.status ?? 200, result.body);
}
