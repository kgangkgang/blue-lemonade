// 7.4.0 저장 공간 보고 다리 — globalThis[Symbol.for('st.storage-report.v1')].register({ id, owner, label, measure, clean }) (README 「확장 만드는 분께」)
//   다리가 아직 없으면 globalThis[Symbol.for('st.storage-report.pending')] 배열에 넣어 두면, 다리를 만드는 쪽이 나중에 읽어 간다.
// 블루레몬에이드가 이 기기에 남기는 것: 목소리 캐시(TTS) · 번역 캐시 · 요청 기록 · 사용량 장부 · 가격표(공식 · 중계) · 모델 목록 캐시 · 입력 임시 저장 · 효과음 보관함.
//   measure() 는 개수 · 바이트(대략)만 읽는다. clean 의 describe() 는 지우지 않는다. run() 은 부르는 쪽이 사용자에게 물은 뒤에만 부른다.
//   IndexedDB 는 이름이 있을 때만 연다 (없는 DB 를 열면 빈 DB 가 생기므로 indexedDB.databases() 로 먼저 본다).
export const REPORT_BRIDGE = Symbol.for('st.storage-report.v1');
export const REPORT_PENDING = Symbol.for('st.storage-report.pending');

/** 값의 대략 바이트: Blob · ArrayBuffer 는 그 크기, 글은 ×2(UTF-16), 객체는 JSON 길이 ×2 (Blob 칸은 크기만) */
export function approxBytes(value) {
    if (value == null) return 0;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (typeof value === 'string') return value.length * 2;
    if (typeof value !== 'object') return 8;
    let bytes = 0;
    for (const [key, item] of Object.entries(value)) bytes += key.length * 2 + approxBytes(item);
    return bytes;
}

async function dbNames() {
    try { if (typeof indexedDB?.databases === 'function') return new Set((await indexedDB.databases()).map(db => db.name)); } catch { /* 모름 */ }
    return null;   // 목록을 못 읽는 브라우저 — 열어 본다 (없으면 새로 생기지 않게 version 없이 열고 upgrade 면 닫고 지운다)
}
function openExisting(name) {
    return new Promise((resolve) => {
        let request, fresh = false;
        try { request = indexedDB.open(name); } catch { resolve(null); return; }
        request.onupgradeneeded = () => { fresh = true; };
        request.onsuccess = () => {
            const db = request.result;
            if (fresh) { db.close(); try { indexedDB.deleteDatabase(name); } catch { /* 그대로 */ } resolve(null); return; }
            resolve(db);
        };
        request.onerror = request.onblocked = () => resolve(null);
    });
}
/** DB 하나의 개수 · 바이트 (저장소 전부) — 없으면 { count: 0, bytes: 0 } */
export async function measureDb(name, names) {
    if (names && !names.has(name)) return { count: 0, bytes: 0 };
    const db = await openExisting(name);
    if (!db) return { count: 0, bytes: 0 };
    try {
        let count = 0, bytes = 0;
        for (const store of [...db.objectStoreNames]) {
            await new Promise((resolve) => {
                const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
                req.onsuccess = () => { const c = req.result; if (!c) { resolve(); return; } count++; bytes += approxBytes(c.value); c.continue(); };
                req.onerror = () => resolve();
            });
        }
        return { count, bytes };
    } finally { db.close(); }
}
async function clearDb(name) {
    const db = await openExisting(name);
    if (!db) return;
    try {
        for (const store of [...db.objectStoreNames]) await new Promise((resolve) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).clear(); t.oncomplete = t.onerror = t.onabort = () => resolve(); });
    } finally { db.close(); }
}
function measureLocal(keys) {
    let count = 0, bytes = 0;
    try { for (const key of keys) { const value = globalThis.localStorage?.getItem(key); if (value != null) { count++; bytes += (key.length + value.length) * 2; } } } catch { /* 없음 */ }
    return { count, bytes };
}
/** 이름이 prefix 로 시작하는 localStorage 열쇠들 */
function localKeys(prefix) {
    const out = [];
    try { const box = globalThis.localStorage; for (let i = 0; i < (box?.length || 0); i++) { const key = box.key(i); if (key?.startsWith(prefix)) out.push(key); } } catch { /* 없음 */ }
    return out;
}

// 번역 캐시(LLMtranslatorDB)는 상한이 없다 — 번역 DB 창에서 사용자가 보고 고치는 자료라 저절로 지우지 않고, 「오래된 것만 지우기」를 물어본 뒤에만 한다.
//   date 칸은 예전부터 한국 시각(UTC+9)을 ISO 글로 적어 왔다 → 기준 시각도 같은 방식으로 만들어 글로 견준다
export const OLD_TRANSLATION_DAYS = 60;
export function translationCutoff(now = Date.now(), days = OLD_TRANSLATION_DAYS) { return new Date(now + 9 * 3600000 - days * 86400000).toISOString(); }
/** date 가 기준보다 앞선 줄 (keys: true 면 지울 id 도) — DB 가 없으면 { count: 0, bytes: 0 } */
async function oldTranslations(names, { keys = false } = {}) {
    const out = { count: 0, bytes: 0, ...(keys ? { ids: [] } : {}) };
    if (names && !names.has('LLMtranslatorDB')) return out;
    const db = await openExisting('LLMtranslatorDB');
    if (!db) return out;
    try {
        if (!db.objectStoreNames.contains('translations')) return out;
        const cutoff = translationCutoff();
        await new Promise((resolve) => {
            const req = db.transaction('translations', 'readonly').objectStore('translations').openCursor();
            req.onsuccess = () => { const c = req.result; if (!c) { resolve(); return; } const row = c.value; if (typeof row?.date === 'string' && row.date < cutoff) { out.count++; out.bytes += approxBytes(row); if (keys) out.ids.push(c.primaryKey); } c.continue(); };
            req.onerror = () => resolve();
        });
    } finally { db.close(); }
    return out;
}
async function removeOldTranslations() {
    const { ids, count, bytes } = await oldTranslations(await dbNames(), { keys: true });
    if (!ids?.length) return { count: 0, bytes: 0 };
    const db = await openExisting('LLMtranslatorDB');
    if (!db) return { count: 0, bytes: 0 };
    try {
        await new Promise((resolve) => { const t = db.transaction('translations', 'readwrite'), s = t.objectStore('translations'); for (const id of ids) s.delete(id); t.oncomplete = t.onerror = t.onabort = () => resolve(); });
    } finally { db.close(); }
    return { count, bytes };
}

export const VOICE_DBS = Object.freeze(['lemon-voice', 'lemon-voice-listen']);
export const TRANSLATION_DBS = Object.freeze(['LLMtranslatorDB', 'LLMtranslatorSegments', 'LLMtranslatorProgress']);
export const REQUEST_DB = 'request_log';
export const LEDGER_DB = 'BlueLemonadeUsage';
export const PRICE_KEYS = Object.freeze(['bl-official-prices-v1']);
export const RELAY_PRICE_PREFIX = 'bl-relay-pricing:';
export const MODEL_KEYS = Object.freeze(['bl_live_models_v1', 'lemon_voice_model_lists']);
export const DRAFT_KEYS = Object.freeze(['bl-drafts']);
export const SFX_DB = 'lemon-voice-sfx';
export const LEGACY_PROMPT_DB = 'PTTranslationDB_PLUS';

async function sum(names, list) {
    let count = 0, bytes = 0;
    for (const name of list) { const r = await measureDb(name, names); count += r.count; bytes += r.bytes; }
    return { count, bytes };
}

/** 목소리 캐시 비우기 — TTS 애드온이 떠 있으면 그 clear()(재생기의 메모리 사본도 버림), 아니면 DB 를 바로 */
async function clearVoice() {
    try { const cache = await import('./addons/tts/src/cache.js'); await cache.clear(); } catch { await clearDb('lemon-voice'); }
    try { const listen = await import('./addons/tts/src/listen.js'); await listen.clearCache(); } catch { await clearDb('lemon-voice-listen'); }
}
/** 번역 캐시 비우기 — 문단 캐시는 번역기 함수로(메모리 사본도), 나머지 DB 는 바로 */
async function clearTranslation() {
    try { const seg = await import('./addons/translator/translation-segments.js'); await seg.clearSegmentCache(); } catch { await clearDb('LLMtranslatorSegments'); }
    await clearDb('LLMtranslatorDB'); await clearDb('LLMtranslatorProgress');
}
async function clearRequests() {
    try { const store = await import('./addons/perf/store.js'); await store.clearEntries(); await store.clearDaily(); } catch { await clearDb(REQUEST_DB); }
}

/** 보고 한 묶음 (등록할 값) */
export function storageReport() {
    const item = (id, label, measured, note = '') => ({ id, label, count: measured.count, bytes: measured.bytes, ...(note ? { note } : {}) });
    return {
        id: 'blue-lemonade', owner: 'blue-lemonade', label: 'Blue Lemonade',
        async measure() {
            const names = await dbNames();
            return { items: [
                item('voice-cache', '목소리 캐시', await sum(names, VOICE_DBS), 'TTS 로 받은 소리 · 듣는 말 번역'),
                item('translation-cache', '번역 캐시', await sum(names, TRANSLATION_DBS), '번역문 · 문단 캐시 · 이어 하기'),
                item('request-log', '요청 기록', await measureDb(REQUEST_DB, names), '요청 로그 · 날짜별 합계'),
                item('usage-ledger', '사용량 장부', await measureDb(LEDGER_DB, names), '90일'),
                item('price-cache', '가격표', measureLocal(PRICE_KEYS), '공식 단가 (하루 한 번 갱신)'),
                item('relay-prices', '중계 가격표', measureLocal(localKeys(RELAY_PRICE_PREFIX)), '가격 비교에서 불러온 중계 · 최근 6곳'),
                item('model-lists', '모델 목록 캐시', measureLocal(MODEL_KEYS), '하루'),
                item('drafts', '입력 임시 저장', measureLocal(DRAFT_KEYS), '보내기 전 글 · 최근 20채팅'),
                item('sfx-library', '효과음 보관함', await measureDb(SFX_DB, names), '내가 넣은 효과음 — 여기서 지우지 않아요'),
                ...(names?.has(LEGACY_PROMPT_DB) ? [item('legacy-prompt-db', '옛 프롬프트 번역', await measureDb(LEGACY_PROMPT_DB, names), '예전 판이 이 브라우저에 둔 것 (지금은 파일에 둬요) — 여기서 지우지 않아요')] : []),
            ] };
        },
        clean: [
            { id: 'voice-cache', label: '목소리 캐시 비우기', describe: async () => ({ ...(await sum(await dbNames(), VOICE_DBS)), note: '다시 들으면 소리를 새로 받아요 (요금이 다시 들 수 있어요)' }), run: async () => { const before = await sum(await dbNames(), VOICE_DBS); await clearVoice(); return before; } },
            { id: 'translation-cache', label: '번역 캐시 비우기', describe: async () => ({ ...(await sum(await dbNames(), TRANSLATION_DBS)), note: '채팅에 붙은 번역문은 그대로예요. 다시 번역하면 처음부터 보내요' }), run: async () => { const before = await sum(await dbNames(), TRANSLATION_DBS); await clearTranslation(); return before; } },
            { id: 'request-log', label: '요청 기록 지우기', describe: async () => ({ ...(await measureDb(REQUEST_DB, await dbNames())), note: '요청 로그 창의 기록 · 날짜별 합계가 지워져요. 사용량 장부는 그대로예요' }), run: async () => { const before = await measureDb(REQUEST_DB, await dbNames()); await clearRequests(); return before; } },
            { id: 'translation-cache-old', label: `${OLD_TRANSLATION_DAYS}일 지난 번역 캐시만 지우기`, describe: async () => ({ ...(await oldTranslations(await dbNames())), note: `${OLD_TRANSLATION_DAYS}일 전에 넣은 번역문 캐시예요. 채팅에 붙은 번역문 · 최근 캐시는 그대로예요` }), run: async () => removeOldTranslations() },
            { id: 'relay-prices', label: '중계 가격표 캐시 비우기', describe: async () => ({ ...measureLocal(localKeys(RELAY_PRICE_PREFIX)), note: '가격 비교에서 「불러오기」를 다시 누르면 새로 받아요' }), run: async () => { const keys = localKeys(RELAY_PRICE_PREFIX), before = measureLocal(keys); try { for (const key of keys) globalThis.localStorage.removeItem(key); } catch { /* 그대로 */ } return before; } },
        ],
    };
}

/** 다리에 등록 (다리가 없으면 대기 줄에) — 한 번만 */
let registered = false;
export function registerStorageReport() {
    if (registered) return;
    registered = true;
    const report = storageReport();
    try {
        const bridge = globalThis[REPORT_BRIDGE];
        if (bridge && typeof bridge.register === 'function') { bridge.register(report); return; }
        const pending = Array.isArray(globalThis[REPORT_PENDING]) ? globalThis[REPORT_PENDING] : (globalThis[REPORT_PENDING] = []);
        if (!pending.some(row => row?.id === report.id)) pending.push(report);
    } catch (error) { console.warn('[Blue Lemonade] 저장 공간 보고 등록', error); }
}
