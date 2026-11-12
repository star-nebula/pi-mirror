import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openDb } from "../db/sqlite.js";
import { DEFAULT_PROFILE_ID } from "../persona/extract.js";
import { listTimeline, readProfile } from "../server/data.js";
import { registerFeature } from "../features/registry.js";
import { mirrorPaths } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "timeline",
  label: "Timeline",
  zh: "观点变化",
  icon: "timeline",
  order: 50,
  nav: true,
  description: "Observed stance changes, newest first, each tied to a note.",
  tools: [],
  commands: ["timeline"],
  routes() {
    return [
      {
        method: "GET",
        path: "/api/timeline",
        handler({ db }) {
          const timeline = listTimeline(db, readProfile(db)?.id ?? DEFAULT_PROFILE_ID);
          return { body: timeline.items };
        },
      },
    ];
  },
  state({ db }) {
    const timeline = listTimeline(db, readProfile(db)?.id ?? DEFAULT_PROFILE_ID);
    return {
      timeline: timeline.items,
      timelineKind: timeline.kind,
    };
  },
};

export default function timeline(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  pi.registerCommand("timeline", {
    description: "Show recent stance changes.",
    handler: async (_args, ctx) => {
      const db = openDb(paths.dbPath);
      try {
        const items = listTimeline(db, readProfile(db)?.id ?? DEFAULT_PROFILE_ID).items.slice(0, 8);
        if (!items.length) {
          ctx.ui.notify("No stance changes recorded yet.", "info");
          return;
        }
        const lines = items.map(
          (item) =>
            `${item.observedAt.slice(0, 10)} · ${item.kind === "stance_event" ? "change" : "observation"} · ${item.topic} (${item.polarity > 0 ? "+" : ""}${item.polarity})`,
        );
        pi.sendMessage({ customType: "pi-mirror-timeline", content: lines.join("\n"), display: true });
      } finally {
        db.close();
      }
    },
  });
}
