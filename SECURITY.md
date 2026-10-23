# Security policy

## Scope and reporting

ASTRA STUDIO is a local browser audio tool, not a security-certified product. No response time, support period or vulnerability-free guarantee is promised. Test reports with synthetic audio and a disposable browser profile; never send real recordings, credentials, personal data or production access material.

If this repository's GitHub **Security** tab offers **Report a vulnerability**, use that private channel. Its availability is controlled by repository settings and is not enabled or promised by this file. Otherwise, ask a repository maintainer for a private reporting channel using their published contact options. If no private option is published, open an issue asking only for a private security contact, without exploit details, sensitive files or proof-of-concept payloads. Do not publish sensitive exploit details before coordinating with a maintainer.

A useful private report includes the affected version/commit, browser/OS versions, a minimal synthetic reproduction, expected/actual behavior and impact. Avoid uploading source audio or entire browser profiles.

## Current boundaries

- Audio processing and editor storage run in the browser. File/PCM/duration limits and worker validation reduce accidental exhaustion; they do not prove browser codecs safe, stop native allocation before decoding or provide process isolation.
- Local saved projects are not encrypted. People with access to the same browser profile, backups or downloaded exports may access that data. Editor deletion does not erase original files, exports, backups or independent advanced/converter sessions. Close other ASTRA tabs before erasing editor data.
- Versioned production headers are in `vercel.json`; a deployment must be checked to prove its actual response policy. Local production preview is not deployment evidence.
- CI is defined locally with read-only repository permissions, immutable official action SHAs, no deployment credentials and no automatic merge. Dependabot proposes weekly npm/action updates; maintainers review changes and tests. Publishing these files and enabling GitHub services are separate operations.
- `npm audit --omit=dev` and full `npm audit` are separate checks; build/development advisories are not hidden by a runtime-only result. Audit results reflect the registry at check time, not a guarantee about unknown vulnerabilities.
- Adding accounts, uploads, a backend, shared storage, analytics or network APIs requires a fresh threat/privacy review. This policy does not supply authentication, authorization, encryption-at-rest or production WAF protection.

## Maintenance references

Official pinned releases: [actions/checkout v4.2.2](https://github.com/actions/checkout/commit/11bd71901bbe5b1630ceea73d27597364c9af683), [actions/setup-node v4.4.0](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020). Pins were verified against the official release links, not copied from a fork. See [GitHub secure use guidance](https://docs.github.com/en/actions/reference/security/secure-use).
