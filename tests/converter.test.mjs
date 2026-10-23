import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
const moduleUrl = async path => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(await fs.readFile(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}}).outputText).toString('base64');
const helperUrl = await moduleUrl('../src/audio/converterHelpers.ts');
const wavUrl = await moduleUrl('../src/audio/wavEncoder.ts');
const {outputName, validateFile, validateAudio, MAX_FILE_BYTES} = await import(helperUrl);
const {encodeWav} = await import(wavUrl);
test('output names replace only final extension and sanitize unsafe characters', () => {
  assert.equal(outputName('voz.final.mpeg', 'mp3'), 'voz.final-convertido.mp3');
  assert.equal(outputName('sin extension', 'wav'), 'sin extension-convertido.wav');
  assert.equal(outputName('a/b?.mp3', 'wav'), 'a_b_-convertido.wav');
  assert.equal(outputName('.wav', 'mp3'), 'audio-convertido.mp3');
});
test('file bounds reject empty and oversized input', () => {
  assert.throws(() => validateFile(0), /vacío/);
  assert.throws(() => validateFile(MAX_FILE_BYTES + 1), /25 MiB/);
  assert.doesNotThrow(() => validateFile(MAX_FILE_BYTES));
});
test('decoded bounds reject channel loss, invalid and excessive audio', () => {
  assert.throws(() => validateAudio(6, 44100, 44100), /mono o estéreo/);
  assert.throws(() => validateAudio(1, 0, 44100), /muestras/);
  assert.throws(() => validateAudio(1, 1, NaN), /muestras/);
  assert.throws(() => validateAudio(2, 44100 * 601, 44100), /10 minutos/);
  assert.doesNotThrow(() => validateAudio(2, 44100, 44100));
});
function fixture(count = 2) {
  const channels = Array.from({length: count}, () => Float32Array.from({length: 4410}, (_, i) => Math.sin(i * 2 * Math.PI * 440 / 44100) * 0.25));
  return {channels, sampleRate: 44100, numberOfChannels: count, length: 4410, getChannelData: i => channels[i]};
}
test('existing WAV encoder emits real PCM16 with correct dimensions', async () => {
  for (const n of [1, 2]) {
    const blob = encodeWav(fixture(n));
    const data = new DataView(await blob.arrayBuffer());
    assert.equal(data.getUint32(0), 0x52494646);
    assert.equal(data.getUint16(22, true), n);
    assert.equal(data.getUint32(24, true), 44100);
    assert.equal(data.getUint16(34, true), 16);
    assert.equal(data.getUint32(40, true), 4410 * n * 2);
  }
});
let result;
globalThis.self = {postMessage: value => {result = value;}};
let workerSource = ts.transpileModule(await fs.readFile(new URL('../src/audio/converterWorker.ts', import.meta.url), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}}).outputText;
workerSource = workerSource.replace("'@breezystack/lamejs'", JSON.stringify(pathToFileURL(process.cwd() + '/node_modules/@breezystack/lamejs/dist/lamejs.js').href)).replace("'./wavEncoder'", JSON.stringify(wavUrl)).replace("'./converterHelpers'", JSON.stringify(helperUrl));
await import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));
test('real worker encoder produces mono/stereo MP3 frames at every bitrate', async () => {
  for (const count of [1, 2]) for (const bitrate of [128, 192, 320]) {
    const {channels} = fixture(count);
    self.onmessage({data: {channels, rate: 44100, format: 'mp3', bitrate}});
    assert.equal(result.error, undefined);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    assert.equal(result.blob.type, 'audio/mpeg');
    assert.ok(bytes.length > 100);
    assert.equal(bytes[0], 255);
    assert.equal(bytes[1] & 0xe0, 0xe0);
    assert.equal((bytes[1] >> 1) & 3, 1, 'MPEG Layer III');
    assert.equal(bytes[3] >> 6 === 3, count === 1, 'channel mode');
  }
});
test('worker WAV and error responses', async () => {
  self.onmessage({data: {channels: fixture(1).channels, rate: 44100, format: 'wav', bitrate: 192}});
  assert.equal(result.blob.type, 'audio/wav');
  self.onmessage({data: {channels: fixture(1).channels, rate: 44100, format: 'mp3', bitrate: 999}});
  assert.match(result.error, /Tasa MP3/);
  self.onmessage({data: {channels: fixture(1).channels, rate: 44100, format: 'exe', bitrate: 192}});
  assert.match(result.error, /Formato/);
});

test('worker runtime rejects null, unequal, non-typed and nonfinite channel messages',()=>{
 for(const data of [null,{}, {channels:[]}, {channels:[[0]]}, {channels:[new Float32Array(1),new Float32Array(2)]},{channels:[Float32Array.of(NaN)]}]){
  self.onmessage({data:data===null?null:{rate:44100,format:'wav',bitrate:192,...data}});
  assert.equal(typeof result.error,'string');assert.equal(result.blob,undefined);
 }
});
