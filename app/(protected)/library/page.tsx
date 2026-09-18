import { Clock3, FileText, LibraryBig } from "lucide-react";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { UploadDocument } from "@/components/library/upload-document";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listOwnedDocuments } from "@/lib/data/documents";
import { formatBytes } from "@/lib/uploads";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const documents = session?.user.id ? await listOwnedDocuments(session.user.id) : [];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="Your workspace"
        title="Library"
        description="Your private home for reading, listening, and keeping ideas close."
        action={<UploadDocument />}
      />
      <div className="mt-8">
        {documents.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((document) => (
              <Card key={document.id} className="group overflow-hidden p-5 transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </div>
                  <Badge variant="outline">{document.format}</Badge>
                </div>
                <h2 className="mt-6 line-clamp-2 font-semibold">{document.title}</h2>
                <p className="mt-2 truncate text-sm text-muted-foreground">{document.originalFilename}</p>
                <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                  <span>{formatBytes(document.sizeBytes)}</span>
                  <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> Queued</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={LibraryBig}
            title="Your library is ready for its first chapter"
            description="Upload a document to store it privately. Text extraction and reading arrive in the next phase."
            footer={<Badge variant="outline">PDF · EPUB · DOCX · TXT</Badge>}
          />
        )}
      </div>
    </div>
  );
}
