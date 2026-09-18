import type { DocumentFormat, DocumentIngestionJob } from "@prisma/client";

import { extractDocument } from "@/lib/ingestion/extract";
import { prisma } from "@/lib/prisma";
import { downloadStoredObject } from "@/lib/storage/s3";

type ClaimedJob = Pick<DocumentIngestionJob, "id" | "documentId" | "attempts" | "maxAttempts">;

export async function processNextIngestionJob() {
  const job = await claimNextJob();
  if (!job) return null;

  try {
    const document = await prisma.document.findUnique({
      where: { id: job.documentId },
      include: { assets: { where: { kind: "ORIGINAL" }, take: 1 } },
    });
    const original = document?.assets[0];
    if (!document || !original) throw new Error("The original document asset is missing.");

    const bytes = await downloadStoredObject(original.storageKey);
    if (BigInt(bytes.byteLength) !== original.byteSize) {
      throw new Error("The stored document size changed after upload verification.");
    }
    const extracted = await extractDocument(document.format as DocumentFormat, bytes);

    await prisma.$transaction(async (transaction) => {
      await transaction.documentSection.deleteMany({ where: { documentId: document.id } });
      await transaction.documentSection.createMany({
        data: extracted.sections.map((section, index) => ({
          documentId: document.id,
          index,
          title: section.title,
          text: section.text,
          pageStart: section.pageStart,
          pageEnd: section.pageEnd,
        })),
      });
      await transaction.document.update({
        where: { id: document.id },
        data: {
          status: "READY",
          title: extracted.title ?? document.title,
          author: extracted.author ?? document.author,
          pageCount: extracted.pageCount,
          failureReason: null,
        },
      });
      await transaction.documentIngestionJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date(), lockedAt: null, lastError: null },
      });
    });
  } catch (error) {
    await recordFailure(job, error);
  }

  return job.id;
}

async function claimNextJob() {
  const jobs = await prisma.$queryRaw<ClaimedJob[]>`
    WITH candidate AS (
      SELECT "id"
      FROM "DocumentIngestionJob"
      WHERE (
        ("status" IN ('QUEUED', 'RETRYING') AND "runAfter" <= NOW())
        OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '15 minutes')
      )
      ORDER BY "runAfter" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "DocumentIngestionJob" AS job
    SET "status" = 'PROCESSING',
        "lockedAt" = NOW(),
        "attempts" = job."attempts" + 1,
        "updatedAt" = NOW()
    FROM candidate
    WHERE job."id" = candidate."id"
    RETURNING job."id", job."documentId", job."attempts", job."maxAttempts"
  `;
  return jobs[0] ?? null;
}

async function recordFailure(job: ClaimedJob, thrown: unknown) {
  const message = safeErrorMessage(thrown);
  const failed = job.attempts >= job.maxAttempts;
  const retryDelaySeconds = Math.min(15 * 60, 30 * 2 ** Math.max(0, job.attempts - 1));

  await prisma.$transaction([
    prisma.documentIngestionJob.update({
      where: { id: job.id },
      data: failed
        ? { status: "FAILED", lastError: message, lockedAt: null }
        : {
            status: "RETRYING",
            lastError: message,
            lockedAt: null,
            runAfter: new Date(Date.now() + retryDelaySeconds * 1000),
          },
    }),
    prisma.document.update({
      where: { id: job.documentId },
      data: failed
        ? { status: "FAILED", failureReason: message }
        : { status: "PROCESSING", failureReason: null },
    }),
  ]);
}

function safeErrorMessage(thrown: unknown) {
  const message = thrown instanceof Error ? thrown.message : "Document processing failed.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 2_000);
}
