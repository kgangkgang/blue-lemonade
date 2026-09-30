// TTS 오디오 캐시: IndexedDB 'lemon-voice' v2, 저장소 'audio'
// 레코드 { key, blob, mime, lufs, t(마지막 사용 ms), size }
// 1.0.0 (v1: 저장소 audio + 색인 t) 에서 올라오면 저장소를 그대로 두고 빠진 색인만 만든다
// 1.2.2: has(key) (읽기만) · setProtected(keys) — 미리 만든 최근 답장의 소리는 정리(prune)에서 빼 둔다 · pickEvictions (순수 함수, 시험용)
//        onClear(fn) — 비우기 뒤 재생기가 메모리에 든 사본(진행 중 · warm · prepared)도 버리게
import { settings } from './settings.js';
import { log } from './log.js';

const DB = 'lemon-voice';
const VER = 2;
const STORE = 'audio';
const BUMP_MS = 60_000;      // 마지막 사용 시각은 1분에 한 번만 다시 씀
const OPEN_TIMEOUT = 8_000;  // 다른 탭이 막고 있을 때 기다리는 한계
const RETRY_MS = 60_000;     // 열기 실패 뒤 다시 시도까지

/** 문자열 해시 (cyrb53 → base36) */
export function hash(str) {
    const s = String(str ?? '');
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** 키 정렬 JSON (같은 파라미터면 같은 문자열) */
function stableJson(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
        .map(k => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
}

/** 캐시 키: hash(엔진|목소리 uid|섞기|파라미터(정렬)|언어|감정|글) */
export function cacheKey({ provider, uid, mix, params, lang, emotion, text } = {}) {
    const mixStr = (Array.isArray(mix) ? mix : []).map(m => `${m.voiceId}=${m.weight}`).join(',');
    return hash([provider || '', uid || '', mixStr, stableJson(params || {}), lang || '', emotion || '', text || ''].join('\u0001'));
}

// ---------- 열기

let dbP = null;
let failedAt = 0;

function open() {
    if (dbP) return dbP;
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (Date.now() - failedAt < RETRY_MS) return Promise.resolve(null);
    // 시크릿 창 등에서 open() 자체가 던지면 dbP 를 건드리지 않고 바로 실패 (안에서 던지면 dbP 가 null 약속으로 굳는다)
    let req;
    try { req = indexedDB.open(DB, VER); }
    catch (e) { log('err', `캐시 열기 실패: ${e?.name || ''}`); failedAt = Date.now(); return Promise.resolve(null); }
    dbP = new Promise((resolve) => {
        let done = false;
        const finish = (d) => {
            if (done) { if (d) d.close(); return; }
            done = true;
            clearTimeout(timer);
            if (!d) { dbP = null; failedAt = Date.now(); }
            resolve(d);
        };
        const timer = setTimeout(() => { log('err', '캐시 열기 시간 초과'); finish(null); }, OPEN_TIMEOUT);
        req.onupgradeneeded = () => {
            const d = req.result;
            const st = d.objectStoreNames.contains(STORE)
                ? req.transaction.objectStore(STORE)
                : d.createObjectStore(STORE, { keyPath: 'key' });
            if (!st.indexNames.contains('t')) st.createIndex('t', 't');
        };
        req.onsuccess = () => {
            const d = req.result;
            d.onversionchange = () => { d.close(); if (dbP) dbP = null; };   // 다른 탭이 올리면 놓아준다
            finish(d);
        };
        req.onerror = () => { log('err', `캐시 열기 실패: ${req.error?.name || ''}`); finish(null); };
        req.onblocked = () => { /* 다른 탭이 닫으면 이어서 열린다 (시간 초과 있음) */ };
    });
    return dbP;
}

/** 트랜잭션 한 번: fn(store) 안에서 요청을 걸고 결과는 클로저로 받는다. 완료 → true, 못 쓰면 null */
function tx(mode, fn) {
    return open().then(d => {
        if (!d) return null;
        return new Promise((resolve, reject) => {
            let t;
            try { t = d.transaction(STORE, mode); } catch (e) { reject(e); return; }
            t.oncomplete = () => resolve(true);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error || new Error('abort'));
            try { fn(t.objectStore(STORE)); } catch (e) { reject(e); try { t.abort(); } catch { /* 이미 끝남 */ } }
        });
    }).catch(e => {
        log('err', `캐시 오류: ${e?.name || e?.message || e}`);
        return null;
    });
}

// ---------- 한도 · 정리

let est = null;       // { count, bytes } 대략치 (정리 스캔으로 정확해짐)
let pruning = null;
let protectedKeys = new Set();   // 정리에서 빼는 키 (미리 만든 최근 답장)
const clearSubs = new Set();

/** 정리에서 뺄 키 (미리 만들기가 최근 답장 몇 개의 키를 준다). 전부 바꿔 끼움 */
export function setProtected(keys) {
    protectedKeys = new Set([...(keys || [])].filter(Boolean));
}
/**
 * 지울 키 고르기 (순수): rows 는 오래된 것부터 { key, size }. 지켜야 할 키는 건너뛰고 오래된 것부터 한도 안으로.
 * 지켜야 할 것만 남아 한도를 넘으면 더 지우지 않는다
 */
export function pickEvictions(rows, lim, keep = protectedKeys) {
    const out = [];
    let n = rows.length, b = 0;
    for (const r of rows) b += Number(r.size) || 0;
    for (let i = 0; i < rows.length && (n > lim.count || b > lim.bytes); i++) {
        if (keep && keep.has(rows[i].key)) continue;
        out.push(rows[i].key);
        n--; b -= Number(rows[i].size) || 0;
    }
    return { keys: out, count: n, bytes: b };
}

/** 한도 (0 이면 무제한, 잘못된 값이면 기본값) */
function limits() {
    const s = settings();
    const n = Number(s.cache_limit), mb = Number(s.cache_mb);
    return {
        count: n === 0 ? Infinity : (Number.isFinite(n) && n > 0 ? n : 1000),
        bytes: mb === 0 ? Infinity : (Number.isFinite(mb) && mb > 0 ? mb : 200) * 1048576,
    };
}

const sizeOf = (rec) => Number(rec.size) || (rec.blob && rec.blob.size) || 0;

/** 오래된 것부터 지워 개수·용량 한도 안으로 */
export function prune() {
    if (pruning) return pruning;
    pruning = tx('readwrite', (st) => {
        const lim = limits();
        const rows = [];
        const cur = st.index('t').openCursor();   // t 오름차순 = 오래된 것 먼저
        cur.onsuccess = () => {
            const c = cur.result;
            if (c) { rows.push({ key: c.value.key, size: sizeOf(c.value) }); c.continue(); return; }
            const pick = pickEvictions(rows, lim);
            for (const k of pick.keys) st.delete(k);
            est = { count: pick.count, bytes: pick.bytes };
        };
    }).finally(() => { pruning = null; });
    return pruning;
}

function pruneIfNeeded() {
    const lim = limits();
    if (!est || est.count > lim.count || est.bytes > lim.bytes) prune();
}

// ---------- 공개 API

/** 꺼내기 → { blob, mime, lufs } | null. 마지막 사용 시각을 올린다 (LRU) */
export async function get(key) {
    if (!key) return null;
    let rec = null;
    await tx('readwrite', (st) => {
        const r = st.get(key);
        r.onsuccess = () => {
            rec = r.result || null;
            if (rec && rec.blob && Date.now() - (Number(rec.t) || 0) > BUMP_MS) {
                rec.t = Date.now();
                st.put(rec);
            }
        };
    });
    if (!rec || !rec.blob) return null;
    return {
        blob: rec.blob,
        mime: rec.mime || rec.blob.type || 'audio/mpeg',
        lufs: Number.isFinite(rec.lufs) ? rec.lufs : null,
    };
}

/** 있나 (읽기만 — 마지막 사용 시각은 그대로) */
export async function has(key) {
    if (!key) return false;
    let n = 0;
    const ok = await tx('readonly', (st) => { const c = st.count(key); c.onsuccess = () => { n = c.result || 0; }; });
    return !!ok && n > 0;
}

/** 넣기 (같은 키면 덮어씀) 뒤 한도 정리. 성공 → true */
export async function put(key, blob, meta = {}) {
    if (!key || !blob || !blob.size) return false;
    const rec = {
        key,
        blob,
        mime: meta.mime || blob.type || 'audio/mpeg',
        lufs: Number.isFinite(meta.lufs) ? meta.lufs : null,
        t: Date.now(),
        size: blob.size,
    };
    let existed = false;
    const ok = await tx('readwrite', (st) => {
        const c = st.count(key);
        c.onsuccess = () => { existed = c.result > 0; };
        st.put(rec);
    });
    if (!ok) return false;
    if (est && !existed) { est.count++; est.bytes += rec.size; }
    pruneIfNeeded();
    return true;
}

/** 하나 지우기 */
export async function remove(key) {
    if (!key) return false;
    const ok = await tx('readwrite', (st) => { st.delete(key); });
    est = null;
    return !!ok;
}

/** 모두 지우기 (재생기가 메모리 사본도 버리게 알림) */
export async function clear() {
    for (const fn of clearSubs) { try { fn(); } catch { /* 구독자 오류는 무시 */ } }
    const ok = await tx('readwrite', (st) => { st.clear(); });
    est = { count: 0, bytes: 0 };
    return !!ok;
}
/** 비우기 알림 받기 → 떼는 함수 */
export function onClear(fn) {
    clearSubs.add(fn);
    return () => clearSubs.delete(fn);
}

/** 개수 · 바이트 */
export async function stats() {
    let count = 0, bytes = 0;
    const ok = await tx('readonly', (st) => {
        const cur = st.openCursor();
        cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            count++;
            bytes += sizeOf(c.value);
            c.continue();
        };
    });
    if (ok) est = { count, bytes };
    return { count, bytes };
}
