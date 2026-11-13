#!/usr/bin/env node
/**
 * Install the Pi-Mirror workbench into an Obsidian vault.
 *
 *   node scripts/install-obsidian.mjs <vault-path> [--force]
 *
 * Copies main.js / manifest.json / styles.css into
 * <vault>/.obsidian/plugins/pi-mirror and, on first install, writes data.json
 * pointing the plugin at this checkout. It never deletes notes and never
 * touches community-plugins.json — enable the plugin in Obsidian's settings.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const pluginSrc = join(repoRoot, "obsidian");
const manifest = JSON.parse(readFileSync(join(pluginSrc, "manifest.json"), "utf8"));

const args = process.argv.slice(2);
const force = args.includes("--force");
const vaultArg = args.find((arg) => !arg.startsWith("--"));

if (!vaultArg) {
  console.error("Usage: node scripts/install-obsidian.mjs <vault-path> [--force]");
  console.error("Example: node scripts/install-obsidian.mjs E:/knowledge");
  process.exit(1);
}

const vault = resolve(vaultArg);
if (!existsSync(join(vault, ".obsidian"))) {
  console.error(`Not an Obsidian vault: ${vault} has no .obsidian folder.`);
  console.error("Open the folder once in Obsidian, then run this again.");
  process.exit(1);
}

const dest = join(vault, ".obsidian", "plugins", manifest.id);
const installedMain = join(dest, "main.js");
const builtAt = existsSync(installedMain) ? statSync(installedMain).mtimeMs : 0;

if (!existsSync(join(pluginSrc, "main.js")) || newestMtime(join(pluginSrc, "src")) > builtAt || force) {
  console.log("building main.js…");
  execFileSync(process.execPath, [join(pluginSrc, "esbuild.config.mjs"), "production"], {
    cwd: pluginSrc,
    stdio: "inherit",
  });
}

mkdirSync(dest, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(join(pluginSrc, file), join(dest, file));
}

// First install only: point the plugin at this checkout. Never clobber settings.
const dataPath = join(dest, "data.json");
if (!existsSync(dataPath) || force) {
  const settings = { serverDir: repoRoot, nodePath: "node", port: 4317, indexOnOpen: true };
  writeFileSync(dataPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  console.log(`wrote settings → ${dataPath}`);
} else {
  console.log("kept existing data.json (use --force to reset it)");
}

console.log(`installed ${manifest.name} ${manifest.version} → ${dest}`);
console.log("");
console.log("Next:");
console.log("  1. In Obsidian: Settings → Community plugins → turn off Restricted mode.");
console.log(`  2. Enable "${manifest.name}", then run "Pi-Mirror: Open the workbench" or click the ribbon icon.`);
console.log(`  3. The server folder is preset to ${repoRoot}. Change it in Settings → Pi-Mirror if you move the checkout.`);

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    newest = Math.max(newest, statSync(join(entry.parentPath ?? dir, entry.name)).mtimeMs);
  }
  return newest;
}
