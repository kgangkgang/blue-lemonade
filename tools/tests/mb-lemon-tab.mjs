// 1.7.4 미트볼 설정 칸의 「블루레몬」 레몬 탭(src/mb-lemon.js) — jsdom 위 가짜 미트볼 설정 칸(이름은 지어낸 것)
//   ① 분류 탭 줄 맨 끝(「다른 확장과 같이 쓰기」 옆)에 레몬 탭 · 그 확장 요소는 그대로(차례 · 개수)
//   ② 레몬 탭 · 서랍 머리 레몬 단추 → 그 칸이 열리고 묶음을 그때 그려요(설정 창 모듈은 처음 열 때만) · 다른 탭이면 닫고 떼요 · 레몬 탭은 기억하지 않아요
//   ③ 맞춤을 전부 꺼도(탭 나누기 끔) · 원작 그대로 보기여도 레몬 단추 · 칸 · 「블루레몬 · 미트볼 맞춤」 한 줄이 남아 열 수 있어요
//   ④ 모양은 묶음 문이 없는 제 시트(src/mb-lemon.css) — 맞춤 시트에는 레몬 것이 없어요
//   ⑤ 테마 설정 창 「화면」 에서 「미트볼 맞춤」 묶음 · 바로가기(mb-fit)를 뺐어요 · 첫 탭의 옛 안내 묶음도 뺐어요
//   ⑥ 설정 찾기 · 변경한 설정: 옛 이름 · 별칭 그대로, 고르면 확장 탭의 레몬 탭(그 줄)으로
//   node tools/tests/mb-lemon-tab.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
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
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const load = file => import(pathToFileURL(path.join(root, file)).href);
// KEEP_GOING=1: 실패해도 끝까지(고치기 전 판에 돌려 몇 개가 없는지 한 번에)
let n = 0, bad = 0;
const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (error) { if (!process.env.KEEP_GOING) throw error; bad++; console.log('not ok', name, '—', String(error?.message || error).split('\n')[0]); } };

const dom = new JSDOM('<!doctype html><html><head></head><body class="salty"></body></html>', { url: 'http://localhost/' });
const { window } = dom, doc = window.document;
for (const k of ['window', 'document', 'localStorage', 'CustomEvent', 'Element', 'HTMLElement', 'Node', 'getComputedStyle']) { try { globalThis[k] = k === 'window' ? window : window[k]; } catch { /* 읽기 전용 */ } }
// jsdom 은 배치가 없어요 — 「보이나」는 display: none 조상이 있는지로
window.Element.prototype.getClientRects = function () { return this.closest('[style*="display: none"]') ? [] : [{}]; };
window.Element.prototype.scrollIntoView = function () {};

const SW = await load('src/mb-switch.js');
let compat = null, lemon = null, organize = null;
try { compat = await load('src/ext-compat.js'); lemon = await load('src/mb-lemon.js'); organize = await load('src/ext-organize.js'); } catch (error) { console.log('모듈을 못 받았어요 —', String(error?.message || error).split('\n')[0]); }
let mounts = 0, unmounts = 0;
lemon?.setPanelLoader?.(async () => ({
    mountMbFit(body) { mounts++; const el = doc.createElement('div'); el.className = 'salty-panel bl-mb-fit-embed'; el.innerHTML = '<div class="salty-group bl-mb-fit"><div class="salty-row"><span>「->」 화살표</span><label class="salty-switch"><input type="checkbox" data-act="mb-fit" data-key="arrow"></label></div><div class="salty-row"><span>뒤로 가기</span><label class="salty-switch"><input type="checkbox" data-toggle="chat.mbBack"></label></div></div>'; body.append(el); return el; },
    unmountPanel(el) { unmounts++; el.remove(); },
}));

// 지어낸 미트볼 설정 칸: 앞머리 + 묶음 머리 넷(마지막이 「다른 확장과 같이 쓰기」)
const HEADS = ['장부', '덧붙이는 기능', '데이터 · 화면', '다른 확장과 같이 쓰기'];
function page({ off = '' } = {}) {
    localStorage.clear();
    if (off) doc.documentElement.setAttribute('data-bl-mb-off', off); else doc.documentElement.removeAttribute('data-bl-mb-off');
    doc.body.removeAttribute('data-bl-ext-raw');
    doc.body.innerHTML = `<div id="extensions-settings-button"><div class="drawer-toggle"></div></div><div id="rm_extensions_block" class="drawer-content"><div id="ss-settings"><div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>상태창 시험</b> <small>v2.8.0</small><div class="inline-drawer-icon"></div></div>
        <div class="inline-drawer-content" style="display: block;">
            <label class="checkbox_label"><input type="checkbox" data-s="enabled"> 켜기</label>
            ${HEADS.map((h, i) => `<b class="ss-set-h">${h}</b><label><input type="checkbox" data-s="k${i}"> 칸 ${i}</label><small>설명 ${i}</small>`).join('')}
        </div></div></div></div>`;
    doc.querySelector('#extensions-settings-button .drawer-toggle').addEventListener('click', () => doc.getElementById('rm_extensions_block').classList.toggle('openDrawer'));
    const r = doc.getElementById('ss-settings');
    const originals = [...r.querySelector('.inline-drawer-content').children];
    return { r, originals };
}
const theirs = r => [...r.querySelector('.inline-drawer-content').children].filter(el => !/(^|\s)bl-ext-/.test(el.className));
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
const flush = () => new Promise(done => setTimeout(done, 0));
const has = (el, attr) => !!el && el.hasAttribute(attr);

// ── ① 탭 줄 ─────────────────────────────
await ok('탭 줄 맨 끝(「다른 확장과 같이 쓰기」 옆)에 레몬 탭 · 아이콘 · 다른 탭과 같은 꼴', () => {
    const { r } = page();
    compat.startExtCompat(doc); compat.buildAll(doc);
    const tabs = [...r.querySelectorAll('.bl-ext-tabs > .bl-ext-tab')];
    assert.deepEqual(tabs.map(t => t.textContent.trim()), ['기본', ...HEADS, '블루레몬']);
    const last = tabs.at(-1);
    assert.equal(last.dataset.blTabTo, 'bl'); assert.ok(last.querySelector('.bl-ext-lemon-ico'), '레몬 아이콘');
    assert.equal(last.getAttribute('role'), 'tab'); assert.equal(last.type, 'button');
    assert.ok(r.querySelector('.inline-drawer-content > .bl-ext-lemonpane[data-bl-tab-g="bl"]'), '레몬 칸');
    assert.ok(r.querySelector('.inline-drawer-header > .bl-ext-view'), '머리 레몬 단추');
});
await ok('그 확장의 요소는 그대로(차례 · 개수) — 우리 칸만 끼워요', () => {
    const { r, originals } = page();
    compat.buildAll(doc);
    assert.deepEqual(theirs(r), originals);
    // 두 번 불러도 한 벌
    compat.buildAll(doc);
    assert.equal(r.querySelectorAll('.bl-ext-lemonpane').length, 1); assert.equal(r.querySelectorAll('.bl-ext-lemon-tab').length, 1); assert.equal(r.querySelectorAll('.bl-ext-lemonbar').length, 1); assert.equal(r.querySelectorAll('.bl-ext-view').length, 1);
});

// ── ② 열고 닫기 ─────────────────────────────
await ok('레몬 탭 누름 → 칸 열림 · 다른 묶음 숨김 · 그때 한 번 그림 · 기억하지 않음 · 다른 탭이면 닫고 뗌', async () => {
    const { r } = page();
    compat.buildAll(doc);
    mounts = 0; unmounts = 0;
    assert.equal(mounts, 0, '서랍을 그리기만 해서는 안 그려요');
    click(r.querySelector('.bl-ext-tabs > .bl-ext-tab[data-bl-tab-name="장부"]'));
    click(r.querySelector('.bl-ext-lemon-tab'));
    await flush();
    assert.equal(r.dataset.blTabs, 'bl'); assert.ok('blLemon' in r.dataset);
    assert.ok(!has(r.querySelector('.bl-ext-lemonpane'), 'data-bl-tab-off'));
    for (const el of theirs(r)) assert.ok(has(el, 'data-bl-tab-off'), el.textContent);
    assert.equal(mounts, 1); assert.ok(r.querySelector('.bl-ext-lemonpane .bl-mb-fit-embed'));
    assert.equal(r.querySelector('.bl-ext-lemon-tab').getAttribute('aria-selected'), 'true');
    assert.equal(localStorage.getItem('bl-ext-tab:ss-settings'), '장부', '레몬 탭은 기억하지 않아요');
    click(r.querySelector('.bl-ext-tabs > .bl-ext-tab[data-bl-tab-to="2"]'));
    assert.ok(!('blLemon' in r.dataset)); assert.ok(has(r.querySelector('.bl-ext-lemonpane'), 'data-bl-tab-off'));
    assert.equal(unmounts, 1); assert.ok(!r.querySelector('.bl-ext-lemonpane .bl-mb-fit-embed'));
});
await ok('머리 레몬 단추 → 레몬 탭 · 한 번 더 → 기억한 탭으로 · 이름 · 열림 표시', async () => {
    const { r } = page();
    compat.buildAll(doc);
    click(r.querySelector('.bl-ext-tabs > .bl-ext-tab[data-bl-tab-name="덧붙이는 기능"]'));
    const head = r.querySelector('.bl-ext-view');
    click(head); await flush();
    assert.equal(r.dataset.blTabs, 'bl'); assert.equal(head.getAttribute('aria-expanded'), 'true');
    assert.match(head.getAttribute('aria-label'), /블루레몬 · 미트볼 맞춤/);
    assert.ok(!head.hasAttribute('aria-pressed'), '누르면 탭으로 가는 단추(켜고 끄는 단추 아님)');
    click(head);
    assert.equal(r.dataset.blTabs, '2'); assert.equal(head.getAttribute('aria-expanded'), 'false');
});

// ── ③ 전부 끔 · 원작 그대로 ─────────────────────────────
await ok('맞춤을 전부 꺼도(탭 나누기 끔) 레몬 단추 · 칸 · 한 줄이 남고 열려요', async () => {
    const { r, originals } = page({ off: SW.MB_KEYS.join(' ') });
    compat.buildAll(doc);
    assert.ok(!r.querySelector('.bl-ext-tabs'), '탭 나누기를 끄면 탭 줄은 안 만들어요(원작처럼 길게)');
    const bar = r.querySelector('.inline-drawer-content > .bl-ext-lemonbar > .bl-ext-lemon-open');
    assert.ok(bar, '「블루레몬 · 미트볼 맞춤」 한 줄'); assert.ok(r.querySelector('.bl-ext-lemonpane')); assert.ok(r.querySelector('.bl-ext-view'));
    assert.deepEqual(theirs(r), originals);
    mounts = 0;
    click(bar); await flush();
    assert.ok('blLemon' in r.dataset); assert.equal(bar.getAttribute('aria-expanded'), 'true'); assert.equal(mounts, 1);
    click(r.querySelector('.bl-ext-view'));
    assert.ok(!('blLemon' in r.dataset), '머리 단추로 닫아요');
    click(r.querySelector('.bl-ext-view')); await flush();
    assert.ok('blLemon' in r.dataset, '머리 단추로 열어요');
});
await ok('원작 그대로 보기여도 레몬 단추가 칸을 열어요(탭 줄은 숨어도)', async () => {
    const { r } = page();
    compat.buildAll(doc);
    organize.setView(r, true);
    assert.equal(r.dataset.blView, 'raw'); assert.ok(doc.body.hasAttribute('data-bl-ext-raw'));
    const head = r.querySelector('.bl-ext-view');
    assert.ok(!head.hasAttribute('data-bl-on'), '원작 그대로면 흐린 레몬');
    click(head); await flush();
    assert.ok('blLemon' in r.dataset); assert.ok(r.querySelector('.bl-ext-lemonpane .bl-mb-fit-embed'));
    organize.setView(r, false);
    assert.ok(head.hasAttribute('data-bl-on'));
});

// ── ④ 시트 ─────────────────────────────
await ok('모양은 묶음 문 없는 제 시트 — 레몬 단추 · 칸 · 한 줄, 맞춤 시트에는 없어요', () => {
    const css = read('src/mb-lemon.css'), status = read('src/ext-status.css');
    assert.match(css, /\.inline-drawer-header > \.bl-ext-view \{ display: inline-flex !important;/);
    assert.match(css, /#ss-settings\[data-bl-lemon\] \.inline-drawer-content > \.bl-ext-lemonpane:not\(#bl-lemon-x\) \{ display: block !important;/);
    assert.match(css, /:root\[data-bl-mb-off~="tabs"\] body\.salty #ss-settings \.inline-drawer-content > \.bl-ext-lemonbar/);
    assert.ok(!/data-bl-mb-off~="(?!tabs")/.test(css), '스위치 문은 「탭 나누기 끔」 때 한 줄을 보이는 데만');
    assert.ok(!/\.bl-ext-view \{ display|bl-ext-lemon(pane|bar|-tab|-open)/.test(status),'맞춤 시트(묶음 문)에는 레몬 단추 · 칸 모양이 없어요');
    assert.match(read('src/mb-lemon.js'), /new URL\('\.\/mb-lemon\.css', import\.meta\.url\)/);
});

// ── ⑤ 테마 설정 창 ─────────────────────────────
await ok('테마 설정 창 「화면」 에서 「미트볼 맞춤」 묶음 · mb-fit 바로가기를 빼고, 레몬 탭이 같은 묶음을 그려요', () => {
    const panel = read('src/panel.js');
    assert.ok(!/\$\{mbFitGroups\(s\)\}/.test(panel), '화면 탭에 묶음이 없어요');
    assert.ok(!/initialExtension === 'mb-fit'|ui\.mbOnly === 'fit'/.test(panel), '좁은 창 바로가기 없음');
    assert.match(panel, /export function mountMbFit\(container\)/);
    assert.match(panel, /root\.innerHTML = mbFitGroups\(getSettings\(\)\);/);
    for (const act of ['mb-fit', 'mb-fit-all', 'mb-fit-raw']) assert.ok(panel.includes(`case '${act}':`), `${act} 처리 그대로`);
    const bridge = read('src/ext-bridge-ui.js');
    assert.ok(!/data-bl-bridge': 'fit'|맞춤 켜고 끄기|openPopup\?\.\(false, 'mb-fit'\)/.test(bridge), '첫 탭의 옛 안내 묶음 · 단추 없음(레몬 탭과 겹침)');
});

// ── ⑥ 설정 찾기 ─────────────────────────────
await ok('설정 찾기: 옛 이름 · 별칭 그대로 · 길은 레몬 탭 · 고르면 그리로', async () => {
    assert.ok(lemon.isLemonPath('@mb') && lemon.isLemonPath('@mb:arrow') && lemon.isLemonPath('chat.mbBack') && lemon.isLemonPath('chat.mbOff') && lemon.isLemonPath('chat.mbPromptCap'));
    assert.ok(!lemon.isLemonPath('chat.mbFace') && !lemon.isLemonPath('chat.mbFaceTone') && !lemon.isLemonPath('chat.backClose'), '꾸미기 보기 · 다른 칸은 그대로');
    const { SEARCH_ENTRIES } = await load('src/settings-search.js');
    const by = t => SEARCH_ENTRIES.find(e => e.title === t);
    assert.equal(by('미트볼 맞춤').path, '@mb'); assert.equal(by('미트볼 맞춤').breadcrumb, '확장 › 미트볼 상태창 › 블루레몬');
    assert.ok(by('미트볼 맞춤').words.includes('원작'), '별칭 그대로');
    assert.equal(by('원작 그대로 보기 (이 기기)').path, '@mb:raw');
    for (const sw of SW.MB_SWITCHES) if (!sw.setting) assert.equal(by(`미트볼 맞춤: ${sw.name}`)?.path, `@mb:${sw.key}`, sw.name);
    assert.equal(by('뒤로 가기로 미트볼 창 닫기').breadcrumb, '확장 › 미트볼 상태창 › 블루레몬');
    const panel = read('src/panel.js');
    assert.match(panel, /const navigate = entry => \{\r?\n\s+if \(isLemonPath\(entry\.path\)\) \{ goMbLemon\(root, entry\.path\); return; \}/);
    assert.match(panel, /function jumpToSetting\(root, path\) \{\r?\n\s+if \(isLemonPath\(path\)\) \{ goMbLemon\(root, [^;]*\bpath\); return; \}/);   // 1.7.6 끈 스위치 줄(chat.mbOff.<열쇠>)은 그 스위치로 바꿔 넘겨요
});
await ok('찾기에서 고르면: 확장 서랍 → 레몬 탭 → 그 줄 표시', async () => {
    const { r } = page();
    compat.buildAll(doc);
    assert.ok(!doc.getElementById('rm_extensions_block').classList.contains('openDrawer'));
    assert.equal(await lemon.gotoMbLemon('@mb:arrow', doc), true);
    assert.ok(doc.getElementById('rm_extensions_block').classList.contains('openDrawer'), '확장 서랍을 열어요');
    assert.equal(r.dataset.blTabs, 'bl');
    assert.ok(r.querySelector('[data-key="arrow"]').closest('.salty-row').hasAttribute('data-bl-lemon-hit'));
    await lemon.gotoMbLemon('chat.mbBack', doc);
    assert.ok(r.querySelector('[data-toggle="chat.mbBack"]').closest('.salty-row').hasAttribute('data-bl-lemon-hit'));
    assert.equal(r.querySelectorAll('[data-bl-lemon-hit]').length, 1);
});
await ok('1.7.7 미트볼이 꺼져 있거나 안 깔린 때: 어디서 켜는지 알리고 확장 탭을 열어 둬요', async () => {
    const { r } = page();
    r.remove();   // 그 확장 설정 칸이 없어요
    doc.getElementById('rm_extensions_block').classList.remove('openDrawer');
    const told = []; const was = globalThis.toastr; globalThis.toastr = { info: (text, title) => told.push([text, title]) };
    try {
        assert.equal(await lemon.gotoMbLemon('@mb:arrow', doc), false);
        assert.equal(told.length, 1); assert.equal(told[0][0], lemon.MB_MISSING); assert.equal(told[0][1], lemon.LEMON_TITLE);
        for (const w of ['꺼져 있거나', '확장 탭', '「확장 관리」에서', '「블루레몬」 탭']) assert.ok(lemon.MB_MISSING.includes(w), w);
        assert.ok(doc.getElementById('rm_extensions_block').classList.contains('openDrawer'), '확장 탭을 열어 둬요');
    } finally { globalThis.toastr = was; }
});

console.log(`mb-lemon-tab: ${n}개 통과${bad ? ` · ${bad}개 실패` : ''}`);
if (bad || !compat || !lemon) process.exitCode = 1;
