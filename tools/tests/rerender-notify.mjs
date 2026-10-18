// 6.5.2 다시 그린 메시지를 실리태번 헬퍼에 알리기 (src/rerender-notify.js): 이벤트 고르기 · 보낼 때/안 보낼 때 · 중첩(무한 루프) 막기 ·
// 메시지별 따로 · 연결(번역기 refreshMessageBlock · handleMessageEdit 건너뛰기 · 다시 쓰기 · 북마크 · 단어 치환 · 접기 · 에셋 · CI 등록).
// 실리태번 · 브라우저 · 네트워크 없음 — 작은 DOM 흉내와 실리태번과 같은 순서의 이벤트 버스(청취자를 차례로 await)로 돌린다.
//   node tools/tests/rerender-notify.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const R = await import(pathToFileURL(path.join(root, 'src/rerender-notify.js')).href);

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + (error.stack || error)); }
}

// ── 작은 DOM 흉내: 태그 · .class · #id · [attr="v"] · 자손(공백) · 쉼표 목록만 ──
class El {
    constructor(tag, { id = '', classes = [], attrs = {}, text = '' } = {}) {
        this.tagName = tag.toUpperCase(); this.id = id; this.attrs = { ...attrs }; this.text = text; this.children = []; this.parentElement = null;
        const set = new Set(classes);
        this.classList = { contains: c => set.has(c), add: c => set.add(c), remove: c => set.delete(c) };
    }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } return this; }
    remove() { const p = this.parentElement; if (p) { p.children = p.children.filter(c => c !== this); this.parentElement = null; } }
    get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
    matches(simple) {
        const m = simple.match(/^([a-z0-9_-]+)?((?:[.#][\w-]+)*)((?:\[[^\]]+\])*)$/i);
        if (!m) throw Error('selector not supported: ' + simple);
        if (m[1] && m[1].toUpperCase() !== this.tagName) return false;
        for (const part of (m[2].match(/[.#][\w-]+/g) || [])) {
            if (part[0] === '#' && this.id !== part.slice(1)) return false;
            if (part[0] === '.' && !this.classList.contains(part.slice(1))) return false;
        }
        for (const attr of (m[3].match(/\[[^\]]+\]/g) || [])) {
            const [, name, value] = attr.match(/^\[([\w-]+)="([^"]*)"\]$/);
            if (String(this.attrs[name]) !== value) return false;
        }
        return true;
    }
    descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
    querySelectorAll(selector) {
        const out = [];
        for (const alternative of selector.split(',').map(s => s.trim()).filter(Boolean)) {
            const steps = alternative.split(/\s+/);
            let pool = [this];
            for (const step of steps) pool = pool.flatMap(node => node.descendants().filter(d => d.matches(step)));
            for (const node of pool) if (!out.includes(node)) out.push(node);
        }
        return out;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    getElementById(id) { return this.descendants().find(d => d.id === id) ?? null; }
}
const CARD = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><script id="fh-colorscheme-sync"></script></head>\n<body>card</body>\n</html>';
function page({ frontend = true, wrapped = false, editing = false, extraPre = false } = {}) {
    const doc = new El('document'); const chat = new El('div', { id: 'chat' }); doc.append(chat);
    const mes = new El('div', { classes: ['mes'], attrs: { mesid: '4' } }); chat.append(mes);
    const text = new El('div', { classes: ['mes_text'] }); mes.append(text);
    if (frontend) {
        const pre = new El('pre'); pre.append(new El('code', { text: CARD }));
        if (wrapped) { const wrap = new El('div', { classes: ['TH-render'] }); wrap.append(pre); text.append(wrap); }
        else text.append(pre);
    }
    if (extraPre) { const pre = new El('pre'); pre.append(new El('code', { text: 'plain code' })); text.append(pre); }
    if (editing) mes.append(new El('textarea', { id: 'curEditTextarea', classes: ['edit_textarea'] }));
    return { doc, mes, text };
}
/** 번역문을 다시 그린 것처럼: 본문을 통째로 바꿔 원시 <pre> 만 남긴다 (updateMessageBlock 이 .mes_text.html(...) 을 하는 것과 같다) */
function rerenderRaw(text) { text.children = []; const pre = new El('pre'); pre.append(new El('code', { text: CARD })); text.append(pre); }
/** 헬퍼처럼: 틀 없는 프런트엔드 <pre> 를 .TH-render 로 감싼다 */
function helperWrap(mes) {
    for (const pre of mes.querySelectorAll('.mes_text pre')) {
        if (!R.isFrontendCode(pre.textContent) || pre.parentElement.classList.contains('TH-render')) continue;
        const parent = pre.parentElement, wrap = new El('div', { classes: ['TH-render'] });
        parent.children[parent.children.indexOf(pre)] = wrap; wrap.parentElement = parent; wrap.append(pre);
    }
}
// 실리태번 lib/eventemitter.js 와 같은 뜻: 청취자 사본을 차례로 await, 하나가 던져도 나머지는 돈다
class Emitter {
    constructor() { this.events = {}; this.log = []; }
    on(type, fn) { (this.events[type] ??= []).push(fn); }
    makeFirst(type, fn) { (this.events[type] ??= []).unshift(fn); }
    async emit(type, ...args) {
        this.log.push([type, ...args]);
        for (const fn of [...(this.events[type] || [])]) { try { await fn(...args); } catch (error) { this.errors = (this.errors || 0) + 1; } }
    }
}
const TYPES = { MESSAGE_UPDATED: 'message_updated', MESSAGE_EDITED: 'message_edited', CHARACTER_MESSAGE_RENDERED: 'character_message_rendered' };
function rig({ frontend = true, wrapped = false, editing = false, helper = true, settings = {}, chat = [], extraPre = false } = {}) {
    const p = page({ frontend, wrapped, editing, extraPre });
    const bus = new Emitter();
    const ctx = { eventSource: bus, event_types: TYPES, eventTypes: TYPES, extensionSettings: { disabledExtensions: ['translate'], ...settings }, chat };
    const N = R.createRerenderNotifier({ getContext: () => ctx, document: p.doc, helperPresent: () => helper, log: () => {} });
    return { ...p, bus, ctx, N };
}
const updated = bus => bus.log.filter(([type]) => type === TYPES.MESSAGE_UPDATED);

// ── 1. 판단 함수 ──
await test('isFrontendCode: 헬퍼와 같은 세 표식(html> · <head> · <body)', () => {
    assert.equal(R.isFrontendCode(CARD), true);
    assert.equal(R.isFrontendCode('<div>not a page</div>'), false);
    assert.equal(R.isFrontendCode('```html\n<body class="x">'), true);
    assert.equal(R.isFrontendCode(''), false); assert.equal(R.isFrontendCode(null), false);
});
await test('needsHelperRender: 틀 없는 프런트엔드 <pre> 만 — 일반 코드 · 이미 .TH-render 안 · 본문 없음은 아니다', () => {
    assert.equal(R.needsHelperRender(page().mes), true);
    assert.equal(R.needsHelperRender(page({ wrapped: true }).mes), false);
    assert.equal(R.needsHelperRender(page({ frontend: false, extraPre: true }).mes), false, '프런트엔드가 아닌 코드 블록은 헬퍼가 iframe 으로 안 그린다');
    assert.equal(R.needsHelperRender(page({ frontend: false }).mes), false);
    assert.equal(R.needsHelperRender(null), false); assert.equal(R.needsHelperRender({}), false);
});
await test('helperRenderMode: 없음 · 끔 · 스트리밍 · iframe — 헬퍼 4.x 의 설정 열쇠는 tavern_helper (설정이 없으면 iframe)', () => {
    assert.equal(R.helperRenderMode({ settings: {}, present: false }), 'none');
    assert.equal(R.helperRenderMode({ settings: {}, present: true }), 'iframe');
    assert.equal(R.helperRenderMode({ settings: { tavern_helper: { render: { enabled: true, allow_streaming: false } } }, present: true }), 'iframe');
    assert.equal(R.helperRenderMode({ settings: { tavern_helper: { render: { enabled: false } } }, present: true }), 'off');
    assert.equal(R.helperRenderMode({ settings: { tavern_helper: { render: { enabled: true, allow_streaming: true } } }, present: true }), 'streaming');
    assert.equal(R.helperRenderMode({ settings: { TavernHelper: { render: { enabled: false } } }, present: true }), 'iframe', '옛 열쇠의 새 꼴은 모른다 — 기본으로');
    assert.equal(R.helperRenderMode({ settings: { TavernHelper: { render: { render_enabled: false } } }, present: true }), 'off', '4.0 전 설정 블록');
    assert.equal(R.helperRenderMode({ settings: { tavern_helper: { render: { enabled: true } }, TavernHelper: { render: { render_enabled: false } } }, present: true }), 'iframe', '새 설정이 있으면 옛 블록은 안 본다');
});
await test('builtinTranslateInterferes: 기본 번역 확장이 켜져 있고, 번역문이 있거나 그 확장의 자동 번역이 켜져 있을 때', () => {
    const shown = { extra: { display_text: '번역' } }, plain = { extra: {} };
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: ['translate'] }, shown), false);
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: ['translate'], translate: { auto_mode: 'responses' } }, plain), false, '껐으면 자동 모드와 상관없다');
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: [] }, shown), true);
    assert.equal(R.builtinTranslateInterferes({}, shown), true, '목록이 없으면 켜진 것으로 본다');
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: [] }, plain), false, '번역문 없음 · 자동 번역 없음 → 그 확장은 아무것도 안 한다');
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: [], translate: { auto_mode: 'none' } }, plain), false);
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: [], translate: { auto_mode: 'responses' } }, plain), true, '자동 번역이면 번역문 없는 글도 제 공급자로 번역해 붙인다');
    assert.equal(R.builtinTranslateInterferes({ disabledExtensions: [] }, undefined), false);
});

// ── 2. 보낼 때 ──
await test('헬퍼가 있고 틀 없는 카드가 남았으면 MESSAGE_UPDATED 를 그 번호(숫자)로 한 번 보내고, 청취자가 끝난 뒤 true', async () => {
    const { bus, N } = rig();
    let finished = false;
    bus.on(TYPES.MESSAGE_UPDATED, async () => { await new Promise(r => setTimeout(r, 5)); finished = true; });
    assert.equal(await N.notify('4'), true);
    assert.equal(finished, true, '청취자(헬퍼)가 끝난 뒤에야 돌아온다');
    assert.deepEqual(bus.log, [[TYPES.MESSAGE_UPDATED, 4]], '다른 이벤트는 보내지 않는다 (CHARACTER_MESSAGE_RENDERED · SWIPED · EDITED 아님)');
});
await test('element 를 주면 문서를 다시 찾지 않는다', async () => {
    const { mes, bus, N } = rig();
    const doc = { querySelector: () => { throw Error('문서를 뒤지면 안 된다'); } };
    const M = R.createRerenderNotifier({ getContext: () => ({ eventSource: bus, event_types: TYPES, extensionSettings: { disabledExtensions: ['translate'] }, chat: [] }), document: doc, helperPresent: () => true });
    assert.equal(await M.notify(4, { element: mes }), true);
    assert.equal(updated(bus).length, 1);
});

// ── 3. 안 보낼 때 ──
await test('헬퍼가 없으면 아무것도 안 한다', async () => {
    const { bus, N } = rig({ helper: false });
    assert.equal(await N.notify(4), false); assert.equal(bus.log.length, 0);
});
await test('헬퍼 렌더를 껐거나 스트리밍 렌더 모드면 안 보낸다 (그 모드는 MESSAGE_UPDATED 를 안 듣는다)', async () => {
    for (const render of [{ enabled: false }, { enabled: true, allow_streaming: true }]) {
        const { bus, N } = rig({ settings: { tavern_helper: { render } } });
        assert.equal(await N.notify(4), false, JSON.stringify(render)); assert.equal(bus.log.length, 0);
    }
});
await test('그릴 코드가 없거나 · 이미 헬퍼 틀 안이거나 · 편집 창이 열렸거나 · 화면에 없으면 안 보낸다', async () => {
    for (const [name, options] of [['코드 없음', { frontend: false }], ['일반 코드만', { frontend: false, extraPre: true }], ['이미 틀 안', { wrapped: true }], ['편집 중', { editing: true }]]) {
        const { bus, N } = rig(options);
        assert.equal(await N.notify(4), false, name); assert.equal(bus.log.length, 0, name);
    }
    const { bus, N } = rig();
    assert.equal(await N.notify(9), false, '화면에 없는 번호'); assert.equal(bus.log.length, 0);
    assert.equal(await N.notify(-1), false); assert.equal(await N.notify('x'), false); assert.equal(await N.notify(null), false); assert.equal(bus.log.length, 0);
});
await test('실리태번 기본 번역 확장이 켜져 있고 번역문이 붙어 있으면 안 보낸다 (그 확장이 MESSAGE_UPDATED 에 번역문을 지운다)', async () => {
    const shown = { mes: 'a', extra: { display_text: '번역' } }, plain = { mes: 'a', extra: {} };
    let r = rig({ settings: { disabledExtensions: [] }, chat: [0, 0, 0, 0, shown] });
    assert.equal(await r.N.notify(4), false); assert.equal(r.bus.log.length, 0);
    r = rig({ settings: { disabledExtensions: [] }, chat: [0, 0, 0, 0, plain] });
    assert.equal(await r.N.notify(4), true, '번역문이 없으면 기본 번역 확장이 할 일이 없다');
    r = rig({ settings: { disabledExtensions: ['translate'] }, chat: [0, 0, 0, 0, shown] });
    assert.equal(await r.N.notify(4), true, '기본 번역 확장을 껐으면 보낸다');
});
await test('getContext 가 없거나 eventSource · MESSAGE_UPDATED 가 없으면 조용히 false', async () => {
    const p = page();
    for (const getContext of [undefined, () => null, () => { throw Error('x'); }, () => ({ eventSource: {}, event_types: TYPES }), () => ({ eventSource: new Emitter(), event_types: {} })]) {
        const M = R.createRerenderNotifier({ getContext, document: p.doc, helperPresent: () => true });
        assert.equal(await M.notify(4), false);
    }
});
await test('emit 이 던지면 false 로 돌아오고 다음 알림은 다시 보낼 수 있다', async () => {
    const { bus, N } = rig();
    bus.emit = async () => { throw Error('bus down'); };
    assert.equal(await N.notify(4), false); assert.equal(N.isNotifying(4), false);
    bus.emit = Emitter.prototype.emit;
    assert.equal(await N.notify(4), true);
});

// ── 4. 돌지 않기 ──
await test('헬퍼가 틀을 씌운 뒤 번역기가 또 그려 알림을 또 부르면(중첩) 보내지 않는다 — MESSAGE_UPDATED 는 알림마다 한 번', async () => {
    const { mes, text, bus, N } = rig();
    let nested = [];
    bus.on(TYPES.MESSAGE_UPDATED, id => { helperWrap(mes); });                                   // 헬퍼
    bus.on(TYPES.MESSAGE_UPDATED, async id => { rerenderRaw(text); nested.push(await N.notify(id)); }); // 번역기 handleMessageEdit 이 건너뛰지 않는 최악의 경우
    bus.on(TYPES.MESSAGE_UPDATED, id => { assert.equal(N.isNotifying(id), true, '청취자가 도는 동안은 알림 중'); });
    assert.equal(await N.notify(4), true);
    assert.deepEqual(nested, [false], '중첩 알림은 보내지 않는다');
    assert.equal(updated(bus).length, 1);
    assert.equal(N.isNotifying(4), false, '끝나면 풀린다');
    assert.equal(R.needsHelperRender(mes), true, '그 경우 카드는 코드로 남는다 — 그래서 번역기 handleMessageEdit 은 isRerenderNotify 로 건너뛴다 (아래 연결 검사)');
});
await test('번역기가 isRerenderNotify 로 건너뛰면 헬퍼 틀이 남고, 알림이 끝난 뒤의 새 알림은 다시 보낸다', async () => {
    const { mes, text, bus, N } = rig();
    bus.on(TYPES.MESSAGE_UPDATED, id => { helperWrap(mes); });
    bus.on(TYPES.MESSAGE_UPDATED, async id => { if (N.isNotifying(id)) return; rerenderRaw(text); await N.notify(id); });
    assert.equal(await N.notify(4), true);
    assert.equal(updated(bus).length, 1); assert.equal(R.needsHelperRender(mes), false, '카드가 틀 안에 있다');
    rerenderRaw(text);
    assert.equal(await N.notify(4), true, '다음 다시 그리기는 새 알림');
    assert.equal(updated(bus).length, 2);
});
await test('실리태번 편집 흐름(바깥 MESSAGE_UPDATED) 안에서 번역기가 다시 그려 알리면 한 번 더 보내되 그 안에서는 더 돌지 않는다', async () => {
    const { mes, text, bus, N } = rig();
    const translator = async id => { if (N.isNotifying(id)) return; rerenderRaw(text); await N.notify(id); };   // handleMessageEdit '해시 같음' 가지
    bus.on(TYPES.MESSAGE_UPDATED, id => helperWrap(mes));
    bus.on(TYPES.MESSAGE_UPDATED, translator);
    await bus.emit(TYPES.MESSAGE_UPDATED, 4);   // 실리태번이 보낸 것 (알림기 밖)
    assert.equal(updated(bus).length, 2, '바깥 1 + 알림 1');
    assert.equal(R.needsHelperRender(mes), false);
});
await test('메시지마다 따로 센다: 다른 번호의 알림은 동시에 보내고, 같은 번호만 막는다', async () => {
    const p = page(); const chat = p.doc.querySelector('#chat');
    const mes7 = new El('div', { classes: ['mes'], attrs: { mesid: '7' } }); const t7 = new El('div', { classes: ['mes_text'] }); const pre = new El('pre'); pre.append(new El('code', { text: CARD })); t7.append(pre); mes7.append(t7); chat.append(mes7);
    const bus = new Emitter();
    const N = R.createRerenderNotifier({ getContext: () => ({ eventSource: bus, event_types: TYPES, extensionSettings: { disabledExtensions: ['translate'] }, chat: [] }), document: p.doc, helperPresent: () => true });
    let during = null;
    bus.on(TYPES.MESSAGE_UPDATED, async id => { if (id === 4) during = await N.notify(7); });
    assert.equal(await N.notify(4), true);
    assert.equal(during, true, '4 를 알리는 동안 7 은 보낼 수 있다');
    assert.deepEqual(bus.log.map(([, id]) => id), [4, 7]);
    // 6.9.8 ready(): 같은 번호의 알림이 도는 동안은 거짓(끝 그림이 틀을 날 코드로 바꾸지 않게), 다른 번호 · 끝난 뒤는 참
    const mes9 = new El('div', { classes: ['mes'], attrs: { mesid: '9' } }); const t9 = new El('div', { classes: ['mes_text'] }); const pre9 = new El('pre'); pre9.append(new El('code', { text: CARD })); t9.append(pre9); mes9.append(t9); chat.append(mes9);
    let ready = null;
    bus.on(TYPES.MESSAGE_UPDATED, id => { if (id === 9) ready = { same: N.ready(9), other: N.ready(8), str: N.ready('9') }; });
    assert.equal(await N.notify(9), true);
    assert.deepEqual(ready, { same: false, other: true, str: false });
    assert.equal(N.ready(9), true, '끝난 뒤는 다시 참');
});

// ── 5. 연결 ──
await test('번역기: import · refreshMessageBlock 이 다시 그린 뒤 알림을 돌려주고 · handleMessageEdit 은 알림이면 맨 먼저 건너뛴다', () => {
    const js = read('src/addons/translator/index.js');
    assert.match(js, /import \{ notifyRerender, isRerenderNotify, canNotifyRerender \} from '\.\.\/\.\.\/rerender-notify\.js';/);
    const refresh = js.slice(js.indexOf('\nfunction refreshMessageBlock('), js.indexOf('\n}\n', js.indexOf('\nfunction refreshMessageBlock(')) + 3);
    assert.match(refresh, /const result = updateMessageBlock\(messageId, message, kept \? \{ rerenderMessage: false \} : undefined\);/, '6.9.6 미리 보기를 그렸으면 바뀐 문단만 (translator-preview-steady.mjs) — 그래도 다시 그린 뒤 알림');
    assert.match(refresh, /llm-translator:rendered/, '6.1.8 문서 이벤트는 그대로');
    assert.match(refresh, /return notifyRerender\(messageId, \{ element \}\)\.then\(\(\) => result\);/, '찾아 둔 요소를 넘기고, 기다리는 쪽은 청취자 뒤에 이어 간다');
    assert.ok(refresh.indexOf('llm-translator:rendered') < refresh.indexOf('notifyRerender('), '문서 이벤트 다음에 알림');
    const edit = js.slice(js.indexOf('\nasync function handleMessageEdit('), js.indexOf('const context = getContext();', js.indexOf('\nasync function handleMessageEdit(')));
    assert.match(edit, /if \(isRerenderNotify\(messageId\)\) return;/, '채팅을 읽기 전에 건너뛴다');
    assert.equal((js.match(/updateMessageBlock\(/g) || []).length, 1, 'updateMessageBlock 은 refreshMessageBlock 만 부른다 (다른 길이 생기면 알림을 더해야 한다)');
    assert.equal((js.match(/isRerenderNotify\(/g) || []).length, 1);
});
await test('다시 쓰기: 씬 플랜 다시 생성 뒤 다시 그리면 알린다 (고치기 길은 notifyTextChanged 의 MESSAGE_UPDATED 가 이미 헬퍼를 깨운다)', () => {
    const js = read('src/addons/rewrite/index.js');
    assert.match(js, /import \{ notifyRerender \} from '\.\.\/\.\.\/rerender-notify\.js';/);
    assert.match(js, /\/\/ 1\.7\.5: 편집 중이면 다시 그리지 않는다\n\s*updateMessageBlock\(messageId, message\);\n\s*await keepChatReadingPosition\([^\n]+=> notifyRerender\(messageId\)\);/);
    assert.equal((js.match(/notifyRerender\(/g) || []).length, 1, '고치기 길(manual → notifyTextChanged)에는 더하지 않는다 — 두 번 보내지 않게');
});
await test('북마크: 고치기 뒤 번역문을 지우고 다시 그릴 때 · 북마크 창에서 번역한 뒤 채팅을 다시 그릴 때 알린다', () => {
    const data = read('src/addons/bookmarks/data.js'), tr = read('src/addons/bookmarks/translate.js');
    assert.match(data, /import \{ notifyRerender \} from '\.\.\/\.\.\/rerender-notify\.js';/);
    assert.match(data, /if \(rendered\) \{ updateMessageBlock\(index, message\); await notifyRerender\(index\); \}/);
    assert.match(data, /if \(rendered\) updateMessageBlock\(index, message\);\n\s*await eventSource\.emit\(event_types\.MESSAGE_UPDATED, index\);/, '첫 다시 그리기 뒤엔 북마크가 보내는 MESSAGE_UPDATED 가 헬퍼를 깨운다 — 알림을 더하지 않는다');
    assert.match(tr, /import \{ notifyRerender \} from '\.\.\/\.\.\/rerender-notify\.js';/);
    assert.match(tr, /if \(!isEditingMessage\(document, index\)\) \{ updateMessageBlock\(index, message\); void notifyRerender\(index\); \}/);
});
await test('단어 치환 · 접기 · 에셋 자리: 다시 그린 뒤 알린다', () => {
    const wt = read('src/word-tools.js'), fold = read('src/mes-fold.js'), ar = read('src/addons/assets/after-reply.js');
    assert.match(wt, /import \{ notifyRerender \} from '\.\/rerender-notify\.js';/);
    assert.match(wt, /await ctx\.eventSource\.emit\(ctx\.eventTypes\.MESSAGE_UPDATED,row\.id\);else await notifyRerender\(row\.id\);/, '번역문까지 바꾼 줄(MESSAGE_UPDATED 를 안 보내는 쪽)만 알린다');
    assert.match(fold, /import \{ notifyRerender \} from '\.\/rerender-notify\.js';/);
    assert.match(fold, /ctx\.updateMessageBlock\(id, message\); changed\.push\(id\); void notifyRerender\(id\);/);
    assert.match(fold, /ctx\.updateMessageBlock\(id, message\);\n\s*await notifyRerender\(id\);/);
    assert.match(ar, /import \{ notifyRerender \} from '\.\.\/\.\.\/rerender-notify\.js';/);
    assert.match(ar, /refreshSlots\(messageId\);\n\s*void notifyRerender\(messageId\);[^\n]*\n\}/);
});
await test('rerender-notify.js 는 실리태번 모듈을 import 하지 않고 · CI 에 등록됐다', () => {
    const js = read('src/rerender-notify.js');
    assert.ok(!/^import /m.test(js), '실리태번 import 없음 (node 에서 그대로 돈다)');
    assert.match(js, /globalThis\.SillyTavern\?\.getContext\?\.\(\)/);
    assert.match(js, /globalThis\.TavernHelper/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/rerender-notify\.mjs \./);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
