import { z } from "zod";

const audioEnvironmentSchema = z.object({
  TTS_PROVIDER: z.enum(["openai"]).default("openai"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TTS_MODEL: z.string().min(1).default("gpt-4o-mini-tts"),
  AUDIO_MAX_CHARACTERS_PER_JOB: z.coerce.number().int().positive().default(500_000),
  AUDIO_DAILY_CHARACTER_LIMIT: z.coerce.number().int().positive().default(1_000_000),
  AUDIO_MAX_ACTIVE_JOBS: z.coerce.number().int().positive().default(2),
  AUDIO_COST_PER_MILLION_CHARACTERS_MICROS: z.coerce.number().int().nonnegative().default(15_000_000),
});

export type AudioEnvironment = z.infer<typeof audioEnvironmentSchema>;

export function parseAudioEnvironment(environment: Record<string, string | undefined> = process.env) {
  return audioEnvironmentSchema.parse(environment);
}

export const supportedVoices = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;

