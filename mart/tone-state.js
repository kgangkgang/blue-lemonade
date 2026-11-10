// 11-10 글꾸 마트 목록 위 「캐릭터」 — 고른 캐릭터 대사색(K) · 밤/낮 · 기억한 캐릭터.
//   사용자 「가브리엘 글꾸 누르고 그안에서 글꾸 디자인고르는거지」 · 「일단 내가 대사색깔지정해둔애들은 그 색깔바탕으로 글꾸해주면좋겠음」
//   - 기본 목록: 사용자가 정해 둔 캐릭터 대사색(CAST) + 「캐릭터 없음」(무채) + 「직접 색」. 이 브라우저에 기억한 캐릭터가 기본 목록 위에 와요.
//   - 블루레몬 로그 복사에서 넘어올 때: 주소 ?k=3aa7ff&name=이름&tone=dark|light → 그 캐릭터를 기억하고 골라요.
//   - 「원래 색」을 고르면 다시 칠하기를 꺼요(지금까지의 마트 모양).
//   목록 · 상세 창(mart.js) · 시식 창(taste.js) · 캐릭터 줄(cast.js)이 같이 읽고, 바뀌면 'bl-tone-change' 를 알려요.
import { toneHtml, toneMixHtml, speakerColor, PAPER_COLORS, TEXTURES } from './tone-geulkku.js?v=20261110v';
import { toneSimple, ORIGINAL } from './simple-frames.js?v=20261111a';   // 11-11 심플 새 틀(클래스 + 틀 안 <style>) — 색 블록만 갈아 끼우고 낮 · 밤은 뿌리 클래스
export { PAPER_COLORS, TEXTURES };

/** 11-10 밤 사용자 「음 그라데이션 과감하게 빼자... 구리다...」 — 혼합(2~3색 그라데이션)은 꺼 두고 스위치도 안 보여요. 코드는 남겨 둬요(true 로 바꾸면 돌아와요) */
export const MIX_ENABLED = false;
export const TONE_KEY = 'bl-mart-tone-v1';
export const CAST_KEY = 'bl-mart-cast-v1';
/** 사용자가 정해 둔 캐릭터 대사색 — 데우스 대사색 표(카드별 bl_cast_<카드> · 사용자 것)를 세계관(카드)별로 묶었어요.
 *  천지합동학원 · 센티넬버스 아카데미는 같은 사람들이라 천지합동청 · 센티넬버스에 합쳤어요.
 *  확실하지 않은 묶음은 「기타」: 카드 Michael Kaiser · Reo Mikage · Seishiro Nagi 의 세 사람. 사용자 본인(페르소나)은 기본 목록에 넣지 않아요 — 「직접 색」으로 이 브라우저에만 기억해요. */
export const CAST_GROUPS = Object.freeze([
    { id: 'halo', label: '천지합동청', sub: '천사 · 악마', cast: [['가브리엘', '#3aa7ff'], ['우리엘', '#7fe03c'], ['자드키엘', '#3ccfbf'], ['라파엘', '#7fd4ea'], ['미카엘', '#f0d878'], ['우지엘', '#6676d9'], ['아델스타인', '#5b7fd1'], ['루시퍼', '#79a9d8'], ['사탄', '#e63946'], ['아스모데우스', '#ff5fa2'], ['벨포드', '#b799e8'], ['레비', '#ffa04a'], ['릴', '#ff5a3c']] },
    { id: 'dh', label: 'D&H · 아드리안', sub: '', cast: [['백영현', '#efe3b4'], ['한이안', '#4cb4ff'], ['엘리어스 애션포드', '#ff5c8a'], ['진 강', '#c8a07a'], ['유수호', '#4fd8a4'], ['아드리안 폰 아이젠베르크', '#ff6f45']] },
    { id: 'gangho', label: '무협시뮬', sub: '', cast: [['구야', '#ff7572'], ['야신', '#ffcc00'], ['백헌', '#f6ae87'], ['묵향', '#24b4d2'], ['당휘', '#3fb475'], ['윤소한', '#99b460'], ['서연진', '#84abba']] },
    { id: 'sentinel', label: '센티넬버스', sub: '', cast: [['차이현', '#9b8ec4'], ['백시우', '#d19cff'], ['강태오', '#ff6a4d'], ['이시온', '#a8d86a'], ['서준영', '#9ec8f0'], ['류서휘', '#7fbfa8'], ['레온 체하르', '#f5c84c'], ['권무진', '#d9985c'], ['김이한', '#c9bda6'], ['은설', '#e8e4f2'], ['신재이', '#4f8dff']] },
    { id: 'etc', label: '기타', sub: '', cast: [['미하엘 카이저', '#5ac8ff'], ['미카게 레오', '#c08cff'], ['나기 세이시로', '#d0d8e0']] },
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
    return { on, k, mode, name, mix, picks, paper, texture, none };
})();
/** 캐릭터 · 밤낮 · 켬을 바꿔요(기억하고 'bl-tone-change' 를 알려요) */
export function setTone(next = {}) {
    if ('k' in next) toneState.k = speakerColor(next.k);
    if ('name' in next) toneState.name = cleanName(next.name);
    if ('mode' in next) toneState.mode = next.mode === 'light' ? 'light' : 'dark';
    if ('on' in next) toneState.on = !!next.on;
    if ('k' in next || 'on' in next) toneState.none = toneState.on && !toneState.k;   // 11-11 「캐릭터 없음(무채)」을 직접 고른 것만 기억해요(아무것도 안 골랐으면 원래 색)
    if ('mix' in next) toneState.mix = MIX_ENABLED && !!next.mix;
    if ('picks' in next) toneState.picks = (next.picks || []).map(x => ({ name: cleanName(x?.name), color: speakerColor(x?.color) })).filter(x => x.color).slice(0, 3);
    if ('paper' in next && Object.hasOwn(PAPER_COLORS, next.paper)) toneState.paper = next.paper;
    if ('texture' in next && Object.hasOwn(TEXTURES, next.texture) && !TEXTURES[next.texture].hidden) toneState.texture = next.texture;
    write(TONE_KEY, { k: toneState.k, name: toneState.name, mode: toneState.mode, on: toneState.on, none: toneState.none, mix: toneState.mix, picks: toneState.picks, paper: toneState.paper, texture: toneState.texture });
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { ...toneState } })); } catch { /* 시험 */ }
}
/** 다시 칠할 글꾸인가(로그 글꾸만 — 게시글 틀 photo 는 자기 색 그대로 · 단 심플 새 틀 simple 은 게시글 틀이어도 캐릭터 색으로) */
//   11-11 심플 새 틀은 늘 이 길로 — 캐릭터를 안 골랐으면(원래 색) 틀을 만든 색 그대로 낮 · 밤만 바꿔요(첫인상 = 합격한 시안 색)
export const toned = item => item?.kind === 'geulkku' && (item.simple ? true : toneState.on && !item.photo);
/** 다 그린 글꾸 HTML 을 고른 대사색으로(꺼져 있으면 그대로) */
export const toneOut = (item, html) => {
    if (!html || !toned(item)) return html;
    if (item.simple) return toneSimple(html, toneState.on ? toneState.k : ORIGINAL, { mode: toneState.mode });   // 종이 색 · 질감은 심플 새 틀에 안 걸어요(이식-설계 1-3 「처음엔 종이 고르기에서 빼요」)
    const roles = item.colors || item.palette || null, opt = { mode: toneState.mode, paper: toneState.paper, texture: toneState.texture };
    const ks = toneState.mix ? toneState.picks.map(x => x.color) : [];
    return ks.length >= 2 ? toneMixHtml(html, roles, ks, opt) : toneHtml(html, roles, toneState.k, opt);
};
/** 다시 칠하기 값이 바뀌었는지 알아보는 열쇠(카드마다 그린 것을 다시 쓸지) */
export const toneKey = () => JSON.stringify([toneState.on, toneState.k, toneState.mode, toneState.mix, toneState.picks.map(x => x.color), toneState.paper, toneState.texture]);
