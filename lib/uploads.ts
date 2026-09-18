import { DocumentFormat } from "@prisma/client";
import { z } from "zod";

export const DEFAULT_MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const DEFAULT_USER_STORAGE_QUOTA_BYTES = 500 * 1024 * 1024;
export const UPLOAD_TTL_SECONDS = 10 * 60;

const allowedFiles = {
  "application/pdf": { extension: "pdf", format: DocumentFormat.PDF },
  "application/epub+zip": { extension: "epub", format: DocumentFormat.EPUB },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    format: DocumentFormat.DOCX,
  },
  "text/plain": { extension: "txt", format: DocumentFormat.TXT },
} as const;

export const acceptedDocumentTypes = Object.keys(allowedFiles);

export const uploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(acceptedDocumentTypes as [string, ...string[]]),
  sizeBytes: z.number().int().positive(),
});

export function validateUploadRequest(
  input: unknown,
  maxBytes = DEFAULT_MAX_DOCUMENT_BYTES,
) {
  const parsed = uploadRequestSchema.parse(input);
  const rule = allowedFiles[parsed.contentType as keyof typeof allowedFiles];
  const extension = parsed.filename.split(".").pop()?.toLowerCase();

  if (extension !== rule.extension) {
    throw new Error(`The file extension must be .${rule.extension}.`);
  }
  if (parsed.sizeBytes > maxBytes) {
    throw new Error(`Files must be ${formatBytes(maxBytes)} or smaller.`);
  }

  return { ...parsed, extension: rule.extension, format: rule.format };
}

export function documentTitle(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return withoutExtension || "Untitled document";
}

export function storageKeyFor(ownerId: string, documentId: string, extension: string) {
  return `users/${ownerId}/documents/${documentId}/original/${crypto.randomUUID()}.${extension}`;
}

export function formatBytes(bytes: number | bigint) {
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}

export function hasExpectedFileSignature(contentType: string, bytes: Uint8Array) {
  if (contentType === "application/pdf") {
    return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }
  if (
    contentType === "application/epub+zip" ||
    contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  if (contentType === "text/plain") {
    if (bytes.includes(0)) return false;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
