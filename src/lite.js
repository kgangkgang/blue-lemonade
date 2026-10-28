import { positionMessageMenu } from './menu-position.js';
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';
import { booting, afterBoot } from './boot-gate.js';
// 가볍게 (2.5.2): 테마 설정창 미리보기 전용 CSS 는 설정창을 열 때까지 빼 둔다.
//
// css/23-preview.gen.css (style.css 안의 미리보기 사본)는 #chat 규칙을 :is(#salty-nochat, .salty-preview) · .salty-sample 용으로 복사한 것이라
// 규칙이 200개 가까이 된다. 브라우저는 채팅 본문이 바뀔 때마다(답변이 한 글자씩 자랄 때) 바뀐 요소를 모든 규칙과 견주는데,
// 이 규칙들은 설정창 밖에서는 절대 맞지 않으면서도 매번 견줘진다 (PC 에서 스타일 계산의 약 1/4). 그래서 제자리에서 꺼 뒀다가
// 설정 서랍을 펴거나 설정 팝업을 열 때 다시 켠다 (2.9.1 부터 제자리 — 순서가 안 바뀜).
const PREVIEW = /#salty-nochat|\.salty-preview|\.salty-sample/;
let deferred = [];     // 제자리에서 꺼 둔 CSSMediaRule 들 (parkRule)
let restored = false;
let deferredRules = 0;   // 꺼 둔 규칙 수 (덩어리 수가 아니라)

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

// 쉼표로 나뉜 선택자 전부가 미리보기 칸을 가리킬 때만 (채팅과 같이 쓰는 규칙은 남긴다).
// :is(A, B) · :where(A, B) 안의 쉼표도 갈래로 센다 — `:is(body.salty #chat .mes .mes_text, .salty-sample)` 처럼
// 채팅과 표본이 한 규칙을 나눠 쓰는 것(본문 글꼴 · 크기 · 줄 간격!)을 통째로 떼면 설정창을 열기 전까지 글꼴이 안 먹는다
function splitTop(text) {
    const parts = [];
    let depth = 0, cur = '';
    for (const c of text) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (c === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur);
    return parts;
}
function expand(selector) {
    const m = /:(?:is|where)\(/.exec(selector);
    if (!m) return [selector];
    let depth = 0, end = -1;
    for (let i = m.index + m[0].length - 1; i < selector.length; i++) {
        if (selector[i] === '(') depth++;
        else if (selector[i] === ')' && --depth === 0) { end = i; break; }
    }
    if (end < 0) return [selector];
    const head = selector.slice(0, m.index), tail = selector.slice(end + 1);
    const args = splitTop(selector.slice(m.index + m[0].length, end));
    return args.flatMap(a => expand(head + a + tail));
}
function previewOnly(selectorText) {
    if (!PREVIEW.test(selectorText)) return false; // 4.1.2: 규칙 대부분(3천여 개)은 미리보기 이름이 아예 없다 — 쪼개 보기 전에 넘긴다
    return splitTop(selectorText).flatMap(expand).every(p => PREVIEW.test(p));
}

/**
 * 규칙을 제자리에서 `@media not all { … }` 로 감싸 꺼 둔다. 돌려받은 CSSMediaRule 의 mediaText 를 'all' 로 바꾸면 다시 켜진다.
 * 2.9.1: 예전에는 떼어 낸 규칙을 <style> 로 문서 맨 뒤에 붙였는데, 그러면 style.css 안에서 그 뒤에 오던 같은 세기의 규칙보다
 * 나중이 되어 덮어쓰기가 뒤집혔다 (월드인포 줄마다 덮어쓰기 칸이 2열 · 세로 대신 옛 한 줄 규칙으로 깨짐).
 * 제자리에 두면 순서가 그대로다. 안 맞는 @media 안의 규칙은 브라우저가 규칙 목록에 넣지 않으니 :has() 비용도 똑같이 빠진다.
 */
// 4.1.2: 나란히 붙은 규칙들은 한 덩어리로 (count 개) — 미리보기 사본은 수백 개가 줄지어 있어, 하나씩 넣고 지우면 그때마다 시트가 바뀐 것으로 쳐졌다
function parkRule(owner, index, count = 1) {
    let text = '';
    for (let i = index; i < index + count; i++) text += `${owner.cssRules[i].cssText}\n`;
    owner.insertRule(`@media not all {\n${text}}`, index); // 먼저 넣고 원래 것을 지운다 — 넣기가 실패해도 규칙이 사라지지 않게
    for (let i = 0; i < count; i++) owner.deleteRule(index + 1);
    return owner.cssRules[index];
}

// 3.0.0: 맨 위 목록은 게으른 칸 시작 표시(#salty-lazy-panel-start) 앞까지만 — 그 뒤는 deferPanelHasRules 가 통째로 옮긴다
function pull(list, owner, end = list.length) {
    for (let i = end - 1; i >= 0; i--) {
        const rule = list[i];
        if (rule.cssRules && rule.type !== CSSRule.STYLE_RULE) {
            if (rule.type === CSSRule.MEDIA_RULE && rule.media.mediaText === 'not all') {
                // 4.8.3: 빌드(gen-preview-css.js)가 미리 꺼 둔 미리보기 덩어리 — 뽑아 넣을 것 없이 목록에만 넣고, 켤 때 함께 켠다
                const first = rule.cssRules[0];
                if (first && first.type === CSSRule.STYLE_RULE && PREVIEW.test(first.selectorText) && !deferred.includes(rule)) {
                    deferred.push(rule);
                    deferredRules += rule.cssRules.length;
                }
                continue;
            }
            pull(rule.cssRules, rule);
            continue;
        }
        if (rule.type !== CSSRule.STYLE_RULE || !previewOnly(rule.selectorText)) continue;
        let first = i;
        while (first > 0 && list[first - 1].type === CSSRule.STYLE_RULE && previewOnly(list[first - 1].selectorText)) first--;
        deferred.push(parkRule(owner, first, i - first + 1));
        deferredRules += i - first + 1;
        i = first;
    }
}

// 4.8.4: 빌드(tools/css-park.cjs)가 미리보기 전용 규칙을 `@media not all` 로 미리 꺼 둔다 — 여기서는 그 덩어리만 모은다
// (규칙 하나하나의 selectorText 를 읽지 않는다: 3,500개를 읽는 것만으로 폰 리그 부팅 0.15s@4x 였다).
// 덩어리를 하나도 못 찾으면(옛 빌드 · 손으로 고친 style.css) 예전처럼 훑어서 뽑는다.
function collectParked(list) {
    for (const rule of list) {
        if (rule.type === CSSRule.STYLE_RULE || !rule.cssRules) continue;
        if (rule.type === CSSRule.MEDIA_RULE && rule.media.mediaText === 'not all') {
            const first = rule.cssRules[0];
            if (first && first.type === CSSRule.STYLE_RULE && PREVIEW.test(first.selectorText)) { deferred.push(rule); deferredRules += rule.cssRules.length; }
            continue;
        }
        collectParked(rule.cssRules);
    }
}

/** 시트가 읽히면 미리보기 규칙을 떼어 둔다. 시트가 아직 안 왔으면 잠시 뒤 다시. */
export function deferPreviewRules(tries = 25) {
    if (restored || deferred.length) return;
    const sheet = themeSheet();
    if (!sheet || !sheet.cssRules.length) {
        if (tries > 0) setTimeout(() => deferPreviewRules(tries - 1), 200);
        return;
    }
    try {
        collectParked(sheet.cssRules);
        if (deferred.length) { afterBoot(() => setTimeout(() => detachPreviewRules(sheet), 1500)); return; }
        const lazy = lazyStart(sheet);
        pull(sheet.cssRules, sheet, lazy < 0 ? sheet.cssRules.length : lazy);
    } catch (err) {
        console.warn('[Blue Lemonade] 미리보기 규칙 분리 실패 — 그대로 둠', err);
        restorePreviewRules();
    }
}

/** 설정창을 열 때: 꺼 둔 규칙을 제자리에서 다시 켠다 (이 호출은 세션 끝까지 — 설정 창 · 서랍 · 메모 바). */
let permanent = false, holders = 0;
export function restorePreviewRules() {
    permanent = true;
    turnOn();
}
function turnOn() {
    if (restored) return;
    restored = true;
    if (previewStyle) { previewStyle.media = 'all'; return; }
    for (const block of deferred) block.media.mediaText = 'all';
}

// 10-28: 덩어리를 style.css 안에서 켜면(mediaText) 1.7MB 시트 전체가 바뀐 것으로 쳐져 문서 전체를 다시 계산했다 —
// 긴 채팅(메시지 300)에서 폰 4배 기준 설정 창 · 북마크 창을 처음 열 때 약 6초. 빌드가 같은 덩어리를 src/preview-park.gen.css 로 따로 적어 두므로,
// 시작 덮개가 걷힌 뒤 그 글을 꺼 둔 작은 <style> 로 테마 시트 바로 뒤(게으른 칸보다 앞)에 붙여 두고, 켜고 끌 때 그 <style> 의 media 만 바꾼다
// (작은 시트는 바뀐 규칙이 맞을 요소만 다시 계산해요 — 같은 채팅에서 30ms 안팎). style.css 안의 덩어리는 꺼진 채 그대로 둔다.
// 받은 글이 시트의 덩어리와 하나씩 같은 뼈대가 아니면(캐시에 남은 옛 style.css 등) 붙이지 않고 예전처럼 제자리에서 켠다 — 화면은 같다.
let previewStyle = null;
async function detachPreviewRules(sheet) {
    if (previewStyle || restored || !deferred.length) return;
    try {
        const res = await fetch(new URL('./preview-park.gen.css', import.meta.url));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (previewStyle || restored) return;   // 받는 사이 설정 창을 열었으면 이번 세션은 제자리 그대로
        const probe = new CSSStyleSheet();
        probe.replaceSync(text);
        const blocks = [];
        const dig = rule => { while (rule && rule.media?.mediaText !== 'all' && rule.cssRules?.length === 1) rule = rule.cssRules[0]; return rule; };
        for (const rule of probe.cssRules) blocks.push(dig(rule));
        const ok = blocks.length === deferred.length && blocks.every((b, i) => b?.media?.mediaText === 'all' && sameShape(b.cssRules, deferred[i].cssRules) && outerOf(b) === outerOf(deferred[i]));
        if (!ok) { console.info('[Blue Lemonade] 미리보기 규칙은 style.css 안에서 켜요 (화면은 같음): 받은 덩어리가 시트와 다름'); return; }
        const style = document.createElement('style');
        style.id = 'salty-preview-css';
        style.media = 'not all';
        style.textContent = text;
        sheetTail(sheet).after(style);   // 게으른 칸(<style id="salty-panel-css">)이 이미 붙어 있으면 그 앞 — 원래 style.css 안 차례(미리보기 → 게으른 칸)와 같다
        previewStyle = style;
    } catch (err) {
        console.info('[Blue Lemonade] 미리보기 규칙은 style.css 안에서 켜요 (화면은 같음):', err?.message || err);
    }
}
/** 덩어리를 싼 겉 조건(@media · @supports …)을 바깥에서 안쪽 차례로 — 받은 글 쪽은 맨 바깥 `@media all` 감싸개 바로 위까지 */
function outerOf(rule) {
    const out = [];
    for (let p = rule.parentRule; p; p = p.parentRule) out.unshift(p.conditionText ?? p.media?.mediaText ?? p.name ?? '');
    return out.join(' / ');
}
// 5.6.6 (점검 PAB-4): 북마크 창처럼 닫히는 쪽은 쥐었다 놓는다 — 놓는 쪽이 마지막이고 세션 끝까지 켜 둔 쪽(설정 창 · 메모)이 없으면
// 352개 미리보기 규칙을 다시 끈다 (예전엔 한 번 열면 그 세션 내내 켜져 있어, 글이 붙을 때마다 채팅 전체를 다시 맞춰 봤다)
export function holdPreviewRules() { holders++; turnOn(); }
export function releasePreviewRules() {
    holders = Math.max(0, holders - 1);
    if (holders || permanent || !restored) return;
    if (previewStyle) previewStyle.media = 'not all';
    else for (const block of deferred) block.media.mediaText = 'not all';
    restored = false;
}

export function deferredPreviewRuleCount() {
    return restored ? 0 : deferredRules;
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
const sheetTail = sheet => { const ext = document.getElementById('salty-ext-css'); return ext?.isConnected && ext.previousElementSibling === sheet.ownerNode ? ext : sheet.ownerNode; };
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
function uiOpenQuick() {
    return quickOpen() || !!document.querySelector('.openDrawer, dialog[open]');
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
    const want = quick || legacyOpen();
    if (want) closedSeen = 0;
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
            const probe = new CSSStyleSheet();
            probe.replaceSync(tail);
            const from = lazyStart(sheet);
            const live = from < 0 ? [] : [...sheet.cssRules].slice(from + 1);
            if (from < 0 || !sameShape(live, probe.cssRules)) { reasons.push(`${cut ? 'style.css' : 'lazy-panel.gen.css'} 규칙 ${probe.cssRules.length}개 ↔ 시트 ${live.length}개`); continue; }
            const style = document.createElement('style');
            style.id = 'salty-panel-css';
            style.media = 'not all';
            style.textContent = tail;
            (previewStyle?.isConnected ? previewStyle : sheetTail(sheet)).after(style); // 10-28 미리보기 <style> 이 먼저 붙었으면 그 뒤(원래 차례: 미리보기 → 게으른 칸). 먼저 새 시트를 붙이고(꺼진 채) 원래 규칙을 지운다 — 같은 태스크라 그 사이 그리기가 없다
            for (let i = sheet.cssRules.length - 1; i > from; i--) sheet.deleteRule(i);
            panelCount = live.length;
            panelStyle = style;
            panelOn = false;
            syncPanelCss();
            watchPanelOpen();
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
function watchPanelOpen() {
    // 2.9.2: 채팅 밖 변화마다 uiOpen() 을 불렀는데, 옛 팝업 검사의 getClientRects() 가 그때마다 문서 전체 강제 레이아웃이었다.
    // 답변 생성 · 채팅 바꾸기 때 프롬프트 관리자 · 확장 칸이 다시 그려지며 여러 번 돌아서, 측정에서 테마 JS 가운데 가장 비쌌다
    // (답변 한 번 169ms · 채팅 전환 156ms, PC). 이제 아무것도 안 열려 있을 때는 '무언가 열렸을 수 있는' 변화에만 다시 본다 —
    // 서랍에 openDrawer 가 붙음 · dialog 의 open · 옛 팝업(이나 그 겉 칸)의 style/class · 그런 것이 새로 붙음. 열려 있을 때는 예전처럼.
    const OPENERS = `.openDrawer, dialog, ${LEGACY_POPUPS}`;
    const mayOpen = (m) => {
        const t = m.target;
        if (m.type === 'childList') return [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches(OPENERS) || !!n.querySelector(OPENERS)));
        if (m.attributeName === 'open' || t.classList.contains('openDrawer')) return true;
        return t !== document.body && (t.matches(LEGACY_POPUPS) || !!t.querySelector(LEGACY_POPUPS));
    };
    panelObserving = true;
    new MutationObserver((list) => {
        let hit = false;
        for (const m of list) {
            const t = m.target;
            if (t.nodeType !== 1 || t.closest?.('#chat, #form_sheld')) continue;
            if (panelTap) panelTap(m); // 5.3.7: 숫자 쉼표(numcomma.js)도 채팅 밖 변화만 받는다
            if (hit || (!panelOn && !mayOpen(m))) continue;
            hit = true;
            if (!panelTap) break;
        }
        if (!hit) return;
        // 4.1.2: 켜는 쪽은 그리기 전에(바로), 끄는 쪽은 0.1초에 한 번 — 열려 있는 동안(시작할 때의 로딩 팝업 포함)은 채팅 밖
        // 변화마다 문서를 훑었다 (폰 리그 시작 한 번에 0.2초). 늦게 꺼져도 서랍이 닫힌 뒤라 보이는 것이 없다.
        if (panelOn) { if (!offTimer) offTimer = setTimeout(() => { offTimer = 0; syncPanelCss(); }, 100); return; }
        syncPanelCss();
    }).observe(document.body, { attributes: true, attributeFilter: ['class', 'open', 'style'], subtree: true, childList: true });
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
export function startMenuOpenMark() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    // _blClosedAt: 이 메뉴가 마지막으로 닫힌 때 (아래 0.45초 뒤 강제 닫기가 '실리태번이 이미 닫았다가 사용자가 다시 연 메뉴'를 가려낼 때 쓴다)
    const sync = (el) => { const visible = el.classList.contains('visible'); if (!visible) el._blClosedAt = performance.now(); el.closest('.mes')?.classList.toggle('bl-menu-open', visible); positionMessageMenu(el, visible); };
    // 2.9.4: ··· 메뉴 위치가 쓰는 #chat 앵커(--salty-chat)는 열린 메뉴가 있을 때만 — style.css 가 #chat.bl-mes-menu-open 에만 이름을 준다
    const syncChat = () => chat.classList.toggle('bl-mes-menu-open', !!chat.querySelector(':scope > .mes.bl-menu-open'));
    chat.querySelectorAll('.extraMesButtons').forEach(sync);
    syncChat();
    // 4.2.8 '··· 버튼이 아예 없고 버튼들이 늘 펼쳐져 있는' 환경: 다른 CSS(확장 · 커스텀 CSS · 옛 테마 조각)가 버튼 칸을 늘 보이게 하고 ··· 를 숨긴 경우다.
    // 실리태번의 '메시지 작업 확장'과 같은 모습인데 body 에 그 표시(expandMessageActions)가 없어서, 테마는 그 칸을 '떠 있는 메뉴'로 그렸고 닫을 방법도 없이 채팅을 가렸다.
    // 눌러서 연 흔적(.visible · 인라인 display)이 없는데도 보이고 있으면 늘 펼침으로 보고, 실리태번과 같은 표시를 달아 이름 줄 아래 한 줄로 그린다.
    const detectForced = () => {
        const body = document.body, menu = chat.querySelector(':scope > .mes:last-of-type .mes_buttons > .extraMesButtons');
        // 5.5.6: 테마가 빠진 상태(확장만 · 테마 끔)에서는 실리태번의 표시를 달지 않는다 — 내가 달아 둔 것이 있으면 뗀다
        if (!themeEnabled(getSettings())) { if (body.classList.contains('bl-forced-expand')) { body.classList.remove('bl-forced-expand'); if (!document.getElementById('expandMessageActions')?.checked) body.classList.remove('expandMessageActions'); } return; }
        if (!menu || document.getElementById('expandMessageActions')?.checked) { body.classList.remove('bl-forced-expand'); return; }
        const mine = body.classList.contains('bl-forced-expand');
        if (mine) body.classList.remove('expandMessageActions'); // 내가 단 표시를 잠깐 떼고 잰다 (같은 태스크 안이라 화면에는 안 보인다)
        const forced = !menu.classList.contains('visible') && !/display/.test(menu.getAttribute('style') || '') && getComputedStyle(menu).display !== 'none';
        body.classList.toggle('bl-forced-expand', forced);
        if (forced) body.classList.add('expandMessageActions');
    };
    // 경량화(10-15): 잴 때는 다음 프레임 맨 앞에서 — 채팅을 막 그리는 중(채팅 바꾼 1.2초 뒤)에 계산된 스타일을 읽으면 그 자리에서 문서 전체를 다시 계산했다
    // (폰 리그 4배 30개 열기 1.4~2.4초). 프레임이 어차피 할 계산과 하나로 묶인다. 숨은 탭은 화면이 돌아올 때 잰다
    const measureSoon = ms => setTimeout(() => requestAnimationFrame(detectForced), ms);
    for (const ms of [1500, 5000]) measureSoon(ms);
    // 5.5.6: 접속 중에 테마를 켜고 끄면(설정 창의 스위치 — 새로고침 없음) 다시 잰다. body.salty 가 바뀐 때만 — detectForced 도 body 클래스를 바꾸므로 되먹임을 막는다
    let themed = document.body.classList.contains('salty');
    new MutationObserver(() => { const now = document.body.classList.contains('salty'); if (now !== themed) { themed = now; measureSoon(0); } }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
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
    new MutationObserver((list) => {
        let menu = false;
        for (const m of list) if (m.target.classList?.contains('extraMesButtons')) { sync(m.target); menu = true; }
        if (menu) syncChat();
    }).observe(chat, { attributes: true, attributeFilter: ['class'], subtree: true });
    // 열린 메뉴째로 메시지가 지워진 경우도 (메시지를 넣고 뺄 때만 불림 — 스트리밍 글자는 .mes 안쪽이라 안 불림)
    new MutationObserver(() => { if (chat.classList.contains('bl-mes-menu-open')) syncChat(); }).observe(chat, { childList: true });
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
    const observer = new MutationObserver(schedule);
    for (const el of menus) observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
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
