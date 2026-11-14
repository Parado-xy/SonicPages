export type PlaybackStatus = { playing: boolean; positionMs: number };

export interface AudioPlayer {
  play(
    uri: string,
    title: string,
    positionMs: number,
    signal: AbortSignal,
    onStatus: (status: PlaybackStatus) => void,
  ): Promise<void>;
  pause(): void;
  resume(): void;
}
