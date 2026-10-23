import { Mp3Encoder } from '@breezystack/lamejs';
import { encodeWav, floatToInt16 } from './wavEncoder';
import { validateAudio, type OutputFormat } from './converterHelpers';
self.onmessage = (event: MessageEvent<{channels: Float32Array[]; rate: number; format: OutputFormat; bitrate: number}>) => {
  try {
    const { channels, rate, format, bitrate } = event.data;
    validateAudio(channels.length, channels[0].length, rate);
    if (format !== 'wav' && format !== 'mp3') throw new Error('Formato de salida no válido.');
    if (![128, 192, 320].includes(bitrate)) throw new Error('Tasa MP3 no válida.');
    let blob: Blob;
    if (format === 'wav') {
      // The existing encoder only needs these AudioBuffer fields; no audio graph.
      blob = encodeWav({numberOfChannels: channels.length, sampleRate: rate, length: channels[0].length, getChannelData: (i: number) => channels[i]} as AudioBuffer);
    } else {
      const encoder = new Mp3Encoder(channels.length, rate, bitrate);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < channels[0].length; i += 1152) {
        const left = floatToInt16(channels[0].subarray(i, i + 1152));
        const right = channels.length > 1 ? floatToInt16(channels[1].subarray(i, i + 1152)) : undefined;
        const chunk = encoder.encodeBuffer(left, right);
        if (chunk.length) chunks.push(new Uint8Array(chunk));
      }
      const tail = encoder.flush();
      if (tail.length) chunks.push(new Uint8Array(tail));
      blob = new Blob(chunks as BlobPart[], {type: 'audio/mpeg'});
    }
    self.postMessage({blob});
  } catch (error) {
    self.postMessage({error: error instanceof Error ? error.message : 'No se pudo codificar el audio.'});
  }
};
