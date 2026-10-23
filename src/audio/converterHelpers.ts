export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PCM_BYTES = 128 * 1024 * 1024;
export type OutputFormat = 'wav' | 'mp3';
export function outputName(name: string, format: OutputFormat): string {
  const base = name.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'audio';
  return `${base}-convertido.${format}`;
}
export function validateFile(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('El archivo está vacío.');
  if (size > MAX_FILE_BYTES) throw new Error('El archivo supera el límite de 25 MiB.');
}
export function validateAudio(channels: number, length: number, rate: number, maxSeconds = 600): void {
  if (!Number.isInteger(channels) || channels < 1 || channels > 2) throw new Error('Solo se admite audio mono o estéreo; no se descartan canales.');
  if (!Number.isFinite(rate) || rate < 8000 || rate > 192000 || !Number.isSafeInteger(length) || length <= 0) throw new Error('El audio no contiene muestras válidas.');
  if (length / rate > maxSeconds || channels * length * 4 > MAX_PCM_BYTES) throw new Error(`El audio supera ${maxSeconds/60} minutos o 128 MiB de audio decodificado.`);
}

export const canceled = () => new DOMException('Operación cancelada o reemplazada.', 'AbortError');
// One active native decode plus one waiting request across the workspaces.
let decodeTail: Promise<void> = Promise.resolve();
let decodes = 0;
export async function decodeFile(file: File, context: BaseAudioContext, current = () => true, maxSeconds = 600): Promise<AudioBuffer> {
  validateFile(file.size);
  if (decodes >= 2) throw new Error('Hay audio procesándose. Espera antes de importar otro archivo.');
  decodes++;
  const previous = decodeTail;
  let release!: () => void;
  decodeTail = new Promise<void>(resolve => { release = resolve; });
  try {
    await previous;
    if (!current()) throw canceled();
    const data = await file.arrayBuffer();
    if (!current()) throw canceled();
    const buffer = await context.decodeAudioData(data);
    if (!current()) throw canceled();
    validateAudio(buffer.numberOfChannels, buffer.length, buffer.sampleRate, maxSeconds);
    return buffer;
  } finally { decodes--; release(); }
}
export function validateChannels(value: unknown, rate: number): Float32Array[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2 || !(value[0] instanceof Float32Array)) throw new Error('Canales no válidos.');
  validateAudio(value.length, value[0].length, rate);
  for (const channel of value) {
    if (!(channel instanceof Float32Array) || channel.length !== value[0].length || channel.some(x => !Number.isFinite(x))) throw new Error('Muestras o canales no válidos.');
  }
  return value;
}
