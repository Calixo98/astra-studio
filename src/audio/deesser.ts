// De-esser split-band: la banda sibilante (>6 kHz, filtros LR4) pasa por un
// compresor agresivo; el resto pasa limpio. Web Audio no tiene sidechain,
// así que comprimir solo la banda alta es la aproximación estándar.

import { dbToGain } from './state';

const CROSSOVER_HZ = 6000;
const RATIO = 12;

export interface DeesserUnit {
  input: GainNode;
  output: GainNode;
  /** intensidad 0–100 → threshold 0 a −45 dB en la banda sibilante */
  update(intensity: number): void;
}

export function createDeesser(ctx: BaseAudioContext, intensity: number): DeesserUnit {
  const input = ctx.createGain();
  const output = ctx.createGain();

  // Banda baja limpia (LR4 = dos biquads Butterworth en cascada)
  const lp1 = ctx.createBiquadFilter();
  const lp2 = ctx.createBiquadFilter();
  for (const f of [lp1, lp2]) {
    f.type = 'lowpass';
    f.frequency.value = CROSSOVER_HZ;
    f.Q.value = Math.SQRT1_2;
  }

  // Banda sibilante comprimida
  const hp1 = ctx.createBiquadFilter();
  const hp2 = ctx.createBiquadFilter();
  for (const f of [hp1, hp2]) {
    f.type = 'highpass';
    f.frequency.value = CROSSOVER_HZ;
    f.Q.value = Math.SQRT1_2;
  }

  const comp = ctx.createDynamicsCompressor();
  comp.ratio.value = RATIO;
  comp.knee.value = 3;
  comp.attack.value = 0.002;
  comp.release.value = 0.06;

  // El DynamicsCompressorNode aplica makeup automático; lo compensamos para
  // que bajar el threshold reduzca las eses en vez de subir la banda entera.
  const compensate = ctx.createGain();

  input.connect(lp1);
  lp1.connect(lp2);
  lp2.connect(output);

  input.connect(hp1);
  hp1.connect(hp2);
  hp2.connect(comp);
  comp.connect(compensate);
  compensate.connect(output);

  const unit: DeesserUnit = {
    input,
    output,
    update(intensity: number) {
      const t = -(Math.max(0, Math.min(100, intensity)) / 100) * 45; // 0 → 0 dB, 100 → -45 dB
      comp.threshold.value = t;
      // makeup aproximado de Chromium: 0.6 · |ganancia a fondo de escala|
      compensate.gain.value = dbToGain(0.6 * t * (1 - 1 / RATIO));
    },
  };
  unit.update(intensity);
  return unit;
}
