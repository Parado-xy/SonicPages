import { describe, expect, it } from "vitest";

import { hashText, splitForSpeech } from "@/lib/audio/chunk";

describe("splitForSpeech", () => {
  it("keeps every chunk within the provider limit and preserves offsets", () => {
    const text = `${"A clear sentence with useful words. ".repeat(30)}A final sentence.`;
    const chunks = splitForSpeech(text, 240);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 240)).toBe(true);
    expect(chunks.every((chunk) => text.slice(chunk.startOffset, chunk.endOffset).trim() === chunk.text)).toBe(true);
  });

  it("is deterministic for cache keys", () => {
    expect(hashText("same text")).toBe(hashText("same text"));
    expect(hashText("same text")).not.toBe(hashText("different text"));
  });

  it("rejects unsafe tiny chunk sizes", () => {
    expect(() => splitForSpeech("hello", 20)).toThrow(/at least 200/);
  });
});

