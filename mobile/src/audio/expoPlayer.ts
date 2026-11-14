import { createAudioPlayer, setAudioModeAsync, type AudioPlayer as NativePlayer } from "expo-audio";
import { AppState } from "react-native";
import type { AudioPlayer, PlaybackStatus } from "./player";

export class ExpoPlayer implements AudioPlayer {
  private current?: NativePlayer;
  private owner?: AbortSignal;
  private hasMediaSession = false;

  async play(uri: string, title: string, positionMs: number, signal: AbortSignal,
    onStatus: (status: PlaybackStatus) => void) {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "doNotMix",
    });
    if (signal.aborted) return;

    if (this.owner !== signal) {
      this.close();
      this.current = createAudioPlayer(null, { updateInterval: 250 });
      this.owner = signal;
      signal.addEventListener("abort", () => this.close(signal), { once: true });
    }
    const player = this.current!;
    await new Promise<void>((resolve, reject) => {
      let started = false;
      let requestedPlay = false;
      let settled = false;
      let lastPosition = 0;
      let lastAdvance = Date.now();
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearInterval(watchdog);
        subscription.remove();
        signal.removeEventListener("abort", cancel);
        if (error) reject(error);
        else resolve();
      };
      const cancel = () => finish();
      const watchdog = setInterval(() => {
        const value = player.currentStatus;
        if (!started || value.isBuffering || value.playing || (requestedPlay && value.playbackState === "idle")) {
          if (Date.now() - lastAdvance > 15_000) finish(new Error("Android audio player stopped advancing"));
        } else {
          lastAdvance = Date.now();
        }
      }, 1000);

      const status = (value: NativePlayer["currentStatus"]) => {
        if (started && value.didJustFinish) {
          finish();
          return;
        }
        if (!value.isLoaded || value.didJustFinish || value.duration <= 0) return;
        if (!started) {
          started = true;
          const start = async () => {
            if (positionMs > 0 && positionMs < value.duration * 1000 - 250) {
              await player.seekTo(positionMs / 1000);
            }
            if (settled) return;
            if (!this.hasMediaSession && AppState.currentState !== "background") {
              try {
                player.setActiveForLockScreen(true, { title, artist: "SonicPages" });
                this.hasMediaSession = true;
              } catch (error) {
                console.warn("Could not enable lock-screen playback controls", error);
              }
            }
            requestedPlay = true;
            player.play();
          };
          void start().catch(error => finish(error));
          return;
        }
        if (value.currentTime !== lastPosition) {
          lastPosition = value.currentTime;
          lastAdvance = Date.now();
        }
        onStatus({ playing: value.playing, positionMs: value.currentTime * 1000 });
      };
      const subscription = player.addListener("playbackStatusUpdate", status);
      signal.addEventListener("abort", cancel, { once: true });
      try {
        player.replace(uri);
        status(player.currentStatus);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  close(signal?: AbortSignal) {
    if (signal && this.owner !== signal) return;
    const player = this.current;
    this.current = undefined;
    this.owner = undefined;
    this.hasMediaSession = false;
    // Let the current clip detach its listeners before releasing the native player.
    if (!player) return;
    queueMicrotask(() => {
      try {
        player.pause();
        player.clearLockScreenControls();
      } catch (error) {
        console.warn("Could not clear audio controls", error);
      } finally {
        player.remove();
      }
    });
  }

  pause() { this.current?.pause(); }
  resume() { this.current?.play(); }
}
