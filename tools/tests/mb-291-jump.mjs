// 미트볼 2.9.1(원작 d61af0b1) 서랍 — 🔎 상태창 검색 › 설정으로 가기 · 「확장 탭에 보이기」 줄 (버그 사냥 5차 · jsdom 위 가짜 설정 칸 · 이름은 지어낸 것)
//   ① 그 확장이 찾은 칸으로 굴리고 반짝 표시(.ss-set-flash)를 달면: 그 칸이 다른 분류 탭에 있으면 그 탭으로 바꿔요(전에는 가린 자리라 아무것도 안 보였어요)
//   ② 접힌 갈래에 든 칸이면 그 갈래를 펼쳐요
//   ③ 그 확장이 찾기 칸을 (입력 사건 없이) 비우고 간 때: 찾기 표식(data-bl-finding)을 떼어 탭 줄이 돌아와요
//   ④ 반짝 표시를 알아채는 신호는 빌린 키프레임 0.001초(감시자 없음) · 원작 그대로 보기 · 맞춤 「탭」 스위치를 끄면 안 걸려요
//   ⑤ 테마 「확장 탭에 보이기」 줄은 2.9.1 에서 칸들 겹(.ss-set-body) 밖(내용 칸 맨 앞)에 남아요 — 앞 판처럼 첫 탭에서만 보여요(다른 탭 · 찾기 칸은 그대로)
//   원작 코드는 싣지 않아요(하는 일만 흉내: 찾기 칸 비우기 · hidden 떼기 · 반짝 class).
//   node tools/tests/mb-291-jump.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]  (jsdom 이 없으면 종료 코드 2 — 통과로 치지 않아요)
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
window.Element.prototype.getClientRects = function () { return [{}]; };
let scrolled = [];
window.Element.prototype.scrollIntoView = function () { scrolled.push(this); };

const compat = await load('src/ext-compat.js');
const lemon = await load('src/mb-lemon.js');
lemon.setPanelLoader?.(async () => ({ mountMbFit(body) { const el = doc.createElement('div'); body.append(el); return el; }, unmountPanel(el) { el.remove(); } }));
compat.startExtCompat(doc);

const HEADS = ['장부', '번역', '데이터 · 화면', '다른 확장과 같이 쓰기'];
function page({ v = '2.9.1', wrapped = true } = {}) {
    localStorage.clear();
    doc.documentElement.removeAttribute('data-bl-mb-off');
    doc.body.removeAttribute('data-bl-ext-raw');
    const rows = `<label class="checkbox_label"><input type="checkbox" data-s="enabled"> 켜기</label>
        ${HEADS.map((h, i) => `<b class="ss-set-h">${h}</b><label class="checkbox_label"><input type="checkbox" data-s="k${i}"> 칸 ${i}</label><small>설명 ${i}</small>`).join('')}
        <label>번역 지침<textarea data-s="trRules"></textarea></label><label>모델<select data-s="aiProfile"></select></label>`;
    doc.body.innerHTML = `<div id="ss-settings" class="ss-settings"><div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>상태창 시험 <small>v${v}</small></b><div class="inline-drawer-icon"></div></div>
        <div class="inline-drawer-content" style="display: block;">${wrapped ? `<div class="ss-set-find"><input class="ss-in ss-set-q" type="search"><small class="ss-hint ss-set-n"></small></div><div class="ss-set-body">${rows}</div>` : rows}</div></div></div>`;
    compat.buildAll(doc);
    const r = doc.getElementById('ss-settings');
    return { r, body: r.querySelector('.ss-set-body') || r.querySelector('.inline-drawer-content'), q: r.querySelector('.ss-set-q') };
}
const rowOf = (r, key) => { const body = r.querySelector('.ss-set-body') || r.querySelector('.inline-drawer-content'); let el = r.querySelector(`[data-s="${key}"]`); while (el.parentElement !== body) el = el.parentElement; return el; };
// 그 확장이 하는 일(흉내): 찾기 칸에 가린 칸이면 찾기 칸을 사건 없이 비우고 hidden 을 다 떼요 → 그 줄로 굴리고 반짝 class — 맞춤 시트의 신호(빌린 키프레임)가 animationstart 로 와요
function jump(r, key, { signal = true } = {}) {
    const t = rowOf(r, key), q = r.querySelector('.ss-set-q');
    if (q && t.closest('[hidden]')) { q.value = ''; for (const c of r.querySelector('.ss-set-body').children) c.hidden = false; }
    t.scrollIntoView(); t.classList.add('ss-set-flash');
    if (signal) { const e = new window.Event('animationstart', { bubbles: true }); Object.defineProperty(e, 'animationName', { value: 'ss-pulse' }); t.dispatchEvent(e); }
    return t;
}
const type = (q, text) => { q.value = text; q.dispatchEvent(new window.Event('input', { bubbles: true })); };

await ok('① 다른 분류 탭의 칸으로 가면 그 탭으로 바꾸고 그 줄로 다시 굴려요', () => {
    const { r } = page();
    assert.equal(r.dataset.blTabs, '0');
    scrolled = [];
    const t = jump(r, 'k2');
    assert.equal(t.hasAttribute('data-bl-tab-off'), false, '그 줄이 보여요');
    assert.equal(r.dataset.blTabs, t.dataset.blTabG, '그 줄의 탭');
    assert.ok(r.querySelector(`.bl-ext-tab[data-bl-tab-to="${t.dataset.blTabG}"]`).classList.contains('active'));
    assert.equal(scrolled.at(-1), t, '바꾼 뒤 그 줄로 다시 굴림');
    // 이미 보이는 칸이면 아무것도 안 바꿔요(다시 굴리지도 않아요)
    t.classList.remove('ss-set-flash'); scrolled = [];
    const same = jump(r, 'k2');
    assert.equal(scrolled.length, 1, '그 확장의 굴림 한 번뿐'); assert.equal(same.hasAttribute('data-bl-tab-off'), false);
});
await ok('② 접힌 갈래에 든 칸이면 갈래를 펼쳐요', () => {
    const { r } = page();
    const t = rowOf(r, 'trRules');
    assert.ok(t.dataset.blFold && 'blFoldOff' in t.dataset, '처음엔 접혀 있어요(정리한 보기)');
    jump(r, 'trRules');
    assert.equal('blFoldOff' in t.dataset, false, '펼침');
    assert.equal(t.hasAttribute('data-bl-tab-off'), false, '그 탭');
    assert.equal(r.querySelector(`.bl-ext-fold[data-bl-fold-for="${t.dataset.blFold}"]`).getAttribute('aria-expanded'), 'true');
});
await ok('③ 찾기 칸에 적은 뒤 가린 칸으로 가면(그 확장이 칸을 사건 없이 비움): 찾기 표식을 떼고 탭 꼴로', () => {
    const { r, q } = page();
    type(q, '장부');
    assert.ok(r.hasAttribute('data-bl-finding'));
    for (const c of r.querySelector('.ss-set-body').children) c.hidden = !/장부|칸 0/.test(c.textContent);
    const t = jump(r, 'k3');
    assert.equal(q.value, '');
    assert.equal(r.hasAttribute('data-bl-finding'), false, '표식을 뗌');
    assert.equal(t.hasAttribute('data-bl-tab-off'), false, '그 칸의 탭으로');
    // 찾기 칸에 글이 남은 채 보이는 칸으로 가면 찾는 꼴 그대로(탭을 안 바꿔요)
    const { r: r2, q: q2 } = page();
    type(q2, '칸 3');
    const before = r2.dataset.blTabs;
    jump(r2, 'k3');
    assert.ok(r2.hasAttribute('data-bl-finding')); assert.equal(r2.dataset.blTabs, before);
});
await ok('④ 원작 그대로 보기 · 맞춤 「탭」 스위치 끔에서는 안 바꿔요 · 신호는 빌린 키프레임 0.001초(감시자 없음)', () => {
    let { r } = page();
    r.querySelector('.bl-ext-tab[data-bl-tab-to="2"]');
    r.dataset.blView = 'raw';
    assert.equal(compat.revealFlash(rowOf(r, 'k2')), false);
    ({ r } = page());
    doc.documentElement.setAttribute('data-bl-mb-off', 'tabs');
    const t = jump(r, 'k2');
    assert.equal(r.dataset.blTabs, '0', '스위치를 끄면 그대로');
    doc.documentElement.removeAttribute('data-bl-mb-off');
    assert.ok(t);
    const css = read('src/ext-status.css');
    assert.match(css, /body\.salty:not\(\[data-bl-ext-raw\]\) #ss-settings \.ss-set-body \.ss-set-flash \{ animation: ss-pulse \.001s 1 !important; \}/);
    const sec = css.slice(0, css.indexOf('.ss-set-flash { animation'));
    assert.equal(sec.slice(sec.lastIndexOf('/* @mb ')).startsWith('/* @mb tabs */'), true, '「탭」 묶음 문 안');
    assert.ok(!/MutationObserver/.test(read('src/ext-compat.js').slice(read('src/ext-compat.js').indexOf('export function revealFlash'), read('src/ext-compat.js').indexOf('let started = false'))));
    // 앞 판(2.9.0 · 칸들이 내용 칸 바로 아래): 반짝 표시가 와도 그대로 돌아요
    const old = page({ v: '2.9.0', wrapped: false });
    const t2 = rowOf(old.r, 'k1'); t2.classList.add('ss-set-flash');
    assert.equal(compat.revealFlash(t2), true); assert.equal(t2.hasAttribute('data-bl-tab-off'), false);
});
await ok('⑤ 「확장 탭에 보이기」 줄(내용 칸 맨 앞 · 칸들 겹 밖)은 첫 탭에서만 · 원작 찾기 칸은 늘 보여요', () => {
    for (const wrapped of [true, false]) {
        const { r } = page({ v: wrapped ? '2.9.1' : '2.9.0', wrapped });
        const content = r.querySelector('.inline-drawer-content');
        const hs = doc.createElement('div'); hs.className = 'bl-hs-row'; content.prepend(hs);   // src/headswitch.js 가 탭보다 늦게 끼운 꼴
        compat.buildAll(doc);
        assert.equal(hs.dataset.blTabG, '0', `첫 탭 것(${wrapped ? '2.9.1' : '2.9.0'})`);
        r.querySelector('.bl-ext-tab[data-bl-tab-to="2"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
        assert.ok(hs.hasAttribute('data-bl-tab-off'), '다른 탭에서는 가림');
        if (wrapped) assert.equal(r.querySelector('.ss-set-find').hasAttribute('data-bl-tab-off'), false, '원작 찾기 칸은 안 가려요');
        r.querySelector('.bl-ext-tab[data-bl-tab-to="0"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
        assert.equal(hs.hasAttribute('data-bl-tab-off'), false);
    }
    assert.match(read('src/ext-status.css'), /:is\(\.inline-drawer-content, \.ss-set-body\) > \[data-bl-tab-off\] \{ display: none !important; \}/, '내용 칸 바로 아래 줄도 같은 가림 규칙');
});
await ok('CI 목록(release-check.yml)에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /tools\/tests\/mb-291-jump\.mjs/);
});
console.log(bad ? `mb-291-jump: ${bad}개 실패 · ${n}개 통과` : `mb-291-jump: ${n}개 통과`);
process.exit(bad ? 1 : 0);
