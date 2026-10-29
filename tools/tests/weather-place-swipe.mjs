// 8.2.7 폰 예측점검(hunt-mobile): 설정 › 날씨 › 「자리」의 채팅 화면 위 자리 정하기 막(#bl-weather-place, #sheld 안)에서 점을 옆으로 빠르게 끌면
// 실리태번 손짓(public/lib/swiped-events.js — document 의 touchstart · touchmove · touchend)이 #sheld 안의 옆 밀기로 읽어
// RossAscends-mods.js 의 swiped-left 처리가 마지막 답의 「다음 답」(.swipe_right:last)을 눌렀어요 — 넘길 답이 없으면 새 답 생성.
// 고친 뒤: 막 안에서 시작한 터치는 문서까지 올라가지 않아요(끌기 · 단추 누르기는 막 안 리스너가 그대로 받아요).
//   node tools/tests/weather-place-swipe.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };

// ── 작은 DOM 흉내: 거품 단계 전달 · stopPropagation · 이 함수가 쓰는 선택자만 ──
class El {
    constructor(tag = 'div', cls = '') { this.tagName = tag.toUpperCase(); this.className = cls; this.children = []; this.parentElement = null; this.listeners = {}; this.style = {}; this.dataset = {}; this.id = ''; }
    get isConnected() { for (let p = this; p; p = p.parentElement) if (p === docEl) return true; return false; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
    append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } }
    remove() { const p = this.parentElement; if (p) { p.children = p.children.filter(c => c !== this); this.parentElement = null; } }
    focus() { doc.activeElement = this; }
    setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 600 }; }
    closest(sel) { for (let p = this; p; p = p.parentElement) if (p.matches(sel)) return p; return null; }
    matches(sel) {
        if (sel === '.bl-weather-place-dot') return this.className.includes('bl-weather-place-dot');
        const m = /^\[data-place(?:="([^"]+)")?\]$/.exec(sel);
        if (m) return 'place' in this.dataset && (!m[1] || this.dataset.place === m[1]);
        return false;
    }
    *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
    querySelectorAll(sel) { return [...this.walk()].filter(n => n.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    set innerHTML(html) {
        this.children = [];
        const bar = new El('div', 'bl-weather-place-bar'); this.append(bar);
        for (const [, act] of html.matchAll(/data-place="([^"]+)"/g)) { const b = new El('button'); b.dataset.place = act; bar.append(b); }
        for (const [, i] of html.matchAll(/class="bl-weather-place-dot" data-index="(\d+)"/g)) { const d = new El('button', 'bl-weather-place-dot'); d.dataset.index = i; this.append(d); }
    }
}
const docEl = new El('html'), body = new El('body'), sheld = new El('div'); sheld.id = 'sheld';
docEl.append(body); body.append(sheld);
const doc = {
    activeElement: body, listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); },
    createElement: tag => new El(tag),
    querySelector: sel => (sel === 'body > #sheld' ? sheld : null),
    getElementById: id => [...docEl.walk()].find(n => n.id === id) || null,
};
/** 거품 단계로 보내고, 문서(document)까지 갔는지 돌려줘요 — 실리태번 swiped-events 가 거기서 받아요 */
function dispatch(target, type) {
    let stopped = false;
    const event = { type, target, touches: [{ clientX: 10, clientY: 10 }], stopPropagation() { stopped = true; }, preventDefault() {} };
    for (let n = target; n && !stopped; n = n.parentElement) for (const fn of n.listeners[type] || []) fn(event);
    if (stopped) return false;
    for (const fn of doc.listeners[type] || []) fn(event);
    return true;
}
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = doc;
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

// weather.js 의 import 줄을 떼고 같은 이름을 흉내로 넣어요(설정 · 저장 · 엔진은 이 시험에서 안 써요)
const stubs = { bindWeatherRest() {}, weatherAmount() { return 1; }, weatherPixelRatio() { return 1; }, activeWeather() { return { on: false }; }, parseColor() { return null; },
    getSettings: () => ({ chat: { weatherSpots: {} } }), saveSettings() {}, loadWeatherModule: async () => ({}) };
globalThis.__weatherPlace = stubs;
const source = (await fs.readFile(path.join(root, 'src/weather.js'), 'utf8')).replace(/^import [^\n]*\n/gm, '');
const prelude = `const {${Object.keys(stubs).join(',')}} = globalThis.__weatherPlace;\n`;
const mod = await import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));

await test('자리 정하기 막의 점에서 시작한 터치(옆으로 끌기)는 문서까지 가지 않아요 — 실리태번 스와이프 · 새 답 생성이 안 걸려요 (고치기 전: 문서까지 감)', () => {
    mod.placeWeatherSpots('rain', [[0.2, 0.3], [0.7, 0.6]], () => {});
    const box = doc.getElementById('bl-weather-place');
    assert.ok(box, '막이 #sheld 안에 붙어요');
    assert.equal(box.parentElement, sheld);
    const dot = box.querySelector('.bl-weather-place-dot');
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.equal(dispatch(dot, type), false, type);
    const bar = box.querySelector('[data-place="done"]');
    assert.equal(dispatch(bar, 'touchend'), false, '도구 줄 단추 위 터치도');
});
await test('막 밖(채팅)의 터치는 예전처럼 문서까지 가요 · 막의 끌기 리스너(pointerdown)는 그대로 막 안에 있어요', () => {
    const outside = new El('div'); sheld.append(outside);
    assert.equal(dispatch(outside, 'touchmove'), true);
    const box = doc.getElementById('bl-weather-place');
    assert.ok((box.listeners.pointerdown || []).length >= 1);
    for (const type of ['touchstart', 'touchmove', 'touchend']) assert.ok((box.listeners[type] || []).length >= 1, type);
});
await test('취소를 누르면 막이 빠져요 (리스너는 막과 함께 사라져요)', () => {
    const box = doc.getElementById('bl-weather-place');
    const cancel = box.querySelector('[data-place="cancel"]');
    for (const fn of box.listeners.click || []) fn({ target: cancel });
    assert.equal(doc.getElementById('bl-weather-place'), null);
});

const ci = await fs.readFile(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
assert.ok(ci.includes('node tools/tests/weather-place-swipe.mjs .'), 'release-check.yml 에 등록');
console.log(`날씨 자리 정하기 · 스와이프 가드: ${pass}개 통과했어요.`);
