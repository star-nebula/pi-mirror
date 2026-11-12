import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type AgentSession,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { DB } from "../db/sqlite.js";
import { DEFAULT_PROFILE_ID } from "../persona/extract.js";
import { guardWithDb } from "../persona/guard-db.js";
import type { GuardReport } from "../persona/guard.js";
import { listTimeline, readProfile } from "../server/data.js";
import { readNoteAt } from "../tools/vault-tools.js";
import { searchVault } from "../vault/search.js";
import {
  addClaim,
  addSource,
  closeOpenSteps,
  finishStep,
  appendStep,
  getRun,
  savePackage,
  setGuard,
  setPlan,
  setRunStatus,
} from "./store.js";
import { hashText, validatePackage } from "./validate.js";
import type {
  ClaimStatus,
  ContentPackage,
  PackageAngle,
  PackageClaim,
  PackageFormat,
  PackageReference,
  PackageVariant,
  PlanStatus,
  PlanStep,
  ReferenceView,
  SearchResult,
  StudioClaim,
  StudioSource,
} from "./types.js";
import type { ReferenceService, ResearchService } from "./services.js";

export interface StudioAgentOptions {
  db: DB;
  vaultRoot: string;
  runId: string;
  goal: string;
  platform: string | null;
  audience: string | null;
  research?: ResearchService;
  references?: ReferenceService;
}

interface Ledger {
  sources: Map<number, StudioSource>;
}

const TOOL_LABELS: Record<string, string> = {
  update_plan: "Update plan",
  trend_scan: "Scan trends",
  web_search: "Search the web",
  fetch_page: "Read a page",
  verify_claim: "Verify a claim",
  note_search: "Search notes",
  note_read: "Read a note",
  note_recent: "Recent notes",
  stance_history: "Stance history",
  reference_search: "Search references",
  reference_analyze: "Analyze a reference",
  guard_text: "Run Guard",
  submit_package: "Submit package",
};

const STUDIO_SYSTEM_PROMPT = `You are Pi-Mirror Studio, a content research agent working for the owner of a Markdown vault. The output is a social-media note, an article, or a video script (copy only — never video production).

You decide the path. Do not follow a fixed sequence. Use the tools you need, in the order the work requires, and stop when you have enough. The only fixed contracts are the ones below.

Hard contracts:
1. Facts need evidence. Call verify_claim before treating a public claim as true. Every factual sentence in the final body must carry a numbered citation [n] that maps to a note or web source returned by a tool, or be marked [inference]/[unknown]. Never invent a source number.
2. The owner's history is not yours to invent. Use note_search / note_read for their stance and material. Do not stage personal anecdotes that the notes do not contain.
3. Reference notes are for structure and rhythm, never for facts and never for sentences. If you use one, call reference_analyze and list its id in references_used. Similarity must stay low.
4. Call guard_text on the exact final body. If it reports high findings, revise the text and run guard_text again. submit_package rejects an unguarded body, a stale guard, or any remaining high finding.
5. Do not publish. Saving a draft is a separate user action. Publishing requires explicit consent and is never your call.
6. Ask only when a choice materially changes the piece. If you cannot ask, put the question in questions and state the assumption you used.
7. Keep the plan current with update_plan. The plan is yours; revise it as you learn.
8. Write in the language of the goal. Default to Chinese when the goal is Chinese.
9. Verify a claim at its primary source. For a product or company fact, fetch the official page (the company blog, docs, or filing) and read its wording. Do not widen the task into funding, valuation, or acquisition history unless the goal asks; a news snippet is not proof of a deal. If a search returns nothing useful, change the query or fetch a page you already have — do not repeat the same query.
10. Keep the evidence list small and used. Six sources you actually cite beat thirty collected. Do not search bare numbers or encyclopedia and dictionary pages for facts.

Useful strategies (examples, not a required order):
- Hot topic: trend_scan -> fetch_page / verify_claim -> note_search for the owner's stance -> reference_search for structure -> pick 2-3 angles -> draft -> guard -> submit.
- Own material: note_recent -> note_search -> stance_history -> optional trend_scan -> angles -> draft -> guard -> submit.
- Repurpose: note_read an old piece -> reference_search -> rewrite for the target platform -> guard -> submit.

When you are ready, call submit_package exactly once. Do not print the package in a chat message. Put the final piece in body, with citations. Keep title_options to 3 or fewer. If the user asked for two platforms, put the second version in variants.`;

function textResult(text: string, details: Record<string, unknown> = {}): {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
} {
  return { content: [{ type: "text", text }], details };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizePlan(value: unknown): PlanStep[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { steps?: unknown }).steps)
      ? ((value as { steps: unknown[] }).steps)
      : [];
  const allowed = new Set<PlanStatus>(["pending", "active", "done", "skipped"]);
  return raw
    .map((item, index) => {
      if (typeof item === "string") {
        return { title: item.trim(), status: (index === 0 ? "active" : "pending") as PlanStatus };
      }
      if (!item || typeof item !== "object") return null;
      const record = item as { title?: unknown; status?: unknown };
      const title = asString(record.title);
      if (!title) return null;
      const status = allowed.has(record.status as PlanStatus) ? (record.status as PlanStatus) : "pending";
      return { title, status };
    })
    .filter((item): item is PlanStep => Boolean(item))
    .slice(0, 12);
}

function normalizeAngles(value: unknown): PackageAngle[] {
  if (!Array.isArray(value)) return [];
  const angles: PackageAngle[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { title?: unknown; rationale?: unknown; evidence?: unknown; risk?: unknown };
    const title = asString(record.title);
    if (!title) continue;
    angles.push({
      title,
      rationale: asString(record.rationale),
      evidence: Array.isArray(record.evidence)
        ? record.evidence.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
      risk: asString(record.risk) || undefined,
    });
    if (angles.length >= 5) break;
  }
  return angles;
}

function normalizeClaims(value: unknown): PackageClaim[] {
  if (!Array.isArray(value)) return [];
  const statuses = new Set<ClaimStatus>([
    "confirmed",
    "single-source",
    "disputed",
    "unverified",
    "stale",
    "opinion",
  ]);
  const claimsOut: PackageClaim[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { text?: unknown; status?: unknown; confidence?: unknown; sources?: unknown };
    const text = asString(record.text);
    const status = record.status as ClaimStatus;
    if (!text || !statuses.has(status)) continue;
    claimsOut.push({
      text,
      status,
      confidence: asString(record.confidence) || undefined,
      sources: Array.isArray(record.sources)
        ? record.sources.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [],
    });
    if (claimsOut.length >= 30) break;
  }
  return claimsOut;
}

function normalizeReferences(value: unknown): PackageReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { id: item.trim() };
      if (!item || typeof item !== "object") return null;
      const record = item as { id?: unknown; pattern?: unknown };
      const id = asString(record.id);
      return id ? { id, pattern: asString(record.pattern) || undefined } : null;
    })
    .filter((item): item is PackageReference => Boolean(item))
    .slice(0, 10);
}

function normalizeVariants(value: unknown): PackageVariant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as { platform?: unknown; body?: unknown };
      const platform = asString(record.platform);
      const body = asString(record.body);
      return platform && body ? { platform, body } : null;
    })
    .filter((item): item is PackageVariant => Boolean(item))
    .slice(0, 4);
}

function sourceLine(source: StudioSource): string {
  const bits = [`[${source.number}]`, source.kind];
  if (source.publishedAt) bits.push(source.publishedAt.slice(0, 10));
  if (source.locator) bits.push(source.locator);
  return bits.join(" · ");
}

function summarizeArgs(name: string, args: unknown): string {
  const record = (args ?? {}) as Record<string, unknown>;
  if (name === "submit_package") return "final package";
  if (name === "guard_text") return `${asString(record.text).length} chars`;
  if (name === "update_plan") return `${normalizePlan(args).length} steps`;
  if (name === "web_search" || name === "note_search" || name === "reference_search") {
    return asString(record.query).slice(0, 120);
  }
  if (name === "fetch_page" || name === "note_read") return asString(record.url ?? record.path).slice(0, 160);
  if (name === "verify_claim") return asString(record.claim).slice(0, 160);
  if (name === "trend_scan") return asString(record.query) || "all sources";
  if (name === "reference_analyze") return asString(record.id);
  return "";
}

function summarizeResult(result: unknown): string {
  const record = result as { content?: Array<{ type?: string; text?: string }> };
  const text = (record?.content ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
  return text.replace(/\s+/g, " ").trim().slice(0, 420);
}


export async function runStudioAgent(options: StudioAgentOptions): Promise<void> {
  const { db, runId, goal } = options;
  const profileId = readProfile(db)?.id ?? DEFAULT_PROFILE_ID;
  const ledger: Ledger = { sources: new Map() };
  const usedReferences = new Map<string, ReferenceView>();
  const claims: StudioClaim[] = [];
  let plan: PlanStep[] = [];
  let guard: GuardReport | null = null;
  let guardHash: string | null = null;
  let submitted: ContentPackage | null = null;
  const activeSteps = new Map<string, number>();

  setRunStatus(db, runId, "running");

  const addWebSource = (result: SearchResult): StudioSource => {
    const source = addSource(db, runId, {
      kind: "web",
      title: result.title || result.url,
      locator: result.url,
      quote: result.snippet || null,
      publishedAt: null,
      metadata: { source: result.source },
    });
    ledger.sources.set(source.number, source);
    return source;
  };

  const addNoteSource = (input: {
    path: string;
    title: string;
    quote: string;
    heading?: string | null;
    line?: string | null;
  }): StudioSource => {
    const source = addSource(db, runId, {
      kind: "note",
      title: input.title || input.path,
      locator: input.path,
      quote: input.quote,
      publishedAt: null,
      metadata: { heading: input.heading ?? null, line: input.line ?? null, path: input.path },
    });
    ledger.sources.set(source.number, source);
    return source;
  };

  const tools: ToolDefinition[] = [
    {
      name: "update_plan",
      label: "Update Plan",
      description:
        "Write or revise your own short plan. The UI shows it. Use status pending / active / done / skipped. The plan is not a required sequence.",
      parameters: Type.Object({
        steps: Type.Array(
          Type.Object({
            title: Type.String({ description: "One short step" }),
            status: Type.Optional(Type.String({ description: "pending, active, done or skipped" })),
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        plan = normalizePlan(params);
        if (!plan.length) return textResult("Plan is empty. Provide at least one step.");
        setPlan(db, runId, plan);
        return textResult(`Plan updated (${plan.length} steps).`);
      },
    },
  ];

  if (options.research) {
    const research = options.research;
    tools.push(
      {
        name: "trend_scan",
        label: "Trend Scan",
        description:
          "Scan current trend sources (x.com snapshot packs plus Techmeme RSS). Returns headlines, heat and links. A trend is a lead, not evidence: verify before using.",
        parameters: Type.Object({
          query: Type.Optional(Type.String({ description: "Optional topic filter" })),
          limit: Type.Optional(Type.Number({ default: 8 })),
        }),
        async execute(_toolCallId, params) {
          const input = params as { query?: string; limit?: number };
          const items = await research.trends({ query: input.query, limit: input.limit });
          if (!items.length) return textResult("No trend items matched. Use web_search or the owner's notes.");
          const lines = items.map((item, index) => {
            const bits = [`${index + 1}. ${item.title}`, `   ${item.source}${item.heat ? ` · ${item.heat}` : ""}`];
            if (item.url) bits.push(`   ${item.url}`);
            if (item.summary) bits.push(`   ${item.summary.slice(0, 320)}`);
            for (const post of item.posts ?? []) {
              bits.push(`   post: ${post.author ?? "unknown"} ${post.url ?? ""} ${post.text?.slice(0, 220) ?? ""}`);
            }
            return bits.join("\n");
          });
          return textResult(lines.join("\n\n"));
        },
      },
      {
        name: "web_search",
        label: "Web Search",
        description:
          "Search the public web. Returns numbered results you can cite. Search entities and product names, never a bare number: a query like \"11\" returns Windows 11 pages. A one-word query is usually too broad. Snippets are leads; use fetch_page or verify_claim before treating a detail as fact.",
        parameters: Type.Object({
          query: Type.String({ description: "Search query; include date or product name when useful" }),
          limit: Type.Optional(Type.Number({ default: 6 })),
        }),
        async execute(_toolCallId, params) {
          const input = params as { query: string; limit?: number };
          const results = await research.search(input.query, input.limit);
          if (!results.length) return textResult("No results. Try a different query.");
          return textResult(
            results
              .map((result) => {
                const source = addWebSource(result);
                return `[${source.number}] ${result.title}\n${result.url}\n${result.snippet}`;
              })
              .join("\n\n"),
          );
        },
      },
      {
        name: "fetch_page",
        label: "Fetch Page",
        description:
          "Fetch a public URL and return readable text with a citation number. Use it for the primary source, not just a search snippet. Private network URLs are rejected.",
        parameters: Type.Object({ url: Type.String({ description: "Public http(s) URL" }) }),
        async execute(_toolCallId, params) {
          const input = params as { url: string };
          const page = await research.fetch(input.url);
          const source = addSource(db, runId, {
            kind: "web",
            title: page.title || page.url,
            locator: page.url,
            quote: page.quote,
            publishedAt: page.publishedAt,
            metadata: { site: page.site },
          });
          ledger.sources.set(source.number, source);
          const header = `[${source.number}] ${page.title}\n${page.url}${page.publishedAt ? `\npublished: ${page.publishedAt}` : ""}`;
          return textResult(`${header}\n\n${page.text.slice(0, 14000)}`);
        },
      },
      {
        name: "verify_claim",
        label: "Verify Claim",
        description:
          "Heuristically check one factual claim against public search results. Returns confirmed / single-source / disputed / unverified, with numbered sources. It is not a truth oracle: read the sources.",
        parameters: Type.Object({ claim: Type.String({ description: "One factual claim, in one sentence" }) }),
        async execute(_toolCallId, params) {
          const input = params as { claim: string };
          const verdict = await research.verify(input.claim);
          const numbers: number[] = [];
          for (const result of verdict.sources) {
            const source = addWebSource(result);
            numbers.push(source.number);
          }
          const claim = addClaim(db, runId, {
            text: verdict.claim,
            status: verdict.status,
            confidence: verdict.confidence,
            sources: numbers,
          });
          claims.push(claim);
          const lines = [
            `status: ${verdict.status}`,
            `confidence: ${verdict.confidence}`,
            `note: ${verdict.note}`,
            verdict.sources.length ? "sources:" : "sources: none",
            ...verdict.sources.map((result, index) => {
              const number = numbers[index];
              return `[${number}] ${result.title}\n    ${result.url}\n    ${result.snippet.slice(0, 240)}`;
            }),
          ];
          return textResult(lines.join("\n"));
        },
      },
    );
  }

  tools.push(
    {
      name: "note_search",
      label: "Note Search",
      description:
        "Search the owner's indexed Markdown vault. Returns numbered snippets. Use these for the owner's stance, material and voice; cite them like web sources.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ default: 6 })),
      }),
      async execute(_toolCallId, params) {
        const input = params as { query: string; limit?: number };
        const hits = searchVault(db, input.query, Math.min(input.limit ?? 6, 10));
        if (!hits.length) return textResult("No notes matched. The vault does not cover this query.");
        const lines: string[] = [];
        for (const hit of hits) {
          const source = addNoteSource({
            path: hit.notePath,
            title: hit.title,
            quote: hit.text.replace(/\s+/g, " ").trim().slice(0, 500),
            heading: hit.heading,
            line: `L${hit.start + 1}-L${hit.end + 1}`,
          });
          lines.push(
            `[${source.number}] ${hit.notePath} · ${hit.heading ?? hit.title} · L${hit.start + 1}-L${hit.end + 1}`,
            hit.text.replace(/\s+/g, " ").trim().slice(0, 700),
            "",
          );
        }
        return textResult(lines.join("\n"));
      },
    },
    {
      name: "note_read",
      label: "Note Read",
      description: "Read one note by vault-relative path. Returns a citation number and the full note.",
      parameters: Type.Object({ path: Type.String({ description: "Vault-relative path" }) }),
      async execute(_toolCallId, params) {
        const input = params as { path: string };
        const text = readNoteAt(options.vaultRoot, input.path);
        const source = addNoteSource({
          path: input.path,
          title: input.path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? input.path,
          quote: text.replace(/\s+/g, " ").trim().slice(0, 500),
          heading: null,
          line: "full note",
        });
        return textResult(`[${source.number}] full note · ${input.path}\n\n${text.slice(0, 14000)}`);
      },
    },
    {
      name: "note_recent",
      label: "Recent Notes",
      description: "List recently updated notes. Use it to notice what the owner is thinking about right now.",
      parameters: Type.Object({
        days: Type.Optional(Type.Number({ default: 30 })),
        limit: Type.Optional(Type.Number({ default: 12 })),
      }),
      async execute(_toolCallId, params) {
        const input = params as { days?: number; limit?: number };
        const days = Math.min(Math.max(input.days ?? 30, 1), 3650);
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const rows = db
          .prepare(
            `SELECT path, title, updated_at AS updatedAt FROM notes
             WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT ?`,
          )
          .all(since, Math.min(input.limit ?? 12, 30)) as Array<{
          path: string;
          title: string;
          updatedAt: string;
        }>;
        if (!rows.length) return textResult(`No notes updated in the last ${days} days. Try note_search.`);
        return textResult(
          rows.map((row) => `${row.updatedAt.slice(0, 10)} · ${row.title} · ${row.path}`).join("\n"),
        );
      },
    },
    {
      name: "stance_history",
      label: "Stance History",
      description: "Read the owner's recorded stance changes, optionally filtered by topic. Use it to avoid writing against their current view.",
      parameters: Type.Object({
        topic: Type.Optional(Type.String({ description: "Optional topic filter" })),
        limit: Type.Optional(Type.Number({ default: 12 })),
      }),
      async execute(_toolCallId, params) {
        const input = params as { topic?: string; limit?: number };
        const result = listTimeline(db, profileId, Math.min(input.limit ?? 12, 40));
        const filtered = input.topic
          ? result.items.filter((item) => item.topic.toLowerCase().includes(input.topic!.toLowerCase()))
          : result.items;
        if (!filtered.length) return textResult("No stance history matched. The persona may not have recorded this topic yet.");
        return textResult(
          filtered
            .map(
              (item) =>
                `${item.observedAt.slice(0, 10)} · ${item.topic} · polarity ${item.polarity} · confidence ${item.confidence}` +
                (item.quote ? `\n  “${item.quote.slice(0, 220)}”` : ""),
            )
            .join("\n"),
        );
      },
    },
  );

  if (options.references) {
    const references = options.references;
    tools.push(
      {
        name: "reference_search",
        label: "Reference Search",
        description:
          "Search the local reference library of social posts. Returns structure and engagement signals. References are style examples, never factual sources.",
        parameters: Type.Object({
          query: Type.String({ description: "Topic or format to look for" }),
          platform: Type.Optional(Type.String({ description: "Optional platform filter" })),
          limit: Type.Optional(Type.Number({ default: 6 })),
        }),
        async execute(_toolCallId, params) {
          const input = params as { query: string; platform?: string; limit?: number };
          const items = references.search(input.query, { platform: input.platform, limit: input.limit });
          if (!items.length) {
            return textResult(
              "No reference notes matched. Continue without them, or ask the user to import 2-3 examples.",
            );
          }
          return textResult(
            items
              .map(
                (item) =>
                  `${item.id} · ${item.platform} · ${item.title}\n` +
                  `  engagement ${item.engagement} · follower tier ${item.followerTier}` +
                  (item.engagementPerFollower !== null ? ` · per follower ${item.engagementPerFollower}` : "") +
                  `\n  patterns: ${item.patterns.join(" / ") || "none detected"}\n  hook: ${item.hook.slice(0, 220)}`,
              )
              .join("\n\n"),
          );
        },
      },
      {
        name: "reference_analyze",
        label: "Reference Analyze",
        description:
          "Read one reference note's structure: hook, rhythm, lists, questions, CTA, keywords. Borrow the pattern, never the sentences; add its id to references_used.",
        parameters: Type.Object({ id: Type.String({ description: "Reference id from reference_search" }) }),
        async execute(_toolCallId, params) {
          const input = params as { id: string };
          const item = references.get(input.id);
          if (!item) return textResult(`Reference ${input.id} not found.`);
          usedReferences.set(item.id, item);
          return textResult(
            [
              `${item.id} · ${item.platform} · ${item.title}`,
              `author: ${item.author ?? "unknown"} · followers: ${item.followers ?? "unknown"} · likes: ${item.likes ?? "unknown"} · collects: ${item.collects ?? "unknown"} · comments: ${item.comments ?? "unknown"}`,
              `patterns: ${item.patterns.join(" / ") || "none detected"}`,
              `stats: ${JSON.stringify(item.stats)}`,
              `hook: ${item.hook}`,
              `keywords: ${item.keywords.join(", ")}`,
              `body preview:\n${item.body.slice(0, 1400)}`,
            ].join("\n"),
          );
        },
      },
    );
  }

  tools.push(
    {
      name: "guard_text",
      label: "Guard Text",
      description:
        "Check a draft against the owner's traits, voice and recorded claims. Run it on the exact final body. Fix high findings and run it again.",
      parameters: Type.Object({ text: Type.String({ description: "The exact body you plan to submit" }) }),
      async execute(_toolCallId, params) {
        const input = params as { text: string };
        const report = guardWithDb(db, input.text, {
          claims: claims.map((claim) => ({
            text: claim.text,
            status: claim.status,
            confidence: claim.confidence,
          })),
        });
        guard = report;
        guardHash = hashText(input.text);
        setGuard(db, runId, report);
        const lines = [
          `coverage: ${report.summary.coverage}% · sentences: ${report.summary.sentences}`,
          `high: ${report.summary.high} · medium: ${report.summary.medium} · low: ${report.summary.low}`,
          ...report.findings.map(
            (finding) =>
              `- [${finding.severity}] ${finding.title}: ${finding.detail}${finding.evidence ? ` (${finding.evidence})` : ""}`,
          ),
        ];
        return textResult(lines.join("\n"));
      },
    },
    {
      name: "submit_package",
      label: "Submit Package",
      description:
        "Submit the final content package. Requires a guard_text run on this exact body with zero high findings. Includes the chosen angle, 2-3 alternatives, title options, claims, references used, questions and risks.",
      parameters: Type.Object({
        title: Type.String({ description: "Working title" }),
        angle: Type.String({ description: "The chosen angle in one sentence" }),
        why_now: Type.String({ description: "Why this piece now" }),
        audience: Type.Optional(Type.String()),
        platform: Type.Optional(Type.String()),
        format: Type.Optional(Type.String({ description: "note, article or script" })),
        body: Type.String({ description: "Final body in Markdown, with [n] citations" }),
        title_options: Type.Optional(Type.Array(Type.String())),
        angles: Type.Optional(
          Type.Array(
            Type.Object({
              title: Type.String(),
              rationale: Type.String(),
              evidence: Type.Optional(Type.Array(Type.Number())),
              risk: Type.Optional(Type.String()),
            }),
          ),
        ),
        chosen_angle: Type.Optional(Type.String()),
        claims: Type.Optional(
          Type.Array(
            Type.Object({
              text: Type.String(),
              status: Type.String(),
              confidence: Type.Optional(Type.String()),
              sources: Type.Optional(Type.Array(Type.Number())),
            }),
          ),
        ),
        references_used: Type.Optional(
          Type.Array(
            Type.Object({
              id: Type.String(),
              pattern: Type.Optional(Type.String()),
            }),
          ),
        ),
        questions: Type.Optional(Type.Array(Type.String())),
        risks: Type.Optional(Type.Array(Type.String())),
        variants: Type.Optional(
          Type.Array(
            Type.Object({
              platform: Type.String(),
              body: Type.String(),
            }),
          ),
        ),
      }),
      async execute(_toolCallId, params) {
        const input = params as Record<string, unknown>;
        const formatRaw = asString(input.format, "note") as PackageFormat;
        const format: PackageFormat = ["note", "article", "script"].includes(formatRaw) ? formatRaw : "note";
        const packageClaims = normalizeClaims(input.claims);
        const pkg: ContentPackage = {
          title: asString(input.title),
          angle: asString(input.angle),
          whyNow: asString(input.why_now ?? input.whyNow),
          audience: asString(input.audience) || options.audience || "my readers",
          platform: asString(input.platform) || options.platform || "xiaohongshu",
          format,
          body: asString(input.body),
          titleOptions: asStringArray(input.title_options ?? input.titleOptions).slice(0, 5),
          angles: normalizeAngles(input.angles),
          chosenAngle: asString(input.chosen_angle ?? input.chosenAngle) || asString(input.angle),
          claims:
            packageClaims.length > 0
              ? packageClaims
              : claims.map((claim) => ({
                  text: claim.text,
                  status: claim.status,
                  confidence: claim.confidence,
                  sources: claim.sources,
                })),
          referencesUsed: normalizeReferences(input.references_used ?? input.referencesUsed),
          questions: asStringArray(input.questions).slice(0, 8),
          risks: asStringArray(input.risks).slice(0, 8),
          variants: normalizeVariants(input.variants),
        };

        const run = getRun(db, runId);
        const sources = run?.sources ?? [...ledger.sources.values()];
        const references = [...usedReferences.values()];
        const validation = validatePackage({
          pkg,
          sources,
          claims,
          references,
          guard,
          guardHash,
          bodyHash: hashText(pkg.body),
        });
        if (!validation.ok) {
          return textResult(
            [
              "Package rejected. Fix these and call submit_package again:",
              ...validation.errors.map((error) => `- ${error}`),
              validation.warnings.length ? "Warnings:" : "",
              ...validation.warnings.map((warning) => `- ${warning}`),
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }

        plan = plan.map((step) =>
          step.status === "pending" || step.status === "active" ? { ...step, status: "done" as const } : step,
        );
        setPlan(db, runId, plan);
        savePackage(db, runId, pkg, guard!);
        submitted = pkg;
        return textResult(
          [
            `Package accepted: ${pkg.title}`,
            `sources: ${sources.length} · references: ${pkg.referencesUsed.length} · guard: ${guard!.summary.high} high`,
            ...validation.warnings.map((warning) => `warning: ${warning}`),
            "The run is complete. Stop here.",
          ].join("\n"),
        );
      },
    },
  );

  const loader = new DefaultResourceLoader({
    cwd: options.vaultRoot,
    agentDir: getAgentDir(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: STUDIO_SYSTEM_PROMPT,
  });

  let session: AgentSession | undefined;
  let timedOut = false;
  try {
    const created = await createAgentSession({
      cwd: options.vaultRoot,
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      customTools: tools,
      tools: tools.map((tool) => tool.name),
    });
    session = created.session;

    session.subscribe((event) => {
      if (event.type === "tool_execution_start") {
        const stepId = appendStep(db, runId, {
          toolCallId: event.toolCallId,
          tool: event.toolName,
          title: TOOL_LABELS[event.toolName] ?? event.toolName,
          detail: summarizeArgs(event.toolName, event.args),
          payload: event.toolName === "submit_package" ? {} : event.args,
        });
        if (event.toolCallId) activeSteps.set(event.toolCallId, stepId);
      } else if (event.type === "tool_execution_end") {
        const stepId = event.toolCallId ? activeSteps.get(event.toolCallId) : undefined;
        if (stepId !== undefined) {
          finishStep(db, stepId, {
            status: event.isError ? "error" : "ok",
            detail: summarizeResult(event.result),
            durationMs: event.durationMs ?? null,
          });
          if (event.toolCallId) activeSteps.delete(event.toolCallId);
        }
      } else if (event.type === "auto_retry_start") {
        appendStep(db, runId, {
          kind: "notice",
          title: "Retry",
          detail: `Attempt ${event.attempt}/${event.maxAttempts}: ${event.errorMessage}`,
        });
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      void session?.abort();
    }, Number(process.env.PI_MIRROR_STUDIO_TIMEOUT_MS ?? 6 * 60 * 1000));

    try {
      await session.prompt(
        [
          `Goal: ${goal}`,
          options.platform ? `Platform: ${options.platform}` : "",
          options.audience ? `Audience: ${options.audience}` : "",
          `Today: ${new Date().toISOString().slice(0, 10)}`,
          "Start by writing a short plan with update_plan. Then do the research the goal actually needs. Do not follow a fixed sequence.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } finally {
      clearTimeout(timer);
    }

    if (!submitted) {
      throw new Error(
        timedOut
          ? "The run timed out before submit_package."
          : "The agent finished without submit_package. It must submit a package to finish.",
      );
    }

    closeOpenSteps(db, runId, "ok");
    setRunStatus(db, runId, "done", {
      model: session.model?.id ?? null,
      finished: true,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    closeOpenSteps(db, runId, "error");
    setRunStatus(db, runId, "error", {
      error: message,
      model: session?.model?.id ?? null,
      finished: true,
    });
  } finally {
    session?.dispose();
  }
}
