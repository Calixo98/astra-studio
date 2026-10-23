import { MAX_PROJECT_PCM, MAX_PROJECT_SECONDS, validateProject, type Asset, type Project } from './model';
export interface StoredAsset { id: string; name: string; rate: number; channels: Float32Array[] }
export interface SavedProject { schema: 1; savedAt: number; project: Project; assets: StoredAsset[] }
export function serializeProject(project: Project, assets: Map<string, Asset>): SavedProject {
  const used = new Set(project.tracks.flatMap(t => t.clips.map(c => c.assetId)));
  const data: StoredAsset[] = [];
  let bytes = 0;
  for (const id of used) {
    const asset = assets.get(id);
    if (!asset) throw new Error('Falta audio del proyecto.');
    const channels = Array.from({length:asset.buffer.numberOfChannels},(_,i)=>asset.buffer.getChannelData(i).slice());
    bytes += channels.reduce((n,c)=>n+c.byteLength,0);
    if (bytes > MAX_PROJECT_PCM) throw new Error('El proyecto supera 128 MiB de audio.');
    data.push({id,name:asset.name,rate:asset.buffer.sampleRate,channels});
  }
  return {schema:1,savedAt:Date.now(),project:structuredClone(project),assets:data};
}
export function validateSaved(value: unknown): SavedProject {
  const saved = value as SavedProject;
  if (!saved || saved.schema !== 1 || !Array.isArray(saved.assets) || saved.assets.length > 800) throw new Error('Guardado incompatible.');
  const durations = new Map<string,number>(); let bytes = 0;
  for (const a of saved.assets) {
    if (!a || typeof a.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(a.id) || durations.has(a.id) || typeof a.name !== 'string' || !Number.isFinite(a.rate) || a.rate < 8000 || a.rate > 192000 || !Array.isArray(a.channels) || a.channels.length < 1 || a.channels.length > 2) throw new Error('Audio guardado no válido.');
    const length = a.channels[0]?.length;
    if (!length || length/a.rate > MAX_PROJECT_SECONDS) throw new Error('Audio guardado demasiado largo.');
    for (const channel of a.channels) {
      if (!(channel instanceof Float32Array) || channel.length !== length) throw new Error('Canales guardados no válidos.');
      bytes += channel.byteLength;
      if (bytes > MAX_PROJECT_PCM) throw new Error('Guardado supera 128 MiB.');
      if (channel.some(x=>!Number.isFinite(x))) throw new Error('Muestras guardadas no válidas.');
    }
    durations.set(a.id,length/a.rate);
  }
  return {...saved,project:validateProject(saved.project,durations)};
}
async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open('astra-editor-v2',1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Almacenamiento local no disponible.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas de ASTRA para abrir el guardado.'));
  });
}
export async function readSaved(): Promise<SavedProject | null> {
  const db = await openDb();
  try {
    const result = await new Promise<unknown>((resolve,reject)=>{
      const tx=db.transaction('projects','readonly'); const req=tx.objectStore('projects').get('latest');
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
    return result ? validateSaved(result) : null;
  } finally { db.close(); }
}
export async function writeSaved(snapshot: SavedProject): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite');
      tx.objectStore('projects').put(snapshot,'latest');
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error ?? new Error('Guardado cancelado.'));
    });
  } finally { db.close(); }
}
export async function clearSaved(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite');
      tx.objectStore('projects').clear();
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error ?? new Error('No se pudo borrar el guardado.'));
    });
  } finally { db.close(); }
}
/** Serialize writes, invalidate queued snapshots, then drain before deletion. */
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private generation = 0;
  private deleting = false;
  enqueue(snapshot: SavedProject, writer: (s: SavedProject)=>Promise<void> = writeSaved): Promise<void> {
    if(this.deleting)return Promise.reject(new Error('Borrado local en curso.'));
    const token=this.generation;
    const operation=this.tail.catch(()=>{}).then(()=>{
      if(token!==this.generation)throw new Error('Guardado anterior descartado.');
      return writer(snapshot);
    });
    this.tail=operation; return operation;
  }
  clear(clearer: ()=>Promise<void> = clearSaved): Promise<void> {
    this.generation++; this.deleting=true;
    const operation=this.tail.catch(()=>{}).then(clearer);
    this.tail=operation;
    return operation.finally(()=>{this.deleting=false;});
  }
}
