import { describe, expect, it } from "vitest";

import { createAnnotationSchema, updateAnnotationSchema } from "@/lib/annotation-validation";

describe("annotation validation", () => {
  it("accepts an anchored highlight", () => {
    expect(createAnnotationSchema.safeParse({ kind: "highlight", sectionId: "section", startOffset: 3, endOffset: 9, selectedText: "sample", color: "green" }).success).toBe(true);
  });

  it("rejects empty notes and unsupported colors", () => {
    expect(createAnnotationSchema.safeParse({ kind: "note", sectionId: "section", content: " " }).success).toBe(false);
    expect(updateAnnotationSchema.safeParse({ kind: "highlight", color: "orange" }).success).toBe(false);
  });
});
