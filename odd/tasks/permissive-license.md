# Permissive licensing

## Objective and authorization
License original ASTRA code under standard MIT, permitting commercial and proprietary forks; preserve third-party obligations. Local changes only; no push or deployment.

## Constraints and checks
No audio behavior or dependency changes. Recordings/samples remain with their rightsholders. TDD mode is not explicitly configured; ordinary functional checks apply: `node --test tests/*.test.mjs`, `npx tsc --noEmit`, `npm run build`. RDD off. Parent owns work-unit commit after review. Forecast: about 150 authored lines excluding verbatim license texts and upstream source archive; delivery strategy ask-on-risk.

## Tasks
- [x] L1 Verify installed codec license/provenance and exact source availability.
- [x] L2 Add MIT metadata/docs and preserve distributed third-party notices/source.
- [x] L3 Run checks and inspect built notices; report limitations.

## Progress
Engram project resolution is ambiguous; full mirror pending explicit project selection. No session identity invented. Commit evidence pending parent handoff. Next: parent inspection and authorized commit/push.

## Verification evidence
- Registry gitHead verified by GitHub tree; local source archive includes src and build configuration, omits test audio and PNG documentation images.
- Source archive SHA256: 5EE71527CFB5D2E7B9716581EB81D63CF28868EF84C3435A3D1FBB5F66AA32C1.
- node --test tests/*.test.mjs: 29 passed, 0 failed.
- npx tsc --noEmit: passed (exit 0).
- npm run build: passed (exit 0).
- Six dist/licenses files byte-match public originals; no audio fixtures in source archive.
- Browser/hardware tests and modified-library/reproducible rebuild not performed; no legal compliance certification.
- Source archive provenance tied to registry metadata, not a proven reproducible binary build.


## Final local verification
Independent verification passed all 29 tests and confirmed root/public/dist license text equality. Archive paths, source version and build configuration were checked; no audio or PNG fixtures are included. Parent spot-check passed both licensing tests and git diff --check. Upstream archive byte comparison, a modified-library/reproducible rebuild and legal compliance certification were not performed. Local implementation and verification are complete. Publication remains pending the parent's explicitly authorized commit/push; no deployment is authorized.
