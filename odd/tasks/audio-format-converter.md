# Audio format converter
## Objective and scope
Standalone Spanish local audio conversion in ASTRA STUDIO. Preserve existing mix/export; no deployment or external transfer.
## Acceptance
File picker and drop; browser decode; WAV PCM16 and MP3 bitrate; bounded resources, clear errors, no stale downloads; Spanish navy/gold UI.
## Configuration
No TDD mode configured; ordinary checks: node deterministic tests, npx tsc --noEmit, npm run build. RDD off (default). No Git repository: work-unit commits unavailable; do not initialize.
## Tasks
- [x] C1 Implement bounded local conversion and independent UI.
- [x] C2 Add deterministic tests and README, run checks.
## Evidence
Engram mirror pending: project detection ambiguous; no project guessed.
Forecast: approximately 300 authored lines. Delivery: ask-on-risk; no remote operations.
## Next
Feature complete locally. User can test the converter and separately authorize deployment. Broader producer feedback and FL Studio analysis were not performed.

## Verified outcomes
- C1: Independent Conversor tab; offline decode, worker WAV/MP3 encoding; reset and busy-state guards. Existing mix/export code unchanged.
- C2: node --test tests/converter.test.mjs: 6 passed, 0 failed (real WAV/MP3 encoding, mono/stereo, all bitrates).
- npx tsc --noEmit: passed (exit 0).
- npm run build: passed, Vite 6.4.3; worker bundled separately.
- Parent independent Chromium verification passed: synthetic WAV to MP3 (ffprobe: 44100 Hz, mono, 192 kbps); MPEG-extension MP3 to WAV (PCM16, 44100 Hz, mono); real local audio to WAV succeeded. No user audio included in the app or output bundle.
- Browser state checks passed: changing format invalidates output, removing file resets state, corrupt input rejected, busy controls disabled during observed worker encoding, no page errors, no overflow at 375 px.
- Parent spot check: node --test tests/converter.test.mjs, 6 passed.
- Native risk assessment unavailable because untracked inventory was undeclared; treated as high risk, independent review completed with no blockers. RDD remains off; no native approval claimed.
- Skipped: cross-browser compatibility checks and worker-crash injection.
- Work-unit commits unavailable because no Git repository; RDD off by default.
- Engram mirror still pending because project selection ambiguous.
