// 가볍게 (2.5.2): 테마 설정창 미리보기 전용 CSS 는 설정창을 열 때까지 빼 둔다.
//
// style.css 의 surfaces:preview 블록은 #chat 규칙을 :is(#salty-nochat, .salty-preview) · .salty-sample 용으로 복사한 것이라
// 규칙이 200개가 넘는다. 브라우저는 채팅 본문이 바뀔 때마다(답변이 한 글자씩 자랄 때) 바뀐 요소를 모든 규칙과 견주는데,
// 이 규칙들은 설정창 밖에서는 절대 맞지 않으면서도 매번 견줘진다 (PC 에서 스타일 계산의 약 1/4). 그래서 시트에서 떼어 뒀다가
// 설정 서랍을 펴거나 설정 팝업을 열 때 <style> 로 되돌린다. style.css 자체는 건드리지 않는다 (미리보기 생성 블록 그대로).
const PREVIEW = /#salty-nochat|\.salty-preview|\.salty-sample/;
let deferred = [];     // [{ text, wrappers: ['@media (…)', …] }]
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

function pull(list, owner, wrappers) {
    for (let i = list.length - 1; i >= 0; i--) {
        const rule = list[i];
        if (rule.cssRules && rule.type !== CSSRule.STYLE_RULE) {
            const head = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();   // '@media (max-width: 1000px)'
            pull(rule.cssRules, rule, [...wrappers, head]);
            continue;
        }
        if (rule.type !== CSSRule.STYLE_RULE || !previewOnly(rule.selectorText)) continue;
        deferred.push({ text: rule.cssText, wrappers });
        owner.deleteRule(i);
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
        pull(sheet.cssRules, sheet, []);
    } catch (err) {
        console.warn('[Blue Lemonade] 미리보기 규칙 분리 실패 — 그대로 둠', err);
        restorePreviewRules();
    }
}

/** 설정창을 열 때: 떼어 둔 규칙을 원래 @media 껍데기째 <style> 로 되돌린다 (한 번만). */
export function restorePreviewRules() {
    if (restored) return;
    restored = true;
    if (!deferred.length) return;
    const style = document.createElement('style');
    style.id = 'salty-preview-css';
    style.textContent = deferred.map(({ text, wrappers }) =>
        wrappers.reduceRight((inner, head) => `${head} {\n${inner}\n}`, text)).join('\n');
    document.head.append(style);
    deferred = [];
}

export function deferredPreviewRuleCount() {
    return deferred.length;
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
