#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultDbPath, openDb } from "./db/sqlite.js";
import { indexVault } from "./vault/index.js";
import { searchVault } from "./vault/search.js";
import { applyProposal, proposeWrite, rejectProposal } from "./vault/propose.js";
import { computeVoiceStats, ensureProfile, extractTraits } from "./persona/extract.js";
import { renderPersonaCard } from "./persona/card.js";

function usage(): void {
  console.log(`pi-mirror — a personal agent that thinks like you

Usage:
  pi-mirror index [vault] [--db path]
  pi-mirror search <query...> [--db path]
  pi-mirror persona [vault] [--db path]
  pi-mirror propose <target-path> [content] [--db path]
  pi-mirror apply <proposal-id> [--db path]
  pi-mirror reject <proposal-id> [--db path]
  pi-mirror migrate [--db path]

Environment:
  PI_MIRROR_DB      SQLite path (default: .pi-mirror/pi-mirror.db)
  PI_MIRROR_VAULT   default vault root for the extension's note_read
`);
}

const argv = process.argv.slice(2);
let dbPath = defaultDbPath();

const dbFlag = argv.indexOf("--db");
if (dbFlag >= 0) {
  const value = argv[dbFlag + 1];
  if (!value) {
    console.error("--db requires a path");
    process.exit(1);
  }
  dbPath = value;
  argv.splice(dbFlag, 2);
}

const [command, ...args] = argv;

function printHits(query: string): void {
  const db = openDb(dbPath);
  try {
    const hits = searchVault(db, query);
    if (hits.length === 0) {
      console.log(`No hits for "${query}".`);
      return;
    }
    hits.forEach((hit, index) => {
      const heading = hit.heading ? ` · ${hit.heading}` : "";
      console.log(`${index + 1}. ${hit.notePath}${heading}`);
      console.log(`   ${hit.text.replace(/\s+/g, " ").slice(0, 220)}`);
    });
  } finally {
    db.close();
  }
}

switch (command) {
  case "index": {
    const vault = resolve(args[0] ?? process.cwd());
    const db = openDb(dbPath);
    try {
      const stats = indexVault(db, vault);
      console.log(JSON.stringify({ vault, db: dbPath, ...stats }, null, 2));
    } finally {
      db.close();
    }
    break;
  }

  case "search": {
    const query = args.join(" ").trim();
    if (!query) {
      console.error("search requires a query");
      process.exit(1);
    }
    printHits(query);
    break;
  }

  case "persona": {
    const vault = resolve(args[0] ?? process.cwd());
    const db = openDb(dbPath);
    try {
      const stats = indexVault(db, vault);
      const profile = ensureProfile(db);
      const traits = extractTraits(db, vault, profile.id);
      const voice = computeVoiceStats(db, vault, profile.id);
      const card = renderPersonaCard(db, profile.id);
      console.log(card);
      console.error(
        `indexed ${stats.files} files / ${stats.chunks} chunks; ` +
          `${traits.traitsCreated} traits; ${voice.sampleSentences} sentences`,
      );
    } finally {
      db.close();
    }
    break;
  }

  case "propose": {
    const target = args[0];
    if (!target) {
      console.error("propose requires a target path");
      process.exit(1);
    }
    const content = args.length > 1 ? args.slice(1).join(" ") : readFileSync(0, "utf8");
    const db = openDb(dbPath);
    try {
      const proposal = proposeWrite(db, process.cwd(), target, content);
      console.log(JSON.stringify(proposal, null, 2));
    } finally {
      db.close();
    }
    break;
  }

  case "apply": {
    const id = args[0];
    if (!id) {
      console.error("apply requires a proposal id");
      process.exit(1);
    }
    const db = openDb(dbPath);
    try {
      applyProposal(db, process.cwd(), id);
      console.log(`applied ${id}`);
    } finally {
      db.close();
    }
    break;
  }

  case "reject": {
    const id = args[0];
    if (!id) {
      console.error("reject requires a proposal id");
      process.exit(1);
    }
    const db = openDb(dbPath);
    try {
      rejectProposal(db, id);
      console.log(`rejected ${id}`);
    } finally {
      db.close();
    }
    break;
  }

  case "migrate": {
    const db = openDb(dbPath);
    try {
      const rows = db
        .prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version")
        .all();
      console.log(JSON.stringify({ db: dbPath, migrations: rows }, null, 2));
    } finally {
      db.close();
    }
    break;
  }

  case "help":
  case "--help":
  case "-h":
  case undefined:
    usage();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
