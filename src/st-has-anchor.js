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
// 1.0.0 극한 최적화: 옮겨 적은 규칙의 :has(~ * A) 는 #top-settings-holder 뒤 문서 전체(채팅 포함)를 훑어서, 메시지 · 서랍 어디든 요소가 바뀔 때마다 #top-settings-holder 를
//   다시 계산했어요(폰 리그 CPU 4배: 요소 5개짜리 재계산 한 번 50~140ms · 채팅 전환 한 번에 20번 안팎). 규칙은 가운데 서랍이 열려 있을 때만 맞으니,
//   #top-settings-holder.bl-center-drawer 표식을 :where 로 맨 앞에 두어(특이도 0 · 왼쪽부터 견줌) 닫혀 있을 때는 :has 를 아예 견주지 않게 해요. 표식은 서랍 칸의 class 만 봐요.
//   :where 안 맨 오른쪽은 #top-settings-holder 로 — `*` 이면 표식이 바뀔 때마다 문서 전체를 다시 계산했어요(서랍을 열 때마다 요소 3,700개)
// 1.0.0 퇴행 고침(실리태번 설정 서랍): 그 표식은 가운데 서랍(사용자 설정 · 확장 · 월드인포)을 열 때마다 켜져, 켜지는 순간 :has(~ * A) 사슬을 새로 견줬어요 —
//   월드인포를 한 번 연 뒤 실리태번 설정 서랍 열기가 8.2.5 416 → 1,187ms(폰 4배 · 같은 리그, 표식만 빼면 622). 조건 A(.drawer-content.maximized · .drawer-content.open ·
//   #character_popup.open)는 드물게만 참이라, 이제 :has() 를 아예 쓰지 않고 JS 가 「A 가 문서에 있고 holder 가 B 에 맞음」을 서랍 칸 · 인물 창의 class 가 바뀔 때만 계산해
//   holder 에 bl-st-raise-N 을 달아요(N = 규칙 차례). 선택자는 #top-settings-holder:is(.bl-st-raise-N, :is(A):is(B 안))…:is(body *) — 뜻(맞는 경우)은 같고
//   우선순위도 :is 의 가장 큰 인자라 원래와 같아요(뒤 인자는 holder 에 맞을 수 없는 서랍 칸 선택자). A 가 서랍 칸 · 인물 창이 아니거나 B 가 :has(복합 하나)가 아니면 예전 표식 꼴 그대로.

const HOLDER = '#top-settings-holder';
export const CENTER_OPEN = 'bl-center-drawer';
export const RAISE = 'bl-st-raise';
/** JS 가 지켜볼 수 있는 조건 A — 서랍 칸 · 인물 창(class 만 바뀌어요) */
const WATCHABLE = /^(?:\.drawer-content|#character_popup)(?![\w-])/;
const HAS_ONE = /^:has\((.+)\)$/;
/** 옮겨 적은 규칙마다 { cls, conds: [{ a, b }] } — b = holder 가 맞아야 하는 원래 오른쪽 칸 */
export const RAISES = [];
const CENTER_DRAWER = '.drawer-content.openDrawer:not(.fillLeft):not(.fillRight)';
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
export function rebaseSelector(selector, cls = null) {
    const parts = twoCompounds(String(selector || ''));
    if (!parts) return null;
    const [left, right] = parts;
    const match = BODY_HAS.exec(left);
    if (!match || !balanced(match[1])) return null;   // body:has(A):has(B) 처럼 둘 이상이면 손대지 않는다
    const arg = match[1].trim();
    if (!singleCompound(arg)) return null;
    if (!right.startsWith(HOLDER) || /^[\w-]/.test(right.slice(HOLDER.length))) return null;
    const rest = right.slice(HOLDER.length), one = HAS_ONE.exec(rest);
    if (cls && WATCHABLE.test(arg) && one && balanced(one[1]) && singleCompound(one[1])) return `${HOLDER}:is(.${cls}, :is(${arg}):is(${one[1].trim()})):is(body *)`;
    return `${HOLDER}:where(.${CENTER_OPEN})${rest}:is(:has(${arg}), :has(~ ${arg}), :has(~ * ${arg})):is(body *)`;
}
/** rebaseSelector 가 class 꼴로 옮겼을 때 그 조건 { a, b } (아니면 null) */
function raiseCond(selector) {
    const parts = twoCompounds(String(selector || '')); if (!parts) return null;
    const match = BODY_HAS.exec(parts[0]); if (!match) return null;
    return { a: match[1].trim(), b: parts[1] };
}
function balanced(text) {
    let depth = 0;
    for (const ch of text) { if (ch === '(') depth++; else if (ch === ')' && --depth < 0) return false; }
    return depth === 0;
}

/** 규칙 하나(선택자 목록)를 옮겨 적은 선택자 목록 — 목록 중 하나라도 맞지 않으면 null(규칙을 그대로 둔다) */
export function rebaseSelectorList(selectorText, cls = null) {
    const list = splitTop(String(selectorText || ''), ',').map(part => part.trim()).filter(Boolean);
    if (!list.length) return null;
    const next = list.map(sel => rebaseSelector(sel, cls));
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
        const cls = `${RAISE}-${RAISES.length}`;
        const next = rebaseSelectorList(selector, cls);
        const css = String(rule.cssText || '');
        const open = css.indexOf('{');
        if (!next || open < 0) continue;
        try {
            sheet.insertRule(`${next} ${css.slice(open)}`, index);   // 먼저 넣고(실패해도 원래 규칙은 남게) 원래 것을 지운다
            sheet.deleteRule(index + 1);
            changed++;
            // class 꼴로 옮긴 선택자의 조건만 JS 가 계산해요(예전 표식 꼴로 남은 선택자는 아래 watchCenterDrawers 가 맡아요)
            const conds = splitTop(selector, ',').map(part => part.trim()).filter(part => rebaseSelector(part, cls)?.includes(`.${cls}`)).map(raiseCond).filter(Boolean);
            if (conds.length) RAISES.push({ cls, conds });
        } catch { /* 이 브라우저가 :is(:has()) 를 못 읽으면 원래 규칙 그대로 */ }
    }
    return changed;
}

/** 예전 표식 꼴(:where(.bl-center-drawer))로 옮긴 규칙이 실리태번 style.css 에 남았나 — 없으면 표식 감시도 안 걸어요 */
function needsCenterMark(doc) {
    const has = rules => { try { for (const r of rules || []) { if (r.cssRules && !r.selectorText ? has(r.cssRules) : String(r.selectorText || '').includes(`.${CENTER_OPEN}`)) return true; } } catch { /* 읽을 수 없는 시트 */ } return false; };
    for (const sheet of doc.styleSheets || []) { const href = String(sheet.href || ''); if (!/\/third-party\//.test(href) && /\/style\.css(?:[?#]|$)/.test(href) && has(sheet.cssRules)) return true; }
    return false;
}
/** 가운데 서랍이 열려 있는 동안만 html 에 표식 — 서랍 칸의 class 와 서랍이 더 붙는 것만 봐요 */
export function watchCenterDrawers(doc = globalThis.document) {
    const holder = doc?.querySelector?.(HOLDER);
    const mark = holder;   // 표식은 #top-settings-holder 자신에 — html 에 달면 바뀔 때마다 문서 전체를 다시 계산했어요(서랍을 열 때마다 요소 3,700개)
    if (!holder || !mark || typeof MutationObserver !== 'function') { mark?.classList?.add(CENTER_OPEN); return null; }   // 볼 수 없으면 언제나 견줘요(예전과 같음)
    const sync = () => mark.classList.toggle(CENTER_OPEN, !!holder.querySelector(CENTER_DRAWER));
    const seen = new WeakSet();
    const classes = new MutationObserver(sync);
    const attach = () => { for (const el of holder.querySelectorAll('.drawer-content')) if (!seen.has(el)) { seen.add(el); classes.observe(el, { attributes: true, attributeFilter: ['class'] }); } };
    const kids = new MutationObserver(() => { attach(); sync(); });
    for (const el of [holder, ...holder.children]) kids.observe(el, { childList: true });
    attach(); sync();
    return { stop: () => { classes.disconnect(); kids.disconnect(); } };
}

/** RAISES 조건을 지금 계산해 holder 의 bl-st-raise-N 을 바뀔 때만 붙이고 떼요. 돌려줌: 붙은 class 목록 */
export function syncRaises(doc = globalThis.document, holder = doc?.querySelector?.(HOLDER), raises = RAISES) {
    if (!holder) return [];
    const on = [];
    for (const { cls, conds } of raises) {
        const want = conds.some(({ a, b }) => { try { return !!doc.querySelector(a) && holder.matches(b); } catch { return false; } });   // 드문 A 부터 — 없으면 B(:has)는 견주지 않아요
        if (holder.classList.contains(cls) !== want) holder.classList.toggle(cls, want);
        if (want) on.push(cls);
    }
    return on;
}
/** 서랍 칸 · 인물 창의 class 와 그런 칸이 붙고 떨어지는 것(문서 · holder · 이동 칸 바로 아래)만 봐요 — body 전체 감시는 없어요 */
export function watchRaises(doc = globalThis.document) {
    const holder = doc?.querySelector?.(HOLDER);
    if (!holder || !RAISES.length || typeof MutationObserver !== 'function') return null;
    let queued = false;
    const sync = () => { queued = false; syncRaises(doc, holder); };
    const soon = () => { if (!queued) { queued = true; queueMicrotask(sync); } };
    const seen = new WeakSet();
    const classes = new MutationObserver(soon);
    const WATCH = '.drawer-content, #character_popup';
    const watchOne = el => { if (!seen.has(el)) { seen.add(el); classes.observe(el, { attributes: true, attributeFilter: ['class'] }); } };
    const attach = (root = doc) => { if (root.matches?.(WATCH)) watchOne(root); for (const el of root.querySelectorAll?.(WATCH) || []) watchOne(el); };
    // 붙은 가지 안만 훑어요(토스트 · 창이 body 에 붙을 때마다 문서 전체를 훑지 않게)
    const kids = new MutationObserver(records => { let touched = false; for (const r of records) { for (const n of r.addedNodes) if (n.nodeType === 1) { attach(n); touched = true; } if (r.removedNodes.length) touched = true; } if (touched) soon(); });
    for (const el of new Set([doc.body, holder, ...holder.children, doc.getElementById?.('movingDivs')].filter(Boolean))) kids.observe(el, { childList: true });
    attach(); sync();
    return { stop: () => { classes.disconnect(); kids.disconnect(); } };
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
    if (changed) { done = changed; watchRaises(doc); if (needsCenterMark(doc)) watchCenterDrawers(doc); }
    else if (!found && tries > 0) setTimeout(() => rebaseBodyHasRules(doc, tries - 1), 200);
    return changed;
}
