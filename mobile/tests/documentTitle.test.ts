import { equal, deepEqual } from "node:assert/strict";
import { test } from "node:test";
import { displayTitle } from "../src/imports/documentTitle";
import { documentChunks } from "../src/reader/pdfPages";

test("uses book metadata or a clean filename without archive suffixes", () => {
  const filename = "No Bullsh_t Strategy_ A Founder's Guide -- Alex Smith -- 2023 -- isbn13 9781805146582.pdf";
  equal(displayTitle(filename, "No Bullsh*t Strategy"), "No Bullsh*t Strategy");
  equal(displayTitle(filename, "Microsoft Word - manuscript"), "No Bullsh t Strategy A Founder's Guide");
  equal(displayTitle("The_Last_Ferry.txt"), "The Last Ferry");
});

test("page chunks retain physical page indices and original text offsets", () => {
  const text = "Start here.\n\nNext page.";
  const result = documentChunks("doc", text, [0, 13, 13]);
  deepEqual(result.map(chunk => [chunk.pageIndex, chunk.text, chunk.startChar]), [
    [0, "Start here.", 0], [2, "Next page.", 13],
  ]);
});
