import { z } from "zod";

const sectionAnchor = z.object({
  sectionId: z.string().min(1),
  characterOffset: z.number().int().nonnegative().default(0),
});

export const createAnnotationSchema = z.discriminatedUnion("kind", [
  sectionAnchor.extend({ kind: z.literal("bookmark"), label: z.string().trim().max(120).nullable().optional() }),
  z.object({ kind: z.literal("highlight"), sectionId: z.string().min(1), startOffset: z.number().int().nonnegative(), endOffset: z.number().int().positive(), selectedText: z.string().trim().min(1).max(10_000), color: z.enum(["yellow", "green", "blue", "pink"]).default("yellow") }),
  z.object({ kind: z.literal("note"), sectionId: z.string().min(1), highlightId: z.string().min(1).nullable().optional(), content: z.string().trim().min(1).max(20_000) }),
]);

export const updateAnnotationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bookmark"), label: z.string().trim().max(120).nullable() }),
  z.object({ kind: z.literal("highlight"), color: z.enum(["yellow", "green", "blue", "pink"]) }),
  z.object({ kind: z.literal("note"), content: z.string().trim().min(1).max(20_000) }),
]);

export const annotationKindSchema = z.enum(["bookmark", "highlight", "note"]);
