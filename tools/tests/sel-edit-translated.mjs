// 1.1.1 시제품 「번역문도 고치기」 (src/quick/sel-edit.js · quick.selEditTr, 기본 꺼짐)
//   · 꺼져 있으면 1.0.3 그대로: 번역문이 있는 메시지에서 단추가 안 뜨고 고치지 않음
//   · 켜면: 번역문(extra.display_text)이 있는 메시지도 받고, 담은 글은 번역문 · 고치면 번역문만 바뀌고 원문 · 스와이프는 그대로 · 사건(MESSAGE_EDITED · MESSAGE_UPDATED) 없이 그리기 · 저장
//   · 그사이 번역문이 바뀌면 거절 · 번역기 확장의 번역 칸(DOM)이 있는 메시지는 여전히 안 받음
//   · 기본 꺼짐 · 설정 창 · 찾기 · 이름표
//   node tools/tests/sel-edit-translated.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

await test('기본 꺼짐 · 설정 창 · 찾기 · 이름표', () => {
    assert.match(read('src/settings.js'), /selEditTr: false/);
    assert.match(read('src/panel.js'), /toggle\('quick\.selEditTr', s\.quick\?\.selEditTr === true\)/);
    assert.match(read('src/settings-search.js'), /'quick\.selEditTr'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.selEditTr':'번역문도 고치기'/);
    assert.doesNotMatch(read('src/quick/sel-edit.js'), /writeTranslation[\s\S]*?MESSAGE_(EDITED|UPDATED)[\s\S]*?\n}\s*\nasync function writeMessage/, '번역문 쓰기는 편집 사건을 쏘지 않아요');
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, quick: { selEdit: true, selEditTr: false } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
const toasts = [];
globalThis.toastr = { info: (m) => { toasts.push(['info', m]); return null; }, success: (m) => { toasts.push(['success', m]); return null; }, warning: (m) => { toasts.push(['warning', m]); return null; }, error: (m) => { toasts.push(['error', m]); return null; }, clear() {} };
document.body.classList.add('salty');
const order = [];
for (const t of ['MESSAGE_EDITED', 'MESSAGE_UPDATED']) eventSource.on(ctx.eventTypes[t], id => order.push([t, id]));
ctx.updateMessageBlock = id => order.push(['render', id]);
ctx.saveChat = async () => order.push(['save']);
const S = await import(url('src/settings.js'));
const mod = await import(url('src/quick/sel-edit.js'));
mod.syncSelectionEdit(true);

const answer = async (value) => {
    for (let i = 0; i < 20 && !document.querySelector('dialog.bl-qe-dialog'); i++) await new Promise(r => setImmediate(r));
    const dialog = document.querySelector('dialog.bl-qe-dialog');
    assert.ok(dialog, '창이 떠요');
    const title = dialog.querySelector('h3').textContent;
    if (value === null) { dialog.querySelector('[data-card-clear]').click(); return title; }
    dialog.querySelector('textarea').value = value;
    dialog.querySelector('[data-card-done]').click();
    return title;
};
const message = () => ({ mes: 'She said *quietly* "hello".', swipes: ['She said *quietly* "hello".'], swipe_id: 0, extra: { display_text: '그녀가 *조용히* 말했다. "안녕."' } });
const target = () => ({ single: true, index: 0, root: document.createElement('div') });

await test('꺼져 있으면 번역문 메시지는 안 받고, 담았더라도 안내만 (1.0.3 그대로)', async () => {
    ctx.chat = [message()];
    assert.equal(mod._forTest.accepts(target()), false);
    toasts.length = 0; order.length = 0;
    await mod._forTest.run({ captured: { index: 0, raw: ctx.chat[0].mes, selected: 'quietly', screen: 'She said quietly "hello".', at: 9 } });
    assert.ok(toasts.some(([kind]) => kind === 'info'));
    assert.deepEqual(order, []);
});

await test('켜면 번역문 메시지도 받고 담은 글은 번역문이에요 · 번역기 확장 칸이 있으면 여전히 안 받음', () => {
    settings.quick.selEditTr = true; S.invalidateSettings();
    ctx.chat = [message()];
    assert.equal(mod._forTest.accepts(target()), true);
    const root2 = document.createElement('div'); root2.innerHTML = '<div class="translated_text">x</div>';
    assert.equal(mod._forTest.accepts({ single: true, index: 0, root: root2 }), false);
    const textNode = document.createTextNode('그녀가 조용히 말했다. "안녕."');
    const host = document.createElement('div'); host.append(textNode);
    const range = { startContainer: textNode, startOffset: 4, toString: () => '조용히', intersectsNode: () => true };
    const cap = mod._forTest.capture({ single: true, index: 0, root: host, range });
    assert.equal(cap.tr, true);
    assert.equal(cap.raw, '그녀가 *조용히* 말했다. "안녕."');
    assert.equal(cap.selected, '조용히'); assert.equal(cap.at, 4);
});

await test('고치면 번역문만 바뀌고 원문 · 스와이프는 그대로 · 편집 사건 없이 그리기 → 저장 · 창 제목은 「번역문 고치기」', async () => {
    ctx.chat = [message()];
    const raw = ctx.chat[0].extra.display_text;
    order.length = 0; toasts.length = 0;
    const screen = '그녀가 조용히 말했다. "안녕."';
    const job = mod._forTest.run({ captured: { index: 0, raw, selected: '조용히', screen, at: screen.indexOf('조용히'), tr: true } });
    const title = await answer('나직이');
    await job;
    assert.equal(title, '번역문 고치기');
    assert.equal(ctx.chat[0].extra.display_text, '그녀가 *나직이* 말했다. "안녕."');
    assert.equal(ctx.chat[0].mes, 'She said *quietly* "hello".');
    assert.equal(ctx.chat[0].swipes[0], 'She said *quietly* "hello".');
    assert.deepEqual(order, [['render', 0], ['save']]);
    assert.ok(toasts.some(([kind, m]) => kind === 'success' && /번역문/.test(m)));
});

await test('그사이 번역문이 바뀌었으면 거절 · 취소는 그대로', async () => {
    ctx.chat = [message()];
    order.length = 0; toasts.length = 0;
    await mod._forTest.run({ captured: { index: 0, raw: '옛 번역', selected: '옛', screen: '옛 번역', at: 0, tr: true } });
    assert.ok(toasts.some(([kind]) => kind === 'warning'));
    const raw = ctx.chat[0].extra.display_text;
    const job = mod._forTest.run({ captured: { index: 0, raw, selected: '조용히', screen: '그녀가 조용히 말했다. "안녕."', at: 4, tr: true } });
    await answer(null); await job;
    assert.equal(ctx.chat[0].extra.display_text, raw);
    assert.deepEqual(order, []);
});

await test('원문 고치기(번역 없는 메시지)는 전과 같아요: 글 · 스와이프 · 편집 사건 차례', async () => {
    const raw = '그녀가 *조용히* 말했다.';
    ctx.chat = [{ mes: raw, swipes: [raw], swipe_id: 0, extra: {} }];
    order.length = 0;
    const screen = '그녀가 조용히 말했다.';
    const job = mod._forTest.run({ captured: { index: 0, raw, selected: '조용히', screen, at: screen.indexOf('조용히') } });
    const title = await answer('나직이');
    await job;
    assert.equal(title, '고른 글 고치기');
    assert.equal(ctx.chat[0].mes, '그녀가 *나직이* 말했다.');
    assert.deepEqual(order, [['MESSAGE_EDITED', 0], ['render', 0], ['MESSAGE_UPDATED', 0], ['save']]);
});

console.log(`sel-edit-translated: ${passed}개 통과`);
