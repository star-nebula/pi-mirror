import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { startWorkspace, type WorkspaceHandle } from "../src/server/app.js";
import { allFeatures } from "../src/features/all.js";
import type { PersonaAnswer } from "../src/persona/agent.js";

function tempVault(): string {
  const vault = mkdtempSync(join(tmpdir(), "pi-mirror-server-"));
  mkdirSync(join(vault, "Knowledge"), { recursive: true });
  writeFileSync(
    join(vault, "Knowledge", "a.md"),
    "# 知识库\n\n知识库内容生产线需要证据。\n\n我认为每条结论都要有来源。\n",
    "utf8",
  );
  return vault;
}

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), "pi-mirror-server-db-")), "test.db");
}

const answer: PersonaAnswer = {
  answer: "我的判断是证据优先 [1]。",
  sources: [
    {
      number: 1,
      path: "Knowledge/a.md",
      title: "知识库",
      heading: "知识库",
      quote: "知识库内容生产线需要证据。",
      line: "L3-L3",
    },
  ],
  model: "fake-model",
};

let handle: WorkspaceHandle | null = null;

afterEach(async () => {
  await handle?.close();
  handle = null;
});

async function start(): Promise<WorkspaceHandle> {
  handle = await startWorkspace({
    vaultRoot: tempVault(),
    dbPath: tempDb(),
    port: 0,
    features: allFeatures,
    ask: async () => answer,
    draft: async () => ({
      ...answer,
      answer: "证据优先 [1]。所有人都会同意这一点。我会一直坚持。",
    }),
  });
  return handle;
}

async function call(
  base: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; headers: Headers; json: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  return {
    status: response.status,
    headers: response.headers,
    json: (await response.json()) as Record<string, unknown>,
  };
}

describe("workspace API", () => {
  it("serves the app shell with lock-down headers", async () => {
    const workspace = await start();
    const response = await fetch(workspace.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(await response.text()).toContain("Pi-Mirror");
  });

  it("indexes the vault and exposes persona state", async () => {
    const workspace = await start();
    const indexed = await call(workspace.url, "/api/index", { method: "POST", body: {} });
    expect(indexed.status).toBe(200);
    expect((indexed.json.index as { files: number }).files).toBe(1);

    const state = await call(workspace.url, "/api/state");
    expect(state.status).toBe(200);
    const counts = state.json.counts as { notes: number; traits: number };
    expect(counts.notes).toBe(1);
    expect(counts.traits).toBeGreaterThan(0);
    expect((state.json.consent as Array<{ scope: string; granted: boolean }>).every((c) => !c.granted)).toBe(true);
  });

  it("runs a fake Ask turn and keeps history", async () => {
    const workspace = await start();
    const asked = await call(workspace.url, "/api/ask", {
      method: "POST",
      body: { question: "我的判断是什么？" },
    });
    expect(asked.status).toBe(200);
    expect(asked.json.answer).toBe(answer.answer);

    const history = await call(workspace.url, "/api/history");
    const entries = history.json as unknown as Array<{ question: string; answer: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0].question).toBe("我的判断是什么？");
  });

  it("returns guard findings with a draft", async () => {
    const workspace = await start();
    const drafted = await call(workspace.url, "/api/write", {
      method: "POST",
      body: { topic: "证据优先", platform: "xiaohongshu" },
    });
    expect(drafted.status).toBe(200);
    const guard = drafted.json.guard as { findings: Array<{ id: string }> };
    const ids = guard.findings.map((finding) => finding.id);
    expect(ids).toContain("absolute-claims");
    expect(ids).toContain("unsupported-claims");
  });

  it("blocks publishing until consent is granted, then records it", async () => {
    const workspace = await start();
    const draft = await call(workspace.url, "/api/drafts", {
      method: "POST",
      body: { content: "证据优先 [1]。", platform: "xiaohongshu", topic: "证据" },
    });
    const draftId = draft.json.id as string;

    const denied = await call(workspace.url, "/api/publish", {
      method: "POST",
      body: { draftId, platform: "xiaohongshu" },
    });
    expect(denied.status).toBe(403);

    await call(workspace.url, "/api/consent", {
      method: "POST",
      body: { scope: "publishing", granted: true },
    });
    const published = await call(workspace.url, "/api/publish", {
      method: "POST",
      body: { draftId, platform: "xiaohongshu", url: "https://example.com/post" },
    });
    expect(published.status).toBe(201);
    const records = published.json.records as Array<{ draftId: string; platform: string }>;
    expect(records[0].draftId).toBe(draftId);
    expect(records[0].platform).toBe("xiaohongshu");
  });

  it("rejects note paths that escape the vault", async () => {
    const workspace = await start();
    const escaped = await call(workspace.url, "/api/note?path=../secret.md");
    expect(escaped.status).toBe(400);
  });

  it("rejects a non-loopback Host header", async () => {
    const workspace = await start();
    const status = await new Promise<number>((resolvePromise, rejectPromise) => {
      const req = request(
        `${workspace.url}/api/health`,
        { headers: { host: "evil.example" } },
        (res) => {
          res.resume();
          resolvePromise(res.statusCode ?? 0);
        },
      );
      req.on("error", rejectPromise);
      req.end();
    });
    expect(status).toBe(403);
  });

  it("answers 429 while a persona turn is running", async () => {
    let release!: (value: PersonaAnswer) => void;
    const gate = new Promise<PersonaAnswer>((resolvePromise) => {
      release = resolvePromise;
    });
    handle = await startWorkspace({
      vaultRoot: tempVault(),
      dbPath: tempDb(),
      port: 0,
      features: allFeatures,
      ask: async () => gate,
      draft: async () => answer,
    });

    const first = call(handle.url, "/api/ask", { method: "POST", body: { question: "first" } });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    const second = await call(handle.url, "/api/ask", { method: "POST", body: { question: "second" } });
    expect(second.status).toBe(429);

    release(answer);
    const done = await first;
    expect(done.status).toBe(200);
  });
});
