import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFeature } from "../features/registry.js";
import { asString, optionalString } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";
import type { ReferenceService, ResearchService } from "../studio/services.js";
import {
  analyzeReference,
  getReference,
  importReference,
  listReferences,
  searchReferences,
} from "../studio/reference.js";

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function limitOf(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 1), 50);
}

function serviceFor(db: Parameters<typeof listReferences>[0]): ReferenceService {
  return {
    list: (limit) => listReferences(db, limit),
    search: (query, options) => searchReferences(db, query, options),
    get: (id) => getReference(db, id),
    import: (input) => importReference(db, input),
  };
}

export const feature: FeaturePlugin = {
  id: "reference",
  label: "References",
  zh: "参考库",
  icon: "library",
  order: 71,
  nav: false,
  description: "A local library of social posts with engagement metrics and structure analysis.",
  tools: ["reference_search", "reference_analyze"],
  commands: [],
  routes(runtime) {
    return [
      {
        method: "GET",
        path: "/api/references",
        handler({ url }) {
          const query = optionalString(url.searchParams.get("query"), 300) ?? "";
          const platform = optionalString(url.searchParams.get("platform"), 60) ?? undefined;
          const limit = limitOf(url.searchParams.get("limit"), 20);
          const items = query
            ? searchReferences(runtime.db, query, { platform, limit })
            : listReferences(runtime.db, limit);
          const count = (
            runtime.db.prepare("SELECT COUNT(*) AS n FROM reference_notes").get() as { n: number }
          ).n;
          return { body: { ok: true, references: items, count } };
        },
      },
      {
        method: "POST",
        path: "/api/references",
        async handler({ body, service }) {
          let text = optionalString(body.body, 30000) ?? "";
          let title = optionalString(body.title, 300) ?? undefined;
          const url = optionalString(body.url, 2000) ?? undefined;
          if (!text && url) {
            const research = service<ResearchService>("research");
            if (!research) {
              return {
                status: 400,
                body: {
                  ok: false,
                  error: "Paste the post body, or load the research plugin so Pi-Mirror can fetch the URL.",
                },
              };
            }
            const page = await research.fetch(url);
            text = page.text;
            title = title || page.title;
          }
          if (!text.trim()) {
            return { status: 400, body: { ok: false, error: "A reference needs a body or a public URL." } };
          }
          const created = importReference(runtime.db, {
            platform: optionalString(body.platform, 60) ?? "unknown",
            url,
            author: optionalString(body.author, 120) ?? undefined,
            title,
            body: text,
            tags: Array.isArray(body.tags)
              ? body.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20)
              : [],
            followers: optionalNumber(body.followers),
            likes: optionalNumber(body.likes),
            collects: optionalNumber(body.collects),
            comments: optionalNumber(body.comments),
            postedAt: optionalString(body.postedAt, 80) ?? undefined,
          });
          return { status: 201, body: { ok: true, reference: created } };
        },
      },
      {
        method: "POST",
        path: "/api/references/analyze",
        handler({ body }) {
          const id = optionalString(body.id, 120);
          if (id) {
            const item = getReference(runtime.db, id);
            if (!item) return { status: 404, body: { ok: false, error: "Reference not found." } };
            return { body: { ok: true, reference: item } };
          }
          const text = asString(body.text, "text", 20000);
          return { body: { ok: true, analysis: analyzeReference({ title: optionalString(body.title, 300) ?? undefined, body: text }) } };
        },
      },
    ];
  },
  state(runtime) {
    const items = listReferences(runtime.db, 6);
    const count = (
      runtime.db.prepare("SELECT COUNT(*) AS n FROM reference_notes").get() as { n: number }
    ).n;
    return { referenceLibrary: { count, recent: items } };
  },
  services(runtime) {
    return { references: serviceFor(runtime.db) };
  },
};

export default function reference(pi: ExtensionAPI) {
  registerFeature(feature);
}
