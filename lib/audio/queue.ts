import type { AudioGenerationJob } from "@prisma/client";

import { splitForSpeech } from "@/lib/audio/chunk";
import { createSpeechProvider } from "@/lib/audio/provider";
import { prisma } from "@/lib/prisma";
import { storeGeneratedAudio } from "@/lib/storage/s3";

type ClaimedJob = Pick<AudioGenerationJob, "id" | "documentId" | "requestedById" | "provider" | "model" | "voiceId" | "requestKey" | "attempts" | "maxAttempts" | "characterCount" | "estimatedCostMicros">;

export async function processNextAudioJob() {
  const job = await claimNextJob();
  if (!job) return null;
  try {
    const provider = createSpeechProvider();
    if (provider.id !== job.provider) throw new Error(`Audio provider ${job.provider} is not configured.`);
    const document = await prisma.document.findUnique({
      where: { id: job.documentId },
      select: { sections: { orderBy: { index: "asc" }, select: { id: true, index: true, text: true } }, audioSegments: { where: { jobId: job.id }, select: { index: true } } },
    });
    if (!document?.sections.length) throw new Error("The document has no readable sections.");
    const completedIndexes = new Set(document.audioSegments.map((segment) => segment.index));
    let segmentIndex = 0;
    for (const section of document.sections) {
      for (const chunk of splitForSpeech(section.text)) {
        const currentIndex = segmentIndex++;
        if (completedIndexes.has(currentIndex)) continue;
        const audio = await provider.synthesize({ text: chunk.text, voiceId: job.voiceId, model: job.model, rate: 1 });
        const storageKey = `users/${job.requestedById}/audio/${job.documentId}/${job.requestKey}/${currentIndex}.mp3`;
        await storeGeneratedAudio(storageKey, audio.bytes, audio.contentType);
        await prisma.audioSegment.create({ data: { jobId: job.id, documentId: job.documentId, sectionId: section.id, index: currentIndex, storageKey, durationMs: audio.durationMs, contentType: audio.contentType, byteSize: BigInt(audio.bytes.byteLength), startOffset: chunk.startOffset, endOffset: chunk.endOffset, textHash: chunk.textHash } });
      }
    }
    await prisma.audioGenerationJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, errorMessage: null, actualCostMicros: job.estimatedCostMicros } });
  } catch (error) {
    await recordFailure(job, error);
  }
  return job.id;
}

async function claimNextJob() {
  const jobs = await prisma.$queryRaw<ClaimedJob[]>`
    WITH candidate AS (
      SELECT "id" FROM "AudioGenerationJob"
      WHERE (("status" IN ('QUEUED', 'RETRYING') AND "runAfter" <= NOW()) OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '15 minutes'))
      ORDER BY "runAfter", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE "AudioGenerationJob" AS job SET "status" = 'PROCESSING', "lockedAt" = NOW(), "startedAt" = COALESCE(job."startedAt", NOW()), "attempts" = job."attempts" + 1, "updatedAt" = NOW()
    FROM candidate WHERE job."id" = candidate."id"
    RETURNING job."id", job."documentId", job."requestedById", job."provider", job."model", job."voiceId", job."requestKey", job."attempts", job."maxAttempts", job."characterCount", job."estimatedCostMicros"
  `;
  return jobs[0] ?? null;
}

async function recordFailure(job: ClaimedJob, thrown: unknown) {
  const failed = job.attempts >= job.maxAttempts;
  const message = (thrown instanceof Error ? thrown.message : "Audio generation failed.").replace(/[\r\n]+/g, " ").slice(0, 2_000);
  await prisma.audioGenerationJob.update({ where: { id: job.id }, data: failed ? { status: "FAILED", errorMessage: message, lockedAt: null } : { status: "RETRYING", errorMessage: message, lockedAt: null, runAfter: new Date(Date.now() + Math.min(15 * 60, 30 * 2 ** Math.max(0, job.attempts - 1)) * 1_000) } });
}
