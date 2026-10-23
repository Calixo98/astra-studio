import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const read = p => fs.readFile(new URL('../src/'+p,import.meta.url),'utf8');
const url = s => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const helpersUrl=url(await read('audio/converterHelpers.ts'));
const {decodeFile,validateAudio,validateChannels,MAX_FILE_BYTES}=await import(helpersUrl);
const pcm={numberOfChannels:1,length:8000,sampleRate:8000,duration:1};
const tick=()=>new Promise(r=>setTimeout(r,0));
test('import budgets reject invalid metadata before reading and reject malformed PCM',async()=>{
 let reads=0;const file={size:MAX_FILE_BYTES+1,arrayBuffer(){reads++;}};
 await assert.rejects(decodeFile(file,{}),/25 MiB/);assert.equal(reads,0);
 for(const args of [[NaN,1,44100],[1,NaN,44100],[1,1,7999],[1,1,192001],[1,8000*181,8000,180]])assert.throws(()=>validateAudio(...args));
 for(const channels of [null,[],[[0]],[new Float32Array(1),new Float32Array(2)],[Float32Array.of(NaN)]])assert.throws(()=>validateChannels(channels,8000));
});
test('decode gate serializes, caps pending work, rejects stale work and releases after failure',async()=>{
 let release,active=0,peak=0,first=true,current=true,reads=0;
 const file={size:1,async arrayBuffer(){reads++;return new ArrayBuffer(1)}};
 const ctx={async decodeAudioData(){active++;peak=Math.max(peak,active);if(first){first=false;await new Promise(r=>release=r);}active--;return pcm;}};
 const a=decodeFile(file,ctx,()=>current);await tick();
 const b=decodeFile(file,ctx);await assert.rejects(decodeFile(file,ctx),/procesándose/);
 current=false;release();await assert.rejects(a,{name:'AbortError'});assert.equal(await b,pcm);assert.equal(peak,1);assert.equal(reads,2);
 await assert.rejects(decodeFile(file,{decodeAudioData(){throw Error('bad')}}),/bad/);
 assert.equal(await decodeFile(file,ctx),pcm);
});
test('worker encoding cancellation terminates worker and never transfers original buffers',async()=>{
 const previous=globalThis.Worker;let instance;
 globalThis.Worker=class {constructor(){instance=this;this.terminated=false;}terminate(){this.terminated=true;}postMessage(message){this.message=message;}};
 try{
  const source=(await read('audio/encodeWorker.ts')).replace("'./converterHelpers'",JSON.stringify(helpersUrl)).replace("new URL('./converterWorker.ts', import.meta.url)","'worker.js'");
  const {encodeInWorker}=await import(url(source));const data=Float32Array.of(.1,.2);
  const ac=new AbortController();const pending=encodeInWorker({...pcm,length:2,getChannelData:()=>data},'mp3',192,ac.signal);
  assert.notEqual(instance.message.channels[0].buffer,data.buffer);ac.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(instance.terminated,true);assert.equal(data.length,2);
  const before=instance;await assert.rejects(encodeInWorker({...pcm,getChannelData:()=>data},'mp3',192,ac.signal),{name:'AbortError'});assert.equal(instance,before);
 }finally{globalThis.Worker=previous;}
});
test('recorder chunks, deadline, global stop, visibility and pending permission release',async()=>{
 const stateUrl=url(await read('audio/state.ts'));
 const {initRecorder,MAX_RECORDING_MS,MAX_RECORDING_BYTES}=await import(url((await read('ui/recorder.ts')).replace("'../audio/state'",JSON.stringify(stateUrl))));
 const original=Object.fromEntries(['document','window','navigator','MediaRecorder','File'].map(k=>[k,globalThis[k]]));
 const element=()=>({disabled:false,hidden:true,textContent:'',classList:{add(){},remove(){}},addEventListener(k,f){this[k]=f;}});
 const elements=Object.fromEntries(['btn-rec','rec-time','rec-hint','global-recording','global-recording-status','global-recording-stop'].map(k=>[k,element()]));
 const events={},timers=new Map();let next=0,stopped=0,rec,recorded=0,permissionResolve;
 const stream=()=>({getTracks:()=>[{stop(){stopped++;}}]});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getUserMedia(){return stream();}}}});
 globalThis.document={hidden:false,getElementById:k=>elements[k],addEventListener(k,f){events[k]=f;}};
 globalThis.window={setTimeout(f,ms){timers.set(++next,{f,ms});return next;},clearTimeout(id){timers.delete(id);},setInterval(){return 100;},clearInterval(){},addEventListener(k,f){events[k]=f;}};
 globalThis.File=class extends Blob{constructor(parts,name,options){super(parts,options);this.name=name;}};
 globalThis.MediaRecorder=class{constructor(){rec=this;this.state='inactive';this.mimeType='audio/webm';}start(ms){this.slice=ms;this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>this.onstop?.());}};
 try{
  initRecorder({stop(){},applyMix(){},ctx:{async resume(){}},tracks:{beat:{buffer:null}}},async()=>{recorded++;});
  elements['btn-rec'].click();await tick();assert.equal(rec.slice,1000);assert.equal(elements['global-recording'].hidden,false);
  rec.ondataavailable({data:new Blob(['sample'])});elements['global-recording-stop'].click();await tick();assert.equal(stopped,1);assert.equal(recorded,1);assert.equal(elements['global-recording'].hidden,true);
  elements['btn-rec'].click();await tick();rec.ondataavailable({data:{size:MAX_RECORDING_BYTES+1}});await tick();assert.equal(recorded,1);assert.match(elements['rec-hint'].textContent,/25 MiB/);assert.equal(stopped,2);
  elements['btn-rec'].click();await tick();const deadline=[...timers.values()].find(t=>t.ms===MAX_RECORDING_MS);assert.ok(deadline);deadline.f();await tick();assert.equal(stopped,3);
  elements['btn-rec'].click();await tick();document.hidden=true;events.visibilitychange();await tick();assert.equal(stopped,4);assert.equal(recorded,1);document.hidden=false;
  navigator.mediaDevices.getUserMedia=()=>new Promise(r=>permissionResolve=r);elements['btn-rec'].click();elements['global-recording-stop'].click();permissionResolve(stream());await tick();assert.equal(stopped,5);assert.equal(elements['btn-rec'].disabled,false);
 }finally{for(const [key,value] of Object.entries(original))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
});

test('save deletion drains current write, rejects queued snapshots and blocks new writes',async()=>{
 const modelUrl=url(await read('editor/model.ts'));
 const {SaveQueue}=await import(url((await read('editor/storage.ts')).replace("'./model'",JSON.stringify(modelUrl))));
 const queue=new SaveQueue();let release;const writes=[];
 const first=queue.enqueue({name:'first'},async s=>{await new Promise(r=>release=r);writes.push(s.name);});await tick();
 const queued=queue.enqueue({name:'stale'},async s=>writes.push(s.name));
 const rejected=assert.rejects(queued,/descartado/);
 const deletion=queue.clear(async()=>writes.splice(0));
 await assert.rejects(queue.enqueue({},async()=>{}),/Borrado/);
 release();await first;await rejected;await deletion;assert.deepEqual(writes,[]);
 await queue.enqueue({name:'new'},async s=>writes.push(s.name));assert.deepEqual(writes,['new']);
 await assert.rejects(queue.clear(async()=>{throw Error('quota')}),/quota/);
 await queue.enqueue({},async()=>writes.push('recovered'));assert.equal(writes.at(-1),'recovered');
});
test('versioned browser headers and same-origin worklet have no script-inline/eval exceptions',async()=>{
 const config=JSON.parse((await fs.readFile(new URL('../vercel.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
 const headers=Object.fromEntries(config.headers[0].headers.map(h=>[h.key,h.value]));
 const csp=headers['Content-Security-Policy'];
 assert.equal(config.headers[0].source,'/(.*)');
 assert.match(csp,/script-src 'self';/);assert.match(csp,/worker-src 'self';/);
 assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/base-uri 'none'/);assert.match(csp,/object-src 'none'/);
 assert.doesNotMatch(csp,/script-src[^;]*(unsafe-inline|unsafe-eval|blob:)/);
 assert.equal(headers['Permissions-Policy'],'microphone=(self), camera=(), geolocation=()');
 assert.equal(headers['X-Content-Type-Options'],'nosniff');
 const wrapper=await read('audio/lufsWorklet.ts');assert.match(wrapper,/new URL\('\.\/lufsProcessor.js', import.meta.url\)/);assert.doesNotMatch(wrapper,/createObjectURL|WORKLET_CODE/);
 assert.match(await read('audio/lufsProcessor.js'),/registerProcessor\('lufs-processor'/);
 const editor=await read('editor/editor.ts');assert.match(editor,/saveGeneration\+\+;clearTimeout\(saveTimer\)/);assert.match(editor,/history.reset\(newProject\(\)\)/);assert.match(editor,/allowAutosave=false;draw\(\)/);
});

test('CI is least-privilege, immutable-pinned and audits build dependencies independently',async()=>{
 const workflow=await fs.readFile(new URL('../.github/workflows/checks.yml',import.meta.url),'utf8');
 assert.match(workflow,/permissions:\s+contents: read/);assert.doesNotMatch(workflow,/pull_request_target|secrets\.|contents: write|npm audit[^\n]*\|\|/);
 const uses=[...workflow.matchAll(/uses: ([^\s#]+)/g)].map(m=>m[1]);assert.equal(uses.length,4);
 for(const action of uses)assert.match(action,/^actions\/(checkout|setup-node)@[a-f0-9]{40}$/);
 assert.match(workflow,/persist-credentials: false/);assert.match(workflow,/run: npm ci/);assert.match(workflow,/run: npm test/);assert.match(workflow,/run: npm run typecheck/);assert.match(workflow,/run: npm run build/);
 assert.match(workflow,/run: npm audit --omit=dev/);assert.match(workflow,/if: always\(\)\s+run: npm audit\s/);
 const updates=await fs.readFile(new URL('../.github/dependabot.yml',import.meta.url),'utf8');assert.match(updates,/package-ecosystem: npm/);assert.match(updates,/package-ecosystem: github-actions/);assert.equal([...updates.matchAll(/interval: weekly/g)].length,2);
});
