-- Pi-Mirror schema v0.2
-- SQLite 3.34+ (FTS5 trigram). 需要 better-sqlite3 或系统 sqlite 启用 FTS5。
-- 设计原则：文件是笔记的真相源，本库只是索引与状态缓存；可重建。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- 元信息
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 源材料与可引用片段
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
  id            TEXT PRIMARY KEY,              -- nanoid/uuid
  kind          TEXT NOT NULL
                CHECK (kind IN ('url', 'pdf', 'text', 'note')),
  title         TEXT NOT NULL,
  locator       TEXT,                          -- URL / 文件路径 / note path
  content_hash  TEXT NOT NULL,                 -- sha256，用于去重与缓存
  raw_path      TEXT,                          -- 原文快照，如 .pi-press/sources/<hash>.txt
  fetched_at    TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sources_hash ON sources(content_hash);
CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources(kind);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  source_id    TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  ordinal      INTEGER NOT NULL,
  text         TEXT NOT NULL,
  start_offset INTEGER NOT NULL,               -- 在原文中的起止，用于回跳
  end_offset   INTEGER NOT NULL,
  heading      TEXT,
  UNIQUE (source_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);

-- FTS5：trigram 对中文子串友好，但 MATCH 最少 3 个字符；
-- 1–2 字的中文查询（如“知识”）在应用层用 LIKE 兜底，或改 jieba 分词后存 tokenized_text。
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
  text,
  content='chunks',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunk_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunk_fts(chunk_fts, rowid, text)
  VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunk_fts(chunk_fts, rowid, text)
  VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunk_fts(rowid, text) VALUES (new.rowid, new.text);
END;

-- ------------------------------------------------------------
-- 笔记与双链
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  id               TEXT PRIMARY KEY,
  path             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  content_hash     TEXT NOT NULL,
  source_id        TEXT REFERENCES sources(id) ON DELETE SET NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);

-- to_note_id 允许为空：断链也要能记录，供审计
CREATE TABLE IF NOT EXISTS note_links (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  to_note_id   TEXT REFERENCES notes(id) ON DELETE SET NULL,
  to_path      TEXT,
  link_type    TEXT NOT NULL DEFAULT 'wiki'
               CHECK (link_type IN ('wiki', 'markdown', 'embed', 'tag')),
  UNIQUE (from_note_id, to_path)
);

CREATE INDEX IF NOT EXISTS idx_note_links_from ON note_links(from_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_to ON note_links(to_note_id);

-- ------------------------------------------------------------
-- Claim：可验证的事实陈述
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claims (
  id         TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  source_id  TEXT REFERENCES sources(id) ON DELETE SET NULL,
  chunk_id   TEXT REFERENCES chunks(id) ON DELETE SET NULL,
  note_id    TEXT REFERENCES notes(id) ON DELETE SET NULL,
  span_start INTEGER,
  span_end   INTEGER,
  confidence REAL NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'extracted'
             CHECK (status IN ('extracted', 'verified', 'rejected', 'conflict')),
  created_at TEXT NOT NULL,
  -- 至少要有出处：外部源或库内笔记
  CHECK (source_id IS NOT NULL OR note_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_claims_source ON claims(source_id);
CREATE INDEX IF NOT EXISTS idx_claims_chunk ON claims(chunk_id);
CREATE INDEX IF NOT EXISTS idx_claims_note ON claims(note_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

CREATE TABLE IF NOT EXISTS claim_links (
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  relation TEXT NOT NULL
           CHECK (relation IN ('supports', 'contradicts', 'duplicates', 'related')),
  score    REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (claim_id, note_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_claim_links_note ON claim_links(note_id);

-- ------------------------------------------------------------
-- Brief / Draft / 引用绑定
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS briefs (
  id           TEXT PRIMARY KEY,
  topic        TEXT NOT NULL,
  audience     TEXT,
  platform     TEXT NOT NULL,                  -- xiaohongshu / x / newsletter
  angle        TEXT,
  outline_json TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id             TEXT PRIMARY KEY,
  brief_id       TEXT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL,
  content_md     TEXT NOT NULL DEFAULT '',
  sentence_count INTEGER NOT NULL DEFAULT 0,   -- 用于覆盖率
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'reviewed', 'approved', 'published')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drafts_brief ON drafts(brief_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);

CREATE TABLE IF NOT EXISTS draft_claims (
  draft_id        TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  claim_id        TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  sentence_index  INTEGER NOT NULL,
  citation_status TEXT NOT NULL DEFAULT 'ok'
                  CHECK (citation_status IN ('ok', 'missing', 'weak', 'conflict')),
  PRIMARY KEY (draft_id, claim_id, sentence_index)
);

CREATE INDEX IF NOT EXISTS idx_draft_claims_draft ON draft_claims(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_claims_claim ON draft_claims(claim_id);

-- ------------------------------------------------------------
-- 资产与发布记录
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
  id        TEXT PRIMARY KEY,
  draft_id  TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('card', 'cover', 'image')),
  template  TEXT NOT NULL,
  path      TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_draft ON assets(draft_id);

CREATE TABLE IF NOT EXISTS publish_records (
  id           TEXT PRIMARY KEY,
  draft_id     TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  url          TEXT,
  published_at TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publish_draft ON publish_records(draft_id);

-- ------------------------------------------------------------
-- 写入门禁
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS write_proposals (
  id          TEXT PRIMARY KEY,
  target_path TEXT NOT NULL,
  base_hash   TEXT,                            -- 生成时的文件 hash，防并发覆盖
  diff        TEXT NOT NULL,                   -- unified diff
  content     TEXT NOT NULL,                   -- 完整新内容，便于应用
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  created_at  TEXT NOT NULL,
  reviewed_at TEXT,
  applied_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON write_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_target ON write_proposals(target_path);

-- ------------------------------------------------------------
-- Voice / Eval
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_profiles (
  id                 TEXT PRIMARY KEY,
  style_guide_json   TEXT NOT NULL,
  sample_note_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id           TEXT PRIMARY KEY,
  dataset      TEXT NOT NULL,                  -- retrieval / extraction / citation
  metrics_json TEXT NOT NULL,
  report_path  TEXT,
  git_sha      TEXT,
  created_at   TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 视图
-- ------------------------------------------------------------
-- 每条 claim 的出处上下文，UI 和审计直接用
CREATE VIEW IF NOT EXISTS v_claim_context AS
SELECT
  c.id            AS claim_id,
  c.text          AS claim_text,
  c.status,
  c.confidence,
  c.span_start,
  c.span_end,
  s.id            AS source_id,
  s.title         AS source_title,
  s.kind          AS source_kind,
  s.locator       AS source_locator,
  ch.id           AS chunk_id,
  ch.text         AS chunk_text,
  ch.heading      AS chunk_heading,
  n.id            AS note_id,
  n.path          AS note_path,
  n.title         AS note_title
FROM claims c
LEFT JOIN sources s ON s.id = c.source_id
LEFT JOIN chunks  ch ON ch.id = c.chunk_id
LEFT JOIN notes   n ON n.id = c.note_id;

-- 草稿引用覆盖率
CREATE VIEW IF NOT EXISTS v_draft_audit AS
SELECT
  d.id AS draft_id,
  d.brief_id,
  d.platform,
  d.status,
  d.sentence_count,
  COUNT(DISTINCT CASE WHEN dc.citation_status = 'ok'       THEN dc.sentence_index END) AS cited_sentences,
  COUNT(DISTINCT CASE WHEN dc.citation_status = 'missing'  THEN dc.sentence_index END) AS missing_sentences,
  COUNT(DISTINCT CASE WHEN dc.citation_status = 'weak'     THEN dc.sentence_index END) AS weak_sentences,
  COUNT(DISTINCT CASE WHEN dc.citation_status = 'conflict' THEN dc.sentence_index END) AS conflict_sentences,
  CASE
    WHEN d.sentence_count > 0
    THEN ROUND(
      1.0 * COUNT(DISTINCT CASE WHEN dc.citation_status = 'ok' THEN dc.sentence_index END)
      / d.sentence_count, 4)
    ELSE 0
  END AS citation_coverage
FROM drafts d
LEFT JOIN draft_claims dc ON dc.draft_id = d.id
GROUP BY d.id;

-- 重复 claim 候选（相同文本 hash 由应用层写入 metadata 也可以；这里给精确重复）
CREATE VIEW IF NOT EXISTS v_duplicate_claims AS
SELECT text, COUNT(*) AS n, GROUP_CONCAT(id) AS claim_ids
FROM claims
GROUP BY text
HAVING COUNT(*) > 1;

-- claim 与库内笔记的关联（supports / contradicts / duplicates / related）
CREATE VIEW IF NOT EXISTS v_claim_note_links AS
SELECT
  cl.claim_id,
  cl.relation,
  cl.score,
  n.id    AS note_id,
  n.path  AS note_path,
  n.title AS note_title
FROM claim_links cl
JOIN notes n ON n.id = cl.note_id;

-- 断链审计：to_note_id 为空即未解析的链接
CREATE VIEW IF NOT EXISTS v_broken_links AS
SELECT
  id,
  from_note_id,
  to_path,
  link_type
FROM note_links
WHERE to_note_id IS NULL;

-- ------------------------------------------------------------
-- v2: Persona layer
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS persona_profiles (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'draft'
             CHECK (status IN ('draft', 'reviewed', 'active', 'archived')),
  summary_md TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persona_traits (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES persona_profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL
             CHECK (kind IN ('value', 'stance', 'taboo', 'voice',
                             'biography', 'relationship', 'preference', 'goal')),
  text       TEXT NOT NULL,
  polarity   REAL,                             -- stance: -1..1
  confidence REAL NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_to   TEXT,
  status     TEXT NOT NULL DEFAULT 'candidate'
             CHECK (status IN ('candidate', 'confirmed', 'rejected', 'outdated')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traits_profile ON persona_traits(profile_id);
CREATE INDEX IF NOT EXISTS idx_traits_kind ON persona_traits(kind);
CREATE INDEX IF NOT EXISTS idx_traits_status ON persona_traits(status);

CREATE TABLE IF NOT EXISTS persona_trait_evidence (
  id         TEXT PRIMARY KEY,
  trait_id   TEXT NOT NULL REFERENCES persona_traits(id) ON DELETE CASCADE,
  note_id    TEXT REFERENCES notes(id) ON DELETE SET NULL,
  source_id  TEXT REFERENCES sources(id) ON DELETE SET NULL,
  quote      TEXT NOT NULL,
  span_start INTEGER,
  span_end   INTEGER,
  weight     REAL NOT NULL DEFAULT 1,
  CHECK (note_id IS NOT NULL OR source_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_trait_evidence_trait ON persona_trait_evidence(trait_id);
CREATE INDEX IF NOT EXISTS idx_trait_evidence_note ON persona_trait_evidence(note_id);

CREATE TABLE IF NOT EXISTS voice_features (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES persona_profiles(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,                   -- avg_sentence_len / question_rate / emoji_rate ...
  value_json  TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL,
  UNIQUE (profile_id, feature)
);

CREATE TABLE IF NOT EXISTS voice_samples (
  id            TEXT PRIMARY KEY,
  note_id       TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  split         TEXT NOT NULL DEFAULT 'train'
                CHECK (split IN ('train', 'test', 'heldout')),
  text          TEXT NOT NULL,
  features_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_samples_split ON voice_samples(split);

CREATE TABLE IF NOT EXISTS stance_events (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES persona_profiles(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL,
  polarity      REAL NOT NULL,                 -- -1..1
  confidence    REAL NOT NULL DEFAULT 0,
  observed_at   TEXT NOT NULL,
  note_id       TEXT REFERENCES notes(id) ON DELETE SET NULL,
  quote         TEXT,
  supersedes_id TEXT REFERENCES stance_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stance_topic ON stance_events(topic, observed_at);

CREATE TABLE IF NOT EXISTS consent_records (
  id         TEXT PRIMARY KEY,
  scope      TEXT NOT NULL
             CHECK (scope IN ('modeling', 'drafting', 'publishing', 'demo')),
  granted    INTEGER NOT NULL DEFAULT 0,
  granted_at TEXT,
  revoked_at TEXT,
  note       TEXT
);

CREATE TABLE IF NOT EXISTS redaction_runs (
  id             TEXT PRIMARY KEY,
  source_vault   TEXT NOT NULL,
  output_vault   TEXT NOT NULL,
  rules_json     TEXT NOT NULL DEFAULT '{}',
  stats_json     TEXT NOT NULL DEFAULT '{}',
  leak_scan_json TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_evals (
  id         TEXT PRIMARY KEY,
  draft_id   TEXT REFERENCES drafts(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL,                    -- recognizability / stylometry / stance / citation
  score      REAL NOT NULL,
  judge      TEXT NOT NULL,                    -- human / llm / stylometry
  notes      TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_evals_draft ON voice_evals(draft_id);

CREATE TABLE IF NOT EXISTS turing_trials (
  id               TEXT PRIMARY KEY,
  sample_real      TEXT NOT NULL,
  sample_agent     TEXT NOT NULL,
  guess            TEXT NOT NULL CHECK (guess IN ('real', 'agent')),
  correct          INTEGER NOT NULL,
  participant_hash TEXT,
  created_at       TEXT NOT NULL
);

-- ------------------------------------------------------------
-- Persona views
-- ------------------------------------------------------------
CREATE VIEW IF NOT EXISTS v_persona_card AS
SELECT
  t.id         AS trait_id,
  t.profile_id,
  t.kind,
  t.text,
  t.polarity,
  t.confidence,
  t.valid_from,
  t.valid_to,
  t.status,
  COUNT(e.id)  AS evidence_count
FROM persona_traits t
LEFT JOIN persona_trait_evidence e ON e.trait_id = t.id
GROUP BY t.id;

CREATE VIEW IF NOT EXISTS v_stance_timeline AS
SELECT
  s.profile_id,
  s.topic,
  s.polarity,
  s.confidence,
  s.observed_at,
  s.note_id,
  s.quote,
  s.supersedes_id
FROM stance_events s
ORDER BY s.topic, s.observed_at;

CREATE VIEW IF NOT EXISTS v_voice_eval_summary AS
SELECT
  draft_id,
  metric,
  AVG(score) AS avg_score,
  COUNT(*)   AS n
FROM voice_evals
GROUP BY draft_id, metric;

-- ------------------------------------------------------------
-- v3: Content studio (agent runs, research ledger, references)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_runs (
  id           TEXT PRIMARY KEY,
  goal         TEXT NOT NULL,
  platform     TEXT,
  audience     TEXT,
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'running', 'done', 'error')),
  plan_json    TEXT NOT NULL DEFAULT '[]',
  package_json TEXT,
  guard_json   TEXT,
  error        TEXT,
  model        TEXT,
  draft_id     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  finished_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_studio_runs_status ON studio_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_studio_runs_created ON studio_runs(created_at);

CREATE TABLE IF NOT EXISTS studio_steps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       TEXT NOT NULL REFERENCES studio_runs(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  tool_call_id TEXT,
  kind         TEXT NOT NULL DEFAULT 'tool',
  tool         TEXT,
  title        TEXT NOT NULL,
  detail       TEXT,
  status       TEXT NOT NULL DEFAULT 'running',
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  duration_ms  INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_studio_steps_run ON studio_steps(run_id, seq);

CREATE TABLE IF NOT EXISTS studio_sources (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES studio_runs(id) ON DELETE CASCADE,
  number        INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('note', 'web', 'reference')),
  title         TEXT NOT NULL,
  locator       TEXT,
  quote         TEXT,
  published_at  TEXT,
  retrieved_at  TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (run_id, number)
);

CREATE INDEX IF NOT EXISTS idx_studio_sources_run ON studio_sources(run_id, number);

CREATE TABLE IF NOT EXISTS studio_claims (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES studio_runs(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  status       TEXT NOT NULL
               CHECK (status IN ('confirmed', 'single-source', 'disputed', 'unverified', 'stale', 'opinion')),
  confidence   TEXT NOT NULL DEFAULT 'medium',
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_claims_run ON studio_claims(run_id);

CREATE TABLE IF NOT EXISTS studio_packages (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES studio_runs(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  package_json TEXT NOT NULL,
  guard_json   TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (run_id, version)
);

CREATE TABLE IF NOT EXISTS reference_notes (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'unknown',
  url           TEXT,
  author        TEXT,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  tags_json     TEXT NOT NULL DEFAULT '[]',
  followers     INTEGER,
  likes         INTEGER,
  collects      INTEGER,
  comments      INTEGER,
  posted_at     TEXT,
  imported_at   TEXT NOT NULL,
  analysis_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_reference_platform ON reference_notes(platform);
CREATE INDEX IF NOT EXISTS idx_reference_imported ON reference_notes(imported_at);

-- ------------------------------------------------------------
-- 初始记录
-- ------------------------------------------------------------
INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (1, datetime('now'));

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (2, datetime('now'));
