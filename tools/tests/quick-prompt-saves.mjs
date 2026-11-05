// 1.0.3 프롬프트 켜짐 묶음 저장 (src/quick/prompt-saves-core.js · src/quick/prompt-saves.js)
//   · 다듬기(깨진 값 · 같은 id · 12개 · 이름 24자 · 빈 묶음) · 찍기 · 입히기 계획(허락 안 된 항목 · 없는 항목 · 새 항목은 그대로) · 같은지 · 순서
//   · 기본 꺼짐 · 서랍 문 뒤에서 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 변경한 설정에서 묶음 목록은 뺌
//   · 가짜 브라우저: 목록 위 칩 줄 · 실리태번이 칸을 다시 그려도 다시 꽂힘(바로 아래 자식만 봄) · 저장 → 칩 · 누르면 입힘 + ↶ · 프리셋마다 따로
//   · 덮어쓰기 · 이름 바꾸기 · 순서 · 지우기(물음) · 끄면 줄 · 감시 · 사건 없음
//   node tools/tests/quick-prompt-saves.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/quick/prompt-saves-core.js'));

await test('다듬기: 깨진 값 · 같은 id · 빈 묶음 · 이름 · 최대 수', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, name: `n${i}`, states: { a: true } }));
    assert.equal(core.tidySets(many).length, core.MAX_SETS);
    const out = core.tidySets([null, 'x', [], { id: 'a', name: '  긴   이름 ' + 'ㄱ'.repeat(40), states: { main: true, nsfw: false, bad: 'yes', __proto__: { x: true } } }, { id: 'a', name: '같은 id', states: { main: false } }, { id: 'e', name: '빈', states: {} }, { id: '../x', states: { q: true } }]);
    assert.equal(out.length, 3);
    assert.equal(out[0].name.length, core.MAX_NAME);
    assert.deepEqual(out[0].states, { main: true, nsfw: false });
    assert.notEqual(out[1].id, 'a');
    assert.match(out[2].id, /^[A-Za-z0-9_-]+$/);
    assert.match(out[2].name, /^묶음 3$/);
    assert.deepEqual(core.tidySets('junk'), []);
});

await test('찍기 · 입히기 계획 · 같은지', () => {
    const order = [{ identifier: 'main', enabled: true }, { identifier: 'nsfw', enabled: false }, { identifier: 'jb', enabled: true }, { identifier: 'new', enabled: true }];
    const set = { states: { main: false, nsfw: true, jb: true, gone: true } };
    assert.deepEqual(core.snapshot(order), { main: true, nsfw: false, jb: true, new: true });
    assert.deepEqual(core.planApply(set, order), [['main', false], ['nsfw', true]]);
    assert.deepEqual(core.planApply(set, order, id => id !== 'main'), [['nsfw', true]], '허락 안 된 항목은 그대로');
    assert.equal(core.matches(set, order), false);
    assert.equal(core.matches({ states: { main: true, jb: true, gone: false } }, order), true, '없는 항목 · 새 항목은 안 봄');
    assert.equal(core.matches({ states: { gone: true } }, order), false, '겹치는 항목이 없으면 같지 않음');
    assert.equal(core.matches({ states: { main: true, nsfw: true } }, order, id => id !== 'nsfw'), true, '켜고 끌 수 없는 항목은 안 봄');
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.deepEqual(core.moveSet(list, 'b', -1).map(s => s.id), ['b', 'a', 'c']);
    assert.equal(core.moveSet(list, 'a', -1), null);
});

await test('기본 꺼짐 · 서랍 문 뒤에서 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 변경한 설정에서 목록은 뺌', () => {
    assert.match(read('src/settings.js'), /promptSaves: \{ on: false, presets: \{\} \}/);
    const f = read('src/features.js');
    assert.match(f, /s\.promptSaves\?\.on === true/);
    assert.match(f, /onGate\('drawer', promptSaves \|\| modules\.promptsaves \? \(\) => load\('promptsaves', '\.\/quick\/prompt-saves\.js'\)/);
    assert.match(read('src/panel.js'), /toggle\('promptSaves\.on', s\.promptSaves\?\.on === true\)/);
    assert.match(read('src/settings-search.js'), /'promptSaves\.on'\]/);
    assert.match(read('src/settings-labels.js'), /'promptSaves\.on':'프롬프트 켜짐 묶음'/);
    assert.match(read('src/settings-differences.js'), /'promptSaves\.presets'/);
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, promptSaves: { on: true, presets: {} } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
const toasts = [];
globalThis.toastr = { info: m => { toasts.push(m); return null; }, success: m => { toasts.push(m); return null; }, warning: m => toasts.push(m), error: m => toasts.push(m), clear() {} };
let confirmAnswer = true; globalThis.confirm = () => confirmAnswer;
delete ctx.Popup;
let preset = 'Alpha';
ctx.getPresetManager = () => ({ getSelectedPresetName: () => preset });
let nameAnswer = '짧게';
ctx.callGenericPopup = async () => nameAnswer;

const container = document.getElementById('completion_prompt_manager');
const order = [{ identifier: 'main', enabled: true }, { identifier: 'nsfw', enabled: false }, { identifier: 'jb', enabled: true }, { identifier: 'locked', enabled: true }];
let renders = 0, saves = 0;
// 실리태번 renderPromptManager 흉내: 칸을 비우고 머리 · 목록을 새로 넣어요
const rerender = () => { container.replaceChildren(); const head = document.createElement('div'); head.className = 'completion_prompt_manager_header'; const list = document.createElement('ul'); list.id = 'completion_prompt_manager_list'; container.append(head, list); };
rerender();
const pm = {
    activeCharacter: { id: 0 },
    getPromptOrderForCharacter: () => order,
    getPromptOrderEntry: (c, id) => order.find(e => e.identifier === id),
    getPromptById: id => ({ identifier: id }),
    isPromptToggleAllowed: p => p.identifier !== 'locked',
    render: () => { renders++; rerender(); },
    saveServiceSettings: () => { saves++; },
};
const P = await import(url('src/quick/prompt-saves.js'));
P._forTest.setApi({ promptManager: pm });
const base = dom.listenerCounts(eventSource);
await P.syncPromptSaves(true);
const tick = () => dom.clock.advance(40);
const rowEl = () => container.querySelector('.bl-ps-row');
const chips = () => [...container.querySelectorAll('.bl-ps-chip[data-ps-id]')].map(c => [c.textContent, c.getAttribute('aria-pressed')]);

await test('켜면 목록 바로 위 칩 줄 · 묶음이 없으면 「켜짐 묶음 저장」 하나', () => {
    const row = rowEl();
    assert.ok(row);
    assert.equal(row.nextElementSibling.id, 'completion_prompt_manager_list');
    assert.match(row.textContent, /켜짐 묶음 저장/);
    assert.ok(container.querySelector('link#bl-quick-style') || document.getElementById('bl-quick-style'), '모양 시트');
});

await test('저장 → 칩(지금 상태와 같아 눌린 모양) · 프리셋마다 따로 테마 설정에', async () => {
    await P._forTest.addSet();
    assert.deepEqual(chips(), [['짧게', 'true']]);
    assert.deepEqual(settings.promptSaves.presets.Alpha[0].states, { main: true, nsfw: false, jb: true, locked: true });
    preset = 'Beta'; P._forTest.paint();
    assert.deepEqual(chips(), [], '다른 프리셋엔 없음');
    preset = 'Alpha'; P._forTest.paint();
});

await test('실리태번이 칸을 다시 그려도 칩 줄이 다시 꽂힘', async () => {
    rerender();
    assert.equal(rowEl(), null);
    await tick();
    assert.ok(rowEl());
    assert.equal(rowEl().nextElementSibling.id, 'completion_prompt_manager_list');
});

await test('칩 누르면 다른 것만 입힘(허락 안 된 항목은 그대로) · ↶ 계획 · 같으면 그대로', async () => {
    order[0].enabled = false; order[1].enabled = true; order[3].enabled = false;
    P._forTest.paint();
    assert.deepEqual(chips(), [['짧게', 'false']]);
    const id = settings.promptSaves.presets.Alpha[0].id;
    renders = 0; saves = 0; toasts.length = 0;
    rowEl().querySelector(`[data-ps-id="${id}"]`).click();
    await tick();
    assert.deepEqual(order.map(e => e.enabled), [true, false, true, false], 'locked 는 그대로');
    assert.equal(renders, 1); assert.equal(saves, 1);
    assert.match(toasts[0], /2개를 바꿨어요/);
    assert.deepEqual(chips(), [['짧게', 'true']]);
    toasts.length = 0;
    P._forTest.apply(id);
    assert.match(toasts[0], /그대로예요/);
    assert.equal(renders, 1);
});

await test('덮어쓰기 · 이름 바꾸기 · 순서 · 지우기(물음, 취소면 그대로)', async () => {
    nameAnswer = '길게';
    await P._forTest.addSet();
    const [a, b] = settings.promptSaves.presets.Alpha.map(s => s.id);
    order[2].enabled = false;
    await P._forTest.overwrite(a);
    assert.equal(settings.promptSaves.presets.Alpha[0].states.jb, false);
    nameAnswer = '아주 짧게';
    await P._forTest.rename(a);
    assert.equal(settings.promptSaves.presets.Alpha[0].name, '아주 짧게');
    P._forTest.move(b, -1);
    assert.deepEqual(settings.promptSaves.presets.Alpha.map(s => s.name), ['길게', '아주 짧게']);
    confirmAnswer = false;
    await P._forTest.remove(b);
    assert.equal(settings.promptSaves.presets.Alpha.length, 2);
    confirmAnswer = true;
    await P._forTest.remove(b);
    await P._forTest.remove(a);
    assert.equal(settings.promptSaves.presets.Alpha, undefined, '다 지우면 프리셋 칸도 없앰');
    nameAnswer = null;
    await P._forTest.addSet();
    assert.equal(settings.promptSaves.presets.Alpha, undefined, '이름 창 취소');
});

await test('끄면 칩 줄 · 감시 · 사건이 남지 않음(다시 그려도 안 생김)', async () => {
    await P.syncPromptSaves(false);
    assert.equal(rowEl(), null);
    rerender(); await tick();
    assert.equal(rowEl(), null);
    assert.equal(eventSource.byType()[ctx.eventTypes.OAI_PRESET_CHANGED_AFTER] ?? 0, 0, '프리셋 바뀜 사건 뗌');
    const now = dom.listenerCounts(eventSource);
    assert.deepEqual({ ...now, eventSource: 0 }, { ...base, eventSource: 0 }, '요소 · 문서 · 창 리스너 없음');
    const { domWatchStats } = await import(url('src/dom-watch.js'));
    assert.equal(domWatchStats().subscriptions, 0);
});

console.log(`quick-prompt-saves: ${passed}개 통과`);
