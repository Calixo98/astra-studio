import { decodeFile, MAX_PCM_BYTES, canceled } from './converterHelpers';
// Motor de audio en vivo: grafo compartido, carga de archivos y transporte
// sincronizado de las dos pistas (voz y beat).

import { state, faderToGain, effectiveMuteGains } from './state';
import { createVocalChain, type VocalChain } from './vocalChain';
import { createMasterChain, type MasterChain } from './masterChain';
import { createLufsMeter, type LufsData, type LufsMeterNode } from './lufsWorklet';

export type TrackId = 'vocal' | 'beat';

export interface Track {
  buffer: AudioBuffer | null;
  fileName: string;
  source: AudioBufferSourceNode | null;
  input: GainNode;
  fader: GainNode;
  panner: StereoPannerNode;
  muteGain: GainNode;
  analyser: AnalyserNode;
}

export class Engine {
  readonly ctx: AudioContext;
  readonly vocalChain: VocalChain;
  readonly masterChain: MasterChain;
  readonly masterAnalyser: AnalyserNode;
  readonly tracks: Record<TrackId, Track>;
  lufs: LufsMeterNode | null = null;
  lufsData: LufsData = { momentary: -Infinity, shortTerm: -Infinity, integrated: -Infinity };
  onLufs: ((d: LufsData) => void) | null = null;

  onChange: (() => void) | null = null;
  playing = false;
  private startCtxTime = 0;
  private offset = 0;

  constructor() {
    this.ctx = new AudioContext();
    const ctx = this.ctx;

    const makeTrack = (): Track => {
      const input = ctx.createGain();
      const fader = ctx.createGain();
      const panner = ctx.createStereoPanner();
      const muteGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      fader.connect(panner);
      panner.connect(muteGain);
      muteGain.connect(analyser);
      return { buffer: null, fileName: '', source: null, input, fader, panner, muteGain, analyser };
    };

    const vocal = makeTrack();
    const beat = makeTrack();
    this.tracks = { vocal, beat };

    this.vocalChain = createVocalChain(ctx, state.vocal);
    vocal.input.connect(this.vocalChain.input);
    this.vocalChain.output.connect(vocal.fader);

    beat.input.connect(beat.fader);

    const mixBus = ctx.createGain();
    vocal.analyser.connect(mixBus);
    beat.analyser.connect(mixBus);

    this.masterChain = createMasterChain(ctx, state.master);
    mixBus.connect(this.masterChain.input);

    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterChain.output.connect(this.masterAnalyser);
    this.masterAnalyser.connect(ctx.destination);

    this.applyAll();
  }

  /** Carga el worklet LUFS y lo inserta al final de la cadena. */
  async init(): Promise<void> {
    this.lufs = await createLufsMeter(this.ctx, (d) => {
      this.lufsData = d;
      this.onLufs?.(d);
    });
    if (this.lufs) {
      this.masterAnalyser.disconnect();
      this.masterAnalyser.connect(this.lufs.node);
      this.lufs.node.connect(this.ctx.destination);
    }
  }

  private loads = { vocal: 0, beat: 0 };

  async loadFile(id: TrackId, file: File): Promise<AudioBuffer> {
    const token = ++this.loads[id];
    const buffer = await decodeFile(file, this.ctx, () => token === this.loads[id]);
    if (token !== this.loads[id]) throw canceled();
    const other = this.tracks[id === 'vocal' ? 'beat' : 'vocal'].buffer;
    if (buffer.length * buffer.numberOfChannels * 4 + (other ? other.length * other.numberOfChannels * 4 : 0) > MAX_PCM_BYTES) throw new Error('Las dos pistas superan 128 MiB PCM. Quita una pista.');
    this.stop();
    this.tracks[id].buffer = buffer;
    this.tracks[id].fileName = file.name;
    this.onChange?.();
    return buffer;
  }

  clearTrack(id: TrackId): void {
    this.loads[id]++;
    this.stop();
    this.tracks[id].buffer = null;
    this.tracks[id].fileName = '';
    this.onChange?.();
  }

  /** Salta a una posición (en segundos). Mantiene la reproducción si estaba activa. */
  seek(t: number): void {
    const target = Math.max(0, Math.min(t, this.duration));
    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.stopSources();
      this.playing = false;
    }
    this.offset = target;
    if (wasPlaying) this.play();
  }

  get duration(): number {
    return Math.max(this.tracks.vocal.buffer?.duration ?? 0, this.tracks.beat.buffer?.duration ?? 0);
  }

  get hasAudio(): boolean {
    return this.duration > 0;
  }

  get position(): number {
    if (!this.playing) return this.offset;
    return Math.min(this.offset + (this.ctx.currentTime - this.startCtxTime), this.duration);
  }

  play(): void {
    if (!this.hasAudio || this.playing) return;
    void this.ctx.resume();
    if (this.offset === 0) this.lufs?.reset();
    for (const id of ['vocal', 'beat'] as TrackId[]) {
      const t = this.tracks[id];
      if (!t.buffer || this.offset >= t.buffer.duration) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = t.buffer;
      src.connect(t.input);
      src.start(0, this.offset);
      t.source = src;
    }
    this.startCtxTime = this.ctx.currentTime;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.position;
    this.stopSources();
    this.playing = false;
  }

  stop(): void {
    this.stopSources();
    this.playing = false;
    this.offset = 0;
    this.lufs?.reset();
  }

  /** Llamado desde el loop de UI; detiene al llegar al final. Devuelve true si estaba sonando y terminó. */
  tick(): boolean {
    if (this.playing && this.position >= this.duration) {
      this.stop();
      return true;
    }
    return false;
  }

  private stopSources(): void {
    for (const id of ['vocal', 'beat'] as TrackId[]) {
      const t = this.tracks[id];
      if (t.source) {
        try {
          t.source.stop();
        } catch {
          // ya detenido
        }
        t.source.disconnect();
        t.source = null;
      }
    }
  }

  /** Aplica todos los parámetros del estado al grafo en vivo. */
  applyAll(): void {
    this.vocalChain.update(state.vocal);
    this.masterChain.update(state.master);
    this.applyMix();
  }

  applyMix(): void {
    this.onChange?.();
    const now = this.ctx.currentTime;
    const smooth = (param: AudioParam, value: number) => {
      param.setTargetAtTime(value, now, 0.015);
    };
    const mutes = effectiveMuteGains(state.vocalMix, state.beatMix);
    smooth(this.tracks.vocal.fader.gain, faderToGain(state.vocalMix.volume));
    smooth(this.tracks.beat.fader.gain, faderToGain(state.beatMix.volume));
    smooth(this.tracks.vocal.panner.pan, state.vocalMix.pan / 100);
    smooth(this.tracks.beat.panner.pan, state.beatMix.pan / 100);
    smooth(this.tracks.vocal.muteGain.gain, mutes.vocal);
    smooth(this.tracks.beat.muteGain.gain, mutes.beat);
  }
}
