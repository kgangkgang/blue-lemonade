// TTS 화자 찾기: 대화 색 → 이름 (대사 색 배우기 · 팔레트 불러오기 · 이름 접두)
// 채팅별 상태는 chatMetadata.lemon_voice 에 둔다:
//   { colors: { '#rrggbb': { name, locked, auto, votes:{이름:점수}, tvotes:{이름:점수}, count, aliases:[] } },
//     userColor, palette_at, names:{속마음 라벨:횟수}, learned:{메시지 번호:{h,v,k,n}}, seeded }
//   votes = 모든 표, tvotes = 그중 속마음 표 (내 색 찾기에 씀), learned = 메시지별 낸 표 (스와이프·수정 때 되돌리기용)
import { getContext, saveMetadataDebounced } from '../../../../../../../extensions.js';
import { settings, save } from './settings.js';
import { segmentMessage, parseRegexLines } from './text.js';
import { peopleChanged, invalidatePeople, peopleStamp, peopleMemoOn } from '../../../people.js';   // 6.9.5 인물표 — 색 표가 바뀌면 알린다 · 7.2.8 기억 비우기

// 투표 가중치 (연구 deus.md 와 같게)
const W = { label: 5, thought: 3, sameLine: 2, prevNarr: 1 };
const MIN_TOTAL = 3, MIN_SHARE = 0.5, MIN_MARGIN = 2, USER_MIN = 3, SEED_W = 2;
export const NEAR_DE = 8;                 // 이보다 가까운 색은 자동 배정 금지, 제안만
const GLOBAL_ORDER_ID = 100001;          // 프롬프트 매니저의 전역 순서 id
export const PALETTE_LINE = /^\s*[-*•]\s*(.+?)\s*:\s*["']?(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})["']?/gm;
const KO_PARTICLE = '(?:이|가|은|는|의|을|를|에게|한테|와|과|도|만|께|에|로|으로|이여|야|아|님|씨)?';
const SPEECH_RE = /\b(?:said|says|asked|asks|replied|murmured|muttered|whispered|shouted|snapped|added|called|continued|answered|laughed|hissed|growled|sighed|breathed|drawled|chirped|barked|yelled|cried|declared|announced|stated|interjected|mumbled)\b|말했|말한|물었|중얼|속삭|외쳤|덧붙|대답|웃었|소리쳤|내뱉|말을|言った|言う|叫んだ|囁いた|尋ねた|答えた|呟いた|笑った/i;

// ---- 컨텍스트 (테스트에서 바꿔 끼울 수 있게)
let testCtx = null, testSave = null;
/** 테스트용: getContext 와 저장 함수를 바꿔 끼운다 */
export function _setContextForTest(getCtx, saveFn) { testCtx = getCtx || null; testSave = saveFn || null; }
const ctx = () => (testCtx ? testCtx() : getContext()) || {};
function persist() {
    try { (testSave || saveMetadataDebounced)(); }
    catch (e) { console.error('[TTS] 채팅 메타 저장 실패', e); }
    peopleChanged();
}

// ---- 작은 도구
const fold = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
/** 2.0.2 색 표의 이름이 {{user}} 매크로 그대로인가 (카드 팔레트 · 연결표의 「{{user}}」 줄) — 페르소나 이름과 글자가 달라도 나 */
const isUserMacro = (s) => /^\{\{user\}\}$/i.test(String(s || '').trim());
const cleanName = (s) => String(s || '').replace(/[*_`~"'“”‘’]/g, '').trim().slice(0, 40);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
// 7.2.8 색 표(st)를 고치는 곳은 모두 dirty() — 별명표 · 인물표 기억을 그 자리에서 비운다 (bump 는 st 의 표 · 이름표에만 쓴다)
const dirty = () => invalidatePeople();
const bump = (o, k, d) => { const v = (o[k] || 0) + d; if (v > 0) o[k] = v; else delete o[k]; dirty(); };

/** 색을 '#rrggbb' 소문자로 (#rgb 늘림, rgb() 변환); 못 읽으면 null */
export function normColor(v) {
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    let m = /^#?([0-9a-f]{3})$/.exec(s);
    if (m) return '#' + [...m[1]].map(ch => ch + ch).join('');
    m = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
    if (m) return '#' + m[1];
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
    if (m) return '#' + m.slice(1, 4).map(n => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
    return null;
}

/** 글 해시 (FNV-1a 32bit + 길이) — 같은 메시지를 두 번 배우지 않기 위해 */
function hashOf(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + ':' + str.length;
}

// ---- 색 거리 (CIE76 ΔE)
function lab(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(u => (u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92));
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [X, Y, Z].map(f);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function deltaE(a, b) {
    const A = lab(normColor(a) || '#000000'), B = lab(normColor(b) || '#000000');
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

// ---- 채팅별 상태
const EMPTY = () => ({ colors: {}, userColor: null, palette_at: 0, names: {}, learned: {}, seeded: false });
const STATE_KEYS = Object.keys(EMPTY());
let orphan = null; // 채팅이 없을 때 쓰는 임시 상태
function state() {
    const md = ctx().chatMetadata;
    if (!md || typeof md !== 'object') return (orphan ||= EMPTY());
    let st = md.lemon_voice;
    if (!st || typeof st !== 'object') { st = md.lemon_voice = EMPTY(); dirty(); }
    for (const k of STATE_KEYS) if (!(k in st)) { st[k] = EMPTY()[k]; dirty(); }
    if (!st.seeded) { seedFromCard(st); dirty(); }
    return st;
}
function entry(st, c) {
    const e = st.colors[c] || (dirty(), st.colors[c] = { name: null, locked: false, auto: false, votes: {}, tvotes: {}, count: 0, aliases: [] });
    e.votes ||= {}; e.tvotes ||= {}; e.aliases ||= []; e.count ||= 0;
    return e;
}

// ---- 카드
function currentCards() {
    const c = ctx();
    const chars = Array.isArray(c.characters) ? c.characters : [];
    if (c.groupId) {
        const g = (c.groups || []).find(x => x && x.id === c.groupId);
        const members = new Set(g?.members || []);
        return chars.filter(ch => ch && members.has(ch.avatar));
    }
    const ch = chars[c.characterId];
    return ch ? [ch] : [];
}
function cardAvatar() {
    const c = ctx();
    return c.groupId ? '' : (c.characters?.[c.characterId]?.avatar || '');
}
/** 새 채팅: 같은 카드에서 저장한 색 → 이름을 표 2점씩으로 심는다 (잠금 아님) */
function seedFromCard(st) {
    st.seeded = true;
    const av = cardAvatar();
    if (!av) return;
    const seed = settings().card_colors[av];
    if (!seed || typeof seed !== 'object') return;
    for (const [col, name] of Object.entries(seed)) {
        const c = normColor(col), n = String(name || '').trim();
        if (c && n) bump(entry(st, c).votes, n, SEED_W);
    }
}
/** 사용자가 정한 색 → 이름을 카드에 기억 (다음 채팅의 씨앗) */
function rememberOnCard(c, name) {
    const av = cardAvatar();
    if (!av) return;
    const s = settings();
    const m = s.card_colors[av] && typeof s.card_colors[av] === 'object' ? s.card_colors[av] : (s.card_colors[av] = {});
    if (name) m[c] = name; else delete m[c];
    if (!Object.keys(m).length) delete s.card_colors[av];
    save();
}

/**
 * 7.0.2 캐릭터 이름 바꾸기(CHARACTER_RENAMED): 실리태번이 카드 파일(avatar)을 바꿔 그 카드의 색 기억(card_colors[아바타])이 고아가 되고,
 * 새 이름에는 목소리 연결(char_map) · 고정(prefer_keep)이 없어 기본 목소리로 읽었다.
 * card_colors 는 새 아바타로 옮긴다. 이름 열쇠(char_map · prefer_keep)는 **복사**만 한다 — 옛 채팅의 메시지는 옛 이름이 그대로일 수 있고(실리태번이 묻는다),
 * 같은 이름의 다른 화자(페르소나 · 다른 카드)와 섞이지 않게 새 이름에 이미 연결이 있거나 newName 이 다른 사람 이름이면 그대로 둔다.
 * 순수: s(TTS 설정)를 고쳐 { colors, voices } 를 돌려준다
 */
export function renameCharacterKeys(s, { oldAvatar = '', newAvatar = '', oldName = '', newName = '', taken = [] } = {}) {
    const out = { colors: false, voices: 0 };
    if (!s || typeof s !== 'object') return out;
    if (oldAvatar && newAvatar && oldAvatar !== newAvatar && s.card_colors?.[oldAvatar] && !s.card_colors[newAvatar]) {
        s.card_colors[newAvatar] = s.card_colors[oldAvatar]; delete s.card_colors[oldAvatar]; out.colors = true;
    }
    const key = n => String(n || '').trim().toLowerCase().replace(/\s+/g, '');
    const from = key(oldName), to = key(newName);
    if (!from || !to || from === to || (taken || []).some(n => key(n) === to)) return out;
    for (const field of ['char_map', 'prefer_keep']) {
        const map = s[field];
        if (!map || typeof map !== 'object') continue;
        const oldKey = Object.keys(map).find(k => key(k) === from);
        if (oldKey === undefined || Object.keys(map).some(k => key(k) === to)) continue;
        map[String(newName).trim()] = map[oldKey];
        out.voices++;
    }
    if (out.voices) dirty();
    return out;
}

// ---- 이름 · 별명
const personaName = () => String(ctx().name1 || '').trim();
const charName = () => String(ctx().name2 || '').trim();

/** 별명표: pairs = [표면 이름, 대표 이름], map = 접힌 이름 → 대표 이름 (돌려준 것은 읽기만 — 기억해 둔 것을 같이 쓴다)
 *  7.2.8 기억: 인물표 · 화자 찾기 · 대사 칠하기가 이름마다 불러 채팅 열기 · 답마다 별명표를 수백 번 새로 만들었다.
 *  같은 색 표(st) · 설정 객체 · 목소리 목록 · 연결표 · 페르소나 · 캐릭터 이름 · 이름 다리 · 판 번호(peopleStamp — dirty() · save() · peopleChanged() 가 올린다)면 그대로 */
let tableMemo = null;
function aliasTable(st) {
    const s0 = settings(), c0 = ctx();
    const keys = [peopleStamp(), st, st?.names, st?.colors, s0, s0.voices, s0.voices?.length, s0.char_map, s0.char_map ? Object.keys(s0.char_map).length : 0, c0.name1, c0.name2, globalThis[NAMES_BRIDGE]];
    if (peopleMemoOn() && tableMemo && tableMemo.keys.length === keys.length && tableMemo.keys.every((x, i) => Object.is(x, keys[i]))) return tableMemo.table;
    const table = buildAliasTable(st);
    tableMemo = peopleMemoOn() ? { keys, table } : null;
    return table;
}
function buildAliasTable(st) {
    const pairs = [], map = new Map();
    const put = (surface, canonName) => {
        const s = String(surface || '').trim(), k = fold(s);
        if (!k || map.has(k)) return;
        map.set(k, canonName); pairs.push([s, canonName]);
    };
    const s = settings();
    for (const v of s.voices) { put(v.name, v.name); for (const a of v.aliases) put(a, v.name); }
    for (const k of Object.keys(s.char_map)) put(k, k);
    const labels = new Map();
    for (const [n, k] of Object.entries(st.names || {})) labels.set(fold(n), (labels.get(fold(n)) || 0) + k);
    const lab = (a) => labels.get(fold(a)) || 0;
    for (const e of Object.values(st.colors)) {
        if (!e.name) continue;
        put(e.name, e.name);
        const al = (e.aliases || []).filter(a => fold(a) !== fold(e.name));
        // 한 팔레트 줄에 속마음 라벨이 둘 이상 들어 있으면 가장 많이 나온 라벨만 접고 나머지는 딴 사람 (긴 성 이름 함정)
        const labelled = [e.name, ...al].filter(x => lab(x) > 0);
        const keep = labelled.length >= 2 ? labelled.reduce((b, x) => (lab(x) > lab(b) ? x : b)) : null;
        for (const a of al) {
            if (keep && lab(a) > 0 && fold(a) !== fold(keep)) continue;
            put(a, e.name);
        }
    }
    const u = personaName(); if (u) put(u, u);
    const ch = charName(); if (ch) put(ch, ch);
    // 6.3.5 이름 다리 — 사용자가 정한 이름(목소리 · 연결표 · 색 표 · 페르소나 · 캐릭터) 뒤, 배운 이름(속마음 라벨 · 표) 앞:
    //       배운 라벨이 다리 별명을 가로채지 않게. 끝에서 한 번 더 — 배운 이름끼리도 잇는다 (put 은 이미 있는 이름을 덮지 않는다)
    const bridge = () => bridgeInto(k => map.has(k), k => map.get(k), put);
    bridge();
    for (const n of Object.keys(st.names || {})) put(n, n);
    for (const e of Object.values(st.colors)) for (const n of Object.keys(e.votes || {})) put(n, n); // 카드 씨앗 이름도 서술에서 찾도록
    bridge();
    return { pairs, map };
}
const canonWith = (map, n) => { const t = String(n || '').trim(); return map.get(fold(t)) || t; };

// 6.3.5 이름 다리 — 번역 애드온이 용어집의 이름 짝을 globalThis[Symbol.for('blue-lemonade.names')] 로 내놓는다 ({ version: 1, pairs: [{ src, dst }] }).
// 없으면(번역 애드온 끔 · 옛 테마) 빈 목록. 짝의 한쪽이 이미 아는 이름이면 다른 쪽을 그 대표 이름의 별명으로 — 이미 있는 이름(사용자가 넣은 별명 ·
// 인물 연결 열쇠 · 색 표)은 건드리지 않고, 두 번 돌아 사슬(영문 ↔ 한글 ↔ 가나)도 잇는다. 양쪽 다 모르는 짝은 아무것도 안 한다
const NAMES_BRIDGE = Symbol.for('blue-lemonade.names');
const bridgeFolded = new WeakMap();   // 다리 객체 → 접은 짝 (별명표는 canon 부를 때마다 다시 만드니 접기는 다리가 바뀔 때 한 번만)
function bridgePairs() {
    const api = globalThis[NAMES_BRIDGE];
    if (!api || typeof api !== 'object' || api.version !== 1 || !Array.isArray(api.pairs)) return [];
    let list = bridgeFolded.get(api);
    if (!list) {
        list = api.pairs.filter(p => p && typeof p.src === 'string' && typeof p.dst === 'string' && fold(p.src) && fold(p.dst))
            .map(p => ({ src: p.src.trim(), dst: p.dst.trim(), ks: fold(p.src), kd: fold(p.dst) }));
        bridgeFolded.set(api, list);
    }
    return list;
}
/** 6.4.3 이름 다리의 「같은 사람」 — 대표 이름 → 목소리 (인물 연결표 값 · 이름이나 별명이 맞는 목소리), 없으면 접은 이름.
 *  한 사람이 대표 이름 둘로 알려진 경우(연결표의 두 열쇠가 같은 목소리 · 목소리 이름과 연결표 열쇠가 같은 목소리)를 한 사람으로 본다 —
 *  6.4.2 는 대표 이름 글자로만 가려 그 표기를 아무에게도 안 붙였다(엑스트라 목소리). rank = 설정 순서(연결표 → 목소리): 붙일 대표 이름을 짝 순서와 상관없이 고른다.
 *  색인은 처음 물을 때 한 번 (대표 이름이 하나뿐인 표기는 묻지 않는다) */
function bridgeOwners() {
    let index = null;
    const build = () => {
        const s = settings(), have = new Set(s.voices.map(v => v.uid)), out = new Map();
        let n = 0;
        for (const [k, uid] of Object.entries(s.char_map || {})) if (uid && have.has(uid) && fold(k) && !out.has(fold(k))) out.set(fold(k), { key: `voice:${uid}`, rank: n++ });
        for (const v of s.voices) for (const a of [v.name, ...(v.aliases || [])]) if (fold(a) && !out.has(fold(a))) out.set(fold(a), { key: `voice:${v.uid}`, rank: n++ });
        return out;
    };
    return (name) => {
        if (!index) index = build();
        return index.get(fold(name)) || { key: `name:${fold(name)}`, rank: Infinity };
    };
}
/** has(접은 열쇠) · canonOf(접은 열쇠) → 대표 이름 · put(표면 이름, 대표 이름)
 *  6.4.2 한 차례씩: 아는 이름과 짝인 모르는 표기를 모두 모은 뒤 붙인다 — 서로 다른 두 사람에게 닿는 표기(Ren · Len → レン)는 누구에게도 붙이지 않는다
 *  (예전: 먼저 나온 짝의 사람이 가져가서 남의 목소리 · 색). 붙인 표기로 다음 차례에 사슬을 잇는다. 짝 순서와 상관없다 */
function bridgeInto(has, canonOf, put, ownerOf = bridgeOwners()) {
    const pairs = bridgePairs();
    if (!pairs.length) return;
    for (let round = 0; round < 8; round++) {
        const offers = new Map();   // 접은 표면 → { surface, owners: 접은 대표 → 대표 }
        const offer = (k, surface, owner) => {
            let o = offers.get(k);
            if (!o) offers.set(k, o = { surface, owners: new Map() });
            o.owners.set(fold(owner), owner);
        };
        for (const { src, dst, ks, kd } of pairs) {
            const a = has(ks), b = has(kd);
            if (a && !b) offer(kd, dst, canonOf(ks));
            else if (b && !a) offer(ks, src, canonOf(kd));
        }
        let added = 0;
        for (const { surface, owners } of offers.values()) {
            let owner = owners.size === 1 ? owners.values().next().value : null;
            if (!owner) {   // 6.4.3 대표 이름이 둘 이상이어도 같은 목소리면 한 사람 — 설정 순서가 앞선 대표 이름으로 (서로 다른 목소리 · 목소리 없는 서로 다른 이름만 모호)
                const who = [...owners.values()].map(c => ({ c, ...ownerOf(c) }));
                if (new Set(who.map(x => x.key)).size === 1) owner = who.sort((x, y) => x.rank - y.rank || (x.c < y.c ? -1 : x.c > y.c ? 1 : 0))[0].c;
            }
            if (owner) { put(surface, owner); added++; }
        }
        if (!added) return;
    }
}
/** 별명 → 대표 이름 (모르면 그대로) */
export function canon(name) { return canonWith(aliasTable(state()).map, name); }
/** 6.9.5 인물표: 그 사람의 표기들 — 별명표에서 같은 대표 이름으로 접히는 것 (대표 이름 먼저) */
export function namesOf(name) {
    const { pairs, map } = aliasTable(state());
    const c = canonWith(map, name), k = fold(c);
    if (!k) return [];
    return [c, ...pairs.filter(([s, cn]) => fold(cn) === k && fold(s) !== k).map(([s]) => s)];
}
/** 6.9.5 인물표 목록의 후보: 이 채팅 색 표의 이름(정해 둔 것 → 많이 나온 것) · 지금 카드(그룹이면 멤버) · 나 */
export function peopleNames() {
    const out = colorTable().map(row => row.name).filter(Boolean);
    for (const card of currentCards()) if (card?.name) out.push(String(card.name));
    const u = personaName(); if (u) out.push(u);
    return out;
}
/** 7.2.8 인물표 기억의 열쇠 (src/people.js stamp): 알림 없이 바뀌는 것 — 채팅(메타 객체 · 색 표) · 페르소나 · 캐릭터 · 설정 객체 · 목소리 목록 · 연결표 · 나 · 「엔진」 */
export function peopleInputs() {
    const c = ctx(), s = settings(), md = c.chatMetadata;
    const lv = md && typeof md === 'object' ? md.lemon_voice : undefined;
    return [md, lv, lv?.names, lv?.colors, lv?.userColor, c.name1, c.name2, c.characterId, c.groupId, s, s.voices, s.voices?.length, s.char_map, s.char_map ? Object.keys(s.char_map).length : 0, s.user_voice, s.prefer_provider, s.prefer_keep, s.providers];
}
/** 나(페르소나) 이름인가 — 별명표를 거쳐 */
export function isPersonaName(name) {
    const u = personaName();
    if (!u) return false;
    const { map } = aliasTable(state());
    return fold(canonWith(map, name)) === fold(canonWith(map, u));
}
/** 알려진 이름 전부 (text.js knownNames 용) */
export function knownNames() { return aliasTable(state()).pairs.map(p => p[0]); }

/** 서술 속 이름 찾기: 영문은 \b 경계, 한글은 조사 허용 경계 */
function nameMatcher(st) {
    const { pairs, map } = aliasTable(st);
    const items = pairs.slice().sort((a, b) => b[0].length - a[0].length);
    const pats = items.map(([s]) => {
        const e = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (/^[A-Za-z]/.test(s)) return `(?<!\\w)${e}(?:'s)?(?!\\w)`;
        if (/^[가-힣]/.test(s)) return `(?<![가-힣])${e}(?=${KO_PARTICLE}(?![가-힣]))`;
        return e;
    });
    const rx = pats.length ? new RegExp(pats.map(p => `(${p})`).join('|'), 'g') : null;
    const canonOf = items.map(([, c]) => c);
    const namesIn = (text) => {
        const out = [];
        if (!rx || !text) return out;
        for (const m of String(text).matchAll(rx)) {
            const gi = m.findIndex((g, i) => i > 0 && g !== undefined);
            if (gi > 0) out.push(canonOf[gi - 1]);
        }
        return out;
    };
    return { namesIn, canon: (n) => canonWith(map, n) };
}

// ---- 조각 → 줄 단위 (S 색 대화문 · T 속마음 표시 · V 보이는 속마음 라벨 · N 서술)
function unitsOf(segs) {
    const lines = new Map();
    segs.forEach((sg, i) => {
        if (!sg) return;
        const l = Number.isFinite(sg.line) ? sg.line : i;
        if (!lines.has(l)) lines.set(l, []);
        lines.get(l).push(sg);
    });
    const units = [];
    for (const list of lines.values()) {
        const dl = list.filter(s => s.kind === 'dialogue' && normColor(s.color));
        const th = list.filter(s => s.kind === 'thought' && s.speakerHint);
        const nar = list.filter(s => s.kind !== 'thought' && !dl.includes(s)).map(s => s.text || s.raw || '').join(' ').trim();
        for (const d of dl) units.push({ t: 'S', color: normColor(d.color), nar });
        for (const t of th) {
            const c = normColor(t.color), name = String(t.speakerHint).trim();
            units.push(c ? { t: 'V', color: c, name } : { t: 'T', name });
        }
        if (!dl.length && !th.length && nar) units.push({ t: 'N', text: nar });
    }
    return units;
}

// ---- 표 내기 · 되돌리기
function applyNames(st, list, sign) { for (const [n, k] of list) bump(st.names, n, sign * k); }
function applyVotes(st, rec, sign) {
    for (const [c, name, w, t] of rec.v) {
        const e = entry(st, c);
        bump(e.votes, name, sign * w);
        if (t) bump(e.tvotes, name, sign * w);
    }
    for (const c of rec.k) { const e = entry(st, c); e.count = Math.max(0, e.count + sign); dirty(); }
}
function retract(st, rec) {
    if (!rec) return;
    applyVotes(st, { v: rec.v || [], k: rec.k || [] }, -1);
    applyNames(st, rec.n || [], -1);
}

/** 한 메시지의 조각에서 표를 내고, 낸 표 기록을 돌려준다 */
function learnUnits(st, units) {
    const rec = { h: '', v: [], k: [], n: [] };
    // 속마음 라벨을 먼저 이름표에 올린다 (같은 메시지 안에서 바로 찾도록)
    for (const u of units) if ((u.t === 'T' || u.t === 'V') && u.name) rec.n.push([u.name, 1]);
    applyNames(st, rec.n, +1);
    const { namesIn, canon: cn } = nameMatcher(st);
    const vote = (c, name, w, thought) => { if (c && name) rec.v.push([c, name, w, thought ? 1 : 0]); };
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.t === 'V') { vote(u.color, cn(u.name), W.label, true); continue; }
        if (u.t !== 'S') continue;
        const c = u.color;
        rec.k.push(c);
        // 같은 색이 이어지는 묶음 [q0..q1]
        let q0 = i; while (q0 > 0 && units[q0 - 1].t === 'S' && units[q0 - 1].color === c) q0--;
        let q1 = i; while (q1 + 1 < units.length && units[q1 + 1].t === 'S' && units[q1 + 1].color === c) q1++;
        // 묶음 바로 앞·뒤의 속마음 표시 → 3
        if (i === q1 && units[q1 + 1]?.t === 'T') vote(c, cn(units[q1 + 1].name), W.thought, true);
        if (i === q0 && q0 > 0 && units[q0 - 1].t === 'T') vote(c, cn(units[q0 - 1].name), W.thought, true);
        // 같은 줄의 서술에 이름 + 말하기 동사 → 2
        if (u.nar && SPEECH_RE.test(u.nar)) { const same = namesIn(u.nar); if (same.length) vote(c, same[0], W.sameLine, false); }
        // 바로 앞 서술 단락의 마지막 이름 → 1 (묶음의 첫 줄에서만)
        if (i === q0) {
            let p = q0 - 1; while (p >= 0 && units[p].t !== 'N') p--;
            if (p >= 0) { const pl = namesIn(units[p].text); if (pl.length) vote(c, pl[pl.length - 1], W.prevNarr, false); }
        }
    }
    applyVotes(st, rec, +1);
    return rec;
}

// ---- 표 → 이름
const autoClear = (e) => { if (e.auto) { e.name = null; e.auto = false; } };
function resolveAll(st) {
    dirty();   // 7.2.8 부르기 전에 고친 이름 · 별명(setColor · importPalette)을 별명표가 보게
    const { map } = aliasTable(st);
    const cn = (n) => canonWith(map, n);
    const USER = cn(personaName());
    const isUserName = (n) => isUserMacro(n) || (!!USER && fold(cn(n)) === fold(USER));   // 2.0.2 「{{user}}」 로 잠긴 색도 내 색
    const locked = {}; let lockedUser = null;
    for (const [c, e] of Object.entries(st.colors)) if (e.locked && e.name) { locked[c] = e.name; if (!lockedUser && isUserName(e.name)) lockedUser = c; }
    // 내 색: 서술에서 내 이름이 가리킨 표 − 그 색의 속마음 표 (나는 true_thoughts 를 받지 않는다)
    let uc = null;
    if (USER) {
        let best = -Infinity;
        for (const [c, e] of Object.entries(st.colors)) {
            const sc = (e.votes[USER] || 0) - (e.tvotes[USER] || 0) - sum(e.tvotes);
            if (sc > best) { best = sc; uc = c; }
        }
        if (best < USER_MIN) uc = null;
    }
    if (lockedUser) st.userColor = lockedUser;
    else if (uc && !locked[uc] && !Object.values(locked).some(isUserName)) st.userColor = uc;
    else st.userColor = null;
    const taken = new Set(Object.values(locked).map(n => fold(cn(n))));
    if (st.userColor) taken.add(fold(USER));
    // 나머지 색: 잠긴 이름·나를 뺀 표에서 합 ≥3, 1등 비중 ≥½, 2등과 차이 ≥2
    const cand = [];
    for (const [c, e] of Object.entries(st.colors)) {
        if (locked[c] || c === st.userColor) continue;
        const vv = Object.entries(e.votes).filter(([n]) => !taken.has(fold(cn(n))) && !isUserName(n)).sort((a, b) => b[1] - a[1]);
        const tot = vv.reduce((a, [, w]) => a + w, 0);
        if (!tot) { autoClear(e); continue; }
        cand.push({ e, n1: vv[0][0], w1: vv[0][1], tot, margin: vv[0][1] - (vv[1] ? vv[1][1] : 0) });
    }
    cand.sort((a, b) => b.margin - a.margin || b.tot - a.tot);
    for (const x of cand) {
        if (x.tot >= MIN_TOTAL && x.w1 / x.tot >= MIN_SHARE && x.margin >= MIN_MARGIN) { x.e.name = x.n1; x.e.auto = true; }
        else autoClear(x.e);
    }
    // 표도 대화문도 이름도 없는 빈 항목은 지운다
    for (const [c, e] of Object.entries(st.colors)) if (!e.locked && !e.count && !Object.keys(e.votes).length && !e.name && c !== st.userColor) delete st.colors[c];
    dirty();
}

// ---- text.js 옵션 (다시 배우기용; index.js · player.js 의 실시간 학습과 같은 규칙)
function segmentOpts() {
    const s = settings(), c = ctx();
    const skipTags = new Set(String(s.skip_tags || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
    const names = new Set(knownNames());
    for (const ch of currentCards()) if (ch?.name) names.add(ch.name);   // 그룹 멤버 이름 (「 접두 힌트용)
    return { skipTags, skipCode: !!s.skip_codeblocks, stripRegex: parseRegexLines(s.strip_regex), userName: c.name1 || '', charName: c.name2 || '', knownNames: [...names].filter(Boolean), routes: s.routes, final: true };
}

// ================= 공개 API =================

// 5.6.4 CHARACTER_MESSAGE_RENDERED 뒤에 실리태번이 채팅을 저장하는 type — 스트리밍 onFinishStreaming · 보통 Generate · 그림 확장('extension') 은
// 렌더 이벤트를 기다린 다음 saveChatConditional (chat_metadata 포함) 을 부른다.
// 저장이 따라오지 않는 것: 채팅을 연 인사말(first_message) · /sendas at= (command: 저장이 렌더보다 먼저) · 모르는 type · 끊긴 스트리밍
const SAVED_AFTER_RENDER = new Set(['normal', 'swipe', 'regenerate', 'continue', 'quiet', 'extension']);
/** 이 렌더 뒤에 실리태번이 채팅을 저장하는가 (sp = getContext().streamingProcessor) */
export function chatSavedAfterRender(id, type, sp) {
    if (!SAVED_AFTER_RENDER.has(type)) return false;
    // 끊긴 스트리밍: onErrorStreaming 이 같은 type 으로 렌더 이벤트를 내고 저장하지 않는다 (그 처리기만 isStopped 를 켜고, 끝까지 받은 것은 isFinished)
    if (sp && Number(sp.messageId) === Number(id) && sp.isStopped && !sp.isFinished) return false;
    return true;
}

/**
 * 메시지 하나에서 배운다 (원문 조각으로). 이미 배운 메시지는 건너뛰고, 글이 바뀐(스와이프·수정) 메시지는 예전 표를 걷어낸 뒤 다시 낸다.
 * deferSave = 실리태번이 곧 이 채팅을 저장한다 (보통 답장 렌더 뒤 saveChatConditional — chat_metadata 도 함께) → 따로 저장하지 않는다 (5.6.4: 답장마다 1초 뒤 같은 채팅을 한 번 더 저장하던 것)
 */
export function learnFromMessage(mes, segsOriginal, { deferSave = false } = {}) {
    if (!mes || mes.is_system || !Array.isArray(segsOriginal)) return false;
    const st = state();
    if (!st.palette_at) importPalette({ deferSave });
    const chat = Array.isArray(ctx().chat) ? ctx().chat : [];
    const idx = chat.indexOf(mes);
    const h = hashOf(String(mes.mes || ''));
    let retracted = false;
    if (idx >= 0) {
        const prev = st.learned[idx];
        if (prev && prev.h === h) return false;
        if (prev) { retract(st, prev); delete st.learned[idx]; retracted = true; }
    }
    const rec = learnUnits(st, unitsOf(segsOriginal));
    rec.h = h;
    if (idx >= 0) st.learned[idx] = rec;
    // 표·이름·대화문 수가 하나도 안 바뀐 메시지는 채팅 파일을 다시 쓰지 않는다 (큰 채팅의 저장 비용)
    if (retracted || rec.v.length || rec.n.length || rec.k.length) { resolveAll(st); if (!deferSave) persist(); }
    return true;
}

/** 채팅 전체를 처음부터 다시 배운다 (팔레트 잠금은 유지). 배운 메시지 수를 돌려준다 */
export function relearnChat() {
    resetLearning(true);
    const st = state(), c = ctx();
    if (!st.palette_at) importPalette();
    const chat = Array.isArray(c.chat) ? c.chat : [];
    const opts = segmentOpts();
    let n = 0;
    chat.forEach((m, i) => {
        if (!m || m.is_system) return;
        const raw = String(m.mes || '');
        let segs;
        try { segs = segmentMessage(typeof c.substituteParams === 'function' ? c.substituteParams(raw) : raw, opts); }
        catch (e) { console.error('[TTS] 조각 나누기 실패', e); return; }
        const rec = learnUnits(st, unitsOf(Array.isArray(segs) ? segs : []));
        rec.h = hashOf(raw);
        st.learned[i] = rec; n++;
    });
    resolveAll(st); persist();
    return n;
}

/** 지워지거나 자리가 바뀐 메시지에 맞춰 표 기록을 맞춘다 (MESSAGE_DELETED 뒤). 바뀐 항목 수를 돌려준다 */
export function syncChat() {
    const st = state();
    const chat = Array.isArray(ctx().chat) ? ctx().chat : [];
    const byHash = new Map();
    for (const rec of Object.values(st.learned)) { if (!byHash.has(rec.h)) byHash.set(rec.h, []); byHash.get(rec.h).push(rec); }
    const next = {}; let moved = 0;
    chat.forEach((m, i) => {
        if (!m) return;
        const list = byHash.get(hashOf(String(m.mes || '')));
        if (list?.length) { next[i] = list.shift(); if (st.learned[i] !== next[i]) moved++; }
    });
    let dropped = 0;
    for (const list of byHash.values()) for (const rec of list) { retract(st, rec); dropped++; }
    st.learned = next; dirty();
    if (moved || dropped) { resolveAll(st); persist(); }
    return moved + dropped;
}

/** 켜진 프롬프트와 현재 카드에서 "- 이름 / 별명: #색" 줄을 읽어 잠긴 색으로 넣는다. { '#rrggbb': [이름들] } 을 돌려준다 (deferSave: learnFromMessage 와 같음) */
export function importPalette({ deferSave = false } = {}) {
    const st = state(), c = ctx();
    const texts = [];
    const oai = c.chatCompletionSettings || {};
    const prompts = Array.isArray(oai.prompts) ? oai.prompts : [];
    const orders = Array.isArray(oai.prompt_order) ? oai.prompt_order : [];
    const orderOf = (id) => orders.find(o => o && String(o.character_id) === String(id))?.order;
    const order = orderOf(GLOBAL_ORDER_ID) || (c.characterId !== undefined ? orderOf(c.characterId) : null) || null;
    const on = Array.isArray(order) ? new Set(order.filter(x => x && x.enabled).map(x => x.identifier)) : null;
    for (const p of prompts) {
        if (!p || p.marker || !p.content) continue;
        if (on ? on.has(p.identifier) : p.enabled !== false) texts.push(String(p.content));
    }
    for (const ch of currentCards()) texts.push(ch.description, ch.personality, ch.scenario, ch.data?.creator_notes ?? ch.creatorcomment);
    const found = {};
    for (const t of texts) {
        if (!t) continue;
        for (const m of String(t).matchAll(PALETTE_LINE)) {
            const col = normColor(m[2]);
            const names = m[1].split('/').map(cleanName).filter(Boolean);
            if (!col || !names.length) continue;
            const arr = found[col] || (found[col] = []);
            for (const n of names) if (!arr.some(x => fold(x) === fold(n))) arr.push(n);
        }
    }
    // 이름 고르기: 목소리 이름·다른 이름·연결표 열쇠와 맞는 첫 이름 (다른 이름으로 맞으면 그 목소리의 이름으로), 없으면 첫 이름
    const s = settings();
    const known = new Map();
    for (const k of Object.keys(s.char_map)) known.set(fold(k), k);
    for (const v of s.voices) { known.set(fold(v.name), v.name); for (const a of v.aliases) if (!known.has(fold(a))) known.set(fold(a), v.name); }
    bridgeInto(k => known.has(k), k => known.get(k), (n, c) => { if (!known.has(fold(n))) known.set(fold(n), c); });   // 6.3.5 이름 다리
    for (const [col, names] of Object.entries(found)) {
        const e = entry(st, col);
        const hit = names.find(n => known.has(fold(n)));
        e.name = hit ? known.get(fold(hit)) : names[0];
        e.locked = true; e.auto = false; e.aliases = names;
    }
    st.palette_at = Date.now(); dirty();
    resolveAll(st); if (!deferSave) persist();
    return found;
}

/** 조각의 화자. 순서: 잠긴·배운 색 → 내 색 → 조각의 이름 힌트 → 보낸 사람 */
export function resolveSpeaker(seg, rctx = {}) {
    const st = state();
    const { map } = aliasTable(st);
    const cn = (n) => canonWith(map, n);
    const userName = String(rctx.userName || personaName() || '').trim();
    const isUser = (n) => !!n && (isUserMacro(n) || (!!userName && (fold(n) === fold(userName) || fold(cn(n)) === fold(cn(userName)))));
    const c = normColor(seg?.color);
    const e = c ? st.colors[c] : null;
    // 2.0.2 칸 이름이 「{{user}}」 매크로면 내 이름으로 (전엔 「{{user}}」 라는 모르는 캐릭터가 되어 내 목소리를 안 쓰고 「목소리를 먼저 정해요」)
    if (e?.name) return { name: isUserMacro(e.name) && userName ? userName : e.name, source: e.locked ? 'palette' : 'learned', isUser: isUser(e.name) };
    if (c && st.userColor === c) return { name: userName, source: 'user', isUser: true };
    const hint = String(seg?.speakerHint || '').trim();
    if (hint) { const n = cn(hint); return { name: n, source: 'hint', isUser: isUser(n) }; }
    const mes = rctx.mes || null;
    const sender = String(mes?.name || (mes?.is_user ? userName : (rctx.charName || charName())) || '').trim();
    return { name: sender, source: 'sender', isUser: !!mes?.is_user || isUser(sender) };
}

/** 이 채팅의 내 색 ('#rrggbb' | null) */
export function userColor() { return state().userColor || null; }

/**
 * 6.2.3 색 없는 대사에 화자 색 (paint.js): 이 채팅에서 그 인물이 쓴 색 ('#rrggbb' | null).
 * 이름(별명표를 거침)이 같은 색 가운데 가장 많이 본 것(count) — 같으면 잠긴(팔레트) 것. 없고 그 이름이 나면 내 색
 */
export function colorOfName(name, { userName = '' } = {}) {
    const st = state();
    const { map } = aliasTable(st);
    const k = fold(canonWith(map, name));
    if (!k) return null;
    let best = null, score = -1;
    for (const [c, e] of Object.entries(st.colors || {})) {
        if (!e?.name || !/^#[0-9a-f]{6}$/.test(c)) continue;
        // 6.2.5 그 칸의 별명도 본다 — 대사 분석이 화자를 다른 표기(한글 이름 · 별명)로 주면 칸 이름(영문 이름)과 안 맞아 색 없는 대사를 못 칠했다
        if (![e.name, ...(Array.isArray(e.aliases) ? e.aliases : [])].some(n => fold(canonWith(map, n)) === k)) continue;
        const v = (Number(e.count) || 0) * 2 + (e.locked ? 1 : 0);
        if (v > score) { best = c; score = v; }
    }
    const me = String(userName || personaName() || '').trim();
    if (!best && me && st.userColor && fold(canonWith(map, me)) === k) best = st.userColor;
    return best;
}

/** 이름 있는 색 가운데 ΔE < 8 로 가까운 것 (UI 제안용; 자동 배정에는 쓰지 않는다) */
export function nearestKnown(color) {
    const c = normColor(color);
    if (!c) return null;
    const st = state();
    let best = null;
    for (const [k, e] of Object.entries(st.colors)) {
        if (k === c) continue;
        const nm = (e.name && !isUserMacro(e.name) ? e.name : null) || (k === st.userColor || isUserMacro(e.name) ? personaName() : null);
        if (!nm) continue;
        const d = deltaE(c, k);
        if (d < NEAR_DE && (!best || d < best.dE)) best = { color: k, name: nm, dE: Math.round(d * 10) / 10 };
    }
    return best;
}

/** UI 표: [{ color, name, locked, votes, count, isUser, near, aliases }] (잠긴 것 → 많이 나온 것 순) */
export function colorTable() {
    const st = state();
    const u = personaName();
    const { map } = aliasTable(st);
    const isUserName = (n) => !!n && (isUserMacro(n) || (!!u && fold(canonWith(map, n)) === fold(canonWith(map, u))));
    return Object.entries(st.colors).map(([color, e]) => {
        const user = color === st.userColor || isUserName(e.name);
        const votes = Object.fromEntries(Object.entries(e.votes || {}).sort((a, b) => b[1] - a[1]));
        return {
            color,
            name: e.name || (user ? u : null),
            locked: !!e.locked,
            votes,
            count: e.count || 0,
            isUser: user,
            near: e.name || user ? null : nearestKnown(color),
            aliases: (e.aliases || []).slice(),
        };
    }).sort((a, b) => Number(b.locked) - Number(a.locked) || b.count - a.count || a.color.localeCompare(b.color));
}

/** 색에 이름을 정한다. name 이 비면 이름·잠금을 지운다. locked=false 면 학습이 뒤에 바꿀 수 있다 */
export function setColor(color, name, locked = true) {
    const c = normColor(color);
    if (!c) return false;
    const st = state();
    const e = entry(st, c);
    const n = String(name || '').trim();
    // 1.9.7 다른 사람 이름으로 바꾸거나 이름을 지우면 전 이름의 다른 표기(aliases — 팔레트의 「미나/Mina」)를 떼어 낸다. 남으면 옛 별명이 새 이름의 표기로 남아
    //   화자 찾기 · 이름표가 어긋났다. 같은 사람의 다른 표기(aliases 안의 이름)로 바꾸는 건 그대로 둔다
    const samePerson = n && (fold(e.name || '') === fold(n) || (e.aliases || []).some(a => fold(a) === fold(n)));
    if (!samePerson) e.aliases = [];
    dirty();
    if (!n) { e.name = null; e.locked = false; e.auto = false; rememberOnCard(c, null); }
    else { e.name = n; e.locked = !!locked; e.auto = false; rememberOnCard(c, e.locked ? n : null); }
    resolveAll(st); persist();
    return true;
}

/** 배운 것을 지운다. keepLocked=true 면 잠긴(팔레트·직접 정한) 색은 남기고 표만 비운다 */
export function resetLearning(keepLocked = true) {
    const st = state();
    for (const [c, e] of Object.entries(st.colors)) {
        if (keepLocked && e.locked) { e.votes = {}; e.tvotes = {}; e.count = 0; }
        else delete st.colors[c];
    }
    st.names = {}; st.learned = {}; st.userColor = null; st.seeded = false; dirty();
    // palette_at 은 그대로 둔다: 비운 뒤 다음 답장에서 팔레트가 조용히 되살아나지 않도록 (다시 넣기는 "프리셋에서 불러오기" 버튼)
    seedFromCard(st);
    resolveAll(st); persist();
}

/** 6.5.4 그 색의 임자 — 이름 있는 칸의 이름, 내 색이면 내 이름 ('' = 아는 인물 없음). 꼭 같은 색이 먼저, 없으면 채널마다 ±6 안의 색 (화면 계산값 · 팔레트 표기 차) */
export function ownerOfColor(color) {
    const c = normColor(color);
    if (!c) return '';
    const st = state();
    const nameOf = (k, e) => String((e?.name && !isUserMacro(e.name) ? e.name : '') || (k === st.userColor || isUserMacro(e?.name) ? personaName() : '') || '').trim();
    const exact = st.colors?.[c] ? nameOf(c, st.colors[c]) : '';
    if (exact) return exact;
    const near = (a, b) => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 6);
    for (const [k, e] of Object.entries(st.colors || {})) {
        if (k === c || !/^#[0-9a-f]{6}$/.test(k) || !near(k, c)) continue;
        const nm = nameOf(k, e);
        if (nm) return nm;
    }
    return '';
}
