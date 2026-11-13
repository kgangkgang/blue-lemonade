// 뗀 규칙 시트(「CSS 늦게 붙이기」)의 실행 길을 실제로 돌려 봐요 — src/apply.js 가 부르는 src/lite.js syncGateCss · panelCssReady → src/gate-css.js
//   지금까지는 글자 대조(css-gates-order ④ · markdown-css-split)만 있었어요(공개판 감사 「시험 공백」). 가짜 DOM(leak-dom)의 <link> 받기를 손으로 쏴서 「받는 동안」 틈을 봐요.
//   ① 켠 설정의 클래스는 시트를 다 받기 전엔 body 에 없고, 받은 뒤에 달려요 — 달기 직전에 긴 채팅을 식혀요(결함 고침: applyAll 밖에서 식히지 않고 달았어요)
//   ② 시트를 못 받으면(error) 시트를 떼고 클래스는 달아요(이때도 식힌 뒤)
//   ③ 끄면 시트가 꺼지고(media not all), 다시 켜면 켜지고 미룰 클래스가 없어요(시트가 이미 와 있어요)
//   ④ 접두사 클래스(고른 마크다운 모양)만 켜도 미루고 시트를 붙여요 · 시트는 표 차례대로 테마 시트 뒤 줄에 놓여요
//   ⑤ 설정 창 시트: panelCssReady 는 시트를 다 받은 뒤에만 풀려요
//   ⑥ 몸통(gate-css.js)을 못 받으면: 클래스는 달고(식힌 뒤), 다음 applyAll 에서 새 주소(?retry=)로 다시 받아 시트를 붙여요(결함 고침: 다시 받지 않아 켠 꾸밈이 계속 빠졌어요)
//   ⑦ 설정 창 시트도 몸통을 못 받은 다음 번에 다시 받아요
//   node tools/tests/gate-css-run.mjs [테마 루트]
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const at = rel => pathToFileURL(path.join(root, rel)).href;
// 「조각을 못 받음」 흉내: lite.js?case=fail… 이 처음 부르는 import('./gate-css.js') 만 실패해요. 다시 받는 주소(./gate-css.js?retry=N)는 그대로 받아요
register('data:text/javascript,' + encodeURIComponent("export async function resolve(specifier, context, next) { if (specifier === './gate-css.js' && /[?&]case=fail/.test(context.parentURL || '')) throw new Error('흉내: 조각을 못 받았어요'); return next(specifier, context); }"));
const dom = await import(at('tools/tests/leak-dom.mjs'));
dom.installBrowser({});
const { linkLoads, EventLite } = dom;
const Ev = EventLite ?? globalThis.Event;
linkLoads.hold = true;

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log(`ok - ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); } }
const turn = () => new Promise(r => setImmediate(r));
async function until(fn, what) { for (let i = 0; i < 400; i++) { const v = fn(); if (v) return v; await turn(); } throw new Error(`기다려도 안 됐어요: ${what}`); }
const body = document.body, has = c => body.classList.contains(c);
const gate = id => document.getElementById(`salty-gate-${id}`);
const fire = async (link, type) => { await turn(); link.dispatchEvent(new Ev(type)); await turn(); };
const cooled = [];
const coolFor = name => () => { cooled.push(has(name) ? '달린 뒤' : '달기 전'); return 0; };
function reset() { for (const l of [...document.head.querySelectorAll('link')]) if (l.id.startsWith('salty-gate-')) l.remove(); body.className = 'salty'; cooled.length = 0; }

// 테마 시트 자리(이 뒤 줄에 뗀 규칙 시트가 놓여요)
const main = document.createElement('link');
main.setAttribute('rel', 'stylesheet'); main.href = at('style.css');
document.head.append(main);
body.className = 'salty';

const L = await import(at('src/lite.js'));
const { GATE_SHEETS, PANEL_SHEET } = await import(at('src/css-gates.gen.js'));

await test('① 켠 설정의 클래스는 시트를 받는 동안 미뤄지고, 받은 뒤에 달려요 — 달기 직전에 긴 채팅을 식혀요', async () => {
    const held = L.syncGateCss(['salty', 'salty-outline'], coolFor('salty-outline'));
    assert.deepEqual([...held], ['salty-outline'], 'apply.js 가 지금 달지 않을 클래스');
    const link = await until(() => gate('outline'), '외곽선 시트 붙음');
    assert.equal(link.media, 'all');
    assert.ok(link.href.endsWith('/src/gate-outline.gen.css'), link.href);
    await turn();
    assert.ok(!has('salty-outline'), '받기 전에는 클래스가 없어요');
    assert.deepEqual(cooled, []);
    await fire(link, 'load');
    assert.ok(has('salty-outline'), '받은 뒤에 달려요');
    assert.deepEqual(cooled, ['달기 전'], '클래스를 달기 직전에 한 번 식혀요');
});

await test('② 시트를 못 받으면 시트를 떼고 클래스는 달아요(식힌 뒤)', async () => {
    cooled.length = 0;
    const held = L.syncGateCss(['salty', 'salty-outline', 'salty-indent'], coolFor('salty-indent'));
    assert.deepEqual([...held], ['salty-indent']);
    const link = gate('type');
    assert.ok(link, '몸통을 이미 받았으니 바로 붙어요');
    await fire(link, 'error');
    assert.ok(!link.isConnected && !gate('type'), '못 받은 시트는 떼요');
    assert.ok(has('salty-indent'), '기능 상태는 맞게 클래스는 달아요');
    assert.deepEqual(cooled, ['달기 전']);
});

await test('③ 끄면 시트가 꺼지고, 다시 켜면 켜지며 미룰 클래스가 없어요', async () => {
    const link = gate('outline');
    assert.equal(L.syncGateCss(['salty'], coolFor('x')).size, 0);
    assert.equal(link.media, 'not all', '꺼 둔 시트');
    body.classList.remove('salty-outline', 'salty-indent');   // apply.js 가 떼는 몫
    const held = L.syncGateCss(['salty', 'salty-demink-outline'], coolFor('x'));
    assert.equal(link.media, 'all', '같은 시트를 다시 켜요');
    assert.equal(held.size, 0, '시트가 이미 와 있어 미루지 않아요 — apply.js 가 바로 달아요');
    assert.equal(gate('outline'), link, '시트를 새로 붙이지 않아요');
});

await test('④ 접두사 클래스(고른 마크다운 모양)만 켜도 미루고 시트를 붙여요 · 시트는 표 차례대로 놓여요', async () => {
    cooled.length = 0;
    const held = L.syncGateCss(['salty', 'salty-md-size-small', 'salty-indent', 'salty-outline'], coolFor('salty-md-size-small'));
    assert.deepEqual([...held].sort(), ['salty-indent', 'salty-md-size-small'], '못 받은 시트의 클래스만 미뤄요(외곽선 시트는 ① 에서 이미 받았어요)');
    const order = [...document.head.querySelectorAll('link')].map(l => l.id).filter(Boolean);
    assert.deepEqual(order, GATE_SHEETS.map(s => `salty-gate-${s.id}`), '표 차례(md → outline → type)');
    assert.equal(main.nextElementSibling, gate(GATE_SHEETS[0].id), '테마 시트 바로 뒤 줄');
    await fire(gate('md'), 'load');
    assert.ok(has('salty-md-size-small') && !has('salty-indent'), '받은 시트의 클래스만 달려요');
    await fire(gate('type'), 'load');
    assert.ok(has('salty-indent'));
    assert.deepEqual(cooled, ['달기 전', '달린 뒤'], '시트마다 달기 전에 식혀요(둘째 때는 첫 클래스가 이미 달려 있어요)');
});

await test('⑤ 설정 창 시트: panelCssReady 는 시트를 다 받은 뒤에만 풀려요', async () => {
    assert.ok(PANEL_SHEET, '설정 창 시트가 표에 있어요');
    let done = null;
    const wait = L.panelCssReady().then(v => { done = v; });
    const link = await until(() => gate('panel'), '설정 창 시트 붙음');
    await turn(); await turn();
    assert.equal(done, null, '받기 전에는 안 풀려요 — 창을 꾸밈 없이 그리지 않아요');
    assert.equal(link.previousElementSibling, gate(GATE_SHEETS.at(-1).id), '켜짐 시트들 뒤(99)');
    await fire(link, 'load');
    await wait;
    assert.equal(done, true);
    assert.equal(await L.panelCssReady(), true, '두 번째부터는 바로');
});

await test('⑥ 몸통을 못 받으면 클래스는 달고, 다음 applyAll 에서 새 주소로 다시 받아 시트를 붙여요', async () => {
    reset();
    const F = await import(`${at('src/lite.js')}?case=fail-a`);
    const want = ['salty', 'salty-outline'];
    assert.deepEqual([...F.syncGateCss(want, coolFor('salty-outline'))], ['salty-outline']);
    await until(() => has('salty-outline'), '실패 갈래가 클래스를 달아요');
    assert.deepEqual(cooled, ['달기 전'], '실패 갈래도 달기 전에 식혀요');
    assert.equal(gate('outline'), null, '몸통이 없어 시트는 아직 없어요');
    // 다음 applyAll: 클래스가 이미 body 에 있어 미룰 것은 없지만, 시트를 붙이러 다시 받아요
    assert.equal(F.syncGateCss(want, coolFor('salty-outline')).size, 0);
    const link = await until(() => gate('outline'), '다시 받은 몸통이 시트를 붙여요');
    assert.equal(link.media, 'all');
    await fire(link, 'load');
    // 그 뒤로는 받은 몸통이 일해요
    assert.equal(F.syncGateCss(['salty'], coolFor('x')).size, 0);
    assert.equal(link.media, 'not all');
});

await test('⑦ 설정 창 시트도 몸통을 못 받은 다음 번에 다시 받아요', async () => {
    reset();
    const F = await import(`${at('src/lite.js')}?case=fail-b`);
    assert.equal(await F.panelCssReady(), false, '처음엔 못 받아 false(창은 꾸밈 없이라도 열어요)');
    assert.equal(gate('panel'), null);
    let done = null;
    const wait = F.panelCssReady().then(v => { done = v; });
    const link = await until(() => gate('panel'), '다시 누르면 시트가 붙어요');
    await fire(link, 'load');
    await wait;
    assert.equal(done, true);
});

console.log(`gate-css-run: ${passed}개 통과 · ${failed}개 실패`);
if (failed) process.exitCode = 1;
