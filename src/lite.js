// 가볍게 (2.5.2): 테마 설정창 미리보기 전용 CSS 는 설정창을 열 때까지 빼 둔다.
//
// style.css 의 surfaces:preview 블록은 #chat 규칙을 :is(#salty-nochat, .salty-preview) · .salty-sample 용으로 복사한 것이라
// 규칙이 200개가 넘는다. 브라우저는 채팅 본문이 바뀔 때마다(답변이 한 글자씩 자랄 때) 바뀐 요소를 모든 규칙과 견주는데,
// 이 규칙들은 설정창 밖에서는 절대 맞지 않으면서도 매번 견줘진다 (PC 에서 스타일 계산의 약 1/4). 그래서 시트에서 떼어 뒀다가
// 설정 서랍을 펴거나 설정 팝업을 열 때 <style> 로 되돌린다. style.css 자체는 건드리지 않는다 (미리보기 생성 블록 그대로).
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

function pull(list, owner) {
    for (let i = list.length - 1; i >= 0; i--) {
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
        pull(sheet.cssRules, sheet);
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

// ── 서랍 · 팝업 전용 :has() 규칙은 서랍이나 팝업이 열려 있을 때만 시트에 둔다 (2.8.4) ──────────────
//
// 측정(PC, 서랍 모두 닫힘, 메시지 5개): 입력칸 높이가 한 줄 늘 때 스타일 재계산이 테마 없이 3ms, 테마 있으면 22ms 인데
// 그중 14ms 가 설정 서랍 · 팝업 안에서만 맞는 :has() 규칙 206개 몫이다 — 서랍이 display:none 이라 맞을 일이 없는데도
// 브라우저는 인라인 style 이 바뀔 때마다 :has() 규칙들을 다시 따진다. 폰에서는 몇 배라 빨리 치면 글자가 빠졌다
// (사용자: "빨리 치면 글자가 떨어지네"). 채팅 · 입력칸 · 환영 화면의 :has() 는 그대로 둔다.
// 이 규칙들을 제자리에서 @media not all 로 감싸 두고(parkRule), 서랍(.openDrawer)이나 팝업(dialog[open] · 옛 팝업 div)이
// 하나라도 보이면 켜고('all') 아니면 끈다('not all'). 켜고 끄는 건 MutationObserver 마이크로태스크라 그리기 전에 끝난다.
// 2.9.1: 2.8.4 는 이 규칙들을 <style id="salty-panel-css"> 로 문서 맨 뒤에 옮겼다 — 순서가 바뀌어 뒤에서 덮던 규칙이 져서
// 월드인포 편집 칸이 깨졌다. 이제 순서는 style.css 그대로다.
const PANEL = /#left-nav-panel|#right-nav-panel|#WorldInfo|#rm_|#extensions|#user-settings|#PersonaManagement|#completion_prompt_manager|#tavern_helper|\.TH-custom-tailwind|#openai_api|\.popup|dialog|drawer-content|#AdvancedFormatting|#floatingPrompt|#character_popup|#world_popup|#select_chat_popup|#shadow_popup|\.salty-panel|#salty-drawer|\.inline-drawer|\.range-block|#range_block|#top-settings-holder|#character_search_bar|#rm_print_characters_block|\.wi-|\.world_entry|#logprobs|\.avatar-container|#CharListButtonAndHotSwaps|#avatar_div|#persona|\.flex-container:has|\.salty-prevbox|#left-nav|#right-nav/;
const LEGACY_POPUPS = '#character_popup, #world_popup, #select_chat_popup, #shadow_popup, #dialogue_popup, #export_format_popup';
let panelBlocks = null;  // 꺼 둔 규칙을 감싼 CSSMediaRule 들
let panelOn = false;
let panelCount = 0;

function styleRulesOf(rule) {
    if (rule.type === CSSRule.STYLE_RULE) return [rule];
    return rule.cssRules ? [...rule.cssRules].flatMap(styleRulesOf) : [];
}
// :not( … ) 의 안을 비운다. 2.9.2: 빼는 목록에 적힌 이름은 그 규칙이 어디서 먹는지와 상관없다 —
// `.menu_button:is(…):where(:not(.popup-controls *))` · `#nonQRFormItems > :where(:not(… [role="dialog"] …))` ·
// `#leftSendForm > :where(div:not(#extensionsMenuButton))` 가 안에 든 .popup · dialog · #extensions 때문에 서랍 규칙으로 잘못 분류돼
// 서랍이 닫혀 있는 동안(= 채팅하는 내내) 꺼져 있었다: 다른 확장이 입력줄에 단 아이콘 단추가 테마 크기를 잃고 서랍을 열 때만 돌아옴,
// 시작 화면 최근 채팅의 아이콘 색이 달라짐 (12개 규칙)
function stripNot(selector) {
    let out = '', i = 0;
    while (i < selector.length) {
        const at = selector.indexOf(':not(', i);
        if (at < 0) { out += selector.slice(i); break; }
        out += selector.slice(i, at + 5);
        let depth = 1, j = at + 5;
        for (; j < selector.length && depth; j++) {
            if (selector[j] === '(') depth++;
            else if (selector[j] === ')') depth--;
        }
        out += ')';
        i = j;
    }
    return out;
}
function panelHasOnly(rule) {
    const list = styleRulesOf(rule);
    return list.length > 0 && list.every(r => r.selectorText.includes(':has(') && splitTop(stripNot(r.selectorText)).flatMap(expand).every(p => PANEL.test(p)));
}
function uiOpen() {
    if (document.querySelector('.openDrawer, dialog[open]')) return true;
    for (const el of document.querySelectorAll(LEGACY_POPUPS)) if (el.getClientRects().length) return true;
    return false;
}
function syncPanelCss() {
    if (!panelBlocks) return;
    const want = uiOpen();
    if (want === panelOn) return;
    panelOn = want;
    const text = want ? 'all' : 'not all';
    for (const block of panelBlocks) block.media.mediaText = text;
}

/** 시트의 서랍 · 팝업 전용 :has() 규칙을 제자리에서 꺼 두고, 열림 상태를 지켜본다. */
export function deferPanelHasRules(tries = 25) {
    if (panelBlocks) return;
    const sheet = themeSheet();
    if (!sheet || !sheet.cssRules.length) {
        if (tries > 0) setTimeout(() => deferPanelHasRules(tries - 1), 200);
        return;
    }
    const parked = [];
    try {
        for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
            const rule = sheet.cssRules[i];
            if (rule.type === CSSRule.MEDIA_RULE && rule.media.mediaText === 'not all') continue; // 미리보기 규칙으로 이미 꺼 둔 것
            if (!panelHasOnly(rule)) continue;
            parked.push(parkRule(sheet, i));
        }
    } catch (err) {
        console.warn('[Blue Lemonade] 서랍 :has 규칙 분리 실패 — 켜 둠', err);
        for (const block of parked) block.media.mediaText = 'all';
        return;
    }
    panelCount = parked.length;
    panelBlocks = parked;
    panelOn = false;
    syncPanelCss();
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
    document.addEventListener('click', () => queueMicrotask(syncPanelCss), true);
}

export function panelHasRuleCount() {
    return panelCount;
}

export function panelCssEnabled() {
    return !!panelBlocks && panelOn;
}

// 메시지 ··· 메뉴가 열린 메시지 표시 (2.5.3): style.css 가 `.mes:has(.extraMesButtons.visible)` 로 알아내던 것.
// :has() 는 메뉴 하나가 열릴 때 그 메시지 안 요소 전부(긴 답변이면 수백 개)를 다시 계산하게 만들어 ··· 탭이 굼떴다.
// 대신 실리태번이 .extraMesButtons 에 .visible 을 붙이는 순간 여기서 .mes 에 bl-menu-open 을 붙인다 (클래스 하나 = 그 요소만 다시 계산).
export function startMenuOpenMark() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    const sync = (el) => el.closest('.mes')?.classList.toggle('bl-menu-open', el.classList.contains('visible'));
    chat.querySelectorAll('.extraMesButtons').forEach(sync);
    new MutationObserver((list) => {
        for (const m of list) if (m.target.classList?.contains('extraMesButtons')) sync(m.target);
    }).observe(chat, { attributes: true, attributeFilter: ['class'], subtree: true });
}
