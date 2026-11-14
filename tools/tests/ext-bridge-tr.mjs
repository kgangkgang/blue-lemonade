// 1.4.x 미트볼 「화면만 번역」 빈틈 메우기(src/ext-bridge-tr.js) — 가짜 확장(사전 하나 · 번역기 하나)으로 돌려 봐요. 원작 코드는 싣지 않아요.
//   node tools/tests/ext-bridge-tr.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   ① 영어 덩이 고르기(그림 글자 · 한국어 머리 · +2 · … 빼기) ② 칩 · 기록 · 알림 글 모으기 · 사전에 있는 것 · 못 바꾼 것 빼기
//   ③ 40자 넘는 덩이는 글 통째 짝도 ④ .custom-ss-slot 안 기록만 골라 그 메시지 칩을 번역(메시지 꾸미기가 그리기 전에 불러요)
//   ⑤ 단추를 누른 뒤 사전이 늘고 잠잠해지면 한 번 메움 · 취소면 안 함 · 남은 글이 없다고 끝나도 메움 ⑥ 자동은 그 확장 자동 번역이 켜진 때만
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const dom = new JSDOM('<!doctype html><html><body><div id="chat"><div class="mes" mesid="1"><div class="mes_text"><p>story</p><div class="custom-ss-slot"></div></div></div></div></body></html>');
const { window } = dom;
for (const k of ['MutationObserver', 'Node', 'NodeFilter']) globalThis[k] = window[k];
const T = await import(pathToFileURL(path.join(root, 'src/ext-bridge-tr.js')).href);

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const tick = () => new Promise(r => setTimeout(r, 0));

await test('① 영어 덩이: 그림 글자 · 한국어 머리 · 부호 · 수 · 말줄임 빼기, 붙은 숫자 · 괄호는 같이', () => {
    assert.equal(T.englishPart('+Honey Lemon Drop'), 'Honey Lemon Drop');
    assert.equal(T.englishPart('📍 3F Hall (North Express Lift)'), '3F Hall (North Express Lift)');
    assert.equal(T.englishPart("+Ann's Blue Ledger ×2"), "Ann's Blue Ledger");
    assert.equal(T.englishPart('📜 Lost Cat: 진행 중'), 'Lost Cat');
    assert.equal(T.englishPart('📰 A very long headline that got cu…'), 'A very long headline that got cu');
    assert.equal(T.englishPart('♥ 노라 +1'), '');
    assert.equal(T.skipPart('HP'), true); assert.equal(T.skipPart('@lucy_d'), true); assert.equal(T.skipPart('Plum Tea'), false);
});

await test('② 모으기: 칩 · 최근 기록 · 알림 · 사전에 있음 · 못 바꾼 것 · 화면에서 이미 한국어', () => {
    const current = { snaps: new Map([[1, { labels: ['+Honey Lemon Drop', '♥ Nora +1', '📍 Roof Garden'] }], [3, { labels: ['+Honey Lemon Drop', 'HP -3'] }]]), state: { recent: ['🗑 Old Lantern'] } };
    const meta = { notes: [{ title: 'Event Card', text: 'Pay 5000 to the bank.', hint: '' }, null] };
    const texts = T.visibleTexts(current, meta);
    assert.deepEqual(texts, ['+Honey Lemon Drop', '♥ Nora +1', '📍 Roof Garden', '+Honey Lemon Drop', 'HP -3', '🗑 Old Lantern', 'Event Card', 'Pay 5000 to the bank.', '']);
    const dict = { Nora: '노라', 'Event Card': '사건 카드' };
    const shown = t => t.replace('Nora', '노라');
    const { list, owners } = T.collectGaps(texts, { shown, has: p => Object.hasOwn(dict, p), tried: new Set(['Old Lantern']) });
    assert.deepEqual(list, ['Honey Lemon Drop', 'Roof Garden', 'Pay 5000 to the bank.']);
    assert.equal(owners.get('Honey Lemon Drop').length, 2);
    // 아는 이름이 든 덩이는 원래 글에서 통째로(화면 글 「카이's Blue …」에서 자르지 않음)
    const two = T.collectGaps(["−Kai's Blue Ledger"], { shown: t => t.replace('Kai', '카이') });
    assert.deepEqual(two.list, ["Kai's Blue Ledger"]);
});

await test('③ 짝: 덩이 하나 · 40자 넘으면 원래 글 통째 · 영어 그대로면 없음', () => {
    const long = 'Carried three crates to the night market stall';
    const owners = new Map([[long, [`📋 ${long}`]], ['Plum Tea', ['+Plum Tea']]]);
    assert.deepEqual(T.pairsFor('Plum Tea', '매실차', owners), [['Plum Tea', '매실차']]);
    assert.deepEqual(T.pairsFor(long, '상자 셋을 밤 시장 노점에 나름', owners), [[long, '상자 셋을 밤 시장 노점에 나름'], [`📋 ${long}`, '📋 상자 셋을 밤 시장 노점에 나름']]);
    assert.deepEqual(T.pairsFor('Plum Tea', 'Plum Tea', owners), []);
    assert.deepEqual(T.pairsFor('Plum Tea', '', owners), []);
});

// 가짜 확장: 사전 하나(채팅 메타 tr) · 화면 번역(글자 노드 바꾸기) · 번역기(ko 표)
function fakeTarget({ view = true, auto = 'st', engine = 'llm', ko = {} } = {}) {
    const meta = { tr: { Nora: '노라' }, notes: [] };
    const calls = { view: 0, json: [] };
    const sub = t => { let out = t; for (const [en, k] of Object.entries(meta.tr).sort((a, b) => b[0].length - a[0].length)) out = out.split(en).join(k); return out; };
    const app = { current: { state: { recent: [] }, snaps: new Map([[1, { labels: ['+Honey Lemon Drop', '♥ Nora +1'] }]]) } };
    const tr = {
        translateView(rootEl = window.document.body) { calls.view++; const w = window.document.createTreeWalker(rootEl, window.NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode); for (const n of nodes) { const v = sub(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } },
        trString: sub,
        async trJSON(src) { calls.json.push(src.list); return { list: src.list.map(s => ko[s] ?? s) }; },
        addPairs(pairs) { for (const [a, b] of pairs) meta.tr[a] = b; return pairs.length; },
        pairsOf() { return []; },
        missingTr: () => [],
    };
    const core = { app, getMeta: () => meta, viewTr: () => view, settings: () => ({ trAuto: auto, trEngine: engine }) };
    return { mb: { tr, core, busy: () => false }, meta, calls, app };
}
function fakeTimers() {
    let t = 0; const q = [];
    return { now: () => t, timers: { setTimeout(fn, ms) { q.push([t + ms, fn]); return q.length; }, clearTimeout() {} }, async run(ms) { const end = t + ms; for (;;) { q.sort((a, b) => a[0] - b[0]); const next = q[0]; if (!next || next[0] > end) break; q.shift(); t = next[0]; next[1](); await tick(); } t = end; } };
}

await test('④ 칩 다시 적기: 원래 칩 글 → 사전 · 반쯤 바뀐 글도 바로잡음 · 칩 자리 기록만 · 본문 안 건드림 · 화면만 번역이 아니면 안 함', async () => {
    const { mb, meta } = fakeTarget();
    const fill = T.createTrFill(mb, { doc: window.document });
    const mes = window.document.querySelector('.mes'), slot = mes.querySelector('.custom-ss-slot'), body = mes.querySelector('.mes_text p');
    slot.innerHTML = '<div class="ss-msgcard ss-scope"><span class="ss-mchip">+Honey 급행 Drop</span><span class="ss-mchip">♥ Nora +1</span><button class="ss-mchip roll">x</button></div>';
    body.textContent = 'Nora walks';
    assert.equal(fill.slotRecord({ target: slot, addedNodes: [slot.firstChild] }), true);
    assert.equal(fill.slotRecord({ target: Object.assign(window.document.createElement('div'), { className: 'ss-slot' }), addedNodes: [slot.firstChild] }), true);
    assert.equal(fill.slotRecord({ target: body, addedNodes: [body.firstChild] }), false);
    assert.equal(fill.slotRecord({ target: slot, addedNodes: [] }), false);
    meta.tr['Honey Lemon Drop'] = '꿀레몬 사탕';
    fill.paint([mes]);
    assert.deepEqual([...slot.querySelectorAll('span.ss-mchip')].map(e => e.textContent), ['+꿀레몬 사탕', '♥ 노라 +1']);
    assert.equal(body.textContent, 'Nora walks');
    const off = fakeTarget({ view: false });
    slot.innerHTML = '<div class="ss-msgcard ss-scope"><span class="ss-mchip">♥ Nora +1</span></div>';
    T.createTrFill(off.mb, { doc: window.document }).paint([mes]);
    assert.equal(off.calls.view, 0);
    assert.equal(slot.textContent, '♥ Nora +1');
    // 칩 수가 칩 글 수와 다르면 그 확장 화면 번역만
    const { mb: mb2, calls } = fakeTarget();
    T.createTrFill(mb2, { doc: window.document }).paint([mes]);
    assert.equal(calls.view, 1);
    assert.equal(slot.textContent, '♥ 노라 +1');
});

await test('⑤ 누른 뒤: 사전이 늘고 잠잠해지면 칩 덩이를 한 번 메우고 같은 사전에 넣음', async () => {
    const f = fakeTarget({ ko: { 'Honey Lemon Drop': '꿀레몬 사탕' } });
    const tm = fakeTimers(); const toasts = [];
    const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: { success: m => toasts.push(m) } });
    f.mb.tr.missingTr = () => ['Office'];
    fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
    window.document.body.append(Object.assign(window.document.createElement('div'), { id: 'x' }));
    await tm.run(1500);
    f.meta.tr.Office = '사무실';   // 그 확장이 남은 글을 번역함
    await tm.run(6000);
    assert.deepEqual(f.calls.json, [['Honey Lemon Drop']]);
    assert.equal(f.meta.tr['Honey Lemon Drop'], '꿀레몬 사탕');
    assert.equal(toasts.length, 1);
    assert.equal(fill.watching, false);
    await fill.fill('click');   // 이미 사전에 있으면 다시 안 보냄
    assert.equal(f.calls.json.length, 1);
});

await test('⑤-2 취소(사람이 누름)면 안 메움 · 남은 글이 없다고 끝나면 메움 · 영어 그대로면 이번 접속엔 다시 안 보냄', async () => {
    const f = fakeTarget();
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: null });
    f.mb.tr.missingTr = () => ['Office'];
    const go = Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' });
    fill.onClick({ target: go, isTrusted: true });
    const dlg = window.document.createElement('dialog'); dlg.setAttribute('open', ''); dlg.innerHTML = '<button class="popup-button-ok"></button><button class="popup-button-cancel"></button>';
    window.document.body.append(dlg);
    fill.onClick({ target: dlg.querySelector('.popup-button-cancel'), isTrusted: false });   // 프로그램 누름은 무시
    assert.equal(fill.watching, true);
    fill.onClick({ target: dlg.querySelector('.popup-button-cancel'), isTrusted: true });
    dlg.remove();
    await tm.run(9000);
    assert.equal(f.calls.json.length, 0);
    assert.equal(fill.watching, false);
    f.mb.tr.missingTr = () => [];
    fill.onClick({ target: go, isTrusted: true });
    await tm.run(9000);
    assert.deepEqual(f.calls.json, [['Honey Lemon Drop']]);   // 번역기가 영어 그대로 → 못 바꾼 것
    await fill.fill('click');
    assert.equal(f.calls.json.length, 1);
});

await test('⑥ 자동: 그 확장 자동 번역이 지금 번역 담당에 켜졌을 때만', () => {
    assert.equal(T.createTrFill(fakeTarget({ auto: 'st', engine: 'llm' }).mb).autoOn(), false);
    assert.equal(T.createTrFill(fakeTarget({ auto: 'st', engine: 'st' }).mb).autoOn(), true);
    assert.equal(T.createTrFill(fakeTarget({ auto: 'always', engine: 'llm' }).mb).autoOn(), true);
    assert.equal(T.createTrFill(fakeTarget({ auto: 'off', engine: 'st' }).mb).autoOn(), false);
});

await test('⑦ 1.5.0 버그 사냥: 번역을 기다리는 사이 채팅을 바꾸면 그 결과를 새 채팅 사전에 넣지 않아요', async () => {
    const f = fakeTarget({ ko: { 'Honey Lemon Drop': '꿀레몬 사탕' } });
    let chat = 'A';
    const added = [];
    const real = f.mb.tr.trJSON;
    f.mb.tr.trJSON = async src => { const out = await real(src); chat = 'B'; return out; };   // 번역하는 동안 다른 채팅으로
    f.mb.tr.addPairs = pairs => { added.push([chat, ...pairs]); return pairs.length; };
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => chat });
    const done = await fill.fill('click');
    assert.equal(done, 0);
    assert.deepEqual(added, [], JSON.stringify(added));
    chat = 'A';
    f.mb.tr.trJSON = real;
    assert.equal(await T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => chat }).fill('click'), 1, '그대로면 넣어요');
    assert.equal(added.length, 1);
});

console.log(`ext-bridge-tr: ${passed} 통과`);
