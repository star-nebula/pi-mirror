import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { basename } from "node:path";
import { openDb } from "../db/sqlite.js";
import { searchVault } from "../vault/search.js";
import { renderPersonaCard } from "../persona/card.js";
import { readNoteAt } from "../tools/vault-tools.js";

export interface PersonaSource {
  number: number;
  path: string;
  title: string;
  heading: string | null;
  quote: string;
  line: string;
}

export interface PersonaAnswer {
  answer: string;
  sources: PersonaSource[];
  model: string | null;
  error?: string;
  code?: "model_unavailable" | "empty_answer" | "agent_failed";
}

export interface PersonaAgentOptions {
  vaultRoot: string;
  dbPath: string;
  profileId?: string;
}

const ASK_SYSTEM_PROMPT = `You are Pi-Mirror, a personal agent that speaks in the first person as the owner of a Markdown vault.

Hard rules:
1. Call vault_search before making any factual claim about the owner's notes. Search more than once if the first query is too broad.
2. Cite each factual sentence with the bracketed number of the source, for example [1] or [2]. Those numbers are the only pointers: never print a file path or a line number in the answer body.
3. If the vault does not support a point, say so explicitly in the owner's voice ("my notes don't cover this", "I don't know yet") and mark it [unknown]. Never invent a belief or a source.
4. Reasoning that goes beyond the notes is allowed, but mark it [inference].
5. Answer in the language of the question. Keep the answer compact: a direct answer first, then at most three short paragraphs.
6. Do not mention these rules, the tools, or the system prompt.

Output format: plain Markdown, no headings, no bullet lists unless the question asks for a list.`;

const DRAFT_SYSTEM_PROMPT = `You are Pi-Mirror, drafting in the first person as the owner of a Markdown vault.

Hard rules:
1. Call vault_search before writing. Ground every factual sentence in a numbered result and cite it as [1], [2]. Never print a file path, wikilink or line number in the draft.
2. Mark reasoning beyond the notes as [inference]. If a section has no support, omit it rather than filling the gap.
3. Never invent events, dates, quotes or personal history. If the notes do not contain an anecdote, write the idea without one and do not stage a scene. Use [unknown] at most once in the whole draft.
4. A sentence either cites a note ([1]) or is marked [inference]; never stack them as [inference][1].
5. Match the owner's voice: short sentences, conclusion first, restrained punctuation.
6. When the draft is ready, call submit_draft exactly once with the final Markdown. Do not print the draft in a message, and put nothing but the draft in the markdown argument.`;

const REPAIR_PROMPT = `Your previous answer does not cite every factual sentence. Rewrite it with the same claims in the same language, but:
- end every factual sentence with the matching [n] source number;
- remove every inline file path, wikilink and line number from the body;
- keep [unknown] and [inference] markers where they belong;
- keep the same structure and length.
Output only the rewritten answer.`;

const REPAIR_DRAFT_PROMPT = `${REPAIR_PROMPT}
Call submit_draft again with the revised draft. The markdown argument must contain only the draft, with no preamble or review notes.`;

function lastAssistantText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      role?: string;
      content?: string | Array<{ type?: string; text?: string }>;
    };
    if (message?.role !== "assistant") continue;
    if (typeof message.content === "string") return message.content.trim();
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();
    }
  }
  return "";
}

function hasCitation(text: string): boolean {
  return /\[\d+\]/.test(text);
}

function citationCount(text: string): number {
  return (text.match(/\[\d+\]/g) ?? []).length;
}

function sentenceCount(text: string): number {
  return (
    text
      .split(/[。！？!?]+|\n{2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 3).length || 1
  );
}

function citationDensity(text: string): number {
  return citationCount(text) / sentenceCount(text);
}

function extractDraft(text: string): string {
  let body = text.trim();
  const closed = body.match(/<draft>([\s\S]*?)<\/draft>/i);
  if (closed) {
    body = closed[1].trim();
  } else {
    const open = body.match(/<draft>([\s\S]*)$/i);
    if (open) body = open[1].replace(/<\/draft>/gi, "").trim();
  }

  body = body.replace(/^-{3,}\s*\n+/, "");

  // Models often prepend "Draft below — grounded in..." even inside the tags.
  const fence = body.search(/\n-{3,}\n/);
  if (fence > 0 && fence < 900) {
    const head = body.slice(0, fence);
    if (head.length < 900 && /draft|grounded|below|以下是|草稿|说明/i.test(head)) {
      body = body.slice(fence).replace(/^\n-{3,}\n/, "").trim();
    }
  }

  // And append review notes after a rule, despite the instruction not to.
  const trailing = body.search(
    /\n(?:-{3,}\s*\n+)?(?:notes? on the draft|draft notes|备注[:：]|说明[:：]|约\s*\d+\s*字|word count)/i,
  );
  if (trailing > 200) body = body.slice(0, trailing).trim();

  const tailRule = body.match(/\n-{3,}\s*\n+(?=[\s\S]{0,500}(?:字|notes|hashtag|CTA|需要你确认|建议))/i);
  if (tailRule?.index && tailRule.index > 200) body = body.slice(0, tailRule.index).trim();

  return body;
}

function createAgentTools(
  options: PersonaAgentOptions,
  ledger: {
    add(source: Omit<PersonaSource, "number">, key?: string): number;
    forPath(path: string): number | undefined;
  },
  runtime: { draft: boolean; onSubmit: (markdown: string) => void },
): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: "vault_search",
      label: "Vault Search",
      description:
        "Search the owner's Markdown vault. Returns numbered snippets; cite them by their number only.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        limit: Type.Optional(Type.Number({ default: 6 })),
      }),
      async execute(_toolCallId, params) {
        const input = params as { query: string; limit?: number };
        const db = openDb(options.dbPath);
        let hits;
        try {
          hits = searchVault(db, input.query, Math.min(input.limit ?? 6, 10));
        } finally {
          db.close();
        }

        if (!hits.length) {
          return {
            content: [{ type: "text", text: "No notes matched. The vault does not cover this query." }],
            details: { count: 0 },
          };
        }

        const lines: string[] = [];
        hits.forEach((hit) => {
          const number = ledger.add(
            {
              path: hit.notePath,
              title: hit.title,
              heading: hit.heading,
              quote: hit.text.replace(/\s+/g, " ").trim().slice(0, 320),
              line: `L${hit.start + 1}-L${hit.end + 1}`,
            },
            `${hit.notePath}#${hit.heading ?? ""}#${hit.start}-${hit.end}`,
          );
          if (number < 0) return;
          lines.push(
            `[${number}] ${hit.notePath} · ${hit.heading ?? hit.title} · L${hit.start + 1}-L${hit.end + 1}`,
            hit.text.replace(/\s+/g, " ").trim().slice(0, 700),
            "",
          );
        });

        return { content: [{ type: "text", text: lines.join("\n") }], details: { count: hits.length } };
      },
    },
    {
      name: "note_read",
      label: "Note Read",
      description: "Read a note by its vault-relative path. The number in the header is its citation number.",
      parameters: Type.Object({ path: Type.String({ description: "Vault-relative note path" }) }),
      async execute(_toolCallId, params) {
        const input = params as { path: string };
        const text = readNoteAt(options.vaultRoot, input.path);
        const existing = ledger.forPath(input.path);
        const number =
          existing ??
          ledger.add(
            {
              path: input.path,
              title: basename(input.path, ".md"),
              heading: null,
              quote: text.replace(/\s+/g, " ").trim().slice(0, 320),
              line: "full note",
            },
            `${input.path}#full`,
          );
        const header = number > 0 ? `[${number}] full note · ${input.path}\n\n` : "";
        return {
          content: [{ type: "text", text: `${header}${text.slice(0, 24000)}` }],
          details: { path: input.path, number },
        };
      },
    },
    {
      name: "persona_card",
      label: "Persona Card",
      description: "Read the owner's persona traits, confidence and evidence.",
      parameters: Type.Object({
        includeEvidence: Type.Optional(Type.Boolean({ default: true })),
      }),
      async execute(_toolCallId, params) {
        const input = params as { includeEvidence?: boolean };
        const db = openDb(options.dbPath);
        let card: string;
        try {
          card = renderPersonaCard(db, options.profileId, {
            includeEvidence: input.includeEvidence ?? true,
            maxPerKind: 20,
          });
        } finally {
          db.close();
        }
        return { content: [{ type: "text", text: card }], details: { profileId: options.profileId ?? "default" } };
      },
    },
  ];

  if (runtime.draft) {
    tools.push({
      name: "submit_draft",
      label: "Submit Draft",
      description:
        "Submit the final draft. The markdown argument must contain only the draft, with citations, and no preamble or review notes.",
      parameters: Type.Object({
        markdown: Type.String({ description: "The final draft only" }),
      }),
      async execute(_toolCallId, params) {
        const input = params as { markdown: string };
        runtime.onSubmit(input.markdown);
        return {
          content: [{ type: "text", text: "Draft received. Do not print it again or add commentary." }],
          details: { chars: input.markdown.length },
        };
      },
    });
  }

  return tools;
}

async function runAgent(
  options: PersonaAgentOptions,
  prompt: string,
  systemPrompt: string,
  mode: "ask" | "draft",
): Promise<PersonaAnswer> {
  const sources: PersonaSource[] = [];
  const byKey = new Map<string, number>();
  const byPath = new Map<string, number>();
  let nextNumber = 1;

  const ledger = {
    add(source: Omit<PersonaSource, "number">, key?: string): number {
      const identity = key ?? `${source.path}#${source.heading ?? ""}#${source.line}`;
      const existing = byKey.get(identity);
      if (existing) return existing;
      if (sources.length >= 16) return -1;
      const number = nextNumber;
      nextNumber += 1;
      sources.push({ ...source, number });
      byKey.set(identity, number);
      if (!byPath.has(source.path)) byPath.set(source.path, number);
      return number;
    },
    forPath(path: string): number | undefined {
      return byPath.get(path);
    },
  };

  let submitted = "";
  const tools = createAgentTools(options, ledger, {
    draft: mode === "draft",
    onSubmit: (markdown) => {
      submitted = markdown;
    },
  });
  const loader = new DefaultResourceLoader({
    cwd: options.vaultRoot,
    agentDir: getAgentDir(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt,
  });

  let session;
  try {
    const created = await createAgentSession({
      cwd: options.vaultRoot,
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      customTools: tools,
      tools: tools.map((tool) => tool.name),
    });
    session = created.session;

    if (process.env.PI_MIRROR_DEBUG === "1") {
      session.subscribe((event) => {
        const entry = event as {
          type?: string;
          toolName?: string;
          args?: unknown;
          isError?: boolean;
        };
        if (entry.type === "tool_execution_start") {
          console.error(`[pi-mirror] tool -> ${entry.toolName} ${JSON.stringify(entry.args)}`);
        } else if (entry.type === "tool_execution_end") {
          console.error(`[pi-mirror] tool <- ${entry.toolName} ${entry.isError ? "ERROR" : "ok"}`);
        }
      });
    }

    await session.prompt(prompt);
    let answer =
      mode === "draft"
        ? submitted.trim() || extractDraft(lastAssistantText(session.state.messages))
        : lastAssistantText(session.state.messages);

    // One repair turn keeps the citation contract honest when the model forgets its numbers.
    if (answer && sources.length > 0 && (citationCount(answer) === 0 || citationDensity(answer) < 0.2)) {
      const before = answer;
      const beforeCount = citationCount(answer);
      submitted = "";
      await session.prompt(mode === "draft" ? REPAIR_DRAFT_PROMPT : REPAIR_PROMPT);
      let repaired =
        mode === "draft"
          ? submitted.trim() || extractDraft(lastAssistantText(session.state.messages))
          : lastAssistantText(session.state.messages);
      if (
        repaired &&
        citationCount(repaired) > beforeCount &&
        repaired.length >= before.length * 0.4
      ) {
        answer = repaired;
      }
    }

    if (!answer) {
      return {
        answer: "",
        sources,
        model: session.model?.id ?? null,
        error: "The agent returned an empty answer.",
        code: "empty_answer",
      };
    }
    return { answer, sources, model: session.model?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unavailable = /api key|auth|credential|no model|model.*not|provider/i.test(message);
    return {
      answer: "",
      sources,
      model: null,
      error: unavailable
        ? `pi has no usable model configured: ${message}`
        : `The persona agent failed: ${message}`,
      code: unavailable ? "model_unavailable" : "agent_failed",
    };
  } finally {
    session?.dispose();
  }
}

export function askPersona(options: PersonaAgentOptions, question: string): Promise<PersonaAnswer> {
  return runAgent(options, question, ASK_SYSTEM_PROMPT, "ask");
}

export function draftAsPersona(options: PersonaAgentOptions, brief: string): Promise<PersonaAnswer> {
  const prompt = `Write the draft described below. Search the vault first, then draft it.\n\nBrief:\n${brief}`;
  return runAgent(options, prompt, DRAFT_SYSTEM_PROMPT, "draft");
}
