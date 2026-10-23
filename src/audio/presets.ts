// Presets de cadena vocal por género. Valores pensados para voz urbana/pop
// en español; el usuario puede partir de aquí y ajustar a mano.

import type { VocalParams } from './state';

export interface VocalPreset {
  id: string;
  label: string;
  hint: string;
  params: VocalParams;
}

export const VOCAL_PRESETS: VocalPreset[] = [
  {
    id: 'trap',
    label: 'Trap',
    hint: 'Voz brillante y comprimida al frente, reverb corta',
    params: {
      eqLow: -2,
      eqMid: -1,
      eqHigh: 3,
      clarity: 45,
      deesser: 45,
      compThreshold: -24,
      compAttack: 5,
      compRelease: 80,
      reverbSize: 25,
      reverbDecay: 60,
      reverbMix: 12,
      width: 110,
    },
  },
  {
    id: 'reggaeton',
    label: 'Reggaetón',
    hint: 'Cuerpo en la voz, presencia y reverb media',
    params: {
      eqLow: 1,
      eqMid: -1.5,
      eqHigh: 2,
      clarity: 35,
      deesser: 35,
      compThreshold: -20,
      compAttack: 8,
      compRelease: 100,
      reverbSize: 40,
      reverbDecay: 45,
      reverbMix: 20,
      width: 120,
    },
  },
  {
    id: 'balada',
    label: 'Balada',
    hint: 'Compresión suave, sala grande y voz amplia',
    params: {
      eqLow: 0,
      eqMid: -2,
      eqHigh: 1.5,
      clarity: 30,
      deesser: 25,
      compThreshold: -16,
      compAttack: 20,
      compRelease: 200,
      reverbSize: 65,
      reverbDecay: 30,
      reverbMix: 30,
      width: 130,
    },
  },
];
