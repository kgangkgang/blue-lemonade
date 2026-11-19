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
    // 버그 사냥 2: 악센트 글자로 시작 · 끝나는 이름 — ASCII 만 영어로 봐서 「mile's Caf」 · 「Zo」 를 떼어 보내 칩이 「📍 É에밀의 카페é」 가 됐어요
    assert.equal(T.englishPart("📍 Émile's Café"), "Émile's Café");
    assert.equal(T.englishPart('💞 Zoë'), 'Zoë');
    assert.equal(T.englishPart('🗺️ 새 장소: Ölberg Plaza'), 'Ölberg Plaza');
    assert.equal(T.englishPart('📍 Ñandú'), 'Ñandú');
    assert.equal(T.skipPart('Zoë'), false, '라틴 글자 셋');
    assert.equal(T.skipPart('É'), true, '한 글자는 그대로 건너뜀');
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

await test('⑤-2 취소(사람이 누름)면 안 메움 · 남은 글이 없다고 끝나면 메움 · 영어 그대로면 자동으로는 다시 안 보냄(누르면 한 번 더)', async () => {
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
    await fill.fill('auto');
    assert.equal(f.calls.json.length, 1, '자동으로는 이번 접속에 다시 안 보내요');
    await fill.fill('click');
    assert.equal(f.calls.json.length, 2, '1.7.8 사람이 다시 누르면 한 번 더 보내요');
});

await test('⑤-3 확인 창을 Esc 로 닫아도 취소 — 뒤에 사전이 늘어도(고정 낱말 짝) 메우지 않아요', async () => {
    const f = fakeTarget();
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: null });
    f.mb.tr.missingTr = () => ['Office'];
    const go = Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' });
    fill.onClick({ target: go, isTrusted: true });
    const dlg = window.document.createElement('dialog'); dlg.setAttribute('open', ''); dlg.innerHTML = '<button class="popup-button-ok"></button><button class="popup-button-cancel"></button>';
    window.document.body.append(dlg);
    fill.onKey({ key: 'Escape', isTrusted: false });   // 프로그램이 낸 키는 무시
    assert.equal(fill.watching, true);
    fill.onKey({ key: 'Escape', isTrusted: true });
    dlg.remove();
    await tm.run(3000);
    f.meta.tr = { ...(f.meta.tr || {}), Sunny: '맑음' };   // 다음 답 뒤 고정 낱말 짝 하나
    await tm.run(60000);
    assert.equal(f.calls.json.length, 0, '유료 메우기 0');
    assert.equal(fill.watching, false);
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

// ───── 1.5.1: 장르 한 줄 · 반쯤 번역 짝 · 이어진 글 조각 · 고정 낱말 (지어낸 글 · 사용자 채팅 글 아님) ─────
await test('⑧ 반쯤 번역 짝 알아보기: 원문 영어 낱말 셋 이상이 이어 남음 · 고유 이름 · 줄임말 · 단위는 아님', () => {
    assert.equal(T.halfValue('Robin is a archive staff member caught up in office chaos.', '로빈 is a archive staff member caught up in office chaos.'), true);
    assert.equal(T.halfValue('Robin is a staff member.', '로빈은 직원이다.'), false);
    assert.equal(T.halfValue('Works at Central Records Bureau daily', '매일 중앙 기록국(Central Records Bureau)에서 일함'), false);
    assert.equal(T.halfValue('185cm, short black hair', '185cm, 짧은 검은 머리'), false);
    assert.equal(T.latinWords('S.T.A.R 직원 · HP 30 · 185cm'), 0);
    assert.equal(T.stillEnglish('아침:청장실, Day:청장실'), true);
    assert.equal(T.stillEnglish('아침:청장실, 낮:청장실'), false);
    assert.equal(T.stillEnglish('Afterlife workplace sitcom'), true);
    assert.equal(T.stillEnglish('main', { soft: true }), false);
    assert.equal(T.stillEnglish('main'), false);
    assert.equal(T.stillEnglish('Courier'), true);
});

await test('⑨ 상태 칸 훑기: 코드 칸 · 꺼진 칸 빼고, 장르 같은 「코드로 보던 글 칸」도 모음', () => {
    const state = { core: { title: 'Harbor Archive', genre: 'Afterlife office sitcom', id: 'w_1' }, data: { profile: { mode: 'detailed', list: [{ name: 'Mira', role: 'main', avatar: 'x.png', sched: 'Morning:Lobby, Day:Desk' }] }, news: { list: [{ title: 'Off mod headline' }] } } };
    const texts = T.stateTexts(state, id => id !== 'news');
    assert.deepEqual(texts.map(x => `${x.key}=${x.text}`), ['title=Harbor Archive', 'genre=Afterlife office sitcom', 'mode=detailed', 'name=Mira', 'role=main', 'sched=Morning:Lobby, Day:Desk']);
});

await test('⑩ 조각 짝(AI 0): 같은 나눔표면 조각끼리 · 표가 다르면 안 함 · 이미 있는 조각 그대로 · 고정 낱말은 빈 것만', () => {
    const dict = { 'Morning:Front Desk, Day:Front Desk, Night:Dorm 2': '아침:안내 데스크, 낮:안내 데스크, 밤:기숙사 2동', Night: '밤', 'A long sentence, with a comma': '쉼표가 없는 번역' };
    const got = Object.fromEntries(T.piecePairs(dict));
    assert.deepEqual(got, { Morning: '아침', 'Front Desk': '안내 데스크', Day: '낮', 'Dorm 2': '기숙사 2동' });
    assert.deepEqual(T.piecePairs(dict, new Set(['other'])), []);
    assert.deepEqual(T.fixedPairs([{ text: 'Morning:Lobby, Afternoon:Desk, Night:Dorm', key: 'sched' }, { text: 'Sunday', key: 'week' }, { text: 'Spring', key: 'desc' }], { Night: '밤' }), [['Morning', '아침'], ['Afternoon', '오후'], ['Sunday', '일']]);
    assert.deepEqual(T.batches(['a'.repeat(5000), 'b'.repeat(4000), 'c'], 60, 8000).map(b => b.length), [1, 2]);
    assert.equal(T.batches(Array.from({ length: 130 }, (_, i) => `s${i}`)).length, 3);
});

await test('⑪ 누른 뒤 메우기: 장르 · 반쯤 번역 짝 · 영어 문장 칸을 한 번에 · 짝은 끝에 한 번(저장 한 번) · 데이터는 그대로 · 실리 번역 길은 잠깐 빼고 되돌림', async () => {
    for (const engine of ['llm', 'st']) {
        const f = fakeTarget({ engine, ko: { 'Afterlife office sitcom': '사후세계 직장 시트콤', 'Robin is a clerk caught up in daily chaos.': '로빈은 매일의 혼란에 휘말린 직원이다.', 'A quiet archive above the harbor.': '항구 위 조용한 기록관.' } });
        const core = { title: 'Harbor Archive', genre: 'Afterlife office sitcom', userRole: 'Robin is a clerk caught up in daily chaos.', summary: 'A quiet archive above the harbor.' };
        f.app.current.state = { core, data: { calendar: { times: ['Morning'] } }, recent: [] };
        Object.assign(f.meta.tr, { 'Harbor Archive': '항구 기록관', Morning: '아침', 'Robin is a clerk caught up in daily chaos.': '로빈 is a clerk caught up in daily chaos.' });
        let adds = 0;
        const realAdd = f.mb.tr.addPairs; f.mb.tr.addPairs = p => { adds++; return realAdd(p); };
        if (engine === 'st') { const real = f.mb.tr.trJSON; f.mb.tr.trJSON = async src => { assert.equal(Object.hasOwn(f.meta.tr, 'Robin is a clerk caught up in daily chaos.'), false, '실리 번역 길에는 반쯤 짝을 빼고 보냄'); return real(src); }; }
        const before = JSON.stringify(core);
        const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
        const done = await fill.fill('click');
        assert.equal(done, 3, engine);   // 장르 · 요약 · 반쯤 짝(칩 「Honey Lemon Drop」은 번역기가 영어 그대로라 못 바꾼 것)
        assert.equal(f.meta.tr['Afterlife office sitcom'], '사후세계 직장 시트콤');
        assert.equal(f.meta.tr['Robin is a clerk caught up in daily chaos.'], '로빈은 매일의 혼란에 휘말린 직원이다.');
        assert.equal(f.calls.json.length, 1, '한 번에');
        assert.equal(adds, 2, '번역 짝은 한 번에(+ 1.5.2 사전에 이미 든 고정 낱말 「Morning」을 낱말 바꾸기에서 빼는 한 번)');
        assert.equal(Object.keys(f.meta.tr).includes('Morning'), false, '고정 낱말은 셀 수 없는 칸');
        assert.equal(f.meta.tr.Morning, '아침');
        assert.equal(JSON.stringify(core), before, '데이터는 그대로');
    }
});

await test('⑫ 번역기가 다시 반쯤 돌려주면 옛 짝을 되돌리고(실리 번역 길) 자동으로는 다시 안 보냄(누르면 한 번 더) · 조각 짝은 단추 없이', async () => {
    const f = fakeTarget({ engine: 'st', ko: {} });
    const half = 'Robin is a clerk caught up in daily chaos.';
    f.app.current.state = { core: { userRole: half, sched: 'Morning:Front Desk, Day:Front Desk' }, data: {}, recent: [] };
    f.app.current.snaps = new Map();
    Object.assign(f.meta.tr, { [half]: '로빈 is a clerk caught up in daily chaos.', 'Morning:Front Desk, Day:Front Desk': '아침:안내 데스크, 낮:안내 데스크' });
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', now: tm.now, timers: tm.timers });
    assert.equal(await fill.fill('click'), 0);
    assert.equal(f.meta.tr[half], '로빈 is a clerk caught up in daily chaos.', '되돌림');
    assert.equal(f.meta.tr.Day, '낮', '조각 짝');
    assert.equal(await fill.fill('auto'), 0);
    assert.equal(f.calls.json.length, 1, '못 바꾼 글은 자동으로는 다시 안 보냄');
    assert.equal(await fill.fill('click'), 0);
    assert.equal(f.calls.json.length, 2, '1.7.8 사람이 다시 누르면 한 번 더');
    delete f.meta.tr.Day; delete f.meta.tr.Morning; delete f.meta.tr['Front Desk'];
    fill.tidySoon(); await tm.run(3000);
    assert.equal(f.meta.tr.Day, '낮', '채팅 열기 · 답 끝 뒤 자동');
});

await test('⑬ 고정 낱말 사전(테마 card-values 하나): 정해진 칸(요일 · 시간대 · 달 · 날씨 · 계절)의 값 전체만 · 대소문자 · 줄임 · 복수 · 날짜 꼴 — 이름 칸 · 자유 글 · 문장은 아님', () => {
    const cases = [['Saturday', 'time', '토요일'], ['SATURDAY', 'time', '토요일'], ['sat', 'week', '토'], ['Tues', 'week', '화'], ['April', 'month', '4월'], ['Sept', 'month', '9월'], ['May', 'month', '5월'], ['Winter', 'season', '겨울'], ['Late Autumn', 'season', '늦가을'], ['Day', 'time', '낮'], ['Dusk', 'time', '해 질 녘'], ['Afternoon', 'slot', '오후'], ['Partly Cloudy', 'weather', '구름 조금'], ['Sunny, gentle breeze', 'weather', '맑음, 산들바람'], ['Weekends', 'time', '주말'], ['Day 3', 'time', '3일째'], ['4/1 (Mon)', 'time', '4/1(월)'], ['Heavy rain · Cold', 'weather', '폭우 · 추움'], ['Light rain', 'chip-weather', '약한 비'], ['Morning', 'chip-time', '아침']];
    for (const [en, key, ko] of cases) assert.equal(T.fixedValue(en, key), ko, `${key}:${en}`);
    for (const text of ['Morning walk to the lobby', 'The day begins', 'Sunny Side Cafe']) assert.equal(T.fixedValue(text, 'weather'), null, text);
    for (const [text, key] of [['April', ''], ['Summer', 'name'], ['June', 'who'], ['Morning', 'label'], ['Spring', 'desc'], ['May', 'time']]) assert.equal(T.fixedValue(text, key), null, `${key}:${text} — 정해진 칸이 아니면 안 바꿈`);
    const pairs = Object.fromEntries(T.fixedPairs([{ text: 'Mon', key: 'week' }, { text: 'Spring', key: 'season' }, { text: 'Summer', key: 'name' }, { text: 'Morning:Lobby, Day:Desk', key: 'sched' }, { text: 'Rainy days make Mira sleepy.', key: 'desc' }, { text: 'Autumn', key: 'label' }], {}));
    assert.deepEqual(pairs, { Mon: '월', Spring: '봄', Morning: '아침', Day: '낮' });
});

await test('⑭ 고정 낱말 칸은 번역 요청에 0번 실림 · 누르기 전에 사전에 들어감(그 확장 길도 안 보냄) · 사전 짝은 한 번에', async () => {
    const f = fakeTarget({ ko: { 'Rainy days make Mira sleepy.': '비 오는 날이면 미라는 졸려 한다.' } });
    f.app.current.snaps = new Map([[1, { labels: ['날씨: Partly cloudy', '📍 Lobby'] }]]);
    f.app.current.state = { core: { title: 'Harbor Archive' }, data: { calendar: { week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], months: [{ name: 'January' }, { name: 'April' }], times: ['Dawn', 'Morning', 'Day', 'Evening', 'Night'], time: 'morning', weather: 'Light rain, chilly', season: 'Spring' }, rel: { user: [{ name: 'Mira', memo: 'Rainy days make Mira sleepy.' }] } }, recent: [] };
    Object.assign(f.meta.tr, { 'Harbor Archive': '항구 기록관', Mira: '미라', Lobby: '로비' });
    let adds = 0; const realAdd = f.mb.tr.addPairs; f.mb.tr.addPairs = p => { adds++; return realAdd(p); };
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', now: tm.now, timers: tm.timers });
    f.mb.tr.missingTr = () => [];
    fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
    assert.equal(f.meta.tr.Sat, '토', '누르는 순간 사전에');
    assert.equal(f.meta.tr['Light rain, chilly'], '약한 비, 쌀쌀함');
    assert.equal(f.meta.tr.morning, '아침');
    assert.equal(f.meta.tr['Partly cloudy'], '구름 조금');
    assert.equal(adds, 1);
    await tm.run(9000);
    const sent = f.calls.json.flat();
    assert.deepEqual(sent, ['Rainy days make Mira sleepy.'], JSON.stringify(sent));
    for (const w of ['Mon', 'April', 'Morning', 'Day', 'Spring', 'Light rain, chilly', 'Partly cloudy', 'morning']) assert.equal(sent.includes(w), false, w);
});

// ───── 1.5.2: 고정 낱말이 자유 글 속 낱말을 바꾸지 않게 · 칩 줄도 같은 사전 · 같은 길 (지어낸 이름) ─────
// 그 확장 화면 번역의 동작을 본뜬 것(코드는 옮기지 않음): 통째 맞춤(hasOwn) → 사전 열쇠(Object.entries · 3~40자 · 긴 것부터)를 낱말 경계로 바꿈
const viewLike = (dict, v) => {
    const k = v.trim();
    if (Object.hasOwn(dict, k)) return v.replace(k, () => dict[k]);
    let out = v;
    for (const [en, ko] of Object.entries(dict).filter(([e]) => e.length >= 3 && e.length <= 40).sort((a, b) => b[0].length - a[0].length)) {
        const re = new RegExp(`(^|[^A-Za-z])${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g');
        if (out.includes(en)) out = out.replace(re, (m, pre) => pre + ko);
    }
    return out;
};
await test('⑮ 고정 낱말은 자유 글 속에서 안 바뀜(Morning After · Monday Blues · Spring Festival · May I …) · 정해진 자리는 그대로 · 파일엔 안 적힘', () => {
    const f = fakeTarget();
    f.app.current.snaps = new Map();
    f.app.current.state = { core: { title: 'Harbor Archive' }, data: { calendar: { week: ['Mon', 'Sat'], times: ['Morning', 'Night'], time: 'Morning', months: [{ name: 'April' }, { name: 'May' }] }, profile: { list: [{ name: 'Rowan', sched: 'Morning:Front Desk, Night:Staff Dorm 2' }] }, rel: { user: [{ name: 'Marlow', label: 'Complicated Morning After' }] } }, recent: [] };
    Object.assign(f.meta.tr, { Morning: '아침', Monday: '월요일', Spring: '봄', May: '5월', Sat: '토요일', Rowan: '로완', Marlow: '말로', 'Front Desk': '안내 데스크' });
    f.meta.trLock = {};
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
    fill.tidy({ draw: false });
    const d = f.meta.tr;
    for (const text of ['Complicated Morning After', 'Monday Blues', 'Spring Festival', 'May I come in?', 'Saturday Night Fever'])
        assert.equal(viewLike(d, text), text, text);
    assert.equal(viewLike(d, 'Morning'), '아침', '값 전체는 그대로 한국어');
    assert.equal(viewLike(d, '4/5(Sat) Morning'), '4/5(토) 아침', '띠 · 머리 날짜 줄');
    assert.equal(viewLike(d, '6일 (Sat)'), '6일 (토)');
    assert.equal(viewLike(d, '지금 여기 (Morning)'), '지금 여기 (아침)');
    assert.equal(viewLike(d, '2026년 May 6일 (Mon)'), '2026년 5월 6일 (월)');
    assert.equal(viewLike(d, ' · Morning:Front Desk, Night:Staff Dorm 2 · '), ' · 아침:안내 데스크, 밤:Staff Dorm 2 · ', '일과 줄');
    assert.equal(viewLike(d, 'Rowan smiles.'), '로완 smiles.', '이름은 그 확장 뜻대로 글 속에서도');
    assert.equal(JSON.parse(JSON.stringify(d)).Morning, undefined, '고정 낱말 열쇠는 채팅 파일에 안 적힘(열 때마다 다시)');
    assert.equal(fill.tidy({ draw: false }), 0, '두 번째는 할 일 없음');
});

await test('⑯ 칩 줄: 같은 사전 · 같은 길 — 관계 이름 · 새 장소는 번역 대상(이름은 빼고) · 시간대 칩은 사전 · 「이름\'s」는 「이름의」', () => {
    const d = { Rowan: '로완', Marlow: '말로' };
    Object.defineProperty(d, 'Morning', { value: '아침', enumerable: false, writable: true, configurable: true });
    const labels = ['💞 Rowan = Complicated Morning After', "🗺️ 새 장소: Marlow's Penthouse", '🕐 Morning', '날씨: Light rain', '♥ Rowan +8', '📅 +3일', '📍 지옥', '+Silver Key', "📜 진행: Find Mira's Ledger"];
    const shown = labels.map(l => T.chipText(viewLike(d, l), d));
    assert.deepEqual(shown, ['💞 로완 = Complicated Morning After', '🗺️ 새 장소: 말로의 Penthouse', '🕐 아침', '날씨: 약한 비', '♥ 로완 +8', '📅 +3일', '📍 지옥', '+Silver Key', "📜 진행: Find Mira's Ledger"]);
    const { list } = T.collectGaps(labels, { shown: t => viewLike(d, t), has: p => Object.hasOwn(d, p) });
    assert.deepEqual(list, ['Complicated Morning After', "Marlow's Penthouse", 'Silver Key', "Find Mira's Ledger"]);
    // 번역이 들어오면 칩은 통째로
    Object.assign(d, { 'Complicated Morning After': '복잡한 다음 날 아침', "Marlow's Penthouse": '말로의 펜트하우스' });
    assert.equal(T.chipText(viewLike(d, labels[0]), d), '💞 로완 = 복잡한 다음 날 아침');
    assert.equal(T.chipText(viewLike(d, labels[1]), d), '🗺️ 새 장소: 말로의 펜트하우스');
});

// ───── 1.5.3: 1.5.2 검토 결함 (사용자가 고친 것이 이김 · 이름은 고정 낱말이 아님 · 망가진 자료 되살리기) ─────
const reset = (meta, next) => { for (const k of Object.keys(meta)) delete meta[k]; Object.assign(meta, next); };
// 그 확장 「번역 고치기」 창의 동작을 본뜬 것(코드는 옮기지 않음): 창을 열 때 사전을 펼쳐 읽고, 고치면 d[en] = 값 · 📌 잠금 · 곧바로 채팅 메타 저장(JSON)
const fakeTrFix = (meta, edits, saved) => async () => {
    const d = meta.tr, lock = (meta.trLock ??= {});
    saved.seen = { ...d };
    for (const [en, ko] of Object.entries(edits)) { d[en] = ko; lock[en] = true; }
    saved.json = JSON.stringify(meta);
};
await test('⑰ 「번역 고치기」에서 고정 낱말을 고치고 📌 → 저장 → 다시 열기: 고친 값이 그대로(검토 1)', async () => {
    const f = fakeTarget();
    f.app.current.snaps = new Map();
    f.app.current.state = { core: {}, data: { calendar: { times: ['Morning', 'Night'], time: 'Morning' } }, recent: [] };
    f.meta.trLock = {};
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', now: tm.now, timers: tm.timers });
    fill.tidy({ draw: false });
    assert.equal(Object.keys(f.meta.tr).includes('Morning'), false, '평소엔 숨김');
    const saved = {};
    f.app.openTrFix = fakeTrFix(f.meta, { Morning: '오전' }, saved);
    assert.equal(fill.guardTrFix(), true);
    await f.app.openTrFix(null, 'calendar');
    assert.equal(saved.seen.Morning, '아침', '창에는 숨긴 짝도 보임');
    assert.equal(JSON.parse(saved.json).tr.Morning, '오전', '고친 값이 채팅 파일에');
    await tm.run(100);
    assert.equal(Object.keys(f.meta.tr).includes('Morning'), true, '📌 한 것은 숨기지 않음');
    assert.equal(Object.keys(f.meta.tr).includes('Night'), false, '나머지는 다시 숨김');
    // 다시 열기 = 저장된 JSON 으로
    reset(f.meta, JSON.parse(saved.json));
    const again = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
    again.tidy({ draw: false });
    assert.equal(f.meta.tr.Morning, '오전');
    assert.equal(JSON.parse(JSON.stringify(f.meta)).tr.Morning, '오전', '다시 저장해도 남음');
    assert.equal(f.meta.trLock.Morning, true);
    assert.equal(viewLike(f.meta.tr, 'Morning'), '오전');
});

await test('⑱ 이름이 April · June · Summer 인 사람: 이름 그대로 · 고정 낱말 사전에 안 들어감 · 문장 속 이름도 그대로 · 정해진 칸의 Morning · Saturday · May 는 한국어(검토 2)', () => {
    const f = fakeTarget();
    f.app.current.snaps = new Map([[1, { labels: ['♥ April +8', '💞 June = Complicated Morning After', '🕐 Morning'] }]]);
    f.app.current.state = { core: {}, data: { profile: { list: [{ name: 'April' }, { name: 'Summer' }] }, rel: { user: [{ name: 'June', label: 'Complicated Morning After' }] }, calendar: { week: ['Saturday'], months: [{ name: 'April' }, { name: 'May' }, { name: 'June' }], times: ['Morning'], time: 'Morning', season: 'Summer' } }, recent: [] };
    f.meta.trLock = {};
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
    fill.tidy({ draw: false });
    const d = f.meta.tr;
    for (const name of ['April', 'June', 'Summer']) assert.equal(Object.hasOwn(d, name), false, `${name} 은 사전에 안 들어감`);
    assert.equal(viewLike(d, 'April waved at Summer and June.'), 'April waved at Summer and June.');
    assert.equal(viewLike(d, 'Morning'), '아침'); assert.equal(viewLike(d, 'Saturday'), '토'); assert.equal(viewLike(d, 'May'), '5월');
    assert.equal(viewLike(d, 'Complicated Morning After'), 'Complicated Morning After', '부분 바꿈 0 그대로');
    const chips = ['♥ April +8', '💞 June = Complicated Morning After', '🕐 Morning'].map(l => T.chipText(viewLike(d, l), d, l));
    assert.deepEqual(chips, ['♥ April +8', '💞 June = Complicated Morning After', '🕐 아침']);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(d))).includes('4월'), false, '채팅 파일에 「4월」 짝 없음');
});

await test('⑲ 망가진 자료 되살리기: 값 없는 잠금 풀기 · 이름 → 달 · 계절 짝 지우기 · 📌 한 짝은 그대로 · 두 번 돌아도 같음 · 진단 기록', () => {
    const f = fakeTarget();
    f.app.current.snaps = new Map();
    f.app.current.state = { core: {}, data: { profile: { list: [{ name: 'April' }, { name: 'June' }, { name: 'Autumn' }] }, calendar: { times: ['Morning'] } }, recent: [] };
    reset(f.meta, { tr: { Rowan: '로완', April: '4월', June: '6월', Autumn: '가을' }, trLock: { Morning: true, June: true }, notes: [] });
    Object.defineProperty(f.meta.tr, 'Night', { value: '야간', enumerable: false, writable: true, configurable: true });
    f.meta.trLock.Night = true;   // 1.5.2 에서 고쳐 📌 했지만 숨은 채인 것
    const before = T.trRepairLog.length;
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
    fill.tidy({ draw: false });
    const d = f.meta.tr;
    assert.equal(f.meta.trLock.Morning, undefined, '① 값 없는 잠금은 풀림');
    assert.equal(d.Morning, '아침', '① 풀린 뒤 다시 들어감');
    assert.equal(Object.hasOwn(d, 'April'), false, '② 이름 → 달 짝 지움'); assert.equal(Object.hasOwn(d, 'Autumn'), false);
    assert.equal(d.June, '6월', '📌 한 짝은 사용자 것'); assert.equal(d.Rowan, '로완');
    assert.equal(Object.keys(d).includes('Night') && JSON.parse(JSON.stringify(d)).Night, '야간', '③ 📌 한 숨은 짝은 파일에 남게');
    const log = T.trRepairLog.at(-1);
    assert.equal(T.trRepairLog.length, before + 1);
    assert.deepEqual([log.unlocked, log.removed, log.shown], [1, 2, 1]);
    const snap = JSON.stringify(f.meta);
    fill.tidy({ draw: false });
    assert.equal(JSON.stringify(f.meta), snap, '두 번째도 같은 결과');
    assert.equal(T.trRepairLog.length, before + 1, '두 번째는 기록 없음');
});

await test('㉒ 1.6.6 번역 모델이 나눔표 「 / 」를 괄호로 싼 짝: 「가「 / 」나」 · 「가 「 」 나」 → 「가 / 나」 · 📌 한 짝 · 원문에 괄호가 있는 짝 · 진짜 대사 괄호는 그대로 · 두 번 돌아도 같음', async () => {
    assert.equal(T.sepQuoteValue('Harvest Moon / Lantern Night', '수확의 달「 / 」등불의 밤'), '수확의 달 / 등불의 밤');
    assert.equal(T.sepQuoteValue('Harbor drama / slice of life', '항구 드라마 「 」 일상물'), '항구 드라마 / 일상물');
    assert.equal(T.sepQuoteValue('Harvest Moon / Lantern Night', '수확의 달 / 등불의 밤'), null, '고칠 것 없음');
    assert.equal(T.sepQuoteValue('Harvest Moon / Lantern Night', '「수확의 달」 / 「등불의 밤」'), null, '낱말을 감싼 괄호는 이 꼴이 아님');
    assert.equal(T.sepQuoteValue('She said 「 / 」 once', '그녀는 「 / 」 라고 했다'), null, '원문에 괄호가 있으면 그대로');
    assert.equal(T.sepQuoteValue('Harvest Moon', '수확의 달「 」'), null, '원문에 나눔표가 없으면 그대로');
    // 채팅을 열 때(tidy) 사전에서 바로잡고 · 그 확장 addPairs 로(사전 판 올림 · 저장) · 📌 한 짝은 안 건드림
    const f = fakeTarget();
    f.app.current.snaps = new Map();
    f.app.current.state = { core: {}, data: { calendar: { events: [{ title: 'Harvest Moon / Lantern Night' }, { title: 'Founders Day / Tide Fair' }, { title: 'Bell Day / Rope Day' }] } }, recent: [] };
    reset(f.meta, { tr: { 'Harvest Moon / Lantern Night': '수확의 달「 / 」등불의 밤', 'Founders Day / Tide Fair': '창립일 「 」 물때 장', 'Bell Day / Rope Day': '종의 날「 / 」밧줄의 날' }, trLock: { 'Bell Day / Rope Day': true }, notes: [] });
    const added = [];
    const inner = f.mb.tr.addPairs;
    f.mb.tr.addPairs = pairs => { added.push(...pairs); return inner(pairs.filter(([en]) => !f.meta.trLock?.[en])); };
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
    fill.tidy({ draw: false });
    assert.equal(f.meta.tr['Harvest Moon / Lantern Night'], '수확의 달 / 등불의 밤');
    assert.equal(f.meta.tr['Founders Day / Tide Fair'], '창립일 / 물때 장');
    assert.equal(f.meta.tr['Bell Day / Rope Day'], '종의 날「 / 」밧줄의 날', '📌 한 짝은 사용자 것');
    assert.equal(added.some(([en]) => en === 'Bell Day / Rope Day'), false, '📌 한 짝은 보내지도 않음');
    const snap = JSON.stringify(f.meta);
    fill.tidy({ draw: false });
    assert.equal(JSON.stringify(f.meta), snap, '두 번째도 같은 결과');
    // 번역 메우기(fill)로 새로 온 짝도 같은 꼴이면 바로잡아 넣음
    assert.deepEqual(T.pairsFor('Pier Two / Gull Rock', '둘째 부두「 / 」갈매기 바위', new Map()), [['Pier Two / Gull Rock', '둘째 부두 / 갈매기 바위']]);
});

await test('⑳ 1.5.8 테마 번역기가 답을 번역해 끝내면 그 답의 관계 칩 「이름 = 설명」 · 새 상태 글을 한 번에 메움 · 그 확장 자동 번역 「끔」이면 안 함', async () => {
    const LABEL = 'witnessed her harbor prank humiliation';
    for (const [auto, expect] of [['st', 1], ['always', 1], ['off', 0]]) {
        const f = fakeTarget({ auto, engine: 'llm', ko: { [LABEL]: '항구 장난으로 망신당한 걸 봄' } });
        f.app.current.snaps = new Map([[1, { labels: ['♥ Rowan +2', `💞 Marlow = ${LABEL}`] }]]);
        f.app.current.state = { core: {}, data: { rel: { user: [{ name: 'Marlow', label: LABEL }, { name: 'Rowan', label: '' }] } }, recent: [] };
        Object.assign(f.meta.tr, { Rowan: '로완', Marlow: '말로' });
        f.meta.trLock = {};
        const tm = fakeTimers();
        const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', now: tm.now, timers: tm.timers });
        fill.afterTranslate({ type: 'translation' });
        fill.afterTranslate({ type: 'translation' });   // 한 번으로 묶음
        await tm.run(2000);
        assert.equal(f.calls.json.length, expect, `trAuto=${auto}`);
        if (expect) {
            assert.deepEqual(f.calls.json[0], [LABEL], '이름은 빼고 설명만 · 칩과 상태 글이 같은 열쇠라 한 번');
            assert.equal(f.meta.tr[LABEL], '항구 장난으로 망신당한 걸 봄');
            const mes = window.document.querySelector('.mes'); mes.setAttribute('mesid', '1');
            mes.querySelector('.custom-ss-slot').innerHTML = `<div class="ss-msgcard ss-scope"><span class="ss-mchip">♥ Rowan +2</span><span class="ss-mchip">💞 Marlow = ${LABEL}</span></div>`;
            f.mb.tr.trString = t => viewLike(f.meta.tr, t);
            fill.paint([mes]);
            assert.deepEqual([...mes.querySelectorAll('.ss-mchip')].map(e => e.textContent), ['♥ 로완 +2', '💞 말로 = 항구 장난으로 망신당한 걸 봄']);
        }
    }
    const f = fakeTarget();
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', now: tm.now, timers: tm.timers });
    fill.afterTranslate({ type: 'retranslation-check' });
    await tm.run(2000);
    assert.equal(f.calls.json.length, 0, '번역 끝남이 아닌 알림은 안 봄');
});

await test('㉑ 1.5.8 칩 「이름 = 긴 설명」: 사전의 통째 번역(40자 넘어도)이 먼저 · 통째 짝이 없으면 조각 짝으로 이어 붙이지 않고 원문 그대로', () => {
    const LONG = 'witnessed her harbor prank humiliation at dawn';   // 40자 넘음 — 그 확장 화면 번역은 글 속에서 안 바꾸는 길이
    const d = { Marlow: '말로', 'witnessed her': '그녀를 목격함', 'harbor prank humiliation': '항구 장난 망신' };
    const label = `💞 Marlow = ${LONG}`;
    assert.equal(viewLike(d, label), '💞 말로 = 그녀를 목격함 항구 장난 망신 at dawn', '그 확장 화면 번역만 쓰면 조각이 이어 붙음(사용자 화면 꼴)');
    assert.equal(T.chipShown(label, d, t => viewLike(d, t)), `💞 말로 = ${LONG}`, '통째 짝이 없으면 원문 그대로');
    d[LONG] = '새벽에 그녀가 항구 장난으로 망신당하는 모습을 목격함';
    assert.equal(T.chipShown(label, d, t => viewLike(d, t)), '💞 말로 = 새벽에 그녀가 항구 장난으로 망신당하는 모습을 목격함');
    // 칩 줄에 그려진 글도
    const f = fakeTarget();
    Object.assign(f.meta.tr, d);
    f.mb.tr.trString = t => viewLike(f.meta.tr, t);
    f.app.current.snaps = new Map([[1, { labels: ['♥ Marlow +2', label, '🗺️ 새 장소: Marlow\'s Penthouse', '+Silver Key'] }]]);
    const mes = window.document.querySelector('.mes'); mes.setAttribute('mesid', '1');
    mes.querySelector('.custom-ss-slot').innerHTML = `<div class="ss-msgcard ss-scope">${['♥ Marlow +2', label, "🗺️ 새 장소: Marlow's Penthouse", '+Silver Key'].map(l => `<span class="ss-mchip">${l}</span>`).join('')}</div>`;
    T.createTrFill(f.mb, { doc: window.document }).paint([mes]);
    assert.deepEqual([...mes.querySelectorAll('.ss-mchip')].map(e => e.textContent), ['♥ 말로 +2', '💞 말로 = 새벽에 그녀가 항구 장난으로 망신당하는 모습을 목격함', '🗺️ 새 장소: 말로의 Penthouse', '+Silver Key']);
});

await test('㉒ 1.6.8 굳힌 옛 답의 날 칩(「aff 이름 +4」): 그 확장 실시간 칩처럼 아이콘으로(♥ · 🤝 · 📍 · 🕐 …) · 한국어 저장 · 화면만 번역 둘 다', async () => {
    const ops = [['aff', 'Nora +4'], ['trust', 'Nora +5'], ['호감', 'Nora +1'], ['Loc', 'Harbor'], ['time', 'Morning'], ['weather', 'Rain'], ['cash', '+300'],
        ['item', 'Plum Tea 2'], ['item', '-Old Key 1|'], ['stat', '체력 -5'], ['hp', '-3'], ['cond', '독'], ['date', '+1'], ['mind', 'Nora: 속마음'], ['memo', 'x']];
    const m = { is_user: false, swipe_id: 0, extra: { statussim: { bySwipe: { 0: ops } } } };
    const want = ['♥ Nora +4', '🤝 Nora +5', '♥ Nora +1', '📍 Harbor', '🕐 Morning', '날씨: Rain', '골드 +300', '+Plum Tea×2', '−Old Key', '체력 −5', 'HP −3', '상태: 독', '📅 +1일'];
    assert.deepEqual(T.bakedChips(m, { currency: '골드' }), want);
    assert.equal(T.bakedChips(m)[6], '💰 +300', '화폐 이름이 없으면 돈 아이콘');
    // 굳힐 때 적어 둔 칩 글이 있으면 그것 그대로(🎲 빼고) · 사람 답 · 변화 줄 없음은 없음
    assert.deepEqual(T.bakedChips({ swipe_id: 0, extra: { statussim: { chips: { 0: ['♥ Nora +2', '🎲 x'] }, bySwipe: { 0: ops } } } }), ['♥ Nora +2']);
    assert.equal(T.bakedChips({ is_user: true, extra: { statussim: { bySwipe: { 0: ops } } } }), null);
    assert.equal(T.bakedChips({ extra: {} }), null);
    // 칩 줄: 그 확장이 그린 날 칩 글(「키 값」)을 다시 적어요 — 한국어 저장(화면만 번역 꺼짐)에서도
    const raw = T.rawChipKeys(ops).map(([k, v]) => `${k} ${v}`.slice(0, 60));
    const mes = window.document.querySelector('.mes'); mes.setAttribute('mesid', '2');
    const slot = mes.querySelector('.custom-ss-slot');
    const draw = () => { slot.innerHTML = `<div class="ss-msgcard ss-scope">${raw.map(l => `<span class="ss-mchip">${l}</span>`).join('')}</div>`; };
    const chips = () => [...slot.querySelectorAll('.ss-mchip')].map(e => e.textContent);
    for (const view of [false, true]) {
        const f = fakeTarget({ view });
        f.app.current.state.data = { wallet: { currency: '골드' } };
        draw();
        T.createTrFill(f.mb, { doc: window.document, chat: () => [{}, {}, m] }).paint([mes]);
        const fixedKo = t => t.replace('🕐 Morning', '🕐 아침').replace('날씨: Rain', '날씨: 비');
        assert.deepEqual(chips(), view ? want.map(t => fixedKo(t.replace('Nora', '노라'))) : want.map(fixedKo), view ? '화면만 번역: 아이콘 + 사전 이름 · 시간대 · 날씨 고정 낱말' : '한국어 저장: 아이콘 + 시간대 · 날씨 고정 낱말');
    }
    // 한국어 저장 · 실시간 칩: 시간대 · 날씨 칩만 고정 낱말로(AI 0) · 다른 칩 · 이름은 그대로
    const liveKo = fakeTarget({ view: false });
    liveKo.app.current.snaps = new Map([[2, { labels: ['🕐 Evening', '날씨: Light rain', '♥ Nora +1', '📍 Harbor Street'] }]]);
    slot.innerHTML = `<div class="ss-msgcard ss-scope">${['🕐 Evening', '날씨: Light rain', '♥ Nora +1', '📍 Harbor Street'].map(l => `<span class="ss-mchip">${l}</span>`).join('')}</div>`;
    T.createTrFill(liveKo.mb, { doc: window.document, chat: () => [{}, {}, m] }).paint([mes]);
    assert.deepEqual(chips(), ['🕐 저녁', '날씨: 약한 비', '♥ Nora +1', '📍 Harbor Street']);
    // 실시간 칩(그 답의 snaps 가 있음)의 다른 칩은 건드리지 않아요 · 칩 수가 다르면 그대로
    const live = fakeTarget({ view: false });
    live.app.current.snaps = new Map([[2, { labels: ['aff 놀이 +1'] }]]);
    slot.innerHTML = '<div class="ss-msgcard ss-scope"><span class="ss-mchip">aff 놀이 +1</span></div>';
    T.createTrFill(live.mb, { doc: window.document, chat: () => [{}, {}, m] }).paint([mes]);
    assert.deepEqual(chips(), ['aff 놀이 +1']);
    slot.innerHTML = '<div class="ss-msgcard ss-scope"><span class="ss-mchip">aff Nora +4</span></div>';
    T.createTrFill(fakeTarget({ view: false }).mb, { doc: window.document, chat: () => [{}, {}, m] }).paint([mes]);
    assert.deepEqual(chips(), ['aff Nora +4']);
    mes.setAttribute('mesid', '1');
});

await test('㉓ 1.6.8 그림 글자가 붙은 날씨 · 시간대(「🌧 Rain」): 낱말 짝(Rain → 비)과 붙은 꼴 짝(🌧 Rain → 🌧 비)을 AI 없이 · 자유 글 · 이름은 그대로', () => {
    const items = [{ text: '🌧 Rain', key: 'weather' }, { text: '☀️ Clear', key: 'weather' }, { text: '🕐 Evening', key: 'time' }, { text: '🌧 Rain', key: 'note' }, { text: '🌸 Nora', key: 'weather' }];
    assert.deepEqual(T.fixedPairs(items, {}), [['Rain', '비'], ['🌧 Rain', '🌧 비'], ['Clear', '맑음'], ['☀️ Clear', '☀️ 맑음'], ['Evening', '저녁'], ['🕐 Evening', '🕐 저녁']]);
    assert.deepEqual(T.fixedPairs(items, { '🌧 Rain': '🌧 비' }).slice(0, 1), [['Rain', '비']], '사전에 있는 짝은 그대로');
});

await test('㉔ 1.6.8 70자로 잘린 알림 글(「화면 밖 — 이름」 · 「…」): 상태에 원문 통째가 있으면 원문을 번역 요청에 · 없으면 예전처럼 덩이 · 알림함을 열면 자동 번역 규칙대로', async () => {
    const LONG = 'Checked the old harbor lighthouse lamp at dawn to make sure the wick was dry and polished the brass rail.';
    const cut = LONG.slice(0, 69) + '…';
    const full = pre => (LONG.startsWith(pre) ? LONG : null);
    assert.deepEqual(T.collectGaps([cut], { full }).list, [LONG]);
    assert.deepEqual(T.collectGaps([cut], { full, has: p => p === LONG }).list, [], '원문이 사전에 있으면 안 보냄');
    assert.deepEqual(T.collectGaps([cut]).list, [LONG.slice(0, 69).trim()]);
    // 알림함을 열면: 그 확장 자동 번역이 켜져 있을 때만(실리 기본 번역 · 항상) 원문을 한 번에 · 꺼져 있으면 안 함
    const btn = Object.assign(window.document.createElement('button'), {}); btn.dataset.hud = 'inbox'; window.document.body.append(btn);
    for (const [auto, engine, want] of [['st', 'st', 1], ['st', 'llm', 0], ['always', 'llm', 1], ['off', 'st', 0]]) {
        const f = fakeTarget({ auto, engine, ko: { [LONG]: '새벽에 낡은 등대 등을 점검했다.' } });
        f.meta.notes = [{ title: '화면 밖 — Nora', text: cut }];
        f.app.current.state = { recent: [], data: { rel: { life: [{ who: 'Nora', text: LONG }] } } };
        const tm = fakeTimers();
        const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers });
        fill.onClick({ target: btn, isTrusted: true });
        await tm.run(1000);
        assert.equal(f.calls.json.length, want, `${auto}/${engine}`);
        if (want) assert.equal(f.meta.tr[LONG], '새벽에 낡은 등대 등을 점검했다.');
    }
    btn.remove();
});

await test('㉕ 1.6.8 플레이 기록 「지난 하루들」 줄(state.days 의 칩 글): 「날씨: Sunny」 통째 짝을 AI 없이 · 그날 칩의 영어 글도 번역 요청에 · 이름 칩은 그대로', async () => {
    // 모으기: 지난 하루들 줄도 화면에 보일 글이에요
    const cur = { state: { recent: [], days: [{ date: '1년 Mar 2일 (Fri)', labels: ['날씨: Sunny', '상태: Tired', '♥ Nora +3'] }, null, { labels: 'x' }] } };
    assert.deepEqual(T.visibleTexts(cur, {}), ['날씨: Sunny', '상태: Tired', '♥ Nora +3']);
    // 통째 짝: 시간대 · 날씨 칩만 · 사전에 있는 것 · 못 읽는 낱말 · 다른 칩은 빼요 · 사전 값(📌 고친 값)이 먼저
    assert.deepEqual(T.chipSlotPairs(['날씨: Sunny', '🕐 Afternoon', '🕐 Late Afternoon', '날씨: Sunny', '날씨: Purple haze', '상태: Tired', '♥ April +3', '날씨: 비'], {}),
        [['날씨: Sunny', '날씨: 맑음'], ['🕐 Afternoon', '🕐 오후'], ['🕐 Late Afternoon', '🕐 늦은 오후']]);
    assert.deepEqual(T.chipSlotPairs(['날씨: Sunny', '🕐 Afternoon'], { '날씨: Sunny': '날씨: 해' , Afternoon: '한낮' }), [['🕐 Afternoon', '🕐 한낮']]);
    // tidy(답 끝 · 채팅 열기): 지난 하루들 줄의 통째 짝이 사전에 들어가요(그 확장 화면 번역이 통째로 맞춰요)
    const f = fakeTarget();
    f.app.current.state = { recent: [], days: [{ labels: ['날씨: Sunny', '상태: Tired'] }], data: {} };
    f.app.current.snaps = new Map();
    const fill = T.createTrFill(f.mb, { doc: window.document });
    fill.tidy({ draw: false });
    assert.equal(f.meta.tr['날씨: Sunny'], '날씨: 맑음');
    assert.equal(Object.hasOwn(f.meta.tr, '상태: Tired'), false, '상태 이름은 번역기 몫');
    // 번역 단추: 그날 칩 글의 영어(지금 상태에 없는 상태 이름)도 번역 요청에 실려요 · 고정 낱말은 안 실려요
    const g = fakeTarget({ ko: { Tired: '피곤' } });
    g.app.current.state = { recent: [], days: [{ labels: ['날씨: Sunny', '상태: Tired'] }], data: {} };
    g.app.current.snaps = new Map();
    await T.createTrFill(g.mb, { doc: window.document }).fill('auto');
    assert.deepEqual(g.calls.json, [['Tired']]);
    assert.equal(g.meta.tr.Tired, '피곤');
});

await test('㉖ 1.6.8 그 확장이 실리 기본 알림(toastr)으로 띄우는 글: 제목이 그 확장 이름일 때만 · 화면만 번역일 때만 사전으로 · 태그 · 엔티티 그대로', () => {
    const dict = { Leon: '레오', Bread: '빵', "Ann's Ledger": '앤의 장부' };
    const trs = t => { let out = t; for (const [en, ko] of Object.entries(dict)) out = out.split(en).join(ko); return out; };
    assert.equal(T.trToastMessage('Leon와(과) 연인이 되었어요 💞', trs), '레오와(과) 연인이 되었어요 💞');
    assert.equal(T.trToastMessage('💬 <b>Leon</b>: hi<br><small>Ann&#39;s Ledger</small>', trs), '💬 <b>레오</b>: hi<br><small>앤의 장부</small>');
    assert.equal(T.trToastMessage('<a href="Leon">x</a>', trs), '<a href="Leon">x</a>', '태그 속성은 안 건드려요');
    assert.equal(T.trToastMessage('상태창을 만들었어요!', trs), '상태창을 만들었어요!');
    const seen = [];
    const fake = { options: { escapeHtml: true } };
    for (const k of ['info', 'success', 'warning', 'error']) fake[k] = (m, t) => { seen.push([k, m, t]); return k; };
    let view = true;
    assert.equal(T.wrapMbToasts(fake, { title: '미트볼 상태창', trs, on: () => view }), true);
    assert.equal(T.wrapMbToasts(fake, { title: '미트볼 상태창', trs }), false, '한 번만 감싸요');
    assert.equal(fake.success('Bread 구매!', '미트볼 상태창'), 'success', '돌려준 값 그대로');
    fake.info('Leon joined', 'Other');
    view = false; fake.info('Leon와(과) 연인이 되었어요', '미트볼 상태창');
    assert.deepEqual(seen, [['success', '빵 구매!', '미트볼 상태창'], ['info', 'Leon joined', 'Other'], ['info', 'Leon와(과) 연인이 되었어요', '미트볼 상태창']]);
});

await test('1.7.6 지도 「아직 안 가 본 곳」 이름 · 설명도 같은 번역 길 · 같은 사전으로(누를 때만 · 이미 있으면 안 보냄 · 스위치를 끄면 안 실어요)', async () => {
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1');
    const ko = { 'Honey Lemon Drop': '꿀레몬 사탕', Lobby: '로비', 'Staff Canteen': '구내식당', 'A restaurant where employees eat together.': '직원들이 함께 먹는 식당이에요.' };
    globalThis[REG] = () => [{ name: 'Lobby', summary: '' }, { name: 'Staff Canteen', summary: 'A restaurant where employees eat together.' }, { name: '달빛 찻집', summary: '골목 끝 찻집이에요.' }];
    try {
        // 자동(답이 끝난 뒤): 다른 빈틈이 없으면 이것 때문에 번역 요청을 내지 않아요
        let f = fakeTarget({ ko }); f.mb.core.app.current.snaps = new Map();
        let fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
        assert.equal(await fill.fill('auto'), 0); assert.deepEqual(f.calls.json, [], '자동으로는 따로 안 보내요');
        // 누르면: 이름 둘 + 영어 설명 하나(한국어 이름 · 설명은 안 보내요) → 같은 사전
        assert.equal(await fill.fill('click'), 3);
        assert.deepEqual(f.calls.json, [['Lobby', 'Staff Canteen', 'A restaurant where employees eat together.']]);
        assert.equal(f.meta.tr.Lobby, '로비'); assert.equal(f.meta.tr['Staff Canteen'], '구내식당'); assert.equal(f.meta.tr['A restaurant where employees eat together.'], '직원들이 함께 먹는 식당이에요.');
        assert.equal(await fill.fill('click'), 0); assert.equal(f.calls.json.length, 1, '한 번 번역한 이름은 다시 안 물어요');
        // 자동이라도 다른 빈틈과 같이 갈 때는 같은 묶음에 실어요(요청 수는 그대로)
        f = fakeTarget({ ko }); fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
        await fill.fill('auto'); assert.equal(f.calls.json.length, 1); assert.ok(f.calls.json[0].includes('Honey Lemon Drop') && f.calls.json[0].includes('Lobby'));
        // 번역기가 영어 그대로 돌려준 이름은 이번 접속에 다시 안 보내요
        f = fakeTarget({ ko: {} }); f.mb.core.app.current.snaps = new Map(); fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
        await fill.fill('click'); await fill.fill('auto'); assert.equal(f.calls.json.length, 1, '자동으로는 다시 안 보내요');
        await fill.fill('click'); assert.equal(f.calls.json.length, 2, '1.7.8 다시 누르면 한 번 더 보내요(그 접속 동안 굳히지 않아요)');
        // 「지도에 아직 안 가 본 곳」 스위치를 끄면 안 실어요
        f = fakeTarget({ ko }); f.mb.core.app.current.snaps = new Map(); fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
        window.document.documentElement.setAttribute('data-bl-mb-off', 'unvisited');
        assert.equal(await fill.fill('click'), 0); assert.deepEqual(f.calls.json, []);
        window.document.documentElement.removeAttribute('data-bl-mb-off');
        // 원문 보기(화면만 번역 아님)에서는 아무것도 안 해요
        f = fakeTarget({ ko, view: false }); assert.equal(await T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' }).fill('click'), 0);
    } finally { delete globalThis[REG]; window.document.documentElement.removeAttribute('data-bl-mb-off'); }
});

await test('1.7.8 번역 단추를 누른 뒤: 그 확장이 「N개 번역했어요」 알림을 띄우면 기다리지 않고 바로 이어 번역 · 시작 · 끝 알림 두 번까지 · 영어 그대로 돌아오면 그렇다고 알려요', async () => {
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1');
    globalThis[REG] = () => [{ name: 'Lobby', summary: '' }, { name: 'Staff Canteen', summary: '' }];
    try {
        const f = fakeTarget({ ko: { Lobby: '로비', 'Staff Canteen': '구내식당' } }); f.mb.core.app.current.snaps = new Map();
        const tm = fakeTimers(); const toasts = [];
        const toast = { success: m => toasts.push(['success', m]), info: m => toasts.push(['info', m]) };
        const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast, chatId: () => 'A' });
        f.mb.tr.missingTr = () => ['Office'];
        fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
        // 그 확장이 번역을 끝내고 제 알림을 띄움(사전이 안 늘었어도 — 번역기가 영어로 돌려준 때)
        await tm.run(200);
        fill.mbToast('success', '3개 번역했어요.');
        await tm.run(400);
        assert.deepEqual(f.calls.json, [['Lobby', 'Staff Canteen']], '알림 뒤 0.4초 안에 이어 보내요(예전: 사전이 늘어야만 · 3초 넘게 잠잠해야만)');
        assert.equal(fill.watching, false);
        assert.deepEqual(toasts.map(x => x[0]), ['info', 'success']);
        assert.match(toasts[0][1], /2개/); assert.match(toasts[0][1], /이어서 번역/);
        assert.match(toasts[1][1], /2개/);
        // 다시 눌렀는데 보낼 것이 없으면 알림 없음
        toasts.length = 0; fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
        fill.mbToast('success', '번역 안 된 글이 없어요. 그래도 …'); await tm.run(400);
        assert.deepEqual(toasts, []); assert.equal(f.calls.json.length, 1);
        // 누르지 않았는데 뜬 그 확장 알림(다른 일)에는 안 움직여요
        fill.mbToast('success', '3개 번역했어요.'); await tm.run(400); assert.equal(f.calls.json.length, 1);
        // 버그 사냥 4: 번역 중에 단추를 다시 눌러 멈춤 → 「(멈춤)」 알림에는 이어 번역 안 함 · 오류 알림은 끝이 아니라 기다려요(그 확장이 번역 모델로 한 번 더 · 끝 알림에 이어요)
        {
            const h = fakeTarget({ ko: { Lobby: '로비', 'Staff Canteen': '구내식당' } }); h.mb.core.app.current.snaps = new Map(); h.mb.tr.missingTr = () => ['Office'];
            const fh = T.createTrFill(h.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: null, chatId: () => 'A' });
            const go = () => fh.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
            go(); go();   // 누름 · 번역 중에 다시 누름(그 확장은 멈춤)
            assert.equal(fh.mbToast('success', '1개 번역했어요 (멈춤).'), true); await tm.run(400);
            assert.deepEqual(h.calls.json, [], '멈춘 번역은 안 이어요'); assert.equal(fh.watching, false);
            go();
            assert.equal(fh.mbToast('error', '번역하지 못했어요: 429'), false); await tm.run(400);
            // 1.7.9 통합: 누르자마자 먼저 보내기(그 확장이 안 보내는 글만 · 1.7.9 번역 늦음 고침)는 돌아요 — 오류 알림으로 이어 메우기(그 확장이 다시 보낼 글까지)는 안 해요
            assert.deepEqual(h.calls.json, [['Lobby', 'Staff Canteen']], '오류 알림에는 이어 메우기를 안 보내요(그 확장이 번역 모델로 한 번 더 보내는 중)');
            assert.ok(!h.calls.json.flat().includes('Office'), '그 확장이 보낼 글은 안 보내요'); assert.equal(fh.watching, true);
            assert.equal(fh.mbToast('success', '0개 번역했어요.'), true); await tm.run(400);
            assert.equal(h.calls.json.length, 1, '끝 알림에 이어요(먼저 보낸 글은 다시 안 보내요)'); assert.equal(fh.watching, false);
        }
        // 번역기가 영어 그대로 돌려줌 → 끝 알림이 그렇다고 · 다음 누름에 다시 보내요
        const g = fakeTarget({ ko: {} }); g.mb.core.app.current.snaps = new Map(); const msgs = [];
        const fill2 = T.createTrFill(g.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: { success: m => msgs.push(m), info: m => msgs.push(m) }, chatId: () => 'A' });
        await fill2.fill('click');
        assert.equal(msgs.length, 2); assert.match(msgs[1], /다시/);
        await fill2.fill('click'); assert.equal(g.calls.json.length, 2);
    } finally { delete globalThis[REG]; }
});
await test('버그 사냥 4: 이어 번역 끝 알림 — 요청 실패는 「영어 그대로」 가 아니라 실패로 · 기다리는 사이 채팅이 바뀌면 알림 없음 · 지도 글이 없으면 「지도 이름도」 를 안 붙여요', async () => {
    const mk = () => fakeTarget({ ko: { 'Honey Lemon Drop': '꿀레몬 사탕' } });   // 남은 글: 칩 「+Honey Lemon Drop」
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1'), old = globalThis[REG];
    globalThis[REG] = () => [];
    try {
        let g = mk(); let msgs = [];
        const toast = { success: m => msgs.push(['success', m]), info: m => msgs.push(['info', m]), warning: m => msgs.push(['warning', m]) };
        g.mb.tr.trJSON = async src => src;   // 그 확장 번역 길이 실패하면 받은 것을 그대로 돌려줘요
        await T.createTrFill(g.mb, { doc: window.document, toast, chatId: () => 'A' }).fill('click');
        assert.equal(msgs.at(-1)?.[0], 'warning', JSON.stringify(msgs)); assert.match(msgs.at(-1)[1], /안 됐어요/);
        assert.ok(!/지도 이름/.test(msgs[0][1]), '지도 글이 없어요');
        g = mk(); msgs = []; let chat = 'A';
        const real = g.mb.tr.trJSON; g.mb.tr.trJSON = async src => { const out = await real(src); chat = 'B'; return out; };
        await T.createTrFill(g.mb, { doc: window.document, toast, chatId: () => chat }).fill('click');
        assert.deepEqual(msgs.map(x => x[0]), ['info'], '시작 알림만(새 채팅에 「영어 그대로」 를 안 띄워요)');
    } finally { globalThis[REG] = old; }
});
await test('버그 사냥 6 번역 단추 배지가 남던 것: 번역기가 그대로 돌려준 기호 · 약어는 「그대로」 짝으로(배지에서 빠짐) · 알림은 「번역할 영어 문장이 없어요」 · 이름 · 문장은 예전처럼', async () => {
    for (const s of ['A.B.C', '(¬‿¬) ok', 'ABCD', 'NPC LOG', 'x2', '⠀A.B.C⠀']) assert.equal(T.keepAsIs(s), true, s);
    for (const s of ['Honey Lemon Drop', 'Golden Honey Butter Rolls', 'He is lying again', 'Oskar', 'OK then']) assert.equal(T.keepAsIs(s), false, s);
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1'), old = globalThis[REG];
    globalThis[REG] = () => [];
    try {
        const g = fakeTarget({ ko: {} }); g.mb.core.app.current.snaps = new Map([[1, { labels: ['💬 (¬‿¬) ok', '+Honey Lemon Drop'] }]]);
        let saved = 0; g.mb.core.saveMeta = () => { saved++; };
        const msgs = [];
        const fill = T.createTrFill(g.mb, { doc: window.document, toast: { success: m => msgs.push(['success', m]), info: m => msgs.push(['info', m]), warning: m => msgs.push(['warning', m]) }, chatId: () => 'A' });
        await fill.fill('click');
        assert.equal(g.meta.tr.ok, 'ok', '기호 · 짧은 글은 「그대로」 짝');
        assert.equal(Object.hasOwn(g.meta.tr, 'Honey Lemon Drop'), false, '번역할 이름은 한 번으로는 짝을 안 만들어요');
        assert.ok(saved >= 1, '채팅 메타 저장');
        assert.match(msgs.at(-1)[1], /번역할 영어 문장이 없어요/);
        await fill.fill('click');
        assert.deepEqual(g.calls.json.at(-1), ['Honey Lemon Drop'], '다음 누름엔 기호를 다시 안 보내고 이름만 다시 보내요');
        assert.equal(g.meta.tr['Honey Lemon Drop'], 'Honey Lemon Drop', '다른 누름에서 두 번 그대로 오면 「확인함」');
        await fill.fill('click');
        assert.equal(g.calls.json.length, 2, '그 뒤로는 안 보내요(배지에서도 빠짐)');
    } finally { globalThis[REG] = old; }
});
await test('1.7.8 받침 길: 미트볼 창(상태창 · 지도)이 열려 있어도 사전이 잠잠해지면 이어요 — 확인 창만 기다려요', async () => {
    // 리그(사용자 채팅 사본 · 1.7.7): 미트볼 상태창도 「확인」 단추가 있는 창이라 그 창을 닫을 때까지 이어 번역이 안 돌았어요(40초 넘게 · 닫자 그제야)
    const f = fakeTarget({ ko: { 'Honey Lemon Drop': '꿀레몬 사탕' } });
    const tm = fakeTimers();
    const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: null, chatId: () => 'A' });
    f.mb.tr.missingTr = () => ['Office'];
    const sheet = window.document.createElement('dialog'); sheet.className = 'popup ss-dlg'; sheet.setAttribute('open', ''); sheet.innerHTML = '<button class="popup-button-ok"></button>';
    window.document.body.append(sheet);
    fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
    await tm.run(1500); f.meta.tr.Office = '사무실';
    await tm.run(6000);
    assert.deepEqual(f.calls.json, [['Honey Lemon Drop']], '상태창이 열린 채로도 이어요');
    sheet.remove();
});
await test('1.7.8 띠 날짜 칸을 누르면 펼쳐지는 줄 「4/7(월) · 정오 · Clear」: 날씨가 짧은 글 덩이(「 · Clear」)라 낱말 바꾸기에서 뺀 고정 낱말로 안 바뀌었어요 → 덩이 통째 짝(AI 0)', () => {
    const ko = (w, key) => T.fixedValue(w, key);
    const pairs = new Map(T.slotPairs([{ text: 'Clear', key: 'weather' }, { text: 'Light rain', key: 'weather' }, { text: 'Noon', key: 'times' }, { text: 'Spring', key: 'season' }], ko));
    assert.equal(pairs.get('· Clear'), '· 맑음');
    assert.equal(pairs.get('· Clear ·'), '· 맑음 ·', '그날 일정이 뒤에 붙으면 덩이가 「 · Clear · 」 예요(리그: 일정 있는 날)');
    assert.ok(pairs.get('· Light rain') && !/[A-Za-z]/.test(pairs.get('· Light rain')), String(pairs.get('· Light rain')));
    assert.equal(pairs.get('· Spring'), '· 봄');
    // 날씨 칸이 아닌 값(사람 이름 Clear · 자유 글)은 안 만들어요
    assert.equal(new Map(T.slotPairs([{ text: 'Clear', key: 'name' }], ko)).get('· Clear'), undefined);
    assert.equal(new Map(T.slotPairs([{ text: 'A soft drizzle over the harbor', key: 'weather' }], ko)).size, 0, '자유 글 날씨는 번역 길로');
});
await test('1.7.8 위치 칸 펼침 머리 줄 「1층 후정 — Quiet walled garden behind the 1F S…」: 사전에 통째 번역이 있어도 「— 」 가 붙고 60자로 잘린 덩이라 못 찾았어요 → 그 덩이 통째 짝(AI 0)', () => {
    const desc = 'Quiet walled garden behind the 1F Security wing planted with Heavenly willows and Infernal ash trees.';
    const ko = '1층 경비부 별관 뒤편에 자리한 조용한 담장 정원으로, 천계의 버드나무와 지옥의 물푸레나무가 심겨 있어요.';
    const dict = { [desc]: ko, 'Short note.': '짧은 메모.' };
    const places = [{ name: 'First-Floor Rear Courtyard', desc }, { name: 'Shed', desc: 'Short note.' }, { name: 'Attic', desc: 'A dusty attic full of old crates and forgotten letters from long ago.' }];
    const pairs = new Map(T.placeDescPairs(places, dict));
    const key = '— ' + desc.slice(0, 59) + '…';
    assert.ok(pairs.has(key), [...pairs.keys()].join(' | '));
    const v = pairs.get(key); assert.ok(v.startsWith('— 1층 경비부'), v); assert.ok(v.endsWith('…') && v.length <= 2 + 45, v);
    assert.equal(pairs.size, 1, '짧은 설명(그 확장이 덩이를 나눠 찾아요) · 사전에 번역이 없는 설명(남은 글 번역으로)은 안 만들어요');
    // 원문에 공백이 겹쳐 있어도 그 확장 short 와 같은 꼴로
    assert.ok(new Map(T.placeDescPairs([{ name: 'X', desc: desc.replace(' behind', '  behind') }], { [desc.replace(' behind', '  behind')]: ko })).has(key));
});
await test('1.8.1 잘린 장소 설명 짝: 「번역 고치기」로 그 설명의 번역을 고치면 짝도 따라가요 · 그 짝을 손으로 고친 것 · 📌 고정은 그대로', () => {
    const desc = 'Quiet walled garden behind the 1F Security wing planted with Heavenly willows and Infernal ash trees.';
    const key = '— ' + desc.slice(0, 59) + '…';
    const setup = () => {
        const f = fakeTarget();
        f.app.current.snaps = new Map();
        f.app.current.state = { data: { map: { places: [{ name: 'Courtyard', desc }] } }, recent: [] };
        f.meta.tr[desc] = '1층 경비부 별관 뒤편에 자리한 조용한 담장 정원으로, 천계의 버드나무와 지옥의 물푸레나무가 심겨 있어요.';
        f.meta.trLock = {};
        const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
        fill.tidy({ draw: false });
        assert.ok(f.meta.tr[key]?.startsWith('— 1층 경비부'), f.meta.tr[key]);
        return { f, fill };
    };
    let { f, fill } = setup();
    f.meta.tr[desc] = '경비동 1층 뒤 조용한 안뜰이에요. 하늘 버드나무와 지옥 물푸레나무가 있어요.';   // 번역 고치기
    fill.tidy({ draw: false });
    assert.ok(f.meta.tr[key].startsWith('— 경비동 1층 뒤'), `옛 번역이 남았어요: ${f.meta.tr[key]}`);
    // 짝을 손으로 고쳤으면(테마가 넣은 값이 아니면) 설명을 다시 고쳐도 그대로
    ({ f, fill } = setup());
    f.meta.tr[key] = '— 손으로 고친 안뜰 설명…';
    fill.tidy({ draw: false });
    f.meta.tr[desc] = '다시 고친 번역이에요. 조용한 안뜰이에요.';
    fill.tidy({ draw: false });
    assert.equal(f.meta.tr[key], '— 손으로 고친 안뜰 설명…');
    // 📌 고정한 짝은 늘 사용자 것
    ({ f, fill } = setup());
    const was = f.meta.tr[key]; f.meta.trLock[key] = true;
    f.meta.tr[desc] = '또 고친 번역이에요. 조용한 안뜰이에요.';
    fill.tidy({ draw: false });
    assert.equal(f.meta.tr[key], was);
});
await test('1.7.8 그 확장 알림 감싸기: 제 이름 알림이면 본 것을 알려 줘요(seen)', () => {
    const seen = []; const fake = { success() {}, info() {}, warning() {}, error() {} };
    T.wrapMbToasts(fake, { title: '미트볼 상태창', trs: t => t, seen: (k, m) => seen.push([k, m]) });
    fake.success('3개 번역했어요.', '미트볼 상태창'); fake.info('다른 것', 'Other');
    assert.deepEqual(seen, [['success', '3개 번역했어요.']]);
});

// 1.7.9 번역이 늦게 보이던 것(11-18 사용자 폰: 「나머지 번역」 을 눌러도 한참 뒤 「20개 번역」 알림과 함께야 지도가 바뀜)
//   가짜 번역기는 글이 길수록 늦게 돌려줘요(1초 + 1자마다 10ms · 가상 시계)
const slowTr = (f, tm, ms = (n) => 1000 + 10 * n) => { f.mb.tr.trJSON = src => new Promise(res => { const n = src.list.join('').length; f.calls.json.push(src.list); tm.timers.setTimeout(() => res({ list: src.list.map(s => f.ko[s] ?? s) }), ms(n)); }); };
await test('1.7.9 누르자마자 그 확장이 안 보내는 글(지도 흐린 점 이름 · 칩)부터 작은 묶음으로 · 묶음마다 바로 다시 그림 · 그 확장이 보낼 글은 안 보냄 · 같은 글 두 번 0 · 끝 알림 한 번', async () => {
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1');
    const S1 = 'A wide hall where employees of every department share their meals. '.repeat(6).trim(), S2 = 'The harbor hall keeps the old ledgers of every ship that ever docked here. '.repeat(5).trim();
    globalThis[REG] = () => [{ name: 'Lobby', summary: '' }, { name: 'Staff Canteen', summary: S1 }, { name: 'Harbor Hall', summary: S2 }];
    try {
        const ko = { Lobby: '로비', 'Staff Canteen': '구내식당', 'Harbor Hall': '항구 홀', 'Honey Lemon Drop': '꿀레몬 사탕', [S1]: '모든 부서 직원이 함께 먹는 넓은 식당이에요.', [S2]: '항구에 닿은 배의 옛 장부를 두는 홀이에요.' };
        const f = fakeTarget({ ko }); f.ko = ko;
        f.app.current.state = { core: { here: 'Office' }, recent: [] };
        const tm = fakeTimers(); slowTr(f, tm);
        const draws = []; f.app.rerenderPanels = () => draws.push(tm.now());
        const toasts = [];
        const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: { success: m => toasts.push(['success', m]), info: m => toasts.push(['info', m]) }, chatId: () => 'A' });
        f.mb.tr.missingTr = () => (Object.hasOwn(f.meta.tr, 'Office') ? [] : ['Office']);
        fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
        await tm.run(350);
        assert.deepEqual(f.calls.json, [['Lobby', 'Staff Canteen', 'Harbor Hall', 'Honey Lemon Drop']], '0.3초에 이름 · 칩만 먼저(그 확장 번역을 기다리지 않아요 · 긴 설명은 다음 묶음)');
        await tm.run(1500);   // 첫 묶음이 돌아옴(1초 + 45자 → 1.75초)
        assert.equal(f.meta.tr.Lobby, '로비'); assert.equal(f.meta.tr['Harbor Hall'], '항구 홀');
        assert.ok(draws.some(x => x === 1750), `돌아오자마자 다시 그림: ${draws}`);
        assert.deepEqual(f.calls.json[1], [S1, S2], '설명은 이어서 한 묶음');
        f.meta.tr.Office = '사무실'; fill.mbToast('success', '1개 번역했어요.');   // 그 확장 번역이 끝남(설명 묶음은 아직 가는 중)
        await tm.run(1000);
        assert.equal(f.calls.json.length, 2, '가는 중인 설명을 다시 보내지 않아요');
        assert.deepEqual(toasts.map(x => x[0]), ['info'], '끝 알림은 설명 묶음까지 끝난 뒤');
        await tm.run(10000);
        assert.equal(f.meta.tr[S2], ko[S2]);
        assert.deepEqual(toasts.map(x => x[0]), ['info', 'success']); assert.match(toasts[1][1], /6개/);
        const sent = f.calls.json.flat(); assert.equal(new Set(sent).size, sent.length, '같은 글 두 번 0'); assert.equal(sent.includes('Office'), false, '그 확장이 보낼 글은 안 보내요');
        assert.equal(fill.watching, false);
        // 다시 눌러도 보낼 것이 없으면 요청 0 · 알림 0
        toasts.length = 0; fill.onClick({ target: Object.assign(window.document.createElement('button'), { className: 'ss-trf-go' }), isTrusted: true });
        await tm.run(500); fill.mbToast('success', '번역 안 된 글이 없어요.'); await tm.run(2000);
        assert.equal(f.calls.json.length, 2); assert.deepEqual(toasts, []);
    } finally { delete globalThis[REG]; }
});
await test('1.7.9 「상태창 전체 번역」(확인 창이 뜸): 「예」 를 본 뒤에만 먼저 보내요 · 취소하면 0 · 확인 창이 안 뜨면 그 확장 번역 뒤에', async () => {
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1');
    globalThis[REG] = () => [{ name: 'Lobby', summary: '' }];
    const sheetBtn = () => { const b = window.document.createElement('button'); b.setAttribute('data-act', 'trsheet'); return b; };
    const confirm = () => { const d = window.document.createElement('dialog'); d.setAttribute('open', ''); d.innerHTML = '<button class="popup-button-ok"></button><button class="popup-button-cancel"></button>'; window.document.body.append(d); return d; };
    try {
        for (const step of ['ok', 'cancel', 'none']) {
            const ko = { Lobby: '로비' };
            const f = fakeTarget({ ko }); f.ko = ko; f.mb.core.app.current.snaps = new Map();
            const tm = fakeTimers(); slowTr(f, tm);
            const fill = T.createTrFill(f.mb, { doc: window.document, now: tm.now, timers: tm.timers, toast: null, chatId: () => 'A' });
            f.mb.tr.missingTr = () => ['Office'];
            fill.onClick({ target: sheetBtn(), isTrusted: true });
            if (step === 'none') { await tm.run(11000); assert.equal(f.calls.json.length, 0, '확인 창을 못 봤으면 먼저 안 보내요'); fill.mbToast('success', '1개 번역했어요.'); await tm.run(3000); assert.deepEqual(f.calls.json, [['Lobby']], '그 확장 번역 뒤에는 예전처럼'); continue; }
            await tm.run(100); const d = confirm(); await tm.run(1000);
            assert.equal(f.calls.json.length, 0, '확인 창이 떠 있는 동안은 안 보내요');
            if (step === 'cancel') fill.onClick({ target: d.querySelector('.popup-button-cancel'), isTrusted: true });
            d.remove(); await tm.run(2000);
            assert.equal(f.calls.json.length, step === 'ok' ? 1 : 0, step);
        }
    } finally { delete globalThis[REG]; window.document.querySelectorAll('dialog').forEach(d => d.remove()); }
});
await test('1.7.9 묶음 고르기: 보이는 글부터(흐린 점 이름 → 짧은 글 → 긴 글 → 카드 설명) · 첫 묶음만 작게 · 다 합쳐 작으면 한 번에', () => {
    const long = 'x'.repeat(300);
    assert.deepEqual(T.viewOrder(['A long sentence that is surely more than forty letters.', 'Chip', 'Desc', 'Name'], { first: new Set(['Name']), last: new Set(['Desc']) }), ['Name', 'Chip', 'A long sentence that is surely more than forty letters.', 'Desc']);
    assert.deepEqual(T.quickBatches(['a', 'b', 'c']), [['a', 'b', 'c']], '작으면 나누지 않아요');
    assert.deepEqual(T.quickBatches(['Lobby', 'Hall', long, long, long]), [['Lobby', 'Hall'], [long, long, long]], '이름만 먼저');
    const many = Array.from({ length: 30 }, (_, i) => `Item ${i}`);
    const b = T.quickBatches(many); assert.equal(b[0].length, 12); assert.equal(b.flat().length, 30); assert.equal(b.length, 2);
    assert.deepEqual(T.quickBatches([long, long, long]).map(x => x.length), [2, 1], '긴 글만이면 600자까지 먼저');
    assert.deepEqual(T.quickBatches([]), []);
});

await test('1.8.8 이름만 한국어인 섞인 값(「이름\'s Birthday」): 알아보기 · 사슬 · 같은 틀에서 이름만 끼우기 · 조사 받침 · 거꾸로 든 짝 · 📌 · 두 번째는 그대로 · 번역 호출 0', async () => {
    // 알아보기
    assert.deepEqual(T.nameOnlyValue("Robin's Birthday", "로빈's Birthday"), { pre: '', post: "'s Birthday", name: 'Robin', ko: '로빈' });
    assert.ok(T.nameOnlyValue('Dinner with Robin', 'Dinner with 로빈'), '뒤에 이름');
    assert.equal(T.nameOnlyValue('Morning:Front Desk', '아침:Front Desk'), null, '일과 조각(고정 낱말)은 테마가 일부러 넣은 짝');
    assert.equal(T.nameOnlyValue('item: +Plum Tea', 'item: +매실차'), null, '코드 머리만 남으면 아님');
    assert.equal(T.nameOnlyValue("Robin's Birthday", '로빈의 생일'), null, '다 번역된 값');
    assert.equal(T.nameOnlyValue('Gale vs. the Pier', '게일 vs. 부두'), null);
    // 조사 받침
    assert.equal(T.fillFrame('\u0000의 생일', '로빈'), '로빈의 생일');
    assert.equal(T.fillFrame('\u0000는 휴가', '마렌'), '마렌은 휴가');
    assert.equal(T.fillFrame('\u0000은 휴가', '로아'), '로아는 휴가');
    assert.equal(T.fillFrame('\u0000과 산책', '로아'), '로아와 산책');
    assert.equal(T.fillFrame('\u0000로 가는 길', '마렌'), '마렌으로 가는 길');
    assert.equal(T.fillFrame('\u0000으로 가는 길', '로아'), '로아로 가는 길');
    assert.equal(T.fillFrame('\u0000으로 가는 길', '하늘'), '하늘로 가는 길', '받침 ㄹ 은 「로」');
    // 사전 짝 고르기
    const dict = {
        Robin: '로빈', Gale: '게일', Maren: '마렌',
        "Robin's Birthday": "로빈's Birthday",          // 사슬(섞인 글 자체의 번역)이 있음
        "로빈's Birthday": '로빈의 생일',
        "Gale's Birthday": '게일의 생일', "Maren's Birthday": '마렌의 생일',
        "Toma's Birthday": "토마's Birthday",            // 사슬 없음 → 같은 틀(「X's Birthday → X의 생일」)
        "Toma's Room": "토마's Room",                    // 틀을 읽을 짝 없음 → 번역 길로
        "로아's Day Off": "Roa's Day Off",               // 거꾸로 든 짝
        "Roa's Day Off": "로아's Day Off", "Gale's Day Off": '게일의 휴무일',
        "Pinned's Birthday": "핀's Birthday",
    };
    const memo = new Map();
    const got = Object.fromEntries(T.mixedNamePairs(dict, { "Pinned's Birthday": true }, new Set(['Robin']), memo));
    assert.equal(got["Robin's Birthday"], '로빈의 생일', '사슬');
    assert.equal(got["Toma's Birthday"], '토마의 생일', '같은 틀');
    assert.equal(got["Roa's Day Off"], '로아의 휴무일');
    assert.equal(got["로아's Day Off"], '로아의 휴무일', '거꾸로 든 짝도 한국어로');
    assert.equal("Toma's Room" in got, false, '틀이 없으면 AI 없이 고치지 않음');
    assert.equal("Pinned's Birthday" in got, false, '📌 한 짝');
    assert.equal(Object.keys(got).some(k => !/[가-힣]/.test(got[k])), false);
    // tidy: 사전만 고치고(데이터 그대로) · 두 번째는 같은 결과 · 번역 호출 0
    const f = fakeTarget();
    f.app.current.snaps = new Map();
    const events = [{ m: 3, d: 14, title: "Toma's Birthday" }, { m: 3, d: 20, title: "Gale's Birthday" }];
    f.app.current.state = { core: {}, data: { calendar: { events }, quest: { list: [{ title: "Toma's Room" }] } }, recent: [] };
    reset(f.meta, { tr: { ...dict }, trLock: {}, notes: [] });
    const before = JSON.stringify(f.app.current.state);
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A' });
    fill.tidy({ draw: false });
    assert.equal(f.meta.tr["Toma's Birthday"], '토마의 생일');
    assert.equal(f.meta.tr["Robin's Birthday"], '로빈의 생일');
    assert.equal(JSON.stringify(f.app.current.state), before, '달력 · 퀘스트 데이터는 그대로');
    assert.equal(f.calls.json.length, 0, 'AI 0');
    const snap = JSON.stringify(f.meta);
    fill.tidy({ draw: false });
    assert.equal(JSON.stringify(f.meta), snap, '두 번째도 같은 결과');
    // 남은 섞인 값(틀 없음)만 번역 길의 반쯤 번역 짝으로 · 고친 것은 안 보냄
    const gaps = fill.stateGaps(f.app.current.state, f.meta.tr);
    assert.deepEqual(gaps.half, ["Toma's Room"]);
});
console.log(`ext-bridge-tr: ${passed} 통과`);
