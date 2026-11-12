import { feature as ask } from "../extensions/ask.js";
import { feature as consent } from "../extensions/consent.js";
import { feature as guard } from "../extensions/guard.js";
import { feature as library } from "../extensions/library.js";
import { feature as persona } from "../extensions/persona.js";
import { feature as reference } from "../extensions/reference.js";
import { feature as research } from "../extensions/research.js";
import { feature as studio } from "../extensions/studio.js";
import { feature as timeline } from "../extensions/timeline.js";
import { feature as vault } from "../extensions/vault.js";
import { feature as write } from "../extensions/write.js";
import type { FeaturePlugin } from "./contract.js";

/** Static composition for the dev harness and tests; production uses the live registry. */
export const allFeatures: FeaturePlugin[] = [
  vault,
  persona,
  ask,
  write,
  guard,
  timeline,
  library,
  consent,
  research,
  reference,
  studio,
];
