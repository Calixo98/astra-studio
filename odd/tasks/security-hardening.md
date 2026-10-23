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
- [ ] SH2 Add confirmed editor saved+active data deletion with queue generation/drain; deployable versioned browser headers and same-origin worklet; document native cancellation/memory and storage limitations. Tests + typecheck + build; local commit.
- [ ] SH3 Add least-privilege pinned CI, weekly dependency updates and security reporting policy. Validate config and real dependency audit evidence; tests + typecheck + build; local commit.

## Acceptance
Existing behavior/tests remain; malformed worker messages rejected; no synchronous advanced MP3; no stale source overwrite; microphone status independent of app tab and stops when document hidden/page abandoned; deletion cannot resurrect queued writes; CSP has no unsafe-inline/eval script permission. Production headers are only prepared, never claimed deployed.

## Progress and evidence
Branch: feature/security-hardening, base d7fccad. SH1: shared decoder and worker bounds, global bounded microphone lifecycle and cancellation implemented. Tests: 33/33 pass; npx tsc --noEmit pass; npm run build pass. Initial checks exposed UTF-8 read mismatch and test import mapping, repaired before final checks.

## Next
Implement SH1, then SH2 and SH3; parent independently checks production browser flows.
