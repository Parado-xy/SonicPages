"use client";

import { Folder, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Collection = { id: string; name: string; _count: { documents: number } };

export function CollectionNav({ collections, selected }: { collections: Collection[]; selected?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(id?: string) {
    const params = new URLSearchParams(current.toString());
    if (id) params.set("collection", id);
    else params.delete("collection");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}` as never);
  }

  async function create(event: FormEvent) {
    event.preventDefault(); setPending(true); setError(null);
    const response = await fetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const body = await response.json() as { id?: string; error?: string };
    setPending(false);
    if (!response.ok) return setError(body.error ?? "Unable to create collection.");
    setName(""); setCreating(false); router.refresh(); if (body.id) choose(body.id);
  }

  async function removeSelected() {
    if (!selected) return;
    setPending(true);
    const response = await fetch(`/api/collections/${selected}`, { method: "DELETE" });
    setPending(false);
    if (response.ok) { choose(); router.refresh(); }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <button onClick={() => choose()} className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition", !selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>All documents</button>
      {collections.map((collection) => (
        <button key={collection.id} onClick={() => choose(collection.id)} className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition", selected === collection.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
          <Folder className="size-3.5" /> {collection.name} <span className="opacity-65">{collection._count.documents}</span>
        </button>
      ))}
      <Button size="sm" variant="ghost" onClick={() => setCreating((value) => !value)}><Plus className="size-4" /> New collection</Button>
      {selected && !confirmDelete ? <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} aria-label="Delete selected collection"><Trash2 className="size-4 text-danger" /></Button> : null}
      {selected && confirmDelete ? <div className="flex items-center gap-2 rounded-full border border-danger/30 bg-card px-2 py-1"><span className="pl-2 text-xs text-danger">Delete collection?</span><Button size="sm" className="bg-danger text-white" onClick={removeSelected} disabled={pending}>Delete</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button></div> : null}
      {creating ? (
        <form onSubmit={create} className="flex w-full items-center gap-2 pt-2">
          <input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Collection name" className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary sm:max-w-xs" />
          <Button size="sm" disabled={pending || !name.trim()}>Create</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Button>
          {error ? <span className="text-xs text-danger" role="alert">{error}</span> : null}
        </form>
      ) : null}
    </div>
  );
}
