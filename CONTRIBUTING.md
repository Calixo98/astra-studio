# Contributing

Original ASTRA STUDIO code is licensed under MIT (see `LICENSE`). By contributing code you have the right to contribute, you make that contribution available under the project MIT license. Preserve third-party licenses and attribution; do not relicense LGPL components as MIT. Do not publish private deployment metadata.

- Keep changes scoped; preserve the independent converter and advanced two-track workspace.
- Keep source audio out of fixtures and public bundles. Use generated synthetic test signals only.
- Editor snapshots contain descriptors, not cloned AudioBuffers. Keep source assets immutable; validate project and PCM bounds when restoring data.
- Preview and export must share the exact rendered samples. Label estimates and unsupported latency/compliance claims honestly.
- Run `node --test tests/*.test.mjs`, `npx tsc --noEmit`, and `npm run build`; report skipped browser/hardware checks.
- Do not introduce cloud transfers, telemetry, new dependencies, a change to the project license, deployment or publication without owner authorization.

Security contact and supported-browser policy remain maintainer decisions. See `THIRD_PARTY_NOTICES.md` for codec provenance, distributed notices and source/rebuild instructions.
