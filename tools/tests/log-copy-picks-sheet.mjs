// 1.1.8 「블루레몬 추천」 기본 글꾸 — 로그 복사 창에서: 분류 칩 · 추천 칩 22 · 같은 이름 판은 칩 옆 둥근 꺾쇠로 고르기(기억) · 받은 글꾸가 이기기 · 기본 틀 18 그대로
//   창을 가짜 브라우저(leak-dom)로 열어 꼴과 상태만 봐요(그려진 생김새는 헤드리스 사진으로).
//   node tools/tests/log-copy-picks-sheet.mjs .
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
const toasts = [];
globalThis.toastr = { info: (m) => toasts.push(m), success() {}, warning() {}, error() {}, clear() {} };

const S = await import(url('src/settings.js'));
const sheet = await import(url('src/log-copy-sheet.js'));
const { PRESETS } = await import(url('src/log-copy-presets.js'));
const sample = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/mart-picks-sample.json'), 'utf8'));
const { readMart, addMartItems } = await import(url('src/mart-import.js'));

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나은 하늘을 보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루이 물었다.')] };
const BASE = { on: true, shape: 'card', palette: '', category: 'basic', recent: ['card'], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };
const received = (key, set = { blGeulkku: 2 }) => {
    const raw = sample.items[key], s = { logCopy: { custom: [] } };
    addMartItems(s, readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, emoji: raw.emoji, html: raw.html, set }] })).items);
    return s.logCopy.custom[0];
};

async function open(logCopy = BASE) {
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone(logCopy), captureTools: { redact: false, names: [], mask: 'auto', maskWord: '○○' } };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    const all = sel => [...dialog.querySelectorAll(sel)];
    const click = async (sel) => { const b = pick(sel); assert.ok(b, `없음: ${sel}`); b.click(); await settle(); };
    return { dialog, pick, all, click, store: () => S.getSettings().logCopy, chips: () => all('[data-lc-shapes] > [data-shape]').map(b => b.querySelector('span:not(.bl-lc-emoji)')?.textContent) };
}

await test('분류: 「기본」 바로 뒤 「블루레몬 추천」 · 추천 칩 22(차례 = 사용자 목록) · 기본 틀 18 은 그대로', async () => {
    const w = await open();
    assert.deepEqual(w.all('[data-cat]').map(b => b.textContent).slice(0, 2), ['기본', '블루레몬 추천']);
    await w.click('[data-cat="pick"]');
    assert.deepEqual(w.chips(), ['낫표', '견출지', '바인더', '티백', '성냥', '블라인드', '모래시계', '실 전화', '형광펜', '고양이', '택배 상자', '우체국', '삐삐', '비주얼노벨 선택지', '세이브 슬롯', '플라밍고', '기타', '분노', '묘비', '속보 방송', '즉석 카메라', '업적 달성 알림']);
    assert.deepEqual(w.all('[data-lc-pv]').map(b => b.dataset.lcPv), ['p-cat', 'p-flamingo', 'p-guitar', 'p-anger', 'p-news', 'p-camera'], '꺾쇠는 시리즈 칩(고양이 · 플라밍고 · 기타 · 분노 · 속보 · 카메라)에만');
    assert.equal(w.all('[data-lc-del]').length, 0, '추천 글꾸는 지우기 ✕ 가 없어요');
    assert.equal(PRESETS.filter(x => x.basic).length, 18, '기본 글꾸 18 그대로');
    await w.click('[data-cat="basic"]');
    assert.ok(w.all('[data-lc-shapes] > [data-shape]').some(b => b.dataset.shape === 'card'));
});

await test('고르기: 추천 칩을 누르면 그 마트 틀로 그려요 · 받은 글꾸처럼 밝기만(색 칩 없음) · 간편 조절 줄 · 창 이름', async () => {
    const w = await open({ ...BASE, category: 'pick' });
    await w.click('[data-shape="simple-k1014"]');
    assert.equal(w.store().shape, 'card', '아직 복사 전');
    assert.equal(w.pick('[data-shape="simple-k1014"]').getAttribute('aria-checked'), 'true');
    assert.equal(w.pick('[data-lc-stage-name]').textContent, '택배 상자');
    assert.ok(w.pick('[data-lc-pals]').hidden, '에이드 색 칩은 숨겨요(밝기만)');
    await settle(200);
    assert.ok(!w.pick('[data-lc-easy]').hidden, '간편 조절 줄(받은 글꾸와 같은 조절 화면)');
});

await test('판 고르기: 칩 옆 둥근 꺾쇠 → 판 칩이 펼쳐지고, 고르면 그 판으로 그리고 기억해요(다시 열어도)', async () => {
    const w = await open({ ...BASE, category: 'pick' });
    const pv = w.pick('[data-lc-pv="p-guitar"]');
    assert.equal(pv.getAttribute('aria-expanded'), 'false');
    assert.ok(pv.querySelector('i.bl-lc-chev'), '둥근 꺾쇠(기준 모양 마스크)');
    assert.equal(w.all('[data-lc-pvar]').length, 0);
    await w.click('[data-lc-pv="p-guitar"]');
    assert.equal(w.pick('[data-lc-pv="p-guitar"]').getAttribute('aria-expanded'), 'true');
    assert.deepEqual(w.all('[data-lc-pvar]').map(b => [b.dataset.lcPvar, b.textContent, b.getAttribute('aria-pressed')]),
        [['simple-k1163', '기타', 'true'], ['simple-k1342', '줄 하나 딩', 'false'], ['simple-k1343', '일렉 기타', 'false']]);
    await w.click('[data-lc-pvar="simple-k1343"]');
    assert.deepEqual(w.store().pickVar, { 'p-guitar': 'simple-k1343' });
    assert.equal(w.all('[data-lc-pvar]').length, 0, '고르면 판 칩을 접어요');
    const chip = w.pick('[data-shape="simple-k1343"]');
    assert.equal(chip.getAttribute('aria-checked'), 'true');
    assert.equal(chip.querySelector('small').textContent, '일렉 기타', '칩에 고른 판 이름');
    assert.equal(w.pick('[data-lc-stage-name]').textContent, '일렉 기타');
    assert.equal(w.pick('[data-shape="simple-k1163"]'), null, '묶음은 칩 하나');
    // 분노: 주전자 판까지 셋(사용자 「주전자도 걍 넣어」) · 고양이 · 속보 · 카메라 시리즈
    await w.click('[data-lc-pv="p-anger"]');
    assert.deepEqual(w.all('[data-lc-pvar]').map(b => b.textContent), ['분노', '핏줄 표시', '주전자']);
    for (const [g, names] of [['p-cat', ['고양이', '검은 고양이', '길고양이 급식 기록장']], ['p-news', ['속보 방송', 'HUNTV 속보']], ['p-camera', ['즉석 카메라', '카메라', '올해의 필름']]]) {
        await w.click(`[data-lc-pv="${g}"]`);
        assert.deepEqual(w.all('[data-lc-pvar]').map(b => b.textContent), names, g);
    }
    // 다시 열어도 고른 판
    w.dialog.close(); await settle();
    const again = await open({ ...w.store(), category: 'pick' });
    assert.ok(again.pick('[data-shape="simple-k1343"]'), '기억한 판 칩');
});

await test('조절 값: 추천 글꾸에서 바꾼 조절은 logCopy.pickSet 에 · 내 글꾸 칸(20개 상한)은 그대로', async () => {
    const w = await open({ ...BASE, category: 'pick', shape: 'simple-k1' });
    await settle(200);
    const motion = w.pick('[data-lc-easy="motion:0"]');
    assert.ok(motion, '움직임 끔 칩');
    motion.click(); await settle();
    assert.ok(w.store().pickSet['simple-k1'], '조절 값이 남아요');
    assert.equal(w.store().custom.length, 0);
});

await test('겹치지 않기: 마트에서 같은 틀을 받아 둔 사람은 받은 글꾸가 이기고(「내 글꾸」에만) 추천 줄에서 빠져요 · 지우면 돌아와요', async () => {
    const mine = received('k1342');
    const w = await open({ ...BASE, category: 'pick', custom: [mine] });
    await w.click('[data-lc-pv="p-guitar"]');
    assert.deepEqual(w.all('[data-lc-pvar]').map(b => b.textContent), ['기타', '일렉 기타']);
    await w.click('[data-cat="mine"]');
    assert.ok(w.pick('[data-shape="simple-k1342"]'), '내 글꾸에 받은 것');
    assert.ok(w.pick('[data-lc-del="simple-k1342"]'), '받은 것은 지울 수 있어요');
    assert.equal(w.all('[data-shape="simple-k1342"]').length, 1, '한 번만');
    const solo = received('k1222');
    const v = await open({ ...BASE, category: 'pick', custom: [solo] });
    assert.ok(v.chips().includes('즉석 카메라'), '시리즈 판이 남아 칩은 그대로');
    assert.equal(v.pick('[data-shape="simple-k1222"]'), null, '받은 판(k1222)은 추천 줄에 없어요');
    await v.click('[data-lc-pv="p-camera"]');
    assert.deepEqual(v.all('[data-lc-pvar]').map(b => b.textContent), ['카메라', '올해의 필름']);
    await v.click('[data-cat="mine"]');
    await v.click('[data-lc-del="simple-k1222"]');   // 1.2.0 ✕ 한 번에 지워요(알림의 ↶ 로 되돌려요 — log-copy-paste-manage.mjs)
    await v.click('[data-cat="pick"]');   // 펼친 판 칩은 이번 창 동안 펼친 채
    assert.equal(v.pick('[data-lc-pv="p-camera"]').getAttribute('aria-expanded'), 'true');
    assert.deepEqual(v.all('[data-lc-pvar]').map(b => b.textContent), ['즉석 카메라', '카메라', '올해의 필름'], '받은 것을 지우면 추천 판이 돌아와요');
    const u = await open({ ...BASE, category: 'pick', custom: [received('k13')] });
    assert.ok(!u.chips().includes('형광펜'), '판이 하나뿐인 칩은 칩째 빠져요');
    assert.equal(u.chips().length, 21);
});

await test('옛 id: 1.1.7 에서 뺀 「택배 상자」 · 「속보 방송」을 고른 채였으면 추천 판으로 이어 그리고 마트 안내를 띄우지 않아요', async () => {
    toasts.length = 0;
    const w = await open({ ...BASE, shape: 'c-scene-sp-2' });
    assert.equal(w.pick('[data-shape="simple-k1218"]')?.getAttribute('aria-checked'), 'true');
    assert.equal(w.pick('[data-cat="pick"]').getAttribute('aria-pressed'), 'true');
    assert.ok(!toasts.some(m => /속보 방송/.test(m)), '안내 없음');
});

console.log(`log-copy-picks-sheet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
