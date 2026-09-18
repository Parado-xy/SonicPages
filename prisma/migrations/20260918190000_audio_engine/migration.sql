ALTER TYPE "AudioJobStatus" ADD VALUE 'RETRYING';

ALTER TABLE "PlaybackPreference"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'openai',
ALTER COLUMN "voiceId" SET DEFAULT 'coral',
ALTER COLUMN "voiceId" SET NOT NULL;

ALTER TABLE "AudioGenerationJob"
ADD COLUMN "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini-tts',
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "characterCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "actualCostMicros" INTEGER,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "lockedAt" TIMESTAMP(3);

UPDATE "AudioGenerationJob" SET "requestKey" = "id" WHERE "requestKey" IS NULL;
ALTER TABLE "AudioGenerationJob" ALTER COLUMN "requestKey" SET NOT NULL;
ALTER TABLE "AudioGenerationJob" ALTER COLUMN "model" DROP DEFAULT;

DROP INDEX IF EXISTS "AudioSegment_storageKey_key";
ALTER TABLE "AudioSegment"
ADD COLUMN "startOffset" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "endOffset" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "textHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "AudioSegment" ALTER COLUMN "textHash" DROP DEFAULT;

CREATE UNIQUE INDEX "AudioGenerationJob_requestKey_key" ON "AudioGenerationJob"("requestKey");
CREATE INDEX "AudioGenerationJob_status_runAfter_idx" ON "AudioGenerationJob"("status", "runAfter");
CREATE INDEX "AudioGenerationJob_lockedAt_idx" ON "AudioGenerationJob"("lockedAt");
