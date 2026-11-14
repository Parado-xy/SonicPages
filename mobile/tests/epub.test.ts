import { equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractEpubText } from "../src/imports/epub";

const container = '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>';
const manifest = '<manifest><item id="one" href="chapters/one%20a.xhtml" media-type="application/xhtml+xml"/><item id="two" href="../two.xhtml" media-type="application/xhtml+xml"/></manifest>';
const archive = (spine: string, chapters: Record<string, string>) => zipSync(Object.fromEntries(
  Object.entries({ "META-INF/container.xml": container, "OPS/book.opf": `<package>${manifest}<spine>${spine}</spine></package>`, ...chapters })
    .map(([path, value]) => [path, strToU8(value)]),
));

test("reads chapters in spine order and excludes markup, navigation and scripts", () => {
  const book = archive('<itemref idref="two"/><itemref idref="one"/>', {
    "OPS/chapters/one a.xhtml": '<html><body><nav>Contents</nav><p>Then &amp; there.</p></body></html>',
    "two.xhtml": '<html><body><h1>First</h1><p>Read <em>this</em>.</p><script>bad()</script></body></html>',
  });
  equal(extractEpubText(book), "First\n\nRead this.\n\nThen & there.");
});

test("reports missing chapters and image-only EPUBs", () => {
  const spine = '<itemref idref="one"/>';
  throws(() => extractEpubText(archive(spine, {})), /missing a chapter/);
  throws(() => extractEpubText(archive(spine, { "OPS/chapters/one a.xhtml": '<body><img src="a.png"/></body>' })), /No readable text/);
});
