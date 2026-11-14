// 1.4.6 머리 스위치 고침(독립 검토 1.4.5 결함 1 ~ 8) — jsdom 으로 실제 DOM · 타이머를 돌려 봐요.
//   node tools/tests/headswitch-dom.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 은 tools/package.json 의 개발 의존성이에요(1.4.6 · 공개 CI 는 `cd tools && npm ci` 뒤 `node tools/tests/headswitch-dom.mjs . tools`). 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'MutationObserver', 'Event', 'CustomEvent', 'NodeFilter', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'])
    if (!(k in globalThis) || k === 'window' || k === 'document') globalThis[k] = k === 'window' ? window : window[k];
globalThis.CSS = { escape: s => String(s).replace(/["\\]/g, '\\$&'), supports: () => false };
const toasts = [];
globalThis.toastr = { info: (msg) => toasts.push(msg), warning() {}, error() {}, success() {} };
const ctx = { extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {}, characters: [], groups: [], characterId: undefined, groupId: null, eventSource: { on() {} }, event_types: {} };
globalThis.SillyTavern = { getContext: () => ctx };
const origInfo = console.info; console.info = () => {};

const url = rel => pathToFileURL(path.join(root, rel)).href;
const { getSettings, invalidateSettings } = await import(url('src/settings.js'));
const S = await import(url('src/addon-start-state.js'));
let fresh = 0;
const loadHS = () => import(`${url('src/headswitch.js')}?n=${++fresh}`);   // 부팅 하나 = 모듈 하나(모듈 안 상태가 새로)
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; origInfo(`PASS ${name}`); };

// ── 확장 서랍 뼈대 ──
function stage() {
    document.body.innerHTML = `<div class="drawer-content closedDrawer" id="rm_ext_drawer"><div id="rm_extensions_block">
        <div id="extensions_settings"></div><div id="extensions_settings2"></div></div></div>`;
    return { col1: document.getElementById('extensions_settings'), col2: document.getElementById('extensions_settings2'), drawer: document.getElementById('rm_ext_drawer') };
}
const html = s => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const qr = () => html(`<div id="qr_container" class="extension_container"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b data-i18n="Quick Reply">빠른 답장</b><div class="inline-drawer-icon down"></div></div>
    <div class="inline-drawer-content"><label><input type="checkbox" id="qr--isEnabled"> 사용</label></div></div></div>`);
const summary = () => html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><b data-i18n="ext_sum_title">요약</b></div><div class="inline-drawer-content"><p>켜기 스위치 없음</p></div></div>`);
// 캐릭터 에셋처럼: 머리줄만 먼저(늦은 애드온) → 서랍을 열면 속(켜기 스위치)을 받고 감싼 칸에 id
const assetStub = () => html(`<div class="eh-root"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>캐릭터 에셋 <button type="button" class="eh-version ext-version">v1.7.7</button></b><div class="inline-drawer-icon down"></div></div>
    <div class="inline-drawer-content" style="display:none"></div></div></div>`);
function buildAsset(stub) { stub.id = 'char_assets_settings'; stub.querySelector('.inline-drawer-content').innerHTML = '<label><input type="checkbox" data-bl-master id="eh_enabled"> 사용</label>'; }
const heads = () => [...document.querySelectorAll('.bl-hs-head')].map(sw => sw.closest('.inline-drawer').dataset.blHsStable);
const setHS = (headSwitches, extra = {}) => { ctx.extensionSettings.salty = { headSwitches, ...extra }; invalidateSettings(); getSettings(); };

await test('검토 1: 늦게 속이 생기는 창(캐릭터 에셋)은 서랍을 열어 켜기 스위치가 생길 때 다시 짝지어요 · 다 옮겼으면 알림 없음', async () => {
    toasts.length = 0;
    const { col1, col2, drawer } = stage();
    col1.append(qr()); col2.append(summary());
    setHS({ 'cls:inline-drawer': true, 'cls:inline-drawer#2': true });   // 1.4.4: 빠른 답장 = 첫 창 · 에셋 = 둘째(왼쪽 칸에 늦게 붙어 문서 차례로 #2 — 요약은 #3 으로 밀려요 · v1.4.4 번호 매기기 그대로)
    const H = await loadHS();
    H.syncHeadSwitch(true);
    assert.equal(document.querySelector('[data-bl-hs-key="cls:inline-drawer"]').dataset.blHsStable, 't:Quick Reply');
    assert.deepEqual(heads(), ['t:Quick Reply'], '짝을 찾기 전에는 옛 열쇠로 보여요(v1.4.4 모습)');
    const stub = assetStub(); col1.append(stub);   // 쉴 때 늦은 애드온이 머리줄만
    await sleep(320);
    S.markLateDone();
    await sleep(320);
    const s = getSettings();
    assert.equal(s.headSwitches['t:Quick Reply'], true, '빠른 답장은 바로 옮겨요');
    assert.deepEqual(s.headSwitchMove.done, { 'cls:inline-drawer': 't:Quick Reply' }, '에셋(#2)은 켜기 스위치가 아직 없어 남아요');
    assert.equal(s.headSwitches['cls:inline-drawer#2'], true, '옛 열쇠는 안 지워요');
    drawer.classList.replace('closedDrawer', 'openDrawer');   // 확장 서랍 열기
    await sleep(400);
    buildAsset(stub);   // 속 받기 · 감싼 칸 id
    await sleep(400);
    assert.equal(s.headSwitches['in:char_assets_settings'], true, '켜기 스위치가 생기자 다시 짝지었어요');
    assert.equal(s.headSwitchMove.done['cls:inline-drawer#2'], 'in:char_assets_settings');
    assert.deepEqual(heads().sort(), ['in:char_assets_settings', 't:Quick Reply']);
    await sleep(4300);
    assert.deepEqual(toasts, [], '다 옮겼으니 알림 없음');
    assert.equal(s.headSwitchMove.noticed, false);
    H.syncHeadSwitch(false);
});

await test('검토 1: 서랍을 열고 조용해진 뒤에도 남은 것만 한 번 알림 · 「못 옮김」으로 적어 다음 부팅엔 안 짝지음 · 다시 안 뜸', async () => {
    toasts.length = 0;
    const { col1, col2, drawer } = stage();
    col1.append(qr()); col2.append(summary());
    setHS({ 'cls:inline-drawer#2': true });   // 옛 #2 = 지금은 요약(켜기 스위치 없음)
    let H = await loadHS();
    H.syncHeadSwitch(true);
    await sleep(320);
    assert.deepEqual(toasts, [], '서랍을 열기 전엔 알리지 않아요(1.4.5 는 쉴 때 바로 떴어요)');
    drawer.classList.replace('closedDrawer', 'openDrawer');
    await sleep(2000);
    assert.deepEqual(toasts, [], '연 직후(늦은 속을 기다리는 동안)도 아직');
    await sleep(2600);
    assert.deepEqual(toasts, ['확장 위로 꺼내 둔 스위치 1개를 새 판으로 옮기지 못했어요. 확장 서랍에서 한 번만 다시 켜 주세요.']);
    const s = getSettings();
    assert.deepEqual(s.headSwitchMove, { done: { 'cls:inline-drawer#2': '' }, noticed: true, from145: false, names145: [] });
    assert.equal(s.headSwitches['cls:inline-drawer#2'], true, '옛 열쇠는 그대로(되돌리기)');
    H.syncHeadSwitch(false);
    // 다음 부팅: 차례가 바뀌어 #2 가 켜기 스위치 있는 창이 돼도 짝짓지 않아요 · 알림도 다시 없음
    const again = stage(); again.col1.append(summary()); again.col2.append(qr());
    again.col1.prepend(html('<div class="inline-drawer"><div class="inline-drawer-toggle"><b>번역</b></div><div class="inline-drawer-content"><input type="checkbox" id="tr_enabled"></div></div>'));
    H = await loadHS(); H.syncHeadSwitch(true);
    again.drawer.classList.replace('closedDrawer', 'openDrawer');
    await sleep(4500);
    assert.deepEqual(heads(), [], '못 옮김으로 적은 옛 열쇠는 읽지도 짝짓지도 않아요');
    assert.equal(toasts.length, 1, '알림은 한 번뿐');
    H.syncHeadSwitch(false);
});

await test('1.4.5 를 거친 설정(옮겼음 표시): 표시는 목록 밖으로 · 남은 옛 열쇠를 다시 짝지어요 · 알림은 이미 띄웠으니 다시 안 띄워요', async () => {
    toasts.length = 0;
    const { col1, drawer } = stage();
    col1.append(qr());
    setHS({ 'cls:inline-drawer#2': true, '@moved:stable-keys': true });
    const s = getSettings();
    assert.ok(!('@moved:stable-keys' in s.headSwitches));
    assert.equal(s.headSwitchMove.noticed, true);
    const H = await loadHS(); H.syncHeadSwitch(true);
    const stub = assetStub(); col1.append(stub);   // 에셋 = #2
    await sleep(320);
    drawer.classList.replace('closedDrawer', 'openDrawer');
    await sleep(300); buildAsset(stub); await sleep(400);
    assert.equal(s.headSwitches['in:char_assets_settings'], true, '1.4.5 가 놓친 에셋을 다시 짝지었어요');
    assert.deepEqual(heads(), ['in:char_assets_settings']);
    await sleep(4300);
    assert.deepEqual(toasts, []);
    H.syncHeadSwitch(false);
});

await test('검토 3: 옮기기를 끝낸 옛 열쇠 · 표시만 남으면 모듈을 켜지 않아요(features.js 식을 그대로 계산)', () => {
    const src = fs.readFileSync(path.join(root, 'src/features.js'), 'utf8');
    const expr = src.match(/const headSwitchWanted = (on && \(.*\));/)[1];
    const wanted = new Function('on', 's', `return ${expr};`);
    const tidy = raw => { ctx.extensionSettings.salty = raw; invalidateSettings(); return getSettings(); };
    assert.equal(wanted(true, tidy({ headSwitchRows: false, headSwitches: { '@moved:stable-keys': true } })), false, '1.4.5 표시 하나뿐');
    assert.equal(wanted(true, tidy({ headSwitchRows: false, headSwitches: { 'cls:inline-drawer#8': true }, headSwitchMove: { done: { 'cls:inline-drawer#8': 't:Quick Reply' } } })), false, '옮긴 옛 열쇠만 남음(이름 열쇠는 끔)');
    assert.equal(wanted(true, tidy({ headSwitchRows: false, headSwitches: { 'cls:inline-drawer#8': true } })), true, '아직 짝을 찾는 옛 열쇠는 켜요');
    assert.equal(wanted(true, tidy({ headSwitchRows: false, headSwitches: { 't:Quick Reply': true } })), true);
});

await test('검토 2 · 5 · 6 · 7: 공용 틀 class 가 더 붙은 창 · 판 번호 든 제목 · 제목 안 단추 data-i18n · 이름 없는 창', async () => {
    const { col1, col2 } = stage();
    col1.append(html(`<div class="inline-drawer wide100p"><div class="inline-drawer-toggle"><a class="menu_button" data-i18n="[title]Help" title="Help">?</a><span><b>My Tool</b> v2.3.1</span></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>`));
    col1.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><i class="fa-solid fa-gear" data-i18n="[title]Settings"></i><b data-i18n="[title]tip;Other Ext">Other Ext</b></div><div class="inline-drawer-content"><input type="checkbox" id="oe_enable"></div></div>`));
    col2.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><div class="inline-drawer-icon down"></div></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>`));
    setHS({ 'cls:inline-drawer#2': true }, { headSwitchMove: { done: { 'cls:inline-drawer#2': 't:Somewhere' }, noticed: false } });   // 옮긴 뒤 남겨 둔 남의 옛 열쇠
    const H = await loadHS(); H.syncHeadSwitch(true);
    const keys = [...document.querySelectorAll('[data-bl-hs-key]')].map(d => [d.dataset.blHsKey, d.dataset.blHsStable]);
    assert.deepEqual(keys, [
        ['cls:inline-drawer.wide100p', 'x:My Tool'],   // 검토 2(옛 번호 꼴로 알아봄) · 5(판 번호 뗌) · 6(단추의 [title] 건너뜀)
        ['cls:inline-drawer', 't:Other Ext'],          // 검토 6: 아이콘의 data-i18n · 속성 칸 건너뜀
        ['cls:inline-drawer#2', 'u:cls:inline-drawer'],   // 검토 7: 이름 없는 창은 u: — 옛 열쇠와 글자가 안 겹쳐요
    ]);
    assert.deepEqual(heads(), [], '이름 없는 창이 남의 옛 값(#2)을 읽지 않아요');
    // 검토 5: 한글화가 뒤에 제목 글을 바꿔도 처음 본 원문 열쇠 그대로
    document.querySelector('.wide100p b').textContent = '내 도구';
    H.refresh();
    assert.equal(document.querySelector('.wide100p').dataset.blHsStable, 'x:My Tool');
    H.syncHeadSwitch(false);
});

await test('1.4.5 이름 열쇠(판 번호 든 제목 글)는 새 열쇠로 바로 옮겨요 — 1.4.5 에서 켠 스위치가 안 사라져요', async () => {
    const { col1 } = stage();
    col1.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><b>My Tool v2.3.1</b></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>`));
    setHS({ 'x:My Tool v2.3.1': true, '@moved:stable-keys': true });   // 1.4.5 를 거친 설정(검토 H2: 그때 있던 열쇠만 옮겨요)
    const H = await loadHS(); H.syncHeadSwitch(true);
    const s = getSettings();
    assert.equal(s.headSwitches['x:My Tool'], true);
    assert.equal(s.headSwitchMove.done['x:My Tool v2.3.1'], 'x:My Tool');
    assert.deepEqual(heads(), ['x:My Tool']);
    H.syncHeadSwitch(false);
});

// ── 1.4.6 독립 검토 H1 ~ H4 ──
await test('H1: 1.4.5 에서 옮긴 뒤 끈 스위치(옛 열쇠는 남음)는 1.4.6 에서 되살아나지 않아요 · 1.4.5 가 놓친 늦은 창만 다시 짝지어요', async () => {
    toasts.length = 0;
    const { col1, drawer } = stage();
    col1.append(qr());
    // 1.4.5: 옛 「cls:inline-drawer」(빠른 답장)를 t:Quick Reply 로 옮긴 뒤 사용자가 꺼서 이름 열쇠만 지워짐 · 옛 #2(에셋)는 놓침
    setHS({ 'cls:inline-drawer': true, 'cls:inline-drawer#2': true, '@moved:stable-keys': true });
    const H = await loadHS(); H.syncHeadSwitch(true);
    const stub = assetStub(); col1.append(stub);
    await sleep(350);
    const s = getSettings();
    assert.equal(s.headSwitches['t:Quick Reply'], undefined, '1.4.5 에서 끈 빠른 답장이 다시 켜지지 않아요');
    assert.deepEqual(heads(), [], '머리 스위치도 없음');
    drawer.classList.replace('closedDrawer', 'openDrawer');
    await sleep(300); buildAsset(stub); await sleep(400);
    assert.equal(s.headSwitches['in:char_assets_settings'], true, '놓친 에셋은 다시 짝');
    assert.deepEqual(heads(), ['in:char_assets_settings']);
    assert.equal(s.headSwitches['cls:inline-drawer'], true, '옛 열쇠는 그대로');
    H.syncHeadSwitch(false);
});

await test('H2: 같은 이름 창 둘 — 첫 창만 켜면 둘째 창이 저절로 켜지지 않아요 · 1.4.5 의 t:Foo#2 는 둘째 창 그대로', async () => {
    const two = () => { const { col1 } = stage();
        for (let i = 0; i < 2; i++) col1.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><b data-i18n="Foo">Foo</b></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>`)); };
    two(); setHS({ 't:Foo': true });   // 1.4.6 새 사용자 · 첫 창만
    let H = await loadHS(); H.syncHeadSwitch(true);
    assert.equal(getSettings().headSwitches['t:Foo#2'], undefined, '둘째 창 열쇠가 안 생겨요');
    assert.deepEqual(heads(), ['t:Foo']);
    H.syncHeadSwitch(false);
    two(); setHS({ 't:Foo#2': true, '@moved:stable-keys': true });   // 1.4.5 사용자 · 둘째 창만
    H = await loadHS(); H.syncHeadSwitch(true);
    assert.deepEqual(heads(), ['t:Foo#2']);
    assert.equal(getSettings().headSwitches['t:Foo'], undefined);
    H.syncHeadSwitch(false);
    // 단추 안 data-i18n 이 다른 창 제목과 같아도(1.4.5 꼴로 겹침) 그 창이 켜지지 않아요
    const { col1 } = stage();
    col1.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><b data-i18n="Summarize">요약</b></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>`));
    col1.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><a class="menu_button" data-i18n="Summarize">?</a><b>Other</b></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>`));
    setHS({ 't:Summarize': true });
    H = await loadHS(); H.syncHeadSwitch(true);
    assert.deepEqual(heads(), ['t:Summarize']);
    assert.equal(getSettings().headSwitches['x:Other'], undefined);
    H.syncHeadSwitch(false);
});

await test('H3: 확장 칸이 계속 바뀌어도 서랍을 연 뒤 한도 시간(15초)이 지나면 정리 · 알림이 돌아요', async () => {
    toasts.length = 0;
    const { col1, col2, drawer } = stage();
    col1.append(qr()); col2.append(summary());
    const clock = html('<div class="inline-drawer"><div class="inline-drawer-toggle"><b data-i18n="Clock">Clock</b></div><div class="inline-drawer-content"><span class="t">0</span></div></div>');
    col2.append(clock);
    setHS({ 'cls:inline-drawer#2': true });   // 요약(켜기 스위치 없음) → 못 옮김
    const H = await loadHS(); H.syncHeadSwitch(true);
    await sleep(300);
    drawer.classList.replace('closedDrawer', 'openDrawer');
    let n = 0; const tick = setInterval(() => { clock.querySelector('.t').replaceChildren(document.createTextNode(String(++n))); }, 600);
    try { await sleep(16500); } finally { clearInterval(tick); }
    assert.equal(toasts.length, 1, '바뀌는 창이 있어도 한도 뒤 한 번');
    assert.equal(getSettings().headSwitchMove.done['cls:inline-drawer#2'], '');
    H.syncHeadSwitch(false);
});

await test('H4: 제목 글 열쇠가 한글화 전후로 흔들리지 않아요(켜기 스위치 id 를 제목 글보다 먼저 · 빈 글은 붙잡지 않음)', async () => {
    const make = title => { const { col1 } = stage(); col1.append(html(`<div class="inline-drawer"><div class="inline-drawer-toggle"><b>${title}</b></div><div class="inline-drawer-content"><input type="checkbox" id="lib_enabled"></div></div>`)); };
    make('Library'); setHS({}); let H = await loadHS(); H.syncHeadSwitch(true);
    const a = document.querySelector('[data-bl-hs-key]').dataset.blHsStable; H.syncHeadSwitch(false);
    make('도서관'); H = await loadHS(); H.syncHeadSwitch(true);   // 다음 부팅: 한글화가 먼저 바꿈
    const b = document.querySelector('[data-bl-hs-key]').dataset.blHsStable; H.syncHeadSwitch(false);
    assert.equal(a, b, `부팅마다 같은 열쇠 (${a} · ${b})`);
    // 처음 본 순간 제목이 비었으면 붙잡지 않고, 글이 생기면 그 글로
    const { col1 } = stage();
    const w = html('<div class="inline-drawer"><div class="inline-drawer-toggle"><b></b></div><div class="inline-drawer-content"><label><input type="checkbox"> 사용</label></div></div>');
    col1.append(w); setHS({}); H = await loadHS(); H.syncHeadSwitch(true);
    w.querySelector('b').textContent = 'Late Title'; H.refresh();
    assert.equal(w.dataset.blHsStable, 'x:Late Title');
    H.syncHeadSwitch(false);
});

await test('검토 4: 6초 한도로 나눠 시작 중에 번호를 매긴 부팅은 짝짓지 않고(다음 부팅에) 알림 · 「못 옮김」도 미뤄요', async () => {
    toasts.length = 0;
    const { col1, drawer } = stage();
    col1.append(summary()); col1.append(qr());
    setHS({ 'cls:inline-drawer#2': true });
    S.spreadBegin();
    const realNow = Date.now; let shift = 0; Date.now = () => realNow() + shift;
    try {
        const H = await loadHS(); H.syncHeadSwitch(true);   // 나눠 시작 중 — 기다려요
        assert.equal(document.querySelector('[data-bl-hs-key]'), null, '기다리는 동안은 번호 없음');
        shift = 7000; H.refresh();   // 6초 한도
        assert.equal(document.querySelectorAll('[data-bl-hs-key]').length, 2);
        S.spreadEnd(); await sleep(320);
        assert.equal(getSettings().headSwitches['t:Quick Reply'], undefined, '믿을 수 없는 번호로는 안 옮겨요');
        drawer.classList.replace('closedDrawer', 'openDrawer');
        shift = 0; await sleep(4500);
        assert.deepEqual(toasts, []); assert.deepEqual(getSettings().headSwitchMove.done, {}, '다음 부팅에 다시');
        H.syncHeadSwitch(false);
    } finally { Date.now = realNow; while (S.spreadPending()) S.spreadEnd(); }
});

await test('검토 8: lite.js 미리보기 시트 — 접힌 칸(details · 「예시 펼치기」)을 펼치면 다시 켜져요', async () => {
    const src = fs.readFileSync(path.join(root, 'src/lite.js'), 'utf8');
    const part = src.slice(src.indexOf('let holders = 0, offWatch = false;'), src.indexOf('// 5.6.6 (점검 PAB-4)')).replace(/export function/g, 'function');
    const link = { media: 'all' };
    const run = new Function('document', 'requestAnimationFrame', 'previewLinkBox', `let restored = false; const preloadPreviewCss = () => previewLinkBox; let previewLink = previewLinkBox;
        ${part}; return { restorePreviewRules, get restored() { return restored; } };`);
    // jsdom 은 배치를 안 해요 — 접힌 details 안 · display:none 안이면 「안 보임」으로
    window.Element.prototype.getClientRects = function () { return this.closest('details:not([open]), [hidden]') ? [] : [{}]; };
    document.body.innerHTML = `<div class="drawer-toggle" id="tg">서랍</div><details id="fold"><summary>예시</summary><div class="salty-preview">표본</div></details>
        <button type="button" aria-expanded="false" id="pv">예시 펼치기</button><div id="pvbox" hidden><div class="salty-sample">표본</div></div>`;
    const L = run(document, fn => setTimeout(fn, 0), link);
    L.restorePreviewRules();
    assert.equal(link.media, 'all');
    document.getElementById('tg').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await sleep(30);
    assert.equal(link.media, 'not all', '보이는 표본이 없으면 꺼요(그대로)');
    document.getElementById('fold').open = true;   // details 펼침 → toggle(거품 없음)
    await sleep(60);
    assert.equal(link.media, 'all', 'details 를 펼치면 다시 켜요');
    document.getElementById('fold').open = false; document.getElementById('tg').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await sleep(30); assert.equal(link.media, 'not all');
    const pv = document.getElementById('pv');
    pv.addEventListener('click', () => { document.getElementById('pvbox').hidden = false; pv.setAttribute('aria-expanded', 'true'); });
    pv.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await sleep(30);
    assert.equal(link.media, 'all', '「예시 펼치기」(aria-expanded 단추)로 펼쳐도 다시 켜요');
    assert.match(src, /document\.addEventListener\('toggle', e => e\.target\?\.open && later\(\), true\);/);
});

console.info = origInfo;
console.log(`headswitch-dom: ${passed} passed`);
process.exit(0);
