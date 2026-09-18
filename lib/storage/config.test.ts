import { describe, expect, it } from "vitest";

import { parseStorageEnvironment } from "@/lib/storage/config";

const storageEnvironment = {
  S3_BUCKET: "private-documents",
  S3_ACCESS_KEY_ID: "access-key",
  S3_SECRET_ACCESS_KEY: "secret-key",
};

describe("storage environment", () => {
  it("provides secure upload defaults", () => {
    expect(parseStorageEnvironment(storageEnvironment)).toMatchObject({
      S3_REGION: "us-east-1",
      S3_FORCE_PATH_STYLE: false,
      MAX_DOCUMENT_BYTES: 50 * 1024 * 1024,
      USER_STORAGE_QUOTA_BYTES: 500 * 1024 * 1024,
    });
  });

  it("supports S3-compatible endpoints", () => {
    expect(
      parseStorageEnvironment({
        ...storageEnvironment,
        S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
        S3_FORCE_PATH_STYLE: "true",
      }),
    ).toMatchObject({
      S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      S3_FORCE_PATH_STYLE: true,
    });
  });

  it("rejects missing private-storage credentials", () => {
    expect(() => parseStorageEnvironment({ S3_BUCKET: "private-documents" })).toThrow();
  });
});
