// 1.5.3 업데이트 창의 「바뀐 내역」 — 게시 직후(GitHub Pages 배포 전)에 창을 열어도 「못 불러왔어요」로 끝나지 않게 (src/update-check.js openUpdate · fetchNotes)
//   node tools/tests/update-notes-dom.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
// 1.5.2 게시 직후: manifest(raw)는 새 판인데 Pages 의 release-notes.json 은 아직 옛것 → 새 판 항목이 없어 빈 목록 → 실패 글.
//   - 받았는데 새 판 항목이 아직 없음 → 「준비하는 중」 + 스스로 다시 시도(캐시를 피하는 주소) → 항목이 생기면 내역
//   - Pages 에 없으면 raw 의 공지 표(main 의 src/notice-data.js — manifest 와 한 커밋)로
//   - 네트워크 · 404 → 실패 글 + 「다시 시도」 단추 · 창을 닫으면 타이머 0 · 「업데이트」 단추는 어느 상태에서도 눌려요
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://example.test/', pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'localStorage'])
    globalThis[k] = k === 'window' ? window : window[k];

// ---- 타이머 세기: 모듈이 거는 setTimeout 이 창을 닫은 뒤 남는지
const live = new Set();
const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
globalThis.setTimeout = (fn, ms, ...rest) => { const id = realSet(() => { live.delete(id); fn(...rest); }, ms); live.add(id); return id; };
globalThis.clearTimeout = (id) => { live.delete(id); realClear(id); };
const sleep = ms => new Promise(r => realSet(r, ms));
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };   // setTimeout(0) 은 Windows 에서 15ms 씩이라 다시 부르기 간격을 넘겨 버려요

// ---- 흉내: 실리태번 컨텍스트 · 팝업
let popup = null;
const ctx = {
    extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {}, getRequestHeaders: () => ({}),
    getExtensionManifest: () => null, POPUP_TYPE: { CONFIRM: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0 },
    callGenericPopup: (el, type, text, opts) => new Promise((resolve) => {
        document.body.append(el);
        const btn = () => { const b = document.createElement('div'); b.className = 'menu_button'; return b; };
        const p = { okButton: btn(), cancelButton: btn(), dlg: document.createElement('dialog') };
        popup = { el, opts, p, close: () => { el.remove(); resolve(0); } };
        opts.onOpen?.(p);
    }),
};
globalThis.SillyTavern = { getContext: () => ctx };

// ---- 흉내: fetch — 설치 manifest(file:) · GitHub manifest(raw main) · Pages 공지 · raw 공지 표
const note = (version, items = [`${version} 바뀐 점`]) => ({ version, series: 2, date: '2026-11-15', items });
const OLD = [note('1.5.1'), note('1.5.0'), note('1.4.9'), note('1.4.8'), note('1.4.7')];
const NEW = [note('1.5.2', ['새 판 내역']), ...OLD];
const table = list => `// 공지 본문\nexport const NOTICES = [\n${list.map(n => JSON.stringify(n)).join(',\n')},\n];\n`;
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const text = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body), text: async () => body });
let PAGES = () => json(200, NEW), RAWTABLE = () => text(200, table(NEW));
const seen = [];
globalThis.fetch = async (u) => {
    const url = String(u);
    seen.push(url);
    if (url.startsWith('file:') && url.endsWith('manifest.json')) return json(200, { version: '1.4.8', bl_series: 2 });
    if (/raw\.githubusercontent\.com\/[^?]*\/main\/manifest\.json/.test(url)) return json(200, { version: '1.5.2', bl_series: 2 });
    if (/github\.io\/[^?]*\/release-notes\.json/.test(url)) return PAGES();
    if (/raw\.githubusercontent\.com\/[^?]*\/main\/src\/notice-data\.js/.test(url)) return RAWTABLE();
    throw new Error('예상 밖 요청 ' + url);
};
const down = () => { throw new TypeError('Failed to fetch'); };

const U = await import(pathToFileURL(path.join(root, 'src/update-check.js')).href);
assert.equal(await U.checkForUpdate({ force: true }), 's2:1.5.2');
assert.equal(U.hasUpdate(), true);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
    finally { if (popup?.el?.isConnected) popup.close(); await settle(); }
}
const box = () => popup.el.querySelector('.bl-update-notes');
const vers = () => [...box().querySelectorAll('.salty-notice-ver')].map(e => e.textContent);
const retry = () => box().querySelector('button.bl-update-retry');
const pagesHits = () => seen.filter(u => u.includes('release-notes.json'));
async function open(opts) {
    const done = U.openUpdate(opts);
    await settle();
    assert.ok(popup?.el?.isConnected, '업데이트 창이 열렸어요');
    return { done };   // 창이 닫힐 때 끝나는 약속 — 그대로 돌려주면 await 가 창이 닫힐 때까지 기다려요
}
// 업데이트 단추: onClosing 이 업데이트를 시작(단추가 바쁨으로)하고 창을 닫지 않아요 — 내역 상태와 상관없이
async function pressUpdate() {
    const kept = popup.opts.onClosing({ result: ctx.POPUP_RESULT.AFFIRMATIVE });
    assert.equal(kept, false, '업데이트를 누르면 창을 닫지 않고 업데이트를 시작해요');
    assert.ok(popup.p.okButton.hasAttribute('disabled'), '업데이트 중엔 단추가 바쁨');
    await settle(60);   // 시험엔 실리태번 extensions.js 가 없어 곧 실패 글로 돌아와요 — 단추가 다시 살아나는지
    assert.ok(!popup.p.okButton.hasAttribute('disabled'), '끝나면 단추가 다시 눌려요');
    assert.match(popup.el.querySelector('.bl-update-status').textContent, /\S/, '업데이트 결과 줄');
}

await test('여러 판 사이: 1.4.8 → 1.5.2 사이 네 판을 새것 먼저 · 맨 위만 펼침 · 10분 묶음 주소', async () => {
    PAGES = () => json(200, NEW); seen.length = 0;
    await open();
    assert.deepEqual(vers(), ['v1.5.2', 'v1.5.1', 'v1.5.0', 'v1.4.9']);
    assert.ok(box().querySelector('.salty-notice-item').classList.contains('open'));
    assert.equal(pagesHits().length, 1);
    assert.match(pagesHits()[0], /release-notes\.json\?t=\d+$/, '성공하는 첫 요청은 10분 묶음 값');
    assert.ok(!seen.some(u => u.includes('notice-data.js')), 'Pages 에 있으면 다른 출처는 안 받아요');
    await pressUpdate();
});

await test('새 판 항목이 아직 없음(Pages 배포 전): 준비 중 글 → 스스로 다시(다른 t) → 항목이 생기면 내역', async () => {
    PAGES = () => json(200, OLD); RAWTABLE = () => text(200, table(OLD)); seen.length = 0;
    await open({ retryMs: [40, 40, 40] });
    assert.match(box().textContent, /준비하는 중이에요/);
    assert.doesNotMatch(box().textContent, /못 불러왔어요/);
    assert.equal(retry(), null, '스스로 다시 부르는 동안은 단추 없음');
    await pressUpdate();
    assert.ok(seen.some(u => u.includes('notice-data.js')), 'Pages 에 없으면 raw 공지 표도 봐요');
    const first = pagesHits()[0];
    PAGES = () => json(200, NEW);
    await sleep(80); await settle();
    assert.deepEqual(vers(), ['v1.5.2', 'v1.5.1', 'v1.5.0', 'v1.4.9']);
    const again = pagesHits()[1];
    assert.ok(again && again !== first, `다시 시도는 다른 주소 (${first} → ${again})`);
    assert.equal(live.size, 0, '내역을 받은 뒤 남은 타이머 0');
});

await test('빈 응답 뒤 창을 다시 열면 10분 묶음 주소를 쓰지 않아요(캐시가 옛 목록을 다시 주지 않게)', async () => {
    PAGES = () => json(200, OLD); RAWTABLE = () => text(200, table(OLD)); seen.length = 0;
    await open({ retryMs: [] });
    const a = pagesHits()[0];
    popup.close(); await settle();
    PAGES = () => json(200, NEW);
    await open();
    const b = pagesHits()[1];
    assert.notEqual(a, b, '다시 연 창은 새 값');
    assert.deepEqual(vers(), ['v1.5.2', 'v1.5.1', 'v1.5.0', 'v1.4.9']);
});

await test('대체 출처: Pages 는 옛것이어도 raw 의 공지 표(manifest 와 한 커밋)에 새 판이 있으면 바로 내역', async () => {
    PAGES = () => json(200, OLD); RAWTABLE = () => text(200, table(NEW)); seen.length = 0;
    await open({ retryMs: [40] });
    assert.deepEqual(vers(), ['v1.5.2', 'v1.5.1', 'v1.5.0', 'v1.4.9']);
    assert.match(box().textContent, /새 판 내역/);
    assert.equal(live.size, 0, '다시 시도 타이머 없음');
    PAGES = () => json(404, null); seen.length = 0;
    popup.close(); await settle();
    await open({ retryMs: [40] });
    assert.deepEqual(vers(), ['v1.5.2', 'v1.5.1', 'v1.5.0', 'v1.4.9'], 'Pages 404 여도 raw 로');
});

await test('404 · 네트워크: 지금 실패 글 그대로 + 「다시 시도」 단추(스스로는 안 부름) → 누르면 다시 받아 내역', async () => {
    PAGES = () => json(404, null); RAWTABLE = down; seen.length = 0;
    await open({ retryMs: [40, 40] });
    assert.match(box().textContent, /바뀐 내역을 못 불러왔어요/);
    assert.match(box().innerHTML, /GitHub 릴리스/);
    assert.ok(retry(), '다시 시도 단추');
    assert.equal(retry().getAttribute('type'), 'button', '폼 제출 단추가 아니에요');
    assert.equal(live.size, 0, '실패는 스스로 다시 부르지 않아요');
    await pressUpdate();
    const n = pagesHits().length;
    PAGES = () => json(200, NEW);
    retry().click();
    await settle();
    assert.equal(pagesHits().length, n + 1);
    assert.match(pagesHits().at(-1), /\?t=\d+-/, '단추로 다시 부를 때도 캐시를 피하는 주소');
    assert.deepEqual(vers(), ['v1.5.2', 'v1.5.1', 'v1.5.0', 'v1.4.9']);
});

await test('다시 시도가 다 떨어지면: 아직 안 올라왔다는 글 + 「다시 시도」 단추 · 남은 타이머 0', async () => {
    PAGES = () => json(200, OLD); RAWTABLE = () => text(200, table(OLD)); seen.length = 0;
    await open({ retryMs: [20, 20] });
    await sleep(90); await settle();
    assert.equal(pagesHits().length, 3, '처음 + 다시 두 번');
    assert.match(box().textContent, /아직 올라오지 않았어요/);
    assert.ok(retry());
    assert.equal(live.size, 0);
    await pressUpdate();
});

await test('창을 닫으면: 다시 시도 타이머를 지우고 더는 받지 않아요(새는 타이머 0)', async () => {
    PAGES = () => json(200, OLD); RAWTABLE = () => text(200, table(OLD)); seen.length = 0;
    const { done } = await open({ retryMs: [60, 60, 60] });
    assert.match(box().textContent, /준비하는 중이에요/);
    assert.ok(live.size >= 1, '다시 시도 타이머가 걸려 있어요');
    popup.close();
    assert.equal(await done, true);
    await settle();
    assert.equal(live.size, 0, '닫은 뒤 타이머 0');
    const n = seen.length;
    await sleep(150); await settle();
    assert.equal(seen.length, n, '닫은 뒤 요청 0');
});

await test('받는 중에 창을 닫아도: 늦게 온 응답이 다시 시도를 걸지 않아요', async () => {
    let release;
    PAGES = () => new Promise(r => { release = () => r(json(200, OLD)); });
    RAWTABLE = () => text(200, table(OLD)); seen.length = 0;
    const done = U.openUpdate({ retryMs: [30] });
    await settle();
    assert.match(popup.el.querySelector('.bl-update-notes').textContent, /불러오는 중/);
    await pressUpdate();
    popup.close(); await done;
    release(); await settle();
    assert.equal(live.size, 0);
});

console.log(`\nupdate-notes-dom: ${pass} passed, ${fail} failed`);
realSet(() => process.exit(fail ? 1 : 0), 0);
