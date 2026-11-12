// 1.1.7 뺀 옛 내장 글꾸 48종 — 로그 복사 창을 가짜 브라우저(leak-dom)로 실제로 열어 봐요(검토 11-12) · 1.1.8 9초 알림 → 시트 안 띠 · 복사 뒤에도 옛 id 기억(retiredFrom)
//   저장된 모양 · 즐겨찾기 · 최근 · 분류에 옛 id 가 남아 있어도 창이 뜨고, 고른 틀 · 안내 · 저장 값이 맞는지.
//   node tools/tests/log-copy-retired-sheet.mjs .
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack || error}`); } finally { document.querySelector('dialog.bl-lc')?.close(); document.querySelector('dialog.bl-lc')?.remove(); await settle(); } };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx } = dom.installBrowser({ settings: { enabled: true } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
const toasts = [];
globalThis.toastr = { info(...a) { toasts.push(a); }, success() {}, warning() {}, error() {}, clear() {} };
const opened = [];
window.open = (...a) => { opened.push(a); return null; };
globalThis.open = window.open;
globalThis.isSecureContext = true;
try { Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); } catch { globalThis.navigator.clipboard = { writeText: async () => {} }; }

const S = await import(url('src/settings.js'));
const sheet = await import(url('src/log-copy-sheet.js'));
const { PAGES } = await import(url('src/repo.js'));

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나은 하늘을 보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루이 물었다.')] };
const BASE = { on: true, shape: 'card', palette: '', category: 'basic', recent: [], fav: [], custom: [], blank: [], lemonLink: false };
// 1.0.8 「글자색 바꿔 내 글꾸에 저장」 · 옛 붙여넣기로 생긴 틈 템플릿 내 글꾸(마트 「일러스트」 틀처럼 id 가 옛 내장 id 와 같을 수 있어요)
const TPL = id => ({ id, name: '빼빼로데이 · 내 색', html: '', template: '<div>{{messages}}</div>', colors: {}, messages: 'box', tail: '', emoji: '', slot: null });

async function open(logCopy) {
    toasts.length = 0; opened.length = 0;
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone({ ...BASE, ...logCopy }), captureTools: { redact: false, names: [], mask: 'auto', maskWord: '○○' } };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const on = () => dialog.querySelector('[data-shape][aria-checked="true"], [data-shape].is-on, [aria-checked="true"][data-shape]')?.dataset.shape ?? null;
    return { dialog, on, store: () => S.getSettings().logCopy, chips: () => [...dialog.querySelectorAll('[data-shape]')].map(b => b.dataset.shape) };
}

const band = w => w.dialog.querySelector('[data-lc-retired]');
const bandOn = w => !band(w).hidden;
const copyText = async (w) => { w.dialog.querySelector('[data-lc="md"]').click(); await settle(); };

await test('옛 내장 빼빼로데이(새 판 안 받음): 창이 뜨고 깡통 로그 · 1.1.8 알림 대신 시트 안 띠(이름 · 마트 #simple-k1317 · 붙여 넣기) · 저장 값은 그대로', async () => {
    const w = await open({ shape: 'concept-sp-pepero', category: 'event', fav: ['concept-sp-pepero', 'c-xmas-sp-1', 'card'], recent: ['concept-sp-pepero', 'c-react-sp-2'] });
    assert.equal(w.on(), 'kkangtong');
    assert.equal(toasts.length, 0, '9초 알림은 없어요');
    assert.ok(bandOn(w), '띠가 보여요');
    assert.match(band(w).textContent, /빼빼로데이/);
    assert.equal(band(w).querySelector('a[href]').getAttribute('href'), `${PAGES}/mart/geulkku/?view#simple-k1317`);
    assert.equal(band(w).querySelector('a[href]').getAttribute('target'), '_blank');
    band(w).querySelector('[data-lc="paste"]').click();
    assert.equal(w.dialog.querySelector('[data-lc-paste]').hidden, false, '띠의 「붙여 넣기」 → 붙여 넣기 칸');
    assert.equal(w.store().shape, 'concept-sp-pepero', '열기만 해서는 저장 값이 안 바뀌어요');
    assert.equal(w.store().retiredFrom, 'concept-sp-pepero', '옛 id 를 기억해요');
    assert.ok(!w.chips().some(id => /-sp-/.test(id)), '옛 id 칩은 안 보여요');
});

await test('옛 장면 사랑 재판(11-12 마트 새 판 k1379): 깡통 로그 · 띠에 마트 바로가기 #simple-k1379', async () => {
    const w = await open({ shape: 'c-scene-sp-1', category: 'scene' });
    assert.equal(w.on(), 'kkangtong');
    assert.equal(toasts.length, 0);
    assert.ok(bandOn(w));
    assert.match(band(w).textContent, /사랑 재판/);
    assert.doesNotMatch(band(w).textContent, /이제 없어요/);
    assert.equal(band(w).querySelector('a[href]').getAttribute('href'), `${PAGES}/mart/geulkku/?view#simple-k1379`);
});

await test('1.0.1 시험판의 더 옛 id(concept-xmas)도 같은 띠 · 마트 #simple-k1091', async () => {
    const w = await open({ shape: 'concept-xmas' });
    assert.equal(w.on(), 'kkangtong');
    assert.equal(band(w).querySelector('a[href]').getAttribute('href'), `${PAGES}/mart/geulkku/?view#simple-k1091`);
});

await test('띠는 처리될 때까지 남아요 — 다시 열어도 그대로 · ✕ 로 닫으면 저장돼 다음에도 닫힌 채(옛 id 기억은 그대로)', async () => {
    let w = await open({ shape: 'concept-sp-pepero' });
    assert.ok(bandOn(w));
    w.dialog.close(); w.dialog.remove(); await settle();
    await sheet.openLogSheet(model); await settle();
    let d = document.querySelector('dialog.bl-lc');
    assert.equal(d.querySelector('[data-lc-retired]').hidden, false, '다시 열어도 띠');
    d.querySelector('[data-lc="retired-x"]').click(); await settle();
    assert.equal(d.querySelector('[data-lc-retired]').hidden, true, '✕ 로 닫혀요');
    assert.equal(S.getSettings().logCopy.retiredOff, true);
    d.close(); d.remove(); await settle();
    await sheet.openLogSheet(model); await settle();
    d = document.querySelector('dialog.bl-lc');
    assert.equal(d.querySelector('[data-lc-retired]').hidden, true, '닫은 띠는 다음에도 닫힌 채');
    assert.equal(S.getSettings().logCopy.retiredFrom, 'concept-sp-pepero', '옛 id 는 그대로 기억');
    toasts.length = 0;
});

await test('깡통 로그로 복사해 모양이 바뀌어도 옛 id 를 기억 → 나중에 마트 새 판을 받으면 이어 그려요 · 그 판으로 복사하면 기억을 지워요', async () => {
    const w = await open({ shape: 'concept-sp-pepero' });
    await copyText(w);
    let lc = S.getSettings().logCopy;
    assert.equal(lc.shape, 'kkangtong', '복사하면 저장 모양은 깡통 로그');
    assert.equal(lc.retiredFrom, 'concept-sp-pepero', '옛 id 는 남아요(전엔 사라져 나중에 새 판을 받아도 안 이어졌어요)');
    // 설정 정리를 거쳐도 남아요
    S.invalidateSettings();
    assert.equal(S.getSettings().logCopy.retiredFrom, 'concept-sp-pepero');
    // 나중에 마트 새 판을 받음
    const frame = { key: 'k1317', html: '<div class="gk"></div>', rows: {}, roots: {}, paper: {} };
    S.getSettings().logCopy.custom.push({ id: 'simple-k1317', name: '빼빼로데이', html: '', emoji: '🥢', frame, set: { blGeulkku: 2 }, slot: null });
    await sheet.openLogSheet(model); await settle();
    const d = document.querySelector('dialog.bl-lc');
    assert.equal(d.querySelector('[data-shape][aria-checked="true"]')?.dataset.shape, 'simple-k1317', '새 판으로 이어 그려요');
    assert.equal(d.querySelector('[data-lc-retired]').hidden, true, '이어졌으면 띠 없음');
    d.querySelector('[data-lc="md"]').click(); await settle();
    lc = S.getSettings().logCopy;
    assert.equal(lc.shape, 'simple-k1317');
    assert.ok(!lc.retiredFrom, '다 끝났으면 기억을 지워요');
    S.invalidateSettings();
    assert.ok(!('retiredFrom' in S.getSettings().logCopy), '설정 정리는 빈 기억을 남기지 않아요');
});

await test('깡통 로그가 아닌 다른 틀을 골라 복사하면 — 다 끝난 일로 봐요(띠 · 기억 없음)', async () => {
    const w = await open({ shape: 'concept-sp-pepero' });
    w.dialog.querySelector('[data-lc="more"]').click(); await settle();
    w.dialog.querySelector('[data-cat="basic"]')?.click(); await settle();
    const other = w.chips().find(id => id !== 'kkangtong' && !id.startsWith('simple-'));
    w.dialog.querySelector(`[data-shape="${other}"]`).click(); await settle();
    assert.equal(bandOn(w), false, '다른 틀로 바꾸면 띠는 숨어요');
    await copyText(w);
    const lc = S.getSettings().logCopy;
    assert.equal(lc.shape, other);
    assert.ok(!lc.retiredFrom);
});

await test('내 글꾸의 id 가 옛 내장 id 와 같으면 — 내 글꾸가 먼저예요(기본 틀로 바꾸거나 「테마에 없어요」 안내를 띄우지 않아요)', async () => {
    const w = await open({ shape: 'concept-pepero', category: 'mine', custom: [TPL('concept-pepero')] });
    assert.equal(toasts.length, 0, `안내 ${JSON.stringify(toasts.map(t => t[0]))}`);
    assert.ok(w.chips().includes('concept-pepero'), '내 글꾸 칩');
    assert.equal(w.on(), 'concept-pepero');
});

await test('마트 새 판(simple-k1317)을 받아 뒀으면 그 글꾸로 이어서 · 안내 없음', async () => {
    const frame = { key: 'k1317', html: '<div class="gk"></div>', rows: {}, roots: {}, paper: {} };
    const w = await open({ shape: 'concept-sp-pepero', custom: [{ id: 'simple-k1317', name: '빼빼로데이', html: '', emoji: '🥢', frame, set: { blGeulkku: 2 }, slot: null }] });
    assert.equal(toasts.length, 0);
    assert.equal(bandOn(w), false);
    assert.equal(w.on(), 'simple-k1317');
});

console.log(`log-copy-retired-sheet: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
