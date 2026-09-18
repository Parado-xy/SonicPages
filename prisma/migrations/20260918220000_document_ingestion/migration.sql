-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "DocumentIngestionJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentIngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentIngestionJob_documentId_key" ON "DocumentIngestionJob"("documentId");

-- CreateIndex
CREATE INDEX "DocumentIngestionJob_status_runAfter_idx" ON "DocumentIngestionJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "DocumentIngestionJob_lockedAt_idx" ON "DocumentIngestionJob"("lockedAt");

-- AddForeignKey
ALTER TABLE "DocumentIngestionJob" ADD CONSTRAINT "DocumentIngestionJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
