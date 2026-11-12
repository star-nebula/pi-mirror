import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(resolve(here, "schema.sql"), "utf8");

export type DB = Database.Database;

export function openDb(dbPath: string): DB {
  const abs = resolve(dbPath);
  mkdirSync(dirname(abs), { recursive: true });
  const db = new Database(abs);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
  return db;
}

export function defaultDbPath(): string {
  return process.env.PI_MIRROR_DB ?? resolve(process.cwd(), ".pi-mirror", "pi-mirror.db");
}
