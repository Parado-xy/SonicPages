import { describe, expect, it } from "vitest";

import { audioGenerationSchema, playbackPreferenceSchema } from "@/lib/audio/validation";

describe("audio validation", () => {
  it("provides a safe default voice", () => {
    expect(audioGenerationSchema.parse({})).toEqual({ voiceId: "coral" });
  });

  it("rejects unknown voices and extreme speeds", () => {
    expect(audioGenerationSchema.safeParse({ voiceId: "custom" }).success).toBe(false);
    expect(playbackPreferenceSchema.safeParse({ provider: "openai", voiceId: "coral", rate: 4, pitch: 1, autoAdvance: true }).success).toBe(false);
  });
});

