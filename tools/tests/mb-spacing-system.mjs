// 1.7.6 미트볼 상태창 「간격 체계」(src/ext-status.css — 2.9.0 개편): class 를 하나하나 세지 않고 구조로 거는 넓은 규칙이 제 뜻대로 걸리는지
//   ① 묶음 자리 · 무게(뒤의 세부 규칙이 이기게 낮게) · 토큰만 · :has 없음 ② jsdom 위 지어낸 화면에서 어느 덩이에 걸리나(붙던 꼴 · 나란한 단추 · 띠 · 다음 판이 더할 법한 이름)
//   ③ 「원작 그대로 보기」 · 「간격」 스위치 끔이면 안 걸림
//   node tools/tests/mb-spacing-system.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 2 — 통과로 안 쳐요)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const require = createRequire(import.meta.url);
const L = require(path.join(root, 'tools/css-lib.cjs'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };

const src = read('src/ext-status.css').replace(/\r\n/g, '\n');
const BEGIN = '/* ========== 간격 체계', END = '/* ========== 간격 체계 끝 ========== */';
const a = src.indexOf(BEGIN), b = src.indexOf(END);
const block = src.slice(a, b);
const parsed = block.replace(/^\/\*[\s\S]*?\*\/\n/, '');
const rules = L.flatRules(L.parse(parsed, []));
const bodyOf = r => parsed.slice(r.bodyStart, r.bodyEnd);

ok('묶음: 「간격」 스위치(spacing) 아래 · 옛 「면 · 줄 간격 사다리」 · 「간격 한 벌」 세부 규칙보다 앞(같은 무게면 뒤 세부가 이겨요)', () => {
    assert.ok(a > 0 && b > a, '묶음 표식');
    assert.equal(src.slice(src.lastIndexOf('/* @mb ', a), a).trim(), '/* @mb spacing */');
    assert.ok(b < src.indexOf('/* ---------- 면 · 줄: 간격 사다리 ---------- */'));
    assert.ok(b < src.indexOf('/* ---------- 간격 한 벌: 상태창 절 안'));
    assert.ok(rules.length >= 7, `규칙 ${rules.length}개`);
});
ok('규칙: :has 없음 · 값은 간격 토큰(--bl-s*)에서 온 변수만 · 박힌 px 없음', () => {
    assert.ok(!/:has\(/.test(block.replace(/\/\*[\s\S]*?\*\//g, '')));
    const css = block.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/(margin-top|gap):\s*([^;]+);/g)) assert.match(m[2], /^var\(--bl-mb-g-(chip|btn|block|note|field)\)$/, `${m[1]}: ${m[2]}`);
    const tok = /\{ (--bl-mb-g-chip: var\(--bl-s1, 4px\); --bl-mb-g-btn: var\(--bl-s2, 8px\); --bl-mb-g-block: var\(--bl-s2, 8px\); --bl-mb-g-note: var\(--bl-s1, 4px\); --bl-mb-g-field: var\(--bl-s3, 12px\);) \}/.exec(css);
    assert.ok(tok, '눈금 다섯은 테마 간격 토큰에서');
});
ok('무게: 세로 흐름 규칙은 body.salty + :where(…) 머리(0,1,1)에 덩이 둘 — 테마 세부 규칙(body.salty .ss-scope .x = 0,3,1 이상)보다 무겁지 않아요', () => {
    const flow = rules.filter(r => /margin-top/.test(bodyOf(r)) || r.selector.includes(':where(.ss-scope :is('));
    assert.ok(flow.length >= 5);
    for (const r of flow) for (const part of L.topSplit(r.selector)) {
        assert.ok(part.startsWith('body.salty:where(:not([data-bl-ext-raw])) :where(.ss-scope :is(.ss-body, .ss-sec, .ss-card, .ss-root, details)) > '), part.slice(0, 90));
        const tail = part.split(')) > ')[1];
        assert.ok((tail.match(/\./g) || []).length + (tail.match(/\[/g) || []).length >= 1);
        assert.ok(!/#|!important/.test(tail));
    }
});

// ── 지어낸 화면에서 어디에 걸리나(선택자 맞음만 — jsdom 은 배치가 없어요) ─────────────────────────────
const html = `<!doctype html><html><body class="salty"><div class="ss-root ss-scope"><main class="ss-body">
<div class="ss-mapwrap line" id="map"></div><p class="ss-hint" id="mapHint">끌어서 옮겨요</p>
<section class="ss-sec" id="sec">
  <div class="ss-sec-h"><h4>게임 모드</h4></div>
  <div class="ss-seg wrap" id="modes"><button>가</button><button>나</button></div>
  <div class="ss-pills" id="pills"><button class="ss-pill">욕구 탭</button></div>
  <p class="ss-hint" id="h1">설명 하나</p><p class="ss-hint" id="h2">설명 둘</p>
  <div class="ss-stack" id="stack"></div><button class="ss-btn ghost" id="ghost">직접 걸기</button>
  <button class="ss-btn" id="b1">가</button><button class="ss-btn" id="b2">나</button>
  <button class="ss-btn wide" id="w1">넓은 가</button><button class="ss-btn wide" id="w2">넓은 나</button>
  <div class="ss-newthing-wrap" id="future"></div><div class="ss-grid-btns" id="after"></div>
</section>
<div class="ss-card" id="card"><div class="ss-inline" id="inl"></div><button class="ss-btn sm" id="cardBtn">이 날로</button></div>
<header class="ss-head"><div class="ss-head-a" id="heada"></div></header>
<div class="ss-tools" id="tools"></div><div class="ss-bub-acts" id="bub"></div><div class="ss-zzz-acts" id="futureActs"></div><span class="ss-pair-adj" id="adj"></span>
</main></div>
<div id="ss-hud" class="ss-scope"><div class="ss-tb"><div class="ss-tb-acts" id="band"></div></div></div></body></html>`;
const dom = new JSDOM(html); const doc = dom.window.document;
const hits = (id, prop) => rules.filter(r => { if (!new RegExp(`(^|[;\\s{])${prop}:`).test(bodyOf(r))) return false; try { return doc.getElementById(id).matches(r.selector); } catch (e) { throw Error(`선택자를 못 읽어요: ${r.selector.slice(0, 80)} — ${e.message}`); } }).length;
ok('세로: 붙던 꼴에 걸려요 — 상자 → 설명 · 고르기 → 알약 줄 · 설명 → 설명 · 묶음 → 낱 단추 · 넓은 단추끼리 · 카드 안 줄 → 단추', () => {
    for (const id of ['mapHint', 'pills', 'h1', 'h2', 'ghost', 'w2', 'cardBtn', 'after']) assert.ok(hits(id, 'margin-top') >= 1, id);
    assert.ok(hits('h2', 'margin-top') >= 2, '설명 뒤 설명은 4 로 덮는 줄이 하나 더');
});
ok('세로: 건드리지 않는 곳 — 절 제목 바로 다음 · 나란히 놓인 낱 단추 · 절의 첫 덩이', () => {
    for (const id of ['modes', 'b1', 'b2', 'w1', 'map', 'sec']) assert.equal(hits(id, 'margin-top'), 0, id);   // 낱 단추는 앞이 줄 · 상자 · 설명일 때만(#ghost) — 단추 뒤 단추(#b1 · #b2)는 나란히 놓일 수 있어 그대로
});
ok('가로: 아이콘 단추 줄 틈 — 창 머리 · 칸 도구 줄 · 「-acts」 · 「-adj」 · 띠 단추 줄(.ss-tb-acts)은 빼요', () => {
    for (const id of ['heada', 'tools', 'bub', 'adj']) assert.equal(hits(id, 'gap'), 1, id);
    assert.equal(hits('band', 'gap'), 0, '띠는 제 틈(3)');
});
ok('다음 판: 처음 보는 이름도 버릇대로면 걸려요(「…wrap」 상자 · 「…-acts」 줄)', () => {
    assert.equal(hits('futureActs', 'gap'), 1);
    assert.ok(hits('after', 'margin-top') >= 1, '「…wrap」 다음 단추 격자');
    doc.getElementById('h2').insertAdjacentHTML('afterend', '<div class="ss-brandnew-wrap" id="fut2"></div>');
    assert.ok(hits('fut2', 'margin-top') >= 1, '설명 다음 「…wrap」');
});
ok('끔: 「원작 그대로 보기」면 한 줄도 안 걸리고, 사본은 「간격」 스위치 문을 달아요', () => {
    doc.body.setAttribute('data-bl-ext-raw', '');
    for (const id of ['mapHint', 'pills', 'h1', 'ghost', 'heada', 'tools']) assert.equal(hits(id, 'margin-top') + hits(id, 'gap'), 0, id);
    doc.body.removeAttribute('data-bl-ext-raw');
    const gen = read('src/ext-status.gen.css');
    assert.ok(gen.includes(':where(:root:not([data-bl-mb-off~="spacing"])) > body.salty:where(:not([data-bl-ext-raw])) :where(.ss-scope :is(.ss-body, .ss-sec, .ss-card, .ss-root, details)) > * + .ss-hint'));
});
await ok('아이콘 줄(1.7.6 · 디자인 관문): 그림만 옮겨요(면 · 누를 자리 그대로) · 원작 그대로 보기에서는 안 걸려요 · 꺼진 단추 같은 테마 공통 꼴은 안 건드려요', () => {
    const at = src.indexOf('1.7.6 아이콘 줄 세로 가운데'); assert.ok(at > 0, '아이콘 줄 묶음');
    const part = src.slice(at);
    const lines = part.split('\n').filter(l => l.startsWith('body.salty'));
    assert.ok(lines.length >= 8, '규칙 수');
    for (const l of lines) assert.ok(l.startsWith('body.salty:not([data-bl-ext-raw]) '), '원작 그대로 보기 문: ' + l.slice(0, 80));
    const icon = lines.filter(l => / > i[^ ]* {/.test(l));
    assert.ok(icon.length >= 5, '아이콘 규칙');
    for (const l of icon) { const body = l.slice(l.indexOf('{')); assert.doesNotMatch(body, /(^|[ ;{])(width|height|padding|margin|color|background)[^;]*:/, '그림 자리만 옮겨요: ' + l.slice(0, 80)); }
    for (const act of ['inbox', 'hidetog', 'talk', 'leave']) assert.ok(icon.some(l => l.includes('[data-act="' + act + '"]')), act);
    assert.doesNotMatch(part, /:has\(|!important|opacity/, ':has · !important · 투명도 없음');
    assert.match(part, /#ss-hud \.ss-tb-acts > \.ss-t\.ic::after \{ content: ''; position: absolute; inset: 0 -5px; \}/, '띠 단추 누를 자리 가로 40');
});
console.log(`mb-spacing-system: ${n}개 통과`);
