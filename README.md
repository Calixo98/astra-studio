# ASTRA STUDIO V2

Local browser audio editor with a Spanish navy/gold interface. No backend, cloud audio upload or AI processing. V2 is the default workspace; the earlier voice/beat tools and format converter remain independent.

## V2 quick start

1. Open **Editor V2**, choose **Canción**, **Voz / podcast** or **Masterizar mezcla**.
2. Use **Añadir audio** (multiple files) or drop files onto that control. Each file becomes a track with one clip. Assign a track's **Tipo** to **Voz** for vocal treatment in song mode.
3. Select a timeline clip. Drag horizontally, or use exact numeric controls for timeline position, original-source start, duration and fades. **Dividir en cursor**, **Duplicar**, **Eliminar clip**, track volume/mute/solo, and **Deshacer/Rehacer** are non-destructive. The history retains up to 40 descriptor snapshots; original audio is shared separately.
4. Adjust **Claridad**, **Ambiente** and **Nivel**. Voice mode treats every track as voice; song mode treats only voice tracks. Master mode applies global tone/level and ignores vocal ambience. These are deterministic DSP macros, not AI or noise removal.
5. **Escuchar** prepares a cached before/after render. Pause, stop, set the common cursor in seconds, or use the space bar outside form controls. A/B preserves the same arrangement/timing and attenuates the louder version using estimated integrated loudness; unavailable estimates are disclosed. The before version retains faders, fades and common sample protection, so it is not an untouched raw source.
6. **Preparar mezcla** then **Descargar mezcla** exports processed WAV PCM16 or MP3 192/320 kbps via a worker. Output is stereo 44.1 kHz. The export uses the exact processed render, without the A/B listening attenuation. Edits invalidate cached renders and obsolete encoding results.

The spectrum and sample-level display describe the active preview, not certified analysis. The export's LUFS and interpolated peak estimates have not been validated for BS.1770 or true-peak compliance. Shared sample clipping protection can saturate and does not guarantee intersample peak ceilings. No platform certification is claimed.

### Limits and local storage

- Up to 8 tracks, 100 clips total, 3 minutes of arrangement/source length, 25 MiB per imported file and 128 MiB decoded PCM across the in-memory asset registry.
- Imported audio must be browser-decodable mono/stereo. Native decode can allocate memory before dimensions are checked. Cached A/B renders, undo-held assets, save snapshots and browser decoding require additional memory; low-memory devices may need smaller projects.
- Original assets stay immutable in memory, including assets referenced by undo. Start a new project to release the registry/history.
- Changes debounce to one local IndexedDB project slot. **Guardar local** saves explicitly; **Reabrir guardado** is offered on startup instead of silently replacing the current session. A prior saved project is not overwritten until an explicit save/new/restore decision. Save failures/quota errors are reported; no successful-save claim is made on failure. Writes are serialized and PCM is deduplicated by asset identity in snapshots.
- Browser storage is not a backup: it can be cleared or evicted and is scoped to the origin/browser profile. No cloud synchronization or portable project-file export is implemented. Keep your original source files. A debounced save still pending when the tab closes may be lost.

## Independent advanced tools

**Voz avanzada / Master / Mezcla / Exportar** keep the earlier two-track session, separate from the editor. They provide vocal EQ, clarity, de-esser, compressor, deterministic convolution reverb and stereo width; master EQ/maximizer; track faders/pan/mute/solo; live meters; offline WAV/MP3 output. Their controls do not change editor settings or clips. Playback is stopped when switching workspaces to avoid overlapping sessions.

Microphone recording remains in the advanced voice tool. Permission, recording and stopping states are guarded and streams are released on failure. Browser recording latency is not compensated: review alignment manually. Hardware microphone accuracy and cross-browser support require testing.

## Independent converter

The **Conversor** converts one browser-decodable file into WAV PCM16 or MP3 128/192/320 kbps, without effects, editor tracks or cloud transfer. It outputs 44.1 kHz mono/stereo, rejects multichannel audio, and invalidates downloads after relevant changes. Limits: 25 MiB input, 10 minutes and 128 MiB decoded PCM. Codec support depends on the browser; a `.mpeg` extension does not guarantee decodability. MP3 is lossy; MP3-to-WAV does not restore lost quality. Worker encoding prevents the long codec loop from running on the UI thread.

## Development and checks

```sh
npm install
npm run dev
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Vite prints the actual local URL/port. No deployment is part of this work. Existing dependencies are TypeScript, Vite and `@breezystack/lamejs`; no new dependency was added for V2.

Core modules: `src/editor/model.ts` (validated descriptors/history), `storage.ts` (versioned PCM/IndexedDB queue), `render.ts` (shared preview/export scheduling and matching), `editor.ts` (guided accessible DOM controls). Deterministic regressions cover editing, history, save serialization/order, arrangement scheduling, render snapshots, reverb/protection and the existing converter. They do not replace browser, hardware, assistive-technology or low-memory testing.

## Licencia y uso libre

El código original de ASTRA STUDIO está bajo la [licencia MIT](LICENSE). Puedes usarlo, copiarlo, modificarlo, distribuirlo, venderlo e incorporarlo en proyectos comerciales o propietarios, sin obligación de publicar tus cambios al código MIT. Conserva el aviso de copyright y la licencia en las copias o porciones sustanciales del software. Se entrega sin garantía, según el texto de la licencia.

Esto no cambia las licencias de terceros: el codificador MP3 `@breezystack/lamejs` 1.2.7 declara LGPL-3.0. Sus condiciones siguen aplicando al distribuirlo, también en forks cerrados. Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para atribuciones, textos completos, código fuente de la versión y reconstrucción con una biblioteca modificada. Los avisos y ese código fuente se incluyen en `dist/licenses/` al compilar; no se afirma una certificación legal de cumplimiento.

La licencia del programa no reclama tus grabaciones ni otorga derechos sobre canciones, muestras u otros contenidos de terceros. Debes contar con los derechos necesarios para el audio que utilices. Este cambio de licencia no despliega la aplicación ni publica paquetes npm (`private: true` evita publicaciones npm accidentales, no limita los permisos MIT).

## Ayuda contextual
Los botones `(i)` explican los controles en español sin modificar el audio. Se abren al pasar el puntero o enfocar con teclado; clic/toque fija la ayuda y otro clic la cierra. Escape, Cerrar ayuda, clic fuera o cambiar de pestaña cierran el panel. El texto se puede seleccionar y el panel admite foco y desplazamiento. Los botones están fuera de las etiquetas para no activar sus entradas. Contenido declarativo: `src/ui/helpContent.ts`; comportamiento: `src/ui/help.ts`. No incorpora dependencias ni cambia DSP. Los valores sugeridos son puntos de partida, no garantías de resultado.

## Local privacy and resource boundaries

- Inputs are limited to 25 MiB before reading, mono/stereo, 8–192 kHz and 128 MiB decoded PCM. Converter and advanced tracks allow up to 10 minutes; the editor allows 3 minutes and 128 MiB across retained original assets. The two advanced sources together are limited to 128 MiB. These workspace limits are not a total browser-memory quota: render buffers, undo descriptors, export copies, codec/browser allocations and independent workspaces add overhead.
- At most one native decode runs and one request waits across the workspaces. Latest advanced-track requests win; removed/replaced results are discarded. Native decode can allocate memory before post-decode checks. Treat untrusted audio as a browser codec input, not a sandbox proven safe by these limits.
- Cancel terminates encoder workers. Native `decodeAudioData` and `OfflineAudioContext.startRendering()` cannot be forcibly aborted here: cancellation discards their result, keeps the operation busy until native work settles and skips later render stages. Do not assume immediate native memory reclamation.
- Microphone capture requests 1-second chunks and stops at 3 minutes; collected chunks above 25 MiB are discarded. Browser scheduling may delay chunk/timer delivery, so this is not a hard native-process memory or real-time guarantee. A global banner/stop remains available when switching ASTRA sections. Hiding the browser document or leaving the page stops/discards capture; a pending permission grant is immediately released if canceled. Browser permissions remain user-controlled. Capture latency is not compensated.
- **Borrar mis datos locales del editor** asks for confirmation, waits for the current save, invalidates queued saves, clears ASTRA's editor project store and clears active editor audio/history. Canceling confirmation changes nothing; a storage failure preserves the active project. Autosave stays paused after erasure until **Guardar local**. Close other ASTRA tabs first: another tab can save its own active project again. Advanced mixer/converter sessions are independent and are not cleared. Original files, downloaded exports, browser-profile backups and OS copies are not deleted. Local IndexedDB is not encryption or isolation from people using the same browser profile.

## Production browser policy

`vercel.json` versions CSP, microphone-only Permissions Policy, nosniff, no-referrer and framing denial. Scripts/workers/worklet assets are same-origin, without `unsafe-eval` or `unsafe-inline` script permission. Inline styles remain allowed for existing dynamic timeline positions and controls. Blob media/download URLs are local outputs, not a remote upload permission. `connect-src 'self'` permits same-origin module fetching; the app has no backend authentication or remote processing.

This configuration is **prepared, not a claim about deployed response headers**. Development HMR is outside this production policy. To reproduce production locally: `npm run build`, then `npm run preview:security` (127.0.0.1:4173). This local-only preview sends the exact headers in `vercel.json`; verify worklet metering, worker conversions/downloads and absence of CSP violations. No HSTS preload/includeSubDomains assertion is made for shared hosting.

API behavior references: [MediaRecorder timeslices](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start), [offline rendering](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering), [Vercel security headers](https://vercel.com/docs/cdn-security/security-headers).
