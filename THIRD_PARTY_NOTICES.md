# Third-party notices

The MIT license in `LICENSE` applies to original ASTRA STUDIO code, not to third-party components or users' recordings. The MP3 encoder is LGPL software and is not relicensed under MIT. Commercial/proprietary forks of ASTRA must still satisfy the applicable third-party terms when distributing this encoder/combined work.

## @breezystack/lamejs 1.2.7

- Installed package metadata: `LGPL-3.0` (legacy identifier); the full LGPL version 3 and incorporated GPL version 3 terms are supplied in `lamejs-LGPL-3.0.txt` and `GPL-3.0.txt`.
- Author credited by the package: Alex Zhukov; original project: https://github.com/zhuker/lamejs . LAME: https://lame.sourceforge.net/ . Preserve upstream copyright/attribution comments in the source.
- Package repository: https://github.com/shijinyu/lamejs (redirects to https://github.com/gideonstele/lamejs).
- Registry metadata `gitHead`: `1fb0ef5fa177413107e2e107d054a9b994e3f79c`.
- Published package: https://registry.npmjs.org/@breezystack/lamejs/-/lamejs-1.2.7.tgz
- Lockfile integrity: `sha512-6wc7ck65ctA75Hq7FYHTtTvGnYs6msgdxiSUICQ+A01nVOWg6rqouZB8IdyteRlfpYYiFovkf67dIeOgWIUzTA==`.
- Upstream source for that registry revision: https://github.com/gideonstele/lamejs/tree/1fb0ef5fa177413107e2e107d054a9b994e3f79c . Archive: https://codeload.github.com/gideonstele/lamejs/tar.gz/1fb0ef5fa177413107e2e107d054a9b994e3f79c .
- A local source archive is distributed at `licenses/lamejs-1.2.7-source.tar.gz` (repository path `public/licenses/lamejs-1.2.7-source.tar.gz`). It preserves the revision's source/build configuration, omitting upstream `testdata` audio and PNG documentation images; these are not required by the package build. This is a repacked source archive, not the original upstream archive.
- The installed package's `LICENSE` is an upstream FAQ, not the full LGPL text. It is preserved verbatim as `lamejs-upstream-license-notice.txt`; its wording does not replace the actual license terms.

ASTRA does not modify the encoder source. Vite bundles it into an MP3 worker. Notices alone are not a certification of redistribution compliance; distributors must assess their actual distribution, corresponding-source and recombination obligations under LGPL section 4/GPL section 6. A byte-for-byte reproducible build of the published encoder from the registry revision has not been established here.

## Source and replacement/recombination

Obtain ASTRA's source, including `package.json`, `package-lock.json`, `src/`, `index.html`, `tsconfig.json` and `vite.config.ts`, alongside your distributed version. Retain its source/build instructions with redistributed builds, rather than supplying only `dist/`. The MIT terms permit modifying/rebuilding the application. Nothing in ASTRA's license restricts modification of the LGPL library or reverse engineering to debug those modifications.

1. Run `npm ci` in the ASTRA source checkout (Node.js/npm required).
2. Extract `licenses/lamejs-1.2.7-source.tar.gz` from a distributed build, or `public/licenses/lamejs-1.2.7-source.tar.gz` from this checkout, into a separate directory. Consult its package scripts/build configuration; install its build dependencies and run `npm run build` there after modifying its source. Upstream includes `pnpm-lock.yaml` for its dependency versions. Do not use the omitted audio-dependent upstream tests as a build requirement.
3. Replace `node_modules/@breezystack/lamejs/dist/` with the rebuilt encoder's `dist/`, retaining the compatible exports/interface. This local replacement is intentional; do not run `npm ci` again before the next step because it restores the published dependency. Alternatively maintain a local package replacement and matching lockfile in your fork.
4. Run `npm run build` in ASTRA; serve the resulting `dist/` with any static web server. The MP3 worker is rebuilt with your modified library. Run ASTRA's test/type checks and test MP3 exports in the browser.

Replacement instructions are supplied; a modified-library rebuild has not been executed in this change. No claim of complete legal compliance or reproducibility is made.

## Distributed license files

`public/licenses/` is copied unchanged to `dist/licenses/` by Vite: ASTRA's MIT `LICENSE`, these notices, both GNU license texts, the upstream FAQ and the source archive. Original copies of the text licenses are also in repository `licenses/`. Full license texts come from the SPDX license-list-data project:

- https://raw.githubusercontent.com/spdx/license-list-data/main/text/MIT.txt
- https://raw.githubusercontent.com/spdx/license-list-data/main/text/LGPL-3.0-only.txt
- https://raw.githubusercontent.com/spdx/license-list-data/main/text/GPL-3.0-only.txt

Development-only dependencies retain their own licenses in their packages. This notice identifies the runtime dependency currently declared by ASTRA; it is not a blanket relicensing of every tool or future dependency.
