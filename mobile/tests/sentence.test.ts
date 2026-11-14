import { equal } from "node:assert/strict";
import { test } from "node:test";
import { documentChunks } from "../src/reader/pdfPages";
import { sentenceAt } from "../src/reader/sentence";

test("highlights the same whole sentence across bounded requests without crossing a PDF page", () => {
  const first = "The tide carried the boat a little farther from the quiet harbor with every wave until the captain could no longer see the lights.";
  const next = "The harbor was quiet.";
  const text = first + "\n\n" + next;
  const chunks = documentChunks("book", text, [0, first.length + 2]);
  equal(chunks.length, 3);
  for (const chunk of chunks) {
    const { start, end } = sentenceAt(text, chunk);
    equal(text.slice(start, end), chunk.pageIndex === 0 ? first : next);
  }
});
