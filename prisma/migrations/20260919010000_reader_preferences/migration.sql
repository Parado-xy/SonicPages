-- CreateTable
CREATE TABLE "ReaderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL DEFAULT 'serif',
    "fontSize" INTEGER NOT NULL DEFAULT 19,
    "lineHeight" DOUBLE PRECISION NOT NULL DEFAULT 1.8,
    "contentWidth" INTEGER NOT NULL DEFAULT 720,
    "theme" TEXT NOT NULL DEFAULT 'paper',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReaderPreference_userId_key" ON "ReaderPreference"("userId");

-- AddForeignKey
ALTER TABLE "ReaderPreference" ADD CONSTRAINT "ReaderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
