// 11-14 로그 복사 창 「글 속 그림」 칸 — 창을 가짜 브라우저(leak-dom)로 열어 칸 상태와 미리보기 글(srcdoc = 복사 글)을 봐요.
//   ① 그림이 없는 로그는 칸이 숨고 미리보기에 그림 칸 0
//   ② 실리태번 주소 그림은 번호(1 · 2 …)로 · 공개 주소는 「바로」 — 주소를 붙이기 전엔 공개 주소만 미리보기에
//   ③ 깡통에 올린 주소를 붙이면 그 번호 그림이 메시지 맨 앞에 · 「그림 넣기」를 끄면 0(설정에 남아요) · 갤러리 틀은 사진 칸이 따로라 0
//   node tools/tests/log-copy-pics-sheet.mjs .
import assert from 'node:assert/strict';
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

const LOCAL = `${location.origin}/characters/someone/smile.png`;
const PUBLIC = 'https://example.org/art/scene.webp';
const KK = 'https://img.kkangtong.xyz/post-images/uploads/aaaa-bbbb.jpg';
const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text, pics) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)], ...(pics ? { pics: pics.map(src => ({ src })) } : {}) });
const base = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤', base: { bg: 'rgb(20, 31, 46)', ...font } };
const PLAIN = { ...base, messages: [one(0, '미나', false, '미나는 창가에 섰다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」')] };
const WITH = { ...base, messages: [one(0, '미나', false, '미나는 창가에 섰다.', [LOCAL]), one(1, '하루', true, '「우산 또 안 챙겼지?」', [PUBLIC])] };
const CARD = { on: true, shape: 'kkangtong', palette: '', category: 'basic', recent: [], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };

async function open(model, logCopy = CARD) {
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone(logCopy) };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    return { dialog, pick, doc: () => pick('[data-lc-frame]').srcdoc, store: () => S.getSettings().logCopy };
}
const pics = html => (html.match(/class="blq-pic"/g) || []).length;

await test('그림 없는 로그: 칸 숨김 · 미리보기 그림 칸 0', async () => {
    const w = await open(PLAIN);
    assert.equal(w.pick('[data-lc-pics]').hidden, true);
    assert.equal(pics(w.doc()), 0);
});

await test('그림 있는 로그: 1번(실리태번) · 바로(공개) — 붙이기 전엔 공개 주소만 · 붙이면 1번이 첫 메시지 맨 앞', async () => {
    const w = await open(WITH);
    assert.equal(w.pick('[data-lc-pics]').hidden, false);
    const marks = [...w.pick('[data-lc-pics-list]').querySelectorAll('b')].map(b => b.textContent);
    assert.deepEqual(marks, ['1', '바로']);
    assert.match(w.pick('[data-lc-pics-sum]').textContent, /올릴 그림 1장 중 0장/);
    assert.equal(w.pick('[data-lc="pics-save"]').hidden, false);
    assert.equal(pics(w.doc()), 1);
    assert.ok(w.doc().includes(PUBLIC) && !w.doc().includes(LOCAL), '실리태번 주소는 복사 글에 안 가요');
    const box = w.pick('[data-lc-pic-codes]');
    box.value = `붙인 그림\n${KK}\n`;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(400);
    const html = w.doc();
    assert.equal(pics(html), 2);
    assert.ok(html.indexOf(KK) < html.indexOf('미나는 창가에') && html.indexOf(PUBLIC) > html.indexOf('미나는 창가에'), '각 메시지 맨 앞');
    assert.match(w.pick('[data-lc-pics-sum]').textContent, /1장 중 1장/);
});

await test('검토 보1: 코드 칸에 실리태번 · 내부망 주소를 붙이면 넣지 않고 칸에 · 알림으로 알려요(뒤 번호는 제자리)', async () => {
    const two = { ...WITH, messages: [...WITH.messages, one(2, '미나', false, '「다음에.」', [`${location.origin}/user/images/x/b.png`])] };
    const warns = [];
    globalThis.toastr.warning = m => warns.push(m);
    try {
        const w = await open(two);
        const box = w.pick('[data-lc-pic-codes]');
        box.value = `<img src="http://192.168.0.5:8000/characters/Someone/smile.png"><img src="${KK}">`;
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await settle(400);
        const html = w.doc();
        assert.ok(!html.includes('192.168.0.5') && !html.includes('/characters/'), '실리태번 주소가 복사 글에 없어요');
        assert.ok(html.includes(KK), '2번은 제자리');
        assert.equal(pics(html), 2, '공개 1 + 2번');
        assert.match(w.pick('[data-lc-pics-sum]').textContent, /2장 중 1장 .*붙인 코드 1번째는 실리태번/);
        assert.ok(warns.some(m => /1번째/.test(m)), '알림');
    } finally { globalThis.toastr.warning = () => {}; }
});

await test('작은 그림 = 한 장 받기 단추 · 「그림 받기」는 받는 동안 꺼지고 「시작했어요」로 알려요(검토 사1)', async () => {
    const infos = [];
    globalThis.toastr.info = m => infos.push(m);
    try {
        const w = await open(WITH);
        const get = w.pick('[data-lc-pic-get="1"]');
        assert.ok(get && get.tagName === 'BUTTON', '1번 그림이 단추');
        const save = w.pick('[data-lc="pics-save"]');
        save.click(); await settle();
        assert.equal(save.disabled, true, '받는 동안 꺼짐');
        assert.ok(infos.some(m => /시작했어요/.test(m)) && !infos.some(m => /받았어요/.test(m)));
        await settle(1600);
        assert.equal(save.disabled, false);
    } finally { globalThis.toastr.info = () => {}; }
});

await test('검토 보3: 그림만 있는 메시지 — 코드를 붙이기 전엔 이름 줄도 비워요 · 붙이면 그림이 그 자리에', async () => {
    const onlyPic = { ...PLAIN, messages: [PLAIN.messages[0], { ...one(1, '미나', false, 'x', [LOCAL]), nodes: [] }, PLAIN.messages[1]] };
    const w = await open(onlyPic);
    assert.equal(pics(w.doc()), 0);
    assert.equal((w.doc().match(/>미나</g) || []).length <= 1, true, '빈 메시지 이름 줄 없음');
    const box = w.pick('[data-lc-pic-codes]');
    box.value = KK; box.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(400);
    const html = w.doc();
    assert.equal(pics(html), 1);
    assert.ok(html.indexOf(KK) > html.indexOf('미나는 창가에') && html.indexOf(KK) < html.indexOf('우산'), '둘째 자리');
});

await test('「그림 넣기」 끄면 0 · 설정에 남고 다시 열어도 꺼진 채 · 켜면 다시', async () => {
    const w = await open(WITH);
    w.pick('[data-lc="pics-on"]').click(); await settle();
    assert.equal(w.store().picsOff, true);
    assert.equal(pics(w.doc()), 0);
    assert.equal(w.pick('[data-lc="pics-on"]').getAttribute('aria-pressed'), 'false');
    const again = await open(WITH, { ...CARD, picsOff: true });
    assert.equal(again.store().picsOff, true);
    assert.equal(pics(again.doc()), 0);
    again.pick('[data-lc="pics-on"]').click(); await settle();
    assert.equal(again.store().picsOff, undefined, '켜면 값 없이(옛 설정 꼴)');
    assert.equal(pics(again.doc()), 1);
});

await test('갤러리 틀: 사진 칸이 따로라 글 속 그림 칸 0 · 칸에 까닭', async () => {
    const w = await open(WITH, { ...CARD, shape: 'gallery-grid', category: 'gallery' });
    assert.equal(pics(w.doc()), 0);
    assert.match(w.pick('[data-lc-pics-sum]').textContent, /갤러리/);
});

console.log(`log-copy-pics-sheet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
process.exit(0);
