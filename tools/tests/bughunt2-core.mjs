// 7.0.2 버그 사냥 2차 코어 고침 — 넓은 표 가로 밀기 · 화이트/나이트 자동 저장 · 채팅 이름 바꾸기 귀속 · 테마 설정 세 갈래 합치기 ·
// 단어/캡처 프리셋 확인 · 원문 바뀜 다리 이벤트 · 카드 고르기 자동 초점 · 새 답 첫 줄 단추 자리
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFile(path.join(root, rel), 'utf8');
let moduleId = 0;
const bindings = globalThis.__bh2 = {};
async function load(rel, imports = {}, tail = '') {
    const id = ++moduleId;
    bindings[id] = imports;
    const source = (await read(rel)).replace(/^import [^\n]*\n/gm, '');
    const prelude = `const {${Object.keys(imports).join(',')}} = globalThis.__bh2[${id}];\n`;
    return import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\n' + tail).toString('base64'));
}
let passed = 0;
const test = async (label, fn) => { await fn(); passed++; console.log(`PASS ${label}`); };

// ---- mobile-02 넓은 표
globalThis.getComputedStyle = el => ({ overflowX: el.overflowX ?? 'visible' });
const node = (props, parent = null) => ({ nodeType: 1, parentElement: parent, scrollWidth: 100, clientWidth: 100, classList: { contains: c => (props.classes || []).includes(c) }, closest(sel) { for (let e = this; e; e = e.parentElement) if (sel === '.mes_text' && e.classList.contains('mes_text')) return e; return null; }, ...props });
const { wideScroller } = await load('src/layout.js', {});
await test('wide scroller: a touch inside an overflowing table in a message is held back · not overflowing / outside messages swipes as before', () => {
    const chatEl = node({});
    const mes = node({ classes: ['mes_text'] }, chatEl);
    const table = node({ overflowX: 'auto', scrollWidth: 900, clientWidth: 360 }, mes);
    const cell = node({}, table);
    assert.equal(wideScroller(cell, chatEl), table);
    table.scrollWidth = 360; assert.equal(wideScroller(cell, chatEl), null, 'fits → normal swipe');
    table.scrollWidth = 900; table.overflowX = 'hidden'; assert.equal(wideScroller(cell, chatEl), null, 'not a scroller');
    const outside = node({ overflowX: 'auto', scrollWidth: 900, clientWidth: 360 }, chatEl);
    assert.equal(wideScroller(node({}, outside), chatEl), null, 'outside .mes_text');
    assert.equal(wideScroller({ nodeType: 3, parentElement: cell }, chatEl), null, 'text node walks up');
    table.overflowX = 'scroll'; assert.equal(wideScroller({ nodeType: 3, parentElement: cell }, chatEl), table);
});
await test('wide scroller wiring: only touchmove · touchend · touchcancel are stopped (touchstart still closes drawers)', async () => {
    const src = await read('src/layout.js');
    assert.match(src, /chatEl\?\.addEventListener\('touchstart', event => \{ wideGesture = !!wideScroller\(event\.target, chatEl\); \}, \{ passive: true \}\)/);
    assert.match(src, /for \(const type of \['touchmove', 'touchend', 'touchcancel'\]\) chatEl\?\.addEventListener\(type, event => \{ if \(wideGesture\) event\.stopPropagation\(\);/);
});

// ---- data-03 화이트 · 나이트 자동은 저장하지 않는다
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
const palettes = await import(pathToFileURL(path.join(root, 'src/palettes.js')));
const s = { enabled: true, palette: 'salt', auto: { on: true, by: 'time', night: '00:00', day: '23:59' } };
let saves = 0;
const auto = await load('src/automode.js', { getSettings: () => s, saveSettings: () => saves++, ...palettes });
await test('auto day/night switches the palette in memory and re-applies, but never saves (hidden tabs cannot overwrite other devices)', async () => {
    let applied = 0;
    auto.syncAutoMode(true, { applyAll: () => applied++, refreshPanels() {} });
    const want = auto.wantMode(s.auto);
    assert.equal(palettes.PALETTES[s.palette].mode, want);
    assert.ok(applied >= 1); assert.equal(saves, 0);
    assert.doesNotMatch(await read('src/automode.js'), /saveSettings\(\)/);
    auto.syncAutoMode(false);
});

// ---- data-01 채팅 이름 바꾸기
const store = { promptBinds: { a: { keys: ['c:A.png', 'c:A.png/main', 'g:7/day'] }, b: { keys: ['c:A.png/main', 'c:A.png/main-2'] }, c: { keys: ['c:B.png/main'] } } };
let bindSaves = 0;
const pb = await load('src/promptbind.js', { getSettings: () => store, saveSettings: () => bindSaves++, currentKey: () => 'c:A.png', keyLabel: k => k });
await test('chat rename moves 「+ this chat」 keys of that owner only, dedupes, saves once', () => {
    assert.equal(pb.renameChatKeys({ avatarId: 'A.png', oldFileName: 'main.jsonl', newFileName: 'main-2.jsonl' }), 2);
    assert.deepEqual(store.promptBinds.a.keys, ['c:A.png', 'c:A.png/main-2', 'g:7/day']);
    assert.deepEqual(store.promptBinds.b.keys, ['c:A.png/main-2'], 'no duplicate');
    assert.deepEqual(store.promptBinds.c.keys, ['c:B.png/main'], 'other character untouched');
    assert.equal(bindSaves, 1);
    assert.equal(pb.renameChatKeys({ groupId: '7', oldFileName: 'day.jsonl', newFileName: 'day: 2?.jsonl' }), 1);
    assert.ok(store.promptBinds.a.keys.includes('g:7/day 2'), 'new name sanitized like the draft keys');
    assert.equal(pb.renameChatKeys({ avatarId: 'A.png', oldFileName: 'main-2.jsonl', newFileName: 'raw name' }, 'server-name'), 2, 'open chat: the real chat id wins');
    assert.ok(store.promptBinds.b.keys.includes('c:A.png/server-name'));
    assert.equal(pb.renameChatKeys({ avatarId: 'A.png', oldFileName: 'x', newFileName: 'x' }), 0);
    assert.equal(pb.renameChatKeys({}), 0);
});
await test('chat rename wiring: CHAT_RENAMED → renameChatKeys → sync again (CHAT_CHANGED came first and turned the prompt off)', async () => {
    const src = await read('src/promptbind.js');
    assert.match(src, /eventSource\.on\(event_types\.CHAT_RENAMED, data => \{/);
    assert.match(src, /if \(renameChatKeys\(data, here \? \(ctx\.chatId \?\? ctx\.getCurrentChatId\?\.\(\)\) : null\)\) syncPromptBinds\('chat'\);/);
});

// ---- data-02 세 갈래 합치기
const sync = await import(pathToFileURL(path.join(root, 'src/settings-sync.js')));
await test('three-way merge: untouched tab adopts the server; each side keeps its own new library items; deletions stick', () => {
    const base = { size: 16, styles: [{ id: 's1', name: 'A' }], frameLibrary: [{ id: 'f1' }], promptBinds: { p1: { keys: ['c:A'] } } };
    // 이 탭은 아무것도 안 바꿈 → 서버 그대로
    const tab = structuredClone(base), server = { ...structuredClone(base), size: 18, styles: [{ id: 's1', name: 'A' }, { id: 's2', name: 'Phone' }] };
    let r = sync.mergeSalty(tab, base, server);
    assert.equal(r.changed, true); assert.equal(r.needSave, false); assert.deepEqual(tab, server);
    // 둘 다 바꿈: 이 탭은 글자 크기 · 스타일 s3 추가 · 액자 f1 지움, 서버(폰)는 스타일 s2 추가 · 귀속 p2 추가
    const tab2 = { size: 20, styles: [{ id: 's1', name: 'A' }, { id: 's3', name: 'PC' }], frameLibrary: [], promptBinds: { p1: { keys: ['c:A'] } } };
    const server2 = { size: 16, styles: [{ id: 's1', name: 'A' }, { id: 's2', name: 'Phone' }], frameLibrary: [{ id: 'f1' }], promptBinds: { p1: { keys: ['c:A'] }, p2: { keys: ['c:B'] } } };
    r = sync.mergeSalty(tab2, base, server2);
    assert.equal(tab2.size, 20, 'local scalar change wins over unchanged server');
    assert.deepEqual(tab2.styles.map(x => x.id), ['s1', 's2', 's3'], 'both new styles');
    assert.deepEqual(tab2.frameLibrary, [], 'deleted here → not resurrected');
    assert.deepEqual(Object.keys(tab2.promptBinds).sort(), ['p1', 'p2']);
    assert.equal(r.needSave, true, 'server lacks this tab changes');
    // 서버(폰)가 지운 것: 이 탭이 안 고쳤으면 따라 지움, 고쳤으면 남김
    const base3 = { styles: [{ id: 'a', n: 1 }, { id: 'b', n: 1 }], fonts: { x: 1, y: 2 } };
    const tab3 = { styles: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], fonts: { x: 1, y: 2 }, extra: 1 };
    const server3 = { styles: [], fonts: { x: 1 } };
    sync.mergeSalty(tab3, base3, server3);
    assert.deepEqual(tab3.styles, [{ id: 'b', n: 2 }], 'a deleted remotely, b edited here survives');
    assert.deepEqual(tab3.fonts, { x: 1 }, 'removed key follows the server');
    assert.equal(tab3.extra, 1);
    // 같은 값이면 바꾸지 않음
    const same = { k: 1 }; r = sync.mergeSalty(same, { k: 0 }, { k: 1 }); assert.equal(r.changed, false); assert.equal(r.needSave, false);
});
await test('settings sync wiring: registered as 「salty」 on the shared merge, started from index.js regardless of add-ons', async () => {
    const src = await read('src/settings-sync.js');
    assert.match(src, /registerSettingsMerge\('salty', ext => \{/);
    assert.match(src, /startSettingsMerge\(\{ save \}\)/);
    assert.match(await read('index.js'), /startThemeSettingsSync\(\{ getSalty: \(\) => SillyTavern\.getContext\(\)\.extensionSettings\?\.salty, save: saveSettings, after: \(\) => \{ applyAll\(\); refreshPanels\(\); \} \}\);/);
});

// ---- data-04 · integration-02 단어 도구 (원문 확인)
await test('word presets: delete asks (danger) and offers undo; loading over unsaved rules asks and offers undo; capture preset delete asks', async () => {
    const wt = await read('src/word-tools.js'), co = await read('src/capture-options.js');
    assert.match(wt, /import \{ ask, attachUndo \} from '\.\/ask\.js';/);
    assert.match(wt, /if\(!await ask\(`치환 프리셋 「\$\{preset\.name\}」을 지울까요\?`,\{ok:'지우기',danger:true\}\)\)return;/);
    assert.match(wt, /if\(unsaved&&!await ask\(/);
    assert.equal((wt.match(/attachUndo\(globalThis\.toastr/g) || []).length, 2);
    assert.match(co, /if\(!await ask\(`캡처 프리셋 「\$\{gone\.name\}」을 지울까요\?`,\{ok:'지우기',danger:true\}\)\)return;/);
    assert.match(co, /attachUndo\(globalThis\.toastr/);
});
await test('word replace: an original-text change also raises the bridge event (translated rows cannot send MESSAGE_UPDATED)', async () => {
    const wt = await read('src/word-tools.js');
    assert.match(wt, /if\(was!==now\)try\{document\.dispatchEvent\(new CustomEvent\('blue-lemonade:message-text-changed',\{detail:\{messageId:row\.id,before:was,after:now,by:'word-tools'\}\}\)\);\}catch/);
    assert.match(wt, /ctx\.eventSource\.emit\(ctx\.eventTypes\.MESSAGE_UPDATED,row\.id\)/, 'untranslated rows keep MESSAGE_UPDATED');
});

// ---- mobile-04 카드 고르기 초점
await test('card picker focuses the search box only on mouse devices', async () => {
    const picker = await load('src/prompt-card-picker.js', { showThemeModal() {} });
    globalThis.matchMedia = () => ({ matches: true });
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true }); assert.equal(picker.mouseDevice(), true);
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5 }, configurable: true }); assert.equal(picker.mouseDevice(), false);
    globalThis.matchMedia = () => ({ matches: false }); assert.equal(picker.mouseDevice(), false);
    const src = await read('src/prompt-card-picker.js');
    assert.match(src, /showThemeModal\(dialog\);if\(mouseDevice\(\)\)search\.focus\(\);/);
    assert.doesNotMatch(src, /showThemeModal\(dialog\);search\.focus\(\)/);
});

// ---- mobile-01 새 답 첫 줄 단추 자리
await test('reply-top sits above the measured input panel (two-line phone panel, quick replies, notes bar)', async () => {
    const rt = await load('src/reply-top.js', {});
    assert.equal(rt.footOffset({ bottom: 843 }, { top: 707.2, height: 135.8 }), 136);
    assert.equal(rt.footOffset({ bottom: 843 }, { top: 751.2, height: 91.8 }), 92);
    assert.equal(rt.footOffset({ bottom: 843 }, { top: 0, height: 0 }), null, 'hidden panel → CSS fallback');
    const src = await read('src/reply-top.js');
    assert.match(src, /btn\.style\?\.setProperty\?\.\('--bl-reply-foot'/);
    assert.match(src, /resize = new ResizeObserver\(place\)/);
});

delete globalThis.__bh2;
console.log(`PASS bughunt2 core: ${passed} checks`);
