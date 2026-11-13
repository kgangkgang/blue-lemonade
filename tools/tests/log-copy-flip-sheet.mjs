// 로그 복사 「전환 넣기」 켬끔 — 창에서: 밝기 옆 칩(기본 끔) · 켜면 한 줄(얼마나 커지는지) · 이 기기에 기억 · 못 다는 글꾸는 흐리게 + 까닭 한 줄 · 설정 꼴은 그대로
//   창을 가짜 브라우저(leak-dom)로 열어 꼴과 상태만 봐요(미리보기 문서는 없어요 — 알약 · 복사 글은 log-copy-flip.mjs · log-copy-flip-browser.mjs).
//   node tools/tests/log-copy-flip-sheet.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack || error}`); } finally { document.querySelector('dialog.bl-lc')?.close(); await settle(); } };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const { ctx } = dom.installBrowser({ settings: { enabled: true } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
globalThis.toastr = { info() {}, success() {}, warning() {}, error() {}, clear() {} };

const S = await import(url('src/settings.js'));
const sheet = await import(url('src/log-copy-sheet.js'));
const sample = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/mart-picks-sample.json'), 'utf8'));
const { readMart, addMartItems } = await import(url('src/mart-import.js'));

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나은 하늘을 보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루이 물었다.')] };
const BASE = { on: true, shape: 'card', palette: '', category: 'basic', recent: ['card'], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };
const received = (key) => {
    const raw = sample.items[key], s = { logCopy: { custom: [] } };
    addMartItems(s, readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, emoji: raw.emoji, html: raw.html, set: { blGeulkku: 2 } }] })).items);
    return s.logCopy.custom[0];
};
const KEY = 'bl-lc-flip', NONE = '이 글꾸는 낮 · 밤 두 판이 없어요';

async function open(logCopy = BASE) {
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone(logCopy), captureTools: { redact: false, names: [], mask: 'auto', maskWord: '○○' } };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    const click = async (sel) => { const b = pick(sel); assert.ok(b, `없음: ${sel}`); b.click(); await settle(200); };
    const chip = () => pick('[data-lc="flip"]'), note = () => pick('[data-lc-flip-note]');
    return { dialog, pick, click, chip, note, store: () => S.getSettings().logCopy, state: () => ({ pressed: chip().getAttribute('aria-pressed'), off: chip().getAttribute('aria-disabled'), note: note().hidden ? null : note().textContent }) };
}

await test('꼴: 밝기 단추 바로 뒤 칩 하나 · 글자는 「전환 넣기」 · 해 · 달 아이콘 · 이름표(aria-label) · 까닭 줄은 그 아래 따로 · 기본 끔', async () => {
    localStorage.removeItem(KEY);
    const w = await open();
    const row = w.pick('[data-lc-colors]'), kids = [...row.children].map(el => el.className);
    assert.deepEqual(kids.slice(0, 2), ['bl-lc-mode salty-mode-switch', 'bl-lc-chip bl-lc-flip'], '밝기(1.2.4 공용 밝기 스위치) → 전환 넣기');
    assert.equal(w.chip().querySelector('span').textContent, '전환 넣기');
    assert.equal(w.chip().getAttribute('aria-label'), '낮 · 밤 전환 넣기');
    assert.deepEqual([...w.chip().querySelectorAll('i')].map(i => i.className), ['fa-regular fa-sun', 'fa-regular fa-moon'], '밝기 단추와 같은 해 · 달');
    assert.ok(!/[낮밤]/.test(w.chip().textContent), '보이는 글자에 「낮」 「밤」 없음');
    assert.deepEqual(w.state(), { pressed: 'false', off: 'false', note: null }, '기본 글꾸 새 틀(카드): 끔 · 켤 수 있음 · 줄 없음');
    assert.equal(localStorage.getItem(KEY), null);
    assert.equal(w.note().getAttribute('role'), 'status');
});

await test('켜기 · 기억: 켜면 「복사 글 +n.nKB(모두 n.nKB)」 한 줄 · 이 기기에 기억(다시 열어도 켬) · 끄면 지워요 · 저장된 설정 꼴은 그대로', async () => {
    localStorage.removeItem(KEY);
    let w = await open();
    const before = JSON.stringify(w.store());
    await w.click('[data-lc="flip"]');
    assert.equal(w.state().pressed, 'true');
    assert.match(w.state().note, /^복사 글 \+\d\.\dKB\(모두 \d+\.\dKB\)$/);
    assert.equal(localStorage.getItem(KEY), '1');
    assert.equal(JSON.stringify(w.store()), before, '설정(logCopy)에는 아무것도 안 적어요');
    w.dialog.close(); await settle();
    w = await open();
    assert.equal(w.state().pressed, 'true', '다시 열어도 켠 채');
    assert.match(w.state().note, /^복사 글 \+/);
    await w.click('[data-lc-mode="dark"]');
    assert.equal(w.state().pressed, 'true', '밝기를 바꿔도 켠 채(처음 판만 바뀌어요)');
    await w.click('[data-lc="flip"]');
    assert.deepEqual(w.state(), { pressed: 'false', off: 'false', note: null });
    assert.equal(localStorage.getItem(KEY), null);
    w.dialog.close(); await settle();
    w = await open();
    assert.equal(w.state().pressed, 'false', '끈 것도 기억');
});

await test('되는 글꾸: 블루레몬 추천 · 마트에서 받은 심플 글꾸도 켜져요', async () => {
    localStorage.setItem(KEY, '1');
    let w = await open({ ...BASE, category: 'pick' });
    await w.click('[data-shape="simple-k1014"]');
    assert.equal(w.state().off, 'false');
    assert.equal(w.state().pressed, 'true');
    assert.match(w.state().note, /^복사 글 \+/);
    w.dialog.close(); await settle();
    const mine = received('k2');
    w = await open({ ...BASE, category: 'mine', shape: mine.id, custom: [mine] });
    assert.deepEqual([w.state().off, w.state().pressed], ['false', 'true'], '받은 심플 글꾸');
    assert.match(w.state().note, /^복사 글 \+/);
    localStorage.removeItem(KEY);
});

await test('안 되는 글꾸(깡통 로그 틀 · 에이드 색 틀 · 붙여 넣은 HTML): 흐리게 · 꺼 뒀으면 줄 없이 조용히 · 누르면 까닭 한 줄 · 켜 둔 채 오면 까닭이 바로 보여요', async () => {
    localStorage.removeItem(KEY);
    let w = await open({ ...BASE, shape: 'kkangtong' });
    assert.deepEqual(w.state(), { pressed: 'false', off: 'true', note: null }, '깡통 로그: 흐림 · 줄 없음');
    assert.equal(w.chip().title, NONE);
    assert.ok(w.pick('[data-lc-colors]').classList.contains('bl-lc-flip-idle'), '폰에서는 줄을 늘리지 않아요');
    await w.click('[data-lc="flip"]');
    assert.equal(w.state().note, NONE, '누르면 까닭');
    assert.equal(w.state().pressed, 'false');
    assert.equal(localStorage.getItem(KEY), null, '못 다는 글꾸에서 눌러도 켜지지 않아요');
    await w.click('[data-lc="flip"]');
    assert.equal(w.state().note, null, '다시 누르면 접혀요');
    w.dialog.close(); await settle();
    localStorage.setItem(KEY, '1');
    w = await open({ ...BASE, shape: 'kkangtong' });
    assert.deepEqual(w.state(), { pressed: 'false', off: 'true', note: NONE }, '켜 둔 채 못 다는 글꾸로 오면 까닭이 보여요');
    if (!w.pick('[data-shape="card"]')) await w.click('[data-lc="more"]');   // 깡통 로그 틀은 접힌 채 열려요 — 펼쳐서 다른 틀로
    await w.click('[data-shape="card"]');
    assert.equal(w.state().off, 'false');
    assert.equal(w.state().pressed, 'true', '되는 글꾸로 돌아오면 다시 켜져 있어요');
    w.dialog.close(); await settle();
    localStorage.removeItem(KEY);
    const raw = { id: 'c1', name: '내 글꾸 1', html: '<div class="box"><p>붙여 넣은 글꾸</p></div>', slot: 'auto' };
    w = await open({ ...BASE, category: 'mine', shape: 'c1', custom: [raw] });
    assert.deepEqual(w.state(), { pressed: 'false', off: 'true', note: null }, '붙여 넣은 HTML: 흐림');
    assert.ok(w.pick('[data-lc-colors] > .bl-lc-mode').hidden, '밝기 단추는 예전처럼 숨김');
    assert.ok(w.pick('[data-lc-hd-mode]').hidden);
    assert.ok(w.pick('[data-lc-pals]').hidden);
    await w.click('[data-lc="flip"]');
    assert.equal(w.state().note, NONE);
});

console.log(`log-copy-flip-sheet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
