import type { DB } from "../db/sqlite.js";
import { DEFAULT_PROFILE_ID } from "../persona/extract.js";

export const CONSENT_SCOPES = ["modeling", "drafting", "publishing", "demo"] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export interface ProfileView {
  id: string;
  name: string;
  version: number;
  status: string;
  summary: string;
}

export interface EvidenceView {
  id: string;
  notePath: string | null;
  quote: string;
  weight: number;
}

export interface TraitView {
  id: string;
  kind: string;
  text: string;
  polarity: number | null;
  confidence: number;
  status: string;
  evidenceCount: number;
  evidence: EvidenceView[];
}

export interface VoiceView {
  feature: string;
  value: number | string;
  sampleSize: number;
}

export interface ConsentView {
  scope: ConsentScope;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  note: string | null;
}

export interface DraftView {
  id: string;
  platform: string;
  status: string;
  topic: string;
  audience: string | null;
  preview: string;
  content: string;
  sentenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublishView {
  id: string;
  draftId: string;
  platform: string;
  url: string | null;
  publishedAt: string | null;
  createdAt: string;
  topic: string;
}

export interface TimelineItem {
  id: string;
  topic: string;
  polarity: number;
  confidence: number;
  observedAt: string;
  quote: string | null;
  notePath: string | null;
  kind: "stance_event" | "observed_trait";
}

export interface CountsView {
  notes: number;
  chunks: number;
  traits: number;
  evidence: number;
  drafts: number;
  published: number;
  lastIndexed: string | null;
}

export interface StatePayload {
  profile: ProfileView | null;
  traits: TraitView[];
  voice: VoiceView[];
  counts: CountsView;
  consent: ConsentView[];
  drafts: DraftView[];
  publish: PublishView[];
  timeline: TimelineItem[];
  timelineKind: "stance_events" | "observed_traits";
  meta: {
    vaultRoot: string;
    demo: boolean;
    model: string | null;
    provider: string | null;
    startedAt: string;
    version: string;
  };
}

interface TraitRow {
  id: string;
  kind: string;
  text: string;
  polarity: number | null;
  confidence: number;
  status: string;
  evidenceCount: number;
}

const KIND_ORDER = `CASE kind
  WHEN 'value' THEN 0 WHEN 'stance' THEN 1 WHEN 'taboo' THEN 2
  WHEN 'goal' THEN 3 WHEN 'preference' THEN 4 WHEN 'voice' THEN 5
  WHEN 'biography' THEN 6 ELSE 7 END`;

export function readProfile(db: DB): ProfileView | null {
  const row = db
    .prepare(
      `SELECT id, name, version, status, summary_md AS summary
       FROM persona_profiles
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, version DESC
       LIMIT 1`,
    )
    .get() as ProfileView | undefined;
  return row ?? null;
}

export function listTraits(db: DB, profileId = DEFAULT_PROFILE_ID): TraitView[] {
  const rows = db
    .prepare(
      `SELECT trait_id AS id, kind, text, polarity, confidence, status, evidence_count AS evidenceCount
       FROM v_persona_card
       WHERE profile_id = ? AND status != 'rejected'
       ORDER BY ${KIND_ORDER}, confidence DESC, evidence_count DESC`,
    )
    .all(profileId) as TraitRow[];

  const evidenceStmt = db.prepare(
    `SELECT e.id, e.quote, e.weight, n.path AS notePath
     FROM persona_trait_evidence e
     LEFT JOIN notes n ON n.id = e.note_id
     WHERE e.trait_id = ?
     ORDER BY e.weight DESC
     LIMIT 8`,
  );

  return rows.map((row) => ({
    ...row,
    evidence: evidenceStmt.all(row.id) as EvidenceView[],
  }));
}

export function listVoice(db: DB, profileId = DEFAULT_PROFILE_ID): VoiceView[] {
  const rows = db
    .prepare(
      `SELECT feature, value_json, sample_size AS sampleSize
       FROM voice_features WHERE profile_id = ? ORDER BY feature`,
    )
    .all(profileId) as Array<{ feature: string; value_json: string; sampleSize: number }>;

  return rows.map((row) => {
    let value: number | string = row.value_json;
    try {
      value = JSON.parse(row.value_json) as number | string;
    } catch {
      // keep raw JSON
    }
    return { feature: row.feature, value, sampleSize: row.sampleSize };
  });
}

export function readCounts(db: DB): CountsView {
  const one = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;
  const last = db.prepare("SELECT MAX(updated_at) AS at FROM notes").get() as { at: string | null };
  return {
    notes: one("SELECT COUNT(*) AS n FROM notes"),
    chunks: one("SELECT COUNT(*) AS n FROM chunks"),
    traits: one("SELECT COUNT(*) AS n FROM persona_traits WHERE status != 'rejected'"),
    evidence: one("SELECT COUNT(*) AS n FROM persona_trait_evidence"),
    drafts: one("SELECT COUNT(*) AS n FROM drafts"),
    published: one("SELECT COUNT(*) AS n FROM publish_records"),
    lastIndexed: last.at ?? null,
  };
}

const DEFAULT_CONSENT_NOTE = "Off by default. Grant a scope only when you mean it.";

export function readConsent(db: DB): ConsentView[] {
  const latest = db
    .prepare(
      `SELECT c.scope, c.granted, c.granted_at, c.revoked_at, c.note
       FROM consent_records c
       JOIN (SELECT scope, MAX(rowid) AS rowid FROM consent_records GROUP BY scope) latest
         ON latest.rowid = c.rowid`,
    )
    .all() as Array<{
    scope: ConsentScope;
    granted: number;
    granted_at: string | null;
    revoked_at: string | null;
    note: string | null;
  }>;

  const byScope = new Map(latest.map((row) => [row.scope, row]));
  return CONSENT_SCOPES.map((scope) => {
    const row = byScope.get(scope);
    if (!row) {
      return { scope, granted: false, grantedAt: null, revokedAt: null, note: DEFAULT_CONSENT_NOTE };
    }
    return {
      scope,
      granted: Boolean(row.granted),
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
      note: row.note,
    };
  });
}

export function setConsent(db: DB, scope: ConsentScope, granted: boolean): ConsentView {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO consent_records (id, scope, granted, granted_at, revoked_at, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    `consent_${scope}_${Date.now()}`,
    scope,
    granted ? 1 : 0,
    granted ? now : null,
    granted ? null : now,
    granted ? "Granted in the Pi-Mirror workspace." : "Revoked in the Pi-Mirror workspace.",
  );
  return readConsent(db).find((row) => row.scope === scope)!;
}

export function listDrafts(db: DB, limit = 30): DraftView[] {
  const rows = db
    .prepare(
      `SELECT d.id, d.platform, d.status, d.content_md AS content, d.sentence_count AS sentenceCount,
              d.created_at AS createdAt, d.updated_at AS updatedAt,
              b.topic, b.audience
       FROM drafts d JOIN briefs b ON b.id = d.brief_id
       ORDER BY d.updated_at DESC, d.created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    platform: string;
    status: string;
    content: string;
    sentenceCount: number;
    createdAt: string;
    updatedAt: string;
    topic: string;
    audience: string | null;
  }>;

  return rows.map((row) => ({
    ...row,
    preview: row.content.replace(/\s+/g, " ").trim().slice(0, 180),
  }));
}

export function listPublish(db: DB, limit = 30): PublishView[] {
  return db
    .prepare(
      `SELECT p.id, p.draft_id AS draftId, p.platform, p.url, p.published_at AS publishedAt,
              p.created_at AS createdAt, b.topic
       FROM publish_records p
       JOIN drafts d ON d.id = p.draft_id
       JOIN briefs b ON b.id = d.brief_id
       ORDER BY COALESCE(p.published_at, p.created_at) DESC
       LIMIT ?`,
    )
    .all(limit) as PublishView[];
}

export function listTimeline(
  db: DB,
  profileId = DEFAULT_PROFILE_ID,
  limit = 40,
): { items: TimelineItem[]; kind: "stance_events" | "observed_traits" } {
  const events = db
    .prepare(
      `SELECT s.id, s.topic, s.polarity, s.confidence, s.observed_at AS observedAt,
              s.quote, n.path AS notePath
       FROM stance_events s
       LEFT JOIN notes n ON n.id = s.note_id
       WHERE s.profile_id = ?
       ORDER BY s.observed_at DESC
       LIMIT ?`,
    )
    .all(profileId, limit) as Array<Omit<TimelineItem, "kind">>;

  if (events.length > 0) {
    return { items: events.map((event) => ({ ...event, kind: "stance_event" })), kind: "stance_events" };
  }

  // Before any stance history exists, surface stance traits as a single observation.
  const observed = db
    .prepare(
      `SELECT t.id, t.text AS topic, COALESCE(t.polarity, 0) AS polarity, t.confidence,
              COALESCE(n.updated_at, t.created_at) AS observedAt, e.quote, n.path AS notePath
       FROM persona_traits t
       LEFT JOIN persona_trait_evidence e ON e.trait_id = t.id
       LEFT JOIN notes n ON n.id = e.note_id
       WHERE t.profile_id = ? AND t.kind = 'stance' AND t.status != 'rejected'
       GROUP BY t.id
       ORDER BY observedAt DESC
       LIMIT ?`,
    )
    .all(profileId, limit) as Array<Omit<TimelineItem, "kind">>;

  return {
    items: observed.map((item) => ({ ...item, kind: "observed_trait" })),
    kind: "observed_traits",
  };
}

export function buildState(
  db: DB,
  meta: StatePayload["meta"],
): StatePayload {
  const profile = readProfile(db);
  const profileId = profile?.id ?? DEFAULT_PROFILE_ID;
  const timeline = listTimeline(db, profileId);
  return {
    profile,
    traits: listTraits(db, profileId),
    voice: listVoice(db, profileId),
    counts: readCounts(db),
    consent: readConsent(db),
    drafts: listDrafts(db),
    publish: listPublish(db),
    timeline: timeline.items,
    timelineKind: timeline.kind,
    meta,
  };
}
