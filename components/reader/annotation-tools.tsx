"use client";

import { BookmarkPlus, Download, MessageSquarePlus, Search, StickyNote, Trash2, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resilientMutation } from "@/lib/offline";

type Bookmark = { id: string; sectionId: string | null; characterOffset: number; label: string | null; createdAt: string };
type Highlight = { id: string; sectionId: string | null; startOffset: number; endOffset: number; selectedText: string; color: string; createdAt: string; updatedAt: string };
type Note = { id: string; sectionId: string | null; highlightId: string | null; content: string; createdAt: string; updatedAt: string };
type Section = { id: string; index: number; title: string | null };
type SelectionAnchor = { startOffset: number; endOffset: number; selectedText: string; top: number; left: number };

const markColors: Record<string, string> = { yellow: "bg-amber-200/75 text-inherit", green: "bg-emerald-200/75 text-inherit", blue: "bg-sky-200/75 text-inherit", pink: "bg-pink-200/75 text-inherit" };

export function AnnotationTools({ ownerId, documentId, section, sections, initialAnnotations, panelOpen, onClose, onNavigate }: { ownerId: string; documentId: string; section: Section & { text: string }; sections: Section[]; initialAnnotations: { bookmarks: Bookmark[]; highlights: Highlight[]; notes: Note[] }; panelOpen: boolean; onClose: () => void; onNavigate: (index: number) => void }) {
  const [bookmarks, setBookmarks] = useState(initialAnnotations.bookmarks);
  const [highlights, setHighlights] = useState(initialAnnotations.highlights);
  const [notes, setNotes] = useState(initialAnnotations.notes);
  const [selection, setSelection] = useState<SelectionAnchor | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ highlightId: string | null; content: string } | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sectionHighlights = highlights.filter((item) => item.sectionId === section.id);
  const paragraphs = useMemo(() => paragraphsWithOffsets(section.text), [section.text]);

  function captureSelection() {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) return setSelection(null);
    const range = browserSelection.getRangeAt(0);
    const start = globalOffset(range.startContainer, range.startOffset);
    const end = globalOffset(range.endContainer, range.endOffset);
    const selectedText = browserSelection.toString();
    if (start === null || end === null || start === end || section.text.slice(start, end) !== selectedText) return setSelection(null);
    const rect = range.getBoundingClientRect();
    setSelection({ startOffset: start, endOffset: end, selectedText, top: Math.max(72, rect.top - 52), left: Math.min(window.innerWidth - 190, Math.max(12, rect.left + rect.width / 2 - 90)) });
  }

  async function createHighlight(color: keyof typeof markColors, composeNote = false) {
    if (!selection) return;
    const result = await create({ kind: "highlight", sectionId: section.id, startOffset: selection.startOffset, endOffset: selection.endOffset, selectedText: selection.selectedText, color });
    if (result) { const highlight = result as Highlight; setHighlights((items) => [highlight, ...items]); if (composeNote) setNoteDraft({ highlightId: highlight.id, content: "" }); }
    window.getSelection()?.removeAllRanges(); setSelection(null);
  }

  async function addBookmark() {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const characterOffset = Math.round(section.text.length * Math.max(0, Math.min(1, window.scrollY / scrollable)));
    const result = await create({ kind: "bookmark", sectionId: section.id, characterOffset });
    if (result) setBookmarks((items) => [result as Bookmark, ...items]);
  }

  async function saveNote() {
    if (!noteDraft?.content.trim()) return;
    const result = await create({ kind: "note", sectionId: section.id, highlightId: noteDraft.highlightId, content: noteDraft.content });
    if (result) { setNotes((items) => [result as Note, ...items]); setNoteDraft(null); }
  }

  async function create(body: object) {
    setError(null);
    const clientId = crypto.randomUUID();
    const requestBody = { ...body, clientId };
    const response = await resilientMutation(ownerId, `/api/documents/${documentId}/annotations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
    if (!response) return { id: clientId, ...requestBody, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? "Annotation could not be saved."); return null; }
    return value.annotation;
  }

  async function remove(kind: "bookmark" | "highlight" | "note", id: string) {
    const response = await resilientMutation(ownerId, `/api/annotations/${kind}/${id}`, { method: "DELETE" });
    if (response && !response.ok) return setError("Annotation could not be removed.");
    if (kind === "bookmark") setBookmarks((items) => items.filter((item) => item.id !== id));
    if (kind === "highlight") setHighlights((items) => items.filter((item) => item.id !== id));
    if (kind === "note") setNotes((items) => items.filter((item) => item.id !== id));
  }

  async function recolor(id: string, color: string) {
    const response = await resilientMutation(ownerId, `/api/annotations/highlight/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "highlight", color }) });
    if (!response || response.ok) setHighlights((items) => items.map((item) => item.id === id ? { ...item, color } : item));
  }

  async function updateNote(id: string, content: string) {
    const response = await resilientMutation(ownerId, `/api/annotations/note/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "note", content }) });
    if (!response || response.ok) setNotes((items) => items.map((item) => item.id === id ? { ...item, content } : item));
  }

  const normalizedQuery = query.toLowerCase();
  const filtered = [
    ...bookmarks.filter((item) => (item.label ?? "bookmark").toLowerCase().includes(normalizedQuery)).map((item) => ({ kind: "bookmark" as const, item })),
    ...highlights.filter((item) => item.selectedText.toLowerCase().includes(normalizedQuery)).map((item) => ({ kind: "highlight" as const, item })),
    ...notes.filter((item) => item.content.toLowerCase().includes(normalizedQuery)).map((item) => ({ kind: "note" as const, item })),
  ];

  return <>
    <div className="reader-copy" onMouseUp={captureSelection}>{paragraphs.map((paragraph) => <p key={paragraph.start} data-reader-paragraph data-start={paragraph.start}>{renderMarks(paragraph.text, paragraph.start, sectionHighlights)}</p>)}</div>
    {selection ? <div className="fixed z-50 flex items-center gap-1 rounded-xl border bg-card p-1.5 text-card-foreground shadow-xl" style={{ top: selection.top, left: selection.left }}><button aria-label="Highlight yellow" className="size-7 rounded-lg bg-amber-300" onClick={() => createHighlight("yellow")} /><button aria-label="Highlight green" className="size-7 rounded-lg bg-emerald-300" onClick={() => createHighlight("green")} /><button aria-label="Highlight blue" className="size-7 rounded-lg bg-sky-300" onClick={() => createHighlight("blue")} /><Button size="sm" variant="ghost" onClick={() => createHighlight("yellow", true)}><MessageSquarePlus className="size-4" /> Note</Button></div> : null}
    {noteDraft ? <div className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-lg rounded-2xl border bg-card p-4 text-card-foreground shadow-2xl"><div className="flex items-center justify-between"><p className="font-semibold">Add a note</p><Button size="icon" variant="ghost" onClick={() => setNoteDraft(null)}><X className="size-4" /></Button></div><textarea autoFocus className="mt-3 min-h-28 w-full rounded-xl border bg-background p-3 text-sm" placeholder="Capture your thought…" value={noteDraft.content} onChange={(event) => setNoteDraft({ ...noteDraft, content: event.target.value })} /><div className="mt-3 flex justify-end"><Button onClick={saveNote} disabled={!noteDraft.content.trim()}>Save note</Button></div></div> : null}
    {panelOpen ? <aside className="fixed inset-y-0 right-0 z-40 w-[min(26rem,94vw)] overflow-y-auto border-l bg-card p-5 text-card-foreground shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Reading tools</p><h2 className="mt-1 text-lg font-semibold">Notes & highlights</h2></div><Button size="icon" variant="ghost" onClick={onClose}><X className="size-4" /></Button></div><div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" onClick={addBookmark}><BookmarkPlus className="size-4" /> Bookmark</Button><Button variant="outline" onClick={() => setNoteDraft({ highlightId: null, content: "" })}><StickyNote className="size-4" /> New note</Button></div><div className="relative mt-4"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input aria-label="Search annotations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your annotations" className="h-9 w-full rounded-xl border bg-background pl-9 pr-3 text-sm" /></div><div className="mt-4 flex gap-2"><a href={`/api/documents/${documentId}/annotations/export?format=markdown`} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted px-2 py-2 text-xs font-semibold"><Download className="size-3" /> Markdown</a><a href={`/api/documents/${documentId}/annotations/export?format=json`} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted px-2 py-2 text-xs font-semibold"><Download className="size-3" /> JSON</a></div>{error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}<div className="mt-5 space-y-3">{filtered.length ? filtered.map(({ kind, item }) => <AnnotationCard key={`${kind}-${item.id}`} kind={kind} item={item} sections={sections} highlights={highlights} onNavigate={onNavigate} onRemove={remove} onRecolor={recolor} onUpdateNote={updateNote} />) : <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{query ? "No annotations match your search." : "Select text to highlight it, or save a bookmark or note."}</p>}</div></aside> : null}
  </>;
}

function AnnotationCard({ kind, item, sections, highlights, onNavigate, onRemove, onRecolor, onUpdateNote }: { kind: "bookmark" | "highlight" | "note"; item: Bookmark | Highlight | Note; sections: Section[]; highlights: Highlight[]; onNavigate: (index: number) => void; onRemove: (kind: "bookmark" | "highlight" | "note", id: string) => void; onRecolor: (id: string, color: string) => void; onUpdateNote: (id: string, content: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(kind === "note" ? (item as Note).content : "");
  const section = sections.find((value) => value.id === item.sectionId);
  const text = kind === "highlight" ? (item as Highlight).selectedText : kind === "note" ? (item as Note).content : (item as Bookmark).label || "Saved position";
  const linkedText = kind === "note" ? highlights.find((value) => value.id === (item as Note).highlightId)?.selectedText : null;
  return <article className="rounded-2xl border p-3"><button className="text-left" onClick={() => section && onNavigate(section.index)}><span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{kind} · {section?.title || (section ? `Section ${section.index + 1}` : "Document")}</span>{linkedText ? <p className="mt-2 line-clamp-2 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">{linkedText}</p> : null}{editing ? null : <p className={cn("mt-2 text-sm leading-5", kind === "highlight" && "italic")}>{text}</p>}</button>{editing ? <textarea className="mt-2 min-h-24 w-full rounded-lg border bg-background p-2 text-sm" value={content} onChange={(event) => setContent(event.target.value)} /> : null}<div className="mt-3 flex items-center gap-1">{kind === "highlight" ? Object.keys(markColors).map((color) => <button key={color} aria-label={`Change highlight to ${color}`} onClick={() => onRecolor(item.id, color)} className={cn("size-5 rounded-full", markColors[color], (item as Highlight).color === color && "ring-2 ring-primary ring-offset-1")} />) : null}{kind === "note" ? <Button size="sm" variant="ghost" onClick={() => { if (editing && content.trim()) void onUpdateNote(item.id, content); setEditing(!editing); }}>{editing ? "Save" : "Edit"}</Button> : null}<Button size="icon" variant="ghost" className="ml-auto" onClick={() => void onRemove(kind, item.id)} aria-label={`Delete ${kind}`}><Trash2 className="size-4" /></Button></div></article>;
}

function paragraphsWithOffsets(text: string) { const matches = [...text.matchAll(/\S[\s\S]*?(?=\n{2,}|$)/g)]; return matches.map((match) => ({ text: match[0].trimEnd(), start: match.index ?? 0 })); }
function globalOffset(node: Node, offset: number) { const element = node instanceof Element ? node : node.parentElement; const paragraph = element?.closest<HTMLElement>("[data-reader-paragraph]"); if (!paragraph) return null; const range = document.createRange(); range.selectNodeContents(paragraph); range.setEnd(node, offset); return Number(paragraph.dataset.start) + range.toString().length; }
function renderMarks(text: string, base: number, highlights: Highlight[]) { const relevant = highlights.filter((item) => item.endOffset > base && item.startOffset < base + text.length); const boundaries = [...new Set([0, text.length, ...relevant.flatMap((item) => [Math.max(0, item.startOffset - base), Math.min(text.length, item.endOffset - base)])])].sort((a, b) => a - b); return boundaries.slice(0, -1).map((start, index) => { const end = boundaries[index + 1]; const highlight = relevant.find((item) => item.startOffset <= base + start && item.endOffset >= base + end); const value = text.slice(start, end); return highlight ? <mark key={`${start}-${highlight.id}`} data-highlight-id={highlight.id} className={cn("rounded-sm", markColors[highlight.color] ?? markColors.yellow)}>{value}</mark> : <Fragment key={start}>{value}</Fragment>; }); }
