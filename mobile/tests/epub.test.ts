import { equal, throws } from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { extractEpubContents, extractEpubCover, extractEpubText } from "../src/imports/epub";

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

test("EPUB cover metadata supports EPUB 3 and EPUB 2", () => {
  for (const metadata of [
    '<manifest><item id="cover" properties="cover-image" href="art%20one.png" media-type="image/png"/></manifest>',
    '<metadata><meta name="cover" content="cover"/></metadata><manifest><item id="cover" href="art%20one.png" media-type="image/png"/></manifest>',
  ]) {
    const book = zipSync({
      "META-INF/container.xml": strToU8(container),
      "OPS/book.opf": strToU8(`<package>${metadata}</package>`),
      "OPS/art one.png": Uint8Array.of(137, 80, 78, 71),
    });
    const cover = extractEpubCover(book);
    equal(cover?.extension, "png");
    equal(cover?.data.length, 4);
  }
});

test("EPUB navigation uses actual spine text offsets", () => {
  const book = zipSync({
    "META-INF/container.xml": strToU8(container),
    "OPS/book.opf": strToU8('<package><manifest><item id="nav" properties="nav" href="nav.xhtml"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>'),
    "OPS/nav.xhtml": strToU8('<nav epub:type="toc"><ol><li><a href="one.xhtml">First</a><ol><li><a href="one.xhtml#second">Second</a></li></ol></li></ol></nav>'),
    "OPS/one.xhtml": strToU8('<body><p>First.</p><p id="second">Second.</p></body>'),
  });
  equal(JSON.stringify(extractEpubContents(book)), JSON.stringify([
    { title: "First", depth: 0, offset: 0 },
    { title: "Second", depth: 1, offset: 8 },
  ]));
});
