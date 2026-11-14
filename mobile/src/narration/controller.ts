import type { AudioPlayer } from "../audio/player";
import type { GeneratedSpeech, LocalSpeechEngine, SpeechChunk } from "../speech/types";

export type ReadingPosition = { index: number; positionMs: number };
export type NarrationState = ReadingPosition & {
  phase: "idle" | "generating" | "buffering" | "playing" | "paused" | "finished" | "error";
  durationMs?: number;
  highlightedIndex: number | null;
  error?: string;
};

export class NarrationController {
  private session?: AbortController;
  private clipDurationMs?: number;
  private state: NarrationState;

  constructor(
    private readonly engine: Pick<LocalSpeechEngine, "synthesize">,
    private readonly audio: AudioPlayer,
    private readonly chunks: SpeechChunk[],
    private readonly title: string,
    position: ReadingPosition,
    private readonly publish: (state: NarrationState) => void,
    private readonly persist: (position: ReadingPosition) => void,
  ) {
    this.state = { ...position, phase: "idle", highlightedIndex: null };
  }

  private update(next: Partial<NarrationState>) {
    this.state = { ...this.state, ...next };
    this.publish(this.state);
  }

  checkpoint() {
    if (this.state.highlightedIndex === null || this.clipDurationMs === undefined) return;
    const nativePosition = this.audio.positionMs?.();
    const positionMs = Number.isFinite(nativePosition)
      ? Math.max(0, Math.min(nativePosition!, this.clipDurationMs))
      : this.state.positionMs;
    this.update({ positionMs });
    this.persist({ index: this.state.index, positionMs });
  }

  stop() {
    this.checkpoint();
    this.session?.abort();
    this.session = undefined;
    this.clipDurationMs = undefined;
    this.update({ phase: "idle", highlightedIndex: null, durationMs: undefined });
  }

  toggle() {
    switch (this.state.phase) {
      case "playing": this.audio.pause(); break;
      case "paused": this.audio.resume(); break;
      case "generating":
      case "buffering": break;
      case "finished": void this.listen(0); break;
      default: void this.listen(this.state.index, this.state.positionMs);
    }
  }

  async seek(positionMs: number) {
    if (!this.clipDurationMs || this.state.highlightedIndex === null || !this.audio.seek) return;
    const session = this.session;
    const target = Math.max(0, Math.min(positionMs, this.clipDurationMs - 1));
    await this.audio.seek(target);
    if (session !== this.session || session?.signal.aborted) return;
    this.update({ positionMs: target });
    this.persist({ index: this.state.index, positionMs: target });
  }

  async skip(deltaMs: number, durationAt: (index: number) => number | undefined) {
    if (this.state.highlightedIndex === null || !this.clipDurationMs) return;
    let index = this.state.index;
    let position = (this.audio.positionMs?.() ?? this.state.positionMs) + deltaMs;
    let duration = this.clipDurationMs;
    while (position >= duration && index + 1 < this.chunks.length) {
      position -= duration;
      const next = durationAt(++index);
      if (!next) { position = 0; break; }
      duration = next;
    }
    while (position < 0 && index > 0) {
      const previous = durationAt(--index);
      if (!previous) { position = 0; break; }
      position += previous;
    }
    if (index === this.state.index) await this.seek(position);
    else if (this.state.phase === "paused") {
      this.stop();
      this.update({ index, positionMs: Math.max(0, position) });
      this.persist({ index, positionMs: this.state.positionMs });
    } else await this.listen(index, Math.max(0, position));
  }

  async listen(index: number, positionMs = 0) {
    if (!this.chunks[index]) return;
    this.session?.abort();
    const session = new AbortController();
    this.session = session;
    const { signal } = session;
    const prepare = (chunk: SpeechChunk): Promise<GeneratedSpeech> => {
      const result = this.engine.synthesize(chunk, signal);
      // A look-ahead failure is handled when its passage reaches the front of the queue.
      void result.catch(() => undefined);
      return result;
    };

    try {
      this.persist({ index, positionMs });
      const pending = new Map<number, Promise<GeneratedSpeech>>();
      let scheduled = index;
      const fill = (through: number) => {
        while (scheduled <= through && scheduled < this.chunks.length) {
          pending.set(scheduled, prepare(this.chunks[scheduled]));
          scheduled++;
        }
      };
      fill(index);
      for (let current = index; current < this.chunks.length && !signal.aborted; current++) {
        const offset = current === index ? positionMs : 0;
        this.update({ index: current, positionMs: offset, phase: "generating", highlightedIndex: null, durationMs: undefined });
        this.clipDurationMs = undefined;
        const clip = await pending.get(current)!;
        pending.delete(current);
        if (signal.aborted) return;
        const next = this.chunks[current + 1];
        this.clipDurationMs = clip.durationMs;
        fill(current + 3);
        let lastSaved = -Infinity;
        let hasPlayed = false;
        await this.audio.play(clip.localAudioUri, this.title, offset, signal, status => {
          if (signal.aborted) return;
          hasPlayed ||= status.playing;
          if (!hasPlayed) return;
          const phase = status.buffering ? "buffering" : status.playing ? "playing" : "paused";
          const elapsed = Math.min(clip.durationMs, Math.max(0, status.positionMs));
          const phaseChanged = this.state.phase !== phase;
          this.update({ index: current, phase, positionMs: elapsed, durationMs: clip.durationMs, highlightedIndex: current });
          if (phaseChanged || Math.abs(elapsed - lastSaved) >= 1000) {
            this.persist({ index: current, positionMs: elapsed });
            lastSaved = elapsed;
          }
        });
        if (signal.aborted) return;
        this.clipDurationMs = undefined;
        this.persist(next ? { index: current + 1, positionMs: 0 } : { index: 0, positionMs: 0 });
      }
      if (!signal.aborted) {
        this.update({ phase: "finished", highlightedIndex: null, positionMs: 0, durationMs: undefined });
        session.abort();
      }
    } catch (error) {
      if (!signal.aborted) {
        this.update({ phase: "error", highlightedIndex: null, error: error instanceof Error ? error.message : String(error) });
        session.abort();
      }
    }
  }
}
