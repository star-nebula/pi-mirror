import type { DB } from "../db/sqlite.js";
import { listTraits, listVoice, readProfile } from "../server/data.js";
import { guardText, type GuardContext, type GuardReport } from "./guard.js";
import { DEFAULT_PROFILE_ID } from "./extract.js";

/** Shared by the Guard feature route, the Guard pi command, and the workspace runtime. */
export function guardWithDb(db: DB, text: string, context: GuardContext = {}): GuardReport {
  const profile = readProfile(db);
  const profileId = profile?.id ?? DEFAULT_PROFILE_ID;
  const traits = listTraits(db, profileId).map((trait) => ({
    kind: trait.kind,
    text: trait.text,
    polarity: trait.polarity,
    confidence: trait.confidence,
  }));
  const voice = Object.fromEntries(listVoice(db, profileId).map((feature) => [feature.feature, feature.value])) as {
    avgSentenceLen?: number;
    exclaimRate?: number;
    firstPersonRate?: number;
  };
  return guardText(text, traits, voice, context);
}
