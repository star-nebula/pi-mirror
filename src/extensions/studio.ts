import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFeature } from "../features/registry.js";
import { asString, createDraft, optionalString } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";
import { createRun, getRun, listRuns, markStaleRuns, setDraftId, setRunStatus } from "../studio/store.js";
import type { StudioRunInput } from "../studio/types.js";

export const feature: FeaturePlugin = {
  id: "studio",
  label: "Studio",
  zh: "创作",
  icon: "spark",
  order: 5,
  nav: true,
  description:
    "A goal-driven content research agent: it decides what to check, what to read, what to draft and when to ask.",
  tools: [
    "update_plan",
    "trend_scan",
    "web_search",
    "fetch_page",
    "verify_claim",
    "note_search",
    "note_read",
    "note_recent",
    "stance_history",
    "reference_search",
    "reference_analyze",
    "guard_text",
    "submit_package",
  ],
  commands: [],
  routes(runtime) {
    markStaleRuns(runtime.db);
    return [
      {
        method: "POST",
        path: "/api/studio/runs",
        handler({ body, studioBusy, startStudio }) {
          if (studioBusy()) {
            return {
              status: 429,
              body: { ok: false, error: "A Studio run is already active. Wait for it to finish." },
            };
          }
          const goal = asString(body.goal, "goal", 2000);
          const platform = optionalString(body.platform, 60);
          const audience = optionalString(body.audience, 200);
          const runId = createRun(runtime.db, { goal, platform, audience });
          const input: StudioRunInput = { runId, goal, platform, audience };
          void startStudio(input).catch((error: unknown) => {
            setRunStatus(runtime.db, runId, "error", {
              error: error instanceof Error ? error.message : String(error),
              finished: true,
            });
          });
          return { status: 202, body: { ok: true, id: runId } };
        },
      },
      {
        method: "GET",
        path: "/api/studio/runs",
        handler({ url }) {
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 12, 1), 30);
          return { body: { ok: true, runs: listRuns(runtime.db, limit) } };
        },
      },
      {
        method: "GET",
        path: "/api/studio/run",
        handler({ url }) {
          const id = optionalString(url.searchParams.get("id"), 120);
          if (!id) return { status: 400, body: { ok: false, error: "id is required." } };
          const run = getRun(runtime.db, id);
          if (!run) return { status: 404, body: { ok: false, error: "Run not found." } };
          return { body: { ok: true, run } };
        },
      },
      {
        method: "POST",
        path: "/api/studio/save",
        handler({ body }) {
          const runId = asString(body.runId, "runId", 120);
          const run = getRun(runtime.db, runId);
          if (!run) return { status: 404, body: { ok: false, error: "Run not found." } };
          if (!run.package) {
            return { status: 409, body: { ok: false, error: "This run has no content package yet." } };
          }
          if (run.draftId) {
            return { body: { ok: true, id: run.draftId, alreadySaved: true } };
          }
          const created = createDraft(runtime.db, {
            content: run.package.body,
            topic: run.package.title,
            platform: optionalString(body.platform, 60) ?? run.package.platform,
            audience: run.package.audience,
          });
          setDraftId(runtime.db, runId, created.id);
          return { status: 201, body: { ok: true, id: created.id, topic: created.topic } };
        },
      },
    ];
  },
  state(runtime) {
    return {
      studio: {
        runs: listRuns(runtime.db, 6),
        active: runtime.studioBusy(),
      },
    };
  },
};

export default function studio(pi: ExtensionAPI) {
  registerFeature(feature);
}
