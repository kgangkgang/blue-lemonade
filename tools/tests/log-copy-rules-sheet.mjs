// 1.5.0 버그 사냥 — 로그 복사 창 「글자 바꾸기」 줄의 ✕ 가 누른 줄을 지우는지(가짜 브라우저 leak-dom).
//   전엔: 한 줄을 비우면 0.3초 뒤 readRules 가 빈 줄을 걸러 저장 번호가 당겨졌는데 화면 ✕ 는 옛 번호 그대로 —
//   그 아래 줄의 ✕ 를 누르면 엉뚱한 규칙이 지워졌어요.
//   node tools/tests/log-copy-rules-sheet.mjs .
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

const font = { color: 'rgb(219, 226, 235)', 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '0px', 'line-height': '26px' };
const p = text => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font }, children: [{ t: 'text', text }] });
const one = (i, name, user, text) => ({ index: i, user, name, nameStyle: { color: 'rgb(200, 200, 200)' }, time: 0, font, bubble: null, nodes: [p(text)] });
const MODEL = { chatName: '미나', charName: '미나', userName: '하루', chatTitle: '비', base: { bg: 'rgb(20, 31, 46)', ...font }, messages: [one(0, '미나', false, '사과 배 감')] };
const CARD = { on: true, shape: 'kkangtong', palette: '', category: 'basic', recent: [], fav: [], custom: [], tagsOff: false, titleOff: false, dateOff: false, namesOff: false, topOff: false, bottomOff: false, blank: [], lemonLink: false, lemonAt: 'auto', basicInfo: 'off', basicHeight: '' };
const RULES = [{ from: '사과', to: 'A' }, { from: '배', to: 'B' }, { from: '감', to: 'C' }];

async function open() {
    ctx.extensionSettings.salty = { enabled: true, logCopy: structuredClone(CARD), captureTools: { replaceRules: structuredClone(RULES) } };
    S.invalidateSettings();
    await sheet.openLogSheet(MODEL);
    await settle();
    const dialog = document.querySelector('dialog.bl-lc');
    assert.ok(dialog, '창이 떠요');
    return dialog;
}
const saved = () => S.getSettings().captureTools.replaceRules.map(r => r.from);
const rows = d => [...d.querySelectorAll('.bl-lc-rule')];

await test('바탕: 규칙 셋이 줄 셋으로 · 가운데 ✕ 는 가운데 규칙', async () => {
    const d = await open();
    assert.deepEqual(rows(d).map(r => r.querySelector('[data-rule-from]').value), ['사과', '배', '감']);
    rows(d)[1].querySelector('[data-lc-rule-remove]').click(); await settle();
    assert.deepEqual(saved(), ['사과', '감']);
});

await test('가운데 줄을 비우고 0.3초 뒤 그 아래 줄의 ✕ → 그 아래 줄(감)만 지워져요', async () => {
    const d = await open();
    const mid = rows(d)[1];
    for (const sel of ['[data-rule-from]', '[data-rule-to]']) { const input = mid.querySelector(sel); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
    await settle(400);
    assert.deepEqual(saved(), ['사과', '감'], '빈 줄은 저장에서 빠져요');
    const last = rows(d).find(r => r.querySelector('[data-rule-from]').value === '감');
    assert.ok(last, '화면엔 감 줄이 있어요');
    last.querySelector('[data-lc-rule-remove]').click(); await settle();
    assert.deepEqual(saved(), ['사과'], `감이 지워져야 해요 — 남은 것 ${saved().join(',')}`);
});

await test('새 줄을 더한 뒤 다른 줄을 고치고 맨 아래 빈 줄의 ✕ → 다른 규칙은 그대로', async () => {
    const d = await open();
    d.querySelector('[data-lc="rule-add"]').click(); await settle();
    assert.equal(rows(d).length, 4);
    const first = rows(d)[0].querySelector('[data-rule-to]'); first.value = 'AA'; first.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(400);
    rows(d)[3].querySelector('[data-lc-rule-remove]').click(); await settle();
    assert.deepEqual(saved(), ['사과', '배', '감']);
});

console.log(`log-copy-rules-sheet: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
process.exit(0);
