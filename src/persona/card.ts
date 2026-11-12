import type { DB } from "../db/sqlite.js";
import { DEFAULT_PROFILE_ID } from "./extract.js";

const KIND_LABEL: Record<string, string> = {
  value: "价值",
  stance: "立场",
  taboo: "禁忌",
  voice: "语气",
  biography: "经历",
  relationship: "关系",
  preference: "偏好",
  goal: "目标",
};

const VOICE_LABEL: Record<string, string> = {
  avgSentenceLen: "平均句长（字）",
  questionRate: "问句率",
  exclaimRate: "感叹句率",
  emojiRate: "emoji / 句",
  listRate: "列表行占比",
  avgParagraphLen: "平均段长（字）",
  firstPersonRate: "第一人称句占比",
  englishMixRate: "中英混排行占比",
};

interface TraitRow {
  trait_id: string;
  kind: string;
  text: string;
  polarity: number | null;
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
  status: string;
  evidence_count: number;
}

interface VoiceRow {
  feature: string;
  value_json: string;
}

export interface PersonaCardOptions {
  maxPerKind?: number;
  includeEvidence?: boolean;
}

export function renderPersonaCard(
  db: DB,
  profileId = DEFAULT_PROFILE_ID,
  options: PersonaCardOptions = {},
): string {
  const profile = db
    .prepare("SELECT id, name, version, status FROM persona_profiles WHERE id = ?")
    .get(profileId) as
    | { id: string; name: string; version: number; status: string }
    | undefined;

  if (!profile) {
    return `# Persona Card\n\nNo profile found. Run \`pi-mirror persona <vault>\` first.`;
  }

  const traits = db.prepare(`
    SELECT trait_id, kind, text, polarity, confidence, valid_from, valid_to, status, evidence_count
    FROM v_persona_card
    WHERE profile_id = ? AND status != 'rejected'
    ORDER BY kind, confidence DESC, evidence_count DESC
  `).all(profileId) as TraitRow[];

  const voice = db.prepare(`
    SELECT feature, value_json
    FROM voice_features
    WHERE profile_id = ?
    ORDER BY feature
  `).all(profileId) as VoiceRow[];

  const sample = db.prepare(`
    SELECT MAX(sample_size) AS n FROM voice_features WHERE profile_id = ?
  `).get(profileId) as { n: number | null } | undefined;

  const evidenceStmt = db.prepare(`
    SELECT quote FROM persona_trait_evidence
    WHERE trait_id = ?
    ORDER BY weight DESC
    LIMIT 1
  `);

  const lines: string[] = [];
  lines.push(`# Persona Card · ${profile.name}`);
  lines.push("");
  lines.push(
    `> profile \`${profile.id}\` · v${profile.version} · ${profile.status} · ` +
      `${traits.length} traits · ${sample?.n ?? 0} sentences`,
  );
  lines.push("");

  const kinds = new Map<string, TraitRow[]>();
  for (const trait of traits) {
    const list = kinds.get(trait.kind) ?? [];
    list.push(trait);
    kinds.set(trait.kind, list);
  }

  const maxPerKind = options.maxPerKind ?? 8;
  for (const [kind, items] of kinds) {
    lines.push(`## ${KIND_LABEL[kind] ?? kind}`);
    for (const item of items.slice(0, maxPerKind)) {
      const confidence = Math.round(item.confidence * 100);
      const polarity =
        item.polarity === null ? "" : ` · polarity ${item.polarity > 0 ? "+" : ""}${item.polarity}`;
      lines.push(
        `- ${item.text}  `,
        `  ${confidence}% · ${item.evidence_count} evidence${polarity} · ${item.status}`,
      );
      if (options.includeEvidence !== false) {
        const evidence = evidenceStmt.get(item.trait_id) as { quote: string } | undefined;
        if (evidence) lines.push(`  > ${evidence.quote}`);
      }
    }
    if (items.length > maxPerKind) {
      lines.push(`- … 另有 ${items.length - maxPerKind} 条`);
    }
    lines.push("");
  }

  if (voice.length > 0) {
    lines.push("## 语气指纹");
    lines.push("");
    lines.push("| 特征 | 值 |");
    lines.push("|---|---|");
    for (const row of voice) {
      let value = row.value_json;
      try {
        value = String(JSON.parse(row.value_json));
      } catch {
        // keep raw
      }
      lines.push(`| ${VOICE_LABEL[row.feature] ?? row.feature} | ${value} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "每条 trait 都应能点回原文；未确认的 trait 是候选，不是结论。发布前必须人工审阅。",
  );

  return lines.join("\n");
}
