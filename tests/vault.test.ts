import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb } from "../src/db/sqlite.js";
import { indexVault } from "../src/vault/index.js";
import { searchVault } from "../src/vault/search.js";
import { applyProposal, proposeWrite } from "../src/vault/propose.js";

function tempVault(): string {
  const vault = mkdtempSync(join(tmpdir(), "pi-mirror-vault-"));
  mkdirSync(join(vault, "Knowledge"), { recursive: true });
  writeFileSync(
    join(vault, "Knowledge", "a.md"),
    "# 知识库\n\n知识库内容生产线需要证据。\n\n知识管理的价值在于复用。\n",
    "utf8",
  );
  return vault;
}

function tempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-mirror-db-"));
  return join(dir, "test.db");
}

describe("vault index and search", () => {
  it("indexes notes and finds 3-character Chinese queries via FTS5", () => {
    const vault = tempVault();
    const db = openDb(tempDb());
    try {
      const stats = indexVault(db, vault);
      expect(stats.files).toBe(1);
      expect(stats.chunks).toBeGreaterThan(0);

      const hits = searchVault(db, "知识库");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].notePath).toBe("Knowledge/a.md");
      expect(hits[0].start).toBeGreaterThanOrEqual(0);
    } finally {
      db.close();
    }
  });

  it("falls back to LIKE for 1–2 character Chinese queries", () => {
    const vault = tempVault();
    const db = openDb(tempDb());
    try {
      indexVault(db, vault);
      const hits = searchVault(db, "知识");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].text).toContain("知识");
    } finally {
      db.close();
    }
  });

  it("matches long multi-term Chinese queries by scoring each term", () => {
    const vault = tempVault();
    const db = openDb(tempDb());
    try {
      indexVault(db, vault);
      const hits = searchVault(db, "知识库 内容 生产线 证据");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].notePath).toBe("Knowledge/a.md");
    } finally {
      db.close();
    }
  });

  it("does not write a note until a proposal is applied", () => {
    const vault = tempVault();
    const db = openDb(tempDb());
    try {
      const target = "Knowledge/new.md";
      const proposal = proposeWrite(db, vault, target, "# New\n\ncontent");
      expect(proposal.diff).toContain("+content");
      expect(() => readFileSync(join(vault, target), "utf8")).toThrow();

      applyProposal(db, vault, proposal.id);
      expect(readFileSync(join(vault, target), "utf8")).toContain("content");
    } finally {
      db.close();
    }
  });

  it("rejects paths outside the vault root", () => {
    const vault = tempVault();
    const db = openDb(tempDb());
    try {
      expect(() => proposeWrite(db, vault, "../escape.md", "nope")).toThrow(/escapes/);
    } finally {
      db.close();
    }
  });
});
