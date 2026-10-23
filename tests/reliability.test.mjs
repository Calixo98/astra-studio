import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source = path => fs.readFile(new URL('../src/'+path, import.meta.url), 'utf8');
const url = s => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const stateUrl = url(await source('audio/state.ts'));
const reverbUrl = url(await source('audio/reverb.ts'));
const { buildImpulse } = await import(reverbUrl);
const { RenderRevision } = await import(url(await source('audio/renderRevision.ts')));
const { createMasterChain } = await import(url((await source('audio/masterChain.ts')).replace("'./state'", JSON.stringify(stateUrl))));
const { measureLoudness } = await import(url(await source('audio/lufs.ts')));
const buffer = (channels, sr = 48000) => ({sampleRate:sr, numberOfChannels:channels.length,length:channels[0].length,getChannelData:i=>channels[i]});
test('render revisions reject edits during async work and retain no previous authority', () => {
  const r = new RenderRevision(), token = r.capture();
  assert.equal(r.isCurrent(token), true);
  r.invalidate();
  assert.equal(r.isCurrent(token), false);
  assert.equal(r.isCurrent(r.capture()), true);
});
test('synthetic reverb is repeatable, stereo decorrelated, and parameter-sensitive', () => {
  const ctx = {sampleRate:8000,createBuffer:(n,len,sr)=>buffer(Array.from({length:n},()=>new Float32Array(len)),sr)};
  const a=buildImpulse(ctx,35,40), b=buildImpulse(ctx,35,40), c=buildImpulse(ctx,35,41);
  assert.deepEqual(a.getChannelData(0), b.getChannelData(0));
  assert.notDeepEqual(a.getChannelData(0), a.getChannelData(1));
  assert.notDeepEqual(a.getChannelData(0), c.getChannelData(0));
});
test('shared master protection is neutral below ceiling and clips symmetrically at the ceiling', () => {
  const nodes=[];const node=()=>{const n={connections:[],connect(to){this.connections.push(to)},gain:{value:1},frequency:{},Q:{},ratio:{},knee:{},attack:{},release:{},threshold:{}};nodes.push(n);return n};
  const ctx={createGain:node,createBiquadFilter:node,createDynamicsCompressor:node,createWaveShaper:node};
  const master=createMasterChain(ctx,{eq:[0,0,0,0,0],maximizer:0,ceiling:-1});
  const protection=nodes.find(n=>n.curve);
  const ceiling=10**(-1/20), curve=protection.curve;
  assert.equal(protection.oversample,'none');
  assert.ok(Math.abs(curve[0]+ceiling)<1e-7);
  assert.ok(Math.abs(curve.at(-1)-ceiling)<1e-7);
  assert.equal(curve[32768],0);
  assert.equal(curve[40960],0.25);
  assert.equal(protection.connections[0],master.output);
  for(const x of curve) assert.ok(Math.abs(x)<=ceiling+1e-7);
});
test('short signal produces unavailable integrated estimate but nonzero peak, not silence', () => {
  const data=Float32Array.from({length:2400},(_,i)=>Math.sin(i*2*Math.PI*440/48000)*.25);
  const result=measureLoudness(buffer([data]));
  assert.equal(result.integrated,-Infinity);
  assert.ok(result.truePeak>-13 && result.truePeak<-11);
});
test('mutation notifications cover track replacement/removal and mix/chain updates', async()=>{
  const engine=await source('audio/engine.ts');
  assert.match(engine,/fileName = file.name;\s*this.onChange\?\.\(\)/);
  assert.match(engine,/fileName = '';\s*this.onChange\?\.\(\)/);
  assert.match(engine,/applyMix\(\): void \{\s*this.onChange\?\.\(\)/);
  const main=await source('main.ts');
  assert.match(main,/if \(!renderRevision.isCurrent\(startedRevision\)\)/);
  assert.match(main,/rendered = null;\s*lastAnalysis = null;/);
});
test('recorder serializes permission requests and releases streams after constructor failure', async () => {
  const { initRecorder } = await import(url((await source('ui/recorder.ts')).replace("'../audio/state'",JSON.stringify(stateUrl))));
  const makeElement=()=>({textContent:'',disabled:false,hidden:true,classList:{add(){},remove(){}},addEventListener(name,fn){this[name]=fn;}});
  const elements={'btn-rec':makeElement(),'rec-time':makeElement(),'rec-hint':makeElement()};
  const previousWarn = console.warn;
  console.warn = () => {};
  const originals={document:globalThis.document,window:globalThis.window,navigator:globalThis.navigator,MediaRecorder:globalThis.MediaRecorder};
  let resolve,requests=0,stopped=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia(){requests++;return new Promise(r=>resolve=r)}}}});
  globalThis.document={getElementById:id=>elements[id]};
  globalThis.window={clearInterval(){},addEventListener(){}};
  globalThis.MediaRecorder=class{constructor(){throw Error('unsupported')}};
  try {
    initRecorder({stop(){},applyMix(){},tracks:{beat:{buffer:null}}},async()=>{});
    elements['btn-rec'].click();elements['btn-rec'].click();
    assert.equal(requests,1);
    assert.equal(elements['btn-rec'].disabled,true);
    resolve({getTracks:()=>[{stop(){stopped++}}]});
    await new Promise(r=>setTimeout(r,0));
    assert.equal(stopped,1);
    assert.equal(elements['btn-rec'].disabled,false);
    assert.match(elements['rec-hint'].textContent,/No se pudo/);
  } finally {
    console.warn = previousWarn;
    for(const [key,value] of Object.entries(originals)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
});
