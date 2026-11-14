export type PlaybackStatus = { playing: boolean; buffering?: boolean; positionMs: number };

export interface AudioPlayer {
  play(
    uri: string,
    title: string,
    positionMs: number,
    signal: AbortSignal,
    onStatus: (status: PlaybackStatus) => void,
  ): Promise<void>;
  positionMs?(): number | undefined;
  pause(): void;
  resume(): void;
}
