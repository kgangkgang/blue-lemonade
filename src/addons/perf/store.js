// 요청 로그 — 기록 보관 (IndexedDB)
// 기록은 이 기기의 브라우저에만 남는다 (settings.json에 넣기엔 너무 크고, 폰과 PC의 요청은 따로 세는 게 맞다).
// IndexedDB를 쓸 수 없는 창(시크릿 모드 등)에서는 메모리에만 남겨서 창을 닫으면 사라진다.
import { settings } from './state.js';

const DB_NAME = 'request_log';
const DB_VERSION = 2;
const ENTRIES = 'entries';
const DAILY = 'daily';
/** 중계 서버가 기록한 실제 과금의 날짜별 합 (1.2.0) — 키 "YYYY-MM-DD|모델" */
const RELAY = 'relay_daily';

let dbPromise = null;
/** IndexedDB가 없을 때의 대체 보관 */
const memory = { entries: [], daily: new Map(), relay: new Map() };
let memoryOnly = false;

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        let request;
        try {
            request = indexedDB.open(DB_NAME, DB_VERSION);
        } catch {
            memoryOnly = true;
            return resolve(null);
        }
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ENTRIES)) {
                const store = db.createObjectStore(ENTRIES, { keyPath: 'id' });
                store.createIndex('at', 'at');
            }
            if (!db.objectStoreNames.contains(DAILY)) {
                db.createObjectStore(DAILY, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(RELAY)) {
                db.createObjectStore(RELAY, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.warn('[요청 로그] IndexedDB를 열지 못했어요. 메모리에만 기록해요.', request.error);
            memoryOnly = true;
            resolve(null);
        };
        request.onblocked = () => {
            memoryOnly = true;
            resolve(null);
        };
    });
    return dbPromise;
}

function tx(db, store, mode, work) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const result = work(transaction.objectStore(store));
        transaction.oncomplete = () => resolve(result?.result ?? result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function isMemoryOnly() {
    return memoryOnly;
}

// ── 요청 기록 ────────────────────────────────────────────────

export async function addEntry(entry) {
    const db = await openDb();
    if (!db) {
        memory.entries.unshift(entry);
        memory.entries.length = Math.min(memory.entries.length, settings().maxEntries);
        return;
    }
    await tx(db, ENTRIES, 'readwrite', store => store.put(entry));
}

export async function getEntry(id) {
    const db = await openDb();
    if (!db) return memory.entries.find(entry => entry.id === id) ?? null;
    const store = db.transaction(ENTRIES, 'readonly').objectStore(ENTRIES);
    return (await requestToPromise(store.get(id))) ?? null;
}

/** 최근 것부터. before를 주면 그 시각보다 앞선 것만 (페이지 넘기기). */
export async function listEntries({ limit = 50, before = null } = {}) {
    const db = await openDb();
    if (!db) {
        return memory.entries.filter(entry => before === null || entry.at < before).slice(0, limit);
    }
    return new Promise((resolve, reject) => {
        const out = [];
        const index = db.transaction(ENTRIES, 'readonly').objectStore(ENTRIES).index('at');
        const range = before === null ? null : IDBKeyRange.upperBound(before, true);
        const cursorRequest = index.openCursor(range, 'prev');
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor || out.length >= limit) return resolve(out);
            out.push(cursor.value);
            cursor.continue();
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
    });
}

export async function countEntries() {
    const db = await openDb();
    if (!db) return memory.entries.length;
    const store = db.transaction(ENTRIES, 'readonly').objectStore(ENTRIES);
    return requestToPromise(store.count());
}

/**
 * 오래된 기록을 정리한다: maxEntries를 넘는 것은 지우고, keepBodies보다 오래된 것은 본문(프롬프트·응답)을 비운다.
 * 날짜별 집계는 건드리지 않는다.
 */
export async function trimEntries() {
    const { maxEntries, keepBodies } = settings();
    const db = await openDb();
    if (!db) {
        memory.entries.length = Math.min(memory.entries.length, maxEntries);
        memory.entries.forEach((entry, position) => { if (position >= keepBodies) stripBody(entry); });
        return;
    }
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(ENTRIES, 'readwrite');
        const index = transaction.objectStore(ENTRIES).index('at');
        const cursorRequest = index.openCursor(null, 'prev');
        let position = 0;
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            if (position >= maxEntries) {
                cursor.delete();
            } else if (position >= keepBodies && hasBody(cursor.value)) {
                const stripped = { ...cursor.value };
                stripBody(stripped);
                cursor.update(stripped);
            }
            position++;
            cursor.continue();
        };
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function hasBody(entry) {
    return !!(entry.messages || entry.prompt || entry.reply || entry.reasoning);
}

/** 본문을 비우고 '본문 없음' 표시를 남긴다. */
export function stripBody(entry) {
    delete entry.messages;
    delete entry.prompt;
    delete entry.reply;
    delete entry.reasoning;
    delete entry.raw;
    entry.stripped = true;
}

export async function clearEntries() {
    const db = await openDb();
    memory.entries = [];
    if (!db) return;
    await tx(db, ENTRIES, 'readwrite', store => store.clear());
}

// ── 날짜별 집계 ──────────────────────────────────────────────
// 키: "YYYY-MM-DD|모델|부르는 쪽". 요청이 끝날 때마다 더한다. 요청 기록이 지워져도 집계는 남는다.

export function dayKeyOf(at) {
    const date = new Date(at);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function bumpDaily(entry) {
    const day = dayKeyOf(entry.at);
    const key = `${day}|${entry.model || '?'}|${entry.caller || 'unknown'}|${entry.purpose || 'unknown'}`;
    const add = {
        requests: 1,
        errors: entry.ok ? 0 : 1,
        promptTokens: Number(entry.promptTokens) || 0,
        completionTokens: Number(entry.completionTokens) || 0,
        reasoningTokens: Number(entry.reasoningTokens) || 0,
        cachedTokens: Number(entry.cachedTokens)||0,
        unknownUsage: !entry.usageKnown&&!entry.estimated?1:0,
        estimatedRequests: entry.estimated ? 1 : 0,
        cost: Number(entry.cost) || 0,
        priced: entry.cost === null || entry.cost === undefined ? 0 : 1,
    };
    const db = await openDb();
    if (!db) {
        const row = memory.daily.get(key) ?? { key, day, model: entry.model || '?', caller: entry.caller || 'unknown', purpose: entry.purpose || 'unknown', kind: entry.kind || 'text', ...zeroSums() };
        memory.daily.set(key, sum(row, add));
        return;
    }
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(DAILY, 'readwrite');
        const store = transaction.objectStore(DAILY);
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
            const row = getRequest.result ?? { key, day, model: entry.model || '?', caller: entry.caller || 'unknown', purpose: entry.purpose || 'unknown', kind: entry.kind || 'text', ...zeroSums() };
            store.put(sum(row, add));
        };
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        // [1.2.2] 저장 공간이 꽉 차면 요청 오류 없이 트랜잭션만 중단된다(QuotaExceededError). 그때도 약속을 끝내야 한다 — 이 파일의 다른 트랜잭션도 같다
        transaction.onabort = () => reject(transaction.error);
    });
}

function zeroSums() {
    return { cachedTokens:0,unknownUsage:0, requests: 0, errors: 0, promptTokens: 0, completionTokens: 0, reasoningTokens: 0, estimatedRequests: 0, cost: 0, priced: 0 };
}

function sum(row, add) {
    for (const [field, value] of Object.entries(add)) row[field] = (Number(row[field]) || 0) + value;
    return row;
}

export async function listDaily() {
    const db = await openDb();
    if (!db) return [...memory.daily.values()];
    const store = db.transaction(DAILY, 'readonly').objectStore(DAILY);
    return (await requestToPromise(store.getAll())) ?? [];
}

export async function clearDaily() {
    const db = await openDb();
    memory.daily.clear();
    if (!db) return;
    await tx(db, DAILY, 'readwrite', store => store.clear());
}

/** 가격표를 고친 뒤 집계의 비용을 다시 계산한다 (토큰 수는 그대로). */
export async function repriceDaily(costOf) {
    const db = await openDb();
    const reprice = (row) => {
        const cost = (row.kind&& !['text','embedding'].includes(row.kind))||row.unknownUsage===row.requests?null:costOf(row.model, row.promptTokens, row.completionTokens);
        row.cost = cost ?? 0;
        row.priced = cost === null ? 0 : Math.max(0,row.requests-(row.unknownUsage||0));
        return row;
    };
    if (!db) {
        for (const row of memory.daily.values()) reprice(row);
        return;
    }
    // [1.2.2] 읽기와 쓰기를 한 트랜잭션에서 한다. 예전에는 따로 해서, 그 사이에 끝난 요청의 합계(bumpDaily)가
    // 읽어 둔 옛 줄로 덮여 사라졌다 (예산 새로 고침이 자동 가격을 바꾸는 순간 번역 · 다시 쓰기 요청이 끝나면).
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(DAILY, 'readwrite');
        const store = transaction.objectStore(DAILY);
        const getAll = store.getAll();
        getAll.onsuccess = () => (getAll.result ?? []).forEach(row => store.put(reprice(row)));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

// ── 중계 서버 과금 (1.2.0) ───────────────────────────────────
// 중계 서버는 최근 요청 1,000건만 주니, 받아 올 때마다 날짜·모델별로 합쳐 두면 오래된 날도 남는다.

export async function listRelayDaily() {
    const db = await openDb();
    if (!db) return [...memory.relay.values()];
    const store = db.transaction(RELAY, 'readonly').objectStore(RELAY);
    return (await requestToPromise(store.getAll())) ?? [];
}

export async function putRelayDaily(rows) {
    if (!rows.length) return;
    const db = await openDb();
    if (!db) {
        for (const row of rows) memory.relay.set(row.key, row);
        return;
    }
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(RELAY, 'readwrite');
        const store = transaction.objectStore(RELAY);
        rows.forEach(row => store.put(row));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

export async function clearRelayDaily() {
    const db = await openDb();
    memory.relay.clear();
    if (!db) return;
    await tx(db, RELAY, 'readwrite', store => store.clear());
}
