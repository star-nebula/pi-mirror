import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { openDb, type DB } from "../db/sqlite.js";
import { indexVault } from "../vault/index.js";
import { searchVault } from "../vault/search.js";
import { proposeWrite } from "../vault/propose.js";
import { renderPersonaCard } from "../persona/card.js";

export interface VaultToolOptions {
  vaultRoot: string;
  dbPath: string;
}

function withDb<T>(dbPath: string, fn: (db: DB) => T): T {
  const db = openDb(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function readNoteAt(vaultRoot: string, relPath: string): string {
  const root = resolve(vaultRoot);
  const abs = resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`Path escapes vault root: ${relPath}`);
  }
  return readFileSync(abs, "utf8");
}

/**
 * The tools that make Pi-Mirror a pi plugin: the same definitions are
 * registered on the host session and handed to the persona agent session.
 */
export function createVaultTools(options: VaultToolOptions): ToolDefinition[] {
  const { vaultRoot, dbPath } = options;

  return [
    {
      name: "vault_index",
      label: "Vault Index",
      description: "Index the user's Markdown vault into the local Pi-Mirror SQLite store.",
      parameters: Type.Object({
        vaultRoot: Type.Optional(Type.String({ description: "Vault root; defaults to the configured vault" })),
        maxChars: Type.Optional(Type.Number({ default: 700 })),
      }),
      promptSnippet: "index a Markdown vault into the local SQLite store",
      async execute(_toolCallId, params) {
        const input = params as { vaultRoot?: string; maxChars?: number };
        const root = resolve(input.vaultRoot ?? vaultRoot);
        const stats = withDb(dbPath, (db) => indexVault(db, root, { maxChars: input.maxChars }));
        return {
          content: [{ type: "text", text: JSON.stringify({ vault: root, ...stats }, null, 2) }],
          details: { files: stats.files, chunks: stats.chunks },
        };
      },
    },
    {
      name: "vault_search",
      label: "Vault Search",
      description:
        "Search the user's Markdown vault. Returns snippets with note path, heading and line range. Chinese queries of 1–2 characters fall back to LIKE.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ default: 8 })),
      }),
      promptSnippet: "search the vault and get note paths with snippets",
      promptGuidelines: [
        "Call vault_search before making any claim about the user's notes.",
        "Cite results by their note path and line range.",
      ],
      async execute(_toolCallId, params) {
        const input = params as { query: string; limit?: number };
        const hits = withDb(dbPath, (db) => searchVault(db, input.query, input.limit ?? 8));
        return {
          content: [{ type: "text", text: JSON.stringify(hits, null, 2) }],
          details: { count: hits.length },
        };
      },
    },
    {
      name: "note_read",
      label: "Note Read",
      description: "Read a note from the vault by its relative path.",
      parameters: Type.Object({
        path: Type.String({ description: "Note path relative to the vault root" }),
      }),
      promptSnippet: "read a full note by relative path",
      async execute(_toolCallId, params) {
        const input = params as { path: string };
        const text = readNoteAt(vaultRoot, input.path);
        return {
          content: [{ type: "text", text }],
          details: { path: input.path, chars: text.length },
        };
      },
    },
    {
      name: "persona_card",
      label: "Persona Card",
      description: "Render the current persona card: values, stances, taboos, voice, with evidence counts.",
      parameters: Type.Object({
        profileId: Type.Optional(Type.String({ description: "Persona profile id; defaults to the latest" })),
        includeEvidence: Type.Optional(Type.Boolean({ default: true })),
      }),
      promptSnippet: "read the user's persona traits with evidence",
      async execute(_toolCallId, params) {
        const input = params as { profileId?: string; includeEvidence?: boolean };
        const card = withDb(dbPath, (db) =>
          renderPersonaCard(db, input.profileId, { includeEvidence: input.includeEvidence ?? true }),
        );
        return {
          content: [{ type: "text", text: card }],
          details: { profileId: input.profileId ?? "latest" },
        };
      },
    },
    {
      name: "propose_note",
      label: "Propose Note Write",
      description: "Create a reviewable diff for a note write. Nothing is written until the user approves.",
      parameters: Type.Object({
        targetPath: Type.String({ description: "Target note path relative to the vault root" }),
        content: Type.String({ description: "Full new note content" }),
        reason: Type.Optional(Type.String({ description: "Why this write is proposed" })),
      }),
      promptSnippet: "propose a note write as a reviewable diff",
      async execute(_toolCallId, params) {
        const input = params as { targetPath: string; content: string; reason?: string };
        const proposal = withDb(dbPath, (db) =>
          proposeWrite(db, vaultRoot, input.targetPath, input.content, input.reason ?? ""),
        );
        return {
          content: [{ type: "text", text: proposal.diff }],
          details: { id: proposal.id, targetPath: proposal.targetPath, status: proposal.status },
        };
      },
    },
  ];
}
