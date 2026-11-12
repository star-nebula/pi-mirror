import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFeature } from "../features/registry.js";
import { asString, optionalString } from "../features/helpers.js";
import type { FeaturePlugin } from "../features/contract.js";
import type { ResearchService } from "../studio/services.js";
import { fetchPage, searchWeb, trendScan, verifyClaim } from "../studio/research.js";

function limitOf(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 1), 20);
}

const service: ResearchService = {
  search: (query, limit) => searchWeb(query, limit),
  fetch: (url) => fetchPage(url),
  verify: (claim) => verifyClaim(claim),
  trends: (options) => trendScan(options),
};

export const feature: FeaturePlugin = {
  id: "research",
  label: "Research",
  zh: "热点与核实",
  icon: "search",
  order: 70,
  nav: false,
  description: "Web search, page reading, trend scanning and claim verification for the Studio agent.",
  tools: ["trend_scan", "web_search", "fetch_page", "verify_claim"],
  commands: [],
  routes() {
    return [
      {
        method: "POST",
        path: "/api/research/search",
        async handler({ body }) {
          const query = asString(body.query, "query", 500);
          const results = await searchWeb(query, limitOf(body.limit, 6));
          return { body: { ok: true, query, results } };
        },
      },
      {
        method: "POST",
        path: "/api/research/fetch",
        async handler({ body }) {
          const url = asString(body.url, "url", 2000);
          const page = await fetchPage(url);
          return { body: { ok: true, page } };
        },
      },
      {
        method: "POST",
        path: "/api/research/verify",
        async handler({ body }) {
          const claim = asString(body.claim, "claim", 1000);
          const verdict = await verifyClaim(claim);
          return { body: { ok: true, verdict } };
        },
      },
      {
        method: "GET",
        path: "/api/research/trends",
        async handler({ url }) {
          const query = optionalString(url.searchParams.get("query"), 200) ?? undefined;
          const items = await trendScan({ query, limit: limitOf(url.searchParams.get("limit"), 8) });
          return { body: { ok: true, items } };
        },
      },
    ];
  },
  services() {
    return { research: service };
  },
};

export default function research(pi: ExtensionAPI) {
  registerFeature(feature);
}
