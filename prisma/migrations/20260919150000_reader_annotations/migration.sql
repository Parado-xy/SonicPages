ALTER TABLE "Bookmark" ADD COLUMN "characterOffset" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Note" ADD COLUMN "highlightId" TEXT;

CREATE UNIQUE INDEX "Bookmark_userId_documentId_sectionId_characterOffset_key"
ON "Bookmark"("userId", "documentId", "sectionId", "characterOffset");
CREATE INDEX "Note_highlightId_idx" ON "Note"("highlightId");

ALTER TABLE "Note" ADD CONSTRAINT "Note_highlightId_fkey"
FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
