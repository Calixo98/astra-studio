import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const content=await fs.readFile(new URL('../src/ui/helpContent.ts',import.meta.url),'utf8');
const code=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {helpEntries}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const help=await fs.readFile(new URL('../src/ui/help.ts',import.meta.url),'utf8');
test('declarative help covers editor, advanced processing, mixing and conversion',()=>{
  for(const selector of ['#ed-goal','#ed-clarity','#ed-ambience','#ed-level','#ed-ab','#ed-save','#ed-clip-start','#ed-clip-offset','#ed-clip-duration','#v-comp-attack','#v-comp-release','#v-comp-threshold','#v-rev-size','#v-rev-decay','#v-rev-mix','#v-width','#v-deesser','#m-max','#m-ceiling','#converter-bitrate']) assert.ok(helpEntries.some(e=>e.selector.includes(selector)),selector);
  assert.ok(helpEntries.every(e=>e.title.length>3 && e.text.length>70));
});
test('help accurately distinguishes macro modes, sample clipping and lossy conversion',()=>{
  const entry=selector=>helpEntries.find(e=>e.selector===selector).text;
  assert.match(entry('#ed-clarity'),/4 y 10 kHz/);
  assert.match(entry('#ed-ambience'),/Masterizar no se usa/);
  assert.match(entry('#m-ceiling'),/no certificación true-peak/);
  assert.match(entry('#v-rev-decay'),/Más acelera/);
  assert.match(entry('#converter-bitrate'),/no restaura/);
});
test('help is isolated from audio and label activation with delegated lifecycle',()=>{
  assert.doesNotMatch(help,/dispatchEvent|\.value\s*=|AudioContext|engine|state\./);
  assert.match(help,/element.closest\('label'\)/);
  assert.match(help,/button.type = 'button'/);
  assert.match(help,/aria-expanded/); assert.match(help,/aria-describedby/);
  assert.match(help,/MutationObserver/); assert.match(help,/observer.disconnect/);
  assert.match(help,/restoring = true; previous.focus\(\); restoring = false/);
});
