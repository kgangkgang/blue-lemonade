// 8.2.7 폰 예측점검(hunt-mobile): 테마 설정 슬라이더는 3.9.0 부터 「가로로 민 손짓만 값」(src/touch-sliders.js)이라 창을 손가락으로 굴려도 값이 안 바뀌어요.
// 애드온 · 도구 창 슬라이더(TTS 설정 · 목소리 편집 · 커스텀 CSS 조절 · 메모 설정 · 프롬프트 패널 · 액자 편집 · 캡처 필터)는 이 보호가 없었어요 —
// 폰 흉내 엣지(헤드리스 · CDP 터치, 384px)에서 슬라이더 위에서 시작해 세로로 200px 밀면 칸은 굴러가면서 값이 50 → 82 로 뛰고 input · change 가 한 번씩 나갔어요(저장됨).
// 고친 뒤: 문서에 한 벌만(ADDON_RANGES) 같은 규칙을 걸어요 — 세로 밀기는 스크롤만, 가로 끌기는 지금처럼 값. 테마 슬라이더는 제 뿌리가 받아 겹치지 않아요.
//   node tools/tests/addon-touch-sliders.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const mod = await import(pathToFileURL(path.join(root, 'src/touch-sliders.js')));
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
function fakeRoot() {
    const listeners = {};
    return { listeners, addEventListener(type, fn, opt) { (listeners[type] ||= []).push({ fn, capture: opt === true || !!opt?.capture }); },
        fire(type, ev) { for (const l of listeners[type] || []) l.fn(ev); return ev; } };
}
const range = (matches) => ({ type: 'range', value: '50', disabled: false, closest: sel => (matches(sel) ? range.last : null) });
test('애드온 슬라이더: 세로로 밀면 값이 안 바뀌고 input · change 가 애드온까지 안 가요 (고치기 전: ADDON_RANGES 없음 · 보호 없음)', () => {
    assert.equal(typeof mod.ADDON_RANGES, 'string');
    assert.equal(typeof mod.startAddonTouchSliders, 'function');
    const doc = fakeRoot();
    mod.startAddonTouchSliders(doc);
    mod.startAddonTouchSliders(doc);   // 두 번 불러도 한 벌
    assert.equal(doc.listeners.pointerdown.length, 1);
    const input = range.last = range(sel => sel === mod.ADDON_RANGES);
    const ev = (extra = {}) => ({ pointerType: 'touch', isPrimary: true, pointerId: 3, clientX: 100, clientY: 300, target: input, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; }, ...extra });
    doc.fire('pointerdown', ev());
    doc.fire('pointermove', ev({ clientY: 260 }));          // 세로 우세 → 스크롤
    input.value = '82';                                     // 닿은 자리로 뛴 값
    const inp = doc.fire('input', ev()), chg = doc.fire('change', ev());
    assert.equal(inp.stopped, true); assert.equal(chg.stopped, true);
    assert.equal(input.value, '50', '되돌려요');
    doc.fire('pointerup', ev());
});
test('애드온 슬라이더: 가로로 끌면 지금처럼 값이 바뀌어요 · 마우스는 손대지 않아요', () => {
    const doc = fakeRoot();
    mod.bindTouchSliders(doc, mod.ADDON_RANGES);
    const input = range.last = range(sel => sel === mod.ADDON_RANGES);
    const ev = (extra = {}) => ({ pointerType: 'touch', isPrimary: true, pointerId: 4, clientX: 100, clientY: 300, target: input, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; }, ...extra });
    doc.fire('pointerdown', ev());
    doc.fire('pointermove', ev({ clientX: 160 }));
    input.value = '70';
    assert.notEqual(doc.fire('input', ev()).stopped, true);
    assert.equal(input.value, '70');
    doc.fire('pointerup', ev());
    const mouse = doc.fire('pointerdown', ev({ pointerType: 'mouse' }));
    input.value = '20'; assert.notEqual(doc.fire('input', ev()).stopped, true);
});
test('테마 슬라이더는 그대로 제 뿌리가 받아요 (기본 선택자 · 애드온 선택자에서 빠짐)', () => {
    assert.equal(mod.THEME_RANGES, 'input[type="range"]:is([data-range],[data-touch-range])');
    for (const part of mod.ADDON_RANGES.split(/,\s*(?![^()]*\))/)) assert.match(part, /:not\(\[data-range\],\[data-touch-range\]\)$/);
    assert.match(read('src/panel.js'), /bindTouchSliders\(root\);/);
});
test('선택자가 가리키는 창 · 슬라이더가 실제로 있어요', () => {
    assert.match(read('src/addons/tts/settings.html'), /<div id="lv_settings"/);
    assert.match(read('src/addons/tts/src/ui.js'), /el\.className = 'lv-editor';/);
    assert.match(read('src/addons/customstyle/index.js'), /const CTS_CONTENT_ID = 'ctsi-drawer-content';/);
    assert.match(read('src/addons/notes/index.js'), /lookDialog\.className = 'bl-notes-dialog bl-notes-look';/);
    assert.match(read('src/frame-editor.js'), /dialog\.className = 'bl-frame-editor';/);
    assert.match(read('src/addons/prompt/index.js'), /type="range" class="pt-param-slider"/);
    assert.match(read('src/addons/prompt/settings-ui.js'), /pt-orig-size/);
    assert.match(read('src/capture-options.js'), /type="range"[^`]*data-capture-option|data-capture-option[^`]*type="range"/);
});
test('index.js 가 시작할 때 한 번 걸어요', () => {
    const src = read('index.js');
    assert.match(src, /import \{ startAddonTouchSliders \} from '\.\/src\/touch-sliders\.js';/);
    assert.equal((src.match(/^\s*startAddonTouchSliders\(\);/gm) || []).length, 1);
});
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/addon-touch-sliders.mjs .'), 'release-check.yml 에 등록');
console.log(`애드온 슬라이더 손가락 보호: ${pass}개 통과했어요.`);
