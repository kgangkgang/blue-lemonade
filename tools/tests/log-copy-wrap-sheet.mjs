// 11-13 로그 복사 창 「줄바꿈」 — 글자 단위(기본) · 단어 단위. 창을 가짜 브라우저(leak-dom)로 열어 미리보기 글(srcdoc = 복사 글)과 칸 상태를 봐요.
//   ① 새 설정 · 옛 설정(wrap 없음) 모두 글자 단위 — 메시지 글은 word-break:normal · 틀 제목은 그대로
//   ② PC 칩 「단어 단위 줄바꿈」 · 폰 「줄바꿈」 갈래의 알약 스위치가 같은 값(설정 logCopy.wrap 에 남아요) · 누르면 미리보기가 다시 그려져요
//   ③ 받은 심플 글꾸(추천 판)도 틀 <style> 의 본문 줄이 고른 값
//   node tools/tests/log-copy-wrap-sheet.mjs .
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

// 화면에서 뜬 모델 꼴 — 채팅 글은 테마 규칙(06-chat-text.css)이 keep-all 이라 그대로 뜨면 단어 단위예요
const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px', 'word-break': 'keep-all' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const model = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비 그친 뒤의 아주 긴 제목 줄', base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [one(0, '미나', false, '미나는 창가에 서서 비 그친 하늘을 한참 동안 올려다보았다.'), one(1, '하루', true, '「우산 또 안 챙겼지?」 하루가 물었다.')] };
const CARD = { on: true, shape: 'status', palette: '', category: 'basic', recent: [], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };

async function open(logCopy) {
    ctx.extensionSettings.salty = logCopy === undefined ? { enabled: true } : { enabled: true, logCopy: structuredClone(logCopy) };
    S.invalidateSettings();
    await sheet.openLogSheet(model);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    const pick = sel => dialog.querySelector(sel);
    return { dialog, pick, doc: () => pick('[data-lc-frame]').srcdoc, store: () => S.getSettings().logCopy };
}
/** 메시지 글이 든 칸(data-bl-msg) 안의 word-break 값들 — 이름 줄(data-bl-name · 글자 단위여도 낱말째)은 빼요 */
const msgBreaks = (html) => {
    const out = [];
    for (const m of html.matchAll(/data-bl-msg[\s\S]*?(?=data-bl-msg|$)/g)) for (const b of m[0].replace(/<div[^>]*data-bl-name[^>]*>[^<]*<\/div>/g, '').matchAll(/word-break:\s*([\w-]+)/g)) out.push(b[1]);
    return out;
};
/** 이름 줄의 word-break 값들 */
const nameBreaks = html => [...html.matchAll(/<div[^>]*data-bl-name[^>]*>/g)].map(m => (m[0].match(/word-break:\s*([\w-]+)/) || [, ''])[1]);

await test('새 설정 · 옛 설정(wrap 없음): 글자 단위 — 저장 값 없음(옛 설정 꼴 그대로) · 메시지 글 normal', async () => {
    for (const saved of [undefined, CARD]) {
        const w = await open(saved);
        assert.equal(w.store().wrap, undefined, '글자 단위는 값 없이(설정 정리가 옛 설정 꼴을 안 바꿔요)');
        const b = msgBreaks(w.doc());
        assert.ok(b.length > 0 && b.every(v => v === 'normal'), `${saved ? '옛' : '새'} 설정 ${b.join(',')}`);
        assert.equal(w.pick('[data-lc="wrap"]').getAttribute('aria-pressed'), 'false');
        assert.equal(w.pick('[data-lc-sw="wrap"]').getAttribute('aria-checked'), 'false');
        assert.match(w.pick('[data-lc-fd="wrap"] [data-lc-fd-sum]').textContent, /^글자 단위/);
    }
});

await test('PC 칩 · 폰 알약 스위치가 같은 값 — 누르면 단어 단위(설정에 남음) · 다시 누르면 글자 단위', async () => {
    const w = await open(CARD);
    w.pick('[data-lc="wrap"]').click(); await settle();
    assert.equal(w.store().wrap, 'word');
    assert.equal(w.pick('[data-lc="wrap"]').getAttribute('aria-pressed'), 'true');
    assert.equal(w.pick('[data-lc-sw="wrap"]').getAttribute('aria-checked'), 'true');
    assert.match(w.pick('[data-lc-fd="wrap"] [data-lc-fd-sum]').textContent, /^단어 단위/);
    const b = msgBreaks(w.doc());
    assert.ok(b.length > 0 && b.every(v => v === 'keep-all'), b.join(','));
    w.pick('[data-lc-sw="wrap"]').click(); await settle();   // 폰 갈래의 스위치 = PC 칩
    assert.equal(w.store().wrap, undefined, '글자 단위로 돌아오면 값을 지워요');
    assert.ok(msgBreaks(w.doc()).every(v => v === 'normal'));
    assert.ok(nameBreaks(w.doc()).length && nameBreaks(w.doc()).every(v => v === 'keep-all'), `상태창(화면 그대로 로그) 이름 줄은 글자 단위여도 낱말째 ${nameBreaks(w.doc())}`);
    assert.equal(S.getSettings().logCopy.wrap, undefined);
    const again = await open({ ...CARD, wrap: 'word' });
    assert.equal(again.store().wrap, 'word', '단어 단위는 설정 정리를 지나도 남아요');
    assert.equal((await open({ ...CARD, wrap: 'nope' })).store().wrap, undefined, '모르는 값은 버려요');
    const back = await open({ ...CARD, wrap: 'word' });
    assert.equal(back.pick('[data-lc="wrap"]').getAttribute('aria-pressed'), 'true', '다시 열어도 단어 단위');
});

await test('갈래 머리 「줄바꿈」은 폰 갈래 차례 마지막(머리 칸 뒤) · PC 에서는 칩 줄', async () => {
    const w = await open(CARD);
    const fd = w.pick('[data-lc-fd="wrap"]');
    assert.ok(fd && fd.querySelector('[data-lc-fold="wrap"] b').textContent === '줄바꿈');
    assert.ok(w.pick('.bl-lc-tools [data-lc="wrap"]'), 'PC 도구 칩 줄');
    const style = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    assert.match(style, /\.bl-lc-fd\[data-lc-fd="wrap"\] \{ order:5; \}/);
});

await test('추천 판(받은 심플 글꾸 꼴): 틀 <style> 본문 줄 — 글자 단위면 덮개 · 단어 단위면 틀 그대로', async () => {
    const picks = await import(url('src/log-copy-picks.js'));
    const list = await picks.loadPicks();
    if (!list.length) { console.log('  (이 노드에 DecompressionStream 이 없어 건너뛰어요)'); return; }
    const id = list[0].id;
    const w = await open({ ...CARD, shape: id, category: 'pick' });
    await settle(200);
    const html = w.doc(), key = (html.match(/class="gk [^"]*\b(gk-[kq]\d+)\b/) || [])[1];
    assert.ok(key, '심플 틀로 그려져요');
    const cover = new RegExp(`\\.${key} \\.gk-nr(?:,\\.${key} \\.gk-dl)?\\{word-break:normal\\}`);   // 이 글에 있는 본문 줄 class 만(이 견본은 대사 줄이 없을 수도)
    assert.match(html, cover, '본문 줄 덮개');
    w.pick('[data-lc="wrap"]').click(); await settle(200);
    assert.doesNotMatch(w.doc(), cover, '단어 단위면 덮개 없음');
    assert.equal(w.store().wrap, 'word');
});

await test('기본 글꾸 새 틀(카드): 틀 <style> 의 지문 · 대사 줄 덮개 — 제목 규칙 그대로', async () => {
    const w = await open({ ...CARD, shape: 'card' });
    const html = w.doc();
    assert.match(html, /\.[\w-]+ \.nr(?:,\.[\w-]+ \.dl)?\{word-break:normal\}/, '본문 줄 덮개');
    assert.match(html, /\.tt\{[^{}]*word-break:keep-all/, '제목은 낱말 단위 그대로');
    w.pick('[data-lc="wrap"]').click(); await settle();
    assert.doesNotMatch(w.doc(), /\.nr(?:,[^{}]*)?\{word-break:normal\}/, '단어 단위');
});

console.log(`log-copy-wrap-sheet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
process.exit(0);
