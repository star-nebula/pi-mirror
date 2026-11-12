import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startWorkspace, type WorkspaceHandle } from "../src/server/app.js";
import { allFeatures } from "../src/features/all.js";
import type { PersonaAnswer } from "../src/persona/agent.js";

function tempVault(): string {
  const vault = mkdtempSync(join(tmpdir(), "pi-mirror-features-"));
  mkdirSync(join(vault, "Knowledge"), { recursive: true });
  writeFileSync(join(vault, "Knowledge", "a.md"), "# 知识库\n\n我认为每条结论都要有来源。\n", "utf8");
  return vault;
}

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), "pi-mirror-features-db-")), "test.db");
}

const answer: PersonaAnswer = {
  answer: "证据优先 [1]。",
  sources: [],
  model: "fake-model",
};

let handle: WorkspaceHandle | null = null;

afterEach(async () => {
  await handle?.close();
  handle = null;
});

async function call(
  base: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe("feature plugins", () => {
  it("declares every product feature once, with a stable order", () => {
    const ids = allFeatures.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "vault",
      "persona",
      "ask",
      "write",
      "guard",
      "timeline",
      "library",
      "consent",
      "research",
      "reference",
      "studio",
    ]);
    expect(allFeatures.filter((feature) => feature.nav).map((feature) => feature.id)).toEqual([
      "persona",
      "ask",
      "write",
      "guard",
      "timeline",
      "library",
      "consent",
      "studio",
    ]);
  });

  it("composes only the plugins that were loaded", async () => {
    handle = await startWorkspace({
      vaultRoot: tempVault(),
      dbPath: tempDb(),
      port: 0,
      features: allFeatures.filter((feature) => feature.id === "ask"),
      ask: async () => answer,
    });

    const features = await call(handle.url, "/api/features");
    expect(features.json).toHaveLength(1);
    expect((features.json as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "ask",
      nav: true,
      commands: ["ask"],
    });

    const state = await call(handle.url, "/api/state");
    expect(state.status).toBe(200);
    expect((state.json.features as Array<{ id: string }>).map((feature) => feature.id)).toEqual(["ask"]);
    expect(state.json.traits).toBeUndefined();
    expect(state.json.consent).toBeUndefined();
    expect(state.json.counts).toBeDefined();

    const ask = await call(handle.url, "/api/ask", { method: "POST", body: { question: "我的判断？" } });
    expect(ask.status).toBe(200);

    const missing = await call(handle.url, "/api/persona");
    expect(missing.status).toBe(404);
    expect(String(missing.json.error)).toContain("No loaded feature plugin");
    expect(handle.features).toEqual(["ask"]);
  });

  it("fails publishing closed when the Consent plugin is not loaded", async () => {
    handle = await startWorkspace({
      vaultRoot: tempVault(),
      dbPath: tempDb(),
      port: 0,
      features: allFeatures.filter((feature) => ["write", "library"].includes(feature.id)),
      ask: async () => answer,
    });

    const draft = await call(handle.url, "/api/drafts", {
      method: "POST",
      body: { content: "证据优先 [1]。", topic: "证据", platform: "xiaohongshu" },
    });
    expect(draft.status).toBe(201);

    const denied = await call(handle.url, "/api/publish", {
      method: "POST",
      body: { draftId: draft.json.id, platform: "xiaohongshu" },
    });
    expect(denied.status).toBe(403);
    expect(String(denied.json.error)).toContain("Consent plugin");
  });

  it("restores publishing when Consent is loaded and granted", async () => {
    handle = await startWorkspace({
      vaultRoot: tempVault(),
      dbPath: tempDb(),
      port: 0,
      features: allFeatures.filter((feature) => ["write", "library", "consent"].includes(feature.id)),
      ask: async () => answer,
    });

    const draft = await call(handle.url, "/api/drafts", {
      method: "POST",
      body: { content: "证据优先 [1]。", topic: "证据", platform: "xiaohongshu" },
    });
    await call(handle.url, "/api/consent", {
      method: "POST",
      body: { scope: "publishing", granted: true },
    });
    const published = await call(handle.url, "/api/publish", {
      method: "POST",
      body: { draftId: draft.json.id, platform: "xiaohongshu" },
    });
    expect(published.status).toBe(201);
  });
});
