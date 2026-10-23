// Medidores de nivel por pista y actualización del medidor LUFS.

import type { LufsData } from '../audio/lufsWorklet';

const scratch = new Float32Array(2048);

/** Dibuja un medidor vertical a partir de un AnalyserNode. */
export function drawLevelMeter(canvas: HTMLCanvasElement, analyser: AnalyserNode): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  analyser.getFloatTimeDomainData(scratch);
  let sum = 0;
  let peak = 0;
  const n = Math.min(scratch.length, analyser.fftSize);
  for (let i = 0; i < n; i++) {
    const v = scratch[i];
    sum += v * v;
    const av = Math.abs(v);
    if (av > peak) peak = av;
  }
  const rms = Math.sqrt(sum / n);
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-6));
  const peakDb = 20 * Math.log10(Math.max(peak, 1e-6));

  const norm = (db: number) => Math.max(0, Math.min(1, (db + 60) / 60));

  ctx.clearRect(0, 0, w, h);
  const level = norm(rmsDb);
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#2c5f8a');
  grad.addColorStop(0.7, '#d4af37');
  grad.addColorStop(1, '#f87171');
  ctx.fillStyle = grad;
  ctx.fillRect(2, h - level * h, w - 4, level * h);

  const py = h - norm(peakDb) * h;
  ctx.fillStyle = '#e8c547';
  ctx.fillRect(0, Math.max(0, py - 1), w, 2);
}

function fmtLufs(v: number): string {
  return isFinite(v) ? v.toFixed(1) : '—';
}

export function updateLufsUi(d: LufsData): void {
  const short = document.getElementById('lufs-short')!;
  const mom = document.getElementById('lufs-momentary')!;
  const integ = document.getElementById('lufs-integrated')!;
  const bar = document.getElementById('lufs-bar')!;
  const status = document.getElementById('lufs-status')!;

  short.textContent = fmtLufs(d.shortTerm);
  mom.textContent = fmtLufs(d.momentary) + (isFinite(d.momentary) ? ' LUFS' : '');
  integ.textContent = fmtLufs(d.integrated) + (isFinite(d.integrated) ? ' LUFS' : '');

  const pct = isFinite(d.shortTerm) ? Math.max(0, Math.min(100, ((d.shortTerm + 30) / 30) * 100)) : 0;
  bar.style.width = `${pct}%`;

  status.classList.remove('chip-ok', 'chip-warn', 'chip-neutral');
  if (!isFinite(d.integrated)) {
    status.classList.add('chip-neutral');
    status.textContent = 'Reproduce para medir';
  } else if (d.integrated >= -15 && d.integrated <= -13) {
    status.classList.add('chip-ok');
    status.textContent = '✓ En rango para Spotify y YouTube';
  } else if (d.integrated < -15) {
    status.classList.add('chip-warn');
    status.textContent = `Bajo para streaming (${d.integrated.toFixed(1)} LUFS, objetivo −14)`;
  } else {
    status.classList.add('chip-warn');
    status.textContent = `Alto para streaming (${d.integrated.toFixed(1)} LUFS, objetivo −14)`;
  }
}
