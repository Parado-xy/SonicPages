"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, List, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/reader/audio-player";
import { cn } from "@/lib/utils";

type SectionSummary = { id: string; index: number; title: string | null; pageStart: number | null; pageEnd: number | null };
type Preference = { fontFamily: string; fontSize: number; lineHeight: number; contentWidth: number; theme: string };
type Props = {
  document: { id: string; title: string; author: string | null; format: string };
  sections: SectionSummary[];
  section: SectionSummary & { text: string };
  progress: { sectionIndex: number | null; characterOffset: number; percent: number };
  preference: Preference;
  playbackPreference: { provider: string; voiceId: string; rate: number; pitch: number; autoAdvance: boolean };
  audioJob: { id: string; status: string; voiceId: string; errorMessage: string | null; segments: { id: string; sectionId: string | null; index: number; durationMs: number; startOffset: number; endOffset: number; url: string }[] } | null;
};

const themeStyles = {
  paper: { background: "#fbfaf6", color: "#28251f" },
  sepia: { background: "#f3e7cf", color: "#3d3022" },
  night: { background: "#111815", color: "#dfe9e1" },
} as const;

export function ReaderExperience({ document, sections, section, progress, preference: initialPreference, playbackPreference, audioJob }: Props) {
  const router = useRouter();
  const [preference, setPreference] = useState(initialPreference);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingPercent, setReadingPercent] = useState(progress.percent);
  const saveTimer = useRef<number | undefined>(undefined);
  const preferenceTimer = useRef<number | undefined>(undefined);
  const sectionPosition = sections.findIndex((item) => item.index === section.index);
  const previous = sections[sectionPosition - 1];
  const next = sections[sectionPosition + 1];

  const saveProgress = useCallback((keepalive = false) => {
    const scrollable = Math.max(1, globalThis.document?.documentElement.scrollHeight - window.innerHeight);
    const fraction = Math.max(0, Math.min(1, window.scrollY / scrollable));
    const percent = ((sectionPosition + fraction) / sections.length) * 100;
    if (!keepalive) setReadingPercent(percent);
    void fetch(`/api/documents/${document.id}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIndex: section.index, characterOffset: Math.round(section.text.length * fraction), percent }),
      keepalive,
    });
  }, [document.id, section.index, section.text.length, sectionPosition, sections.length]);

  useEffect(() => {
    if (progress.sectionIndex === section.index && progress.characterOffset > 0) {
      const ratio = Math.min(1, progress.characterOffset / Math.max(1, section.text.length));
      window.setTimeout(() => window.scrollTo({ top: (globalThis.document.documentElement.scrollHeight - window.innerHeight) * ratio }), 50);
    } else window.scrollTo({ top: 0 });
  }, [progress.characterOffset, progress.sectionIndex, section.index, section.text.length]);

  useEffect(() => {
    const onScroll = () => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => saveProgress(), 800);
    };
    const onBeforeUnload = () => saveProgress(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("beforeunload", onBeforeUnload); window.clearTimeout(saveTimer.current); saveProgress(true); };
  }, [saveProgress]);

  const navigate = useCallback((index: number) => {
    saveProgress();
    setTocOpen(false);
    router.push(`/reader/${document.id}?section=${index}` as never);
  }, [document.id, router, saveProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.key === "ArrowLeft" || event.key.toLowerCase() === "k") && previous) navigate(previous.index);
      if ((event.key === "ArrowRight" || event.key.toLowerCase() === "j") && next) navigate(next.index);
      if (event.key.toLowerCase() === "t") setTocOpen((open) => !open);
      if (event.key === "Escape") { setTocOpen(false); setSettingsOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, next, previous]);

  function updatePreference(patch: Partial<Preference>) {
    const updated = { ...preference, ...patch };
    setPreference(updated);
    window.clearTimeout(preferenceTimer.current);
    preferenceTimer.current = window.setTimeout(() => {
      void fetch("/api/reader/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
    }, 350);
  }

  const colors = themeStyles[preference.theme as keyof typeof themeStyles] ?? themeStyles.paper;
  const overallPercent = Math.round(readingPercent);

  return (
    <div className="-mx-4 -my-8 min-h-screen sm:-mx-6 lg:-mx-10 lg:-my-10" style={colors}>
      <header className="sticky top-16 z-20 border-b border-current/10 px-4 py-3 backdrop-blur-xl sm:px-6 lg:top-0" style={colors}>
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Link href="/library" className="flex size-10 items-center justify-center rounded-xl hover:bg-current/10" aria-label="Back to library"><ChevronLeft className="size-5" /></Link>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{document.title}</p><p className="truncate text-xs opacity-60">{section.title || `Section ${sectionPosition + 1}`} · {overallPercent}%</p></div>
          <Button size="icon" variant="ghost" onClick={() => setTocOpen((open) => !open)} aria-label="Table of contents"><List className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setSettingsOpen((open) => !open)} aria-label="Reading settings"><Settings2 className="size-4" /></Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-current/10"><div className="h-full bg-primary transition-[width]" style={{ width: `${overallPercent}%` }} /></div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className={cn("fixed inset-y-0 right-0 z-40 w-[min(22rem,88vw)] border-l border-current/10 p-5 shadow-2xl transition-transform lg:sticky lg:top-[65px] lg:z-10 lg:h-[calc(100vh-65px)] lg:w-72 lg:translate-x-0 lg:shadow-none", tocOpen ? "translate-x-0" : "translate-x-full")} style={colors}>
          <div className="flex items-center justify-between"><p className="font-semibold">Contents</p><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setTocOpen(false)}><X className="size-4" /></Button></div>
          <nav className="mt-5 max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto pr-1" aria-label="Document sections">
            {sections.map((item, index) => <button key={item.id} onClick={() => navigate(item.index)} aria-current={item.index === section.index ? "location" : undefined} className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-current/10", item.index === section.index && "bg-current/10 font-semibold")}><span className="mt-0.5 text-xs opacity-45">{String(index + 1).padStart(2, "0")}</span><span className="line-clamp-2">{item.title || (item.pageStart ? `Page ${item.pageStart}` : `Section ${index + 1}`)}</span></button>)}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-36 pt-10 sm:px-10 lg:pt-16">
          <article className="mx-auto" style={{ maxWidth: preference.contentWidth, fontFamily: preference.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : "Inter, 'Segoe UI', sans-serif", fontSize: preference.fontSize, lineHeight: preference.lineHeight }}>
            <div className="mb-10 border-b border-current/10 pb-7"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-55"><BookOpen className="size-4" />{document.format}</div><h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{section.title || document.title}</h1>{document.author ? <p className="mt-3 text-base opacity-60">{document.author}</p> : null}</div>
            <div className="reader-copy">{paragraphs(section.text).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <nav className="mt-16 flex items-center justify-between gap-4 border-t border-current/10 pt-7" aria-label="Section navigation"><Button variant="outline" disabled={!previous} onClick={() => previous && navigate(previous.index)}><ArrowLeft className="size-4" /> Previous</Button><span className="text-xs opacity-55">{sectionPosition + 1} of {sections.length}</span><Button disabled={!next} onClick={() => next && navigate(next.index)}>Next <ArrowRight className="size-4" /></Button></nav>
          </article>
        </main>
      </div>

      {settingsOpen ? <ReaderSettings preference={preference} update={updatePreference} close={() => setSettingsOpen(false)} /> : null}
      <AudioPlayer key={section.id} documentId={document.id} sectionId={section.id} sectionIndex={section.index} sectionCount={sections.length} initialJob={audioJob} initialPreference={playbackPreference} onAdvance={() => next && navigate(next.index)} />
    </div>
  );
}

function ReaderSettings({ preference, update, close }: { preference: Preference; update: (patch: Partial<Preference>) => void; close: () => void }) {
  return <div className="fixed right-4 top-36 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border bg-card p-5 text-card-foreground shadow-2xl lg:top-20" role="dialog" aria-label="Reading settings"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Reading comfort</p><h2 className="mt-1 font-semibold">Typography & theme</h2></div><Button size="icon" variant="ghost" onClick={close} aria-label="Close reading settings"><X className="size-4" /></Button></div><div className="mt-5 space-y-5"><Setting label={`Text size · ${preference.fontSize}px`}><input aria-label="Text size" className="w-full accent-[var(--primary)]" type="range" min="15" max="28" value={preference.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} /></Setting><Setting label={`Line height · ${preference.lineHeight.toFixed(1)}`}><input aria-label="Line height" className="w-full accent-[var(--primary)]" type="range" min="1.4" max="2.2" step="0.1" value={preference.lineHeight} onChange={(event) => update({ lineHeight: Number(event.target.value) })} /></Setting><Setting label="Typeface"><div className="grid grid-cols-2 gap-2">{["serif", "sans"].map((font) => <Choice key={font} active={preference.fontFamily === font} onClick={() => update({ fontFamily: font })}>{font === "serif" ? "Book serif" : "Clean sans"}</Choice>)}</div></Setting><Setting label="Reading theme"><div className="grid grid-cols-3 gap-2">{["paper", "sepia", "night"].map((theme) => <Choice key={theme} active={preference.theme === theme} onClick={() => update({ theme })}>{theme}</Choice>)}</div></Setting><Setting label={`Page width · ${preference.contentWidth}px`}><input aria-label="Page width" className="w-full accent-[var(--primary)]" type="range" min="560" max="920" step="40" value={preference.contentWidth} onChange={(event) => update({ contentWidth: Number(event.target.value) })} /></Setting></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Keyboard: ←/K previous · →/J next · T contents · Esc close</p></div>;
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) { return <div><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</div>; }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize", active && "border-primary bg-accent text-accent-foreground")}>{active ? <Check className="size-3" /> : null}{children}</button>; }
function paragraphs(text: string) { return text.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean); }
