// Cadena de procesamiento vocal completa:
// input → claridad (HPF + presencia) → EQ 3 bandas → de-esser → compresor
//       → reverb (wet/dry) → amplitud estéreo → output

import type { VocalParams } from './state';
import { createDeesser, type DeesserUnit } from './deesser';
import { createReverb, type ReverbUnit } from './reverb';
import { createStereoWidth, type StereoWidthUnit } from './stereoWidth';

export interface VocalChain {
  input: GainNode;
  output: GainNode;
  reverb: ReverbUnit;
  /** Compresor expuesto para leer la reducción de ganancia en la UI. */
  comp: DynamicsCompressorNode;
  update(p: VocalParams): void;
}

export function createVocalChain(ctx: BaseAudioContext, p: VocalParams): VocalChain {
  const input = ctx.createGain();
  const output = ctx.createGain();

  // Claridad: filtro paso-altos + realce de presencia en 3.5 kHz
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.Q.value = Math.SQRT1_2;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3500;
  presence.Q.value = 0.9;

  // EQ de 3 bandas
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 120;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1500;
  eqMid.Q.value = 1;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 8000;

  const deesser: DeesserUnit = createDeesser(ctx, p.deesser);

  const comp = ctx.createDynamicsCompressor();
  comp.ratio.value = 4;
  comp.knee.value = 8;

  const reverb: ReverbUnit = createReverb(ctx, p.reverbSize, p.reverbDecay, p.reverbMix);
  const width: StereoWidthUnit = createStereoWidth(ctx, p.width);

  input.connect(hpf);
  hpf.connect(presence);
  presence.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(deesser.input);
  deesser.output.connect(comp);
  comp.connect(reverb.input);
  reverb.output.connect(width.input);
  width.output.connect(output);

  const chain: VocalChain = {
    input,
    output,
    reverb,
    comp,
    update(p: VocalParams) {
      const c = Math.max(0, Math.min(100, p.clarity)) / 100;
      hpf.frequency.value = 40 + c * 100;   // 40–140 Hz
      presence.gain.value = c * 5;          // hasta +5 dB

      eqLow.gain.value = p.eqLow;
      eqMid.gain.value = p.eqMid;
      eqHigh.gain.value = p.eqHigh;

      deesser.update(p.deesser);

      comp.threshold.value = p.compThreshold;
      comp.attack.value = Math.max(0.001, p.compAttack / 1000);
      comp.release.value = Math.max(0.01, p.compRelease / 1000);

      reverb.update(p.reverbSize, p.reverbDecay, p.reverbMix);
      width.update(p.width);
    },
  };
  chain.update(p);
  return chain;
}
