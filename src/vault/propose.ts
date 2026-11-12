import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { createTwoFilesPatch } from "diff";
import type { DB } from "../db/sqlite.js";

export interface Proposal {
  id: string;
  targetPath: string;
  diff: string;
  status: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertInside(root: string, abs: string): void {
  const normalizedRoot = resolve(root);
  const normalizedAbs = resolve(abs);
  if (normalizedAbs !== normalizedRoot && !normalizedAbs.startsWith(normalizedRoot + sep)) {
    throw new Error(`Path escapes vault root: ${abs}`);
  }
}

export function proposeWrite(
  db: DB,
  vaultRoot: string,
  targetPath: string,
  content: string,
  reason = "",
): Proposal {
  const abs = resolve(vaultRoot, targetPath);
  assertInside(vaultRoot, abs);

  const before = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  const baseHash = sha256(before);
  const diff = createTwoFilesPatch(
    targetPath,
    targetPath,
    before,
    content,
    "before",
    "after",
    { context: 3 },
  );

  const id = `prop_${randomUUID()}`;
  db.prepare(`
    INSERT INTO write_proposals (id, target_path, base_hash, diff, content, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, targetPath, baseHash, diff, content, reason, new Date().toISOString());

  return { id, targetPath, diff, status: "pending" };
}

interface ProposalRow {
  id: string;
  target_path: string;
  base_hash: string | null;
  content: string;
  status: string;
}

export function approveProposal(db: DB, id: string): void {
  const result = db.prepare(`
    UPDATE write_proposals
    SET status = 'approved', reviewed_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(new Date().toISOString(), id);
  if (result.changes === 0) throw new Error(`Proposal not pending: ${id}`);
}

export function rejectProposal(db: DB, id: string): void {
  const result = db.prepare(`
    UPDATE write_proposals
    SET status = 'rejected', reviewed_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(new Date().toISOString(), id);
  if (result.changes === 0) throw new Error(`Proposal not pending: ${id}`);
}

export function applyProposal(db: DB, vaultRoot: string, id: string): void {
  const row = db.prepare(`
    SELECT id, target_path, base_hash, content, status
    FROM write_proposals WHERE id = ?
  `).get(id) as ProposalRow | undefined;

  if (!row) throw new Error(`Proposal not found: ${id}`);
  if (row.status !== "pending" && row.status !== "approved") {
    throw new Error(`Proposal cannot be applied from status: ${row.status}`);
  }

  const abs = resolve(vaultRoot, row.target_path);
  assertInside(vaultRoot, abs);

  const current = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  if (row.base_hash && sha256(current) !== row.base_hash) {
    throw new Error("Target changed since proposal was created; regenerate the diff.");
  }

  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, row.content, "utf8");

  db.prepare(`
    UPDATE write_proposals
    SET status = 'applied', reviewed_at = ?, applied_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), id);
}
