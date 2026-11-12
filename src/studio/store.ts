import { randomUUID } from "node:crypto";
import type { DB } from "../db/sqlite.js";
import type { GuardReport } from "../persona/guard.js";
import type {
  ContentPackage,
  PlanStep,
  RunStatus,
  StudioClaim,
  StudioRun,
  StudioSource,
  StudioStep,
} from "./types.js";

interface RunRow {
  id: string;
  goal: string;
  platform: string | null;
  audience: string | null;
  status: RunStatus;
  plan_json: string;
  package_json: string | null;
  guard_json: string | null;
  error: string | null;
  model: string | null;
  draft_id: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

interface StepRow {
  id: number;
  seq: number;
  tool: string | null;
  title: string;
  detail: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  payload_json: string;
}

interface SourceRow {
  number: number;
  kind: StudioSource["kind"];
  title: string;
  locator: string | null;
  quote: string | null;
  published_at: string | null;
  retrieved_at: string;
  metadata_json: string;
}

interface ClaimRow {
  id: string;
  text: string;
  status: StudioClaim["status"];
  confidence: string;
  sources_json: string;
  created_at: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function createRun(
  db: DB,
  input: { goal: string; platform?: string | null; audience?: string | null },
): string {
  const id = `run_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO studio_runs (id, goal, platform, audience, status, plan_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'queued', '[]', ?, ?)`,
  ).run(id, input.goal, input.platform ?? null, input.audience ?? null, now, now);
  return id;
}

export function setRunStatus(
  db: DB,
  id: string,
  status: RunStatus,
  patch: { error?: string | null; model?: string | null; finished?: boolean } = {},
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE studio_runs
     SET status = ?, error = COALESCE(?, error), model = COALESCE(?, model),
         updated_at = ?, finished_at = CASE WHEN ? THEN ? ELSE finished_at END
     WHERE id = ?`,
  ).run(status, patch.error ?? null, patch.model ?? null, now, patch.finished ? 1 : 0, now, id);
}

export function markStaleRuns(db: DB): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE studio_runs
     SET status = 'error', error = COALESCE(error, 'The workspace restarted before this run finished.'),
         finished_at = ?, updated_at = ?
     WHERE status IN ('queued', 'running')`,
  ).run(now, now);
}

export function setPlan(db: DB, runId: string, plan: PlanStep[]): void {
  db.prepare("UPDATE studio_runs SET plan_json = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(plan),
    new Date().toISOString(),
    runId,
  );
}

export function setGuard(db: DB, runId: string, report: GuardReport): void {
  db.prepare("UPDATE studio_runs SET guard_json = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(report),
    new Date().toISOString(),
    runId,
  );
}

export function appendStep(
  db: DB,
  runId: string,
  input: {
    toolCallId?: string | null;
    tool?: string | null;
    title: string;
    detail?: string | null;
    payload?: unknown;
    kind?: string;
  },
): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM studio_steps WHERE run_id = ?")
    .get(runId) as { seq: number };
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO studio_steps
       (run_id, seq, tool_call_id, kind, tool, title, detail, status, started_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
    )
    .run(
      runId,
      row.seq,
      input.toolCallId ?? null,
      input.kind ?? "tool",
      input.tool ?? null,
      input.title,
      input.detail ?? null,
      now,
      JSON.stringify(input.payload ?? {}),
    );
  return Number(result.lastInsertRowid);
}

export function closeOpenSteps(db: DB, runId: string, status = "error"): void {
  db.prepare(
    "UPDATE studio_steps SET status = ?, finished_at = ? WHERE run_id = ? AND status = 'running'",
  ).run(status, new Date().toISOString(), runId);
}

export function finishStep(
  db: DB,
  id: number,
  patch: { status: string; detail?: string | null; durationMs?: number | null; payload?: unknown },
): void {
  db.prepare(
    `UPDATE studio_steps
     SET status = ?, detail = COALESCE(?, detail), finished_at = ?, duration_ms = ?,
         payload_json = CASE WHEN ? IS NULL THEN payload_json ELSE ? END
     WHERE id = ?`,
  ).run(
    patch.status,
    patch.detail ?? null,
    new Date().toISOString(),
    patch.durationMs ?? null,
    patch.payload === undefined ? null : JSON.stringify(patch.payload),
    patch.payload === undefined ? null : JSON.stringify(patch.payload),
    id,
  );
}

export function addSource(
  db: DB,
  runId: string,
  source: Omit<StudioSource, "number" | "retrievedAt"> & { retrievedAt?: string },
): StudioSource {
  const existing = db
    .prepare(
      `SELECT number, kind, title, locator, quote, published_at, retrieved_at, metadata_json
       FROM studio_sources
       WHERE run_id = ? AND kind = ? AND (locator = ? OR title = ?)
       ORDER BY number LIMIT 1`,
    )
    .get(runId, source.kind, source.locator ?? "", source.title) as SourceRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE studio_sources
       SET title = ?, quote = COALESCE(?, quote), published_at = COALESCE(?, published_at),
           metadata_json = ?
       WHERE run_id = ? AND number = ?`,
    ).run(
      source.title,
      source.quote ?? null,
      source.publishedAt ?? null,
      JSON.stringify(source.metadata ?? {}),
      runId,
      existing.number,
    );
    return {
      number: existing.number,
      kind: existing.kind,
      title: source.title,
      locator: existing.locator,
      quote: source.quote ?? existing.quote,
      publishedAt: source.publishedAt ?? existing.published_at,
      retrievedAt: existing.retrieved_at,
      metadata: source.metadata,
    };
  }

  const next = db
    .prepare("SELECT COALESCE(MAX(number), 0) + 1 AS number FROM studio_sources WHERE run_id = ?")
    .get(runId) as { number: number };
  const retrievedAt = source.retrievedAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO studio_sources
     (id, run_id, number, kind, title, locator, quote, published_at, retrieved_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `src_${randomUUID().slice(0, 8)}`,
    runId,
    next.number,
    source.kind,
    source.title,
    source.locator ?? null,
    source.quote ?? null,
    source.publishedAt ?? null,
    retrievedAt,
    JSON.stringify(source.metadata ?? {}),
  );
  return { ...source, number: next.number, retrievedAt };
}

export function addClaim(
  db: DB,
  runId: string,
  claim: { text: string; status: StudioClaim["status"]; confidence?: string; sources?: number[] },
): StudioClaim {
  const id = `claim_${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO studio_claims (id, run_id, text, status, confidence, sources_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    runId,
    claim.text,
    claim.status,
    claim.confidence ?? "medium",
    JSON.stringify(claim.sources ?? []),
    createdAt,
  );
  return {
    id,
    text: claim.text,
    status: claim.status,
    confidence: claim.confidence ?? "medium",
    sources: claim.sources ?? [],
    createdAt,
  };
}

export function savePackage(
  db: DB,
  runId: string,
  pkg: ContentPackage,
  report: GuardReport,
): void {
  const now = new Date().toISOString();
  const version = (
    db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM studio_packages WHERE run_id = ?").get(runId) as {
      version: number;
    }
  ).version;
  db.prepare(
    `INSERT INTO studio_packages (id, run_id, version, package_json, guard_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    `pkg_${randomUUID().slice(0, 8)}`,
    runId,
    version,
    JSON.stringify(pkg),
    JSON.stringify(report),
    now,
  );
  db.prepare(
    `UPDATE studio_runs
     SET status = 'done', package_json = ?, guard_json = ?, finished_at = ?, updated_at = ?, error = NULL
     WHERE id = ?`,
  ).run(JSON.stringify(pkg), JSON.stringify(report), now, now, runId);
}

export function setDraftId(db: DB, runId: string, draftId: string): void {
  db.prepare("UPDATE studio_runs SET draft_id = ?, updated_at = ? WHERE id = ?").run(
    draftId,
    new Date().toISOString(),
    runId,
  );
}

export function getRun(db: DB, id: string): StudioRun | null {
  const row = db.prepare("SELECT * FROM studio_runs WHERE id = ?").get(id) as RunRow | undefined;
  if (!row) return null;

  const steps = db
    .prepare(
      `SELECT id, seq, tool, title, detail, status, started_at, finished_at, duration_ms, payload_json
       FROM studio_steps WHERE run_id = ? ORDER BY seq`,
    )
    .all(id) as StepRow[];

  const sources = db
    .prepare(
      `SELECT number, kind, title, locator, quote, published_at, retrieved_at, metadata_json
       FROM studio_sources WHERE run_id = ? ORDER BY number`,
    )
    .all(id) as SourceRow[];

  const claims = db
    .prepare(
      `SELECT id, text, status, confidence, sources_json, created_at
       FROM studio_claims WHERE run_id = ? ORDER BY created_at`,
    )
    .all(id) as ClaimRow[];

  return {
    id: row.id,
    goal: row.goal,
    platform: row.platform,
    audience: row.audience,
    status: row.status,
    plan: parseJson<PlanStep[]>(row.plan_json, []),
    package: parseJson<ContentPackage | null>(row.package_json, null),
    guard: parseJson<GuardReport | null>(row.guard_json, null),
    error: row.error,
    model: row.model,
    draftId: row.draft_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    steps: steps.map((step) => ({
      id: step.id,
      seq: step.seq,
      tool: step.tool,
      title: step.title,
      detail: step.detail,
      status: step.status,
      startedAt: step.started_at,
      finishedAt: step.finished_at,
      durationMs: step.duration_ms,
      payload: parseJson<unknown>(step.payload_json, {}),
    })),
    sources: sources.map((source) => ({
      number: source.number,
      kind: source.kind,
      title: source.title,
      locator: source.locator,
      quote: source.quote,
      publishedAt: source.published_at,
      retrievedAt: source.retrieved_at,
      metadata: parseJson<Record<string, unknown>>(source.metadata_json, {}),
    })),
    claims: claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      status: claim.status,
      confidence: claim.confidence,
      sources: parseJson<number[]>(claim.sources_json, []),
      createdAt: claim.created_at,
    })),
  };
}

export function listRuns(db: DB, limit = 12): StudioRun[] {
  const rows = db
    .prepare("SELECT id FROM studio_runs ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Array<{ id: string }>;
  return rows.map((row) => getRun(db, row.id)).filter((run): run is StudioRun => Boolean(run));
}
