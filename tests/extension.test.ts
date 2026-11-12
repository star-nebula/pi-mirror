import { describe, expect, it } from "vitest";
import extension from "../src/extension.js";

describe("pi extension", () => {
  it("registers the week-1 tools and command", () => {
    const tools: string[] = [];
    const commands: string[] = [];

    extension({
      registerTool: (tool: { name: string }) => tools.push(tool.name),
      registerCommand: (name: string) => commands.push(name),
      on: () => undefined,
    } as never);

    expect(tools).toEqual(
      expect.arrayContaining([
        "vault_index",
        "vault_search",
        "note_read",
        "persona_card",
        "propose_note",
      ]),
    );
    expect(commands).toContain("mirror");
  });
});
