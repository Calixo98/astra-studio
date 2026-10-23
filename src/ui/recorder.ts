import { state } from '../audio/state';
import type { Engine } from '../audio/engine';

type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopping';

export function initRecorder(engine: Engine, onRecorded: (file: File) => Promise<void>): void {
  const btn = document.getElementById('btn-rec') as HTMLButtonElement;
  const timeEl = document.getElementById('rec-time')!;
  const hintEl = document.getElementById('rec-hint')!;
  if (!btn) return;
  let phase: RecordingState = 'idle';
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let timer: number | undefined;
  let previous: { mute: boolean; solo: boolean } | null = null;
  const cleanup = () => {
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    window.clearInterval(timer);
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
    recorder = null;
    btn.disabled = false;
    btn.textContent = '● Grabar con micrófono';
    btn.classList.remove('recording');
    timeEl.hidden = true;
  };
  const fail = (err: unknown) => {
    console.warn('Recording failed', err);
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
    phase = 'requesting';
    btn.disabled = true;
    btn.textContent = 'Esperando permiso…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const current = new MediaRecorder(stream);
      recorder = current;
      const chunks: BlobPart[] = [];
      let failed = false;
      current.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      current.onerror = e => { failed = true; fail(e); };
      current.onstop = () => {
        if (failed) return;
        phase = 'stopping';
        btn.disabled = true;
        const type = current.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        cleanup();
        hintEl.textContent = 'Procesando la toma…';
        void (async () => {
          try {
            if (!blob.size) throw new Error('Empty recording');
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
      current.start();
      if (engine.tracks.beat.buffer) engine.play();
      phase = 'recording';
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
  btn.addEventListener('click', () => {
    if (phase === 'recording' && recorder) {
      phase = 'stopping';
      btn.disabled = true;
      try { recorder.stop(); } catch (err) { fail(err); }
    } else if (phase === 'idle') void start();
  });
  window.addEventListener('pagehide', cleanup);
}
