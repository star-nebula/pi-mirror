import esbuild from "esbuild";
import { builtinModules } from "node:module";
import process from "node:process";

const production = process.argv.includes("production");

const external = [
  "obsidian",
  "electron",
  "@codemirror/state",
  "@codemirror/view",
  "@codemirror/language",
  "@lezer/common",
  "@lezer/highlight",
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

const options = {
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  external,
  sourcemap: production ? false : "inline",
  logLevel: "info",
  treeShaking: true,
};

if (production) {
  await esbuild.build({ ...options, minify: true });
  console.log("built main.js (production)");
} else {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching src/ — reload Obsidian to pick up main.js");
}
