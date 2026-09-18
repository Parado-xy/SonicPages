import { z } from "zod";

import { supportedVoices } from "@/lib/audio/config";

export const audioGenerationSchema = z.object({
  voiceId: z.enum(supportedVoices).default("coral"),
});

export const playbackPreferenceSchema = z.object({
  provider: z.literal("openai"),
  voiceId: z.enum(supportedVoices),
  rate: z.number().min(0.5).max(2),
  pitch: z.number().min(0.5).max(2),
  autoAdvance: z.boolean(),
});

