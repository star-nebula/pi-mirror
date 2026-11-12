import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

mkdirSync(resolve(root, "dist", "db"), { recursive: true });
cpSync(resolve(root, "src", "db", "schema.sql"), resolve(root, "dist", "db", "schema.sql"));
console.log("copied schema.sql to dist/db/");

mkdirSync(resolve(root, "dist"), { recursive: true });
cpSync(resolve(root, "web"), resolve(root, "dist", "web"), { recursive: true });
console.log("copied web/ to dist/web/");
