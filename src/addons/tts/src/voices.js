// TTS 목소리 찾기: 화자 이름 → 목소리, 목록 관리
import { settings, save, toVoice, fillKnown, fillKnownFacts, hasDb, providerConfig, USER_AUTO } from './settings.js';
import { getProvider } from './providers/index.js';
import { koVoiceName } from './voice-names.js';

const fold = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
const LANGS = ['ko', 'ja', 'en', 'zh'];

/** 목록 전체 (설정 배열 그대로) */
export function allVoices() { return settings().voices; }

/** uid 로 찾기 */
export function findVoice(uid) {
    if (!uid) return null;
    return settings().voices.find(v => v.uid === uid) || null;
}

/** 이름·다른 이름으로 찾기 (대소문자·띄어쓰기 무시) */
export function voiceByName(name) {
    const k = fold(name);
    if (!k) return null;
    const vs = settings().voices.filter(v => !v.gone);   // 5.7.2 계정에 없는 목소리는 이름으로 고르지 않음
    return vs.find(v => fold(v.name) === k) || vs.find(v => (v.aliases || []).some(a => fold(a) === k))
        // 5.7.2 괄호 앞 이름 · 괄호 안 영문 이름 ('루시퍼 (Lucifer)' ← 캐릭터 Lucifer) — 정확히 같은 이름 · 다른 이름이 없을 때만
        || vs.find(v => !(v.mix || []).length && nameKeys(v.name).slice(1).includes(k)) || null;
}

// ---------- 1.3.7 엔진 자동 맞춤 (prefer_provider)
// 같은 사람인지: 목소리 이름 · 괄호 앞 이름 · 괄호 안 영문 이름("루시퍼 (Lucifer)") · 다른 이름 · 캐릭터 이름이 하나라도 같으면.
// 괄호 안이 한글 설명("세라프 (새 참조)" · "다크초코 쿠키 (최원형)")이면 이름으로 쓰지 않는다 — 다른 목소리끼리 '새 참조' 로 맞지 않게.
const LATIN_NAME = /^[A-Za-z][A-Za-z .'\-]{0,39}$/;
function nameKeys(name) {
    const raw = String(name || '').trim();
    if (!raw) return [];
    const out = [fold(raw)];
    const base = raw.split(/[(（]/)[0].trim();
    if (base && fold(base) !== out[0]) out.push(fold(base));
    for (const m of raw.matchAll(/[(（]([^)）]+)[)）]/g)) { const inner = m[1].trim(); if (LATIN_NAME.test(inner)) out.push(fold(inner)); }
    return out.filter(Boolean);
}
/**
 * 이 목소리 · 캐릭터 이름과 같은 사람인 그 엔진의 목소리 (없으면 null). 점수: 목소리 이름(또는 다른 이름)이 정확히 같음 3 · 괄호 앞 이름 2 ·
 * 다른 이름 · 캐릭터 이름 1 — 같은 점수면 먼저 등록한 것.
 * 1.3.8: 정확히 같은 이름이 괄호 붙은 이름(「세라프 (긴 참조)」)보다 늘 앞 · 캐릭터 이름(1점)으로는 엔진의 기본 목소리(stock — 「Alice」)를 짝으로 안 고름
 */
export function twinOf(v, provider, charName = '') {
    if (!v || !provider) return null;
    if (v.provider === provider) return v;
    const full = fold(v.name), base = nameKeys(v.name)[1] || full;
    const others = new Set([...(v.aliases || []).flatMap(nameKeys), ...nameKeys(charName), ...nameKeys(v.name).slice(2)]);
    let best = null, bestScore = 0;
    for (const x of settings().voices) {
        if (x.provider !== provider || x.uid === v.uid || x.gone || (x.mix || []).length) continue;   // 5.7.2 계정에 없는 목소리는 짝이 아님
        const keys = new Set([...nameKeys(x.name), ...(x.aliases || []).flatMap(nameKeys)]);
        const exact = fold(x.name) === full || (x.aliases || []).some(a => fold(a) === full);
        const score = exact ? 3 : (keys.has(full) || keys.has(base)) ? 2 : [...others].some(k => keys.has(k)) ? 1 : 0;
        if (score === 1 && (x.stock || builtIn(x))) continue;
        if (score > bestScore) { best = x; bestScore = score; }
    }
    return best;
}
/** 1.3.8 엔진에 원래 있는 목소리인가 (목록이 정해진 엔진: OpenAI · Gemini · OpenRouter — stock 표시가 없는 1.3.7 목록도) */
function builtIn(x) {
    try { const ids = getProvider(x.provider)?.stockIds?.(); return !!ids && ids.has(String(x.voiceId)); } catch { return false; }
}
/**
 * 1.3.8 「엔진」을 따르지 않고 연결표 목소리 그대로 읽는 캐릭터인가 (settings.prefer_keep — 캐릭터별 목소리 · 대화 색에서 다른 엔진 목소리를 고름).
 * 이름은 연결표 이름 그대로 · 띄어쓰기 · 대소문자 무시 · 분석이 준 다른 글자 이름(루시퍼 → Lucifer)도
 */
export function isPinned(name, { raw = false } = {}) {
    const s = settings();
    const keep = s.prefer_keep;
    if (!keep || typeof keep !== 'object') return false;
    // 고정은 「엔진」에 맞선 것 — 「지정한 그대로」면 고정이 아님 (기록은 남겨 「엔진」을 다시 켜면 살아남). raw = 그래도 기록을 봄 (previewPrefer: 앞으로 고를 「엔진」)
    if (!raw && !s.prefer_provider) return false;
    const n = String(name || '').trim();
    if (!n) return false;
    if (keep[n] === true) return true;
    const k = fold(n);
    const hit = Object.keys(keep).find(x => keep[x] === true && fold(x) === k);
    if (hit) return true;
    const ck = charKeyOf(n);
    return !!ck && keep[ck] === true;
}
/** 엔진 자동 맞춤이 켜져 있으면 같은 사람의 그 엔진 목소리, 아니면 그대로 (1.3.8 고정한 캐릭터도 그대로) */
export function preferVoice(v, charName = '') {
    const p = settings().prefer_provider;
    if (!p || !v || !engineUsable(p)) return v;   // 5.7.2 키를 지운 엔진이면 지정한 목소리 그대로 (모두 '키를 먼저 저장해요' 로 멈추지 않게)
    if (charName && isPinned(charName)) return v;
    return twinOf(v, p, charName) || v;
}
/** 엔진 자동 맞춤을 그 엔진으로 바꾸면 캐릭터 몇이 바뀌나 (names = 연결표 이름들) → { moved: [이름], kept: [이름] } — 1.3.8 고정한 캐릭터는 셈에서 뺀다 */
export function previewPrefer(provider, names) {
    const s = settings();
    const moved = [], kept = [];
    for (const n of names) {
        if (isPinned(n, { raw: true })) continue;   // 「엔진」이 꺼져 있어도 켜면 다시 고정되니 셈에서 뺌
        const v = findVoice(s.char_map[n]) || voiceByName(n);
        if (!v) continue;
        (v.provider === provider || twinOf(v, provider, n) ? moved : kept).push(n);
    }
    return { moved, kept };
}
/**
 * 1.3.8 화자 이름 → 연결표의 이름 (없으면 ''). 그대로 · 띄어쓰기 · 대소문자 무시, 그다음 목소리 이름 · 다른 이름을 거쳐:
 * 분석이 한글로 준 '루시퍼' → 목소리 '루시퍼 (Lucifer)' 의 괄호 안 이름 → 연결표 'Lucifer' (엑스트라 · 다른 목소리로 새지 않게)
 */
export function charKeyOf(name) {
    const s = settings();
    const n = String(name || '').trim();
    const k = fold(n);
    if (!k) return '';
    if (Object.prototype.hasOwnProperty.call(s.char_map, n)) return n;
    const keys = Object.keys(s.char_map);
    const same = keys.find(x => fold(x) === k);
    if (same) return same;
    // 1.3.8 리뷰 p04: voiceByName 과 같은 차례 — 이름이 정확히 같은 목소리 → 다른 이름 → 괄호 앞 · 괄호 안 영문 이름. 맞는 목소리가 있는 첫 단계에서만 찾는다
    //   (다른 목소리에 남은 옛 다른 이름 '세라프' 의 'Lil' 이 이름이 정확히 'Lil' 인 목소리를 이기지 않게). 연결표 이름은 그 목소리의 이름 · 다른 이름이어야
    //   (빌린 목소리 '진우 쿠키' 는 그것을 쓰는 Lucifer 가 아님)
    const vs = s.voices.filter(v => !v.gone && !(v.mix || []).length);
    const tiers = [
        vs.filter(v => fold(v.name) === k),
        vs.filter(v => (v.aliases || []).some(a => fold(a) === k)),
        vs.filter(v => nameKeys(v.name).slice(1).includes(k)),
    ];
    const tier = tiers.find(t => t.length) || [];
    const exactOther = (x, v) => vs.some(o => o !== v && fold(o.name) === fold(x));
    for (const v of tier) {
        const own = nameKeys(v.name), al = (v.aliases || []).map(fold);
        const hit = keys.find(x => own.includes(fold(x))) || keys.find(x => al.includes(fold(x)) && !exactOther(x, v));
        if (hit) return hit;
    }
    return '';
}
/** 1.3.8 「나」 자동인가 (내 목소리 칸 = USER_AUTO) */
export const userAuto = () => settings().user_voice === USER_AUTO;
/** 목소리로 쓰는 uid 들 (연결표 · 기본 · 나 · 내레이터 — 「나」 자동 표시는 빼고) */
export function usedUids() {
    const s = settings();
    return new Set([...Object.values(s.char_map), s.default_voice, s.user_voice, s.narrator_voice].filter(u => u && u !== USER_AUTO));
}

/** 화자 이름 → 목소리. 나 → 내 목소리(없으면 null), 내레이터 → 내레이터(없으면 기본), 그 외 연결표 → 이름·다른 이름 → 기본.
 *  1.3.7 엔진 자동 맞춤(prefer_provider)이면 고른 목소리와 같은 사람인 그 엔진 목소리로 (없으면 원래 목소리)
 *  1.3.8 「나」 자동: 페르소나도 목소리를 안 정한 화자처럼 (연결표 → 엑스트라 → 기본) · 분석이 다른 글자로 준 이름은 연결표 이름으로 (charKeyOf) */
export function voiceFor(name, { isUser = false, kind = '' } = {}) {
    const s = settings();
    if (isUser && s.user_voice !== USER_AUTO) return preferVoice(findVoice(s.user_voice), name);
    if (kind === 'narrator' && !isUser) return preferVoice(findVoice(s.narrator_voice) || findVoice(s.default_voice));
    const n = String(name || '').trim();
    if (n) {
        const key = charKeyOf(n);
        const v = findVoice(key ? s.char_map[key] : '') || voiceByName(n);
        if (v) return preferVoice(v, key || n);
        const x = extraFor(n);                    // 1.3.7 목소리를 안 정한 화자 → 엑스트라 목소리 (없으면 기본)
        if (x) return x;
    }
    return preferVoice(findVoice(s.default_voice));
}

/**
 * 목록 한 줄의 목록 음량 보정 → autoGainDb 값 | null (없음).
 * 새 목록(목록 1.2.5 복사)은 autoGainDb — 0 도 값. 옛 목록(1.2.4 까지)의 gainDb 도 목록 값이지만 0 은 '모름'으로 버린다
 * (1.2.4 두 번 맞춤을 피하려고 gainDb 를 모두 0 으로 만든 목록을 붙여도 이름표 값이 지워지지 않게 — 목록가 정말 0 으로 잰 목소리는 이름표도 0)
 */
function studioGain(item) {
    if (hasDb(item.autoGainDb)) return Number(item.autoGainDb);
    if (hasDb(item.gainDb) && Number(item.gainDb) !== 0) return Number(item.gainDb);
    return null;
}
/**
 * 목소리 넣기·고치기. list = [{ voiceId, name?, lang?, group?, aliases?, autoGainDb?, model?, params?, ... }]
 * 이미 있으면 사용자가 고친 값은 두고 빈 곳만 채운다; overwrite=true 면 이름·그룹·원어·다른 이름·목록 음량 보정·만든 모델을 새 값으로 바꾼다
 * 1.2.3: 이름이 id 그대로면(계정에서 불러온 것) 목록 이름표로 한글 이름 · 그룹 · 원어를 채운다 (붙여넣기는 이름을 준 줄은 그대로)
 * 1.2.5: 목록의 음량 보정은 목록 값 → autoGainDb (studioGain). 사용자 보정 gainDb 는 목록으로 바꾸지 않는다 (새 목소리는 0).
 *        목록에 없는 autoGainDb · model 은 이름표로 (fillKnownFacts — 붙여넣기에서도, 이름 조건 없이)
 */
export function upsertVoices(list, provider = 'minimax', { overwrite = false } = {}) {
    const s = settings();
    let added = 0, updated = 0;
    for (const item of Array.isArray(list) ? list : []) {
        if (!item || !(item.voiceId ?? item.voice_id)) continue;
        const auto = studioGain(item);
        const nv = toVoice({ ...item, gainDb: 0, autoGainDb: auto }, item.provider || provider);
        const cur = s.voices.find(v => v.uid === nv.uid);
        if (!cur) {
            if (!overwrite || nv.name === nv.voiceId) fillKnown(nv);
            fillKnownFacts(nv);
            unremove(nv.provider, nv.voiceId);   // 1.3.8 지웠던 목소리를 다시 넣음 (불러오기 · 붙여넣기) → 계정 맞춤도 다시 따름
            s.voices.push(nv); added++; continue;
        }
        const before = JSON.stringify(cur);
        if (overwrite) {
            cur.name = nv.name; cur.group = nv.group;
            if (nv.lang) cur.lang = nv.lang;
            if (auto !== null) cur.autoGainDb = nv.autoGainDb;
            if (nv.model) cur.model = nv.model;
            if (Array.isArray(item.aliases)) cur.aliases = nv.aliases;
        } else {
            if (cur.name === cur.voiceId && nv.name !== nv.voiceId) cur.name = nv.name;
            if ((!cur.group || cur.group === '기타') && nv.group !== '기타') cur.group = nv.group;
            if (!cur.lang && nv.lang) cur.lang = nv.lang;
            if (!hasDb(cur.autoGainDb) && auto !== null) cur.autoGainDb = nv.autoGainDb;
            if (!cur.model && nv.model) cur.model = nv.model;
            for (const a of nv.aliases) if (!cur.aliases.some(x => fold(x) === fold(a))) cur.aliases.push(a);
        }
        if (!overwrite || cur.name === cur.voiceId) fillKnown(cur);
        fillKnownFacts(cur);
        if (JSON.stringify(cur) !== before) updated++;
    }
    if (added || updated) save();
    return { added, updated };
}

// ---------- 1.3.7 목록 = 연결된 계정
/** 지금 쓸 수 있는 엔진인가: 키가 필요 없거나 키가 저장돼 있음 (엔진 설정을 새로 만들지 않고 읽기만) */
export function engineUsable(id) {
    const p = getProvider(id);
    if (!p) return false;
    if (!p.needsKey) return true;
    const c = settings().providers?.[id];
    return !!(c && String(c.key || '').trim());
}
/** 목록 · 고르기에 보일 목소리: 계정에 있고(gone 아님) · 쓸 수 있는 엔진 · 「엔진」을 골랐으면 그 엔진만 */
export function shownVoices() {
    const s = settings();
    const pref = s.prefer_provider;
    return s.voices.filter(v => !v.gone && engineUsable(v.provider) && (!pref || v.provider === pref));
}
/** 숨긴 까닭별 개수 { gone, engine, nokey } (한 목소리는 한 칸에만 — 계정에 없음 → 키 없음 → 다른 엔진 순) */
export function hiddenCounts() {
    const s = settings();
    const out = { gone: 0, nokey: 0, engine: 0 };
    for (const v of s.voices) {
        if (v.gone) out.gone++;
        else if (!engineUsable(v.provider)) out.nokey++;
        else if (s.prefer_provider && v.provider !== s.prefer_provider) out.engine++;
    }
    return out;
}
/**
 * 계정 맞춤: 그 엔진의 계정 목록(listVoices 전부 — 시스템 · 기본 목소리 포함)과 비교해
 *   계정에 없는 목소리(섞은 목소리는 재료 하나라도 없으면)는 gone, 다시 생기면 되돌리고,
 *   계정에 새로 생긴 내 목소리(own — 복제 · 생성)는 자동으로 넣는다 (시스템 · 기본 목소리는 넣지 않음 — 불러오기로 고름).
 * list 를 받아 오지 못했으면 부르지 말 것 (빈 목록이면 아무것도 안 함).  → { added, gone, back, hidden }
 */
export function syncAccount(providerId, list) {
    const s = settings();
    const rows = (Array.isArray(list) ? list : []).filter(x => x && x.voiceId);
    if (!rows.length) return { added: 0, gone: 0, back: 0, hidden: s.voices.filter(v => v.provider === providerId && v.gone).length };
    const ids = new Set(rows.map(x => String(x.voiceId)));
    const ownIds = new Set(rows.filter(x => x.own === true).map(x => String(x.voiceId)));
    let gone = 0, back = 0, marked = 0;
    for (const v of s.voices) {
        if (v.provider !== providerId) continue;
        const parts = (v.mix || []).length ? v.mix.map(m => String(m.voiceId)) : [String(v.voiceId)];
        const missing = parts.some(id => !ids.has(id));
        if (missing && !v.gone) { v.gone = true; gone++; }
        else if (!missing && v.gone) { delete v.gone; back++; }
        // 1.3.8 계정 목록이 알려 준 기본 · 시스템 목소리 표시 (1.3.7 에 불러온 목소리도 — 캐릭터 이름만으로 짝이 되지 않게)
        if (!(v.mix || []).length && ids.has(String(v.voiceId))) {
            const stock = !ownIds.has(String(v.voiceId));
            if (stock && !v.stock) { v.stock = true; marked++; }
            else if (!stock && v.stock) { delete v.stock; marked++; }
        }
    }
    const have = new Set(s.voices.filter(v => v.provider === providerId).map(v => String(v.voiceId)));
    const removed = new Set(removedIds(providerId));   // 1.3.8 사용자가 지운 목소리는 다시 넣지 않음
    storeStock(providerId, rows);                 // 엑스트라 목소리용 기본 목소리 캐시도 같이
    const fresh = rows.filter(x => x.own && !have.has(String(x.voiceId)) && !removed.has(String(x.voiceId)));
    const r = fresh.length ? upsertVoices(fresh, providerId) : { added: 0 };
    // 5.7.2 새로 들어온 내 목소리가 다른 엔진에 있는 같은 사람(이름 · 괄호 안 영문 이름)이면 그 목소리의 원어 · 묶음 · 다른 이름을 이어받는다
    //   (MiniMax 에서 일본어로 읽던 캐릭터를 ElevenLabs 로 옮겨도 일본어로 · '복제' 대신 '천지합동청' 묶음에)
    for (const x of fresh) inheritTwin(s.voices.find(v => v.provider === providerId && v.voiceId === String(x.voiceId)));
    if (gone || back || marked || fresh.length) save();
    return { added: r.added || 0, gone, back, hidden: s.voices.filter(v => v.provider === providerId && v.gone).length };
}
/** 1.3.8 불러오기로 새로 들어온 목소리(voiceId 들)도 다른 엔진의 같은 사람에게서 원어 · 묶음을 이어받는다 (계정 맞춤과 같게) → 이어받은 수 */
export function inheritNew(providerId, voiceIds) {
    const s = settings();
    let n = 0;
    for (const id of voiceIds || []) if (inheritTwin(s.voices.find(v => v.provider === providerId && v.voiceId === String(id)))) n++;
    if (n) save();
    return n;
}
/**
 * 5.7.2 새 목소리 v 의 다른 엔진 쌍둥이(연결된 것 먼저)에서 원어 · 묶음 · 다른 이름을 채운다.
 * 1.3.8 짝은 목소리 이름으로, 또는 그 목소리를 쓰는 캐릭터 이름으로 (previewPrefer · voiceFor 와 같은 판단 — '진우 쿠키' 를 쓰는 Lucifer ↔ '루시퍼 (Lucifer)').
 *   캐릭터 이름으로 이어진 짝은 원어 · 묶음만 — 빌려 쓰던 목소리 이름(진우 쿠키)을 다른 이름으로 넣으면 그 목소리를 쓰는 다른 캐릭터까지 이 목소리로 바뀐다
 */
const AUTO_GROUPS = new Set(['복제', '생성', '전문', '기타', '내 목소리', '']);
function inheritTwin(v) {
    if (!v) return false;
    const s = settings();
    const mapped = usedUids();
    const charsOf = new Map();   // 목소리 uid → 그 목소리를 쓰는 캐릭터 이름들
    for (const [n, uid] of Object.entries(s.char_map)) if (uid) charsOf.set(uid, [...(charsOf.get(uid) || []), n]);
    let twin = null, viaChar = false, best = -1;
    for (const x of s.voices) {
        if (x.provider === v.provider || (x.mix || []).length || x.gone) continue;
        const byName = twinOf(x, v.provider)?.uid === v.uid;   // x 에서 보면 v 가 그 엔진의 같은 사람
        const byChar = !byName && (charsOf.get(x.uid) || []).some(n => twinOf(x, v.provider, n)?.uid === v.uid);
        if (!byName && !byChar) continue;
        const rank = (mapped.has(x.uid) ? 2 : 0) + (byName ? 1 : 0);   // 연결된 것 → 이름이 같은 것 → 먼저 등록한 것
        if (rank > best) { twin = x; viaChar = byChar; best = rank; }
    }
    if (!twin) return false;
    if (twin.lang) v.lang = twin.lang;                        // 사용자가 정해 둔 원어가 먼저 (목록의 언어 표시는 믿지 않음)
    if (AUTO_GROUPS.has(String(v.group || '')) && twin.group) v.group = twin.group;
    if (viaChar) return true;
    const seen = new Set([v.name, ...(v.aliases || [])].map(fold));
    for (const a of [twin.name, ...(twin.aliases || [])]) { if (a && !seen.has(fold(a))) { v.aliases = [...(v.aliases || []), a]; seen.add(fold(a)); } }
    return true;
}
/** 계정에 없는 목소리 지우기 — 캐릭터 · 기본 · 나 · 내레이터에 연결된 것은 남긴다 → 지운 개수 */
export function removeGone() {
    const s = settings();
    const used = usedUids();
    const drop = s.voices.filter(v => v.gone && !used.has(v.uid)).map(v => v.uid);
    for (const uid of drop) removeVoice(uid, { keep: false });
    return drop.length;
}
// ---------- 1.3.8 지운 계정 목소리 (account_removed): 계정 맞춤이 다시 넣지 않는다 · 불러오기 · 붙여넣기로 다시 넣으면 풂
const REMOVED_MAX = 500;
/** 그 엔진에서 사용자가 지운 voiceId 들 */
export function removedIds(providerId) {
    const r = settings().account_removed;
    const l = r && typeof r === 'object' ? r[providerId] : null;
    return Array.isArray(l) ? l.map(String) : [];
}
function remember(providerId, voiceId) {
    const s = settings();
    if (!s.account_removed || typeof s.account_removed !== 'object' || Array.isArray(s.account_removed)) s.account_removed = {};
    const l = Array.isArray(s.account_removed[providerId]) ? s.account_removed[providerId] : (s.account_removed[providerId] = []);
    const id = String(voiceId);
    if (!l.includes(id)) l.push(id);
    if (l.length > REMOVED_MAX) l.splice(0, l.length - REMOVED_MAX);
}
/** 지운 목록에서 뺀다 (다시 넣음) → 뺐으면 true */
export function unremove(providerId, voiceId) {
    const s = settings();
    const l = s.account_removed && s.account_removed[providerId];
    if (!Array.isArray(l)) return false;
    const i = l.indexOf(String(voiceId));
    if (i < 0) return false;
    l.splice(i, 1);
    if (!l.length) delete s.account_removed[providerId];
    return true;
}

/** 5.7.2 처음 들어온 목소리(그 전 목록이 비어 있었음)면 기본 목소리를 비워 두지 않는다 — 한국어 → 첫 목소리. 고른 목소리 | null */
export function seedDefault(before, providerId) {
    const s = settings();
    if (s.default_voice || before > 0) return null;
    const pool = s.voices.filter(v => v.provider === providerId && !v.gone && !(v.mix || []).length);
    const pick = pool.find(v => v.lang === 'ko') || pool[0] || null;
    if (!pick) return null;
    s.default_voice = pick.uid;
    save();
    return pick;
}
/** 5.7.2 그 엔진의 '계정에 없음' 표시를 모두 지운다 (계정 맞춤을 믿을 수 없는 설정 — MiniMax 직접 입력 서버가 숨긴 것) → 되돌린 개수 */
export function clearGone(providerId) {
    let n = 0;
    for (const v of settings().voices) if (v.provider === providerId && v.gone) { delete v.gone; n++; }
    if (n) save();
    return n;
}

/** 목소리 지우기 (연결표·기본·나·내레이터에서도 뺀다). keep = 1.3.8 지운 것으로 기억 (계정 맞춤이 다시 넣지 않음 — 계정에 없어 지운 것은 기억하지 않음) */
export function removeVoice(uid, { keep = true } = {}) {
    const s = settings();
    const i = s.voices.findIndex(v => v.uid === uid);
    if (i < 0) return false;
    const [gone] = s.voices.splice(i, 1);
    // 1.3.8 계정 맞춤이 지운 내 목소리를 다음 맞춤에서 다시 넣지 않게 (기본 · 시스템 목소리 · 섞은 목소리는 원래 저절로 안 들어옴)
    let acct = false;
    try { acct = !!getProvider(gone.provider)?.caps?.account; } catch { acct = false; }
    if (keep && acct && !gone.stock && !(gone.mix || []).length && gone.voiceId) remember(gone.provider, gone.voiceId);
    for (const [k, v] of Object.entries(s.char_map)) if (v === uid) { delete s.char_map[k]; if (s.prefer_keep) delete s.prefer_keep[k]; }
    for (const k of ['default_voice', 'user_voice', 'narrator_voice']) if (s[k] === uid) s[k] = '';
    if (s.prefer_provider && !s.voices.some(v => v.provider === s.prefer_provider)) s.prefer_provider = '';   // 1.3.7 그 엔진 목소리가 다 없어지면 자동 맞춤도 끔
    save();
    return true;
}

/**
 * MiniMax 목록 JSON: [{voiceId,name,lang,group,autoGainDb?,model?,aliases?}] — 원본 음량 보정·생성 모델·다른 이름을 유지한다.
 * 이전 형식의 gainDb 도 받는다 (autoGainDb 로 — upsertVoices 의 studioGain).
 */
export function importStudioList(json) {
    let arr = json;
    if (typeof json === 'string') {
        try { arr = JSON.parse(json); } catch { throw new Error('목록 형식이 아니에요'); }
    }
    if (!Array.isArray(arr)) throw new Error('목록 형식이 아니에요');
    const items = arr.filter(x => x && (x.voiceId || x.voice_id)).map(x => ({
        ...x,
        voiceId: String(x.voiceId || x.voice_id).trim(),
        name: String(x.name || x.voiceId || x.voice_id).trim(),
        lang: LANGS.includes(x.lang) ? x.lang : '',
        group: String(x.group || '기타').trim() || '기타',
        aliases: Array.isArray(x.aliases) ? x.aliases.map(a => String(a).trim()).filter(Boolean) : undefined,
    }));
    if (!items.length) throw new Error('목소리가 없어요');
    return upsertVoices(items, 'minimax', { overwrite: true });
}

// ---------- 1.3.7 엑스트라 목소리 (목소리를 안 정한 화자: 카페 사장 · 편의점 점원 …)
// 대사 분석이 그 화자의 성별 · 나이를 알려 주면(analysis people) extra_map 에 적고, 지금 쓰는 엔진의 기본 목소리
// (계정 목록의 시스템 · 기본 목소리 — 엔진이 성별을 주거나 이름에 Girl · Man 같은 낱말이 있는 것) 가운데 맞는 것을 고른다.
// 같은 이름은 늘 같은 목소리 · 이미 다른 엑스트라가 쓰는 목소리는 피한다 · 사용자가 「엑스트라로도 쓰기」를 켠 목소리가 있으면 그것들 가운데서.
// 기본 목소리 목록은 localStorage 캐시 (설정 파일은 폰과 동기화되니 넣지 않는다) — 계정 맞춤 · 분석 뒤에 채운다 (페이지를 열 때는 통신 없음).
const STOCK_KEY = 'lemon_voice_tts_stock';
const STOCK_TTL = 3 * 24 * 3600e3;
const EXTRA_MAX = 300;
function readStock() {
    try { const j = JSON.parse(globalThis.localStorage?.getItem(STOCK_KEY) || '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; }
}
/** 그 엔진의 기본 목소리 캐시 → [{ voiceId, name, g, a, l }] (성별을 아는 것만) */
export function stockOf(pid) { const e = readStock()[pid]; return e && Array.isArray(e.list) ? e.list : []; }
const stockFresh = (pid) => { const e = readStock()[pid]; return !!e && Date.now() - (Number(e.at) || 0) < STOCK_TTL; };

const FEMALE = /\b(girl|lady|woman|women|female|feminine|princess|queen|maiden|wife|girlfriend|sister|mother|mom|mommy|grandma|granny|grandmother|madam|miss|aunt|auntie|heroine|daughter|empress|witch|nun|she|her)\b|여성|여자|소녀|아가씨|할머니|누나|언니|엄마|아줌마|공주|여왕/i;
const MALE = /\b(boy|man|men|gentleman|gentlemen|male|masculine|prince|king|knight|butler|boyfriend|brother|father|dad|daddy|grandpa|grandfather|uncle|guy|sir|lord|husband|son|monk|lad|emperor|wizard|he|his|him)\b|남성|남자|소년|할아버지|아저씨|오빠|아빠|왕자|기사/i;
const YOUNG = /\b(child|kid|kids|boy|girl|little|young|youth|youthful|student|teen|teenager|lad|maiden|junior|cute)\b|어린|소년|소녀|학생|아이/i;
const OLD = /\b(old|elder|elderly|senior|grandpa|grandma|granny|grandmother|grandfather|aged|veteran)\b|노인|할머니|할아버지|노년/i;
const ADULT = /\b(adult|mature|middle|lady|woman|man|gentleman|mother|father|uncle|aunt|boss|commander|owner|wife|husband|butler|madam)\b|중년|아저씨|아줌마|어른/i;
/** CamelCase · _ · - 를 낱말로 (Korean_SweetGirl → Korean Sweet Girl) */
const words = (t) => String(t || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-./]+/g, ' ');
/** 목록 한 줄의 성별: 엔진이 준 값(gender) → 이름 · 설명 낱말. 둘 다 걸리거나 없으면 '' */
export function genderOf(item) {
    const g = String(item?.gender || '').toLowerCase();
    if (/^(f|female|feminine|woman|여)/.test(g)) return 'f';
    if (/^(m|male|masculine|man|남)/.test(g)) return 'm';
    const t = words(`${item?.voiceId || ''} ${item?.name || ''} ${item?.desc || ''}`);
    const f = FEMALE.test(t), m = MALE.test(t);
    return f === m ? '' : f ? 'f' : 'm';
}
/** 나이: y(어림) · a(어른) · o(나이 듦) · '' (모름) */
export function ageOf(item) {
    const a = String(item?.age || '').toLowerCase();
    if (/young|child|teen|kid|youth/.test(a)) return 'y';
    if (/old|elder|senior/.test(a)) return 'o';
    if (/middle|adult|mature/.test(a)) return 'a';
    const t = words(`${item?.voiceId || ''} ${item?.name || ''} ${item?.desc || ''}`);
    return OLD.test(t) ? 'o' : YOUNG.test(t) ? 'y' : ADULT.test(t) ? 'a' : '';
}
/** 계정 목록(listVoices) → 기본 목소리 캐시 (내 목소리 · 섞은 목소리 · 성별을 모르는 것은 뺌) */
export function storeStock(pid, list) {
    const rows = (Array.isArray(list) ? list : [])
        .filter(x => x && x.voiceId && x.own !== true && !(Array.isArray(x.mix) && x.mix.length))
        .map(x => ({ voiceId: String(x.voiceId), name: koVoiceName(String(x.name || x.voiceId)).slice(0, 60), g: genderOf(x), a: ageOf(x), l: LANGS.includes(x.lang) ? x.lang : '' }))
        .filter(x => x.g)
        .slice(0, 600);
    try { const all = readStock(); all[pid] = { at: Date.now(), list: rows }; globalThis.localStorage?.setItem(STOCK_KEY, JSON.stringify(all)); } catch { /* 저장소 없음 · 꽉 참 */ }
    return rows;
}
const stockJobs = new Map();
/** 기본 목소리 캐시가 없거나 오래됐으면 계정 목록을 받아 채운다 (같은 엔진은 한 번에 하나 · 실패하면 옛 캐시) */
export function ensureStock(pid) {
    if (!pid || stockFresh(pid)) return Promise.resolve(stockOf(pid));
    if (stockJobs.has(pid)) return stockJobs.get(pid);
    let p = null;
    try { p = getProvider(pid); } catch { p = null; }
    if (!p || typeof p.listVoices !== 'function' || !engineUsable(pid)) return Promise.resolve(stockOf(pid));
    const job = Promise.resolve()
        .then(() => p.listVoices(providerConfig(pid, p.defaults || {})))
        .then(list => (Array.isArray(list) && list.length ? storeStock(pid, list) : stockOf(pid)))
        .catch(() => stockOf(pid))
        .finally(() => stockJobs.delete(pid));
    stockJobs.set(pid, job);
    return job;
}

/** 이 이름에 사용자가 정한 목소리가 있나 (연결표 · 목소리 이름 · 다른 이름 — 엑스트라 표는 보지 않음) */
export function hasOwnVoice(name) {
    const s = settings();
    const n = String(name || '').trim();
    if (!n) return false;
    if (s.char_map[n]) return true;
    const k = fold(n);
    if (Object.keys(s.char_map).some(x => fold(x) === k)) return true;
    return !!voiceByName(n) || !!charKeyOf(n);   // 1.3.8 분석이 다른 글자로 준 이름 ('루시퍼' → 연결표 Lucifer)
}
/** 엑스트라 표의 같은 사람 (이름이 같음 → 띄어쓰기 · 대소문자만 다름 → 한쪽이 다른 쪽을 품음: '카페 사장님' ⊃ '카페 사장') */
export function extraKey(name) {
    const map = settings().extra_map;
    const n = String(name || '').trim();
    if (!n) return '';
    if (Object.prototype.hasOwnProperty.call(map, n)) return n;
    const k = fold(n);
    const keys = Object.keys(map);
    const same = keys.find(x => fold(x) === k);
    if (same) return same;
    if (k.length < 2) return '';
    return keys.find(x => { const f = fold(x); return f.length >= 2 && (f.includes(k) || k.includes(f)); }) || '';
}
/** 엑스트라에 쓸 엔진: 「엔진」으로 고른 것 → 기본 목소리의 엔진 → 캐릭터 연결이 가장 많은 엔진 (쓸 수 있는 것만) */
export function extraEngine() {
    const s = settings();
    if (s.prefer_provider && engineUsable(s.prefer_provider)) return s.prefer_provider;
    const d = findVoice(s.default_voice);
    if (d && engineUsable(d.provider)) return d.provider;
    const count = {};
    for (const uid of Object.values(s.char_map)) { const v = findVoice(uid); if (v && engineUsable(v.provider)) count[v.provider] = (count[v.provider] || 0) + 1; }
    return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '';
}
const nameHash = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** 엑스트라가 읽을 언어: 기본 목소리의 원어(모두 일본어로 읽는 채팅이면 엑스트라도) → 그 화자의 대사 언어 */
function extraLang(e) {
    const d = findVoice(settings().default_voice);
    return (d && d.lang) || (e && e.l) || '';
}
/** 엑스트라 한 명에게 그 엔진의 목소리 id 고르기 ('' = 맞는 게 없음 → 기본 목소리) */
function pickExtra(name, e, pid) {
    const s = settings();
    const taken = usedUids();
    const marked = s.voices.filter(v => v.provider === pid && v.extra && !v.gone && !(v.mix || []).length && !taken.has(v.uid))
        .map(v => ({ voiceId: v.voiceId, g: v.extra, a: '', l: v.lang || '' }));
    let pool = (marked.length ? marked : stockOf(pid).filter(v => !taken.has(`${pid}:${v.voiceId}`))).filter(v => v.g === e.g);
    if (!pool.length) return '';
    const narrow = (arr, f) => { const x = arr.filter(f); return x.length ? x : arr; };
    const lang = extraLang(e);
    if (lang) pool = narrow(pool, v => v.l === lang);      // MiniMax 시스템 목소리는 언어마다 따로 — 같은 언어 먼저 (없으면 아무 언어)
    if (e.a) pool = narrow(pool, v => v.a === e.a);
    const used = new Map();
    for (const x of Object.values(s.extra_map)) { const id = x && x.v && x.v[pid]; if (id) used.set(id, (used.get(id) || 0) + 1); }
    const min = Math.min(...pool.map(v => used.get(v.voiceId) || 0));
    const least = pool.filter(v => (used.get(v.voiceId) || 0) === min);
    return least[nameHash(name) % least.length].voiceId;
}
const extraVoices = new Map();   // uid → 목록에 없는 기본 목소리로 만든 목소리 객체 (같은 객체를 돌려줘야 재생기가 줄을 합친다)
const extraListeners = new Set();
/** 엑스트라 표가 바뀌면 cb() — 목소리 탭이 다시 그리게 (ui). 그만 들으려면 돌려준 함수 */
export function onExtrasChange(cb) { extraListeners.add(cb); return () => extraListeners.delete(cb); }
function emitExtras() { for (const cb of [...extraListeners]) { try { cb(); } catch { /* 듣는 쪽 오류는 무시 */ } } }
/** 화자 이름 → 엑스트라 목소리 (엑스트라를 끔 · 표에 없음 · 성별 모름 · 맞는 목소리 없음이면 null → 기본 목소리) */
export function extraFor(name) {
    const s = settings();
    if (s.extras === 'off') return null;
    const key = extraKey(name);
    const e = key ? s.extra_map[key] : null;
    if (!e || !e.g) return null;
    const pid = extraEngine();
    if (!pid) return null;
    let id = e.v && e.v[pid];
    if (!id) {
        if (!stockFresh(pid)) ensureStock(pid);              // 다음 줄부터 (지금 줄은 기본 목소리)
        id = pickExtra(key, e, pid);
        if (!id) return null;
        e.v = { ...(e.v || {}), [pid]: id };
        save();
        emitExtras();
    }
    const own = s.voices.find(v => v.provider === pid && v.voiceId === id && !v.gone);
    if (own) return own;
    const uid = `${pid}:${id}`;
    let tv = extraVoices.get(uid);
    if (!tv) {
        const st = stockOf(pid).find(x => x.voiceId === id);
        tv = toVoice({ voiceId: id, name: st ? st.name : id, group: '엑스트라', lang: (st && st.l) || extraLang(e) }, pid);
        extraVoices.set(uid, tv);
    }
    return tv;
}
/**
 * 대사 분석이 알려 준 사람들 { 이름: { g, a, l } } → 엑스트라 표 (목소리를 정한 이름 · 성별 모름은 뺌) → 고친 사람 수.
 * 표가 300명을 넘으면 처음 본 지 오래된 것부터 지운다. 다 적은 뒤 그 엔진의 기본 목소리 캐시를 채운다 (기다림 · 실패는 조용히)
 */
export async function noteExtras(people) {
    const s = settings();
    if (s.extras === 'off' || !people || typeof people !== 'object') return 0;
    let n = 0;
    for (const [raw, p] of Object.entries(people)) {
        const name = String(raw || '').trim();
        if (!name || !p || (p.g !== 'm' && p.g !== 'f') || hasOwnVoice(name)) continue;
        const key = extraKey(name);
        const cur = key ? s.extra_map[key] : null;
        if (cur) {
            if (!cur.g) { cur.g = p.g; n++; }
            if (!cur.a && p.a) { cur.a = p.a; n++; }
            continue;
        }
        s.extra_map[name] = { g: p.g, a: ['y', 'a', 'o'].includes(p.a) ? p.a : '', l: LANGS.includes(p.l) ? p.l : '', t: Date.now(), v: {} };
        n++;
    }
    const keys = Object.keys(s.extra_map);
    if (keys.length > EXTRA_MAX) {
        keys.sort((a, b) => (Number(s.extra_map[a]?.t) || 0) - (Number(s.extra_map[b]?.t) || 0));
        for (const k of keys.slice(0, keys.length - EXTRA_MAX)) delete s.extra_map[k];
    }
    if (n) { save(); emitExtras(); }
    const pid = extraEngine();
    if (pid) { try { await ensureStock(pid); } catch { /* 조용히 */ } }
    return n;
}
/**
 * 5.7.3 「나」를 자동으로 + 페르소나 이름의 성별을 바로 적는다 (사용자가 고른 것 — 분석이 알려 줄 때까지 기다리지 않게).
 * 「내 대사」가 읽지 않음이면 읽게. 이미 고른 목소리가 있으면 성별이 바뀔 때만 새로 고름
 */
export function setPersonaAuto(name, g) {
    const s = settings();
    s.user_voice = USER_AUTO;
    if (s.routes && typeof s.routes === 'object' && s.routes.user_dialogue === 'skip') s.routes.user_dialogue = 'user';
    const n = String(name || '').trim();
    if (n && (g === 'm' || g === 'f')) {
        const key = extraKey(n) || n;
        const cur = s.extra_map[key];
        if (cur) { if (cur.g !== g) { cur.g = g; cur.v = {}; } }
        else s.extra_map[key] = { g, a: '', l: '', t: Date.now(), v: {} };
    }
    save();
    emitExtras();
}
/** 5.7.3 페르소나의 엑스트라 성별을 아는가 (「나」 자동인데 아직 모르면 물어봄) */
export function personaKnown(name) {
    const key = extraKey(name);
    const e = key ? settings().extra_map[key] : null;
    return !!(e && (e.g === 'm' || e.g === 'f'));
}
/** 엑스트라 한 명을 표에서 뺀다 (다음에 분석이 다시 알려 주면 새로 고름) */
export function forgetExtra(name) {
    const s = settings();
    const key = extraKey(name);
    if (!key) return false;
    delete s.extra_map[key];
    save();
    return true;
}
