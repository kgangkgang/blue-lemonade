// 1.0.3 메시지 범위 지우기 (src/quick/range-delete.js)
//   · 고르기 차례(처음 → 끝 → 새 처음) · 범위 · 안내 글 · 기본 켬 · 켤 때만 받음 · 설정 창 · 찾기 · 이름표
//   · 가짜 브라우저: ☰ 메뉴 「메시지 삭제」 바로 아래 항목 하나 · 누르면 입력줄 대신 「지우기 · 취소」 줄 · 고른 메시지는 실리태번 삭제 모양(.selected)
//   · 지우기 전 늘 확인(취소면 그대로) · 끝에서부터 실리태번 deleteMessage(도구 호출 묶음 안 건드림) · 채팅이 바뀌면 그만 · 답 만드는 중엔 안 들어감
//   · 나오면(취소 · Esc · 채팅 바뀜) 리스너 · 칠 · 줄이 남지 않음 · 끄면 메뉴 항목도 없음
//   node tools/tests/quick-range-delete.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

await test('기본 켬 · 켤 때만 받음 · 설정 창 · 찾기 · 이름표', () => {
    assert.match(read('src/settings.js'), /quick: \{[^}]*rangeDelete: true/);
    const f = read('src/features.js');
    assert.match(f, /q\.rangeDelete !== false/);
    assert.match(f, /load\('rangedelete', '\.\/quick\/range-delete\.js'\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.rangeDelete', s\.quick\?\.rangeDelete !== false\)/);
    assert.match(read('src/settings-search.js'), /'quick\.rangeDelete'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.rangeDelete':'메시지 범위 지우기'/);
});

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx, eventSource } = dom.installBrowser({ settings: { enabled: true, quick: { rangeDelete: true } } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
const toasts = [];
globalThis.toastr = { info: m => toasts.push(['info', m]), success: m => toasts.push(['success', m]), warning: m => toasts.push(['warning', m]), error: m => toasts.push(['error', m]), clear() {} };
let confirmAnswer = true; const asked = [];
globalThis.confirm = msg => { asked.push(msg); return confirmAnswer; };   // ask() 는 Popup 이 없으면 confirm 으로
delete ctx.Popup;

const R = await import(url('src/quick/range-delete.js'));

await test('고르기 차례 · 범위 · 안내 글', () => {
    let s = { start: null, end: null };
    s = R.nextPick(s, 5); assert.deepEqual(s, { start: 5, end: null });
    s = R.nextPick(s, 2); assert.deepEqual(s, { start: 5, end: 2 });
    assert.deepEqual(R.rangeOf(s.start, s.end), [2, 5]);
    s = R.nextPick(s, 7); assert.deepEqual(s, { start: 7, end: null }, '세 번째는 새 처음');
    assert.deepEqual(R.rangeOf(7, null), [7, 7]);
    assert.equal(R.rangeOf(null, null), null);
    assert.match(R.rangeLabel(null), /처음 메시지/);
    assert.match(R.rangeLabel([2, 5]), /#2 ~ #5 · 4개/);
    assert.match(R.rangeLabel([3, 3]), /#3 하나/);
});

// 실리태번 뼈대: ☰ 메뉴 · 입력줄 · 메시지 6개
const options = document.createElement('div'); options.id = 'options';
options.innerHTML = '<div class="options-content"><a id="option_select_chat"></a><a id="option_delete_mes"></a><a id="option_regenerate"></a></div>';
document.body.append(options);
const chat = document.getElementById('chat');
const fill = n => { chat.replaceChildren(); ctx.chat = []; for (let i = 0; i < n; i++) { chat.append(dom.messageElement(i)); ctx.chat.push({ mes: `m${i}` }); } };
fill(6);
const deletes = [];
ctx.deleteMessage = async (id, swipe, ask, tools) => {
    deletes.push([id, swipe, ask, tools]);
    ctx.chat.splice(id, 1);
    chat.querySelector(`.mes[mesid="${id}"]`)?.remove();
    for (const mes of chat.children) { const m = Number(mes.getAttribute('mesid')); if (m > id) mes.setAttribute('mesid', String(m - 1)); }
};
const base = dom.listenerCounts(eventSource);

await test('켜면 ☰ 메뉴 「메시지 삭제」 바로 아래 항목 하나 (두 번 켜도 하나)', () => {
    R.syncRangeDelete(true); R.syncRangeDelete(true);
    const items = document.querySelectorAll('#option_bl_range_delete');
    assert.equal(items.length, 1);
    assert.equal(document.getElementById('option_delete_mes').nextElementSibling, items[0]);
    assert.match(items[0].textContent, /범위 지우기/);
});

const click = el => el.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

await test('항목 → 입력줄 대신 줄 · 처음/끝 누르면 사이가 실리태번 삭제 모양으로', () => {
    click(document.getElementById('option_bl_range_delete'));
    const bar = document.getElementById('bl-range-del');
    assert.ok(bar, '줄이 떠요');
    assert.equal(document.getElementById('send_form').style.display, 'none');
    assert.ok(bar.querySelector('.bl-rd-ok').classList.contains('disabled'), '고르기 전엔 지우기 못 누름');
    click(chat.querySelector('[mesid="4"] .mes_text'));
    click(chat.querySelector('[mesid="2"]'));
    const picked = [...chat.querySelectorAll('.mes.selected')].map(m => m.getAttribute('mesid'));
    assert.deepEqual(picked, ['2', '3', '4']);
    assert.match(bar.querySelector('.bl-rd-note').textContent, /#2 ~ #4 · 3개/);
    assert.equal(bar.querySelector('.bl-rd-ok').classList.contains('disabled'), false);
});

await test('확인에서 취소하면 아무것도 안 지움(줄은 남음)', async () => {
    confirmAnswer = false; asked.length = 0;
    await R._forTest.confirmDelete();
    assert.equal(asked.length, 1);
    assert.match(asked[0], /#2 ~ #4 메시지 3개를 지울까요\?/);
    assert.match(asked[0], /되돌릴 수 없어요/);
    assert.deepEqual(deletes, []);
    assert.ok(document.getElementById('bl-range-del'));
});

await test('지우기: 끝에서부터 실리태번 deleteMessage(확인 창은 우리 것 · 도구 묶음 안 건드림) · 나오면 흔적 없음', async () => {
    confirmAnswer = true;
    await R._forTest.confirmDelete();
    assert.deepEqual(deletes, [[4, undefined, false, false], [3, undefined, false, false], [2, undefined, false, false]]);
    assert.deepEqual(ctx.chat.map(m => m.mes), ['m0', 'm1', 'm5']);
    assert.equal(document.getElementById('bl-range-del'), null);
    assert.notEqual(document.getElementById('send_form').style.display, 'none');
    assert.equal(chat.querySelectorAll('.mes.selected').length, 0);
    assert.deepEqual(dom.listenerCounts(eventSource), { ...base, elements: base.elements + 1 }, '남은 것은 메뉴 항목 리스너 하나');
    assert.ok(toasts.some(([k, m]) => k === 'success' && /3개/.test(m)));
});

await test('Esc · 취소 단추 · 채팅 바뀜으로 나오면 그대로', async () => {
    fill(4); deletes.length = 0;
    R._forTest.enter();
    click(chat.querySelector('[mesid="1"]'));
    document.dispatchEvent(new Event('keydown', { bubbles: true, key: 'Escape' }));
    assert.equal(document.getElementById('bl-range-del'), null);
    assert.equal(chat.querySelectorAll('.mes.selected').length, 0);
    R._forTest.enter();
    click(document.querySelector('#bl-range-del .bl-rd-cancel'));
    assert.equal(document.getElementById('bl-range-del'), null);
    R._forTest.enter();
    await eventSource.emit(ctx.eventTypes.CHAT_CHANGED);
    assert.equal(document.getElementById('bl-range-del'), null);
    assert.deepEqual(deletes, []);
    assert.deepEqual(dom.listenerCounts(eventSource), { ...base, elements: base.elements + 1 });
});

await test('하나만 고르면 그 하나 · 답 만드는 중엔 들어가지 않음 · 그사이 채팅이 바뀌면 안 지움', async () => {
    fill(3); deletes.length = 0; confirmAnswer = true;
    R._forTest.enter();
    click(chat.querySelector('[mesid="1"]'));
    await R._forTest.confirmDelete();
    assert.deepEqual(deletes.map(d => d[0]), [1]);
    document.body.dataset.generating = 'true';
    R._forTest.enter();
    assert.equal(document.getElementById('bl-range-del'), null);
    delete document.body.dataset.generating;
    fill(3); deletes.length = 0;
    R._forTest.enter();
    click(chat.querySelector('[mesid="0"]'));
    const keep = ctx.getCurrentChatId; let id = 'chat-0'; ctx.getCurrentChatId = () => id;
    globalThis.confirm = () => { id = 'chat-other'; return true; };
    await R._forTest.confirmDelete();
    assert.deepEqual(deletes, []);
    ctx.getCurrentChatId = keep;
});

await test('끄면 메뉴 항목 · 고르기 줄 · 리스너 모두 없음', () => {
    R._forTest.enter();
    R.syncRangeDelete(false);
    assert.equal(document.getElementById('option_bl_range_delete'), null);
    assert.equal(document.getElementById('bl-range-del'), null);
    assert.deepEqual(dom.listenerCounts(eventSource), base);
});

console.log(`quick-range-delete: ${passed}개 통과`);
