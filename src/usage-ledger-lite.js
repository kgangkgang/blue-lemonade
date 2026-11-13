// 1.1.1 가볍게: 사용량 장부 허브의 시작 그래프 몫 — 허브 걸기 · 설정 · 알림만 (README 「확장 만드는 분께」 · DEVELOPERS.md)
//   기록 · 읽기 · 값 셈(usage-ledger.js · usage-ledger-core.js · 가격 제공처 표)은 허브의 record · query · summary · price 를 처음 부를 때 받아요.
//   on · payMethods · setPayMethod · setKrwRate 는 여기서 곧바로 돌아요(예전과 같은 동기 함수). 꺼져 있으면 record 는 모듈을 받지 않고 null.
// 순수 상수 · originOf · dayKey · dayStart 는 usage-ledger-core.js 가 그대로 다시 내보내요(시험 · 화면이 쓰던 이름 그대로).

export const LEDGER_SYMBOL = Symbol.for('blue-lemonade.usage');
export const LEDGER_VERSION = 1;
export const KEEP_DAYS = 90;
export const PAY_METHODS = Object.freeze(['크레딧', '실제 결제', '중계']);
/** 원/달러 기본값 — 사용자가 설정에서 바꾼다 (서울외국환중개 매매기준율, 돈 지도 2026-10-20) */
export const DEFAULT_KRW = Object.freeze({ rate: 1332.1, date: '2026-10-20', source: '서울외국환중개 매매기준율 (2026-10-20)' });

/** 주소에서 origin 만 (경로 · 검색어 · 계정 정보 · 키는 버린다). http(s) 가 아니면 '' */
export function originOf(value) {
    if (typeof value !== 'string' || !value) return '';
    try {
        const url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol)) return '';
        return url.origin;
    } catch { return ''; }
}

/** 이 기기 날짜 'YYYY-MM-DD' */
export function dayKey(at) {
    const d = new Date(at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' (이 기기 날짜)의 시작 시각 */
export function dayStart(day) {
    const [y, m, d] = String(day).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1).getTime();
}

const SETTINGS_KEY = 'bl_usage_ledger';
const listeners = new Set();
/** 중계 origin 들 (setRelayRate · 예산 기능이 알려 준 것) — usage-ledger.js relayContext 가 읽어요 */
export const relayOrigins = new Set();

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
    // 7.7.2 중계마다 「쿼터 1달러 = 몇 원」 (가격 비교에서 충전 단가 · 환율로 정한 것) { [origin]: { rate, source, date } }
    if (!s.relayRates || typeof s.relayRates !== 'object' || Array.isArray(s.relayRates)) s.relayRates = {};
    for (const [key, value] of Object.entries(s.relayRates)) if (!originOf(key) || originOf(key) !== key || !(Number(value?.rate) > 0 && Number.isFinite(Number(value.rate)))) delete s.relayRates[key];
    return s;
}
export const ledgerEnabled = () => ledgerSettings().enabled !== false;
function saveLedgerSettings() { try { context()?.saveSettingsDebounced?.(); } catch { /* 저장은 다음에 */ } }

export function emit() { for (const fn of listeners) { try { fn(); } catch (error) { console.warn('[Blue Lemonade] 사용량 장부 알림', error); } } }

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
    if (!(Number.isFinite(n) && n > 0)) return false;   // 위쪽 상한 없음 — 곱하기에만 쓰여요
    ledgerSettings().krw = { rate: n, date: String(date).slice(0, 10), source: String(source).slice(0, 80) };
    saveLedgerSettings(); emit();
    return true;
}
/** 7.7.2 중계 origin 의 「쿼터 1달러 = rate 원」 (null 이면 지움) — 장부의 중계 원화 환산이 그 중계 기준이 된다 */
export function setRelayRate(origin, rate, source = '', date = dayKey(Date.now())) {
    const o = originOf(origin), s = ledgerSettings();
    if (!o) return false;
    if (rate === null) delete s.relayRates[o];
    else if (Number(rate) > 0 && Number.isFinite(Number(rate))) s.relayRates[o] = { rate: Math.round(Number(rate) * 100) / 100, source: String(source).slice(0, 80), date: String(date).slice(0, 10) };
    else return false;
    relayOrigins.add(o); saveLedgerSettings(); emit();
    return true;
}

// 기록 · 읽기 본체 — 처음 부를 때 한 번 받아요(실패하면 다음에 다시)
let full = null;
const loadFull = () => full ||= import('./usage-ledger.js').catch(error => { full = null; throw error; });

/** 허브를 건다 (BL 시작 때 — 가볍다: 장부 · 가격표는 처음 쓸 때 연다) */
export function installUsageLedger() {
    const existing = globalThis[LEDGER_SYMBOL];
    if (existing && existing.version >= LEDGER_VERSION && existing.__bl) return existing;
    // record 는 부른 순간의 값 · 시각으로 적어요(본체를 받는 동안 부른 쪽이 객체를 바꿔도 같은 기록)
    const record = raw => {
        try {
            if (!ledgerEnabled()) return Promise.resolve(null);
            const at = Date.now(), copy = raw && typeof raw === 'object' ? { ...raw } : raw;
            return loadFull().then(m => m.record(copy, at), () => null);
        } catch { return Promise.resolve(null); }
    };
    const query = (...args) => loadFull().then(m => m.query(...args));
    const summary = (...args) => loadFull().then(m => m.summary(...args));
    const price = (...args) => loadFull().then(m => m.price(...args));
    const hub = Object.freeze({ version: LEDGER_VERSION, __bl: true, record, query, summary, price, on, payMethods, setPayMethod, setKrwRate });
    try { Object.defineProperty(globalThis, LEDGER_SYMBOL, { value: hub, configurable: true, writable: false }); }
    catch { globalThis[LEDGER_SYMBOL] = hub; }
    return hub;
}
