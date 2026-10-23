import { canceled, validateAudio, type OutputFormat } from './converterHelpers';
/** Termination cancels encoding; transferred copies leave originals intact. */
export function encodeInWorker(buffer: AudioBuffer, format: OutputFormat, bitrate = 320, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(canceled()); return; }
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: unknown, blob?: Blob) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); worker?.terminate();
      if (error) reject(error); else resolve(blob!);
    };
    const abort = () => finish(canceled());
    try {
      validateAudio(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      worker = new Worker(new URL('./converterWorker.ts', import.meta.url), {type: 'module'});
      signal?.addEventListener('abort', abort, {once: true});
      timer = setTimeout(() => finish(new Error('El codificador tardó demasiado. Prueba audio más corto.')), 120000);
      worker.onerror = () => finish(new Error('No se pudo ejecutar el codificador local.'));
      worker.onmessage = event => {
        const data = event.data;
        if (data?.blob instanceof Blob && !data.error) finish(undefined, data.blob);
        else finish(new Error(typeof data?.error === 'string' ? data.error : 'Respuesta del codificador no válida.'));
      };
      const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i).slice());
      worker.postMessage({channels, rate: buffer.sampleRate, format, bitrate}, channels.map(c => c.buffer));
    } catch (error) { finish(error); }
  });
}
