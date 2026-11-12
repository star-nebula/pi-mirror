import { type ExtensionAPI, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { openDb } from "../db/sqlite.js";
import { guardWithDb } from "../persona/guard-db.js";
import { registerFeature } from "../features/registry.js";
import { asString, mirrorPaths } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "guard",
  label: "Guard",
  zh: "发布前检查",
  icon: "guard",
  order: 40,
  nav: true,
  description: "Evidence, taboo, tone and citation checks before anything ships.",
  tools: ["guard_text"],
  commands: ["guard"],
  routes() {
    return [
      {
        method: "POST",
        path: "/api/guard",
        handler({ guard, body }) {
          const text = asString(body.text, "text", 20000);
          return { body: guard(text) };
        },
      },
    ];
  },
};

export default function guard(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  const tool: ToolDefinition = {
    name: "guard_text",
    label: "Guard Text",
    description:
      "Check a draft against the owner's traits and voice: absolute claims, taboos, uncited claims, invented personal history, style distance and citation coverage.",
    parameters: Type.Object({
      text: Type.String({ description: "Draft or answer to check" }),
    }),
    async execute(_toolCallId, params) {
      const input = params as { text: string };
      const db = openDb(paths.dbPath);
      try {
        const report = guardWithDb(db, input.text);
        const lines = [
          `sentences: ${report.summary.sentences} · coverage: ${report.summary.coverage}% · checked traits: ${report.checkedTraits}`,
          `high: ${report.summary.high} · medium: ${report.summary.medium} · low: ${report.summary.low}`,
          ...report.findings.map(
            (finding) => `- [${finding.severity}] ${finding.title}: ${finding.detail}${finding.evidence ? ` (${finding.evidence})` : ""}`,
          ),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }], details: { summary: report.summary } };
      } finally {
        db.close();
      }
    },
  };
  pi.registerTool(tool);

  pi.registerCommand("guard", {
    description: "Check a draft against the persona. Usage: /guard <text>",
    handler: async (args, ctx) => {
      const text = args.trim();
      if (!text) {
        ctx.ui.notify("Usage: /guard <text>", "info");
        return;
      }
      const db = openDb(paths.dbPath);
      try {
        const report = guardWithDb(db, text);
        const lines = [
          `${report.summary.high} high · ${report.summary.medium} medium · ${report.summary.low} low · coverage ${report.summary.coverage}%`,
          ...report.findings.map((finding) => `- ${finding.title}: ${finding.detail}`),
        ];
        pi.sendMessage({
          customType: "pi-mirror-guard",
          content: lines.join("\n") || "No findings.",
          display: true,
        });
      } finally {
        db.close();
      }
    },
  });
}
