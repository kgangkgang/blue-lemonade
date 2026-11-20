// 1.9.2 미트볼 큰 창 안쪽 다듬기(src/ext-status.css): 작은 탭 줄 밑 도구 줄 머리(탭 이름 되풀이)만 숨고 동작 단추는 남는지 · 본문 맨 위 「보일 것」 + 설명 줄이 한 안내 상자로 묶이는지
//   jsdom 위 지어낸 화면에서 선택자 맞음만 봐요(배치는 리그 몫). 탭이 하나뿐인 묶음 · 미니홈피 꼴 · 「원작 그대로 보기」 는 안 걸려요
//   node tools/tests/mb-sheet-tidy.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 2 — 통과로 안 쳐요)
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
const HEAD = 'body.salty:not([data-bl-ext-raw]) .ss-scope:not(.ss-hompy) > ';
const rules = L.flatRules(L.parse(src, [])).filter(r => L.topSplit(r.selector).some(p => p.startsWith(HEAD)));
const bodyOf = r => src.slice(r.bodyStart, r.bodyEnd);
const marker = at => src.slice(src.lastIndexOf('/* @mb ', at), src.indexOf('*/', src.lastIndexOf('/* @mb ', at)) + 2);

ok('묶음: 도구 줄 규칙은 「controls」 · 안내 상자 규칙은 「spacing」 스위치 아래 · 모두 원작 그대로 보기 문 · !important 없음', () => {
    assert.ok(rules.length >= 9, `규칙 ${rules.length}개`);
    for (const r of rules) {
        const want = r.selector.includes('.ss-toolrow') ? '/* @mb controls */' : '/* @mb spacing */';
        assert.equal(marker(r.bodyStart), want, r.selector.slice(0, 90));
        assert.doesNotMatch(bodyOf(r), /!important/);
    }
});

const page = (extra = '', rootCls = 'ss-root ss-scope', tabs = true, group = 'me') => new JSDOM(`<!doctype html><html><body class="salty"><div class="${rootCls}">
<header class="ss-head"></header><nav class="ss-groups"><button class="on" data-act="group" data-arg="${group}">나</button></nav>
${tabs ? '<nav class="ss-tabs"><button class="on">프로필</button><button>수치</button></nav>' : ''}
<div class="ss-toolrow" id="row"><div class="ss-toolrow-t" id="title"><i></i>프로필</div><div class="ss-tools" id="tools"><button class="ss-tool" data-act="favtog" id="fav"></button><button class="ss-tool" data-act="edit" id="edit"></button></div></div>
<main class="ss-body" id="body"><details class="ss-more ss-relshow ss-partbar" id="bar"><summary id="sum">보일 것</summary></details>
<div class="ss-hint" id="mode">프로필 모드</div><div class="ss-hint ss-relonly" id="rel">관계에만 있는 사람 <button class="ss-btn sm" id="add">프로필 더하기</button></div>
<div class="ss-stack" id="cards"></div><p class="ss-hint" id="later">아래 설명</p>${extra}</main></div></body></html>`).window.document;
const hits = (doc, id, prop) => rules.filter(r => { if (!new RegExp(`(^|[;\\s{])${prop}:`).test(bodyOf(r))) return false; return doc.getElementById(id).matches(r.selector); });
const has = (doc, id, prop) => hits(doc, id, prop).length > 0;

let D;
try { D = page(); D.querySelector(':has(*)'); } catch { console.log('이 jsdom 은 :has 를 못 읽어요 — 이 시험은 돌지 않았어요'); process.exit(2); }

ok('도구 줄: 작은 탭 줄이 있으면 머리(탭 이름)만 숨기고 줄은 오른쪽 · 구분선 없음 · 단추는 안 건드림', () => {
    assert.ok(hits(D, 'title', 'display').some(r => /display: none/.test(bodyOf(r))));
    assert.ok(has(D, 'row', 'justify-content') && has(D, 'row', 'border-bottom'));
    for (const id of ['fav', 'edit', 'tools']) assert.equal(hits(D, id, 'display').length + hits(D, id, 'visibility').length, 0, id);
    assert.ok(has(D, 'body', 'padding-top'));
});
ok('도구 줄: 탭이 하나뿐인 묶음은 「관리」 · 「부가 기능」(묶음 이름 = 탭 이름)만 머리를 숨기고, 다른 이름인 묶음(즐겨찾기 · 탭 하나로 준 세계) · 미니홈피 꼴은 그대로', () => {
    for (const g of ['manage', 'extra']) { const d = page('', 'ss-root ss-scope', false, g); assert.ok(hits(d, 'title', 'display').length > 0, g); assert.ok(has(d, 'row', 'border-bottom') && has(d, 'body', 'padding-top'), g); }
    for (const g of ['fav', 'world']) assert.equal(hits(page('', 'ss-root ss-scope', false, g), 'title', 'display').length, 0, g);
    assert.equal(hits(page('', 'ss-root ss-scope ss-hompy'), 'title', 'display').length, 0, '미니홈피');
});
ok('안내 상자: 보일 것 + 이어진 설명 둘이 한 면 · 첫 칸 위 둥글게 · 끝 칸 아래 둥글게 · 뒤 덩이 · 절 12 · 뒤쪽 낱 설명은 안 걸림', () => {
    for (const id of ['bar', 'mode', 'rel']) assert.ok(has(D, id, 'background'), id);
    assert.ok(has(D, 'bar', 'border-top-left-radius') && !has(D, 'mode', 'border-top-left-radius'));
    assert.ok(has(D, 'rel', 'border-bottom-left-radius') && !has(D, 'mode', 'border-bottom-left-radius'));
    assert.ok(has(D, 'cards', 'margin-top'), '상자 뒤 덩이 12');
    { const d = page('<section class="ss-sec" id="sec2"></section>'); d.getElementById('cards').remove(); assert.ok(has(d, 'sec2', 'margin-top'), '상자 뒤 절도 12(절 위 24 대신)'); }
    assert.ok(!has(D, 'later', 'background'), '본문 아래쪽 설명');
    assert.ok(has(D, 'mode', 'font-size') && has(D, 'sum', 'font-size'));
});
ok('안내 상자 안 단추(프로필 더하기): 글 끝에 매달리지 않고 오른쪽으로', () => {
    assert.ok(hits(D, 'add', 'float').some(r => /float: right/.test(bodyOf(r))));
});
ok('안내 상자: 설명이 안 이어지면 「보일 것」 한 줄은 그대로 · 원작 그대로 보기 · 미니홈피면 안 걸림', () => {
    const d = page(); d.getElementById('mode').remove(); d.getElementById('rel').remove();
    assert.equal(hits(d, 'bar', 'background').length, 0, '설명 없는 탭');
    assert.ok(has(d, 'sum', 'font-size'), '「보일 것」 글자는 상자 없는 탭에서도 같은 크기');
    const raw = page(); raw.body.setAttribute('data-bl-ext-raw', '');
    for (const id of ['bar', 'mode', 'rel', 'title', 'row']) assert.equal(hits(raw, id, 'background').length + hits(raw, id, 'display').length, 0, id);
    assert.equal(hits(page('', 'ss-root ss-scope ss-hompy'), 'mode', 'background').length, 0);
});
ok(':has 는 주어 칸에만(테마 :has 지킴이) · 「+ *」 같은 넓은 뒤 칸 없음', () => {
    for (const r of rules) for (const part of L.topSplit(r.selector)) {
        const cs = L.compounds(part.trim()); const last = cs[cs.length - 1];
        for (const c of cs.slice(0, -1)) assert.ok(!c.includes(':has('), part.slice(0, 120));
        assert.notEqual(last.trim(), '*', part.slice(0, 120));
    }
});
ok('생성 사본: 스위치 문(controls · spacing)이 달렸어요', () => {
    const gen = read('src/ext-status.gen.css');
    assert.ok(gen.includes(':where(:root:not([data-bl-mb-off~="controls"])) > ' + HEAD + '.ss-tabs ~ .ss-toolrow > .ss-toolrow-t,'));
    assert.ok(gen.includes(':where(:root:not([data-bl-mb-off~="spacing"])) > ' + HEAD + '.ss-body > .ss-partbar:first-child:has(+ .ss-hint)'));
});
console.log(`mb-sheet-tidy: ${n}개 통과`);
