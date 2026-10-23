import { outputName, validateAudio, validateFile, type OutputFormat } from '../audio/converterHelpers';
export function initConverter(): void {
  const panel = document.getElementById('tab-conversor')!;
  panel.innerHTML = `<div class="panel converter"><h2>Conversor de audio</h2>
    <p>Convierte un archivo, sin cargar voz ni base. Procesamiento local: el original no se modifica.</p>
    <div id="converter-drop" class="converter-drop"><label for="converter-file">Seleccionar audio o arrastrarlo aquí</label>
    <input id="converter-file" type="file" accept="audio/*,.mp3,.wav,.mpeg,.mpg,.ogg,.m4a,.flac"></div>
    <p>MP3, WAV y audio MPEG; OGG, M4A o FLAC si tu navegador los decodifica. No todo MPEG contiene audio compatible.</p>
    <p>Límite: 25 MiB por archivo, 10 minutos, mono/estéreo y 128 MiB decodificados. Salida a 44 100 Hz (remuestreo si hace falta).</p>
    <p id="converter-info">Ningún archivo seleccionado.</p>
    <div class="converter-options"><label>Formato <select id="converter-format"><option value="mp3">MP3</option><option value="wav">WAV PCM de 16 bits</option></select></label>
    <label>Calidad MP3 <select id="converter-bitrate"><option value="128">128 kbps</option><option value="192" selected>192 kbps</option><option value="320">320 kbps</option></select></label></div>
    <p>MP3 siempre se recodifica con pérdida, incluso si el original es MP3. Pasar de MP3 a WAV no recupera calidad perdida. No se aplican efectos ni masterización.</p>
    <div class="converter-options"><button id="converter-clear">Quitar archivo</button><button id="converter-run" class="btn-gold">Convertir</button><a id="converter-download" class="btn-gold" hidden>Descargar archivo</a></div>
    <p id="converter-status" role="status" aria-live="polite">Selecciona un archivo para empezar.</p></div>`;
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const input = get<HTMLInputElement>('converter-file');
  const format = get<HTMLSelectElement>('converter-format');
  const bitrate = get<HTMLSelectElement>('converter-bitrate');
  const clear = get<HTMLButtonElement>('converter-clear');
  const run = get<HTMLButtonElement>('converter-run');
  const download = get<HTMLAnchorElement>('converter-download');
  const info = get<HTMLElement>('converter-info');
  const status = get<HTMLElement>('converter-status');
  const drop = get<HTMLElement>('converter-drop');
  let buffer: AudioBuffer | null = null;
  let filename = '';
  let busy = false;
  let url = '';
  function resetOutput() {
    download.hidden = true;
    download.removeAttribute('href');
    if (url) URL.revokeObjectURL(url);
    url = '';
  }
  function availability(value: boolean) {
    busy = value;
    input.disabled = format.disabled = clear.disabled = value;
    bitrate.disabled = value || format.value !== 'mp3';
    run.disabled = value || !buffer;
    panel.setAttribute('aria-busy', String(value));
  }
  async function load(file: File) {
    if (busy) return;
    resetOutput(); buffer = null; filename = ''; info.textContent = 'Ningún archivo seleccionado.';
    availability(true); status.textContent = 'Decodificando audio…';
    try {
      validateFile(file.size);
      // Offline context cannot play to speakers; conversion stays separate from the mixer.
      const context = new OfflineAudioContext(2, 1, 44100);
      let decoded: AudioBuffer;
      try { decoded = await context.decodeAudioData(await file.arrayBuffer()); }
      catch { throw new Error('No se pudo decodificar. El archivo puede estar dañado, no contener audio o usar un códec no compatible con este navegador.'); }
      validateAudio(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
      buffer = decoded; filename = file.name;
      info.textContent = `${filename} · ${(file.size / 1048576).toFixed(2)} MiB · ${decoded.duration.toFixed(2)} s · ${decoded.sampleRate} Hz (decodificado) · ${decoded.numberOfChannels} canal(es)`;
      status.textContent = 'Listo para convertir.';
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'No se pudo cargar el archivo.'; }
    finally { input.value = ''; availability(false); }
  }
  input.addEventListener('change', () => { if (input.files?.[0]) void load(input.files[0]); });
  drop.addEventListener('dragover', event => { event.preventDefault(); });
  drop.addEventListener('drop', event => {
    event.preventDefault();
    if (busy) return;
    if (event.dataTransfer?.files.length !== 1) { status.textContent = 'Arrastra un solo archivo de audio.'; return; }
    void load(event.dataTransfer.files[0]);
  });
  clear.addEventListener('click', () => { resetOutput(); buffer = null; filename = ''; input.value = ''; info.textContent = 'Ningún archivo seleccionado.'; status.textContent = 'Selecciona un archivo para empezar.'; availability(false); });
  for (const control of [format, bitrate]) control.addEventListener('change', () => { resetOutput(); status.textContent = buffer ? 'Ajustes cambiados. Convierte de nuevo.' : 'Selecciona un archivo.'; availability(false); });
  run.addEventListener('click', () => {
    if (!buffer || busy) return;
    resetOutput(); availability(true); status.textContent = 'Convirtiendo… Puedes seguir usando las otras pestañas.';
    let worker: Worker | undefined;
    const finish = (message: string) => { worker?.terminate(); status.textContent = message; availability(false); };
    try {
      worker = new Worker(new URL('../audio/converterWorker.ts', import.meta.url), {type: 'module'});
      worker.onerror = () => finish('No se pudo ejecutar el codificador local. Intenta con un archivo más corto.');
      worker.onmessage = (event: MessageEvent<{blob?: Blob; error?: string}>) => {
        if (event.data.error || !event.data.blob) { finish(event.data.error || 'No se generó el archivo.'); return; }
        url = URL.createObjectURL(event.data.blob);
        download.href = url; download.download = outputName(filename, format.value as OutputFormat); download.hidden = false;
        finish(`Conversión terminada: ${(event.data.blob.size / 1048576).toFixed(2)} MiB. Descarga tu archivo.`);
      };
      const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer!.getChannelData(i).slice());
      worker.postMessage({channels, rate: buffer.sampleRate, format: format.value, bitrate: Number(bitrate.value)}, channels.map(c => c.buffer));
    } catch { finish('No se pudo iniciar la conversión. Intenta con un archivo más corto.'); }
  });
  availability(false);
}
