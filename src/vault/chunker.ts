export interface Chunk {
  ordinal: number;
  text: string;
  start: number;
  end: number;
  heading?: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export interface SplitResult {
  frontmatter: string;
  body: string;
  /** body 在原始文件中的起始偏移 */
  offset: number;
}

export function splitFrontmatter(content: string): SplitResult {
  const match = FRONTMATTER.exec(content);
  if (!match) {
    return { frontmatter: "", body: content, offset: 0 };
  }
  return {
    frontmatter: match[1] ?? "",
    body: content.slice(match[0].length),
    offset: match[0].length,
  };
}

export function extractTitle(content: string, fallback: string): string {
  const { body } = splitFrontmatter(content);
  const heading = /^#\s+(.+)$/m.exec(body);
  return heading?.[1]?.trim() || fallback;
}

/**
 * 按空行分块，保留相对原文的精确 offset。
 * 中文没有空格，块大小按字符数控制，避免切碎句子。
 */
export function chunkMarkdown(content: string, maxChars = 700): Chunk[] {
  const { body, offset: base } = splitFrontmatter(content);
  const parts = body.split(/\n{2,}/);
  const blocks: Array<{ text: string; start: number; end: number; heading?: string }> = [];

  let pos = 0;
  for (const raw of parts) {
    if (!raw) continue;
    const rawStart = body.indexOf(raw, pos);
    if (rawStart < 0) continue;
    pos = rawStart + raw.length;

    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const text = raw.trim();
    if (!text) continue;

    const headingMatch = /^#{1,6}\s+(.+)$/m.exec(text);
    blocks.push({
      text,
      start: base + rawStart + leading,
      end: base + rawStart + raw.length - trailing,
      heading: headingMatch?.[1]?.trim(),
    });
  }

  const chunks: Chunk[] = [];
  let buffer: typeof blocks = [];
  let size = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.map((block) => block.text).join("\n\n");
    chunks.push({
      ordinal: chunks.length,
      text,
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
      heading: buffer.find((block) => block.heading)?.heading,
    });
    buffer = [];
    size = 0;
  };

  for (const block of blocks) {
    if (buffer.length > 0 && size + block.text.length > maxChars) {
      flush();
    }
    buffer.push(block);
    size += block.text.length + 2;
  }
  flush();

  return chunks;
}
