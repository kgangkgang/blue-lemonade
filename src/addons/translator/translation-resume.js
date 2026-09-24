// Private browser-local checkpoints. No API keys/configuration are persisted.
const memory = new Map();
const TTL = 24 * 60 * 60 * 1000, LIMIT = 20;
async function database() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LLMtranslatorProgress', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('jobs', { keyPath: 'key' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => reject(Error('checkpoint unavailable'));
    });
}
async function read(key) {
    let value = memory.get(key);
    if (!value) {
        let db;
        try {
            db = await database();
            value = await new Promise((resolve, reject) => {
                const request = db.transaction('jobs').objectStore('jobs').get(key);
                request.onsuccess = () => resolve(request.result); request.onerror = reject;
            });
        } catch { /* memory fallback */ } finally { db?.close(); }
    }
    return value?.time > Date.now() - TTL ? value : null;
}
async function write(value) {
    memory.set(value.key, structuredClone(value));
    for (const [key, job] of memory) if (job.time < Date.now() - TTL) memory.delete(key);
    while (memory.size > LIMIT) memory.delete(memory.keys().next().value);
    let db;
    try {
        db = await database();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('jobs', 'readwrite'), store = tx.objectStore('jobs');
            store.put(value);
            const request = store.getAll();
            request.onsuccess = () => {
                const jobs = request.result.sort((a, b) => b.time - a.time);
                jobs.forEach((job, index) => { if (index >= LIMIT || job.time < Date.now() - TTL) store.delete(job.key); });
            };
            tx.oncomplete = resolve; tx.onabort = tx.onerror = reject;
        });
    } catch { /* memory fallback; never prevent a completed translation */ } finally { db?.close(); }
}
// http 로 연 폰(비보안 컨텍스트)에는 crypto.subtle 이 없다 — 같은 입력이면 같은 값이 나오는 순수 JS 해시(FNV-1a 두 벌)로 대신한다.
// 키는 같은지만 견주므로 형식이 달라도 된다. subtle 이 있으면 예전 그대로 SHA-256 (저장된 키 유지).
function fallbackHash(bytes) {
    let a = 0x811c9dc5, b = 0x050c5d1f;
    for (const byte of bytes) { a = Math.imul(a ^ byte, 0x01000193) >>> 0; b = Math.imul(b ^ byte, 0x5bd1e995) >>> 0; }
    return `fnv-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
export async function checkpointKey(value) {
    const bytes = new TextEncoder().encode(value);
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return fallbackHash(bytes);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function clearCheckpoints(key) {
    if (key) memory.delete(key); else memory.clear();
    let db;
    try {
        db = await database();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('jobs', 'readwrite'), store = tx.objectStore('jobs');
            if (key) store.delete(key); else store.clear();
            tx.oncomplete = resolve; tx.onabort = tx.onerror = reject;
        });
    } catch { /* memory-only browsers */ } finally { db?.close(); }
}
export async function translateChunks({ key, chunks, request, check = () => {}, progress = () => {}, blockedMarker }) {
    // Bound storage; exceptionally large jobs still translate without checkpoints.
    const persist = chunks.join('').length <= 200000;
    const saved = persist ? await read(key) : null;
    const parts = saved?.parts?.length === chunks.length ? [...saved.parts] : chunks.map(() => null);
    const output = [], resumed = parts.filter(part => typeof part === 'string').length;
    let blocked = 0;
    for (let i = 0; i < chunks.length; i++) {
        check();
        progress({ stage: 'chunks', done: i, total: chunks.length, resumed });
        if (typeof parts[i] === 'string') { output.push(parts[i]); continue; }
        try {
            const result = await request(chunks[i], i);
            check();
            parts[i] = result;
            if (persist) await write({ key, parts, time: Date.now() });
            output.push(result);
        } catch (error) {
            if (error?.refused && blockedMarker) { blocked++; output.push(`${blockedMarker}\n${chunks[i]}`); continue; }
            const completed = parts.filter(part => typeof part === 'string').length;
            if (!error?.cancelled && completed && persist) {
                error.message += ` (문단 ${completed}/${chunks.length} 저장됨. 같은 모델·설정으로 다시 번역하면 이어서 진행해요.)`;
                error.resumable = true;
            }
            throw error;
        }
    }
    check();
    if (blocked === chunks.length) throw Object.assign(Error('모든 문단의 번역이 거절됐어요.'), { refused: true });
    return { text: output.join('\n\n'), blocked, total: chunks.length, resumed };
}
