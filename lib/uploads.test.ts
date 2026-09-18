import { DocumentFormat } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  documentTitle,
  formatBytes,
  hasExpectedFileSignature,
  validateUploadRequest,
} from "@/lib/uploads";

describe("document upload validation", () => {
  it("accepts a supported document with a matching extension", () => {
    expect(
      validateUploadRequest({
        filename: "Reading List.PDF",
        contentType: "application/pdf",
        sizeBytes: 2048,
      }),
    ).toMatchObject({ extension: "pdf", format: DocumentFormat.PDF });
  });

  it("rejects content type and extension mismatches", () => {
    expect(() =>
      validateUploadRequest({
        filename: "not-really-a-document.exe",
        contentType: "application/pdf",
        sizeBytes: 2048,
      }),
    ).toThrow(/extension must be .pdf/);
  });

  it("rejects files above the configured limit", () => {
    expect(() =>
      validateUploadRequest(
        { filename: "large.txt", contentType: "text/plain", sizeBytes: 101 },
        100,
      ),
    ).toThrow(/or smaller/);
  });

  it("derives safe display values without using them as storage keys", () => {
    expect(documentTitle("my.notes.docx")).toBe("my.notes");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
  });

  it("checks file signatures instead of trusting browser metadata", () => {
    expect(hasExpectedFileSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasExpectedFileSignature("application/pdf", new TextEncoder().encode("<script>"))).toBe(false);
    expect(hasExpectedFileSignature("application/epub+zip", Uint8Array.of(0x50, 0x4b, 0x03, 0x04))).toBe(true);
    expect(hasExpectedFileSignature("text/plain", Uint8Array.of(65, 0, 66))).toBe(false);
  });
});
