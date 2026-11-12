# Pi-Mirror — Frontend Design Brief

> Source: `E:/knowledge/Interview/pi-press/PRD.md` Appendix C. This file is the hand-off brief for the
> OpenDesign `open-design-mode` skill (`collect_brief` → confirm → `start_run`).
> Scope: design the product UI, not the Week 1 verification harness.

## Deliverable

A responsive, desktop-first web app UI covering 7 screens plus one clickable prototype.
Implementation target: React + Tailwind-compatible markup, but the design should stand alone as
HTML/CSS with real interaction states.

## Product

- **Name:** Pi-Mirror
- **One-liner:** A quiet, editorial workspace where you meet a version of yourself built from your notes.
- **Audience:** developers and knowledge workers who keep a Markdown vault and write regularly.
- **Job:** show a person-agent that answers, writes, and holds stances with evidence — and can say
  "I don't know".

## Vibe

Editorial, intimate, trustworthy. A study rather than a dashboard. Paper and ink. Not a chat app,
not a SaaS marketing page. The interface should feel like reading a well-set book that happens to
be about you.

## Screens

### 1. Persona Card (landing)

- Grid of trait cards grouped by kind: value / stance / taboo / voice / biography / relationship /
  preference / goal.
- Each card: trait text, confidence (0–1 as a thin bar), evidence count, active time range,
  and one representative quote.
- A "draft" or "needs review" state must be visually distinct from "confirmed".
- Clicking a card opens an evidence drawer: source quotes with note path, date, and weight.
- Header strip: profile version, notes indexed, sentences analyzed, last rebuilt.

### 2. Ask

- First-person answer, long-form, with inline citation chips referencing specific notes.
- Three answer registers that must look different:
  - `[note]` — supported by notes (sage),
  - `[inference]` — model's guess (amber),
  - `[unknown]` — explicit "I don't know" (neutral, muted, never hidden).
- Right-hand evidence panel listing the cited notes; clicking a chip scrolls/highlights the source.
- A visible "this is a simulation of me" framing, not a fake person.

### 3. Write

- Split editor: draft on the left, voice panel on the right.
- Sentence-level citation underlines in the draft; unverified sentences marked.
- Voice panel: overall score 0–100, per-dimension bars (sentence length, question rate, emoji,
  first person, list usage, paragraph length), and 3 rewrite suggestions.
- Bottom citation audit: every claim → note, or an explicit gap.

### 4. Guard

- Paste box → report: style distance, stance conflicts, taboo words, unsupported claims.
- Each finding must cite the conflicting trait or note.
- Tone: a proofreader's margin notes, not a red error wall.

### 5. Timeline

- Topic timeline showing when a belief appeared, strengthened, or reversed.
- Turning-point cards with before/after quotes and dates.
- Horizontal scrub or vertical spine; must work with two or three topics.

### 6. Kit

- Content kit previews: 1080×1440 card, platform copy, export buttons, publish log.
- Read-only history of what was published, where, and with which citations.

### 7. Consent

- Four independent toggles: modeling / drafting / publishing / demo.
- Revoke, export, and delete-data actions with clear consequences.
- Consent record history, not just current state.

## Visual language

- **Palette:** warm paper `#F6F1E7`, ink `#1C1A17`, muted terracotta `#B4552D` (warnings),
  sage `#5F6F52` (evidence), amber `#C98A2E` (inference).
- **Type:** serif display for headings (Source Serif / Noto Serif SC), sans for UI (Inter /
  Noto Sans SC), mono for evidence and paths (JetBrains Mono).
- **Layout:** generous margins, 12-column grid, cards with thin 1px rules, no heavy shadows,
  no rounded-everything.
- **Motion:** subtle. Evidence drawer slide, staggered card reveal, timeline scroll.
  Respect `prefers-reduced-motion`.
- **Dark mode:** deep ink `#141311` with warm paper text `#EDE6D8`.
- **Density:** comfortable; the product should feel calm at 1440px and usable at 390px.

## Copy and language

- Interface copy in English. Sample vault content stays in Chinese, because the demo vault is a
  real (desensitized) Chinese vault — this bilingual contrast is intentional and should look
  deliberate, not broken.
- No emoji in UI chrome. No exclamation marks in product voice.

## Anti-patterns

- No neon gradients, glassmorphism, or AI-purple.
- No chatbot bubbles as the main surface.
- No dashboard KPI wall.
- No unlabeled spinners — every long step names what it is doing.
- No fake testimonial or fake user count.

## Demo constraints

- Persistent banner: "Desensitized demo vault · no real notes uploaded".
- Read-only; rate-limited; no upload of real notes.
- All evidence paths point at the demo vault.

## Data the UI must accommodate

From the Week 1 schema and harness (`src/server/index.ts`):

```ts
type Trait = {
  trait_id: string;
  kind: "value" | "stance" | "taboo" | "voice" | "biography" | "relationship" | "preference" | "goal";
  text: string;
  polarity: number | null;   // -1..1, for stances
  confidence: number;        // 0..1
  status: "draft" | "confirmed" | "rejected";
  evidence_count: number;
  quote: string | null;
};

type VoiceFeature = { feature: string; value: number | string };

type Hit = {
  notePath: string;
  title: string;
  heading: string | null;
  text: string;
  score: number;
};
```

Persona card today renders 12 traits from 4 demo notes and 24 analyzed sentences — design must
still look intentional with sparse data, and show a useful empty state.

## Reference points

Editorial: Are.na, Readwise Reader, Stripe Press, Obsidian's quiet mode.
Not: Notion AI, ChatGPT, generic admin dashboards.
