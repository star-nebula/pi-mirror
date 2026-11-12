import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { draftAsPersona } from "../persona/agent.js";
import { guardWithDb } from "../persona/guard-db.js";
import { openDb } from "../db/sqlite.js";
import { readProfile } from "../server/data.js";
import { registerFeature } from "../features/registry.js";
import { asString, composeBrief, createDraft, mirrorPaths, optionalString } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "write",
  label: "Write",
  zh: "以我起草",
  icon: "write",
  order: 30,
  nav: true,
  description: "Draft from the vault with citations, then send the result through Guard.",
  tools: [],
  commands: ["draft"],
  routes() {
    return [
      {
        method: "POST",
        path: "/api/write",
        handler: async ({ draft, guard, body }) => {
          const brief = composeBrief(body);
          const answer = await draft(brief);
          const report = answer.answer ? guard(answer.answer) : null;
          return { body: { ok: !answer.error, ...answer, brief, guard: report } };
        },
      },
      {
        method: "POST",
        path: "/api/drafts",
        handler({ db, body }) {
          const content = asString(body.content, "content", 40000);
          const created = createDraft(db, {
            content,
            topic: optionalString(body.topic),
            platform: optionalString(body.platform),
            audience: optionalString(body.audience),
          });
          return { status: 201, body: { ok: true, id: created.id, topic: created.topic } };
        },
      },
    ];
  },
};

export default function write(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  pi.registerCommand("draft", {
    description: "Draft from the vault and save it to the library. Usage: /draft <topic>",
    handler: async (args, ctx) => {
      const topic = args.trim();
      if (!topic) {
        ctx.ui.notify("Usage: /draft <topic>", "info");
        return;
      }

      const db = openDb(paths.dbPath);
      try {
        const profileId = readProfile(db)?.id;
        ctx.ui.setStatus("pi-mirror-draft", "drafting…");
        const answer = await draftAsPersona(
          { ...paths, profileId },
          `Topic: ${topic}\nAudience: my regular readers\nPlatform: xiaohongshu\nAngle: a direct, evidence-backed take\nLength: 300–600 Chinese characters.`,
        );
        if (answer.error) {
          ctx.ui.notify(answer.error, "error");
          return;
        }
        const created = createDraft(db, { content: answer.answer, topic, platform: "xiaohongshu" });
        const report = guardWithDb(db, answer.answer);
        const summary = `Draft ${created.id} saved · ${answer.sources.length} sources · guard ${report.summary.high} high / ${report.summary.medium} medium`;
        ctx.ui.notify(summary, report.summary.high ? "warning" : "info");
        pi.sendMessage({ customType: "pi-mirror-draft", content: answer.answer, display: true });
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      } finally {
        ctx.ui.setStatus("pi-mirror-draft", undefined);
        db.close();
      }
    },
  });
}
