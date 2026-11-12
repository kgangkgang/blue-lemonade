// 태그 글자색 — 실리태번 태그는 사용자가 바탕색만 정하고 글자색은 비워 두는 일이 많다. 그러면 글자는 테마
// 본문색을 물려받아, 라이트 팔레트에서 진한 빨강 태그 위에 어두운 글자가 얹힌다(대비 1.5 안팎).
//
// 바탕색만 정한 태그는 바탕 밝기(상대 휘도)를 재서, 팔레트에 이미 있는 두 끝 색 — 본문 글자(--salty-text)와
// 페이지 바탕(--salty-bg) — 중 대비가 큰 쪽을 글자색으로 준다. 새 색은 만들지 않는다.
// 사용자가 글자색까지 정한 태그(color2)는 손대지 않는다. 고름 · 뺌 · 거르기 동그라미는 제 면이 따로라 빼 둔다.
//
// 관찰자 없이 태그 목록(getContext().tags)으로 태그 id 별 규칙을 한 장 만들어 둔다 — 태그가 다시 그려져도 그대로 맞는다.
// 다시 만드는 때: 테마 적용(팔레트 바뀜) · 설정 저장(태그 색 바꿈 · 태그 추가) · 앱 준비.
//
// 1.2.2 재는 일(계산된 스타일 읽기)은 재료가 바뀐 때만 — 설정 저장 이벤트는 부팅 중에만 열몇 번 오는데, 그때마다 body 의 계산된 스타일을 읽어
// 그 자리에서 문서 스타일 계산을 강제했다(폰 리그 추적: 부팅 18번). 두 끝 색이 나오는 곳은 정해져 있다 — 테마 변수 시트(#salty-vars 의 선언) ·
// <html> · <body> 인라인 값 · 사용자 정의 CSS(#custom-style). 그 재료와 태그 목록(id · 바탕색 · 글자색)이 지난번과 같으면 결과도 같으므로 읽지 않는다.
import { parseColor } from './palettes.js';

const STYLE_ID = 'bl-tag-ink';
let enabled = false, hooked = false, frame = 0, lastCss = null, lastInputs = null;

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);

/** 바탕색 하나 → 'text' | 'bg' (팔레트의 어느 끝 색이 더 잘 읽히나). 시험에서도 쓴다. */
export function pickTagInk(background, text, page) {
    const bg = parseColor(background), t = parseColor(text), p = parseColor(page);
    const solid = bg[3] < 1 ? over(bg, p) : bg;   // 반투명 태그는 페이지 바탕 위에 얹힌 색으로 잰다
    return ratio(t, solid) >= ratio(p, solid) ? 'text' : 'bg';
}

// 사용자가 정한 인라인 글자색이 있으면 규칙이 지게 — jQuery 는 "background-color: …; color: …;" 꼴로 쓴다
const NO_INLINE_INK = ':not([style^="color"]):not([style*="; color"]):not([style*=";color"])';
const NOT_STATE = ':not(.selected):not(.excluded):not(.actionable)';

const INK_VARS = ['--salty-text', '--salty-bg'];
const DECLARED = INK_VARS.map(name => new RegExp('(?<![\\w-])' + name + '\\s*:[^;}]*', 'g'));
/** 계산된 스타일을 읽지 않고 알 수 있는 재료 — 이것이 같으면 build 의 결과(규칙 글)도 같다. 시험에서도 쓴다. */
export function tagInkInputs(tags, doc = document) {
    const list = [];
    for (const tag of tags) if (tag && tag.id != null) list.push([tag.id, tag.color ?? '', tag.color2 ?? '']);
    const sheet = doc.getElementById('salty-vars')?.textContent ?? '', root = doc.documentElement, body = doc.body;
    const own = DECLARED.map(pattern => sheet.match(pattern) || []);   // 시트 안 그 변수의 선언 전부(어느 선택자 것이든)
    const inline = INK_VARS.map(name => [root.style.getPropertyValue(name), body.style.getPropertyValue(name)]);
    // 선언이 다른 변수를 가리키면(var(…)) 그 변수가 올 수 있는 인라인 스타일 전체를, 선언을 못 찾으면 시트 전체를 재료로
    const wide = own.some(found => !found.length || found.some(value => value.includes('var('))) ? [sheet, root.getAttribute('style'), body.getAttribute('style')] : null;
    return JSON.stringify([list, own, inline, wide, doc.getElementById('custom-style')?.textContent ?? '']);
}

function build() {
    frame = 0;
    const el = document.getElementById(STYLE_ID);
    if (!enabled) { el?.remove(); lastCss = null; lastInputs = null; return; }
    let tags = [];
    try { tags = SillyTavern.getContext().tags || []; } catch { tags = []; }
    const inputs = tagInkInputs(tags);
    if (el && lastCss !== null && inputs === lastInputs) return;   // 재료가 그대로 — 재지 않는다
    const body = getComputedStyle(document.body);
    const text = body.getPropertyValue('--salty-text').trim(), page = body.getPropertyValue('--salty-bg').trim();
    if (!text || !page) return;
    lastInputs = inputs;
    const rules = { text: [], bg: [] };
    for (const tag of tags) {
        if (!tag || tag.id == null || !String(tag.color || '').trim() || String(tag.color2 || '').trim()) continue;
        const id = CSS.escape(String(tag.id));
        const side = pickTagInk(tag.color, text, page);
        rules[side].push(
            `body.salty .tag[id="${id}"]${NOT_STATE}${NO_INLINE_INK}`,
            `body.salty .tag_view_item[id="${id}"] .tag_view_name${NO_INLINE_INK}`,
            `body.salty .bogus_folder_select[tagid="${id}"] .avatar${NO_INLINE_INK}`,
        );
    }
    let css = '';
    if (rules.text.length) css += `${rules.text.join(',\n')} { color: var(--salty-text) !important; }\n`;
    if (rules.bg.length) css += `${rules.bg.join(',\n')} { color: var(--salty-bg) !important; }\n`;
    if (css === lastCss && el) return;
    lastCss = css;
    const style = el || Object.assign(document.createElement('style'), { id: STYLE_ID });
    style.textContent = css;
    if (!el) document.head.appendChild(style);
}

const soon = () => { if (!frame) frame = requestAnimationFrame(build); };

export function syncTagInk(active) {
    enabled = !!active;
    if (enabled && !hooked) {
        hooked = true;
        try {
            const { eventSource, event_types } = SillyTavern.getContext();
            for (const name of ['SETTINGS_UPDATED', 'APP_READY', 'CHARACTER_PAGE_LOADED']) if (event_types?.[name]) eventSource.on(event_types[name], soon);
        } catch { /* 이벤트를 못 걸면 테마 적용 때만 */ }
    }
    soon();   // 팔레트 변수가 바뀐 뒤 프레임에서 잰다
}
