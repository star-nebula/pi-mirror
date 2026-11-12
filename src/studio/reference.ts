import { randomUUID } from "node:crypto";
import type { DB } from "../db/sqlite.js";
import type { ReferenceAnalysis, ReferenceInput, ReferenceView } from "./types.js";

interface ReferenceRow {
  id: string;
  platform: string;
  url: string | null;
  author: string | null;
  title: string;
  body: string;
  tags_json: string;
  followers: number | null;
  likes: number | null;
  collects: number | null;
  comments: number | null;
  posted_at: string | null;
  imported_at: string;
  analysis_json: string;
}

const EMOJI = /[\u{1f300}-\u{1faff}\u{2600}-\u{27bf}]/gu;
const CTA = /评论区|收藏|关注|转发|点赞|主页|私信|链接|comment|follow|save|share|subscribe/i;
const ANECDOTE = /我以前|去年|那年|有一次|曾经|当时|后来|刚工作|上大学|小时候/i;
const CONTRAST = /不是[^。！？!?]{1,20}而是|你以为[^。！？!?]{1,20}其实|反而|恰恰相反/i;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function splitReferenceSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenizeKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  const cleaned = text.toLowerCase().replace(/[^㐀-鿿a-z0-9]+/g, " ");
  for (const word of cleaned.match(/[a-z][a-z0-9-]{3,}/g) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const cjk = text.replace(/[^㐀-鿿]/g, "");
  for (let index = 0; index < cjk.length - 1; index += 1) {
    const bigram = cjk.slice(index, index + 2);
    if (bigram.length === 2) counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  const stop = new Set([
    "一个",
    "这个",
    "那个",
    "我们",
    "他们",
    "可以",
    "就是",
    "不是",
    "自己",
    "什么",
    "因为",
    "所以",
    "但是",
    "没有",
    "已经",
    "还是",
  ]);
  return [...counts.entries()]
    .filter(([term, count]) => count >= 2 && !stop.has(term))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([term]) => term);
}

export function analyzeReference(input: { title?: string; body: string }): ReferenceAnalysis {
  const body = input.body.trim();
  const sentences = splitReferenceSentences(body);
  const paragraphs = body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const listLines = body
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*]|\d+[.、)])\s+/.test(line)).length;
  const questions = (body.match(/[？?]/g) ?? []).length;
  const exclamations = (body.match(/[！!]/g) ?? []).length;
  const emojis = (body.match(EMOJI) ?? []).length;
  const avgSentenceLength = sentences.length
    ? Math.round((sentences.reduce((sum, sentence) => sum + [...sentence].length, 0) / sentences.length) * 10) / 10
    : 0;
  const firstLine = body.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
  const title =
    (input.title ?? "").trim() ||
    firstLine.replace(/^#{1,4}\s+/, "").replace(/^\d+[.、)]\s+/, "").slice(0, 80);
  const hook = sentences.slice(0, 2).join(" ").slice(0, 220);
  const patterns: string[] = [];
  if (questions > 0 && /为什么|怎么|如何|why|how/i.test(sentences[0] ?? "")) patterns.push("提问开场");
  else if ((sentences[0]?.length ?? 0) <= 42) patterns.push("结论先行");
  if (listLines >= 3) patterns.push("清单体");
  if (ANECDOTE.test(body) || /^我/.test(sentences[0] ?? "")) patterns.push("故事开场");
  if (CONTRAST.test(body)) patterns.push("反差结构");
  if (/\d/.test(title)) patterns.push("数字标题");
  if (avgSentenceLength > 0 && avgSentenceLength <= 22) patterns.push("短句节奏");
  if (CTA.test(body)) patterns.push("强互动");
  if (body.length > 900) patterns.push("长文");
  if (emojis >= 3) patterns.push("emoji 密度高");

  return {
    title,
    hook: hook || normalize(body).slice(0, 220),
    preview: normalize(body).slice(0, 180),
    stats: {
      chars: body.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      listLines,
      questions,
      exclamations,
      emojis,
      avgSentenceLength,
    },
    patterns: [...new Set(patterns)],
    keywords: tokenizeKeywords(body),
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function engagementScore(metrics: {
  likes?: number | null;
  collects?: number | null;
  comments?: number | null;
}): number {
  return (metrics.likes ?? 0) + 2 * (metrics.collects ?? 0) + 3 * (metrics.comments ?? 0);
}

export function followerTier(followers: number | null): ReferenceView["followerTier"] {
  if (!followers || followers <= 0) return "unknown";
  if (followers < 1000) return "nano";
  if (followers < 10000) return "micro";
  if (followers < 50000) return "mid";
  return "macro";
}

function parseAnalysis(value: string): ReferenceAnalysis {
  try {
    return JSON.parse(value) as ReferenceAnalysis;
  } catch {
    return analyzeReference({ body: "" });
  }
}

function toView(row: ReferenceRow): ReferenceView {
  const analysis = parseAnalysis(row.analysis_json);
  const engagement = engagementScore({
    likes: row.likes,
    collects: row.collects,
    comments: row.comments,
  });
  return {
    ...analysis,
    id: row.id,
    platform: row.platform,
    url: row.url,
    author: row.author,
    title: row.title || analysis.title,
    body: row.body,
    tags: (() => {
      try {
        return JSON.parse(row.tags_json) as string[];
      } catch {
        return [];
      }
    })(),
    followers: row.followers,
    likes: row.likes,
    collects: row.collects,
    comments: row.comments,
    postedAt: row.posted_at,
    importedAt: row.imported_at,
    engagement,
    engagementPerFollower:
      row.followers && row.followers > 0 ? Math.round((engagement / row.followers) * 1000) / 1000 : null,
    followerTier: followerTier(row.followers),
  };
}

export function importReference(
  db: DB,
  input: ReferenceInput & { body: string },
): ReferenceView {
  const body = input.body.trim();
  if (!body) throw new Error("Reference body is empty.");
  const analysis = analyzeReference({ title: input.title, body });
  const id = `ref_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO reference_notes
     (id, platform, url, author, title, body, tags_json, followers, likes, collects, comments,
      posted_at, imported_at, analysis_json, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}')`,
  ).run(
    id,
    input.platform?.trim() || "unknown",
    input.url?.trim() || null,
    input.author?.trim() || null,
    input.title?.trim() || analysis.title,
    body,
    JSON.stringify(input.tags ?? []),
    numberOrNull(input.followers),
    numberOrNull(input.likes),
    numberOrNull(input.collects),
    numberOrNull(input.comments),
    input.postedAt ?? null,
    now,
    JSON.stringify(analysis),
  );
  return getReference(db, id)!;
}

export function getReference(db: DB, id: string): ReferenceView | null {
  const row = db.prepare("SELECT * FROM reference_notes WHERE id = ?").get(id) as ReferenceRow | undefined;
  return row ? toView(row) : null;
}

export function listReferences(db: DB, limit = 30): ReferenceView[] {
  const rows = db
    .prepare("SELECT * FROM reference_notes ORDER BY imported_at DESC LIMIT ?")
    .all(limit) as ReferenceRow[];
  return rows.map(toView);
}

function queryTerms(query: string): string[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  const terms = new Set<string>();
  for (const word of text.split(/[\s\p{P}\p{S}]+/u)) {
    if ([...word].length >= 2) terms.add(word);
  }
  const cjk = text.replace(/[^㐀-鿿]/g, "");
  if (cjk.length >= 2 && cjk.length <= 4) terms.add(cjk);
  return [...terms].slice(0, 6);
}

export function searchReferences(
  db: DB,
  query: string,
  options: { platform?: string; limit?: number } = {},
): ReferenceView[] {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 30);
  const terms = queryTerms(query);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (terms.length) {
    clauses.push(`(${terms.map(() => "(title LIKE ? OR body LIKE ? OR tags_json LIKE ?)").join(" OR ")})`);
    for (const term of terms) {
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      params.push(pattern, pattern, pattern);
    }
  }
  if (options.platform) {
    clauses.push("platform = ?");
    params.push(options.platform);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM reference_notes ${where}
       ORDER BY (COALESCE(likes, 0) + 2 * COALESCE(collects, 0) + 3 * COALESCE(comments, 0)) DESC,
                imported_at DESC
       LIMIT ?`,
    )
    .all(...params, limit) as ReferenceRow[];
  return rows.map(toView);
}

function ngrams(text: string, size = 4): Set<string> {
  const clean = text
    .toLowerCase()
    .replace(/[^㐀-鿿a-z0-9]+/g, "")
    .replace(/\s+/g, "");
  const grams = new Set<string>();
  for (let index = 0; index <= clean.length - size; index += 1) {
    grams.add(clean.slice(index, index + size));
  }
  return grams;
}

/** Character 4-gram Jaccard. 0 = unrelated, 1 = identical. */
export function similarity(a: string, b: string): number {
  const left = ngrams(a);
  const right = ngrams(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const gram of left) {
    if (right.has(gram)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}
