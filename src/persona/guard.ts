export interface GuardTrait {
  kind: string;
  text: string;
  polarity?: number | null;
  confidence?: number;
}

export interface GuardVoice {
  avgSentenceLen?: number;
  exclaimRate?: number;
  firstPersonRate?: number;
}

export interface GuardFinding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  evidence: string | null;
}

export interface GuardReport {
  findings: GuardFinding[];
  summary: { high: number; medium: number; low: number; sentences: number; coverage: number };
  checkedTraits: number;
}

export interface GuardClaim {
  text: string;
  status: string;
  confidence?: string;
}

export interface GuardContext {
  claims?: GuardClaim[];
  sourceCount?: number;
}

const ABSOLUTE_WORDS = [
  "所有人",
  "每个人",
  "所有人都会",
  "一定",
  "必然",
  "绝对",
  "从不",
  "永远",
  "彻底",
  "颠覆",
  "革命",
  "保证",
  "100%",
  "毫无疑问",
  "everyone",
  "everybody",
  "always",
  "never",
  "guarantee",
  "undoubtedly",
  "definitely",
  "100 percent",
];

const CLAIM_WORDS = [
  "是",
  "会",
  "应该",
  "必须",
  "证明",
  "说明",
  "导致",
  "因为",
  "所以",
  " is ",
  " will ",
  " should ",
  " must ",
  " proves ",
  " causes ",
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function averageSentenceLength(sentences: string[]): number {
  if (!sentences.length) return 0;
  const total = sentences.reduce((sum, sentence) => sum + [...sentence].length, 0);
  return Math.round((total / sentences.length) * 10) / 10;
}

function cited(sentence: string): boolean {
  return /\[\d+\]/.test(sentence) || /\[\s*(note|inference|unknown)\s*\]/i.test(sentence);
}

export function guardText(
  text: string,
  traits: GuardTrait[],
  voice: GuardVoice = {},
  context: GuardContext = {},
): GuardReport {
  const findings: GuardFinding[] = [];
  const sentences = splitSentences(text);
  const lower = text.toLowerCase();

  const absolutes = ABSOLUTE_WORDS.filter((word) => lower.includes(word.toLowerCase()));
  if (absolutes.length) {
    findings.push({
      id: "absolute-claims",
      severity: "high",
      title: "Absolute claims",
      detail: `Found ${absolutes.length} absolute phrase${absolutes.length > 1 ? "s" : ""} that are hard to support with notes.`,
      evidence: absolutes.join(" · "),
    });
  }

  const taboos = traits.filter((trait) => trait.kind === "taboo");
  if (taboos.length && absolutes.length) {
    findings.push({
      id: "taboo-tension",
      severity: "high",
      title: "Tension with a taboo",
      detail: `The draft uses language close to a declared taboo: “${taboos[0].text}”.`,
      evidence: taboos[0].text,
    });
  }

  const unsupported = sentences.filter((sentence) => !cited(sentence) && CLAIM_WORDS.some((word) => sentence.includes(word)));
  if (unsupported.length) {
    findings.push({
      id: "unsupported-claims",
      severity: unsupported.length > 2 ? "high" : "medium",
      title: "Unsupported claims",
      detail: `${unsupported.length} sentence${unsupported.length > 1 ? "s" : ""} make a claim without a citation or an explicit inference marker.`,
      evidence: unsupported[0].slice(0, 120),
    });
  }

  const ANECDOTE_MARKERS = /以前|那年|有一次|曾经|当时|后来|几年前|去年|小时候|上大学|刚工作/;
  const hasNumericCitation = (sentence: string) => /\[\d+\]/.test(sentence);
  const unbackedNarrative = sentences.filter(
    (sentence) => sentence.includes("我") && ANECDOTE_MARKERS.test(sentence) && !hasNumericCitation(sentence),
  );
  if (unbackedNarrative.length) {
    findings.push({
      id: "unbacked-narrative",
      severity: "high",
      title: "Unbacked personal narrative",
      detail:
        "A first-person anecdote has no note citation. A persona must not stage your history, even with an inference label.",
      evidence: unbackedNarrative[0].slice(0, 140),
    });
  }

  const avg = averageSentenceLength(sentences);
  if (typeof voice.avgSentenceLen === "number" && voice.avgSentenceLen > 0) {
    const distance = Math.abs(avg - voice.avgSentenceLen);
    if (distance >= 18) {
      findings.push({
        id: "style-distance",
        severity: distance >= 30 ? "high" : "medium",
        title: "Style distance",
        detail: `Average sentence length is ${avg} characters; your vault averages ${voice.avgSentenceLen}.`,
        evidence: `${avg} vs ${voice.avgSentenceLen}`,
      });
    }
  }

  const exclaims = (text.match(/[!！]/g) ?? []).length;
  if (sentences.length && exclaims / sentences.length > 0.15) {
    findings.push({
      id: "exclaim-rate",
      severity: "low",
      title: "Punctuation drift",
      detail: `${exclaims} exclamation mark${exclaims > 1 ? "s" : ""} across ${sentences.length} sentences.`,
      evidence: "exclamation rate",
    });
  }

  const claims = context.claims ?? [];
  const presentClaims = claims.filter((claim) => {
    const needle = claim.text.replace(/\s+/g, " ").trim().slice(0, 30);
    return needle.length >= 8 && text.replace(/\s+/g, " ").includes(needle);
  });
  const disputed = presentClaims.filter((claim) => claim.status === "disputed");
  if (disputed.length) {
    findings.push({
      id: "disputed-claim",
      severity: "high",
      title: "Disputed claim",
      detail: `${disputed.length} claim${disputed.length > 1 ? "s" : ""} in this draft ${disputed.length > 1 ? "are" : "is"} disputed by the sources. Write the disagreement, do not pick a side silently.`,
      evidence: disputed[0].text.slice(0, 160),
    });
  }
  const unverified = presentClaims.filter((claim) => claim.status === "unverified");
  if (unverified.length) {
    findings.push({
      id: "unverified-claim",
      severity: "high",
      title: "Unverified claim",
      detail: `${unverified.length} claim${unverified.length > 1 ? "s have" : " has"} no reliable source. Remove ${unverified.length > 1 ? "them" : "it"} or mark ${unverified.length > 1 ? "them" : "it"} [unknown].`,
      evidence: unverified[0].text.slice(0, 160),
    });
  }
  const singleSource = presentClaims.filter((claim) => claim.status === "single-source");
  if (singleSource.length) {
    findings.push({
      id: "single-source",
      severity: "medium",
      title: "Single-source claim",
      detail: `${singleSource.length} claim${singleSource.length > 1 ? "s rest" : " rests"} on one source. Hedge the wording or find an independent source.`,
      evidence: singleSource[0].text.slice(0, 160),
    });
  }
  const stale = presentClaims.filter((claim) => claim.status === "stale");
  if (stale.length) {
    findings.push({
      id: "stale-claim",
      severity: "medium",
      title: "Stale claim",
      detail: `${stale.length} claim${stale.length > 1 ? "s are" : " is"} old enough to mislead a "today" piece. Date it or replace it.`,
      evidence: stale[0].text.slice(0, 160),
    });
  }

  const citedCount = sentences.filter(cited).length;
  const coverage = sentences.length ? Math.round((citedCount / sentences.length) * 100) : 0;
  if (sentences.length && coverage < 50) {
    findings.push({
      id: "citation-coverage",
      severity: coverage < 25 ? "high" : "medium",
      title: "Low citation coverage",
      detail: `Only ${coverage}% of sentences carry a citation or an inference marker.`,
      evidence: `${citedCount}/${sentences.length}`,
    });
  }

  return {
    findings,
    summary: {
      high: findings.filter((finding) => finding.severity === "high").length,
      medium: findings.filter((finding) => finding.severity === "medium").length,
      low: findings.filter((finding) => finding.severity === "low").length,
      sentences: sentences.length,
      coverage,
    },
    checkedTraits: traits.length,
  };
}
