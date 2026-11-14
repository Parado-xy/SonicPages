import { File } from "expo-file-system";
import { NativeModules, Platform } from "react-native";
import { extractEpubText } from "./epub";

const TEXT = "text/plain";
const EPUB = "application/epub+zip";
const PDF = "application/pdf";

export const documentTypes = Platform.OS === "android"
  ? [TEXT, EPUB, PDF, "application/octet-stream"]
  : [TEXT, EPUB, "application/octet-stream"];

export async function readDocument(file: File, name: string, mime?: string): Promise<string> {
  const extension = name.toLowerCase().split(".").at(-1);
  if (file.size > 50 * 1024 * 1024) throw new Error("This file exceeds the 50 MB import limit.");
  let content: string;
  if (extension === "epub" || mime === EPUB) {
    content = extractEpubText(await file.bytes());
  } else if (extension === "pdf" || mime === PDF) {
    const pdf = NativeModules.SonicPagesPdfText as { extract(uri: string): Promise<string> } | undefined;
    if (!pdf) throw new Error("PDF import requires the updated SonicPages Android app.");
    const extracted = await pdf.extract(file.uri);
    content = extracted.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
      .map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
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
  return content;
}
