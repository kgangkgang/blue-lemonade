// 11-12 공통 설정 꼴 `blGeulkku: 2`(설계 `지시-1111/글꾸-조절-설계/설계.md` 5절) — 마트의 지금 값(toneState · look · motion · 틀별 tune)을 그 꼴로 내고 · 받아요.
//   쓰는 곳: 「테마로 담기」 꾸러미의 set · 설정 파일 `.bl-geulkku.json`. DOM 없는 순수 모듈(값은 부르는 쪽이 넘겨요 — node 시험).
//   없는 키 = 틀 그대로 → 아무것도 안 고친 설정은 { blGeulkku: 2 } 이에요. 새 조절(띠 진하기 · 모양 · 질감 …)은 그 칸이 생기면 여기에 더해요.
import { cleanLook } from './look.js?v=20261112a';
import { cleanTune } from './tune.js?v=20261112a';

export const SET_V = 2;
const HEX = /^#[0-9a-f]{6}$/i;
const hex = v => (HEX.test(v || '') ? v.toLowerCase() : null);
const name = s => String(s ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 24);
const lv = v => (v === 's' || v === 'l' ? v : 'm');
const frameKeyOf = id => (String(id || '').match(/(?:^|-)((?:k|q)\d+)$/) || [])[1] || '';

/** 지금 값 → 설정(꼴 2) · frame: 그 틀 열쇠(주면 완성 프리셋 꼴 — 틀 값까지) */
export function makeSet({ tone = {}, look = null, motion = null, tune = null, frame = '', label = '' } = {}) {
    const out = { blGeulkku: SET_V, from: 'mart' };
    if (name(label)) out.name = name(label);
    const style = {}, cast = {};
    if (tone.on) cast.main = hex(tone.k) ? { name: name(tone.name), color: hex(tone.k) } : { none: true };
    if (hex(tone.k2)) cast.other = { name: name(tone.name2), color: hex(tone.k2) };
    if (hex(tone.k3)) cast.third = { name: name(tone.name3), color: hex(tone.k3) };
    if (tone.cover === false) cast.cover = false;
    if (Object.keys(cast).length) style.cast = cast;
    if (tone.mode === 'light' || tone.mode === 'dark') style.mode = tone.mode;
    const L = cleanLook(look);
    if (L) { const { lemon, ...rest } = L; if (Object.keys(rest).length) style.look = rest; if (lemon?.off) style.show = { lemon: false }; }
    if (motion && (lv(motion.text) !== 'm' || lv(motion.prop) !== 'm')) style.motion = { text: lv(motion.text), prop: lv(motion.prop) };
    if (Object.keys(style).length) out.style = style;
    const key = frameKeyOf(frame);
    if (key) {
        out.frame = key;
        const t = cleanTune(tune) || {}, f = {};
        if (t.vals) f.vals = t.vals;
        if (t.lines) f.lines = t.lines;
        if (t.texts) f.texts = t.texts;
        if (t.spoilers) f.spoilers = t.spoilers;
        if (t.inks) f.colors = t.inks;
        if (t.prop || t.own === true || t.own === false) f.prop = { ...(t.own === true ? { tone: 'own' } : t.own === false ? { tone: 'cast' } : {}), ...(t.prop ? { tone: 'pick', color: t.prop } : {}) };
        if (t.hideTitle || t.hideNames) f.show = { ...(t.hideTitle ? { title: false } : {}), ...(t.hideNames ? { names: false } : {}) };
        if (Object.keys(f).length) out.frames = { [key]: f };
    }
    return out;
}

/**
 * 설정(꼴 2 · 여러 벌이면 첫 벌) → 마트 값 { tone, look, motion, frame, tune } · 모르는 것은 버려요 · 꼴이 아니면 null
 *   tone 은 setTone 에 그대로 넘길 꼴(캐릭터 없음 · 원래 색까지)이에요.
 */
export function readSet(raw) {
    let v = raw;
    if (typeof v === 'string') { try { v = JSON.parse(v.replace(/^﻿/, '')); } catch { return null; } }
    if (!v || typeof v !== 'object') return null;
    if (Array.isArray(v.sets)) v = v.sets[0];
    if (!v || v.blGeulkku !== SET_V) return null;
    const s = v.style && typeof v.style === 'object' ? v.style : {}, c = s.cast || {};
    const tone = { mode: s.mode === 'light' ? 'light' : 'dark', cover: c.cover !== false };
    if (c.main?.none) Object.assign(tone, { on: true, k: null, name: '' });
    else if (hex(c.main?.color)) Object.assign(tone, { on: true, k: hex(c.main.color), name: name(c.main.name) });
    else tone.on = false;
    tone.k2 = hex(c.other?.color); tone.name2 = tone.k2 ? name(c.other.name) : '';
    tone.k3 = hex(c.third?.color); tone.name3 = tone.k3 ? name(c.third.name) : '';
    const look = cleanLook({ ...(s.look || {}), ...(s.show?.lemon === false ? { lemon: { off: true } } : {}) });
    const motion = { text: lv(s.motion?.text), prop: lv(s.motion?.prop) };
    const frame = frameKeyOf(v.frame), f = (frame && v.frames?.[frame]) || {};
    const tune = cleanTune({ vals: f.vals, lines: f.lines, texts: f.texts, spoilers: f.spoilers, inks: f.colors, prop: f.prop?.tone === 'pick' ? f.prop.color : undefined, own: f.prop?.tone === 'own' ? true : f.prop?.tone === 'cast' ? false : undefined, hideTitle: f.show?.title === false, hideNames: f.show?.names === false });
    return { tone, look, motion, frame, tune, name: name(v.name) };
}
