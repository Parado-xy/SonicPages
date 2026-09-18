import { BookOpen, CheckCircle2, Clock3, FileText, LibraryBig } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/auth";
import { CollectionNav } from "@/components/library/collection-nav";
import { DocumentActions } from "@/components/library/document-actions";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { ProcessingRefresh, RetryIngestion } from "@/components/library/processing-controls";
import { UploadDocument } from "@/components/library/upload-document";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listOwnedCollections, listOwnedDocuments } from "@/lib/data/documents";
import { parseLibraryQuery } from "@/lib/library-query";
import { formatBytes } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export const metadata = { title: "Library" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LibraryPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  const query = parseLibraryQuery(await searchParams);
  const userId = session?.user.id;
  const [{ documents, total }, collections] = userId
    ? await Promise.all([listOwnedDocuments(userId, query), listOwnedCollections(userId)])
    : [{ documents: [], total: 0 }, []];
  const processing = documents.some((document) => ["PENDING", "PROCESSING"].includes(document.status));
  const filtered = Boolean(query.q || query.format || query.status || query.collectionId);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <ProcessingRefresh active={processing} />
      <PageHeader eyebrow="Your workspace" title="Library" description="Find every document, reading thread, and collection in one calm workspace." action={<UploadDocument />} />
      <div className="mt-8">
        <CollectionNav collections={collections} selected={query.collectionId} />
        <LibraryToolbar initialQuery={query.q} format={query.format} status={query.status} sort={query.sort} view={query.view} />
        <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
          <p>{total} document{total === 1 ? "" : "s"}{query.collectionId ? " in this collection" : ""}</p>
          {filtered ? <Link href="/library" className="font-semibold text-primary hover:underline">Clear filters</Link> : null}
        </div>

        {documents.length ? (
          <div className={cn("mt-4", query.view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3")}>
            {documents.map((document) => {
              const collectionOptions = collections.map((collection) => ({ id: collection.id, name: collection.name, selected: document.collections.some((membership) => membership.collectionId === collection.id) }));
              return query.view === "grid" ? (
                <Card key={document.id} className="group flex min-h-64 flex-col overflow-visible p-5 transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileText className="size-5" /></div>
                    <div className="flex items-center gap-2"><Badge variant="outline">{document.format}</Badge><DocumentActions documentId={document.id} title={document.title} collections={collectionOptions} /></div>
                  </div>
                  <h2 className="mt-6 line-clamp-2 font-semibold">{document.title}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{document.author || document.originalFilename}</p>
                  <CollectionLabels names={document.collections.map((membership) => membership.collection.name)} />
                  {document.status === "FAILED" && document.failureReason ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-danger">{document.failureReason}</p> : null}
                  <ReadingProgress percent={document.readingProgress[0]?.percent} />
                  <div className="mt-auto flex items-center justify-between border-t pt-4 text-xs text-muted-foreground"><span>{formatBytes(document.sizeBytes)}</span><DocumentStatus document={document} /></div>
                </Card>
              ) : (
                <Card key={document.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileText className="size-5" /></div><div className="min-w-0"><h2 className="truncate font-semibold">{document.title}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{document.author || document.originalFilename}</p></div></div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end"><Badge variant="outline">{document.format}</Badge><ReadingProgress percent={document.readingProgress[0]?.percent} compact /><span className="hidden text-xs text-muted-foreground md:block">{formatBytes(document.sizeBytes)}</span><DocumentStatus document={document} /><DocumentActions documentId={document.id} title={document.title} collections={collectionOptions} /></div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-4"><EmptyState icon={filtered ? BookOpen : LibraryBig} title={filtered ? "No documents match this view" : "Your library is ready for its first chapter"} description={filtered ? "Try a broader search, another format, or clear the active collection." : "Upload a document and SonicPages will securely extract it for reading."} footer={filtered ? <Link href="/library" className="text-sm font-semibold text-primary hover:underline">Show all documents</Link> : <Badge variant="outline">PDF · EPUB · DOCX · TXT</Badge>} /></div>
        )}
        {pageCount > 1 ? <Pagination query={query} pageCount={pageCount} /> : null}
      </div>
    </div>
  );
}

function DocumentStatus({ document }: { document: { id: string; status: string; _count: { sections: number } } }) {
  if (document.status === "FAILED") return <RetryIngestion documentId={document.id} />;
  if (document.status === "READY") return <span className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="size-3.5" />{document._count.sections} section{document._count.sections === 1 ? "" : "s"}</span>;
  return <span className="flex items-center gap-1.5"><Clock3 className="size-3.5 animate-pulse" />Processing</span>;
}

function CollectionLabels({ names }: { names: string[] }) {
  if (!names.length) return <div className="min-h-7" />;
  return <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">{names.slice(0, 2).map((name) => <span key={name} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{name}</span>)}{names.length > 2 ? <span className="px-1 py-1 text-[11px] text-muted-foreground">+{names.length - 2}</span> : null}</div>;
}

function ReadingProgress({ percent, compact = false }: { percent?: number; compact?: boolean }) {
  if (!percent) return compact ? null : <div className="min-h-5" />;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  if (compact) return <span className="hidden text-xs font-medium text-primary lg:block">{value}% read</span>;
  return <div className="my-3"><div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>Reading progress</span><span>{value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></div></div>;
}

function Pagination({ query, pageCount }: { query: ReturnType<typeof parseLibraryQuery>; pageCount: number }) {
  const values = { q: query.q || undefined, format: query.format, status: query.status, sort: query.sort === "recent" ? undefined : query.sort, view: query.view === "grid" ? undefined : query.view, collection: query.collectionId };
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Library pages">
      <Link aria-disabled={query.page <= 1} className={cn("rounded-xl border bg-card px-4 py-2 text-sm font-semibold", query.page <= 1 && "pointer-events-none opacity-40")} href={{ pathname: "/library", query: { ...values, page: Math.max(1, query.page - 1) } }}>Previous</Link>
      <span className="text-sm text-muted-foreground">Page {query.page} of {pageCount}</span>
      <Link aria-disabled={query.page >= pageCount} className={cn("rounded-xl border bg-card px-4 py-2 text-sm font-semibold", query.page >= pageCount && "pointer-events-none opacity-40")} href={{ pathname: "/library", query: { ...values, page: Math.min(pageCount, query.page + 1) } }}>Next</Link>
    </nav>
  );
}
