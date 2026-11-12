import type { DB } from "../db/sqlite.js";

export interface SearchHit {
  chunkId: string;
  sourceId: string;
  notePath: string;
  title: string;
  text: string;
  heading: string | null;
  start: number;
  end: number;
  score: number;
}

const SELECT_COLUMNS = `
    c.id AS chunkId,
    c.source_id AS sourceId,
    s.locator AS notePath,
    s.title AS title,
    c.text AS text,
    c.heading AS heading,
    c.start_offset AS start,
    c.end_offset AS end`;

const FTS_SQL = `
  SELECT ${SELECT_COLUMNS}, bm25(chunk_fts) AS score
  FROM chunk_fts
  JOIN chunks c ON c.rowid = chunk_fts.rowid
  JOIN sources s ON s.id = c.source_id
  WHERE chunk_fts MATCH ?
  ORDER BY score
  LIMIT ?
`;

/**
 * FTS5 trigram treats a MATCH as an exact phrase, so a long natural-language
 * query often misses notes that a human would call relevant. The LIKE pass
 * below scores each CJK bigram and Latin token separately and ranks by how
 * many terms a chunk contains.
 */
function planTerms(query: string): string[] {
  const parts = query
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const terms: string[] = [];
  for (const part of parts) {
    const chars = [...part];
    if (chars.length < 2) continue;
    terms.push(part);
    if (/[㐀-鿿]/.test(part) && chars.length > 4) {
      for (let index = 0; index < chars.length - 1; index += 1) {
        const bigram = chars[index] + chars[index + 1];
        if (/[㐀-鿿]{2}/.test(bigram)) terms.push(bigram);
      }
    }
  }
  return [...new Set(terms)].filter((term) => [...term].length >= 2).slice(0, 10);
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

function likeSearch(db: DB, terms: string[], limit: number): SearchHit[] {
  if (!terms.length) return [];
  const patterns = terms.map((term) => `%${escapeLike(term)}%`);
  const score = terms.map(() => "CASE WHEN c.text LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END").join(" + ");
  const where = terms.map(() => "c.text LIKE ? ESCAPE '\\'").join(" OR ");
  const sql = `
    SELECT ${SELECT_COLUMNS}, (${score}) AS score
    FROM chunks c
    JOIN sources s ON s.id = c.source_id
    WHERE ${where}
    ORDER BY score DESC, c.ordinal
    LIMIT ?
  `;
  return db.prepare(sql).all(...patterns, ...patterns, limit) as SearchHit[];
}

export function searchVault(db: DB, query: string, limit = 8): SearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const terms = planTerms(q);
  const ftsTerms = q
    .split(/[\s\p{P}\p{S}]+/u)
    .map((part) => part.trim())
    .filter((part) => [...part].length >= 3)
    .slice(0, 8)
    .map((part) => `"${part.replace(/"/g, '""')}"`);

  let ftsHits: SearchHit[] = [];
  if (ftsTerms.length) {
    try {
      ftsHits = db.prepare(FTS_SQL).all(ftsTerms.join(" OR "), limit) as SearchHit[];
    } catch {
      // Malformed or unsupported MATCH: the LIKE pass still answers.
    }
  }
  if (ftsHits.length >= limit || terms.length === 0) return ftsHits.slice(0, limit);

  const likeHits = likeSearch(db, terms, limit);
  if (!likeHits.length) return ftsHits;

  const merged = [...ftsHits];
  const seen = new Set(ftsHits.map((hit) => hit.chunkId));
  for (const hit of likeHits) {
    if (merged.length >= limit) break;
    if (seen.has(hit.chunkId)) continue;
    merged.push(hit);
    seen.add(hit.chunkId);
  }
  return merged;
}
