import { describe, expect, it } from "vitest";

import { isQueueableMutation } from "@/lib/offline";

describe("offline mutation policy", () => {
  it("allows recoverable reading and annotation writes", () => {
    expect(isQueueableMutation("PUT", "/api/documents/doc/progress")).toBe(true);
    expect(isQueueableMutation("POST", "/api/documents/doc/annotations")).toBe(true);
    expect(isQueueableMutation("DELETE", "/api/annotations/note/client-id")).toBe(true);
  });

  it("never queues destructive document or audio generation requests", () => {
    expect(isQueueableMutation("DELETE", "/api/documents/doc")).toBe(false);
    expect(isQueueableMutation("POST", "/api/documents/doc/audio")).toBe(false);
    expect(isQueueableMutation("POST", "/api/uploads")).toBe(false);
  });
});
