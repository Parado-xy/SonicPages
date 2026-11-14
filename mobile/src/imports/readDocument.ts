import { File } from "expo-file-system";
import { NativeModules, Platform } from "react-native";
import { extractEpubDocument } from "./epub";

const TEXT = "text/plain";
const EPUB = "application/epub+zip";
const PDF = "application/pdf";

export const documentTypes = Platform.OS === "android"
  ? [TEXT, EPUB, PDF, "application/octet-stream"]
  : [TEXT, EPUB, "application/octet-stream"];

export async function readDocument(file: File, name: string, mime?: string): Promise<{ content: string; title?: string | null; author?: string | null; pageStarts?: number[] }> {
  const extension = name.toLowerCase().split(".").at(-1);
  if (file.size > 50 * 1024 * 1024) throw new Error("This file exceeds the 50 MB import limit.");
  let content: string;
  let author: string | null | undefined;
  let title: string | null | undefined;
  let pageStarts: number[] | undefined;
  if (extension === "epub" || mime === EPUB) {
    ({ content, title, author } = extractEpubDocument(await file.bytes()));
  } else if (extension === "pdf" || mime === PDF) {
    ({ content, title, author, pageStarts } = await readPdf(file));
  } else if (extension === "txt" || mime === TEXT) {
    content = await file.text();
  } else {
    throw new Error("Choose a TXT, EPUB, or text-based PDF.");
  }
  if (!content.trim() && !pageStarts?.length) throw new Error("This document is empty.");
  if (content.length > 4_000_000) throw new Error("This document contains too much text to import.");
  return { content, title, author, pageStarts };
}

export async function readPdf(file: File) {
  const pdf = NativeModules.SonicPagesPdfText as {
    extract(uri: string): Promise<{ pages: string[]; title: string | null; author?: string | null }>;
  } | undefined;
  if (!pdf) throw new Error("PDF import requires the updated SonicPages Android app.");
  const { pages, title, author } = await pdf.extract(file.uri);
  let content = "";
  const pageStarts = pages.map(page => {
    const normalized = page.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
      .map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
    const start = content.length;
    if (normalized) content += normalized + "\n\n";
    return start;
  });
  return { content: /[\p{L}\p{N}]/u.test(content) ? content.trimEnd() : "", title, author, pageStarts };
}
