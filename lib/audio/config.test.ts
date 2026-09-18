import { describe, expect, it } from "vitest";

import { parseAudioEnvironment } from "@/lib/audio/config";

describe("audio configuration", () => {
  it("applies conservative generation limits", () => {
    const value = parseAudioEnvironment({ OPENAI_API_KEY: "secret" });
    expect(value.AUDIO_MAX_ACTIVE_JOBS).toBe(2);
    expect(value.AUDIO_MAX_CHARACTERS_PER_JOB).toBe(500_000);
  });

  it("requires provider credentials", () => {
    expect(() => parseAudioEnvironment({})).toThrow();
  });
});
