// 8.2.7 폰 예측점검(hunt-mobile): 제목 번역 떠 있는 단추(.ppt-ta-fab, src/addons/prompt/index.js makeFab)는 꾹 누른 채 끌어 옮겨요.
// 길게 누르기 설명(src/longpress-help.js)이 그 단추에도 걸려, 누른 채 0.5초 멈췄다 끌면 설명 창이 뜨고 손을 뗄 때 window 캡처에서 pointerup 을 막았어요
// → 단추의 pointerup(끌기 끝 · 자리 저장)이 안 돌아 옮긴 자리가 저장되지 않았고, PC 마우스는 끌기 상태가 안 풀려 단추가 커서를 따라다녔어요.
// 고친 뒤: 그 단추는 SKIP(자기 누르기 동작이 있는 곳)이라 길게 눌러도 설명을 띄우지 않고 pointerup 도 막지 않아요. PC 마우스 올려 두기 설명은 그대로.
//   node tools/tests/longpress-fab-drag.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { startLongpressHelp, SKIP, HOVER_SKIP, HOLD_MS } = await import(pathToFileURL(path.join(root, 'src/longpress-help.js')));
const { HELP } = await import(pathToFileURL(path.join(root, 'src/longpress-help-data.js')));
// 단순 선택자(.class · #id · 태그)만 맞추는 작은 요소 — SKIP 의 복잡한 줄(> · 공백)은 이 요소들과 안 맞아요
class El {
    constructor(tag, attrs = {}, parent = null) { this.tagName = tag.toUpperCase(); this.attrs = attrs; this.id = attrs.id || ''; this.parentElement = parent; this.nodeType = 1; this.isConnected = true; this.classList = (attrs.class || '').split(/\s+/).filter(Boolean); this.style = {}; }
    getAttribute(k) { return this.attrs[k] ?? null; } hasAttribute(k) { return k in this.attrs; } setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { delete this.attrs[k]; }
    matches(sel) { return sel.split(',').map(s => s.trim()).some(s => (s.startsWith('.') && !/[\s>:[]/.test(s) && this.classList.includes(s.slice(1))) || (s.startsWith('#') && !/[\s>:[]/.test(s) && this.id === s.slice(1)) || s.toUpperCase() === this.tagName); }
    closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
    querySelectorAll() { return []; }
}
const body = new El('body');
const fab = new El('button', { class: 'ppt-ta-fab', type: 'button', title: '제목 번역' }, body);
const icon = new El('i', { class: 'fa-solid fa-language' }, fab);
let pass = 0; const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
function makeEnv() {
    let now = 0, seq = 0; const timers = new Map(), listeners = [];
    const target = where => ({ addEventListener: (type, fn) => listeners.push({ where, type, fn }), removeEventListener: (type, fn) => { const i = listeners.findIndex(l => l.where === where && l.type === type && l.fn === fn); if (i >= 0) listeners.splice(i, 1); } });
    const doc = target('doc'), host = { ...target('host'), Element: El, navigator: {}, setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; }, clearTimeout: id => timers.delete(id) };
    const opened = [];
    const stop = startLongpressHelp({ doc, host, load: () => ({ HELP }), open: help => opened.push(help) });
    const fire = (type, el, extra = {}) => {
        const ev = { type, target: el, pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch', clientX: 10, clientY: 10, defaultPrevented: false, stopped: false, ...extra,
            preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; } };
        for (const where of ['host', 'doc']) for (const l of listeners.filter(l => l.where === where && l.type === type)) { if (ev.stopped) break; l.fn(ev); }
        return ev;
    };
    const advance = async ms => { const until = now + ms; for (;;) { const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; timers.delete(next[0]); now = next[1].at; await next[1].fn(); await new Promise(r => setImmediate(r)); } now = until; await new Promise(r => setImmediate(r)); };
    return { fire, advance, opened, stop };
}
await test('떠 있는 단추를 꾹 누른 채 멈췄다 끌어도 설명 창이 안 뜨고, 손 뗄 때 pointerup · click 을 막지 않아요 (고치기 전: 창이 뜨고 pointerup 을 막음)', async () => {
    const env = makeEnv();
    env.fire('pointerdown', icon);
    await env.advance(HOLD_MS + 50);
    env.fire('pointermove', icon, { clientX: 120, clientY: 300 });
    const up = env.fire('pointerup', icon, { clientX: 120, clientY: 300 });
    assert.equal(env.opened.length, 0, '설명 창 없음');
    assert.equal(up.stopped || up.defaultPrevented, false, 'pointerup 은 단추까지 가요(끌기 끝 · 자리 저장)');
    env.stop();
});
await test('사전에는 그 단추 설명이 있어요(PC 마우스 올려 두기용) · SKIP 에 들어 있어요 · 올려 두기 제외에는 없어요', () => {
    assert.ok(HELP.some(e => e.classes?.includes('ppt-ta-fab')));
    assert.ok(SKIP.split(',').map(s => s.trim()).includes('.ppt-ta-fab'));
    assert.ok(!HOVER_SKIP.includes('ppt-ta-fab'));
});
await test('다른 단추는 지금처럼 길게 누르면 설명이 떠요', async () => {
    const env = makeEnv();
    const other = new El('div', { id: 'options_button' }, body);
    env.fire('pointerdown', other); await env.advance(HOLD_MS + 50);
    assert.equal(env.opened.length, 1);
    env.stop();
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/longpress-fab-drag.mjs .'), 'release-check.yml 에 등록');
console.log(`길게 누르기 설명 · 떠 있는 단추 끌기: ${pass}개 통과했어요.`);
