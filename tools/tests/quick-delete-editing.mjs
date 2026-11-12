// 연필로 고치는 중인 메시지보다 앞을 테마 단추(연필 옆 지우기 · 범위 지우기)로 지우지 않는지 (11-12 전체 점검 1부)
//   실리태번 deleteMessage 는 지운 번호가 편집 번호(this_edit_mes_id)와 같을 때만 그 번호를 비워요(script.js deleteMessage).
//   그보다 앞을 지우면 편집 번호가 옛 번호로 남아, ✓ 를 누를 때 messageEditDone 이 chat[옛 번호] — 다른 메시지 — 의 글로
//   고친 칸을 다시 그리고 MESSAGE_EDITED · MESSAGE_UPDATED 를 그 번호로 내요. 실리태번 자신의 지우기 모드는 편집부터 닫아요.
//   node tools/tests/quick-delete-editing.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx } = dom.installBrowser({ settings: { enabled: true, quick: { rangeDelete: true, mesDelete: true } } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
const toasts = [];
globalThis.toastr = { info: m => toasts.push(['info', m]), success: m => toasts.push(['success', m]), warning: m => toasts.push(['warning', m]), error: m => toasts.push(['error', m]), clear() {} };
globalThis.confirm = () => true;
delete ctx.Popup;

const chat = document.getElementById('chat');
const fill = n => { chat.replaceChildren(); ctx.chat = []; for (let i = 0; i < n; i++) { chat.append(dom.messageElement(i)); ctx.chat.push({ mes: `m${i}`, is_user: false }); } };
const edit = id => { const box = document.createElement('textarea'); box.setAttribute('class', 'edit_textarea'); chat.querySelector(`.mes[mesid="${id}"] .mes_block`).append(box); };
const deletes = [];
ctx.deleteMessage = async (id) => { deletes.push(id); ctx.chat.splice(id, 1); chat.querySelector(`.mes[mesid="${id}"]`)?.remove(); };

const M = await import(url('src/quick/mes-delete.js'));
const R = await import(url('src/quick/range-delete.js'));

await test('연필 옆 지우기: #5 를 고치는 중에 #3 을 지우려 하면 알리고 안 지워요', async () => {
    fill(6); edit(5); deletes.length = 0; toasts.length = 0;
    assert.equal(await M.deleteWithAsk(3), false);
    assert.deepEqual(deletes, []);
    assert.ok(toasts.some(([k, m]) => k === 'info' && /고치는 중/.test(m)));
});
await test('연필 옆 지우기: 고치는 메시지 자신 · 그 뒤 메시지는 예전처럼 지워요(실리태번이 편집 번호를 맞춰요)', async () => {
    fill(6); edit(2); deletes.length = 0;
    assert.equal(await M.deleteWithAsk(4), true);
    assert.equal(await M.deleteWithAsk(2), true);
    assert.deepEqual(deletes, [4, 2]);
});
await test('편집이 없으면 그대로', async () => {
    fill(3); deletes.length = 0;
    assert.equal(await M.deleteWithAsk(0), true);
    assert.deepEqual(deletes, [0]);
});
const click = el => el.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
await test('범위 지우기: 고르는 범위가 고치는 메시지보다 앞이면 알리고 안 지워요', async () => {
    R.syncRangeDelete(true);
    fill(6); edit(5); deletes.length = 0; toasts.length = 0;
    R._forTest.enter();
    click(chat.querySelector('[mesid="1"]')); click(chat.querySelector('[mesid="3"]'));
    await R._forTest.confirmDelete();
    assert.deepEqual(deletes, []);
    assert.ok(toasts.some(([k, m]) => k === 'info' && /고치는 중/.test(m)));
});
await test('범위 지우기: 고치는 메시지가 범위 안이면 예전처럼 지워요', async () => {
    fill(6); edit(2); deletes.length = 0;
    R._forTest.enter();
    click(chat.querySelector('[mesid="1"]')); click(chat.querySelector('[mesid="3"]'));
    await R._forTest.confirmDelete();
    assert.deepEqual(deletes, [3, 2, 1]);
    R.syncRangeDelete(false);
});
console.log(`quick-delete-editing: ${passed} 통과`);
