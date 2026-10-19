// 7.2.8 폰 속도 — 미룬 일 · 덜 읽는 일이 결과는 그대로인지
//   node tools/tests/phone-speed-728.mjs <테마 루트>
// · st-solid: 테마가 켜져 있으면(body.salty) 계산된 스타일을 읽지 않고, 읽었을 때와 같은 결과(판 · 채팅 칸 떼기)
// · squared-buttons: 300ms 뒤 바로 재지 않고 다음 프레임 처음에 잰다 · 이미 표시했거나 건너뛸 요소는 레이아웃을 묻지 않는다 · 표시 결과는 같다
// · customstyle: 답을 받는 동안의 설정 저장은 끝난 뒤 한 번 본다 (코드 확인)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 작은 DOM 흉내 ──
class ClassList { constructor() { this.set = new Set(); } contains(c) { return this.set.has(c); } add(c) { this.set.add(c); } remove(c) { this.set.delete(c); } toggle(c, on) { if (on ?? !this.set.has(c)) this.set.add(c); else this.set.delete(c); return this.set.has(c); } }
class Style { constructor() { this.props = {}; } getPropertyValue(k) { return this.props[k] ?? ''; } setProperty(k, v) { this.props[k] = v; } removeProperty(k) { delete this.props[k]; } }

// ── st-solid ──
async function stSolidRun({ salty, tint = 'rgba(20, 20, 20, 0.5)', filter = 'none' }) {
    const rootEl = { style: new Style(), classList: new ClassList() };
    const body = { classList: new ClassList() };
    if (salty) body.classList.add('salty');
    let reads = 0, frames = [];
    globalThis.document = { documentElement: rootEl, body, querySelector: () => ({}) };
    globalThis.getComputedStyle = el => { reads++; return el === rootEl ? { getPropertyValue: k => ({ '--SmartThemeBlurTintColor': tint, '--SmartThemeBodyColor': '#dcdcd2', '--SmartThemeChatTintColor': 'rgba(0,0,0,1)' })[k] ?? '' } : { backdropFilter: filter }; };
    globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
    globalThis.MutationObserver = class { observe() {} };
    globalThis.SillyTavern = { getContext: () => ({ eventSource: { on() {} }, event_types: {} }) };
    const mod = await import(pathToFileURL(path.join(root, 'src/st-solid.js')).href + '?v=' + Math.random());
    mod.startStSolid();
    return { reads, tint: rootEl.style.getPropertyValue('--bl-st-solid-tint'), solid: rootEl.classList.contains('bl-st-solid'), chat: rootEl.classList.contains('bl-st-solid-chat'), rootEl, body, frames };
}
await test('st-solid: 테마 켜짐 → 계산된 스타일 0번 · 판/채팅 칸 뗌 (반투명 · 흐림 없음이어도)', async () => {
    const r = await stSolidRun({ salty: true });
    assert.equal(r.reads, 0);
    assert.deepEqual([r.tint, r.solid, r.chat], ['', false, false]);
});
await test('st-solid: 테마 꺼짐 → 예전처럼 읽고 반투명 · 흐림 없음이면 불투명 판', async () => {
    const r = await stSolidRun({ salty: false });
    assert.ok(r.reads >= 1);
    assert.equal(r.solid, true);
    assert.equal(r.tint, 'rgb(20, 20, 20)');
});
await test('st-solid: 켜져 있던 판은 테마를 켜면 떼어진다 (예전 결과와 같음)', async () => {
    const r = await stSolidRun({ salty: false });
    assert.equal(r.solid, true);
    r.body.classList.add('salty');
    const src = read('src/st-solid.js');
    assert.match(src, /if \(body\.classList\.contains\('salty'\)\) \{ paint\(root, '', false, false\); return; \}/);
    assert.match(src, /const off = !body\.classList\.contains\('salty'\);/, '아래 길은 그대로 (off 가 거짓이면 want · chat 이 거짓)');
});

// ── squared-buttons ──
class El {
    constructor(tag, { cls = '', id = '', text = 'Button', w = 80, h = 32, radius = '16px', bg = 'rgb(10, 20, 30)', cursor = 'pointer', parent = null, marked = false, skipArea = false, hidden = false } = {}) {
        Object.assign(this, { tagName: tag.toUpperCase(), className: cls, id, innerText: text, w, h, radius, bg, cursor, parent, skipArea, hidden, attrs: new Map(), children: [], isConnected: true, nodeType: 1 });
        if (marked) this.attrs.set('data-bl-squared', '');
        this.offsetReads = 0;
        parent?.children.push(this);
    }
    get offsetParent() { this.offsetReads++; return this.hidden ? null : {}; }
    hasAttribute(a) { return this.attrs.has(a); }
    setAttribute(a, v) { this.attrs.set(a, v); }
    removeAttribute(a) { this.attrs.delete(a); }
    matches(sel) { const t = this.tagName.toLowerCase(); if (sel === 'input,select,textarea,img,svg') return ['input', 'select', 'textarea', 'img', 'svg'].includes(t); if (/^button,a,summary/.test(sel)) return ['button', 'a', 'summary'].includes(t) || /menu_button/.test(this.className); return /^button,/.test(sel) && ['button', 'a'].includes(t); }
    closest(sel) { if (/send_form|mes_buttons/.test(sel)) return this.skipArea ? this : null; if (/style,script/.test(sel)) return null; if (/closedDrawer/.test(sel)) return null; return null; }
    querySelectorAll() { const out = []; const walk = e => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
    getBoundingClientRect() { return { width: this.w, height: this.h }; }
}
function squaredHost() {
    const timers = [], frames = [];
    class HTMLElement {}
    Object.setPrototypeOf(El.prototype, HTMLElement.prototype);
    const host = {
        HTMLElement, timers, frames,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
        requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
        addEventListener() {}, removeEventListener() {},
        MutationObserver: class { constructor(cb) { host.observerCb = cb; } observe() {} disconnect() {} },
        getComputedStyle: el => ({ display: 'block', visibility: 'visible', borderTopLeftRadius: el.radius, backgroundColor: el.bg, borderTopWidth: '0px', backgroundImage: 'none', boxShadow: 'none', cursor: el.cursor }),
    };
    return host;
}
await test('squared-buttons: 300ms 타이머 뒤 다음 프레임 처음에 재고 · 표시는 같은 요소에만', async () => {
    const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')).href);
    const host = squaredHost();
    const body = new El('body', { text: '' }); body.dataset = {}; body.matches = () => false;
    const doc = { body, head: { append() {} }, documentElement: body, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [] };
    const pill = new El('button', { parent: body });
    const square = new El('button', { parent: body, radius: '4px' });
    const marked = new El('button', { parent: body, marked: true });
    const skipped = new El('div', { cls: 'menu_button toggle-switch', parent: body });
    const inSend = new El('button', { parent: body, skipArea: true });
    const hidden = new El('button', { parent: body, hidden: true });
    const input = new El('input', { parent: body });
    const all = [pill, square, marked, skipped, inSend, hidden, input];
    const expected = all.map(e => e.offsetParent !== null && mod.isRoundTextButton(e, host));
    for (const e of all) e.offsetReads = 0;
    const stop = mod.watchSquaredButtons(doc, host);
    assert.equal(host.timers.length, 1); assert.equal(host.timers[0].ms, 300);
    assert.equal(host.frames.length, 0);
    host.timers[0].fn();
    assert.equal(host.frames.length, 1, '타이머는 프레임만 예약한다');
    assert.equal(all.reduce((n, e) => n + e.offsetReads, 0), 0, '프레임 전에는 레이아웃을 묻지 않는다');
    host.frames[0]();
    assert.deepEqual(all.map(e => e.hasAttribute('data-bl-squared')), all.map((e, i) => e === marked || expected[i]));
    assert.equal(pill.hasAttribute('data-bl-squared'), true);
    assert.deepEqual([marked, skipped, inSend, input].map(e => e.offsetReads), [0, 0, 0, 0], '표시된 · 건너뛸 요소는 offsetParent 를 안 읽는다');
    stop();
});

// ── customstyle ──
await test('customstyle: 답을 받는 동안의 설정 저장은 생성이 끝난 뒤 한 번 본다', () => {
    const src = read('src/addons/customstyle/index.js');
    assert.match(src, /import \{ isMainChatGenerating, whenMainChatIdle \} from '\.\.\/\.\.\/main-chat-rules\.js';/);
    assert.match(src, /if \(isMainChatGenerating\(\)\) \{\s*if \(!afterReply\) \{ afterReply = true; whenMainChatIdle\(\{ quietMs: 300 \}\)\.then\(\(\) => \{ afterReply = false; later\(\); \}\); \}\s*return;\s*\}/);
    assert.match(src, /settingsTimer = setTimeout\(\(\) => \{\s*if \(isMainChatGenerating\(\)\) \{ later\(\); return; \}/);
    assert.match(src, /const checkConfig = \(\) => \{[\s\S]*?if \(JSON\.stringify\(currentConfig\) !== JSON\.stringify\(this\.previousStyleValue\)\)/, '바뀌었을 때 하는 일은 그대로');
});

// ── 번역 용어집 이름 후보를 한 번 만들어 넘겨도 결과가 같다 ──
await test('용어집 이름 지키기: 미리 만든 후보(prepared)로 고친 글 = 예전처럼 매번 훑은 글', async () => {
    const M = await import(pathToFileURL(path.join(root, 'src/addons/translator/glossary-match.js')).href);
    const E = (src, dst, id = src) => ({ id, scope: 'global', src, dst });
    const lists = [
        [E('Mina, ミナ', '미나', 'mina'), E('Corvin, コルヴィン', '코르빈'), E('Security', '보안팀'), E('Hell', '지옥'), E('Mina Tower', '미나 탑'), E('Rex', '렉스, 렉')],
        [E('Mina', '미나', 'plain')], [], [{ src: '', dst: '' }, E('Corvin', 'Corvin')],
    ];
    const namesSets = [['미나', '코르빈'], [], ['Rex'], undefined];
    const pairs = [
        ['Mina jumps a little in her chair. Corvin nods. His gaze lands on Mina\'s face.', '갑작스러운 등장에 Mina가 의자에서 튀어 오른다. Corvin가 고개를 끄덕인다. 시선이 Mina\'s 얼굴에 닿는다. MINA는 웃었다.'],
        ['Mina smiled. Mina\'s Notebook. "Welcome aboard, Mina!"', '미나(Mina)가 웃었다. Mina\'s Notebook. "Welcome aboard, Mina!"'],
        ['Mina smiled. <tracker>Mina\'s Room</tracker>', '<tracker>\n📍 Mina\'s Room | Clear\n</tracker>\nMina가 창가에서 조용히 웃었다.'],
        ['Corvin smiled at the Mina Tower.', 'Corvin이 Mina Tower 앞에서 웃었다. Corvin야, 가자!'],
        ['Rex smiled.', 'Mina가 웃었다.'], ['', ''], ['Mina', 'Mina'],
    ];
    let n = 0;
    for (const entries of lists) for (const names of namesSets) {
        const prepared = M.prepareGlossaryNames(entries, names);
        for (const [src, out] of pairs) { assert.equal(M.enforceGlossaryNames(entries, src, out, { names, prepared }), M.enforceGlossaryNames(entries, src, out, { names })); n++; }
    }
    assert.ok(n > 100);
    assert.match(read('src/addons/translator/index.js'), /get prepared\(\) \{ return prepared \?\?= prepareGlossaryNames\(entries, names\); \}/);
});

await test('상태 카드 찾기 기억: 같은 글을 여러 번 불러도 결과가 같고, 돌려받은 칸을 고쳐도 다음 결과는 그대로', async () => {
    const D = await import(pathToFileURL(path.join(root, 'src/addons/translator/display-cards.js')).href);
    const texts = ['앞 글\n<status_bar>\n日期：Tuesday\n时间：1:00\n</status_bar>\n뒤 글 <b>굵게</b>', '```\n<status_bar>x</status_bar>\n```\n<tracker>a</tracker>', 'plain text', '◸ <olden> a｜b ◹ rest', '<profile><profile>in</profile></profile>tail'];
    const first = texts.map(x => [D.displayCardBlocks(x), D.withoutDisplayCards(x), D.withDisplayCardsProtected(x, v => v.toUpperCase())]);
    for (let k = 0; k < 40; k++) for (const x of texts) D.withoutDisplayCards(x + ' ' + k);   // 기억이 넘쳐 밀려나도
    const again = texts.map(x => [D.displayCardBlocks(x), D.withoutDisplayCards(x), D.withDisplayCardsProtected(x, v => v.toUpperCase())]);
    assert.deepEqual(again, first);
    const twice = texts.map(x => [D.displayCardBlocks(x), D.withoutDisplayCards(x), D.withDisplayCardsProtected(x, v => v.toUpperCase())]);
    assert.deepEqual(twice, first, '바로 다시 불러도 (기억에서)');
    assert.match(read('src/addons/translator/display-cards.js'), /return hit\.map\(card => \(\{ \.\.\.card \}\)\);/);
});

await test('B1 모달이 열린 동안 알림: 테마 창 표시 · 화면 아래 · 누름 통과 · 처음 설정 창은 창 맨 아래 줄', () => {
    assert.match(read('src/modal.js'), /dialog\.toggleAttribute\?\.\('data-bl-modal', true\);[^\n]*\n\s*try \{ dialog\.showModal\(\); \}/);
    const css = read('style.css');
    assert.match(css, /dialog\[data-bl-modal\]\[open\] > #toast-container \{ top: auto !important; bottom: max\(8px, env\(safe-area-inset-bottom, 0px\)\) !important; margin-top: 0 !important; pointer-events: none; \}/);
    assert.match(css, /dialog\.bl-first-run\[data-bl-modal\]\[open\] > #toast-container \{ position: static !important; order: 99;/);
});

console.log(`phone-speed-728: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
