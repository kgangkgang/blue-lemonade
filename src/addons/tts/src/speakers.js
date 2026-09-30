// TTS 화자 찾기: 대화 색 → 이름 (대사 색 배우기 · 팔레트 불러오기 · 이름 접두)
// 채팅별 상태는 chatMetadata.lemon_voice 에 둔다:
//   { colors: { '#rrggbb': { name, locked, auto, votes:{이름:점수}, tvotes:{이름:점수}, count, aliases:[] } },
//     userColor, palette_at, names:{속마음 라벨:횟수}, learned:{메시지 번호:{h,v,k,n}}, seeded }
//   votes = 모든 표, tvotes = 그중 속마음 표 (내 색 찾기에 씀), learned = 메시지별 낸 표 (스와이프·수정 때 되돌리기용)
import { getContext, saveMetadataDebounced } from '../../../../../../../extensions.js';
import { settings, save } from './settings.js';
import { segmentMessage, parseRegexLines } from './text.js';

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
}

// ---- 작은 도구
const fold = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
const cleanName = (s) => String(s || '').replace(/[*_`~"'“”‘’]/g, '').trim().slice(0, 40);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const bump = (o, k, d) => { const v = (o[k] || 0) + d; if (v > 0) o[k] = v; else delete o[k]; };

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
let orphan = null; // 채팅이 없을 때 쓰는 임시 상태
function state() {
    const md = ctx().chatMetadata;
    if (!md || typeof md !== 'object') return (orphan ||= EMPTY());
    let st = md.lemon_voice;
    if (!st || typeof st !== 'object') st = md.lemon_voice = EMPTY();
    for (const [k, v] of Object.entries(EMPTY())) if (!(k in st)) st[k] = v;
    if (!st.seeded) seedFromCard(st);
    return st;
}
function entry(st, c) {
    const e = st.colors[c] || (st.colors[c] = { name: null, locked: false, auto: false, votes: {}, tvotes: {}, count: 0, aliases: [] });
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

// ---- 이름 · 별명
const personaName = () => String(ctx().name1 || '').trim();
const charName = () => String(ctx().name2 || '').trim();

/** 별명표: pairs = [표면 이름, 대표 이름], map = 접힌 이름 → 대표 이름 */
function aliasTable(st) {
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
        // 한 팔레트 줄에 속마음 라벨이 둘 이상 들어 있으면 가장 많이 나온 라벨만 접고 나머지는 딴 사람 (Beelzebub 함정)
        const labelled = [e.name, ...al].filter(x => lab(x) > 0);
        const keep = labelled.length >= 2 ? labelled.reduce((b, x) => (lab(x) > lab(b) ? x : b)) : null;
        for (const a of al) {
            if (keep && lab(a) > 0 && fold(a) !== fold(keep)) continue;
            put(a, e.name);
        }
    }
    const u = personaName(); if (u) put(u, u);
    const ch = charName(); if (ch) put(ch, ch);
    for (const n of Object.keys(st.names || {})) put(n, n);
    for (const e of Object.values(st.colors)) for (const n of Object.keys(e.votes || {})) put(n, n); // 카드 씨앗 이름도 서술에서 찾도록
    return { pairs, map };
}
const canonWith = (map, n) => { const t = String(n || '').trim(); return map.get(fold(t)) || t; };
/** 별명 → 대표 이름 (모르면 그대로) */
export function canon(name) { return canonWith(aliasTable(state()).map, name); }
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
    for (const c of rec.k) { const e = entry(st, c); e.count = Math.max(0, e.count + sign); }
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
    const { map } = aliasTable(st);
    const cn = (n) => canonWith(map, n);
    const USER = cn(personaName());
    const isUserName = (n) => !!USER && fold(cn(n)) === fold(USER);
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

/** 메시지 하나에서 배운다 (원문 조각으로). 이미 배운 메시지는 건너뛰고, 글이 바뀐(스와이프·수정) 메시지는 예전 표를 걷어낸 뒤 다시 낸다 */
export function learnFromMessage(mes, segsOriginal) {
    if (!mes || mes.is_system || !Array.isArray(segsOriginal)) return false;
    const st = state();
    if (!st.palette_at) importPalette();
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
    if (retracted || rec.v.length || rec.n.length || rec.k.length) { resolveAll(st); persist(); }
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
    st.learned = next;
    if (moved || dropped) { resolveAll(st); persist(); }
    return moved + dropped;
}

/** 켜진 프롬프트와 현재 카드에서 "- 이름 / 별명: #색" 줄을 읽어 잠긴 색으로 넣는다. { '#rrggbb': [이름들] } 을 돌려준다 */
export function importPalette() {
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
    for (const [col, names] of Object.entries(found)) {
        const e = entry(st, col);
        const hit = names.find(n => known.has(fold(n)));
        e.name = hit ? known.get(fold(hit)) : names[0];
        e.locked = true; e.auto = false; e.aliases = names;
    }
    st.palette_at = Date.now();
    resolveAll(st); persist();
    return found;
}

/** 조각의 화자. 순서: 잠긴·배운 색 → 내 색 → 조각의 이름 힌트 → 보낸 사람 */
export function resolveSpeaker(seg, rctx = {}) {
    const st = state();
    const { map } = aliasTable(st);
    const cn = (n) => canonWith(map, n);
    const userName = String(rctx.userName || personaName() || '').trim();
    const isUser = (n) => !!n && !!userName && (fold(n) === fold(userName) || fold(cn(n)) === fold(cn(userName)));
    const c = normColor(seg?.color);
    const e = c ? st.colors[c] : null;
    if (e?.name) return { name: e.name, source: e.locked ? 'palette' : 'learned', isUser: isUser(e.name) };
    if (c && st.userColor === c) return { name: userName, source: 'user', isUser: true };
    const hint = String(seg?.speakerHint || '').trim();
    if (hint) { const n = cn(hint); return { name: n, source: 'hint', isUser: isUser(n) }; }
    const mes = rctx.mes || null;
    const sender = String(mes?.name || (mes?.is_user ? userName : (rctx.charName || charName())) || '').trim();
    return { name: sender, source: 'sender', isUser: !!mes?.is_user || isUser(sender) };
}

/** 이 채팅의 내 색 ('#rrggbb' | null) */
export function userColor() { return state().userColor || null; }

/** 이름 있는 색 가운데 ΔE < 8 로 가까운 것 (UI 제안용; 자동 배정에는 쓰지 않는다) */
export function nearestKnown(color) {
    const c = normColor(color);
    if (!c) return null;
    const st = state();
    let best = null;
    for (const [k, e] of Object.entries(st.colors)) {
        if (k === c) continue;
        const nm = e.name || (k === st.userColor ? personaName() : null);
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
    const isUserName = (n) => !!n && !!u && fold(canonWith(map, n)) === fold(canonWith(map, u));
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
    st.names = {}; st.learned = {}; st.userColor = null; st.seeded = false;
    // palette_at 은 그대로 둔다: 비운 뒤 다음 답장에서 팔레트가 조용히 되살아나지 않도록 (다시 넣기는 "프리셋에서 불러오기" 버튼)
    seedFromCard(st);
    resolveAll(st); persist();
}
