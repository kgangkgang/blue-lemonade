// 11-12 움직임 세기(글 · 소품 · 약 / 중 / 강) — 설계 `지시-1111/글꾸-조절-설계/설계.md` 4-2 · 4-4 ③ · 연결 설명서 `지시-1111/글움직임-세기/마트-연결.md`.
//   모든 틀에 같이 · 이 브라우저에 기억(`bl-mart-motion-v1` — 「모바일에서 강하다」 사용자 말이라 틀을 넘나들어 기억) · 중 = 지금 HTML 그대로.
//   그 틀에 그 세기가 없으면(describe 가 false) 조용히 중으로 둬요. 11-12 밤: 세기 모듈에 「끔」(gm-0 · gp-0)이 들어와 넷 · 빠르기 · 열어 두기는 모듈이 나오면.
import { applyLevel, describe } from './lib/motion/motion.js';

export const MOTION_KEY = 'bl-mart-motion-v1';
export const MOTION_LEVELS = Object.freeze([['0', '끔'], ['s', '약'], ['m', '중'], ['l', '강']]);
const ok = v => (v === '0' || v === 's' || v === 'l' ? v : 'm');
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
let motion = (() => { try { const v = JSON.parse(store()?.getItem(MOTION_KEY) || 'null') || {}; return { text: ok(v.text), prop: ok(v.prop) }; } catch { return { text: 'm', prop: 'm' }; } })();
let rev = 0;
export const motionNow = () => ({ ...motion });
export const motionRev = () => rev;
/** 바꿔요 — { text, prop } 중 준 것만 · 기억하고 'bl-tone-change' 를 알려요 */
export function setMotion(next = {}) {
    if ('text' in next) motion.text = ok(next.text);
    if ('prop' in next) motion.prop = ok(next.prop);
    rev++;
    try { store()?.setItem(MOTION_KEY, JSON.stringify(motion.text === 'm' && motion.prop === 'm' ? {} : motion)); } catch { /* 이번 화면에서만 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { motion: true } })); } catch { /* 시험 */ }
    return motionNow();
}
const keyOf = html => (String(html ?? '').match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || '';
/** 그 틀이 받는 세기 — { text: { s, l }, prop: { s, l } } · 못 읽는 틀이면 둘 다 false */
export function motionCaps(html) {
    try { const d = describe(String(html ?? ''), { key: keyOf(html) }); if (d) return { text: { 0: !!d.text.off, s: d.text.s, l: d.text.l }, prop: { 0: !!d.prop.off, s: d.prop.s, l: d.prop.l } }; } catch { /* 아래 */ }
    return { text: { 0: false, s: false, l: false }, prop: { 0: false, s: false, l: false } };
}
/** 다 그린 틀 HTML 에 지금 세기를 걸어요(둘 다 중이면 그대로 · 그 틀에 없는 세기는 중) */
export function applyMotion(html, value = motion) {
    const text = ok(value?.text), prop = ok(value?.prop);
    if (text === 'm' && prop === 'm') return html;
    try {
        const caps = motionCaps(html), t = text !== 'm' && caps.text[text] ? text : 'm', p = prop !== 'm' && caps.prop[prop] ? prop : 'm';
        if (t === 'm' && p === 'm') return html;
        return applyLevel(String(html), { text: t, prop: p, key: keyOf(html) });
    } catch { return html; }
}
