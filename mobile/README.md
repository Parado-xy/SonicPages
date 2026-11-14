# SonicPages Android beta

SonicPages imports TXT, EPUB, and PDF files from your device. Download a Kokoro
voice once or select an available offline Android voice. The app can then
generate and play narration locally, including with the screen locked.

[Download the beta ZIP](https://drive.google.com/file/d/17CYwdzrkGp1FfsFAzunAX7aw5lBR3boC/view?usp=drivesdk).

- The library supports search, covers, bookmarks, and per-document progress.
- Narration highlights the spoken sentence in reflowed text and on original
  PDF pages when the text can be mapped to the page.
- Scanned PDFs without selectable text can be viewed as original pages.
- The reader, Now Playing, and Android media controls share the playback session.

### Architecture and attribution

The reader renders source passages and follows the playback highlight. The narration controller sequences clips and prefetches up to three passages ahead of the current clip. The speech engine serializes inference, then hands a local WAV URI and duration to the controller. Expo Audio owns the native player and lock-screen session. SQLite stores imported text and the last passage plus media position.

[Readest](https://github.com/readest/readest/tree/a60b7eee0892f5533edbaca7d6391cd3609e4173/apps/readest-app/src/services/tts) was an architectural reference for separating the speech provider from playout, prefetching, and driving highlights from playback boundaries. The SonicPages implementation is independent of Readest's AGPL-3.0 code. Kokoro spike attribution is retained in `src/vendor/kokoro/LICENSE`. The model vocabulary comes from the [Kokoro 1.0 configuration](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/config.json). English pronunciation uses the [CMU pronunciation dictionary package](https://github.com/words/cmu-pronouncing-dictionary) with a basic unknown-word fallback.

### Verification

```sh
npm ci
npm run typecheck
npm test
npx expo export --platform android --output-dir /tmp/sonicpages-export
npm run android
```

For a physical-device check, download a voice on Wi-Fi, then import and play a short TXT document. Confirm the next passage plays automatically, highlights advance with audio, pause and stop respond, and restarting restores a saved position. Import a multi-passage TXT and repeat in airplane mode after setup, including one uncached passage. Lock the screen during playback and check both lock-screen controls and the transition into the next passage. Record the `Kokoro waveform` lines, first-audio latency, any gaps, and whether stopping or importing during synthesis leaves playback responsive.

Desktop ONNX Runtime 1.24.3 with the v1.0 INT8 model, matching af_heart voice, and two CPU threads produced 24 kHz mono PCM with the app's token sequences:

| Passage | Inference | WAV duration | Peak | RMS |
| --- | ---: | ---: | ---: | ---: |
| Hello world. | 2.59 s | 1.625 s | 0.351 | 0.065 |
| This is a test. | 3.58 s | 1.750 s | 0.556 | 0.067 |
| SonicPages turns your documents into immersive listening experiences. | 10.24 s | 5.325 s | 0.628 | 0.067 |

On the same desktop, the v1.0 INT8 and Q8F16 variants both returned healthy waveforms for a fixed phoneme input. Two CPU threads were faster than four in a single INT8 comparison on this host. Offline narration, background playback, and resume were verified on a Galaxy S22. Broader device coverage and battery measurements are pending. If synthesis is slower than playback, the queue can wait between uncached passages. Passage highlighting follows player events. Word alignment needs a timing source.

### Standalone Android acceptance test

Use the standalone APK artifact from Mobile checks or build the EAS preview profile from this directory:

```sh
npx eas-cli@latest build --platform android --profile preview
```

Keep Metro stopped. Install the APK using the same signing key as any existing installation if you want to keep its app data. On a clean test installation, start voice setup on Wi-Fi and check that progress is visible. Interrupt the connection, restore it, then retry setup. A partial download is retried from the beginning. A completed model download is reused if the voice download fails.

Save a new TXT to Downloads. Once setup finishes, force-stop SonicPages, turn on airplane mode with Wi-Fi off, and launch from the app icon. The app should load the saved voice automatically. Import the new TXT and listen through multiple passages. Record whether launch, setup recovery, fresh synthesis, and playback pass on the device.

### Long listening and resume acceptance test

On the standalone APK, import a fresh TXT with at least 30 minutes of narration. At normal speed, listen across passage boundaries with the app visible, in the background, and with the screen locked. Check for gaps and confirm that the highlight follows the audible passage when the reader is visible. Exercise lock-screen pause and play. During separate runs, receive a call and disconnect a Bluetooth headset. Check whether playback pauses and whether playback can continue from that point. While listening, force-stop the app, turn off Wi-Fi and mobile data, and relaunch. Tap Play and compare the restored passage and elapsed position with the point you heard before stopping.

### Offline document imports

Use **Import** to select TXT, EPUB, or a text-based PDF. EPUB follows the book's spine and extracts readable XHTML without loading external resources. Android PDF import extracts selectable text locally, in page order. Complex columns and tables may read out of order. Image-only PDFs are readable in Page view. Narration requires selectable text. Password-protected PDFs are rejected. The library stores extracted text and reading position per document.

### Android export and storage

In **Library**, open a document's **Options** to export the original file or a WAV containing generated passages in reading order. Imports from older builds can export their readable text as TXT. Reimport the original to make its source bytes available while retaining the matching document's position. Android opens a system picker so you can choose where to save each export.

The Library shows the space used by the offline voice and generated audio. **Clear generated audio** stops playback and removes the audio cache. Reopen or resume a document to regenerate narration offline. Original files, reader text, downloaded speech assets, and saved positions remain available.
