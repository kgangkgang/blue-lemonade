// 7.4.0 사용량 장부 허브 — globalThis[Symbol.for('blue-lemonade.usage')] (README 「확장 만드는 분께」)
//
// 확장마다 「무슨 기능이 얼마 썼나」를 한 곳에 적는 장부. 이 기기 IndexedDB(BlueLemonadeUsage)에만, 90일 둔다. 밖으로 보내지 않는다.
//   record(entry)            기록 한 건 (네트워크 없음 · 곧바로 돌아옴) → Promise<id | null>
//   query({ from, to })      [{ ...entry, cost: { usd, krw, priceSource, estimated, approx, kind, relay, payMethod, note } }]
//   summary({ day } | { from, to })  { total, requests, replies, lines, byExt, byFeature, byModel, topReply, krw }
//   price(model, api, at?)   Promise<{ inPerM, outPerM, cachedInPerM, currency, source, date, approx, note } | null>
//   on('change', cb)         기록이 늘거나 값이 바뀌면 → 떼는 함수
//   payMethods()             { [연결 열쇠]: '크레딧' | '실제 결제' | '중계' } (기본값 + 사용자가 바꾼 것)
// 값은 기록 시각 · 실제 연결의 단가로 물을 때 셈한다(날짜별 단가 · 나중에 맞춘 중계 과금이 반영된다). 키 · 비밀은 받지도 남기지도 않는다.
import { LEDGER_SYMBOL, LEDGER_VERSION, KEEP_DAYS, DEFAULT_KRW, PAY_METHODS, normalizeEntry, costOf, summarize, matchRelayLogs, dayKey, dayStart, connectionOf, payKeyOf, payMethodOf, officialRates, originOf } from './usage-ledger-core.js';

const DB_NAME = 'BlueLemonadeUsage', STORE = 'entries', SETTINGS_KEY = 'bl_usage_ledger';
const listeners = new Set();
let dbPromise = null, queue = [], flushTimer = 0, pricing = null, pruned = false;

function context() { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } }
/** 설정 (extension_settings.bl_usage_ledger): enabled · krw { rate, date, source } · payMethods { 열쇠: 수단 } */
export function ledgerSettings() {
    const ext = context()?.extensionSettings;
    if (!ext) return { enabled: true, krw: { ...DEFAULT_KRW }, payMethods: {} };
    const s = ext[SETTINGS_KEY] && typeof ext[SETTINGS_KEY] === 'object' ? ext[SETTINGS_KEY] : (ext[SETTINGS_KEY] = {});
    if (typeof s.enabled !== 'boolean') s.enabled = true;
    if (!s.krw || typeof s.krw !== 'object' || !(Number(s.krw.rate) > 0)) s.krw = { ...DEFAULT_KRW };
    if (!s.payMethods || typeof s.payMethods !== 'object' || Array.isArray(s.payMethods)) s.payMethods = {};
    for (const [key, value] of Object.entries(s.payMethods)) if (!PAY_METHODS.includes(value) || ['__proto__', 'constructor', 'prototype'].includes(key)) delete s.payMethods[key];
    return s;
}
export const ledgerEnabled = () => ledgerSettings().enabled !== false;
function saveLedgerSettings() { try { context()?.saveSettingsDebounced?.(); } catch { /* 저장은 다음에 */ } }

function emit() { for (const fn of listeners) { try { fn(); } catch (error) { console.warn('[Blue Lemonade] 사용량 장부 알림', error); } } }

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open(DB_NAME, 1); } catch (error) { reject(error); return; }
        request.onupgradeneeded = () => { const store = request.result.createObjectStore(STORE, { keyPath: 'id' }); store.createIndex('at', 'at'); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => reject(request.error || new Error('usage ledger unavailable'));
    }).catch(error => { dbPromise = null; throw error; });
    return dbPromise;
}
async function tx(mode, run) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode), store = t.objectStore(STORE);
        let value;
        Promise.resolve(run(store, v => { value = v; })).catch(reject);
        t.oncomplete = () => resolve(value); t.onerror = t.onabort = () => reject(t.error);
    });
}
function flush() {
    flushTimer = 0;
    const rows = queue.splice(0);
    if (!rows.length) return;
    tx('readwrite', store => { for (const row of rows) store.put(row); }).then(emit, error => { if (typeof indexedDB !== 'undefined') console.warn('[Blue Lemonade] 사용량 장부를 저장하지 못했어요', error); });
    if (!pruned) { pruned = true; setTimeout(prune, 30000)?.unref?.(); }
}
/** 90일 지난 기록 지우기 (시작 뒤 한 번, 기록할 때) */
async function prune() {
    const before = Date.now() - KEEP_DAYS * 86400000;
    try { await tx('readwrite', store => { const req = store.index('at').openCursor(IDBKeyRange.upperBound(before)); req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } }; }); } catch { /* 다음에 */ }
}
const newId = at => `${at}-${Math.random().toString(36).slice(2, 10)}`;

/** 기록 한 건. 이름 · 기능 글은 기록하는 쪽이 준다. 꺼져 있거나 못 쓰는 기록이면 null */
export function record(raw) {
    try {
        if (!ledgerEnabled()) return Promise.resolve(null);
        const entry = normalizeEntry(raw);
        if (!entry) return Promise.resolve(null);
        entry.id = newId(entry.at);
        queue.push(entry);
        if (!flushTimer) flushTimer = setTimeout(flush, 400);
        return Promise.resolve(entry.id);
    } catch { return Promise.resolve(null); }
}

async function readRange(from, to) {
    if (queue.length) { clearTimeout(flushTimer); flush(); }
    try {
        return await tx('readonly', (store, done) => {
            const req = store.index('at').getAll(IDBKeyRange.bound(from, to));
            req.onsuccess = () => done(req.result || []);
        }) || [];
    } catch { return []; }
}

// ── 가격 (BL 가격표 — 처음 물을 때 읽는다. 큰 표라 시작 때 읽지 않는다) ──
async function pricingModules() {
    if (!pricing) pricing = Promise.all([import('./addons/perf/pricing-live.js'), import('./addons/perf/pricing-sync.js'), import('./addons/perf/pricing-providers.js')])
        .then(([live, sync, providers]) => { try { sync.loadPriceCache(); } catch { /* 저장된 표 없음 — 함께 실린 표 */ } return { live, providers }; });
    return pricing;
}
function lookupWith({ live, providers }) {
    return (provider, model, at) => {
        const snap = live.priceSnapshot(provider);
        if (!snap) return null;
        const table = snap.models || {};
        const id = Object.hasOwn(table, model) ? model : Object.keys(table).find(key => table[key]?.aliases?.includes?.(model)) || String(model).replace(/-(?:\d{8}|\d{4}-\d{2}-\d{2})$/, '');
        const row = table[id];
        if (!row) return null;
        let rates;
        if (snap.format === 'anthropic') rates = { input: row[0], output: row[1], cacheRead: row[2] };
        else if (snap.format === 'openai') rates = { input: row.standard?.[0], output: row.standard?.[3], cacheRead: row.standard?.[1] ?? undefined };
        else {
            if (row.expires && at > Date.parse(row.expires)) return null;   // 기간이 끝난 할인 단가는 쓰지 않는다 (날짜별 표가 대신)
            rates = { ...row.rates };
        }
        if (!Number.isFinite(rates.input) || !Number.isFinite(rates.output)) return null;
        return { rates, source: providers.PROVIDERS[provider]?.url || '', date: String(snap.checkedAt || '').slice(0, 10) };
    };
}
/** 중계 주소 · 단가 · 쿼터 단위 — 예산 기능 설정에서 (키는 읽지 않는다) */
function relayContext() {
    const log = context()?.extensionSettings?.request_log || {};
    const prices = log.prices && typeof log.prices === 'object' ? log.prices : {};
    const relays = new Set();
    for (const row of Object.values(prices)) if (row?.auto && row.origin) relays.add(originOf(row.origin));
    // 예산 기능의 중계 주소 — 비워 두면 실리태번 사용자 지정 주소(custom_url)의 서버 (budget.js baseUrl 과 같은 규칙)
    const base = originOf(String(log.budget?.baseUrl || '')) || originOf(String(context()?.chatCompletionSettings?.custom_url || ''));
    if (log.budget?.enabled && base) relays.add(base);
    for (const origin of relayOrigins) relays.add(origin);
    relays.delete('');
    return { relays: [...relays], relayPrices: prices, quotaPerUnit: Number(log.budget?.quotaPerUnit) || 500000 };
}
const relayOrigins = new Set();
/** 예산 기능이 중계 주소를 알면 알려 준다 (본체 연결 주소를 물려받는 경우) */
export function noteRelayOrigin(origin) { const o = originOf(origin); if (o) relayOrigins.add(o); }

async function priceContext() {
    const modules = await pricingModules();
    const s = ledgerSettings();
    return { lookup: lookupWith(modules), ...relayContext(), payMethods: s.payMethods, krw: s.krw };
}

export async function query({ from = 0, to = Date.now() } = {}) {
    const rows = await readRange(Number(from) || 0, Number(to) || Date.now());
    const ctx = await priceContext();
    return rows.map(entry => ({ ...entry, cost: costOf(entry, ctx) }));
}
function rangeOf(opts = {}) {
    if (opts.day) { const start = dayStart(opts.day); return { from: start, to: start + 86400000 - 1 }; }
    if (opts.month) { const [y, m] = String(opts.month).split('-').map(Number); return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 1).getTime() - 1 }; }
    return { from: Number(opts.from) || dayStart(dayKey(Date.now())), to: Number(opts.to) || Date.now() };
}
export async function summary(opts = {}) {
    const range = rangeOf(opts);
    const s = ledgerSettings();
    return { ...summarize(await query(range)), from: range.from, to: range.to, krw: { ...s.krw }, note: '가격표 기준 어림값이에요 — 실제 청구와 다를 수 있어요. 「≈」 줄은 토큰 수를 셌거나 단가를 어림한 줄이에요.' };
}
export async function price(model, api, at = Date.now()) {
    const modules = await pricingModules();
    const conn = connectionOf({ api: String(api || ''), origin: '' });
    if (conn.kind !== 'official') return null;
    const found = officialRates(conn.provider, String(model || ''), Number(at) || Date.now(), lookupWith(modules));
    if (!found) return null;
    return { inPerM: found.rates.input, outPerM: found.rates.output, cachedInPerM: Number.isFinite(found.rates.cacheRead) ? found.rates.cacheRead : null, currency: 'USD', source: found.source || '', date: found.date || '', approx: !!found.approx, note: found.note || '' };
}
export function on(event, cb) {
    if (event !== 'change' || typeof cb !== 'function') return () => {};
    listeners.add(cb);
    return () => listeners.delete(cb);
}
export function payMethods() {
    const s = ledgerSettings();
    return { defaults: { vertex: '크레딧', anthropic: '크레딧', 'relay:*': '중계', '*': '실제 결제' }, set: { ...s.payMethods }, choices: [...PAY_METHODS] };
}
export function setPayMethod(key, method) {
    const s = ledgerSettings();
    const k = String(key || '').slice(0, 120);
    if (!k || ['__proto__', 'constructor', 'prototype'].includes(k)) return false;
    if (method === null || method === '') delete s.payMethods[k];
    else if (PAY_METHODS.includes(method)) s.payMethods[k] = method;
    else return false;
    saveLedgerSettings(); emit();
    return true;
}
export function setKrwRate(rate, date = dayKey(Date.now()), source = '사용자 입력') {
    const n = Number(rate);
    if (!(n > 0 && n < 100000)) return false;
    ledgerSettings().krw = { rate: n, date: String(date).slice(0, 10), source: String(source).slice(0, 80) };
    saveLedgerSettings(); emit();
    return true;
}
/** 연결 열쇠 (결제 수단 고르기 창이 줄마다 쓰는 것) — 공식 = 제공처, 중계 = relay:<host> */
export function payKeyFor(entry) { return payKeyOf(connectionOf(entry, relayContext().relays)); }
export function payMethodFor(entry) { const conn = connectionOf(entry, relayContext().relays); return payMethodOf(conn, ledgerSettings().payMethods); }

/**
 * 예산 기능이 중계 장부(/api/log/token)를 받으면 불러 준다 — 장부의 중계 요청과 맞춰 실제 과금(쿼터)을 적는다. 이 함수는 네트워크를 쓰지 않는다.
 * origin: 그 중계 서버 origin (키 · 경로 없이)
 */
export async function applyRelayLogs(origin, logs) {
    const o = originOf(origin);
    if (!o || !Array.isArray(logs) || !logs.length) return 0;
    relayOrigins.add(o);
    const newest = Math.max(...logs.map(log => Number(log.created_at) * 1000 || 0));
    const rows = (await readRange(newest - 3 * 86400000, Date.now())).filter(entry => entry.origin === o && entry.relayQuota === undefined);
    if (!rows.length) return 0;
    const found = matchRelayLogs(rows, logs, { origin: o });
    if (!found.size) return 0;
    try {
        await tx('readwrite', store => { for (const entry of rows) { const hit = found.get(entry.id); if (hit) store.put({ ...entry, relayQuota: hit.quota, relayLogId: hit.logId }); } });
    } catch { return 0; }
    emit();
    return found.size;
}

/** 저장소 보고용: 기록 수 · 대략 바이트 */
export async function ledgerStats() {
    try {
        return await tx('readonly', (store, done) => {
            let count = 0, bytes = 0;
            const req = store.openCursor();
            req.onsuccess = () => { const c = req.result; if (!c) { done({ count, bytes }); return; } count++; bytes += JSON.stringify(c.value).length * 2; c.continue(); };
        }) || { count: 0, bytes: 0 };
    } catch { return { count: 0, bytes: 0 }; }
}

/** 허브를 건다 (BL 시작 때 — 가볍다: 장부 · 가격표는 처음 쓸 때 연다) */
export function installUsageLedger() {
    const existing = globalThis[LEDGER_SYMBOL];
    if (existing && existing.version >= LEDGER_VERSION && existing.__bl) return existing;
    const hub = Object.freeze({ version: LEDGER_VERSION, __bl: true, record, query, summary, price, on, payMethods, setPayMethod, setKrwRate });
    try { Object.defineProperty(globalThis, LEDGER_SYMBOL, { value: hub, configurable: true, writable: false }); }
    catch { globalThis[LEDGER_SYMBOL] = hub; }
    return hub;
}
