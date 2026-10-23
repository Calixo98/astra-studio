// Dibujo de forma de onda estática (min/máx por columna) sobre canvas.

export function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer | null): void {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 300;
  const cssH = canvas.clientHeight || 96;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const mid = cssH / 2;

  // Línea central
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(cssW, mid);
  ctx.stroke();

  if (!buffer) return;

  const data = buffer.getChannelData(0);
  const samplesPerPx = Math.max(1, Math.floor(data.length / cssW));

  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, '#e8c547');
  grad.addColorStop(0.5, '#d4af37');
  grad.addColorStop(1, '#8a7325');
  ctx.fillStyle = grad;

  for (let x = 0; x < cssW; x++) {
    const start = x * samplesPerPx;
    let min = 1;
    let max = -1;
    const end = Math.min(start + samplesPerPx, data.length);
    for (let i = start; i < end; i += 1) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min > max) continue;
    const y1 = mid - max * (mid - 2);
    const y2 = mid - min * (mid - 2);
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}
