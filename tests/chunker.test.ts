import { describe, expect, it } from "vitest";
import { chunkMarkdown, extractTitle, splitFrontmatter } from "../src/vault/chunker.js";

describe("chunker", () => {
  it("keeps offsets that point back to the original text", () => {
    const content = [
      "---",
      "tags: [写作]",
      "---",
      "",
      "# 标题",
      "",
      "第一段内容，讨论证据。",
      "",
      "第二段内容，讨论立场。",
    ].join("\n");

    const chunks = chunkMarkdown(content, 20);
    expect(chunks.length).toBeGreaterThan(0);

    for (const chunk of chunks) {
      const slice = content.slice(chunk.start, chunk.end);
      expect(slice).toContain(chunk.text.slice(0, 4));
    }
  });

  it("strips frontmatter and extracts the title", () => {
    const content = "---\ntags: [a]\n---\n\n# 真正的标题\n\n正文";
    const { frontmatter, body, offset } = splitFrontmatter(content);
    expect(frontmatter).toContain("tags");
    expect(body.startsWith("\n# 真正的标题")).toBe(true);
    expect(offset).toBe(content.indexOf(body));
    expect(extractTitle(content, "fallback")).toBe("真正的标题");
  });

  it("falls back to the filename when there is no heading", () => {
    expect(extractTitle("没有标题的正文", "fallback")).toBe("fallback");
  });
});
