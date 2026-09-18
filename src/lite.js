import { positionMessageMenu } from './menu-position.js';
// 가볍게 (2.5.2): 테마 설정창 미리보기 전용 CSS 는 설정창을 열 때까지 빼 둔다.
//
// css/23-preview.gen.css (style.css 안의 미리보기 사본)는 #chat 규칙을 :is(#salty-nochat, .salty-preview) · .salty-sample 용으로 복사한 것이라
// 규칙이 200개 가까이 된다. 브라우저는 채팅 본문이 바뀔 때마다(답변이 한 글자씩 자랄 때) 바뀐 요소를 모든 규칙과 견주는데,
// 이 규칙들은 설정창 밖에서는 절대 맞지 않으면서도 매번 견줘진다 (PC 에서 스타일 계산의 약 1/4). 그래서 제자리에서 꺼 뒀다가
// 설정 서랍을 펴거나 설정 팝업을 열 때 다시 켠다 (2.9.1 부터 제자리 — 순서가 안 바뀜).
const PREVIEW = /#salty-nochat|\.salty-preview|\.salty-sample/;
let deferred = [];     // 제자리에서 꺼 둔 CSSMediaRule 들 (parkRule)
let restored = false;

function themeSheet() {
    for (const sheet of document.styleSheets) {
        if (!sheet.href || !/\/blue-lemonade\/style\.css/.test(sheet.href)) continue;
        try { void sheet.cssRules; } catch { return null; }   // 다른 출처면 못 읽음
        return sheet;
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
    return splitTop(selectorText).flatMap(expand).every(p => PREVIEW.test(p));
}

/**
 * 규칙을 제자리에서 `@media not all { … }` 로 감싸 꺼 둔다. 돌려받은 CSSMediaRule 의 mediaText 를 'all' 로 바꾸면 다시 켜진다.
 * 2.9.1: 예전에는 떼어 낸 규칙을 <style> 로 문서 맨 뒤에 붙였는데, 그러면 style.css 안에서 그 뒤에 오던 같은 세기의 규칙보다
 * 나중이 되어 덮어쓰기가 뒤집혔다 (월드인포 줄마다 덮어쓰기 칸이 2열 · 세로 대신 옛 한 줄 규칙으로 깨짐).
 * 제자리에 두면 순서가 그대로다. 안 맞는 @media 안의 규칙은 브라우저가 규칙 목록에 넣지 않으니 :has() 비용도 똑같이 빠진다.
 */
function parkRule(owner, index) {
    const text = owner.cssRules[index].cssText;
    owner.insertRule(`@media not all {\n${text}\n}`, index); // 먼저 넣고 원래 것을 지운다 — 넣기가 실패해도 규칙이 사라지지 않게
    owner.deleteRule(index + 1);
    return owner.cssRules[index];
}

// 3.0.0: 맨 위 목록은 게으른 칸 시작 표시(#salty-lazy-panel-start) 앞까지만 — 그 뒤는 deferPanelHasRules 가 통째로 옮긴다
function pull(list, owner, end = list.length) {
    for (let i = end - 1; i >= 0; i--) {
        const rule = list[i];
        if (rule.cssRules && rule.type !== CSSRule.STYLE_RULE) {
            if (rule.type === CSSRule.MEDIA_RULE && rule.media.mediaText === 'not all') continue; // 이미 꺼 둔 것
            pull(rule.cssRules, rule);
            continue;
        }
        if (rule.type !== CSSRule.STYLE_RULE || !previewOnly(rule.selectorText)) continue;
        deferred.push(parkRule(owner, i));
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
        const lazy = lazyStart(sheet);
        pull(sheet.cssRules, sheet, lazy < 0 ? sheet.cssRules.length : lazy);
    } catch (err) {
        console.warn('[Blue Lemonade] 미리보기 규칙 분리 실패 — 그대로 둠', err);
        restorePreviewRules();
    }
}

/** 설정창을 열 때: 꺼 둔 규칙을 제자리에서 다시 켠다 (한 번만). */
export function restorePreviewRules() {
    if (restored) return;
    restored = true;
    for (const block of deferred) block.media.mediaText = 'all';
    deferred = [];
}

export function deferredPreviewRuleCount() {
    return deferred.length;
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
const LAZY_SENTINEL = '#salty-lazy-panel-start';
const LEGACY_POPUPS = '#character_popup, #world_popup, #select_chat_popup, #shadow_popup, #dialogue_popup, #export_format_popup';
let panelStyle = null;  // 옮겨 둔 게으른 칸 규칙이 든 <style id="salty-panel-css">
let panelOn = false;
let panelCount = 0;
let panelPending = false;

/** 시트 맨 위 목록에서 게으른 칸 시작 표시 규칙의 자리 (없으면 -1) */
function lazyStart(sheet) {
    const rules = sheet.cssRules;
    for (let i = rules.length - 1; i >= 0; i--) {
        if (rules[i].type === CSSRule.STYLE_RULE && rules[i].selectorText === LAZY_SENTINEL) return i;
    }
    return -1;
}
function uiOpen() {
    if (document.querySelector('.openDrawer, dialog[open]')) return true;
    for (const el of document.querySelectorAll(LEGACY_POPUPS)) if (el.getClientRects().length) return true;
    return false;
}
function syncPanelCss() {
    if (!panelStyle) return;
    const want = uiOpen();
    if (want === panelOn) return;
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
    fetch(sheet.href).then(res => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`)))).then((text) => {
        const mark = `${LAZY_SENTINEL} {}`;
        const at = text.lastIndexOf(mark);
        if (at < 0) throw new Error('받아 온 style.css 에 게으른 칸 표시가 없음');
        const tail = text.slice(at + mark.length);
        const probe = new CSSStyleSheet();
        probe.replaceSync(tail);
        const from = lazyStart(sheet);
        const live = from < 0 ? [] : [...sheet.cssRules].slice(from + 1);
        if (from < 0 || live.length !== probe.cssRules.length || live.some((rule, i) => rule.cssText !== probe.cssRules[i].cssText)) {
            throw new Error('받아 온 style.css 끝이 올라온 시트와 다름');
        }
        const style = document.createElement('style');
        style.id = 'salty-panel-css';
        style.media = 'not all';
        style.textContent = tail;
        sheet.ownerNode.after(style); // 먼저 새 시트를 붙이고(꺼진 채) 원래 규칙을 지운다 — 같은 태스크라 그 사이 그리기가 없다
        for (let i = sheet.cssRules.length - 1; i > from; i--) sheet.deleteRule(i);
        panelCount = live.length;
        panelStyle = style;
        panelOn = false;
        syncPanelCss();
        watchPanelOpen();
    }).catch((err) => {
        console.warn('[Blue Lemonade] 서랍 전용 규칙 분리 실패 — style.css 안에 켜 둠', err);
    });
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
    new MutationObserver((list) => {
        for (const m of list) {
            const t = m.target;
            if (t.nodeType !== 1 || t.closest?.('#chat, #form_sheld')) continue;
            if (!panelOn && !mayOpen(m)) continue;
            syncPanelCss();
            return;
        }
    }).observe(document.body, { attributes: true, attributeFilter: ['class', 'open', 'style'], subtree: true, childList: true });
    // 서랍 아이콘 · 팝업 여는 순간에도 한 번 (관찰자보다 먼저 그려지는 일이 없게)
    // 2.9.4: 채팅 · 입력판 안의 클릭(보내기 · 메시지 단추)은 건너뛴다. 거기서 여는 팝업 · 서랍은 위 관찰자가 dialog · open · 옛 팝업의
    // style 변화로 같은 마이크로태스크 안에 잡는다. 이 훅이 부르는 uiOpen() 은 옛 팝업 6개에 getClientRects() 를 해서, 보내기를 누른
    // 순간 스타일 · 레이아웃을 강제로 한 번 더 돌렸다 (4배 느린 CPU 에서 보내기마다 약 130ms).
    document.addEventListener('click', (e) => { if (!e.target?.closest?.('#chat, #form_sheld')) queueMicrotask(syncPanelCss); }, true);
}

export function panelHasRuleCount() {
    return panelCount;
}

export function panelCssEnabled() {
    return !!panelStyle && panelOn;
}
/** 서랍 · 팝업이 열려 있나 — 게으른 칸을 지켜보는 중이면 그 값(문서를 다시 훑지 않음), 아직 아니면 null (3.6.1, numbers.js) */
export function uiOpenKnown() {
    return panelStyle ? panelOn : null;
}

// 메시지 ··· 메뉴가 열린 메시지 표시 (2.5.3): style.css 가 `.mes:has(.extraMesButtons.visible)` 로 알아내던 것.
// :has() 는 메뉴 하나가 열릴 때 그 메시지 안 요소 전부(긴 답변이면 수백 개)를 다시 계산하게 만들어 ··· 탭이 굼떴다.
// 대신 실리태번이 .extraMesButtons 에 .visible 을 붙이는 순간 여기서 .mes 에 bl-menu-open 을 붙인다 (클래스 하나 = 그 요소만 다시 계산).
export function startMenuOpenMark() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    const sync = (el) => { const visible = el.classList.contains('visible'); el.closest('.mes')?.classList.toggle('bl-menu-open', visible); positionMessageMenu(el, visible); };
    // 2.9.4: ··· 메뉴 위치가 쓰는 #chat 앵커(--salty-chat)는 열린 메뉴가 있을 때만 — style.css 가 #chat.bl-mes-menu-open 에만 이름을 준다
    const syncChat = () => chat.classList.toggle('bl-mes-menu-open', !!chat.querySelector(':scope > .mes.bl-menu-open'));
    chat.querySelectorAll('.extraMesButtons').forEach(sync);
    syncChat();
    new MutationObserver((list) => {
        let menu = false;
        for (const m of list) if (m.target.classList?.contains('extraMesButtons')) { sync(m.target); menu = true; }
        if (menu) syncChat();
    }).observe(chat, { attributes: true, attributeFilter: ['class'], subtree: true });
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
    // 열고 닫을 때만 불린다 (display 가 바뀌는 순간) — getComputedStyle 은 그때 한 번
    const sync = () => form.classList.toggle('bl-send-menu-open', menus.some(el => el.isConnected && getComputedStyle(el).display !== 'none'));
    sync();
    const observer = new MutationObserver(sync);
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
