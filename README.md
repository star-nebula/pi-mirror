# Pi-Mirror

> A personal agent that thinks like you, grounded in your Markdown notes.
> 从你的笔记里长出一个「你」：知道你怎么想、怎么写、什么时候改变主意。

Pi-Mirror is a **usable local workspace**, not a product landing page. It opens a small app where a goal-driven **Studio** agent researches a topic, reads your vault, borrows structure from reference posts, verifies claims, drafts a social note, runs Guard on its own draft, and hands you a cited content package. The same workspace can answer questions in the first person, review the trait evidence behind the persona, and record what you published. Every agent turn runs on a real [pi](https://pi.dev) `AgentSession`; the whole thing is a hot-pluggable pi extension.

See [docs/feature-map.md](docs/feature-map.md) for the source map, or open [docs/feature-map.html](docs/feature-map.html) for the visual version.

## The product

| Surface | What you do there |
|---|---|
| **Studio** | Give one goal, not a pipeline. The agent plans its own path, scans trends, searches the web, reads your notes, studies reference posts, verifies claims, drafts, runs Guard, and submits a content package. The plan, every tool call, numbered evidence, claim verdicts and Guard report stay visible on the run. |
| **Knowledge base** | One conversation surface. Switch between **ask / write / check** without leaving the thread: answers cite notes as `[1]`, drafts carry a Guard summary, and citations open in place. |
| **Library** | Review drafts and their status; record a publish with platform, URL, and time. |
| **You** (drawer) | Review trait evidence in **Persona**, read stance changes in **Changes**, and grant scopes in **Consent**. Records are append-only. |

Studio is not a fixed content pipeline. The same tool set supports a hot-topic brief, a "what should I write today?" pass over your own notes, and a repurpose/angle exploration. The model writes the plan at runtime; the UI never hard-codes research stages. It never publishes: saving is an explicit click, and recording a publish still needs the `publishing` consent scope.

The interface ships in **Chinese and English**. The globe in the top bar switches the whole workspace — navigation, modes, drawers, Guard findings, statuses, dates, and the command palette — and remembers the choice; a first visit follows the browser language. Vault content and generated drafts keep the language they were written in.

The left rail stays at three entries: **Studio**, **Knowledge base** (still routed at `#/mirror`), **Library**. Persona, Ask, Write, Guard, Timeline, and Consent remain reachable as deep links (`#/persona`, `#/ask`, `#/write`, `#/guard`, `#/timeline`, `#/consent`) for bookmarks and debugging, but they are not top-level navigation.

The app is served from `127.0.0.1` only, with a Host allow-list (DNS-rebinding protection), a strict CSP, and no CORS. The vault is read-only from the product's point of view. Research may fetch public pages and search the web; it never posts to a platform. Publishing is blocked with `403` unless the `publishing` consent scope is currently granted.

## Run it

Requires Node.js >= 22.5 and pi.

```bash
npm install
npm run serve
```

`npm run serve` indexes `demo/vault` (when no `PI_MIRROR_VAULT` is set) and prints a local URL. It is a development harness; the product path is the pi extension below.

### As pi plugins (the real path)

Every product feature is its own pi extension under `src/extensions/`. Nothing patches pi. Load a subset:

```bash
pi -e ./src/extensions/workspace.ts \
   -e ./src/extensions/vault.ts \
   -e ./src/extensions/persona.ts \
   -e ./src/extensions/ask.ts \
   -e ./src/extensions/write.ts \
   -e ./src/extensions/guard.ts \
   -e ./src/extensions/timeline.ts \
   -e ./src/extensions/library.ts \
   -e ./src/extensions/consent.ts \
   -e ./src/extensions/research.ts \
   -e ./src/extensions/reference.ts \
   -e ./src/extensions/studio.ts
```

Or load everything through the aggregator:

```bash
pi -e ./src/extension.ts
```

Inside pi:

```text
/mirror                     open the workspace (starts the local server and a browser tab)
/mirror status | stop       inspect or stop it
/persona                    print the persona card
/ask <question>             ask the persona agent
/draft <topic>              draft, save to the library, and run Guard
/guard <text>               check any text against your traits and voice
/vault <query>              search the vault
/timeline                   show recent stance changes
/drafts                     list drafts and status
/consent [scope on|off]     inspect or change a consent scope
```

| Plugin | Surface | Command | Tool | API |
|---|---|---|---|---|
| `workspace` | shell | `/mirror` | — | `/api/state`, `/api/features`, `/api/health` |
| `vault` | — | `/vault` | `vault_index`, `vault_search`, `note_read`, `propose_note` | `/api/search`, `/api/note`, `/api/index` |
| `persona` | You → Persona | `/persona` | `persona_card` | `/api/persona`, `/api/traits/status` |
| `ask` | Knowledge base · ask | `/ask` | — | `/api/ask`, `/api/history` |
| `write` | Knowledge base · write | `/draft` | — | `/api/write`, `/api/drafts` |
| `guard` | Knowledge base · check | `/guard` | `guard_text` | `/api/guard` |
| `timeline` | You → Changes | `/timeline` | — | `/api/timeline` |
| `library` | Library | `/drafts` | — | `/api/publish`, `/api/drafts/status` |
| `consent` | You → Consent | `/consent` | — | `/api/consent` |
| `research` | Studio tools | — | `web_search`, `fetch_page`, `verify_claim`, `trend_scan` | `/api/research/search`, `/api/research/fetch`, `/api/research/verify`, `/api/research/trends` |
| `reference` | Studio → Reference library | — | `reference_search`, `reference_analyze` | `GET/POST /api/references`, `POST /api/references/analyze` |
| `studio` | Studio | — | `update_plan`, `trend_scan`, `web_search`, `fetch_page`, `verify_claim`, `note_search`, `note_read`, `note_recent`, `stance_history`, `reference_search`, `reference_analyze`, `guard_text`, `submit_package` | `POST/GET /api/studio/runs`, `GET /api/studio/run`, `POST /api/studio/save` |

The manifest lists all twelve under `pi.extensions` (eleven feature plugins plus the workspace host), so pi can enable or disable them individually. Loading a subset really removes the feature: with only `workspace` + `ask`, `/api/features` returns `["ask"]`, `/api/persona` returns `404`, and `/api/state` has no persona slice. `library` resolves a `consent` service at request time and fails publishing closed when the Consent plugin is absent.

The workspace starts on demand and closes on `session_shutdown` or `/mirror stop`. State is stored in `.pi-mirror/pi-mirror.db` under the current working directory. To use built output:

```bash
npm run build
pi -e ./dist/extension.js
```

### As an Obsidian plugin

The same workbench ships as a desktop Obsidian plugin (`obsidian/`), so the agent can live in a vault pane:

```bash
node scripts/install-obsidian.mjs E:/knowledge   # any vault path
```

It copies `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/pi-mirror`, then you enable **Pi-Mirror** in Settings → Community plugins. The plugin does not reimplement anything: it spawns the compiled server from this checkout (`dist/server/index.js`) with your vault as `PI_MIRROR_VAULT` and hosts its loopback URL in an `ItemView`. It is desktop-only, kills the process tree on unload, and keeps its database inside the plugin folder — notes are still only written through proposals. See [`obsidian/README.md`](obsidian/README.md).

### Model

Ask, Write and Studio each create a fresh in-memory pi session with only their own tools and system prompt (no other extensions, skills, prompt templates, or context files). The model and provider come from your existing pi settings (`~/.pi/agent/settings.json`); Pi-Mirror does not store or ask for API keys. If no model is usable, the UI shows the pi error instead of inventing an answer.

Studio runs with a six-minute budget. It can finish early, ask the user through `questions` in the package, or fail honestly: a run that never calls `submit_package` is marked `error`, not turned into a fake draft. A package is accepted only when every citation points at a recorded source, the Guard hash matches the exact submitted body, and there are no high-severity Guard findings. The agent is expected to loop: draft → `guard_text` → fix → submit.

## How it works

```
pi
 ├── feature plugins ── register via the feature registry
 │     ├── vault · persona · ask · write · guard · timeline · library · consent
 │     ├── research · reference · studio
 │     └── each owns its tools, commands, API routes, state slice, services
 └── workspace plugin ── /mirror
       ├── static app (web/)
       ├── /api/state   composes every loaded feature's state slice
       ├── /api/features lists what is actually loaded
       └── dispatches /api/* to the owning feature plugin (404 if absent)
```

- **Feature plugins** — each capability registers its own pi tools and slash command, its own HTTP routes, an optional slice of `/api/state`, and optional named services. The workspace host knows none of them by name.
- **Retrieval** — Markdown is chunked with source offsets and indexed in SQLite FTS5 (trigram). Long Chinese questions are tokenized into terms and CJK bigrams, scored with FTS plus LIKE fallback, then merged.
- **Citations** — a per-turn ledger assigns one global number per source. Search results and `note_read` reuse numbers, and the UI maps `[n]` back to the exact snippet.
- **Deterministic drafts** — the Write agent must call the `submit_draft` tool with the final Markdown, so preambles and review notes never end up in the saved draft.
- **Repair turn** — if citations are missing or too sparse, one extra turn rewrites the answer; it is accepted only if it has more citations and keeps at least 40% of the original length.
- **Studio run trace** — a dedicated `AgentSession` per run. `tool_execution_start/end` events are persisted as numbered steps keyed by `toolCallId`, so parallel tools do not overwrite each other. The UI polls one run endpoint and renders the plan, tool trace, sources, claims and package.
- **Research** — Bing HTML search, public-page fetch with SSRF checks (http/https only; localhost and private IPs rejected), a Techmeme RSS fallback, and a local `demo/trends/*.json` pack for reproducible demos. Search-result wrappers are unwrapped to the real source domain before claim verification.
- **Claims** — `verify_claim` looks for independent domains and support/contradiction language, then marks a claim `confirmed`, `single-source`, `disputed`, `unverified`, `stale` or `opinion`. Guard consumes the same verdicts, so a disputed claim becomes a high finding.
- **Content package** — title, angle, why-now, audience, platform, format, body, title options, alternative angles, claims, references used, open questions, risks and platform variants. `validatePackage` rejects uncited or out-of-ledger citations, a missing/mismatched Guard, high findings, confirmed claims without sources, unknown reference ids, and near-copies of a reference (4-gram Jaccard ≥ 0.45).
- **Guard** — heuristic, sentence-level checks for absolute claims, taboo tension, uncited claims, invented first-person anecdotes, citation coverage, sentence-length distance, exclamation drift, and disputed / unverified / single-source / stale claims.
- **Consent** — append-only `consent_records`; the latest row per scope wins. Only `publishing` is enforced server-side today.

## What works today

- Local workspace app with **Studio + Knowledge base + Library**; Persona, Changes, and Consent live in the You drawer. Responsive at 1440 and 390.
- Eleven product features, each a standalone pi extension with its own tools, commands, API routes and state slice; the workspace rail is built from `/api/features`.
- Real pi `AgentSession` per Studio run and per Ask/Write turn, with vault search, note reading, persona card, web research, reference analysis, claim verification, Guard and package submission tools.
- Studio's visible plan + tool trace + numbered evidence + claim verdicts + Guard loop, all persisted in SQLite per run.
- Reference library with engagement metrics, follower tier, structure analysis and near-copy detection.
- Grounded Chinese retrieval, numbered citations, citation repair, and a guard report on every draft.
- Trait extraction with evidence, review actions, voice statistics, and a stance timeline.
- Append-only consent ledger and a hard publish gate that fails closed when the Consent plugin is absent.
- Draft library and publish records backed by SQLite.
- 37 tests across chunking, retrieval, proposal safety, persona extraction, guard heuristics, Studio validation, reference analysis, research parsing, HTTP API, and plugin composition (subset loading, 404s, and the consent gate).

## Limits and next steps

- Ask history is in memory for the life of the server; Studio runs, drafts, reference posts, traits, consent, and publishes persist.
- Trait extraction is still rule-based; LLM extraction plus a larger review queue is next.
- Only the `publishing` consent scope changes server behavior; `modeling`, `drafting`, and `demo` are recorded intents today.
- Studio research is public-web only. X.com itself is login-walled from the server; the included `demo/trends/2026-11-11.json` records a real X topic and post URLs captured in a logged-in browser. Bing HTML is the search backend; a search API key is not required.
- The public demo will use a desensitized vault with a leak scan. The real vault and the mapping table stay outside the repository.
- Next: richer stance timeline, an eval suite for answer faithfulness, and a read-only hosted demo.

## Privacy

Pi-Mirror is designed for a private vault:

- The server binds to loopback only and rejects non-loopback `Host` headers.
- The vault is read; writes go through proposals with a hash check, never direct edits.
- Sensitive directories (`Interview/`, `AboutMe/`, `Memory/`, `DailyNotes/`) are not part of the demo and must never be copied into the public repository.
- No auto-publishing, no platform posting API, no third-party impersonation, no training on your notes.
- Studio research does send its search queries to Bing/Techmeme and fetches public pages; it does not upload the vault. Drafts stay local until you save or copy them.
- The desensitization mapping table lives outside the repo.

## Development

```bash
npm run typecheck
npm test
npm run build
```

MIT.
