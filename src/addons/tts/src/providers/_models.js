// 1.3.7 엔진 모델 목록 — 늘 최신. 엔진 API 가 주는 목록(listModels)을 localStorage 에 12시간 둔다
//   (settings.json 이 아니다: 그 파일은 폰 ↔ PC 로 동기화되니 목록이 바뀔 때마다 출렁이지 않게)
//   저장 모양: 'lemon_voice_tts_models' = { <엔진 id>: { at, scope, list: [{ value, label, meta? }] } }
//     scope = 목록이 달라지는 조건 (OpenAI 는 주소 — 다른 주소의 목록은 안 씀)
//
//   modelOptions(id, fallback, cfg, opts) → select 선택지
//       받은 목록 (없으면 엔진의 최신 기본 목록) + 저장된 값이 목록에 없으면 그 값 ('목록에 없음' 등) + 직접 입력 (value 'custom')
//       → 사용자가 고른 모델은 절대 바꾸지 않는다. 직접 입력이면 model_custom 칸 (customField)
//   resolveModel(cfg, fallback) → 실제로 요청할 모델 (직접 입력이면 model_custom, 비면 fallback)
//   keyModel(cfg, fallback) → 캐시 키에 넣을 모델 (직접 입력이 아니면 저장된 값 그대로 — 1.3.6 과 같은 키)
//   storeModels / cachedModels / isStale / modelMeta / shared(진행 중인 요청 하나로) / pending
//   newer(a, b) / atLeast(a, b): 버전 [major, minor] 비교 (엔진마다 id 를 읽어 미래 모델도 최신 갈래처럼)
// 네트워크는 여기서 하지 않는다 (엔진의 listModels 가 하고 storeModels 로 넣음). 실패하면 예전 목록 그대로.
import { koModelLabel } from '../model-names.js';

export const STORE = 'lemon_voice_tts_models';
export const MODELS_TTL = 12 * 60 * 60 * 1000;
export const CUSTOM = 'custom';
const MAX_LIST = 300;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
let memo = { raw: null, obj: {} };   // 같은 글이면 다시 파싱하지 않는다
let mem = null;                       // localStorage 를 못 쓰면(사생활 창 · 막힘) 이 세션만

function readAll() {
    if (mem) return mem;
    let raw = null;
    try { raw = globalThis.localStorage ? globalThis.localStorage.getItem(STORE) : null; } catch { raw = null; }
    if (raw === memo.raw) return memo.obj;
    let obj = {};
    try { const j = raw ? JSON.parse(raw) : {}; obj = isObj(j) ? j : {}; } catch { obj = {}; }
    memo = { raw, obj };
    return obj;
}
function writeAll(obj) {
    try {
        if (!globalThis.localStorage) throw new Error('no storage');
        const raw = JSON.stringify(obj);
        globalThis.localStorage.setItem(STORE, raw);
        memo = { raw, obj };
    } catch { mem = obj; }
}
const entryOf = (id) => { const e = readAll()[id]; return isObj(e) && Array.isArray(e.list) ? e : null; };

/** [{ value, label, meta? }] · 문자열 배열도 받음. 빈 값 · 같은 값은 뺀다 */
export function normalizeList(list) {
    const out = [];
    const seen = new Set();
    for (const x of Array.isArray(list) ? list : []) {
        const o = typeof x === 'string' ? { value: x } : x;
        const value = o && (typeof o.value === 'string' || typeof o.value === 'number') ? String(o.value).trim() : '';
        if (!value || value === CUSTOM || seen.has(value)) continue;
        seen.add(value);
        const item = { value, label: typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 120) : value };
        if (isObj(o.meta)) item.meta = o.meta;
        out.push(item);
        if (out.length >= MAX_LIST) break;
    }
    return out;
}

/** 받은 목록을 넣는다. 빈 목록은 넣지 않는다 (예전 목록을 지우지 않게). 넣은 목록을 돌려줌 */
export function storeModels(id, list, scope = '') {
    const norm = normalizeList(list);
    if (!norm.length) return norm;
    const all = { ...readAll() };
    all[id] = { at: Date.now(), scope: String(scope || ''), list: norm };
    writeAll(all);
    return norm;
}
/** 받아 둔 목록 (scope 가 다르면 null). 오래돼도 돌려준다 — 새로 받을 때까지는 이것을 보여 줌 */
export function cachedModels(id, scope = '') {
    const e = entryOf(id);
    return e && String(e.scope || '') === String(scope || '') && e.list.length ? e.list : null;
}
/** 새로 받을 때인가 (없음 · 다른 scope · TTL 지남 · 시계가 뒤로 감) */
export function isStale(id, scope = '', ttl = MODELS_TTL) {
    const e = entryOf(id);
    if (!e || String(e.scope || '') !== String(scope || '') || !e.list.length) return true;
    const age = Date.now() - Number(e.at || 0);
    return !(age >= 0 && age < ttl);
}
/** 받은 목록에 적힌 모델 정보 (ElevenLabs: style · boost · en) — 모르면 null */
export function modelMeta(id, model, scope = '') {
    const list = cachedModels(id, scope);
    const hit = list && list.find(o => o.value === String(model || ''));
    return hit && isObj(hit.meta) ? hit.meta : null;
}
/** 시험용: 캐시 비우기 */
export function clearModels() {
    mem = null;
    memo = { raw: null, obj: {} };
    try { globalThis.localStorage?.removeItem(STORE); } catch { /* 저장소 없음 */ }
}

/**
 * select 선택지: 받은 목록 || fallback, 저장된 값(목록에 없으면 그대로 · 이름표 뒤에 note), 직접 입력.
 * opts.scope · opts.note(id) → '이전 모델' 같은 짧은 말 (없으면 '목록에 없음') · opts.label(o) → 보여 줄 이름 · opts.custom = false 면 직접 입력 없음
 */
export function modelOptions(id, fallback, cfg, { scope = '', note, label, custom = true } = {}) {
    const base = cachedModels(id, scope) || normalizeList(fallback);
    // 1.3.7 보이는 이름은 한국어 (model-names.js 규칙 — 아직 안 나온 모델도). 값(id)은 그대로 · 영어만 되는 모델은 (영어만)
    const shown = (o) => {
        const given = (typeof label === 'function' && label(o)) || o.label;
        const ko = koModelLabel(id, o.value, given);
        return o.meta && o.meta.en && !/영어만/.test(ko) ? `${ko} (영어만)` : ko;
    };
    const list = base.map(o => ({ value: o.value, label: shown(o) }));
    const cur = cfg && cfg.model !== undefined && cfg.model !== null ? String(cfg.model) : '';
    if (cur && cur !== CUSTOM && !list.some(o => o.value === cur)) {
        const n = (typeof note === 'function' && note(cur)) || '목록에 없음';
        list.push({ value: cur, label: `${koModelLabel(id, cur)} (${n})` });
    }
    if (custom) list.push({ value: CUSTOM, label: '직접 입력' });
    return list;
}

/** 직접 입력 칸. nokey: 캐시 키에는 이 칸 대신 실제 모델이 들어간다 (엔진의 modelFor → keyModel) — 모델을 고른 사람의 키는 그대로 */
export const customField = (label = '모델 이름') => ({ key: 'model_custom', label, type: 'text', default: '', nokey: true, show: (cfg) => !!cfg && cfg.model === CUSTOM });

/** 실제로 요청할 모델: 직접 입력이면 model_custom, 비었으면 fallback */
export function resolveModel(cfg, fallback = '') {
    const c = cfg || {};
    const m = c.model === CUSTOM ? c.model_custom : c.model;
    return String(m ?? '').trim() || fallback;
}
/** 캐시 키의 모델 칸: 직접 입력이면 실제 모델, 아니면 저장된 값 그대로 (예전 키와 같게) */
export function keyModel(cfg, fallback = '') {
    const c = cfg || {};
    return c.model === CUSTOM ? resolveModel(c, fallback) : c.model;
}

// ---------- 진행 중인 요청 하나로 (설정 창 · 연결 확인 · ↻ 가 잇달아 불러도 한 번만)
const inflight = new Map();
export function shared(key, fn) {
    let job = inflight.get(key);
    if (job) return job;
    job = Promise.resolve().then(fn);
    inflight.set(key, job);
    const done = () => { if (inflight.get(key) === job) inflight.delete(key); };
    job.then(done, done);
    return job;
}
export const pending = (key) => inflight.has(key);

// ---------- 버전 [major, minor] 비교 (null = 못 읽음)
export function newer(a, b) {
    if (!a || !b) return false;
    return a[0] !== b[0] ? a[0] > b[0] : (a[1] || 0) > (b[1] || 0);
}
export const atLeast = (a, b) => !!a && !!b && !newer(b, a);
