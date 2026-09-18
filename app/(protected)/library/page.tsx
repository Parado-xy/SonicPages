import { LibraryBig, Upload } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="Your workspace"
        title="Library"
        description="Documents, listening progress, and collections will live here."
        action={
          <Button disabled title="Document uploads arrive in the ingestion phase">
            <Upload className="size-4" /> Add document
          </Button>
        }
      />
      <div className="mt-8">
        <EmptyState
          icon={LibraryBig}
          title="Your library is ready for its first chapter"
          description="Secure accounts and document storage arrive in the next phases. This empty state is intentional: no sample documents or fake progress."
          footer={<Badge variant="outline">Uploads planned for PR 4</Badge>}
        />
      </div>
    </div>
  );
}
