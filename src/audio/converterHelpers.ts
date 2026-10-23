export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PCM_BYTES = 128 * 1024 * 1024;
export type OutputFormat = 'wav' | 'mp3';
export function outputName(name: string, format: OutputFormat): string {
  const base = name.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'audio';
  return `${base}-convertido.${format}`;
}
export function validateFile(size: number): void {
  if (size <= 0) throw new Error('El archivo está vacío.');
  if (size > MAX_FILE_BYTES) throw new Error('El archivo supera el límite de 25 MiB.');
}
export function validateAudio(channels: number, length: number, rate: number): void {
  if (channels < 1 || channels > 2) throw new Error('Solo se admite audio mono o estéreo; no se descartan canales.');
  if (!Number.isFinite(rate) || rate <= 0 || length <= 0) throw new Error('El audio no contiene muestras válidas.');
  if (length / rate > 600 || channels * length * 4 > MAX_PCM_BYTES) throw new Error('El audio supera 10 minutos o 128 MiB de audio decodificado.');
}
