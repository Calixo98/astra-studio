// Exportación: reconstruye el grafo completo en un OfflineAudioContext con
// los parámetros actuales, renderiza, mide LUFS/pico y codifica WAV o MP3.

import { Mp3Encoder } from '@breezystack/lamejs';
import { state, faderToGain, effectiveMuteGains } from './state';
import { reverbSeconds } from './reverb';
import { createVocalChain } from './vocalChain';
import { createMasterChain } from './masterChain';
import { measureLoudness } from './lufs';
import { encodeWav, floatToInt16 } from './wavEncoder';
import type { Engine } from './engine';

export interface ExportAnalysis {
  integrated: number;
  truePeak: number;
  ready: boolean;
  message: string;
  suggestion: string;
}

const TARGET_LUFS = -14; // normalización de Spotify y YouTube

export async function renderMix(engine: Engine): Promise<AudioBuffer> {
  const snapshot = structuredClone(state);
  const vocalBuf = engine.tracks.vocal.buffer;
  const beatBuf = engine.tracks.beat.buffer;
  const baseDur = Math.max(vocalBuf?.duration ?? 0, beatBuf?.duration ?? 0);
  if (baseDur <= 0) throw new Error('No hay pistas cargadas');

  const sr = engine.ctx.sampleRate;
  const tail = vocalBuf ? reverbSeconds(snapshot.vocal.reverbSize) + 0.2 : 0.2;
  const ctx = new OfflineAudioContext(2, Math.ceil((baseDur + tail) * sr), sr);

  const master = createMasterChain(ctx, snapshot.master);
  master.output.connect(ctx.destination);

  const mutes = effectiveMuteGains(snapshot.vocalMix, snapshot.beatMix);

  const wireTrack = (
    buffer: AudioBuffer,
    processed: { input: AudioNode; output: AudioNode } | null,
    volume: number,
    pan: number,
    muteGain: number,
  ) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const fader = ctx.createGain();
    fader.gain.value = faderToGain(volume) * muteGain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan / 100;
    if (processed) {
      src.connect(processed.input);
      processed.output.connect(fader);
    } else {
      src.connect(fader);
    }
    fader.connect(panner);
    panner.connect(master.input);
    src.start(0);
  };

  if (vocalBuf) {
    const chain = createVocalChain(ctx, snapshot.vocal);
    wireTrack(vocalBuf, chain, snapshot.vocalMix.volume, snapshot.vocalMix.pan, mutes.vocal);
  }
  if (beatBuf) {
    wireTrack(beatBuf, null, snapshot.beatMix.volume, snapshot.beatMix.pan, mutes.beat);
  }

  const rendered = await ctx.startRendering();
  return rendered;
}

export function analyzeBuffer(buffer: AudioBuffer): ExportAnalysis {
  const { integrated, truePeak } = measureLoudness(buffer);
  if (!isFinite(integrated)) {
    const hasSignal = Array.from({length: buffer.numberOfChannels}, (_, ch) => buffer.getChannelData(ch).some(x => x !== 0)).some(Boolean);
    return {
      integrated,
      truePeak,
      ready: false,
      message: hasSignal ? 'Señal demasiado corta o baja para estimar LUFS' : 'La mezcla está en silencio',
      suggestion: 'Revisa que las pistas no estén muteadas y que los faders estén arriba.',
    };
  }
  const lufsOk = integrated >= -15 && integrated <= -13;
  // Tolerancia para picos inter-sample estimados sobre material ya recortado al techo
  const peakOk = truePeak <= -1;
  const ready = lufsOk && peakOk;

  let suggestion = '';
  if (!lufsOk) {
    const diff = TARGET_LUFS - integrated;
    suggestion =
      diff > 0
        ? `Sube el maximizador aproximadamente +${diff.toFixed(1)} dB para llegar a −14 LUFS.`
        : `Baja el maximizador aproximadamente ${diff.toFixed(1)} dB para llegar a −14 LUFS.`;
  } else if (!peakOk) {
    suggestion = 'El pico supera −1 dBTP: baja el techo del limitador o reduce el maximizador.';
  } else {
    suggestion = 'Referencia orientativa: −14 LUFS ±1 y pico estimado ≤ −1 dB. No es una certificación de plataformas.';
  }

  return {
    integrated,
    truePeak,
    ready,
    message: ready ? 'Dentro de la referencia estimada' : 'Necesita ajuste',
    suggestion,
  };
}

export function encodeMp3(buffer: AudioBuffer, kbps = 320): Blob {
  const nCh = Math.min(buffer.numberOfChannels, 2);
  const left = floatToInt16(buffer.getChannelData(0));
  const right = nCh > 1 ? floatToInt16(buffer.getChannelData(1)) : left;
  const encoder = new Mp3Encoder(2, buffer.sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  const blockSize = 1152;
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right.subarray(i, i + blockSize);
    const mp3 = encoder.encodeBuffer(l, r);
    if (mp3.length > 0) chunks.push(new Uint8Array(mp3));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));
  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

export function encodeWavExport(buffer: AudioBuffer): Blob {
  return encodeWav(buffer);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
