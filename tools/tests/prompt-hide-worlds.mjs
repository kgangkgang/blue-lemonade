// 한글화 패널 1.2.6: 월드인포 목록에서 숨기기 · 다시 보기 (이름은 설정 hiddenWorlds 에만).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/prompt/index.js'), 'utf8');
assert.match(src, /const hiddenWorlds = \(\) => \{ const c = cfg\(\); if \(!Array\.isArray\(c\.hiddenWorlds\)\) c\.hiddenWorlds = \[\]; return c\.hiddenWorlds; \};/);
assert.match(src, /return hidden\.size \? items\.filter\(item => !hidden\.has\(item\.id\)\) : items;/);
assert.match(src, /id="\$\{idPfx\}-hide"/);
assert.match(src, /id="\$\{idPfx\}-unhide"/);
// the list function itself, run with fake world names and settings
const fn = src.slice(src.indexOf('const hiddenWorlds'), src.indexOf('// Marker used to carry world-info keywords'));
const settings = { hiddenWorlds: ['Secret notes'] };
const run = new Function('cfg', 'world_names', 'document', fn + '; return listAllWorldInfos();');
assert.deepEqual(run(() => settings, ['Atlas', 'Secret notes', 'Harbor'], null).map(x => x.id), ['Atlas', 'Harbor']);
settings.hiddenWorlds = [];
assert.equal(run(() => settings, ['Atlas', 'Secret notes'], null).length, 2);
console.log('prompt-hide-worlds: 2 passed, 0 failed');
