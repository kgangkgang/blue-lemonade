// 1.1.1 시제품 프리셋 폴더 — 이름을 바꾼 프리셋이 폴더를 따라가요 (src/quick/preset-list-core.js followRenames · preset-folders.js followList)
//   · 순수: 사라짐 하나 · 생김 하나 → 그 자리에 새 이름 · 처음(seen 없음) · 둘 이상 섞이면 안 건드림 · 폴더 밖 이름 · 새 이름이 이미 폴더에 있으면 안 건드림
//   · 가짜 브라우저: 목록을 처음 열면 이름을 기억 · 실리태번에서 이름을 바꾸고 다시 열면 폴더 안 이름이 바뀌고 알림 · 같은 목록이면 저장 안 함
//   · 설정: presetFolders.seen 이 정리에서 남고 「변경한 설정」에 안 떠요
//   node tools/tests/preset-folders-rename.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/quick/preset-list-core.js'));
const folders = core.tidyFolders([{ id: 'g', name: '제미나이', items: ['[Gemini] 레모나 5.15', '지운 프리셋'] }, { id: 'd', name: '데우스', items: ['데우스 V3'] }]);
const seen = ['Default', '[Gemini] 레모나 5.15', '데우스 V3', '짧은 답'];

await test('이름 하나가 사라지고 하나가 생기면 폴더 안 이름이 따라가요', () => {
    const r = core.followRenames(folders, seen, ['Default', '[Gemini] 레모나 6.0', '데우스 V3', '짧은 답']);
    assert.deepEqual(r.moved, [['[Gemini] 레모나 5.15', '[Gemini] 레모나 6.0']]);
    assert.deepEqual(r.folders[0].items, ['[Gemini] 레모나 6.0', '지운 프리셋']);
    assert.deepEqual(r.folders[1].items, ['데우스 V3']);
    assert.deepEqual(folders[0].items, ['[Gemini] 레모나 5.15', '지운 프리셋'], '원본은 그대로');
});

await test('처음(본 적 없음) · 둘 이상 섞임 · 폴더 밖 이름 · 지우기만 · 새로 만들기만 → 건드리지 않음', () => {
    const same = r => { assert.deepEqual(r.moved, []); assert.equal(r.folders, folders); };
    same(core.followRenames(folders, [], ['A', 'B']));
    same(core.followRenames(folders, undefined, ['A']));
    same(core.followRenames(folders, seen, ['Default', '레모나 6.0', '데우스 V4', '짧은 답']), '둘이 동시에');
    same(core.followRenames(folders, seen, ['Default', '[Gemini] 레모나 5.15', '데우스 V3', '긴 답']), '폴더 밖 이름');
    same(core.followRenames(folders, seen, ['Default', '데우스 V3', '짧은 답']), '지우기만');
    same(core.followRenames(folders, seen, [...seen, '새 프리셋']), '새로 만들기만');
});

await test('새 이름이 이미 다른 폴더에 있으면 건드리지 않음 · 같은 목록 판정', () => {
    const r = core.followRenames(folders, seen, ['Default', '지운 프리셋', '데우스 V3', '짧은 답']);
    assert.deepEqual(r.moved, []);
    assert.equal(core.sameNames(seen, [...seen]), true);
    assert.equal(core.sameNames(seen, [...seen].reverse()), false);
    assert.equal(core.sameNames(undefined, []), false);
});

await test('설정: presetFolders.seen 은 정리에서 남고 변경한 설정에 안 떠요', async () => {
    assert.match(read('src/settings-differences.js'), /'presetFolders\.seen'/);
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, presetFolders: { on: true, folders: structuredClone(folders) } };
const { ctx } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
document.body.classList.add('salty');
const toasts = [];
globalThis.toastr = { info: (m) => { toasts.push(['info', m]); }, success() {}, warning() {}, error() {}, clear() {} };
let saves = 0;
ctx.saveSettingsDebounced = () => { saves++; };

const sel = document.createElement('select');
sel.id = 'settings_preset_openai';
const setNames = list => { sel.innerHTML = ''; list.forEach((name, i) => { const o = document.createElement('option'); o.setAttribute('value', String(i)); o.textContent = name; sel.append(o); }); };
setNames(seen);
let selected = 1;
Object.defineProperty(sel, 'options', { get: () => Object.assign(sel.children.map((o, i) => Object.assign(o, { text: o.textContent, index: i })), {}) });
Object.defineProperty(sel, 'selectedIndex', { get: () => selected, set: v => { selected = v; } });
Object.defineProperty(sel, 'selectedOptions', { get: () => [sel.children[selected]] });
document.body.append(sel);

const S = await import(url('src/settings.js'));
const D = await import(url('src/settings-differences.js'));
const P = await import(url('src/quick/preset-folders.js'));
P.syncPresetFolders(true);
const names = () => [...P._forTest.layer().querySelectorAll('.salty-pick-rows button[data-v]')].map(b => b.dataset.v);

await test('처음 열면 지금 이름을 기억해요(폴더는 그대로) · 같은 목록으로 다시 열면 저장하지 않아요', () => {
    saves = 0;
    P._forTest.open(sel);
    assert.deepEqual(S.getSettings().presetFolders.seen, seen);
    assert.equal(saves, 1);
    assert.deepEqual(names().slice(0, 1), ['[Gemini] 레모나 5.15']);
    P._forTest.close();
    P._forTest.open(sel);
    assert.equal(saves, 1, '같은 목록이면 저장 안 함');
    P._forTest.close();
});

await test('실리태번에서 이름을 바꾸고 다시 열면 폴더 안 이름이 따라가고 알림이 떠요', () => {
    setNames(['Default', '[Gemini] 레모나 6.0', '데우스 V3', '짧은 답']);
    toasts.length = 0;
    P._forTest.open(sel);
    assert.deepEqual(names(), ['[Gemini] 레모나 6.0', '데우스 V3', 'Default', '짧은 답']);
    assert.deepEqual(S.getSettings().presetFolders.folders[0].items, ['[Gemini] 레모나 6.0', '지운 프리셋']);
    assert.deepEqual(S.getSettings().presetFolders.seen, ['Default', '[Gemini] 레모나 6.0', '데우스 V3', '짧은 답']);
    assert.equal(toasts.length, 1); assert.match(toasts[0][1], /레모나 5\.15.*레모나 6\.0/);
    P._forTest.close();
});

await test('둘을 한꺼번에 바꾸면(어느 것인지 모름) 폴더는 그대로 · 이름 기억만 갱신', () => {
    setNames(['Default', '레모나 7', '데우스 V4', '짧은 답']);
    toasts.length = 0;
    P._forTest.open(sel);
    assert.deepEqual(S.getSettings().presetFolders.folders.map(f => f.items), [['[Gemini] 레모나 6.0', '지운 프리셋'], ['데우스 V3']]);
    assert.deepEqual(names(), ['Default', '레모나 7', '데우스 V4', '짧은 답'], '없는 이름은 안 보이고 모두 폴더 밖');
    assert.equal(toasts.length, 0);
    assert.deepEqual(S.getSettings().presetFolders.seen, ['Default', '레모나 7', '데우스 V4', '짧은 답']);
    P._forTest.close();
});

await test('seen 은 설정 정리를 지나도 남고 「변경한 설정」에 안 떠요', () => {
    S.invalidateSettings();
    const s = S.getSettings();
    assert.ok(Array.isArray(s.presetFolders.seen) && s.presetFolders.seen.length === 4);
    assert.ok(!D.changedSettings(s).some(c => c.path.startsWith('presetFolders.seen')));
});

console.log(`preset-folders-rename: ${passed}개 통과`);
