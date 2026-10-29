// 전개 지시 (src/addons/direction) 깃털 창의 저장 · 최근 목록과 설정 카드가 고치는 설정 — 진짜 ensureButton · openPopup · onListClick · buildSettings 로
//   node tools/tests/direction-saved-list.mjs <테마 루트>   (공개 저장소는 '.')
// story-direction.mjs 와 같은 틀: index.js 를 '// ── 시작' 앞까지 떼어 data: 모듈로 불러온다. 화면은 작은 가짜 DOM (querySelector 는 고르개마다 요소 하나,
// [data-…="값"] 고르개면 그 data 값을 가진 요소 — 마크업의 속성 그대로). 확인 창(callGenericPopup)은 정해 둔 답. 지시 글은 지어낸 것.
// 확인하는 것:
//   1) 깃털 창: 적은 글은 치는 대로 저장 · 스위치는 켜짐만 바꾸고 글은 그대로
//   2) 저장 목록: 그 쪽 것만 보임 · 누르면 입력칸에 불러옴 — 덮어쓰는 글이 저장에도 최근에도 없으면 최근에 남김 (되찾기) · 저장된 글이면 안 남김
//   3) 저장 지우기는 확인을 받아서만 (걸러 보인 목록의 그 항목을) · 최근 지우기는 바로 · 최근에서 저장 · 지금 내용 저장 · 같은 글 두 번 · 가득 차면 알림만
//   4) 지우개: 확인을 받아야 지움 · 지운 글은 최근에 남김 · 빈 칸이면 묻지도 않음 · 항상 지시 쪽도 같음
//   5) 설정 카드: 넣는 곳(1.4.0 위치 · 역할 · 깊이 0~100 단추 · 직접 입력, 전개 지시 · 항상 지시 따로) · 켜짐 색은 맞는 코드만 · 프롬프트 직접 고침 · 기본값으로는 확인 뒤에만 · 입력창 버튼 끄면 창도 닫힘
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const src = rel => path.join(root, rel);

// ---------- 작은 가짜 DOM
class FakeClassList {
    constructor() { this.names = new Set(); }
    add(...names) { names.forEach(name => this.names.add(name)); }
    remove(...names) { names.forEach(name => this.names.delete(name)); }
    toggle(name, force) { const on = force === undefined ? !this.names.has(name) : !!force; if (on) this.names.add(name); else this.names.delete(name); return on; }
    contains(name) { return this.names.has(name); }
}
const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const ALL = {   // querySelectorAll 이 돌려줄 요소 (그 밖은 빈 목록)
    '.jj-seg [data-list]': () => [new El('button', { list: 'presets' }), new El('button', { list: 'history' })],
    '.jj-stepper [data-step]': () => [new El('button', { step: '-1' }), new El('button', { step: '1' })],
};
class El {
    constructor(tag = 'div', data = {}) {
        Object.assign(this, { tagName: tag.toUpperCase(), dataset: { ...data }, classList: new FakeClassList(), style: { setProperty() {}, removeProperty() {} },
            attrs: {}, listeners: {}, children: [], found: new Map(), all: new Map(), hidden: false, disabled: false, value: '', textContent: '', innerHTML: '',
            offsetLeft: 0, offsetWidth: 0, scrollLeft: 0, parentElement: null, nextElementSibling: null });
    }
    querySelector(sel) {
        if (!this.found.has(sel)) {
            const attr = /\[data-([a-z-]+)="([^"]*)"\]$/.exec(sel);
            this.found.set(sel, new El('div', attr ? { [camel(attr[1])]: attr[2] } : {}));
        }
        return this.found.get(sel);
    }
    querySelectorAll(sel) { if (!this.all.has(sel)) this.all.set(sel, ALL[sel]?.() ?? []); return this.all.get(sel); }
    get firstElementChild() { return this.querySelector(':first-child'); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
    async fire(type, props = {}) {
        const event = { type, target: this, key: '', button: 0, pointerType: 'mouse', preventDefault() {}, stopPropagation() {}, ...props };
        for (const fn of [...(this.listeners[type] || [])]) await fn(event);
    }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return key in this.attrs ? this.attrs[key] : null; }
    append(...nodes) { for (const node of nodes) { if (node && typeof node === 'object') node.parentElement = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    after(node) { node.parentElement = this.parentElement; this.nextElementSibling = node; }
    remove() { this.removed = true; }
    contains() { return true; }
    closest(sel) { return sel === '[data-act]' && this.dataset.act ? this : null; }
    scrollTo({ left }) { this.scrollLeft = left; }
    getClientRects() { return []; }
    focus() {}
    blur() {}
}
const byId = { send_textarea: new El('textarea'), send_form: new El('form'), extensions_settings: new El() };
globalThis.document = { body: new El('body'), head: new El('head'), documentElement: new El('html'), createElement: tag => new El(tag),
    getElementById: id => byId[id] ?? null, querySelector: () => null, addEventListener() {}, removeEventListener() {} };
globalThis.getComputedStyle = () => ({ position: 'relative', visibility: 'visible', getPropertyValue: () => '' });
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
const toasts = [];
globalThis.toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, text => { toasts.push([kind, String(text)]); }]));

// ---------- index.js 앞부분 (story-direction.mjs 와 같은 떼어 내기)
const { insertInstructions } = await import(pathToFileURL(src('src/addons/direction/prompt.js')).href);
globalThis.__dirPlace=(await import(pathToFileURL(src('src/addons/direction/prompt.js')).href)).placeInstructions;   // 1.4.0 넣는 곳마다
globalThis.__dirTyping=(await import(pathToFileURL(src('src/addons/direction/typing.js')).href)).attachTypingRefresh;   // (10-29) 입력칸 타이핑(조합 중 미루기) — 진짜 모듈
const ext = {};
const P = globalThis.__directionListTest = { ext, insertInstructions, saves: 0, confirm: true, popups: [], context: { substituteParams: text => String(text) } };
const source = (await fs.readFile(src('src/addons/direction/index.js'), 'utf8')).split('// ── 시작')[0].replace(/^import .*;$/gm, '');
const prelude = 'const placeInstructions=globalThis.__dirPlace;const attachTypingRefresh=globalThis.__dirTyping;const setExtensionPrompt=(...a)=>{(globalThis.__dirExt??=[]).push(a);};const extension_prompt_types={NONE:-1,IN_PROMPT:0,IN_CHAT:1,BEFORE_PROMPT:2};const extension_prompt_roles={SYSTEM:0,USER:1,ASSISTANT:2};const P = globalThis.__directionListTest; const extension_settings = P.ext; const insertInstructions = P.insertInstructions;'
    + 'const getContext = () => P.context; const saveSettingsDebounced = () => { P.saves++; }; const eventSource = { on() {}, once() {} }; const event_types = {};'
    + 'const POPUP_TYPE = { TEXT: 1, CONFIRM: 2 }; const callGenericPopup = async (...args) => { P.popups.push(args); return P.confirm; };'
    + 'const oai_settings = {}; const getChatCompletionModel = () => ""; const verifyAddonCss = () => {}; const badgeTextHit = () => true; const showThemeModal = () => {};';
const m = await import('data:text/javascript;base64,' + Buffer.from(prelude + source
    + '\nexport { initSettings, settings, ensureButton, buildSettings, DEFAULT_PROMPT, PRESET_MAX };').toString('base64'));

ext.jeongaejisi = {
    extensionEnabled: true,
    direction: { enabled: true, content: 'A storm rolls in over the harbor.' },
    always: { enabled: false, content: '' },
    presets: [
        { id: 'p1', kind: 'direction', content: 'They share an umbrella.', at: 1 },
        { id: 'p2', kind: 'always', content: '<OOC: keep replies short.>', at: 2 },
        { id: 'p3', kind: 'direction', content: 'A letter arrives at dawn.', at: 3 },
    ],
    history: { direction: [{ content: 'The lighthouse goes dark.', at: 5 }], always: [] },
    directionPrompt: 'D {{direction}}', promptDepth: 1, onColor: '',
};
m.initSettings();
const S = m.settings();
m.ensureButton();
const feather = byId.send_textarea.nextElementSibling;
assert.equal(feather?.id, 'jj-button', '입력창 뒤 깃털 단추');

let popup = null;
async function openPopup() {
    const before = byId.send_form.children.length;
    await feather.fire('click');
    assert.equal(byId.send_form.children.length, before + 1, '깃털을 누르면 창');
    popup = byId.send_form.children.at(-1);
    return popup;
}
const list = () => popup.querySelector('.jj-list');
const rows = () => list().querySelector('.jj-items').children;
const rowTexts = () => rows().map(row => row.children[0].children[0].textContent);
const act = (row, name) => row.children.find(child => child.dataset.act === name);
const click = target => list().fire('click', { target });
const tab = name => popup.querySelectorAll('.jj-seg [data-list]').find(el => el.dataset.list === name);
const textarea = kind => popup.querySelector(`.jj-page[data-kind="${kind}"] .jj-textarea`);

let pass = 0, fail = 0;
async function test(name, fn) {
    P.saves = 0; P.popups.length = 0; P.confirm = true; toasts.length = 0;
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 8).join('\n       ')}`); }
}

await test('깃털 창: 적은 글은 치는 대로 저장 · 스위치는 켜짐만 바꾸고 글은 그대로', async () => {
    await openPopup();
    assert.equal(textarea('direction').value, 'A storm rolls in over the harbor.', '열면 적어 둔 글');
    textarea('direction').value = 'A storm rolls in over the harbor, and the bells ring.';
    await textarea('direction').fire('input');
    assert.equal(S.direction.content, 'A storm rolls in over the harbor, and the bells ring.');
    assert.equal(P.saves, 1);
    await popup.querySelector('.jj-switch').fire('click');
    assert.equal(S.direction.enabled, false); assert.equal(S.direction.content, 'A storm rolls in over the harbor, and the bells ring.', '끄면 글은 그대로');
    await popup.querySelector('.jj-switch').fire('click');
    assert.equal(S.direction.enabled, true); assert.equal(P.saves, 3);
});

await test('저장 목록: 이 쪽 것만 · 누르면 입력칸에 불러옴 — 저장도 최근도 아닌 지금 글은 최근에 남김 · 저장된 글이면 안 남김', async () => {
    await popup.querySelector('[data-act="list"]').fire('click');
    assert.equal(list().hidden, false, '목록이 열림');
    assert.deepEqual(rowTexts(), ['They share an umbrella.', 'A letter arrives at dawn.'], '전개 지시 쪽 저장만 (항상 지시 저장은 안 보임)');
    await click(act(rows()[1], 'use'));
    assert.equal(S.direction.content, 'A letter arrives at dawn.');
    assert.equal(textarea('direction').value, 'A letter arrives at dawn.', '입력칸도');
    assert.equal(S.history.direction[0].content, 'A storm rolls in over the harbor, and the bells ring.', '덮인 글은 최근에서 되찾을 수 있다');
    assert.equal(list().hidden, true, '고르면 목록을 닫음');
    assert.equal(P.saves, 1);
    const recent = S.history.direction.length;
    await popup.querySelector('[data-act="list"]').fire('click');
    await click(act(rows()[0], 'use'));
    assert.equal(S.direction.content, 'They share an umbrella.');
    assert.equal(S.history.direction.length, recent, '저장된 글을 덮을 때는 최근에 안 남김');
});

await test('저장 지우기는 확인 뒤에만 (걸러 보인 목록의 그 항목) · 최근 지우기는 바로 · 최근에서 저장 · 지금 내용 저장 · 같은 글 두 번 안 저장 · 가득 차면 알림만', async () => {
    await popup.querySelector('[data-act="list"]').fire('click');
    P.confirm = false;
    await click(act(rows()[1], 'remove'));
    assert.equal(P.popups.length, 1, '확인 창'); assert.deepEqual(S.presets.map(p => p.id), ['p1', 'p2', 'p3'], '아니요 → 그대로'); assert.equal(P.saves, 0);
    P.confirm = true;
    await click(act(rows()[1], 'remove'));
    assert.deepEqual(S.presets.map(p => p.id), ['p1', 'p2'], '보이는 목록의 두 번째(p3)를 지움 — 전체 목록의 두 번째(항상 지시 p2)가 아니라');
    assert.equal(P.saves, 1);
    // 최근 쪽
    await tab('history').fire('click');
    assert.deepEqual(rowTexts(), S.history.direction.map(h => h.content));
    const target = rows().findIndex(row => row.children[0].children[0].textContent === 'The lighthouse goes dark.');
    assert.ok(target >= 0);
    assert.equal(act(rows()[target], 'keep').disabled, false);
    await click(act(rows()[target], 'keep'));
    assert.deepEqual([S.presets[0].kind, S.presets[0].content], ['direction', 'The lighthouse goes dark.'], '최근에서 저장 = 저장 맨 앞');
    assert.equal(act(rows()[target], 'keep').disabled, true, '저장된 것은 책갈피가 꺼짐');
    const popupsBefore = P.popups.length;
    await click(act(rows()[0], 'remove'));
    assert.equal(P.popups.length, popupsBefore, '최근 지우기는 묻지 않음');
    assert.ok(!S.history.direction.some(h => h.content === 'A storm rolls in over the harbor, and the bells ring.'), '최근에서 지움');
    assert.ok(S.presets.some(p => p.content === 'The lighthouse goes dark.'), '저장은 그대로');
    // 지금 내용 저장
    await tab('presets').fire('click');
    S.direction.content = 'The market burns at midnight.';
    const keep = list().querySelector('[data-act="save-preset"]');
    await click(keep);
    assert.equal(S.presets[0].content, 'The market burns at midnight.');
    const count = S.presets.length;
    await click(keep);
    assert.equal(S.presets.length, count, '같은 글은 두 번 안 저장');
    for (let i = S.presets.length; i < m.PRESET_MAX; i++) S.presets.push({ id: `f${i}`, kind: 'always', content: `filler ${i}`, at: 0 });
    S.direction.content = 'One more scene change.';
    await click(keep);
    assert.equal(S.presets.length, m.PRESET_MAX, '가득 차면 더 안 넣음');
    assert.ok(toasts.some(([kind, text]) => kind === 'warning' && text.includes(`${m.PRESET_MAX}개까지`)));
    S.presets.splice(0, S.presets.length, ...S.presets.filter(p => !String(p.id).startsWith('f')));
    await popup.querySelector('[data-act="list"]').fire('click');   // 목록 닫기
    assert.equal(list().hidden, true);
});

await test('지우개: 확인을 받아야 지움 · 지운 글은 최근에 남김 · 빈 칸이면 묻지도 않음 · 항상 지시 쪽도 같음', async () => {
    const eraser = popup.querySelector('[data-act="clear"]');
    S.direction.content = 'The bridge collapses behind them.';
    P.confirm = false;
    await eraser.fire('click');
    assert.equal(S.direction.content, 'The bridge collapses behind them.', '아니요 → 그대로'); assert.equal(P.saves, 0);
    P.confirm = true;
    await eraser.fire('click');
    assert.equal(S.direction.content, ''); assert.equal(textarea('direction').value, '');
    assert.equal(S.history.direction[0].content, 'The bridge collapses behind them.', '지운 글은 최근에서 되찾음');
    assert.equal(P.saves, 1);
    const asked = P.popups.length;
    await eraser.fire('click');
    assert.equal(P.popups.length, asked, '빈 칸이면 묻지 않음');
    // 제목을 누르면 항상 지시 쪽
    await popup.querySelector('.jj-popup-title').fire('click');
    S.always.content = '<OOC: describe the weather first.>';
    await eraser.fire('click');
    assert.equal(S.always.content, '');
    assert.equal(S.history.always[0].content, '<OOC: describe the weather first.>');
    assert.equal(S.direction.content, '', '전개 지시 쪽은 손대지 않음');
    await popup.querySelector('[data-act="list"]').fire('click');
    assert.deepEqual(rowTexts(), ['<OOC: keep replies short.>'], '항상 지시 쪽에서는 항상 지시 저장만');
    await popup.querySelector('.jj-popup-title').fire('click');   // 전개 지시 쪽으로 돌아감
});

await test('설정 카드: 깊이 0~100 · 켜짐 색은 맞는 코드만 · 프롬프트 직접 고침 · 기본값으로는 확인 뒤에만 · 상태 스위치 · 입력창 버튼 끄면 창도 닫힘', async () => {
    m.buildSettings();
    const card = byId.extensions_settings.children[0];
    assert.equal(card?.id, 'jj-settings');
    // 1.4.0 넣는 곳: 전개 지시 · 항상 지시 줄마다 위치 · 역할 · (채팅 안일 때만) 깊이
    const row = card.querySelector('.jj-place-row[data-kind="direction"]');
    const box = row.children.at(-1);
    assert.equal(box.className, 'jj-place', '줄 끝에 넣는 곳 상자');
    const depth = box.querySelector('[data-field="depth"]');
    assert.equal(depth.value, String(S.direction.place.depth));
    const always = structuredClone(S.always.place);
    for (const [typed, want] of [['250', 100], ['-4', 0], ['x', 1], ['3', 3]]) {
        depth.value = typed; await box.fire('change', { target: depth });
        assert.equal(S.direction.place.depth, want, `깊이 ${typed}`); assert.equal(depth.value, String(want), '칸에도 고른 값');
    }
    const step = n => ({ dataset: {}, closest: sel => sel === '[data-step]' ? { dataset: { step: String(n) } } : null });
    depth.value = '0'; await box.fire('change', { target: depth });
    await box.fire('click', { target: step(-1) }); assert.equal(S.direction.place.depth, 0, '0 아래로 안 내려감');
    await box.fire('click', { target: step(1) }); assert.equal(S.direction.place.depth, 1);
    depth.value = '100'; await box.fire('change', { target: depth }); await box.fire('click', { target: step(1) }); assert.equal(S.direction.place.depth, 100, '100 위로 안 올라감');
    assert.equal(row.querySelector('.jj-place-meaning').textContent, '끝에서 100번째 메시지 앞 · 시스템');
    assert.equal(box.querySelector('.jj-place-depth').hidden, false, '채팅 안이면 깊이 칸이 보임');
    const at = box.querySelector('[data-field="at"]'), role = box.querySelector('[data-field="role"]');
    at.value = 'end'; await box.fire('change', { target: at });
    role.value = 'assistant'; await box.fire('change', { target: role });
    assert.deepEqual(S.direction.place, { at: 'end', role: 'assistant', depth: 100 }, '깊이는 남겨 둠 (채팅 안으로 돌아오면 그대로)');
    assert.equal(box.querySelector('.jj-place-depth').hidden, true, '채팅 안이 아니면 깊이 칸은 숨김');
    assert.equal(row.querySelector('.jj-place-meaning').textContent, '프롬프트 맨 끝 · AI 어시스턴트');
    at.value = 'nowhere'; await box.fire('change', { target: at }); assert.equal(S.direction.place.at, 'depth', '모르는 자리는 채팅 안');
    assert.deepEqual(S.always.place, always, '항상 지시 넣는 곳은 따로');
    // 켜짐 색
    const color = card.querySelector('#jj_on_color');
    color.value = 'ABC'; await color.fire('input');
    assert.equal(S.onColor, '#aabbcc');
    const saves = P.saves;
    color.value = 'not a color'; await color.fire('input');
    assert.equal(S.onColor, '#aabbcc', '잘못된 코드는 저장 안 함'); assert.ok(color.classList.contains('is-invalid')); assert.equal(P.saves, saves);
    color.value = 'rgb(18, 52, 86)'; await color.fire('input');
    assert.equal(S.onColor, '#123456'); assert.ok(!color.classList.contains('is-invalid'));
    await card.querySelector('#jj_on_color_reset').fire('click');
    assert.equal(S.onColor, '', '테마 색으로');
    const swatch = card.querySelector('#jj_on_color_swatch');
    swatch.value = '#336699'; await swatch.fire('input');
    assert.equal(S.onColor, '#336699'); assert.equal(color.value, '#336699');
    // 프롬프트
    const prompt = card.querySelector('#jj_prompt');
    assert.equal(prompt.value, 'D {{direction}}');
    prompt.value = 'Next: {{direction}}'; await prompt.fire('input');
    assert.equal(S.directionPrompt, 'Next: {{direction}}');
    P.confirm = false;
    await card.querySelector('#jj_reset').fire('click');
    assert.equal(S.directionPrompt, 'Next: {{direction}}', '아니요 → 고친 프롬프트 그대로');
    P.confirm = true;
    await card.querySelector('#jj_reset').fire('click');
    assert.equal(S.directionPrompt, m.DEFAULT_PROMPT); assert.equal(prompt.value, m.DEFAULT_PROMPT);
    // 상태 카드 스위치: 켜짐만
    S.always.content = '<OOC: short scenes.>';
    const alwaysSwitch = card.querySelector('.jj-status[data-kind="always"] .jj-switch');
    await alwaysSwitch.fire('click');
    assert.equal(S.always.enabled, true); assert.equal(S.always.content, '<OOC: short scenes.>');
    await alwaysSwitch.fire('click');
    assert.equal(S.always.enabled, false); assert.equal(S.always.content, '<OOC: short scenes.>', '꺼도 글은 그대로');
    // 입력창 버튼 끄기: 깃털 창을 닫고 단추를 숨긴다 · 적은 글은 그대로
    assert.equal(popup.classList.contains('is-open'), true);
    await card.querySelector('#jj_extension_switch').fire('click');
    assert.equal(S.extensionEnabled, false);
    assert.equal(popup.classList.contains('is-open'), false, '창이 닫힘');
    assert.equal(feather.hidden, true, '깃털 단추 숨김');
    assert.deepEqual([S.direction.content, S.always.content], ['', '<OOC: short scenes.>']);
    await card.querySelector('#jj_extension_switch').fire('click');
    assert.equal(S.extensionEnabled, true); assert.equal(feather.hidden, false);
});

delete globalThis.__directionListTest;
console.log(`\ndirection-saved-list: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
