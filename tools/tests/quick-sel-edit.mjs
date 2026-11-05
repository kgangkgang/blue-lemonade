// 1.0.3 고른 글 고치기 (src/quick/sel-edit-core.js · src/quick/sel-edit.js)
//   · 자리 찾기: 하나뿐 · 여럿이면 화면 차례와 앞뒤 글 · 꾸밈 표시 건너뜀 · 원래 글에 없는 글 · 화면과 개수가 다르면 거절
//   · 바꾸기 · 앞뒤 글 · 이유 글 · 기본 꺼짐 · 켤 때만 받음(features.js) · 설정 창 · 찾기 · 이름표
//   · 가짜 브라우저: 고친 뒤 글 · 스와이프 · 편집 차례(MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 저장) · 번역 메시지 거절 · 그사이 바뀌면 거절 · 취소는 그대로
//   node tools/tests/quick-sel-edit.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/quick/sel-edit-core.js'));

await test('하나뿐인 글: 그 자리 (꾸밈 표시 안 글도)', () => {
    const raw = '그녀가 *조용히* 말했다. "안녕하세요."';
    const screen = '그녀가 조용히 말했다. "안녕하세요."';
    const at = screen.indexOf('조용히');
    const r = core.locateEdit(raw, '조용히', screen, at);
    assert.ok(r.span);
    assert.equal(raw.slice(r.span.start, r.span.end), '조용히');
    assert.equal(core.replaceSpan(raw, r.span, '나직이'), '그녀가 *나직이* 말했다. "안녕하세요."');
});

await test('여러 번 나오는 글: 화면 차례 · 앞뒤 글로 두 번째를 고름', () => {
    const raw = '사과를 먹었다.\n\n오후에 또 사과를 먹었다.';
    const screen = '사과를 먹었다.\n오후에 또 사과를 먹었다.';
    const at = screen.lastIndexOf('사과');
    const r = core.locateEdit(raw, '사과', screen, at);
    assert.ok(r.span, JSON.stringify(r));
    assert.equal(r.span.start, raw.lastIndexOf('사과'));
    assert.equal(core.replaceSpan(raw, r.span, '배'), '사과를 먹었다.\n\n오후에 또 배를 먹었다.');
});

await test('원래 글에 없는 글(정규식이 화면에만 보이는 글)은 거절', () => {
    const raw = '본문만 있어요.';
    const screen = '[상태] 체력 100\n본문만 있어요.';
    assert.equal(core.locateEdit(raw, '체력 100', screen, screen.indexOf('체력')).reason, 'missing');
});

await test('화면과 원래 글의 개수가 다르면 거절(엉뚱한 자리 안 고침)', () => {
    const raw = '고양이와 고양이.';
    const screen = '고양이와 고양이. 고양이';
    assert.equal(core.locateEdit(raw, '고양이', screen, 0).reason, 'count');
});

await test('빈 고른 글 · 너무 긴 글 · 글 밖 자리', () => {
    assert.equal(core.locateEdit('abc', '   ', 'abc', 0).reason, 'empty');
    const long = 'ㄱ'.repeat(core.EDIT_LIMIT + 1);
    assert.equal(core.locateEdit(long, long, long, 0).reason, 'long');
    assert.equal(core.replaceSpan('abc', { start: 2, end: 9 }, 'x'), null);
    assert.equal(core.replaceSpan('abc', { start: 1, end: 1 }, 'x'), null);
});

await test('앞뒤 글은 한 줄 안에서만 (줄 넘으면 끊음 · 길면 …)', () => {
    const raw = '첫 줄\n가나다라마바사아자차카타파하 고칠글 하파타카차자아사바마라다나가\n끝 줄';
    const start = raw.indexOf('고칠글');
    const c = core.spanContext(raw, { start, end: start + 3 }, 5);
    assert.equal(c.before, '…카타파하 ');
    assert.equal(c.after, ' 하파타카…');
    const c2 = core.spanContext(raw, { start, end: start + 3 }, 200);
    assert.ok(!c2.before.includes('첫 줄') && !c2.after.includes('끝 줄'));
});

await test('이유마다 알림 글이 있음', () => {
    for (const k of ['empty', 'long', 'missing', 'count', 'ambiguous', 'changed', 'translated']) assert.ok(core.EDIT_REASONS[k], k);
});

await test('기본 꺼짐 · 켤 때만 받음 · 설정 창 · 찾기 · 이름표 · 제로 · 변경한 설정 길', () => {
    assert.match(read('src/settings.js'), /quick: \{ selEdit: false/);
    const f = read('src/features.js');
    assert.match(f, /q\.selEdit === true/);
    assert.match(f, /load\('seledit', '\.\/quick\/sel-edit\.js'\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.selEdit', s\.quick\?\.selEdit === true\)/);
    assert.match(read('src/settings-search.js'), /'quick\.selEdit'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.selEdit':'고른 글 고치기'/);
    assert.match(read('src/zero-panel.js'), /'quick'/);
    // 모듈은 시작 그래프에 없음: 정적 import 하는 곳이 없어요
    for (const file of ['index.js', 'src/apply.js', 'src/settings.js', 'src/panel.js']) assert.doesNotMatch(read(file), /from '\.\/(src\/)?quick\/sel-edit/, file);
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, quick: { selEdit: true } };
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
const mod = await import(url('src/quick/sel-edit.js'));
mod.syncSelectionEdit(true);

const answer = async (value) => {
    for (let i = 0; i < 20 && !document.querySelector('dialog.bl-qe-dialog'); i++) await new Promise(r => setImmediate(r));
    const dialog = document.querySelector('dialog.bl-qe-dialog');
    assert.ok(dialog, '창이 떠요');
    if (value === null) { dialog.querySelector('[data-card-clear]').click(); return; }
    dialog.querySelector('textarea').value = value;
    dialog.querySelector('[data-card-done]').click();
};

await test('고치기: 그 자리만 바뀌고 스와이프 · 편집 차례 · 저장', async () => {
    const raw = '그녀가 *조용히* 말했다.';
    ctx.chat = [{ mes: raw, swipes: [raw, '다른 답'], swipe_id: 0, extra: {} }];
    order.length = 0;
    const screen = '그녀가 조용히 말했다.';
    const job = mod._forTest.run({ captured: { index: 0, raw, selected: '조용히', screen, at: screen.indexOf('조용히') } });
    await answer('나직이');
    await job;
    assert.equal(ctx.chat[0].mes, '그녀가 *나직이* 말했다.');
    assert.equal(ctx.chat[0].swipes[0], '그녀가 *나직이* 말했다.');
    assert.equal(ctx.chat[0].swipes[1], '다른 답');
    assert.deepEqual(order, [['MESSAGE_EDITED', 0], ['render', 0], ['MESSAGE_UPDATED', 0], ['save']]);
    assert.equal(ctx.chatMetadata.tainted, true);
    assert.ok(!document.querySelector('dialog.bl-qe-dialog'), '창은 닫히면 지워져요');
});

await test('취소 · 그대로 저장은 아무것도 안 바꿈', async () => {
    const raw = '하나 둘 셋';
    ctx.chat = [{ mes: raw, extra: {} }];
    order.length = 0;
    let job = mod._forTest.run({ captured: { index: 0, raw, selected: '둘', screen: raw, at: 3 } });
    await answer(null); await job;
    job = mod._forTest.run({ captured: { index: 0, raw, selected: '둘', screen: raw, at: 3 } });
    await answer('둘'); await job;
    assert.equal(ctx.chat[0].mes, raw);
    assert.deepEqual(order, []);
});

await test('번역문이 있는 메시지 · 그사이 바뀐 메시지는 고치지 않음 · 도구도 안 뜸', async () => {
    ctx.chat = [{ mes: 'original', extra: { display_text: '번역문' } }];
    assert.equal(mod._forTest.accepts({ single: true, index: 0, root: document.createElement('div') }), false);
    toasts.length = 0;
    await mod._forTest.run({ captured: { index: 0, raw: 'original', selected: 'orig', screen: 'original', at: 0 } });
    assert.equal(ctx.chat[0].mes, 'original');
    assert.ok(toasts.some(([kind]) => kind === 'info'));
    ctx.chat = [{ mes: '새 글', extra: {} }];
    toasts.length = 0;
    await mod._forTest.run({ captured: { index: 0, raw: '옛 글', selected: '옛', screen: '옛 글', at: 0 } });
    assert.equal(ctx.chat[0].mes, '새 글');
    assert.ok(toasts.some(([kind]) => kind === 'warning'));
    ctx.chat = [{ mes: '보통 글', extra: {} }];
    assert.equal(mod._forTest.accepts({ single: true, index: 0, root: document.createElement('div') }), true);
    assert.equal(mod._forTest.accepts({ single: false, index: null, root: document.createElement('div') }), false, '여러 메시지에 걸친 선택은 아님');
});

await test('끄면 도구가 쉼(받은 모듈은 그대로 · 리스너 더하지 않음)', () => {
    const before = dom.listenerCounts(eventSource);
    mod.syncSelectionEdit(false);
    assert.equal(mod._forTest.accepts({ single: true, index: 0, root: document.createElement('div') }), false);
    assert.deepEqual(dom.listenerCounts(eventSource).eventSource, before.eventSource);
});

console.log(`quick-sel-edit: ${passed}개 통과`);
