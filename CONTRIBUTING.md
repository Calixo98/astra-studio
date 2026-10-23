# Contributing preparation

This local project has not yet been published and its owner has not selected a license. Do not infer redistribution permission or publish deployment metadata.

- Keep changes scoped; preserve the independent converter and advanced two-track workspace.
- Keep source audio out of fixtures and public bundles. Use generated synthetic test signals only.
- Editor snapshots contain descriptors, not cloned AudioBuffers. Keep source assets immutable; validate project and PCM bounds when restoring data.
- Preview and export must share the exact rendered samples. Label estimates and unsupported latency/compliance claims honestly.
- Run `node --test tests/*.test.mjs`, `npx tsc --noEmit`, and `npm run build`; report skipped browser/hardware checks.
- Do not introduce cloud transfers, telemetry, new dependencies, a license, deployment or publication without owner authorization.

A public contribution process, security contact and supported-browser matrix remain owner decisions before release.
