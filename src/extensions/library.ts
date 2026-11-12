import { randomUUID } from "node:crypto";
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openDb } from "../db/sqlite.js";
import { listDrafts, listPublish } from "../server/data.js";
import { registerFeature } from "../features/registry.js";
import { asString, mirrorPaths, optionalString } from "../features/helpers.js";
import type { ConsentService, FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "library",
  label: "Library",
  zh: "草稿与发布",
  icon: "library",
  order: 60,
  nav: true,
  description: "Draft status and publish records. Publishing requires the Consent plugin.",
  tools: [],
  commands: ["drafts"],
  routes() {
    return [
      {
        method: "GET",
        path: "/api/publish",
        handler({ db }) {
          return { body: { drafts: listDrafts(db), records: listPublish(db) } };
        },
      },
      {
        method: "POST",
        path: "/api/drafts/status",
        handler({ db, body }) {
          const id = asString(body.id, "id", 120);
          const status = asString(body.status, "status", 40);
          if (!["draft", "reviewed", "approved", "published"].includes(status)) {
            return {
              status: 400,
              body: { error: "status must be draft, reviewed, approved or published." },
            };
          }
          const result = db
            .prepare("UPDATE drafts SET status = ?, updated_at = ? WHERE id = ?")
            .run(status, new Date().toISOString(), id);
          if (result.changes === 0) return { status: 404, body: { error: "Draft not found." } };
          return { body: { ok: true, drafts: listDrafts(db) } };
        },
      },
      {
        method: "POST",
        path: "/api/publish",
        handler({ db, body, service }) {
          const draftId = asString(body.draftId, "draftId", 120);
          const platform = asString(body.platform, "platform", 60);
          const url = optionalString(body.url, 500);

          // Resolved at request time. If the Consent plugin is not loaded, publishing fails closed.
          const consent = service<ConsentService>("consent");
          if (!consent?.isGranted("publishing")) {
            return {
              status: 403,
              body: {
                ok: false,
                error: "Publishing consent is off. Load the Consent plugin and grant it before recording a publish.",
              },
            };
          }

          const draft = db.prepare("SELECT id FROM drafts WHERE id = ?").get(draftId);
          if (!draft) return { status: 404, body: { ok: false, error: "Draft not found." } };

          const now = new Date().toISOString();
          const id = `pub_${randomUUID().slice(0, 8)}`;
          db.prepare(
            "INSERT INTO publish_records (id, draft_id, platform, url, published_at, metrics_json, created_at) VALUES (?, ?, ?, ?, ?, '{}', ?)",
          ).run(id, draftId, platform, url, now, now);
          db.prepare("UPDATE drafts SET status = 'published', updated_at = ? WHERE id = ?").run(now, draftId);

          return {
            status: 201,
            body: { ok: true, id, records: listPublish(db), drafts: listDrafts(db) },
          };
        },
      },
    ];
  },
  state({ db }) {
    return { drafts: listDrafts(db), publish: listPublish(db) };
  },
};

export default function library(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  pi.registerCommand("drafts", {
    description: "List recent drafts and their status.",
    handler: async (_args, ctx) => {
      const db = openDb(paths.dbPath);
      try {
        const drafts = listDrafts(db).slice(0, 8);
        if (!drafts.length) {
          ctx.ui.notify("No drafts yet. Run /draft <topic> or use the Write view.", "info");
          return;
        }
        const lines = drafts.map(
          (draft) => `${draft.id} · ${draft.status} · ${draft.platform} · ${draft.topic}`,
        );
        pi.sendMessage({ customType: "pi-mirror-drafts", content: lines.join("\n"), display: true });
      } finally {
        db.close();
      }
    },
  });
}
