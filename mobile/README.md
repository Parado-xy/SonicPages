# SonicPages mobile — listening-first proof of concept

This directory is an isolated React Native / Expo development-build spike. It does not replace the existing Next.js application.

## Goal

Prove **offline, on-device Kokoro narration** with an immersive text-following reader on real Android and iOS devices.

### Acceptance criteria

1. Import one local UTF-8 TXT file and persist its contents locally.
2. Download or provision Kokoro weights on-device, with explicit storage/size disclosure.
3. Synthesize sentence-aligned chunks without sending document text to a remote service.
4. Play chunks in order and cache completed audio in durable app storage.
5. Display word or passage highlighting based on verified timestamps, never fabricated proportional timing.
6. Continue playing already generated audio with the screen locked, including lock-screen controls.
7. Restore reading position after app restart; allow offline re-opening.
8. Record device model, OS, first-audio latency, generation real-time factor, memory use, and playback interruptions.

### Architecture boundary

- UI: React Native + Expo development builds (not Expo Go).
- Local document and chunk metadata: SQLite.
- Imported TXT content and position: local SQLite. Speech assets and generated WAV files: durable app-private storage.
- Speech adapter: Kokoro ONNX runtime behind a typed interface.
- Playback: expo-audio, configured for background playback.
- Sync: intentionally **out of scope** for this spike. Google Drive will be optional later.
- Payments, sign-in, server database and cloud storage: **out of scope**.

### Development order

1. Create the Expo TypeScript app in this directory using the currently compatible Expo SDK.
2. Build a local TXT importer and an accessible reader with a persistent playback bar.
3. Implement a speech adapter with a real Kokoro ONNX integration. A fake engine is allowed in unit tests only, not in the demonstration.
4. Build bounded passage generation and local caching keyed by document identity, source offsets, model, voice, and phonemizer version.
5. Connect real audio timestamps to text highlighting. If the model does not emit word timing, investigate forced alignment or use honest sentence-level highlighting.
6. Enable background playback and lock-screen controls, then verify on physical devices.
7. Benchmark at least one midrange Android phone and one iPhone.

### Known risks

- Expo development builds are necessary for ONNX native modules.
- Background **playback** does not guarantee background **synthesis**; generate a buffer ahead while the app is active.
- A word-alignment engine may be required separately from Kokoro inference.
- Model weights and voice assets require explicit license review before paid distribution.
- iOS and Android differ in model memory, CPU/GPU acceleration and background execution.
- Do not silently fall back to a paid cloud TTS API.

### Architecture and attribution

The reader renders source passages and follows the playback highlight. The narration controller sequences clips and keeps one passage in flight ahead of the current clip. The speech engine serializes inference, then hands a local WAV URI and duration to the controller. Expo Audio owns the native player and lock-screen session. SQLite stores imported text and the last passage plus media position.

[Readest](https://github.com/readest/readest/tree/a60b7eee0892f5533edbaca7d6391cd3609e4173/apps/readest-app/src/services/tts) was an architectural reference for separating the speech provider from playout, prefetching, and driving highlights from playback boundaries. The SonicPages implementation is independent of Readest's AGPL-3.0 code. Kokoro spike attribution is retained in `src/vendor/kokoro/LICENSE`. The model vocabulary comes from the [Kokoro 1.0 configuration](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/config.json). English pronunciation uses the [CMU pronunciation dictionary package](https://github.com/words/cmu-pronouncing-dictionary) with a basic unknown-word fallback.

### Verification

```sh
npm ci
npm run typecheck
npm test
npx expo export --platform android --output-dir /tmp/sonicpages-export
npm run android
```

Rebuild the development client after removing Expo AV. For a physical-device check, prepare the 93 MB model and voice on Wi-Fi, then play the built-in “Hello world.” passage. Confirm the next passage plays automatically, highlights advance with audio, pause and stop respond, and restarting restores a saved position. Import a multi-passage TXT and repeat in airplane mode after setup, including one uncached passage. Lock the screen during playback and check both lock-screen controls and the transition into the next passage. Record the `Kokoro waveform` lines, first-audio latency, any gaps, and whether stopping or importing during synthesis leaves playback responsive.

Desktop ONNX Runtime 1.24.3 with the v1.0 INT8 model, matching af_heart voice, and two CPU threads produced 24 kHz mono PCM with the app's token sequences:

| Passage | Inference | WAV duration | Peak | RMS |
| --- | ---: | ---: | ---: | ---: |
| Hello world. | 2.59 s | 1.625 s | 0.351 | 0.065 |
| This is a test. | 3.58 s | 1.750 s | 0.556 | 0.067 |
| SonicPages turns your documents into immersive listening experiences. | 10.24 s | 5.325 s | 0.628 | 0.067 |

On the same desktop, the v1.0 INT8 and Q8F16 variants both returned healthy waveforms for a fixed phoneme input. Two CPU threads were faster than four in a single INT8 comparison on this host. Native performance, audible output, and background playback need verification on the S22. If synthesis is slower than playback, the queue can wait between uncached passages. Passage highlighting follows player events. Word alignment needs a timing source.
