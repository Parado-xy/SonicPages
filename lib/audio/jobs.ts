import { createHash } from "node:crypto";

import { parseAudioEnvironment } from "@/lib/audio/config";
import { prisma } from "@/lib/prisma";

export class AudioLimitError extends Error {}

export async function enqueueAudioGeneration(userId: string, documentId: string, voiceId: string) {
  const config = parseAudioEnvironment();
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: userId, status: "READY" },
    select: { id: true, sections: { orderBy: { index: "asc" }, select: { text: true } } },
  });
  if (!document?.sections.length) return null;
  const characterCount = document.sections.reduce((total, section) => total + section.text.length, 0);
  if (characterCount > config.AUDIO_MAX_CHARACTERS_PER_JOB) {
    throw new AudioLimitError(`This document exceeds the ${config.AUDIO_MAX_CHARACTERS_PER_JOB.toLocaleString()} character audio limit.`);
  }

  const contentDigest = createHash("sha256").update(document.sections.map((section) => section.text).join("\u0000")).digest("hex");
  const requestKey = createHash("sha256").update([document.id, config.TTS_PROVIDER, config.OPENAI_TTS_MODEL, voiceId, contentDigest].join(":")) .digest("hex");
  const existing = await prisma.audioGenerationJob.findUnique({
    where: { requestKey },
    include: { segments: { orderBy: { index: "asc" }, select: { id: true, sectionId: true, index: true, durationMs: true, startOffset: true, endOffset: true } } },
  });
  if (existing && !["FAILED", "CANCELLED"].includes(existing.status)) return existing;

  const [activeJobs, dailyUsage] = await Promise.all([
    prisma.audioGenerationJob.count({ where: { requestedById: userId, status: { in: ["QUEUED", "PROCESSING", "RETRYING"] } } }),
    prisma.audioGenerationJob.aggregate({
      where: { requestedById: userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1_000) }, status: { not: "CANCELLED" } },
      _sum: { characterCount: true },
    }),
  ]);
  if (activeJobs >= config.AUDIO_MAX_ACTIVE_JOBS) throw new AudioLimitError("Finish an active audio job before starting another.");
  if (!existing && (dailyUsage._sum.characterCount ?? 0) + characterCount > config.AUDIO_DAILY_CHARACTER_LIMIT) {
    throw new AudioLimitError("Your rolling 24-hour audio generation limit has been reached.");
  }

  const estimatedCostMicros = Math.ceil((characterCount / 1_000_000) * config.AUDIO_COST_PER_MILLION_CHARACTERS_MICROS);
  return prisma.audioGenerationJob.upsert({
    where: { requestKey },
    create: { documentId, requestedById: userId, provider: config.TTS_PROVIDER, model: config.OPENAI_TTS_MODEL, voiceId, requestKey, characterCount, estimatedCostMicros },
    update: { status: "RETRYING", attempts: 0, runAfter: new Date(), lockedAt: null, errorMessage: null, completedAt: null },
    include: { segments: { orderBy: { index: "asc" }, select: { id: true, sectionId: true, index: true, durationMs: true, startOffset: true, endOffset: true } } },
  });
}

export async function getOwnedAudioState(userId: string, documentId: string) {
  return prisma.audioGenerationJob.findFirst({
    where: { documentId, document: { ownerId: userId } },
    orderBy: { createdAt: "desc" },
    include: { segments: { orderBy: { index: "asc" }, select: { id: true, sectionId: true, index: true, durationMs: true, startOffset: true, endOffset: true } } },
  });
}
