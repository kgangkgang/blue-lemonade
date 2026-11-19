// 1.9.x 미트볼 화면 다듬기 둘 — ① 닫힌 고르개의 고른 값 글(src/mb-select-tr.js) ② 설명 글 안 단추의 위 간격(src/ext-status.css 공용 규칙)
//   ① 값(value 속성)이 따로 있는 option 글만 사전으로 · 값은 그대로 · 다시 그려도 다시 적음 · 화면만 번역이 꺼지면 되돌림 · 사전이 늘면 원래 글에서 다시 옮김 · 그 확장 밖 고르개는 안 건드림
//   ② 설명 글(.ss-hint) 안의 단추 · 칩에 위 간격 규칙이 소스 · 생성 CSS 에 있고 0 이 아니에요
//   ③ 환영 화면에 남는 앞 채팅 칩 자리 가리기(그 확장이 메시지 번호로 다시 달아서 화면에서만 가려요)
//   node tools/tests/mb-select-tr.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const M = await import(pathToFileURL(path.join(root, 'src/mb-select-tr.js')).href);
const page = () => new JSDOM(`<!doctype html><body>
<dialog class="ss-dlg" open><div class="ss-root"><div class="ss-qcheck">
 <select class="ss-in" id="attr"><option value="">능력치 없이</option><option value="Charm" selected>Charm +2</option><option value="Etiquette">Etiquette +4</option></select>
 <select class="ss-in" id="dc"><option value="12" selected>보통 12</option></select>
 <select id="bare"><option>Charm</option></select>
</div></div></dialog>
<select id="other"><option value="Charm">Charm +2</option></select></body>`).window.document;
const DICT = { Charm: '매력', Etiquette: '예법' };
const trs = t => String(t).replace(/[A-Za-z]+/g, w => DICT[w] ?? w);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

test('① 닫힌 고르개의 고른 값 글이 사전 글로 — 값은 그대로', () => {
    const doc = page();
    assert.equal(M.trOptions(doc, trs), 2);
    const sel = doc.getElementById('attr');
    assert.equal(sel.selectedOptions[0].textContent, '매력 +2');
    assert.equal(sel.value, 'Charm');
    assert.deepEqual([...sel.options].map(o => o.textContent), ['능력치 없이', '매력 +2', '예법 +4']);
    assert.equal(doc.getElementById('dc').options[0].textContent, '보통 12');
});
test('값 속성이 없는 option(글이 곧 값) · 그 확장 밖 고르개는 안 건드려요', () => {
    const doc = page(); M.trOptions(doc, trs);
    assert.equal(doc.getElementById('bare').options[0].textContent, 'Charm');
    assert.equal(doc.getElementById('bare').value, 'Charm');
    assert.equal(doc.getElementById('other').options[0].textContent, 'Charm +2');
});
test('두 번 돌려도 그대로 · 그 확장이 다시 그리면 다시 적어요', () => {
    const doc = page(); M.trOptions(doc, trs);
    assert.equal(M.trOptions(doc, trs), 0);
    doc.getElementById('attr').innerHTML = '<option value="Etiquette" selected>Etiquette +4</option>';
    assert.equal(M.trOptions(doc, trs), 1);
    assert.equal(doc.getElementById('attr').selectedOptions[0].textContent, '예법 +4');
});
test('사전이 나중에 늘면 원래 글에서 다시 옮겨요 · 화면만 번역이 꺼지면 원래 글로', () => {
    const doc = page();
    M.trOptions(doc, t => String(t).replace('Charm', '매력'));
    assert.equal(doc.getElementById('attr').options[2].textContent, 'Etiquette +4');
    M.trOptions(doc, trs);
    assert.equal(doc.getElementById('attr').options[2].textContent, '예법 +4');
    M.trOptions(doc, trs, false);
    assert.deepEqual([...doc.getElementById('attr').options].map(o => o.textContent), ['능력치 없이', 'Charm +2', 'Etiquette +4']);
});
test('번역 함수가 던져도 원문 그대로(화면을 깨지 않아요)', () => {
    const doc = page();
    assert.equal(M.trOptions(doc, () => { throw new Error('x'); }), 0);
    assert.equal(doc.getElementById('attr').selectedOptions[0].textContent, 'Charm +2');
});
test('고리: 그 확장 화면의 값 바꿈 뒤 다시 적어요 · 밖의 누름에는 안 돌아요', () => {
    const doc = page(); const q = [];
    const run = M.watchSelectTr(doc, { trs, on: () => true, timer: fn => q.push(fn) });
    doc.getElementById('other').dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    assert.equal(q.length, 0);
    doc.getElementById('attr').dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    assert.equal(q.length, 2);
    q.shift()();
    assert.equal(doc.getElementById('attr').selectedOptions[0].textContent, '매력 +2');
    assert.equal(typeof run.soon, 'function');
});
test('② 설명 글 안 단추 · 칩: 위 간격 공용 규칙(0 아님)이 소스 · 생성 CSS 에', () => {
    const RULE = '.ss-scope .ss-hint > :is(.ss-btn, .ss-chip, button) { margin-top: var(--bl-mb-g-block, 8px); }';
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(css.includes('body.salty:where(:not([data-bl-ext-raw])) ' + RULE));
    const g = /--bl-mb-g-block:\s*([^;]+);/.exec(css);
    assert.ok(g && !/^0(px)?$/.test(g[1].trim()), '간격 값');
    assert.ok(fs.readFileSync(path.join(root, 'src/ext-status.gen.css'), 'utf8').includes('.ss-hint > '), '생성 CSS');
});
test('③ 환영 화면(열린 채팅 없음)에서는 메시지 밑 칩 자리를 가려요 — 표식은 채팅 번호로만 · :has 와 #chat 없이', () => {
    const RULE = 'body.salty.bl-mb-welcome .mes .ss-slot { display: none !important; }';
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.ok(css.includes(RULE));
    assert.ok(!css.includes('.welcomePanel)') && !css.includes('#chat'), ':has(.welcomePanel) · #chat 꼴이 남아 있지 않아요');
    const gen = fs.readFileSync(path.join(root, 'src/ext-status.gen.css'), 'utf8');
    assert.ok(gen.includes('body.salty.bl-mb-welcome .mes .ss-slot { display: none !important; }'), '생성 CSS');
    const doc = page();
    assert.equal(M.markWelcome(doc, undefined), true);
    assert.ok(doc.body.classList.contains('bl-mb-welcome'));
    assert.equal(M.markWelcome(doc, 'chat - 2026'), false);
    assert.ok(!doc.body.classList.contains('bl-mb-welcome'), '채팅을 열면 표식을 떼요');
    assert.equal(M.markWelcome(doc, null), true);
    assert.equal(M.markWelcome(null, null), true, '문서가 없어도 던지지 않아요');
    const tr = fs.readFileSync(path.join(root, 'src/ext-bridge-tr.js'), 'utf8');
    assert.ok(tr.includes('eventSource.on(types.CHAT_CHANGED, () => welcome())'), '채팅이 바뀔 때만 갱신');
});
console.log(`mb-select-tr: ${passed} 통과`);
