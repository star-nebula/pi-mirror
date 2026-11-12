import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openDb } from "../db/sqlite.js";
import { ensureProfile, computeVoiceStats, extractTraits } from "../persona/extract.js";
import { registerFeature } from "../features/registry.js";
import { assertInside, mirrorPaths } from "../features/helpers.js";
import { searchVault } from "../vault/search.js";
import { indexVault } from "../vault/index.js";
import { readNoteAt } from "../tools/vault-tools.js";
import { createVaultTools } from "../tools/vault-tools.js";
import { basename } from "node:path";
import type { FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "vault",
  label: "Vault",
  zh: "笔记检索",
  icon: "library",
  order: 0,
  nav: false,
  description: "Markdown indexing, full-text search, note reading and write proposals.",
  tools: ["vault_index", "vault_search", "note_read", "propose_note"],
  commands: ["vault"],
  routes() {
    return [
      {
        method: "GET",
        path: "/api/search",
        handler({ db, url }) {
          const query = (url.searchParams.get("q") ?? "").trim();
          return { body: query ? searchVault(db, query, 12) : [] };
        },
      },
      {
        method: "GET",
        path: "/api/note",
        handler({ vaultRoot, url }) {
          const relPath = url.searchParams.get("path") ?? "";
          const abs = assertInside(vaultRoot, relPath);
          const text = readNoteAt(vaultRoot, relPath);
          return { body: { path: relPath, title: basename(abs, ".md"), text } };
        },
      },
      {
        method: "POST",
        path: "/api/index",
        handler({ db, vaultRoot, body }) {
          const requested = typeof body.vaultRoot === "string" ? body.vaultRoot : "";
          const root = requested ? assertInside(vaultRoot, requested) : vaultRoot;
          const index = indexVault(db, root, {
            maxChars:
              typeof body.maxChars === "number" ? Math.max(200, Math.min(4000, body.maxChars)) : undefined,
          });
          const profile = ensureProfile(db);
          const traits = extractTraits(db, root, profile.id);
          const voice = computeVoiceStats(db, root, profile.id);
          return {
            body: {
              ok: true,
              vault: root,
              index,
              traits,
              voice: { sampleSentences: voice.sampleSentences, sampleNotes: voice.sampleNotes },
            },
          };
        },
      },
    ];
  },
};

export default function vault(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  const names = new Set(feature.tools);
  for (const tool of createVaultTools(paths)) {
    if (names.has(tool.name)) pi.registerTool(tool);
  }

  pi.registerCommand("vault", {
    description: "Search the vault. Usage: /vault <query>",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /vault <query>", "info");
        return;
      }
      const db = openDb(paths.dbPath);
      try {
        const hits = searchVault(db, query, 6);
        if (!hits.length) {
          ctx.ui.notify("No notes matched.", "info");
          return;
        }
        const text = hits
          .map((hit, index) => `[${index + 1}] ${hit.notePath} · ${hit.heading ?? hit.title}\n${hit.text.slice(0, 240)}`)
          .join("\n\n");
        pi.sendMessage({ customType: "pi-mirror-vault", content: text, display: true });
      } finally {
        db.close();
      }
    },
  });
}
