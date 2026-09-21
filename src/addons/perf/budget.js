// 요청 로그 — 예산 (중계 서버의 사용량·잔액 연동, 1.2.0)
//
// new-api 계열 중계 서버는 API 키만으로 두 가지를 준다.
//   GET /api/usage/token/        그 키의 누적 사용량 (quota 단위, 500000 = 1달러)
//   GET /api/log/token?key=…     그 키의 최근 요청 1,000건 — 모델·토큰·실제 과금(quota)
// 콘솔에서 만든 시스템 액세스 토큰이 있으면 GET /api/user/self 로 계정의 실제 잔액도 가져온다.
// 잔액은 세 가지 중 되는 것으로 정한다: 계정 잔액 > 키에 걸린 한도 > (충전 금액 − 기준 시점 이후 사용액).
import { oai_settings } from '../../../../../../openai.js';
import { TITLE, settings, saveSettings, money, costOf } from './state.js';
import { listRelayDaily, putRelayDaily, dayKeyOf, repriceDaily } from './store.js';

const RELAY_LOG_LIMIT = 1000;
// 키로 조회하는 두 엔드포인트(/api/usage/token, /api/log/token)는 같은 IP에서 20분에 약 20번까지만 받는다 (넘으면 429, Retry-After 초).
// 한 번 새로 고칠 때 둘을 부르니 4분에 한 번이면 20분에 10번이다. 계정 엔드포인트(/api/user/self)는 그런 제한이 없어 1분에 한 번 묻는다.
const KEY_INTERVAL_MS = 4 * 60_000;
const ACCOUNT_INTERVAL_MS = 60_000;
const DEFAULT_RETRY_MS = 10 * 60_000;
const TIMEOUT_MS = 15_000;

const state = {
    loading: false,
    /** 키 엔드포인트를 마지막으로 부른 시각. [1.2.1] 429 물러남 시각은 설정(budget.retryAt)에 저장한다 — 새로 고침해도 남아야 한다 */
    lastKeyFetchAt: 0,
    /** 마지막 키 조회가 429였나 */
    limited: false,
    lastAccountFetchAt: 0,
    updatedAt: 0,
    /** [1.2.2] 키 사용량(token)을 받은 시각. updatedAt은 계정 잔액을 받아도 바뀌어서 "방금 받은 사용량인가"를 가릴 수 없다 */
    tokenAt: 0,
    /** 마지막 실패 이유 */
    error: null,
    /** /api/usage/token/ 의 data */
    token: null,
    /** /api/user/self 의 data (계정 토큰이 있을 때) */
    account: null,
    accountError: null,
    /** 최근 요청 1,000건 */
    logs: [],
    logsError: null,
    /** 날짜·모델별 실제 과금 — store의 relay_daily와 같은 내용 */
    daily: [],
};

const listeners = new Set();
let refreshTimer = null;
/** 잡아 둔 새로 고침 시각 (0이면 없음) */
let refreshAt = 0;

export function budgetState() {
    return state;
}

export function config() {
    return settings().budget;
}

/** 값이 바뀔 때마다 부른다 (창을 새로 그리는 데 쓴다) */
export function onBudget(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify() {
    for (const listener of listeners) {
        try {
            listener(state);
        } catch (error) {
            console.warn('[요청 로그] budget listener', error);
        }
    }
}

function toast(kind, message, options = {}) {
    if (typeof toastr !== 'undefined') toastr[kind](message, `${TITLE} · 예산`, { timeOut: 12000, ...options });
}

/**
 * 중계 서버 주소. 비어 있으면 실리태번의 사용자 지정 API 주소에서 서버 부분을 쓴다.
 * [1.2.1] 물려받은 주소는 "키를 처음 넣었을 때의 주소"(keyHost)와 같을 때만 쓴다.
 * 그러지 않으면 본체 API 주소를 다른 업체로 바꿨을 때 이 서버의 키가 그 업체로 날아간다.
 */
export function baseUrl() {
    const budget = config();
    const own = budget.baseUrl?.trim();
    if (own) return own.replace(/\/+$/, '');
    const inherited = originOf(oai_settings?.custom_url);
    if (!inherited) return '';
    if (budget.keyHost && budget.keyHost !== inherited) return '';
    return inherited;
}

function originOf(url) {
    try {
        return new URL(String(url ?? '')).origin;
    } catch {
        return '';
    }
}

/** 물려받은 주소가 키를 넣을 때와 달라졌나 (설정 화면에서 알려 주려고) */
export function inheritedHostChanged() {
    const budget = config();
    if (budget.baseUrl?.trim() || !budget.keyHost) return false;
    const inherited = originOf(oai_settings?.custom_url);
    return !!inherited && inherited !== budget.keyHost;
}

/** 키를 넣거나 주소를 바꿀 때, 그 키가 어느 서버 것인지 적어 둔다 */
export function rememberKeyHost() {
    const budget = config();
    budget.keyHost = budget.baseUrl?.trim() ? '' : originOf(oai_settings?.custom_url);
    saveSettings();
    // [1.2.2] 받아 둔 사용량은 예전 키(서버) 것이다. 버려야 연결 확인이 그 값을 새 키의 결과로 내놓지 않는다
    state.token = null;
    state.tokenAt = 0;
    state.logs = [];
    state.error = null;
    state.lastKeyFetchAt = 0;
}

export function isConfigured() {
    const budget = config();
    return budget.enabled && !!budget.key && !!baseUrl();
}

export function quotaToMoney(quota) {
    const per = Number(config().quotaPerUnit) || 500000;
    return (Number(quota) || 0) / per;
}

async function relayGet(path, headers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(baseUrl() + path, { headers, signal: controller.signal, cache: 'no-store' });
        const text = await response.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch {
            json = null;
        }
        if (!response.ok) {
            const error = new Error(json?.message || json?.error?.message || `HTTP ${response.status}`);
            error.status = response.status;
            const retryAfter = Number(response.headers.get('retry-after'));
            error.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null;
            throw error;
        }
        if (json && json.success === false) throw new Error(json.message || '서버가 실패라고 답했어요');
        if (!json) throw new Error('JSON이 아닌 응답이에요');
        return json;
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('응답이 없어요 (15초)');
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

function keyHeaders() {
    return { Authorization: `Bearer ${config().key}` };
}

function accountHeaders() {
    const { accessToken, userId } = config();
    return { Authorization: `Bearer ${accessToken}`, 'New-Api-User': String(userId) };
}

/** 로그 응답은 판에 따라 data가 배열이거나 { items } 다 */
function logItems(json) {
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.data?.items)) return json.data.items;
    return [];
}

/** 설정만 확인한다 (연결 확인 버튼). 성공하면 요약 글을 돌려준다 */
export async function testConnection() {
    if (!baseUrl()) throw new Error('서버 주소가 없어요. 사용자 지정 API 주소를 쓰거나 서버 주소를 적어 주세요.');
    if (!config().key) throw new Error('API 키를 적어 주세요.');
    // [1.2.2] 연결 확인도 자동 조회와 같은 몫(키 조회 20분에 약 20번, 폰과 PC가 함께 쓴다)을 아낀다.
    // 예전에는 누를 때마다 사용량을 따로 묻고 이어서 강제 새로 고침까지 해 한 번에 키 조회가 3번 나갔고, 429로 물러나 있는 중에도 물었다.
    // 이제 물러나 있으면 묻지 않고, 4분 안에 이 키로 받은 값이 있으면 그 값으로 답하고, 아니면 자동 조회와 같은 한 번(사용량 + 내역)만 부른다.
    if (retryAt() > Date.now()) {
        throw new Error(`서버가 조회 횟수를 잠시 막았어요 (429). ${Math.max(1, Math.ceil(refreshWaitMs() / 60000))}분 뒤에 다시 해 보세요.`);
    }
    const fresh = state.token && !state.error && Date.now() - state.lastKeyFetchAt < KEY_INTERVAL_MS;
    if (!fresh) {
        if (state.loading) throw new Error('지금 가져오는 중이에요. 잠시 뒤 다시 눌러 주세요.');
        const before = state.tokenAt;
        state.loading = true;
        notify();
        try {
            await fetchKeyData();
        } finally {
            state.loading = false;
            notify();
        }
        if (!state.token || state.tokenAt === before) throw new Error(state.error || '사용량을 가져오지 못했어요.');
    }
    const data = state.token;
    const parts = [`키 "${data.name ?? '?'}"`, `누적 ${money(quotaToMoney(data.total_used))}`];
    if (data.unlimited_quota === false) parts.push(`남은 한도 ${money(quotaToMoney(data.total_available))}`);
    if (config().accessToken && config().userId) {
        const me = await relayGet('/api/user/self', accountHeaders());
        parts.push(`계정 잔액 ${money(quotaToMoney(me?.data?.quota))}`);
    }
    return parts.join(' · ');
}

function hasAccount() {
    return !!(config().accessToken && config().userId);
}

/** [1.2.1] 429 물러남이 끝나는 시각 (설정에 저장돼 새로 고침해도 남는다) */
function retryAt() {
    const saved = Number(config().retryAt) || 0;
    // 기기 시계가 바뀌어 한참 뒤로 잡힌 값은 버린다
    return saved > Date.now() + 6 * 60 * 60_000 ? 0 : saved;
}

function setRetryAt(at) {
    config().retryAt = at;
    saveSettings();
}

/** 키 엔드포인트를 다음에 부를 수 있는 시각 (간격과 429 물러남 중 늦은 쪽) */
export function nextKeyFetchAt() {
    return Math.max(state.lastKeyFetchAt + KEY_INTERVAL_MS, retryAt());
}

/** 429로 막혀 있으면 다시 부를 수 있는 시각, 아니면 0. 새로 고침 뒤에도 (state.limited 가 false여도) 남는다 */
export function limitedUntil() {
    const until = retryAt();
    return until > Date.now() ? Math.max(until, state.lastKeyFetchAt + KEY_INTERVAL_MS) : 0;
}

/**
 * 손으로 새로 고쳐도 되는가.
 * [1.2.1] 예전에는 1분마다 눌러도 돼서, 4분 간격으로 아껴 둔 몫을 버튼 몇 번으로 다 써 429를 맞았다.
 * 이제 자동 조회와 같은 간격(4분)을 쓰고, 남은 시간을 버튼에 보여 준다.
 */
export function canRefreshNow() {
    return !state.loading && Date.now() >= nextKeyFetchAt();
}

/** 새로 고침까지 남은 밀리초 (0이면 지금 눌러도 된다) */
export function refreshWaitMs() {
    return Math.max(0, nextKeyFetchAt() - Date.now());
}

/**
 * 곧 새로 고친다 (요청이 끝난 뒤 몇 초 모아서 한 번). 아직 간격이 안 찼으면 찰 때까지 미룬다.
 * [1.2.1] 예전에는 부를 때마다 타이머를 새로 잡아서, 스와이프를 이어 하면 (생성이 4초 안에 계속 끝나면)
 * 갱신이 한없이 밀렸다. 이제 이미 잡혀 있으면 그대로 두고, 더 빨리 해야 할 때만 다시 잡는다.
 */
export function refreshSoon(delay = 4000) {
    if (!isConfigured()) return;
    const nextAccount = hasAccount() ? state.lastAccountFetchAt + ACCOUNT_INTERVAL_MS : Infinity;
    const next = Math.min(nextKeyFetchAt(), nextAccount);
    const at = Math.min(Math.max(Date.now() + delay, next), Date.now() + 30 * 60_000);
    if (refreshTimer && refreshAt && refreshAt <= at) return;
    clearTimeout(refreshTimer);
    refreshAt = at;
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshAt = 0;
        refresh().catch(() => {});
    }, at - Date.now());
}

/**
 * 중계 서버에서 다시 가져온다. 간격이 찬 것만 부른다: 키 엔드포인트 4분, 계정 엔드포인트 1분.
 * force는 간격을 무시하지만 429로 물러나 있는 동안은 키 엔드포인트를 건너뛴다.
 */
export async function refresh({ force = false } = {}) {
    if (!isConfigured() || state.loading) return state;
    const now = Date.now();
    const keyDue = now >= retryAt() && (force || now - state.lastKeyFetchAt >= KEY_INTERVAL_MS);
    const accountDue = hasAccount() && (force || now - state.lastAccountFetchAt >= ACCOUNT_INTERVAL_MS);
    if (!keyDue && !accountDue) return state;
    state.loading = true;
    notify();
    try {
        if (keyDue) await fetchKeyData();
        if (accountDue) await fetchAccountData();
        else if (!hasAccount()) {
            state.account = null;
            state.accountError = null;
        }
        checkAlerts();
    } finally {
        state.loading = false;
        notify();
    }
    return state;
}

/** 키로 조회: 누적 사용량 + 최근 로그. 429면 Retry-After만큼(없으면 10분) 물러나고 지난 값은 그대로 둔다 */
async function fetchKeyData() {
    state.lastKeyFetchAt = Date.now();
    const [usage, logs] = await Promise.allSettled([
        relayGet('/api/usage/token/', keyHeaders()),
        relayGet(`/api/log/token?key=${encodeURIComponent(config().key)}&p=1&page_size=${RELAY_LOG_LIMIT}`, keyHeaders()),
    ]);
    const limited = [usage, logs].find(result => result.status === 'rejected' && result.reason?.status === 429);
    if (limited) {
        setRetryAt(Date.now() + (limited.reason.retryAfterMs ?? DEFAULT_RETRY_MS));
        state.limited = true;
        const minutes = Math.max(1, Math.ceil((nextKeyFetchAt() - Date.now()) / 60_000));
        state.error = `서버가 조회 횟수를 잠시 막았어요 (429). ${minutes}분 뒤에 다시 가져와요.`;
        // 물러남이 끝나면 저절로 다시 부른다
        refreshSoon(nextKeyFetchAt() - Date.now() + 1000);
    } else {
        state.limited = false;
        if (retryAt()) setRetryAt(0);
        state.error = usage.status === 'rejected' ? usage.reason.message : null;
    }
    if (usage.status === 'fulfilled') {
        state.token = usage.value?.data ?? null;
        state.updatedAt = Date.now();
        state.tokenAt = state.updatedAt;
        const budget = config();
        if (budget.baselineUsed === null && state.token) {
            budget.baselineUsed = Number(state.token.total_used) || 0;
            budget.baselineAt = Date.now();
            saveSettings();
        }
    }
    if (logs.status === 'fulfilled') {
        state.logs = logItems(logs.value);
        state.logsError = null;
        if (state.logs.length) {
            try {
                state.daily = await mergeRelayDaily(state.logs);
                await syncPricesFromLogs(state.logs);
            } catch (error) {
                console.warn('[요청 로그] 과금 집계를 저장하지 못했어요', error);
            }
        }
    } else if (!limited) {
        state.logsError = logs.reason?.message ?? null;
    }
    if (!state.daily.length) state.daily = await listRelayDaily().catch(() => []);
}

/** 계정 토큰으로 조회: 실제 잔액 */
async function fetchAccountData() {
    state.lastAccountFetchAt = Date.now();
    try {
        const me = await relayGet('/api/user/self', accountHeaders());
        state.account = me?.data ?? null;
        state.accountError = null;
        state.updatedAt = Date.now();
    } catch (error) {
        state.account = null;
        state.accountError = error.message;
    }
}

/** 저장해 둔 날짜별 과금만 읽는다 (창을 열 때 서버에 묻기 전에 먼저 보여 주려고) */
export async function loadDaily() {
    if (!state.daily.length) state.daily = await listRelayDaily().catch(() => []);
    return state.daily;
}

/**
 * 최근 로그를 날짜·모델별로 합쳐 store에 넣는다.
 * 로그 창(1,000건)이 그 날 전체를 덮으면 그 날 값을 바꿔 쓰고, 덮지 못한 가장 오래된 날은 큰 쪽을 남긴다
 * (먼저 받아 둔 값에 지금은 사라진 앞부분이 들어 있을 수 있다).
 */
async function mergeRelayDaily(logs) {
    const consumed = logs.filter(log => (log.type === undefined || log.type === 2) && Number(log.quota) >= 0);
    if (!consumed.length) return state.daily.length ? state.daily : listRelayDaily();
    const oldestAt = Math.min(...consumed.map(log => Number(log.created_at) * 1000));
    const complete = logs.length < RELAY_LOG_LIMIT;
    const groups = new Map();
    for (const log of consumed) {
        const at = Number(log.created_at) * 1000;
        const day = dayKeyOf(at);
        const model = String(log.model_name || '?');
        const key = `${day}|${model}`;
        const row = groups.get(key) ?? { key, day, model, requests: 0, quota: 0, promptTokens: 0, completionTokens: 0, dayComplete: false };
        row.requests += 1;
        row.quota += Number(log.quota) || 0;
        row.promptTokens += Number(log.prompt_tokens) || 0;
        row.completionTokens += Number(log.completion_tokens) || 0;
        groups.set(key, row);
    }
    const existing = new Map((await listRelayDaily()).map(row => [row.key, row]));
    const out = [];
    for (const row of groups.values()) {
        const dayStart = new Date(`${row.day}T00:00:00`).getTime();
        row.dayComplete = complete || dayStart > oldestAt;
        const old = existing.get(row.key);
        if (old && !row.dayComplete && Number(old.quota) > row.quota) {
            out.push({ ...old, dayComplete: false });
        } else {
            out.push(row);
        }
    }
    await putRelayDaily(out);
    for (const row of out) existing.set(row.key, row);
    return [...existing.values()];
}

/**
 * 로그의 배율로 가격표를 채운다. new-api는 요청마다 other에 model_ratio·completion_ratio·group_ratio를 적는다.
 * 배율 1 = 100만 토큰당 2달러. 입력 = model_ratio × 2 × group_ratio, 출력 = 입력 × completion_ratio.
 * (model_price가 0보다 크면 토큰이 아니라 건당 요금이라 건너뛴다.)
 * 직접 적은 가격은 건드리지 않고, 자동으로 채운 것(auto)만 새 배율로 고친다.
 */
async function syncPricesFromLogs(logs) {
    const prices = settings().prices;
    const seen = new Set();
    let changed = false;
    for (const log of logs) {
        const model = String(log.model_name || '').trim();
        if (!model || seen.has(model) || log.type !== undefined && log.type !== 2) continue;
        let other = log.other;
        if (typeof other === 'string') {
            try {
                other = JSON.parse(other);
            } catch {
                other = null;
            }
        }
        if (!other || typeof other !== 'object') continue;
        seen.add(model);
        const modelPrice = Number(other.model_price);
        const modelRatio = Number(other.model_ratio);
        if (Number.isFinite(modelPrice) && modelPrice > 0) continue;
        if (!Number.isFinite(modelRatio) || modelRatio <= 0) continue;
        const groupRatio = Number.isFinite(Number(other.group_ratio)) && Number(other.group_ratio) > 0 ? Number(other.group_ratio) : 1;
        const completionRatio = Number.isFinite(Number(other.completion_ratio)) && Number(other.completion_ratio) > 0 ? Number(other.completion_ratio) : 1;
        const per = Number(config().quotaPerUnit) || 500000;
        // 배율 1 = 1K 토큰당 quota 1000 = 1000/500000 달러 → 100만 토큰당 2달러 (quotaPerUnit이 다르면 그에 맞춘다)
        const input = round(modelRatio * groupRatio * 1_000_000 / per);
        const output = round(input * completionRatio);
        const current = prices[model];
        if (current && current.auto !== true) continue;
        if (current && current.input === input && current.output === output) continue;
        prices[model] = { input, output, auto: true };
        changed = true;
    }
    if (!changed) return;
    saveSettings();
    await repriceDaily(costOf);
    notify();
}

function round(value) {
    return Math.round(value * 10000) / 10000;
}

// ── 요약 ────────────────────────────────────────────────────

/**
 * 잔액과 사용액을 한데 모은다.
 * source: 'account' 계정 잔액 / 'token' 키 한도 / 'manual' 충전 금액에서 계산 / null 모름
 */
export function summary() {
    const budget = config();
    const token = state.token;
    const usedTotal = token ? quotaToMoney(token.total_used) : null;
    const sinceBaseline = token && budget.baselineUsed !== null
        ? Math.max(0, quotaToMoney(Number(token.total_used) - budget.baselineUsed))
        : null;

    let remaining = null;
    let total = null;
    let source = null;
    if (state.account && Number.isFinite(Number(state.account.quota))) {
        remaining = quotaToMoney(state.account.quota);
        source = 'account';
        // 예산(충전 금액)이 잔액보다 크면 그중 얼마를 썼는지 보여 준다. 잔액이 더 크면 예산은 뜻이 없다
        total = budget.amount > 0 && budget.amount >= remaining ? budget.amount : null;
    } else if (token && token.unlimited_quota === false && Number.isFinite(Number(token.total_available))) {
        remaining = quotaToMoney(token.total_available);
        total = quotaToMoney(token.total_granted);
        source = 'token';
    } else if (budget.amount > 0 && sinceBaseline !== null) {
        remaining = budget.amount - sinceBaseline;
        total = budget.amount;
        source = 'manual';
    }
    const spent = total !== null && remaining !== null ? total - remaining : sinceBaseline;
    const ratio = total ? Math.max(0, Math.min(1, spent / total)) : null;
    return { usedTotal, sinceBaseline, remaining, total, spent, ratio, source };
}

/** 저장된 날짜별 과금에서 기간 합 */
export function spendBetween(fromDay, toDay = '9999-99-99') {
    let quota = 0;
    let requests = 0;
    for (const row of state.daily) {
        if (row.day < fromDay || row.day > toDay) continue;
        quota += Number(row.quota) || 0;
        requests += Number(row.requests) || 0;
    }
    return { amount: quotaToMoney(quota), requests };
}

export function todayKey() {
    return dayKeyOf(Date.now());
}

export function monthStartKey() {
    return `${todayKey().slice(0, 7)}-01`;
}

// ── 알림 ────────────────────────────────────────────────────

function checkAlerts() {
    const budget = config();
    const { remaining, total, ratio } = summary();
    let changed = false;

    if (remaining !== null) {
        const level = remaining <= 0 ? 'over' : (total !== null && ratio !== null && ratio * 100 >= budget.warnPercent ? 'warn' : null);
        const rank = { over: 2, warn: 1 };
        if (level && (rank[level] ?? 0) > (rank[budget.alerted] ?? 0)) {
            const of = total !== null ? ` (예산 ${money(total)})` : '';
            if (level === 'over') toast('error', `예산을 다 썼어요. 잔액 ${money(remaining)}${of}`);
            else toast('warning', `예산의 ${Math.round(ratio * 100)}%를 썼어요. 잔액 ${money(remaining)}${of}`);
            budget.alerted = level;
            changed = true;
        } else if (!level && budget.alerted) {
            budget.alerted = null;
            changed = true;
        }
    }

    if (budget.dailyLimit > 0) {
        const today = todayKey();
        const { amount } = spendBetween(today, today);
        if (amount >= budget.dailyLimit && budget.dailyAlertedDay !== today) {
            toast('warning', `오늘 ${money(amount)} 썼어요. 하루 한도 ${money(budget.dailyLimit)}를 넘었어요.`);
            budget.dailyAlertedDay = today;
            changed = true;
        }
    }
    if (changed) saveSettings();
}

/**
 * "지금부터 다시 세기": 지금까지의 사용량을 기준으로 삼고 알림도 다시 시작한다.
 * [1.2.1] 예전에는 429로 막혀 있거나 다른 조회가 도는 중이면 refresh 가 그냥 돌아와서,
 * 몇 시간 전 숫자로 기준을 잡고 그 뒤로 잔액이 계속 실제보다 많게 나왔다. 이제 방금 받은 값일 때만 기준으로 쓴다.
 */
export async function resetBaseline() {
    // [1.2.2] updatedAt이 아니라 tokenAt을 본다. 계정 토큰이 있으면 키 조회가 429로 막혀도 계정 잔액이 updatedAt을 올려서,
    // 몇 시간 전 사용량이 기준으로 들어갔다.
    const before = state.tokenAt;
    await refresh({ force: true });
    if (!state.token) throw new Error(state.error || '사용량을 가져오지 못했어요');
    if (state.tokenAt === before || Date.now() - state.tokenAt > 60_000) {
        const wait = Math.max(1, Math.ceil(refreshWaitMs() / 60_000));
        throw new Error(limitedUntil()
            ? `서버가 조회를 막아 둔 동안은 기준을 잡을 수 없어요. ${wait}분 뒤에 다시 해 주세요.`
            : '방금 사용량을 못 받았어요. 잠시 뒤 다시 해 주세요.');
    }
    const budget = config();
    budget.baselineUsed = Number(state.token.total_used) || 0;
    budget.baselineAt = Date.now();
    budget.alerted = null;
    saveSettings();
    notify();
}

/** 예산 금액을 바꾸면 알림 단계를 다시 계산한다 */
export function onAmountChanged() {
    config().alerted = null;
    saveSettings();
    if (state.token) checkAlerts();
    notify();
}
