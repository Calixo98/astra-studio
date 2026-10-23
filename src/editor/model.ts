export const MAX_TRACKS = 8;
export const MAX_PROJECT_SECONDS = 180;
export const MAX_PROJECT_PCM = 128 * 1024 * 1024;
export type Goal = 'voice' | 'song' | 'master';
export interface Settings { goal: Goal; clarity: number; ambience: number; level: number }
export interface Clip { id: string; assetId: string; start: number; offset: number; duration: number; fadeIn: number; fadeOut: number }
export interface EditorTrack { id: string; name: string; role: 'voice' | 'instrument'; volume: number; mute: boolean; solo: boolean; clips: Clip[] }
export interface Project { version: 1; name: string; tracks: EditorTrack[]; settings: Settings }
export interface Asset { id: string; name: string; buffer: AudioBuffer }
export const newId = (): string => crypto.randomUUID();
export function newProject(): Project {
  return { version: 1, name: 'Mi proyecto', tracks: [], settings: { goal: 'song', clarity: 25, ambience: 10, level: 20 } };
}
export function projectDuration(p: Project): number {
  return Math.max(0, ...p.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)));
}
export function cloneProject(p: Project): Project { return structuredClone(p); }
export function validateProject(value: unknown, durations: Map<string, number>): Project {
  const p = value as Project;
  const finite = (x: unknown, low: number, high: number): boolean => typeof x === 'number' && Number.isFinite(x) && x >= low && x <= high;
  const fail = (): never => { throw new Error('El proyecto guardado no es válido o usa una versión incompatible.'); };
  if (!p || p.version !== 1 || typeof p.name !== 'string' || p.name.length > 200 || !Array.isArray(p.tracks) || p.tracks.length > MAX_TRACKS) fail();
  if (!p.settings || !['voice','song','master'].includes(p.settings.goal) || ![p.settings.clarity,p.settings.ambience,p.settings.level].every(x => finite(x,0,100))) fail();
  const ids = new Set<string>();
  const unique = (id: string) => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ids.has(id)) fail(); ids.add(id); };
  for (const t of p.tracks) {
    unique(t.id);
    if (typeof t.name !== 'string' || t.name.length > 200 || !['voice','instrument'].includes(t.role) || !finite(t.volume,0,100) || typeof t.mute !== 'boolean' || typeof t.solo !== 'boolean' || !Array.isArray(t.clips) || t.clips.length > 100) fail();
    for (const c of t.clips) {
      unique(c.id);
      const sourceDuration = durations.get(c.assetId);
      if (sourceDuration === undefined || !finite(c.start,0,MAX_PROJECT_SECONDS) || !finite(c.offset,0,sourceDuration) || !finite(c.duration,0.001,sourceDuration) || c.offset+c.duration > sourceDuration+0.00001 || c.start+c.duration > MAX_PROJECT_SECONDS || !finite(c.fadeIn,0,c.duration) || !finite(c.fadeOut,0,c.duration)) fail();
    }
  }
  if (p.tracks.reduce((n,t)=>n+t.clips.length,0) > 100) fail();
  return cloneProject(p);
}
export function splitClip(clip: Clip, time: number): [Clip, Clip] {
  const relative = time - clip.start;
  if (relative < 0.001 || relative > clip.duration - 0.001) throw new Error('Sitúa el cursor dentro del clip para dividirlo.');
  return [
    { ...clip, duration: relative, fadeIn: Math.min(clip.fadeIn,relative), fadeOut: 0 },
    { ...clip, id: newId(), start: time, offset: clip.offset + relative, duration: clip.duration-relative, fadeIn: 0, fadeOut: Math.min(clip.fadeOut,clip.duration-relative) },
  ];
}
export function trimClip(clip: Clip, startOffset: number, duration: number, sourceDuration: number): Clip {
  if (!Number.isFinite(startOffset) || !Number.isFinite(duration) || startOffset < 0 || duration < 0.001 || startOffset+duration > sourceDuration+0.00001) throw new Error('El recorte debe permanecer dentro del audio original.');
  return { ...clip, offset: startOffset, duration, fadeIn: Math.min(clip.fadeIn,duration), fadeOut: Math.min(clip.fadeOut,duration) };
}
/** Descriptor-only snapshots: immutable AudioBuffers remain in a separate registry. */
export class ProjectHistory {
  private past: Project[] = [];
  private future: Project[] = [];
  constructor(public current: Project = newProject(), private limit = 40) {}
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  commit(next: Project): void {
    this.past.push(cloneProject(this.current));
    if (this.past.length > this.limit) this.past.shift();
    this.current = cloneProject(next);
    this.future = [];
  }
  undo(): boolean {
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(cloneProject(this.current)); this.current = previous; return true;
  }
  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(cloneProject(this.current)); this.current = next; return true;
  }
  reset(p: Project): void { this.current = cloneProject(p); this.past = []; this.future = []; }
}
export function audibleTracks(p: Project): EditorTrack[] {
  const solo = p.tracks.some(t => t.solo);
  return p.tracks.filter(t => !t.mute && (!solo || t.solo));
}
/** Attenuate only: estimated loudness matching must never increase clipping risk. */
export function comparisonGains(before: number, after: number): { before: number; after: number } {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return { before: 1, after: 1 };
  const target = Math.min(before,after);
  return { before: 10 ** ((target-before)/20), after: 10 ** ((target-after)/20) };
}
