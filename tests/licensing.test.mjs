import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('original code uses MIT while encoder metadata remains LGPL', () => {
  assert.equal(JSON.parse(read('package.json')).license, 'MIT');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages[''].license, 'MIT');
  assert.equal(lock.packages['node_modules/@breezystack/lamejs'].license, 'LGPL-3.0');
  assert.match(read('LICENSE'), /Copyright \(c\) 2026 ASTRA STUDIO contributors/);
  assert.match(read('LICENSE'), /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test('distributed notices match original texts and retain codec source reference', () => {
  for (const [source, target] of [
    ['LICENSE', 'LICENSE'], ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
    ['licenses/lamejs-LGPL-3.0.txt', 'lamejs-LGPL-3.0.txt'],
    ['licenses/GPL-3.0.txt', 'GPL-3.0.txt'],
    ['licenses/lamejs-upstream-license-notice.txt', 'lamejs-upstream-license-notice.txt'],
  ]) assert.equal(read(`public/licenses/${target}`), read(source));
  assert.match(read('licenses/lamejs-LGPL-3.0.txt'), /4\. Combined Works/);
  assert.match(read('licenses/GPL-3.0.txt'), /END OF TERMS AND CONDITIONS/);
  assert.match(read('THIRD_PARTY_NOTICES.md'), /1fb0ef5fa177413107e2e107d054a9b994e3f79c/);
  assert.ok(existsSync(new URL('../public/licenses/lamejs-1.2.7-source.tar.gz', import.meta.url)));
});
