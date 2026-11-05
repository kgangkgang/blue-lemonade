// 1.0.3 프리셋 고르기 목록 폴더 (src/quick/preset-list-core.js · src/quick/preset-folders.js)
//   · 다듬기(같은 프리셋이 두 폴더에 · 깨진 값 · 같은 id · 이름) · 묶기 차례 · 찾기 · 넣기(다른 폴더에서 빼옴 · 없는 이름은 남김) · 순서 · 지우기
//   · 기본 꺼짐 · 서랍 문 뒤에서 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 변경한 설정에서 폴더 목록은 뺌
//   · 가짜 브라우저: 폴더 머리 · 들여 쓴 프리셋 · 폴더 밖 · 지금 프리셋 폴더는 펼침 · 고르면 실리태번 칸 값 + input · change
//   · 접기 기억 · 새 폴더 창 · 폴더 지우기(물음, 프리셋 파일은 그대로) · 찾기 · 끄면 창 갈고리 없음
//   node tools/tests/quick-preset-folders.mjs <테마 루트>
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

await test('다듬기: 같은 프리셋은 앞 폴더만 · 깨진 값 · 같은 id · 이름', () => {
    const out = core.tidyFolders([{ id: 'a', name: ' 일상 ', items: ['A', 'B', 'A', 7] }, { id: 'a', name: '', items: ['B', 'C'], open: false }, null, 'x']);
    assert.deepEqual(out[0], { id: 'a', name: '일상', open: true, items: ['A', 'B'] });
    assert.notEqual(out[1].id, 'a');
    assert.equal(out[1].name, '폴더 2');
    assert.deepEqual(out[1].items, ['C']);
    assert.equal(out[1].open, false);
    assert.equal(core.tidyFolders(Array.from({ length: 80 }, (_, i) => ({ id: `f${i}`, items: [] }))).length, core.MAX_FOLDERS);
});

const names = ['Default', '레모나 5.15', '[Gemini] 레모나 5.15', '데우스 V3', '솔라 2', '짧은 답'];
const folders = core.tidyFolders([{ id: 'g', name: '제미나이', items: ['[Gemini] 레모나 5.15', '지운 프리셋'] }, { id: 'd', name: '데우스 · 솔라', items: ['솔라 2', '데우스 V3'] }]);

await test('묶기: 폴더 차례 · 폴더 안은 넣은 차례 · 없는 이름은 안 보임 · 나머지는 폴더 밖', () => {
    const { groups, loose } = core.groupPresets(names, folders);
    assert.deepEqual(groups.map(g => [g.folder.id, g.items]), [['g', ['[Gemini] 레모나 5.15']], ['d', ['솔라 2', '데우스 V3']]]);
    assert.deepEqual(loose, ['Default', '레모나 5.15', '짧은 답']);
    assert.equal(core.folderOf(folders, '데우스 V3'), 'd');
    assert.equal(core.folderOf(folders, 'Default'), '');
});

await test('찾기 · 넣기(다른 폴더에서 빼옴 · 없는 이름은 남김) · 순서 · 지우기', () => {
    assert.deepEqual(core.searchPresets(names, folders, '레모나 gemini'), [{ name: '[Gemini] 레모나 5.15', folder: '제미나이' }]);
    assert.deepEqual(core.searchPresets(names, folders, '   '), []);
    const next = core.assignPresets(folders, 'g', ['레모나 5.15', '솔라 2'], new Set(names));
    assert.deepEqual(next[0].items, ['지운 프리셋', '레모나 5.15', '솔라 2']);
    assert.deepEqual(next[1].items, ['데우스 V3']);
    assert.deepEqual(core.moveFolder(folders, 'd', -1).map(f => f.id), ['d', 'g']);
    assert.equal(core.moveFolder(folders, 'g', -1), null);
    assert.deepEqual(core.removeFolder(folders, 'g').map(f => f.id), ['d']);
});

await test('기본 꺼짐 · 서랍 문 뒤에서 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 변경한 설정에서 폴더 목록은 뺌', () => {
    assert.match(read('src/settings.js'), /presetFolders: \{ on: false, folders: \[\] \}/);
    const f = read('src/features.js');
    assert.match(f, /s\.presetFolders\?\.on === true/);
    assert.match(f, /onGate\('drawer', presetFolders \|\| modules\.presetfolders \? \(\) => load\('presetfolders', '\.\/quick\/preset-folders\.js'\)/);
    assert.match(read('src/panel.js'), /toggle\('presetFolders\.on', s\.presetFolders\?\.on === true\)/);
    assert.match(read('src/settings-search.js'), /'presetFolders\.on'\]/);
    assert.match(read('src/settings-labels.js'), /'presetFolders\.on':'프리셋 목록 폴더'/);
    assert.match(read('src/settings-differences.js'), /'presetFolders\.folders'/);
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, presetFolders: { on: true, folders: structuredClone(folders) } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
let confirmAnswer = true; globalThis.confirm = () => confirmAnswer;
delete ctx.Popup;
document.body.classList.add('salty');

// 실리태번 프리셋 고르기 칸 흉내 (값 = 번호, 글 = 이름)
const sel = document.createElement('select');
sel.id = 'settings_preset_openai';
names.forEach((name, i) => { const o = document.createElement('option'); o.setAttribute('value', String(i)); o.textContent = name; sel.append(o); });
let selected = 3;
Object.defineProperty(sel, 'options', { get: () => Object.assign(sel.children.map((o, i) => Object.assign(o, { text: o.textContent, index: i })), {}) });
Object.defineProperty(sel, 'selectedIndex', { get: () => selected, set: v => { selected = v; } });
Object.defineProperty(sel, 'selectedOptions', { get: () => [sel.children[selected]] });
document.body.append(sel);
const fired = [];
sel.addEventListener('input', () => fired.push('input'));
sel.addEventListener('change', () => fired.push('change:' + selected));

const P = await import(url('src/quick/preset-folders.js'));
const base = dom.listenerCounts(eventSource);

await test('켜면 창(window) 갈고리만 · 끄면 다 뗌', () => {
    P.syncPresetFolders(true); P.syncPresetFolders(true);
    assert.equal(dom.listenerCounts(eventSource).window - base.window, 6);
    P.syncPresetFolders(false);
    assert.deepEqual(dom.listenerCounts(eventSource), base);
    P.syncPresetFolders(true);
});

const layer = () => P._forTest.layer();
const rows = () => [...layer().querySelectorAll('.salty-pick-rows > *')].map(el => el.classList.contains('bl-pfo-head') ? `[${el.querySelector('span').textContent}${el.classList.contains('closed') ? ' 접힘' : ''}]` : el.classList.contains('salty-pick-group') ? `-${el.textContent}-` : el.classList.contains('bl-pfo-new') ? '+새 폴더' : `${el.dataset.depth ? '  ' : ''}${el.dataset.v}${el.classList.contains('on') ? ' ✓' : ''}`);

await test('목록: 폴더 머리 · 들여 쓴 프리셋 · 지금 프리셋 ✓ · 폴더 밖 · 새 폴더', () => {
    P._forTest.open(sel);
    assert.ok(layer());
    assert.deepEqual(rows(), ['[제미나이]', '  [Gemini] 레모나 5.15', '[데우스 · 솔라]', '  솔라 2', '  데우스 V3 ✓', '-폴더 밖-', 'Default', '레모나 5.15', '짧은 답', '+새 폴더']);
    assert.equal(layer().querySelector('.bl-pfo-head small').textContent, '1');
});

await test('고르면 실리태번 칸 값 + input · change(실리태번 프리셋 바꾸기가 그대로 돎) · 목록 닫힘', () => {
    layer().querySelector('button[data-v="레모나 5.15"]').click();
    assert.equal(selected, 1);
    assert.deepEqual(fired, ['input', 'change:1']);
    assert.equal(layer(), null);
    fired.length = 0;
    P._forTest.open(sel);
    layer().querySelector('button[data-v="레모나 5.15"]').click();
    assert.deepEqual(fired, [], '같은 것을 고르면 사건 없음');
});

await test('접기는 기억하고, 지금 프리셋이 든 폴더는 늘 펼쳐서 열림', () => {
    P._forTest.open(sel);
    layer().querySelector('.bl-pfo-head[data-f="g"] [data-pfo="fold"]').click();
    assert.equal(settings.presetFolders.folders[0].open, false);
    assert.deepEqual(rows().slice(0, 2), ['[제미나이 접힘]', '[데우스 · 솔라]']);
    P._forTest.close();
    selected = 2;   // [Gemini] 레모나 5.15 — 접힌 폴더 안
    P._forTest.open(sel);
    assert.deepEqual(rows().slice(0, 2), ['[제미나이]', '  [Gemini] 레모나 5.15 ✓']);
    P._forTest.close();
});

await test('새 폴더 창: 이름 · 고른 프리셋(다른 폴더에서 빼옴) · 저장', async () => {
    await P._forTest.openEditor(sel, null);
    const dialog = document.querySelector('dialog.bl-pfo-editor');
    assert.ok(dialog);
    dialog.querySelector('[data-pfo-name]').value = '자주 씀';
    dialog.querySelector('.bl-prompt-card-choice[data-v="Default"]').click();
    dialog.querySelector('.bl-prompt-card-choice[data-v="솔라 2"]').click();
    assert.match(dialog.querySelector('[data-v="솔라 2"] small').textContent, /데우스 · 솔라/);
    dialog.querySelector('[data-card-done]').click();
    const saved = settings.presetFolders.folders;
    assert.equal(saved.length, 3);
    assert.deepEqual([saved[2].name, saved[2].items], ['자주 씀', ['Default', '솔라 2']]);
    assert.deepEqual(saved[1].items, ['데우스 V3']);
    assert.equal(document.querySelector('dialog.bl-pfo-editor'), null, '창은 닫히면 지워져요');
});

await test('폴더 지우기는 물음(취소면 그대로) · 프리셋은 폴더 밖으로', async () => {
    const id = settings.presetFolders.folders[2].id;
    confirmAnswer = false;
    await P._forTest.dropFolder(sel, id);
    assert.equal(settings.presetFolders.folders.length, 3);
    confirmAnswer = true;
    await P._forTest.dropFolder(sel, id);
    assert.equal(settings.presetFolders.folders.length, 2);
    assert.equal(sel.children.length, names.length, '프리셋 칸은 그대로');
});

await test('찾기: 폴더 이름을 함께 보여 줌 · 없으면 빈 줄', () => {
    const html = P._forTest.rowsHtml(sel, '데우스');
    assert.match(html, /data-v="데우스 V3"/);
    assert.match(html, /<small>데우스 · 솔라<\/small>/);
    assert.match(P._forTest.rowsHtml(sel, '없는 이름'), /찾는 프리셋이 없어요/);
});

await test('끄면 열린 목록도 닫힘 · 창 갈고리 없음', () => {
    P._forTest.open(sel);
    P.syncPresetFolders(false);
    assert.equal(layer(), null);
    const now = dom.listenerCounts(eventSource);   // 실리태번 사건 칸은 설정 저장(settings.js)이 처음 저장할 때 다는 것 — 이 기능과 상관없어요
    assert.deepEqual({ ...now, eventSource: 0 }, { ...base, eventSource: 0 });
});

console.log(`quick-preset-folders: ${passed}개 통과`);
