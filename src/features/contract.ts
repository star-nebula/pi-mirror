import type { DB } from "../db/sqlite.js";
import type { GuardReport } from "../persona/guard.js";
import type { PersonaAnswer } from "../persona/agent.js";
import type { StudioRunInput } from "../studio/types.js";

export interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  sources: PersonaAnswer["sources"];
  model: string | null;
  error?: string;
  at: string;
}

export interface FeatureMeta {
  id: string;
  label: string;
  zh: string;
  icon: string;
  order: number;
  /** Shows up in the workspace rail. Infrastructure plugins set false. */
  nav: boolean;
  description: string;
  tools: string[];
  commands: string[];
}

/** Published by the Consent plugin; Library resolves it and fails closed if absent. */
export interface ConsentService {
  list(): Array<{ scope: string; granted: boolean }>;
  isGranted(scope: string): boolean;
}

export interface FeatureRuntime {  db: DB;
  vaultRoot: string;
  dbPath: string;
  history: HistoryEntry[];
  ask(question: string): Promise<{ answer: PersonaAnswer; entry: HistoryEntry }>;
  draft(brief: string): Promise<PersonaAnswer>;
  guard(text: string): GuardReport;
  startStudio(input: StudioRunInput): Promise<void>;
  studioBusy(): boolean;
  service<T>(name: string): T | undefined;
}

export interface FeatureRequest extends FeatureRuntime {
  method: string;
  url: URL;
  body: Record<string, unknown>;
}

export interface FeatureResponse {
  status?: number;
  body: unknown;
}

export type FeatureHandler = (request: FeatureRequest) => Promise<FeatureResponse> | FeatureResponse;

export interface FeatureRoute {
  method: "GET" | "POST";
  path: string;
  handler: FeatureHandler;
}

export interface FeaturePlugin extends FeatureMeta {
  routes(runtime: FeatureRuntime): FeatureRoute[];
  /** Contributes a slice to GET /api/state. Removable without touching the host. */
  state?(runtime: FeatureRuntime): Record<string, unknown>;
  /** Publishes a named service that other features can resolve at request time. */
  services?(runtime: FeatureRuntime): Record<string, unknown>;
}

export class FeatureError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
