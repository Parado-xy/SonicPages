ALTER TABLE "Bookmark" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Highlight" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Note" ADD COLUMN "clientId" TEXT;

CREATE UNIQUE INDEX "Bookmark_clientId_key" ON "Bookmark"("clientId");
CREATE UNIQUE INDEX "Highlight_clientId_key" ON "Highlight"("clientId");
CREATE UNIQUE INDEX "Note_clientId_key" ON "Note"("clientId");
