// 1.1.5 받은 심플 글꾸를 테마 안에서 조절하기 — 조절 값(blGeulkku 2)을 칸 하나씩 바꾸는 함수와 세밀 화면이 그릴 값 한 벌.
//   칸 표 · 범위 · 단계는 글꾸 마트 사본의 표(SHAPE_FIELDS · LOOK_FIELDS · 질감 · 움직임)를 그대로 읽고, 값 다듬기도 마트 cleanShape · cleanLook · cleanTex 가 해요.
//   조절 모듈(log-copy-simple-set.js — 받은 글꾸를 그릴 때 받는 마트 사본 조각)과 따로 둬요: 그리기만 할 때는 이 파일을 안 받고, 조절 화면(log-copy-tune-ui.js)이 뜰 때 같이 받아요.
import { read, rebuild, clone, castOf, easyOf, OWN_ROOT, EASY_MOTION, EASY_SIZE, LOOKS, applySet, prepareFrame, readFor, dropLemon, withStyle, withMotion, withSize } from './log-copy-simple-set.js';
import { SHAPE_FIELDS, PAINT_ROLES } from './geulkku-mart/shape.js';
import { LOOK_FIELDS, LOOK_TABS, FONT_STACKS } from './geulkku-mart/look.js';
import { TUNE_ROLES } from './geulkku-mart/tune.js';
import { SPEEDS } from './geulkku-mart/motion-state.js';
import { cleanTex, texInfo } from './geulkku-mart/texture.js';
import { TEX, ORDER as TEX_ORDER } from './geulkku-mart/lib/texture/tex.js';
import { capsStatic, capWhy } from './geulkku-mart/caps.js';

export { castOf, easyOf, EASY_MOTION, EASY_SIZE, LOOKS, applySet, prepareFrame, readFor, dropLemon, withStyle, withMotion, withSize };   // 조절 모듈 것을 그대로(시험 · 화면이 한 곳에서 읽게)
// ── 1.1.5 「세밀」과 간편의 색 · 질감 줄(설계 4-4) — 칸 표 · 범위는 마트 사본의 표(SHAPE_FIELDS · LOOK_FIELDS · 질감 · 움직임) 그대로, 값은 같은 set 하나 ──
export { SHAPE_FIELDS, LOOK_FIELDS, LOOK_TABS, FONT_STACKS, PAINT_ROLES, TUNE_ROLES, SPEEDS, capWhy };
export const TEX_LIST = Object.freeze(TEX_ORDER.map(k => Object.freeze([k, TEX[k].name])));
export const TEX_ON = Object.freeze([['b', '글 칸만'], ['c', '카드 전체']]);
export const TEX_LEVEL = Object.freeze([[1, '옅게'], [2, '보통'], [3, '진하게']]);
/** 질감 견본 네모의 바탕 선언(칩 앞 작은 네모 — 낮 · 밤 한 벌 · 진하게) */
export function texSwatch(id, mode = 'dark') {
    const T = TEX[id], t = mode === 'light' ? 'd' : 'n';
    if (!T) return '';
    const ls = T.layers(t, T.a[t][2], {});
    return `background-image:${ls.map(l => l.img).join(',')};background-size:${ls.map(l => l.size).join(',')};background-position:${ls.map(l => l.pos).join(',')};background-repeat:${ls.map(l => l.rep).join(',')}`;
}
const LEVELS = EASY_MOTION.map(([v]) => v);
/** 글 움직임 · 소품 움직임을 따로(part: 'text' | 'prop') */
export function withMotionPart(set, part, level) {
    const r = read(set);
    if (!r || !['text', 'prop'].includes(part) || !LEVELS.includes(level)) return set;
    return rebuild(r, { motion: { ...r.motion, [part]: level } });
}
/** 빠르기 's'(느리게) | 'm' | 'l'(빠르게) */
export function withSpeed(set, speed) {
    const r = read(set);
    if (!r || !SPEEDS.some(([v]) => v === speed)) return set;
    return rebuild(r, { motion: { ...r.motion, speed } });
}
/** 처음부터 열어 두기 */
export function withOpen(set, on) {
    const r = read(set);
    return r ? rebuild(r, { motion: { ...r.motion, open: on === true } }) : set;
}
/** 바탕 질감 — patch: null(없음) | { tex?, on?, level?, margin? }(지금 값에 덮어써요 · 처음 고르면 글 칸만 · 보통) */
export function withTex(set, patch) {
    const r = read(set);
    if (!r) return set;
    const next = patch == null || patch.tex === null ? null : cleanTex({ on: 'b', level: 2, ...(r.tex || {}), ...patch });
    return rebuild(r, { tex: next });
}
/** 모양 칸 하나(마트 SHAPE_FIELDS 의 path · null = 틀 그대로) — 범위 · 단계는 마트 cleanShape 가 다듬어요 */
export function withShape(set, path, value) {
    const r = read(set);
    if (!r || !SHAPE_FIELDS.some(f => f.path === path)) return set;
    const shape = { ...(r.shape || {}) };
    if (value == null) delete shape[path]; else shape[path] = value;
    return rebuild(r, { shape: Object.keys(shape).length ? shape : null });
}
/** 글 모양 칸 하나(마트 LOOK_FIELDS 의 path · null = 틀 그대로) — 범위는 마트 cleanLook 이 다듬어요. 고정 크기(type.size)를 주면 더하기 값(sizeStep)은 지워요 */
export function withLook(set, path, value) {
    const r = read(set);
    if (!r || !LOOK_FIELDS.some(f => f.path === path) || path === 'lemon.off') return set;
    const L = clone(r.look) || {}, ks = path.split('.');
    let a = L;
    for (const k of ks.slice(0, -1)) a = a[k] ??= {};
    if (value == null) delete a[ks.at(-1)]; else a[ks.at(-1)] = value;
    if (path === 'type.size' && value != null && L.type) delete L.type.sizeStep;
    return rebuild(r, { look: L });
}
/** 낱낱 색(이 틀 · 밤낮 따로 — 마트 tune.inks): role = 제목 · 본문 · 대사 · 이름 · 카드 바탕 · 깡통 띠 · 깡캐 띠 · 제목 밑줄 · null = 틀 그대로 */
export function withInk(set, key, mode, role, color) {
    const r = read(set);
    if (!r || !key || !['light', 'dark'].includes(mode) || ![...TUNE_ROLES, ...PAINT_ROLES].some(x => x.role === role)) return set;
    const tune = r.frame === key ? clone(r.tune) || {} : {};
    const row = ((tune.inks ??= {})[mode] ??= {});
    if (color == null) delete row[role]; else row[role] = color;
    return rebuild(r, { tune, frame: key });
}
/** 화자 색(who: 'main' 깡통 | 'other' 깡캐 · value: '#rrggbb' | 'orig' | null = 인물표 색) */
export function withCast(set, who, value) {
    const r = read(set);
    if (!r || !['main', 'other'].includes(who)) return set;
    return rebuild(r, { cast: { ...(r.cast || {}), [who]: value } });
}
/** 지금 글 모양 값(없으면 null) */
export const lookOf = set => read(set)?.look ?? null;
/** 능력표를 잴 글 — 등록 값의 로그 자리에 이름 · 대사 · 지문 줄을 한 줄씩 넣은 것(이름표 · 띠 같은 줄 규칙이 걸리는지 보려면 줄이 있어야 해요) */
//   1.1.8 칸 묶음 틀은 로그 자리 둘에 칸 둘(지문 · 대사 줄을 넣은 both)
const unitProbe = u => u.both.split('{{지문들}}').join(u.rows.지문).split('{{대사들}}').join(u.rows.대사);
export const probeOf = frame => (frame?.units ? String(frame.html).split('{{로그}}').join(unitProbe(frame.units[0])).split('{{로그:2}}').join(unitProbe(frame.units[1]))
    : String(frame?.html ?? '').split('{{로그}}').join(['이름', '대사', '지문'].map(k => frame?.rows?.[k] ?? '').join('\n')));
/** 소품도 캐릭터 색(기본 켬 — 「기본 색」 틀에서만 뜻이 있어요) */
export function withCover(set, on) {
    const r = read(set);
    return r ? rebuild(r, { tone: { ...r.tone, cover: on !== false }, tune: r.tune && (({ own, ...t }) => t)(r.tune) }) : set;   // 담아 온 틀 값(소품 기본 색 · 캐릭터 색)보다 지금 누른 것이 먼저
}
const leaves = v => (v && typeof v === 'object' ? Object.values(v).reduce((n, x) => n + leaves(x), 0) : v == null ? 0 : 1);
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const shown = (f, v) => (f.kind === 'range' ? `${f.scale ? v / f.scale : v}${f.unit || ''}` : f.kind === 'pick' ? (f.options.find(([id]) => id === v)?.[1] ?? '') : f.kind === 'font' ? (FONT_STACKS.find(x => x.id === v)?.label ?? '') : '');
const COLOR_KEYS = SHAPE_FIELDS.filter(f => f.group === 'color').map(f => f.path), PROP_KEYS = SHAPE_FIELDS.filter(f => f.group === 'prop').map(f => f.path);
/**
 * 세밀 화면이 그릴 값 한 벌 — 지금 값 · 이 틀이 받는 조절(정적 능력표 — 마트 capsStatic) · 갈래별 「바꾼 것」 수 · 요약 글.
 * @param {object} set 조절 값 @param {string} html 틀(등록 값의 html) @param {string} key 틀 열쇠 @param {'light'|'dark'} [mode] @param {object} [row] 틀별 능력표 한 줄(1.1.5 — 정적 값 위에 덮어써요)
 */
let probed = {};
export function fineOf(set, html, key, mode = 'dark', row = null) {
    const r = read(set) || read({ blGeulkku: 2 });
    if (probed.html !== html || probed.row !== row) { const t = texInfo(html); probed = { html, row, caps: { ...capsStatic(html), ...row }, tx: { blocked: !!t.blocked, why: t.blocked ? t.why || '' : '', pane: !!t.pane } }; }   // 같은 틀은 한 번만 재요(누를 때마다 다시 그려도)
    const { caps, tx } = probed;
    const look = clone(r.look) || {}; delete look.lemon;
    const shape = r.shape || {}, tune = r.frame === key ? r.tune : null, inks = tune?.inks || {};
    const m = r.motion, level = Object.fromEntries(EASY_MOTION), speed = Object.fromEntries(SPEEDS);
    const count = {
        color: leaves(inks) + COLOR_KEYS.filter(k => shape[k] != null).length,
        text: leaves(look),
        motion: (m.text !== 'm') + (m.prop !== 'm') + (m.speed !== 'm') + (m.open ? 1 : 0),
        prop: PROP_KEYS.filter(k => shape[k] != null).length,
        shape: Object.keys(shape).filter(k => !COLOR_KEYS.includes(k) && !PROP_KEYS.includes(k)).length + (r.tex ? 1 : 0),
    };
    const words = [];
    if (m.text !== 'm') words.push(`글 움직임 ${level[m.text]}`);
    if (m.prop !== 'm') words.push(`소품 움직임 ${level[m.prop]}`);
    if (m.speed !== 'm') words.push(speed[m.speed]);
    if (m.open) words.push('열어 두기');
    if (r.tex) words.push(`질감 ${TEX[r.tex.tex].name}`);
    for (const f of SHAPE_FIELDS) if (shape[f.path] != null) words.push(`${f.label} ${shown(f, shape[f.path])}`.trim());
    for (const f of LOOK_FIELDS) { const v = getPath(look, f.path); if (v != null) words.push(`${LOOK_TABS.find(([t]) => t === f.tab)?.[1] ?? ''} ${f.label} ${shown(f, v)}`.trim()); }
    if (leaves(inks)) words.push(`낱낱 색 ${leaves(inks)}`);
    return { look, shape, motion: m, tex: r.tex, inks: inks[mode] || {}, cover: tune?.own != null ? !tune.own : r.tone.cover !== false, cast: r.cast, caps, own: OWN_ROOT.test(html),
        texture: { ...tx }, count, total: Object.values(count).reduce((a, b) => a + b, 0), words };
}
/** 처음으로 — group: 'all' | 'color' | 'text' | 'motion' | 'prop' | 'shape'(화자 색 · 레몬 · 고친 글 · 이 틀 값은 그대로) */
export function resetFine(set, group, key) {
    const r = read(set);
    if (!r) return set;
    const all = group === 'all', patch = {};
    const dropShape = (hit) => { const s = Object.fromEntries(Object.entries(patch.shape === undefined ? r.shape ?? {} : patch.shape ?? {}).filter(([k]) => !hit(k))); patch.shape = Object.keys(s).length ? s : null; };
    if (all || group === 'color') { dropShape(k => COLOR_KEYS.includes(k)); if (r.frame === key && r.tune?.inks) { const t = clone(r.tune); delete t.inks; patch.tune = t; } }
    if (all || group === 'text') patch.look = r.look?.lemon?.off === true ? { lemon: { off: true } } : null;
    if (all || group === 'motion') patch.motion = { text: 'm', prop: 'm', speed: 'm', open: false };
    if (all || group === 'prop') dropShape(k => PROP_KEYS.includes(k));
    if (all || group === 'shape') { dropShape(k => !COLOR_KEYS.includes(k) && !PROP_KEYS.includes(k)); patch.tex = null; }
    return rebuild(r, patch);
}
