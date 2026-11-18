// 미트볼 2.9.1(원작 d61af0b1 · 11-18 밤) 확장 서랍 새 구조 — jsdom 위 가짜 미트볼 설정 칸(이름은 지어낸 것)
//   사용자(11-18 밤): 「미트볼 업데이트하고 그 확장 설정 쪽에서 가로 스크롤하는 거 사라짐 … 세로로 ㅈㄴ 길어 스크롤 존나존나 해도 끝이 없어」
//   원작이 서랍 칸들을 내용 칸 안 .ss-set-body 한 겹 아래로 옮기고(맨 위에 제 「설정 찾기」 칸 .ss-set-find), 테마 분류 탭은 내용 칸 바로 아래 머리만 찾아서 탭 줄을 못 만들었어요.
//   ① 새 구조에서도 분류 탭 줄(가로로 넘기는 줄) · 레몬 탭 · 정리한 보기가 걸리고, 탭 하나만 보여요
//   ② 원작 요소는 그대로(차례 · 개수) · 원작 「설정 찾기」 칸은 칸들 밖 맨 위 그대로 · 테마 찾기 칸 · 머리 돋보기는 만들지 않아요(같은 일)
//   ③ 원작 찾기 칸에 적는 동안은 탭 · 접힌 갈래로 가린 줄도 보이게(data-bl-finding) · 비우면 탭 꼴로
//   ④ 기능 다리 칸(용어집 · 모델)도 칸들 곁에 · 맞춘 판 안내 줄은 내용 칸 끝
//   ⑤ 앞 판(칸들이 내용 칸 바로 아래)은 그대로
//   ⑥ 맞춤 시트: 탭 가림 · 접힘 · 2열 격자 · 레몬 칸이 새 겹에도
//   node tools/tests/mb-291.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]  (jsdom 이 없으면 종료 코드 2 — 통과로 치지 않아요)
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
let n = 0, bad = 0;
const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (error) { if (!process.env.KEEP_GOING) throw error; bad++; console.log('not ok', name, '—', String(error?.message || error).split('\n')[0]); } };

const dom = new JSDOM('<!doctype html><html><head></head><body class="salty"></body></html>', { url: 'http://localhost/' });
const { window } = dom, doc = window.document;
for (const k of ['window', 'document', 'localStorage', 'CustomEvent', 'Element', 'HTMLElement', 'Node', 'getComputedStyle']) { try { globalThis[k] = k === 'window' ? window : window[k]; } catch { /* 읽기 전용 */ } }
window.Element.prototype.getClientRects = function () { return this.closest('[style*="display: none"]') ? [] : [{}]; };
window.Element.prototype.scrollIntoView = function () {};

let compat = null, lemon = null;
try { compat = await load('src/ext-compat.js'); lemon = await load('src/mb-lemon.js'); } catch (error) { console.log('모듈을 못 받았어요 —', String(error?.message || error).split('\n')[0]); }
lemon?.setPanelLoader?.(async () => ({ mountMbFit(body) { const el = doc.createElement('div'); body.append(el); return el; }, unmountPanel(el) { el.remove(); } }));

const HEADS = ['장부', '번역', '데이터 · 화면', '다른 확장과 같이 쓰기'];
const rows = () => `<label class="checkbox_label"><input type="checkbox" data-s="enabled"> 켜기</label>
    ${HEADS.map((h, i) => `<b class="ss-set-h">${h}</b><label class="checkbox_label"><input type="checkbox" data-s="k${i}"> 칸 ${i}</label><small>설명 ${i}</small>`).join('')}
    <label>번역 지침<textarea data-s="trRules"></textarea></label><label>모델<select data-s="aiProfile"></select></label>`;
function page({ v = '2.9.1', wrapped = true } = {}) {
    localStorage.clear();
    doc.documentElement.removeAttribute('data-bl-mb-off');
    doc.body.innerHTML = `<div id="extensions-settings-button"><div class="drawer-toggle"></div></div><div id="rm_extensions_block" class="drawer-content"><div id="ss-settings" class="ss-settings"><div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>상태창 시험 <small>v${v}</small></b><div class="inline-drawer-icon"></div></div>
        <div class="inline-drawer-content" style="display: block;">${wrapped ? `<div class="ss-set-find"><input class="ss-in ss-set-q" type="search"><small class="ss-hint ss-set-n"></small></div><div class="ss-set-body">${rows()}</div>` : rows()}</div></div></div></div>`;
    const r = doc.getElementById('ss-settings');
    const body = r.querySelector('.ss-set-body') || r.querySelector('.inline-drawer-content');
    return { r, body, originals: [...body.children], top: [...r.querySelector('.inline-drawer-content').children] };
}
const shown = (r, el) => !el.hasAttribute('data-bl-tab-off');
const theirs = el => [...el.children].filter(c => !/(^|\s)bl-ext-/.test(String(c.className || '')));

await ok('① 2.9.1 새 구조(.ss-set-body)에도 분류 탭 줄 · 레몬 탭 · 정리한 보기가 걸리고 탭 하나만 보여요', () => {
    const { r, body } = page();
    compat.startExtCompat(doc); compat.buildAll(doc);
    const nav = r.querySelector('.bl-ext-tabs');
    assert.ok(nav, '탭 줄');
    assert.equal(nav.parentElement, body, '탭 줄은 칸들 곁(.ss-set-body 바로 아래)');
    assert.deepEqual([...nav.querySelectorAll('.bl-ext-tab')].map(t => t.textContent.trim()), ['기본', ...HEADS, '블루레몬']);
    assert.equal(r.dataset.blTabs, '0');
    const groups = theirs(body).map(c => c.dataset.blTabG);
    assert.ok(groups.every(g => g !== undefined), '원작 줄마다 탭 번호');
    const visible = theirs(body).filter(c => shown(r, c));
    assert.ok(visible.length > 0 && visible.length < theirs(body).length, '첫 탭 줄만 보여요(나머지는 가림)');
    assert.ok(body.querySelector(':scope > .bl-ext-lemonpane'), '레몬 칸도 칸들 곁');
    assert.equal(r.dataset.blOrg, '1', '정리한 보기');
});
await ok('② 원작 요소는 그대로 · 원작 「설정 찾기」 칸은 맨 위 그대로 · 테마 찾기 칸 · 머리 돋보기는 안 만들어요', () => {
    const { r, body, originals, top } = page();
    compat.buildAll(doc); compat.buildAll(doc);
    assert.deepEqual(theirs(body), originals);
    const content = r.querySelector('.inline-drawer-content');
    assert.equal(content.firstElementChild, top[0], '원작 찾기 칸이 맨 위');
    assert.ok(top.every(el => el.parentElement === content), '원작 겹 그대로');
    assert.equal(r.querySelectorAll('.bl-ext-tabs').length, 1, '탭 줄 한 벌');
    assert.equal(r.querySelector('.bl-ext-find'), null, '테마 찾기 칸 없음');
    assert.equal(r.querySelector('.bl-ext-findbtn'), null, '머리 돋보기 없음');
});
await ok('③ 원작 찾기 칸에 적는 동안 data-bl-finding · 비우면 뗌', () => {
    const { r } = page();
    compat.buildAll(doc);
    const q = r.querySelector('.ss-set-q');
    q.value = '번역'; q.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.ok(r.hasAttribute('data-bl-finding'));
    q.value = ''; q.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.ok(!r.hasAttribute('data-bl-finding'));
});
await ok('③-2 닫은 길잡이는 원작 찾기 칸을 비워도(원작이 칸들의 hidden 을 모두 뗌) 다시 안 떠요', () => {
    const { r } = page();
    compat.buildAll(doc);
    const box = r.querySelector('.bl-ext-start'); assert.ok(box, '길잡이');
    r.querySelector('.bl-ext-start-x').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    box.hidden = false;   // 원작 filterSettings(el, '') 가 하는 일
    assert.ok(box.hasAttribute('data-bl-gone'));
    assert.match(read('src/ext-status.css'), /\.bl-ext-start:is\(\[hidden\], \[data-bl-gone\]\) \{ display: none !important; \}/);
});
await ok('④ 탭을 누르면 그 묶음만 · 안내 줄은 내용 칸 끝', () => {
    const { r, body } = page();
    compat.buildAll(doc);
    const tab = [...r.querySelectorAll('.bl-ext-tab')].find(t => t.dataset.blTabName === '번역');
    tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const vis = theirs(body).filter(c => shown(r, c));
    assert.ok(vis.length && vis.every(c => c.dataset.blTabG === tab.dataset.blTabTo), '번역 묶음만');
    const note = r.querySelector('small.bl-ext-compat');
    assert.ok(note && note.parentElement === r.querySelector('.inline-drawer-content'), '안내 줄은 내용 칸');
});
await ok('⑤ 앞 판(칸들이 내용 칸 바로 아래)은 그대로', () => {
    const { r, body } = page({ v: '2.9.0', wrapped: false });
    compat.buildAll(doc);
    assert.equal(r.querySelector('.bl-ext-tabs')?.parentElement, body);
    assert.ok(r.querySelector('.bl-ext-find'), '앞 판에는 테마 찾기 칸(원작 찾기 칸이 없어요)');
});
await ok('⑥ 맞춤 시트: 탭 가림 · 접힘 · 2열 격자 · 레몬 칸이 새 겹에도', () => {
    const css = read('src/ext-status.css'), lem = read('src/mb-lemon.css');
    assert.match(css, /#ss-settings:not\(\[data-bl-view="raw"\], \[data-bl-finding\]\) :is\(\.inline-drawer-content, \.ss-set-body\) > \[data-bl-tab-off\] \{ display: none !important; \}/);
    assert.match(css, /#ss-settings\[data-bl-view="org"\]:not\(\[data-bl-finding\]\) :is\(\.inline-drawer-content, \.ss-set-body\) > \[data-bl-fold-off\]/);
    assert.match(css, /#ss-settings\[data-bl-view="org"\] \.inline-drawer-content > \.ss-set-body \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    assert.match(css, /#ss-settings\[data-bl-view="org"\] :is\(\.inline-drawer-content, \.ss-set-body\) > label\[data-bl-col\]/);
    assert.match(lem, /#ss-settings\[data-bl-lemon\] :is\(\.inline-drawer-content, \.ss-set-body\) > \.bl-ext-lemonpane/);
    assert.ok(!/#ss-settings[^{}]*\s\.inline-drawer-content > (?!small\.bl-ext-compat|\.ss-set-body)/.test(css + lem), '#ss-settings 의 내용 칸 바로 아래 규칙은 모두 새 겹에도');
});
await ok('⑦ 2.9.1 새 칸은 이웃 갈래에(접힌 갈래 밖으로 새지 않게) · 이름표 → 칸 틈 8(다리 칸도)', async () => {
    const { PLANS } = await load('src/ext-organize.js');
    const keys = Object.fromEntries(PLANS['#ss-settings'].folds.flatMap(([t, list]) => list.map(k => [String(k).split(':')[0], t])));
    for (const [k, t] of [['trConvertAsk', '번역 지침 · 자동 번역'], ['trAutoConvert', '번역 지침 · 자동 번역'], ['trNotice', '번역 지침 · 자동 번역'], ['genBatchSize', '실패했을 때 · 묶어 만들기'], ['quiet', '알림 시간 · 종류']]) assert.equal(keys[k], t, k);
    assert.match(read('src/ext-status.css'), /> label > :is\(select, textarea, \.ss-set-inline\)[^{]*\{ margin: var\(--bl-s2, 8px\) 0 0; \}/);
    assert.match(read('src/ext-bridge.css'), /body\.salty \.bl-ext-bridge-pick \{ gap: var\(--bl-s2, 8px\); margin-top: var\(--bl-s2, 8px\); \}/);
});
await ok('⑧ 원작 「모델 이름만」 칸에 이름이 있으면 테마 모델 칸에 그 사실을 알려요(원작이 테마 모델을 지나쳐요)', async () => {
    const B = await load('src/ext-bridge-ui.js');
    assert.match(B.upModelNote({ aiModelOnly: 'gemini-2.5-flash' }), /gemini-2\.5-flash.*비워야/);
    assert.equal(B.upModelNote({ aiModelOnly: '' }), ''); assert.equal(B.upModelNote(undefined), '');
});
await ok('⑨ 원작 ✕(.ss-popx · 창 표식 ss-xclose)가 있는 창은 테마 ✕ 를 안 띄우고 원작 ✕ 에 테마 꼴을 입혀요(두 겹 ✕)', () => {
    const css = read('src/ext-status.css');
    assert.match(css, /dialog\.popup\.ss-dlg\.large_dialogue_popup:not\(\.ss-xclose\) > \.popup-button-close \{/);
    assert.ok(!/dialog\.popup\.ss-dlg\.large_dialogue_popup > \.popup-button-close/.test(css), '테마 ✕ 규칙은 모두 원작 ✕ 없는 창만');
    assert.match(css, /dialog\.popup\.ss-dlg\.large_dialogue_popup\.ss-xclose > \.ss-popx \{[^}]*top: 12px; right: var\(--bl-s3, 12px\)/);
});
await ok('⑩ 11-19 사용자 사진 셋: 큰 창 위 빈 띠 없음 · 스타일로 고르기 · 기능 정리 단추 왼쪽 맞춤 · 그림 하나 · 접힌 접기 줄 틈 0', () => {
    const css = read('src/ext-status.css');
    assert.ok(!/large_dialogue_popup \.popup-content:is\(\[data-bl-fade-y="top"\], \[data-bl-fade-y="both"\]\)::before \{/.test(css), '붙박이 띠 없음');
    assert.match(css, /\.ss-sp-row > button\.ss-btn\.ss-sp-open \{[^}]*text-align: start;/);
    assert.match(css, /\.ss-sp-row > button\.ss-sp-open > i \{ display: none; \}/);
    assert.match(css, /\.ss-scope details:not\(\[open\]\) \{ row-gap: 0; \}/);
});
await ok('CI 목록(release-check.yml)에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /tools\/tests\/mb-291\.mjs/);
});
console.log(bad ? `mb-291: ${bad}개 실패 · ${n}개 통과` : `mb-291: ${n}개 통과`);
process.exit(bad ? 1 : 0);
