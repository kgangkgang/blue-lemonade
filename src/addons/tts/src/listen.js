// TTS 1.4.4 듣는 언어 (설정 listen_lang) — 채팅을 어떤 언어로 하든 TTS 는 고른 언어로 읽는다.
//   '자동'(기본) = 1.4.3 과 똑같이 (이 모듈을 거치지 않는다 — 요청 · 캐시 키 그대로).
//   고르면: 읽을 줄 가운데 그 언어가 아닌 줄만 블루 레몬에이드 LLM 번역 애드온(연결 · 모델 · 키 · 용어집)으로 옮긴다.
//   화면 글 · 강조 · 화자 · 감정 분석은 그대로이고 소리(와 재생 막대 글)만 바뀐다. 번역기의 화면 번역 언어는 건드리지 않는다.
//
// 어느 글을 옮기나 (player.buildJobs):
//   고른 글(읽을 글 설정 · 목소리별 우선 글)이나 그 짝(원문 ↔ 번역문)이 이미 그 언어면 그 글을 그대로 (요청 없음 — 예: 화면 번역문이 한국어이고 한국어로 들음).
//   아니면 원문(모델이 쓴 글)을 옮긴다 — 번역문을 다시 옮기면 뜻이 두 번 흐려지고, 번역문은 늦게 오거나 없을 수 있다.
// 언제 옮기나: 번역 기다리기 · 대사 분석이 끝난 뒤 (player.prepareThen 의 마지막 단계 · 미리 만들기는 번역문을 기다린 뒤 2차에서).
//   메시지마다 한 요청 (자동 읽기로 읽을 줄 + 누른 줄을 ⟦n⟧ 번호 묶음 하나로) — 그 뒤 다시 듣기 · 대사 클릭 · 미리 만들기는 캐시에서.
// 캐시: 열쇠 = 판(v1) · 목표 언어 · 번역기 연결/모델(speechModelTag) · 원문 해시. 메모리(3000줄) + IndexedDB 'lemon-voice-listen'(5000줄, 오래된 것부터 지움).
//   용어집을 고쳐도 옛 번역은 그대로 (채팅 번역 캐시와 같은 규칙) — 데이터 탭의 캐시 비우기가 이것도 비운다.
// 같은 줄을 두 곳(자동 읽기 · 미리 만들기)이 함께 원하면 한 요청에 붙고, 기다리는 쪽이 모두 그만두면 요청도 끊는다.
// 못 옮긴 줄은 잠시(거절 · 답에 없음 10분, 그 밖 오류 1분) 다시 보내지 않고 원문으로 (failedRecently — 다시 듣기 · 누르기마다 값을 치르지 않게).
// 엔진에 알릴 언어는 spokenLang: 옮긴 글에 그 언어 글자가 없으면(모델이 안 옮기고 돌려줌) 글에서 감지.
// 시험: tools/tests/tts-listen.mjs

import { extension_settings } from '../../../../../../../extensions.js';
import { log } from './log.js';

export const LISTEN_LANGS = Object.freeze(['auto', 'ko', 'ja', 'en', 'zh']);
export const LISTEN_LABELS = Object.freeze({ auto: '자동', ko: '한국어', ja: '日本語', en: 'English', zh: '中文' });
const LANG_KO = Object.freeze({ ko: '한국어', ja: '일본어', en: '영어', zh: '중국어' });
/** 막대 · 알림용 한국어 이름 (한국어 · 일본어 · 영어 · 중국어 — 모두 '로' 가 붙는다) */
export const langName = (t) => LANG_KO[t] || String(t || '');
const API = Symbol.for('blue-lemonade.translator');
const VER = 'v1';                 // 프롬프트를 바꾸면 올린다 (옛 번역을 다시 쓰지 않게)
const MEM_MAX = 3000;
const DB_NAME = 'lemon-voice-listen';
const STORE = 'lines';
const DB_MAX = 5000;

/** 설정 → 목표 언어 코드 ('' = 자동: 지금처럼) */
export function listenTarget(s) {
    const v = s && typeof s === 'object' ? s.listen_lang : '';
    return typeof v === 'string' && v !== 'auto' && LISTEN_LANGS.includes(v) ? v : '';
}

// ---------- 글자 갈래 (싸게: 정규식으로 셈)
const HANGUL = /[\uac00-\ud7a3\u3131-\u318e]/g;
const KANA = /[\u3041-\u309f\u30a0-\u30ff\u31f0-\u31ff\uff66-\uff9f]/g;
const HAN = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
const LATIN = /[A-Za-z\u00c0-\u024f]/g;
const count = (s, re) => (s.match(re) || []).length;
/** { h: 한글, k: 가나, c: 한자, l: 라틴 } */
export function scriptCounts(text) {
    const s = String(text ?? '');
    return { h: count(s, HANGUL), k: count(s, KANA), c: count(s, HAN), l: count(s, LATIN) };
}
/**
 * 이 줄이 이미 그 언어인가 (옮길 필요 없음). 한글 · 가나 · 한자 한 글자는 라틴 두 글자로 셈 (한 글자가 담는 말이 더 많다).
 * ko = 한글이 절반 이상 · ja = 가나가 있고 가나+한자가 60 % 이상 (한자만 있는 줄은 중국어일 수도 있어 옮김) ·
 * en = 라틴이 80 % 이상 · zh = 가나 · 한글 없이 한자가 60 % 이상. 글자가 하나도 없으면(…… · !?) 참 — 옮길 것이 없다
 */
export function inTarget(text, target) {
    const { h, k, c, l } = scriptCounts(text);
    const total = 2 * (h + k + c) + l;
    if (!total) return true;
    switch (target) {
        case 'ko': return (2 * h) / total >= 0.5;
        case 'ja': return k > 0 && (2 * (k + c)) / total >= 0.6 && (2 * h) / total < 0.2;
        case 'en': return l / total >= 0.8;
        case 'zh': return k === 0 && h === 0 && (2 * c) / total >= 0.6;
        default: return true;
    }
}

/**
 * 옮긴 글을 엔진에 알릴 언어: 그 언어 글자가 있으면 target, 없으면 '' (글에서 감지) — 모델이 안 옮기고 돌려준 영어 줄에
 * 일본어 발음 힌트(MiniMax language_boost · ElevenLabs language_code)를 주지 않게. 번역기에 그 언어로 달라고 했으니 inTarget 보다 너그럽다
 * (한글 답 속 영어 이름 · 한자만인 일본어 답 「大丈夫。」). 글자가 없으면 target
 */
export function spokenLang(text, target) {
    const { h, k, c, l } = scriptCounts(text);
    if (!(h + k + c + l)) return target;
    switch (target) {
        case 'ko': return h > 0 ? 'ko' : '';
        case 'ja': return k > 0 || (c > 0 && h === 0) ? 'ja' : '';
        case 'zh': return c > 0 && k === 0 && h === 0 ? 'zh' : '';
        case 'en': return l > 0 && l >= 2 * (h + k + c) ? 'en' : '';
        default: return '';
    }
}

// ---------- 캐시
/** 같은 줄로 볼 원문 (앞뒤 공백 · 줄바꿈만 정리 — 번역기에 보내는 모양과 같음) */
export const normSource = (text) => String(text ?? '').replace(/\s*\n+\s*/g, ' ').trim();
function fnv(str, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
/** 캐시 열쇠: 판 · 목표 언어 · 번역 연결/모델 · 원문 (원문은 해시 둘 + 길이) */
export function cacheKey(src, target, model) {
    const t = normSource(src);
    return `${VER}|${target}|${String(model || '')}|${fnv(t, 2166136261)}${fnv(t, 0x9747b28c)}.${t.length}`;
}
const mem = new Map();   // 열쇠 → 옮긴 글 (최근 것이 뒤)
function memGet(k) {
    if (!mem.has(k)) return undefined;
    const v = mem.get(k);
    mem.delete(k);
    mem.set(k, v);
    return v;
}
function memSet(k, v) {
    mem.delete(k);
    mem.set(k, v);
    while (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
}
let tagMemo = { at: 0, v: '' };
/** 번역기의 연결 · 모델 지문 (1초 기억 — buildJobs 가 줄마다 부른다) */
export function modelTag() {
    const now = Date.now();
    if (now - tagMemo.at < 1000) return tagMemo.v;
    let v = '';
    try { const api = globalThis[API]; v = typeof api?.speechModelTag === 'function' ? String(api.speechModelTag() ?? '') : ''; } catch { v = ''; }
    tagMemo = { at: now, v };
    return v;
}
/** 메모리에 있는 번역 ('' = 없음 — 네트워크 · IndexedDB 를 안 봄) */
export function peek(src, target) {
    const v = memGet(cacheKey(src, target, modelTag()));
    return typeof v === 'string' ? v : '';
}
// 못 옮긴 줄 (메모리만): 거절 · 입력 차단 · 답에 없음은 10분, 그 밖 오류(429 · 5xx · 네트워크)는 1분 동안 다시 보내지 않고 원문으로 읽는다 —
// 전엔 막힌 메시지를 다시 듣거나 줄을 누를 때마다 같은 줄로 요청(+ 다시 보내기)이 또 나가고 「번역 중…」을 기다렸다. 그만둠 · 준비 안 됨은 세지 않음
const FAIL_MS = 10 * 60 * 1000;
const FAIL_SHORT_MS = 60 * 1000;
const failedAt = new Map();   // 열쇠 → 다시 보낼 수 있는 때
function markFailed(keys, ms) {
    const until = Date.now() + ms;
    for (const k of keys) { failedAt.delete(k); failedAt.set(k, until); }
    while (failedAt.size > MEM_MAX) failedAt.delete(failedAt.keys().next().value);
}
function failedKey(k, now = Date.now()) {
    const t = failedAt.get(k);
    if (!t) return false;
    if (t > now) return true;
    failedAt.delete(k);
    return false;
}
/** 이 줄을 얼마 전에 옮기지 못했나 (그동안은 원문으로 — 요청 없음) */
export function failedRecently(src, target) {
    return failedKey(cacheKey(src, target, modelTag()));
}

// ---------- IndexedDB (없거나 막히면 메모리만 — 사생활 모드 · 시험)
let dbp = null;
function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined' || !indexedDB) { reject(new Error('IndexedDB 없음')); return; }
        let r;
        try { r = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
        r.onupgradeneeded = () => {
            const db = r.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'k' }).createIndex('at', 'at');
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error || new Error('IndexedDB 열기 실패'));
        r.onblocked = () => reject(new Error('IndexedDB 막힘'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
}
function txDone(t) { return new Promise((resolve, reject) => { t.oncomplete = () => resolve(true); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); }); }
async function dbGet(keys) {
    const out = new Map();
    if (!keys.length) return out;
    try {
        const db = await openDb();
        const t = db.transaction(STORE, 'readonly');
        const st = t.objectStore(STORE);
        for (const k of keys) { const r = st.get(k); r.onsuccess = () => { if (r.result && typeof r.result.t === 'string') out.set(k, r.result.t); }; }
        await txDone(t);
    } catch { /* 메모리만 */ }
    return out;
}
let writes = 0;
async function dbPut(rows) {
    if (!rows.length) return;
    try {
        const db = await openDb();
        const t = db.transaction(STORE, 'readwrite');
        const st = t.objectStore(STORE);
        for (const row of rows) st.put(row);
        await txDone(t);
        writes += rows.length;
        if (writes >= 200) { writes = 0; await prune(); }
    } catch { /* 메모리만 */ }
}
/** 5000줄을 넘으면 오래된 것부터 4000줄까지 */
async function prune() {
    try {
        const db = await openDb();
        const n = await new Promise((resolve, reject) => { const r = db.transaction(STORE, 'readonly').objectStore(STORE).count(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        if (n <= DB_MAX) return;
        let drop = n - Math.round(DB_MAX * 0.8);
        const t = db.transaction(STORE, 'readwrite');
        const req = t.objectStore(STORE).index('at').openCursor();
        req.onsuccess = () => { const c = req.result; if (!c || drop <= 0) return; c.delete(); drop--; c.continue(); };
        await txDone(t);
    } catch { /* 다음에 */ }
}
/** 캐시 비우기 (데이터 탭) — 메모리 · IndexedDB */
export async function clearCache() {
    mem.clear();
    failedAt.clear();
    try {
        const db = await openDb();
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).clear();
        await txDone(t);
    } catch { /* 없음 */ }
}

// ---------- 번역기 (블루 레몬에이드 LLM 번역 애드온의 translateForSpeech)
/** 지금 옮길 수 있나 → { ok, why, api } — 애드온이 꺼졌거나(단독 확장이 돌면 내장판은 대기) 연결 · 모델 · 키가 없으면 ok=false */
export function translatorState() {
    const api = globalThis[API];
    const on = !!extension_settings?.salty?.addons?.translator;
    if (!on || !api || typeof api.translateForSpeech !== 'function') return { ok: false, why: '블루 레몬에이드의 LLM 번역이 꺼져 있어요', api: null };
    let r = { ok: true };
    try { if (typeof api.speechReady === 'function') r = api.speechReady() || { ok: false }; } catch (e) { r = { ok: false, why: String(e?.message || e) }; }
    return r.ok ? { ok: true, why: '', api } : { ok: false, why: String(r.why || 'LLM 번역 설정을 확인해요'), api: null };
}
const abortError = () => Object.assign(new Error('중단'), { name: 'AbortError' });
const inflight = new Map();   // 열쇠 → { ctrl, users, keys, promise }
function startBatch(api, lines, target, model) {
    const e = { ctrl: new AbortController(), users: 0, keys: lines.map(x => cacheKey(x, target, model)), promise: null };
    e.promise = (async () => {
        try {
            const out = await api.translateForSpeech(lines, target, { signal: e.ctrl.signal });
            const rows = [];
            const missed = [];
            const at = Date.now();
            lines.forEach((_, i) => {
                const t = typeof out?.[i] === 'string' ? out[i].trim() : '';
                if (!t) { missed.push(e.keys[i]); return; }
                memSet(e.keys[i], t);
                rows.push({ k: e.keys[i], t, at });
            });
            void dbPut(rows);
            if (missed.length) markFailed(missed, FAIL_MS);
            log('info', `듣는 언어 번역 · ${langName(target)} ${rows.length}/${lines.length}줄`);
            return rows.length;
        } catch (err) {
            if (!e.ctrl.signal.aborted && err?.name !== 'AbortError' && !err?.notReady) markFailed(e.keys, err?.refused ? FAIL_MS : FAIL_SHORT_MS);
            throw err;
        } finally {
            for (const k of e.keys) if (inflight.get(k) === e) inflight.delete(k);
        }
    })();
    e.promise.catch(() => { /* 기다리는 쪽이 받는다 */ });
    for (const k of e.keys) inflight.set(k, e);
    return e;
}
/** 진행 중인 요청에 붙기 — 내 signal 로 그만두면 나만 빠지고, 아무도 안 기다리면 요청도 끊는다 */
function joinBatch(e, signal) {
    e.users++;
    return new Promise((resolve, reject) => {
        let done = false;
        const settle = (fn, v) => {
            if (done) return;
            done = true;
            e.users--;
            signal?.removeEventListener('abort', onAbort);
            fn(v);
        };
        function onAbort() {
            settle(reject, abortError());
            if (e.users <= 0 && !e.ctrl.signal.aborted) e.ctrl.abort();
        }
        if (signal?.aborted) { onAbort(); return; }
        signal?.addEventListener('abort', onAbort, { once: true });
        e.promise.then(v => settle(resolve, v), err => settle(reject, err));
    });
}
/**
 * 원문 줄들을 target 으로: 메모리 → IndexedDB → 번역기 한 요청 (이미 다른 쪽이 보낸 줄은 그 요청에 붙음). 끝나면 peek 로 꺼낸다.
 * → { asked: 번역기에 새로 보낸 줄 수, failed: 끝내 못 옮긴 줄 수 }. 번역기를 못 쓰면 notReady 오류 · 그만두면 AbortError
 */
export async function fill(srcs, target, { signal = null } = {}) {
    const model = modelTag();
    const now = Date.now();
    const left = [...new Set((srcs || []).map(normSource).filter(Boolean))].filter(x => memGet(cacheKey(x, target, model)) === undefined);
    const want = left.filter(x => !failedKey(cacheKey(x, target, model), now));   // 얼마 전에 못 옮긴 줄은 보내지 않음 (원문)
    const skipped = left.length - want.length;
    if (!want.length) return { asked: 0, failed: skipped };
    const stored = await dbGet(want.map(x => cacheKey(x, target, model)));
    if (signal?.aborted) throw abortError();
    const rest = [];
    for (const x of want) {
        const k = cacheKey(x, target, model);
        const v = stored.get(k);
        if (v) memSet(k, v); else rest.push(x);
    }
    if (!rest.length) return { asked: 0, failed: skipped };
    const joined = new Set();
    const mine = [];
    for (const x of rest) {
        const e = inflight.get(cacheKey(x, target, model));
        if (e && !e.ctrl.signal.aborted) joined.add(e); else mine.push(x);
    }
    if (signal?.aborted) throw abortError();
    if (mine.length) {
        const st = translatorState();
        if (!st.ok) throw Object.assign(new Error(st.why), { notReady: true });
        joined.add(startBatch(st.api, mine, target, model));
    }
    await Promise.all([...joined].map(e => joinBatch(e, signal)));
    const failed = rest.filter(x => memGet(cacheKey(x, target, model)) === undefined).length + skipped;
    return { asked: mine.length, failed };
}
/** 시험용 */
export const _forTest = { mem, inflight, failedAt, reset() { mem.clear(); inflight.clear(); failedAt.clear(); tagMemo = { at: 0, v: '' }; } };
