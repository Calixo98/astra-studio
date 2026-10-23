// Reverb por convolución con impulso sintético (ruido con decaimiento exponencial).

export interface ReverbUnit {
  input: GainNode;
  output: GainNode;
  /** Actualiza tamaño (0–100), decaimiento (0–100) y mezcla (0–100). */
  update(size: number, decay: number, mix: number): void;
  /** Duración actual del impulso en segundos (para la cola en el export). */
  tailSeconds: number;
}

export function reverbSeconds(size: number): number {
  return 0.3 + (size / 100) * 3.7; // 0.3–4 s
}

export function buildImpulse(ctx: BaseAudioContext, size: number, decay: number): AudioBuffer {
  const seconds = reverbSeconds(size);
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(seconds * sr));
  const impulse = ctx.createBuffer(2, len, sr);
  // decaimiento: 0 → cola larga (rate bajo), 100 → cola corta y densa
  const rate = 1.5 + (decay / 100) * 8;
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let energy = 0;
    let seed = (0x41535452 + ch) >>> 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const v = (seed / 4294967296 * 2 - 1) * Math.exp(-t * rate);
      data[i] = v;
      energy += v * v;
    }
    // Normaliza la energía para que el nivel wet no dependa del tamaño
    const norm = 1 / Math.sqrt(Math.max(energy, 1e-8));
    for (let i = 0; i < len; i++) data[i] *= norm * 8;
  }
  return impulse;
}

export function createReverb(ctx: BaseAudioContext, size: number, decay: number, mix: number): ReverbUnit {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();

  input.connect(dry);
  dry.connect(output);
  input.connect(convolver);
  convolver.connect(wet);
  wet.connect(output);

  let lastSize = -1;
  let lastDecay = -1;

  const unit: ReverbUnit = {
    input,
    output,
    tailSeconds: reverbSeconds(size),
    update(s: number, d: number, m: number) {
      if (s !== lastSize || d !== lastDecay) {
        convolver.buffer = buildImpulse(ctx, s, d);
        lastSize = s;
        lastDecay = d;
        unit.tailSeconds = reverbSeconds(s);
      }
      dry.gain.value = 1;
      wet.gain.value = m / 100;
    },
  };
  unit.update(size, decay, mix);
  return unit;
}
