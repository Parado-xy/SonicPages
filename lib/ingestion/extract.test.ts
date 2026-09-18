// @vitest-environment node

import { DocumentFormat } from "@prisma/client";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";

import { extractDocument } from "@/lib/ingestion/extract";

describe("document extraction", () => {
  it("extracts and normalizes UTF-8 text", async () => {
    const result = await extractDocument(
      DocumentFormat.TXT,
      new TextEncoder().encode("First paragraph.\r\n\r\nSecond    paragraph."),
    );
    expect(result.sections).toEqual([
      { text: "First paragraph.\n\nSecond paragraph." },
    ]);
  });

  it("splits very long text into bounded sections", async () => {
    const result = await extractDocument(
      DocumentFormat.TXT,
      new TextEncoder().encode("a".repeat(25_000)),
    );
    expect(result.sections).toHaveLength(3);
    expect(Math.max(...result.sections.map((section) => section.text.length))).toBeLessThanOrEqual(12_000);
  });

  it("rejects empty and invalid UTF-8 documents", async () => {
    await expect(extractDocument(DocumentFormat.TXT, new Uint8Array())).rejects.toThrow(/No readable text/);
    await expect(extractDocument(DocumentFormat.TXT, Uint8Array.of(0xff, 0xfe))).rejects.toThrow();
  });

  it("extracts PDF pages and metadata", async () => {
    const pdf = new PDFDocument({ info: { Title: "A small PDF", Author: "SonicPages" } });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.text("Page one text");
    pdf.addPage().text("Page two text");
    pdf.end();
    await new Promise<void>((resolve) => pdf.on("end", resolve));

    const result = await extractDocument(DocumentFormat.PDF, Buffer.concat(chunks));
    expect(result).toMatchObject({ title: "A small PDF", author: "SonicPages", pageCount: 2 });
    expect(result.sections.map((section) => section.text).join(" ")).toContain("Page two text");
  });

  it("extracts DOCX text after archive safety checks", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello from DOCX</w:t></w:r></w:p></w:body></w:document>`);
    const result = await extractDocument(DocumentFormat.DOCX, await zip.generateAsync({ type: "uint8array" }));
    expect(result.sections[0].text).toContain("Hello from DOCX");
  });

  it("extracts EPUB metadata and reading order", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip");
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`);
    zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package><metadata><dc:title>Test Book</dc:title><dc:creator>Test Author</dc:creator></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`);
    zip.file("OEBPS/chapter.xhtml", `<html><body><h1>Opening</h1><p>Hello from EPUB.</p></body></html>`);
    const result = await extractDocument(DocumentFormat.EPUB, await zip.generateAsync({ type: "uint8array" }));
    expect(result).toMatchObject({ title: "Test Book", author: "Test Author" });
    expect(result.sections[0]).toMatchObject({ title: "Opening", text: expect.stringContaining("Hello from EPUB") });
  });
});
