// Enlace declarativo slider → estado → grafo de audio.

import { state } from '../audio/state';
import type { Engine } from '../audio/engine';

type Scope = 'chain' | 'mix';

interface Binding {
  id: string;
  scope: Scope;
  get(): number;
  set(v: number): void;
  format(v: number): string;
}

const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
const pct = (v: number) => `${v.toFixed(0)} %`;
const ms = (v: number) => `${v.toFixed(0)} ms`;

function bindings(): Binding[] {
  const v = state.vocal;
  const m = state.master;
  return [
    { id: 'v-eq-low', scope: 'chain', get: () => v.eqLow, set: (x) => (v.eqLow = x), format: db },
    { id: 'v-eq-mid', scope: 'chain', get: () => v.eqMid, set: (x) => (v.eqMid = x), format: db },
    { id: 'v-eq-high', scope: 'chain', get: () => v.eqHigh, set: (x) => (v.eqHigh = x), format: db },
    { id: 'v-clarity', scope: 'chain', get: () => v.clarity, set: (x) => (v.clarity = x), format: pct },
    { id: 'v-deesser', scope: 'chain', get: () => v.deesser, set: (x) => (v.deesser = x), format: pct },
    { id: 'v-comp-threshold', scope: 'chain', get: () => v.compThreshold, set: (x) => (v.compThreshold = x), format: db },
    { id: 'v-comp-attack', scope: 'chain', get: () => v.compAttack, set: (x) => (v.compAttack = x), format: ms },
    { id: 'v-comp-release', scope: 'chain', get: () => v.compRelease, set: (x) => (v.compRelease = x), format: ms },
    { id: 'v-rev-size', scope: 'chain', get: () => v.reverbSize, set: (x) => (v.reverbSize = x), format: pct },
    { id: 'v-rev-decay', scope: 'chain', get: () => v.reverbDecay, set: (x) => (v.reverbDecay = x), format: pct },
    { id: 'v-rev-mix', scope: 'chain', get: () => v.reverbMix, set: (x) => (v.reverbMix = x), format: pct },
    { id: 'v-width', scope: 'chain', get: () => v.width, set: (x) => (v.width = x), format: pct },
    ...m.eq.map((_, i): Binding => ({
      id: `m-eq-${i}`,
      scope: 'chain',
      get: () => m.eq[i],
      set: (x) => (m.eq[i] = x),
      format: db,
    })),
    { id: 'm-max', scope: 'chain', get: () => m.maximizer, set: (x) => (m.maximizer = x), format: db },
    { id: 'm-ceiling', scope: 'chain', get: () => m.ceiling, set: (x) => (m.ceiling = x), format: db },
    { id: 'mix-vocal-vol', scope: 'mix', get: () => state.vocalMix.volume, set: (x) => (state.vocalMix.volume = x), format: pct },
    { id: 'mix-beat-vol', scope: 'mix', get: () => state.beatMix.volume, set: (x) => (state.beatMix.volume = x), format: pct },
    {
      id: 'mix-vocal-pan',
      scope: 'mix',
      get: () => state.vocalMix.pan,
      set: (x) => (state.vocalMix.pan = x),
      format: fmtPan,
    },
    {
      id: 'mix-beat-pan',
      scope: 'mix',
      get: () => state.beatMix.pan,
      set: (x) => (state.beatMix.pan = x),
      format: fmtPan,
    },
  ];
}

function fmtPan(v: number): string {
  if (v === 0) return 'C';
  return v < 0 ? `I ${Math.abs(v).toFixed(0)}` : `D ${v.toFixed(0)}`;
}

let activeBindings: Binding[] = [];

/** Re-sincroniza todos los sliders y sus valores desde el estado (p. ej. al aplicar un preset). */
export function syncControlsFromState(): void {
  for (const b of activeBindings) {
    const input = document.getElementById(b.id) as HTMLInputElement | null;
    const val = document.getElementById(`${b.id}-val`);
    if (!input) continue;
    input.value = String(b.get());
    if (val) val.textContent = b.format(b.get());
  }
}

export function initControls(engine: Engine): void {
  activeBindings = bindings();
  for (const b of activeBindings) {
    const input = document.getElementById(b.id) as HTMLInputElement | null;
    const val = document.getElementById(`${b.id}-val`);
    if (!input) {
      console.warn(`Control no encontrado: ${b.id}`);
      continue;
    }
    input.value = String(b.get());
    if (val) val.textContent = b.format(b.get());
    input.addEventListener('input', () => {
      const x = parseFloat(input.value);
      b.set(x);
      if (val) val.textContent = b.format(x);
      if (b.scope === 'mix') engine.applyMix();
      else engine.applyAll();
      // Un ajuste manual desactiva el preset seleccionado
      if (b.id.startsWith('v-')) {
        document.dispatchEvent(new CustomEvent('astra:manual-change'));
      }
    });
  }

  // Botones solo / mute
  const toggles: Array<{ id: string; get(): boolean; set(v: boolean): void }> = [
    { id: 'solo-vocal', get: () => state.vocalMix.solo, set: (x) => (state.vocalMix.solo = x) },
    { id: 'mute-vocal', get: () => state.vocalMix.mute, set: (x) => (state.vocalMix.mute = x) },
    { id: 'solo-beat', get: () => state.beatMix.solo, set: (x) => (state.beatMix.solo = x) },
    { id: 'mute-beat', get: () => state.beatMix.mute, set: (x) => (state.beatMix.mute = x) },
  ];
  for (const t of toggles) {
    const btn = document.getElementById(t.id) as HTMLButtonElement | null;
    if (!btn) continue;
    btn.addEventListener('click', () => {
      t.set(!t.get());
      btn.classList.toggle('active', t.get());
      engine.applyMix();
    });
  }
}
