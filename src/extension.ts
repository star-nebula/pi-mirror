import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import ask from "./extensions/ask.js";
import consent from "./extensions/consent.js";
import guard from "./extensions/guard.js";
import library from "./extensions/library.js";
import persona from "./extensions/persona.js";
import reference from "./extensions/reference.js";
import research from "./extensions/research.js";
import studio from "./extensions/studio.js";
import timeline from "./extensions/timeline.js";
import vault from "./extensions/vault.js";
import workspace from "./extensions/workspace.js";
import write from "./extensions/write.js";

/**
 * Convenience aggregator: loads every feature plugin plus the workspace host.
 *
 * Each feature is also a standalone pi extension under src/extensions/ and can
 * be loaded on its own with `pi -e`. This file exists for one-flag launches and
 * for people who prefer a single entry point.
 */
export default function piMirror(pi: ExtensionAPI) {
  vault(pi);
  persona(pi);
  ask(pi);
  write(pi);
  guard(pi);
  timeline(pi);
  library(pi);
  consent(pi);
  research(pi);
  reference(pi);
  studio(pi);
  workspace(pi);
}
