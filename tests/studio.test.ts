import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startWorkspace, type WorkspaceHandle } from "../src/server/app.js";
import { allFeatures } from "../src/features/all.js";
import { analyzeReference, similarity, searchReferences, importReference } from "../src/studio/reference.js";
import { parseBingResults, assertPublicHttpUrl, filterRelevant, searchWeb } from "../src/studio/research.js";
import { addSource, getRun, savePackage } from "../src/studio/store.js";
import { guardWithDb } from "../src/persona/guard-db.js";
import { hashText, validatePackage } from "../src/studio/validate.js";
import { openDb } from "../src/db/sqlite.js";
import type { ContentPackage } from "../src/studio/types.js";

function tempVault(): string {
  const vault = mkdtempSync(join(tmpdir(), "pi-mirror-studio-"));
  mkdirSync(join(vault, "Knowledge"), { recursive: true });
  writeFileSync(join(vault, "Knowledge", "a.md"), "# 知识库\n\n我认为每条结论都要有来源。\n", "utf8");
  return vault;
}

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), "pi-mirror-studio-db-")), "test.db");
}

const body = "这是一段足够长的内容，用来验证 Studio 路由可以保存内容包。证据优先 [1]。";

function packageFixture(): ContentPackage {
  return {
    title: "证据优先",
    angle: "先给结论，再回到来源",
    whyNow: "今天的热点需要一个有依据的判断",
    audience: "做 AI 产品的人",
    platform: "xiaohongshu",
    format: "note",
    body,
    titleOptions: ["证据优先"],
    angles: [],
    chosenAngle: "先给结论，再回到来源",
    claims: [],
    referencesUsed: [],
    questions: [],
    risks: [],
    variants: [],
  };
}

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

describe("studio primitives", () => {
  it("analyzes a list-style reference without copying it", () => {
    const analysis = analyzeReference({
      title: "3 个我踩过的坑",
      body: "我以前做内容总是先写正文。\n\n- 先写标题\n- 再写开头\n- 最后才写正文\n\n收藏这篇，下次直接用。",
    });
    expect(analysis.title).toContain("3 个");
    expect(analysis.patterns).toContain("清单体");
    expect(analysis.patterns).toContain("故事开场");
    expect(analysis.stats.listLines).toBe(3);
    expect(analysis.keywords.length).toBeGreaterThan(0);
  });

  it("scores similarity and catches near-copies", () => {
    expect(similarity("证据优先，先给结论", "证据优先，先给结论")).toBe(1);
    expect(similarity("证据优先，先给结论", "今天天气不错，出去走走")).toBeLessThan(0.1);
    expect(similarity(body, body)).toBe(1);
  });

  it("parses Bing result markup", () => {
    const html = `<li class="b_algo"><h2><a href="https://example.com/a">Example A</a></h2><p class="b_lineclamp">Snippet A</p></li>
      <li class="b_algo"><h2><a href="https://example.org/b">Example B</a></h2><p>Snippet B</p></li>`;
    const results = parseBingResults(html);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: "Example A", url: "https://example.com/a", source: "example.com" });
  });

  it("drops search results that only match a bare number", () => {
    const results = [
      { title: "Cursor Projects is now multiplayer", url: "https://cursor.com/blog/projects", snippet: "agents share context", source: "cursor.com" },
      { title: "Windows 11 系统安装", url: "https://example.com/win11", snippet: "11 系统", source: "example.com" },
      { title: "11（自然数之一）", url: "https://example.com/11", snippet: "11 是自然数", source: "example.com" },
    ];
    const kept = filterRelevant(results, "Cursor 11 人 62 个 agent");
    expect(kept).toHaveLength(1);
    expect(kept[0].url).toBe("https://cursor.com/blog/projects");
  });

  it("refuses a bare-number query before hitting the network", async () => {
    await expect(searchWeb("11")).rejects.toThrow(/too generic/i);
    await expect(searchWeb("62")).rejects.toThrow(/too generic/i);
  });

  it("rejects loopback fetches", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1:4317/api/state")).rejects.toThrow(/Private|localhost/i);
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(/http/i);
  });

  it("imports and searches references by engagement", () => {
    const db = openDb(tempDb());
    try {
      const low = importReference(db, {
        platform: "xiaohongshu",
        title: "低互动",
        body: "这是一篇普通的笔记，讲了一些普通的事情，没有特别的结构。",
        likes: 10,
        collects: 2,
        comments: 1,
        followers: 5000,
      });
      const high = importReference(db, {
        platform: "xiaohongshu",
        title: "低粉高赞",
        body: "我以前总是先写正文。\n\n- 先写标题\n- 再写开头\n- 最后写正文\n\n收藏这篇。",
        likes: 900,
        collects: 300,
        comments: 80,
        followers: 800,
      });
      expect(high.engagement).toBeGreaterThan(low.engagement);
      expect(high.followerTier).toBe("nano");
      const results = searchReferences(db, "标题");
      expect(results[0].id).toBe(high.id);
    } finally {
      db.close();
    }
  });
});

describe("package validation", () => {
  it("accepts a guarded, cited package", () => {
    const db = openDb(tempDb());
    try {
      const report = guardWithDb(db, body, {});
      const result = validatePackage({
        pkg: packageFixture(),
        sources: [
          {
            number: 1,
            kind: "note",
            title: "知识库",
            locator: "Knowledge/a.md",
            quote: "证据优先。",
            publishedAt: null,
            retrievedAt: new Date().toISOString(),
          },
        ],
        claims: [],
        references: [],
        guard: report,
        guardHash: hashText(body),
        bodyHash: hashText(body),
      });
      expect(result.ok).toBe(true);
    } finally {
      db.close();
    }
  });

  it("rejects a package without a guard", () => {
    const result = validatePackage({
      pkg: packageFixture(),
      sources: [],
      claims: [],
      references: [],
      guard: null,
      guardHash: null,
      bodyHash: hashText(body),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("guard_text");
  });
});

describe("studio API", () => {
  it("creates a run, returns its trace, and saves the package as a draft", async () => {
    const dbPath = tempDb();
    handle = await startWorkspace({
      vaultRoot: tempVault(),
      dbPath,
      port: 0,
      features: allFeatures,
      studio: async (options) => {
        const source = addSource(options.db, options.runId, {
          kind: "note",
          title: "知识库",
          locator: "Knowledge/a.md",
          quote: "证据优先。",
          publishedAt: null,
        });
        const report = guardWithDb(options.db, body, {});
        savePackage(options.db, options.runId, packageFixture(), report);
        void source;
      },
    });

    const created = await call(handle.url, "/api/studio/runs", {
      method: "POST",
      body: { goal: "写一篇关于证据优先的笔记", platform: "xiaohongshu" },
    });
    expect(created.status).toBe(202);
    const id = String(created.json.id);

    let run: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await call(handle.url, `/api/studio/run?id=${id}`);
      run = response.json.run as Record<string, unknown>;
      if (run.status === "done") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(run?.status).toBe("done");
    expect((run?.package as { title: string }).title).toBe("证据优先");

    const saved = await call(handle.url, "/api/studio/save", {
      method: "POST",
      body: { runId: id },
    });
    expect(saved.status).toBe(201);
    expect(saved.json.id).toMatch(/^draft_/);
    const stored = getRun(openDb(dbPath), id);
    expect(stored?.draftId).toBe(saved.json.id);
  });
});
