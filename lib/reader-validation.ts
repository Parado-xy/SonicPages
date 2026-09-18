import { z } from "zod";

export const readingProgressSchema = z.object({
  sectionIndex: z.number().int().nonnegative(),
  characterOffset: z.number().int().nonnegative().default(0),
  percent: z.number().min(0).max(100),
  positionSeconds: z.number().int().nonnegative().optional(),
});

export const readerPreferenceSchema = z.object({
  fontFamily: z.enum(["serif", "sans"]),
  fontSize: z.number().int().min(15).max(28),
  lineHeight: z.number().min(1.4).max(2.2),
  contentWidth: z.number().int().min(560).max(920),
  theme: z.enum(["paper", "sepia", "night"]),
});
