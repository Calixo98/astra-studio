function kWeightingCoeffs(fs) {
  const f1 = 1681.9744509555319, G = 3.99984385397, Q1 = 0.7071752369554196;
  const A = Math.pow(10, G / 40);
  const w0 = 2 * Math.PI * f1 / fs;
  const cos0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q1);
  const sqA = Math.sqrt(A);
  let a0 = A + 1 - (A - 1) * cos0 + 2 * sqA * alpha;
  const s1 = {
    b0: (A * (A + 1 + (A - 1) * cos0 + 2 * sqA * alpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos0)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos0 - 2 * sqA * alpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos0)) / a0,
    a2: (A + 1 - (A - 1) * cos0 - 2 * sqA * alpha) / a0,
  };
  const f2 = 38.13547087602444, Q2 = 0.5003270373238773;
  const w2 = 2 * Math.PI * f2 / fs;
  const cos2 = Math.cos(w2);
  const alpha2 = Math.sin(w2) / (2 * Q2);
  a0 = 1 + alpha2;
  const s2 = {
    b0: (1 + cos2) / 2 / a0,
    b1: -(1 + cos2) / a0,
    b2: (1 + cos2) / 2 / a0,
    a1: (-2 * cos2) / a0,
    a2: (1 - alpha2) / a0,
  };
  return [s1, s2];
}

function blockLoudness(ms) {
  return -0.691 + 10 * Math.log10(Math.max(ms, 1e-12));
}

function gatedLoudness(blocks) {
  const abs = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blockLoudness(blocks[i]) > -70) abs.push(blocks[i]);
  }
  if (abs.length === 0) return -Infinity;
  let sum = 0;
  for (const ms of abs) sum += ms;
  const relGate = blockLoudness(sum / abs.length) - 10;
  let relSum = 0, relN = 0;
  for (const ms of abs) {
    if (blockLoudness(ms) > relGate) { relSum += ms; relN++; }
  }
  if (relN === 0) return -Infinity;
  return blockLoudness(relSum / relN);
}

class LufsProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.coeffs = kWeightingCoeffs(sampleRate);
    // Estado de filtros: [canal][etapa] -> x1, x2, y1, y2
    this.fstate = new Float64Array(2 * 2 * 4);
    this.hopSize = Math.round(sampleRate * 0.1);
    this.hopCount = 0;
    this.hopEnergy = 0;
    this.hops = [];       // energías de los últimos hops (para momentary/short-term)
    this.blocks = [];     // mean squares de bloques de 400 ms (para integrado)
    this.sincePost = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'reset') {
        this.hops = [];
        this.blocks = [];
        this.hopCount = 0;
        this.hopEnergy = 0;
        this.fstate.fill(0);
      }
    };
  }

  step(ch, stage, x) {
    const c = this.coeffs[stage];
    const o = (ch * 2 + stage) * 4;
    const st = this.fstate;
    const y = c.b0 * x + c.b1 * st[o] + c.b2 * st[o + 1] - c.a1 * st[o + 2] - c.a2 * st[o + 3];
    st[o + 1] = st[o];
    st[o] = x;
    st[o + 3] = st[o + 2];
    st[o + 2] = y;
    return y;
  }

  onHop() {
    this.hops.push(this.hopEnergy);
    this.hopEnergy = 0;
    this.hopCount = 0;
    const n = this.hops.length;
    if (n >= 4) {
      const ms = (this.hops[n - 1] + this.hops[n - 2] + this.hops[n - 3] + this.hops[n - 4]) / (4 * this.hopSize);
      this.blocks.push(ms);
    }
    if (n > 30) this.hops.splice(0, n - 30);
    this.sincePost++;
    if (this.sincePost >= 2) {
      this.sincePost = 0;
      this.post();
    }
  }

  post() {
    const nb = this.blocks.length;
    const momentary = nb > 0 ? blockLoudness(this.blocks[nb - 1]) : -Infinity;
    let shortTerm = -Infinity;
    if (this.hops.length > 0) {
      let sum = 0;
      for (const e of this.hops) sum += e;
      shortTerm = blockLoudness(sum / (this.hops.length * this.hopSize));
    }
    const integrated = gatedLoudness(this.blocks);
    this.port.postMessage({ momentary: momentary, shortTerm: shortTerm, integrated: integrated });
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    for (let ch = 0; ch < output.length; ch++) {
      const src = input[Math.min(ch, input.length - 1)];
      if (src) output[ch].set(src);
    }
    const nCh = Math.min(input.length, 2);
    const frames = input[0].length;
    for (let i = 0; i < frames; i++) {
      let e = 0;
      for (let ch = 0; ch < nCh; ch++) {
        const y = this.step(ch, 1, this.step(ch, 0, input[ch][i]));
        e += y * y;
      }
      this.hopEnergy += e;
      this.hopCount++;
      if (this.hopCount >= this.hopSize) this.onHop();
    }
    return true;
  }
}

registerProcessor('lufs-processor', LufsProcessor);