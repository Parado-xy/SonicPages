"use client";

import { LoaderCircle, Pause, Play, RotateCcw, RotateCw, Volume2, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { supportedVoices } from "@/lib/audio/config";
import { resilientMutation } from "@/lib/offline";

type Segment = { id: string; sectionId: string | null; index: number; durationMs: number; startOffset: number; endOffset: number; url: string };
type Job = { id: string; status: string; voiceId: string; errorMessage: string | null; segments: Segment[] } | null;
type Preference = { provider: string; voiceId: string; rate: number; pitch: number; autoAdvance: boolean };

export function AudioPlayer({ ownerId, documentId, sectionId, sectionIndex, sectionCount, initialJob, initialPreference, onAdvance }: { ownerId: string; documentId: string; sectionId: string; sectionIndex: number; sectionCount: number; initialJob: Job; initialPreference: Preference; onAdvance: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [job, setJob] = useState(initialJob);
  const [preference, setPreference] = useState(initialPreference);
  const [segmentPosition, setSegmentPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastProgressSave = useRef(0);
  const segments = job?.segments.filter((segment) => segment.sectionId === sectionId) ?? [];
  const segment = segments[segmentPosition];
  const totalDuration = segments.reduce((total, item) => total + item.durationMs / 1_000, 0);
  const completedDuration = segments.slice(0, segmentPosition).reduce((total, item) => total + item.durationMs / 1_000, 0);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/documents/${documentId}/audio`);
    if (!response.ok) return;
    const body = await response.json();
    setJob(body.job);
  }, [documentId]);

  useEffect(() => {
    if (!job || !["QUEUED", "PROCESSING", "RETRYING"].includes(job.status)) return;
    const timer = window.setInterval(() => void refresh(), 2_500);
    return () => window.clearInterval(timer);
  }, [job, refresh]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = preference.rate; }, [preference.rate, segment]);

  async function generate() {
    setError(null);
    const response = await fetch(`/api/documents/${documentId}/audio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: preference.voiceId }) });
    const body = await response.json();
    if (!response.ok) return setError(body.error ?? "Audio generation could not start.");
    setJob(body.job);
  }

  function savePreference(patch: Partial<Preference>) {
    const updated = { ...preference, ...patch };
    setPreference(updated);
    void resilientMutation(ownerId, "/api/audio/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
  }

  async function togglePlayback() {
    if (!audio.current) return;
    if (audio.current.paused) await audio.current.play(); else audio.current.pause();
  }

  function seekBy(seconds: number) {
    if (!audio.current) return;
    audio.current.currentTime = Math.max(0, Math.min(audio.current.duration || 0, audio.current.currentTime + seconds));
  }

  function onEnded() {
    if (segmentPosition < segments.length - 1) { setSegmentPosition((value) => value + 1); window.setTimeout(() => void audio.current?.play(), 0); }
    else { setPlaying(false); if (preference.autoAdvance && sectionIndex < sectionCount - 1) onAdvance(); }
  }

  function onTimeUpdate() {
    if (!audio.current || !segment) return;
    const currentElapsed = completedDuration + audio.current.currentTime;
    setElapsed(currentElapsed);
    if (Date.now() - lastProgressSave.current < 2_000) return;
    lastProgressSave.current = Date.now();
    const ratio = audio.current.duration ? audio.current.currentTime / audio.current.duration : 0;
    const characterOffset = Math.round(segment.startOffset + (segment.endOffset - segment.startOffset) * ratio);
    const percent = ((sectionIndex + characterOffset / Math.max(1, segment.endOffset)) / sectionCount) * 100;
    void resilientMutation(ownerId, `/api/documents/${documentId}/progress`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionIndex, characterOffset, percent: Math.min(100, percent), positionSeconds: Math.round(currentElapsed) }) });
  }

  const busy = job && ["QUEUED", "PROCESSING", "RETRYING"].includes(job.status);
  return <div className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-3xl rounded-2xl border border-current/10 bg-card/95 p-3 text-card-foreground shadow-2xl backdrop-blur-xl sm:bottom-5 sm:p-4">
    {segment ? <audio ref={audio} src={segment.url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={onEnded} onTimeUpdate={onTimeUpdate} /> : null}
    <div className="flex items-center gap-2 sm:gap-3">
      {segments.length ? <><Button size="icon" variant="ghost" onClick={() => seekBy(-15)} aria-label="Back 15 seconds"><RotateCcw className="size-4" /></Button><Button size="icon" onClick={togglePlayback} aria-label={playing ? "Pause audio" : "Play audio"}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button><Button size="icon" variant="ghost" onClick={() => seekBy(15)} aria-label="Forward 15 seconds"><RotateCw className="size-4" /></Button><div className="min-w-0 flex-1"><input className="w-full accent-[var(--primary)]" aria-label="Audio position" type="range" min="0" max={Math.max(1, totalDuration)} value={Math.min(elapsed, totalDuration)} onChange={(event) => { const target = Number(event.target.value); const local = target - completedDuration; if (audio.current && local >= 0 && local <= (audio.current.duration || 0)) audio.current.currentTime = local; }} /><p className="text-[11px] text-muted-foreground">{formatTime(elapsed)} / {formatTime(totalDuration)} · {job?.voiceId}</p></div></> : <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Listen to this document</p><p className="truncate text-xs text-muted-foreground">{busy ? "Creating private audio in the background…" : job?.status === "FAILED" ? job.errorMessage : "Choose a voice and generate reusable audio."}</p></div>}
      <label className="hidden items-center gap-1 sm:flex"><Volume2 className="size-4 text-muted-foreground" /><select aria-label="Voice" value={preference.voiceId} onChange={(event) => savePreference({ voiceId: event.target.value })} className="rounded-lg border bg-background px-2 py-1.5 text-xs">{supportedVoices.map((voice) => <option key={voice}>{voice}</option>)}</select></label>
      <select aria-label="Playback speed" value={preference.rate} onChange={(event) => savePreference({ rate: Number(event.target.value) })} className="rounded-lg border bg-background px-2 py-1.5 text-xs">{[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select>
      {!segments.length ? <Button onClick={generate} disabled={Boolean(busy)}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}{busy ? "Generating" : "Generate"}</Button> : preference.voiceId !== job?.voiceId ? <Button variant="outline" onClick={generate}>Use voice</Button> : null}
    </div>{error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
  </div>;
}

function formatTime(seconds: number) { const value = Math.max(0, Math.round(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }
