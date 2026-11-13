# Pi-Mirror for Obsidian

A workbench pane inside your vault. It hosts the same local agent the browser
uses — the pane is the real web app in an iframe fed by a local server process,
not a reimplementation.

## Why a local process

The workspace keeps its state in SQLite through `better-sqlite3`, a native
module. Obsidian's renderer cannot load it, so the plugin spawns the compiled
Node server (`dist/server/index.js`) from the pi-mirror checkout and points the
pane at its loopback URL. Nothing new is exposed: the server already binds
`127.0.0.1` only, checks the `Host` header, and the plugin narrows CSP
`frame-ancestors` to `'self' app://obsidian.md`.

## Install (manual, this checkout)

```bash
node scripts/install-obsidian.mjs E:/knowledge
```

Then: **Settings → Community plugins → turn off Restricted mode**, enable
**Pi-Mirror**, and run `Pi-Mirror: Open the workbench` (or click the ribbon
icon). The installer presets the server folder to this checkout on first
install and leaves an existing `data.json` alone.

## Settings

| Setting | Meaning |
|---|---|
| Server folder | The pi-mirror checkout containing `dist/` and `web/`. Run `npm install && npm run build` there once. |
| Node executable | `node` from `PATH`, or an absolute path if Obsidian cannot find it. |
| Port | Preferred loopback port. If taken, the server scans upward (25 tries). |
| Index the vault on first open | Builds the note index the first time the pane opens. |

## Commands

- `Pi-Mirror: Open the workbench`
- `Pi-Mirror: Restart the local agent`
- `Pi-Mirror: Reindex this vault`
- `Pi-Mirror: Stop the local agent`
- `Pi-Mirror: Open the workbench in your browser`

## Behaviour

- Desktop only (`isDesktopOnly: true`): there is no filesystem root or child
  process on mobile.
- The server starts on first open, is reused by later panes, and is killed
  (whole process tree on Windows) when the plugin unloads.
- One database per vault, at
  `<vault>/.obsidian/plugins/pi-mirror/pi-mirror.db`. It holds the index, runs,
  drafts and proposals — never your notes.
- The agent writes through proposals. Applying one is a separate step, and
  publishing needs its own consent.

## Develop

```bash
cd obsidian
npm install
npm run build      # tsc --noEmit + esbuild → main.js
npm run dev        # esbuild in watch mode
```

The obsidian-free half (`src/server.ts`) is covered by the repo's test suite:

```bash
npx vitest run tests/obsidian-plugin.test.ts
```
