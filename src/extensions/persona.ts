import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openDb } from "../db/sqlite.js";
import { DEFAULT_PROFILE_ID } from "../persona/extract.js";
import { renderPersonaCard } from "../persona/card.js";
import { readProfile, listTraits, listVoice } from "../server/data.js";
import { registerFeature } from "../features/registry.js";
import { asString, mirrorPaths } from "../features/helpers.js";
import { createVaultTools } from "../tools/vault-tools.js";
import type { FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "persona",
  label: "Persona",
  zh: "身份模型",
  icon: "persona",
  order: 10,
  nav: true,
  description: "Traits, confidence and evidence, with a human review queue.",
  tools: ["persona_card"],
  commands: ["persona"],
  routes() {
    return [
      {
        method: "GET",
        path: "/api/persona",
        handler({ db }) {
          const profile = readProfile(db);
          const profileId = profile?.id ?? DEFAULT_PROFILE_ID;
          return {
            body: {
              profile,
              traits: listTraits(db, profileId),
              voice: listVoice(db, profileId),
            },
          };
        },
      },
      {
        method: "POST",
        path: "/api/traits/status",
        handler({ db, body }) {
          const id = asString(body.id, "id", 120);
          const status = asString(body.status, "status", 40);
          if (!["candidate", "confirmed", "rejected", "outdated"].includes(status)) {
            return {
              status: 400,
              body: { error: "status must be candidate, confirmed, rejected or outdated." },
            };
          }
          const result = db.prepare("UPDATE persona_traits SET status = ? WHERE id = ?").run(status, id);
          if (result.changes === 0) return { status: 404, body: { error: "Trait not found." } };
          return { body: { ok: true, id, status } };
        },
      },
    ];
  },
  state({ db }) {
    const profile = readProfile(db);
    const profileId = profile?.id ?? DEFAULT_PROFILE_ID;
    return {
      profile,
      traits: listTraits(db, profileId),
      voice: listVoice(db, profileId),
    };
  },
};

export default function persona(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  for (const tool of createVaultTools(paths)) {
    if (tool.name === "persona_card") pi.registerTool(tool);
  }

  pi.registerCommand("persona", {
    description: "Print the reviewed persona card.",
    handler: async (_args, ctx) => {
      const db = openDb(paths.dbPath);
      try {
        const profile = readProfile(db);
        const card = renderPersonaCard(db, profile?.id, { includeEvidence: false, maxPerKind: 6 });
        pi.sendMessage({ customType: "pi-mirror-persona", content: card, display: true });
      } finally {
        db.close();
      }
    },
  });
}
