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

await test('⑫ 번역기가 다시 반쯤 돌려주면 옛 짝을 되돌리고(실리 번역 길) 이번 접속엔 다시 안 보냄 · 조각 짝은 단추 없이', async () => {
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
    assert.equal(await fill.fill('click'), 0);
    assert.equal(f.calls.json.length, 1, '못 바꾼 글은 다시 안 보냄');
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

console.log(`ext-bridge-tr: ${passed} 통과`);
