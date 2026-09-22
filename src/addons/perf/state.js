// 요청 로그 — 설정 보관과 공통 상수
// 설정 키(request_log)와 폴더 이름(request-log)은 바꾸지 않는다. 가격표가 여기 들어 있다.
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';

export const MODULE = 'request_log';
export const FOLDER = 'blue-lemonade'; // 2.0.0 성능 보조로 합침
export const VERSION = '1.2.5';
export const TITLE = '요청 로그';

const DEFAULTS = Object.freeze({
    /** 기록을 남길지 */
    enabled: true,
    /** 남겨 둘 요청 수. 넘치면 오래된 것부터 지운다 (날짜별 집계는 지우지 않는다). */
    maxEntries: 500,
    /** 프롬프트·응답 본문까지 남겨 둘 요청 수. 그보다 오래된 요청은 숫자만 남는다. */
    keepBodies: 30,
    /** { [모델 이름]: { input, output } } — 100만 토큰당 가격 */
    prices: {},
    /** 가격 앞에 붙일 단위 */
    unit: '$',
    /** 이 확장이 부르는 요청은 없지만, 확장별로 기록에서 뺄 수 있다 (폴더 이름 목록) */
    ignoreCallers: [],
    /** 예산 — new-api 계열 중계 서버의 사용량·잔액 연동 (1.2.0) */
    budget: {
        enabled: false,
        /** 비우면 사용자 지정 API 주소(custom_url)의 서버를 쓴다 */
        baseUrl: '',
        /** 조회에 쓰는 그 서버의 API 키 (settings.json에 저장된다) */
        key: '',
        /** 충전한 금액. 0이면 잔액을 계산하지 않고 사용액만 보인다 */
        amount: 0,
        /** 예산의 이 비율을 넘게 쓰면 한 번 알린다 */
        warnPercent: 80,
        /** 하루에 이 금액을 넘게 쓰면 한 번 알린다. 0이면 끔 */
        dailyLimit: 0,
        /** new-api의 quota 단위: 500000 quota = 1 (달러) */
        quotaPerUnit: 500000,
        /** "지금부터 다시 세기"를 누른 시점의 누적 사용량(quota)과 시각 */
        baselineUsed: null,
        baselineAt: null,
        /** (선택) 콘솔의 시스템 액세스 토큰과 사용자 ID — 있으면 계정의 실제 잔액을 가져온다 */
        accessToken: '',
        userId: '',
        /** 마지막으로 알린 단계(warn/over)와 하루 한도를 알린 날 */
        alerted: null,
        dailyAlertedDay: '',
        /** [1.2.1] 이 키를 넣었을 때의 서버. 본체 주소를 물려받는 중에 주소가 바뀌면 키를 보내지 않는다 */
        keyHost: '',
        /** [1.2.1] 429로 막힌 동안은 이 시각까지 묻지 않는다 (새로 고침해도 남게 저장한다) */
        retryAt: 0,
    },
});

export function settings() {
    return extension_settings[MODULE];
}

export function saveSettings() {
    saveSettingsDebounced();
}

function clampInt(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function cleanPrices(prices) {
    const out = {};
    if (!prices || typeof prices !== 'object') return out;
    for (const [model, price] of Object.entries(prices)) {
        const name = String(model ?? '').trim();
        if (!name || !price || typeof price !== 'object') continue;
        const input = Number(price.input);
        const output = Number(price.output);
        out[name] = {
            input: Number.isFinite(input) && input >= 0 ? input : 0,
            output: Number.isFinite(output) && output >= 0 ? output : 0,
        };
        // 중계 서버 로그의 배율에서 자동으로 채운 가격 (1.2.0). 직접 고치면 auto가 빠져 자동으로 덮어쓰지 않는다
        if (price.auto === true) out[name].auto = true;
    }
    return out;
}

function cleanBudget(budget) {
    const base = { ...DEFAULTS.budget, ...(budget && typeof budget === 'object' ? budget : {}) };
    const text = (value, max = 400) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
    const positive = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
    };
    return {
        enabled: base.enabled === true,
        baseUrl: text(base.baseUrl).replace(/\/+$/, ''),
        key: text(base.key),
        amount: positive(base.amount, 0),
        warnPercent: clampInt(base.warnPercent, 1, 100, DEFAULTS.budget.warnPercent),
        dailyLimit: positive(base.dailyLimit, 0),
        quotaPerUnit: positive(base.quotaPerUnit, DEFAULTS.budget.quotaPerUnit) || DEFAULTS.budget.quotaPerUnit,
        baselineUsed: Number.isFinite(Number(base.baselineUsed)) && base.baselineUsed !== null ? Number(base.baselineUsed) : null,
        baselineAt: Number.isFinite(Number(base.baselineAt)) && base.baselineAt !== null ? Number(base.baselineAt) : null,
        accessToken: text(base.accessToken),
        userId: text(String(base.userId ?? ''), 40),
        alerted: typeof base.alerted === 'string' ? base.alerted : null,
        dailyAlertedDay: text(base.dailyAlertedDay, 10),
        keyHost: text(base.keyHost, 200),
        retryAt: positive(base.retryAt, 0),
    };
}

export function initSettings() {
    const existing = extension_settings[MODULE];
    const store = existing && typeof existing === 'object' ? { ...DEFAULTS, ...existing } : { ...DEFAULTS };
    store.enabled = store.enabled !== false;
    store.maxEntries = clampInt(store.maxEntries, 20, 5000, DEFAULTS.maxEntries);
    store.keepBodies = clampInt(store.keepBodies, 0, 500, DEFAULTS.keepBodies);
    store.prices = cleanPrices(store.prices);
    store.unit = typeof store.unit === 'string' && store.unit.trim() ? store.unit.trim().slice(0, 4) : DEFAULTS.unit;
    store.ignoreCallers = Array.isArray(store.ignoreCallers) ? store.ignoreCallers.map(String) : [];
    store.budget = cleanBudget(store.budget);
    extension_settings[MODULE] = store;
    return store;
}

/** 금액 표시: 단위 + 크기에 맞는 소수 자리 */
export function money(value, { empty = '—', signed = false } = {}) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return empty;
    const amount = Number(value);
    const unit = settings().unit;
    if (amount === 0) return `${unit}0`;
    const size = Math.abs(amount);
    const digits = size >= 1 ? 2 : size >= 0.01 ? 3 : 4;
    const text = size.toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    const sign = amount < 0 ? '-' : (signed ? '+' : '');
    return `${sign}${unit}${text}`;
}

/** 모델 이름으로 가격을 찾는다. 정확히 같은 이름이 없으면 가격표 이름이 모델 이름 앞부분과 같은 것을 쓴다 (예: gemini-3.8-flash ← gemini-3.8-flash-001). */
export function priceFor(model) {
    const prices = settings().prices;
    const name = String(model ?? '');
    if (!name) return null;
    if (prices[name]) return prices[name];
    const match = Object.keys(prices)
        .filter(key => name.startsWith(key))
        .sort((a, b) => b.length - a.length)[0];
    return match ? prices[match] : null;
}

/** 토큰 수로 비용을 계산한다. 가격표에 없으면 null. */
export function costOf(model, promptTokens, completionTokens) {
    const price = priceFor(model);
    if (!price) return null;
    const input = Number(promptTokens) || 0;
    const output = Number(completionTokens) || 0;
    return (input * price.input + output * price.output) / 1_000_000;
}

/** 부르는 쪽(폴더 이름)을 사람이 읽는 이름으로 */
const CALLER_LABELS = {
    chat: '채팅',
    'llm-translator-custom': '번역',
    'llm-translator': '번역',
    'ban-word-rewrite': '다시 쓰기',
    'long-memory': '장기 기억',
    'chat-bookmarks': '북마크',
    'story-direction': '전개 지시',
    'JS-Slash-Runner': '헬퍼',
    memory: '요약',
    expressions: '표정',
    caption: '이미지 설명',
    vectors: '벡터',
    unknown: '알 수 없음',
};

export function callerLabel(caller) {
    return CALLER_LABELS[caller] ?? String(caller ?? 'unknown');
}

/** 채팅 요청의 종류 */
const TYPE_LABELS = {
    normal: '보내기',
    regenerate: '다시 생성',
    swipe: '스와이프',
    continue: '이어쓰기',
    impersonate: '대신 쓰기',
    quiet: '조용히',
};

export function typeLabel(type) {
    return TYPE_LABELS[type] ?? '';
}
