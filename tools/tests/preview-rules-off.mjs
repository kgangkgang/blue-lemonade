// 미리보기 사본 규칙 시트(src/preview.gen.css)는 설정 창 · 서랍 · 메모가 보이는 동안만 켜요(1.4.x 작업자 D).
//   예전엔 restorePreviewRules 가 「세션 끝까지」 켜 둬서, 설정 창을 한 번 연 뒤로 채팅 요소마다 미리보기 규칙과 견줬어요(리그 11-14: 요소당 약 +0.8µs · PC).
//   lite.js 의 미리보기 몫(preloadPreviewCss ~ releasePreviewRules)만 떼어 가짜 문서에서 돌려요. 네트워크 없음.
//   node tools/tests/preview-rules-off.mjs [테마 뿌리]
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/lite.js'), 'utf8');
const from = src.indexOf('/** 미리보기 시트를 꺼진 채');
const to = src.indexOf('/** 꺼져 있나(1)');
assert.ok(from > 0 && to > from, 'lite.js 미리보기 몫을 못 찾았어요');
const part = src.slice(from, to)
    .replace(/^\/\/ --split[\s\S]*?(?=\/\*\* 미리보기 시트를 다 받았을 때)/m, '')   // 둘째 장 · 호환 몫은 빼요
    .replace(/export /g, '');
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

function world() {
    const listeners = {}; const timers = []; const visible = new Set();
    const link = { media: '', id: '', dataset: {}, isConnected: true, addEventListener() {}, sheet: {} };
    const document = {
        createElement: () => link, head: { append() {} },
        addEventListener: (k, f) => { (listeners[k] ||= []).push(f); },
        querySelectorAll: () => [...visible].map(name => ({ name, getClientRects: () => [1] })),
    };
    const ctx = { document, setTimeout: f => timers.push(f), URL, console, panelCssReady() {}, themeSheet: () => null, themeRunEnd: n => n, PREVIEW_URL: 'x', previewLink: null, restored: false };
    vm.createContext(ctx);
    vm.runInContext(`let previewLink=null, restored=false;\n${part}\nthis.api={restorePreviewRules,holdPreviewRules,releasePreviewRules,preloadPreviewCss,get restored(){return restored}};`, ctx);
    const fire = (k, e = {}) => { for (const f of listeners[k] || []) f(e); while (timers.length) timers.shift()(); };
    return { api: ctx.api, link, visible, fire };
}

test('설정 창을 열면 켜고, 닫은 뒤 보이는 표본이 없으면 꺼요', () => {
    const w = world();
    w.visible.add('.salty-panel');
    w.api.restorePreviewRules();
    assert.equal(w.link.media, 'all');
    w.fire('close');                                  // 창이 닫혔지만 아직 보임(닫히는 중)
    assert.equal(w.link.media, 'all');
    w.visible.clear();
    w.fire('close');
    assert.equal(w.link.media, 'not all');
    assert.equal(w.api.restored, false);
    w.api.restorePreviewRules();                      // 다시 열면 다시 켜요
    assert.equal(w.link.media, 'all');
});
test('서랍 단추를 누른 뒤에도 같아요 — 다른 곳 누름은 안 봐요', () => {
    const w = world();
    w.api.restorePreviewRules();
    w.fire('click', { target: { closest: () => null } });
    assert.equal(w.link.media, 'all');
    w.fire('click', { target: { closest: s => (/inline-drawer-toggle/.test(s) ? {} : null) } });
    assert.equal(w.link.media, 'not all');
});
test('북마크가 쥐고 있으면 끄지 않고, 놓으면 보이는 표본을 보고 꺼요', () => {
    const w = world();
    w.api.holdPreviewRules();
    w.api.restorePreviewRules();
    w.fire('close');
    assert.equal(w.link.media, 'all');
    w.visible.add('.salty-preview');
    w.api.releasePreviewRules();
    assert.equal(w.link.media, 'all', '설정 창이 보이는 동안은 그대로');
    w.visible.clear();
    w.api.releasePreviewRules();
    assert.equal(w.link.media, 'not all');
});
test('검토 D-1: 확장 서랍을 닫았다 다시 열면(테마 서랍은 펼친 채 — restore 를 다시 안 불러요) 보이는 표본을 보고 다시 켜요', () => {
    const w = world();
    w.visible.add('.salty-panel');
    w.api.restorePreviewRules();
    const drawer = { target: { closest: s => (/drawer-toggle/.test(s) ? {} : null) } };
    w.visible.clear(); w.fire('click', drawer);       // 확장 서랍 닫음
    assert.equal(w.link.media, 'not all');
    w.visible.add('.salty-panel'); w.fire('click', drawer);   // 다시 엶 — 누가 restore 를 안 불러도
    assert.equal(w.link.media, 'all');
    assert.equal(w.api.restored, true);
});
test('검토 D-2: 메모 창은 그릴 때마다 켜요(한 번만 켜는 표식 없음) — 닫았다 다시 열어도 서식이 있어요', () => {
    const notes = fs.readFileSync(path.join(root, 'src/addons/notes/index.js'), 'utf8');
    assert.doesNotMatch(notes, /previewRulesOn/);
    const body = notes.slice(notes.indexOf('function renderView('), notes.indexOf('function renderView(') + 400);
    assert.match(body, /restorePreviewRules\(\)/);
    const w = world();
    w.visible.add('.salty-preview'); w.api.restorePreviewRules();   // 메모 열고 그림
    w.visible.clear(); w.fire('close');                               // 닫음 → 꺼짐
    assert.equal(w.link.media, 'not all');
    w.visible.add('.salty-preview'); w.api.restorePreviewRules();   // 다시 열면 renderView 가 다시 켬
    assert.equal(w.link.media, 'all');
});
test('듣기는 한 번만 걸어요', () => {
    const w = world();
    w.api.restorePreviewRules(); w.api.restorePreviewRules();
    assert.match(src, /if \(offWatch \|\| typeof document === 'undefined'\) return;/);
});
console.log(`preview-rules-off: ${pass} passed, 0 failed`);
