import type { GuardReport } from "../persona/guard.js";

export type SourceKind = "note" | "web" | "reference";

export type ClaimStatus =
  | "confirmed"
  | "single-source"
  | "disputed"
  | "unverified"
  | "stale"
  | "opinion";

export type RunStatus = "queued" | "running" | "done" | "error";

export type PlanStatus = "pending" | "active" | "done" | "skipped";

export interface PlanStep {
  title: string;
  status: PlanStatus;
}

export interface StudioSource {
  number: number;
  kind: SourceKind;
  title: string;
  locator: string | null;
  quote: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  metadata?: Record<string, unknown>;
}

export interface StudioClaim {
  id: string;
  text: string;
  status: ClaimStatus;
  confidence: string;
  sources: number[];
  createdAt: string;
}

export interface PackageAngle {
  title: string;
  rationale: string;
  evidence?: number[];
  risk?: string;
}

export interface PackageClaim {
  text: string;
  status: ClaimStatus;
  confidence?: string;
  sources?: number[];
}

export interface PackageReference {
  id: string;
  pattern?: string;
}

export interface PackageVariant {
  platform: string;
  body: string;
}

export type PackageFormat = "note" | "article" | "script";

export interface ContentPackage {
  title: string;
  angle: string;
  whyNow: string;
  audience: string;
  platform: string;
  format: PackageFormat;
  body: string;
  titleOptions: string[];
  angles: PackageAngle[];
  chosenAngle: string;
  claims: PackageClaim[];
  referencesUsed: PackageReference[];
  questions: string[];
  risks: string[];
  variants: PackageVariant[];
}

export interface StudioStep {
  id: number;
  seq: number;
  tool: string | null;
  title: string;
  detail: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  payload: unknown;
}

export interface StudioRun {
  id: string;
  goal: string;
  platform: string | null;
  audience: string | null;
  status: RunStatus;
  plan: PlanStep[];
  package: ContentPackage | null;
  guard: GuardReport | null;
  error: string | null;
  model: string | null;
  draftId: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  steps: StudioStep[];
  sources: StudioSource[];
  claims: StudioClaim[];
}

export interface StudioRunInput {
  runId: string;
  goal: string;
  platform: string | null;
  audience: string | null;
}

export interface ReferenceMetrics {
  followers?: number | null;
  likes?: number | null;
  collects?: number | null;
  comments?: number | null;
}

export interface ReferenceInput extends ReferenceMetrics {
  platform?: string;
  url?: string;
  author?: string;
  title?: string;
  body?: string;
  tags?: string[];
  postedAt?: string;
}

export interface ReferenceAnalysis {
  title: string;
  hook: string;
  preview: string;
  stats: {
    chars: number;
    sentences: number;
    paragraphs: number;
    listLines: number;
    questions: number;
    exclamations: number;
    emojis: number;
    avgSentenceLength: number;
  };
  patterns: string[];
  keywords: string[];
}

export interface ReferenceView extends ReferenceAnalysis {
  id: string;
  platform: string;
  url: string | null;
  author: string | null;
  tags: string[];
  followers: number | null;
  likes: number | null;
  collects: number | null;
  comments: number | null;
  postedAt: string | null;
  importedAt: string;
  engagement: number;
  engagementPerFollower: number | null;
  followerTier: "nano" | "micro" | "mid" | "macro" | "unknown";
  body: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  site: string;
  publishedAt: string | null;
  text: string;
  quote: string;
}

export interface ClaimVerdict {
  claim: string;
  status: ClaimStatus;
  confidence: "high" | "medium" | "low";
  note: string;
  sources: SearchResult[];
}

export interface TrendItem {
  title: string;
  url: string | null;
  source: string;
  publishedAt: string | null;
  summary: string;
  heat?: string | null;
  posts?: Array<{ url: string; author?: string; text?: string; observedAt?: string }>;
}
