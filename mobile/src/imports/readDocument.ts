import { File } from "expo-file-system";
import { NativeModules, Platform } from "react-native";
import { extractEpubDocument } from "./epub";

const TEXT = "text/plain";
const EPUB = "application/epub+zip";
const PDF = "application/pdf";

export const documentTypes = Platform.OS === "android"
  ? [TEXT, EPUB, PDF, "application/octet-stream"]
  : [TEXT, EPUB, "application/octet-stream"];

export async function readDocument(file: File, name: string, mime?: string): Promise<{ content: string; title?: string | null; pageStarts?: number[] }> {
  const extension = name.toLowerCase().split(".").at(-1);
  if (file.size > 50 * 1024 * 1024) throw new Error("This file exceeds the 50 MB import limit.");
  let content: string;
  let title: string | null | undefined;
  let pageStarts: number[] | undefined;
  if (extension === "epub" || mime === EPUB) {
    ({ content, title } = extractEpubDocument(await file.bytes()));
  } else if (extension === "pdf" || mime === PDF) {
    ({ content, title, pageStarts } = await readPdf(file));
    if (!/[\p{L}\p{N}]/u.test(content)) {
      throw new Error("This PDF has no readable text. Scanned PDFs require OCR before import.");
    }
  } else if (extension === "txt" || mime === TEXT) {
    content = await file.text();
  } else {
    throw new Error("Choose a TXT, EPUB, or text-based PDF.");
  }
  if (!content.trim()) throw new Error("This document is empty.");
  if (content.length > 4_000_000) throw new Error("This document contains too much text to import.");
  return { content, title, pageStarts };
}

export async function readPdf(file: File) {
  const pdf = NativeModules.SonicPagesPdfText as {
    extract(uri: string): Promise<{ pages: string[]; title: string | null }>;
  } | undefined;
  if (!pdf) throw new Error("PDF import requires the updated SonicPages Android app.");
  const { pages, title } = await pdf.extract(file.uri);
  let content = "";
  const pageStarts = pages.map(page => {
    const normalized = page.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
      .map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
    const start = content.length;
    if (normalized) content += normalized + "\n\n";
    return start;
  });
  return { content: content.trimEnd(), title, pageStarts };
}
