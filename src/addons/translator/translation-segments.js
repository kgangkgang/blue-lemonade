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
// 메모리에 없는 키만 한 연결 · 한 읽기 트랜잭션으로 한꺼번에 읽는다 (예전엔 키마다 DB 를 열었다). 결과: key → text (TTL 지난 것은 뺌)
async function readMany(keys) {
    const found = new Map(), missing = [];
    for (const key of keys) { const value = memory.get(key); if (value) found.set(key, value); else missing.push(key); }
    let handle;
    if (missing.length) try {
        handle = await db();
        const store = handle.transaction('parts').objectStore('parts');
        await Promise.all(missing.map(key => new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => { if (request.result) found.set(key, request.result); resolve(); };
            request.onerror = () => reject(request.error);
        })));
    } catch { /* Storage unavailable: translate normally. */ } finally { handle?.close(); }
    const fresh = new Map();
    for (const [key, value] of found) if (value?.time > Date.now() - TTL) fresh.set(key, value.text);
    return fresh;
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
    // 앞의 <think>…</think> · 코드 펜스 · 앞뒤 설명문은 걷어 내고 가장 바깥 [ … ] 만 읽는다. 개수 · 번호 · 중복 · 빈 글 검사는 그대로 엄격하다.
    const text = String(raw).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const end = text.lastIndexOf(']');
    let value;
    for (const start of new Set([text.indexOf('['), text.search(/\[\s*\{/)])) {
        if (start < 0 || end <= start) continue;
        try { value = JSON.parse(text.slice(start, end + 1)); break; } catch { /* validated below */ }
    }
    const fail = () => { throw Error('문단 번호나 응답 형식이 맞지 않아 번역을 적용하지 않았어요. 다시 시도해 주세요.'); };
    if (!Array.isArray(value) || value.length !== count) return fail();
    const found = new Map();
    for (const row of value) {
        const id = typeof row?.id === 'string' && /^\s*\d+\s*$/.test(row.id) ? Number(row.id) : row?.id; // "0" 같은 숫자 문자열도 받는다
        if (!row || !Number.isInteger(id) || id < 0 || id >= count || found.has(id) || typeof row.text !== 'string' || !row.text.trim()) return fail();
        found.set(id, row.text);
    }
    return Array.from({length: count}, (_, id) => found.get(id));
}
export async function translateSegments({ parts, signature, request, check = () => {}, progress = () => {}, cacheable = () => true, blockedMarker }) {
    const stamp = epoch, output = [...parts], total = Math.ceil(parts.length / 2), missing = new Map();
    let reused = 0, translated = 0, blocked = 0;
    // paragraph-v2: 서명이 준비된 프롬프트 전체가 아니라 짧은 요약(연결 · 프롬프트 · 용어집)이 됐다
    const keyed = [];
    for (let i = 0; i < parts.length; i += 2) {
        check();
        const body = parts[i];
        if (!body.trim() || /^(\s*\[\[__VAR_\d+__\]\]\s*)+$/.test(body)) continue;
        keyed.push([i, body, await checkpointKey(JSON.stringify(['paragraph-v2', signature(body), body]))]);
    }
    const saved = await readMany([...new Set(keyed.map(row => row[2]))]);
    check();
    for (const [i, body, key] of keyed) {
        if (saved.has(key)) { output[i] = saved.get(key); reused++; continue; }
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
            // Validate the entire batch before persisting any part. null = 그 묶음만 거절·실패 (차단 표시로 남기고 캐시에 넣지 않는다)
            if (!Array.isArray(results) || results.length !== pending.length || results.some(text => text !== null && (typeof text !== 'string' || !text.trim()))) throw Error('문단 번역 응답이 맞지 않아 저장하지 않았어요.');
            for (let n = 0; n < pending.length; n++) {
                check();
                const row = pending[n], result = results[n];
                if (result === null) {
                    if (!blockedMarker) throw Error('일부 문단의 번역을 받지 못했어요.');
                    for (const i of row.indices) { output[i] = `${blockedMarker}\n${row.body}`; blocked++; }
                    continue;
                }
                if (epoch === stamp && cacheable(row.body, result)) await write(row.key, result, stamp);
                for (const i of row.indices) { output[i] = result; translated++; }
            }
        } else if (!blocked) throw Error('빈 번역 응답은 저장하지 않았어요.');
    }
    check();
    progress({ stage: 'segments', done: total, total, reused, translated, pending: 0 });
    return { text: output.join(''), reused, translated, blocked, total };
}
