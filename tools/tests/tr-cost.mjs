// 1.9.2 번역 비용 — 같은 글을 다시 번역 요청하지 않는지 「요청 수 · 보낸 글자 수」로 세요(가짜 확장 · 가짜 번역기 · 유료 호출 0).
//   node tools/tests/tr-cost.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   ① 숨긴 고정 꼴 짝(번역기가 준 「March 20 → 3월 20일」 꼴): 채팅을 다시 열어도(채팅 파일 왕복) 그 확장이 같은 글을 또 보내지 않아요
//      · 테마가 스스로 만드는 고정 낱말 짝은 적어 두지 않아요 · 「번역 고치기」에서 지운 짝은 되살리지 않아요 · 📌 고정 열쇠는 그대로
//   ② 상태 칸 · 지도 글 메우기에 물을 낱말 없는 글(아이디 · 주소 · 약어)을 안 실어요 — 보낸 글자 수
//   ③ 속마음 번역: 점자 빈칸 · 보통 빈칸만 다른 같은 글은 한 번만 보내요(대기 · 보내는 중 · 번역 단추 목록)
//   ④ 영어 속마음: 속마음 번역이 보내는 중이거나 받은 글은 미트볼 메우기가 또 보내지 않아요(받은 짝은 그 확장 사전에도)
//   글은 모두 이 시험이 지은 가짜예요(채팅 본문 · 캐릭터 이름 없음).
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const dom = new JSDOM('<!doctype html><html><body><div id="chat"></div></body></html>');
const { window } = dom;
for (const k of ['MutationObserver', 'Node', 'NodeFilter']) globalThis[k] = window[k];
const T = await import(pathToFileURL(path.join(root, 'src/ext-bridge-tr.js')).href);
const M = await import(pathToFileURL(path.join(root, 'src/mb-mind-tr.js')).href);

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const tick = () => new Promise(r => setTimeout(r, 0));
const BL = '⠀';

/** 가짜 번역기 — 부른 수 · 보낸 글자 수를 세요(지시문 몫은 셈에 넣지 않아요) */
function counter(ko = s => `〔${s}〕`) {
    const c = { n: 0, chars: 0, texts: [] };
    c.list = async list => { c.n++; for (const s of list) { c.chars += s.length; c.texts.push(s); } return list.map(ko); };
    return c;
}
/** 가짜 확장 한 채팅: 상태 · 사전(채팅 메타 tr) · 자체 자동 번역(사전에 없는 상태 글만 보내요 — 그 확장 규칙을 흉내 낸 것) */
function fakeMb({ meta, chatMeta, state, bill }) {
    const sub = t => { let out = t; for (const [en, k] of Object.entries(meta.tr).sort((a, b) => b[0].length - a[0].length)) out = out.split(en).join(k); return out; };
    const tr = {
        translateView() {}, trString: sub, missingTr: () => [],
        async trJSON(src) { return { list: await bill.list(src.list) }; },
        addPairs(pairs) { let n = 0; for (const [a, b] of pairs) { if (meta.tr[a] === b) continue; delete meta.tr[a]; meta.tr[a] = b; n++; } return n; },
    };
    const core = { app: { current: { state, snaps: new Map() } }, getMeta: () => meta, viewTr: () => true, settings: () => ({ trAuto: 'always', trEngine: 'llm' }), saveMeta() {} };
    /** 그 확장 자동 번역(fillNew) 흉내: 사전에 없는 상태 글 */
    const ownFill = async () => { const need = state.texts.filter(k => !Object.hasOwn(meta.tr, k)); if (need.length) tr.addPairs((await tr.trJSON({ list: need })).list.map((v, i) => [need[i], v])); return need.length; };
    return { mb: { tr, core, busy: () => false }, ownFill, chatMeta };
}
/** 채팅 파일 왕복(JSON) — 셀 수 없는 칸(숨긴 짝)은 빠져요 */
const roundTrip = v => JSON.parse(JSON.stringify(v));

await test('① 숨긴 고정 꼴 짝: 다시 열어도 그 확장이 같은 글을 또 안 보냄 · 값은 받은 그대로', async () => {
    const bill = counter(s => (s === 'March 20' ? '3월 20일' : `〔${s}〕`));
    // 상태 글: 날짜 꼴(일정 칸 — 테마 고정 낱말 칸이 아니라 테마는 짝을 못 만들어요) · 보통 글
    const state = { texts: ['March 20', 'Lantern Repair'], data: { calendar: { events: [{ title: 'Lantern Repair', when: 'March 20' }] } }, core: {} };
    let file = { meta: { tr: { Nora: '노라' } }, chatMeta: {} };
    for (let session = 1; session <= 3; session++) {
        const meta = file.meta, chatMeta = file.chatMeta;
        const f = fakeMb({ meta, chatMeta, state, bill });
        const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', kept: () => (chatMeta[T.KEPT_KEY] ||= {}), saveKept: () => {} });
        fill.tidy({ draw: false });   // 채팅을 열 때 테마 정리(되돌리기 포함)
        await f.ownFill();            // 그 확장이 번역할 글을 고름
        fill.tidy({ draw: false });   // 답 끝 · 다음 정리(숨기기 · 적어 두기)
        assert.equal(meta.tr['March 20'], '3월 20일', `${session}번째: 화면 값은 받은 그대로`);
        assert.equal(Object.keys(meta.tr).includes('March 20'), false, `${session}번째: 열쇠는 숨긴 채(낱말 바꾸기에서 빠짐 · 1.5.2 그대로)`);
        file = { meta: roundTrip(meta), chatMeta: roundTrip(chatMeta) };   // 채팅 파일에 적고 다음에 다시 읽음
    }
    // 고치기 전에는 열 때마다 「March 20」 을 다시 보냈어요(3번 열면 3통) — 이제 처음 한 번만
    assert.equal(bill.texts.filter(s => s === 'March 20').length, 1, '같은 날짜 글은 처음 한 번만 번역 요청');
    assert.equal(bill.n, 1);
    assert.deepEqual(file.chatMeta[T.KEPT_KEY], { 'March 20': '3월 20일' }, '테마 칸에는 번역기가 준 짝만');
});

await test('① 테마가 만드는 고정 낱말 짝은 적어 두지 않음 · 📌 고정 · 지운 짝', async () => {
    const dict = { Morning: '아침', 'Late Night': '늦은 밤', 'April 3': '4월 3일' };
    T.hideFixedKeys(dict);
    const store = {};
    assert.equal(T.keepHidden(dict, store, new Set(['Morning', 'Late Night'])), 1, '테마 몫(own)은 빼고');
    assert.deepEqual(store, { 'April 3': '4월 3일' });
    const next = {};
    assert.equal(T.restoreHidden(next, store, new Set(['April 3'])), 0, '📌 고정한 열쇠는 그대로 둠');
    assert.equal(T.restoreHidden(next, store), 1);
    assert.equal(next['April 3'], '4월 3일'); assert.equal(Object.keys(next).length, 0, '숨긴 칸으로');
    assert.equal(T.restoreHidden(next, store), 0, '이미 있으면 안 덮음');
    // 고정 꼴이 아닌 열쇠 · 값이 같은 짝 · 상한
    const big = {}; for (let i = 0; i < T.KEPT_MAX + 20; i++) Object.defineProperty(big, `March ${i % 28 + 1}, ${1900 + i}`, { value: `${i}`, enumerable: false, writable: true, configurable: true });
    const s2 = {}; T.keepHidden(big, s2); assert.ok(Object.keys(s2).length <= T.KEPT_MAX, '상한');
    // 「번역 고치기」 창에서 지운 짝은 창을 닫은 뒤 적어 둔 것에서도 빠져요
    const state = { texts: [], data: {}, core: {} };
    const meta = { tr: {} }, chatMeta = { [T.KEPT_KEY]: { 'March 20': '3월 20일' } };
    const f = fakeMb({ meta, chatMeta, state, bill: counter() });
    let opened = false; f.mb.core.app.openTrFix = async () => { opened = true; delete meta.tr['March 20']; };
    const fill = T.createTrFill(f.mb, { doc: window.document, toast: null, chatId: () => 'A', kept: () => chatMeta[T.KEPT_KEY], saveKept: () => {}, timers: { setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {} } });
    fill.tidy({ draw: false }); assert.equal(meta.tr['March 20'], '3월 20일', '열 때 되돌림');
    fill.guardTrFix(); await f.mb.core.app.openTrFix(); assert.ok(opened);
    assert.equal(Object.hasOwn(meta.tr, 'March 20'), false);
    assert.deepEqual(chatMeta[T.KEPT_KEY], {}, '지운 짝은 적어 둔 것에서도 빠짐');
});

await test('② 상태 칸 메우기: 아이디 · 주소 · 약어는 안 실음(보낸 글자 수)', async () => {
    const state = { core: {}, data: { phone: { contacts: [{ handle: '@river_bird_77', note: 'Met at the harbor market' }], links: [{ url: 'https://example.invalid/page' }], stats: [{ label: 'HP', desc: 'Feeling rested today' }] } } };
    const meta = { tr: {} };
    const fill = T.createTrFill({ tr: { trString: s => s, translateView() {} }, core: { app: { current: { state } }, getMeta: () => meta, viewTr: () => true, settings: () => ({}) }, busy: () => false }, { doc: window.document, toast: null, kept: () => ({}), saveKept: () => {} });
    const { miss } = fill.stateGaps(state, meta.tr);
    assert.deepEqual(miss.sort(), ['Feeling rested today', 'Met at the harbor market'], '물을 낱말 있는 글만');
    assert.equal(T.noWordsToAsk(`${BL}@river_bird_77${BL}`), true, '점자 빈칸 껍데기도');
    assert.equal(T.noWordsToAsk('Pine Trail'), false);
    assert.equal(T.noWordsToAsk('http://not a link but a sentence'), false, '빈칸 든 글은 주소로 안 봄');
    // 칩 덩이 고르기(skipPart)는 예전 그대로
    assert.equal(T.skipPart('http://a b c'), true); assert.equal(T.skipPart('Pine Trail'), false);
});

await test('③ 속마음 번역: 점자 빈칸 · 보통 빈칸만 다른 같은 글은 한 번만 보냄', async () => {
    const A = `今日はいい天気${BL}(^_^)`, B = '今日はいい天気 (^_^)';
    const sent = [];
    const state = { turn: 2, data: { rel: { user: [{ name: '아린', mind: { text: A, turn: 2 }, mindLog: [{ text: B, turn: 1 }] }] }, profile: { list: [] } }, watch: [] };
    const mb = {
        core: { app: { current: { state } }, settings: () => ({ ssGenLang: 'enview', trAuto: 'always', trEngine: 'llm', trCode: 'ko' }) },
        tr: { async trText(t) { sent.push(t); await tick(); return t.split('\n').map(() => '오늘은 날씨가 좋네 (^_^)').join('\n'); } },
    };
    const store = new Map();
    const mem = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const m = M.createMindTr(mb, { doc: window.document, storage: mem, toast: null, timers: globalThis, chatId: () => 'c1' });
    assert.equal(M.allMindTexts(state).length, 1, '번역 단추 목록: 같은 글 하나');
    await m.clickFill();
    assert.equal(sent.length, 1, '한 번만 보냄'); assert.equal(sent[0].split('\n').length, 1, '한 줄만');
    assert.equal(m.store.get('ko', B), '오늘은 날씨가 좋네 (^_^)', '보통 빈칸 꼴도 같은 번역');
    // 대기 · 보내는 중에 두 꼴이 같이 와도 한 번
    sent.length = 0; store.clear();
    const m2 = M.createMindTr(mb, { doc: window.document, storage: mem, toast: null, timers: globalThis, chatId: () => 'c2' });
    const el1 = window.document.createElement('span'), el2 = window.document.createElement('span');
    const box = window.document.createElement('div'); box.className = 'ss-scope'; window.document.body.append(box);
    el1.textContent = A; el2.textContent = B; box.append(el1, el2);
    m2.paintEl(el1); m2.paintEl(el2);
    await new Promise(r => setTimeout(r, 200)); await tick();
    assert.equal(sent.length, 1, '대기 줄에서도 한 번');
    assert.equal(sent[0].split('\n').length, 1, '한 줄');
    box.remove();
});

await test('④ 영어 속마음: 속마음 번역과 미트볼 메우기가 같은 글을 두 번 보내지 않음', async () => {
    const EN = 'I should have brought an umbrella today.';
    const meta = { tr: {} }, sent = [];
    const state = { turn: 4, core: {}, data: { rel: { user: [{ name: '아린', mind: { text: EN, turn: 4 }, mindLog: [] }] }, profile: { list: [] } }, watch: [] };
    let release; const gate = new Promise(r => { release = r; });
    const tr = {
        async trText(t) { sent.push(['text', t]); await gate; return t.split('\n').map(() => '오늘은 우산을 챙겼어야 했는데.').join('\n'); },
        addPairs(pairs) { for (const [a, b] of pairs) meta.tr[a] = b; return pairs.length; },
        trString: s => meta.tr[s] ?? s, translateView() {},
        async trJSON(src) { sent.push(['json', ...src.list]); return { list: src.list.map(s => `〔${s}〕`) }; },
    };
    const core = { app: { current: { state } }, getMeta: () => meta, viewTr: () => true, settings: () => ({ ssGenLang: 'enview', trAuto: 'always', trEngine: 'llm', trCode: 'ko' }) };
    const mem = new Map();
    const m = M.createMindTr({ core, tr }, { doc: window.document, storage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }, toast: null, chatId: () => 'c9' });
    const fill = T.createTrFill({ tr, core, busy: () => false }, { doc: window.document, toast: null, chatId: () => 'c9', kept: () => ({}), saveKept: () => {} });
    const go = m.clickFill();                 // 속마음 번역이 보내는 중
    await tick();
    assert.deepEqual(fill.stateGaps(state, meta.tr).miss, [], '보내는 중인 글은 메우기에 안 실음');
    release(); await go;
    assert.equal(meta.tr[EN], '오늘은 우산을 챙겼어야 했는데.', '받은 번역을 그 확장 사전에도');
    assert.deepEqual(fill.stateGaps(state, meta.tr).miss, [], '사전에 있으니 메우기에 안 실음');
    assert.equal(sent.length, 1, '번역 요청은 한 번');
});

console.log(`\n번역 비용 시험 ${passed}개 통과`);
