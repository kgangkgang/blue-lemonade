// 1.5.0 설정 창 짧은 줄 두 열(src/settings-advanced.js pairShortRows) — jsdom 으로 표시가 맞게 붙는지 봐요.
//   node tools/tests/settings-pairs.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 알리고 끝 — 통과로 세지 않아요)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || path.join(root, 'tools');
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
for (const k of ['window', 'document', 'Node', 'Element', 'HTMLElement']) globalThis[k] = k === 'window' ? window : window[k];
const { pairShortRows } = await import(pathToFileURL(path.join(root, 'src/settings-advanced.js')).href);

const sw = '<label class="salty-switch"><input type="checkbox"><span></span></label>';
const row = (label, { note = '', control = sw, cls = '' } = {}) => `<div class="salty-row ${cls}"><span>${label}${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
const slider = '<div class="salty-slider"><header><span>진하기</span></header><input type="range"></div>';
const group = (title, inner) => `<div class="bl-editor-group" data-group="${title}"><h4 class="bl-editor-group-head">${title}<button class="bl-help-btn">?</button></h4><div class="bl-editor-group-body"><div class="salty-group">${inner}</div></div></div>`;
const mount = html => { const s = document.createElement('section'); s.className = 'salty-sec'; s.innerHTML = html; document.body.replaceChildren(s); return s; };
const marks = s => [...s.querySelectorAll('.salty-row')].map(r => r.dataset.pair || '-').join('');

let failed = 0, passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n' + (e.stack || e)); } };

test('짧은 스위치 줄이 둘 이상 이어지면 짝 표시 · 홀수면 끝 줄은 전체 폭', () => {
    const s = mount(group('메시지 편의', row('고른 글 고치기') + row('번역문도 고치기') + row('퀵 리플라이 줄 접기')));
    pairShortRows(s, false);
    assert.equal(marks(s), '11-');
    assert.ok(s.querySelector('.salty-group').classList.contains('bl-pairs'));
});
test('설명이 남은 줄 · 긴 이름(15자 이상) · 고르기 칸 줄은 짝에서 빠지고 짝을 끊어요', () => {
    const s = mount(group('화면', row('배경 이미지 비치기', { note: '끄면 깨끗한 종이색 바탕' }) + row('글자색 대비 맞추기') + row('새 답 첫 줄로 가는 단추') + row('아주아주 긴 이름을 가진 설정 줄이에요') + row('채팅 입력칸 숨기기') + row('모양', { control: '<select><option>a</option></select>' }) + row('하나')));
    pairShortRows(s, false);
    assert.equal(marks(s), '-11----');
});
test('되돌리기 단추(↺)가 이름 안에 있어도 글자 수에 넣지 않아요 · 아이콘 단추 · 색 칸 줄도 짝', () => {
    const s = mount(group('진단', row('숨긴 메시지 흐리게<button class="bl-setting-reset">↺</button>') + row('진단 복사', { control: '<button class="salty-btn salty-btn-icon"></button>' }) + row('글자 색', { cls: 'salty-color', control: '<toolcool-color-picker></toolcool-color-picker>' }) + row('바탕', { cls: 'salty-color', control: '<toolcool-color-picker></toolcool-color-picker>' })));
    pairShortRows(s, false);
    assert.equal(marks(s), '1111');
});
test('짝이 없으면 묶음에 표시하지 않아요 · 혼자 선 슬라이더는 전체 폭 표시 · 나란한 슬라이더는 그대로', () => {
    const s = mount(group('가', row('하나') + slider + row('둘')) + group('나', row('하나') + row('둘') + slider + row('셋') + slider + slider));
    pairShortRows(s, false);
    const [a, b] = s.querySelectorAll('.salty-group');
    assert.ok(!a.classList.contains('bl-pairs')); assert.ok(b.classList.contains('bl-pairs'));
    assert.deepEqual([...b.querySelectorAll('.salty-slider')].map(x => x.hasAttribute('data-pair-wide')), [true, false, false]);
});
test('제목 + 짧은 줄 하나뿐인 묶음이 이어지면 둘씩 나란히(a · b) · 홀수 끝과 줄이 여럿인 묶음은 그대로', () => {
    const s = mount(group('캐릭터 관리', row('최근 채팅 · 채팅 폴더')) + group('API 연결', row('API 서버 상태')) + group('로그 복사', row('로그 복사')) + group('메시지 편의', row('하나') + row('둘')) + group('단추 설명', row('설명 보기')) + group('한국어', row('화면 다듬기')));
    pairShortRows(s, false);
    assert.deepEqual([...s.querySelectorAll('.bl-editor-group')].map(g => g.dataset.solo || '-'), ['a', 'b', '-', '-', 'a', 'b']);
});
test('칩으로 한 묶음씩 보는 화면은 묶음을 나란히 두지 않아요(줄 짝은 그대로)', () => {
    const s = mount(group('가', row('하나')) + group('나', row('둘')) + group('다', row('셋') + row('넷')));
    pairShortRows(s, true);
    assert.equal(s.querySelectorAll('.bl-solo').length, 0); assert.equal(marks(s), '--11');
});
test('두 열 규칙이 CSS 에 있고 폰 320 · 큰 글씨에서는 한 열로 돌아가요', () => {
    const css = fs.readFileSync(path.join(root, 'css/33-panel-columns.css'), 'utf8');
    assert.match(css, /\.salty-group\.bl-pairs:not\(\.bl-control-grid\) \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /@container bl-controls \(22em <= width < 34em\) \{\s*html body \.salty-panel\.bl-editor \.salty-sec \.salty-group\.bl-control-grid\.bl-pairs \{/, '짧은 값 격자는 좁을 때만 짝 두 열');
    assert.match(css, /@container bl-controls \(width < 22em\) \{\s*html body \.salty-panel\.bl-editor \.salty-sec \.salty-group\.bl-pairs \{ display: block; \}/);
    assert.match(css, /\.bl-editor-group\.bl-solo\[data-solo="a"\]/);
});
test('두 열 접는 묶음(변경한 설정 · 마크다운): 같은 줄 칸 높이 같게 · 개수와 꺾쇠는 첫 줄 자리 · 제목만 줄바꿈', () => {
    const css = fs.readFileSync(path.join(root, 'css/67-markdown-controls.css'), 'utf8');
    assert.match(css, /\.salty-panel \.bl-md-groups \{ align-items:stretch; \}/);
    assert.match(css, /\.bl-md-groups > \.bl-md-group > summary > small \{[^}]*align-self:flex-start;[^}]*white-space:nowrap/);
    assert.match(css, /\.bl-md-groups > \.bl-md-group > summary > span \{[^}]*word-break:keep-all/);
    assert.match(css, /html:not\(#bl-ui-parts-off\) body:not\(#bl-md-chev\) \.salty-panel \.bl-md-groups > \.bl-md-group > summary::after \{ top:22px !important; \}/);
    assert.match(css, /\.bl-md-groups > \.bl-md-group\[open\] \{ grid-column:1 \/ -1; \}/);
});
console.log(`settings-pairs: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
