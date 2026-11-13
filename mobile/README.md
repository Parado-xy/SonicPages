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
- Document and synthesized audio files: device filesystem.
- Speech adapter: Kokoro ONNX runtime behind a typed interface.
- Playback: expo-audio, configured for background playback.
- Sync: intentionally **out of scope** for this spike. Google Drive will be optional later.
- Payments, sign-in, server database and cloud storage: **out of scope**.

### Development order

1. Create the Expo TypeScript app in this directory using the currently compatible Expo SDK.
2. Build a local TXT importer and an accessible reader with a persistent playback bar.
3. Implement a speech adapter with a real Kokoro ONNX integration. A fake engine is allowed in unit tests only, not in the demonstration.
4. Build chunk generation and local caching with stable content hashes.
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

### References

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo Audio: https://docs.expo.dev/versions/latest/sdk/audio/
- ONNX Runtime React Native: https://github.com/microsoft/onnxruntime/tree/main/js/react_native
- Kokoro model: https://huggingface.co/hexgrad/Kokoro-82M

### Status

Architecture and acceptance criteria established. Native app and on-device Kokoro inference **not yet implemented or tested**.
