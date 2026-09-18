import path from "node:path";

import { DocumentFormat } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";
import { convert } from "html-to-text";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Open, type CentralDirectory, type File } from "unzipper";

const MAX_EXTRACTED_CHARACTERS = 5_000_000;
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5_000;
const SECTION_TARGET_CHARACTERS = 12_000;

export type ExtractedSection = {
  title?: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
};

export type ExtractedDocument = {
  title?: string;
  author?: string;
  pageCount?: number;
  sections: ExtractedSection[];
};

export async function extractDocument(format: DocumentFormat, bytes: Uint8Array) {
  let extracted: ExtractedDocument;
  switch (format) {
    case DocumentFormat.PDF:
      extracted = await extractPdf(bytes);
      break;
    case DocumentFormat.DOCX:
      extracted = await extractDocx(bytes);
      break;
    case DocumentFormat.EPUB:
      extracted = await extractEpub(bytes);
      break;
    case DocumentFormat.TXT:
      extracted = extractText(bytes);
      break;
  }

  const totalCharacters = extracted.sections.reduce((sum, section) => sum + section.text.length, 0);
  if (!totalCharacters) throw new Error("No readable text was found in this document.");
  if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
    throw new Error("The extracted document exceeds the supported text limit.");
  }

  return { ...extracted, sections: extracted.sections.filter((section) => section.text.length > 0) };
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const info = await parser.getInfo();
    const text = await parser.getText();
    return {
      title: stringMetadata(info.info?.Title),
      author: stringMetadata(info.info?.Author),
      pageCount: text.total,
      sections: text.pages.flatMap((page) =>
        chunkText(page.text).map((content) => ({
          title: `Page ${page.num}`,
          text: content,
          pageStart: page.num,
          pageEnd: page.num,
        })),
      ),
    };
  } finally {
    await parser.destroy();
  }
}

function extractText(bytes: Uint8Array): ExtractedDocument {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { sections: chunkText(text).map((content) => ({ text: content })) };
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  await inspectArchive(bytes);
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return { sections: chunkText(result.value).map((content) => ({ text: content })) };
}

async function extractEpub(bytes: Uint8Array): Promise<ExtractedDocument> {
  const archive = await inspectArchive(bytes);
  const parser = new XMLParser({ ignoreAttributes: false });
  const container = parser.parse(await readArchiveText(archive, "META-INF/container.xml"));
  const opfPath = container?.container?.rootfiles?.rootfile?.["@_full-path"];
  if (typeof opfPath !== "string") throw new Error("EPUB package metadata is missing.");

  const opf = parser.parse(await readArchiveText(archive, opfPath));
  const packageData = opf?.package;
  const manifestItems = asArray<Record<string, string>>(packageData?.manifest?.item);
  const spineItems = asArray<Record<string, string>>(packageData?.spine?.itemref);
  const manifest = new Map(manifestItems.map((item) => [item["@_id"], item]));
  const opfDirectory = path.posix.dirname(opfPath);
  const sections: ExtractedSection[] = [];

  for (const spineItem of spineItems) {
    const item = manifest.get(spineItem["@_idref"]);
    if (!item?.["@_href"]) continue;
    const chapterPath = path.posix.normalize(path.posix.join(opfDirectory, item["@_href"]));
    const html = await readArchiveText(archive, chapterPath);
    const chapterText = convert(html, {
      wordwrap: false,
      selectors: [{ selector: "img", format: "skip" }],
    });
    const heading = firstHeading(html);
    sections.push(...chunkText(chapterText).map((text) => ({ title: heading, text })));
  }

  const metadata = packageData?.metadata ?? {};
  return {
    title: xmlText(metadata["dc:title"]),
    author: xmlText(metadata["dc:creator"]),
    sections,
  };
}

async function inspectArchive(bytes: Uint8Array) {
  const archive = await Open.buffer(Buffer.from(bytes));
  if (archive.files.length > MAX_ARCHIVE_ENTRIES) throw new Error("The archive contains too many entries.");

  let totalBytes = 0;
  for (const entry of archive.files) {
    assertSafeArchivePath(entry.path);
    totalBytes += entry.uncompressedSize;
    if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error("The expanded archive is too large.");
  }
  return archive;
}

async function readArchiveText(archive: CentralDirectory, requestedPath: string) {
  assertSafeArchivePath(requestedPath);
  const normalized = path.posix.normalize(requestedPath);
  const entry = archive.files.find((file) => path.posix.normalize(file.path) === normalized) as File | undefined;
  if (!entry) throw new Error(`Required archive entry is missing: ${normalized}`);
  const content = await entry.buffer();
  return new TextDecoder("utf-8", { fatal: true }).decode(content);
}

function assertSafeArchivePath(entryPath: string) {
  const normalized = path.posix.normalize(entryPath);
  if (normalized.startsWith("../") || normalized.startsWith("/") || normalized === "..") {
    throw new Error("The archive contains an unsafe path.");
  }
}

function chunkText(input: string) {
  const normalized = input.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [normalized]) {
    if (current && current.length + paragraph.length + 2 > SECTION_TARGET_CHARACTERS) {
      chunks.push(current);
      current = "";
    }
    if (paragraph.length > SECTION_TARGET_CHARACTERS) {
      if (current) chunks.push(current);
      for (let offset = 0; offset < paragraph.length; offset += SECTION_TARGET_CHARACTERS) {
        chunks.push(paragraph.slice(offset, offset + SECTION_TARGET_CHARACTERS));
      }
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function firstHeading(html: string) {
  const match = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  return match ? convert(match[1], { wordwrap: false }).trim() || undefined : undefined;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function xmlText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object" && "#text" in value) return stringMetadata(value["#text"]);
  return undefined;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
