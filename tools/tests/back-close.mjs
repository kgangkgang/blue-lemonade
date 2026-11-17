// 1.6.9 뒤로 가기로 테마 창 닫기(src/back-close.js · 공용 창 겹 쌓기 src/layer-back.js)
//   ① 테마 창(모달 dialog)이 뜨면 겹 하나 · 뒤로 가기 = 맨 위 창 하나만 닫기 · 다 닫힌 뒤 뒤로 가기는 원래대로(페이지 쪽)
//   ② 실리태번 팝업 꼴(취소 사건을 막고 스스로 [closing]) · 막는 창(취소를 막고 안 닫음 = 겹 남음)
//   ③ ✕ · Esc · 바깥으로 닫힘(close 사건 · 문서에서 빠짐 · toggle closed) → 기록 한 칸을 스스로 물려 남는 칸 없음
//   ④ 미트볼 창(dialog.ss-dlg) · 모달 아닌 창 · 설정 끔은 겹 안 올림 ⑤ 대화상자 아닌 겹(backLayer) ⑥ 새로 고침 뒤 남은 칸 치우기
//   ⑦ 연결(showThemeModal · 시작 표 · 설정 · 표식 · 패널 · 검색 · 겹 올리는 모듈들)
//   node tools/tests/back-close.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const LB = await import(pathToFileURL(path.join(root, 'src/layer-back.js')).href);
const fresh = () => import(pathToFileURL(path.join(root, 'src/back-close.js')).href + `?t=${Math.random()}`);

// ── 가짜 기록(tools/tests/layer-back.mjs 와 같은 꼴) ───────────────────────────
const fakeWin = (entries = [{ before: 1 }, { app: 1 }], at = entries.length - 1) => {
    const w = { entries: entries.slice(), at, left: 0, moves: [], listeners: [], queue: Promise.resolve() };
    w.history = {
        get state() { return w.entries[w.at]; },
        pushState(state) { w.entries.length = w.at + 1; w.entries.push(state); w.at++; },
        go(d) { w.moves.push(d); w.queue = w.queue.then(() => { const to = w.at + d; if (to < 0) { w.left++; return; } if (to >= w.entries.length) return; w.at = to; for (const fn of w.listeners) fn({ state: w.entries[w.at] }); }); },
        back() { this.go(-1); },
    };
    w.addEventListener = (type, fn) => { if (type === 'popstate') w.listeners.push(fn); };
    w.idle = async () => { for (let i = 0; i < 8; i++) { await w.queue; await new Promise(r => setTimeout(r, 0)); } };
    return w;
};
const depth = w => w.entries[w.at]?.[LB.DEPTH_KEY] || 0;

// ── 가짜 문서: body 직속 창 · toggle 사건 · 감시 ─────────────────────────────
const makeDoc = (attrs = {}) => {
    const doc = { dialogs: [], watchers: [], toggles: [] };
    doc.body = { getAttribute: k => attrs[k] ?? null, attrs };
    doc.querySelectorAll = sel => (sel === 'dialog[open]' ? doc.dialogs.filter(d => d.open) : []);
    doc.addEventListener = (type, fn, capture) => { assert.equal(type, 'toggle'); assert.equal(capture, true); doc.toggles.push(fn); };
    doc.watch = (el, spec, fn) => { assert.equal(el, doc.body); assert.deepEqual(Object.keys(spec).sort(), ['childList', 'name']); doc.watchers.push(fn); };
    doc.fire = recs => { for (const fn of doc.watchers) fn(recs); };
    return doc;
};
/** 가짜 dialog: kind = theme(취소 → close) · st(실리태번 팝업: 취소를 막고 [closing] 뒤 문서에서 빠짐) · block(취소를 막고 그대로) */
const dialog = (doc, { kind = 'theme', modal = true, mb = false, name = '' } = {}) => {
    const d = { nodeType: 1, tagName: 'DIALOG', name, open: false, isConnected: false, attrs: new Set(), listeners: {}, cancels: 0 };
    d.matches = sel => (sel === ':modal' ? modal && d.open : sel === 'dialog.ss-dlg' ? mb : false);
    d.hasAttribute = k => d.attrs.has(k);
    d.addEventListener = (type, fn, opt) => { (d.listeners[type] ||= []).push({ fn, once: !!opt?.once }); };
    d.emit = type => { const list = d.listeners[type] || []; d.listeners[type] = list.filter(l => !l.once); for (const l of list) l.fn({ target: d }); };
    d.dispatchEvent = ev => {
        assert.equal(ev.type, 'cancel'); assert.equal(ev.cancelable, true); d.cancels++;
        if (kind === 'st') { ev.preventDefault(); d.attrs.add('closing'); queueMicrotask(() => { d.close(); doc.remove(d); }); }
        if (kind === 'block') ev.preventDefault();
        return !ev.defaultPrevented;
    };
    d.close = () => { if (!d.open) return; d.open = false; d.attrs.delete('closing'); queueMicrotask(() => d.emit('close')); };
    return d;
};
const show = (doc, d, how = 'body') => {
    if (!doc.dialogs.includes(d)) doc.dialogs.push(d);
    d.isConnected = true; d.open = true;
    if (how === 'body') doc.fire([{ addedNodes: [d], removedNodes: [] }]);
    if (how === 'toggle') for (const fn of doc.toggles) fn({ target: d, newState: 'open' });
};
const withRemove = doc => { doc.remove = d => { const i = doc.dialogs.indexOf(d); if (i >= 0) doc.dialogs.splice(i, 1); d.isConnected = false; d.open = false; doc.fire([{ addedNodes: [], removedNodes: [d] }]); }; return doc; };
const setup = async (attrs) => {
    const m = await fresh(); m.resetBackCloseForTest();
    const w = fakeWin(); const stack = LB.createLayers(w); const doc = withRemove(makeDoc(attrs));
    assert.equal(m.startBackClose(doc, { watch: doc.watch, stack }), true);
    assert.equal(m.startBackClose(doc, { watch: doc.watch, stack }), false);
    return { m, w, stack, doc };
};

await ok('① 테마 창 두 겹 → 뒤로 가기 한 번에 맨 위 하나만 · 다 닫힌 뒤 뒤로 가기는 페이지 쪽(원래 동작)', async () => {
    const { w, stack, doc } = await setup();
    const a = dialog(doc, { name: 'settings' }), b = dialog(doc, { name: 'help' });
    show(doc, a); show(doc, b);
    assert.equal(stack.size, 2); assert.equal(depth(w), 2);
    w.history.back(); await w.idle();
    assert.equal(b.open, false); assert.equal(a.open, true); assert.equal(stack.size, 1); assert.equal(depth(w), 1); assert.equal(w.left, 0);
    w.history.back(); await w.idle();
    assert.equal(a.open, false); assert.equal(stack.size, 0); assert.equal(depth(w), 0); assert.equal(w.at, 1); assert.equal(w.left, 0);
    assert.deepEqual(w.moves, [-1, -1]);                               // 테마가 스스로 더 움직인 것 없음
    w.history.back(); await w.idle(); assert.equal(w.at, 0);          // 창이 없으면 실리태번 쪽 원래 동작 그대로
});
await ok('② 실리태번 팝업 꼴(취소를 막고 스스로 닫힘)은 한 번에 닫히고 · 막는 창은 남고 기록 한 칸을 다시 채워요', async () => {
    const { w, stack, doc } = await setup();
    const st = dialog(doc, { kind: 'st' }); show(doc, st);
    w.history.back(); await w.idle();
    assert.equal(st.cancels, 1); assert.equal(st.isConnected, false); assert.equal(stack.size, 0); assert.equal(depth(w), 0); assert.deepEqual(w.moves, [-1]);
    const blk = dialog(doc, { kind: 'block' }); show(doc, blk);
    w.history.back(); await w.idle();
    assert.equal(blk.open, true); assert.equal(stack.size, 1); assert.equal(depth(w), 1); assert.equal(w.left, 0);   // 페이지를 떠나지 않아요
});
await ok('③ ✕ · Esc · 바깥으로 닫히면(toggle closed · 문서에서 빠짐 · showThemeModal 의 close 처리 · 소리 없이 닫힘) 기록 한 칸을 스스로 물려요 — 남는 칸 없음', async () => {
    const { m, w, stack, doc } = await setup();
    const a = dialog(doc), b = dialog(doc), c = dialog(doc), d = dialog(doc);
    show(doc, a); show(doc, b, 'toggle'); show(doc, c);
    d.isConnected = true; d.open = true; const dropD = m.trackDialog(d);                          // showThemeModal 길(body 밖 · 다시 쓰는 창)
    assert.equal(typeof dropD, 'function'); assert.equal(m.trackDialog(d), null);                     // 같은 창은 한 겹
    assert.equal(stack.size, 4); assert.equal(depth(w), 4);
    d.close(); dropD(); dropD(); await w.idle(); assert.equal(stack.size, 3); assert.equal(depth(w), 3);   // showThemeModal 의 close 처리
    for (const fn of doc.toggles) fn({ target: c, newState: 'closed' }); await w.idle(); assert.equal(stack.size, 2);   // toggle closed(Esc · ✕)
    b.close(); doc.fire([{ addedNodes: [], removedNodes: [] }]); await w.idle(); assert.equal(stack.size, 1);          // 소리 없이 닫힌 창 — 다음 body 변화에서 치움
    doc.remove(a); await w.idle();                                                                     // 문서에서 바로 뗌
    assert.equal(stack.size, 0); assert.equal(depth(w), 0); assert.equal(w.at, 1); assert.equal(w.left, 0);
    const again = dialog(doc); show(doc, again, 'toggle'); show(doc, again);                          // 같은 창 알림이 여러 길로 와도 한 겹
    assert.equal(stack.size, 1); assert.equal(depth(w), 1);
    for (const x of [a, b, c, d]) assert.equal(Object.values(x.listeners).flat().length, 0, '창에 리스너를 달지 않아요');
});
await ok('④ 미트볼 창(mb-back 몫) · 모달 아닌 창 · 이미 닫힌 창 · 설정 끔은 겹을 안 올려요', async () => {
    const { stack, doc } = await setup();
    show(doc, dialog(doc, { mb: true })); show(doc, dialog(doc, { modal: false }));
    const late = dialog(doc); doc.dialogs.push(late); late.isConnected = true; doc.fire([{ addedNodes: [late], removedNodes: [] }]);   // 붙었지만 아직 안 열림
    assert.equal(stack.size, 0);
    const off = await setup({ 'data-bl-back-close': 'off' });
    show(off.doc, dialog(off.doc)); assert.equal(off.stack.size, 0);
    assert.equal(typeof off.m.backLayer(() => {}, off.doc, off.stack), 'function'); assert.equal(off.stack.size, 0);
});
await ok('⑤ 대화상자 아닌 겹(backLayer): 뒤로 가기 = 그 겹의 닫기 · 다른 길로 닫히면 done() 으로 칸 정리 · 창 위의 목록 팝업이 먼저', async () => {
    const { m, w, stack, doc } = await setup();
    const dlg = dialog(doc); show(doc, dlg);
    let closed = 0; let done = null;
    done = m.backLayer(() => { closed++; done(); }, doc, stack);       // 모듈의 닫기 함수가 스스로 done 을 불러도 한 번
    assert.equal(stack.size, 2); assert.equal(depth(w), 2);
    w.history.back(); await w.idle();
    assert.equal(closed, 1); assert.equal(dlg.open, true); assert.equal(stack.size, 1); assert.equal(depth(w), 1);
    const d2 = m.backLayer(() => {}, doc, stack); d2(); d2(); await w.idle();
    assert.equal(stack.size, 1); assert.equal(depth(w), 1); assert.equal(w.left, 0);
});
await ok('⑥ 새로 고침 뒤 깊이만 남은 칸에 서 있으면 시작할 때 스스로 물러나요 · 이미 떠 있던 창은 올려요', async () => {
    const m = await fresh(); m.resetBackCloseForTest();
    const w = fakeWin([{ app: 1 }, { app: 1, [LB.DEPTH_KEY]: 1 }, { app: 1, [LB.DEPTH_KEY]: 2 }]);
    const stack = LB.createLayers(w); const doc = withRemove(makeDoc());
    m.startBackClose(doc, { watch: doc.watch, stack }); await w.idle();
    assert.equal(w.at, 0); assert.equal(w.left, 0);
    m.resetBackCloseForTest();
    const w2 = fakeWin(); const s2 = LB.createLayers(w2); const doc2 = withRemove(makeDoc());
    const pre = dialog(doc2); doc2.dialogs.push(pre); pre.isConnected = true; pre.open = true;
    m.startBackClose(doc2, { watch: doc2.watch, stack: s2 }); assert.equal(s2.size, 1);
});
await ok('⑦ 연결: showThemeModal · 시작 표 · 설정(기본 켬) · 표식 · 패널 · 검색 · 이름표 · 스타일 밖 · 미리보기 목록 · 겹 올리는 모듈 · 시험 등록', async () => {
    assert.ok(read('src/modal.js').includes("import('./back-close.js').then(m => { if (dialog.open) backDrop = m.trackDialog(dialog); })") && read('src/modal.js').includes('backDrop?.(); backDrop = null;'));
    assert.ok(read('index.js').includes("['startBackClose', () => import('./src/back-close.js'), m => { m.startBackClose(); }]"));
    assert.ok(read('src/settings.js').includes('s.chat.backClose = flag(s.chat.backClose, true);'));
    assert.ok(read('src/apply.js').includes("s.chat.backClose !== false ? 'on' : 'off'") && read('src/apply.js').includes("setAttribute('data-bl-back-close', on)"));
    assert.ok(read('src/panel.js').includes("toggle('chat.backClose', s.chat.backClose !== false)"));
    assert.ok(read('src/settings-labels.js').includes('"chat.backClose":"뒤로 가기로 창 닫기"') && read('src/settings-search.js').includes("'chat.backClose']"));
    for (const f of ['src/settings.js', 'src/styles.js']) assert.ok(read(f).includes("'mbBack', 'backClose',"), f);
    assert.ok(read('tools/tests/preview-coverage.mjs').includes("['chat.backClose', NONE,"));
    for (const f of ['src/selects.js', 'src/colorpick.js', 'src/qrfind.js', 'src/addons/translator/remote.js', 'src/mes-fold.js', 'src/weather.js', 'src/chat-organizer.js', 'src/quick/shared.js', 'src/addons/bookmarks/panel.js']) assert.ok(/backLayer\(/.test(read(f)), `${f} 가 겹을 올려요`);
    assert.ok(!/new MutationObserver|setInterval|setTimeout/.test(read('src/back-close.js')));
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/back-close.mjs .'));
});
console.log(`back-close: ${n}개 통과`);
