import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { askPersona } from "../persona/agent.js";
import { openDb } from "../db/sqlite.js";
import { readProfile } from "../server/data.js";
import { registerFeature } from "../features/registry.js";
import { asString, mirrorPaths } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "ask",
  label: "Ask",
  zh: "以我回答",
  icon: "ask",
  order: 20,
  nav: true,
  description: "First-person answers grounded in vault snippets, with numbered citations.",
  tools: [],
  commands: ["ask"],
  routes() {
    return [
      {
        method: "POST",
        path: "/api/ask",
        handler: async ({ ask, body }) => {
          const question = asString(body.question, "question", 2000);
          const { answer, entry } = await ask(question);
          return {
            body: {
              ok: !answer.error,
              ...answer,
              question,
              id: entry.id,
              at: entry.at,
            },
          };
        },
      },
      {
        method: "GET",
        path: "/api/history",
        handler({ history }) {
          return { body: history };
        },
      },
    ];
  },
};

export default function ask(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  pi.registerCommand("ask", {
    description: "Ask the persona agent a question. Usage: /ask <question>",
    handler: async (args, ctx) => {
      const question = args.trim();
      if (!question) {
        ctx.ui.notify("Usage: /ask <question>", "info");
        return;
      }

      const db = openDb(paths.dbPath);
      let profileId: string | undefined;
      try {
        profileId = readProfile(db)?.id;
      } finally {
        db.close();
      }

      ctx.ui.setStatus("pi-mirror-ask", "thinking…");
      try {
        const answer = await askPersona({ ...paths, profileId }, question);
        if (answer.error) {
          ctx.ui.notify(answer.error, "error");
          return;
        }
        const sources = answer.sources.length
          ? `\n\n${answer.sources.map((source) => `[${source.number}] ${source.path} · ${source.heading ?? source.title}`).join("\n")}`
          : "";
        pi.sendMessage({
          customType: "pi-mirror-ask",
          content: `${answer.answer}${sources}`,
          display: true,
        });
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      } finally {
        ctx.ui.setStatus("pi-mirror-ask", undefined);
      }
    },
  });
}
