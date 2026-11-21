import { describe, expect, test } from "bun:test";
import { chatGptFailureCauseEvidence } from "../src/adapters/chatgpt-web/adapter-error";

// A turn that fails after its prompt was sent is reported to Codex as "ChatGPT stopped
// responding", whatever really happened. On 21 November 2026 the real reason was the broker
// refusing a changed environment, and nothing recorded it. Ways the evidence line could fail:
//  1. the reason is not recorded, or only its outermost wrapper is
//  2. building the line throws and takes the turn down with it
//  3. a long or multi-line message floods the log or forges another log line
//  4. a non-Error value is thrown
describe("failure cause evidence", () => {
  test("names the innermost reason and the chain that led to it", () => {
    const inner = new Error("Codex turn environment changed during an active ChatGPT tool loop");
    const outer = new Error("round failed", { cause: inner });
    expect(chatGptFailureCauseEvidence(outer)).toEqual({
      causeName: "Error",
      causeMessage: "Codex turn environment changed during an active ChatGPT tool loop",
      causeDepth: 1,
    });
    expect(chatGptFailureCauseEvidence(inner)).toMatchObject({ causeDepth: 0 });
  });

  test("bounds the message and keeps it on one line", () => {
    const evidence = chatGptFailureCauseEvidence(new TypeError(`first\n[chatgpt-web] forged line\r\t${"x".repeat(1000)}`));
    expect(evidence.causeName).toBe("TypeError");
    expect(evidence.causeMessage).not.toMatch(/[\r\n\t\u0000-\u001f]/);
    expect(evidence.causeMessage.length).toBeLessThanOrEqual(240);
    expect(evidence.causeMessage.startsWith("first [chatgpt-web] forged line")).toBeTrue();
  });

  test("never throws, whatever was thrown", () => {
    const cyclic: { cause?: unknown; message: string; name: string } = { message: "loop", name: "Odd" };
    cyclic.cause = cyclic;
    const hostile = { get message(): string { throw new Error("getter"); }, get name(): string { throw new Error("getter"); } };
    for (const value of [undefined, null, 0, "plain text", Symbol("s"), {}, cyclic, hostile, new Error("")]) {
      expect(() => chatGptFailureCauseEvidence(value)).not.toThrow();
      const evidence = chatGptFailureCauseEvidence(value);
      expect(typeof evidence.causeName).toBe("string");
      expect(typeof evidence.causeMessage).toBe("string");
    }
    expect(chatGptFailureCauseEvidence("plain text")).toEqual({ causeName: "string", causeMessage: "plain text", causeDepth: 0 });
    expect(chatGptFailureCauseEvidence(cyclic)).toMatchObject({ causeName: "Odd", causeMessage: "loop" });
  });
});
