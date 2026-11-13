// 1.4.x opt-chat-open(고침안 6 — 채팅을 열 때마다 붙는 고정 몫): 채팅이 바뀔 때 화면에 안 보이는 창을 같은 내용으로 다시 쓰지 않아요.
//   다시 쓰면 HTML 풀기에 더해, 그 창을 보는 단추 글자 맞춤(control-ink)이 새 단추를 보고 창이 보이는지 물으며 배치를 강제했어요(진단 diag-1 · 폰 4배 짧은 채팅 열기).
//   ㄱ. 프롬프트 연동 정규식(regexlink): 요약 · 모듈 표는 넣은 글이 같으면 손대지 않아요(누가 칸을 비웠으면 다시 넣어요)
//   ㄴ. 단추 글자 세로 맞춤(control-ink): 프레임 뒤 읽기를 한가할 때로(최대 0.3초) — 채팅을 여는 도중에 읽어 남의 배치를 대신 치르지 않게
//   ㄷ. 네모 단추(squared-buttons): 처음 보는 단추 재기도 같은 때로(아는 생김새는 예전처럼 바로)
//   node tools/tests/chat-open-fixed-cost.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('ok', name); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

check('ㄱ. 정규식 연동 창: 같은 글은 다시 넣지 않아요 · 비워진 칸은 다시 넣어요', () => {
    const src = read('src/addons/regexlink/index.js');
    const fn = src.match(/const shownHtml = new WeakMap\(\);\nfunction setHtml\(el, html\) \{[\s\S]*?\n\}\n/);
    assert.ok(fn, 'setHtml 이 있어요');
    assert.ok(src.includes("setHtml(root.querySelector('.rl-summary'), total"), '요약은 setHtml 로');
    assert.ok(src.includes("setHtml(root.querySelector('.rl-modules'), moduleTable());"), '모듈 표는 setHtml 로');
    assert.ok(!/querySelector\('\.rl-(summary|modules)'\)\.innerHTML\s*=/.test(src), 'innerHTML 을 바로 넣는 줄이 없어요');
    const setHtml = new Function(fn[0] + 'return setHtml;')();
    let writes = 0, inner = '';
    const el = { get firstChild() { return inner ? {} : null; }, set innerHTML(v) { writes++; inner = v; }, get innerHTML() { return inner; } };
    setHtml(el, '<b>a</b>'); setHtml(el, '<b>a</b>'); setHtml(el, '<b>a</b>');
    assert.equal(writes, 1, '같은 글은 한 번만 넣어요');
    setHtml(el, '<b>b</b>'); assert.equal(writes, 2, '글이 바뀌면 넣어요');
    inner = ''; setHtml(el, '<b>b</b>'); assert.equal(writes, 3, '누가 비웠으면 다시 넣어요');
    setHtml(null, 'x');   // 칸이 없으면 아무것도 안 해요
});

check('ㄴ. 단추 글자 맞춤: rAF 뒤 한가할 때(최대 0.3초) · 기다리는 사이 꺼지면 재지 않아요 · 한가 호출이 없으면 예전처럼 setTimeout 0', () => {
    const src = read('src/control-ink.js');
    assert.ok(src.includes("globalThis.requestIdleCallback(fn, { timeout: 300 })"), '한가할 때 · 최대 0.3초');
    assert.ok(src.includes(": typeof globalThis.setTimeout === 'function' ? globalThis.setTimeout(fn, 0) : fn());"), '없으면 예전 길');
    assert.ok(src.includes("if (!enabled) { pending.clear(); return; }"), '꺼졌으면 재지 않아요');
    const q = src.indexOf('frame = requestAnimationFrame(() => afterLayout(() => {'), a = src.indexOf('alignRoots([...pending]', q);
    assert.ok(q > 0 && a > q, '맞추기는 그 뒤에 한 번');
});

check('ㄷ. 네모 단추: rAF 뒤 한가할 때(최대 0.3초) · 겹쳐 걸지 않고 · 끌 때 취소해요', () => {
    const src = read('src/squared-buttons.js');
    assert.ok(src.includes("if (!frame && !idle) frame = host.requestAnimationFrame(() => { frame = 0; if (stopped) return; if (typeof host.requestIdleCallback === 'function') { idle = host.requestIdleCallback(() => { idle = 0; flush(); }, { timeout: 300 }); }"));
    assert.ok(src.includes('if (idle) host.cancelIdleCallback?.(idle);'));
});

console.log(`chat-open-fixed-cost: ${passed} passed`);
