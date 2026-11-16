// 1.6.1 뒤로 가기로 미트볼 창 닫기(src/mb-back.js · 공용 창 겹 쌓기 src/layer-back.js)
//   ① 미트볼 창이 뜨면 겹 하나 · 문서에서 빠지면 겹을 내려요 ② 뒤로 가기 = 사람이 닫을 때와 같은 단추(취소가 보이면 취소 · 아니면 닫기)
//   ③ 위에 다른 창이 떠 있으면 그것부터 닫고 미트볼 창은 남겨요 ④ 「원작 그대로 보기」 · 테마 꺼짐 · 설정 끔이면 겹을 안 올려요 ⑤ 연결(설정 · 표식 · 미트볼 문)
//   node tools/tests/mb-back.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const fresh = () => import(pathToFileURL(path.join(root, 'src/mb-back.js')).href + `?t=${Math.random()}`);

// ── 작은 가짜 문서: body 직속 창 · 단추 누름 기록 ─────────────────────────────
const makeDoc = ({ salty = true, attrs = {} } = {}) => {
    const doc = { dialogs: [], watchers: [] };
    doc.body = { classList: { contains: c => c === 'salty' && salty }, attrs, hasAttribute: k => k in attrs, getAttribute: k => attrs[k] ?? null };
    doc.querySelectorAll = sel => (sel === 'dialog[open]' ? doc.dialogs.filter(d => d.open) : sel === 'dialog[open]:not([closing])' ? doc.dialogs.filter(d => d.open && !d.closing) : sel === 'dialog.ss-dlg[open]' ? doc.dialogs.filter(d => d.open && d.mb) : []);
    doc.watch = (rootEl, spec, fn) => { assert.equal(rootEl, doc.body); assert.deepEqual(Object.keys(spec).sort(), ['childList', 'name']); doc.watchers.push(fn); };
    doc.show = d => { if (!doc.dialogs.includes(d)) doc.dialogs.push(d); d.isConnected = true; d.open = true; for (const fn of doc.watchers) fn([{ addedNodes: [d], removedNodes: [] }]); };
    doc.remove = d => { doc.dialogs.splice(doc.dialogs.indexOf(d), 1); d.isConnected = false; d.open = false; for (const fn of doc.watchers) fn([{ addedNodes: [], removedNodes: [d] }]); };
    return doc;
};
const dialog = (doc, { mb = true, cancel = false } = {}) => {
    const d = { nodeType: 1, mb, clicks: [], isConnected: false, open: false };
    const btn = name => ({ name, shown: name !== 'cancel' || cancel, click() { d.clicks.push(name); doc.remove(d); } });
    const parts = { '.popup-button-ok': btn('ok'), '.popup-button-cancel': btn('cancel'), '.popup-button-close': btn('close') };
    d.matches = sel => sel === 'dialog.ss-dlg' && mb;
    d.querySelector = sel => parts[sel] || null;
    return d;
};
const isShown = el => el.shown;
/** 가짜 겹 관리자: 올린 겹을 그대로 보여 줘요(기록 쪽은 tools/tests/layer-back.mjs 가 봐요) */
const fakeStack = () => { const s = { layers: [], started: 0 }; s.start = () => { s.started++; }; s.open = close => { const l = { close, done: false }; s.layers.push(l); return () => { l.done = true; }; }; s.live = () => s.layers.filter(l => !l.done); return s; };

await ok('① 미트볼 창이 뜨면 겹 하나 · 다른 창은 아님 · 문서에서 빠지면 겹을 내려요 · 이미 떠 있던 창도 올려요', async () => {
    const m = await fresh(); const doc = makeDoc(); const stack = fakeStack();
    const first = dialog(doc); doc.dialogs.push(first); first.isConnected = true; first.open = true;   // 모듈보다 먼저 떠 있던 창
    assert.equal(m.startMbBack(doc, { watch: doc.watch, stack, isShown }), true); assert.equal(m.startMbBack(doc, { watch: doc.watch, stack, isShown }), false);
    assert.equal(stack.started, 1); assert.equal(stack.live().length, 1); assert.equal(doc.watchers.length, 1);
    const other = dialog(doc, { mb: false }); doc.show(other); assert.equal(stack.live().length, 1);
    const second = dialog(doc); doc.show(second); doc.show(second); assert.equal(stack.live().length, 2);   // 같은 창은 한 번만
    doc.remove(second); assert.equal(stack.live().length, 1); doc.remove(first); assert.equal(stack.live().length, 0);
});
await ok('② 뒤로 가기: 「취소」 가 보이는 창은 취소 · 아니면 그 확장이 닫을 때 쓰는 확인 단추(「닫기」) — 창 안 다른 것은 안 건드려요', async () => {
    const m = await fresh(); const doc = makeDoc(); const stack = fakeStack(); m.startMbBack(doc, { watch: doc.watch, stack, isShown });
    const plain = dialog(doc), ask = dialog(doc, { cancel: true });
    doc.show(plain); doc.show(ask);
    assert.equal(stack.layers[1].close(), true); assert.deepEqual(ask.clicks, ['cancel']); assert.deepEqual(plain.clicks, []);
    assert.equal(stack.layers[0].close(), true); assert.deepEqual(plain.clicks, ['ok']);
    const bare = { querySelector: () => null }; assert.equal(m.closeDialog(bare, isShown), null); assert.equal(m.backOnce(doc, { isConnected: false }, isShown), true);
});
await ok('③ 미트볼 창 위에 다른 창(물음 · 테마 확인 창)이 떠 있으면 그것부터 닫고 미트볼 창은 남겨요 — 한 번에 한 겹', async () => {
    const m = await fresh(); const doc = makeDoc(); const stack = fakeStack(); m.startMbBack(doc, { watch: doc.watch, stack, isShown });
    const win = dialog(doc); doc.show(win);
    const confirm = dialog(doc, { mb: false, cancel: true }); doc.show(confirm);
    assert.equal(stack.layers[0].close(), false);                      // 겹은 남아요(공용 겹 쌓기가 기록 한 칸을 다시 채워요)
    assert.deepEqual(confirm.clicks, ['cancel']); assert.deepEqual(win.clicks, []); assert.equal(stack.live().length, 1);
    assert.equal(stack.layers[0].close(), true); assert.deepEqual(win.clicks, ['ok']);
});
await ok('③-2 위 창이 닫히는 애니메이션 중([closing] · open 그대로)이면 맨 위로 안 봐요 — 빠르게 두 번 누르면 두 번째는 미트볼 창을 닫아요', async () => {
    const m = await fresh(); const doc = makeDoc(); const stack = fakeStack(); m.startMbBack(doc, { watch: doc.watch, stack, isShown });
    const win = dialog(doc); doc.show(win);
    const confirm = dialog(doc, { mb: false, cancel: true }); doc.show(confirm);
    const cancel = confirm.querySelector('.popup-button-cancel'); cancel.click = () => { confirm.clicks.push('cancel'); confirm.closing = true; };   // 실리태번: 누르면 [closing] 만 달고 애니메이션이 끝난 뒤에 문서에서 빼요
    assert.equal(stack.layers[0].close(), false); assert.deepEqual(confirm.clicks, ['cancel']);
    assert.equal(stack.layers[0].close(), true);                       // 애니메이션이 아직 안 끝났어도 두 번째 뒤로 가기는 미트볼 창
    assert.deepEqual(confirm.clicks, ['cancel']); assert.deepEqual(win.clicks, ['ok']);
});
await ok('④ 「원작 그대로 보기」 · 테마 꺼짐 · 설정 끔이면 겹을 안 올려요 · 켜 둔 동안 올린 겹은 꺼도 창이 닫힐 때 내려요', async () => {
    for (const opt of [{ attrs: { 'data-bl-ext-raw': '' } }, { salty: false }, { attrs: { 'data-bl-mb-back': 'off' } }]) {
        const m = await fresh(); const doc = makeDoc(opt); const stack = fakeStack(); m.startMbBack(doc, { watch: doc.watch, stack, isShown });
        doc.show(dialog(doc)); assert.equal(stack.layers.length, 0);
    }
    const m = await fresh(); const attrs = { 'data-bl-mb-back': 'on' }; const doc = makeDoc({ attrs }); const stack = fakeStack(); m.startMbBack(doc, { watch: doc.watch, stack, isShown });
    const win = dialog(doc); doc.show(win); attrs['data-bl-mb-back'] = 'off';
    doc.show(dialog(doc)); assert.equal(stack.layers.length, 1);
    doc.remove(win); assert.equal(stack.live().length, 0);
});
await ok('⑤ 연결: 설정 「뒤로 가기로 미트볼 창 닫기」 기본 켬 · 표식 · 미트볼 문에서만 받음 · 감시자 · 타이머를 새로 만들지 않아요', () => {
    assert.ok(read('src/settings.js').includes('s.chat.mbBack = flag(s.chat.mbBack, true);'));
    assert.ok(read('src/apply.js').includes("s.chat.mbBack !== false ? 'on' : 'off'") && read('src/apply.js').includes("setAttribute('data-bl-mb-back', on)"));
    assert.ok(read('src/panel.js').includes("toggle('chat.mbBack', s.chat.mbBack !== false)"));
    assert.ok(read('src/settings-labels.js').includes('"chat.mbBack":"뒤로 가기로 미트볼 창 닫기"') && read('src/settings-search.js').includes("'chat.mbBack']"));
    for (const f of ['src/settings.js', 'src/styles.js']) assert.ok(read(f).includes("'mbHiddenSync', 'mbBack',"), f);
    const gate = read('index.js').split('\n').find(line => line.includes("import('./src/mb-back.js')"));
    assert.ok(gate && gate.indexOf("getElementById('ss-settings')") < gate.indexOf('mb-back.js'));
    for (const f of ['src/mb-back.js', 'src/layer-back.js']) assert.ok(!/new MutationObserver|setInterval|setTimeout|extension_settings|chat_metadata/.test(read(f)), f);
    assert.ok(!/^import /m.test(read('src/layer-back.js')));            // 공용 부품은 아무것도 안 끌어와요
    const yml = read('.github/workflows/release-check.yml'); assert.ok(yml.includes('node tools/tests/mb-back.mjs .') && yml.includes('node tools/tests/layer-back.mjs .'));
});
console.log(`mb-back: ${n}개 통과`);
