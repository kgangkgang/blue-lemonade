import { positionMessageMenu } from './menu-position.js';
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';
import { booting, afterBoot } from './boot-gate.js';
import { watchDom } from './dom-watch.js';
import { GATE_SHEETS, PANEL_SHEET } from './css-gates.gen.js';   // 1.1.6 뗀 규칙 시트 표(tools/build-css.cjs 가 만들어요)
// 9.0.1 설정 창 미리보기 CSS 는 따로 받는 시트(src/preview.gen.css)로만 — 설정 창 · 미리보기를 처음 쓸 때 <link> 로 붙인다.
//
// css/23-preview.gen.css 는 #chat 규칙을 :is(#salty-nochat, .salty-preview) · .salty-sample 용으로 복사한 것이고(tools/gen-preview-css.js),
// 빌드(tools/css-park.cjs)가 그 사본과 미리보기 전용 손 규칙(24-previewbox …)을 style.css 에서 통째로 떼어 src/preview.gen.css 로 쓴다.
// 브라우저는 채팅 본문이 바뀔 때마다 바뀐 요소를 모든 규칙과 견주는데 이 규칙들은 설정 창 밖에서는 절대 맞지 않는다 —
// 그래서 2.5.2 ~ 8.x 는 style.css 안에서 꺼 뒀다가 켰고(@media not all · 10-28 부터는 작은 <style> 로 옮겨 켬), 9.0.1 부터는 아예 받지 않는다.
// 안 열면 0KB · 파싱도 없다. 열면 테마 시트 바로 뒤(서랍 전용 <style> 보다 앞 — 원래 style.css 안 차례)에 붙고, 쓰는 동안만 켠다.
// 받기 전 · 못 받았을 때: 표본 칸은 style.css 의 폴백(24-previewbox — 표본 숨김 · 안내 한 줄)으로 보인다. 실제 채팅은 늘 바로 바뀐다.
const PREVIEW_URL = new URL('./preview.gen.css', import.meta.url).href;
let previewLink = null;   // <link id="salty-preview-css">
let restored = false;     // 켜져 있나 (media all)

// 1.1.6 CSS 줄이기 첫 걸음: 기본값에서 하나도 안 맞는 규칙(글자 외곽선 · 고른 마크다운 모양 · 들여쓰기 · 정보 정렬)과 테마 설정 창(.salty-panel) 안에서만 맞는 규칙은
//   첫 장(style.css) · 전체 장(style-lazy.gen.css) 둘 다에 싣지 않고 작은 시트(src/markdown.gen.css · src/gate-*.gen.css · src/panel.gen.css)로 떼어 둬요(tools/css-gates.cjs).
//   기본값이면 받지도 않아요(0KB · 해석 없음). 1.1.1 마크다운 분리(첫 장에서만)를 일반화한 것이에요.
//   · 켜짐 시트: 그 클래스가 body 에 붙기 전에 시트를 붙이고, 다 받은 뒤에 클래스를 켜요(syncGateCss 가 미룰 클래스를 돌려주면 apply.js 가 그 클래스만 늦게 달아요)
//     — 켜는 순간 꾸밈 없는 한 프레임이 없어요. 부팅 때 이미 켜 둔 설정이면 applyAll 첫 번에 바로 붙어요(덮개가 걷히기 전).
//   · 설정 창 시트: 설정 창을 만들기 전에(index.js loadPanel · first-run.js) panelCssReady() 를 기다려요. 서랍 · ✦ 메뉴를 누르는 순간 미리 받아요(preloadPreviewCss).
//   · 자리: 테마 시트 뒤 줄(첫 장 → 가벼운 사본 · 전체 장 → 미리보기 → 켜짐 시트들(표 차례) → 설정 창 시트) — 그 뒤에 서랍 전용 칸 · 호환 시트가 와요.
//     원래 이 규칙보다 뒤에 있던 규칙과 덮어쓰기를 겨루는 규칙은 빌드가 떼지 않아서 이 자리로 와도 화면이 같아요(tools/tests/css-gates-order.mjs).
// 붙이고 기다리는 몸통은 src/gate-css.js(켤 때만 받아요) — 시작 묶음에는 표와 이 작은 입구만 둬요.
/** 테마 시트 뒤 줄(가벼운 사본 · 전체 장 · 미리보기 · 뗀 규칙 시트들)의 마지막 노드 — 그 뒤에 서랍 전용 칸 · 호환 시트가 붙어요.
 *  order 를 주면 data-bl-gate 가 그보다 큰 시트 앞에서 멈춰요(그 자리에 붙일 때 — 미리보기 -1 · 켜짐 시트 0.. · 설정 창 99) */
export function themeRunEnd(node, order = Infinity) {
    let end = node;
    for (let n = node?.nextElementSibling; n && (n.id === 'salty-lazy-css' || n.id === 'salty-ext-css' || n.dataset?.blGate != null) && !(Number(n.dataset?.blGate) > order); n = n.nextElementSibling) end = n;
    return end;
}
let gateApi = null, gateWant = [], gateCool = null, gateTry = 0, gateBusy = null;
// 못 받은 모듈 주소는 브라우저가 기억해요(weather-load.js · tts shell 과 같은 까닭) — 다시 받을 땐 주소 뒤에 ?retry= 를 붙여요. 받는 중이면 같은 약속을 써요(몸통이 두 벌 되지 않게)
const gateLoad = () => gateBusy ??= (gateTry ? import(`./gate-css.js?retry=${gateTry}`) : import('./gate-css.js')).then(m => (gateApi = m), (error) => { gateTry++; throw error; }).finally(() => { gateBusy = null; });
const gated = c => GATE_SHEETS.some(s => s.classes.includes(c) || s.prefixes.some(p => c.startsWith(p)));
/**
 * applyAll 이 body 클래스를 바꾸기 직전에 불러요(want = 달 클래스 전부). 켠 설정의 시트를 붙이고, 시트가 아직 안 와서 지금 달면
 * 꾸밈 없이 한 번 그려질 클래스 모음(held)을 돌려줘요 — apply.js 는 그 클래스만 빼고 달고, 시트가 오면 src/gate-css.js 가 달아요.
 * 기본값(켠 것 없음)이면 아무것도 받지 않아요.
 * cool = 미룬 클래스를 나중에 달기 직전에 부를 「긴 채팅 식히기」(apply.js 가 features.js coolChatForRestyle 을 넘겨요 — 여기서 features.js 를 부르면 서로 물려요).
 */
export function syncGateCss(want, cool = null) {
    gateWant = [...want];
    if (cool) gateCool = cool;
    if (gateApi) return gateApi.syncGateCss(gateWant, false, gateCool);
    const held = new Set(gateWant.filter(c => !document.body.classList.contains(c) && gated(c)));
    // 몸통을 못 받은 적이 있으면(gateTry) 미룰 클래스가 없어도 다시 받아요 — 실패 갈래가 클래스를 이미 달아 held 가 비는데, 시트가 붙어야 켠 꾸밈이 보여요
    if (held.size || (gateTry && gateWant.some(gated))) gateLoad().then(m => m.syncGateCss(gateWant, true, gateCool), () => {
        const add = [...held].filter(c => gateWant.includes(c) && !document.body.classList.contains(c));
        if (add.length) { try { gateCool?.(); } catch { /* 식히기는 덤이에요 */ } document.body.classList.add(...add); }
    });
    return held;
}
/** 테마 설정 창 규칙 시트를 다 받았을 때(못 받았어도) 풀리는 약속 — 창(.salty-panel)을 만들기 전에 기다려요 */
export function panelCssReady() {
    if (!PANEL_SHEET) return Promise.resolve(true);
    return gateApi ? gateApi.panelCssReady() : gateLoad().then(m => m.panelCssReady(), () => false);
}

// 폴더 이름이 blue-lemonade 가 아니어도(blue-lemonade-main …) 제 style.css 를 찾는다 — 이 파일 기준 상대 주소가 먼저, 옛 이름 규칙은 예비
const OWN_SHEET = new URL('../style.css', import.meta.url).href;
function themeSheet() {
    for (const test of [href => href === OWN_SHEET, href => /\/blue-lemonade\/style\.css/.test(href)]) {
        for (const sheet of document.styleSheets) {
            if (!sheet.href || !test(sheet.href)) continue;
            try { void sheet.cssRules; } catch { return null; }   // 다른 출처면 못 읽음
            return sheet;
        }
    }
    return null;
}

/** 미리보기 시트를 꺼진 채(media="not all") 붙여 받아 둔다 — 서랍 · ✦ 메뉴를 누르는 순간(설정 창 코드를 미리 받는 그때) 부른다. 이미 있으면 그대로 */
export function preloadPreviewCss() {
    panelCssReady();   // 1.1.6 설정 창 규칙 시트도 같은 때 미리(붙는 자리는 미리보기 앞)
    if (previewLink?.isConnected) return previewLink;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'salty-preview-css';
    link.dataset.blGate = '-1';   // 1.1.6 테마 시트 뒤 줄의 맨 앞 칸(뗀 규칙 시트들보다 앞 — 미리보기 사본은 원래 앞 모듈이에요)
    link.href = PREVIEW_URL;
    link.media = restored ? 'all' : 'not all';
    // 못 받으면 떼어 두고 다음에 다시 — 그동안 표본 칸은 폴백(숨김 · 안내 한 줄)이다
    link.addEventListener('error', () => { console.info('[Blue Lemonade] 미리보기 CSS 를 못 받았어요 — 다음에 열 때 다시 받아요 (실제 채팅은 그대로)'); link.remove(); if (previewLink === link) previewLink = null; }, { once: true });
    const sheet = themeSheet();
    if (sheet?.ownerNode?.isConnected) themeRunEnd(sheet.ownerNode, -1).after(link);   // 서랍 전용 <style id="salty-panel-css"> 가 이미 붙었으면 그 앞 — 원래 차례(본문 → 나머지(--split) → 미리보기 → 1.1.6 뗀 규칙 시트들 → 서랍 전용)
    else document.head.append(link);
    previewLink = link;
    return link;
}

// --split 첫 시트는 작게 시작해요. 첫 서랍에서 원래 모듈 순서 전체를 받아 첫 시트를 끄고 교체해요.
// 첫 시트는 메타와99꼬리를 찾는 원본으로 남아요. 둘째 파일의99꼬리도 원문으로 분리해 별도 받기 실패를 복구해요.
const SPLIT_URL = new URL('./style-lazy.gen.css', import.meta.url).href;
// 서랍 · 테마 설정 창 · 애드온 창(85-addon-unify 가 아는 창들)만 — 실리태번 보통 팝업(.popup · bl-roomy-dialog 표식 포함)은 아니에요
//   닫힌 채 늘 문서에 있는 설정 블록(#model_register_settings · .bwr_settings …)은 열림이 아니에요 — 열린 서랍(.openDrawer)이나 열린 dialog 안에 있을 때만
const LAZY_OPENERS = ['.drawer-content.openDrawer', 'dialog[open] .salty-panel', 'dialog[open].bl-settings-dialog', 'dialog[open].bl-translator-dialog', 'dialog[open].bl-assets-dialog', 'dialog[open].bl-direction-dialog', 'dialog[open].bl-notes-dialog', 'dialog[open].bl-ctsi-dialog', 'dialog[open].blpt-dialog', 'dialog[open].blzi-dialog', 'dialog[open].bl-mermaid-dialog', 'dialog[open].bl-mav-viewer', 'dialog[open] .bl-extension-page', 'dialog[open] .pa-hub', 'dialog[open].po-dialog', 'dialog[open] #pt-panel', 'dialog[open] .bwr_settings', 'dialog[open] #model_register_settings', 'dialog[open] #model-switch-settings', 'dialog[open] #lv_settings', 'dialog[open] .cg-root', 'dialog[open] .bl-notes-view'].join(', ');
let splitPrefetched = false;
/** 두 장 빌드면 테마 시트 */
function splitBuild() {
    const sheet = themeSheet();
    const first = sheet?.cssRules?.[0];
    if (!first || first.selectorText !== ':root' || first.style?.getPropertyValue('--bl-css-split').trim() !== '1') return null;
    return sheet;
}
/** 둘째 장 미리 받기(fetch 만) */
export function prefetchSplitCss() {
    if (splitPrefetched || document.getElementById('salty-lazy-css') || !splitBuild()) return false;
    splitPrefetched = true;
    try { fetch(SPLIT_URL, { priority: 'low', credentials: 'same-origin' }).catch(() => {}); } catch { /* fetch 없음 */ }
    return true;
}
let splitRequest = null;
export function loadSplitCss() {
    if (splitRequest || document.getElementById('salty-lazy-css')) return false;
    const sheet = splitBuild(); if (!sheet) return false;
    try { window.dispatchEvent(new Event('bl:full-css')); } catch { /* 창 없는 시험 */ }   // 애드온 시트도 같은 때 전체로 (addons.js)
    let timer;
    const loaded = Promise.race([import('./split-css.js'), new Promise(resolve => { timer = setTimeout(() => resolve(null), 15000); })]);
    splitRequest = loaded.then(m => { clearTimeout(timer); return m ? m.loadFullCss(sheet, style => {
        panelStyle = style; panelCount = style.sheet?.cssRules.length || 0;
        syncPanelCss(); if (!panelObserving) watchPanelOpen();
    }, () => themeEnabled(getSettings())) : false; }).catch(() => false)
        .then(ok => { clearTimeout(timer); if (!ok) splitRequest = null; return ok; });
    return true;
}
/** 전체 CSS가 적용됐거나 받기에 실패하면 끝나요. 실패한 다음 호출은 다시 받아요. */
export function splitCssReady() { loadSplitCss(); return splitRequest || Promise.resolve(document.getElementById('salty-lazy-css')?.dataset.blFullTheme === 'ready'); }
// 1.0.0 크로미움 밖 · 다른 폭 규칙 시트 — 조건이 맞을 때만 src/compat-css.js 가 붙여요(설명 · 조건은 그 파일)
export function loadCompatCss(win = window) {
    const first = themeSheet()?.cssRules?.[0];
    if (first?.selectorText !== ':root') return null;
    const mark = name => String(first.style.getPropertyValue(name)).trim().replace(/^"|"$/g, '').split('|').filter(Boolean);
    const ok = f => { try { return !!f(); } catch { return false; } };
    const mq = q => ok(() => win.matchMedia(q).matches);
    const go = what => import('./compat-css.js').then(m => m.attachCompat(what, win)).catch(error => console.warn('[Blue Lemonade] 호환 CSS', error));
    const ua = win.navigator?.userAgent || '';
    const groups = mark('--bl-compat-media').map(g => g.split(' & ')), wide = () => groups.some(g => g.every(mq));
    const browser = mark('--bl-compat-supports').some(c => ok(() => win.CSS.supports(c))) || ok(() => win.CSS.supports('-moz-appearance: none')) || (/AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) || mq('(forced-colors: active)');
    if (browser) go('browser'); else ok(() => win.matchMedia('(forced-colors: active)').addEventListener('change', e => { if (e.matches) go('browser'); }));
    if (wide()) go('width'); else for (const q of new Set(groups.flat())) ok(() => win.matchMedia(q).addEventListener('change', () => { if (wide()) go('width'); }));
    return { browser, width: wide() };
}
export function scheduleSplitCss({ after = null, then = null } = {}) {
    // 1.0.0(11-03 퇴행 고침): 덮개가 걷히고 3층까지 끝난 뒤(after) 쉴 때 둘째 장 · 애드온 전체 시트를 붙여요. 예전엔 처음 여는 서랍(캐릭터 목록 · 월드인포 …)이
    //   받기 · 해석 · 문서 전체 재계산을 떠안고, 받는 사이 첫 장 모양으로 먼저 그렸다가 다시 그렸어요(PC 첫 서랍 작업 1,687 → 850ms).
    //   다 붙은 뒤(못 받아도) then — 서랍 문 모듈을 쉴 때 시작(index.js). 서랍 · 메뉴를 먼저 누르면 그때 붙는 것은 그대로예요
    const idle = fn => { if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 4000 }); else setTimeout(fn, 1500); };
    afterBoot(() => Promise.resolve(after).catch(() => {}).then(() => idle(() => {
        let ready = null;
        try { loadSplitCss(); ready = splitRequest; } catch (error) { console.warn('[Blue Lemonade] 두 번째 CSS', error); }
        if (then) Promise.resolve(ready).catch(() => {}).then(() => idle(() => { try { then(); } catch (error) { console.warn('[Blue Lemonade] 쉴 때 서랍 준비', error); } }));
    })));
    return true;
}

/** 미리보기 시트를 다 받았을 때(못 받았어도) 풀리는 약속 — 표본을 그린 뒤 바로 계산 스타일을 옮겨 적는 쪽(과일 상태창 표본)이 기다린다 */
export function previewCssReady() {
    const link = preloadPreviewCss();
    if (link.sheet) return Promise.resolve(true);
    return new Promise(resolve => { link.addEventListener('load', () => resolve(true), { once: true }); link.addEventListener('error', () => resolve(false), { once: true }); });
}

/** 설정 창을 열 때: 미리보기 시트를 켠다 (이 호출은 세션 끝까지 — 설정 창 · 서랍). */
let permanent = false, holders = 0;
export function restorePreviewRules() {
    permanent = true;
    turnOn();
}
function turnOn() {
    restored = true;
    preloadPreviewCss().media = 'all';
}
// 5.6.6 (점검 PAB-4): 북마크 창처럼 닫히는 쪽은 쥐었다 놓는다 — 놓는 쪽이 마지막이고 세션 끝까지 켜 둔 쪽(설정 창)이 없으면 다시 끈다
// (켜 둔 채면 글이 붙을 때마다 채팅 전체를 미리보기 규칙과 다시 맞춰 봤다). 작은 따로 시트라 켜고 끌 때 다시 계산은 맞는 요소만이다.
export function holdPreviewRules() { holders++; turnOn(); }
export function releasePreviewRules() {
    holders = Math.max(0, holders - 1);
    if (holders || permanent || !restored) return;
    restored = false;
    if (previewLink) previewLink.media = 'not all';
}

/** 꺼져 있나(1) · 켜져 있나(0) — 9.0.1 부터 규칙 수는 시트를 받기 전이라 세지 않는다(예전엔 꺼 둔 규칙 수) */
export function deferredPreviewRuleCount() {
    return restored ? 0 : 1;
}

// ── 서랍 · 팝업이 열렸을 때만 켜는 규칙: style.css 맨 끝의 게으른 칸 ──────────────────────────────
//
// 왜 (2.8.4 · 2.9.4 측정): 서랍 · 팝업 안에서만 맞는 규칙 가운데, 오른쪽 끝이 `> *` 처럼 아무 요소나 받고 그 왼쪽 칸에 :has() 가 있는
// 규칙(`.range-block:has(…) > *`)은 채팅의 모든 요소가 부모의 :has() 를 따지게 한다 — 답변 한 단계의 스타일 계산이 180 → 510ms
// (4배 느린 CPU). 서랍이 닫혀 있으면 맞을 일이 없으니 꺼 둔다. 끄고 켜는 시트는 작은 <style> 이어야 한다: style.css 안에서
// @media 글을 바꾸면 시트 전체가 바뀐 것으로 쳐져 문서 전체(1만 6천 요소)를 다시 계산했다 (서랍 여닫기마다 0.5초).
//
// 순서 (2.8.4 → 2.9.1 → 3.0.0): 규칙을 다른 <style> 로 옮기면 style.css 안에서 그 뒤에 오던 같은 무게의 규칙보다 뒤가 되어
// 덮어쓰기가 뒤집힌다 (2.8.4 에서 월드인포 편집 칸이 폰에서 깨짐). 2.9.4 는 옮길 5개를 손으로 확인했다.
// 3.0.0 부터 옮길 규칙은 분류기로 고르지 않고 css/99-lazy-panel.css 에 둔다 — 빌드가 이 모듈을 style.css 맨 끝에 두고,
// 여기서는 시작 표시 규칙(#salty-lazy-panel-start) 뒤를 통째로 테마 <link> 바로 뒤 <style> 로 옮긴다.
// 원래도 맨 끝이었으니 옮겨도 폭포 순서가 한 칸도 안 바뀐다. tools/check-order.cjs 가 이것을 확인한다.
// 규칙 글은 CSSOM 의 cssText 가 아니라 style.css 원문 끝을 잘라 쓴다 (cssText 는 var() 가 든 줄임 속성을 온전히 못 되살린다).
//
// 5.6.4 (점검 RP-2): `> *` 뿐 아니라 오른쪽 끝이 태그뿐인 서랍 규칙(`… div:has(> select) > span`)도 옮겼다 (9 → 67개).
// 크롬은 :has() 왼쪽 칸 규칙들의 오른쪽 끝 태그를 한 목록으로 모아 두는데, 실리태번 코어의
// `body:has(.drawer-content.maximized) #top-settings-holder:has(.drawer-content.openDrawer …)` 가 서랍을 처음 연 순간 body 에
// ':has() 영향' 표시를 남긴 뒤로는 채팅에 요소가 붙을 때마다 body 아래에서 그 태그(span · i · select …)를 가진 요소를 전부 다시
// 계산했다 (폰 리그 4배: 글 붙이기 한 번 35 → 180~210ms, 그중 테마 몫 = 다시 계산하는 요소 1,091 → 791).
// 8.2.1 테마가 꺼진 모드면 큰 시트 바로 뒤에 가벼운 사본(<link id="salty-ext-css">)이 있어요 — 미리보기 · 게으른 칸 <style> 은 그 뒤에 붙여야 원래 차례(본문 → 미리보기 → 게으른 칸)예요
// 전체 교체 시트(<style id="salty-lazy-css">)가 있으면 그 뒤 — 본문 → 미리보기 → 서랍 전용이에요.
// 1.1.1 마크다운 모양 시트 → 1.1.6 뗀 규칙 시트들(<link data-bl-gate>)이 테마 시트 뒤 줄에 있으면 그 뒤 — 본문 → 미리보기 → 뗀 규칙 → 게으른 칸이에요.
// 1.1.6 뗀 규칙 시트(켜짐 · 설정 창, data-bl-gate)도 그 줄에 있어요 — 줄 끝(themeRunEnd: 가벼운 사본 salty-ext-css · 전체 시트 · 뗀 규칙 시트) 뒤예요.
const sheetTail = sheet => themeRunEnd(sheet.ownerNode);
const LAZY_SENTINEL = '#salty-lazy-panel-start';
const LEGACY_POPUPS = '#character_popup, #world_popup, #select_chat_popup, #shadow_popup, #dialogue_popup, #export_format_popup';
let panelStyle = null;  // 옮겨 둔 게으른 칸 규칙이 든 <style id="salty-panel-css">
let panelOn = false;
let panelCount = 0;
let panelPending = false;
let offTimer = 0;
// 5.6.4 (점검 RP-2): 끄는 것은 서랍이 다 닫힌 뒤에 — 실리태번은 openDrawer 를 떼고도 --animation-duration-2x(기본 250ms) 동안
// 높이를 줄이며 서랍을 보여 준다. 게으른 칸에 서랍 안 배치 규칙이 늘어서, 0.1초에 끄면 닫히는 서랍 속이 한 번 다시 배치됐다.
// 서랍을 바꿔 열 때(실리태번이 옛 서랍을 닫고 animation_duration 기다린 뒤 새 서랍을 연다)도 껐다 켰다 하지 않는다.
// 인라인 style 만 읽는다 (스타일 계산을 부르지 않음). 값이 없으면 실리태번 기본 125ms.
let closedSeen = 0; // 열린 서랍 · 팝업이 없다고 처음 본 때 (그 뒤 offDelay 가 지나야 끈다)
function offDelay() {
    const ms = parseFloat(document.documentElement.style.getPropertyValue('--animation-duration'));
    return Math.max(100, (Number.isFinite(ms) ? ms : 125) * 2 + 50);
}

/** 시트 맨 위 목록에서 게으른 칸 시작 표시 규칙의 자리 (없으면 -1) */
function lazyStart(sheet) {
    const rules = sheet.cssRules;
    for (let i = rules.length - 1; i >= 0; i--) {
        if (rules[i].type === CSSRule.STYLE_RULE && rules[i].selectorText === LAZY_SENTINEL) return i;
    }
    return -1;
}
// 4.1.2: 열려 있는 동안(시작할 때의 로딩 팝업 포함)에는 채팅 밖 변화마다 불린다 — 문서 전체(1만 6천 요소)를 선택자로 훑는 대신
// 살아 있는 .openDrawer 목록과 body 바로 아래의 dialog(실리태번 팝업은 늘 여기 붙는다)부터 본다. 못 찾으면 예전처럼 전체를 본다.
const openDrawers = document.getElementsByClassName('openDrawer');
export function quickOpen(skipClass = '') {
    if (openDrawers.length) return true;
    for (const el of document.body.children) if (el.tagName === 'DIALOG' && el.open && !(skipClass && el.classList.contains(skipClass))) return true;
    return false;
}
// 5.8.4: 서랍 · dialog 는 class · open 만 본다 (스타일 계산 없음). 옛 팝업은 상자가 있는지(getClientRects)라 스타일 · 배치를 센다 — 따로 뗐다
// 8.2.7: 선택자 하나로 한 번만 훑어요 — 예전엔 살아 있는 .openDrawer 목록의 length(DOM 이 바뀐 뒤엔 문서 끝까지 다시 셈) · body 자식 dialog 를 먼저 보고,
//   없으면 같은 것을 querySelector 로 또 훑어 닫혀 있을 때(거의 늘) 문서를 두 번 돌았어요. 리그(폰 4배 · 메시지 300 · DOM 이 바뀐 직후): 닫힘 19~25 → 11ms, 서랍 열림 8~10 → 1ms.
//   결과는 같아요(.openDrawer 어디든 · dialog[open] 어디든 — quickOpen 이 보던 것은 그 일부).
function uiOpenQuick() {
    return !!document.querySelector('.openDrawer, dialog[open]');
}
function legacyOpen() {
    for (const el of document.querySelectorAll(LEGACY_POPUPS)) if (el.getClientRects().length) return true;
    return false;
}
let panelFrame = 0;
function syncPanelCss(inFrame = false) {
    if (!panelStyle) return;
    const quick = uiOpenQuick();
    // 5.8.4: 끄는 쪽(켜져 있는데 서랍 · dialog 가 다 닫힘)의 옛 팝업 검사는 다음 프레임 맨 앞(requestAnimationFrame)에서 한다.
    // 클릭 마이크로태스크 · 끄기 타이머에서 getClientRects 를 부르면 서랍을 닫으며 바뀐 스타일을 그 자리에서 강제로 셌고, 그 뒤 다른 코드가 또 바꾸면
    // 프레임이 한 번 더 셌다 (폰 리그 4배 서랍 16번 여닫기에 강제 스타일 1.49 s · 배치 0.17 s). 프레임 맨 앞에서 읽으면 그 프레임이 어차피 할 계산과 하나로 묶인다.
    // 켜는 판정과 그 순간은 그대로다(그리기 전에 바로). 끄는 순간만 프레임 몇 개 안팎으로 옮겨질 수 있다 — 무엇이 열려 있는 동안엔 끄지 않고,
    // 닫힌 것을 본 뒤 offDelay() 를 기다려 끄는 규칙도 같아서 보이는 것이 없다. 숨은 탭(프레임이 오지 않음)은 예전 그대로 바로 본다.
    if (!quick && panelOn && inFrame !== true && !document.hidden) {
        if (!panelFrame) panelFrame = requestAnimationFrame(() => { panelFrame = 0; syncPanelCss(true); });
        return;
    }
    if (!quick && !panelOn && booting()) { afterBoot(syncPanelCss); return; }   // 7.7.4 시작 덮개 동안 열린 옛 팝업은 없다 — 걷힐 때 한 번 본다
    // 꺼진 채(서랍 · dialog 없음)에서 옛 팝업 검사(getClientRects — 스타일 · 배치를 그 자리에서 강제)도 다음 프레임 맨 앞에서 해요.
    //   감시 콜백마다 바로 읽어 덮개가 걷힌 뒤 문서 전체를 따로 세 번 다시 계산했어요(폰 리그 추적: 요소 225). 옛 팝업이 열렸으면 그 프레임을 그리기 전에 켜요(보이는 것 같음)
    if (!quick && !panelOn && inFrame !== true && !document.hidden) {
        if (!panelFrame) panelFrame = requestAnimationFrame(() => { panelFrame = 0; syncPanelCss(true); });
        return;
    }
    const want = quick || legacyOpen();
    if (want) closedSeen = 0;
    // 1.0.0 둘째 장은 서랍 · 테마 설정 창 · 애드온 창이 처음 열릴 때만 — 보통 팝업(확인 · 모델 제안 …)은 첫 장만으로 그려요. 시작 덮개는 열림이 아니에요
    if (want && !booting() && !document.getElementById('salty-lazy-css') && document.querySelector(LAZY_OPENERS)) { try { loadSplitCss(); } catch { /* 그대로 */ } }
    if (want === panelOn) return;
    if (!want) {
        // 5.6.4: 켜기는 바로(그리기 전), 끄기는 닫힌 것을 처음 본 뒤 offDelay() 가 지나서 — 그 사이 다시 열리면 그대로 켜 둠
        const now = performance.now();
        if (!closedSeen) closedSeen = now;
        const left = offDelay() - (now - closedSeen);
        if (left > 0) { if (!offTimer) offTimer = setTimeout(() => { offTimer = 0; syncPanelCss(); }, left); return; }
        closedSeen = 0;
    }
    panelOn = want;
    panelStyle.media = want ? 'all' : 'not all';
}

/** style.css 끝의 게으른 칸을 작은 <style> 로 옮겨 꺼 두고, 서랍 · 팝업 열림을 지켜본다. 실패하면 style.css 안에 켜 둔 채로. */
export function deferPanelHasRules(tries = 25) {
    if (panelStyle || panelPending) return;
    const sheet = themeSheet();
    if (!sheet || !sheet.cssRules.length) {
        if (tries > 0) setTimeout(() => deferPanelHasRules(tries - 1), 200);
        return;
    }
    if (lazyStart(sheet) < 0) return;
    panelPending = true;
    // 꼬리만 받는다 — 빌드가 src/lazy-panel.gen.css 로 따로 써 둔다(1.8KB).
    // 예전에는 style.css(842KB) 를 통째로 받아 문자열로 풀고 뒤만 잘라 썼다. 옛 배포본에는 그 파일이
    // 없을 수 있어 404 면 예전처럼 style.css 에서 잘라 쓴다.
    // 경량화(10-16): 받은 글과 올라온 시트를 규칙의 뼈대(종류 · 선택자 · @media 조건 · 안쪽 규칙)로만 견준다. 예전에는 cssText 를 글자 그대로 견줘서
    // 브라우저가 규칙을 다르게 적으면(안드로이드 WebView — 한글이 든 content 값 · 캐시에 남은 옛 style.css) 매번 「끝이 다름」으로 분리를 못 하고
    // 경고를 남겼다. 옮기는 글은 받은 원문 그대로라 선언을 어떻게 적는지는 상관없다. 꼬리 파일이 안 맞으면(옛 style.css 가 캐시에 남음)
    // 올라온 시트와 같은 주소의 style.css 를 표시 규칙에서 잘라 한 번 더 견준다. 그래도 다르면 style.css 안에 켜 둔다 — 화면은 같고
    // 가벼워지는 것만 빠지므로 오류가 아니라 알림(info)으로만 남긴다 (진단 「최근 오류」에 쌓이지 않게).
    const tailUrl = new URL('./lazy-panel.gen.css', import.meta.url);
    const read = async (url, cut) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cut) return text;
        const mark = `${LAZY_SENTINEL} {}`;
        const at = text.lastIndexOf(mark);
        if (at < 0) throw new Error('받아 온 style.css 에 게으른 칸 표시가 없음');
        return text.slice(at + mark.length);
    };
    (async () => {
        const reasons = [];
        for (const [url, cut] of [[tailUrl, false], [sheet.href, true]]) {
            let tail;
            try { tail = await read(url, cut); } catch (err) { reasons.push(err.message); continue; }
            if (panelStyle) return;   // 전체 시트가 먼저 도착해 꼬리를 이미 준비했어요.
            const probe = new CSSStyleSheet();
            probe.replaceSync(tail);
            const from = lazyStart(sheet);
            const live = from < 0 ? [] : [...sheet.cssRules].slice(from + 1);
            if (from < 0 || !sameShape(live, probe.cssRules)) { reasons.push(`${cut ? 'style.css' : 'lazy-panel.gen.css'} 규칙 ${probe.cssRules.length}개 ↔ 시트 ${live.length}개`); continue; }
            // 1.2.2 시작 덮개 동안이면 옮기기(새 시트 붙이기 + 첫 장에서 규칙 지우기)는 걷힐 때 — 켜진 시트를 고치는 일이라 media 로 못 모아요.
            //   걷힐 때 꺼 둔 시트 켜기와 같은 마이크로태스크에서 하면 다시 계산이 한 번이에요(boot-gate.js). 그동안 규칙은 첫 장에 켜진 채라 화면은 같아요
            const commit = () => {
                if (panelStyle || !sheet.ownerNode?.isConnected || lazyStart(sheet) !== from || sheet.cssRules.length - from - 1 !== live.length) { panelPending = false; return; }
                const style = document.createElement('style');
                style.id = 'salty-panel-css';
                style.media = 'not all';
                style.textContent = tail;
                sheetTail(sheet).after(style); // 1.1.6 테마 시트 뒤 줄(미리보기 · 뗀 규칙 시트 포함) 끝 뒤 · 9.0.1 미리보기 <link> 가 먼저 붙었으면 그 뒤(원래 차례: 미리보기 → 게으른 칸). 먼저 새 시트를 붙이고(꺼진 채) 원래 규칙을 지운다 — 같은 태스크라 그 사이 그리기가 없다
                for (let i = sheet.cssRules.length - 1; i > from; i--) sheet.deleteRule(i);
                panelCount = live.length;
                panelStyle = style;
                panelOn = false;
                syncPanelCss();
                watchPanelOpen();
            };
            if (booting()) afterBoot(commit); else commit();
            return;
        }
        console.info('[Blue Lemonade] 서랍 전용 규칙은 style.css 안에 켜 둠 (화면은 같음):', reasons.join(' / '));
    })().catch((err) => {
        console.info('[Blue Lemonade] 서랍 전용 규칙은 style.css 안에 켜 둠 (화면은 같음):', err?.message || err);
    });
}
/** 두 규칙 목록이 같은 뼈대인가 — 종류 · 선택자 · 조건(@media · @supports · @container) · 이름 · 안쪽 규칙을 차례로. 선언 글(cssText)은 보지 않는다 */
function sameShape(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i];
        if (x.type !== y.type || x.constructor !== y.constructor || x.selectorText !== y.selectorText) return false;
        if ((x.conditionText ?? x.media?.mediaText ?? x.name ?? '') !== (y.conditionText ?? y.media?.mediaText ?? y.name ?? '')) return false;
        if ((x.cssRules || y.cssRules) && !(x.cssRules && y.cssRules && sameShape(x.cssRules, y.cssRules))) return false;
    }
    return true;
}
// 2.9.2: 채팅 밖 변화마다 uiOpen() 을 불렀는데, 옛 팝업 검사의 getClientRects() 가 그때마다 문서 전체 강제 레이아웃이었다.
// 답변 생성 · 채팅 바꾸기 때 프롬프트 관리자 · 확장 칸이 다시 그려지며 여러 번 돌아서, 측정에서 테마 JS 가운데 가장 비쌌다
// (답변 한 번 169ms · 채팅 전환 156ms, PC). 이제 아무것도 안 열려 있을 때는 '무언가 열렸을 수 있는' 변화에만 다시 본다 —
// 서랍에 openDrawer 가 붙음 · dialog 의 open · 옛 팝업(이나 그 겉 칸)의 style/class · 그런 것이 새로 붙음. 열려 있을 때는 예전처럼.
const OPENERS = `.openDrawer, dialog, ${LEGACY_POPUPS}`;
/**
 * 1.2.1 opt: 「서랍 · 팝업 열림」 구독이 받은 묶음 하나 — 숫자 쉼표(tap)에 기록을 넘기고, 무언가 열렸을 수 있으면 true.
 *  · 속성 기록의 「옛 팝업이거나 품었나」(matches + 그 요소 아래 querySelector — 큰 서랍이면 가지 전체)는 한 묶음 안에서 같은 요소면 한 번만 물어요
 *    (콜백 안에서 DOM 을 바꾸지 않아 답이 같아요 · 서랍 여닫는 애니메이션은 같은 요소의 style 기록이 묶음마다 여럿이에요). 결과 · tap 차례는 같아요(tools/tests/lite-panel-batch.mjs)
 */
export function panelBatch(list, { on, tap, body }) {
    const popupMemo = new Map();
    const holdsPopup = t => { let v = popupMemo.get(t); if (v === undefined) popupMemo.set(t, v = t.matches(LEGACY_POPUPS) || !!t.querySelector(LEGACY_POPUPS)); return v; };
    const mayOpen = (m) => {
        const t = m.target;
        if (m.type === 'childList') return [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches(OPENERS) || !!n.querySelector(OPENERS)));
        if (m.attributeName === 'open' || t.classList.contains('openDrawer')) return true;
        return t !== body && holdsPopup(t);
    };
    let hit = false;
    for (const m of list) {
        const t = m.target;
        // 구독 거르개(구역 · exclude)가 이미 빼지만, 같은 나눠 주기에서 앞 구독이 노드를 옮겼을 때도 예전과 같게 콜백에서 한 번 더 봐요(싸요)
        if (t.nodeType !== 1 || t.closest?.('#chat, #form_sheld')) continue;
        if (tap) tap(m); // 5.3.7: 숫자 쉼표(numcomma.js)도 채팅 밖 변화만 받는다
        if (hit || (!on && !mayOpen(m))) continue;
        hit = true;
        if (!tap) break;
    }
    return hit;
}
function watchPanelOpen() {
    panelObserving = true;
    // 8.2.7: body 전체 감시는 공용 감시자(dom-watch.js) 구독으로 — 같은 body 를 보는 다른 모듈과 감시자 하나를 나눠 써요(받는 기록 · 때는 같아요)
    // 9.0.4: 채팅 · 입력판은 콜백에서 건너뛰던 것을 구독 거르개로 — 채팅(#chat) 가지는 감시도 안 걸어요(body 구역)
    watchDom(document.body, { attributes: ['class', 'open', 'style'], subtree: true, childList: true, exclude: ['#chat', '#form_sheld'], name: 'lite 서랍 · 팝업 열림' }, (list) => {
        const hit = panelBatch(list, { on: panelOn, tap: panelTap, body: document.body });
        if (!hit) return;
        // 4.1.2: 켜는 쪽은 그리기 전에(바로), 끄는 쪽은 0.1초에 한 번 — 열려 있는 동안(시작할 때의 로딩 팝업 포함)은 채팅 밖
        // 변화마다 문서를 훑었다 (폰 리그 시작 한 번에 0.2초). 늦게 꺼져도 서랍이 닫힌 뒤라 보이는 것이 없다.
        if (panelOn) { if (!offTimer) offTimer = setTimeout(() => { offTimer = 0; syncPanelCss(); }, 100); return; }
        syncPanelCss();
    });
    // 서랍 아이콘 · 팝업 여는 순간에도 한 번 (관찰자보다 먼저 그려지는 일이 없게)
    // 2.9.4: 채팅 · 입력판 안의 클릭(보내기 · 메시지 단추)은 건너뛴다. 거기서 여는 팝업 · 서랍은 위 관찰자가 dialog · open · 옛 팝업의
    // style 변화로 같은 마이크로태스크 안에 잡는다. 이 훅이 부르는 uiOpen() 은 옛 팝업 6개에 getClientRects() 를 해서, 보내기를 누른
    // 순간 스타일 · 레이아웃을 강제로 한 번 더 돌렸다 (4배 느린 CPU 에서 보내기마다 약 130ms).
    document.addEventListener('click', (e) => { if (!e.target?.closest?.('#chat, #form_sheld')) queueMicrotask(syncPanelCss); }, true);
}

// 5.3.7: 숫자 쉼표(numcomma.js)가 새로 붙거나 보이게 된 숫자 칸을 찾는 길 — 문서를 따로 지켜보지 않고 위 관찰자가 받은 변화를 나눠 받는다.
// 받는 쪽은 요소만 모아 두고 다음 프레임에 한 번 훑는다 (여기서는 부르기만). null 이면 뗀다.
let panelTap = null;
let panelObserving = false;
export function tapPanelChanges(fn) {
    panelTap = typeof fn === 'function' ? fn : null;
}
/** 서랍 · 팝업 관찰자가 돌고 있나 (게으른 칸 분리에 실패하면 없다) */
export function panelWatching() {
    return panelObserving;
}

export function panelHasRuleCount() {
    return panelCount;
}

export function panelCssEnabled() {
    return !!panelStyle && panelOn;
}

// 메시지 ··· 메뉴가 열린 메시지 표시 (2.5.3): style.css 가 `.mes:has(.extraMesButtons.visible)` 로 알아내던 것.
// :has() 는 메뉴 하나가 열릴 때 그 메시지 안 요소 전부(긴 답변이면 수백 개)를 다시 계산하게 만들어 ··· 탭이 굼떴다.
// 대신 실리태번이 .extraMesButtons 에 .visible 을 붙이는 순간 여기서 .mes 에 bl-menu-open 을 붙인다 (클래스 하나 = 그 요소만 다시 계산).
const MES_MENU_OPEN = 'data-bl-mes-menu-open';
export function startMenuOpenMark() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    // _blClosedAt: 이 메뉴가 마지막으로 닫힌 때 (아래 0.45초 뒤 강제 닫기가 '실리태번이 이미 닫았다가 사용자가 다시 연 메뉴'를 가려낼 때 쓴다)
    const sync = (el) => { const visible = el.classList.contains('visible'); if (!visible) el._blClosedAt = performance.now(); el.closest('.mes')?.classList.toggle('bl-menu-open', visible); positionMessageMenu(el, visible); };
    // 2.9.4: ··· 메뉴 위치가 쓰는 #chat 앵커(--salty-chat)는 열린 메뉴가 있을 때만 — style.css 가 #chat[data-bl-mes-menu-open] 에만 이름을 준다
    // 1.2.2: 표식은 class 가 아니라 data 속성 — #chat 의 class 가 바뀌면 실리태번 keyboard.js 가 채팅의 단추 전부를 선택자 27개로 다시 훑고(··· 를 열 때 한 번 · 닫을 때 한 번),
    //   네모 단추 감시도 #chat 을 통째로 다시 쟀어요. 이 표식은 #chat 에 앵커 이름만 주니 단추 모양 · 보임은 그대로예요(서랍 덮개 data-bl-chat-covered 와 같은 길)
    const syncChat = () => { const open = !!chat.querySelector(':scope > .mes.bl-menu-open'); if (chat.hasAttribute(MES_MENU_OPEN) !== open) chat.toggleAttribute(MES_MENU_OPEN, open); };
    chat.querySelectorAll('.extraMesButtons').forEach(sync);
    syncChat();
    // 4.2.8 '··· 버튼이 아예 없고 버튼들이 늘 펼쳐져 있는' 환경: 다른 CSS(확장 · 커스텀 CSS · 옛 테마 조각)가 버튼 칸을 늘 보이게 하고 ··· 를 숨긴 경우다.
    // 실리태번의 '메시지 작업 확장'과 같은 모습인데 body 에 그 표시(expandMessageActions)가 없어서, 테마는 그 칸을 '떠 있는 메뉴'로 그렸고 닫을 방법도 없이 채팅을 가렸다.
    // 눌러서 연 흔적(.visible · 인라인 display)이 없는데도 보이고 있으면 늘 펼침으로 보고, 실리태번과 같은 표시를 달아 이름 줄 아래 한 줄로 그린다.
    const detectForced = () => {
        const body = document.body, menu = chat.querySelector(':scope > .mes:last-of-type .mes_buttons > .extraMesButtons');
        // 5.5.6: 테마가 빠진 상태(확장만 · 테마 끔)에서는 실리태번의 표시를 달지 않는다 — 내가 달아 둔 것이 있으면 뗀다
        if (!themeEnabled(getSettings())) { if (body.classList.contains('bl-forced-expand')) { body.classList.remove('bl-forced-expand'); if (!document.getElementById('expandMessageActions')?.checked) body.classList.remove('expandMessageActions'); } return; }
        // 8.2.6: 붙어 있을 때만 뗀다 — 없는 클래스를 remove 해도 class 변경 기록이 나서 실리태번 keyboard.js 가 문서 전체를 다시 훑고(body 아래 전부)
        //   squared-buttons 가 body 를 통째로 다시 쟀다(실리태번 「메시지 작업 펼치기」를 켠 사람은 채팅을 바꿀 때마다). 끝 상태는 같다
        if (!menu || document.getElementById('expandMessageActions')?.checked) { if (body.classList.contains('bl-forced-expand')) body.classList.remove('bl-forced-expand'); return; }
        const mine = body.classList.contains('bl-forced-expand');
        if (mine) body.classList.remove('expandMessageActions'); // 내가 단 표시를 잠깐 떼고 잰다 (같은 태스크 안이라 화면에는 안 보인다)
        const forced = !menu.classList.contains('visible') && !/display/.test(menu.getAttribute('style') || '') && getComputedStyle(menu).display !== 'none';
        body.classList.toggle('bl-forced-expand', forced);
        if (forced && !body.classList.contains('expandMessageActions')) body.classList.add('expandMessageActions');
    };
    // 경량화(10-15): 잴 때는 다음 프레임 맨 앞에서 — 채팅을 막 그리는 중(채팅 바꾼 1.2초 뒤)에 계산된 스타일을 읽으면 그 자리에서 문서 전체를 다시 계산했다
    // (폰 리그 4배 30개 열기 1.4~2.4초). 프레임이 어차피 할 계산과 하나로 묶인다. 숨은 탭은 화면이 돌아올 때 잰다
    const measureSoon = ms => setTimeout(() => requestAnimationFrame(detectForced), ms);
    for (const ms of [1500, 5000]) measureSoon(ms);
    // 5.5.6: 접속 중에 테마를 켜고 끄면(설정 창의 스위치 — 새로고침 없음) 다시 잰다. body.salty 가 바뀐 때만 — detectForced 도 body 클래스를 바꾸므로 되먹임을 막는다
    let themed = document.body.classList.contains('salty');
    watchDom(document.body, { attributes: ['class'], name: 'lite 테마 켜고 끔' }, () => { const now = document.body.classList.contains('salty'); if (now !== themed) { themed = now; measureSoon(0); } });
    // 메뉴 안 '가지 만들기'처럼 메뉴가 열린 채 채팅이 바뀌면 떨어져 나간 메뉴의 클래스 변화는 안 잡혀 #chat 앵커가 남았다 — 채팅이 바뀔 때 다시 잰다
    try { const { eventSource, event_types } = SillyTavern.getContext(); eventSource.on(event_types.CHAT_CHANGED, () => { syncChat(); measureSoon(1200); }); } catch { /* 이벤트를 못 걸면 시작할 때 잰 값만 쓴다 */ }
    // 4.2.8 바깥을 눌러도 메뉴가 안 닫히는 환경(예전 실리태번은 ··· 를 누르면 버튼 칸을 열어 두기만 하고 닫지 않는다 · 닫는 애니메이션이 끝나지 않는 폰)에서는
    // 테마가 이 칸을 떠 있는 메뉴로 그리기 때문에 메뉴가 채팅을 가린 채 남았다. 실리태번에게 먼저 맡기고, 0.45초 뒤에도 열려 있으면 테마가 닫는다.
    document.addEventListener('click', (event) => {
        // 5.5.6: 떠 있는 메뉴로 그리는 건 테마뿐 — 테마가 빠져 있으면 실리태번의 여닫기에 끼지 않는다.
        // 5.6.4 (점검 PC-4): 누를 때마다 설정 전체 정리(getSettings)를 다시 돌렸다 — apply.js 가 themeEnabled 일 때만 다는 body.salty 로 본다.
        // 열린 메뉴도 클래스 목록으로 먼저 거른다 (style 글자 찾기 선택자로 채팅 전체를 훑지 않게 — 같은 조건)
        if (!document.body.classList.contains('salty')) return;
        if (document.body.classList.contains('expandMessageActions') || event.target?.closest?.('.extraMesButtons, .extraMesButtonsHint')) return;
        const open = [...chat.getElementsByClassName('extraMesButtons')].filter(m => m.classList.contains('visible') || /display: ?flex/.test(m.getAttribute('style') || ''));
        if (!open.length) return;
        const at = performance.now();
        setTimeout(() => {
            for (const menu of open) {
                // 이 클릭 뒤에 실리태번이 한 번 닫았으면(= 지금 열려 있는 건 0.45초 안에 사용자가 다시 연 것) 건드리지 않는다
                if (!menu.isConnected || (menu._blClosedAt || 0) >= at || (!menu.classList.contains('visible') && getComputedStyle(menu).display === 'none')) continue;
                menu.classList.remove('visible'); menu.style.display = 'none'; menu.style.opacity = '';
                const hint = menu.parentElement?.querySelector(':scope > .extraMesButtonsHint');
                if (hint) { hint.style.display = ''; hint.style.opacity = ''; }
                sync(menu);
            }
            syncChat();
        }, 450);
    }, true);
    watchDom(chat, { attributes: ['class'], subtree: true, name: 'lite 메시지 메뉴' }, (list) => {
        let menu = false;
        for (const m of list) if (m.target.classList?.contains('extraMesButtons')) { sync(m.target); menu = true; }
        if (menu) syncChat();
    });
    // 열린 메뉴째로 메시지가 지워진 경우도 (메시지를 넣고 뺄 때만 불림 — 스트리밍 글자는 .mes 안쪽이라 안 불림)
    watchDom(chat, { childList: true, name: 'lite 메뉴 연 메시지 지움' }, () => { if (chat.hasAttribute(MES_MENU_OPEN)) syncChat(); });
}

// ── 앵커 이름은 쓸 때만 (2.9.4) ─────────────────────────────────────────────
//
// 측정(격리 서버, 폰 에뮬레이션 412px · CPU 4배 느리게, 사용자 채팅): 입력칸에 글자 하나 칠 때 레이아웃이 테마 없이 0.9ms,
// 테마 있으면 8~10ms 였다. 원인은 #send_form · #chat 에 늘 붙어 있던 anchor-name — 앵커가 든 칸의 레이아웃이 바뀌면
// 브라우저가 앵커를 쓸 수도 있는 고정 위치 요소들까지 다시 배치해서, 글자 하나 · 답변 한 단계마다 문서 전체 레이아웃이 돌았다.
// 두 앵커를 떼면 0.4ms (다른 요소에 붙인 앵커는 영향 없음 — 자주 바뀌는 칸에 붙은 게 문제).
// 앵커를 쓰는 건 ≡ · ✦ 메뉴(#options · #extensionsMenu, 입력판 위에 맞춤)와 ··· 메뉴뿐이라, 메뉴가 보일 때만 이름을 준다.
// 메뉴가 열리는 변화(style 의 display)를 MutationObserver 로 받으니 같은 프레임 안에서 앵커가 생긴다 — 자리는 전과 같다.
const SEND_MENUS = ['options', 'extensionsMenu'];
export function startAnchorGate(tries = 25) {
    const form = document.getElementById('send_form');
    const menus = SEND_MENUS.map(id => document.getElementById(id));
    if (!form || menus.some(el => !el)) {
        if (tries > 0) setTimeout(() => startAnchorGate(tries - 1), 200);
        else if (form) form.classList.add('bl-send-menu-open'); // 메뉴를 못 찾으면 예전처럼 늘 앵커를 둔다
        return;
    }
    // 열고 닫을 때만 불린다 (display 가 바뀌는 순간) — getComputedStyle 은 그때 한 번.
    // 4.8.3: 여닫는 애니메이션 · 시작 때의 style/class 변화가 한 프레임에 여러 번 오면 그때마다 문서 스타일을 강제로 계산했다
    // (폰 리그 부팅 0.2s@4x) → 프레임 직전에 한 번만 (rAF 는 스타일 계산 전이라 앵커는 여전히 같은 프레임에 생긴다)
    // 7.7.4 시작 덮개 동안은 메뉴가 닫혀 있다 — 재지 않고 걷힐 때 한 번 (boot-gate.js)
    const sync = () => { frame = 0; if (booting()) { afterBoot(schedule); return; } form.classList.toggle('bl-send-menu-open', menus.some(el => el.isConnected && getComputedStyle(el).display !== 'none')); };
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    sync();
    for (const el of menus) watchDom(el, { attributes: ['style', 'class'], name: 'lite 입력판 메뉴 앵커' }, schedule);
}

// ── jQuery 선택자 캐시 넓히기 (2.9.4) ───────────────────────────────────────
//
// 실리태번은 document 에 선택자를 단 input 핸들러 121개 · click 핸들러 116개를 위임해 둔다. 이벤트가 문서까지 올라올 때마다
// jQuery(Sizzle)가 그 선택자들을 이벤트가 지나온 요소마다 맞춰 보는데, Sizzle 이 컴파일해 둔 선택자를 50개까지만 기억해서
// 나머지는 글자 하나 칠 때마다 다시 쪼개고(tokenize) 컴파일했다. 측정(격리 서버, CPU 4배 느리게): 입력칸 input 이벤트 하나 7.7ms,
// 캐시를 500 으로 늘리면 2.3ms · 클릭 15.4 → 6.2ms. 캐시 크기만 바꾸는 것이라 선택 결과는 그대로다 (실리태번 코드는 안 건드림).
export function widenSelectorCache() {
    const expr = window.jQuery?.expr;
    if (expr && typeof expr.cacheLength === 'number' && expr.cacheLength < 500) expr.cacheLength = 500;
}
