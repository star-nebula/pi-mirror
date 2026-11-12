import { createHash } from "node:crypto";
import type { GuardReport } from "../persona/guard.js";
import { similarity } from "./reference.js";
import type { ContentPackage, ReferenceView, StudioClaim, StudioSource } from "./types.js";

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function citationNumbers(text: string): number[] {
  const numbers = new Set<number>();
  for (const match of text.matchAll(/\[(\d{1,2})\]/g)) {
    const number = Number(match[1]);
    if (Number.isInteger(number) && number > 0) numbers.add(number);
  }
  return [...numbers];
}

export interface PackageValidationInput {
  pkg: ContentPackage;
  sources: StudioSource[];
  claims: StudioClaim[];
  references: ReferenceView[];
  guard: GuardReport | null;
  guardHash: string | null;
  bodyHash: string;
}

export interface PackageValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const STATUSES = new Set(["confirmed", "single-source", "disputed", "unverified", "stale", "opinion"]);
const FORMATS = new Set(["note", "article", "script"]);

export function validatePackage(input: PackageValidationInput): PackageValidationResult {
  const { pkg, sources, claims, references, guard, guardHash, bodyHash } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pkg.title.trim()) errors.push("title is required.");
  if (!pkg.angle.trim()) errors.push("angle is required (why this piece exists).");
  if (!pkg.whyNow.trim()) errors.push("whyNow is required (why this piece now).");
  if (pkg.body.trim().length < 40) errors.push("body is too short to be a publishable piece.");
  if (pkg.body.length > 16000) errors.push("body is too long (max 16000 characters).");
  if (!FORMATS.has(pkg.format)) errors.push("format must be note, article or script.");

  const knownSources = new Set(sources.map((source) => source.number));
  const cited = citationNumbers(pkg.body);
  for (const number of cited) {
    if (!knownSources.has(number)) {
      errors.push(`body cites [${number}] but no source with that number exists. Use only numbers returned by tools.`);
    }
  }
  if (!cited.length) {
    errors.push("body has no [n] citations. Ground factual sentences in notes or web sources, or mark them [inference]/[unknown].");
  }

  if (!guard) {
    errors.push("guard_text has not run. Call guard_text on the final body, fix high findings, then submit.");
  } else {
    if (guardHash !== bodyHash) {
      errors.push("guard_text ran on a different body. Re-run guard_text on the exact text you are submitting.");
    }
    if (guard.summary.high > 0) {
      const titles = guard.findings
        .filter((finding) => finding.severity === "high")
        .map((finding) => finding.title)
        .join(", ");
      errors.push(`Guard still has ${guard.summary.high} high finding(s): ${titles}. Revise and re-run guard_text.`);
    }
    if (guard.summary.coverage < 50) {
      warnings.push(`Citation coverage is ${guard.summary.coverage}%. Add citations or markers where you can.`);
    }
  }

  for (const claim of pkg.claims) {
    if (!STATUSES.has(claim.status)) {
      errors.push(`claim status "${claim.status}" is not allowed.`);
      continue;
    }
    if (claim.status === "confirmed" && !(claim.sources?.length ?? 0)) {
      errors.push(`confirmed claim has no source: ${claim.text.slice(0, 80)}`);
    }
    for (const number of claim.sources ?? []) {
      if (!knownSources.has(number)) errors.push(`claim cites [${number}] but no such source exists.`);
    }
  }

  const knownReferenceIds = new Set(references.map((reference) => reference.id));
  for (const used of pkg.referencesUsed) {
    if (!knownReferenceIds.has(used.id)) {
      errors.push(`reference ${used.id} is not in the reference library.`);
      continue;
    }
    const reference = references.find((item) => item.id === used.id)!;
    const copy = similarity(pkg.body, reference.body);
    if (copy >= 0.3) {
      warnings.push(
        `body is ${Math.round(copy * 100)}% similar to reference ${used.id}. Borrow structure, not sentences; rewrite before publishing.`,
      );
      if (copy >= 0.45) errors.push(`body is too close to reference ${used.id} (${Math.round(copy * 100)}%). Rewrite it.`);
    }
  }

  if (pkg.variants.length > 4) errors.push("too many platform variants (max 4).");
  for (const variant of pkg.variants) {
    if (!variant.platform.trim()) errors.push("variant platform is required.");
    if (variant.body.trim().length < 40) errors.push(`variant ${variant.platform} is too short.`);
  }

  if (claims.some((claim) => claim.status === "unverified")) {
    warnings.push("At least one verified claim is still unverified. Keep it out of the body or mark it [unknown].");
  }

  return { ok: errors.length === 0, errors, warnings };
}
