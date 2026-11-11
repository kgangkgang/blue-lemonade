// 11-10 글꾸 마트 목록 위 「캐릭터」 — 고른 캐릭터 대사색(K) · 밤/낮 · 기억한 캐릭터.
//   사용자 「가브리엘 글꾸 누르고 그안에서 글꾸 디자인고르는거지」 · 「일단 내가 대사색깔지정해둔애들은 그 색깔바탕으로 글꾸해주면좋겠음」
//   - 기본 목록: 사용자가 정해 둔 캐릭터 대사색(CAST) + 「캐릭터 없음」(무채) + 「직접 색」. 이 브라우저에 기억한 캐릭터가 기본 목록 위에 와요.
//   - 블루레몬 로그 복사에서 넘어올 때: 주소 ?k=3aa7ff&name=이름&tone=dark|light → 그 캐릭터를 기억하고 골라요.
//   - 「원래 색」을 고르면 다시 칠하기를 꺼요(지금까지의 마트 모양).
//   - 11-11 「상대」(둘째 화자 · 견본 글의 「친구」) 색 k2 · name2 — 안 고르면 틀이 정해 둔 색 그대로예요.
//   목록 · 상세 창(mart.js) · 시식 창(taste.js) · 캐릭터 줄(cast.js)이 같이 읽고, 바뀌면 'bl-tone-change' 를 알려요.
import { toneHtml, toneMixHtml, speakerColor, PAPER_COLORS, TEXTURES } from './tone-geulkku.js?v=20261110v';
import { toneSimple, ORIGINAL } from './simple-frames.js?v=20261111y';
import { applyLook, lookRev } from './look.js?v=20261111y';   // 11-11 글 모양(테마 「글자」 탭 축소판 — 글꼴 · 크기 · 자간 · 그림자 …) — 값이 없으면 그대로
import { tuneOf, tuneRev, applyTune } from './tune.js?v=20261111y';
import { applyWords, wordsRev } from './words.js?v=20261111y';   // 11-11 「도구」 — 이름 숨김 · 단어 바꾸기(모든 틀 · 글자만)
import { applyMine, mineOn, mineRev, mineInfo } from './mine-text.js?v=20261111y';   // 11-11 「내 글 넣기」 — 켜져 있으면 견본 글 대신 내 글   // 11-11 조절 칸(틀 하나의 글자색 · 소품 색 · 고쳐 쓴 글) — 값이 없으면 그대로   // 11-11 심플 새 틀(클래스 + 틀 안 <style>) — 색 블록만 갈아 끼우고 낮 · 밤은 뿌리 클래스
export { PAPER_COLORS, TEXTURES };

/** 11-10 밤 사용자 「음 그라데이션 과감하게 빼자... 구리다...」 — 혼합(2~3색 그라데이션)은 꺼 두고 스위치도 안 보여요. 코드는 남겨 둬요(true 로 바꾸면 돌아와요) */
export const MIX_ENABLED = false;
export const TONE_KEY = 'bl-mart-tone-v1';
export const CAST_KEY = 'bl-mart-cast-v1';
/** 사용자가 정해 둔 캐릭터 대사색 — 데우스 대사색 표(카드별 bl_cast_<카드> · 사용자 것)를 세계관(카드)별로 묶었어요.
 *  천지합동학원 · 센티넬버스 아카데미는 같은 사람들이라 천지합동청 · 센티넬버스에 합쳤어요.
 *  11-11 D&H 묶음의 두 사람(호박 금빛 #f2b33d · 회청 #8fa3b8)은 대사색 표에 없어 원 자료의 생김새에 맞춰 마트가 정한 색이에요(순서는 원 자료 주요 인물 순서).
 *  사용자 본인(페르소나)은 기본 목록에 넣지 않아요 — 「직접 색」으로 이 브라우저에만 기억해요. */
export const CAST_GROUPS = Object.freeze([
    { id: 'halo', label: '천지합동청', sub: '천사 · 악마', cast: [['가브리엘', '#3aa7ff'], ['우리엘', '#7fe03c'], ['자드키엘', '#3ccfbf'], ['라파엘', '#7fd4ea'], ['미카엘', '#f0d878'], ['우지엘', '#6676d9'], ['아델스타인', '#5b7fd1'], ['루시퍼', '#79a9d8'], ['사탄', '#e63946'], ['아스모데우스', '#ff5fa2'], ['벨포드', '#b799e8'], ['레비', '#ffa04a'], ['릴', '#ff5a3c']] },
    { id: 'dh', label: 'D&H · 아드리안', sub: '', cast: [['백영현', '#efe3b4'], ['한이안', '#4cb4ff'], ['엘리어스 애션포드', '#ff5c8a'], ['진 강', '#c8a07a'], ['이세나', '#f2b33d'], ['서미란', '#8fa3b8'], ['유수호', '#4fd8a4'], ['아드리안 폰 아이젠베르크', '#ff6f45']] },
    { id: 'gangho', label: '무협시뮬', sub: '', cast: [['구야', '#ff7572'], ['야신', '#ffcc00'], ['백헌', '#f6ae87'], ['묵향', '#24b4d2'], ['당휘', '#3fb475'], ['윤소한', '#99b460'], ['서연진', '#84abba']] },
    { id: 'sentinel', label: '센티넬버스', sub: '', cast: [['차이현', '#9b8ec4'], ['백시우', '#d19cff'], ['강태오', '#ff6a4d'], ['이시온', '#a8d86a'], ['서준영', '#9ec8f0'], ['류서휘', '#7fbfa8'], ['레온 체하르', '#f5c84c'], ['권무진', '#d9985c'], ['김이한', '#c9bda6'], ['은설', '#e8e4f2'], ['신재이', '#4f8dff']] },
].map(g => Object.freeze({ ...g, cast: Object.freeze(g.cast.map(([name, color]) => Object.freeze({ name, color, group: g.id }))) })));
export const CAST = Object.freeze(CAST_GROUPS.flatMap(g => g.cast));

const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 기억 못 해도 이번 화면에서는 써요 */ } };
const cleanName = s => String(s ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 20);

/** 기억한 캐릭터(최근 것이 앞) */
export function savedCast() {
    const list = read(CAST_KEY, []);
    return Array.isArray(list) ? list.map(x => ({ name: cleanName(x?.name), color: speakerColor(x?.color) })).filter(x => x.name && x.color).slice(0, 30) : [];
}
export function rememberCast(name, color) {
    const n = cleanName(name), c = speakerColor(color);
    if (!n || !c) return null;
    const list = savedCast().filter(x => x.name !== n);
    list.unshift({ name: n, color: c });
    write(CAST_KEY, list.slice(0, 30));
    return { name: n, color: c };
}
export function forgetCast(name) { write(CAST_KEY, savedCast().filter(x => x.name !== cleanName(name))); }
/** 아는 캐릭터 전부: 기억한 것(먼저) → 기본 목록 */
export function castList() {
    return [...savedCast().map(x => ({ ...x, saved: true })), ...CAST.map(x => ({ ...x }))];
}

export const toneState = (() => {
    let q = new URLSearchParams('');
    try { q = new URLSearchParams(location.search); } catch { /* 주소 없음(시험) */ }
    const saved = read(TONE_KEY, {}) || {};
    let k = speakerColor(saved.k), name = cleanName(saved.name), on = saved.on !== false && (!!speakerColor(saved.k) || saved.none === true), none = saved.none === true, mode = saved.mode === 'light' ? 'light' : 'dark';
    // 11-10 혼합(최대 3색) · 종이 색 · 질감
    let mix = MIX_ENABLED && saved.mix === true;
    let picks = Array.isArray(saved.picks) ? saved.picks.map(x => ({ name: cleanName(x?.name), color: speakerColor(x?.color) })).filter(x => x.color).slice(0, 3) : [];
    const paper = Object.hasOwn(PAPER_COLORS, saved.paper) ? saved.paper : 'white', texture = Object.hasOwn(TEXTURES, saved.texture) && !TEXTURES[saved.texture].hidden ? saved.texture : 'plain';
    if (q.has('k')) {
        k = speakerColor(`#${String(q.get('k')).replace(/^#/, '')}`); on = true;
        name = cleanName(q.get('name')) || name;
        if (k && q.get('name')) rememberCast(q.get('name'), k);
    }
    if (q.has('tone')) { mode = q.get('tone') === 'light' ? 'light' : 'dark'; on = q.get('tone') !== 'off'; }
    // 11-11 상대(둘째 화자) 색 — 없으면 틀이 정해 둔 색 그대로
    let k2 = speakerColor(saved.k2) || null, name2 = k2 ? cleanName(saved.name2) : '';
    if (q.has('k2')) { k2 = speakerColor(`#${String(q.get('k2')).replace(/^#/, '')}`) || null; name2 = k2 ? cleanName(q.get('name2')) : ''; }
    // 11-11 「소품도 캐릭터 색」(기본 켬): 캐릭터를 고르면 기본 색 틀(sk-own)의 소품도 캐릭터 색으로 덮어요 · 끄면 소품은 기본 색 그대로 글 쪽만
    const cover = saved.cover !== false;
    return { on, k, mode, name, mix, picks, paper, texture, none, k2, name2, cover };
})();
/** 캐릭터 · 밤낮 · 켬을 바꿔요(기억하고 'bl-tone-change' 를 알려요) */
export function setTone(next = {}) {
    if ('k' in next) toneState.k = speakerColor(next.k);
    if ('name' in next) toneState.name = cleanName(next.name);
    if ('mode' in next) toneState.mode = next.mode === 'light' ? 'light' : 'dark';
    if ('on' in next) toneState.on = !!next.on;
    if ('k' in next || 'on' in next) toneState.none = toneState.on && !toneState.k;   // 11-11 「캐릭터 없음(무채)」을 직접 고른 것만 기억해요(아무것도 안 골랐으면 원래 색)
    if ('k2' in next) { toneState.k2 = speakerColor(next.k2) || null; if (!toneState.k2) toneState.name2 = ''; }
    if ('name2' in next) toneState.name2 = toneState.k2 ? cleanName(next.name2) : '';
    if ('mix' in next) toneState.mix = MIX_ENABLED && !!next.mix;
    if ('picks' in next) toneState.picks = (next.picks || []).map(x => ({ name: cleanName(x?.name), color: speakerColor(x?.color) })).filter(x => x.color).slice(0, 3);
    if ('paper' in next && Object.hasOwn(PAPER_COLORS, next.paper)) toneState.paper = next.paper;
    if ('texture' in next && Object.hasOwn(TEXTURES, next.texture) && !TEXTURES[next.texture].hidden) toneState.texture = next.texture;
    if ('cover' in next) toneState.cover = next.cover !== false;
    write(TONE_KEY, { ...(toneState.cover ? {} : { cover: false }), k: toneState.k, name: toneState.name, mode: toneState.mode, on: toneState.on, none: toneState.none, mix: toneState.mix, picks: toneState.picks, paper: toneState.paper, texture: toneState.texture, ...(toneState.k2 ? { k2: toneState.k2, name2: toneState.name2 } : {}) });
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { ...toneState } })); } catch { /* 시험 */ }
}
/** 다시 칠할 글꾸인가(로그 글꾸만 — 게시글 틀 photo 는 자기 색 그대로 · 단 심플 새 틀 simple 은 게시글 틀이어도 캐릭터 색으로) */
//   11-11 심플 새 틀은 늘 이 길로 — 캐릭터를 안 골랐으면(원래 색) 틀을 만든 색 그대로 낮 · 밤만 바꿔요(첫인상 = 합격한 시안 색)
/** 캐릭터를 골랐나(깡통 캐릭터 · 캐릭터 없음(무채) · 깡캐 중 하나라도) — 안 골랐으면 「원래 색」 */
export const castPicked = () => toneState.on || !!toneState.k2;
/**
 * 11-11 기본 색 틀(뿌리 sk-own)의 소품을 어떻게 — false 면 sk-own 을 떼어 캐릭터 색으로 · undefined 면 기본 색 그대로.
 *   원래 색 → 기본 색 · 캐릭터를 고르면 「소품도 캐릭터 색」(toneState.cover · 기본 켬)을 따라요 · 틀마다 고른 값(tune own true/false)이 있으면 그것이 먼저.
 */
export const ownOf = t => (t?.own === false ? false : t?.own === true ? undefined : castPicked() && toneState.cover ? false : undefined);
export const toned = item => item?.kind === 'geulkku' && (item.simple ? true : toneState.on && !item.photo);
/** 다 그린 글꾸 HTML 을 고른 대사색으로(꺼져 있으면 그대로) */
export const toneOut = (item, html) => {
    if (!html || !toned(item)) return html;
    if (item.simple) { const t = tuneOf(item.id), out = toneSimple(applyMine(html), toneState.on ? toneState.k : ORIGINAL, { mode: toneState.mode, other: toneState.k2, prop: t?.prop, own: ownOf(t) }); const shaped = applyLook(out), tuned = t ? applyTune(shaped, t, { mine: mineOn() }) : shaped; return applyWords(tuned, { auto: mineOn() ? mineInfo()?.names || [] : ['깡통', '깡캐'], mode: toneState.mode }); }   // 종이 색 · 질감은 심플 새 틀에 안 걸어요(이식-설계 1-3 「처음엔 종이 고르기에서 빼요」)
    const roles = item.colors || item.palette || null, opt = { mode: toneState.mode, paper: toneState.paper, texture: toneState.texture };
    const ks = toneState.mix ? toneState.picks.map(x => x.color) : [];
    return ks.length >= 2 ? toneMixHtml(html, roles, ks, opt) : toneHtml(html, roles, toneState.k, opt);
};
/** 다시 칠하기 값이 바뀌었는지 알아보는 열쇠(카드마다 그린 것을 다시 쓸지) */
export const toneKey = () => JSON.stringify([toneState.cover, toneState.on, toneState.k, toneState.mode, toneState.mix, toneState.picks.map(x => x.color), toneState.paper, toneState.texture, toneState.k2, tuneRev(), lookRev(), mineRev(), wordsRev()]);
