import { describe, expect, it } from "vitest";

import { estimateDurationMs } from "@/lib/audio/provider";

describe("estimateDurationMs", () => {
  it("estimates longer audio for more words", () => {
    expect(estimateDurationMs("one two three four")).toBeGreaterThan(estimateDurationMs("one"));
  });

  it("accounts for playback speed", () => {
    expect(estimateDurationMs("one two three four five six", 2)).toBeLessThan(estimateDurationMs("one two three four five six", 1));
  });
});

