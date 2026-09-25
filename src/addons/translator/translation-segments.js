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
// 5.3.4: 한 번역에서 새로 받은 문단을 한 연결 · 한 쓰기 트랜잭션으로 저장한다 (예전엔 문단마다 DB 를 열고 트랜잭션을 따로 만들었다). rows: [key, text]
async function writeMany(rows, stamp) {
    const values = rows.filter(([, text]) => text.length <= 12000).map(([key, text]) => ({ key, text, time: Date.now() }));
    if (!values.length) return;
    for (const value of values) { memory.delete(value.key); memory.set(value.key, value); }
    while (memory.size > LIMIT) memory.delete(memory.keys().next().value);
    let handle;
    try {
        handle = await db();
        if (epoch !== stamp) return;
        await new Promise((resolve, reject) => {
            const tx = handle.transaction('parts', 'readwrite'), store = tx.objectStore('parts');
            for (const value of values) store.put(value);
            const before = writes; writes += values.length; // 예전처럼 문단 16개마다 한 번 정리
            if (Math.floor((before + 15) / 16) !== Math.floor((writes + 15) / 16)) {
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
    // 5.3.4: <p> 도 짝을 본다 — 빈 줄을 품은 <p>…</p> 가 요청 사이에서 쪼개져 여는 태그와 닫는 태그가 따로 번역됐다
    const inline = new Set(['span', 'font', 'q', 'b', 'i', 'strong', 'em', 'u', 's', 'del', 'small', 'mark', 'code', 'a', 'p']);
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

/** 5.2.4: 통짜/덩이 번역에서 모델이 문단 사이 빈 줄을 빠뜨리면(한 문단 = 한 줄로 돌려줌) 원문 문단 수와 줄 수가 같을 때만 빈 줄을 되살린다.
 *  문단 묶음 경로는 구분자를 원문에서 가져오므로 해당 없음. 줄 수가 다르면(문단 안 줄바꿈 · 합쳐진 문단) 손대지 않는다. */
export function restoreParagraphBreaks(source, output) {
    const src = String(source ?? ''), out = String(output ?? '');
    const blank = /\n[\t ]*\n/;
    if (!blank.test(src) || blank.test(out)) return out;
    const paragraphs = src.split(/\n[\t ]*\n(?:[\t ]*\n)*/).filter(p => p.trim()).length;
    const lines = out.split('\n');
    if (paragraphs < 2 || lines.length !== paragraphs || lines.some(l => !l.trim())) return out;
    return lines.join('\n\n');
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
// 5.1.4: 묶음 요청은 JSON 이 아니라 번호 표시를 붙인 자연문으로 보낸다. JSON 으로 감싸면(이스케이프된 날 문장 + "JSON 만 돌려줘")
// 모델·중계 필터가 '이야기 번역' 이 아니라 '자료 처리' 로 보고 첫 번역을 더 자주 거절했고, 프리필("Here is the translation:") 과도 어긋났다.
// 화살표 재번역(통짜 경로)은 되는데 자동 번역만 막히던 이유. 표시는 본문에 나올 일 없는 ⟦n⟧ 을 쓴다.
const MARK = /^[ \t]*⟦\s*(\d+)\s*⟧[ \t]*[:：]?[ \t]*/;
const MARK_ALT = /^[ \t]*【\s*(\d+)\s*】[ \t]*[:：]?[ \t]*/; // 모델이 괄호를 바꿔 쓴 답 — 원래 표시가 하나도 없을 때만 (본문의 각주 【1】 과 헷갈리지 않게)
export const BATCH_HEADER = '[Translate every numbered passage below using the translation instructions above. Each passage starts with a marker like ⟦3⟧. Keep every marker exactly as it is at the start of its translated passage, translate the passage after it completely, keep markup and placeholders, and do not merge, split, reorder, add or drop passages.]\n\n';
export function batchPayload(bodies) {
    return BATCH_HEADER + bodies.map((text, id) => `⟦${id}⟧ ${text}`).join('\n\n');
}
export function batchPayloadLegacy(bodies) {
    return '[Translate every numbered passage below using the translation instructions above. Each passage starts with a marker like ⟦3⟧. Keep every marker exactly as it is at the start of its translated passage, translate the passage after it completely, keep markup and placeholders, and do not merge, split, reorder, add or drop passages.]\n\n' +
        bodies.map((text, id) => `⟦${id}⟧ ${text}`).join('\n\n');
}
// 5.3.4: 답에 덧붙은 머리말 · 꼬리 메모. 원문 문단에는 빈 줄이 없으니(segmentParagraphs) 빈 줄 뒤에 따로 붙은 "Note: …" 는 번역이 아니다.
const NOTE_BLOCK = /^[\s>*_(\[（【]*(?:(?:translator'?s?|translation|tl)\s*notes?|notes?|n\.b\.|번역\s*(?:메모|노트|참고|주석)|역주|참고|주석)\s*[)\]】）*_]*\s*[:：]|^[\s>*_(\[（【]*※/i;
const RULE_BLOCK = /^[\t ]*(?:-{3,}|\*{3,}|_{3,})[\t ]*$/;
const PREAMBLE_BLOCK = /^(?:(?:here(?:'s| is| are)|sure|certainly|okay|ok|below is|the following)(?![a-z])[^\n]{0,100}|(?:translation|번역)[^\n]{0,60}|(?:다음은|아래는)[^\n]{0,60}번역[^\n]{0,40})[:：]\s*$/i;
/** 빈 줄로 떨어진 꼬리 메모(와 그 앞 구분선)를 걷는다. 첫 덩이는 건드리지 않는다. */
export function stripTrailingNote(text) {
    const blocks = String(text ?? '').split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    for (let k = 2; k < blocks.length; k += 2) {
        if (!NOTE_BLOCK.test(blocks[k])) continue;
        let cut = k - 1;
        if (cut >= 2 && RULE_BLOCK.test(blocks[cut - 1])) cut -= 2;
        return blocks.slice(0, cut).join('').replace(/\s+$/, '');
    }
    return blocks.join('');
}
/** 평문 답: 앞의 "Here is the translation:" 같은 한 줄 머리말과 꼬리 메모를 걷는다 (머리말이 문단 하나로 세어져 자리가 밀리지 않게) */
export function stripReplyWrapping(text) {
    let out = String(text ?? '').replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const first = /^([^\n]*)\n[\t ]*\n/.exec(out);
    if (first && PREAMBLE_BLOCK.test(first[1].trim())) out = out.slice(first[0].length).replace(/^\s*\n/, '');
    return stripTrailingNote(out).trim();
}
/** meta.renumbered: 1부터 다시 매긴 답을 한 칸 내려 받았다 (문단 하나를 빼먹고 끝에 지어낸 답과 구별이 안 돼 캐시에 넣지 않는다) */
export function parseBatchResult(raw, count, meta = {}) {
    // 앞의 <think>…</think> · 코드 펜스 · 표시 앞의 설명문은 걷어 낸다. 개수 · 번호 · 중복 · 빈 글 검사는 엄격하다.
    const text = String(raw).replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*```[a-z]*[ \t]*\n|\n[ \t]*```\s*$/g, '').trim();
    const mark = text.includes('⟦') ? MARK : MARK_ALT;
    const fail = () => { throw Object.assign(Error('문단 번호나 응답 형식이 맞지 않아 번역을 적용하지 않았어요. 다시 시도해 주세요.'), { format: true }); };
    const found = new Map();
    let id = null, buffer = [];
    const flush = () => {
        if (id === null) return;
        const body = stripTrailingNote(buffer.join('\n')).replace(/^\n+|\s+$/g, ''); // 빈 줄만 걷고 첫 줄 들여쓰기(코드 · 목록)는 둔다 · 꼬리 메모는 뺀다
        if (!body || found.has(id)) fail();
        found.set(id, body);
    };
    for (const line of text.split('\n')) {
        const hit = mark.exec(line);
        if (hit) { flush(); id = Number(hit[1]); buffer = [line.slice(hit[0].length)]; }
        else if (id !== null) buffer.push(line);
    }
    flush();
    if (found.size !== count) fail();
    // 모델이 1부터 다시 매긴 답(1..N, 0 없음)은 한 칸 내려 받는다 — 개수 · 중복 검사는 그대로
    if (!found.has(0) && found.has(count) && [...found.keys()].every(k => k >= 1 && k <= count)) {
        for (let k = 1; k <= count; k++) { found.set(k - 1, found.get(k)); found.delete(k); }
        meta.renumbered = true;
    }
    for (const key of found.keys()) if (!Number.isInteger(key) || key < 0 || key >= count) fail();
    return Array.from({length: count}, (_, i) => found.get(i));
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
    // 5.2.9: blockedMarker 는 문구 또는 (body, error?) => 문구
    const markOf = (body, error) => typeof blockedMarker === 'function' ? blockedMarker(body, error) : blockedMarker;
    if (pending.length) {
        let results;
        try { results = await request(pending.map(row => row.body)); }
        catch (error) {
            if (!error?.refused || !blockedMarker) throw error;
            check();
            for (const row of pending) for (const i of row.indices) { output[i] = `${markOf(row.body, error)}\n${row.body}`; blocked++; }
        }
        check();
        if (results) {
            // Validate the entire batch before persisting any part. null = 그 묶음만 거절·실패 (차단 표시로 남기고 캐시에 넣지 않는다)
            if (!Array.isArray(results) || results.length !== pending.length || results.some(text => text !== null && (typeof text !== 'string' || !text.trim()))) throw Error('문단 번역 응답이 맞지 않아 저장하지 않았어요.');
            const rows = []; // 5.3.4: 저장은 끝에 한 트랜잭션으로 (중간에 멈춰도 그때까지 확인한 문단은 저장)
            try {
                for (let n = 0; n < pending.length; n++) {
                    check();
                    const row = pending[n], result = results[n];
                    if (result === null) {
                        if (!blockedMarker) throw Error('일부 문단의 번역을 받지 못했어요.');
                        for (const i of row.indices) { output[i] = `${markOf(row.body)}\n${row.body}`; blocked++; }
                        continue;
                    }
                    if (epoch === stamp && cacheable(row.body, result)) rows.push([row.key, result]);
                    for (const i of row.indices) { output[i] = result; translated++; }
                }
            } finally { if (rows.length) await writeMany(rows, stamp); }
        } else if (!blocked) throw Error('빈 번역 응답은 저장하지 않았어요.');
    }
    check();
    progress({ stage: 'segments', done: total, total, reused, translated, pending: 0 });
    return { text: output.join(''), reused, translated, blocked, total };
}
