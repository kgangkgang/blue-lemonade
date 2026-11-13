// 가운데 줄 세로 잉크 맞춤(10-31) — 공용 가운데 줄(--bl-center-row, css/10-foundation)의 제목 글자를 「글자 잉크 중심」으로 세로 가운데에.
//   줄 상자 가운데에 놓으면 글꼴마다 위 · 아래 여백(ascent · descent)이 달라 잉크가 줄표 · 점보다 위로 떠요
//   (사용자 10-31 사진: 데우스 「— 장면 계획 —」 의 글자가 줄표 · 점보다 폰 배율 10px 위).
//   그 글꼴 · 그 글자로 잉크를 재고(control-ink.js 와 같은 캔버스 측정) 「상자 가운데 − 잉크 가운데」를 --bl-ink-dy 로 적어요.
//   CSS(10-foundation · 30-dem-skin)가 제목만 그만큼 옮기고 제목 안 장식(줄표)은 되돌려 놓아요 — 상자 크기 · 자리는 그대로.
//   글꼴을 바꾸거나(설정 반영) 웹 글꼴이 늦게 들어오면 다시 재요. 채팅은 메시지 꾸미기 허브(message-decor.js) 하나로만 봐요.
import { addMessageDecorator } from './message-decor.js';
import { inkOf } from './control-ink.js';
import { hiddenQueue, mayHide } from './hidden-details.js';
import { booting, afterBoot } from './boot-gate.js';   // 1.2.2 덮개 동안은 재지 않아요 — 꺼 둔 시트(채팅 모양 · 들여쓰기)의 여백 · 접힘 모양이 빠진 채 재면 틀린 --bl-ink-dy 가 남아요

// 가운데 줄 제목(장식이 같은 줄에 있는 것만): 데우스 카드 제목. 새 가운데 줄을 만들면 여기 한 줄 + CSS 에 var(--bl-ink-dy)
export const CENTER_INK = [
    '.mes_text details.custom-dem-card > summary > .custom-dem-card__title',
    // 1.0.0 시안 A: 데우스 묶음 머리줄 제목도 점 · ⌄ 와 같은 줄(왼쪽 맞춤) — 세로만 잉크 가운데로
    '.mes_text details.custom-dem-modules > summary > .custom-dem-modules__title',
];
const SEL = CENTER_INK.join(', ');
let off = null, active = false, fontsBound = false;
const canvasAscent = new Map();

function fontAscent(style) {
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if (canvasAscent.has(font)) return canvasAscent.get(font);
    const ctx = (fontAscent.c ||= document.createElement('canvas')).getContext('2d');
    ctx.font = font;
    const m = ctx.measureText('가');
    const v = { asc: m.fontBoundingBoxAscent, desc: m.fontBoundingBoxDescent };
    if (canvasAscent.size > 256) canvasAscent.clear();
    canvasAscent.set(font, v);
    return v;
}

/** 요소 하나: 글자 잉크 가운데를 상자(내용) 가운데로 옮길 거리(px, 아래 +) — 한 줄 글자만, 못 재면 null */
export function inkShift(el) {
    let text = '', node = null;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { text += n.textContent; node ||= n; }
    text = text.replace(/\s+/g, ' ').trim();
    if (!node || !text || text.length > 80) return null;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    if (rects.length !== 1) return null;
    const style = getComputedStyle(el), m = inkOf(text, style);
    if (!m) return null;
    // 글자 조각(content area) 위 → 기준선 = 글꼴 ascent. 조각 높이와 ascent + descent 가 다르면(정수 반올림) 차이를 위아래 반씩
    const { asc, desc } = fontAscent(style), r = rects[0];
    const baseline = r.top + asc + (r.height - asc - desc) / 2;
    const inkMid = baseline + (m.top + m.bottom) / 2;
    const box = el.getBoundingClientRect(), px = k => parseFloat(style[k]) || 0;
    const mid = box.top + px('borderTopWidth') + px('paddingTop') + (box.height - px('borderTopWidth') - px('paddingTop') - px('paddingBottom') - px('borderBottomWidth')) / 2;
    return Math.round((mid - inkMid) * 4) / 4;   // 0.25px 단위
}

// 읽기 먼저 → 쓰기. 보정은 position: relative 의 top 이라 상자와 글자가 같이 움직여 재는 값은 보정과 무관하고, 다른 제목 자리에도 영향 없어요
function measure(els) {
    const shift = els.map(el => inkShift(el));
    els.forEach((el, i) => {
        const s = shift[i];
        if (s === null || Math.abs(s) < 0.25) el.style.removeProperty('--bl-ink-dy');
        else el.style.setProperty('--bl-ink-dy', `${s}px`);
    });
}
// 1.0.4 닫힌 <details> 안 제목(접힌 데우스 모듈)은 그려지지 않아 잴 때마다 그 묶음만 따로 강제 배치돼요(데우스 상태창 30개 · 폰 4배 17번 · 1초 남짓) —
//   보이는 제목은 바로, 닫힌 묶음 안 제목은 쉴 때 · 열리는 순간(열리기 전에) 같은 계산을 해요(hidden-details.js). 잰 값은 그대로예요.
const hidden = hiddenQueue(els => measure(els), { enabled: () => active });
function apply(list) {
    if (booting()) { afterBoot(all); return; }   // 1.2.2 걷힐 때 문서 전체를 한 번
    const els = [];
    for (const root of list) {
        if (root.matches?.(SEL)) els.push(root);
        root.querySelectorAll?.(SEL).forEach(el => els.push(el));
    }
    if (!els.length) return;
    const check = list.some(root => mayHide(root));
    measure(check ? els.filter(el => !hidden.defer(el)) : els);
}

function all() { if (active) apply([document.body]); }

/** features.js 가 설정이 바뀔 때마다 부른다 — 켜져 있으면 글꼴이 바뀌었을 수 있어 다시 재요 */
export function syncCenterInk(on) {
    active = !!on;
    if (active && !off) off = addMessageDecorator('가운데 줄 잉크', list => apply(list), { settle: 400, order: 90 });
    if (!active && off) { off(); off = null; }
    if (!active) { hidden.clear(); document.querySelectorAll(SEL).forEach(el => el.style.removeProperty('--bl-ink-dy')); return; }
    if (!fontsBound && document.fonts?.addEventListener) { document.fonts.addEventListener('loadingdone', () => requestAnimationFrame(all)); fontsBound = true; }
    requestAnimationFrame(all);
}

/** 설정 창 미리보기처럼 채팅 밖에 그린 표본은 그린 쪽이 직접 불러요 */
export function centerInkIn(root) { if (root) apply([root]); }
