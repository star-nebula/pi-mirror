import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb } from "../src/db/sqlite.js";
import { indexVault } from "../src/vault/index.js";
import {
  computeVoiceStats,
  ensureProfile,
  extractTraits,
} from "../src/persona/extract.js";
import { renderPersonaCard } from "../src/persona/card.js";

function setup(): { vault: string; db: ReturnType<typeof openDb> } {
  const vault = mkdtempSync(join(tmpdir(), "pi-mirror-persona-"));
  mkdirSync(join(vault, "Knowledge"), { recursive: true });
  writeFileSync(
    join(vault, "Knowledge", "voice.md"),
    [
      "# 我的写作观",
      "",
      "我认为写作最重要的是证据。没有出处的句子，不如不写。",
      "",
      "我不做没有来源的引用。我讨厌「据说」这种写法。",
      "",
      "我计划每篇文章都保留 claim 到原文的映射。",
      "",
      "我觉得 agent 的核心是工具设计，不是 prompt。",
    ].join("\n"),
    "utf8",
  );
  const dbDir = mkdtempSync(join(tmpdir(), "pi-mirror-db-"));
  const db = openDb(join(dbDir, "test.db"));
  return { vault, db };
}

describe("persona extraction", () => {
  it("extracts traits with evidence and renders a persona card", () => {
    const { vault, db } = setup();
    try {
      indexVault(db, vault);
      const profile = ensureProfile(db);
      const stats = extractTraits(db, vault, profile.id);
      computeVoiceStats(db, vault, profile.id);

      expect(stats.traitsCreated).toBeGreaterThanOrEqual(2);
      expect(stats.evidenceCreated).toBe(stats.traitsCreated);

      const card = renderPersonaCard(db, profile.id);
      expect(card).toContain("Persona Card");
      expect(card).toContain("写作最重要的是证据");
      expect(card).toContain("禁忌");
      expect(card).toContain("语气指纹");

      // 句中「不是 prompt」不应把整条立场判成负向
      const stance = db
        .prepare("SELECT polarity FROM persona_traits WHERE kind = 'stance' AND text LIKE '%工具设计%'")
        .get() as { polarity: number } | undefined;
      expect(stance?.polarity).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it("computes voice features from the note body", () => {
    const { vault, db } = setup();
    try {
      indexVault(db, vault);
      const profile = ensureProfile(db);
      const stats = computeVoiceStats(db, vault, profile.id);

      expect(stats.sampleSentences).toBeGreaterThan(0);
      expect(stats.avgSentenceLen).toBeGreaterThan(0);
      expect(stats.firstPersonRate).toBeGreaterThan(0);

      const rows = db
        .prepare("SELECT feature FROM voice_features WHERE profile_id = ?")
        .all(profile.id) as Array<{ feature: string }>;
      expect(rows.map((row) => row.feature)).toContain("avgSentenceLen");
    } finally {
      db.close();
    }
  });
});
