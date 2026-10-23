// Estado central de parámetros. El grafo en vivo y el render offline
// se construyen a partir de este mismo objeto para que el export
// suene exactamente igual que la previsualización.

export interface VocalParams {
  eqLow: number;      // dB, shelf 120 Hz
  eqMid: number;      // dB, peaking 1.5 kHz
  eqHigh: number;     // dB, shelf 8 kHz
  clarity: number;    // 0–100 (HPF + presencia 3.5 kHz)
  deesser: number;    // 0–100 (intensidad)
  compThreshold: number; // dB
  compAttack: number;    // ms
  compRelease: number;   // ms
  reverbSize: number;    // 0–100 → 0.3–4 s
  reverbDecay: number;   // 0–100
  reverbMix: number;     // 0–100
  width: number;         // 0–200 (%)
}

export interface TrackMix {
  volume: number; // 0–100 (100 = 0 dB)
  pan: number;    // -100..100
  mute: boolean;
  solo: boolean;
}

export interface MasterParams {
  eq: [number, number, number, number, number]; // dB: 60, 250, 1k, 4k, 10k
  maximizer: number; // dB de ganancia de entrada al limitador, 0–12
  ceiling: number;   // techo del limitador en dB (default -1)
}

export interface AppState {
  vocal: VocalParams;
  vocalMix: TrackMix;
  beatMix: TrackMix;
  master: MasterParams;
}

export const state: AppState = {
  vocal: {
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    clarity: 25,
    deesser: 30,
    compThreshold: -18,
    compAttack: 10,
    compRelease: 120,
    reverbSize: 35,
    reverbDecay: 40,
    reverbMix: 18,
    width: 100,
  },
  vocalMix: { volume: 85, pan: 0, mute: false, solo: false },
  beatMix: { volume: 80, pan: 0, mute: false, solo: false },
  master: {
    eq: [0, 0, 0, 0, 0],
    maximizer: 0,
    ceiling: -1,
  },
};

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(g: number): number {
  return 20 * Math.log10(Math.max(g, 1e-8));
}

/** Volumen de fader (0–100) a ganancia lineal: 100 → 0 dB, curva suave. */
export function faderToGain(v: number): number {
  if (v <= 0) return 0;
  // Curva cuadrática: 100 → 1.0, 50 → 0.25 (~ -12 dB)
  const n = v / 100;
  return n * n;
}

/** Ganancias efectivas considerando mute y solo entre las dos pistas. */
export function effectiveMuteGains(vocal: TrackMix, beat: TrackMix): { vocal: number; beat: number } {
  const anySolo = vocal.solo || beat.solo;
  const vOn = !vocal.mute && (!anySolo || vocal.solo);
  const bOn = !beat.mute && (!anySolo || beat.solo);
  return { vocal: vOn ? 1 : 0, beat: bOn ? 1 : 0 };
}
