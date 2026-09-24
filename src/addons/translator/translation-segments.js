import { checkpointKey } from './translation-resume.js';

const memory = new Map(), LIMIT = 400, TTL = 30 * 86400000;
let writes = 0, epoch = 0;
async function db() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LLMtranslatorSegments', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('parts', { keyPath: 'key' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => reject(Error('segment cache unavailable'));
    });
}
async function read(key) {
    let value = memory.get(key), handle;
    if (!value) try {
        handle = await db();
        value = await new Promise((resolve, reject) => {
            const request = handle.transaction('parts').objectStore('parts').get(key);
            request.onsuccess = () => resolve(request.result); request.onerror = reject;
        });
    } catch { /* Storage unavailable: translate normally. */ } finally { handle?.close(); }
    return value?.time > Date.now() - TTL ? value.text : null;
}
async function write(key, text, stamp) {
    if (text.length > 12000) return;
    const value = { key, text, time: Date.now() };
    memory.delete(key); memory.set(key, value);
    while (memory.size > LIMIT) memory.delete(memory.keys().next().value);
    let handle;
    try {
        handle = await db();
        if (epoch !== stamp) return;
        await new Promise((resolve, reject) => {
            const tx = handle.transaction('parts', 'readwrite'), store = tx.objectStore('parts');
            store.put(value);
            if (++writes % 16 === 1) {
                const request = store.getAll();
                request.onsuccess = () => request.result.sort((a, b) => b.time - a.time).forEach((row, i) => {
                    if (i >= LIMIT || row.time < Date.now() - TTL) store.delete(row.key);
                });
            }
            tx.oncomplete = resolve; tx.onerror = tx.onabort = reject;
        });
    } catch { /* Memory cache remains usable. */ } finally { handle?.close(); }
}
export async function clearSegmentCache() {
    epoch++; memory.clear();
    let handle;
    try {
        handle = await db();
        await new Promise((resolve, reject) => {
            const tx = handle.transaction('parts', 'readwrite');
            tx.objectStore('parts').clear();
            tx.oncomplete = resolve; tx.onerror = tx.onabort = reject;
        });
    } catch { /* Memory-only environment. */ } finally { handle?.close(); }
}

export function segmentParagraphs(text) {
    // Never split structured HTML or code across separate model requests.
    if (/```|~~~|<\/?(?:div|details|table|pre|script|style|ul|ol|blockquote)\b/i.test(text)) return null;
    const parts = text.split(/(\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*)/);
    const inline = new Set(['span', 'font', 'q', 'b', 'i', 'strong', 'em', 'u', 's', 'del', 'small', 'mark', 'code', 'a']);
    for (let i = 0; i < parts.length; i += 2) {
        const stack = [];
        for (const match of parts[i].matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
            const tag = match[2].toLowerCase();
            if (!inline.has(tag) || /\/\s*>$/.test(match[0])) continue;
            if (match[1]) { if (stack.pop() !== tag) return null; }
            else stack.push(tag);
        }
        if (stack.length) return null;
    }
    return parts.length <= 161 ? parts : null;
}

export function batchGroups(bodies, limit = 3600) {
    const groups = []; let group = [], size = 0;
    for (const body of bodies) {
        if (group.length && size + body.length > limit) { groups.push(group); group = []; size = 0; }
        group.push(body); size += body.length;
    }
    if (group.length) groups.push(group);
    return groups;
}

// Exact IDs keep model output from being attached to the wrong paragraph.
export function batchPayload(bodies) {
    return '[Translate each text below using the translation instructions above. Return ONLY a JSON array of objects with exactly id and text. Keep every numeric id unchanged, translate its text completely, preserve markup/placeholders, and do not merge or split entries.]\n' +
        JSON.stringify(bodies.map((text, id) => ({ id, text })));
}
export function parseBatchResult(raw, count) {
    let value;
    try { value = JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { /* validated below */ }
    const fail = () => { throw Error('문단 번호나 응답 형식이 맞지 않아 번역을 적용하지 않았어요. 다시 시도해 주세요.'); };
    if (!Array.isArray(value) || value.length !== count) return fail();
    const found = new Map();
    for (const row of value) {
        if (!row || !Number.isInteger(row.id) || row.id < 0 || row.id >= count || found.has(row.id) || typeof row.text !== 'string' || !row.text.trim()) return fail();
        found.set(row.id, row.text);
    }
    return Array.from({length: count}, (_, id) => found.get(id));
}
export async function translateSegments({ parts, signature, request, check = () => {}, progress = () => {}, cacheable = () => true, blockedMarker }) {
    const stamp = epoch, output = [...parts], total = Math.ceil(parts.length / 2), missing = new Map();
    let reused = 0, translated = 0, blocked = 0;
    for (let i = 0; i < parts.length; i += 2) {
        check();
        const body = parts[i];
        if (!body.trim() || /^(\s*\[\[__VAR_\d+__\]\]\s*)+$/.test(body)) continue;
        const key = await checkpointKey(JSON.stringify(['paragraph-v1', signature(body), body]));
        const saved = await read(key);
        check();
        if (typeof saved === 'string') { output[i] = saved; reused++; continue; }
        if (!missing.has(key)) missing.set(key, { key, body, indices: [] });
        missing.get(key).indices.push(i);
    }
    const pending = [...missing.values()];
    progress({ stage: 'segments', done: reused, total, reused, translated, pending: pending.length });
    if (pending.length) {
        let results;
        try { results = await request(pending.map(row => row.body)); }
        catch (error) {
            if (!error?.refused || !blockedMarker) throw error;
            check();
            for (const row of pending) for (const i of row.indices) { output[i] = `${blockedMarker}\n${row.body}`; blocked++; }
        }
        check();
        if (results) {
            // Validate the entire batch before persisting any part.
            if (!Array.isArray(results) || results.length !== pending.length || results.some(text => typeof text !== 'string' || !text.trim())) throw Error('문단 번역 응답이 맞지 않아 저장하지 않았어요.');
            for (let n = 0; n < pending.length; n++) {
                check();
                const row = pending[n], result = results[n];
                if (epoch === stamp && cacheable(row.body, result)) await write(row.key, result, stamp);
                for (const i of row.indices) { output[i] = result; translated++; }
            }
        } else if (!blocked) throw Error('빈 번역 응답은 저장하지 않았어요.');
    }
    check();
    progress({ stage: 'segments', done: total, total, reused, translated, pending: 0 });
    return { text: output.join(''), reused, translated, blocked, total };
}
