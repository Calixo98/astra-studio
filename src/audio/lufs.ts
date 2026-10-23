// Estimación inspirada en ITU-R BS.1770, sin validación de conformidad:
// ponderación K (shelf de agudos + paso-altos) → bloques de 400 ms con
// solape del 75 % → gating absoluto (−70 LUFS) y relativo (−10 LU).

export interface BiquadCoeffs {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

/** Coeficientes de ponderación K para cualquier sample rate (fórmulas RBJ). */
export function kWeightingCoeffs(fs: number): [BiquadCoeffs, BiquadCoeffs] {
  // Etapa 1: high shelf +4 dB
  const f1 = 1681.9744509555319;
  const G = 3.99984385397;
  const Q1 = 0.7071752369554196;
  const A = Math.pow(10, G / 40);
  const w0 = (2 * Math.PI * f1) / fs;
  const cos0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q1);
  const sqA = Math.sqrt(A);
  let a0 = A + 1 - (A - 1) * cos0 + 2 * sqA * alpha;
  const stage1: BiquadCoeffs = {
    b0: (A * (A + 1 + (A - 1) * cos0 + 2 * sqA * alpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos0)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos0 - 2 * sqA * alpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos0)) / a0,
    a2: (A + 1 - (A - 1) * cos0 - 2 * sqA * alpha) / a0,
  };

  // Etapa 2: paso-altos 38 Hz
  const f2 = 38.13547087602444;
  const Q2 = 0.5003270373238773;
  const w2 = (2 * Math.PI * f2) / fs;
  const cos2 = Math.cos(w2);
  const alpha2 = Math.sin(w2) / (2 * Q2);
  a0 = 1 + alpha2;
  const stage2: BiquadCoeffs = {
    b0: (1 + cos2) / 2 / a0,
    b1: -(1 + cos2) / a0,
    b2: (1 + cos2) / 2 / a0,
    a1: (-2 * cos2) / a0,
    a2: (1 - alpha2) / a0,
  };
  return [stage1, stage2];
}

function filterCopy(data: Float32Array, c: BiquadCoeffs): Float32Array {
  const out = new Float32Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

export interface LoudnessResult {
  /** LUFS integrado (−Infinity si no hay señal por encima del gate). */
  integrated: number;
  /** Pico estimado con sobremuestreo 4x, en dBTP. */
  truePeak: number;
}

export function measureLoudness(buffer: AudioBuffer): LoudnessResult {
  const fs = buffer.sampleRate;
  const [s1, s2] = kWeightingCoeffs(fs);
  const nCh = Math.min(buffer.numberOfChannels, 2);
  const hop = Math.round(fs * 0.1);
  const nHops = Math.floor(buffer.length / hop);

  // Energía por hop sumada entre canales (ponderación 1.0 para L y R)
  const hopEnergy = new Float64Array(nHops);
  let truePeak = 0;

  for (let ch = 0; ch < nCh; ch++) {
    const raw = buffer.getChannelData(ch);
    truePeak = Math.max(truePeak, channelTruePeak(raw));
    const filtered = filterCopy(filterCopy(raw, s1), s2);
    for (let h = 0; h < nHops; h++) {
      let e = 0;
      const start = h * hop;
      for (let i = start; i < start + hop; i++) e += filtered[i] * filtered[i];
      hopEnergy[h] += e;
    }
  }

  // Bloques de 400 ms (4 hops, solape 75 %)
  const blocks: number[] = [];
  for (let h = 3; h < nHops; h++) {
    const ms = (hopEnergy[h] + hopEnergy[h - 1] + hopEnergy[h - 2] + hopEnergy[h - 3]) / (4 * hop);
    blocks.push(ms);
  }

  return {
    integrated: gatedLoudness(blocks),
    truePeak: 20 * Math.log10(Math.max(truePeak, 1e-8)),
  };
}

export function blockLoudness(meanSquare: number): number {
  return -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-12));
}

/** Gating en dos etapas de BS.1770 sobre mean squares de bloques de 400 ms. */
export function gatedLoudness(blocks: number[] | Float64Array): number {
  const abs: number[] = [];
  for (const ms of blocks) if (blockLoudness(ms) > -70) abs.push(ms);
  if (abs.length === 0) return -Infinity;
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;
  const relGate = blockLoudness(meanAbs) - 10;
  const rel = abs.filter((ms) => blockLoudness(ms) > relGate);
  if (rel.length === 0) return -Infinity;
  const mean = rel.reduce((a, b) => a + b, 0) / rel.length;
  return blockLoudness(mean);
}

/** Pico con sobremuestreo 4x por interpolación Catmull-Rom (aproximación dBTP). */
function channelTruePeak(data: Float32Array): number {
  let peak = 0;
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const p1 = data[i];
    const a1 = Math.abs(p1);
    if (a1 > peak) peak = a1;
    if (i + 1 >= n) break;
    const p0 = i > 0 ? data[i - 1] : p1;
    const p2 = data[i + 1];
    const p3 = i + 2 < n ? data[i + 2] : p2;
    for (const t of [0.25, 0.5, 0.75]) {
      const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      const av = Math.abs(v);
      if (av > peak) peak = av;
    }
  }
  return peak;
}
