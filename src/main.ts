import { initHelp } from './ui/help';
import { initEditor } from './editor/editor';
import { RenderRevision } from './audio/renderRevision';
import { initConverter } from './ui/converter';
import './styles.css';
import { Engine, type TrackId } from './audio/engine';
import { state } from './audio/state';
import { renderMix, analyzeBuffer, encodeMp3, encodeWavExport, downloadBlob, type ExportAnalysis } from './audio/export';
import { VOCAL_PRESETS } from './audio/presets';
import { initTabs } from './ui/tabs';
import { initControls, syncControlsFromState } from './ui/controls';
import { initRecorder } from './ui/recorder';
import { drawWaveform } from './ui/waveform';
import { drawLevelMeter, updateLufsUi } from './ui/meters';

const engine = new Engine();
void engine.init();

initEditor(() => engine.stop());
initConverter();
initHelp();
initTabs();
initControls(engine);

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento no encontrado: ${id}`);
  return el as T;
};

const btnPlay = $<HTMLButtonElement>('btn-play');
const btnPause = $<HTMLButtonElement>('btn-pause');
const btnStop = $<HTMLButtonElement>('btn-stop');
const timeDisplay = $('time-display');
const btnExport = $<HTMLButtonElement>('btn-export-analyze');
const exportStatus = $('export-status');
const exportResults = $('export-results');

// ── Carga de archivos ──────────────────────────────────────────────

interface TrackUi {
  drop: HTMLElement;
  input: HTMLInputElement;
  name: HTMLElement;
  stripName: HTMLElement;
  stripRemove: HTMLButtonElement;
  wave: HTMLCanvasElement;
  actions: HTMLElement;
}

const trackUi: Record<TrackId, TrackUi> = {
  vocal: {
    drop: $('drop-vocal'),
    input: $<HTMLInputElement>('file-vocal'),
    name: $('name-vocal'),
    stripName: $('strip-name-vocal'),
    stripRemove: $<HTMLButtonElement>('strip-remove-vocal'),
    wave: $<HTMLCanvasElement>('wave-vocal'),
    actions: document.querySelector<HTMLElement>('#drop-vocal .drop-actions')!,
  },
  beat: {
    drop: $('drop-beat'),
    input: $<HTMLInputElement>('file-beat'),
    name: $('name-beat'),
    stripName: $('strip-name-beat'),
    stripRemove: $<HTMLButtonElement>('strip-remove-beat'),
    wave: $<HTMLCanvasElement>('wave-beat'),
    actions: document.querySelector<HTMLElement>('#drop-beat .drop-actions')!,
  },
};

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function refreshAvailability(): void {
  const has = engine.hasAudio;
  btnPlay.disabled = !has;
  btnPause.disabled = !has;
  btnStop.disabled = !has;
  btnExport.disabled = !has || exporting;
  exportStatus.textContent = has
    ? 'La mezcla se renderiza con todos los ajustes actuales.'
    : 'Carga al menos una pista para exportar.';
}

async function loadTrack(id: TrackId, file: File, propagateError = false): Promise<void> {
  const ui = trackUi[id];
  ui.name.textContent = 'Decodificando…';
  try {
    const buffer = await engine.loadFile(id, file);
    const label = `${file.name} · ${fmtTime(buffer.duration)}`;
    ui.name.textContent = label;
    ui.stripName.textContent = label;
    ui.drop.classList.add('loaded');
    ui.actions.hidden = false;
    ui.stripRemove.hidden = false;
    drawWaveform(ui.wave, buffer);
    setTransportUi();
    refreshAvailability();
  } catch (err) {
    console.error('Error al decodificar el audio', err);
    ui.name.textContent = 'No se pudo leer el archivo. Usa un MP3 o WAV válido.';
    if (propagateError) throw err;
  }
}

function removeTrack(id: TrackId): void {
  const ui = trackUi[id];
  engine.clearTrack(id);
  ui.input.value = '';
  ui.name.textContent = '';
  ui.stripName.textContent = 'Sin archivo';
  ui.drop.classList.remove('loaded');
  ui.actions.hidden = true;
  ui.stripRemove.hidden = true;
  drawWaveform(ui.wave, null);
  setTransportUi();
  refreshAvailability();
}

for (const id of ['vocal', 'beat'] as TrackId[]) {
  const ui = trackUi[id];
  ui.drop.addEventListener('click', () => ui.input.click());
  ui.actions.querySelector('[data-action="replace"]')!.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.input.click();
  });
  ui.actions.querySelector('[data-action="remove"]')!.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTrack(id);
  });
  ui.stripRemove.addEventListener('click', () => removeTrack(id));
  ui.input.addEventListener('change', () => {
    const f = ui.input.files?.[0];
    if (f) void loadTrack(id, f);
    // Permite volver a elegir el mismo archivo más adelante
    ui.input.value = '';
  });
  ui.drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    ui.drop.classList.add('dragover');
  });
  ui.drop.addEventListener('dragleave', () => ui.drop.classList.remove('dragover'));
  ui.drop.addEventListener('drop', (e) => {
    e.preventDefault();
    ui.drop.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) void loadTrack(id, f);
  });
}

// ── Transporte ─────────────────────────────────────────────────────

function setTransportUi(): void {
  btnPlay.classList.toggle('active', engine.playing);
}

btnPlay.addEventListener('click', () => {
  engine.play();
  setTransportUi();
});
btnPause.addEventListener('click', () => {
  engine.pause();
  setTransportUi();
});
btnStop.addEventListener('click', () => {
  engine.stop();
  setTransportUi();
});

// Barra espaciadora: reproducir / pausar (como en un DAW)
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || document.getElementById('tab-editor')?.classList.contains('active')) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT')) return;
  e.preventDefault();
  if (!engine.hasAudio) return;
  if (engine.playing) engine.pause();
  else engine.play();
  setTransportUi();
});

// Clic en la forma de onda: saltar a esa posición
for (const wrap of document.querySelectorAll<HTMLElement>('.wave-wrap[data-seek]')) {
  wrap.addEventListener('click', (e) => {
    const id = wrap.dataset.seek as TrackId;
    const dur = engine.tracks[id].buffer?.duration ?? 0;
    if (dur <= 0) return;
    const rect = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    engine.seek(frac * dur);
  });
}

// ── Presets de cadena vocal ────────────────────────────────────────

const presetRow = $('preset-row');
for (const preset of VOCAL_PRESETS) {
  const btn = document.createElement('button');
  btn.className = 'preset';
  btn.textContent = preset.label;
  btn.title = preset.hint;
  btn.addEventListener('click', () => {
    Object.assign(state.vocal, preset.params);
    syncControlsFromState();
    engine.applyAll();
    presetRow.querySelectorAll('.preset').forEach((p) => p.classList.toggle('active', p === btn));
  });
  presetRow.appendChild(btn);
}

// Mover cualquier slider de la voz a mano desmarca el preset
document.addEventListener('astra:manual-change', () => {
  presetRow.querySelectorAll('.preset').forEach((p) => p.classList.remove('active'));
});

// ── Grabación con micrófono ────────────────────────────────────────

initRecorder(engine, (file) => loadTrack('vocal', file, true));

// ── Medidor LUFS en vivo ───────────────────────────────────────────

// Congela el medidor al detener: la cola del reverb tras el stop no debe
// sobreescribir la última medición real.
engine.onLufs = (d) => {
  if (engine.playing) updateLufsUi(d);
};

// ── Loop de refresco (tiempo, playheads, medidores) ───────────────

const meterVocal = $<HTMLCanvasElement>('meter-vocal');
const meterBeat = $<HTMLCanvasElement>('meter-beat');
const grComp = $('gr-comp');
const grLimiter = $('gr-limiter');
const phVocal = $('ph-vocal');
const phBeat = $('ph-beat');

function updatePlayhead(el: HTMLElement, wave: HTMLCanvasElement, trackDur: number, pos: number): void {
  if (trackDur <= 0) {
    el.style.transform = 'translateX(-2px)';
    return;
  }
  const frac = Math.min(pos, trackDur) / trackDur;
  el.style.transform = `translateX(${frac * wave.clientWidth - 2}px)`;
}

function tick(): void {
  if (engine.tick()) setTransportUi(); // llegó al final

  const pos = engine.position;
  timeDisplay.textContent = `${fmtTime(pos)} / ${fmtTime(engine.duration)}`;

  updatePlayhead(phVocal, trackUi.vocal.wave, engine.tracks.vocal.buffer?.duration ?? 0, pos);
  updatePlayhead(phBeat, trackUi.beat.wave, engine.tracks.beat.buffer?.duration ?? 0, pos);

  drawLevelMeter(meterVocal, engine.tracks.vocal.analyser);
  drawLevelMeter(meterBeat, engine.tracks.beat.analyser);

  grComp.textContent = `${engine.vocalChain.comp.reduction.toFixed(1)} dB`;
  grLimiter.textContent = `${engine.masterChain.limiter.reduction.toFixed(1)} dB`;
}
// setInterval en vez de requestAnimationFrame: sigue actualizando el
// transporte (y el auto-stop al final) aunque la pestaña esté en segundo plano.
window.setInterval(tick, 50);

// Redibuja formas de onda al cambiar el tamaño de ventana
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    drawWaveform(trackUi.vocal.wave, engine.tracks.vocal.buffer);
    drawWaveform(trackUi.beat.wave, engine.tracks.beat.buffer);
  }, 150);
});

// ── Exportación ────────────────────────────────────────────────────

const renderRevision = new RenderRevision();
let exporting = false;
let rendered: AudioBuffer | null = null;
let lastAnalysis: ExportAnalysis | null = null;

engine.onChange = () => {
  renderRevision.invalidate();
  rendered = null;
  lastAnalysis = null;
  exportResults.hidden = true;
  $('btn-download').setAttribute('disabled', '');
  exportStatus.textContent = 'La mezcla cambió. Renderiza otra vez antes de descargar.';
};

btnExport.addEventListener('click', () => {
  if (exporting) return;
  void (async () => {
    exporting = true;
    const startedRevision = renderRevision.capture();
    rendered = null;
    lastAnalysis = null;
    $('btn-download').setAttribute('disabled', '');
    btnExport.disabled = true;
    exportStatus.textContent = 'Renderizando la mezcla con todos los efectos…';
    exportResults.hidden = true;
    try {
      const result = await renderMix(engine);
      if (!renderRevision.isCurrent(startedRevision)) {
        exportStatus.textContent = 'La mezcla cambió durante el render. Renderiza otra vez.';
        return;
      }
      rendered = result;
      lastAnalysis = analyzeBuffer(rendered);

      $('export-lufs').textContent = isFinite(lastAnalysis.integrated)
        ? `${lastAnalysis.integrated.toFixed(1)} LUFS`
        : '—';
      $('export-peak').textContent = `${lastAnalysis.truePeak.toFixed(1)} dB`;

      const verdict = $('export-verdict');
      verdict.classList.remove('chip-ok', 'chip-warn', 'chip-neutral');
      verdict.classList.add(lastAnalysis.ready ? 'chip-ok' : 'chip-warn');
      verdict.textContent = (lastAnalysis.ready ? '✓ ' : '⚠ ') + lastAnalysis.message;
      $('export-suggestion').textContent = lastAnalysis.suggestion;

      $('btn-download').removeAttribute('disabled');
      exportResults.hidden = false;
      exportStatus.textContent = 'Análisis completado. Descarga tu mezcla cuando quieras.';
    } catch (err) {
      console.error('Error al renderizar', err);
      exportStatus.textContent = 'Ocurrió un error al renderizar la mezcla.';
    } finally {
      exporting = false;
      btnExport.disabled = !engine.hasAudio;
    }
  })();
});

$('btn-download').addEventListener('click', () => {
  if (!rendered) return;
  const format =
    document.querySelector<HTMLInputElement>('input[name="format"]:checked')?.value ?? 'wav';
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'mp3') {
    downloadBlob(encodeMp3(rendered), `astra-mezcla-${stamp}.mp3`);
  } else {
    downloadBlob(encodeWavExport(rendered), `astra-mezcla-${stamp}.wav`);
  }
});

refreshAvailability();
