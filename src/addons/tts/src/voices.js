// TTS 목소리 찾기: 화자 이름 → 목소리, 목록 관리
import { settings, save, toVoice, fillKnown, fillKnownFacts, hasDb } from './settings.js';

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
    const vs = settings().voices;
    return vs.find(v => fold(v.name) === k) || vs.find(v => (v.aliases || []).some(a => fold(a) === k)) || null;
}

/** 화자 이름 → 목소리. 나 → 내 목소리(없으면 null), 내레이터 → 내레이터(없으면 기본), 그 외 연결표 → 이름·다른 이름 → 기본 */
export function voiceFor(name, { isUser = false, kind = '' } = {}) {
    const s = settings();
    if (isUser) return findVoice(s.user_voice);
    if (kind === 'narrator') return findVoice(s.narrator_voice) || findVoice(s.default_voice);
    const n = String(name || '').trim();
    if (n) {
        let uid = s.char_map[n];
        if (!uid) { const k = fold(n); const key = Object.keys(s.char_map).find(x => fold(x) === k); if (key) uid = s.char_map[key]; }
        const v = findVoice(uid) || voiceByName(n);
        if (v) return v;
    }
    return findVoice(s.default_voice);
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

/** 목소리 지우기 (연결표·기본·나·내레이터에서도 뺀다) */
export function removeVoice(uid) {
    const s = settings();
    const i = s.voices.findIndex(v => v.uid === uid);
    if (i < 0) return false;
    s.voices.splice(i, 1);
    for (const [k, v] of Object.entries(s.char_map)) if (v === uid) delete s.char_map[k];
    for (const k of ['default_voice', 'user_voice', 'narrator_voice']) if (s[k] === uid) s[k] = '';
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
