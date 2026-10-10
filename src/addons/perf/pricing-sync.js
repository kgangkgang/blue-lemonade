import { PRICE_FEED, MAX_FEED_BYTES, applyPriceFeed, validatePriceFeed, currentPriceFeed } from './pricing-live.js';

const KEY = 'bl-official-prices-v1';
const DAY = 86400000;
let inFlight = null, loaded = false, timer = null, enabled = () => true;
let status = { state: 'bundled', checkedFeedAt: 0, nextAt: 0, failures: 0, memoryOnly: false };
export const pricingSyncStatus = () => ({ ...status });
const notify = () => globalThis.document?.dispatchEvent(new Event('bl-prices-updated'));
function save(feed) {
    try { localStorage.setItem(KEY, JSON.stringify({ feed, ...status })); }
    catch { status.memoryOnly = true; }
}
export function loadPriceCache() {
    if (loaded) return;
    loaded = true;
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw || raw.length > MAX_FEED_BYTES) return;
        const saved = JSON.parse(raw);
        applyPriceFeed(saved.feed);
        const now = Date.now();
        status.checkedFeedAt = Math.min(now, Number(saved.checkedFeedAt) || 0);
        status.nextAt = Math.min(now + DAY, Number(saved.nextAt) || 0);
        status.failures = Math.min(8, Number(saved.failures) || 0);
        status.generatedAt = saved.feed.generatedAt;
        status.state = 'cached';
    } catch { /* Corrupt or old cache must not block generation. */ }
}

async function readLimited(response) {
    if (!response.ok || (response.headers.get('content-length') && Number(response.headers.get('content-length')) > MAX_FEED_BYTES)) throw new Error('가격표 응답 오류');
    if (!response.body?.getReader) { const text = await response.text(); if (text.length > MAX_FEED_BYTES) throw new Error('가격표 크기 오류'); return text; }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = '', size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_FEED_BYTES) throw new Error('가격표 크기 오류');
            text += decoder.decode(value, { stream: true });
        }
        return text + decoder.decode();
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
}

/** No keys, cookies, model selection, prompts or account information leave the browser. */
export function refreshPrices({ force = false } = {}) {
    loadPriceCache();
    if (inFlight) return inFlight;
    const now = Date.now();
    if (!force && (!enabled() || now < status.nextAt)) return Promise.resolve(pricingSyncStatus());
    if (force && now < (status.lastAttempt || 0) + 60000) return Promise.resolve(pricingSyncStatus());
    status.lastAttempt = now;
    status.state = 'loading'; notify();
    inFlight = Promise.resolve().then(async () => {
        const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 12000);
        try {
            const response = await fetch(PRICE_FEED, { signal: abort.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache', redirect: 'error' });
            const feed = JSON.parse(await readLimited(response));
            validatePriceFeed(feed);
            if (Date.parse(feed.generatedAt) < Date.parse(status.generatedAt || '1970-01-01')) throw new Error('이전 가격표 응답');
            applyPriceFeed(feed);
            status = { ...status, state: Date.now() - Date.parse(feed.generatedAt) > DAY * 3 ? 'stale' : 'ready', generatedAt: feed.generatedAt, checkedFeedAt: Date.now(), nextAt: Date.now() + DAY, failures: 0 };
            save(currentPriceFeed(feed.generatedAt));
        } catch {
            status.failures += 1;
            status.state = 'offline';
            status.nextAt = Date.now() + Math.min(DAY, 3600000 * 2 ** Math.min(5, status.failures - 1));
            // Preserve the last good feed, including across reloads after a failure.
            try { const old = JSON.parse(localStorage.getItem(KEY)); if (old?.feed) save(old.feed); } catch { /* unavailable storage */ }
        } finally { clearTimeout(timeout); inFlight = null; notify(); }
        return pricingSyncStatus();
    });
    return inFlight;
}

export function startPriceSync(isEnabled) {
    enabled = isEnabled;
    loadPriceCache();
    if (timer) return;
    const wake = () => { if (globalThis.document?.visibilityState !== 'hidden') void refreshPrices(); };
    timer = setInterval(wake, 1800000);
    document.addEventListener('visibilitychange', wake);
    globalThis.addEventListener('online', wake);
    wake();
}
