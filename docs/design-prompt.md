Design and build a production-quality, multi-page marketing + product prototype for **Pi-Mirror**, a personal agent built on top of **pi** (the pi coding agent harness). Pi-Mirror reads a person's Markdown vault, learns their knowledge, voice and stances, and answers or writes in their voice with every sentence traced to a note — or explicitly marked as inference or unknown.

Build three linked pages in this project, using vanilla HTML/CSS/JS with no build step and a shared `styles.css` + `app.js`:

1. `index.html` — marketing home
2. `app.html` — the product workspace (the core of the site)
3. `about.html` — how it works, safety, evaluation, built on pi

## Visual system — follow the OpenDesign marketing site closely

- Background `#FAFAFA`; white surfaces `#FFFFFF`; warm section `#FDFFF7`
- Ink `#262626`; soft `#434343`; mute `#595959`; faint `#8C8C8C`
- Hairlines `#D9D9D9`; soft rules `#F0F0F0`
- One vivid accent: lime `#63FE13`, used sparingly (highlight mark, active dot, one hero word) — never as a large background
- Evidence green `#218C00`; inference amber `#C98A2E`; unknown neutral `#8C8C8C`
- Radii: cards 24px, pills 999px, inputs 12px
- Shadow only for floating layers: `0 30px 60px -30px rgba(38,38,38,.16)`
- Nav height 54px, generous gutters, centered hero, large product frame below the hero
- Type: **Albert Sans** everywhere (Google Fonts); Georgia / Songti SC only for pull quotes
- Scale: hero `clamp(52px, 7.2vw, 112px)` with `-0.045em` tracking; h2 `clamp(32px, 4vw, 56px)`; body 16/1.55; small 13
- Buttons: black pill primary, min-height 48px; ghost button with `1px solid #15140F33`
- Motion 180ms ease; respect `prefers-reduced-motion`; light theme only in v1

Anti-patterns: no purple AI gradients, no glassmorphism, no chatbot bubbles as the main surface, no KPI dashboard wall, no stock photos, no fake testimonial or user counts, no lorem ipsum.

## Home (`index.html`)

- Nav: wordmark "Pi-Mirror", links Persona / Evidence / Safety / About, GitHub icon, black pill "Open demo →"
- Hero: eyebrow "Built on pi · open source"; h1 "A mirror that thinks like you."; subhead "Pi-Mirror reads your notes, learns how you argue, and answers in your voice — with every claim traced back to a note, or marked as a guess."; CTAs "Open the demo" and "Read the source"; below, a real HTML-built product frame showing the persona card grid (not an image)
- Thin stat strip: `4 notes indexed · 12 traits · 24 sentences · every claim cited`, with a `sample data` badge
- "Three ways to use it": Ask / Write / Guard, three large numbered cards with small CSS illustrations
- "Nothing leaves the vault": a sample answer paragraph with inline citation chips `[note]` `[inference]` `[unknown]`, plus an evidence list on the right
- "Designed to disagree": a stance card with polarity and a belief turning point
- Consent band: four toggles illustration, "No separate consent, no publish"
- Built on pi: a code block `pi install npm:pi-mirror` and the extension tool list
- Closing CTA and a multi-column footer

## App (`app.html`) — the core

App shell: 54px top bar (wordmark, vault name `demo-vault`, `⌘K` hint, status dot "read-only demo"), 240px left rail with 7 modules, main canvas, right evidence drawer.

Modules:

- **Persona** (default): header "Your persona, v0.3" with rebuild button and stats; filter chips (all / value / stance / taboo / voice / goal); grid of trait cards. Each card shows kind label, trait text, confidence bar, evidence count, representative quote. Clicking a card opens the evidence drawer with source quotes and note paths.
- **Ask**: large serif question, suggestion chips, first-person answer with superscript citation chips; paragraphs tagged `[note]` (olive), `[inference]` (amber), `[unknown]` (neutral); right panel lists sources with path, date, excerpt.
- **Write**: split view. Left editor with a sample draft; sentence underlines: olive = cited, amber = inferred, gray dashed = unsupported. Right voice panel: score ring 78, six dimension bars, three rewrite suggestions. Bottom citation audit.
- **Guard**: paste area prefilled with a sample, "Run guard" button, report cards for style distance, stance conflict, taboo words, unsupported claims, each with severity and a cited trait.
- **Timeline**: vertical spine 2019→2026, turning-point cards with before/after quotes, small belief-polarity sparkline.
- **Kit**: 1080×1440 card preview built in CSS, platform copy blocks with copy buttons, export buttons, publish log table.
- **Consent**: four independent toggles (modeling / drafting / publishing / demo), consent history, danger zone.

JavaScript: switch modules without reload using hash routing (`#persona`, `#ask`, …), open/close the evidence drawer, filter traits, toggle consent switches, copy buttons, and a `⌘K` command palette listing the modules. All interactive states must be real — no dead buttons. Include empty states and labeled loading steps.

## About (`about.html`)

- "How it works" pipeline diagram in HTML/CSS/SVG: Vault → Chunker → SQLite FTS5 → Persona extraction → Answer with citations → Audit
- "What it refuses to do": the four hard rules
- "Desensitization": a before/after snippet with fake names, noting the mapping table stays outside the repo
- "Evaluation": a metrics table (Turing pass rate, voice similarity, stance consistency, citation coverage, trait precision) with values marked as pilot results
- "Built on pi": extension tools, install line, GitHub link placeholder
- FAQ accordion with six items, then footer

## Content and data

Use realistic sample data and label every number `sample`. Chinese note content with paths such as `Knowledge/AI/Agent设计.md` and `Output/示例文章.md`. Sample traits:

- `工具应该减少决策，而不是增加选项`
- `Agent 的核心是工具设计，不是 prompt`
- `不做没有引用来源的断言`
- `把个人知识库变成可发布的内容`
- `短句，先结论后论证，少用感叹号`

Interface copy in English; sample vault content in Chinese. This bilingual contrast is intentional — make it look deliberate.

Content rules: no claim of real users, no company logos, no testimonials, no production metrics presented as real. Every app page carries the banner "Desensitized demo vault · sample data · read-only".

## Quality bar

This should look like a real 2026 product site, not a template: careful optical alignment, consistent 8px spacing scale, real hover and focus states, no horizontal scroll at 390px, accessible contrast and labels, favicon included. Return every file in the project.
