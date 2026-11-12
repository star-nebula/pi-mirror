#!/usr/bin/env node
import { resolve } from "node:path";
import { defaultDbPath } from "../db/sqlite.js";
import { startWorkspace } from "./app.js";
import { allFeatures } from "../features/all.js";

const vaultRoot = resolve(process.env.PI_MIRROR_VAULT ?? "demo/vault");
const dbPath = defaultDbPath();

const handle = await startWorkspace({ vaultRoot, dbPath, features: allFeatures });

console.log(`Pi-Mirror workspace: ${handle.url}`);
console.log(`vault: ${vaultRoot}`);
console.log(`db:    ${dbPath}`);
console.log("Open the URL in a browser. Ask and Write turns run through a real pi AgentSession.");

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await handle.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
