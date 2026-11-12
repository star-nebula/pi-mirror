import { describe, expect, it } from "vitest";
import { guardText } from "../src/persona/guard.js";

const traits = [
  { kind: "value", text: "证据优先" },
  { kind: "taboo", text: "绝对化表达" },
];

describe("persona guard", () => {
  it("passes a grounded, cited draft", () => {
    const report = guardText(
      "我的规则很简单：每条结论都要有来源 [1]。这也意味着我会主动删掉没有依据的句子 [1]。",
      traits,
      { avgSentenceLen: 30, exclaimRate: 0 },
    );
    expect(report.findings.map((finding) => finding.id)).not.toContain("citation-coverage");
    expect(report.summary.high).toBe(0);
    expect(report.summary.coverage).toBeGreaterThanOrEqual(50);
  });

  it("flags absolute language and taboo tension", () => {
    const report = guardText("所有人都会同意这个结论。这个方向必然彻底改变一切。", traits);
    const ids = report.findings.map((finding) => finding.id);
    expect(ids).toContain("absolute-claims");
    expect(ids).toContain("taboo-tension");
    expect(report.summary.high).toBeGreaterThan(0);
  });

  it("flags claims with neither citation nor inference marker", () => {
    const report = guardText("知识库应该被当作一个人。文件夹只回答东西放哪了。", traits);
    const unsupported = report.findings.find((finding) => finding.id === "unsupported-claims");
    expect(unsupported).toBeDefined();
    expect(unsupported?.severity).toBe("medium");
  });

  it("flags an invented first-person anecdote even with an inference marker", () => {
    const report = guardText("我以前在大厂做内容，每天写十篇稿子 [inference]。", traits);
    const narrative = report.findings.find((finding) => finding.id === "unbacked-narrative");
    expect(narrative).toBeDefined();
    expect(narrative?.severity).toBe("high");
  });

  it("accepts an anecdote that cites a note", () => {
    const report = guardText("我以前在大厂做内容 [2]。", traits);
    expect(report.findings.map((finding) => finding.id)).not.toContain("unbacked-narrative");
  });

  it("reports style distance and low citation coverage", () => {
    const long = "这是一句非常非常长的句子，用来测试语气距离，".repeat(6) + "而且没有任何来源。";
    const report = guardText(long, traits, { avgSentenceLen: 10 });
    const ids = report.findings.map((finding) => finding.id);
    expect(ids).toContain("style-distance");
    expect(ids).toContain("citation-coverage");
  });
});
