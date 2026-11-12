// 1.1.4 글꾸 마트 「테마로 담기」로 받은 심플 글꾸에 담아 온 조절 값(blGeulkku 2)을 입혀요 — 마트 toneOut 의 차례 그대로.
//   다시 칠하기(화자 색 · 낮밤)는 테마 drawSimple 이 해요(인물표 색 · 셋째 화자까지). 그 앞뒤만 여기서:
//     칠하기 앞: 「기본 색」 틀(뿌리 gk-own)의 소품을 캐릭터 색으로 할지(마트 ownOf 규칙)
//     칠하기 뒤: 모양(applyShape · 낱낱 바탕 색) → 글 모양(applyLook) → 이 틀 값(applyTune) → 움직임(applyMotion) → 바탕 질감(applyTex)
//   마트 코드는 손으로 옮기지 않고 사본(src/geulkku-mart/ — tools/mart/geulkku-mart-copy.mjs)을 그대로 불러요. 마트와 같은 결과인지는 tools/tests/log-copy-simple-set.mjs 가 마트 기대값과 맞대요.
//   안 하는 것: 마트 견본 이름 숨김(applyWords — 테마는 이름 숨김 · 바꾸기 도구가 따로) · 담아 온 화자 색(style.cast — 테마는 인물표 색이 먼저) · 담아 온 밤낮(style.mode — 테마 밝기 칩이 정해요).
// 시작 그래프 밖: 로그 복사 시트가 받은 심플 글꾸를 처음 그릴 때만 받아요(import()).
import { readSet, makeSet } from './geulkku-mart/geulkku-set.js';
import { LOOKS, sameLook } from './geulkku-mart/looks.js';   // 1.1.4 간편 — 추천 스타일 여섯 벌(마트와 같은 값)
import { applyShape } from './geulkku-mart/shape.js';
import { applyLook, dropLemon as martDropLemon } from './geulkku-mart/look.js';
import { applyTune } from './geulkku-mart/tune.js';
import { slots } from './geulkku-mart/lib/cust/cust.js';
import { applyMotion } from './geulkku-mart/motion-state.js';
import { applyTex } from './geulkku-mart/texture.js';
import { capsStatic, shapeGate, padIn, titleIn } from './geulkku-mart/caps.js';

const OWN_ROOT = /^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-own[\s"]/;
const ROOT_CLASS = /^(\s*<div\b[^>]*\sclass=")([^"]*)"/;

/** 설정 → 마트 값(못 읽으면 null) — 이 틀 값(frames[key])은 그 틀 열쇠일 때만 */
export function readFor(set, key) {
    const r = readSet(set);
    if (!r) return null;
    return { ...r, tune: r.frame && r.frame === key ? r.tune : null };
}

/**
 * 칠하기 앞 — 「기본 색」 틀의 소품(마트 ownOf): 이 틀 값이 기본 색(own)이면 그대로 · 캐릭터 색(cast)이면 뗌 ·
 *   정하지 않았으면 캐릭터 색을 알고(인물표 · 화면) 「소품도 캐릭터 색」이 켜져 있을 때(기본) 떼요.
 * @param {object} frame 등록 값 @param {object} set 조절 값 @param {{ castKnown?: boolean }} [o]
 */
export function prepareFrame(frame, set, { castKnown = false } = {}) {
    const r = readFor(set, frame?.key);
    if (!r || !OWN_ROOT.test(frame.html)) return frame;
    const own = r.tune?.own;
    const off = own === false || (own !== true && castKnown && r.tone.cover !== false);
    return off ? { ...frame, html: frame.html.replace(ROOT_CLASS, (all, a, v) => `${a}${v.split(/\s+/).filter(c => c !== 'gk-own').join(' ')}"`) } : frame;
}

/**
 * 칠하기 뒤 — 조절 값을 입혀요(아무것도 안 고친 설정이면 받은 글 그대로).
 * @param {string} html drawSimple 이 그린 글(고칠 자리 「✎」 표시 없이)
 * @param {object} set 조절 값 @param {{ mode?: 'light'|'dark', key?: string }} [o]
 */
export function applySet(html, set, { mode = 'dark', key = '' } = {}) {
    if (!html) return html;
    const r = readFor(set, key);
    if (!r) return html;
    const t = r.tune, caps = capsStatic(html);
    const value = r.shape && r.shape.pad != null ? { ...r.shape, pad: padIn(caps, r.shape.pad) } : r.shape;
    const shaped = applyShape(html, value, t?.inks?.[mode], shapeGate(caps, value));
    const L = r.look, ts = L?.title?.size;
    const look = ts == null || !caps?.title || titleIn(caps, ts) === ts ? L : { ...L, title: { ...L.title, size: titleIn(caps, ts) } };
    const styled = applyLook(shaped, look);
    return applyTex(applyMotion(t ? applyTune(styled, valsIn(styled, t), { mine: false }) : styled, r.motion), r.tex);
}

/** 이 틀 값의 글자 칸(tN) 가운데 그린 글에 없는 칸은 빼요 — 테마는 틀의 「로그 자리 · 숨은 줄」 칸에 실제 로그를 그려 그 글자 칸이 없어요.
 *  없는 칸 하나 때문에 마트 applyVals 가 통째로 물러나(원래 글 그대로) 다른 칸 값까지 안 걸리던 것(1.1.4 화면 확인 · 예: 「신문 기사」 머리기사 t3). */
export function valsIn(html, tune) {
    const vals = tune?.vals;
    if (!vals || typeof vals !== 'object') return tune;
    let have;
    try { have = new Set(slots(html, 'gk-').map(s => `t${s.n}`)); } catch { return tune; }
    const keys = Object.keys(vals), keep = keys.filter(k => !/^t\d+$/.test(k) || have.has(k));
    return keep.length === keys.length ? tune : { ...tune, vals: Object.fromEntries(keep.map(k => [k, vals[k]])) };
}

/** 레몬 바로가기(틀 안 레몬)를 빼요 — 시트 「레몬」 칩을 끈 때(마트 「레몬 빼기」와 같은 함수) */
export function dropLemon(html) {
    const r = martDropLemon(html);   // 마트 함수는 { html, rules } 를 돌려줘요 — 규칙(레몬이 빠진 머리 줄 맞춤)은 <style> 끝에 붙여요(마트 applyLook 과 같은 자리)
    const text = String(r?.html ?? html ?? ''), at = text.indexOf('\n</style>');
    return !r?.rules?.length || at < 0 ? text : `${text.slice(0, at)}\n${r.rules.join('\n')}${text.slice(at)}`;
}

// ── 1.1.4 「간편」(설계 4-2 · 마트 tune-ui.js 간편 화면과 같은 규칙) — 받은 심플 글꾸의 조절 값을 칸 셋으로: 스타일 · 움직임 · 글 크기 ──
//   밤낮은 시트 밝기 칩 · 색은 인물표 색(테마 기본)이 맡아요. 값은 그 글꾸의 set 하나 — 바꾸면 마트 makeSet 꼴로 다시 써요.
export { LOOKS };
export const EASY_MOTION = Object.freeze([['0', '끔'], ['s', '약'], ['m', '중'], ['l', '강']]);
export const EASY_SIZE = Object.freeze([[-1, '작게'], [0, '보통'], [2, '크게']]);
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const stepOf = l => l?.type?.sizeStep || 0;
const noStep = (look) => { const L = clone(look) || {}; if (L.type) { delete L.type.sizeStep; if (!Object.keys(L.type).length) delete L.type; } delete L.lemon; return Object.keys(L).length ? L : null; };
// 스타일이 다루는 모양 칸(마트 setShape 한 벌 — 질감은 따로)
const styleShape = shape => { const s = { ...(shape || {}) }; return Object.keys(s).length ? s : null; };
/** 설정 → 간편 칸 값 { style: 추천 스타일 id | null(직접 조절), motion: 세기 | null(글 · 소품 따로), apart: { text, prop } | null, size, fixed: 고정 px | null } */
export function easyOf(set) {
    const r = readSet(set) || readSet({ blGeulkku: 2 });
    const L = noStep(r.look), m = r.motion, step = stepOf(r.look), shape = styleShape(r.shape);
    const hit = LOOKS.find((x) => {
        const xl = noStep(x.look), xs = x.look?.type?.sizeStep;
        return sameLook(xl, L) && sameLook(x.shape || null, shape) && x.motion.text === m.text && x.motion.prop === m.prop && (xs == null || xs === step);
    });
    return { style: hit?.id ?? null, motion: m.text === m.prop ? m.text : null, apart: m.text === m.prop ? null : { text: m.text, prop: m.prop }, size: step, fixed: r.look?.type?.size ?? null };
}
// 마트 값 → 설정(꼴 2) — 화자 · 밤낮 · 이 틀 값 · 질감 · 이름은 그대로
const rebuild = (r, { look = r.look, motion = r.motion, shape = r.shape } = {}) => makeSet({ tone: r.tone, look, motion, tex: r.tex, shape, tune: r.tune, frame: r.frame, label: r.name });
/** 추천 스타일 한 벌을 입혀요(글 모양 · 움직임 세기 · 모양만 — 글 크기는 「큼직하게」만 정하고 나머지는 지금 값 그대로 · 레몬 빼기 그대로) */
export function withStyle(set, id) {
    const r = readSet(set), x = LOOKS.find(v => v.id === id);
    if (!r || !x) return set;
    const next = clone(x.look) || {}, step = x.look?.type?.sizeStep ?? stepOf(r.look);
    if (step) (next.type ??= {}).sizeStep = step;
    if (r.look?.lemon?.off === true) next.lemon = { off: true };
    return rebuild(r, { look: Object.keys(next).length ? next : null, motion: { ...r.motion, text: x.motion.text, prop: x.motion.prop }, shape: x.shape ? { ...x.shape } : null });
}
/** 움직임 세기(글 · 소품 같이) */
export function withMotion(set, level) {
    const r = readSet(set);
    if (!r || !EASY_MOTION.some(([v]) => v === level)) return set;
    return rebuild(r, { motion: { ...r.motion, text: level, prop: level } });
}
/** 글 크기(틀 값에 더하기 -1 · 0 · +2 — 고정 px 는 지워요) */
export function withSize(set, step) {
    const r = readSet(set);
    if (!r || !EASY_SIZE.some(([v]) => v === step)) return set;
    const L = clone(r.look) || {};
    if (L.type) { delete L.type.size; delete L.type.sizeStep; }
    if (step) (L.type ??= {}).sizeStep = step;
    if (L.type && !Object.keys(L.type).length) delete L.type;
    return rebuild(r, { look: Object.keys(L).length ? L : null });
}
