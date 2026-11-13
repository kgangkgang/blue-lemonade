// 원본 블루레몬에이드 1.1.2 의 src/log-copy-lemon.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」 · 「HTML 복사」가 테마 로그 복사와 같은 모양 · 같은 붙여 넣기 꼴로 내려고 써요)
// 1.1.2 로그 복사 「레몬 바로가기」 — 켜면 어느 틀이든 네 모서리 가운데 빈 곳에 작은 레몬(테마 레몬 svg)을 넣고, 누르면 블루레몬에이드 소개 글이 새 창으로 열려요.
//   사용자: 「레몬 하이퍼링크 넣기 · 빼기 기능 … 넣으면 좌측상단 · 우측상단 · 좌측하단 · 우측하단 중에 빈 공간에 넣어서」. 기본 꺼짐(logCopy.lemonLink).
//   자리 「자동」은 미리보기에 그려진 모양을 재서 고르기 때문에(글자 · 그림 · 작은 꾸밈 칸과 안 겹치는 첫 모서리 — 좌상 · 우상 · 좌하 · 우하 차례, 다 차면 덜 겹치는 곳)
//   틀마다 표를 두지 않아도 내장 · 받은 글꾸 · 내 글꾸 모두 같은 규칙이에요. 레몬 틀은 제목 앞 레몬이 이미 링크라 하나 더 넣지 않아요.
//   붙여 넣는 곳: 바깥 상자에 position:relative · 레몬은 position:absolute(바깥 여백 안쪽). 그림 주소는 복사할 때 맨 앞 <style> 로 옮겨져요(log-copy-lift.js).
import { svgDoc, svgUrl } from './log-copy-concept-kit.js';
import { parseColor, contrast } from './shared/ink-paint.js';
const toHex = c => `#${[c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export const LEMON_HOME = 'https://kkangtong.xyz/posts/157369';
export const LEMON_TITLE = '블루레몬에이드';
export const CORNERS = ['tl', 'tr', 'bl', 'br'];
export const CORNER_LABEL = { auto: '자동', tl: '왼쪽 위', tr: '오른쪽 위', bl: '왼쪽 아래', br: '오른쪽 아래' };
export const LEMON_SIZE = 22, LEMON_INSET = 6;   // 사용자 확정(11-10): 22px(18 은 작아 깨져 보였어요) · 바깥 상자 안쪽 6~8px
/** 둥근 모서리 안쪽에 온전히 들어가는 띄움 — 반지름 r 이면 0.293r 보다 안쪽(모서리를 자르는 상자에서 레몬이 잘리지 않게) */
export const insetFor = radius => Math.min(8, Math.max(LEMON_INSET, Math.ceil((Number(radius) || 0) * 0.3) + 1));
// 테마 레몬(fa-lemon · splash.js LEMON_PATH) — 기본 노랑 #FFE23C · 테두리 #E9BE00, 테두리 굵기 12(작게 그려도 안 깨지게)
export const LEMON_YELLOW = { fill: '#FFE23C', stroke: '#E9BE00' };
const LEMON_D = 'M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z';
const lemonSvg = ({ fill, stroke } = LEMON_YELLOW) => svgDoc(472, 472, `<path fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="12" stroke-linejoin="round" transform="translate(12 428) scale(1 -1)" d="${LEMON_D}"/>`);
export const lemonImage = (paint = LEMON_YELLOW) => `${svgUrl(lemonSvg(paint))} center/100% 100% no-repeat`;

const hsl = c => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min; return { s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l }; };
/** 진한 색 바탕(밝지도 무채색도 아닌, 채도 높은 어두운 바탕)인가 — 그때만 노랑이 튀어요(사용자 확정 11-10: 「레몬은 항상 노랑, 진한 색 배경일 때만 틀 대표색」) */
export const vividDark = bg => { const c = parseColor(bg); if (!c || c.a < 0.5) return false; const h = hsl(c); return h.l < 0.4 && h.s > 0.45; };
/** 레몬 칠: 기본 노랑. 진한 색 바탕이고 대표색이 그 바탕과 3:1 이상이면 대표색(테두리는 25% 어둡게) */
export function lemonPaint(bg, accent) {
    if (!vividDark(bg)) return LEMON_YELLOW;
    const a = parseColor(accent), b = parseColor(bg);
    if (!a || !b || contrast(a, b) < 3) return LEMON_YELLOW;
    const dark = { r: Math.round(a.r * 0.75), g: Math.round(a.g * 0.75), b: Math.round(a.b * 0.75), a: 1 };
    return { fill: toHex(a), stroke: toHex(dark) };
}
export const normCorner = v => (v === 'auto' || CORNERS.includes(v) ? v : 'auto');

/** 모서리 자리 style 글 */
export function cornerCss(corner, inset = LEMON_INSET, shift = 0, drop = 0) {
    const c = CORNERS.includes(corner) ? corner : 'tl';
    return `${c[0] === 't' ? 'top' : 'bottom'}:${inset + (drop || 0)}px;${c[1] === 'l' ? 'left' : 'right'}:${inset + (shift || 0)}px`;
}

/** 붙여 넣는 레몬 바로가기 HTML (인라인 style — 그림 주소는 복사 때 <style> 로) */
export function lemonBadge(corner = 'tl', size = LEMON_SIZE, inset = LEMON_INSET, shift = 0, drop = 0, paint = LEMON_YELLOW) {
    return `<a href="${LEMON_HOME}" target="_blank" rel="noopener noreferrer" title="${LEMON_TITLE}" aria-label="${LEMON_TITLE}" style="position:absolute;${cornerCss(corner, inset, shift, drop)};z-index:3;display:block;width:${size}px;height:${size}px;margin:0;padding:0;border:0;line-height:0;font-size:0;text-decoration:none"><span style="display:block;width:${size}px;height:${size}px;background:${lemonImage(paint)}"></span></a>`;
}

const zoneOf = (c, width, height, size, inset, pad, shift = 0, drop = 0) => {
    const left = c[1] === 'l' ? inset + shift : width - inset - size - shift, top = c[0] === 't' ? inset + drop : height - inset - size - drop;
    return { left: left - pad, top: top - pad, right: left + size + pad, bottom: top + size + pad };
};
const overlap = (z, boxes) => boxes.reduce((sum, b) => sum + Math.max(0, Math.min(b.right, z.right) - Math.max(b.left, z.left)) * Math.max(0, Math.min(b.bottom, z.bottom) - Math.max(b.top, z.top)), 0);
/** 비어 있는 첫 모서리(좌상 → 우상 → 좌하 → 우하 — 사용자 확정: 기본 왼쪽 위, 장식이 있으면 다른 빈 모서리) · 없으면 null */
export function freeCorner(width, height, boxes, size = LEMON_SIZE, inset = LEMON_INSET, pad = 2) {
    return CORNERS.find(c => overlap(zoneOf(c, width, height, size, inset, pad), boxes) === 0) ?? null;
}
/** 네 모서리가 다 차 있으면(테두리 띠 · 무늬 등) 모서리에서 안쪽으로 6px 씩 밀어 가장 가까운 빈 곳(가로 shift + 세로 drop ≤ 120px · 폭/높이의 1/4) — { corner, shift, drop } 또는 null */
export function freeSpot(width, height, boxes, size = LEMON_SIZE, inset = LEMON_INSET, pad = 2) {
    const limit = Math.min(120, width / 4 + height / 4);
    for (let t = 0; t <= limit; t += 6) for (const c of CORNERS) for (let drop = 0; drop <= t; drop += 6) {
        const shift = t - drop;
        if (shift > width / 4 || drop > height / 4) continue;
        if (overlap(zoneOf(c, width, height, size, inset, pad, shift, drop), boxes) === 0) return { corner: c, shift, drop };
    }
    return null;
}
/** 빈 모서리 · 다 차 있으면 겹치는 넓이가 가장 작은 모서리. 상자들은 바깥 상자 기준 좌표 { left, top, right, bottom } */
export function pickCorner(width, height, boxes, size = LEMON_SIZE, inset = LEMON_INSET, pad = 2) {
    let best = 'tl', least = Infinity;
    for (const c of CORNERS) {
        const hit = overlap(zoneOf(c, width, height, size, inset, pad), boxes);
        if (hit === 0) return c;
        if (hit < least) { least = hit; best = c; }
    }
    return best;
}

const opaque = v => v && v !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(v);
/** 미리보기 문서에서 바깥 상자 안의 「차 있는 곳」(글자 줄 · 그림 · 작은 꾸밈 칸 · 안쪽 큰 칸의 테두리 · 바탕 경계) — 바깥 상자 기준 좌표 */
export function occupied(root) {
    const doc = root.ownerDocument, win = doc.defaultView, base = root.getBoundingClientRect();
    const area = Math.max(1, base.width * base.height), rootBg = win.getComputedStyle(root).backgroundColor;
    const rel = r => ({ left: r.left - base.left, top: r.top - base.top, right: r.right - base.left, bottom: r.bottom - base.top });
    const out = [];
    const walker = doc.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!/\S/.test(node.data) || node.parentElement?.closest('style,script')) continue;
        const range = doc.createRange(); range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width && r.height) out.push(rel(r));
    }
    for (const el of root.querySelectorAll('*')) {
        if (/^(STYLE|SCRIPT|BR)$/.test(el.tagName) || el.closest(`a[href="${LEMON_HOME}"]`)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = win.getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const media = /^(IMG|SVG|VIDEO|CANVAS|IFRAME|INPUT|BUTTON|AUDIO|SUMMARY)$/i.test(el.tagName);
        const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(s => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
        const filled = cs.backgroundImage !== 'none' || opaque(cs.backgroundColor);
        const box = rel(r);
        // 작은 꾸밈(알약 · 도장 · 띠 · 창 점 · 아이콘)은 통째로
        // 꽉 찬 가로 띠(머리 줄 · 꼬리 줄 — 폭의 90% 이상)는 바탕이라 「경계」만
        const band = r.width >= base.width * 0.9;
        if (media || ((filled || sides.length) && !band && r.width * r.height < area * 0.2)) { out.push(box); continue; }
        // 큰 칸(카드 · 판)은 바탕이 아니라 「경계」만: 테두리 선 · 바깥과 다른 바탕의 가장자리 — 레몬이 둥근 모서리 테두리에 걸치지 않게
        const edge = (filled && cs.backgroundColor !== rootBg) || cs.backgroundImage !== 'none' ? ['Top', 'Right', 'Bottom', 'Left'] : sides;
        for (const s of edge) {
            const w = Math.max(1, parseFloat(cs[`border${s}Width`]) || 1);
            out.push(s === 'Top' ? { ...box, bottom: box.top + w } : s === 'Bottom' ? { ...box, top: box.bottom - w } : s === 'Left' ? { ...box, right: box.left + w } : { ...box, left: box.right - w });
        }
    }
    return out;
}

/** 레몬을 넣어 볼 상자들: 바깥 상자 → (그 안을 거의 다 채우는 한 칸이면) 그 안 카드 … 3단까지 */
export function lemonLevels(root) {
    const levels = [root];
    let at = root;
    for (let i = 0; i < 3; i++) {
        const kids = [...at.children].filter(el => !/^(STYLE|SCRIPT|BR)$/.test(el.tagName) && !el.matches(`a[href="${LEMON_HOME}"]`) && el.getBoundingClientRect().height > 0);
        if (kids.length !== 1) break;
        const a = at.getBoundingClientRect(), k = kids[0].getBoundingClientRect();
        if (k.width * k.height < a.width * a.height * 0.7) break;
        at = kids[0]; levels.push(at);
    }
    return levels;
}

/** 붙여 넣는 글의 바깥 상자(맨 앞 <style> 뒤 첫 요소) */
export const lemonRoot = body => [...(body?.children ?? [])].find(el => !/^(STYLE|SCRIPT|LINK|META)$/.test(el.tagName)) ?? null;

/**
 * 미리보기 문서에 레몬 바로가기를 넣어요(이미 소개 글 링크가 있으면 — 레몬 틀 — 그대로).
 * @param {Document} doc @param {string} at 'auto' | 'tl' | 'tr' | 'bl' | 'br'
 * @returns {string|null} 넣은 모서리
 */
/** 상자의 실제 바탕(불투명한 바탕을 가진 가장 가까운 조상) */
const bgOf = (el, win) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const v = win.getComputedStyle(n).backgroundColor; const c = parseColor(v); if (c && c.a >= 0.5) return v; } return 'rgb(255, 255, 255)'; };
/** 틀 대표색: 그 바탕과 3:1 이상인 글자 · 칠 색 가운데 채도가 가장 높은 것 */
function accentOf(root, bg, win) {
    let best = null, score = 0;
    const b = parseColor(bg);
    for (const el of [root, ...root.querySelectorAll('*')].slice(0, 600)) {
        const cs = win.getComputedStyle(el);
        for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor]) { const c = parseColor(v); if (!c || c.a < 0.8 || !b || contrast(c, b) < 3) continue; const h = hsl(c); if (h.s * (1 - Math.abs(h.l - 0.55)) > score) { score = h.s * (1 - Math.abs(h.l - 0.55)); best = v; } }
    }
    return score > 0.3 ? best : null;
}
export function placeLemon(doc, at = 'auto') {
    const body = doc?.body, root = lemonRoot(body);
    if (!root || body.querySelector(`a[href="${LEMON_HOME}"]`)) return null;
    const win = doc.defaultView;
    const insetOf = el => { const cs = win.getComputedStyle(el); return insetFor(Math.max(...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map(k => parseFloat(cs[`border${k}Radius`]) || 0))); };
    let host = root, corner = null, shift = 0, drop = 0;
    if (at === 'auto') {
        // 바깥 상자부터 안쪽 카드까지: 빈 모서리가 있는 첫 상자(좌상 먼저) → 없으면 모서리에서 가로로 조금 민 빈 곳 → 그래도 없으면 바깥 상자에서 덜 겹치는 모서리
        const levels = lemonLevels(root).map(level => ({ level, box: level.getBoundingClientRect(), occ: occupied(level), inset: insetOf(level) }));
        const exact = levels.find(l => (l.corner = freeCorner(l.box.width, l.box.height, l.occ, LEMON_SIZE, l.inset)));
        const near = exact ? null : levels.find(l => (l.spot = freeSpot(l.box.width, l.box.height, l.occ, LEMON_SIZE, l.inset)));
        if (exact) { host = exact.level; corner = exact.corner; }
        else if (near) { host = near.level; corner = near.spot.corner; shift = near.spot.shift; drop = near.spot.drop; }
        else corner = pickCorner(levels[0].box.width, levels[0].box.height, levels[0].occ, LEMON_SIZE, levels[0].inset);
    } else corner = normCorner(at) === 'auto' ? 'tl' : at;
    const inset = insetOf(host);
    if (win.getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const holder = doc.createElement('div');
    const bg = bgOf(host, win);
    holder.innerHTML = lemonBadge(corner, LEMON_SIZE, inset, shift, drop, lemonPaint(bg, vividDark(bg) ? accentOf(root, bg, win) : null));
    host.prepend(holder.firstElementChild);
    return corner;
}
