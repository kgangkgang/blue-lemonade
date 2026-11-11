// 1.1.3 로그 복사 창에 「깡통 로그」 틀 묶음 잇기 — 창을 가짜 브라우저(leak-dom)로 열어 봐요(리그 없이 · 미리보기는 iframe 에 넣는 글 srcdoc 으로 확인)
//   ① 새 설정은 깡통 로그로 열려요: 제목 · 알약 없음 · 색 칩 숨김(밝기만) · 인물표 색 · 말하는 사람 수에 따른 이름표 / 틀이 저장된 설정은 그 틀 그대로
//   ② 「더 보기」: 깡통 로그면 접힌 채(틀 셋 · 밝기 · 복사만) · 다른 틀을 쓰던 설정은 펼친 채 · 눌러 펼치고 접기
//   ③ 미리보기는 붙일 곳 흉내(바탕 · 코멘트 자리) · 복사 직전 점검을 거쳐요
//   node tools/tests/log-copy-connect-sheet-113.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
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
const { registerPeopleSource } = await import(url('src/people.js'));
const { tone, fitInk } = await import(url('src/shared/char-tone.js'));
const { TONE_SHAPES } = await import(url('src/log-copy-tone.js'));

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const nameStyle = { color: 'rgb(200, 200, 200)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650' };
const said = (color, text) => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'el', block: false, tag: 'span', style: { color: 'rgb(245, 245, 247)', 'background-image': `linear-gradient(transparent 5%, ${color} 5%, ${color} 100%, transparent 100%)` }, children: [{ t: 'text', text }] }] });
const one = (name, user, text, color) => ({ index: 0, user, name, nameStyle, time: 0, font, bubble: null, nodes: [said(color, text)] });
const base = { chatName: 'Mina', charName: 'Mina', userName: '하루', chatTitle: '어느 저녁 이야기', base: { bg: 'rgb(20, 31, 46)', ...font } };
const two = { ...base, messages: [one('Mina', false, '「어서 와요.」', 'rgba(59, 156, 240, 0.35)'), one('하루', true, '「다녀왔어.」', 'rgba(240, 150, 60, 0.35)')] };
const solo = { ...base, messages: [one('Mina', false, '「어서 와요.」', 'rgba(59, 156, 240, 0.35)'), one('Mina', false, '「저녁은 먹었어요?」', 'rgba(59, 156, 240, 0.35)')] };

const OLD = { on: true, shape: 'card', palette: '', category: 'basic', recent: ['card'], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };   // 1.1.3 기본 글꾸 새 틀의 정보 칸 · 높이(정리하면 늘 붙어요)
/** 설정을 갈아 끼우고(logCopy 를 안 주면 새 설정) 창을 열어요 */
async function open(model, logCopy) {
    ctx.extensionSettings.salty = logCopy === undefined ? { enabled: true } : { enabled: true, logCopy: structuredClone(logCopy) };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    return { dialog, pick, all: sel => [...dialog.querySelectorAll(sel)], doc: () => pick('[data-lc-frame]').srcdoc, mode: () => pick('[data-lc-mode][aria-pressed="true"]').dataset.lcMode, store: () => S.getSettings().logCopy };
}
const names = html => (html.match(/data-bl-name/g) ?? []).length;

// ── ① 깡통 로그로 열기 ─────────────────────────────────────────
await test('새 설정: 깡통 로그로 열려요 — 채팅 제목 · 알약 · 날짜 없이, 팔레트 색이 아니라 대사색 틀 · 레몬 바로가기 켬', async () => {
    const w = await open(two);
    assert.equal(w.pick('[data-shape][aria-checked="true"]').dataset.shape, 'kkangtong');
    const html = w.doc(), t = tone('#3b9cf0', { mode: w.mode(), plan: 'B' });
    assert.ok(html.includes(`background-color:${t.card}`) && html.includes(`background-color:${t.log}`), '무채 틀 면 · 로그 면');
    assert.ok(!html.includes('어느 저녁 이야기') && !/data-f="/.test(html), '제목 · 고치는 칸 없음');
    assert.ok(!/>LOG</.test(html), '알약 없음');
    assert.ok(html.includes('「어서 와요.」') && html.includes('「다녀왔어.」'));
    assert.equal(w.store().lemonLink, true); assert.equal(w.pick('[data-lc-lemon]').getAttribute('aria-pressed'), 'true');
});

await test('말하는 사람이 둘이면 이름표 · 한 명이면 없음 · 「이름 줄」을 끄면 없음', async () => {
    assert.equal(names((await open(two)).doc()), 2);
    assert.equal(names((await open(solo)).doc()), 0);
    assert.equal(names((await open(two, { ...OLD, shape: 'kkangtong', namesOff: true })).doc()), 0);
});

await test('색 칩은 숨기고 밝기만 — 밝기를 바꾸면 틀이 낮 · 밤으로 · 다른 틀로 가면 색 칩이 돌아와요', async () => {
    const w = await open(two);
    assert.equal(w.pick('[data-lc-colors]').hidden, false, '밝기 줄은 보여요');
    assert.equal(w.pick('[data-lc-pals]').hidden, true); assert.equal(w.all('[data-lc-pals] [data-palette]').length, 0);
    for (const mode of ['dark', 'light']) {
        w.pick(`[data-lc-mode="${mode}"]`).click(); await settle();
        assert.equal(w.mode(), mode);
        assert.ok(w.doc().includes(`background-color:${tone('#3b9cf0', { mode, plan: 'B' }).card}`), mode);
        assert.equal(w.pick('[data-lc-pals]').hidden, true);
    }
    const deep = tone('#3b9cf0', { mode: 'light', plan: 'C' });
    w.pick('[data-shape="kkangtong-deep"]').click(); await settle();
    assert.ok(w.doc().includes(`background-color:${deep.card}`), '진한 바탕');
    w.pick('[data-lc="more"]')?.getAttribute('aria-expanded') === 'false' && w.pick('[data-lc="more"]').click(); await settle();
    w.pick('[data-shape="status"]').click(); await settle();   // 1.1.3 카드는 기본 글꾸 새 틀(밝기만)이 돼서 팔레트 틀인 상태창으로 봐요
    assert.equal(w.pick('[data-lc-pals]').hidden, false); assert.ok(w.all('[data-lc-pals] [data-palette]').length > 0, '상태창은 색 칩');
    w.pick('[data-shape="card"]').click(); await settle();
    assert.equal(w.pick('[data-lc-pals]').hidden, true, '카드(기본 글꾸 새 틀)는 밝기만');
});

await test('인물표에 정해 둔 대사색이 있으면 그 색이 먼저 — 이름표 글자', async () => {
    const off = registerPeopleSource('connect-test', { person: list => (list.includes('Mina') ? { color: '#cc3377' } : null), names: () => ['Mina'], stamp: () => 1 });
    try {
        const w = await open(two), t = tone('#cc3377', { mode: w.mode(), plan: 'B' });
        assert.match(w.doc(), new RegExp(`<div data-bl-name style="color:${fitInk('#cc3377', t.log)};`));
    } finally { off(); }
    const w = await open(two), t = tone('#3b9cf0', { mode: w.mode(), plan: 'B' });
    assert.match(w.doc(), new RegExp(`<div data-bl-name style="color:${fitInk('#3b9cf0', t.log)};`), '없으면 화면에서 읽은 띠 색');
});

await test('제목은 「머리 칸」에서 적으면 생겨요(밑 2px 줄) — 다른 틀의 제목 · 「비워 둔 머리 칸」 기억은 안 건드려요 · 다른 칸은 이 틀에서 못 써요', async () => {
    const w = await open(two);
    const input = w.pick('[data-lc-field="title"]');
    assert.equal(input.value, '', '빈 채로 시작'); assert.equal(input.disabled, false);
    for (const key of ['date', 'char', 'model', 'prompt']) assert.equal(w.pick(`[data-lc-field="${key}"]`).disabled, true, key);
    for (const key of ['dateOff', 'tagsOff', 'topOff', 'bottomOff']) assert.equal(w.pick(`[data-lc-show="${key}"]`).disabled, true, key);
    for (const key of ['titleOff', 'namesOff']) assert.equal(w.pick(`[data-lc-show="${key}"]`).disabled, false, key);
    input.value = '첫 장'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle(400);
    assert.match(w.doc(), /border-bottom:2px solid [^;"]+[^>]*><span data-f="title"[^>]*>첫 장<\/span>/);
    assert.deepEqual(w.store().blank, [], '비워 둔 칸으로 적지 않아요');
    w.pick('[data-lc="more"]')?.getAttribute('aria-expanded') === 'false' && w.pick('[data-lc="more"]').click(); await settle();
    w.pick('[data-shape="card"]').click(); await settle();
    assert.ok(w.doc().includes('어느 저녁 이야기') && !w.doc().includes('첫 장'), '카드는 채팅 제목 그대로');
    assert.equal(w.pick('[data-lc-field="title"]').value, '어느 저녁 이야기');
    assert.equal(w.pick('[data-lc-field="model"]').disabled, false);
    w.pick('[data-shape="kkangtong"]').click(); await settle();
    assert.ok(w.doc().includes('첫 장') && !w.doc().includes('어느 저녁 이야기'), '돌아오면 이 틀의 제목');
});

await test('틀이 저장된 설정(카드 · 상태창)은 그 틀로 열려요 — 채팅 제목 · 알약 · 색 칩 그대로 · 열었다 닫아도 저장된 틀 · 레몬은 그대로', async () => {
    // 1.1.3 카드는 기본 글꾸 새 틀(밝기만 · 정보 칸 기본 끔) — 팔레트 틀(알약 · 색 칩)은 상태창으로 봐요
    const card = await open(two, OLD);
    assert.equal(card.pick('[data-shape][aria-checked="true"]').dataset.shape, 'card');
    assert.ok(card.doc().includes('어느 저녁 이야기') && card.doc().includes('class="gk '));
    assert.equal(card.pick('[data-lc-pals]').hidden, true);
    card.dialog.close(); await settle();
    assert.deepEqual(S.getSettings().logCopy, OLD);
    const STATUS = { ...OLD, shape: 'status', recent: ['status'] };
    const w = await open(two, STATUS);
    assert.equal(w.pick('[data-shape][aria-checked="true"]').dataset.shape, 'status');
    assert.ok(w.doc().includes('어느 저녁 이야기') && />LOG</.test(w.doc()));
    assert.equal(w.pick('[data-lc-pals]').hidden, false); assert.ok(w.all('[data-lc-pals] [data-palette]').length > 0);
    assert.equal(w.pick('[data-lc-lemon]').getAttribute('aria-pressed'), 'false');
    w.dialog.close(); await settle();
    assert.deepEqual(S.getSettings().logCopy, STATUS);
});

// ── ② 더 보기 ─────────────────────────────────────────────────
const expanded = w => w.pick('[data-lc="more"]').getAttribute('aria-expanded') === 'true';

await test('깡통 로그로 열면 접힌 채: 모양 칩은 틀 셋뿐 · 「+ 내 글꾸」 없음 · 눌러 펼치면 분류 · 다른 모양 · 내 글꾸가 나오고 다시 접혀요', async () => {
    const w = await open(two);
    assert.equal(expanded(w), false); assert.ok(w.dialog.classList.contains('bl-lc-less'));
    assert.deepEqual(w.all('[data-lc-shapes] [data-shape]').map(b => b.dataset.shape), TONE_SHAPES);
    assert.equal(w.pick('[data-lc-shapes] [data-lc="paste"]'), null);
    assert.equal(w.pick('[data-lc="more"] span').textContent, '더 보기');
    const before = w.doc();
    w.pick('[data-lc="more"]').focus?.(); w.pick('[data-lc="more"]').click(); await settle();
    assert.equal(expanded(w), true); assert.ok(!w.dialog.classList.contains('bl-lc-less'));
    assert.equal(w.pick('[data-lc="more"] span').textContent, '접기');
    const ids = w.all('[data-lc-shapes] [data-shape]').map(b => b.dataset.shape);
    assert.deepEqual(ids.slice(0, 5), [...TONE_SHAPES, 'plain', 'card'], '「기본」 분류 전체');
    assert.ok(w.pick('[data-lc-shapes] [data-lc="paste"]'), '「+ 내 글꾸」');
    assert.ok(w.all('[data-lc-cats] [data-cat]').length > 3);
    assert.equal(w.doc(), before, '펼쳐도 미리보기는 그대로');
    w.pick('[data-lc="more"]').click(); await settle();
    assert.equal(expanded(w), false);
});

await test('접힌 채 다른 틀을 고른 상태면 그 틀 칩 하나가 틀 셋 뒤에 같이 보여요', async () => {
    const w = await open(two);
    w.pick('[data-lc="more"]').click(); await settle();
    w.pick('[data-shape="card"]').click(); await settle();
    w.pick('[data-lc="more"]').click(); await settle();
    assert.deepEqual(w.all('[data-lc-shapes] [data-shape]').map(b => b.dataset.shape), [...TONE_SHAPES, 'card']);
    assert.equal(w.pick('[data-shape][aria-checked="true"]').dataset.shape, 'card');
    w.pick('[data-shape="kkangtong-mini"]').click(); await settle();
    assert.deepEqual(w.all('[data-lc-shapes] [data-shape]').map(b => b.dataset.shape), TONE_SHAPES);
});

await test('다른 틀을 쓰던 설정 · 내 글꾸 · 접힌 줄에서 켜 둔 것이 글을 바꾸는 설정은 펼친 채 열려요', async () => {
    assert.equal(expanded(await open(two, OLD)), true, '카드');
    const mine = { ...OLD, shape: 'cabc123', category: 'mine', custom: [{ id: 'cabc123', name: '내 글꾸 1', html: '<div>틀</div>', slot: 'auto' }] };
    assert.equal(expanded(await open(two, mine)), true, '내 글꾸');
    assert.equal(expanded(await open(two, { ...OLD, shape: 'kkangtong', namesOff: true })), true, '이름 줄을 꺼 둠');
    assert.equal(expanded(await open(two, { ...OLD, shape: 'kkangtong' })), false, '깡통 로그를 고른 설정');
    ctx.extensionSettings.salty = { enabled: true, captureTools: { redact: true } }; S.invalidateSettings();
    await sheet.openLogSheet(two); await settle();
    assert.equal(document.querySelector('dialog.bl-lc [data-lc="more"]').getAttribute('aria-expanded'), 'true', '이름 숨김을 켜 둠');
});

await test('접힘은 창 class 하나로 — 접히는 줄 목록 · 저장하지 않아요', async () => {
    const src = read('src/log-copy-sheet.js');
    assert.match(src, /\.bl-lc\.bl-lc-less :is\(\.bl-lc-cats, \.bl-lc-gallery, \.bl-lc-pals, \.bl-lc-inks, \.bl-lc-tools, \.bl-lc-shows, \.bl-lc-fields, \.bl-lc-names, \.bl-lc-words\) \{ display:none; \}/);
    const w = await open(two);
    w.pick('[data-lc="more"]').click(); await settle(); w.dialog.close(); await settle();
    assert.ok(!('more' in S.getSettings().logCopy));
    assert.equal(expanded(await open(two, S.getSettings().logCopy)), false, '다시 열면 틀에 맞춰 접힌 채');
});

// ── ③ 붙일 곳 흉내 · 복사 직전 점검 ─────────────────────────────
const sim = await import(url('src/log-copy-site-sim.js'));

await test('깡통 로그 미리보기는 붙일 곳 흉내: 밤 · 낮 바탕 · 머리 <style> 에 코멘트 자리 — body 안에는 틀뿐 · 다른 틀의 미리보기는 예전 그대로', async () => {
    const w = await open(two);
    for (const mode of ['dark', 'light']) {
        w.pick(`[data-lc-mode="${mode}"]`).click(); await settle();
        const html = w.doc();
        assert.ok(html.includes(`background-color:${sim.SITE[mode].bg};`), `${mode} 바탕`);
        assert.ok(html.split('</head>')[0].includes(sim.sitePreviewCss(mode)), `${mode} 코멘트 자리 규칙은 머리에`);
        assert.match(html.split('</head>')[1], /<body [^>]*><div style="box-sizing:border-box;max-width:100%;background-color:/, 'body 첫 요소가 곧 틀');
        assert.equal(sim.siteCheck(html.split(/<body [^>]*>/)[1].replace('</body></html>', ''), { mode }).low, 0, '덮일 글자색 없음');
    }
    w.pick('[data-lc="more"]').click(); await settle();
    w.pick('[data-shape="card"]').click(); await settle();
    assert.ok(!w.doc().includes('body::before'), '카드 미리보기에는 흉내 규칙 없음');
});

await test('그릴 때와 복사 · 내려받기 직전에 점검을 거쳐요(깡통 로그 틀 묶음만)', () => {
    const src = read('src/log-copy-sheet.js');
    assert.match(src, /if \(toneNow\) html = siteCheck\(html, \{ mode: toneMode \}\)\.html;/, '그릴 때 — 미리보기와 복사 글이 같게');
    assert.match(src, /const html = body\.innerHTML\.trim\(\);\s*return toneOn\(\) \? siteCheck\(html, \{ mode: modeOf\(state\.palette\) \}\)\.html : html;/, '복사 글(result) — 미리보기에서 고친 글까지');
    assert.match(src, /\$\{motionCss\(\)\}\$\{toneNow \? sitePreviewCss\(toneMode\) : ''\}<\/style>/);
});

console.log(`log-copy-connect-sheet-113: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
