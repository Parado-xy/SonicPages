"use client";

import { Check, DownloadCloud, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasOfflineDocument, removeOfflineDocument, saveOfflineDocument, type OfflineSnapshot } from "@/lib/offline";

export function OfflineDocumentButton({ documentId }: { documentId: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void hasOfflineDocument(documentId).then(setSaved); }, [documentId]);

  async function save() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/offline`, { cache: "no-store" });
      if (!response.ok) throw new Error("Document could not be prepared for offline reading.");
      await saveOfflineDocument(await response.json() as OfflineSnapshot);
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Offline save failed."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    await removeOfflineDocument(documentId);
    setSaved(false); setMenuOpen(false); setBusy(false);
  }

  return <div className="relative"><Button size="icon" variant="ghost" onClick={() => saved ? setMenuOpen((open) => !open) : void save()} disabled={busy} aria-label={saved ? "Manage offline copy" : "Save for offline reading"}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : saved ? <Check className="size-4 text-primary" /> : <DownloadCloud className="size-4" />}</Button>{menuOpen ? <div className="absolute right-0 top-11 z-50 w-48 space-y-1 rounded-xl border bg-card p-2 text-card-foreground shadow-xl"><button className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted" onClick={() => { setMenuOpen(false); void save(); }}>Refresh offline copy</button><button className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-danger hover:bg-muted" onClick={() => void remove()}>Remove from device</button></div> : null}{saved ? <span className="sr-only">Available offline</span> : null}{error ? <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border bg-card p-3 text-xs text-danger shadow-xl">{error}</div> : null}</div>;
}
