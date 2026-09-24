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

export async function translateSegments({ parts, signature, request, check = () => {}, progress = () => {}, cacheable = () => true, blockedMarker }) {
    const stamp = epoch, output = [], total = Math.ceil(parts.length / 2);
    let reused = 0, translated = 0, blocked = 0;
    for (let i = 0; i < parts.length; i++) {
        check();
        const body = parts[i];
        if (i % 2 || !body.trim() || /^(\s*\[\[__VAR_\d+__\]\]\s*)+$/.test(body)) { output.push(body); continue; }
        const key = await checkpointKey(JSON.stringify(['paragraph-v1', signature(body), body]));
        const saved = await read(key);
        check();
        progress({ stage: 'segments', done: Math.floor(i / 2), total, reused, translated });
        if (typeof saved === 'string') { output.push(saved); reused++; continue; }
        let result;
        try { result = await request(body); }
        catch (error) {
            if (!error?.refused || !blockedMarker) throw error;
            check(); blocked++; output.push(`${blockedMarker}\n${body}`); continue;
        }
        check();
        if (typeof result !== 'string' || !result.trim()) throw Error('빈 문단 번역은 저장하지 않았어요.');
        if (epoch === stamp && cacheable(body, result)) await write(key, result, stamp);
        output.push(result); translated++;
    }
    check();
    progress({ stage: 'segments', done: total, total, reused, translated });
    return { text: output.join(''), reused, translated, blocked, total };
}
