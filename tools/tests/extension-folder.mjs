// 6.4.2 판 번호가 붙은 설치 폴더 — src/extension-folder.js (순수) + 모델 전환 · 성능 보조 연결 코드. 폴더 이름은 지어낸 것.
//   node tools/tests/extension-folder.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = (rel) => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const F = await import(pathToFileURL(path.join(themeRoot, 'src/extension-folder.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('folderBase: 판 번호 · v 판 · main/master 꼬리만 뗀다', () => {
    for (const [a, b] of [['story-notes-1.6.7', 'story-notes'], ['story-notes', 'story-notes'], ['life-log-personal-1.3.4', 'life-log-personal'], ['pic-tool-3.0.8', 'pic-tool'],
        ['story-notes-v2', 'story-notes'], ['story-notes-main', 'story-notes'], ['story-notes-1.2.0-beta', 'story-notes'], ['ST-notes', 'ST-notes'], ['notes-plus', 'notes-plus'], ['', '']])
        assert.equal(F.folderBase(a), b, a);
});
await test('installedFolder: 정확한 이름 먼저 · 없으면 판 번호 붙은 켜진 폴더 중 가장 새 판 · 꺼진 폴더 · 다른 확장은 아님', () => {
    const names = ['third-party/story-notes-1.6.6', 'third-party/story-notes-1.6.10', 'third-party/story-notes-plus', 'third-party/other', 'assets-core'];
    assert.equal(F.installedFolder('story-notes', names, []), 'story-notes-1.6.10', 'numeric, not string order');
    assert.equal(F.installedFolder('story-notes', names, ['third-party/story-notes-1.6.10']), 'story-notes-1.6.6', 'disabled one skipped');
    assert.equal(F.installedFolder('story-notes', ['third-party/story-notes', ...names], []), 'story-notes', 'exact name wins');
    assert.equal(F.installedFolder('story-notes', ['third-party/story-notes-plus'], []), '', 'a different extension is not a version');
    assert.equal(F.installedFolder('story-notes', ['third-party/story-notes-1.6.7'], ['third-party/story-notes-1.6.7']), '');
    assert.equal(F.installedFolder('', names, []), '', 'empty base (theme add-on with no folder)');
    assert.equal(F.installedFolder('story-notes', null, null), '');
});
await test('모델 전환: 아는 확장은 본래 폴더 이름으로 찾고(판 번호 붙어도), 창 다시 그리기도 그 폴더로 · 자동 찾기는 실제 폴더로', () => {
    const t = read('src/addons/modelswitch/targets.js');
    assert.match(t, /import \{ folderBase, installedFolder \} from '\.\.\/\.\.\/extension-folder\.js';/);
    assert.match(t, /const folderOf = base => installedFolder\(base, extensionNames, extension_settings\.disabledExtensions\);/);
    assert.match(t, /const installed = base => !!folderOf\(base\);/);
    assert.equal((t.match(/new URL\(`\.\.\/\.\.\/\.\.\/\.\.\/\$\{folderOf\(memory\.folder\) \|\| memory\.folder\}\/\$\{file\}`, import\.meta\.url\)/g) || []).length, 2, 'both panel refresh paths');
    assert.match(t, /\.filter\(folder => enabled\(folder\) && folder !== THEME_FOLDER && !KNOWN_FOLDERS\.has\(folderBase\(folder\)\)\);/);
    assert.match(t, /if \(!enabled\(owner\.folder\) \|\| !isObj\(extension_settings\[key\]\)\) continue;/);
    assert.match(t, /const known = KNOWN\.filter\(target => \(installed\(target\.folder\) \|\| target\.builtin\?\.\(\)\) && isObj\(target\.settings\(\)\)\);/);
});
await test('성능 보조: 부르는 쪽 이름표도 판 번호 붙은 폴더를 본래 이름으로', () => {
    const p = read('src/addons/perf/state.js');
    assert.match(p, /import \{ folderBase \} from '\.\.\/\.\.\/extension-folder\.js';/);
    assert.match(p, /return CALLER_LABELS\[caller\] \?\? CALLER_LABELS\[folderBase\(caller\)\] \?\? String\(caller \?\? 'unknown'\);/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/extension-folder\.mjs \./);
});

console.log(`extension-folder: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
