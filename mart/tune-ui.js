// 11-11 글꾸 마트 크게 보기 창의 「조절」 칸 — 블루레몬에이드 테마 「글자」 탭의 축소판(사용자 「블루레몬축소판을 글꾸마트에넣는다고생각해」).
//   묶음 칩: 색 · 본문 · 대사 · 문단 · 그림자 · 외곽선(테마 글자 탭 순서에서 깡통 글에 살아남는 것만) — 칸 이름 · 범위 · 단계는 look.js LOOK_FIELDS(테마와 같은 키).
//   「색」: 색 칩(깡통 · 깡캐 · 소품 · 제목 · 본문 · 대사) · 밤/낮 · 소품 기본 색/캐릭터 색. 바꾼 칸에만 ↺(그 칸만 「틀 그대로」).
//   「글 고치기」: 켠 동안 미리보기의 글자를 바로 고쳐 써요. 「내 프리셋」(틀과 따로 — 색 + 글 모양) · 「내 글꾸」(틀 + 고쳐 쓴 글까지).
//   값: 틀마다 = tune.js · 글 모양(모든 틀) = look.js · 깡통 · 깡캐 · 밤낮 = tone-state.js. 고친 것은 카드 미리보기 · 「HTML 복사」에 같은 길(toneOut)로 들어가요.
import { toneState, setTone, ownOf } from './tone-state.js?v=20261113a';
import { speakerPair, hasPropTone, hasOwnTone, simpleFrameInfo } from './simple-frames.js?v=20261112b';
import { fieldsOf, valsHtml, valOk } from './custom.js?v=20261112e';
import { LOOKS, sameLook } from './looks.js?v=20261112a';   // 11-12 간편 — 추천 스타일 여섯 벌
import { motionNow, setMotion, motionCaps, MOTION_LEVELS, SPEEDS } from './motion-state.js?v=20261112a';   // 11-12 빠르기 · 열어 두기
import { SHAPE_FIELDS, PAINT_ROLES, shapeNow, shapeValue, setShape, setShapeValue, shapeInfo } from './shape.js?v=20261112a';   // 11-12 모양 · 색 더하기
import { capsOf, capWhy } from './caps.js?v=20261112a';
import { makeSet, readSet, encodeSet, readAny, setFile, SET_EXT } from './geulkku-set.js?v=20261112e';   // 11-12 설정 파일 .bl-geulkku.json · 코드 BLG1.   // 11-12 틀 능력표 — 못 받는 칸은 흐리게 + 까닭 한 줄   // 11-12 움직임 세기
import { texNow, setTex, texInfo, TEX_ORDER, TEX_NAMES } from './texture.js?v=20261112a';   // 11-12 바탕 질감
import { swapSpeakers, dayNightHtml } from './cast.js?v=20261113u';
import { castPicked } from './tone-state.js?v=20261113a';   // 11-11 「이 틀」 값 칸
import { TUNE_ROLES, EDIT_CLASSES, EDIT_TAGS, RICH_TAGS, cleanRich, LINES_RANGE, titleInPress, tuneOf, setTune, editables, mineList, saveMine, forgetMine, setsFile, readSets, addSets } from './tune.js?v=20261112f';
import { createEditBlocks } from './edit-blocks.js?v=20261112e';   // 11-12 글 고치기 공용 편집 모듈(테마 로그 복사 창도 같이)
import { wordsNow, setWords, hiddenNames, MASKS, MAX_NAMES, MAX_RULES } from './words.js?v=20261112a';
import { mineOn, mineInfo, applyMine, storyOf } from './mine-text.js?v=20261112f';
import { LOOK_FIELDS, LOOK_TABS, FONT_STACKS, lookNow, lookValue, setLook, setLookValue, presetList, presetLast, markPreset, savePreset, renamePreset, forgetPreset, exportPreset, importPreset, codeBytes } from './look.js?v=20261112a';
import { WRAP_MODES } from './word-wrap.js?v=20261113q';   // 11-13 본문 줄바꿈(글자 단위 기본 · 단어 단위)
import { wrapState, setWrap } from './wrap-state.js?v=20261113q';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const HEX = /^#[0-9a-f]{6}$/i;
const NEUTRAL = '#8b8e96';
const hexOf = (rgb) => { const m = String(rgb || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/); return m ? '#' + m.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('') : null; };
const clone = t => JSON.parse(JSON.stringify(t || {}));
let editing = false;   // 「글 고치기」 켬 — 켜 둔 동안만 미리보기 글자를 고쳐 쓸 수 있어요(꺼져 있으면 소품 누르기 그대로)
let valPending = {}, valTimer = 0;   // 11-11 「이 틀」 값 칸 묶어 저장
let tab = 'color';     // 펼친 묶음

// ── 가로로 미는 칩 줄(.mart-hscroll) — 테마 설정 창의 칩 줄(panel.js fadeTags · showTag)과 같은 식 ──
const FADE = 28;
/** 넘치는 쪽만, 남은 거리만큼 흐려요(넘치지 않으면 흐림 없음) */
export function fadeRow(row) {
    const rest = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.classList.toggle('over', row.scrollWidth > row.clientWidth + 1);
    row.style.setProperty('--fade-l', `${Math.max(0, Math.min(FADE, row.scrollLeft))}px`);
    row.style.setProperty('--fade-r', `${Math.max(0, Math.min(FADE, rest))}px`);
}
/** 고른 칩이 줄 밖이나 흐린 끝에 있으면 보이게 옮겨요 */
export function showOn(row) {
    if (!row.clientWidth) return;
    const on = row.querySelector('[aria-pressed="true"], [aria-current="true"]');
    if (on) { const left = on.offsetLeft - row.offsetLeft; row.scrollLeft = Math.min(Math.max(row.scrollLeft, left + on.offsetWidth + FADE - row.clientWidth), Math.max(0, left - FADE)); }
    fadeRow(row);
}
/** 그 안의 칩 줄 전부: 흐림을 맞추고(show 면 고른 칩도 보이게) */
export function tidyRows(root, show = false) { for (const row of root?.querySelectorAll('.mart-hscroll') || []) (show ? showOn : fadeRow)(row); }

/** 11-12 셋째 화자 칸을 보일 때 — 내 글이 켜져 있고 화자가 셋 이상(이름 없는 그냥 글은 둘로 번갈아서 빼요) */
const thirdOn = () => { const m = mineOn() && mineInfo(); return !!m && !m.generic && (m.names || []).length >= 3; };
/** 셋째 화자를 이 틀이 어떻게 받는지 — 'none' 내 글이 안 들어가는 틀 · 'band' 대사 띠를 그림으로 그어 띠 색은 깡캐 그대로 · '' 다 받음 */
function thirdSeat(item) {
    const html = item.preview || '';
    if (!storyOf(html)) return 'none';
    const info = simpleFrameInfo(html);
    return info?.imageBand ? 'band' : '';
}
/** 그 틀에 보일 색 칩 목록 — [{ key, label, title }] (틀에 있는 것만 · 틀이 못 받는 칸은 안 보여요) */
function chipsOf(item) {
    const html = item.preview || '';
    const out = [{ key: 'k', label: '깡통', title: '깡통(첫째 화자) 색 — 목록 위 「깡통」 칸과 같은 값이에요' }, { key: 'k2', label: '깡캐', title: '깡캐(둘째 화자) 색 — 목록 위 「깡캐」 칸과 같은 값이에요' }];
    if (thirdOn()) out.push({ key: 'k3', label: '셋째', title: '셋째 화자부터 색 — 내 글에 화자가 셋 이상일 때만 · 안 고르면 깡캐 모습 그대로예요' });
    if (hasPropTone(html)) out.push({ key: 'prop', label: '소품', title: '소품 색 — 안 고르면 깡통 색을 따라가요' });
    for (const r of TUNE_ROLES) if (new RegExp(`class="(?:[^"]*\\s)?${r.cls}(?:\\s[^"]*)?"`).test(html)) out.push({ key: r.role, label: r.label, title: `${r.label} 글자색 — 밤 · 낮 판마다 따로 기억해요` });
    const caps = capsOf(item);
    for (const p of PAINT_ROLES) { const why = capWhy(caps, p.cap); out.push({ key: p.role, label: p.label, title: why || `${p.label} 색 — 밤 · 낮 판마다 따로 기억해요`, why }); }
    return out;
}
/** 색 칩의 지금 값 — { 칸: { value(보일 색), changed } } · previewRoot: 크게 보기 미리보기(글자색 원래 값을 화면에서 읽어요) */
function valuesOf(item, previewRoot) {
    const t = tuneOf(item.id), pair = speakerPair(item.preview || ''), mode = toneState.mode;
    const k = toneState.on ? (toneState.k || NEUTRAL) : (pair.main || NEUTRAL);
    const out = { k: { value: k, changed: toneState.on }, k2: { value: toneState.k2 || pair.other || NEUTRAL, changed: !!toneState.k2 }, k3: { value: toneState.k3 || toneState.k2 || pair.other || NEUTRAL, changed: !!toneState.k3 }, prop: { value: t?.prop || k, changed: !!t?.prop } };
    for (const r of TUNE_ROLES) {
        const own = t?.inks?.[mode]?.[r.role];
        const el = previewRoot?.querySelector(`.gk ${r.sel}`);
        out[r.role] = { value: own || (el && hexOf(getComputedStyle(el).color)) || NEUTRAL, changed: !!own };
    }
    const sp = shapeInfo(item.preview || '')?.speakers || [];
    for (const p of PAINT_ROLES) {
        const own = t?.inks?.[mode]?.[p.role], X = p.role === 'bandMain' ? sp[0] : sp.find(x => x !== sp[0]);
        const el = p.role === 'card' ? previewRoot?.querySelector('.gk') : p.role === 'underline' ? previewRoot?.querySelector('.gk .gk-ul') : X ? previewRoot?.querySelector(`.gk .gk-d${X}`) : null;
        out[p.role] = { value: own || (el && hexOf(getComputedStyle(el).backgroundColor)) || NEUTRAL, changed: !!own };
    }
    return out;
}
/** 숫자칸에 보일 글자(자간은 테마처럼 em 으로) · 값이 없으면 빈칸(자리 글자 「틀」 = 틀 그대로) */
const numText = (f, v) => (v == null ? '' : String(f.scale ? Number((v / f.scale).toFixed(2)) : Number(Number(v).toFixed(2))));
const fillOf = (f, v) => `${Number((((v ?? f.def) - f.min) / (f.max - f.min) * 100).toFixed(1))}%`;
const WHEN = { marker: () => lookValue('dialogue.style') === 'marker', pen: () => lookValue('dialogue.style') === 'marker' && (lookValue('dialogue.markerShape') ?? 'stroke') === 'stroke', shadow: () => lookValue('shadow.on') === true, outline: () => lookValue('outline.on') === true, strikeOwn: () => lookValue('strike.line') === 'own' };
const whenOk = (f) => !f.when || WHEN[f.when]?.() === true;
const undoBtn = (attr, key, label) => `<button type="button" class="mart-tune-undo" ${attr}="${key}" title="${esc(label)} · 틀 그대로" aria-label="${esc(label)} · 틀 그대로" hidden>↺</button>`;

/** 글 모양 한 칸 */
function fieldHtml(f) {
    const p = esc(f.path), lab = `<span class="mart-look-label">${esc(f.label)}</span>`;
    const when = f.when ? ` data-when="${f.when}"` : '';
    const dis = f.dim ? ' disabled' : '', dimCls = f.dim ? ' is-dim' : '', dimTitle = f.dim ? ` title="${esc(f.dim)}"` : '';
    if (f.kind === 'range') return `<div class="mart-param${f.wide ? ' is-wide' : ''}${dimCls}"${dimTitle}><header><span class="mart-param-name">${esc(f.label)}</span>${undoBtn('data-look-reset', p, f.label)}<span class="mart-num"><input type="number" step="any" inputmode="decimal" data-look-num="${p}" placeholder="틀" aria-label="${esc(f.label)} 숫자"${dis}><i class="mart-unit">${esc(f.unit || '')}</i></span></header><input type="range" data-look="${p}" min="${f.min}" max="${f.max}" step="${f.step}" value="${Math.min(f.def, f.max)}" style="--fill:${fillOf(f, null)}" aria-label="${esc(f.label)}"${dis}></div>`;
    if (f.kind === 'pick') return `<div class="mart-look-row is-wrap"${when}>${lab}<span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}"><button type="button" class="chip" data-look-pick="${p}" data-v="null" aria-pressed="true">틀 그대로</button>${f.options.map(([id, l]) => `<button type="button" class="chip" data-look-pick="${p}" data-v="${esc(JSON.stringify(id))}" aria-pressed="false">${esc(l)}</button>`).join('')}</span></div>`;
    if (f.kind === 'font') return `<div class="mart-look-row is-wrap"${when}>${lab}<span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}"><button type="button" class="chip" data-look-pick="${p}" data-v="null" aria-pressed="true">틀 그대로</button>${FONT_STACKS.map(s => `<button type="button" class="chip" data-look-pick="${p}" data-v="${esc(JSON.stringify(s.id))}" aria-pressed="false">${esc(s.label)}</button>`).join('')}</span></div><p class="mart-tune-hint">깡통 글에서는 기기 글꼴만 먹어요 · 읽는 사람 기기에 없는 글꼴은 기본 글꼴로 보여요</p>`;
    if (f.kind === 'toggle') return `<div class="mart-look-row"${when}>${lab}<button type="button" class="chip" data-look-toggle="${p}" aria-pressed="false">켬</button></div>`;
    if (f.kind === 'targets') return `<div class="mart-look-row is-wrap"${when}>${lab}<span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}">${f.options.map(([id, l]) => `<button type="button" class="chip" data-look-target="${id}" aria-pressed="false">${esc(l)}</button>`).join('')}</span></div>`;
    if (f.kind === 'color') return `<div class="mart-look-row"${when}>${lab}<label class="mart-ink" title="${esc(f.label)} 바꾸기"><input type="color" data-look-color="${p}" value="${f.def}" aria-label="${esc(f.label)}"><span class="mart-ink-dot" style="background-color:${f.def}" aria-hidden="true"></span>${esc(f.label)}</label>${undoBtn('data-look-reset', p, f.label)}</div>`;   // 11-11 점검 6 — 색 칸도 칸별 ↺
    return '';
}
/** 11-12 모양 칸 하나(shape.js SHAPE_FIELDS) — 그 틀이 못 받으면 흐리게 · 고르기 칩은 못 받는 값만 흐리게 */
const SHAPE_DEF = { width: 640, noBorder: false, nameTag: 'plain', nameAlign: 'left', hideUl: false, hideProp: false };
function shapeFieldHtml(f, caps, wide = false) {
    const why = capWhy(caps, f.cap), dis = why ? ' disabled' : '';
    if (f.kind === 'range') {
        const lim = f.path === 'pad' && caps?.pad ? { min: caps.pad[0], max: caps.pad[1] } : { min: f.min, max: f.max }, g = { ...f, ...lim };
        return `<div class="mart-param${wide ? ' is-wide' : ''}${why ? ' is-dim' : ''}"${why ? ` title="${esc(why)}"` : ''}><header><span class="mart-param-name">${esc(f.label)}</span>${undoBtn('data-shape-reset', f.path, f.label)}<span class="mart-num"><input type="number" step="any" inputmode="decimal" data-shape-num="${f.path}" placeholder="틀" aria-label="${esc(f.label)} 숫자"${dis}><i class="mart-unit">${esc(f.unit || '')}</i></span></header><input type="range" data-shape="${f.path}" min="${lim.min}" max="${lim.max}" step="${f.step}" value="${Math.min(lim.max, Math.max(lim.min, f.def))}" style="--fill:${fillOf(g, null)}" aria-label="${esc(f.label)}"${dis}></div>`;
    }
    const off = v => !!why || (f.path === 'width' && v !== 640 && !(caps?.width || []).includes(v)) || (f.path === 'nameTag' && v !== 'plain' && !(caps?.nameTag || []).includes(v));
    return `<div class="mart-look-row is-wrap${why ? ' is-dim' : ''}"><span class="mart-look-label">${esc(f.label)}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${esc(f.label)}">${f.options.map(([v, l]) => `<button type="button" class="chip" data-shape-pick="${f.path}" data-v="${esc(JSON.stringify(v))}" aria-pressed="${(shapeValue(f.path) ?? SHAPE_DEF[f.path]) === v}"${off(v) ? ' disabled' : ''}>${esc(l)}</button>`).join('')}</span></div>`;
}
/** 모양 칸 여럿(이어진 숫자 칸은 2열 · 홀수면 마지막만 전체 폭) + 못 받는 칸 까닭(겹치면 한 번) */
function shapeBlock(paths, caps, sub = '', skip = null) {
    const fields = paths.map(p => SHAPE_FIELDS.find(x => x.path === p)).filter(Boolean), html = [], whys = [];
    for (let i = 0; i < fields.length; i++) {
        if (fields[i].kind !== 'range') { html.push(shapeFieldHtml(fields[i], caps)); continue; }
        let j = i; while (j < fields.length && fields[j].kind === 'range') j++;
        for (let k = i; k < j; k++) html.push(shapeFieldHtml(fields[k], caps, (j - i) % 2 === 1 && k === j - 1));
        i = j - 1;
    }
    for (const x of fields) { const w = capWhy(caps, x.cap); if (w && !whys.includes(w) && !skip?.has(w)) whys.push(w); }
    const widthWhy = fields.some(x => x.path === 'width') && caps?.width && caps.width.length < 3 && !capWhy(caps, 'width') ? '흐린 폭은 이 틀에서 글이 넘쳐요' : '';
    return `<div class="mart-look">${sub ? `<p class="mart-sub">${esc(sub)}</p>` : ''}${html.join('')}${[...whys, widthWhy].filter(Boolean).map(w => `<p class="mart-tune-hint">흐린 칸 — ${esc(w)}</p>`).join('')}</div>`;
}
/** 「머리」 묶음(테마 머리 칸 글칸 · 보일 것) — 제목 · 숨은 한 줄 글칸(글 고치기와 같은 자리) · 제목 · 이름 줄 켬끔 */
const headSlots = item => { const eds = editables(applyMine(item.preview)); return { title: eds.find(e => e.cls === 'gk-tt'), hl: eds.find(e => e.cls === 'gk-hl') }; };
const plainOf = h => String(h ?? '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** 11-11 레몬 바로가기 달기 · 빼기(테마 로그 복사 「레몬 바로가기」 꼴) — 모든 틀 공통 · 글 모양과 같이 기억 · 내 프리셋에도 */
const lemonRow = () => { const off = lookValue('lemon.off') === true; return `<div class="mart-look-row is-wrap"><span class="mart-look-label">레몬 바로가기</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="레몬 바로가기 — 모든 틀에"><button type="button" class="chip" data-lemon="1" aria-pressed="${!off}" title="틀 머리에 작은 레몬 — 누르면 블루레몬에이드 소개 글">달기</button><button type="button" class="chip" data-lemon="0" aria-pressed="${off}" title="레몬 링크를 빼고 제목을 위로 붙여요">빼기</button></span></div>`; };
function headBody(item) {
    const t = tuneOf(item.id) || {}, key = mineOn() ? 'mineTexts' : 'texts', slots = headSlots(item);
    const val = s => (s ? plainOf(t[key]?.[s.i] ?? s.text) : '');
    const inp = (id, label, s) => s ? `<div class="mart-look-row is-wrap"><span class="mart-look-label">${label}</span><label class="field-wrap mart-head-field"><input type="text" class="field" data-head="${id}" maxlength="200" value="${esc(val(s))}" aria-label="${label}"></label></div>` : '';
    const chip = (path, label, on) => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${label}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${label}"><button type="button" class="chip" data-head-show="${path}" data-v="1" aria-pressed="${!on}">보임</button><button type="button" class="chip" data-head-show="${path}" data-v="0" aria-pressed="${on}">숨김</button></span></div>`;
    return `<div class="mart-look">${inp('title', '제목', slots.title)}${inp('hl', '숨은 한 줄', slots.hl)}${titleInPress(item.preview) ? '' : chip('hideTitle', '보일 것 · 제목', !!t.hideTitle)}${chip('hideNames', '보일 것 · 이름 줄', !!t.hideNames)}${lemonRow()}<p class="mart-tune-hint">${titleInPress(item.preview) ? '이 틀은 제목 줄을 눌러 소품을 열어서 제목은 끌 수 없어요 · ' : ''}여기서 고친 글은 「글 고치기」와 같은 자리예요</p></div>`;
}
/** 「도구」 묶음(테마 drawTools 꼴) — 이름 숨김(가릴 이름 · 더하기 · 가림 꼴) · 단어 바꾸기(찾을 말 → 바꿀 말) · 모든 틀에 같이 */
function toolsBody() {
    const w = wordsNow(), auto = mineOn() ? mineInfo()?.names || [] : ['깡통', '깡캐'], all = [...new Set([...auto, ...w.names])];
    const seg = (label, inner) => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${label}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${label}">${inner}</span></div>`;
    const nameChips = all.map(n => `<span class="mart-tune-chip"><button type="button" class="chip" data-words-name="${esc(n)}" aria-pressed="${!w.off.includes(n)}">${esc(n)}</button>${w.names.includes(n) && !auto.includes(n) ? `<button type="button" class="mart-cast-x" data-words-forget="${esc(n)}" aria-label="${esc(n)} 빼기" title="빼기">×</button>` : ''}</span>`).join('');
    const rules = w.rules.map((r, i) => `<li><span>${esc(r.from)}</span><span aria-hidden="true">→</span><span>${esc(r.to) || '(지움)'}</span><button type="button" class="mart-cast-x" data-words-rule-x="${i}" aria-label="${esc(r.from)} 바꾸기 빼기" title="빼기">×</button></li>`).join('');
    return `<div class="mart-look">${seg('이름 숨김', `<button type="button" class="chip" data-words-hide="0" aria-pressed="${!w.hide}">끔</button><button type="button" class="chip" data-words-hide="1" aria-pressed="${w.hide}">켬</button>`)}
        ${w.hide ? `${seg('가릴 이름', nameChips || '<span class="mart-tune-hint">이름이 없어요</span>')}
        <form class="mart-tune-form mart-words-form" data-form="words-name"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="24" placeholder="가릴 이름 더하기" aria-label="가릴 이름"></label><button type="submit" class="btn">더하기</button></form>
        ${seg('가림 꼴', MASKS.map(([id, l]) => `<button type="button" class="chip" data-words-mask="${id}" aria-pressed="${w.mask === id}">${l}</button>`).join(''))}
        ${w.mask === 'word' ? `<div class="mart-look-row is-wrap"><span class="mart-look-label">가림 글자</span><label class="field-wrap mart-head-field"><input type="text" class="field" data-words-word maxlength="8" value="${esc(w.word)}" aria-label="가림 글자"></label></div>` : ''}` : ''}
        <div class="mart-look-row is-wrap"><span class="mart-look-label">단어 바꾸기</span><span class="mart-tune-hint">찾을 말 → 바꿀 말 · 조사는 받침에 맞춰요 · 모든 틀에</span></div>
        ${rules ? `<ul class="mart-words-rules">${rules}</ul>` : ''}
        <form class="mart-tune-form mart-words-form" data-form="words-rule"><label class="field-wrap"><input type="text" class="field" name="from" maxlength="40" placeholder="찾을 말" aria-label="찾을 말"></label><label class="field-wrap"><input type="text" class="field" name="to" maxlength="40" placeholder="바꿀 말" aria-label="바꿀 말"></label><button type="submit" class="btn">더하기</button></form></div>`;
}
function tabBody(item) {
    if (tab === 'head') return headBody(item);
    if (tab === 'tools') return toolsBody();
    if (tab === 'motion') return motionBody(item);
    if (tab === 'texture') return textureBody(item);
    if (tab === 'vals' && !fieldsOf(item.preview).length) tab = 'color';   // 값 칸이 없는 틀로 넘어오면 「색」으로
    if (tab === 'vals') return valsHtml(fieldsOf(item.preview), tuneOf(item.id)?.vals || {});
    if (tab === 'color') {
        const list = chipsOf(item).filter(c => !(noProp && c.key === 'prop'));
        const chips = list.map(c => `<span class="mart-tune-chip${c.why ? ' is-dim' : ''}"><label class="mart-ink" title="${esc(c.title)}"><input type="color" data-tune="${c.key}" value="${NEUTRAL}" aria-label="${esc(c.label)} 색"${c.why ? ' disabled' : ''}><span class="mart-ink-dot" aria-hidden="true"></span>${esc(c.label)}</label>${undoBtn('data-tune-reset', c.key, c.label)}</span>`).join('');
        const byWhy = new Map(); for (const c of list) if (c.why) byWhy.set(c.why, [...(byWhy.get(c.why) || []), c.label]);
        const dimWhy = [...byWhy].map(([w, ls]) => `${ls.join(' · ')}: ${w}`);
        const seat = thirdOn() ? thirdSeat(item) : '';
        const hint3 = seat === 'none' ? '<p class="mart-tune-hint">이 틀은 내 글을 넣을 자리를 몰라서 셋째 화자 색이 안 보여요 · 견본 글 그대로예요</p>' : seat === 'band' ? '<p class="mart-tune-hint">이 틀은 대사 띠를 그림으로 그어서 셋째 화자는 이름 · 글자 색만 바뀌고 띠는 깡캐 색이에요</p>' : '';
        return `<div class="mart-inks mart-tune-colors mart-hscroll" role="group" aria-label="색 — 눌러서 바꿔요">${chips}</div>${hint3}${dimWhy.length ? `<p class="mart-tune-hint">흐린 칸 — ${esc(dimWhy.join(' · '))}</p>` : ''}
            <div class="mart-tune-line mart-hscroll"><span class="mart-seg" role="group" aria-label="밝기">${dayNightHtml('data-tune-mode', '')}<button type="button" class="chip" data-tune-mode="auto" aria-pressed="false" title="이 기기 밝기를 따라요(나가는 글은 그때 판 하나)">자동</button>${flipChip(item)}</span>${flipNoteHtml(item)}${hasOwnTone(item.preview) && !noProp ? '<span class="mart-seg mart-tune-own" role="group" aria-label="소품 색"><button type="button" class="chip" data-tune-own="1" aria-pressed="true">소품 기본 색</button><button type="button" class="chip" data-tune-own="0" aria-pressed="false">소품 캐릭터 색</button></span>' : ''}</div>${noProp ? shapeBlock(['bandAlpha', 'borderAlpha'], capsOf(item), '', new Set(byWhy.keys())) : ''}`;
    }
    const caps = capsOf(item), capped = f => (f.cap !== 'title' ? f : caps?.title ? { ...f, max: Math.min(f.max, caps.title.max) } : { ...f, dim: capWhy(caps, 'title') });
    const fields = LOOK_FIELDS.filter(f => f.tab === tab && whenOk(f)).map(capped), html = [];
    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (f.kind !== 'range') { html.push(fieldHtml(f)); continue; }
        let j = i; while (j < fields.length && fields[j].kind === 'range') j++;   // 이어진 슬라이더 칸 한 묶음(i ~ j-1)
        for (let k = i; k < j; k++) html.push(fieldHtml({ ...fields[k], wide: (j - i) % 2 === 1 && k === j - 1 }));
        i = j - 1;
    }
    // 대사 줄 늘리기 · 줄이기(이 틀 하나 · 견본 글일 때만 — 내 글은 글이 정해요)
    if (false) html.push(`<div class="mart-look-row is-wrap"><span class="mart-look-label">대사 줄</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="대사 줄">${[[-1, '하나 줄이기'], [0, '견본 그대로'], [1, '하나 더'], [2, '둘 더']].filter(([n]) => n >= LINES_RANGE[0] && n <= LINES_RANGE[1]).map(([n, l]) => `<button type="button" class="chip" data-tune-lines="${n}" aria-pressed="${(tuneOf(item.id)?.lines || 0) === n}">${l}</button>`).join('')}</span></div>`);
    if (tab === 'para') html.push(`<div class="mart-look-row is-wrap"><span class="mart-look-label">줄바꿈</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="줄바꿈">${wrapChips()}</span></div>`);   // 11-13 모든 틀에 같이(바꾼 것 수에는 안 세요 · 밤낮처럼)
    const tWhy = fields.find(f => f.dim)?.dim;
    return `<div class="mart-look">${html.join('')}${tWhy ? `<p class="mart-tune-hint">흐린 칸 — ${esc(tWhy)}</p>` : ''}</div>`;
}

/** 조절 칸(미리보기 위) — 묶음 칩 + 펼친 묶음의 칸 + 글 고치기 · 전부 처음으로 */
// ── 11-12 「간편 | 세밀」(설계 지시-1111/글꾸-조절-설계/설계.md 4-2 · 4-5) — 같은 값을 보는 두 화면 · 마지막에 본 쪽을 기억 · 처음은 간편 ──
const VIEW_KEY = 'bl-mart-geulkku-view-v1';
let view = (() => { try { return localStorage.getItem(VIEW_KEY) === 'detail' ? 'detail' : 'simple'; } catch { return 'simple'; } })();
const setView = (v) => { view = v === 'detail' ? 'detail' : 'simple'; try { localStorage.setItem(VIEW_KEY, view === 'detail' ? 'detail' : ''); } catch { /* 이번 화면에서만 */ } };
const SIZE_STEPS = [[-1, '작게'], [0, '보통'], [2, '크게']];
const MOTION_LABEL = Object.fromEntries(MOTION_LEVELS), SPEED_LABEL = Object.fromEntries(SPEEDS);
const lookNoStep = () => { const L = clone(lookNow()); if (L.type) { delete L.type.sizeStep; if (!Object.keys(L.type).length) delete L.type; } delete L.lemon; return Object.keys(L).length ? L : null; };
const stepOf = l => l?.type?.sizeStep || 0;
/** 지금 값과 똑같은 추천 스타일(없으면 null — 「직접 조절」) · 글 크기(sizeStep)는 「큼직하게」만 따져요 */
function styleNow() {
    const L = lookNoStep(), m = motionNow(), step = stepOf(lookNow());
    return LOOKS.find((x) => {
        const xl = clone(x.look), xs = xl.type?.sizeStep;
        if (xl.type) { delete xl.type.sizeStep; if (!Object.keys(xl.type).length) delete xl.type; }
        return sameLook(Object.keys(xl).length ? xl : null, L) && sameLook(x.shape || null, shapeNow()) && x.motion.text === m.text && x.motion.prop === m.prop && (xs == null || xs === step);
    }) || null;
}
/** 간편 칸으로는 못 나타내는 값(세밀에서 바꾼 것) — 칸 이름 목록 */
function detailChanges(item) {
    const out = [], hit = styleNow(), tabName = Object.fromEntries(LOOK_TABS);
    if (!hit && !presetLast()) {
        for (const f of LOOK_FIELDS) if (f.tab !== 'simple' && lookValue(f.path) != null) out.push(`${tabName[f.tab] || ''} ${f.label}`.trim());
        const m = motionNow(); if (m.text !== m.prop) { out.push(`글 움직임 ${MOTION_LABEL[m.text]}`); out.push(`소품 움직임 ${MOTION_LABEL[m.prop]}`); }
        for (const sf of SHAPE_FIELDS) if (shapeValue(sf.path) != null) out.push(sf.label);
    }
    { const m = motionNow(); if (m.speed !== 'm') out.push(`빠르기 ${SPEED_LABEL[m.speed]}`); if (m.open) out.push('처음부터 열어 두기'); }
    { const t0 = tuneOf(item.id) || {}; for (const md of ['light', 'dark']) for (const p of PAINT_ROLES) if (t0.inks?.[md]?.[p.role]) out.push(`${p.label} 색`); }
    if (lookValue('lemon.off') === true) out.push('레몬 빼기');
    const t = tuneOf(item.id) || {};
    for (const md of ['light', 'dark']) for (const r of TUNE_ROLES) if (t.inks?.[md]?.[r.role]) out.push(`${r.label} 글자색`);
    if (t.prop) out.push('소품 색');
    if (t.own === true || t.own === false) out.push('이 틀 소품 색');
    for (const k of Object.keys(t.vals || {})) out.push(/^t\d+$/.test(k) ? '소품 글자' : k);
    if (t.lines) out.push('대사 줄');
    if (t.hideTitle) out.push('제목 숨김');
    if (t.hideNames) out.push('이름 줄 숨김');
    return [...new Set(out)];
}
/** 11-13 「낮 · 밤 전환 넣기」 켬끔(밝기 줄 옆 · 기본 끔) — 켜면 복사 글과 미리보기에 해 · 달 전환 단추가 붙어요. 얼마나 커지는지 · 못 다는 틀인지는 mart.js 가 알려 줘요(setFlipInfo) */
let flipInfoOf = () => null;
export const setFlipInfo = (fn) => { flipInfoOf = fn; };
const kb = n => `${(n / 1024).toFixed(1)}KB`;
const flipNote = (item) => { const f = flipInfoOf(item); return !f ? '' : f.fail ? '이 틀에는 전환을 달 수 없어요' : f.over ? `전환을 달면 ${kb(f.total)} — 깡통 한 글(약 240KB)에 안 들어가요` : `복사 글 +${kb(f.add)}(모두 ${kb(f.total)})`; };
const flipChip = (item) => { const f = flipInfoOf(item), no = !!(f && (f.fail || f.over)); return `<button type="button" class="chip mart-flip" data-tune-flip aria-pressed="${toneState.flip && !no}" aria-label="낮 · 밤 전환 넣기"${no ? ' disabled' : ''} title="${esc(no ? flipNote(item) : `복사 글에 해 · 달 전환 단추를 넣어요 — 읽는 사람이 깡통에서 밝은 판 · 어두운 판을 바꿔 볼 수 있어요 · ${flipNote(item)}`)}">전환 넣기</button>`; };
const flipNoteHtml = (item) => { const f = flipInfoOf(item), no = !!(f && (f.fail || f.over)); return `<small class="mart-flip-note"${toneState.flip || no ? '' : ' hidden'}>${esc(flipNote(item))}</small>`; };
/** 11-13 「줄바꿈」 칩 둘 — 모든 틀 · 이 기기에 기억(wrap-state.js) · 간편은 글 크기 줄 아래 · 세밀은 「글 › 문단」. 바뀌는 곳은 본문(지문 · 대사)만 */
const WRAP_TITLE = { char: '낱말 가운데서도 줄이 바뀌어 오른쪽 끝이 고르게 맞아요(기본) · 제목 · 이름표는 그대로', word: '낱말을 통째로 다음 줄로 넘겨요 · 줄 끝이 들쭉날쭉할 수 있어요' };
const wrapChips = () => WRAP_MODES.map(([v, l]) => `<button type="button" class="chip" data-tune-wrap="${v}" aria-pressed="${wrapState.mode === v}" title="${esc(WRAP_TITLE[v])}">${l}</button>`).join('');
const segRow = (label, inner, extra = '') => `<div class="mart-simple-row"><p class="mart-simple-h">${label}${extra ? ` <small>${esc(extra)}</small>` : ''}</p><div class="mart-seg mart-simple-seg" role="group" aria-label="${label}">${inner}</div></div>`;
/** 11-12 스타일 카드 그림 — 이름표 · 대사 띠 · 지문 한 줄을 그 스타일 값으로 작게 그려요(전엔 빈 회색 칸이라 무엇이 바뀌는지 안 보였어요) · x 가 null 이면 「직접 조절」 */
const PIC_FONT = { serif: '"AppleMyungjo","Batang","Noto Serif KR",serif', gothic: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif' };
export function stylePic(x) {
    if (!x) return '<b class="is-n">이름</b><span class="is-d">「대사」</span><span class="is-t">직접 고른 값</span>';
    const L = x.look || {}, t = L.type || {}, d = L.dialogue || {}, s = x.shape || {};
    const fam = PIC_FONT[L.fonts?.text] ? `font-family:${PIC_FONT[L.fonts.text]};` : '';
    const text = `${fam}font-weight:${t.weight || 400};font-size:${t.sizeStep ? 12 : 10}px;line-height:${t.lineHeight ? 1.9 : 1.35};${t.indent ? 'text-indent:1em;' : ''}${t.align ? 'text-align:justify;' : ''}`;
    const band = d.style === 'plain' ? 'background:transparent;' : `background:rgba(58,167,255,${((s.bandAlpha ?? 18) / 100).toFixed(2)});${d.style === 'full' ? 'display:block;' : ''}`;
    const name = `font-weight:${L.profile?.nameWeight || 650};${s.nameTag === 'pill' ? 'padding:0 5px;border-radius:999px;background:rgba(58,167,255,.18);' : s.nameTag === 'line' ? 'border-bottom:1.5px solid currentColor;' : ''}`;
    return `<b class="is-n" style="${name}">깡통</b><span class="is-d" style="${band}font-weight:${d.weight || 400}">「안녕」</span><span class="is-t" style="${text}">비가 그쳤다</span>`;
}
/** 간편 화면 칸들(스타일 · 색 · 밤낮 · 움직임 · 글 크기 · 세밀에서 바꾼 것 · 더 조절하기) */
function simpleInner(item) {
    const hit = styleNow(), mine = presetList(), last = presetLast(), changes = detailChanges(item), m = motionNow();
    const card = (attr, id, label, on, cls = '', pic = '') => `<button type="button" class="mart-style-card${cls}" ${attr}="${esc(id)}" aria-pressed="${on}"><i class="mart-style-pic" aria-hidden="true">${pic}</i><span>${esc(label)}</span></button>`;
    const own = !hit && !last && (lookNoStep() || m.text !== 'm' || m.prop !== 'm' || shapeNow());
    const cards = [own ? card('data-view', 'detail', '직접 조절', true, ' is-own', stylePic(null)) : '', ...LOOKS.map(x => card('data-simple-style', x.id, x.label, !own && !last && hit?.id === x.id, '', stylePic(x))), ...mine.map(x => card('data-preset-load', x.id, x.name, x.id === last, ' is-mine', stylePic({ look: x.look, shape: x.shape })))].join('');
    const colorChip = (key, label) => `<span class="mart-tune-chip"><label class="mart-ink" title="${label} 색 — 목록 위 「${label}」 칸과 같은 값이에요"><input type="color" data-tune="${key}" value="${NEUTRAL}" aria-label="${label} 색"><span class="mart-ink-dot" aria-hidden="true"></span>${label}</label>${undoBtn('data-tune-reset', key, label)}</span>`;
    const cover = castPicked() ? `<div class="mart-simple-cover"><span class="mart-simple-h">소품도 캐릭터 색 <small>끄면 소품은 기본 색</small></span><span class="mart-seg" role="group" aria-label="소품도 캐릭터 색"><button type="button" class="chip" data-simple-cover="1" aria-pressed="${toneState.cover}">켬</button><button type="button" class="chip" data-simple-cover="0" aria-pressed="${!toneState.cover}">끔</button></span></div>` : '';
    const caps = motionCaps(item.preview), can = ['0', 's', 'l'].some(v => caps.text[v] || caps.prop[v]), apart = m.text !== m.prop;
    // 11-12 이 틀에 없는 세기(예: 「잔잔하게」의 약을 끔 · 중만 있는 틀에)는 applyMotion 이 중으로 그려요 — 단추도 그린 대로 중을 눌림으로(막힌 단추가 눌림으로 보이던 것 고침)
    const hasLv = v => v === 'm' || !!(caps.text[v] || caps.prop[v]), shown = !apart && hasLv(m.text) ? m.text : 'm', fell = !apart && !hasLv(m.text);
    // 11-12 밤 「소품만」 — 글은 가만히 · 소품만 움직이게(사용자 「글은 애니메이션 없고 일러스트만 애니메이션 주고 싶을 수도 있잖아」). 세밀 「글 움직임 끔 · 소품 움직임 그대로」와 같은 값(text '0' · prop 은 지금 세기 — 끔이었으면 중)
    const propOnly = m.text === '0' && m.prop !== '0', canPropOnly = !!caps.text['0'];
    const motionRow = segRow('움직임', MOTION_LEVELS.map(([v, l]) => `<button type="button" class="chip" data-simple-motion="${v}" aria-pressed="${!apart && shown === v}"${hasLv(v) ? '' : ' disabled'}>${l}</button>`).join('') + `<button type="button" class="chip" data-simple-motion="prop" aria-pressed="${propOnly}"${canPropOnly ? ' title="글은 가만히 두고 소품만 움직여요"' : ' disabled title="이 틀은 글 움직임을 끌 수 없어요"'}>소품만</button>` + (apart && !propOnly ? '<button type="button" class="chip" data-view="detail" aria-pressed="true">따로</button>' : ''), propOnly ? `글은 가만히 · 소품 ${MOTION_LABEL[m.prop]}` : apart ? `글 ${MOTION_LABEL[m.text]} · 소품 ${MOTION_LABEL[m.prop]}` : fell ? `${MOTION_LABEL[m.text]}이 없는 틀이라 중으로 보여요` : onlyOff(caps) ? '이 틀은 끔과 중만' : can ? '글 · 소품 같이' : '이 틀은 세기를 못 바꿔요');
    const fixed = lookValue('type.size'), step = stepOf(lookNow());
    const sizeRow = segRow('글 크기', SIZE_STEPS.map(([v, l]) => `<button type="button" class="chip" data-simple-size="${v}" aria-pressed="${fixed == null && step === v}">${l}</button>`).join(''), fixed != null ? `직접 ${fixed}px` : '');
    return `<div class="mart-simple-row"><p class="mart-simple-h">스타일 <small>한 번에 입혀요</small></p><div class="mart-style-cards mart-hscroll" role="group" aria-label="스타일">${cards}</div></div>
        <div class="mart-simple-row"><p class="mart-simple-h">색</p><div class="mart-simple-cast mart-hscroll">${colorChip('k', '깡통')}<button type="button" class="ibtn mart-cast-swap" data-simple-swap aria-label="깡통 · 깡캐 바꾸기" title="깡통 · 깡캐 바꾸기"></button>${colorChip('k2', '깡캐')}${thirdOn() ? colorChip('k3', '셋째') : ''}</div>${cover}</div>
        <div class="mart-simple-row"><p class="mart-simple-h">밝기 ${flipNoteHtml(item)}</p><div class="mart-seg mart-simple-seg" role="group" aria-label="밝기">${dayNightHtml('data-tune-mode', '')}<button type="button" class="chip" data-tune-mode="auto" aria-pressed="false" title="이 기기 밝기를 따라요(나가는 글은 그때 판 하나)">자동</button>${flipChip(item)}</div></div>
        ${motionRow}${sizeRow}${segRow('줄바꿈', wrapChips(), '본문만')}
        ${changes.length ? `<div class="mart-simple-diff"><p><b>세밀에서 바꾼 것 ${changes.length}</b> · ${esc(changes.slice(0, 5).join(' · '))}${changes.length > 5 ? ' · …' : ''}</p><div class="mart-tune-line mart-hscroll"><button type="button" class="chip" data-view="detail">세밀에서 보기</button><button type="button" class="chip" data-simple-reset title="세밀에서 바꾼 것만 처음으로(캐릭터 · 밤낮 · 고친 글은 그대로)">세밀 것만 처음으로</button></div></div>` : ''}
        <button type="button" class="btn mart-simple-more" data-view="detail" title="색 · 글 · 움직임 · 이 틀 · 도구 · 저장">더 조절하기</button>`;
}
const viewSegHtml = (item) => { const n = detailChanges(item).length; return `<div class="mart-view mart-seg" role="group" aria-label="간편 · 세밀"><button type="button" class="chip" data-view="simple" aria-pressed="${view === 'simple'}">간편</button><button type="button" class="chip" data-view="detail" aria-pressed="${view === 'detail'}">세밀${n ? ` <b class="mart-view-n">${n}</b>` : ''}</button></div>`; };
/** 세밀 「바탕」 묶음 — 질감 여덟 + 끔 · 얹는 곳 · 진하기 · 줄 노트 세로줄(연결 설명서 1절) · 걸지 않는 틀은 질감 줄을 흐리게 하고 까닭 한 줄 */
function textureBody(item) {
    const t = texNow(), i = texInfo(item.preview), off = !t;
    const chip = (attr, v, l, on, dis = false) => `<button type="button" class="chip" ${attr}="${v}" aria-pressed="${on}"${dis ? ' disabled' : ''}>${l}</button>`;
    const row = (label, inner, hide = false) => (hide ? '' : `<div class="mart-look-row is-wrap"><span class="mart-look-label">${label}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${label}">${inner}</span></div>`);
    const blocked = i.blocked ? `<p class="mart-tune-hint">이 틀에는 질감을 얹지 않아요 — ${esc(i.why || '')} · 고른 값은 다른 틀에서 그대로 걸려요</p>` : '';
    return `<div class="mart-look${i.blocked ? ' is-dim' : ''}">${row('바탕 질감', [chip('data-tex', 'none', '끔', off, i.blocked), ...TEX_ORDER.map(k => chip('data-tex', k, TEX_NAMES[k], t?.tex === k, i.blocked))].join(''))}${blocked}
        ${row('얹는 곳', chip('data-tex-on', 'b', '글 칸만', t?.on === 'b') + chip('data-tex-on', 'c', '카드 전체', t?.on === 'c'), off)}
        ${!off && !i.blocked && !i.pane ? '<p class="mart-tune-hint">이 틀은 글 칸이 따로 없어서 카드 전체에 얹혀요</p>' : ''}
        ${row('진하기', [[1, '옅게'], [2, '보통'], [3, '진하게']].map(([v, l]) => chip('data-tex-level', v, l, t?.level === v)).join(''), off)}
        ${row('빨간 세로줄', chip('data-tex-mg', '1', '켬', !!t?.margin) + chip('data-tex-mg', '0', '끔', !t?.margin), off || t.tex !== 'line')}
        <p class="mart-tune-hint">모든 틀에 같이 기억해요 · 낮밤을 바꾸면 그 판 무늬로 다시 얹어요</p></div>`;
}
/** 11-12 깡통 118 뒤: 약 · 강이 중과 같아 보이는 틀(끔만 다른 틀) */
const onlyOff = c => !['s', 'l'].some(v => c.text[v] || c.prop[v]) && (c.text[0] || c.prop[0]);
/** 세밀 「움직임」 묶음 — 글 · 소품 따로(설계 4-4 ③ · 끔 · 빠르기 · 열어 두기는 세기 모듈이 나오면) */
function motionBody(item) {
    const m = motionNow(), caps = motionCaps(item.preview);
    const row = (key, label, c) => `<div class="mart-look-row is-wrap"><span class="mart-look-label">${label}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${label}">${MOTION_LEVELS.map(([v, l]) => `<button type="button" class="chip" data-motion-${key}="${v}" aria-pressed="${m[key] === v}"${v === 'm' || c[v] ? '' : ' disabled'}>${l}</button>`).join('')}</span></div>`;
    const cp = capsOf(item), sWhy = capWhy(cp, 'speed'), oWhy = capWhy(cp, 'open');
    const seg = (attr, label, opts, now, why) => `<div class="mart-look-row is-wrap${why ? ' is-dim' : ''}"><span class="mart-look-label">${label}</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="${label}">${opts.map(([v, l]) => `<button type="button" class="chip" ${attr}="${v}" aria-pressed="${now === v}"${why && v !== opts[0][0] && v !== 'm' ? ' disabled' : ''}>${l}</button>`).join('')}</span></div>`;
    return `<div class="mart-look">${row('text', '글 움직임', caps.text)}${row('prop', '소품 움직임', caps.prop)}${seg('data-motion-speed', '빠르기', SPEEDS, m.speed, sWhy)}${seg('data-motion-open', '열어 두기', [['0', '끔'], ['1', '켬']], m.open ? '1' : '0', oWhy)}<p class="mart-tune-hint">${onlyOff(caps) ? '이 틀은 끔과 중만 달라 보여요 · ' : ''}모든 틀에 같이 기억해요 · 흐린 칸은 이 틀에서 중과 같아 보이는 세기예요 · 빠르기는 반복 움직임까지 같은 배 · 열어 두기는 눌러서 여는 틀이 처음부터 열린 모습으로 나가요${sWhy ? ` · 빠르기: ${esc(sWhy)}` : ''}${oWhy ? ` · 열어 두기: ${esc(oWhy)}` : ''}</p></div>`;
}
const EDITS_HTML = `<div class="mart-tune-line mart-hscroll mart-tune-edits"><button type="button" class="chip mart-tune-edit" data-tune-edit aria-pressed="false">글 고치기</button><button type="button" class="chip" data-hist="undo" title="되돌리기(Ctrl+Z)" disabled>되돌리기</button><button type="button" class="chip" data-hist="redo" title="다시하기(Ctrl+Y)" disabled>다시하기</button><button type="button" class="chip" data-spoiler="wrap" hidden title="커서가 든 지문 · 대사 줄을 눌러야 보이는 글로">줄 숨기기</button><button type="button" class="chip" data-spoiler="unwrap" hidden title="커서가 든 숨긴 줄을 다시 보이게">풀기</button><button type="button" class="chip mart-tune-all" data-tune-reset="all" hidden>전부 처음으로</button></div>
        <p class="mart-tune-hint" data-edit-hint hidden>미리보기의 글자를 눌러 바로 고쳐 써요 · 고치는 동안은 소품이 안 눌려요</p>`;
// ── 11-12 세밀 = 갈래 여덟 접힘(설계 4-4 · 목업-마트-세밀) — ① 색 ② 글 ③ 움직임 ④ 소품 ⑤ 모양 ⑥ 이 틀 ⑦ 도구 ⑧ 저장 · 가져오기 ──
//   머리 줄에 이름 · 지금 값 요약 · 「바꾼 것 n」 · 여러 갈래를 같이 펼칠 수 있고 펼친 갈래는 기억(`bl-mart-geulkku-open-v1`) · 갈래마다 「이 갈래 처음으로」
const GROUPS = Object.freeze([['color', '색'], ['text', '글'], ['motion', '움직임'], ['prop', '소품'], ['shape', '모양'], ['frame', '이 틀'], ['tools', '도구'], ['save', '저장 · 가져오기']]);
const TEXT_TABS = Object.freeze([['text', '본문'], ['dialogue', '대사'], ['em', '속마음'], ['strong', '강조'], ['strike', '취소선'], ['name', '이름'], ['title', '제목'], ['para', '문단'], ['shadow', '그림자'], ['outline', '외곽선']]);
let textTab = 'text';
const OPEN_KEY = 'bl-mart-geulkku-open-v1';
let opened = (() => { try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null'); return new Set(Array.isArray(v) ? v : ['color', 'text']); } catch { return new Set(['color', 'text']); } })();
function saveOpen(g, on) { if (on) opened.add(g); else opened.delete(g); try { localStorage.setItem(OPEN_KEY, JSON.stringify([...opened])); } catch { /* 이번 화면에서만 */ } }
let noProp = false;   // ① 색 갈래를 그릴 때 소품 색 칸은 ④ 소품으로 넘겨요
const bodyFor = (item, t) => { const old = tab; tab = t; try { return tabBody(item); } finally { tab = old; } };
const textPaths = () => LOOK_FIELDS.filter(f => TEXT_TABS.some(([id]) => id === f.tab));
const shapeCount = g => SHAPE_FIELDS.filter(x => x.group === g && shapeValue(x.path) != null).length;
const shapeClear = g => { const o = { ...(shapeNow() || {}) }; for (const x of SHAPE_FIELDS) if (x.group === g) delete o[x.path]; setShape(o); };
function groupCount(item, g) {
    const t = tuneOf(item.id) || {}, m = motionNow();
    if (g === 'color') { let n = shapeCount('color'); for (const md of ['light', 'dark']) n += Object.keys(t.inks?.[md] || {}).length; return n + (toneState.auto ? 1 : 0); }
    if (g === 'text') return textPaths().filter(f => lookValue(f.path) != null).length;
    if (g === 'motion') return (m.text !== 'm') + (m.prop !== 'm') + (m.speed !== 'm') + (m.open ? 1 : 0);
    if (g === 'prop') return (t.prop ? 1 : 0) + (t.own === true || t.own === false ? 1 : 0) + shapeCount('prop');
    if (g === 'shape') return shapeCount('shape') + (t.hideTitle ? 1 : 0) + (t.hideNames ? 1 : 0) + (lookValue('lemon.off') === true ? 1 : 0) + (texNow() ? 1 : 0);
    if (g === 'frame') return Object.keys(t.vals || {}).length + (t.lines ? 1 : 0);
    if (g === 'tools') { const w = wordsNow(); return (w.hide ? 1 : 0) + w.rules.length; }
    return 0;
}
function groupSum(item, g) {
    const t = tuneOf(item.id) || {}, m = motionNow();
    if (g === 'color') return `${toneState.on ? `깡통 ${toneState.name || (toneState.k ? '직접 색' : '캐릭터 없음')}` : '깡통 원래 색'} · ${toneState.auto ? `자동(${toneState.mode === 'light' ? '낮' : '밤'})` : toneState.mode === 'light' ? '낮' : '밤'}${shapeValue('bandAlpha') != null ? ` · 띠 ${shapeValue('bandAlpha')}%` : ''}`;
    if (g === 'text') { const ch = textPaths().filter(f => lookValue(f.path) != null).map(f => `${TEXT_TABS.find(([id]) => id === f.tab)[1]} ${f.label}`); return ch.length ? ch.slice(0, 2).join(' · ') + (ch.length > 2 ? ' · …' : '') : '틀 그대로'; }
    if (g === 'motion') return `글 ${MOTION_LABEL[m.text]} · 소품 ${MOTION_LABEL[m.prop]}${m.speed !== 'm' ? ` · ${SPEED_LABEL[m.speed]}` : ''}${m.open ? ' · 열어 둠' : ''}`;
    if (g === 'prop') return shapeValue('hideProp') ? '소품 숨김' : t.prop ? '소품 색 직접' : t.own === true ? '소품 기본 색' : t.own === false ? '소품 캐릭터 색' : '틀 그대로';
    if (g === 'shape') { const x = texNow(), sv = shapeNow() || {}; return [sv.radius != null ? `모서리 ${sv.radius}` : '', sv.pad != null ? `여백 ${sv.pad}%` : '', sv.width ? `폭 ${sv.width}` : '', sv.nameTag ? `이름표 ${{ pill: '알약', line: '밑줄' }[sv.nameTag]}` : '', x ? `질감 ${TEX_NAMES[x.tex]}` : '질감 없음', t.hideTitle ? '제목 숨김' : '', t.hideNames ? '이름 줄 숨김' : '', lookValue('lemon.off') === true ? '레몬 빼기' : ''].filter(Boolean).join(' · '); }
    if (g === 'frame') { const n = fieldsOf(item.preview).length; return n ? `칸 ${n}` : '대사 줄'; }
    if (g === 'tools') { const w = wordsNow(); return [w.hide ? '이름 숨김 켬' : '이름 숨김 끔', w.rules.length ? `바꾸기 ${w.rules.length}` : ''].filter(Boolean).join(' · '); }
    if (g === 'save') return `내 스타일 ${presetList().length} · 완성 프리셋 ${mineList().length}`;
    return '';
}
function groupReset(item, g) {
    const t = clone(tuneOf(item.id));
    if (g === 'color') { delete t.inks; setTune(item.id, t); shapeClear('color'); if (toneState.auto) setTone({ mode: toneState.mode }); }
    else if (g === 'text') { const L = clone(lookNow()); for (const f of textPaths()) { const ks = f.path.split('.'); let o = L; for (const k of ks.slice(0, -1)) o = o?.[k]; if (o) delete o[ks.at(-1)]; } setLook(L); }
    else if (g === 'motion') setMotion({ text: 'm', prop: 'm', speed: 'm', open: false });
    else if (g === 'prop') { delete t.prop; delete t.own; setTune(item.id, t); shapeClear('prop'); }
    else if (g === 'shape') { delete t.hideTitle; delete t.hideNames; setTune(item.id, t); setLookValue('lemon.off', null); setTex(null); shapeClear('shape'); }
    else if (g === 'frame') { delete t.vals; delete t.lines; setTune(item.id, t); }
    else if (g === 'tools') setWords({ hide: false, rules: [] });
}
/** 세밀 전부 처음으로(설계 4-6) — 스타일 · 이 틀 값 · 질감 · 움직임(캐릭터 · 밤낮 · 고친 글 · 숨긴 줄은 그대로) */
function detailReset(item) {
    const { texts, mineTexts, spoilers, mineSpoilers } = tuneOf(item.id) || {};
    setTune(item.id, { texts, mineTexts, spoilers, mineSpoilers }); setLook(null); setMotion({ text: 'm', prop: 'm', speed: 'm', open: false }); setTex(null); setShape(null); markPreset('');
}
const detailTotal = item => GROUPS.reduce((n, [g]) => n + groupCount(item, g), 0);
const detailHead = item => { const n = detailTotal(item); return `<div class="mart-detail-head"><span>${n ? `세밀에서 바꾼 것 <b>${n}</b>` : '틀 그대로예요'}</span><button type="button" class="chip" data-detail-reset${n ? '' : ' hidden'}>전부 처음으로</button></div>`; };
function groupBody(item, g) {
    if (g === 'color') { noProp = true; try { return bodyFor(item, 'color'); } finally { noProp = false; } }
    if (g === 'text') return `<div class="mart-seg mart-hscroll mart-text-tabs" role="group" aria-label="글 묶음">${TEXT_TABS.map(([id, l]) => `<button type="button" class="chip" data-tune-tab="${id}" aria-pressed="${id === textTab}">${l}</button>`).join('')}</div>${bodyFor(item, textTab)}`;
    if (g === 'motion') return motionBody(item);
    if (g === 'prop') {
        const prop = hasPropTone(item.preview), own = hasOwnTone(item.preview), show = shapeBlock(['hideProp'], capsOf(item));
        if (!prop && !own) return `${show}<p class="mart-tune-hint">이 틀은 소품 색을 따로 바꾸지 않아요 · 소품 자리 · 크기는 틀이 정해요</p>`;
        return `${show}<div class="mart-inks mart-tune-colors mart-hscroll" role="group" aria-label="소품 색">${prop ? `<span class="mart-tune-chip"><label class="mart-ink" title="소품 색 — 안 고르면 깡통 색을 따라가요"><input type="color" data-tune="prop" value="${NEUTRAL}" aria-label="소품 색"><span class="mart-ink-dot" aria-hidden="true"></span>소품 색</label>${undoBtn('data-tune-reset', 'prop', '소품 색')}</span>` : ''}</div>${own ? '<div class="mart-tune-line mart-hscroll"><span class="mart-seg mart-tune-own" role="group" aria-label="소품 색"><button type="button" class="chip" data-tune-own="1" aria-pressed="true">소품 기본 색</button><button type="button" class="chip" data-tune-own="0" aria-pressed="false">소품 캐릭터 색</button></span></div>' : ''}<p class="mart-tune-hint">소품 자리 · 크기는 틀이 정해요(움직이면 열린 뒤 모습이 어긋나서 칸을 두지 않아요)</p>`;
    }
    if (g === 'shape') { const cp = capsOf(item); return shapeBlock(['radius', 'pad', 'width', 'noBorder'], cp, '카드') + shapeBlock(['nameTag', 'nameAlign'], cp, '이름표') + bodyFor(item, 'head') + shapeBlock(['hideUl'], cp) + textureBody(item); }
    if (g === 'frame') {
        const vals = fieldsOf(item.preview).length ? bodyFor(item, 'vals') : '';
        const lines = !mineOn() ? `<div class="mart-look"><div class="mart-look-row is-wrap"><span class="mart-look-label">대사 줄</span><span class="mart-seg mart-look-seg mart-hscroll" role="group" aria-label="대사 줄">${[[-1, '하나 줄이기'], [0, '견본 그대로'], [1, '하나 더'], [2, '둘 더']].filter(([n]) => n >= LINES_RANGE[0] && n <= LINES_RANGE[1]).map(([n, l]) => `<button type="button" class="chip" data-tune-lines="${n}" aria-pressed="${(tuneOf(item.id)?.lines || 0) === n}">${l}</button>`).join('')}</span></div></div>` : '<p class="mart-tune-hint">내 글을 넣은 동안은 대사 줄 수를 내 글이 정해요</p>';
        return vals + lines;
    }
    if (g === 'tools') return toolsBody();
    if (g === 'save') return mineBoxHtml(item);
    return '';
}
function detailBody(item) {
    return GROUPS.map(([g, label]) => { const n = groupCount(item, g), open = opened.has(g);
        return `<details class="mart-group" data-group="${g}"${open ? ' open' : ''}><summary class="mart-look-row chev mart-group-head"><span class="mart-group-name">${label}</span><span class="mart-group-sum">${esc(groupSum(item, g))}</span><span class="mart-group-n"${n ? '' : ' hidden'}>바꾼 것 ${n}</span></summary><div class="mart-group-body">${groupBody(item, g)}<div class="mart-tune-line"><button type="button" class="chip" data-group-reset="${g}"${n ? '' : ' hidden'}>이 갈래 처음으로</button></div></div></details>`; }).join('');
}
export { viewSegHtml };

export function tuneHtml(item) {
    if (!item?.simple || !item.preview) return '';
    if (view === 'simple') return `<section class="mart-tune is-simple" aria-label="조절"><div class="mart-simple">${simpleInner(item)}</div>
        ${EDITS_HTML}</section>`;
    return `<section class="mart-tune is-detail" aria-label="조절">${detailHead(item)}<div class="mart-tune-body mart-gr-list">${detailBody(item)}</div>
        ${EDITS_HTML}</section>`;
}
const dotOf = p => (p.tone.on && p.tone.k ? p.tone.k : NEUTRAL);
const presetsHtml = () => {
    const list = presetList(), last = presetLast();
    if (!list.length) return '<p class="mart-tune-empty">아직 없어요 · 지금 색과 글 모양을 이름 붙여 기억해 두면 어느 틀에든 한 번에 입혀요</p>';
    return `<ul class="mart-tune-mine mart-hscroll">${list.map(x => `<li${x.id === last ? ' class="is-here"' : ''}><button type="button" class="mart-tune-load" data-preset-load="${esc(x.id)}" title="이 프리셋 입히기"${x.id === last ? ' aria-current="true"' : ''}><i class="mart-ink-dot" style="background:${esc(dotOf(x))}" aria-hidden="true"></i><b>${esc(x.name)}</b><span>${x.look ? '색 · 글 모양' : '색'}</span></button><button type="button" class="mart-cast-x" data-preset-rename="${esc(x.id)}" aria-label="${esc(x.name)} 이름 바꾸기" title="이름 바꾸기">✎︎</button><button type="button" class="mart-cast-x" data-preset-forget="${esc(x.id)}" aria-label="${esc(x.name)} 지우기" title="지우기">×</button></li>`).join('')}</ul>`;
};
const mineHtml = (item) => {
    const list = mineList();
    if (!list.length) return '<p class="mart-tune-empty">아직 없어요 · 이 틀과 색 · 글 모양 · 값 · 고쳐 쓴 글까지 통째로 기억해요</p>';
    return `<ul class="mart-tune-mine mart-hscroll">${list.map(x => `<li${x.frame === item.id ? ' class="is-here"' : ''}><button type="button" class="mart-tune-load" data-mine-load="${esc(x.id)}" title="불러오기"><i class="mart-ink-dot" style="background:${esc(dotOf(x))}" aria-hidden="true"></i><b>${esc(x.name)}</b><span>${esc(x.frameName || x.frame)}</span></button><button type="button" class="mart-cast-x mart-set-down" data-mine-down="${esc(x.id)}" aria-label="${esc(x.name)} 파일로 내려받기" title="파일로 내려받기"></button><button type="button" class="mart-cast-x" data-mine-forget="${esc(x.id)}" aria-label="${esc(x.name)} 지우기" title="지우기">×</button></li>`).join('')}</ul>`;
};
/** 11-12 지금 값 → 설정(꼴 2 · 이 틀 값까지) */
const setNow = (item, label = '') => makeSet({ tone: toneState, look: lookNow(), motion: motionNow(), tex: texNow(), shape: shapeNow(), tune: tuneOf(item.id), frame: item.id, label });
/** 글 파일 받기 */
function downloadText(text, filename) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: filename, hidden: true });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/** 11-12 완성 프리셋 파일 받기 */
function downloadSets(rows, name) {
    const blob = new Blob([setsFile(rows)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `완성프리셋-${String(name || '모두').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.bl-mart-set.json`, hidden: true });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/**
 * 11-12 「테마로 담기」 칸 — 테마가 못 받는 틀(item.nt · 테마 받기 검사를 옮긴 theme-take.js 의 까닭)은 단추를 막고 까닭 · 다른 길을 알려요
 *   (예전에는 53틀도 단추가 살아 있어 담으면 테마가 「이 틀은 아직 테마 로그 복사가 받지 못해요」로 건너뛰었어요)
 */
function themeBoxHtml(item) {
    const no = item.nt ? ' disabled aria-describedby="mart-notake-why"' : '';
    const hint = item.nt
        ? `<p class="mart-tune-hint is-notake" id="mart-notake-why"><b>테마 아직 못 받음</b> — 블루레몬 로그 복사가 아직 이 틀을 받지 못해요(${esc(item.nt)}) · 위 「HTML 복사」 · 「파일로 내려받기」로 깡통 글에 붙여 써요</p>`
        : '<p class="mart-tune-hint">블루레몬 1.2.0 부터 이 틀을 받아요 · 1.1.9 까지는 일부 틀을 못 받아요(테마를 최신 판으로 올려요)</p>';
    return `<h3 class="mart-tune-h">테마로 담기 <small>블루레몬 로그 복사에 이 틀 + 지금 조절 값 그대로</small></h3><div class="mart-tune-line mart-hscroll"><button type="button" class="chip" data-act="theme-copy"${no} title="테마 「마트에서 가져오기」에 붙여 넣는 글(bl-mart 꾸러미)을 복사해요">테마용 복사</button><button type="button" class="chip" data-act="theme-file"${no} title="같은 꾸러미를 .bl-mart.json 파일로 받아요">테마용 파일 받기</button></div>${hint}`;
}
/** 「내 프리셋」 · 「완성 프리셋」 칸(미리보기 아래) */
export function mineBoxHtml(item) {
    if (!item?.simple || !item.preview) return '';
    return `<section class="mart-tune-save" aria-label="가져가기 · 내 스타일"><h3 class="mart-tune-h">가져가기 <small>HTML 복사 말고도</small></h3><div class="mart-tune-line mart-hscroll"><button type="button" class="chip mart-dl-chip" data-act="download" title="복사 글과 같은 HTML 을 .html 파일로">파일로 내려받기</button><button type="button" class="chip" data-act="text" title="틀 없이 글만(마크다운) 복사">글만 복사</button></div>
        ${themeBoxHtml(item)}
        <h3 class="mart-tune-h">설정 파일 · 코드 <small>이 틀 + 지금 조절 값 · 마트와 테마가 같은 꼴</small></h3><div class="mart-tune-line mart-hscroll"><button type="button" class="chip" data-setx="file" title="지금 값을 ${SET_EXT} 파일로">설정 파일 받기</button><button type="button" class="chip" data-setx="pick" title="받아 둔 ${SET_EXT} 파일(예전 완성 프리셋 파일도)을 골라 입혀요">파일 가져오기</button><button type="button" class="chip" data-setx="code" title="짧은 코드(BLG1.…)를 복사해요">코드 복사</button><button type="button" class="chip" data-setx="paste" aria-expanded="false">코드 붙여 넣기</button><input type="file" class="mart-setx-file" accept=".json,application/json" hidden></div>
        <div class="mart-setx-io" hidden><textarea class="field" rows="2" placeholder="BLG1.… 코드나 ${SET_EXT} 내용을 붙여 넣어요 · 예전 프리셋 글자(BLM1.) · 테마 스타일 코드(BLS1.)도 돼요" aria-label="설정 코드 붙여 넣기"></textarea><button type="button" class="btn" data-setx="apply">가져와서 입히기</button></div>
        <p class="mart-tune-hint">캐릭터 이름이 받는 쪽 인물표에 없으면 색만 써요 · 「내 글 넣기」 글은 담지 않아요</p>
        <h3 class="mart-tune-h">내 스타일 <small>색 + 글 모양 · 어느 틀에든</small></h3>
        <form class="mart-tune-form" data-form="preset"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="24" placeholder="스타일 이름" aria-label="스타일 이름" required></label><button type="submit" class="btn">스타일 저장</button></form>
        <div class="mart-preset-list">${presetsHtml()}</div>
        <div class="mart-tune-line mart-hscroll"><button type="button" class="chip" data-preset-reset>기본으로</button><button type="button" class="chip" data-preset-export>내보내기</button><button type="button" class="chip" data-preset-io aria-expanded="false">가져오기</button></div>
        <div class="mart-preset-io" hidden><textarea class="field" rows="2" placeholder="프리셋 글자(BLM1.…)나 블루레몬 테마 스타일 코드(BLS1.…) · 프리셋 파일 내용을 붙여 넣어요" aria-label="프리셋 글자 붙여 넣기"></textarea><button type="button" class="btn" data-preset-import>가져와서 입히기</button></div>
        <h3 class="mart-tune-h">완성 프리셋 <small>이 틀 + 색 + 글 모양 + 값 + 고친 글</small></h3>
        <form class="mart-tune-form" data-form="mine"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="24" placeholder="완성 프리셋 이름" aria-label="완성 프리셋 이름" required></label><button type="submit" class="btn">완성 프리셋 저장</button></form>
        <div class="mart-tune-list">${mineHtml(item)}</div>
        <div class="mart-tune-line mart-hscroll"><button type="button" class="chip" data-sets-down title="기억한 완성 프리셋을 파일 하나로">모두 내려받기</button><button type="button" class="chip" data-sets-pick title="내려받은 완성 프리셋 파일(.json)을 골라 가져와요">파일 가져오기</button><input type="file" class="mart-sets-file" accept=".json,application/json" hidden></div></section>`;
}
/** 조절 칸을 지금 값으로 맞춰요 — 칸을 새로 그리지 않아요(색 고르기 창 · 끌고 있는 슬라이더가 안 날아가게) */
// ── 11-11 되돌리기 · 다시하기 — 테마 로그 복사 편집기(hist: 스냅샷 50 · 0.5초 묶음)와 같은 꼴 ──
//   한 칸 = 이 틀의 조절 값(색 · 고쳐 쓴 글 · 대사 줄) + 글 모양 + 깡통 · 깡캐 · 밤낮. 크게 보기를 다른 틀로 열면 새로 시작해요
const HIST_MAX = 50;
const hist = { id: null, stack: [], at: -1, timer: 0, restoring: false };
const snapOf = item => JSON.stringify({ tune: tuneOf(item.id), look: lookNow(), motion: motionNow(), tex: texNow(), shape: shapeNow(), words: wordsNow(), tone: { on: toneState.on, k: toneState.k, name: toneState.name, k2: toneState.k2, name2: toneState.name2, k3: toneState.k3, name3: toneState.name3, mode: toneState.mode, auto: toneState.auto } });
function histPush(item) {
    clearTimeout(hist.timer); hist.timer = 0;
    const s = snapOf(item);
    if (hist.stack[hist.at] === s) return;
    hist.stack = hist.stack.slice(0, hist.at + 1); hist.stack.push(s);
    if (hist.stack.length > HIST_MAX + 1) hist.stack.shift();
    hist.at = hist.stack.length - 1;
}
/** 바뀔 때마다 부르면 0.5초 묶어 한 칸으로 */
function histRecord(item, sheet) {
    if (hist.restoring || hist.id !== item.id) return;
    clearTimeout(hist.timer);
    hist.timer = setTimeout(() => { histPush(item); syncHist(sheet); }, 500);
}
function histStart(item) { clearTimeout(hist.timer); hist.id = item.id; hist.stack = []; hist.at = -1; histPush(item); }
function syncHist(sheet) {
    const u = sheet?.querySelector('[data-hist="undo"]'), r = sheet?.querySelector('[data-hist="redo"]');
    const pending = !!hist.timer;   // 11-12 밤: 고친 글도 조절 값과 한 차례표(칸 단위 따로 되돌리기는 차례가 섞여서 뺐어요)
    if (u) u.disabled = !(hist.at > 0 || pending);
    if (r) r.disabled = pending || hist.at >= hist.stack.length - 1;
}
/** 한 칸 앞 · 뒤로 — 칠하기 · 글 모양 · 깡통 · 깡캐를 그 칸으로 되돌려요 */
function histMove(item, step) {
    if (hist.timer) histPush(item);   // 묶는 중이던 것을 먼저 한 칸으로
    const to = hist.at + step;
    if (to < 0 || to >= hist.stack.length) return false;
    const s = JSON.parse(hist.stack[to]);
    hist.restoring = true;
    try {
        setTune(item.id, s.tune);
        setLook(s.look);
        if (s.motion) setMotion(s.motion);
        if ('tex' in s) setTex(s.tex);
        if ('shape' in s) setShape(s.shape);
        if (s.words) setWords(s.words);
        setTone({ ...(s.tone.on ? { on: true, k: s.tone.k, name: s.tone.name } : { on: false }), k2: s.tone.k2, name2: s.tone.name2, k3: s.tone.k3 ?? null, name3: s.tone.name3 ?? '', mode: s.tone.auto ? 'auto' : s.tone.mode, auto: !!s.tone.auto });
    } finally { hist.restoring = false; }
    hist.at = to;
    return true;
}
export function syncTune(sheet, item) {
    if (item && hist.id !== item.id) histStart(item);
    syncHist(sheet);
    const box = sheet?.querySelector('.mart-tune'); if (!box || !item) return;
    // 11-12 방금 누른 단추(스타일 카드 · 움직임 · 글 크기 …)에 초점이 남아 있어도 다시 그려요 — 전엔 초점이 칸 안이면 건너뛰어 눌림 표시가 그대로였어요. 다시 그린 뒤 같은 단추에 초점을 돌려줘요(색 칸 · 글칸에 있을 땐 그대로)
    if (view === 'simple') {
        const sp = box.querySelector('.mart-simple'), a = document.activeElement, inSp = !!sp?.contains(a);
        if (sp && (!inSp || a.tagName === 'BUTTON')) {
            const key = inSp ? [...a.attributes].find(x => x.name.startsWith('data-'))?.name : null, val = key ? a.getAttribute(key) : null;
            const x = sp.querySelector('.mart-style-cards')?.scrollLeft || 0; sp.innerHTML = simpleInner(item); const c = sp.querySelector('.mart-style-cards'); if (c) c.scrollLeft = x;
            if (key) [...sp.querySelectorAll(`[${key}]`)].find(e => e.getAttribute(key) === val)?.focus({ preventScroll: true });
        }
    }
    { const vs = sheet.querySelector('.mart-view'); if (vs) vs.outerHTML = viewSegHtml(item); }
    if (view === 'detail') { for (const g of box.querySelectorAll('.mart-group')) { const c = groupCount(item, g.dataset.group), n = g.querySelector('.mart-group-n'); if (n) { n.textContent = c ? `바꾼 것 ${c}` : ''; n.hidden = !c; } const sm = g.querySelector('.mart-group-sum'); if (sm) sm.textContent = groupSum(item, g.dataset.group); const rs = g.querySelector('[data-group-reset]'); if (rs) rs.hidden = !c; } const dh = box.querySelector('.mart-detail-head'); if (dh && !dh.contains(document.activeElement)) dh.outerHTML = detailHead(item); }
    const root = sheet.querySelector('.mart-sheet-preview'), v = valuesOf(item, root), t = tuneOf(item.id);
    for (const b of box.querySelectorAll('[data-tune-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tuneTab === tab));
    for (const input of box.querySelectorAll('input[data-tune]')) {
        const cur = v[input.dataset.tune]; if (!cur) continue;
        if (document.activeElement !== input && !input.dataset.busy) input.value = cur.value;
        const dot = input.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = input.dataset.busy ? input.value : cur.value;
        const undo = input.closest('.mart-tune-chip')?.querySelector('[data-tune-reset]'); if (undo) undo.hidden = !cur.changed;
    }
    for (const b of box.querySelectorAll('[data-tune-mode]')) b.setAttribute('aria-pressed', String(b.dataset.tuneMode === (toneState.auto ? 'auto' : toneState.mode)));
    for (const b of box.querySelectorAll('[data-tune-flip]')) b.setAttribute('aria-pressed', String(toneState.flip && !b.disabled));
    for (const b of box.querySelectorAll('[data-tune-wrap]')) b.setAttribute('aria-pressed', String(b.dataset.tuneWrap === wrapState.mode));   // 11-13 줄바꿈
    for (const n of box.querySelectorAll('.mart-flip-note')) { n.hidden = !(toneState.flip || !!box.querySelector('[data-tune-flip]:disabled')); n.textContent = flipNote(item); }
    { const mo = motionNow(); for (const b of box.querySelectorAll('[data-motion-speed]')) b.setAttribute('aria-pressed', String(b.dataset.motionSpeed === mo.speed)); for (const b of box.querySelectorAll('[data-motion-open]')) b.setAttribute('aria-pressed', String((b.dataset.motionOpen === '1') === mo.open)); }
    for (const f of SHAPE_FIELDS) {
        const cur = shapeValue(f.path);
        if (f.kind === 'range') {
            const input = box.querySelector(`input[data-shape="${f.path}"]`); if (!input) continue;
            const g = { ...f, min: Number(input.min), max: Number(input.max) };
            if (document.activeElement !== input) input.value = String(cur ?? Math.min(g.max, Math.max(g.min, f.def)));
            input.style.setProperty('--fill', fillOf(g, document.activeElement === input ? Number(input.value) : cur));
            const n = box.querySelector(`input[data-shape-num="${f.path}"]`); if (n && document.activeElement !== n) n.value = numText(f, cur);
            const undo = box.querySelector(`[data-shape-reset="${f.path}"]`); if (undo) undo.hidden = cur == null;
        } else for (const b of box.querySelectorAll(`[data-shape-pick="${f.path}"]`)) b.setAttribute('aria-pressed', String(JSON.parse(b.dataset.v) === (cur ?? SHAPE_DEF[f.path])));
    }
    if (box.querySelector('input[data-head]')) { const slots = headSlots(item), key = mineOn() ? 'mineTexts' : 'texts'; for (const inp of box.querySelectorAll('input[data-head]')) { const s = slots[inp.dataset.head]; if (s && document.activeElement !== inp) inp.value = plainOf(t?.[key]?.[s.i] ?? s.text); } }
    for (const b of box.querySelectorAll('[data-tune-own]')) b.setAttribute('aria-pressed', String((b.dataset.tuneOwn === '0') === (ownOf(t) === false)));   // 지금 보이는 모습(틀마다 고른 값 · 없으면 마트 칸)
    // 글 모양 칸
    for (const f of LOOK_FIELDS) {
        const cur = lookValue(f.path);
        if (f.kind === 'range') {
            const input = box.querySelector(`input[data-look="${f.path}"]`); if (!input) continue;
            if (document.activeElement !== input) input.value = String(cur ?? f.def);
            input.style.setProperty('--fill', fillOf(f, document.activeElement === input ? Number(input.value) : cur));
            const n = box.querySelector(`input[data-look-num="${f.path}"]`); if (n && document.activeElement !== n) n.value = numText(f, cur);
            const undo = box.querySelector(`[data-look-reset="${f.path}"]`); if (undo) undo.hidden = cur == null;
        } else if (f.kind === 'pick' || f.kind === 'font') {
            for (const b of box.querySelectorAll(`[data-look-pick="${f.path}"]`)) b.setAttribute('aria-pressed', String(JSON.parse(b.dataset.v) === cur));
        } else if (f.kind === 'toggle') {
            const b = box.querySelector(`[data-look-toggle="${f.path}"]`); if (b) { b.setAttribute('aria-pressed', String(cur === true)); b.textContent = cur === true ? '켬' : '끔'; }
        } else if (f.kind === 'targets') {
            const tg = cur || (lookValue('shadow.on') ? { dialogue: true } : {});
            for (const b of box.querySelectorAll('[data-look-target]')) b.setAttribute('aria-pressed', String(tg[b.dataset.lookTarget] === true));
        } else if (f.kind === 'color') {
            const input = box.querySelector(`input[data-look-color="${f.path}"]`); if (!input) continue;
            if (document.activeElement !== input && !input.dataset.busy) input.value = cur || f.def;
            const dot = input.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = input.value;
            const undo = box.querySelector(`[data-look-reset="${f.path}"]`); if (undo) undo.hidden = cur == null;
        }
    }
    box.querySelector('[data-tune-edit]')?.setAttribute('aria-pressed', String(editing));
    for (const sb of box.querySelectorAll('[data-spoiler]')) sb.hidden = !editing;
    const hint = box.querySelector('[data-edit-hint]'); if (hint) hint.hidden = !editing;
    const all = box.querySelector('[data-tune-reset="all"]'); if (all) all.hidden = !(t || toneState.on || toneState.k2 || toneState.k3 || lookNow() || shapeNow());
    const laid = box.clientWidth > 0;   // 창이 뜨기 전(폭 0)에는 건너뛰고, 뜬 뒤 다시 맞춰요
    tidyRows(box, laid && box.dataset.shown !== tab); if (laid) box.dataset.shown = tab;   // 묶음을 바꾼 직후에만 고른 칩을 보이게(그 뒤에는 미는 대로 둬요)
}
export const syncMine = (sheet, item) => {
    if (!sheet || !item) return;
    const body = sheet.querySelector('.mart-tune-body'); if (body && !body.contains(document.activeElement)) { body.innerHTML = detailBody(item); syncTune(sheet, item); }
    const list = sheet.querySelector('.mart-tune-list'); if (list) list.innerHTML = mineHtml(item);
    const pl = sheet.querySelector('.mart-preset-list'); if (pl) pl.innerHTML = presetsHtml();
    tidyRows(sheet.querySelector('.mart-tune-save'), true);
};

/** 11-12 「글 고치기」 끄기(붙일 곳 흉내로 바꿀 때 — 흉내 글은 칸 번호가 달라요) */
export function stopEdit() { editing = false; }
/** 미리보기의 글 자리를 고쳐 쓸 수 있게(「글 고치기」가 켜져 있을 때만) — 11-12 공용 편집 모듈(edit-blocks.js): 점선 블록 · 그 자리 고치기 · 소품 전 · 후 · 칸 단위 되돌리기
 *  자리 번호는 tune.js editables 와 같은 차례(바탕 칸 뒤에 소품 글자 덧칸) */
const blocks = new WeakMap();
export const blocksOf = host => { let c = blocks.get(host); if (!c) { c = createEditBlocks(host, { label: '소품' }); blocks.set(host, c); } return c; };
export function armEdit(previewRoot, item) {
    if (!previewRoot || !item?.simple) return;
    const root = previewRoot.querySelector('.gk'); if (!root) return;
    for (const d of root.querySelectorAll('details[data-bl-spoiler]')) { d.open = editing; if (editing) d.dataset.blHold = 'true'; else delete d.dataset.blHold; }   // 고치는 동안은 숨긴 줄도 펼쳐 보여요(그래야 고쳐 쓰고 풀 수 있어요)
    blocksOf(previewRoot).setOn(editing);
    previewRoot.classList.toggle('is-editing', editing);
}

/** 압축된 테마 스타일 코드(BLS1. — deflate-raw)를 풀어 JSON 글자로 */
async function inflate(text) {
    const stream = new Blob([codeBytes(text)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
}
/** 지금 색 + 글 모양(프리셋에 담을 것) */
const capture = (item) => { const t = tuneOf(item.id) || {}; return { tone: { on: toneState.on, k: toneState.k, name: toneState.name, k2: toneState.k2, name2: toneState.name2, none: toneState.none }, colors: { inks: t.inks, prop: t.prop, own: t.own }, look: lookNow(), shape: shapeNow() }; };
/** 프리셋을 지금 틀에 입혀요 — 고쳐 쓴 글은 그대로 · 그 틀이 못 받는 값(없는 소품 색 등)은 아무 일도 안 해요 */
function applyPreset(item, p) {
    const { texts, mineTexts } = tuneOf(item.id) || {};
    setTune(item.id, { ...p.colors, ...(texts ? { texts } : {}), ...(mineTexts ? { mineTexts } : {}) });
    setLook(p.look); setShape(p.shape || null);
    setTone(p.tone.on ? { on: true, k: p.tone.k, name: p.tone.name, k2: p.tone.k2, name2: p.tone.name2 } : { on: false, k2: p.tone.k2, name2: p.tone.name2 });
    markPreset(p.id);
}

/** 크게 보기 창에 한 번만 걸어요 — current(): 지금 열린 카드 상태({ item }) · openItem(id): 그 틀의 크게 보기를 열어요 · say: 알림 */
export function wireTune(sheet, { current, openItem, say = () => {}, clip = null }) {
    let timer = 0, lookTimer = 0;
    const applyColor = (item, key, hex) => {
        if (!HEX.test(hex)) return;
        if (key === 'k') setTone({ on: true, k: hex, name: '' });
        else if (key === 'k2') setTone({ k2: hex, name2: '' });
        else if (key === 'k3') setTone({ k3: hex, name3: '' });
        else { const t = clone(tuneOf(item.id)); if (key === 'prop') t.prop = hex; else ((t.inks ??= {})[toneState.mode] ??= {})[key] = hex; setTune(item.id, t); }
    };
    const redraw = (item) => { const body = sheet.querySelector('.mart-tune-body'); if (body) body.innerHTML = detailBody(item); const dh = sheet.querySelector('.mart-detail-head'); if (dh) dh.outerHTML = detailHead(item); const box = sheet.querySelector('.mart-tune'); if (box) delete box.dataset.shown; syncTune(sheet, item); };
    // 칩 줄을 밀면 흐림을 다시 맞춰요(scroll 은 위로 안 올라와서 잡는 단계에서) · 창 크기가 바뀌어도
    sheet.addEventListener('toggle', (e) => { const g = e.target; if (!g?.classList?.contains('mart-group')) return; saveOpen(g.dataset.group, g.open); }, true);
    sheet.addEventListener('scroll', (e) => { if (e.target.classList?.contains('mart-hscroll')) fadeRow(e.target); }, true);
    addEventListener('resize', () => { if (sheet.open) tidyRows(sheet); });
    sheet.addEventListener('input', (e) => {
        const t = e.target, item = current()?.item; if (!item) return;
        if (t.matches?.('input[data-tune]')) {
            t.dataset.busy = '1';
            const dot = t.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = t.value;
            clearTimeout(timer); timer = setTimeout(() => applyColor(item, t.dataset.tune, t.value), 150);
            return;
        }
        if (t.matches?.('input[data-words-word]')) { clearTimeout(lookTimer); lookTimer = setTimeout(() => setWords({ word: t.value }), 250); return; }
        if (t.matches?.('input[data-head]')) {   // 머리 칸 글칸: 글 고치기와 같은 자리(tune.texts · 내 글이면 mineTexts) · 원래 글과 같으면 지워요
            const slots = headSlots(item), s = slots[t.dataset.head]; if (!s) return;
            clearTimeout(lookTimer); lookTimer = setTimeout(() => {
                const key = mineOn() ? 'mineTexts' : 'texts', cur = clone(tuneOf(item.id)), texts = cur[key] ??= {}, now = cleanRich(t.value);
                if (now === cleanRich(s.text) || !t.value.trim()) delete texts[s.i]; else texts[s.i] = now;
                setTune(item.id, cur);
            }, 250);
            return;
        }
        if (t.matches?.('[data-val], input[data-val-num]')) {   // 11-11 「이 틀」 값: 슬라이더 · 숫자 · 글자 · 날짜 — 틀 값과 같으면 지워요
            const key = t.dataset.val || t.dataset.valNum, f = fieldsOf(item.preview).find(x => x.key === key); if (!f) return;
            const isNum = f.kind === 'num', v = isNum ? Number(t.value) : t.value.trim();
            if (isNum) { const r = sheet.querySelector(`input[type=range][data-val="${key}"]`), n = sheet.querySelector(`input[data-val-num="${key}"]`); if (r && t !== r) r.value = v; if (n && t !== n) n.value = v; if (r) r.style.setProperty('--fill', `${Number((((Number(r.value) - f.min) / (f.max - f.min)) * 100).toFixed(1))}%`); }
            const ok = valOk(f, v); t.toggleAttribute('aria-invalid', !ok);   // 상한 · 범위 · 꼴을 넘으면 저장하지 않아요(칸이 빨개요)
            if (!ok) { if (!t.dataset.warned) { t.dataset.warned = '1'; say(f.kind === 'date' ? '월-일 꼴로 적어요(예 12-31)' : f.kind === 'chars' ? `${f.len}글자로 적어요` : isNum ? `${f.min}~${f.max} 사이로 적어요` : '글자가 길어요 · 틀 칸을 넘지 않게 줄여요', 2400); } return; }
            delete t.dataset.warned;
            valPending[key] = { v, def: f.def };   // 칸마다 모아 두었다가 한 번에(다른 칸을 바로 이어 바꿔도 안 잃어요)
            clearTimeout(valTimer); valTimer = setTimeout(() => { const cur = clone(tuneOf(item.id)), vals = cur.vals ??= {}; for (const [k, x] of Object.entries(valPending)) { if (String(x.v) === String(x.def) || x.v === '') delete vals[k]; else vals[k] = x.v; } valPending = {}; if (!Object.keys(vals).length) delete cur.vals; setTune(item.id, cur); }, 200);
            return;
        }
        if (t.matches?.('input[data-shape]')) {   // 11-12 모양 숫자 칸
            const f = SHAPE_FIELDS.find(x => x.path === t.dataset.shape), n = sheet.querySelector(`input[data-shape-num="${t.dataset.shape}"]`);
            if (f) { t.style.setProperty('--fill', fillOf({ ...f, min: Number(t.min), max: Number(t.max) }, Number(t.value))); if (n) n.value = numText(f, Number(t.value)); }
            clearTimeout(lookTimer); lookTimer = setTimeout(() => setShapeValue(t.dataset.shape, Number(t.value)), 120);
            return;
        }
        if (t.matches?.('input[data-look]')) {   // 슬라이더: 숫자는 바로 · 다시 칠하기는 0.12초 묶음
            const f = LOOK_FIELDS.find(x => x.path === t.dataset.look), n = sheet.querySelector(`input[data-look-num="${t.dataset.look}"]`);
            if (f) { t.style.setProperty('--fill', fillOf(f, Number(t.value))); if (n) n.value = numText(f, Number(t.value)); }
            clearTimeout(lookTimer); lookTimer = setTimeout(() => setLookValue(t.dataset.look, Number(t.value)), 120);
            return;
        }
        if (t.matches?.('input[data-look-color]')) {
            t.dataset.busy = '1';
            const dot = t.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = t.value;
            clearTimeout(lookTimer); lookTimer = setTimeout(() => setLookValue(t.dataset.lookColor, t.value), 150);
            return;
        }
        const ed = t.closest?.('.mart-sheet-preview [data-bl-ed]');
        if (ed && editing) {   // 글 고치기: 원래 글과 같아지면 그 자리 값은 지워요
            const key = mineOn() ? 'mineTexts' : 'texts', cur = clone(tuneOf(item.id)), texts = cur[key] ??= {}, i = ed.dataset.blEd;
            const base = editables(applyMine(item.preview)).map(x => x.text);   // 내 글이 켜져 있으면 내 글이 본
            const copy = ed.cloneNode(true); for (const s of copy.querySelectorAll('[data-bl-spoiler]')) s.replaceWith(...(s.querySelector(':scope > .blsp-c')?.childNodes || []));
            const now = cleanRich(copy.innerHTML);   // 꾸밈(줄바꿈 · 굵게 · 기울임 …)은 남기고 나머지는 글자만
            if (now === cleanRich(base[i])) delete texts[i]; else texts[i] = now;
            setTune(item.id, cur, { textOnly: true });
        }
    });
    sheet.addEventListener('change', (e) => {
        const t = e.target, item = current()?.item; if (!item) return;
        if (t.matches?.('input[data-tune]')) { delete t.dataset.busy; clearTimeout(timer); applyColor(item, t.dataset.tune, t.value); }
        else if (t.matches?.('input[data-look]')) { clearTimeout(lookTimer); setLookValue(t.dataset.look, Number(t.value)); }
        else if (t.matches?.('input[data-shape]')) { clearTimeout(lookTimer); setShapeValue(t.dataset.shape, Number(t.value)); }
        else if (t.matches?.('input[data-shape-num]')) { const raw = t.value.trim(), r = sheet.querySelector(`input[data-shape="${t.dataset.shapeNum}"]`); let v = raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw); if (v != null && r) v = Math.min(Number(r.max), Math.max(Number(r.min), v)); setShapeValue(t.dataset.shapeNum, v); syncTune(sheet, item); }
        else if (t.matches?.('input[data-look-num]')) {   // 숫자칸: 비우면 틀 그대로 · 범위 밖은 범위 안으로(look.js 가 다듬어요)
            const f = LOOK_FIELDS.find(x => x.path === t.dataset.lookNum), raw = t.value.trim();
            setLookValue(f.path, raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw) * (f.scale || 1));
            syncTune(sheet, item);
        }
        else if (t.matches?.('input[data-look-color]')) { delete t.dataset.busy; clearTimeout(lookTimer); setLookValue(t.dataset.lookColor, t.value); }
    });
    // 바로 고치기(테마 로그 복사 편집기 꼴): Enter = 줄바꿈(제목 · 이름 · 소리 이름표는 한 줄) · Ctrl+B 굵게 · Ctrl+I 기울임 · 붙여 넣기는 글만
    const ONE_LINE = '.gk-tt, .gk-nm, .gk-sn';
    sheet.addEventListener('keydown', (e) => {
        const ed = e.target.closest?.('.mart-sheet-preview [data-bl-ed]'); if (!ed || !editing) return;
        if (e.key === 'Enter') { e.preventDefault(); if (!ed.matches(ONE_LINE) && !e.isComposing) document.execCommand('insertLineBreak'); return; }
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && /^[bi]$/i.test(e.key)) { e.preventDefault(); document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic'); ed.dispatchEvent(new InputEvent('input', { bubbles: true })); }
    });
    sheet.addEventListener('paste', (e) => {
        const ed = e.target.closest?.('.mart-sheet-preview [data-bl-ed]'); if (!ed || !editing) return;
        e.preventDefault();
        let text = (e.clipboardData || globalThis.clipboardData)?.getData('text/plain') || '';
        if (ed.matches(ONE_LINE)) text = text.replace(/\s*\n\s*/g, ' ');
        document.execCommand('insertText', false, text);
    });
    // 되돌리기 · 다시하기: 값이 바뀔 때마다 0.5초 묶어 한 칸 · Ctrl+Z / Ctrl+Y(Ctrl+Shift+Z) — 글칸 · 입력칸 안에서는 그 칸의 되돌리기를 그대로 둬요(고쳐 쓰는 글 칸은 마트 되돌리기)
    // 숨기기 · 풀기에 쓸 마지막 고른 자리(단추를 누르면 고른 것이 풀리는 브라우저가 있어 미리 적어 둬요)
    let lastSel = null;
    document.addEventListener('selectionchange', () => {
        if (!editing || !sheet.open) return;
        const s = getSelection(), n = s?.anchorNode, ed = (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.('.mart-sheet-preview [data-bl-ed]');
        if (!ed) return;
        const spEl = ed.closest('[data-bl-spoiler]') || ed.querySelector(':scope > [data-bl-spoiler]');   // 11-12 지문 줄은 칸(div.blsp-p) 안에 숨긴 글이 있어요
        const text = s.rangeCount && ed.contains(s.getRangeAt(0).endContainer) ? s.toString().replace(/\s+/g, ' ').trim().slice(0, 200) : '';
        lastSel = { i: Number(ed.dataset.blEd), text, spoiler: !!spEl };
    });
    const onChange = () => { const item = current()?.item; if (sheet.open && item?.simple) { histRecord(item, sheet); syncHist(sheet); } };
    document.addEventListener('bl-tune-change', onChange);
    document.addEventListener('bl-tone-change', onChange);
    sheet.addEventListener('focusout', () => setTimeout(() => syncHist(sheet)));   // 11-12 칸 하나를 다 고치면(바깥 누르기 · Enter) 되돌리기 단추를 다시 맞춰요
    const undo = (step) => {
        const item = current()?.item; if (!item) return;
        // 11-12 밤(사용자 「되돌리기가 한 번밖에 안 돼」): 고친 글 · 조절 값을 한 차례표(hist)로 고친 차례대로 끝까지 되돌려요 — 글자를 치면 0.5초 묶음마다 한 칸
        const was = editing ? document.activeElement?.closest?.('.mart-sheet-preview [data-bl-ed]')?.dataset.blEd : null;
        if (histMove(item, step)) {
            redraw(item); syncMine(sheet, item); say(step < 0 ? '되돌렸어요' : '다시 했어요', 1400);
            // 미리보기는 새로 그려져요(캐릭터 색 다시 칠하기는 한 박자 뒤) — 고치던 칸이 있었으면 그 칸 끝에 커서를 다시 놓아요
            if (was != null) setTimeout(() => {
                const el = editing && sheet.open ? sheet.querySelector(`.mart-sheet-preview [data-bl-ed="${was}"]`) : null; if (!el || !el.isContentEditable) return;
                el.focus({ preventScroll: true });
                try { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const g = getSelection(); g.removeAllRanges(); g.addRange(r); } catch { /* 커서 자리는 없어도 돼요 */ }
            });
        }
        syncHist(sheet);
    };
    document.addEventListener('keydown', (e) => {
        if (!sheet.open || !current()?.item?.simple) return;
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
        const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
        if (e.target.closest?.('input, textarea, select')) return;
        if (e.target.closest?.('dialog') && !sheet.contains(e.target)) return;   // 다른 창(장바구니 등) 안이면 그 창 몫
        e.preventDefault();
        undo(k === 'y' || e.shiftKey ? 1 : -1);
    });
    // 고치는 동안 글자를 눌러도 소품(summary)이 열리고 닫히지 않게
    // 11-11 「글 고치기」 켠 동안은 소품이 안 눌려요(사용자 「글 고치는중에도 소품 눌림」): 미리보기 안 누름은 CSS(pointer-events)로 글 칸만 받고,
    //   그래도 들어온 누름(summary · label · 링크 · 단추)의 기본 동작은 막아요 — 제목 줄이 곧 누름 칸인 틀(견출지 · 낫표)에서 제목을 고쳐 써도 안 열리고 안 닫혀요
    const inPreview = e => editing && e.target.closest?.('.mart-sheet-preview');
    sheet.addEventListener('click', (e) => { if (inPreview(e) && e.target.closest('summary, label, a, button, input, audio')) e.preventDefault(); }, true);
    // 그래도 열림 상태가 바뀌면(키보드 · 브라우저 차이) 되돌려요
    sheet.addEventListener('toggle', (e) => { const d = e.target; if (!editing || !d?.matches?.('.mart-sheet-preview details') || d.classList.contains('gkt-k') || d.dataset.blHold === String(d.open)) return; d.dataset.blHold = String(!d.open); d.open = !d.open; }, true);
    sheet.addEventListener('click', async (e) => {
        const item = current()?.item; if (!item) return;
        const q = sel => e.target.closest?.(sel);
        let b;
        if ((b = q('[data-hist]'))) { undo(b.dataset.hist === 'redo' ? 1 : -1); return; }
        // ── 11-12 간편 | 세밀 ──
        if ((b = q('[data-view]'))) { setView(b.dataset.view); const wrap = sheet.querySelector('.mart-sheet-tune'); if (wrap) wrap.innerHTML = tuneHtml(item); const vs = sheet.querySelector('.mart-view'); if (vs) vs.outerHTML = viewSegHtml(item); const box = sheet.querySelector('.mart-tune'); if (box) delete box.dataset.shown; syncTune(sheet, item); wrap?.scrollIntoView?.({ block: 'nearest' }); return; }
        if ((b = q('[data-simple-style]'))) {   // 스타일 한 벌: 글 모양 · 움직임만 바꿔요(캐릭터 · 밤낮 · 이 틀 값 · 고친 글 · 레몬 · 글 크기는 그대로 — 「큼직하게」만 글 크기를 정해요)
            const x = LOOKS.find(v => v.id === b.dataset.simpleStyle); if (!x) return;
            const next = clone(x.look), step = x.look?.type?.sizeStep ?? stepOf(lookNow());
            if (step) (next.type ??= {}).sizeStep = step;
            if (lookValue('lemon.off') === true) next.lemon = { off: true };
            setLook(Object.keys(next).length ? next : null); setMotion(x.motion); setShape(x.shape || null); markPreset('');
            return;   // 11-12 알림 말풍선은 빼요 — 미리보기가 바로 바뀌고 잠깐 강조돼요(mart.js flashPreview)
        }
        if ((b = q('[data-simple-motion]'))) { const v = b.dataset.simpleMotion, cur = motionNow(); setMotion(v === 'prop' ? { text: '0', prop: cur.prop === '0' ? 'm' : cur.prop } : { text: v, prop: v }); return; }
        if ((b = q('[data-tex]'))) { const v = b.dataset.tex, t = texNow() || { on: 'b', level: 2 }; setTex(v === 'none' ? null : { ...t, tex: v }); redraw(item); return; }
        if ((b = q('[data-tex-on]'))) { setTex({ ...texNow(), on: b.dataset.texOn }); redraw(item); return; }
        if ((b = q('[data-tex-level]'))) { setTex({ ...texNow(), level: Number(b.dataset.texLevel) }); redraw(item); return; }
        if ((b = q('[data-tex-mg]'))) { setTex({ ...texNow(), margin: b.dataset.texMg === '1' }); redraw(item); return; }
        if ((b = q('[data-motion-speed]'))) { setMotion({ speed: b.dataset.motionSpeed }); redraw(item); return; }
        if ((b = q('[data-motion-open]'))) { setMotion({ open: b.dataset.motionOpen === '1' }); redraw(item); return; }
        if ((b = q('[data-shape-pick]'))) { const f = SHAPE_FIELDS.find(x => x.path === b.dataset.shapePick), v = JSON.parse(b.dataset.v); if (!f) return; setShapeValue(f.path, v === SHAPE_DEF[f.path] ? null : v); redraw(item); return; }
        if ((b = q('[data-shape-reset]'))) { setShapeValue(b.dataset.shapeReset, null); return; }
        if ((b = q('[data-motion-text]'))) { setMotion({ text: b.dataset.motionText }); redraw(item); return; }
        if ((b = q('[data-motion-prop]'))) { setMotion({ prop: b.dataset.motionProp }); redraw(item); return; }
        if ((b = q('[data-simple-size]'))) { const v = Number(b.dataset.simpleSize); const L = clone(lookNow()); if (L.type) delete L.type.size; setLook(L); setLookValue('type.sizeStep', v || null); return; }
        if (q('[data-simple-swap]')) { swapSpeakers(say); return; }
        if ((b = q('[data-simple-cover]'))) { setTone({ cover: b.dataset.simpleCover === '1' }); return; }
        if (q('[data-simple-reset]')) {   // 세밀에서 바꾼 것만 처음으로 — 스타일(맞는 한 벌이 있으면 그것) · 글 크기 · 캐릭터 · 밤낮 · 고친 글 · 숨긴 줄은 그대로
            const hit = styleNow(), step = stepOf(lookNow()), keep = hit ? clone(hit.look) : {};
            if (step) (keep.type ??= {}).sizeStep = step;
            setLook(Object.keys(keep).length ? keep : null);
            if (!hit) setMotion({ text: 'm', prop: 'm' });
            setShape(hit?.shape || null); setMotion({ speed: 'm', open: false });
            const { texts, mineTexts, spoilers, mineSpoilers } = tuneOf(item.id) || {};
            setTune(item.id, { texts, mineTexts, spoilers, mineSpoilers }); markPreset('');
            say('세밀에서 바꾼 것을 처음으로 돌렸어요', 2200); return;
        }
        if ((b = q('[data-spoiler]'))) {   // 숨기기: 「글 고치기」 중 고른 글(한 칸 안) · 풀기: 커서가 든 숨긴 글
            const key = mineOn() ? 'mineSpoilers' : 'spoilers', cur = clone(tuneOf(item.id)), list = cur[key] ??= [], sel = lastSel;
            const okCell = sel && ['gk-nr', 'gk-d'].some(c => sheet.querySelector(`.mart-sheet-preview [data-bl-ed="${sel.i}"]`)?.classList.contains(c));
            if (b.dataset.spoiler === 'wrap') {
                if (!okCell) { say('숨길 지문 · 대사 줄에 커서를 두세요', 2600); return; }
                if (list.some(x => x.i === sel.i)) return;
                list.push({ i: sel.i }); setTune(item.id, cur); say('그 줄을 눌러야 보이는 글로 숨겼어요', 2000);
            } else {
                if (!sel?.spoiler) { say('풀 숨긴 줄에 커서를 두세요', 2400); return; }
                cur[key] = list.filter(x => x.i !== sel.i); setTune(item.id, cur); say('숨긴 줄을 풀었어요', 2000);
            }
            return;
        }
        if ((b = q('[data-tune-tab]'))) { tab = b.dataset.tuneTab; if (TEXT_TABS.some(([id]) => id === tab)) textTab = tab; redraw(item); return; }
        if ((b = q('[data-group-reset]'))) { groupReset(item, b.dataset.groupReset); redraw(item); say('그 갈래를 처음으로 돌렸어요', 1800); return; }
        if (q('[data-detail-reset]')) { detailReset(item); redraw(item); say('세밀에서 바꾼 것을 처음으로 돌렸어요(캐릭터 · 밤낮 · 고친 글은 그대로)', 2400); return; }
        if ((b = q('[data-tune-flip]'))) { setTone({ flip: !toneState.flip }); redraw(item); return; }   // 11-13 낮 · 밤 전환 넣기
        if ((b = q('[data-tune-wrap]'))) { setWrap(b.dataset.tuneWrap); redraw(item); return; }   // 11-13 줄바꿈 글자 단위 · 단어 단위(카드 · 미리보기 · 복사 글은 'bl-tone-change' 로 다시 그려져요)
        if ((b = q('[data-tune-mode]'))) { setTone({ mode: b.dataset.tuneMode }); return; }   // 'auto' 면 기기 밝기를 따라요(tone-state.js)
        if ((b = q('[data-words-hide]'))) { setWords({ hide: b.dataset.wordsHide === '1' }); redraw(item); return; }
        if ((b = q('[data-words-name]'))) { const n = b.dataset.wordsName, off = wordsNow().off; setWords({ off: off.includes(n) ? off.filter(x => x !== n) : [...off, n] }); redraw(item); return; }
        if ((b = q('[data-words-forget]'))) { const n = b.dataset.wordsForget, w = wordsNow(); setWords({ names: w.names.filter(x => x !== n), off: w.off.filter(x => x !== n) }); redraw(item); return; }
        if ((b = q('[data-words-mask]'))) { setWords({ mask: b.dataset.wordsMask }); redraw(item); return; }
        if ((b = q('[data-words-rule-x]'))) { const i = Number(b.dataset.wordsRuleX); setWords({ rules: wordsNow().rules.filter((_, k) => k !== i) }); redraw(item); return; }
        if ((b = q('[data-head-show]'))) { const t = clone(tuneOf(item.id)); if (b.dataset.v === '0') t[b.dataset.headShow] = true; else delete t[b.dataset.headShow]; setTune(item.id, t); redraw(item); return; }
        if ((b = q('[data-tune-lines]'))) { const t = clone(tuneOf(item.id)), n = Number(b.dataset.tuneLines); if (n) t.lines = n; else delete t.lines; setTune(item.id, t); redraw(item); return; }
        if ((b = q('[data-tune-own]'))) { const t = clone(tuneOf(item.id)); t.own = b.dataset.tuneOwn !== '0'; if (ownOf({ own: t.own }) === ownOf({})) delete t.own; setTune(item.id, t); return; }   // 마트 칸과 같아지면 이 틀 값은 지워요
        if (q('[data-tune-edit]')) { editing = !editing; armEdit(sheet.querySelector('.mart-sheet-preview'), item); syncTune(sheet, item); return; }
        if ((b = q('[data-look-reset]'))) { setLookValue(b.dataset.lookReset, null); return; }
        if ((b = q('[data-look-pick]'))) { setLookValue(b.dataset.lookPick, JSON.parse(b.dataset.v)); redraw(item); return; }
        if ((b = q('[data-val-pick]'))) { const cur = clone(tuneOf(item.id)), f = fieldsOf(item.preview).find(x => x.key === b.dataset.valPick); if (!f) return; const vals = cur.vals ??= {}; const v = f.options.find(o => String(o) === b.dataset.v); if (String(v) === String(f.def)) delete vals[f.key]; else vals[f.key] = v; if (!Object.keys(vals).length) delete cur.vals; setTune(item.id, cur); redraw(item); return; }   // 11-11 「이 틀」 고르기 칩
        if ((b = q('[data-val-reset]'))) { const cur = clone(tuneOf(item.id)); if (cur.vals) { delete cur.vals[b.dataset.valReset]; if (!Object.keys(cur.vals).length) delete cur.vals; } setTune(item.id, cur); redraw(item); return; }
        if ((b = q('[data-lemon]'))) { setLookValue('lemon.off', b.dataset.lemon === '0' ? true : null); redraw(item); return; }
        if ((b = q('[data-look-toggle]'))) { setLookValue(b.dataset.lookToggle, lookValue(b.dataset.lookToggle) === true ? null : true); redraw(item); return; }
        if ((b = q('[data-look-target]'))) { const cur = { ...(lookValue('shadow.targets') || { dialogue: true }) }; if (cur[b.dataset.lookTarget]) delete cur[b.dataset.lookTarget]; else cur[b.dataset.lookTarget] = true; setLookValue('shadow.targets', Object.keys(cur).length ? cur : null); return; }
        if ((b = q('[data-tune-reset]'))) {
            const key = b.dataset.tuneReset;
            if (key === 'all') { setTune(item.id, null); setLook(null); setMotion({ text: 'm', prop: 'm', speed: 'm', open: false }); setTex(null); setShape(null); setTone({ on: false, k2: null, k3: null }); markPreset(''); syncMine(sheet, item); return; }
            if (key === 'k') { setTone({ on: false }); return; }
            if (key === 'k2') { setTone({ k2: null }); return; }
            if (key === 'k3') { setTone({ k3: null }); return; }
            const t = clone(tuneOf(item.id));
            if (key === 'prop') delete t.prop; else if (t.inks?.[toneState.mode]) delete t.inks[toneState.mode][key];
            setTune(item.id, t); return;
        }
        // ── 내 프리셋 ──
        if ((b = q('[data-preset-load]'))) { const p = presetList().find(x => x.id === b.dataset.presetLoad); if (!p) return; applyPreset(item, p); syncMine(sheet, item); say(`스타일 「${p.name}」을 입혔어요`, 2400); return; }
        if ((b = q('[data-preset-rename]'))) { const p = presetList().find(x => x.id === b.dataset.presetRename), f = sheet.querySelector('[data-form="preset"]'); if (!p || !f) return; f.dataset.rename = p.id; f.name.value = p.name; f.querySelector('button').textContent = '이름 바꾸기'; f.name.focus(); f.name.select(); return; }
        if ((b = q('[data-preset-forget]'))) { forgetPreset(b.dataset.presetForget); syncMine(sheet, item); return; }
        if (q('[data-preset-reset]')) { const { texts, mineTexts } = tuneOf(item.id) || {}; setTune(item.id, texts || mineTexts ? { ...(texts ? { texts } : {}), ...(mineTexts ? { mineTexts } : {}) } : null); setLook(null); setTone({ on: false, k2: null }); markPreset(''); syncMine(sheet, item); say('색과 글 모양을 기본으로 돌렸어요', 2400); return; }
        if ((b = q('[data-preset-io]'))) { const io = sheet.querySelector('.mart-preset-io'); io.hidden = !io.hidden; b.setAttribute('aria-expanded', String(!io.hidden)); if (!io.hidden) io.querySelector('textarea').focus(); return; }
        if (q('[data-preset-export]')) {
            const last = presetList().find(x => x.id === presetLast());
            const code = exportPreset({ name: last?.name || '내 스타일', ...capture(item) });
            const io = sheet.querySelector('.mart-preset-io'); io.hidden = false; sheet.querySelector('[data-preset-io]')?.setAttribute('aria-expanded', 'true');
            const ta = io.querySelector('textarea'); ta.value = code; ta.focus(); ta.select();
            try { await navigator.clipboard.writeText(code); say('프리셋 글자를 복사했어요 · 다른 기기의 「가져오기」에 붙여 넣어요', 3200); } catch { say('아래 칸의 글자를 복사해 가요', 3200); }
            return;
        }
        if (q('[data-preset-import]')) {
            const ta = sheet.querySelector('.mart-preset-io textarea'), text = ta.value.trim();
            let got = null;
            try { got = /^BLS1\./.test(text) ? importPreset(text, { json: await inflate(text) }) : importPreset(text); } catch { got = null; }
            if (!got) { say('읽을 수 없는 글자예요 · 프리셋 글자나 테마 스타일 코드를 통째로 붙여 넣어 주세요', 3600); return; }
            const row = savePreset(got.preset); if (!row) return;
            applyPreset(item, row); ta.value = ''; syncMine(sheet, item);
            say(got.from === 'theme' ? `테마 스타일에서 글 모양을 가져와 「${row.name}」로 기억하고 입혔어요(글꼴 · 색은 빼고요)` : `프리셋 「${row.name}」을 가져와 입혔어요`, 3600);
            return;
        }
        // ── 11-12 설정 파일 · 코드(blGeulkku 2) ──
        if ((b = q('[data-setx]'))) {
            const k = b.dataset.setx, io = sheet.querySelector('.mart-setx-io');
            if (k === 'file') { const name = String(item.name || item.label || '글꾸').replace(/[\\/:*?"<>|]+/g, ' ').trim(); downloadText(setFile(setNow(item, name)), `글꾸-${name}${SET_EXT}`); say(`설정 파일을 받았어요(${SET_EXT}) · 다른 기기 · 테마에서 「파일 가져오기」`, 3000); return; }
            if (k === 'pick') { sheet.querySelector('.mart-setx-file')?.click(); return; }
            if (k === 'code') {
                // 11-12 클립보드는 누른 순간에 열어요(압축 encodeSet 을 기다린 뒤 writeText 면 사파리가 막아요) — 코드는 Promise 로 넘기고 아래 칸에도 채워요
                const job = encodeSet(setNow(item)), copied = (clip ? clip(job) : job.then(c => navigator.clipboard.writeText(c)).then(() => true)).catch(() => false);
                const code = await job; if (io) { io.hidden = false; sheet.querySelector('[data-setx="paste"]')?.setAttribute('aria-expanded', 'true'); const ta = io.querySelector('textarea'); ta.value = code; ta.focus(); ta.select(); }
                say(await copied ? '코드를 복사했어요 · 다른 기기나 테마의 「코드 붙여 넣기」에' : '아래 칸의 코드를 복사해 가요', 3000);
                return;
            }
            if (k === 'paste') { if (io) { io.hidden = !io.hidden; b.setAttribute('aria-expanded', String(!io.hidden)); if (!io.hidden) io.querySelector('textarea').focus(); } return; }
            if (k === 'apply') { const ta = io?.querySelector('textarea'); const got = await readAny(ta?.value); if (!got) { say('읽을 수 없는 코드예요 · BLG1.… 코드나 설정 파일 내용을 통째로 붙여 넣어 주세요', 3600); return; } if (ta) ta.value = ''; takeSet(item, got); return; }
        }
        // ── 완성 프리셋(옛 이름 「내 글꾸」 — 기억 칸은 그대로 bl-mart-mine-v1) ──
        if ((b = q('[data-mine-load]'))) { loadSet(item, mineList().find(v => v.id === b.dataset.mineLoad)); return; }
        if ((b = q('[data-mine-down]'))) { const x = mineList().find(v => v.id === b.dataset.mineDown); if (x) { downloadSets([x], x.name); say(`「${x.name}」을 파일로 받았어요 · 다른 기기에서 「파일 가져오기」`, 2800); } return; }
        if (q('[data-sets-down]')) { const list = mineList(); if (!list.length) { say('기억한 완성 프리셋이 없어요', 2400); return; } downloadSets(list, `${list.length}개`); say(`완성 프리셋 ${list.length}개를 파일 하나로 받았어요`, 2800); return; }
        if (q('[data-sets-pick]')) { sheet.querySelector('.mart-sets-file')?.click(); return; }
        if ((b = q('[data-mine-forget]'))) { forgetMine(b.dataset.mineForget); syncMine(sheet, item); }
    });
    /** 11-12 설정(꼴 2) 입히기 — 캐릭터 · 밤낮 · 글 모양 · 움직임 · 질감 · 모양 + 틀 값(그 틀이 다르면 그 틀을 열어요) */
    const takeSet = (item, got) => {
        const r = readSet(got.set); if (!r) { say('읽을 수 없는 설정이에요', 3000); return; }
        const tn = r.tone;
        setTone({ ...(tn.on ? { on: true, k: tn.k, name: tn.name } : { on: false }), k2: tn.k2, name2: tn.name2, k3: tn.k3, name3: tn.name3, cover: tn.cover, mode: tn.auto ? 'auto' : tn.mode });
        setLook(r.look); setMotion(r.motion); setTex(r.tex); setShape(r.shape); markPreset('');
        const label = r.name ? `「${r.name}」` : '설정';
        if (r.frame) {
            const id = `simple-${r.frame}`; setTune(id, r.tune);
            if (id !== item.id && !openItem(id)) { say(`${label}의 틀(${r.frame})이 지금 목록에 없어요 · 스타일은 입혔어요`, 3400); syncMine(sheet, item); return; }
        }
        syncMine(sheet, item); say(`${label}을 입혔어요${got.from === 'theme' ? '(테마 스타일 — 글 모양만)' : got.from === 'old' ? '(예전 꼴에서 올렸어요)' : ''}`, 2800);
    };
    /** 완성 프리셋 불러오기 — 그 틀의 조절 값 · 깡통 · 깡캐 · 셋째 · 밤낮 · 글 모양을 그대로 · 다른 틀이면 그 틀을 열어요 */
    const loadSet = (item, x) => {
        if (!x) return;
        setTune(x.frame, x.tune);
        setTone({ ...(x.tone.on ? { on: true, k: x.tone.k, name: x.tone.name } : { on: false }), k2: x.tone.k2, name2: x.tone.name2, k3: x.tone.k3 ?? null, name3: x.tone.name3 ?? '', mode: x.tone.mode });
        if (x.look !== undefined) setLook(x.look);
        if (x.shape !== undefined) setShape(x.shape);
        if (x.motion) setMotion(x.motion);
        if (x.auto) setTone({ mode: 'auto' });
        if (x.frame !== item.id && !openItem(x.frame)) { say(`「${x.name}」의 틀(${x.frameName || x.frame})이 지금 목록에 없어요 · 값은 기억해 두었어요`, 3400); return; }
        say(`「${x.name}」을 불러왔어요`, 2400);
    };
    sheet.addEventListener('change', (e) => {   // 11-12 설정 파일 가져오기(예전 완성 프리셋 파일도)
        const input = e.target.closest?.('.mart-setx-file'); if (!input) return;
        const f = input.files?.[0]; input.value = ''; const item = current()?.item; if (!f || !item) return;
        if (f.size > 2e6) { say('파일이 너무 커요', 2400); return; }
        f.text().then(readAny).then((got) => { if (!got) { say(`설정 파일이 아니에요(${SET_EXT})`, 3000); return; } takeSet(item, got); }, () => say('파일을 못 읽었어요', 2400));
    });
    sheet.addEventListener('change', (e) => {
        const input = e.target.closest?.('.mart-sets-file'); if (!input) return;
        const f = input.files?.[0]; input.value = ''; const item = current()?.item; if (!f || !item) return;
        if (f.size > 2e6) { say('파일이 너무 커요', 2400); return; }
        f.text().then((text) => {
            const rows = addSets(readSets(text));
            if (!rows.length) { say('완성 프리셋 파일이 아니에요(.bl-mart-set.json)', 3000); return; }
            syncMine(sheet, item);
            if (rows.length === 1) loadSet(item, rows[0]); else say(`완성 프리셋 ${rows.length}개를 가져왔어요 · 목록에서 눌러 불러와요`, 3000);
        }, () => say('파일을 못 읽었어요', 2400));
    });
    sheet.addEventListener('submit', (e) => {
        const f = e.target.closest?.('.mart-tune-form'); if (!f) return;
        e.preventDefault();
        const item = current()?.item; if (!item) return;
        if (f.dataset.form === 'words-name') { const n = f.name.value.trim(), w = wordsNow(); if (!n) return; if (w.names.length >= MAX_NAMES) { say(`가릴 이름은 ${MAX_NAMES}개까지예요`, 2400); return; } setWords({ names: [...w.names, n], off: w.off.filter(x => x !== n) }); redraw(item); sheet.querySelector('[data-form="words-name"] [name=name]')?.focus(); return; }
        if (f.dataset.form === 'words-rule') { const from = f.from.value.trim(), to = f.to.value.trim(), w = wordsNow(); if (!from) return; if (w.rules.length >= MAX_RULES) { say(`바꿀 말은 ${MAX_RULES}개까지예요`, 2400); return; } setWords({ rules: [...w.rules.filter(r => r.from !== from), { from, to }] }); redraw(item); sheet.querySelector('[data-form="words-rule"] [name=from]')?.focus(); return; }
        if (f.dataset.form === 'preset') {
            if (f.dataset.rename) {
                const ok = renamePreset(f.dataset.rename, f.name.value);
                delete f.dataset.rename; f.querySelector('button').textContent = '스타일 저장';
                if (!ok) { say('그 이름은 못 써요(비었거나 이미 있어요)', 2600); return; }
                f.name.value = ''; syncMine(sheet, item); return;
            }
            const row = savePreset({ name: f.name.value, ...capture(item) });
            if (!row) { say('이름을 넣어 주세요', 2400); return; }
            f.name.value = ''; syncMine(sheet, item);
            say(`스타일 「${row.name}」을 기억했어요 · 어느 틀에서든 눌러 입혀요`, 3000);
            return;
        }
        const row = saveMine({ frame: item.id, frameName: item.name || item.label, name: f.name.value, tone: { on: toneState.on, k: toneState.k, name: toneState.name, k2: toneState.k2, name2: toneState.name2, k3: toneState.k3, name3: toneState.name3, mode: toneState.mode, none: toneState.none, auto: toneState.auto }, tune: tuneOf(item.id), look: lookNow(), shape: shapeNow(), motion: motionNow() });
        if (!row) { say('이름을 넣어 주세요', 2400); return; }
        f.name.value = ''; syncMine(sheet, item);
        say(`「${row.name}」을 완성 프리셋으로 기억했어요 · 이 브라우저에 남아요 · 파일로도 받아 가요`, 3000);
    });
}
