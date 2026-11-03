// 9.0.4 테마 색 따라가기 한 구독(src/shared/theme-look.js) — 확장마다 따로 두던 html · body · head 색 감시 12개를 묶은 것
//   ① 여러 함수가 붙어도 감시는 공용 허브 구독 몇 개 · 바뀐 종류를 모아 rAF 하나에 원하는 함수만 한 번씩
//   ② 스와이프 움직임 변수(--slide-mes-*)만 바뀐 :root style 은 아무도 안 불러요
//   ③ head · vars(#salty-vars) 는 원하는 함수가 있을 때만 봐요 ④ 다 끊으면 감시 0
//   ⑤ 옮긴 자리(북마크 · 전개 지시 · 에셋 · TTS · 과일 글자 설정)에 html · body 색 감시자가 다시 생기지 않아요
//   node tools/tests/theme-look.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({});
const { onThemeLook, themeLookStats, withoutMotion } = await import(pathToFileURL(path.join(root, 'src/shared/theme-look.js')).href);
const { domWatchStats } = await import(pathToFileURL(path.join(root, 'src/dom-watch.js')).href);
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const tick = async () => { for (let i = 0; i < 8; i++) await null; };
const html = document.documentElement, body = document.body, head = document.head;
const vars = document.createElement('style'); vars.id = 'salty-vars'; vars.textContent = ':root{--a:1}'; head.append(vars);
await tick();
let rafs = 0; const realRaf = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = fn => { rafs++; return realRaf(fn); };

await test('① 함수 셋 · 감시는 허브 구독 몇 개 · 바뀐 종류를 모아 rAF 하나에 원하는 함수만', async () => {
    const before = domWatchStats().subscriptions;
    const got = { a: [], b: [], c: [] };
    const offA = onThemeLook(k => got.a.push([...k].sort().join(' ')), { watch: 'html body', name: 'A' });
    const offB = onThemeLook(k => got.b.push([...k].sort().join(' ')), { watch: 'body.class', name: 'B' });
    const offC = onThemeLook(k => got.c.push([...k].sort().join(' ')), { watch: 'html.style', name: 'C' });
    assert.equal(domWatchStats().subscriptions - before, 2, 'html · body 구독 둘(head 는 원하는 함수가 없어 안 봐요)');
    rafs = 0;
    body.classList.add('salty-dark'); html.setAttribute('data-theme', 'x'); body.setAttribute('style', 'color:red');
    await tick();
    assert.equal(rafs, 1, 'rAF 하나');
    await dom.clock.advance(20);
    assert.deepEqual(got.a, ['body.class body.style html.data-theme']);
    assert.deepEqual(got.b, ['body.class body.style html.data-theme'], 'body.class 를 원한 함수도 그 프레임에 바뀐 종류 전부를 받아요');
    assert.deepEqual(got.c, [], 'html.style 만 원한 함수는 안 불려요');
    offA(); offB(); offC();
    assert.equal(themeLookStats().listeners, 0);
    body.classList.remove('salty-dark'); body.removeAttribute('style'); html.removeAttribute('data-theme');
});

await test('② 스와이프 움직임 변수만 바뀐 :root style 은 아무도 안 불러요', async () => {
    const got = [];
    html.setAttribute('style', '--SmartThemeBodyColor: #fff');
    const off = onThemeLook(k => got.push([...k].join(' ')), { watch: 'html', name: 'motion' });
    html.setAttribute('style', '--SmartThemeBodyColor: #fff; --slide-mes-x: 10px');
    await dom.clock.advance(20);
    html.setAttribute('style', '--SmartThemeBodyColor: #fff');
    await dom.clock.advance(20);
    assert.deepEqual(got, [], '움직임 변수만');
    html.setAttribute('style', '--SmartThemeBodyColor: #000');
    await dom.clock.advance(20);
    assert.deepEqual(got, ['html.style'], '색 변수가 바뀌면 불러요');
    assert.equal(withoutMotion('--a: 1; --slide-mes-y: 3px'), '--a: 1');
    off(); html.removeAttribute('style');
});

await test('③ head · vars 는 원하는 함수가 있을 때만 · #salty-vars 글이 바뀌면 vars', async () => {
    const got = [];
    const off1 = onThemeLook(() => {}, { watch: 'body' });
    assert.equal(themeLookStats().head, false);
    const off2 = onThemeLook(k => got.push([...k].sort().join(' ')), { watch: 'vars', name: 'vars' });
    assert.equal(themeLookStats().head, true);
    head.append(document.createElement('style'));
    await dom.clock.advance(20);
    assert.deepEqual(got, [], '다른 <style> 은 vars 가 아니에요');
    vars.textContent = ':root{--a:2}';
    await dom.clock.advance(20);
    assert.deepEqual(got, ['head vars']);
    off2();
    assert.equal(themeLookStats().head, false, 'vars 를 원한 함수가 끊기면 head 감시도 떼요');
    off1();
});

await test('④ 다 끊으면 감시 0', async () => {
    const offs = ['html', 'body head', 'vars', 'body.class'].map(w => onThemeLook(() => {}, { watch: w }));
    for (const off of offs) off();
    const s = themeLookStats();
    assert.equal(s.listeners, 0); assert.equal(s.watching, false); assert.equal(s.head, false);
    assert.equal(domWatchStats().subscriptions, 0, '허브 구독도 0');
});

await test('⑤ 옮긴 자리에 html · body 색 감시자가 다시 생기지 않아요', () => {
    const files = {
        'src/addons/bookmarks/index.js': "watch: 'html.style body.class head'",
        'src/addons/direction/index.js': "watch: 'html.style head body.class'", 'src/addons/assets/ui.js': "watch: 'html.style head body.class'",
        'src/addons/tts/src/player.js': "w.offLook = onThemeLook(later",
        'src/fruit-type-ui.js': "onThemeLook(onLook,{watch:'body.class vars'",
    };
    const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
    for (const [rel, needle] of Object.entries(files)) {
        const src = read(rel);
        assert.ok(src.includes(needle), `${rel}: 테마 색 따라가기 한 구독`);
        assert.ok(!/\.observe\(document\.(documentElement|body), \{ ?attributes: ?true, ?attributeFilter: ?\[['"](style|class)/.test(src), `${rel}: html · body 색 감시자를 따로 두지 않아요`);
    }
});

globalThis.requestAnimationFrame = realRaf;
console.log(`테마 색 따라가기 한 구독: ${pass}개 통과했어요.`);
process.exit(0);
