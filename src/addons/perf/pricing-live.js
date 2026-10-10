// Public price data only. A request holds its original immutable snapshot until it finishes.
import { OPENAI_RATES } from './pricing-data.js';
import { CLAUDE_RATES } from './pricing-claude.js';
import { PROVIDER_RATES } from './pricing-catalog.js';
import { PROVIDERS } from './pricing-providers.js';

export const BUNDLED_CHECKED = '2026-10-10T12:00:00Z';
export const PRICE_FEED = 'https://raw.githubusercontent.com/kgangkgang/blue-lemonade/pricing-data/official-prices.json';
export const MAX_FEED_BYTES = 3 * 1024 * 1024;
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const plain = x => x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const validDate = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
const price = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1e9;
const rateKeys = new Set(['input','output','cacheRead','cacheWrite','cacheWrite5m','cacheWrite1h']);
const rowKeys = new Set(['rates','aliases','tiers','longAbove','longRates','longTiers','priorityFactor','regionalFactor','globalOnly','expires','timePricing','uncertain','note','cacheWrite5m','cacheWrite1h','minimum']);
const freeze = x => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const currency = key => PROVIDERS[key].currency || 'USD';
const format = key => key === 'openai' ? 'openai' : key === 'anthropic' ? 'anthropic' : 'generic';
const snapshots = new Map();
for (const [key, models] of Object.entries({ ...PROVIDER_RATES, anthropic: CLAUDE_RATES, openai: OPENAI_RATES })) {
    snapshots.set(key, freeze({ provider: key, format: format(key), currency: currency(key), models,
        checkedAt: BUNDLED_CHECKED, attemptedAt: BUNDLED_CHECKED, status: 'bundled', revision: 'bundled-20261010' }));
}
export const priceSnapshot = provider => snapshots.get(provider) || null;
export const currentPriceFeed = generatedAt => ({ schema: 1, generatedAt, providers: Object.fromEntries(snapshots) });

function rates(value) {
    return plain(value) && Object.keys(value).every(k => rateKeys.has(k) && (value[k] === null || price(value[k]))) && price(value.input) && price(value.output);
}
function modelRow(row, kind) {
    if (kind === 'anthropic') return Array.isArray(row) && row.length === 5 && row.every(price);
    if (kind === 'openai') return plain(row) && Object.hasOwn(row, 'standard') && Object.entries(row).every(([tier, v]) =>
        ['standard','flex','fast','ultrafast'].includes(tier) && Array.isArray(v) && v.length === 8 && price(v[0]) && price(v[3]) && v.every(x => x === null || price(x)));
    if (!plain(row) || !rates(row.rates) || Object.keys(row).some(k => !rowKeys.has(k))) return false;
    if (row.aliases && (!Array.isArray(row.aliases) || row.aliases.length > 100 || row.aliases.some(a => typeof a !== 'string' || a.length > 250 || unsafe.has(a)))) return false;
    for (const field of ['tiers','longTiers']) if (row[field] && (!plain(row[field]) || !Object.entries(row[field]).every(([k, v]) => ['standard','priority','flex','batch','fast'].includes(k) && rates(v)))) return false;
    if (row.longRates && !rates(row.longRates)) return false;
    for (const k of ['longAbove','priorityFactor','regionalFactor','cacheWrite5m','cacheWrite1h']) if (row[k] != null && !price(row[k])) return false;
    for (const k of ['globalOnly','uncertain','minimum']) if (row[k] !== undefined && typeof row[k] !== 'boolean') return false;
    if (row.timePricing !== undefined && row.timePricing !== 'deepseek') return false;
    if (row.expires !== undefined && !validDate(row.expires)) return false;
    return row.note === undefined || (typeof row.note === 'string' && row.note.length <= 2000);
}

/** Validate every provider before changing anything; reject mixed valid/invalid feeds atomically. */
export function validatePriceFeed(feed, now = Date.now()) {
    if (!plain(feed) || feed.schema !== 1 || !validDate(feed.generatedAt) || Date.parse(feed.generatedAt) > now + 300000 || !plain(feed.providers)) throw new Error('가격표 형식 또는 날짜 오류');
    const keys = Object.keys(feed.providers);
    if (keys.length !== snapshots.size || keys.some(k => !snapshots.has(k))) throw new Error('가격 제공처 누락');
    for (const [key, entry] of Object.entries(feed.providers)) {
        if (!plain(entry) || entry.provider !== key || entry.currency !== currency(key) || entry.format !== format(key) || !['ok','review','error','bundled'].includes(entry.status)) throw new Error('가격 제공처·통화 오류');
        if (!validDate(entry.checkedAt) || !validDate(entry.attemptedAt) || Date.parse(entry.checkedAt) > Date.parse(entry.attemptedAt) || Date.parse(entry.attemptedAt) > Date.parse(feed.generatedAt) + 300000) throw new Error('가격 확인일 오류');
        if (!plain(entry.models) || Object.keys(entry.models).length < 1 || Object.keys(entry.models).length > 15000) throw new Error('빈 가격표');
        if (typeof entry.revision !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.revision)) throw new Error('가격표 버전 오류');
        for (const [id, row] of Object.entries(entry.models)) if (!id || id.length > 250 || unsafe.has(id) || !modelRow(row, entry.format)) throw new Error('모델 단가 오류: ' + key);
    }
    return feed;
}

export function applyPriceFeed(feed, now = Date.now()) {
    validatePriceFeed(feed, now);
    const replacements = [];
    for (const [key, entry] of Object.entries(feed.providers)) {
        const previous = snapshots.get(key);
        // CDN rollback must never roll prices backwards. A failed check can update status only.
        if (Date.parse(entry.checkedAt) < Date.parse(previous.checkedAt) || Date.parse(entry.attemptedAt) < Date.parse(previous.attemptedAt)) continue;
        const copy = JSON.parse(JSON.stringify(entry));
        if (['error','review'].includes(entry.status)) {
            if (previous.status !== 'bundled') {
                if (entry.revision !== previous.revision) continue;
                copy.models = previous.models;
                copy.checkedAt = previous.checkedAt;
                copy.revision = previous.revision;
            }
        }
        replacements.push([key, freeze(copy)]);
    }
    for (const [key, value] of replacements) snapshots.set(key, value);
    return replacements.length;
}
