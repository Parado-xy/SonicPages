import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import { locatePdfRange, normalizePdfPage } from "../src/reader/pdfGeometry";

test("PDF normalization preserves the legacy import whitespace rules", () => {
  for (const raw of ["  A\r\n line\r\n\r\nB", "A\r\rB", "A\r\nB", "A\n \n \nB", "  \n\nA\tB  "]) {
    equal(normalizePdfPage(raw).text, raw.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
      .map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n"));
  }
});

test("offset mapping distinguishes repeated text and preserves separate wrapped lines", () => {
  const raw = "Again.\r\n\r\nAgain\r\n today.";
  const normalized = normalizePdfPage(raw);
  const span = (start: number, end: number, y: number) => ({ start, end, x: 0.2, y, width: 0.1, height: 0.01 });
  const first = span(0, 6, 0.1);
  const second = span(10, 15, 0.2);
  const third = span(18, 24, 0.3);
  const boxes = locatePdfRange([first, second, third], normalized, "Again.\n\nAgain today.", { start: 8, end: 20 });
  deepEqual(boxes.map(box => box.y), [0.2, 0.3]);
  deepEqual(locatePdfRange([first, second, third], normalized, "Different text", { start: 8, end: 20 }), []);
});
