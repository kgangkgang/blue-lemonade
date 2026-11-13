// 11-12 밤 원작(출처) 자료 한 곳 — 글꾸 마트 캐릭터 색 · 이름(cast.js) · 옛 세계관 글꾸 분류(mart.js SOURCES) · 액자 마트(frame-room.js)가 모두 여기서 읽어요.
//   사용자 「글꾸 마트는 왜 출처가 없냐 은설이 무슨 캐릭터인지 알려 줘야 할 거 아냐 링크 다 어디 감」 · 「원작자가 버젓이 있는데」.
//   11-11 새벽 글꾸 마트를 새 틀(심플)로 바꾸며 세계관 · 캐릭터 글꾸 카드(카드마다 원작 링크)가 빠졌고, 캐릭터는 목록 위 「깡통 · 깡캐」 색 칸으로 옮겨 갔는데 그 칸에는 원작 줄을 안 만들었어요 — 되살려요.
//   주소는 원작자가 깡통에 올린 글(사용자가 글꾸 마트 자랑 글 시리즈에 걸어 둔 아홉 글 + 아드리안 둘째 글 = 열). 제목은 마트가 써 온 표기 그대로예요.
//   DOM 없는 순수 모듈(node 시험 tools/geulkku-simple-test.mjs 가 「모든 캐릭터에 원작 · 아홉 주소 전부」를 잠가요).
const P = 'https://kkangtong.xyz/posts/';
/** 원작 봇(세계관) */
export const WORKS = Object.freeze({
    halo: Object.freeze({ title: '천악 오피스물 ~천지합동청 H.A.L.O~', url: `${P}54677` }),
    hunter: Object.freeze({ title: '헌터물 시뮬봇 「Dungeons & Hunters」', url: `${P}5150` }),
    gangho: Object.freeze({ title: '미완성인 무협 시뮬레이션', url: `${P}78795` }),
    adrian: Object.freeze({ title: '독일 출생 수석 지휘자', url: `${P}81234` }),
    adrianMod: Object.freeze({ title: '헌시뮬 지휘자 아드리안 캐릭터 추가모드', url: `${P}43794` }),   // 11-12 밤 사용자 「아드리안은 링크가 2개라 2개 다 걸어 줘」
    sengaSim: Object.freeze({ title: '[실리/1차] 센티넬버스 시뮬레이션(센가시뮬) v1.3', url: `${P}29037` }),
    sengaAcademy: Object.freeze({ title: '[실리/1차] 센티넬버스 아카데미', url: `${P}99019` }),
});
/** 캐릭터마다 따로 공유된 깡캐 글 */
export const CHAR_WORKS = Object.freeze({
    uziel: Object.freeze({ name: '우지엘', title: 'MZ가 되고 싶은 최초의 세라프(우지엘)', url: `${P}127563` }),
    lucifer: Object.freeze({ name: '루시퍼', title: '미카엘 쌍둥이 친형 · 칠죄종 타락천사 루시퍼', url: `${P}78569` }),
    asmodeus: Object.freeze({ name: '아스모데우스', title: '나 때찌해줘 갸루오지상(아스모데우스)', url: `${P}155899` }),
});
/** 캐릭터 묶음(tone-state.js CAST_GROUPS 의 id) → 원작 */
export const GROUP_WORKS = Object.freeze({ halo: ['halo'], dh: ['hunter', 'adrian', 'adrianMod'], gangho: ['gangho'], sentinel: ['sengaSim', 'sengaAcademy'] });
/** 아드리안의 원작 글은 둘(봇 글 + 헌시뮬 추가모드 글) — 어디서든 둘을 나란히 걸어요 */
const ADRIAN = Object.freeze(['adrian', 'adrianMod']);
export const ADRIAN_WORKS = Object.freeze(ADRIAN.map(k => WORKS[k]));
/** 11-12 밤 세계관(글꾸 틀 분류 「세계관 · 인물」의 하위 칩) — id 는 목록 자료(index.json 항목 world) · group 은 캐릭터 묶음(tone-state.js CAST_GROUPS) · works 는 그 세계관의 원작 글 전부 · chars 는 그 세계관 인물의 캐릭터 글 */
export const WORLDS = Object.freeze([
    Object.freeze({ id: 'halo', label: '천지합동청', group: 'halo', works: Object.freeze(['halo']), chars: Object.freeze(['uziel', 'lucifer', 'asmodeus']) }),
    Object.freeze({ id: 'hunter', label: 'D&H', group: 'dh', works: Object.freeze(['hunter']), chars: Object.freeze([]) }),
    Object.freeze({ id: 'adrian', label: '아드리안', group: 'dh', works: ADRIAN, chars: Object.freeze([]) }),
    Object.freeze({ id: 'gangho', label: '무협시뮬', group: 'gangho', works: Object.freeze(['gangho']), chars: Object.freeze([]) }),
    Object.freeze({ id: 'sentinel', label: '센티넬버스', group: 'sentinel', works: Object.freeze(['sengaSim', 'sengaAcademy']), chars: Object.freeze([]) }),
]);
export const worldOf = id => WORLDS.find(w => w.id === id) || null;
/** 원작 열쇠(WORKS · CHAR_WORKS 의 이름) → 원작 줄 { kind, title, url } · 모르는 열쇠는 null */
export const sourceByKey = key => (WORKS[key] ? { kind: '원작', ...WORKS[key] } : CHAR_WORKS[key] ? { kind: '깡캐', title: CHAR_WORKS[key].title, url: CHAR_WORKS[key].url } : null);
/** 글꾸 틀 한 장의 원작 줄들(목록 자료의 src — 열쇠 배열) */
export const itemSources = item => (Array.isArray(item?.src) ? item.src.map(sourceByKey).filter(Boolean) : []);
/** 세계관 하나의 원작 줄 전부(원작 글 + 그 세계관 인물의 캐릭터 글) */
export const worldSources = id => { const w = worldOf(id); return w ? [...w.works, ...w.chars].map(sourceByKey).filter(Boolean) : []; };
/** 한 묶음 안에서 원작이 갈리는 캐릭터(D&H · 아드리안 묶음) */
const ONLY = Object.freeze({ dh: name => (name === '아드리안 폰 아이젠베르크' ? ADRIAN : ['hunter']) });
/** 묶음 이름표(「원작」 칸) */
export const GROUP_LABELS = Object.freeze({ halo: '천지합동청', dh: 'D&H · 아드리안', gangho: '무협시뮬', sentinel: '센티넬버스' });

/** 그 캐릭터의 원작 줄들: [{ kind: '원작' | '깡캐', title, url }] — 묶음에 없는 캐릭터(내가 기억한 색)는 [] */
export function castSources(name, group) {
    const keys = ONLY[group] ? ONLY[group](name) : GROUP_WORKS[group] || [];
    const own = Object.values(CHAR_WORKS).filter(c => c.name === name).map(c => ({ kind: '깡캐', title: c.title, url: c.url }));
    return [...own, ...keys.map(k => ({ kind: '원작', ...WORKS[k] }))];
}
/** 그 묶음의 원작 줄들(묶음 원작 + 그 묶음 캐릭터의 깡캐 글) */
export function groupSources(group, names = []) {
    const own = Object.values(CHAR_WORKS).filter(c => names.includes(c.name)).map(c => ({ kind: '깡캐', title: c.title, url: c.url }));
    return [...(GROUP_WORKS[group] || []).map(k => ({ kind: '원작', ...WORKS[k] })), ...own];
}
/** 봇 정식 이름(목록의 source · 액자 마트 봇 이름)으로 원작 찾기 — 없으면 null */
export const workByTitle = title => Object.values(WORKS).find(w => w.title === title) || null;
/** 아홉 글 전부(「원작」 칸 · 시험) */
export const ALL_SOURCES = Object.freeze([...Object.values(WORKS), ...Object.values(CHAR_WORKS)]);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** 원작 한 줄(주소가 있으면 🔗 링크 · 없으면 글만 — 액자 마트와 같은 꼴) */
export const sourceHtml = (src, kind = src.kind || '원작') => (src.url
    ? `<a class="mart-source" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" title="원작 깡통 글">🔗 ${esc(kind)} · ${esc(src.title)}</a>`
    : `<span class="mart-source is-plain" title="원작 봇">${esc(kind)} · ${esc(src.title)}</span>`);
/** 「원작」 칸 — 캐릭터를 안 골라도 보이는 묶음별 목록. groups: tone-state.js CAST_GROUPS */
export function creditsHtml(groups) {
    const rows = groups.filter(g => GROUP_WORKS[g.id]).map(g => `<li><b>${esc(GROUP_LABELS[g.id] || g.label)}</b><span class="mart-credits-who">${esc(g.cast.map(x => x.name).join(' · '))}</span><span class="mart-credits-links">${groupSources(g.id, g.cast.map(x => x.name)).map(s => sourceHtml(s)).join('')}</span></li>`).join('');
    return `<h2>원작</h2><p><b>깡통 · 깡캐</b> 칸의 캐릭터 이름 · 대사색과 <b>세계관 · 인물</b> 틀은 아래 원작 봇에서 왔어요. 원작 글을 누르면 깡통에서 열려요.</p><ul class="mart-credits-list">${rows}</ul>`;
}
