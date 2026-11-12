import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import type { DB } from "../db/sqlite.js";
import { defaultDbPath } from "../db/sqlite.js";
import { FeatureError } from "./contract.js";

export interface MirrorPaths {
  vaultRoot: string;
  dbPath: string;
}

/** Paths shared by every feature plugin, driven by the same environment contract. */
export function mirrorPaths(): MirrorPaths {
  return {
    vaultRoot: resolve(process.env.PI_MIRROR_VAULT ?? process.cwd()),
    dbPath: defaultDbPath(),
  };
}

export function asString(value: unknown, field: string, max = 8000): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new FeatureError(400, `${field} must be a non-empty string.`);
  }
  if (value.length > max) throw new FeatureError(400, `${field} is too long (max ${max} characters).`);
  return value.trim();
}

export function optionalString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function sentenceCount(text: string): number {
  return text
    .split(/[。！？.!?]/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

export function assertInside(root: string, candidate: string): string {
  const abs = resolve(root, candidate);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new FeatureError(400, "Path escapes the configured vault.");
  }
  return abs;
}

export function composeBrief(body: Record<string, unknown>): string {
  if (typeof body.brief === "string" && body.brief.trim()) {
    return body.brief.trim();
  }
  const topic = asString(body.topic, "topic", 300);
  const audience = optionalString(body.audience) ?? "my regular readers";
  const platform = optionalString(body.platform) ?? "xiaohongshu";
  const angle = optionalString(body.angle) ?? "a direct, evidence-backed take";
  const points = Array.isArray(body.points)
    ? body.points.filter((point): point is string => typeof point === "string").slice(0, 8)
    : [];

  return [
    `Topic: ${topic}`,
    `Audience: ${audience}`,
    `Platform: ${platform}`,
    `Angle: ${angle}`,
    points.length ? `Points I want to make:\n${points.map((point) => `- ${point}`).join("\n")}` : "",
    "Length: 300–600 Chinese characters, or about 150 English words.",
    "Start with the conclusion. No hashtags, no calls to action.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface NewDraft {
  id: string;
  topic: string;
  platform: string;
}

export function createDraft(
  db: DB,
  input: { content: string; topic?: string | null; platform?: string | null; audience?: string | null },
): NewDraft {
  const content = input.content.trim();
  const topic = input.topic?.trim() || content.replace(/\s+/g, " ").slice(0, 60);
  const platform = input.platform?.trim() || "xiaohongshu";
  const audience = input.audience?.trim() || null;
  const now = new Date().toISOString();
  const briefId = `brief_${randomUUID().slice(0, 8)}`;
  const draftId = `draft_${randomUUID().slice(0, 8)}`;

  db.prepare(
    "INSERT INTO briefs (id, topic, audience, platform, angle, outline_json, created_at) VALUES (?, ?, ?, ?, ?, '[]', ?)",
  ).run(briefId, topic, audience, platform, null, now);
  db.prepare(
    "INSERT INTO drafts (id, brief_id, platform, content_md, sentence_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
  ).run(draftId, briefId, platform, content, sentenceCount(content), now, now);

  return { id: draftId, topic, platform };
}
