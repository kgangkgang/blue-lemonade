// 원본 omni-next 953c439a 의 src/log-copy-concept-kit.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」가 테마 로그 복사와 같은 모양으로 그리려고 써요)
// 로그 복사 — 컨셉 틀(할로윈 마트 · 기념일 · 사물 · 장르)이 함께 쓰는 조각 상자. 출력은 전부 인라인 style(log-copy-render.js 의 tag).
// 장식 조각은 aria-hidden 이고 글자 칸과 겹치지 않아요. 색은 그 컨셉 묶음 값만(투명도만 바꾼 같은 색 · 흰 반사광 포함).
// 가운데 맞춤은 transform 대신 margin 으로 — 편집기가 transform 을 지워도 자리가 그대로예요. 시작 그래프 밖(시트를 열 때 받아요).
import { tag, mark } from './log-copy-render.js';

export const box = { 'box-sizing': 'border-box', 'max-width': '100%' };
export const font = (ui, size, weight = '400', more = {}) => ({ 'font-family': ui.family, 'font-size': `${size}px`, 'font-weight': weight, 'letter-spacing': ui.tracking, ...more });

export const hide = html => mark(html, 'aria-hidden="true"');   // 장식(글 없음 · 글자 칸과 안 겹침)
export const deco = (style, inner = '') => hide(tag('div', style, inner));
export const WHITE = '#ffffff';
export const al = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;   // 같은 색 · 투명도만
export const at = (pos, style, inner = '') => deco({ position: 'absolute', ...pos, ...style }, inner);
export const lane = (h, inner, more = {}) => deco({ position: 'relative', height: `${h}px`, ...more }, inner);   // 글 없는 장식 줄
export const gap10 = tag('div', { height: '10px' }, '');
export const STAR = 'polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)';
export const star = (pos, size, color) => at(pos, { width: `${size}px`, height: `${size}px`, 'background-color': color, 'clip-path': STAR });
export const dot = (pos, size, color, more = {}) => at(pos, { width: `${size}px`, height: `${size}px`, 'border-radius': '50%', 'background-color': color, ...more });
export const BAT = 'polygon(50% 34%, 54% 14%, 56% 34%, 64% 22%, 78% 12%, 100% 18%, 90% 34%, 86% 58%, 76% 48%, 68% 72%, 60% 60%, 50% 92%, 40% 60%, 32% 72%, 24% 48%, 14% 58%, 10% 34%, 0 18%, 22% 12%, 36% 22%, 44% 34%, 46% 14%)';
export const bat = (pos, w, color) => at(pos, { width: `${w}px`, height: `${Math.round(w * 0.46)}px`, 'background-color': color, 'clip-path': BAT });
export const centerAt = w => ({ left: '50%', 'margin-left': `${Math.round(-w / 2)}px` });
// 1.0.1 그림 부품(11-04 · 커뮤니티 글 편집기가 살리는 꼴): svg 를 퍼센트 인코딩해 style 의 url('data:image/svg+xml,…') 로 — 인라인 <svg> · <img> 는 편집기가 지워요.
//   가져오기 검사 · 소독은 log-copy-template.js safeSvgData(스크립트 · href · 바깥 주소 없는 그림만). 따옴표 · 괄호 · ; { } 까지 인코딩해 style 글에 안전해요.
export const svgDoc = (w, h, inner, ratio = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"${ratio ? ` preserveAspectRatio="${ratio}"` : ''}>${inner}</svg>`;
export const svgUrl = svg => `url('data:image/svg+xml,${String(svg).replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim().replace(/[%#<>"'()&;{}\\]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)}')`;
/** 그림 부품 하나(장식 div · at 과 같아요) — 크기 w × h 에 svg 를 꽉 채워요 · inner 는 그 위에 얹는 부품(촛불 위 불꽃 · 창 속 달) */
export const art = (pos, w, h, svg, more = {}, inner = '') => at(pos, { width: `${w}px`, height: `${h}px`, background: `${svgUrl(svg)} center/100% 100% no-repeat`, ...more }, inner);
/** 바깥 상자(컨셉 바탕색) — more 로 테두리 · 모서리 같은 걸 덧써요 */
export const wrapOuter = (k, ui, inner, pad = '14px', more = {}) => tag('div', { ...box, position: 'relative', padding: pad, 'background-color': k.bg, color: k.text, 'border-radius': '20px', overflow: 'hidden', 'font-family': ui.family, 'letter-spacing': ui.tracking, 'text-align': 'left', ...more }, inner);
