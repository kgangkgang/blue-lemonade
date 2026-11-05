// 정규식 창에서 직접 바꾼 정규식 기록 (1.0.1, src/regex-manual.js) — 가짜 문서 · 가짜 실리태번 문맥으로 누르기 → 기록 → 자동 맞춤이 건너뛸 id 를 검사. 네트워크 · DOM 없음.
//   node tools/tests/regex-manual.mjs [테마 루트]
// 11-03 제보: 정규식 창의 끄기 단추를 눌러도 다시 켜졌다 — 실리태번이 저장 뒤 채팅을 다시 그려(CHAT_CHANGED) 프롬프트 귀속 맞추기가 0.2초 뒤 되돌렸다.
// 확인하는 것:
//   1) 줄 스위치(.regex-toggle-on/off · input.disable_regex)를 캡처 단계로 받아 실리태번이 값을 바꾸기 전에 id 를 적는다 (값이 이미 같았어도 사용자 뜻)
//   2) 일괄 켜기/끄기는 고른 줄(.regex_bulk_checkbox 체크)만 적는다
//   3) 단추가 분명하지 않은 길(정규식 프리셋 고르기 · 편집 창 저장)은 누른 순간의 사진과 잠시 뒤 값을 견줘 달라진 id 만 적는다 — 전역 · 카드 · 프리셋 목록 모두
//   4) 정규식 화면 밖 누르기는 무시 · 감시는 한 벌만 · unwatch 뒤에는 적지 않는다
//   5) 기록 자리는 extension_settings.regex_link.manual (프롬프트 연동 정규식과 같은 객체) · 적으면 저장 · 지우기(forgetManual)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 가짜 실리태번 ─────────────────────────────────────────
const ctx = { extensionSettings: {}, saves: 0, saveSettingsDebounced() { ctx.saves++; } };
globalThis.SillyTavern = { getContext: () => ctx };

// ── 가짜 문서: 요소는 { matches: Set<selector 조각>, parent, id, checked, children } · closest 는 selector 를 ',' 로 나눠 조각마다 matches 로 본다
function node({ sel = [], id = '', parent = null, checked = false, children = [] } = {}) {
    const n = { id, checked, parent, kids: [], _sel: new Set(sel) };
    n.matches = s => s.split(',').map(x => x.trim()).some(x => n._sel.has(x) || (n.id && x === `#${n.id}`));
    n.closest = s => { for (let cur = n; cur; cur = cur.parent) if (cur.matches(s)) return cur; return null; };
    n.querySelectorAll = s => { const out = []; const walk = k => { for (const c of k.kids) { if (c.matches(s)) out.push(c); walk(c); } }; walk(n); return out; };
    n.querySelector = s => n.querySelectorAll(s)[0] || null;
    for (const c of children) { c.parent = n; n.kids.push(c); }
    return n;
}
function doc() {
    const listeners = new Map();
    return {
        listeners,
        addEventListener(type, fn, capture) { listeners.set(type, { fn, capture }); },
        removeEventListener(type, fn) { if (listeners.get(type)?.fn === fn) listeners.delete(type); },
        fire(type, target) { const l = listeners.get(type); if (l) l.fn({ type, target }); },
    };
}
/** 정규식 화면: #regex_container > .regex_settings > 줄들(.regex-script-label#id) — 줄마다 스위치 · 일괄 체크 */
function screen(ids) {
    const rows = ids.map(id => node({ sel: ['.regex-script-label'], id, children: [node({ sel: ['.regex-toggle-on'] }), node({ sel: ['.regex-toggle-off'] }), node({ sel: ['input.disable_regex'] }), node({ sel: ['.regex_bulk_checkbox'] })] }));
    const bulkOn = node({ id: 'bulk_enable_regex' }), bulkOff = node({ id: 'bulk_disable_regex' }), presetSelect = node({ sel: ['select'] });
    const settings = node({ sel: ['.regex_settings'], children: [...rows, bulkOn, bulkOff, presetSelect] });
    const container = node({ id: 'regex_container', children: [settings] });
    return { container, rows: Object.fromEntries(rows.map(r => [r.id, r])), bulkOn, bulkOff, presetSelect };
}
const R = (id, disabled = false) => ({ id, scriptName: id, disabled });

const RM = await import(pathToFileURL(path.join(root, 'src/regex-manual.js')));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const manual = () => ctx.extensionSettings.regex_link?.manual || {};
function fresh() {
    RM.unwatchRegexScreen();
    delete ctx.extensionSettings.regex_link; ctx.saves = 0;
    const lists = { global: [R('g1'), R('g2', true)], card: [R('c1')], preset: [R('p1'), R('p2')] };
    const d = doc(); const s = screen(['g1', 'g2', 'c1', 'p1', 'p2']);
    assert.equal(RM.watchRegexScreen(d, () => [lists.global, lists.card, lists.preset]), true);
    return { d, s, lists };
}
const SETTLE = Math.max(...RM._forTest.SETTLE_MS) + 80;

await test('기록 자리: extension_settings.regex_link.manual (없으면 만든다 · 배열이면 고친다) · 적으면 저장 · 지우기', () => {
    ctx.extensionSettings.regex_link = { manual: ['bad'] };
    assert.deepEqual(RM.manualStore(), {}, '배열은 객체로');
    assert.equal(RM.markManual(['a', 'b', 'a', '', null]), 2); assert.equal(ctx.saves, 1); assert.deepEqual(ctx.extensionSettings.regex_link.manual, { a: true, b: true });
    assert.equal(RM.isManual('a'), true); assert.equal(RM.isManual('zzz'), false); assert.equal(RM.isManual(''), false);
    assert.deepEqual(RM.manualIds().sort(), ['a', 'b']);
    assert.equal(RM.markManual(['a']), 0, '이미 적힌 것은 다시 저장하지 않는다'); assert.equal(ctx.saves, 1);
    assert.equal(RM.forgetManual(['a', 'nope']), 1); assert.equal(ctx.saves, 2); assert.deepEqual(RM.manualIds(), ['b']);
    assert.equal(RM.forgetManual([]), 0); assert.equal(ctx.saves, 2);
    delete ctx.extensionSettings.regex_link;
    assert.deepEqual(RM.manualStore(), {}, '없으면 만든다'); assert.equal(typeof ctx.extensionSettings.regex_link.manual, 'object');
});

await test('줄 스위치: 누른 순간(캡처) 그 줄의 id 를 적는다 — 실리태번이 값을 바꾸기 전 · 값이 같아도', async () => {
    const { d, s } = fresh();
    d.fire('click', s.rows.g1.querySelector('.regex-toggle-on'));
    assert.deepEqual(manual(), { g1: true }, '값을 아직 안 바꿨어도 적힌다 (실리태번 핸들러는 이 뒤에 돈다)');
    d.fire('click', s.rows.p2.querySelector('input.disable_regex'));
    d.fire('click', s.rows.c1.querySelector('.regex-toggle-off'));
    assert.deepEqual(Object.keys(manual()).sort(), ['c1', 'g1', 'p2'], '전역 · 프리셋 · 카드 줄 모두');
    assert.ok(ctx.saves >= 1);
    await sleep(SETTLE);
    assert.deepEqual(Object.keys(manual()).sort(), ['c1', 'g1', 'p2'], '잠시 뒤 견줌에서 더 적히는 것은 없다 (값이 안 바뀌었다)');
});

await test('일괄 켜기/끄기: 고른 줄만 적는다', async () => {
    const { d, s } = fresh();
    s.rows.g2.querySelector('.regex_bulk_checkbox').checked = true;
    s.rows.p1.querySelector('.regex_bulk_checkbox').checked = true;
    d.fire('click', s.bulkOn);
    assert.deepEqual(Object.keys(manual()).sort(), ['g2', 'p1']);
    d.fire('click', s.bulkOff);
    assert.deepEqual(Object.keys(manual()).sort(), ['g2', 'p1'], '같은 것을 또 눌러도 그대로');
    await sleep(SETTLE);
});

await test('정규식 프리셋 고르기(단추 없음): 누른 뒤 달라진 id 만 적는다 — 목록마다 저장을 기다려 늦게 바뀌는 것도', async () => {
    const { d, s, lists } = fresh();
    d.fire('change', s.presetSelect);
    assert.deepEqual(manual(), {}, '누른 순간엔 아무것도 모른다');
    lists.global[0].disabled = true;          // 바로 바뀌는 전역 목록
    await sleep(30);
    assert.deepEqual(manual(), { g1: true }, '0ms 사진 견줌');
    lists.preset[1].disabled = true;          // 저장을 기다린 뒤 바뀌는 프리셋 목록
    await sleep(SETTLE);
    assert.deepEqual(Object.keys(manual()).sort(), ['g1', 'p2']);
    assert.equal('g2' in manual(), false, '안 바뀐 것은 적지 않는다');
});

await test('편집 창 저장(확인 단추 · 창 안에 .regex_editor): 달라진 id 를 적는다 · 항목이 새 객체로 바뀌어도 id 로', async () => {
    const { d, lists } = fresh();
    const editor = node({ sel: ['.regex_editor'] });
    const ok = node({ sel: ['.popup-button-ok'] });
    node({ sel: ['dialog', '.popup'], children: [editor, ok] });
    d.fire('click', ok);
    lists.global[1] = R('g2', false);         // saveRegexScript: array[index] = 새 객체 (disabled 가 true → false)
    await sleep(120);
    assert.deepEqual(manual(), { g2: true });
    const plain = node({ sel: ['.popup-button-ok'] }); node({ sel: ['dialog', '.popup'], children: [node({ sel: ['.something_else'] }), plain] });
    d.fire('click', plain); lists.card[0].disabled = true; await sleep(120);
    assert.deepEqual(manual(), { g2: true }, '다른 창의 확인 단추는 보지 않는다');
    await sleep(SETTLE);
});

await test('화면 밖 누르기는 무시 · 감시는 한 벌만 · unwatch 뒤에는 적지 않는다 · 목록 함수가 던져도 멈추지 않는다', async () => {
    const { d, s, lists } = fresh();
    d.fire('click', node({ sel: ['.regex-toggle-on'], id: 'elsewhere' }));
    d.fire('click', null);
    assert.deepEqual(manual(), {});
    assert.equal(RM.watchRegexScreen(doc(), () => []), false, '두 번째 감시는 거절');
    assert.equal(RM._forTest.watching, true);
    RM.unwatchRegexScreen();
    assert.equal(RM._forTest.watching, false); assert.equal(d.listeners.size, 0, '듣기 해제');
    d.fire('click', s.rows.g1.querySelector('.regex-toggle-on'));
    assert.deepEqual(manual(), {});
    RM.unwatchRegexScreen();
    assert.equal(RM.watchRegexScreen(d, () => { throw new Error('목록 없음'); }), true);
    d.fire('click', s.rows.g1.querySelector('.regex-toggle-on'));
    assert.deepEqual(manual(), { g1: true }, '사진을 못 찍어도 누른 줄은 적힌다');
    await sleep(SETTLE);
    RM.unwatchRegexScreen();
    assert.equal(RM.watchRegexScreen(null, () => []), false); assert.equal(RM.watchRegexScreen(d, 'x'), false);
    void lists;
});

console.log(`\nregex-manual: ${passed} passed, 0 failed`);
