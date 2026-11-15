// 1.5.1 opt-boot: src/icon-text.js 의 「닫힌 서랍 미리 훑기」(덮개가 걷힌 뒤 쉴 때)를 조각으로 나눈 뒤에도
//   ① 끝 표식이 서랍을 처음부터 열어 두고 훑은 것 · 서랍 하나를 한 번에 훑던 것과 같은지(무작위 서랍 나무 · 겹친 닫힌 서랍 포함)
//   ② 한 조각이 한가한 틈을 넘지 않는지(요소 16개마다 남은 시간을 봄) · 여러 조각으로 나뉘는지
//   ③ 훑는 중에 그 서랍이 열리거나 · 아직 안 훑은 서랍에 줄이 붙거나 · 요소가 떨어져도 끝 표식이 같은지 봐요(jsdom)
//   node tools/tests/icon-text-prescan-slices.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
//   모듈 상태(미뤄 둔 서랍 표 · 시작 표시)가 한 벌이라 장면마다 이 파일을 자식 프로세스로 다시 돌려요(--scene).
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
const sceneAt = process.argv.indexOf('--scene');
const SELF = fileURLToPath(import.meta.url);

if (sceneAt < 0) {
    try { createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom'); }
    catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
    const run = (scene, seed) => {
        const r = spawnSync(process.execPath, [SELF, root, jsdomHome, '--scene', scene, String(seed)], { encoding: 'utf8', maxBuffer: 64 << 20 });
        if (r.status !== 0) throw new Error(`${scene}/${seed} 장면이 멈췄어요:\n${r.stderr || r.stdout}`);
        return JSON.parse(r.stdout.trim().split('\n').at(-1));
    };
    let passed = 0;
    const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
    for (const seed of [1, 2, 3]) {
        const open = run('open', seed), whole = run('whole', seed), sliced = run('sliced', seed);
        test(`씨앗 ${seed}: 조각 훑기 끝 표식 = 처음부터 연 서랍 = 한 번에 훑기 (표식 ${open.marks.length}곳)`, () => {
            assert.ok(open.marks.length > 200, '표식이 충분히 붙어야 견줄 수 있어요');
            assert.deepEqual(whole.marks, open.marks);
            assert.deepEqual(sliced.marks, open.marks);
        });
        test(`씨앗 ${seed}: 한가한 틈 4ms 면 여러 조각(${sliced.slices}) · 한 조각에 본 요소 최대 ${sliced.maxPerSlice} · 한 번에 훑기는 한 조각`, () => {
            assert.equal(whole.slices, 1);
            assert.ok(sliced.slices >= 5, `조각 ${sliced.slices}`);
            assert.equal(sliced.overBudget, 0, `틈을 넘긴 조각 ${sliced.overBudget} (가장 큰 조각 요소 ${sliced.maxPerSlice})`);
        });
        const openRef = run('open-mutate', seed), mid = run('sliced-mutate', seed);
        test(`씨앗 ${seed}: 훑는 중 그 서랍이 열림 · 안 훑은 서랍에 줄 붙음 · 요소 떨어짐 — 끝 표식이 같아요`, () => {
            assert.ok(mid.openedMid, '훑는 중에 연 서랍이 있어야 해요');
            assert.deepEqual(mid.marks, openRef.marks);
        });
    }
    console.log(`icon-text-prescan-slices: ${passed}개 통과`);
    process.exit(0);
}

// ---------------------------------------------------------------- 장면 하나(자식 프로세스)
const [scene, seedText] = [process.argv[sceneAt + 1], process.argv[sceneAt + 2]];
const { JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom');
let seed = Number(seedText) * 7919;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ROWS = [
    () => '<label class="checkbox_label"><input type="checkbox"><span>켜기</span></label>',
    () => '<div class="flex-container"><small>값</small><input class="neo-range-slider" type="range"><input class="neo-range-input" type="number"></div>',
    () => '<label class="flex-container"><label>값</label><input class="neo-range-slider" type="range"><input class="neo-range-input"></label>',
    () => '<div class="range-block"><div class="range-block-title">제목</div><div class="range-block-range-and-counter"><input type="range"></div></div>',
    () => '<div class="range-block"><div class="range-block-title">제목</div><div class="wide100p"><input type="number"></div></div>',
    () => '<div class="range-block"><label class="checkbox_label"><input type="checkbox"></label><div class="toggle-description">설명</div></div>',
    () => '<div><label>고르기</label><select><option>가</option></select></div>',
    () => '<label><span><select><option>가</option></select></span></label>',
    () => '<div class="flex-container"><div class="flex1"><div><select></select></div></div></div>',
    () => '<div class="menu_button"><i class="fa-solid fa-gear"></i> 글자 단추</div>',
    () => '<div class="menu_button"><i class="fa-solid fa-gear"></i></div>',
    () => '<div class="menu_button menu_button_icon"><i class="fa-solid fa-gear"></i><span>더</span></div>',
    () => '<form><h4>머리</h4><div>내용</div></form>',
    () => '<div class="flex-container"><h4>머리<span data-i18n="(DEPRECATED)">옛</span></h4></div>',
    () => '<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>칸</b></div><div class="inline-drawer-content"><label class="checkbox_label"><input type="checkbox"></label></div></div>',
    () => '<div><svg><g><label><input type="checkbox"></label></g></svg><span>그림</span></div>',
];
const block = depth => {
    let s = '';
    const n = 4 + Math.floor(rnd() * 8);
    for (let i = 0; i < n; i++) {
        const r = rnd();
        if (depth < 2 && r < 0.06) s += `<div class="drawer-content">${block(depth + 1)}</div>`;   // 겹친 닫힌 서랍
        else if (depth < 3 && r < 0.2) s += `<div class="flex-container">${block(depth + 1)}</div>`;
        else s += pick(ROWS)();
    }
    return s;
};
let body = '<div id="top-bar"><div class="menu_button"><i class="fa-solid fa-bars"></i> 메뉴</div></div><div id="chat"><div class="mes"><div class="mes_block"><div class="mes_text">글</div></div></div></div>';
for (let i = 0; i < 6; i++) body += `<div class="drawer"><div class="drawer-toggle"></div><div class="drawer-content${scene.startsWith('open') ? ' openDrawer' : ''}" id="d${i}">${block(0)}${block(0)}</div></div>`;
if (scene.startsWith('open')) body = body.replace(/class="drawer-content"/g, 'class="drawer-content openDrawer"');
const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'MutationObserver', 'Event', 'CustomEvent', 'NodeFilter', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'])
    if (!(k in globalThis) || k === 'window' || k === 'document') globalThis[k] = k === 'window' ? window : window[k];
// 쉴 때 콜백은 손으로 돌려요(가짜 시계: now() 를 물을 때마다 0.25ms 흐름)
const idle = []; let clock = 0;
globalThis.requestIdleCallback = fn => { idle.push(fn); return idle.length; };
globalThis.cancelIdleCallback = () => {};
const fakeNow = () => (clock += 0.25);
// 조각마다 훑은 요소 수: 조각 훑기는 요소마다 isConnected 를 한 번 봐요
let seen = 0; const conn = Object.getOwnPropertyDescriptor(window.Node.prototype, 'isConnected');
Object.defineProperty(window.Node.prototype, 'isConnected', { configurable: true, get() { seen++; return conn.get.call(this); } });
const { startIconTextMark, prescanDeferredDrawers } = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);
const settle = () => new Promise(r => setTimeout(r, 0));
const marks = () => {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) for (const a of el.getAttributeNames()) if (a.startsWith('data-bl-')) out.push(`${el.tagName.toLowerCase()}#${[...el.parentElement.children].indexOf(el)}@${el.parentElement.closest('[id]')?.id || ''} ${a}=${el.getAttribute(a)}`);
    return out.sort();
};
const mutate = () => {   // 훑는 중(또는 열린 채) 일어나는 일: 아직 안 훑은 서랍에 줄 붙이기 · 요소 떼기
    const last = document.getElementById('d5');
    const t = document.createElement('template');
    t.innerHTML = ROWS[1]() + ROWS[0]() + ROWS[9]();
    last.append(t.content);
    document.querySelector('#d4 label')?.remove();
};
startIconTextMark();   // 덮개(#preloader)가 없어 미리 훑기가 바로 걸려요(앞의 쉴 때 콜백 하나 — 아래에서 다시 걸어요)
idle.length = 0;
let slices = 0, maxPerSlice = 0, overBudget = 0, openedMid = false;
if (scene === 'whole' || scene.startsWith('sliced')) {
    const budget = scene === 'whole' ? 1e9 : 4;
    prescanDeferredDrawers(globalThis.requestIdleCallback, scene === 'whole' ? () => 0 : fakeNow);
    let guard = 0;
    while (idle.length && guard++ < 100000) {
        const fn = idle.shift();
        const start = clock; seen = 0;
        fn({ didTimeout: false, timeRemaining: () => budget });
        slices++;
        maxPerSlice = Math.max(maxPerSlice, seen);
        // 한가한 틈 4ms · 2ms 남기고 멈춤 · 0.25ms 마다 한 번 묻기 → 묻기 9번 안쪽 = 한 박자 16 × 9 — 한 박자에 isConnected 를 두 번(서랍 · 요소) 봐서 × 2 + 여유
        if (scene !== 'whole' && seen > 2 * 16 * 9 + 40) overBudget++;
        if (scene === 'sliced-mutate' && slices === 2) {
            // 지금 훑고 있는 서랍을 연다(실리태번 서랍 열기 = class 바꿈) → 감시 콜백이 통째로 훑어요
            const busy = [...document.querySelectorAll('.drawer-content')].find(d => !d.classList.contains('openDrawer'));
            busy.classList.add('openDrawer'); openedMid = true;
            mutate();
            await settle();
        }
    }
} else if (scene === 'open-mutate') {
    // 견줄 기준: 같은 서랍을 연 채 같은 변화
    mutate();
    await settle();
}
await settle(); await settle();
if (scene === 'sliced-mutate') {
    // 기준과 같게: 기준은 서랍이 모두 열린 채라, 여기도 다 열고(열린 서랍 훑기) 표식을 견줘요 — 이미 훑은 서랍을 여는 것은 아무것도 안 바꿔요
    for (const d of document.querySelectorAll('.drawer-content:not(.openDrawer)')) d.classList.add('openDrawer');
    await settle(); await settle();
}
console.log(JSON.stringify({ scene, marks: marks(), slices, maxPerSlice, overBudget, openedMid }));
process.exit(0);
