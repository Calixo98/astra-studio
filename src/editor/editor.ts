import { ProjectHistory, newProject, newId, cloneProject, projectDuration, splitClip, trimClip, MAX_TRACKS, MAX_PROJECT_PCM, MAX_PROJECT_SECONDS, validateProject, type Asset, type Clip, type Project } from './model';
import { readSaved, serializeProject, SaveQueue, type SavedProject } from './storage';
import { renderPair, type RenderPair } from './render';
import { validateFile, validateAudio } from '../audio/converterHelpers';
import { downloadBlob } from '../audio/export';
import { drawWaveform } from '../ui/waveform';

const escape = (s: string): string => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const errorText = (e: unknown): string => e instanceof Error ? e.message : 'No se pudo completar la operación.';
export function initEditor(stopLegacy: () => void): void {
  const root=document.getElementById('tab-editor')!;
  root.innerHTML=`
    <section class="editor-intro"><div><p class="editor-kicker">TU ESTUDIO LOCAL · V2</p><h1>De la idea a tu mezcla.</h1><p>Importa, ordena y escucha. Tus archivos no salen de este navegador.</p></div><span class="editor-badge">Sin IA · Sin nube</span></section>
    <div class="editor-toolbar"><label>Proyecto <input id="ed-name" maxlength="100" value="Mi proyecto"></label><button id="ed-save">Guardar local</button><button id="ed-restore" disabled>Reabrir guardado</button><button id="ed-new">Nuevo proyecto</button><button id="ed-undo" disabled>Deshacer</button><button id="ed-redo" disabled>Rehacer</button></div>
    <p id="ed-save-status" class="panel-hint" role="status">Comprobando guardado local…</p>
    <section class="editor-guide" aria-label="Preparación guiada"><div><span class="editor-step">01</span><h2>¿Qué vas a crear?</h2><label>Objetivo <select id="ed-goal"><option value="song">Canción</option><option value="voice">Voz / podcast</option><option value="master">Masterizar mezcla</option></select></label><p class="panel-hint">Voz procesa todas las pistas; canción solo las marcadas como voz. Masterizar aplica tono y nivel global, sin reverb vocal.</p></div>
      <div><span class="editor-step">02</span><h2>Elige la intensidad</h2>${['clarity:Claridad:25','ambience:Ambiente:10','level:Nivel:20'].map(item=>{const [key,label,value]=item.split(':');return `<label>${label} <output id="ed-${key}-value">${value}%</output><input id="ed-${key}" data-setting="${key}" type="range" min="0" max="100" value="${value}"></label>`}).join('')}<p class="panel-hint">Ajustes deterministas, no eliminación de ruido. Ambiente no se usa en masterizar.</p></div></section>
    <section class="editor-workspace"><div class="editor-section-head"><div><span class="editor-step">03</span><h2>Construye tu arreglo</h2></div><label class="editor-import" id="ed-drop">+ Añadir audio<input id="ed-files" type="file" accept="audio/*,.mp3,.wav,.mpeg" multiple></label></div><p class="panel-hint">Arrastra archivos aquí o usa Añadir audio. Máximo 8 pistas, 25 MiB por archivo, 128 MiB PCM total y 3 minutos de arreglo. Originales intactos.</p>
    <div class="editor-transport"><button id="ed-play">▶ Escuchar</button><button id="ed-pause">Pausa</button><button id="ed-stop">Detener</button><label>Cursor (s) <input id="ed-cursor" type="number" min="0" step="any" value="0"></label><button id="ed-ab" aria-pressed="false">A/B: Después</button><span id="ed-position">0.00 s</span></div>
    <p class="panel-hint">A/B compara el mismo arreglo y atenúa la versión más fuerte según LUFS estimado. Antes mantiene volumen, fundidos y protección de muestras, sin macros. El archivo exportado no incluye esta atenuación de escucha.</p>
    <div id="ed-timeline" class="editor-timeline" aria-label="Pistas y clips"></div>
    <label class="editor-clip-picker">Seleccionar cualquier clip (incluso superpuestos) <select id="ed-select-clip"><option value="">Elige un clip</option></select></label>
    <form id="ed-clip-form" class="editor-clip-controls" hidden><h3>Clip seleccionado</h3><label>Posición (s)<input id="ed-clip-start" type="number" min="0" step="any" required></label><label>Inicio en original (s)<input id="ed-clip-offset" type="number" min="0" step="any" required></label><label>Duración (s)<input id="ed-clip-duration" type="number" min="0.001" step="any" required></label><label>Entrada suave (s)<input id="ed-clip-in" type="number" min="0" step="any" required></label><label>Salida suave (s)<input id="ed-clip-out" type="number" min="0" step="any" required></label><button type="submit">Aplicar al clip</button><button id="ed-split" type="button">Dividir en cursor</button><button id="ed-duplicate" type="button">Duplicar</button><button id="ed-delete-clip" type="button">Eliminar clip</button></form>
    <div class="editor-monitor"><canvas id="ed-spectrum" width="700" height="100" role="img" aria-label="Espectro de frecuencias y nivel de la escucha; descripción textual a continuación"></canvas><p id="ed-meter">Sin reproducción · Nivel y espectro de la escucha</p></div></section>
    <section class="editor-output"><div><span class="editor-step">04</span><h2>Tu mezcla, lista para escuchar</h2><p id="ed-analysis">Renderiza para obtener una estimación de nivel. No es una certificación de mastering.</p></div><div><button id="ed-render">Preparar mezcla</button><label>Formato <select id="ed-format"><option value="wav">WAV PCM16</option><option value="mp3-192">MP3 192 kbps</option><option value="mp3-320">MP3 320 kbps</option></select></label><button id="ed-download" disabled>Descargar mezcla</button></div></section>
    <p id="ed-status" class="editor-status" role="status" aria-live="polite">Importa tus pistas para comenzar.</p><p class="panel-hint">Herramientas avanzadas: Voz, Master, Mezcla y Exportar conservan su sesión independiente. Sus controles no modifican este editor. El Conversor también es independiente.</p>`;
  const $=<T extends HTMLElement=HTMLElement>(id: string): T=>root.querySelector<T>('#'+id)!;
  const input=(id: string)=>$<HTMLInputElement>(id);
  const button=(id: string)=>$<HTMLButtonElement>(id);
  const history=new ProjectHistory();
  let assets=new Map<string,Asset>();
  let selected: string | null=null;
  let revision=0, pair: RenderPair | null=null, pairRevision=-1;
  let rendering=false, importing=false, encoding=false, initializing=true;
  let saved: SavedProject | null=null, allowAutosave=false;
  const saves=new SaveQueue(); let saveTimer: number | undefined;
  let cursor=0, before=false, playing=false, startTime=0, playEpoch=0;
  const ctx=new AudioContext();
  const gain=ctx.createGain(), analyser=ctx.createAnalyser(); analyser.fftSize=1024;
  gain.connect(analyser); analyser.connect(ctx.destination);
  let source: AudioBufferSourceNode | null=null;
  const p=()=>history.current;
  const status=(message: string)=>{$('ed-status').textContent=message;};
  const position=()=>playing ? Math.min(cursor+ctx.currentTime-startTime,pair?.after.duration ?? projectDuration(p())) : cursor;
  function stop(reset=true): void {
    playEpoch++;
    const at=position(); playing=false;
    if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}
    cursor=reset ? 0 : at;
    input('ed-cursor').value=cursor.toFixed(2); $('ed-position').textContent=cursor.toFixed(2)+' s';
  }
  function updateButtons(): void {
    button('ed-undo').disabled=!history.canUndo || importing;
    button('ed-redo').disabled=!history.canRedo || importing;
    button('ed-play').disabled=initializing || importing || rendering || !projectDuration(p());
    button('ed-render').disabled=initializing || importing || rendering || !projectDuration(p());
    button('ed-download').disabled=encoding || !pair || pairRevision!==revision;
    button('ed-new').disabled=initializing || importing;
    button('ed-save').disabled=initializing || importing;
    button('ed-restore').disabled=initializing || importing || !saved;
    input('ed-files').disabled=initializing || importing;
  }
  async function saveNow(): Promise<void> {
    if(!allowAutosave){$('ed-save-status').textContent='Hay un guardado anterior. Reábrelo o pulsa Guardar local para reemplazarlo.';return;}
    const token=revision;
    try {
      const snapshot=serializeProject(p(),assets);
      $('ed-save-status').textContent='Guardando solo en este navegador…';
      await saves.enqueue(snapshot);
      saved=snapshot;
      if(token===revision)$('ed-save-status').textContent='Guardado local completado. Puede borrarse al limpiar los datos del navegador.';
      updateButtons();
    } catch(e) {$('ed-save-status').textContent='No se guardó: '+errorText(e)+' Comprueba espacio/cuota y permisos de almacenamiento.';}
  }
  function scheduleSave(): void {
    clearTimeout(saveTimer);
    saveTimer=window.setTimeout(()=>void saveNow(),900);
  }
  function changed(next?: Project): void {
    stop(false);
    if(next)history.commit(next);
    revision++;pair=null;pairRevision=-1;
    $('ed-analysis').textContent='La mezcla cambió. Prepara una nueva escucha/exportación.';
    draw();scheduleSave();
  }
  function edit(action: (next: Project)=>void): void {
    try {const next=cloneProject(p());action(next);validateProject(next,new Map([...assets.values()].map(a=>[a.id,a.buffer.duration])));if(next.tracks.flatMap(t=>t.clips).length>100)throw new Error('Máximo 100 clips por proyecto.');if(projectDuration(next)>MAX_PROJECT_SECONDS)throw new Error('El arreglo supera 3 minutos.');changed(next);}
    catch(e){status(errorText(e));}
  }
  function selection(): {track: Project['tracks'][number];clip: Clip} | null {
    for(const track of p().tracks){const clip=track.clips.find(c=>c.id===selected);if(clip)return {track,clip};}return null;
  }
  function select(id: string): void {selected=id;draw();}
  function draw(): void {
    input('ed-name').value=p().name;
    $<HTMLSelectElement>('ed-goal').value=p().settings.goal;
    for(const key of ['clarity','ambience','level'] as const){input('ed-'+key).value=String(p().settings[key]);$('ed-'+key+'-value').textContent=p().settings[key]+'%';}
    const span=Math.max(10,projectDuration(p()));
    $('ed-timeline').innerHTML=p().tracks.length ? `<div class="editor-ruler"><span>Pista</span><span>0 s <b>${span.toFixed(1)} s</b></span></div>`+p().tracks.map(t=>`<div class="editor-track"><div class="editor-track-head"><strong>${escape(t.name)}</strong><label>Tipo <select data-track="${t.id}" data-field="role"><option value="instrument" ${t.role==='instrument'?'selected':''}>Instrumental</option><option value="voice" ${t.role==='voice'?'selected':''}>Voz</option></select></label><label>Volumen <input aria-label="Volumen de ${escape(t.name)}" data-track="${t.id}" data-field="volume" type="range" min="0" max="100" value="${t.volume}"></label><div><button data-track="${t.id}" data-action="mute" aria-pressed="${t.mute}" aria-label="Silenciar ${escape(t.name)}">M</button><button data-track="${t.id}" data-action="solo" aria-pressed="${t.solo}" aria-label="Solo ${escape(t.name)}">S</button><button data-track="${t.id}" data-action="remove" aria-label="Eliminar pista ${escape(t.name)}">Quitar</button></div></div><div class="editor-lane" data-lane="${t.id}">${t.clips.map(c=>`<button class="editor-clip ${c.id===selected?'selected':''}" data-clip="${c.id}" style="left:${c.start/span*100}%;width:${Math.max(.6,c.duration/span*100)}%" aria-pressed="${c.id===selected}" aria-label="Clip ${escape(t.name)}, posición ${c.start.toFixed(2)} segundos, duración ${c.duration.toFixed(2)} segundos"><canvas width="500" height="60" aria-hidden="true"></canvas><span>${escape(assets.get(c.assetId)?.name ?? 'Audio')}</span></button>`).join('')}</div></div>`).join('') : '<div class="editor-empty">Tu lienzo está vacío. Añade voz, instrumentos o una mezcla.</div>';
    for(const el of root.querySelectorAll<HTMLButtonElement>('[data-clip]')){
      const clip=p().tracks.flatMap(t=>t.clips).find(c=>c.id===el.dataset.clip)!;
      const asset=assets.get(clip.assetId);
      const canvas=el.querySelector('canvas')!;
      if(asset){
        // Draw only the source segment, without modifying the original AudioBuffer.
        const sr=asset.buffer.sampleRate,start=Math.floor(clip.offset*sr),length=Math.max(1,Math.floor(clip.duration*sr));
        const original=asset.buffer;
        drawWaveform(canvas,{getChannelData:(ch:number)=>original.getChannelData(ch).subarray(start,start+length),length,sampleRate:sr,numberOfChannels:original.numberOfChannels,duration:clip.duration} as AudioBuffer);
      }
      el.addEventListener('click',()=>select(clip.id));
      el.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;
        const startX=event.clientX,initial=clip.start,lane=el.parentElement!;
        el.setPointerCapture(event.pointerId);
        el.onpointerup=up=>{
          const delta=(up.clientX-startX)/lane.clientWidth*span;
          el.onpointerup=null;
          selected=clip.id;
          if(Math.abs(up.clientX-startX)>4)edit(next=>{const target=next.tracks.flatMap(t=>t.clips).find(c=>c.id===clip.id)!;target.start=Math.max(0,Math.min(MAX_PROJECT_SECONDS-target.duration,initial+delta));});
        };
      });
    }
    const chooser=$<HTMLSelectElement>('ed-select-clip');
    chooser.innerHTML='<option value="">Elige un clip</option>'+p().tracks.flatMap(t=>t.clips.map(c=>`<option value="${c.id}">${escape(t.name)} · ${c.start.toFixed(2)} s · ${c.duration.toFixed(2)} s</option>`)).join('');
    chooser.value=selected??'';
    const chosen=selection();
    $('ed-clip-form').hidden=!chosen;
    if(chosen){const c=chosen.clip;for(const [key,value] of Object.entries({start:c.start,offset:c.offset,duration:c.duration,in:c.fadeIn,out:c.fadeOut}))input('ed-clip-'+key).value=String(value);}
    updateButtons();
  }
  async function importFiles(files: File[]): Promise<void> {
    if(importing || initializing)return;
    importing=true;updateButtons();status('Leyendo audio local…');
    let count=0;const errors:string[]=[];
    try {
      for(const file of files){
        if(p().tracks.length>=MAX_TRACKS){errors.push('Máximo 8 pistas.');break;}
        try {
          validateFile(file.size);
          const buffer=await ctx.decodeAudioData(await file.arrayBuffer());
          validateAudio(buffer.numberOfChannels,buffer.length,buffer.sampleRate);
          if(buffer.duration<0.001)throw new Error('El audio es demasiado corto para crear un clip.');
          if(buffer.duration>MAX_PROJECT_SECONDS)throw new Error('Cada audio del editor debe durar como máximo 3 minutos.');
          const bytes=[...assets.values()].reduce((n,a)=>n+a.buffer.length*a.buffer.numberOfChannels*4,0)+buffer.length*buffer.numberOfChannels*4;
          if(bytes>MAX_PROJECT_PCM)throw new Error('Límite de 128 MiB PCM alcanzado. Crea un proyecto nuevo para liberar originales e historial.');
          const id=newId();assets.set(id,{id,name:file.name,buffer});
          const next=cloneProject(p());next.tracks.push({id:newId(),name:file.name.slice(0,100),role:p().settings.goal==='voice'?'voice':'instrument',volume:80,mute:false,solo:false,clips:[{id:newId(),assetId:id,start:0,offset:0,duration:buffer.duration,fadeIn:Math.min(0.01,buffer.duration/2),fadeOut:Math.min(0.01,buffer.duration/2)}]});
          changed(next);count++;
        }catch(e){errors.push(file.name+': '+errorText(e));}
      }
    }finally{importing=false;updateButtons();status(`${count} pista(s) añadida(s). ${errors.join(' ')}`);}
  }
  async function prepare(): Promise<RenderPair | null> {
    if(pair && pairRevision===revision)return pair;
    if(rendering || importing)return null;
    rendering=true;updateButtons();const token=revision;status('Preparando antes/después con el arreglo completo…');
    try {
      const snapshot=cloneProject(p());const result=await renderPair(snapshot,new Map(assets));
      if(token!==revision){status('El arreglo cambió durante la preparación. Vuelve a escuchar.');return null;}
      pair=result;pairRevision=token;
      $('ed-analysis').textContent=`Nivel integrado estimado: ${Number.isFinite(result.integrated)?result.integrated.toFixed(1)+' LUFS':'no disponible (señal corta/baja)'}. Pico interpolado estimado: ${result.peak.toFixed(1)} dB. Sin certificación. ${result.matched?'A/B con igualación estimada por atenuación.':'A/B sin igualación: loudness insuficiente para comparar.'}`;
      status('Mezcla preparada. Descarga el resultado procesado o compara A/B.');return result;
    }catch(e){pair=null;status(errorText(e));return null;}
    finally{rendering=false;updateButtons();}
  }
  async function play(): Promise<void> {
    stopLegacy();stop(false);const request=playEpoch;
    try {await ctx.resume();}catch(e){status(errorText(e));return;}
    if(request!==playEpoch)return;
    const result=await prepare();if(!result || request!==playEpoch || !root.classList.contains('active'))return;
    const buffer=before?result.before:result.after;
    if(cursor>=buffer.duration)cursor=0;
    gain.gain.value=before?result.gains.before:result.gains.after;
    source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);
    source.start(0,cursor);startTime=ctx.currentTime;playing=true;
    source.onended=()=>{stop();};
    requestAnimationFrame(monitor);
  }
  function monitor(): void {
    if(!playing)return;
    const time=position();$('ed-position').textContent=time.toFixed(2)+' s';input('ed-cursor').value=time.toFixed(2);
    const frequency=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(frequency);
    const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);
    let peak=0;for(const x of samples)peak=Math.max(peak,Math.abs(x));
    $('ed-meter').textContent=`Escucha ${before?'antes':'después'} · pico de muestras ${20*Math.log10(Math.max(peak,1e-8)) < -100?'—':(20*Math.log10(Math.max(peak,1e-8))).toFixed(1)+' dBFS'} · ajuste A/B estimado`;
    const canvas=$<HTMLCanvasElement>('ed-spectrum'),g=canvas.getContext('2d')!;
    g.clearRect(0,0,canvas.width,canvas.height);g.fillStyle='#d4af37';
    for(let i=0;i<80;i++){const h=frequency[Math.floor(i/80*frequency.length)]/255*canvas.height;g.fillRect(i*canvas.width/80,canvas.height-h,canvas.width/80-2,h);}
    for(const lane of root.querySelectorAll<HTMLElement>('.editor-lane'))lane.style.setProperty('--playhead',`${time/Math.max(10,projectDuration(p()))*100}%`);
    requestAnimationFrame(monitor);
  }
  async function exportAudio(): Promise<void> {
    if(encoding || !pair || pairRevision!==revision)return;
    encoding=true;updateButtons();const token=revision,buffer=pair.after;
    const format=$<HTMLSelectElement>('ed-format').value;
    const worker=new Worker(new URL('../audio/converterWorker.ts',import.meta.url),{type:'module'});
    status('Codificando en segundo plano local…');
    try {
      const blob=await new Promise<Blob>((resolve,reject)=>{
        const timeout=window.setTimeout(()=>reject(new Error('La codificación tardó demasiado. Intenta WAV.')),120000);
        worker.onmessage=e=>{clearTimeout(timeout);e.data.error?reject(new Error(e.data.error)):resolve(e.data.blob);};
        worker.onerror=()=>{clearTimeout(timeout);reject(new Error('No se pudo codificar el audio.'));};
        const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
        worker.postMessage({channels,rate:buffer.sampleRate,format:format==='wav'?'wav':'mp3',bitrate:format==='mp3-192'?192:320},channels.map(c=>c.buffer));
      });
      if(token!==revision){status('El proyecto cambió. Se descartó la descarga anterior.');return;}
      downloadBlob(blob,`${p().name.replace(/[^\p{L}\p{N} _-]/gu,'_') || 'astra-mezcla'}.${format==='wav'?'wav':'mp3'}`);
      status('Descarga generada desde la mezcla procesada exacta, sin atenuación A/B.');
    }catch(e){status(errorText(e));}finally{worker.terminate();encoding=false;updateButtons();}
  }
  input('ed-files').addEventListener('change',()=>{void importFiles(Array.from(input('ed-files').files??[]));input('ed-files').value='';});
  $('ed-drop').addEventListener('dragover',e=>{e.preventDefault();});
  $('ed-drop').addEventListener('drop',e=>{e.preventDefault();void importFiles(Array.from((e as DragEvent).dataTransfer?.files??[]));});
  input('ed-name').addEventListener('change',()=>edit(next=>{next.name=input('ed-name').value || 'Mi proyecto';}));
  $<HTMLSelectElement>('ed-goal').addEventListener('change',()=>edit(next=>{next.settings.goal=$<HTMLSelectElement>('ed-goal').value as Project['settings']['goal'];}));
  for(const el of root.querySelectorAll<HTMLInputElement>('[data-setting]'))el.addEventListener('change',()=>edit(next=>{next.settings[el.dataset.setting as 'clarity'|'ambience'|'level']=Number(el.value);}));
  $('ed-timeline').addEventListener('change',e=>{
    const el=e.target as HTMLInputElement;if(!el.dataset.track)return;
    edit(next=>{const t=next.tracks.find(t=>t.id===el.dataset.track)!;if(el.dataset.field==='role')t.role=el.value as 'voice'|'instrument';else t.volume=Number(el.value);});
  });
  $('ed-timeline').addEventListener('click',e=>{
    const el=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(!el)return;
    edit(next=>{const t=next.tracks.find(t=>t.id===el.dataset.track)!;if(el.dataset.action==='remove')next.tracks=next.tracks.filter(x=>x!==t);else if(el.dataset.action==='mute')t.mute=!t.mute;else t.solo=!t.solo;});
  });
  $<HTMLSelectElement>('ed-select-clip').addEventListener('change',()=>select($<HTMLSelectElement>('ed-select-clip').value));
  $('ed-clip-form').addEventListener('submit',e=>{
    e.preventDefault();const chosen=selection();if(!chosen)return;
    edit(next=>{
      const t=next.tracks.find(t=>t.id===chosen.track.id)!;const i=t.clips.findIndex(c=>c.id===selected);
      const c=trimClip(t.clips[i],Number(input('ed-clip-offset').value),Number(input('ed-clip-duration').value),assets.get(chosen.clip.assetId)!.buffer.duration);
      const start=Number(input('ed-clip-start').value),fadeIn=Number(input('ed-clip-in').value),fadeOut=Number(input('ed-clip-out').value);
      if(![start,fadeIn,fadeOut].every(x=>Number.isFinite(x)&&x>=0)||fadeIn>c.duration||fadeOut>c.duration)throw new Error('Posición o fundidos no válidos.');
      t.clips[i]={...c,start,fadeIn,fadeOut};
    });
  });
  button('ed-split').addEventListener('click',()=>{const chosen=selection();if(!chosen)return;edit(next=>{const t=next.tracks.find(t=>t.id===chosen.track.id)!;t.clips.splice(t.clips.findIndex(c=>c.id===selected),1,...splitClip(chosen.clip,cursor));});});
  button('ed-duplicate').addEventListener('click',()=>{const chosen=selection();if(!chosen)return;edit(next=>{if(next.tracks.flatMap(t=>t.clips).length>=100)throw new Error('Máximo 100 clips por proyecto.');next.tracks.find(t=>t.id===chosen.track.id)!.clips.push({...chosen.clip,id:newId(),start:chosen.clip.start+chosen.clip.duration});});});
  button('ed-delete-clip').addEventListener('click',()=>{if(selected)edit(next=>{for(const t of next.tracks)t.clips=t.clips.filter(c=>c.id!==selected);});});
  button('ed-undo').addEventListener('click',()=>{if(history.undo())changed();});
  button('ed-redo').addEventListener('click',()=>{if(history.redo())changed();});
  button('ed-play').addEventListener('click',()=>void play());
  button('ed-pause').addEventListener('click',()=>stop(false));button('ed-stop').addEventListener('click',()=>stop());
  input('ed-cursor').addEventListener('change',()=>{const requested=Number(input('ed-cursor').value)||0;stop(false);cursor=Math.max(0,Math.min(requested,pair?.after.duration??projectDuration(p())));input('ed-cursor').value=cursor.toFixed(2);});
  button('ed-ab').addEventListener('click',()=>{const resume=playing;stop(false);before=!before;button('ed-ab').textContent='A/B: '+(before?'Antes':'Después');button('ed-ab').setAttribute('aria-pressed',String(before));if(resume)void play();});
  button('ed-render').addEventListener('click',()=>void prepare());button('ed-download').addEventListener('click',()=>void exportAudio());
  button('ed-save').addEventListener('click',()=>{if(saved&&!allowAutosave&&!confirm('¿Reemplazar el proyecto guardado en este navegador con el actual?'))return;allowAutosave=true;clearTimeout(saveTimer);void saveNow();});
  button('ed-new').addEventListener('click',()=>{if(!confirm('¿Crear un proyecto nuevo? El guardado local se reemplazará y se vaciarán el audio y el historial actuales.'))return;clearTimeout(saveTimer);stop();assets=new Map();history.reset(newProject());selected=null;allowAutosave=true;changed();void saveNow();});
  button('ed-restore').addEventListener('click',()=>{
    if(!saved || !confirm('¿Reabrir el guardado local y reemplazar los cambios actuales no guardados?'))return;
    clearTimeout(saveTimer);stop();const restored=new Map<string,Asset>();
    try {for(const a of saved.assets){const buffer=ctx.createBuffer(a.channels.length,a.channels[0].length,a.rate);a.channels.forEach((c,i)=>buffer.copyToChannel(new Float32Array(c),i));restored.set(a.id,{id:a.id,name:a.name,buffer});}
      assets=restored;history.reset(saved.project);selected=null;allowAutosave=true;changed();status('Proyecto local reabierto.');
    }catch(e){status('No se pudo reabrir: '+errorText(e));}
  });
  document.addEventListener('astra:tab-change',e=>{if((e as CustomEvent<string>).detail!=='editor')stop(false);else stopLegacy();});
  document.querySelectorAll<HTMLButtonElement>('.transport button').forEach(b=>b.addEventListener('click',()=>stop(false)));
  window.addEventListener('keydown',e=>{
    if(e.code!=='Space' || !root.classList.contains('active'))return;
    const target=e.target as HTMLElement;
    if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(target.tagName))return;
    e.preventDefault();if(playing)stop(false);else void play();
  });
  window.addEventListener('pagehide',()=>{stop();clearTimeout(saveTimer);});
  draw();
  void (async()=>{try{saved=await readSaved();allowAutosave=!saved;$('ed-save-status').textContent=saved?'Hay un proyecto local. Pulsa Reabrir guardado para recuperarlo; no se reemplaza automáticamente.':'Autoguardado local tras cada cambio. No se sincroniza ni sube audio.';}catch(e){$('ed-save-status').textContent='Guardado local no disponible: '+errorText(e);}finally{initializing=false;updateButtons();}})();
}
