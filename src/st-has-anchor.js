// 8.2.4 실리태번 코어의 body:has(…) 규칙을 #top-settings-holder 기준으로 옮겨 적기 (폰 프롬프트 토글 · 채팅 그리기 멈춤 2차)
//
// 왜: 실리태번 style.css 에
//     body:has(.drawer-content.maximized) #top-settings-holder:has(.drawer-content.openDrawer:not(.fillLeft):not(.fillRight)),
//     body:has(.drawer-content.open) #top-settings-holder:has(…),
//     body:has(#character_popup.open) #top-settings-holder:has(…) { z-index: 4005 }
//   가 있다. 가운데 서랍(사용자 설정 · 확장 · 월드 인포처럼 fillLeft/fillRight 가 아닌 것)을 한 번이라도 열면 크롬이 body 를
//   「:has() 의 주체가 아닌 자리」로 표시하고, 그 뒤로는 body 아래 어디서든 요소가 붙거나 바뀔 때마다 body 를 무효화한다.
//   크롬은 :has() 왼쪽 칸 규칙들의 오른쪽 끝 특징(태그 · 클래스)을 한 목록으로 모아 쓰는데, 테마 규칙에는 그 끝이 태그뿐인 것
//   (`… :has(…) > small` · `> i` · `> div` …)이 있어 body 무효화가 채팅 메시지 300개의 요소 1만 2천여 개를 통째로 다시 계산하게 했다
//   (폰 리그 CPU 4배: 강제 스타일 계산 한 번 1.5초 — 프롬프트 토글 한 번에 2~4번, 성능 관문 토글 8.5~67초).
//   순정은 그 목록이 작아 같은 무효화가 싸다. 서랍을 열기 전(부팅 직후)에는 테마도 0.6초였다.
// 무엇을: 같은 시트 같은 자리에 뜻이 같은 규칙을 넣고 원래 규칙을 지운다 — body 대신 #top-settings-holder 자신(주체)에 :has() 를 건다.
//     body:has(A) #top-settings-holder:has(B)
//   → #top-settings-holder:has(B):is(:has(A), :has(~ A), :has(~ * A)):is(body *)
//   · A 가 있는 곳: holder 안(:has(A)) · holder 뒤의 형제(:has(~ A)) · 그 형제 안(:has(~ * A)) — 실리태번은 holder 앞 형제에 서랍을 두지 않는다
//     (index.html: holder 앞은 #top-bar · 메뉴 ul 뿐, #character_popup · #movingDivs 서랍 · 확장이 붙이는 것은 모두 뒤).
//   · :is(body *) 는 원래 선택자의 body 몫(0,0,1)만큼 우선순위를 맞춘다(holder 는 늘 body 안이라 맞음 여부는 같다).
//   · 주체 :has() 는 holder 자신만 다시 계산하므로(z-index 는 물려받지 않음) 채팅이 통째로 다시 계산되지 않는다.
//   · 선언 글은 원래 규칙의 cssText 그대로. A 가 복합 선택자 하나(공백 · 결합자 없음)가 아니면 그 규칙은 손대지 않는다.
// 테마 화면 켜짐과 따로(확장만 모드에서도) 돈다 — 뜻이 같은 규칙이라 켜고 끌 때 되돌릴 것이 없다.

const HOLDER = '#top-settings-holder';
const BODY_HAS = /^body:has\((.+)\)$/;

/** 괄호 · 따옴표 밖에서 글자 하나로 나누기 */
function splitTop(text, char) {
    const out = [];
    let depth = 0, quote = null, cur = '';
    for (const ch of text) {
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        if (depth === 0 && ch === char) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
}

/** 괄호 밖 공백(후손 결합자)에서 두 칸으로: 'body:has(X) #top-settings-holder:has(Y)' → ['body:has(X)', '#top-settings-holder:has(Y)'] */
function twoCompounds(selector) {
    const parts = splitTop(selector.trim().replace(/\s+/g, ' '), ' ').filter(Boolean);
    return parts.length === 2 ? parts : null;
}

/** A 가 결합자 없는 복합 선택자 하나인가 (목록 · 공백 · > ~ + 가 괄호 밖에 없음) */
function singleCompound(arg) {
    const text = arg.trim();
    if (!text || /^[>~+]/.test(text)) return false;
    return ![' ', ',', '>', '~', '+'].some(char => splitTop(text, char).length > 1);
}

/**
 * 선택자 하나 옮겨 적기. 맞는 모양(body:has(A) #top-settings-holder…)이 아니면 null.
 * @param {string} selector
 * @returns {string|null}
 */
export function rebaseSelector(selector) {
    const parts = twoCompounds(String(selector || ''));
    if (!parts) return null;
    const [left, right] = parts;
    const match = BODY_HAS.exec(left);
    if (!match || !balanced(match[1])) return null;   // body:has(A):has(B) 처럼 둘 이상이면 손대지 않는다
    const arg = match[1].trim();
    if (!singleCompound(arg)) return null;
    if (!right.startsWith(HOLDER) || /^[\w-]/.test(right.slice(HOLDER.length))) return null;
    return `${right}:is(:has(${arg}), :has(~ ${arg}), :has(~ * ${arg})):is(body *)`;
}
function balanced(text) {
    let depth = 0;
    for (const ch of text) { if (ch === '(') depth++; else if (ch === ')' && --depth < 0) return false; }
    return depth === 0;
}

/** 규칙 하나(선택자 목록)를 옮겨 적은 선택자 목록 — 목록 중 하나라도 맞지 않으면 null(규칙을 그대로 둔다) */
export function rebaseSelectorList(selectorText) {
    const list = splitTop(String(selectorText || ''), ',').map(part => part.trim()).filter(Boolean);
    if (!list.length) return null;
    const next = list.map(rebaseSelector);
    return next.every(Boolean) ? next.join(', ') : null;
}

/** 이 시트(와 @media 안)의 body:has(…) #top-settings-holder 규칙을 제자리에서 바꾼다. 돌려줌: 바꾼 규칙 수 */
export function rebaseSheet(sheet) {
    let rules;
    try { rules = sheet?.cssRules; } catch { return 0; }   // 다른 출처 시트는 읽을 수 없다
    if (!rules) return 0;
    let changed = 0;
    for (let index = rules.length - 1; index >= 0; index--) {
        const rule = rules[index];
        if (rule?.cssRules && !rule.selectorText) { changed += rebaseSheet(rule); continue; }
        const selector = rule?.selectorText;
        if (typeof selector !== 'string' || !selector.includes('body:has(') || !selector.includes(HOLDER)) continue;
        const next = rebaseSelectorList(selector);
        const css = String(rule.cssText || '');
        const open = css.indexOf('{');
        if (!next || open < 0) continue;
        try {
            sheet.insertRule(`${next} ${css.slice(open)}`, index);   // 먼저 넣고(실패해도 원래 규칙은 남게) 원래 것을 지운다
            sheet.deleteRule(index + 1);
            changed++;
        } catch { /* 이 브라우저가 :is(:has()) 를 못 읽으면 원래 규칙 그대로 */ }
    }
    return changed;
}

let done = 0;
/** 실리태번 style.css 를 찾아 한 번 바꾼다(시트가 아직 없으면 잠깐 뒤 다시). 돌려줌: 바꾼 규칙 수(이미 했으면 그 수) */
export function rebaseBodyHasRules(doc = globalThis.document, tries = 25) {
    if (done || !doc?.styleSheets) return done;
    let changed = 0, found = false;
    for (const sheet of doc.styleSheets) {
        const href = String(sheet.href || '');
        if (/\/third-party\//.test(href) || !/\/style\.css(?:[?#]|$)/.test(href)) continue;
        found = true;
        changed += rebaseSheet(sheet);
    }
    if (changed) done = changed;
    else if (!found && tries > 0) setTimeout(() => rebaseBodyHasRules(doc, tries - 1), 200);
    return changed;
}
