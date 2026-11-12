import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openDb } from "../db/sqlite.js";
import { CONSENT_SCOPES, readConsent, setConsent, type ConsentScope } from "../server/data.js";
import { registerFeature } from "../features/registry.js";
import { mirrorPaths } from "../features/helpers.js";
import type { ConsentService, FeaturePlugin } from "../features/contract.js";

export const feature: FeaturePlugin = {
  id: "consent",
  label: "Consent",
  zh: "授权边界",
  icon: "consent",
  order: 70,
  nav: true,
  description: "Append-only scope grants. Publishing depends on this plugin being loaded.",
  tools: [],
  commands: ["consent"],
  routes() {
    return [
      {
        method: "GET",
        path: "/api/consent",
        handler({ db }) {
          return { body: readConsent(db) };
        },
      },
      {
        method: "POST",
        path: "/api/consent",
        handler({ db, body }) {
          const scope = body.scope;
          if (typeof scope !== "string" || !CONSENT_SCOPES.includes(scope as ConsentScope)) {
            return { status: 400, body: { error: `scope must be one of: ${CONSENT_SCOPES.join(", ")}` } };
          }
          if (typeof body.granted !== "boolean") {
            return { status: 400, body: { error: "granted must be a boolean." } };
          }
          return { body: setConsent(db, scope as ConsentScope, body.granted) };
        },
      },
    ];
  },
  state({ db }) {
    return { consent: readConsent(db) };
  },
  services({ db }) {
    const consent: ConsentService = {
      list: () => readConsent(db),
      isGranted: (scope) => readConsent(db).find((record) => record.scope === scope)?.granted === true,
    };
    return { consent };
  },
};

export default function consent(pi: ExtensionAPI) {
  const paths = mirrorPaths();
  registerFeature(feature);

  pi.registerCommand("consent", {
    description: "Show or change consent scopes. Usage: /consent [modeling|drafting|publishing|demo on|off]",
    handler: async (args, ctx) => {
      const db = openDb(paths.dbPath);
      try {
        const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
          const lines = readConsent(db).map(
            (record) => `${record.scope}: ${record.granted ? "on" : "off"}${record.grantedAt ? ` · ${record.grantedAt.slice(0, 16).replace("T", " ")}` : ""}`,
          );
          pi.sendMessage({ customType: "pi-mirror-consent", content: lines.join("\n"), display: true });
          return;
        }

        const [scope, action] = parts;
        if (!CONSENT_SCOPES.includes(scope as ConsentScope) || !["on", "off"].includes(action ?? "")) {
          ctx.ui.notify("Usage: /consent [modeling|drafting|publishing|demo on|off]", "info");
          return;
        }
        const record = setConsent(db, scope as ConsentScope, action === "on");
        ctx.ui.notify(`${record.scope}: ${record.granted ? "on" : "off"}`, "info");
      } finally {
        db.close();
      }
    },
  });
}
