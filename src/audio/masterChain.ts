// Cadena master: EQ 5 bandas → maximizador (ganancia de entrada) →
// limitador con techo configurable (default −1 dB).

import { dbToGain, type MasterParams } from './state';

export const MASTER_BANDS = [
  { freq: 60, type: 'lowshelf' as BiquadFilterType, label: '60 Hz' },
  { freq: 250, type: 'peaking' as BiquadFilterType, label: '250 Hz' },
  { freq: 1000, type: 'peaking' as BiquadFilterType, label: '1 kHz' },
  { freq: 4000, type: 'peaking' as BiquadFilterType, label: '4 kHz' },
  { freq: 10000, type: 'highshelf' as BiquadFilterType, label: '10 kHz' },
];

const LIMITER_RATIO = 20;

export interface MasterChain {
  input: GainNode;
  output: GainNode;
  /** Limitador expuesto para leer la reducción de ganancia en la UI. */
  limiter: DynamicsCompressorNode;
  update(p: MasterParams): void;
}

export function createMasterChain(ctx: BaseAudioContext, p: MasterParams): MasterChain {
  const input = ctx.createGain();
  const output = ctx.createGain();

  const bands = MASTER_BANDS.map((b) => {
    const f = ctx.createBiquadFilter();
    f.type = b.type;
    f.frequency.value = b.freq;
    if (b.type === 'peaking') f.Q.value = 1;
    return f;
  });

  const maximizer = ctx.createGain();

  const limiter = ctx.createDynamicsCompressor();
  limiter.ratio.value = LIMITER_RATIO;
  limiter.knee.value = 0;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;

  // Compensa el makeup automático del DynamicsCompressorNode para que la
  // salida respete el techo configurado.
  const compensate = ctx.createGain();

  let node: AudioNode = input;
  for (const b of bands) {
    node.connect(b);
    node = b;
  }
  node.connect(maximizer);
  maximizer.connect(limiter);
  limiter.connect(compensate);
  // Shared sample clipping protection, not a professional true-peak limiter.
  const protection = ctx.createWaveShaper();
  protection.oversample = 'none';
  compensate.connect(protection);
  protection.connect(output);

  const chain: MasterChain = {
    input,
    output,
    limiter,
    update(p: MasterParams) {
      const ceiling = dbToGain(p.ceiling);
      const curve = new Float32Array(65537);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.max(-ceiling, Math.min(ceiling, i * 2 / (curve.length - 1) - 1));
      protection.curve = curve;
      bands.forEach((b, i) => (b.gain.value = p.eq[i]));
      maximizer.gain.value = dbToGain(p.maximizer);
      limiter.threshold.value = p.ceiling;
      compensate.gain.value = dbToGain(0.6 * p.ceiling * (1 - 1 / LIMITER_RATIO));
    },
  };
  chain.update(p);
  return chain;
}
