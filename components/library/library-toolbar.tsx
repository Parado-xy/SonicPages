"use client";

import { Grid2X2, List, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  initialQuery: string;
  format?: string;
  status?: string;
  sort: string;
  view: "grid" | "list";
};

export function LibraryToolbar({ initialQuery, format, status, sort, view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  function update(values: Record<string, string | undefined>) {
    const params = new URLSearchParams(current.toString());
    Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    if (!("page" in values)) params.delete("page");
    router.replace(`${pathname}?${params.toString()}` as never);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update({ q: query.trim() || undefined });
  }

  return (
    <div className="rounded-3xl border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative min-w-0 flex-1" onSubmit={submit}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, authors, and filenames"
            aria-label="Search library"
            className="h-11 w-full rounded-2xl border bg-background pl-10 pr-10 text-sm outline-none transition focus:border-primary"
          />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); update({ q: undefined }); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </form>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <FilterSelect label="Format" value={format ?? ""} onChange={(value) => update({ format: value || undefined })}>
            <option value="">All formats</option><option>PDF</option><option>EPUB</option><option>DOCX</option><option>TXT</option>
          </FilterSelect>
          <FilterSelect label="Status" value={status ?? ""} onChange={(value) => update({ status: value || undefined })}>
            <option value="">All statuses</option><option value="READY">Ready</option><option value="PROCESSING">Processing</option><option value="FAILED">Failed</option>
          </FilterSelect>
          <FilterSelect label="Sort" value={sort} onChange={(value) => update({ sort: value === "recent" ? undefined : value })}>
            <option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title</option><option value="size">File size</option>
          </FilterSelect>
          <div className="flex rounded-xl border p-1">
            <Button type="button" size="icon" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => update({ view: undefined })} aria-label="Grid view"><Grid2X2 className="size-4" /></Button>
            <Button type="button" size="icon" variant={view === "list" ? "secondary" : "ghost"} onClick={() => update({ view: "list" })} aria-label="List view"><List className="size-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary lg:w-auto">
        {children}
      </select>
    </label>
  );
}
