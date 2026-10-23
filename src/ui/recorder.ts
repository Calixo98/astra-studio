import { state } from '../audio/state';
import type { Engine } from '../audio/engine';

export const MAX_RECORDING_MS = 180000;
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopping';

export function initRecorder(engine: Engine, onRecorded: (file: File) => Promise<void>): void {
  const btn = document.getElementById('btn-rec') as HTMLButtonElement;
  const timeEl = document.getElementById('rec-time')!;
  const hintEl = document.getElementById('rec-hint')!;
  if (!btn) return;
  const globalPanel = document.getElementById('global-recording');
  const globalStatus = document.getElementById('global-recording-status');
  const globalStop = document.getElementById('global-recording-stop') as HTMLButtonElement | null;
  const show = (message: string, active = true) => {
    if (globalPanel) globalPanel.hidden = !active;
    if (globalStatus) globalStatus.textContent = message;
  };
  let phase: RecordingState = 'idle';
  let abandoned = false;
  let deadline: number | undefined;
  let stopWatchdog: number | undefined;

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: number | undefined;
  let previous: { mute: boolean; solo: boolean } | null = null;
  const cleanup = () => {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    window.clearInterval(timer);
    window.clearTimeout?.(deadline);
    window.clearTimeout?.(stopWatchdog);
    engine.stop();
    if (previous) {
      state.vocalMix.mute = previous.mute;
      state.vocalMix.solo = previous.solo;
      previous = null;
      engine.applyMix();
    }
  };
  const idle = () => {
    phase = 'idle';
    show('', false);
    recorder = null;
    btn.disabled = false;
    btn.textContent = '● Grabar con micrófono';
    btn.classList.remove('recording');
    timeEl.hidden = true;
  };
  const fail = (err: unknown) => {

    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      if (recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* already stopped */ } }
    }
    cleanup();
    idle();
    hintEl.textContent = 'No se pudo completar la toma. Revisa permisos y compatibilidad del navegador.';
  };
  async function start(): Promise<void> {
    if (phase !== 'idle') return;
    phase = 'requesting'; abandoned = false;
    show('Esperando permiso del micrófono…');
    btn.disabled = true;
    btn.textContent = 'Esperando permiso…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if(abandoned || document.hidden) { cleanup(); idle(); return; }
      const current = new MediaRecorder(stream);
      recorder = current;
      const chunks: BlobPart[] = [];
      let failed = false, bytes = 0;
      current.ondataavailable = e => {
        if (abandoned || failed) return;
        bytes += e.data.size;
        if(bytes > MAX_RECORDING_BYTES) { failed = true; fail(new Error('Límite de grabación')); hintEl.textContent='Toma descartada: supera 25 MiB. Graba una toma más corta.'; return; }
        if (e.data.size > 0) chunks.push(e.data);
      };
      current.onerror = e => { failed = true; fail(e); };
      current.onstop = () => {
        if (failed) return;
        if(abandoned) { cleanup(); idle(); return; }
        phase = 'stopping'; show('Procesando toma; micrófono detenido.');
        btn.disabled = true;
        const type = current.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        cleanup();
        hintEl.textContent = 'Procesando la toma…';
        void (async () => {
          try {
            if (!blob.size) throw new Error('Empty recording');
            if(abandoned)return;
            await onRecorded(new File([blob], 'toma-microfono.webm', { type }));
            hintEl.textContent = 'Toma cargada. La latencia del navegador no está compensada: revisa la alineación con el beat.';
          } catch (err) { fail(err); }
          finally { idle(); }
        })();
      };
      engine.stop();
      previous = { mute: state.vocalMix.mute, solo: state.vocalMix.solo };
      state.vocalMix.mute = true;
      state.vocalMix.solo = false; // Existing solo vocal must not suppress the backing beat.
      engine.applyMix();
      await engine.ctx.resume();
      if(abandoned || document.hidden) { cleanup(); idle(); return; }
      current.start(1000);
      if (engine.tracks.beat.buffer) engine.play();
      phase = 'recording'; show('● Micrófono grabando · máximo 3 minutos / 25 MiB');
      deadline = window.setTimeout(() => stopCapture(), MAX_RECORDING_MS);
      btn.disabled = false;
      btn.textContent = '■ Detener grabación';
      btn.classList.add('recording');
      timeEl.hidden = false;
      const startedAt = performance.now();
      hintEl.textContent = 'Grabando… usa audífonos. Latencia no compensada; revisa la alineación al terminar.';
      timer = window.setInterval(() => {
        const s = Math.floor((performance.now() - startedAt) / 1000);
        timeEl.textContent = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
      }, 250);
    } catch (err) { fail(err); }
  }
  function stopCapture(): void {
    if (phase !== 'recording' || !recorder) return;
    phase = 'stopping'; btn.disabled = true; show('Deteniendo micrófono…');
    try {
      recorder.stop();
      stream?.getTracks().forEach(track => track.stop()); stream = null;
      stopWatchdog = window.setTimeout(() => { if(phase==='stopping')fail(new Error('Stop timeout')); }, 5000);
    } catch (err) { fail(err); }
  }
  function abandon(): void {
    abandoned = true;
    if(phase==='recording')stopCapture();
    cleanup();
    if(phase==='requesting')show('Solicitud cancelada. Si concedes permiso, se liberará sin grabar.');
    hintEl.textContent='Toma cancelada. El micrófono se detiene al ocultar o abandonar esta página.';
  }
  btn.addEventListener('click', () => {
    if (phase === 'recording') stopCapture();
    else if (phase === 'idle') void start();
  });
  globalStop?.addEventListener('click', () => {
    if(phase==='recording')stopCapture();else abandon();
  });
  document.addEventListener?.('visibilitychange', () => { if(document.hidden && phase!=='idle')abandon(); });
  window.addEventListener('pagehide', abandon);
}
