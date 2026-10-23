import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const read = file => fs.readFile(new URL('../src/editor/'+file,import.meta.url),'utf8');
const moduleUrl = source => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const helpersUrl=moduleUrl(await fs.readFile(new URL('../src/audio/converterHelpers.ts',import.meta.url),'utf8'));
const modelUrl=moduleUrl(await read('model.ts'));
const {newProject,ProjectHistory,splitClip,trimClip,validateProject,projectDuration,audibleTracks,comparisonGains,MAX_PROJECT_SECONDS}=await import(modelUrl);
const {serializeProject,validateSaved,SaveQueue}=await import(moduleUrl((await read('storage.ts')).replace("'./model'",JSON.stringify(modelUrl))));
const clip=()=>({id:'clip-1',assetId:'asset-1',start:3,offset:2,duration:5,fadeIn:.5,fadeOut:.5});
const fixture=()=>({...newProject(),tracks:[{id:'track-1',name:'voice',role:'voice',volume:80,mute:false,solo:false,clips:[clip()]}]});
const durations=new Map([['asset-1',10]]);
test('splitting preserves timeline and source continuity without source mutation',()=>{
  const original=clip(),[a,b]=splitClip(original,5);
  assert.equal(a.start+a.duration,b.start);
  assert.equal(a.offset+a.duration,b.offset);
  assert.equal(a.duration+b.duration,original.duration);
  assert.equal(a.fadeOut,0);assert.equal(b.fadeIn,0);
  assert.notEqual(a.id,b.id);assert.equal(original.duration,5);
  assert.throws(()=>splitClip(original,3),/cursor/);
  assert.throws(()=>splitClip(original,8),/cursor/);
});
test('trimming is non-destructive and rejects missing source bounds',()=>{
  const original=clip();const result=trimClip(original,3,4,10);
  assert.equal(result.start,3);assert.equal(result.offset,3);assert.equal(result.duration,4);
  assert.equal(original.offset,2);
  for(const [offset,duration] of [[-1,3],[9,2],[0,0],[NaN,2],[2,Infinity]])assert.throws(()=>trimClip(original,offset,duration,10));
});
test('project descriptors validate asset references, limits and injection-prone identities',()=>{
  assert.equal(validateProject(fixture(),durations).version,1);
  for(const mutate of [p=>p.version=2,p=>p.tracks[0].clips[0].assetId='missing',p=>p.tracks[0].clips[0].duration=20,p=>p.tracks[0].clips[0].start=MAX_PROJECT_SECONDS,p=>p.tracks[0].volume=NaN,p=>p.tracks[0].id='x" onclick="bad',p=>p.settings.clarity=101]){
    const p=fixture();mutate(p);assert.throws(()=>validateProject(p,durations));
  }
  const p=fixture();p.tracks[0].clips.push({...clip()});assert.throws(()=>validateProject(p,durations));
});
test('history stores descriptors only, bounds snapshots, clears redo after branching',()=>{
  const h=new ProjectHistory(newProject(),2);
  for(const name of ['first','second','third'])h.commit({...newProject(),name});
  assert.equal(h.current.name,'third');assert.equal(h.undo(),true);assert.equal(h.current.name,'second');assert.equal(h.undo(),true);assert.equal(h.current.name,'first');assert.equal(h.undo(),false);
  assert.equal(h.redo(),true);h.commit(fixture());assert.equal(h.canRedo,false);
  const next=fixture();h.commit(next);next.tracks[0].clips[0].offset=9;assert.equal(h.current.tracks[0].clips[0].offset,2);
  assert.equal(JSON.stringify(h.current).includes('channels'),false);
});
test('solo and mute resolve across arbitrary tracks; project duration uses clip placement',()=>{
  const p=fixture();p.tracks.push({...p.tracks[0],id:'track-2',solo:true});
  assert.deepEqual(audibleTracks(p).map(t=>t.id),['track-2']);p.tracks[1].mute=true;assert.equal(audibleTracks(p).length,0);
  assert.equal(projectDuration(p),8);
});
test('comparison matching attenuates louder version only and handles unavailable estimates',()=>{
  assert.deepEqual(comparisonGains(-14,-14),{before:1,after:1});
  const g=comparisonGains(-18,-12);assert.equal(g.before,1);assert.ok(Math.abs(g.after-.501187)<1e-6);
  const reverse=comparisonGains(-12,-18);assert.equal(reverse.after,1);assert.ok(reverse.before<1);
  assert.deepEqual(comparisonGains(-Infinity,-12),{before:1,after:1});
});
function asset(){const channels=[new Float32Array(80000)];return {id:'asset-1',name:'test.wav',buffer:{sampleRate:8000,numberOfChannels:1,length:80000,getChannelData:i=>channels[i]}};}
test('persistence deduplicates audio, excludes unused assets and freezes snapshot samples',()=>{
  const a=asset(),p=fixture();p.tracks[0].clips.push({...clip(),id:'clip-2'});
  const serialized=serializeProject(p,new Map([['asset-1',a],['unused',{...a,id:'unused'}]]));
  assert.equal(serialized.assets.length,1);a.buffer.getChannelData(0)[0]=.5;
  assert.equal(serialized.assets[0].channels[0][0],0);
  p.name='changed';assert.notEqual(serialized.project.name,p.name);
  assert.equal(validateSaved(serialized).project.tracks[0].clips.length,2);
});
test('stored PCM validates version, sample dimensions, sample values, and references',()=>{
  for(const mutate of [s=>s.schema=2,s=>s.assets[0].rate=0,s=>s.assets[0].channels[0][0]=NaN,s=>s.assets[0].channels.push(new Float32Array(4)),s=>s.assets=[],s=>s.project.tracks[0].clips[0].assetId='absent']){
    const snapshot=serializeProject(fixture(),new Map([['asset-1',asset()]]));mutate(snapshot);assert.throws(()=>validateSaved(snapshot));
  }
});
test('save queue runs in submission order even across delayed failure, newest snapshot wins',async()=>{
  const queue=new SaveQueue(),events=[];let release;let stored;
  const one=queue.enqueue({savedAt:1},async s=>{events.push('start1');await new Promise(r=>release=r);events.push('fail1');throw Error('quota')});
  const two=queue.enqueue({savedAt:2},async s=>{events.push('start2');stored=s.savedAt;});
  const caught=one.catch(e=>e.message);await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['start1']);release();assert.equal(await caught,'quota');await two;assert.equal(stored,2);assert.deepEqual(events,['start1','fail1','start2']);
});
async function renderHarness() {
  const source=(await read('render.ts')).replace("'../audio/converterHelpers'",JSON.stringify(helpersUrl))
    .replace("'./model'",JSON.stringify(modelUrl))
    .replace("import { createMasterChain } from '../audio/masterChain';",'const createMasterChain=(ctx,p)=>{ctx.masterParams=p;return {input:ctx.createGain(),output:ctx.createGain()};};')
    .replace("import { createVocalChain } from '../audio/vocalChain';",'const createVocalChain=(ctx,p)=>{ctx.vocalParams=p;return {input:ctx.createGain(),output:ctx.createGain()};};')
    .replace("import { measureLoudness } from '../audio/lufs';",'const measureLoudness=()=>({integrated:-14,truePeak:-3});');
  return import(moduleUrl(source));
}
function offlineHarness(contexts, delayFirst) {
  return class {
    constructor(ch,length,rate){this.duration=length/rate;this.sources=[];this.envelopes=[];contexts.push(this);}
    createGain(){const gain={events:[],setValueAtTime(v,t){this.events.push(['set',v,t])},linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t])}};this.envelopes.push(gain);return {gain,connect(){}};}
    createBufferSource(){const source={connect(){},start(...args){this.startArgs=args}};this.sources.push(source);return source;}
    startRendering(){return contexts.length===1&&delayFirst ? delayFirst.then(()=>({duration:this.duration})) : Promise.resolve({duration:this.duration});}
  };
}
test('arrangement render schedules source offsets, durations, fades, solo selection and common output protection',async()=>{
  const {renderProject}=await renderHarness(),contexts=[],original=globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext=offlineHarness(contexts);
  try {
    const p=fixture();p.tracks.push({...p.tracks[0],id:'muted',mute:true});
    await renderProject(p,new Map([['asset-1',asset()]]),true);
    assert.equal(contexts[0].sources.length,1);
    assert.deepEqual(contexts[0].sources[0].startArgs,[3,2,5]);
    const fade=contexts[0].envelopes.find(e=>e.events.length);
    assert.deepEqual(fade.events,[['set',0,3],['ramp',1,3.5],['set',1,7.5],['ramp',0,8]]);
    assert.equal(contexts[0].masterParams.ceiling,-1);
    assert.ok(contexts[0].vocalParams);
  }finally{globalThis.OfflineAudioContext=original;}
});
test('before/after pair freezes one arrangement before await even when caller mutates descriptors',async()=>{
  const {renderPair}=await renderHarness(),contexts=[],original=globalThis.OfflineAudioContext;
  let release;const wait=new Promise(r=>release=r);
  globalThis.OfflineAudioContext=offlineHarness(contexts,wait);
  try {
    const p=fixture(),registry=new Map([['asset-1',asset()]]),operation=renderPair(p,registry);
    p.tracks[0].clips[0].start=90;p.settings.level=100;registry.clear();
    release();const result=await operation;
    assert.equal(contexts.length,2);
    assert.deepEqual(contexts[0].sources[0].startArgs,contexts[1].sources[0].startArgs);
    assert.equal(contexts[1].sources[0].startArgs[0],3);
    assert.equal(contexts[1].masterParams.maximizer,1.2);
    assert.deepEqual(result.gains,{before:1,after:1});
  }finally{globalThis.OfflineAudioContext=original;}
});
test('numeric editor forms permit fractional source samples without native step mismatch',async()=>{
  const ui=await read('editor.ts');
  for(const id of ['ed-cursor','ed-clip-start','ed-clip-offset','ed-clip-duration','ed-clip-in','ed-clip-out']){
    const tag=ui.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'))?.[0];
    assert.ok(tag,id);assert.match(tag,/step="any"/);
  }
  assert.match(ui,/id="ed-select-clip"/);
});
