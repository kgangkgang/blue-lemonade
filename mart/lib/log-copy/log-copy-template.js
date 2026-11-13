// 원본 블루레몬에이드 1.1.2 의 src/log-copy-template.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」 · 「HTML 복사」가 테마 로그 복사와 같은 모양 · 같은 붙여 넣기 꼴로 내려고 써요)
// 로그 복사 — 1.0.1 글꾸 마트의 「틈 템플릿」: 고정 색 묶음으로 한 번 그려 둔 모양 HTML 에 네 자리({{head}} · {{body}} · {{info}} · {{tail}})만 비워 둔 것.
// 테마가 그 자리에 컨셉 틀과 같은 부품(제목 · 알약 / 메시지 / 추가 정보 / 꼬리)을 끼워요(log-copy-presets.js drawTemplate).
// 받은 템플릿은 코드가 아니라 데이터예요 — 여기서 고쳐 쓰지 않고 「규칙에 맞는지」만 보고, 하나라도 어긋나면 통째로 거절해요.
//   태그: div · span · p · b · i · em · strong · br 만 / 속성: style 만(장식 표시 aria-hidden="true" 하나는 허용) — class · id · on* · href · src 없음
//   style: url( · expression( · behavior · -moz-binding · javascript: · @import · position: fixed · 역슬래시(CSS 이스케이프) · & (글자 참조로 숨긴 글) 없음
//   길이 64KB 이하 · 네 자리가 각각 한 번씩(속성 안은 안 됨) · 깊이 64 이하 · 주석 없음. DOM 없는 순수 함수(node 시험 tools/tests/mart-import.mjs).
//   1.1.2: 속성 값에 $ 없음(치환 무늬 $' · $& 로 쓰일 수 있는 글) · 한 태그에 같은 속성 두 번 없음(브라우저는 첫 것만 읽어 뒤 것은 숨은 글이 돼요)
//   1.0.1 더한 것: details · summary(속성 open="" 허용) · data-bl-egg="bounce|spin|…"(값 고정 목록) · animation 은 bl- 이름만(log-copy-motion.js)
//   1.0.1 그림 부품(11-04): url( 은 url('data:image/svg+xml,<퍼센트 인코딩 svg>') 하나만 — 커뮤니티 글 편집기가 살리는 꼴(인라인 <svg> · <img> 는 지워져요).
//     인코딩 글에는 따옴표 · 괄호 · < > & 역슬래시 · 조절 문자가 없어야 하고, 풀어 본 svg 에 스크립트 · on…= · href · xlink · foreignObject ·
//     <style> · <!…> · 바깥 url( 이 없어야 해요(safeSvgData — 로그 복사 소독 log-copy-sanitize.js 도 같은 함수). 그 밖의 url((http · https · 다른 data · javascript)은 그대로 막아요.
import { EGG_KINDS } from './log-copy-motion.js';
export const TEMPLATE_MAX = 65536;
export const TEMPLATE_SLOTS = ['head', 'body', 'info', 'tail'];
export const TEMPLATE_MESSAGES = ['box', 'bubble', 'wrap', 'columns', 'station', 'subtitle', 'rpg'];
const TAGS = new Set(['div', 'span', 'p', 'b', 'i', 'em', 'strong', 'br', 'details', 'summary']);   // 1.0.1 details · summary: 눌러 열리는 틀(편지 · 상자 · 커튼)
// 1.0.1 움직임: animation · animation-name 의 이름은 테마 공용 키프레임처럼 bl- 로 시작하는 것만(그 밖 이름 · 키워드 아닌 낱말은 거절)
const ANIM_WORDS = new Set(['infinite', 'alternate', 'alternate-reverse', 'normal', 'reverse', 'forwards', 'backwards', 'both', 'none', 'running', 'paused', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end', 'initial', 'inherit', 'unset']);
function badAnimation(style) {
    for (const [, key, value] of String(style).matchAll(/(?:^|;)\s*(animation(?:-name)?)\s*:\s*([^;]*)/gi)) {
        const words = value.replace(/(?:cubic-bezier|steps)\([^)]*\)/gi, ' ').split(/[\s,]+/).filter(Boolean);
        for (const word of words) {
            if (/^bl-[a-z0-9-]+$/i.test(word)) continue;
            if (key.toLowerCase() === 'animation' && (ANIM_WORDS.has(word.toLowerCase()) || /^[-+]?(\d+\.?\d*|\.\d+)(m?s)?$/i.test(word))) continue;
            if (key.toLowerCase() === 'animation-name' && word.toLowerCase() === 'none') continue;
            return true;
        }
    }
    return false;
}
// 그림 부품 주소: url('data:image/svg+xml,…') — 작은따옴표로 감싸고 안은 퍼센트 인코딩(%3Csvg …)
export const SVG_DATA_URL = /url\(\s*'data:image\/svg\+xml,([^'"()\\<>&\u0000-\u001f]*)'\s*\)/gi;
const SVG_BAD = /<script|<style|<foreignobject|<iframe|<image|<use|<a[\s>]|<!|<\?|\son[a-z]+\s*=|href|xlink|javascript:|vbscript:|data:|@import|url\((?!#[a-z0-9_-]+\))/i;
export const SVG_DATA_MAX = 8192;
/** 데이터 주소 안 svg(퍼센트 인코딩 그대로)가 그림만인가 */
export function safeSvgData(payload) {
    let svg;
    try { svg = decodeURIComponent(String(payload ?? '')).trim(); } catch { return false; }
    if (svg.length > SVG_DATA_MAX || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(svg)) return false;
    if (!/^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>[\s\S]*<\/svg>$/.test(svg)) return false;
    return !SVG_BAD.test(svg);
}
/** style 글에서 그림 부품 주소를 none 으로 바꾼 글(나머지 검사용) — 그림이 나쁘면 null */
export function withoutSvgData(style) {
    let bad = false;
    const out = String(style ?? '').replace(SVG_DATA_URL, (_, data) => { if (!safeSvgData(data)) bad = true; return 'none'; });
    return bad ? null : out;
}
const BAD_STYLE = /(?:^|[^a-z0-9-])url\s*\(|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:|vbscript\s*:|@import|position\s*:\s*fixed|[\\&<>]|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i;
const TOKEN = /<!--|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+="[^"]*")*)\s*\/?>|\{\{([^{}]*)\}\}|[^<{]+|[<{]/gy;

/** 템플릿이 규칙에 맞나 → { ok: true, html } | { ok: false, reason } (고치지 않아요) */
export function checkTemplate(source) {
    const html = typeof source === 'string' ? source : '';
    const fail = reason => ({ ok: false, reason });
    if (!html.trim()) return fail('모양이 비어 있어요');
    if (html.length > TEMPLATE_MAX) return fail('모양이 64KB 보다 커요');
    const count = { head: 0, body: 0, info: 0, tail: 0 };
    const stack = [];
    TOKEN.lastIndex = 0;
    for (let m; TOKEN.lastIndex < html.length && (m = TOKEN.exec(html));) {
        const [all, close, open, attrs, slot] = m;
        if (all === '<!--') return fail('주석은 넣을 수 없어요');
        if (close) {
            const name = close.toLowerCase();
            if (stack.pop() !== name) return fail(`닫는 태그가 어긋나요(${name})`);
        } else if (open) {
            const name = open.toLowerCase();
            if (!TAGS.has(name)) return fail(`쓸 수 없는 태그예요(${name})`);
            const seen = new Set();
            for (const [, key, value] of (attrs || '').matchAll(/\s+([a-zA-Z-]+)="([^"]*)"/g)) {
                const attr = key.toLowerCase();
                if (seen.has(attr)) return fail(`같은 속성을 두 번 쓸 수 없어요(${attr})`);
                seen.add(attr);
                if (value.includes('$')) return fail('속성 값에 $ 는 쓸 수 없어요');
                if (value.includes('{{')) return fail('자리 표시는 속성 안에 둘 수 없어요');
                if (attr === 'aria-hidden' && value === 'true') continue;
                if (attr === 'open' && name === 'details' && (value === '' || value === 'open')) continue;   // 처음부터 펼친 상자
                if (attr === 'data-bl-egg') { if (EGG_KINDS.includes(value)) continue; return fail(`누르면 반응 값이 틀려요(${value})`); }
                if (attr !== 'style') return fail(`쓸 수 없는 속성이에요(${attr})`);
                const plain = withoutSvgData(value);
                if (plain === null) return fail('그림(svg) 부품에 쓸 수 없는 것이 있어요(스크립트 · 링크 · 바깥 주소)');
                if (BAD_STYLE.test(plain)) return fail('스타일에 쓸 수 없는 값이 있어요(주소 · 고정 위치 · 이스케이프)');
                if (badAnimation(value)) return fail('움직임은 bl- 로 시작하는 테마 키프레임만 써요');
            }
            if (name !== 'br' && !/\/>$/.test(all)) { stack.push(name); if (stack.length > 64) return fail('너무 깊게 겹쳐 있어요'); }
        } else if (slot !== undefined) {
            if (!Object.hasOwn(count, slot)) return fail(`모르는 자리 표시예요({{${slot}}})`);
            count[slot]++;
        } else if (all === '<') return fail('태그가 아닌 < 가 있어요');
    }
    if (TOKEN.lastIndex < html.length) return fail('읽을 수 없는 부분이 있어요');
    if (stack.length) return fail('닫지 않은 태그가 있어요');
    const wrong = TEMPLATE_SLOTS.filter(key => count[key] !== 1);
    if (wrong.length) return fail(`자리 표시(${wrong.map(k => `{{${k}}}`).join(' · ')})는 한 번씩 있어야 해요`);
    return { ok: true, html };
}

// 1.0.1 대개편(11-04 검수 「제목이 61종 모두 20px 650 한 가지 = AI 티」): 틀마다 제목 꼴 — 받은 값은 이 표 안에서만(글자로만 · 범위 밖은 버려요)
export const TITLE_FONTS = ['sans', 'serif', 'mono', 'hand', 'display'];
export const TITLE_INKS = ['faceText', 'faceMuted', 'accent', 'quoteBar', 'emphasis', 'name'];
/** 제목 꼴 { font, size 14~40, weight 300~900, align, tracking -0.08~0.4em, upper, italic, ink(역할 색) } → 고친 것 | null */
export function tidyType(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    if (TITLE_FONTS.includes(raw.font)) out.font = raw.font;
    const size = Number(raw.size); if (Number.isFinite(size)) out.size = Math.max(14, Math.min(40, Math.round(size)));
    const weight = Number(raw.weight); if (Number.isFinite(weight)) out.weight = Math.max(300, Math.min(900, Math.round(weight / 100) * 100));
    if (['left', 'center', 'right'].includes(raw.align)) out.align = raw.align;
    const tracking = Number(raw.tracking); if (Number.isFinite(tracking)) out.tracking = Math.max(-0.08, Math.min(0.4, Math.round(tracking * 100) / 100));
    if (raw.upper === true) out.upper = true;
    if (raw.italic === true) out.italic = true;
    if (TITLE_INKS.includes(raw.ink)) out.ink = raw.ink;
    return Object.keys(out).length ? out : null;
}

/** 네 자리에 부품을 끼워요 (부품 글에 $ 가 있어도 그대로 — 함수 치환) */
export const fillTemplate = (template, parts) => String(template ?? '').replace(/\{\{(head|body|info|tail)\}\}/g, (_, key) => parts?.[key] ?? '');

// 색 묶음(역할 이름은 log-copy-concept-kit.js · 할로윈 13종과 같아요) — 빠진 · 틀린 값은 이 바탕 값으로
const BASE = { bg: '#f4f1ea', face: '#fffdf7', faceText: '#2a2622', faceMuted: '#5e564d', panel: '#fffdf7', panel2: '#f3eee3', text: '#2a2622', dialogue: '#1f5fb8', thought: '#6a4a8a', emphasis: '#9a3a1a', mark: '#f6e7b6', quoteBar: '#86b5d5', name: '#1f5fb8', muted: '#5e564d', chip: '#ece6da', chipText: '#2a2622', accent: '#2a2622', onAccent: '#fffdf7', line: '#c9bfb5', deco1: '#86b5d5', deco2: '#f4d35e', deco3: '#c9bfb5' };
export const TEMPLATE_ROLES = Object.keys(BASE);
const HEX = /^#[0-9a-f]{6}$/i;
/** 받은 색 묶음 → 역할 색 전부(#rrggbb 만) · 모자라면 missing 에 이름 */
export function tidyTemplateColors(colors) {
    const out = {}, missing = [];
    for (const key of TEMPLATE_ROLES) {
        const value = colors && typeof colors === 'object' ? colors[key] : undefined;
        if (typeof value === 'string' && HEX.test(value)) out[key] = value.toLowerCase();
        else { out[key] = BASE[key]; if (!key.startsWith('deco')) missing.push(key); }
    }
    return { colors: out, missing };
}
export const templateColors = colors => tidyTemplateColors(colors).colors;
