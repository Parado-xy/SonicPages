import { describe, expect, it } from "vitest";

import { readerPreferenceSchema, readingProgressSchema } from "@/lib/reader-validation";

describe("reader validation", () => {
  it("accepts bounded reading positions", () => {
    expect(readingProgressSchema.parse({ sectionIndex: 2, characterOffset: 120, percent: 42.5 })).toEqual({ sectionIndex: 2, characterOffset: 120, percent: 42.5 });
  });

  it("rejects impossible reading positions", () => {
    expect(() => readingProgressSchema.parse({ sectionIndex: -1, percent: 101 })).toThrow();
  });

  it("accepts accessible preference ranges", () => {
    expect(readerPreferenceSchema.parse({ fontFamily: "serif", fontSize: 20, lineHeight: 1.8, contentWidth: 720, theme: "sepia" })).toMatchObject({ theme: "sepia", fontSize: 20 });
  });

  it("rejects unsupported themes and extreme typography", () => {
    expect(() => readerPreferenceSchema.parse({ fontFamily: "comic", fontSize: 50, lineHeight: 1, contentWidth: 1200, theme: "neon" })).toThrow();
  });
});
