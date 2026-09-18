import { BookOpenText, Play } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Reader" };

export default function ReaderPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="Reading space"
        title="Reader preview"
        description="The document canvas and speech engine will be rebuilt on this foundation."
      />
      <Card className="mt-8 overflow-hidden">
        <div className="flex min-h-[32rem] flex-col items-center justify-center px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <BookOpenText className="size-7" aria-hidden="true" />
          </div>
          <Badge className="mt-5" variant="outline">Reader foundation</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">A calmer place to read</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Page rendering, synchronized speech, highlighting, and keyboard controls
            will be introduced in the dedicated reader and audio phases.
          </p>
          <Button className="mt-6" disabled>
            <Play className="size-4" /> Start listening
          </Button>
        </div>
      </Card>
    </div>
  );
}
