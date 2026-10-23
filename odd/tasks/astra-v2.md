# ASTRA V2
## Objective and authorized scope
Build a trustworthy local browser studio: reliability first, then multitrack editing, persistence, guided accessible UX, and open-source preparation. Preserve the independent converter. No remote operations, deployment, publishing, license selection, plugin reuse, or FL Studio code.
## Tasks and acceptance
- [x] V1 Reliability foundation: invalidate stale exports; immutable renders; deterministic reverb and shared sample-peak protection; robust recorder cleanup; honest measurement estimates. Regression tests, typecheck and build.
- [x] V2 Project model and multitrack clip editing: add/move/trim/split clips, track mix and undo/redo; shared preview/export arrangement scheduling tests.
- [x] V3 Local project persistence: save/reopen projects and audio safely; versioned validation and failure recovery tests.
- [x] V4 Accessible guided UI: simple workflow, keyboard controls, spectrum and level-matched A/B; browser accessibility and responsive checks.
- [x] V5 Verify and document complete workflow; prepare open-source documentation without choosing a license or publishing.
## Configuration and constraints
TDD unspecified: ordinary regression checks, not invented strict TDD. Runner: node --test tests/*.test.mjs; npx tsc --noEmit; npm run build. RDD off (default), confirmed read-only. Git worktree unavailable; work-unit commits unavailable, do not initialize. Forecast >400 authored lines for whole V2; delivery strategy ask-on-risk, no PR planned without user decision. Scope remains local.
## Progress and evidence
Created before source changes. Engram mirror pending: project detection ambiguous; do not guess project. Single delegated writer implemented V1–V4; parent owns independent final browser verification.
## Next step
Local V2 implementation and applicable final checks complete. Next: user tests the local editor. Publication, deployment, license selection and future enhancements remain outside scope.

## V1 observed outcomes
- Export invalidation is wired to Engine.onChange for load/remove and applyMix/applyAll (including sliders, presets, mute/solo and recording temporary state). RenderRevision rejects results after edits during render; failure/start clears previous download authority.
- Offline state is captured synchronously. Reverb noise is deterministic. Shared master WaveShaper replaces export-only post-processing; sample protection is not professional true-peak limiting and can saturate.
- Recorder serializes permission/recording/stopping, cleans microphone streams and restores vocal mute/solo; decode errors propagate to recorder feedback. Latency remains uncompensated and is disclosed.
- Loudness/peak labels are estimates, readiness uses -1 dB threshold without inconsistent -0.8 tolerance, and short non-silent audio is not described as silence.
- node --test tests/*.test.mjs: 12 passed, 0 failed (converter preserved, revision/reverb/protection/short audio/recorder failure regression checks).
- npx tsc --noEmit: exit 0. npm run build: exit 0, Vite 6.4.3.
- Pending independent browser tests: live/offline waveform parity, real microphone start/stop/error paths, download invalidation during an actual render, cross-browser support. No compliance certification claimed.
- No usable Git worktree; commit unavailable. No remote operations. Engram mirror pending because project remains ambiguous.
- Integration for V2 editor: invoke Engine.onChange after any arrangement/audio mutation; retain immutable snapshot and RenderRevision checks when replacing the two-track engine.

## V1 independent verification (parent report)
- Foundation verifier: 12/12 tests passed. Chromium interactions invalidated exports after load/remove/slider/preset/solo/mute. Delayed render discarded after edits.
- Repeated full offline mix renders: difference 0 across 116400 samples. Repeated master offline renders: difference 0. This is offline determinism, not live-device parity certification.
- Repeated recorder click during pending permission: one request. Injected recorder construction failure stopped stream and restored idle. Fake microphone take loaded. Hardware latency remains unverified.

## V2 observed outcomes
- Added independent version-1 Project/Track/Clip/Asset model, non-destructive source offset/duration/timeline position and fades; up to 8 tracks, 100 clips total, 3-minute source/arrangement and 128 MiB total registered PCM. Assets are immutable and shared by descriptor-only undo/redo (40 snapshots).
- Multiple-file import, track role/volume/mute/solo/delete, clip pointer move and exact numeric edits, split/duplicate/delete, common cursor/seek and render-based transport implemented. Every clip is selectable by explicit dropdown, including overlaps.
- One cached deterministic before/after pair drives playback and processed export. Snapshot project and asset registry once before await; edits invalidate render/output and cancel delayed playback intent. Worker WAV/MP3 192/320 uses the exact processed samples, output stereo 44.1 kHz.
- Regression proof: split continuity, trim bounds, schema/asset/ID/limit validation, bounded descriptor history, solo/mute resolution, render scheduling/fades, immutable pair snapshots, and valid decimal native form steps.

## V3 observed outcomes
- Schema-v1 IndexedDB single project slot stores project settings/descriptors plus deduplicated referenced PCM assets. Guarded startup offers restore instead of replacing current unsaved state. Existing saved data is not overwritten until explicit save/new/restore choice.
- Debounced autosave and manual save report transaction completion/failure honestly. Serial queue prevents older async writes winning, including after rejected transactions. Restore validates bounds, channels, rates, finite samples and references. New-project confirmation resets registry/history and local slot.
- Regression proof: dedup and copied snapshot PCM, malformed data rejection, delay/failure save ordering. Browser quota/eviction and refresh interaction verification pending final parent report.

## V4 observed outcomes
- Default Editor V2 beginner workspace with Spanish guidance, voice/song/master goals and deterministic clarity/ambience/level macros. Old advanced tools and converter remain separate; switching workspace cancels playback to avoid double audio.
- Before/after uses same arrangement and common safety; louder render is attenuated using estimated integrated loudness, never boosted. Unavailable matching is disclosed. Preview A/B attenuation is explicitly excluded from export. Active spectrum/sample-level canvas has textual description; numeric clip editing and overlapping-clip selector provide keyboard alternatives.
- Responsive navy/gold interface, visible focus, labels/status regions, accessible mute/solo names and confirmation dialogs. Formal assistive-technology/cross-browser audit still pending.

## V5 verification and preparation progress
- Final writer check: node --test tests/*.test.mjs, 24 passed/0 failed; npx tsc --noEmit exit 0; npm run build exit 0 (Vite 6.4.3).
- Independent verifier found native number-input step mismatch (min .001 with step .01). Fixed all cursor/clip numeric fields to step any and added regression check. Selected-clip dropdown resolves pointer occlusion for overlapping clips. Awaiting parent final browser rerun.
- README documents actual editor behavior, caps, memory overhead, local save limitations, separate legacy workspace/converter, sample-protection and measurement caveats. CONTRIBUTING.md prepares engineering guidance without authorizing distribution. LICENSE remains undecided; no public release, git init, commit, push or deploy.
- Source locator: src/editor/model.ts, storage.ts, render.ts, editor.ts; integration src/main.ts, src/ui/tabs.ts, index.html, src/styles.css; regressions tests/editor.test.mjs.
- Engram full-document mirror remains pending: both save and summary returned ambiguous_project; no project identity guessed.

## V5 final independent verification and local completion
- Independent verifier: no blockers, 24/24 Node tests passed. Parent spot-check: 24/24 tests and npx tsc --noEmit exit 0. Initial build encountered sandbox EPERM; explicitly escalated npm run build then passed (Vite 6.4.3).
- Final Chromium workflow: two-track import; split/duplicate/delete; undo/redo; exact numeric clip edits persisted at timeline start 2 s, source offset 0.25 s, duration 0.5 s, fades 0.1/0.2 s.
- Autosave/reload retained PCM length 96000 and track role, volume 61, clarity 64, and solo state. Existing saved project remained intact before an explicit replacement choice.
- Stopping during preparation canceled delayed playback; edits invalidated prepared output.
- Downloaded WAV verified as PCM16 stereo 44100 Hz, duration 4.2 s. MP3 variants verified at 44100 Hz stereo, duration 4.2318 s.
- Chromium reported no page errors; mobile width 375 px had no horizontal overflow. Parent inspected desktop/mobile screenshots. Foundation same-settings repeated offline rendering had difference 0; this does not establish physical-device playback parity.
- Skipped: cross-browser checks, physical-microphone latency testing, 128 MiB memory-stress testing, exhaustive assistive-technology/accessibility audit.
- Local authorized V1–V5 outcomes are complete. Future scope: owner license/publication decision, portable project files, direct editor recording and compensated recording latency. No deployment or cloud transfer; no usable Git repository or work-unit commits.
- Engram mirror remains pending due ambiguous project; no project identity guessed. Local document is the recovery record. Next action is local user testing, not deployment.
