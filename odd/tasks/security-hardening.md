# Security hardening

## Intent and authorized scope
Harden local audio resource use, microphone lifecycle, editor data deletion, production browser policy and repository automation. Local changes and commits only; no push, deployment, credentials or remote settings. Advanced mixer/editor/converter remain independent.

## Configuration and checks
- TDD: unconfigured; ordinary regression checks, no invented RED evidence.
- Runner: `node --test tests/*.test.mjs`; also `npx tsc --noEmit` and `npm run build` per work unit.
- RDD: off (default), confirmed read-only; not enabled.
- Delivery: ask-on-risk; no PR requested. Forecast ~900 authored lines over three coherent units; delivery/PR slicing awaits explicit publication intent, no remote operation authorized.
- Engram mirror pending: project binding is ambiguous; no project guessed.

## Tasks
- [x] SH1 Bound imports/encodes and recorder lifecycle. Shared 25 MiB, mono/stereo/rate/PCM/duration checks before reads where possible and after decode; serialized decode/latest-load rejection; worker encoding cancellation; global microphone stop/status, bounded chunks/time, cleanup. Tests + typecheck + build; local commit.
- [x] SH2 Add confirmed editor saved+active data deletion with queue generation/drain; deployable versioned browser headers and same-origin worklet; document native cancellation/memory and storage limitations. Tests + typecheck + build; local commit.
- [x] SH3 Add least-privilege pinned CI, weekly dependency updates and security reporting policy. Validate config and real dependency audit evidence; tests + typecheck + build; local commit.

## Acceptance
Existing behavior/tests remain; malformed worker messages rejected; no synchronous advanced MP3; no stale source overwrite; microphone status independent of app tab and stops when document hidden/page abandoned; deletion cannot resurrect queued writes; CSP has no unsafe-inline/eval script permission. Production headers are only prepared, never claimed deployed.

## Progress and evidence
Branch: feature/security-hardening, base d7fccad. SH1 commit: 4be7c5decde0968f8b7b8457a9058a0ed495fe11. SH1: shared decoder and worker bounds, global bounded microphone lifecycle and cancellation implemented. Tests: 33/33 pass; npx tsc --noEmit pass; npm run build pass. Initial checks exposed UTF-8 read mismatch and test import mapping, repaired before final checks.

SH2 commit: f1fc2e8fa3f42df93264402bd336400200b6f1fa. SH2: queue generation/drain erasure, confirmed active+saved editor deletion, same-origin worklet, versioned headers and exact-header local preview implemented. Tests 35/35; tsc/build pass. Independent Chromium production browser checks passed.

SH3 commit: f9594bf4b765b7995530fc7ec3f610b93026678d. SH3: least-privilege pinned CI, npm/actions weekly Dependabot and SECURITY.md prepared locally; source UI request-token readback closed stale error labels. Action SHAs verified through official release/commit pages. Compatible non-forced dependency updates: Vite 6.4.3→6.4.5, nanoid 3.3.16→3.3.20, PostCSS 8.5.19→8.5.31, source-map-js 1.2.1→1.2.2. Initial full audit found 4 affected dev packages (3 high, 1 moderate); after updates runtime and full audits both report 0 at check time.

Final required checks: node --test tests/*.test.mjs 38/38; npm run typecheck pass; npm run build pass. Clean npm ci --ignore-scripts passed after an initial EPERM caused by an owned dev-server executable lock; intervening missing-dependency failures were repaired and all checks rerun. Dedicated YAML parser unavailable (Python yaml absent); CI structure/pins/security policy checked by executable regression tests, remote Actions execution not authorized/performed. Independent SH2 browser verification passed exact headers, worklet, workers, both converter outputs, editor A/B/download, pending autosave erasure and global fake-mic lifecycle. Final Chromium replay passed all three production browser suites against index-CachCoD5.js: exact CSP/headers, real worklet, worker exports, editor render/A-B/download, delayed autosave delete race and fake microphone global stop across sections. Parent independent production build passed Vite 6.4.5 with the same output hash. An additional exact npm ci attempt encountered a Rollup native module lock during overlapping verifier build; no process was terminated. Restored safely with npm install --ignore-scripts, then repeated npm test (38/38), typecheck, production build and both audits successfully; repository clean before this evidence-only update. No further install/build overlap planned.

## Next
Requested local hardening complete and verified; user may review the feature branch. No push, PR or deployment authorized. Engram mirror remains pending ambiguous project binding.
