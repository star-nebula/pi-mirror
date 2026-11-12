import { openDb, defaultDbPath } from "./sqlite.js";

const dbPath = process.argv[2] ?? defaultDbPath();
const db = openDb(dbPath);

const migrations = db
  .prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version")
  .all();

console.log(JSON.stringify({ db: dbPath, migrations }, null, 2));
db.close();
