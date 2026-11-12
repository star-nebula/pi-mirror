import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import type { DB } from "../db/sqlite.js";
import { chunkMarkdown, extractTitle, splitFrontmatter } from "./chunker.js";

const SKIP_DIRS = new Set([
  ".git",
  ".obsidian",
  "node_modules",
  ".pi-mirror",
  ".trash",
  "dist",
  "Attachments",
]);

/**
 * 默认排除隐私与噪声目录。真实库建模时只读 Knowledge / Output / Projects。
 * 需要索引其他目录时，先复制/净化到独立 vault，再改这里。
 */
const DEFAULT_EXCLUDE = [
  /^\./,
  /^(Interview|AboutMe|Memory|DailyNotes|Resources|Archive|Templates|Base|Skills)\//,
  /(^|\/)\.trash\//,
  /(^|\/)node_modules\//,
];

export interface IndexStats {
  files: number;
  chunks: number;
  skipped: number;
  durationMs: number;
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function shortId(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

export function isExcluded(relPath: string): boolean {
  return DEFAULT_EXCLUDE.some((pattern) => pattern.test(relPath));
}

export function walkMarkdown(root: string): string[] {
  const output: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        visit(resolve(dir, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        output.push(resolve(dir, entry.name));
      }
    }
  };
  visit(root);
  return output.sort();
}

export function indexVault(
  db: DB,
  vaultRoot: string,
  options: { maxChars?: number } = {},
): IndexStats {
  const root = resolve(vaultRoot);
  const started = Date.now();
  const files = walkMarkdown(root)
    .map((abs) => ({ abs, rel: toPosix(relative(root, abs)) }))
    .filter(({ rel }) => !isExcluded(rel));

  const upsertSource = db.prepare(`
    INSERT INTO sources (id, kind, title, locator, content_hash, raw_path, fetched_at, metadata_json)
    VALUES (@id, 'note', @title, @locator, @hash, NULL, @fetchedAt, @metadata)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      locator = excluded.locator,
      content_hash = excluded.content_hash,
      fetched_at = excluded.fetched_at,
      metadata_json = excluded.metadata_json
  `);
  const deleteChunks = db.prepare("DELETE FROM chunks WHERE source_id = ?");
  const insertChunk = db.prepare(`
    INSERT INTO chunks (id, source_id, ordinal, text, start_offset, end_offset, heading)
    VALUES (@id, @sourceId, @ordinal, @text, @start, @end, @heading)
  `);
  const upsertNote = db.prepare(`
    INSERT INTO notes (id, path, title, frontmatter_json, content_hash, source_id, updated_at)
    VALUES (@id, @path, @title, @frontmatter, @hash, @sourceId, @updatedAt)
    ON CONFLICT(path) DO UPDATE SET
      title = excluded.title,
      frontmatter_json = excluded.frontmatter_json,
      content_hash = excluded.content_hash,
      source_id = excluded.source_id,
      updated_at = excluded.updated_at
  `);
  const existingHash = db.prepare("SELECT content_hash FROM sources WHERE id = ?");

  const stats: IndexStats = { files: 0, chunks: 0, skipped: 0, durationMs: 0 };
  const fetchedAt = new Date().toISOString();

  const run = db.transaction(() => {
    for (const { abs, rel } of files) {
      const content = readFileSync(abs, "utf8");
      const hash = sha256(content);
      const sourceId = `src_${shortId(rel)}`;
      const noteId = `note_${shortId(rel)}`;
      const title = extractTitle(content, basename(rel, ".md"));
      const { frontmatter } = splitFrontmatter(content);

      const previous = existingHash.get(sourceId) as { content_hash: string } | undefined;
      if (previous?.content_hash === hash) {
        stats.skipped += 1;
        continue;
      }

      upsertSource.run({
        id: sourceId,
        title,
        locator: rel,
        hash,
        fetchedAt,
        metadata: JSON.stringify({ path: rel }),
      });
      deleteChunks.run(sourceId);

      const chunks = chunkMarkdown(content, options.maxChars ?? 700);
      for (const chunk of chunks) {
        insertChunk.run({
          id: `chunk_${sourceId}_${chunk.ordinal}`,
          sourceId,
          ordinal: chunk.ordinal,
          text: chunk.text,
          start: chunk.start,
          end: chunk.end,
          heading: chunk.heading ?? null,
        });
        stats.chunks += 1;
      }

      upsertNote.run({
        id: noteId,
        path: rel,
        title,
        frontmatter: JSON.stringify({ raw: frontmatter }),
        hash,
        sourceId,
        updatedAt: fetchedAt,
      });

      stats.files += 1;
    }
  });

  run();
  stats.durationMs = Date.now() - started;
  return stats;
}
