import { createDemStyleSlots } from './dem-style-slots.js';
import { demStyleKey, demStylesEnabled } from './theme-sheet.js';
const DATA_URL = new URL('./dem-style-data.gen.js', import.meta.url).href;
const FALLBACK_URL = new URL('./dem-style-data.fallback.gen.css', import.meta.url).href;
const OWN_SHEET = new URL('../style.css', import.meta.url).href;

/** 데이터 파일은 실행하지 않고 엄격한 포장 안의 JSON만 읽어요. CSS 규칙 원문도 그대로 남겨요. */
export function parseDemStyleData(text, key) {
    const body = /^\/\* bl-dem-payload \*\/\s*export default ([\s\S]*);\s*$/.exec(text)?.[1]
        ?? /^\/\* bl-dem-payload\n([\s\S]*)\n\*\/\s*$/.exec(text)?.[1];
    if (!body) throw Error('데우스 꾸밈 파일의 형식이 달라요');
    const data = JSON.parse(body);
    if (data?.version !== 1 || data.key !== key || !data.slots || typeof data.slots !== 'object' || Array.isArray(data.slots)
        || !data.blocks || typeof data.blocks !== 'object' || Array.isArray(data.blocks)) throw Error('데우스 꾸밈 파일의 판이 달라요');
    return Object.fromEntries(Object.entries(data.slots).map(([id, ref]) => {
        const rules = Object.hasOwn(data.blocks, ref) ? data.blocks[ref] : null;
        if (!/^[a-z0-9-]+-[a-f0-9]{16}$/.test(id) || !/^[a-f0-9]{16}$/.test(ref) || !Array.isArray(rules) || !rules.length || rules.some(rule => typeof rule !== 'string' || !rule.trim())) throw Error('데우스 꾸밈 파일의 규칙이 달라요');
        return [id, { rules }];
    }));
}

export function createDemStyleLoader({ fetch: fetcher, dataUrl = DATA_URL, fallbackUrl = FALLBACK_URL,
    enabled = demStylesEnabled, timeoutMs = 4000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    const applier = createDemStyleSlots(), cache = new Map(), pending = new Map();
    async function getText(url, key) {
        const controller = new AbortController(); let timer;
        const target = new URL(url); target.searchParams.set('dem', key);
        try {
            return await Promise.race([
                Promise.resolve().then(() => fetcher(target.href, { credentials: 'same-origin', signal: controller.signal })).then(async response => {
                    if (!response.ok) throw Error(`데우스 꾸밈을 받지 못했어요 (${response.status})`);
                    return response.text();
                }),
                new Promise((_, reject) => { timer = setTimer(() => { controller.abort(); reject(Error('데우스 꾸밈 받기 시간이 지났어요')); }, timeoutMs); }),
            ]);
        } finally { clearTimer(timer); }
    }
    async function dataFor(key) {
        if (cache.has(key)) return cache.get(key);
        if (pending.has(key)) return pending.get(key);
        const task = (async () => {
            let data;
            try { data = parseDemStyleData(await getText(dataUrl, key), key); }
            catch { data = parseDemStyleData(await getText(fallbackUrl, key), key); }
            cache.set(key, data);
            while (cache.size > 2) cache.delete(cache.keys().next().value);
            return data;
        })();
        pending.set(key, task);
        try { return await task; } finally { pending.delete(key); }
    }
    async function completeData(key, needed) {
        let data = await dataFor(key);
        const complete = value => needed.every(id => Array.isArray(value[id]?.rules) && value[id].rules.length && value[id].rules.every(rule => typeof rule === 'string' && rule.trim()));
        if (complete(data)) return data;
        cache.delete(key);
        const retryKey = `${key}:fallback`;
        if (!pending.has(retryKey)) pending.set(retryKey, getText(fallbackUrl, key).then(text => parseDemStyleData(text, key)));
        try {
            data = await pending.get(retryKey);
            if (!complete(data)) throw Error('데우스 꾸밈 파일에 필요한 규칙이 없어요');
            cache.set(key, data); return data;
        } finally { pending.delete(retryKey); }
    }
    return {
        async prepare(sheets, options = {}) {
            const active = options.enabled || enabled;
            const targets = [...new Set(sheets)].filter(sheet => sheet && demStyleKey(sheet));
            if (options.signal?.aborted) return false;
            if (!active()) { applier.apply(targets, false); return true; }
            const groups = new Map();
            for (const sheet of targets) {
                const key = demStyleKey(sheet);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(sheet);
            }
            // 모든 내용이 준비된 다음 적용해요. 어느 파일이 어긋나도 일부 시트만 먼저 켜지 않아요.
            const payload = Object.create(null);
            for (const [key, group] of groups) {
                const needed = applier.needed(group);
                if (needed.length) Object.assign(payload, await completeData(key, needed));
            }
            if (options.signal?.aborted) return false;
            const on = active();
            applier.apply(targets, on, payload);
            return true;
        },
    };
}

let loader;
const warnings = new Set();
export async function prepareDemStyleSheets(sheets, options = {}) {
    loader ||= createDemStyleLoader({ fetch: (...args) => globalThis.fetch(...args) });
    try {
        const ok = await loader.prepare(sheets, options);
        if (ok) warnings.clear();
        return ok;
    } catch (error) {
        const reason = String(error?.message || error);
        if (!warnings.has(reason)) { warnings.add(reason); console.warn('[블루레몬에이드] 데우스 꾸밈을 받지 못했어요. 기존 시트를 유지하고 다음 설정 적용 때 다시 시도해요.', reason); }
        return false;
    }
}
export function syncDemStyles(options = {}) {
    const links = [...document.querySelectorAll('link[rel~="stylesheet"]')];
    const main = links.find(link => link.href === OWN_SHEET) || links.find(link => /\/blue-lemonade[^/]*\/style\.css(\?|$)/.test(link.href));
    return prepareDemStyleSheets([main?.sheet, document.getElementById('salty-lazy-css')?.sheet], options);
}
