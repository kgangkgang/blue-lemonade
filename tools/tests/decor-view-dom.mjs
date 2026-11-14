// 장식 액자(src/decor-view.js) — 켠 뒤 새로 붙는 메시지 사진에도 액자가 씌워지는지 jsdom 으로 돌려 봐요.
//   node tools/tests/decor-view-dom.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
// 1.5.0 버그 사냥: quiet(fn) 이 감시 구독의 off.quiet(인자 없음)에 fn 을 넘겨 fn 이 한 번도 안 돌았어요 —
//   감시가 걸린 뒤의 flush(새 사진 감싸기 · 떨어진 사진 풀기)가 통째로 건너뛰어졌어요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="chat"></div></body></html>', { pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'MutationObserver', 'Event', 'CustomEvent', 'NodeFilter', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'Image'])
    if (!(k in globalThis) || k === 'window' || k === 'document') globalThis[k] = k === 'window' ? window : window[k];
globalThis.requestIdleCallback ||= (fn) => setTimeout(() => fn({ timeRemaining: () => 50, didTimeout: false }), 0);
globalThis.cancelIdleCallback ||= clearTimeout;

const url = rel => pathToFileURL(path.join(root, rel)).href;
const { syncDecorView } = await import(url('src/decor-view.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

const decor = { on: true, art: 'data:image/png;base64,AA==', mask: 'data:image/png;base64,AA==', motion: false };
const settings = { enabled: true, image: { decor: { on: false } }, profile: { mode: 'banner', decor }, userProfile: { mode: 'off', decor: { on: false } } };
const chat = document.getElementById('chat');
const mes = (id) => {
    const t = document.createElement('template');
    t.innerHTML = `<div class="mes" mesid="${id}" is_user="false" is_system="false"><div class="mesAvatarWrapper"><div class="avatar"><img src="a${id}.png"></div></div><div class="mes_text">글 ${id}</div></div>`;
    return t.content.firstElementChild;
};
const framed = (m) => m.querySelector('.avatar img').parentElement.classList.contains('bl-art-photo');

await test('켤 때 이미 있던 메시지 사진에 액자', async () => {
    chat.append(mes(0));
    syncDecorView(settings);
    assert.ok(framed(chat.querySelector('[mesid="0"]')));
});

await test('감시가 걸린 뒤 새로 붙은 메시지 사진에도 액자(quiet 가 본문을 건너뛰지 않음)', async () => {
    const m = mes(1);
    chat.append(m);
    await sleep(80);   // MutationObserver → 구독 나눠 주기 → requestAnimationFrame(flush)
    assert.ok(framed(m), '새 메시지 사진이 감싸지지 않았어요');
});

await test('메시지를 지우면 감싸 둔 기록도 풀려요(다시 붙여도 한 겹만)', async () => {
    const m = chat.querySelector('[mesid="1"]');
    m.remove();
    await sleep(80);
    chat.append(m);
    await sleep(80);
    assert.equal(m.querySelectorAll('.bl-art-photo').length, 1);
});

await test('끄면 액자를 풀어요', async () => {
    syncDecorView({ ...settings, enabled: false });
    for (const m of chat.querySelectorAll('.mes')) assert.ok(!framed(m));
});

console.log(`decor-view-dom: ${passed} passed`);
window.close();
