// 1.1.5 로그 복사 「세밀」 화면 — 받은 심플 글꾸의 조절 값(blGeulkku 2)을 갈래별로: 색 · 글 · 움직임 · 소품 · 모양(바탕 질감 포함).
//   칸 · 범위 · 단계는 글꾸 마트 사본의 표(SHAPE_FIELDS · LOOK_FIELDS · 질감 · 움직임 세기)를 그대로 읽어 그려요 — 손으로 다시 적지 않아요.
//   이 틀이 못 받는 조절(정적 능력표 — 마트 capsStatic)은 칸을 흐리게 하고 까닭을 한 줄로 적어요. 숫자 조절칸은 세로 2열이에요(한 열로 내리는 규칙 없음).
//   DOM 없는 글자 함수라 node 로 시험해요. 시작 그래프 밖 — 시트에서 「세밀」을 처음 누를 때만 받아요(import()).
import {
    SHAPE_FIELDS, LOOK_FIELDS, LOOK_TABS, FONT_STACKS, PAINT_ROLES, TUNE_ROLES, SPEEDS, EASY_MOTION, TEX_LIST, TEX_ON, TEX_LEVEL,
    texSwatch, capWhy, fineOf, resetFine, lookOf, probeOf, withMotionPart, withSpeed, withOpen, withTex, withShape, withLook, withInk, withCover, withCast,
} from './log-copy-tune-set.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const act = (kind, path, value) => esc(`${kind}|${path}|${JSON.stringify(value ?? null)}`);

export const GROUPS = Object.freeze([['color', '색'], ['text', '글'], ['motion', '움직임'], ['prop', '소품'], ['shape', '모양']]);
/** 「글」 갈래의 작은 칩(마트 LOOK_TABS 차례 — 색은 「색」 갈래가 맡아요) */
export const TEXT_TABS = Object.freeze(LOOK_TABS.filter(([id]) => id !== 'color'));

const chip = (action, label, pressed, { off = false, lead = '' } = {}) => `<button type="button" class="bl-lc-chip" data-lt="${action}" aria-pressed="${!!pressed}"${off ? ' disabled' : ''}>${lead}<span>${esc(label)}</span></button>`;
const head = (label, why = '') => `<span class="bl-lt-h">${esc(label)}${why ? `<small>${esc(why)}</small>` : ''}</span>`;
const undo = (action, label) => `<button type="button" class="bl-lt-undo" data-lt="${action}" aria-label="${esc(label)} — 틀 그대로" title="틀 그대로"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>`;
const note = (label, chips, small = '') => `<div class="bl-lt-row" role="group" aria-label="${esc(label)}">${head(label, small)}<div class="bl-lt-chips">${chips}</div></div>`;   // 줄 이름 옆 작은 글(흐리지 않아요)
const strip = (label, chips, why = '') => `<div class="bl-lt-row${why ? ' is-off' : ''}" role="group" aria-label="${esc(label)}">${head(label, why)}<div class="bl-lt-chips">${chips}</div></div>`;

// 숫자 조절칸 — 윗줄 이름 · ↺ · 숫자칸 · 단위, 아랫줄 슬라이더. 값을 안 주면 「틀」(틀 그대로)
function numField(kind, f, value, why) {
    const scale = f.scale || 1, set = value != null, id = `${kind}|${f.path}`;
    const box = v => (v == null ? '' : String(Number((v / scale).toFixed(4))));
    return `<div class="bl-lt-num${why ? ' is-off' : ''}" data-lt-f="${esc(id)}" data-scale="${scale}"><header>${head(f.label, why)}${set ? undo(act(kind, f.path, null), f.label) : ''}`
        + `<span class="bl-lt-box"><input type="number" inputmode="decimal" data-lt-i="${esc(id)}|n" min="${f.min / scale}" max="${f.max / scale}" step="${f.step / scale}" placeholder="틀" value="${box(value)}" aria-label="${esc(f.label)}"${why ? ' disabled' : ''}>${f.unit ? `<i>${esc(f.unit)}</i>` : ''}</span></header>`
        + `<input type="range" data-lt-i="${esc(id)}|r" min="${f.min}" max="${f.max}" step="${f.step}" value="${set ? value : f.def}"${set ? '' : ' class="is-unset"'} aria-label="${esc(f.label)}"${why ? ' disabled' : ''}></div>`;
}
// 고르기 — 모양 칸은 첫 값이 기본(틀 그대로) · 글 칸은 앞에 「틀 그대로」 칩
function pickField(kind, f, value, why, { caps = null } = {}) {
    const own = kind === 'shape', now = own ? value ?? f.options[0][0] : value;
    const chips = (own ? '' : chip(act(kind, f.path, null), '틀 그대로', value == null, { off: !!why }))
        + f.options.map(([v, label]) => chip(act(kind, f.path, v), label, now === v, { off: !!why || (f.cap && !!capWhy(caps, f.cap, v)) })).join('');
    return strip(f.label, chips, why);
}
const fontField = (f, value) => strip(f.label, chip(act('look', f.path, null), '틀 그대로', value == null) + FONT_STACKS.map(x => chip(act('look', f.path, x.id), x.label, value === x.id)).join(''));
const colorField = (kind, path, label, value, base = '') => `<span class="bl-lt-inkset"><button type="button" class="bl-lc-chip bl-lt-ink${value ? '' : ' is-unset'}" data-lt-color="${esc(`${kind}|${path}`)}" data-value="${esc(value || base || '')}"${value ? ` style="--ink:${esc(value)}"` : ''}><i aria-hidden="true"></i><span>${esc(label)}</span></button>${value ? undo(act(kind, path, null), label) : ''}</span>`;

const WHEN = {
    marker: L => L.dialogue?.style === 'marker',
    pen: L => L.dialogue?.style === 'marker' && (L.dialogue?.markerShape ?? 'stroke') === 'stroke',
    strikeOwn: L => L.strike?.line === 'own',
    shadow: L => L.shadow?.on === true,
    outline: L => L.outline?.on === true,
};
// 이어진 숫자 칸은 2열 격자로 묶어요(홀수로 남는 마지막 칸만 전체 폭 — CSS)
function layout(parts) {
    let out = '', run = [];
    const flush = () => { if (run.length) out += `<div class="bl-lt-grid">${run.join('')}</div>`; run = []; };
    for (const [isNum, html] of parts) { if (isNum) run.push(html); else { flush(); out += html; } }
    flush();
    return out;
}
function lookFields(tab, f) {
    const L = f.look, parts = [];
    for (const x of LOOK_FIELDS) {
        if (x.tab !== tab || (x.when && !WHEN[x.when]?.(L))) continue;
        const v = get(L, x.path), why = x.cap ? capWhy(f.caps, x.cap) : '';
        if (x.kind === 'range') parts.push([true, numField('look', x.cap && f.caps.title ? { ...x, max: Math.min(x.max, f.caps.title.max) } : x, v, why)]);   // 1.1.5 제목 크기는 그 틀 상한까지(마트와 같게)
        else if (x.kind === 'pick') parts.push([false, pickField('look', x, v, why)]);
        else if (x.kind === 'font') parts.push([false, fontField(x, v)]);
        else if (x.kind === 'color') parts.push([false, `<div class="bl-lt-row" role="group" aria-label="${esc(x.label)}">${head(x.label)}<div class="bl-lt-chips">${colorField('look', x.path, v ? v : '틀 그대로', v, x.def)}</div></div>`]);
        else if (x.kind === 'toggle') parts.push([false, strip(x.label, chip(act('look', x.path, v === true ? null : true), v === true ? '켬' : '끔', v === true))]);
        else if (x.kind === 'targets') parts.push([false, strip(x.label, x.options.map(([k, label]) => chip(act('target', k, null), label, v?.[k] === true)).join(''))]);
    }
    return layout(parts);
}
const shapeFields = (group, f) => layout(SHAPE_FIELDS.filter(x => x.group === group).map((x) => {
    const v = f.shape[x.path], why = x.cap === 'width' || x.cap === 'nameTag' ? capWhy(f.caps, x.cap) : capWhy(f.caps, x.cap, v);
    return x.kind === 'range' ? [true, numField('shape', x.path === 'pad' && f.caps.pad ? { ...x, min: f.caps.pad[0], max: f.caps.pad[1] } : x, v, why)] : [false, pickField('shape', x, v, why, { caps: f.caps })];
}));

function motionBody(f) {
    const m = f.motion, caps = f.caps.motion || {};
    const part = (key, label, none) => {
        const c = caps[key] || {}, any = c[0] || c.s || c.l;
        return strip(label, EASY_MOTION.map(([v, l]) => chip(act('motion', key, v), l, m[key] === v, { off: !any || (v !== 'm' && !c[v]) })).join(''), any ? '' : none);
    };
    const speedWhy = capWhy(f.caps, 'speed'), openWhy = capWhy(f.caps, 'open');
    return part('text', '글 움직임', '이 틀은 글 움직임이 없어요') + part('prop', '소품 움직임', '이 틀은 소품 움직임이 없어요')
        + strip('빠르기', SPEEDS.map(([v, l]) => chip(act('speed', '', v), l, m.speed === v, { off: !!speedWhy })).join(''), speedWhy)
        + strip('처음부터 열어 두기', chip(act('open', '', !m.open), m.open ? '켬' : '끔', m.open, { off: !!openWhy }), openWhy)
        + '<p class="bl-lt-note">「중」은 틀을 만든 세기 그대로예요. 「끔」이면 그 움직임 규칙을 걸지 않아요.</p>';
}
/** 바탕 질감 줄 묶음(간편 · 세밀이 같이 써요) — 걸지 않는 틀이면 빈 글(칸을 통째로 숨겨요) */
export function texRows(tex, texture, mode = 'dark', row = note) {
    if (texture.blocked) return '';
    const paper = mode === 'light' ? '#fbfbfa' : '#1c1e21';   // 견본 네모 바탕 = 붙일 곳 카드 바탕(시트 미리보기와 같은 무채)
    const sw = id => `<i class="bl-lt-sw" aria-hidden="true" style="background-color:${paper};${esc(texSwatch(id, mode))}"></i>`;
    let out = row('바탕 질감', chip(act('tex', 'tex', null), '없음', !tex) + TEX_LIST.map(([id, name]) => chip(act('tex', 'tex', id), name, tex?.tex === id, { lead: sw(id) })).join(''));
    if (!tex) return out;
    const flat = !texture.pane && tex.on === 'b';
    out += row('얹는 곳', TEX_ON.map(([v, l]) => chip(act('tex', 'on', v), l, tex.on === v)).join(''), flat ? '이 틀은 글 칸이 따로 없어서 카드 전체에 얹혀요' : '')
        + row('진하기', TEX_LEVEL.map(([v, l]) => chip(act('tex', 'level', v), l, tex.level === v)).join('') + (tex.tex === 'line' ? `<i class="bl-lt-sep" aria-hidden="true"></i>${chip(act('tex', 'margin', !tex.margin), '빨간 세로줄', !!tex.margin)}` : ''));
    return out;
}
// 간편 줄 꼴(시트의 .bl-lc-easy-row — 줄 이름 왼쪽 · 칩 줄 오른쪽)
const easyRow = (label, chips, small = '') => `<div class="bl-lc-easy-row" role="group" aria-label="${esc(label)}"><span class="bl-lc-easy-h">${esc(label)}${small ? `<small>${esc(small)}</small>` : ''}</span><div class="bl-lc-easy-chips">${chips}</div></div>`;
/**
 * 간편 화면에 더하는 줄 — 색(깡통 · 깡캐 · 소품도 캐릭터 색) · 바탕 질감(고르면 얹는 곳 · 진하기) · 바꾼 것 요약 · 더 조절하기.
 * @returns {{ color: string, texture: string, tail: string, total: number, motion: object|null }} motion: 이 틀이 받는 움직임 세기(세밀 「움직임」 갈래와 같은 능력표 — 간편 움직임 칩도 이걸로 흐려요)
 */
export function easyExtra(set, frame, mode = 'dark', caps = null, { castKnown = true } = {}) {
    const f = fineOf(set, probeOf(frame), frame.key, mode, caps), c = f.cast || {};
    const who = (id, label) => { const v = c[id], hex = v && v !== 'orig' ? v : ''; return `<button type="button" class="bl-lc-chip bl-lt-ink${hex ? '' : ' is-unset'}" data-lt-color="cast|${id}" data-value="${esc(hex)}" aria-pressed="${!!hex}"${hex ? ` style="--ink:${esc(hex)}"` : ''}><i aria-hidden="true"></i><span>${label}</span></button>`; };
    const orig = c.main === 'orig' && c.other === 'orig';
    const color = easyRow('색', chip(act('cast', 'all', null), '인물표 색', !f.cast) + chip(act('cast', 'all', 'orig'), '원래 색', orig) + who('main', '깡통') + who('other', '깡캐')
        + (f.own ? `<i class="bl-lt-sep" aria-hidden="true"></i>${chip(act('cover', '', !f.cover), '소품도 캐릭터 색', f.cover, { off: !castKnown })}` : ''), !f.cast || orig ? (f.own && !castKnown ? COVER_WHY : '') : '직접 색');
    const texture = texRows(f.tex, f.texture, mode, (label, chips, why) => (why ? `${easyRow(label, chips)}<p class="bl-lt-note bl-lc-easy-note">${esc(why)}.</p>` : easyRow(label === '바탕 질감' ? '질감' : label, chips)));
    const words = f.words.slice(0, 5).join(' · ') + (f.words.length > 5 ? ' …' : '');
    const tail = (f.total ? `<div class="bl-lc-easy-sum"><span><b>바꾼 것 ${f.total}</b>${words ? ` · ${esc(words)}` : ''}</span><button type="button" class="bl-lt-undo" data-lt="${act('reset', 'all', null)}" aria-label="바꾼 것 전부 처음으로" title="전부 처음으로"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button></div>` : '')
        + '<button type="button" class="bl-lc-more" data-lc-view="fine"><b>더 조절하기</b><small>색 · 글 · 움직임 · 소품 · 모양</small></button>';
    return { color, texture, tail, total: f.total, motion: f.caps.motion || null };
}
/**
 * 간편 「움직임」 칩 — 마트 간편 줄과 같은 규칙: 「중」은 늘 · 끔 · 약 · 강은 글 · 소품 중 하나라도 그 세기를 받을 때만(못 받는 세기는 흐리게).
 *   11-12 사용자 「누르면 칩만 바뀌고 미리보기는 그대로」 — 심플 28틀 가운데 20틀은 약 · 중 · 강이 똑같이 그려졌어요(받은 세기만 마트 applyMotion 이 입혀요).
 * @param {object|null} caps easyExtra().motion(아직 못 받았으면 null — 다 켜 둬요) @returns {{ can: (v: string) => boolean, note: string }}
 */
export function easyMotion(caps) {
    if (!caps) return { can: () => true, note: '' };
    const has = v => !!(caps.text?.[v] || caps.prop?.[v]);
    const any = ['0', 's', 'l'].some(has), only = has('0') && !has('s') && !has('l');
    return { can: v => v === 'm' || has(v), note: only ? '이 틀은 끔과 중만' : any ? '' : '이 틀은 세기를 못 바꿔요' };
}
/** 11-12 캐릭터 색을 모를 때(인물표 · 화면 대사색 · 고른 화자 색 없음) 「소품도 캐릭터 색」 까닭 — 그땐 소품이 늘 기본 색이라 눌러도 그대로였어요 */
export const COVER_WHY = '캐릭터 색을 알 때만';
function colorBody(f, mode, castKnown = true) {
    const inks = [...PAINT_ROLES.filter(r => !r.cap || !capWhy(f.caps, r.cap)), ...TUNE_ROLES].map(r => colorField('ink', r.role, r.label, f.inks[r.role])).join('');
    return (f.own ? strip('소품도 캐릭터 색', chip(act('cover', '', !f.cover), f.cover ? '켬' : '끔', f.cover, { off: !castKnown }), castKnown ? '' : COVER_WHY) : '')
        + `<div class="bl-lt-row" role="group" aria-label="낱낱 색">${head('낱낱 색', `${mode === 'light' ? '낮' : '밤'} 판에만 기억해요`)}<div class="bl-lt-chips">${inks}</div></div>`
        + shapeFields('color', f);
}

/**
 * 세밀 화면 HTML.
 * @param {object} set 조절 값 @param {{ html: string, key: string }} frame 등록 값
 * @param {{ mode?: 'light'|'dark', open?: Set<string>|string[], tab?: string }} [ui] open: 펼친 갈래 · tab: 「글」 갈래의 고른 칩
 */
export function fineHtml(set, frame, { mode = 'dark', open = [], tab = 'text', caps = null, castKnown = true } = {}) {
    const f = fineOf(set, probeOf(frame), frame.key, mode, caps), opened = new Set(open), level = Object.fromEntries(EASY_MOTION);
    const nowTab = TEXT_TABS.some(([id]) => id === tab) ? tab : 'text';
    const body = {
        color: () => colorBody(f, mode, castKnown),
        text: () => `<div class="bl-lt-chips bl-lt-tabs" role="tablist" aria-label="글 갈래">${TEXT_TABS.map(([id, label]) => `<button type="button" class="bl-lc-chip" role="tab" data-lt-tab="${id}" aria-selected="${id === nowTab}" aria-pressed="${id === nowTab}"><span>${esc(label)}</span></button>`).join('')}</div>${lookFields(nowTab, f)}`,
        motion: () => motionBody(f),
        prop: () => shapeFields('prop', f),
        shape: () => shapeFields('shape', f) + texRows(f.tex, f.texture, mode),
    };
    const sum = { color: '화자 색은 「간편」에서', text: '본문 · 대사 · 이름 · 제목 …', motion: `글 ${level[f.motion.text]} · 소품 ${level[f.motion.prop]}`, prop: f.shape.hideProp ? '숨김' : '보임', shape: f.tex ? `질감 ${TEX_LIST.find(([id]) => id === f.tex.tex)?.[1] ?? ''}` : '카드 · 이름표 · 바탕 질감' };
    const groups = GROUPS.map(([id, label]) => {
        const n = f.count[id], on = opened.has(id);
        return `<details class="bl-lt-g" data-lt-g="${id}"${on ? ' open' : ''}><summary data-lt-sum="${id}"><b>${label}</b><small>${esc(sum[id])}</small>${n ? `<em>바꾼 것 ${n}</em>` : ''}<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>`
            + `<div class="bl-lt-b">${on ? body[id]() : ''}${on && n ? `<button type="button" class="bl-lt-reset" data-lt="${act('reset', id, null)}"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>이 갈래 처음으로</span></button>` : ''}</div></details>`;
    }).join('');
    return `<div class="bl-lt"><div class="bl-lt-top"><span>바꾼 것 <b>${f.total}</b></span><button type="button" class="bl-lt-reset" data-lt="${act('reset', 'all', null)}"${f.total ? '' : ' disabled'}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>전부 처음으로</span></button></div>${groups}</div>`;
}

/**
 * 칸을 누른 것 → 다음 조절 값(모르는 것 · 꼴이 아닌 것은 받은 그대로).
 * @param {object} set @param {string} key 틀 열쇠 @param {string} action 「갈래|칸|JSON 값」 @param {'light'|'dark'} [mode] 낱낱 색을 적을 판
 */
export function fineAct(set, key, action, mode = 'dark') {
    const [kind, path, ...rest] = String(action ?? '').split('|');
    let value = null;
    try { value = JSON.parse(rest.join('|') || 'null'); } catch { return set; }
    switch (kind) {
        case 'look': return withLook(set, path, value);
        case 'shape': return withShape(set, path, value);
        case 'motion': return withMotionPart(set, path, value);
        case 'speed': return withSpeed(set, value);
        case 'open': return withOpen(set, value === true);
        case 'tex': return path === 'tex' && value == null ? withTex(set, null) : ['tex', 'on', 'level', 'margin'].includes(path) ? withTex(set, { [path]: value }) : set;
        case 'ink': return withInk(set, key, mode, path, value);
        case 'cover': return withCover(set, value !== false);
        case 'cast': return path === 'all' ? withCast(withCast(set, 'main', value), 'other', value) : withCast(set, path, value);
        case 'target': { const now = lookOf(set)?.shadow?.targets || {}; const next = { ...now }; if (next[path]) delete next[path]; else next[path] = true; return withLook(set, 'shadow.targets', Object.keys(next).length ? next : null); }
        case 'reset': return resetFine(set, path, key);
        default: return set;
    }
}
/** 숫자칸 · 슬라이더에 적은 값 → fineAct 글(숫자칸은 보이는 단위 · 슬라이더는 저장 단위) — 빈 숫자칸은 틀 그대로 */
export function inputAction(id, scale, type, text) {
    if (type === 'number' && String(text).trim() === '') return `${id}|null`;
    const n = Number(text);
    if (!Number.isFinite(n)) return '';
    return `${id}|${JSON.stringify(type === 'number' ? Number((n * (Number(scale) || 1)).toFixed(4)) : n)}`;
}

/** 세밀 화면 CSS(시트 색 토큰 · 칩은 시트의 .bl-lc-chip 그대로) */
export const FINE_STYLE = `
.bl-lt { display:grid;gap:8px;padding:4px 16px 8px;min-width:0;}
.bl-lt-top { display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--salty-muted);font-size:12px;}
.bl-lt-top b { color:var(--salty-accent-ink, var(--salty-accent));font-weight:700;}
.bl-lt-reset { display:inline-flex;align-items:center;gap:6px;min-height:32px;margin:0;padding:0 10px;border:1px solid var(--salty-line);border-radius:8px;background:transparent;color:var(--salty-text);font:inherit;font-size:12px;cursor:pointer;}
.bl-lt-reset > i { font-size:11px;color:var(--salty-muted);}
.bl-lt-reset:disabled { opacity:.45;cursor:default;}
.bl-lt-g { min-width:0;border:1px solid var(--salty-line);border-radius:12px;background:var(--salty-surface);}
.bl-lt-g > summary { display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;list-style:none;cursor:pointer;-webkit-user-select:none;user-select:none;}
.bl-lt-g > summary::-webkit-details-marker { display:none;}
.bl-lt-g > summary > b { flex:none;font-size:14px;font-weight:700;}
.bl-lt-g > summary > small { flex:1;min-width:0;overflow:hidden;color:var(--salty-muted);font-size:12px;text-overflow:ellipsis;white-space:nowrap;}
.bl-lt-g > summary > em { flex:none;padding:2px 8px;border-radius:999px;background:var(--salty-accent-10, var(--salty-raised));color:var(--salty-accent-ink, var(--salty-accent));font-size:11px;font-style:normal;font-weight:650;}
.bl-lt-g > summary > i { flex:none;color:var(--salty-muted);font-size:11px;}
.bl-lt-g[open] > summary > i { transform:rotate(180deg);}
.bl-lt-g > summary:focus-visible { outline:1px solid var(--salty-accent);outline-offset:-1px;border-radius:12px;}
.bl-lt-b { display:grid;gap:10px;min-width:0;padding:2px 12px 12px;}
.bl-lt-g:not([open]) > .bl-lt-b { display:none;}
.bl-lt-b > .bl-lt-reset { justify-self:end;}
.bl-lt-row { display:grid;gap:4px;min-width:0;}
.bl-lt-h { display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 6px;min-width:0;color:var(--salty-text);font-size:12px;font-weight:650;line-height:1.3;}
.bl-lt-h > small { color:var(--salty-muted);font-size:11px;font-weight:400;}
.bl-lt-chips { display:flex;align-items:center;gap:6px;min-width:0;margin:0 -12px;padding:2px 12px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}
.bl-lt-chips::-webkit-scrollbar { display:none;}
.bl-lt-row.is-off > .bl-lt-chips, .bl-lt-num.is-off > input[type="range"], .bl-lt-num.is-off .bl-lt-box { opacity:.45;}
.bl-lt-note { margin:0;color:var(--salty-muted);font-size:11px;line-height:1.45;}
.bl-lt-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px 12px; min-width:0; }
.bl-lt-grid > .bl-lt-num:last-child:nth-child(odd) { grid-column:1 / -1; }
.bl-lt-num { display:grid; gap:2px; min-width:0; }
.bl-lt-num > header { display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;min-width:0;min-height:30px;}   /* 자리가 모자라면(320 · 큰 글씨) 숫자칸만 다음 줄로 — 글자는 줄이지 않아요 */
.bl-lt-num > header > .bl-lt-h { flex:1 1 auto;word-break:keep-all;}
.bl-lt-box { flex:none;display:inline-flex;align-items:center;gap:3px;margin-left:auto;color:var(--salty-muted);font-size:11px;}
.bl-lt-box > input { box-sizing:border-box;width:46px;height:28px;margin:0;padding:0 4px;border:1px solid var(--salty-line);border-radius:7px;background:transparent;color:var(--salty-text);font:inherit;font-size:12px;text-align:center;-moz-appearance:textfield;appearance:textfield;}
.bl-lt-box > input::-webkit-outer-spin-button, .bl-lt-box > input::-webkit-inner-spin-button { -webkit-appearance:none;margin:0;}
.bl-lt-box > input::placeholder { color:var(--salty-muted);}
.bl-lt-box > i { font-style:normal;}
.bl-lt-num > input[type="range"] { box-sizing:border-box;width:100%;min-width:0;height:28px;margin:0;accent-color:var(--salty-accent);}
.bl-lt-num > input[type="range"].is-unset { opacity:.55;}
.bl-lt-undo { flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:var(--salty-accent-ink, var(--salty-accent));font-size:11px;cursor:pointer;}
.bl-lt-undo:focus-visible, .bl-lt-reset:focus-visible, .bl-lt-box > input:focus-visible { outline:1px solid var(--salty-accent);outline-offset:1px;}
.bl-lt-inkset { flex:none;display:inline-flex;align-items:center;gap:2px;}
.bl-lt-ink > i { width:14px;height:14px;border-radius:50%;background:var(--ink, transparent);box-shadow:inset 0 0 0 1px var(--salty-line);}
.bl-lt-ink.is-unset > i { background:repeating-linear-gradient(45deg, transparent 0 3px, var(--salty-line) 3px 4px);}
.bl-lt-sw { flex:none;width:18px;height:18px;border-radius:5px;background-color:var(--bl-lt-paper, #fbfbfa);box-shadow:inset 0 0 0 1px var(--salty-line);}
.bl-lt-tabs { padding-bottom:4px;}
.bl-lt-sep { flex:none;width:1px;height:18px;background:var(--salty-line);}
.bl-lc-easy-note { margin:0 16px 2px 72px;}
.bl-lc-view { display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:4px 16px 2px;padding:4px;border-radius:12px;background:var(--salty-raised, var(--salty-surface));}
.bl-lc-view > button { min-height:36px;margin:0;padding:0 8px;border:0;border-radius:9px;background:transparent;color:var(--salty-muted);font:inherit;font-size:13px;font-weight:650;cursor:pointer;}
.bl-lc-view > button[aria-pressed="true"] { background:var(--salty-surface);color:var(--salty-text);box-shadow:0 1px 3px rgba(0, 0, 0, .18);}
.bl-lc-view > button > b { margin-left:4px;color:var(--salty-accent-ink, var(--salty-accent));font-weight:700;}
.bl-lc-view > button:focus-visible, .bl-lc-more:focus-visible { outline:1px solid var(--salty-accent);outline-offset:1px;}
.bl-lc-easy-sum { display:flex;align-items:center;gap:8px;margin:6px 16px 0;padding:8px 8px 8px 12px;border-radius:10px;background:var(--salty-accent-10, var(--salty-raised));color:var(--salty-text);font-size:12px;line-height:1.45;}
.bl-lc-easy-sum > span { flex:1;min-width:0;}
.bl-lc-easy-sum b { color:var(--salty-accent-ink, var(--salty-accent));}
.bl-lc-more { display:flex;align-items:baseline;justify-content:center;flex-wrap:wrap;gap:2px 8px;box-sizing:border-box;width:calc(100% - 32px);min-height:44px;margin:8px 16px 4px;padding:6px 12px;border:1px solid var(--salty-line);border-radius:12px;background:transparent;color:var(--salty-text);font:inherit;cursor:pointer;}
.bl-lc-more > b { font-size:14px;}
.bl-lc-more > small { color:var(--salty-muted);font-size:12px;}
@media (pointer: coarse) { .bl-lt-undo { position:relative;} .bl-lt-undo::before { content:'';position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%, -50%);} .bl-lt-box > input { height:32px;} }
`;
