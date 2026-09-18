"use client";

import { Download, FolderPlus, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CollectionOption = { id: string; name: string; selected: boolean };

export function DocumentActions({ documentId, title, collections }: { documentId: string; title: string; collections: CollectionOption[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [nextTitle, setNextTitle] = useState(title);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    setPending(true); setError(null);
    const response = await fetch(`/api/documents/${documentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: nextTitle }) });
    const body = await response.json() as { error?: string };
    setPending(false); if (!response.ok) return setError(body.error ?? "Unable to rename document.");
    setDialog(null); router.refresh();
  }

  async function remove() {
    setPending(true); setError(null);
    const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    if (!response.ok) { const body = await response.json() as { error?: string }; setPending(false); return setError(body.error ?? "Unable to delete document."); }
    setDialog(null); router.refresh();
  }

  async function download() {
    const response = await fetch(`/api/documents/${documentId}/download`);
    const body = await response.json() as { url?: string; error?: string };
    if (!response.ok || !body.url) return setError(body.error ?? "Unable to download document.");
    window.location.assign(body.url);
  }

  async function toggleCollection(collection: CollectionOption) {
    await fetch(`/api/collections/${collection.id}/documents`, {
      method: collection.selected ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    router.refresh();
  }

  return (
    <>
      <details className="relative">
        <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Actions for ${title}`}><MoreHorizontal className="size-5" /></summary>
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border bg-card p-2 text-sm shadow-xl">
          <Action onClick={download} icon={Download}>Download original</Action>
          <Action onClick={() => setDialog("rename")} icon={Pencil}>Rename</Action>
          {collections.length ? <div className="my-1 border-t" /> : null}
          {collections.map((collection) => <Action key={collection.id} onClick={() => toggleCollection(collection)} icon={FolderPlus}>{collection.selected ? "Remove from" : "Add to"} {collection.name}</Action>)}
          <div className="my-1 border-t" />
          <Action onClick={() => setDialog("delete")} icon={Trash2} danger>Delete document</Action>
        </div>
      </details>
      {dialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/25 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{dialog === "rename" ? "Document details" : "Permanent action"}</p><h2 className="mt-2 text-xl font-semibold">{dialog === "rename" ? "Rename document" : "Delete document?"}</h2></div>
              <Button size="icon" variant="ghost" onClick={() => setDialog(null)}><X className="size-4" /></Button>
            </div>
            {dialog === "rename" ? <input autoFocus value={nextTitle} maxLength={160} onChange={(event) => setNextTitle(event.target.value)} className="mt-6 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary" /> : <p className="mt-4 text-sm leading-6 text-muted-foreground">This removes the database record and every private storage asset for <strong className="text-foreground">{title}</strong>. This cannot be undone.</p>}
            {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={() => setDialog(null)} disabled={pending}>Cancel</Button><Button onClick={dialog === "rename" ? rename : remove} disabled={pending || (dialog === "rename" && !nextTitle.trim())} className={dialog === "delete" ? "bg-danger text-white" : undefined}>{pending ? "Working…" : dialog === "rename" ? "Save title" : "Delete permanently"}</Button></div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function Action({ icon: Icon, children, onClick, danger }: { icon: typeof Download; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted ${danger ? "text-danger" : ""}`}><Icon className="size-4" /> <span className="truncate">{children}</span></button>;
}
