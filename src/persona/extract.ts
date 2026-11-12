import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DB } from "../db/sqlite.js";
import { splitFrontmatter } from "../vault/chunker.js";

export const DEFAULT_PROFILE_ID = "profile_default";

export interface PersonaProfile {
  id: string;
  version: number;
}

export type TraitKind =
  | "value"
  | "stance"
  | "taboo"
  | "voice"
  | "biography"
  | "relationship"
  | "preference"
  | "goal";

interface Pattern {
  kind: TraitKind;
  re: RegExp;
  confidence: number;
  polarity: number;
}

/**
 * v0 规则抽取：先保证「每条 trait 都有证据」。
 * v1 再换成 LLM 抽取 + 人工审阅，规则只做召回兜底。
 */
const PATTERNS: Pattern[] = [
  {
    kind: "value",
    re: /(?:我认为|我相信|我的原则|底线是|重要的是)[^。！？\n]{4,100}[。！？]?/g,
    confidence: 0.7,
    polarity: 0.5,
  },
  {
    kind: "taboo",
    re: /我(?:不做|讨厌|不接受|不会做)[^。！？\n]{4,100}[。！？]?|绝不[^。！？\n]{4,100}[。！？]?/g,
    confidence: 0.78,
    polarity: -1,
  },
  {
    kind: "stance",
    re: /我(?:不)?(?:喜欢|支持|反对|觉得|认为)[^。！？\n]{4,100}[。！？]?/g,
    confidence: 0.62,
    polarity: 0.5,
  },
  {
    kind: "goal",
    re: /(?:我想|我计划|我的目标|接下来要)[^。！？\n]{4,100}[。！？]?/g,
    confidence: 0.6,
    polarity: 0.5,
  },
];

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function polarityFor(pattern: Pattern, text: string): number {
  if (pattern.kind === "taboo") return -1;
  if (pattern.kind === "stance") {
    // 只把句首的否定/反对当负向；句中「不是 prompt」不等于反对整个观点。
    if (/^我(?:不(?:喜欢|支持|觉得|认为)|反对|讨厌|拒绝)/.test(text)) return -0.6;
    return 0.5;
  }
  return pattern.polarity;
}

export function ensureProfile(db: DB, name = "Me"): PersonaProfile {
  const existing = db
    .prepare("SELECT id, version FROM persona_profiles WHERE id = ?")
    .get(DEFAULT_PROFILE_ID) as PersonaProfile | undefined;
  if (existing) return existing;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO persona_profiles (id, name, version, status, summary_md, created_at, updated_at)
    VALUES (?, ?, 1, 'active', '', ?, ?)
  `).run(DEFAULT_PROFILE_ID, name, now, now);

  return { id: DEFAULT_PROFILE_ID, version: 1 };
}

export interface ExtractStats {
  notesRead: number;
  traitsCreated: number;
  evidenceCreated: number;
  skipped: number;
}

export function extractTraits(
  db: DB,
  vaultRoot: string,
  profileId = DEFAULT_PROFILE_ID,
  maxTraits = 300,
): ExtractStats {
  const notes = db
    .prepare("SELECT id, path FROM notes ORDER BY path")
    .all() as Array<{ id: string; path: string }>;

  const insertTrait = db.prepare(`
    INSERT OR IGNORE INTO persona_traits
      (id, profile_id, kind, text, polarity, confidence, valid_from, valid_to, status, created_at)
    VALUES
      (@id, @profileId, @kind, @text, @polarity, @confidence, NULL, NULL, 'candidate', @createdAt)
  `);
  const insertEvidence = db.prepare(`
    INSERT OR IGNORE INTO persona_trait_evidence
      (id, trait_id, note_id, source_id, quote, span_start, span_end, weight)
    VALUES
      (@id, @traitId, @noteId, NULL, @quote, @start, @end, 1)
  `);

  const seen = new Set<string>();
  const stats: ExtractStats = {
    notesRead: 0,
    traitsCreated: 0,
    evidenceCreated: 0,
    skipped: 0,
  };
  const createdAt = new Date().toISOString();

  const run = db.transaction(() => {
    for (const note of notes) {
      let content: string;
      try {
        content = readFileSync(resolve(vaultRoot, note.path), "utf8");
      } catch {
        stats.skipped += 1;
        continue;
      }
      stats.notesRead += 1;
      const { body } = splitFrontmatter(content);

      for (const pattern of PATTERNS) {
        if (stats.traitsCreated >= maxTraits) break;

        for (const match of body.matchAll(pattern.re)) {
          if (stats.traitsCreated >= maxTraits) break;

          const quote = normalize(match[0]);
          if (quote.length < 6) continue;

          const text = quote.replace(/[。！？]$/, "");
          if (seen.has(text)) {
            stats.skipped += 1;
            continue;
          }
          seen.add(text);

          const traitId = `trait_${sha1(`${profileId}:${text}`)}`;
          const result = insertTrait.run({
            id: traitId,
            profileId,
            kind: pattern.kind,
            text,
            polarity: polarityFor(pattern, text),
            confidence: pattern.confidence,
            createdAt,
          });

          if (result.changes > 0) {
            stats.traitsCreated += 1;
            const start = match.index ?? 0;
            insertEvidence.run({
              id: `ev_${sha1(`${traitId}:${note.id}:${quote}`)}`,
              traitId,
              noteId: note.id,
              quote,
              start,
              end: start + quote.length,
            });
            stats.evidenceCreated += 1;
          }
        }
      }
    }
  });

  run();
  return stats;
}

export interface VoiceStats {
  avgSentenceLen: number;
  questionRate: number;
  exclaimRate: number;
  emojiRate: number;
  listRate: number;
  avgParagraphLen: number;
  firstPersonRate: number;
  englishMixRate: number;
  sampleSentences: number;
  sampleNotes: number;
}

export function computeVoiceStats(
  db: DB,
  vaultRoot: string,
  profileId = DEFAULT_PROFILE_ID,
): VoiceStats {
  const notes = db
    .prepare("SELECT path FROM notes ORDER BY path")
    .all() as Array<{ path: string }>;

  let sentences = 0;
  let chars = 0;
  let questions = 0;
  let exclaims = 0;
  let emoji = 0;
  let lines = 0;
  let listLines = 0;
  let paragraphs = 0;
  let paragraphChars = 0;
  let firstPerson = 0;
  let englishLines = 0;
  let notesRead = 0;

  for (const note of notes) {
    let content: string;
    try {
      content = readFileSync(resolve(vaultRoot, note.path), "utf8");
    } catch {
      continue;
    }
    notesRead += 1;
    const { body } = splitFrontmatter(content);
    const pieces = body.split(/[。！？.!?]/).map((piece) => piece.trim()).filter(Boolean);
    sentences += pieces.length;
    chars += pieces.reduce((sum, piece) => sum + piece.length, 0);
    questions += (body.match(/[?？]/g) ?? []).length;
    exclaims += (body.match(/[!！]/g) ?? []).length;
    emoji += (body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
    firstPerson += pieces.filter((piece) => piece.includes("我")).length;

    const bodyLines = body.split(/\r?\n/).filter((line) => line.trim().length > 0);
    lines += bodyLines.length;
    listLines += bodyLines.filter((line) => /^\s*(?:[-*+]|\d+\.)\s+/.test(line)).length;
    englishLines += bodyLines.filter((line) => /[A-Za-z]/.test(line)).length;

    const bodyParagraphs = body.split(/\n{2,}/).filter((part) => part.trim().length > 0);
    paragraphs += bodyParagraphs.length;
    paragraphChars += bodyParagraphs.reduce((sum, part) => sum + part.trim().length, 0);
  }

  const safe = (value: number) => (Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0);
  const stats: VoiceStats = {
    avgSentenceLen: safe(sentences > 0 ? chars / sentences : 0),
    questionRate: safe(sentences > 0 ? questions / sentences : 0),
    exclaimRate: safe(sentences > 0 ? exclaims / sentences : 0),
    emojiRate: safe(sentences > 0 ? emoji / sentences : 0),
    listRate: safe(lines > 0 ? listLines / lines : 0),
    avgParagraphLen: safe(paragraphs > 0 ? paragraphChars / paragraphs : 0),
    firstPersonRate: safe(sentences > 0 ? firstPerson / sentences : 0),
    englishMixRate: safe(lines > 0 ? englishLines / lines : 0),
    sampleSentences: sentences,
    sampleNotes: notesRead,
  };

  const upsert = db.prepare(`
    INSERT INTO voice_features (id, profile_id, feature, value_json, sample_size, computed_at)
    VALUES (@id, @profileId, @feature, @value, @sampleSize, @computedAt)
    ON CONFLICT(profile_id, feature) DO UPDATE SET
      value_json = excluded.value_json,
      sample_size = excluded.sample_size,
      computed_at = excluded.computed_at
  `);
  const computedAt = new Date().toISOString();

  const run = db.transaction(() => {
    for (const [feature, value] of Object.entries(stats)) {
      if (feature === "sampleSentences" || feature === "sampleNotes") continue;
      upsert.run({
        id: `vf_${profileId}_${feature}`,
        profileId,
        feature,
        value: JSON.stringify(value),
        sampleSize: sentences,
        computedAt,
      });
    }
  });
  run();

  return stats;
}
