import { maskTranslatorNotes } from './translation-notes.js';
export { maskTranslatorNotes } from './translation-notes.js';
import { checkpointKey } from './translation-resume.js';

// 7.3.1 문단 캐시 크기: 400문단은 70~90문단 답 4~5개뿐이라 조금 전 채팅도 밀려나 처음부터 다시 번역했다.
//   저장소는 4000문단 · 글자 200만 자(어느 쪽이든 먼저 닿는 쪽) 안에서 최근에 쓴 것부터 남긴다(LRU — 꺼내 쓴 문단도 시각을 새로).
//   메모리 사본은 1200문단까지. 정리는 쓴 문단 128개마다 한 번 (getAll 이 4000줄을 읽으니 자주 하지 않는다)
const memory = new Map(), MEMORY_LIMIT = 1200, LIMIT = 4000, CHAR_BUDGET = 2000000, PRUNE_EVERY = 128, TTL = 30 * 86400000;
export const SEGMENT_CACHE_LIMITS = Object.freeze({ paragraphs: LIMIT, chars: CHAR_BUDGET, memory: MEMORY_LIMIT, pruneEvery: PRUNE_EVERY, days: 30 });
/** 7.3.1 남길 줄 고르기 (시험용으로 꺼냄): 최근 것부터 개수 · 글자 수 안에 드는 것만, 기한 지난 것은 뺀다 → 지울 key 목록 */
export function pruneKeys(rows, now = Date.now(), { limit = LIMIT, chars = CHAR_BUDGET, ttl = TTL } = {}) {
    const drop = [];
    let kept = 0, used = 0;
    for (const row of [...rows].sort((a, b) => b.time - a.time)) {
        const size = String(row.text ?? '').length;
        if (row.time < now - ttl || kept >= limit || used + size > chars) { drop.push(row.key); continue; }
        kept++; used += size;
    }
    return drop;
}
// 2.9.0 이어 하기: 묶음이 끊기거나 실패하면(연결 끊김 · 중지 · 시간 초과 · 429 …) 그때까지 닫힌 문단을 같은 저장소에 'resume:' 열쇠로 하루만 둔다.
//   30일 문단 캐시에는 넣지 않는다 — 끝나지 않은 답은 묶음 전체 검사(문단 수 · 1부터 다시 매긴 답)를 못 거쳤다. 검사는 캐시와 같은 cacheable
const RESUME = 'resume:', RESUME_TTL = 86400000;
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
async function readMany(keys, ttl = TTL) {
    const found = new Map(), missing = [];
    for (const key of keys) { const value = memory.get(key); if (value) { memory.delete(key); memory.set(key, value); found.set(key, value); } else missing.push(key); }   // 7.3.1 쓴 것은 맨 뒤로 (LRU)
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
    for (const [key, value] of found) if (value?.time > Date.now() - ttl) fresh.set(key, value.text);
    return fresh;
}
// 5.3.4: 한 번역에서 새로 받은 문단을 한 연결 · 한 쓰기 트랜잭션으로 저장한다 (예전엔 문단마다 DB 를 열고 트랜잭션을 따로 만들었다). rows: [key, text]
async function writeMany(rows, stamp) {
    const values = rows.filter(([, text]) => text.length <= 12000).map(([key, text]) => ({ key, text, time: Date.now() }));
    if (!values.length) return;
    for (const value of values) { memory.delete(value.key); memory.set(value.key, value); }
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
    let handle;
    try {
        handle = await db();
        if (epoch !== stamp) return;
        await new Promise((resolve, reject) => {
            const tx = handle.transaction('parts', 'readwrite'), store = tx.objectStore('parts');
            for (const value of values) store.put(value);
            const before = writes; writes += values.length; // 7.3.1 쓴 문단 128개마다 한 번 정리 (첫 쓰기 때도 — 예전 판이 남긴 줄을 바로 맞춘다)
            if (Math.floor((before + PRUNE_EVERY - 1) / PRUNE_EVERY) !== Math.floor((writes + PRUNE_EVERY - 1) / PRUNE_EVERY)) {
                const request = store.getAll();
                request.onsuccess = () => { for (const key of pruneKeys(request.result)) store.delete(key); };
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

const paragraphKey = (signature, body) => checkpointKey(JSON.stringify(['paragraph-v2', signature, body]));
// 3.0.1 자리표시자([[__VAR_n__]]) 번호는 메시지 전체에서 매겨져, 앞 문단에서 보호 글(색 span · 그림 자리 …)이 하나 늘거나 줄면 뒤 문단의 번호가 모두 밀려
//   열쇠가 바뀌었다 — 대사 한 문단을 지웠는데 뒤 문단이 전부 다시 번역됨(사용자 제보). 열쇠는 문단 안 차례(0, 1, …)로 고쳐 쓴 글 + 그 자리에 든 보호 글(protection)로 만들고,
//   저장할 때 번호를 문단 안 차례로, 꺼낼 때 지금 번호로 되돌린다. 자리표시자가 없는 문단은 예전 열쇠(paragraph-v2) 그대로라 쌓인 캐시가 산다
const VAR_RE = /\[\[__VAR_(\d+)__\]\]/g;
export function localizePlaceholders(body) {
    const map = [];
    const norm = String(body ?? '').replace(VAR_RE, (m, n) => { let j = map.indexOf(Number(n)); if (j < 0) { j = map.length; map.push(Number(n)); } return `[[__VAR_${j}__]]`; });
    return { norm, map };
}
export const restorePlaceholders = (text, map) => map.length ? String(text ?? '').replace(VAR_RE, (m, j) => (Number(j) < map.length ? `[[__VAR_${map[Number(j)]}__]]` : m)) : String(text ?? '');
const localizeOut = (text, map) => map.length ? String(text ?? '').replace(VAR_RE, (m, n) => { const j = map.indexOf(Number(n)); return j < 0 ? m : `[[__VAR_${j}__]]`; }) : String(text ?? '');
/** 문단 캐시 · 이어 하기 열쇠 → { key, map } (map = 문단 안 차례 → 지금 번호). protection(n) = n 번 자리에 든 보호 글 */
export async function segmentCacheKey(signature, body, protection = null) {
    const { norm, map } = localizePlaceholders(body);
    if (!map.length) return { key: await paragraphKey(signature(body), body), map };
    const values = map.map(n => String(protection?.(n) ?? ''));
    return { key: await checkpointKey(JSON.stringify(['paragraph-v3', signature(body), norm, values])), map };
}
// 7.2.6 글자(\p{L})가 하나도 없는 문단 — 자리표시자 · 태그 · 기호뿐(그림 한 장 `<img …>` 같은 것) — 은 보내지 않고 그대로 둔다 (token-audit 번역 1)
const bareLetters = body => /\p{L}/u.test(String(body).replace(/\[\[__VAR_\d+__\]\]/g, '').replace(/<[^>]*>/g, '').replace(/⟦\d+⟧/g, ''));
const skipBody = body => !body.trim() || /^(\s*\[\[__VAR_\d+__\]\]\s*)+$/.test(body) || !bareLetters(body);
export const skipsBody = skipBody;   // 시험용
/** 5.4.2: 한 메시지의 문단 캐시 줄을 지운다 (사용자가 번역문을 지웠을 때) — 남아 있으면 다시 번역해도 요청 없이 옛 번역이 그대로 나왔다 */
export async function forgetSegments(parts, signature, protection = null) {
    const keys = [];
    for (let i = 0; i < parts.length; i += 2) if (!skipBody(parts[i])) keys.push((await segmentCacheKey(signature, parts[i], protection)).key);   // 3.0.1 번역할 때와 같은 열쇠
    if (!keys.length) return 0;
    for (const key of keys) memory.delete(key);
    let handle;
    try {
        handle = await db();
        await new Promise((resolve, reject) => {
            const tx = handle.transaction('parts', 'readwrite'), store = tx.objectStore('parts');
            for (const key of keys) store.delete(key);
            tx.oncomplete = resolve; tx.onerror = tx.onabort = reject;
        });
    } catch { /* Memory-only environment. */ } finally { handle?.close(); }
    return keys.length;
}

/** 7.3.1 segmentParagraphs 가 나누는 조각 상한 (문단 + 구분자) — 401문단 */
export const SEGMENT_PARTS_MAX = 801;
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
    // 7.3.1 문단 수 상한: 161 조각(81문단)을 넘는 긴 답은 null(문단 캐시 없음)이 돼 통짜 한 요청으로 갔다 — 89·90문단 답은 원문 한 문장만
    //   고쳐도 메시지 전체를 다시 보냈다(문단 캐시 · 이어 하기 모두 못 씀). 한 요청 크기는 batchGroups 가 글자 수(응답 길이 × 1.2)로 따로 나누니
    //   여기 상한은 문단 키 계산 · ⟦n⟧ 표시가 터무니없이 많은 글만 막는다
    return parts.length <= SEGMENT_PARTS_MAX ? parts : null;
}

// ── 6.1.8 보호 블록 (번역하지 않고 제자리에 한 번만 두는 블록 — 그림 자리 같은 것) ──
const PLACEHOLDER = /\[\[__VAR_\d+__\]\]/g;
const splitBlank = text => {
    const parts = String(text ?? '').split(/(\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*)/), out = [];
    for (let i = 0; i < parts.length; i += 2) out.push({ body: parts[i], sep: parts[i + 1] ?? '' });
    return out;
};
const joinBlank = list => list.map((p, i) => p.body + (i < list.length - 1 ? (p.sep || '\n\n') : p.sep)).join('');
const gapOf = space => (/\n/.test(space) ? '\n' : space ? ' ' : '');
/**
 * 6.1.8 모델이 빠뜨린 보호 블록 자리표시자를 원문 문단 자리에 되돌린다.
 * masked: 모델에 보낸 원문(자리표시자 포함) · output: 모델 답(자리표시자를 풀기 전) · placeholders: 되돌릴 자리표시자.
 * 자리표시자만 있던 원문 문단이 통째로 빠졌으면 그 문단 자리에, 문단 안에서 빠졌으면 같은 문단의 앞(원문에서 앞에 있었으면) · 뒤에 둔다.
 * 답의 문단 수가 원문(통째로 빠진 문단을 뺀 수)과 다르면 자리를 믿을 수 없어 끝에 문단으로 붙인다. 원문에 없거나 답에 이미 있는 자리표시자는 건드리지 않는다.
 */
export function restoreDroppedPlaceholders(masked, output, placeholders) {
    const source = String(masked ?? ''), answer = String(output ?? '');
    const missing = [...new Set(placeholders || [])].filter(ph => ph && source.includes(ph) && !answer.includes(ph));
    if (!missing.length) return answer;
    const src = splitBlank(source), out = splitBlank(answer);
    const holdersOf = body => body.match(PLACEHOLDER) || [];
    const holderOnly = body => body.trim() !== '' && body.replace(PLACEHOLDER, '').trim() === '';
    const whole = src.map((p, i) => i).filter(i => holderOnly(src[i].body) && holdersOf(src[i].body).every(ph => missing.includes(ph)));
    const inside = missing.map(ph => [ph, src.findIndex(p => p.body.includes(ph))]).filter(([, i]) => i >= 0 && !whole.includes(i)).sort((a, b) => a[1] - b[1] || src[a[1]].body.indexOf(a[0]) - src[b[1]].body.indexOf(b[0]));
    if (out.length !== src.length - whole.length) {
        const items = [...whole.map(i => [i, src[i].body.trim()]), ...inside.map(([ph, i]) => [i, ph])].sort((a, b) => a[0] - b[0]).map(([, text]) => text);
        return answer.replace(/\s+$/, '') + '\n\n' + items.join('\n\n');
    }
    for (const i of whole) out.splice(i, 0, { body: src[i].body, sep: src[i].sep }); // 원문의 뒤 구분자 그대로 (마지막 문단이면 없음 — 사이는 joinBlank 가 채운다)
    for (const [ph, i] of inside) {
        const body = src[i].body, at = body.indexOf(ph), before = body.slice(0, at), after = body.slice(at + ph.length);
        const target = out[i];
        if (!before.trim()) target.body = ph + gapOf(/^\s*/.exec(after)[0]) + target.body.replace(/^\s+/, '');
        else target.body = target.body.replace(/\s+$/, '') + gapOf(/\s*$/.exec(before)[0] || ' ') + ph;
    }
    return joinBlank(out);
}
/**
 * 6.1.8 답에서 빠진 보호 블록의 자리표시자. 값으로 센다 — 교정 재번역은 원문 · 기존 번역을 묶어 보내 같은 블록이 두 번(번호 둘) 나가는데,
 * 답에는 그중 하나만 있으면 된다. blocks: 번호 → 블록 글 · source: 자리를 볼 원문(자리표시자 포함) · output: 모델 답 · isProtected: 지켜야 할 블록인가
 */
export function droppedPlaceholders(blocks, source, output, isProtected) {
    const blockOf = ph => blocks?.[Number(/\d+/.exec(ph)[0])];
    const wanted = new Map(), present = new Map(), answer = String(output ?? ''), dropped = [];
    for (const ph of String(source ?? '').match(PLACEHOLDER) || []) {
        const block = blockOf(ph);
        if (block === undefined || !isProtected(block)) continue;
        if (!wanted.has(block)) wanted.set(block, []);
        wanted.get(block).push(ph);
    }
    for (const ph of answer.match(PLACEHOLDER) || []) { const block = blockOf(ph); if (block !== undefined) present.set(block, (present.get(block) || 0) + 1); }
    for (const [block, list] of wanted) {
        const deficit = list.length - (present.get(block) || 0);
        if (deficit > 0) dropped.push(...list.filter(ph => !answer.includes(ph)).slice(0, deficit));
    }
    return dropped;
}
/** 6.1.8 글에서 토큰(원문 병기 보기의 __MASK_…__)을 지운다 — 보호 블록을 원문 쪽 사본에서 빼 두 번 그리지 않게 */
export function dropTokens(text, tokens) {
    let value = String(text ?? '');
    for (const token of tokens || []) if (token) value = value.split(token).join('');
    return value;
}

// ── 2.5.1 숨긴 HTML 주석 (<!-- … -->) ──
// 과일의 마음 프리셋은 답마다 빈 줄을 품은 자기 점검 주석(「<!--  …점검：⏎…⏎⏎…⏎（…输出结果) -->」)을 넣는다. 원문에선 안 보이는데 번역에 보내면
//   ① 주석 속 빈 줄에서 문단 · 덩이가 갈라져 앞 조각과 뒤 조각이 따로 번역되고 ② 모델이 원문 그대로 둔 뒤 조각은 끝의 「 -->」 때문에
//   원문+화살표(되풀이)로 보여 문단째 지워졌고 ③ 모델이 주석 속 지시를 따르다 답을 끊기도 했다. 그러면 닫는 --> 를 잃은
//   「<!-- 쾌적 성애 점검: …」이 화면에 그대로 보였다. 이제 주석은 번역에 보내지 않고(index.js 보호 규칙) 제자리에 원문 그대로 되돌린다.
export const HTML_COMMENT = /<!--[\s\S]*?-->/g;
/** 닫히지 않은 <!-- 의 자리 (from 부터) — 다음 <!-- 보다 먼저 --> 가 나오지 않으면 닫히지 않은 것. 없으면 -1 */
export function openCommentAt(text, from = 0) {
    const value = String(text ?? '');
    for (let at = value.indexOf('<!--', from); at >= 0; at = value.indexOf('<!--', at + 4)) {
        const close = value.indexOf('-->', at + 4), next = value.indexOf('<!--', at + 4);
        if (close < 0 || (next >= 0 && next < close)) return at;
    }
    return -1;
}
/** 번역문의 주석이 깨졌나 — 닫히지 않은 <!-- 가 있거나 닫힌 주석이 원문보다 적으면 참 (그런 번역은 캐시에 넣지도 꺼내 쓰지도 않는다).
 *  2.5.0 까지 주석 속까지 번역해 닫아 둔 옛 번역은 깨진 게 아니다 (화면에 안 보인다) */
export function brokenComments(source, output) {
    const src = String(source ?? ''), out = String(output ?? '');
    if (openCommentAt(out) >= 0 && openCommentAt(src) < 0) return true;   // 원문부터 안 닫힌 주석(끊긴 답)이면 번역문도 그렇다
    const count = text => (text.match(HTML_COMMENT) || []).length;
    return count(out) < count(src);
}
/**
 * 표시 보정 (저장된 글은 그대로 — 그릴 때만): 닫히지 않은 <!-- 부터 그 문단 끝(빈 줄)까지 숨기고,
 * 여는 짝을 잃고 문단 끝에 홀로 남은 --> 는 그 문단 머리부터 걷는다 (옛 번역의 주석 뒤 조각). 고칠 게 없으면 같은 글.
 */
export function hideOpenComments(text) {
    let value = String(text ?? '');
    if (!value.includes('<!--') && !value.includes('-->')) return value;
    const paragraphEnd = at => { const m = /\n[\t ]*\n/.exec(value.slice(at)); return m ? at + m.index : value.length; };
    for (let at = openCommentAt(value); at >= 0; at = openCommentAt(value, at)) {
        const head = value.slice(0, at), tail = value.slice(paragraphEnd(at));
        // 문단 머리의 주석이면 문단째(뒤 빈 줄까지), 문단 가운데면 그 줄 앞까지만 (「<content>⏎<!-- …」 의 <content> 는 둔다)
        if (!head.trim() || /\n[\t ]*\n[\t ]*$/.test(head)) { value = head + tail.replace(/^\n[\t ]*\n(?:[\t ]*\n)*/, ''); at = head.length; }
        else { const kept = head.replace(/[ \t]*\n?[ \t]*$/, ''); value = kept + tail; at = kept.length; }
    }
    // 홀로 남은 닫는 짝: 문단이 --> 로 끝나고 그 문단에 여는 <!-- 가 없을 때만 (글 속 화살표 「A --> B」는 문단 끝이 아니다)
    const parts = value.split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    let changed = false;
    for (let i = 0; i < parts.length; i += 2) {
        if (!/-->[\t ]*$/.test(parts[i]) || parts[i].includes('<!--')) continue;
        const before = value.slice(0, parts.slice(0, i).join('').length);
        if (openCommentAt(before) >= 0 || before.lastIndexOf('<!--') > before.lastIndexOf('-->')) continue;
        parts[i] = ''; changed = true;
    }
    if (!changed) return value;
    let joined = '';
    for (let i = 0; i < parts.length; i += 2) if (parts[i].trim()) joined += (joined ? (parts[i - 1] || '\n\n') : '') + parts[i];
    return joined;
}
// 2.5.1 끊긴 답: 실리태번은 Gemini(구글 · vertexai) 답을 OpenAI 꼴로 감쌀 때 finishReason 을 버린다 — 안전 필터 · 출력 한도로 답이 문장 중간에서
//   멈춰도(「『남자」) 번역기는 다 온 답으로 받아 그 덩이의 나머지 문단이 사라졌다. 끝난 까닭을 모르니 글로 본다:
//   글자 무게(한글 · 한자 · 가나 = 1, 로마자 = 0.4 — 말이 달라도 번역 전후가 비슷하다: 저장된 번역 1,374문단에서 0.70~1.49)가 원문의 50% 아래이거나,
//   80% 아래이면서 ① 끝 문단이 태그 · 꺾쇠를 연 채 글자로 끝났는데(문장부호 없이) 원문 끝 문단은 닫혀 있거나 ② 문단 수가 원문의 절반 이하이면
//   끊긴 답으로 본다. ①은 무게 30 이상(대사 한 줄도), 나머지는 120 이상인 원문만 본다.
const textWeight = text => {
    const plain = String(text ?? '').replace(HTML_COMMENT, '').replace(/<[^>]*>|\[\[__VAR_\d+__\]\]|⟦\d+⟧/g, '');
    const latin = (plain.match(/\p{Script=Latin}/gu) || []).length, all = (plain.match(/[\p{L}\p{N}]/gu) || []).length;
    return all - latin + latin * 0.4;
};
const INLINE_OPEN = new Set(['span', 'font', 'q', 'b', 'i', 'strong', 'em', 'u', 's', 'del', 'small', 'mark', 'a']);
/** 문단 끝이 열린 채인가 — 글 속 꾸밈 태그가 안 닫혔거나 「 『 “ 가 닫는 짝보다 많은데, 문장부호 · 닫는 괄호 없이 글자로 끝났다 (닫는 태그만 빠뜨린 온전한 번역은 아니다) */
const openEnd = text => {
    const lastPara = String(text ?? '').trim().split(/\n[\t ]*\n/).at(-1) ?? '';
    const stack = [];
    for (const m of lastPara.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
        const tag = m[2].toLowerCase();
        if (!INLINE_OPEN.has(tag) || /\/\s*>$/.test(m[0])) continue;
        if (m[1]) { const k = stack.lastIndexOf(tag); if (k >= 0) stack.splice(k); } else stack.push(tag);
    }
    const more = (a, b) => (lastPara.split(a).length - 1) > (lastPara.split(b).length - 1);
    const midWord = /[\p{L}\p{N}]$/u.test(lastPara.replace(/<[^>]*>|\[\[__VAR_\d+__\]\]/g, '').trimEnd());
    return midWord && (stack.length > 0 || more('「', '」') || more('『', '』') || more('“', '”'));
};
export function looksCutShort(source, output) {
    const src = textWeight(source);
    if (src < 30) return false;
    const ratio = textWeight(output) / src;
    if (ratio >= 0.8) return false;
    if (openEnd(output) && !openEnd(source)) return true;   // 대사 한 줄도 (문장 중간 · 태그 · 꺾쇠가 열린 채)
    if (src < 120) return false;
    if (ratio < 0.5) return true;
    const paragraphs = text => paragraphsOf(String(text ?? '').replace(HTML_COMMENT, '')).length;
    return paragraphs(output) * 2 <= paragraphs(source);
}

/** 5.2.4: 통짜/덩이 번역에서 모델이 문단 사이 빈 줄을 빠뜨리면(한 문단 = 한 줄로 돌려줌) 원문 문단 수와 줄 수가 같을 때만 빈 줄을 되살린다.
 *  문단 묶음 경로는 구분자를 원문에서 가져오므로 해당 없음. 줄 수가 다르면(문단 안 줄바꿈 · 합쳐진 문단) 손대지 않는다. */
export function restoreParagraphBreaks(source, output) {
    // 5.4.1: 통짜 · 덩이 · 평문 재시도 답도 먼저 원문 되풀이(원문+화살표+번역 · ⟦n …] 표시)를 걷는다 — 세 경로가 모두 이 함수를 지난다
    // 6.6.5: 초안 · 모델 혼잣말 · 지어낸 감싸개(<output> …)도 — 초안 줄이 문단 하나로 세어지지 않게 먼저
    const src = String(source ?? ''), out = stripDraftLeaks(removeSourceEcho(src, String(output ?? '')), src);
    const blank = /\n[\t ]*\n/;
    if (!blank.test(src) || blank.test(out)) return out;
    const paragraphs = src.split(/\n[\t ]*\n(?:[\t ]*\n)*/).filter(p => p.trim()).length;
    const lines = out.split('\n');
    if (paragraphs < 2 || lines.length !== paragraphs || lines.some(l => !l.trim())) return out;
    return lines.join('\n\n');
}

// ── 5.6.2 원문 병기 보기(접기 · 원문 먼저 · 펼침)의 블록 마크다운 ──
// 이 보기들은 번역문을 줄마다 <details>/<span> 으로 감싸는데, 줄 머리의 블록 표시(# 제목 · > 인용 · - 목록 · 1. 목록)와 가로줄 · 표까지
// 감싸 버려 마크다운이 풀리고 표시가 글자 그대로 보였다 (커뮤니티 제보). 표시는 감싸개 밖에 두고(splitBlockPrefix), 줄 전체가 구조인 것
// (가로줄 · 제목 밑줄 · 표 · 인용 속 빈 줄)은 감싸지 않는다(structureLines). 판정은 실리태번 마크다운(showdown 2.1) 규칙을 따른다 — 보통 화면과 같은 결과가 나오게:
//  · 목록은 줄 머리 어디서든 시작한다 (빈 줄이 없어도). 맨 바깥에서는 표시 앞 공백이 3칸까지, 열린 목록 안에서는 4칸 · 탭 들여쓰기도 하위 목록이 된다
//  · 제목(#)은 0열에서만 (인용 표시 바로 뒤는 0열), 목록 표시 뒤의 # 는 제목이 아니다. 줄 끝의 닫는 # 들은 떼어 낸다
//  · 열린 목록에서 빈 줄 다음의 들여쓴 줄은 그 항목에 딸린 문단 — 앞 공백을 감싸개 밖에 둬야 목록이 안 끊긴다
const QUOTE_PREFIX = /^(?: {0,3}>[ \t]?)+/, LIST_PREFIX = /^ {0,3}(?:[-+*]|\d{1,9}\.)[ \t]+/, OPEN_LIST_PREFIX = /^[ \t]*(?:[-+*]|\d{1,9}\.)[ \t]+/;
const HEADING_PREFIX = /^#{1,6}[ \t]*(?=[^#\s])/, INDENT_PREFIX = /^[ \t]+/;
/** 줄 머리의 블록 표시와 내용을 나눈다 → { prefix, body, quote, list, indent }. 표시가 없거나 표시 뒤가 비면 prefix 는 '' (줄 그대로).
 *  list: false — 목록 표시는 떼지 않는다 (원문 쪽: 번역문 줄에 목록 표시가 없을 때).
 *  open: true — 목록이 열려 있다: 표시 앞 들여쓰기를 얼마든 받는다 (하위 목록).
 *  continued: true — 열린 목록에서 빈 줄 다음 줄: 표시가 없어도 앞 공백을 prefix 로 뗀다 (항목에 딸린 문단). */
export function splitBlockPrefix(line, { list = true, open = false, continued = false } = {}) {
    const text = String(line ?? '');
    let rest = text;
    const take = pattern => { const hit = pattern.exec(rest)?.[0] ?? ''; rest = rest.slice(hit.length); return hit; };
    const quote = take(QUOTE_PREFIX);
    const marker = list ? take(open && !quote ? OPEN_LIST_PREFIX : LIST_PREFIX) : '';
    const indent = continued && !quote && !marker ? take(INDENT_PREFIX) : '';
    const heading = marker || indent ? '' : take(HEADING_PREFIX);
    if (heading) rest = rest.replace(/[ \t]*#+[ \t]*$/, '');
    const prefix = quote + marker + indent + heading;
    if (!prefix || !rest.trim()) return { prefix: '', body: text, quote: '', list: false, indent: false };
    return { prefix, body: rest, quote, list: !!marker, indent: !!indent };
}

const RULE_LINE = /^ {0,2}(?:(?: ?-){3,}|(?: ?\*){3,}|(?: ?_){3,})[ \t]*$/, UNDERLINE = /^(?:-+|=+)[ \t]*$/, BARE_QUOTE = /^(?: {0,3}>[ \t]?)+[ \t]*$/;
const TABLE_HEAD = /^ {0,3}\|?.+\|.+$/, TABLE_RULE = /^ {0,3}\|?[ \t]*:?[ \t]*[-=]{2,}[ \t]*:?[ \t]*\|[ \t]*:?[ \t]*[-=]{2,}/;
const ONE_COLUMN_ROW = /^ {0,3}\|.+\|[ \t]*$/, ONE_COLUMN_RULE = /^ {0,3}\|[ \t]*:?[ \t]*[-=]{2,}[ \t]*:?[ \t]*\|[ \t]*$/;
const CODE_FENCE = /^\s*`{3,}/;
/** 제목 밑줄(=== · ---)인가 — 문단 글 바로 아래에 오면 그 윗줄을 제목으로 만든다 (새 블록을 여는 줄이 아니다) */
export const isHeadingUnderline = line => UNDERLINE.test(String(line ?? ''));
/** 표시만 있는 인용 줄('>')인가 — 인용 안에서 문단을 나누는 빈 줄 노릇을 한다 (새 블록을 여는 줄이 아니다) */
export const isBareQuote = line => BARE_QUOTE.test(String(line ?? ''));
/** 감싸면 마크다운이 깨지는 '구조 줄'의 번호(Set): 가로줄 · 제목 밑줄 · 표(머리 줄 + 구분 줄 + 빈 줄 전까지, 한 칸짜리 표 포함) · 표시만 있는 인용 줄.
 *  코드 블록 안은 보지 않는다. 원문 · 번역문 양쪽에 같은 판정을 써서 줄 맞춤에서 같이 뺀다 */
export function structureLines(lines) {
    const found = new Set(); let fenced = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i], next = lines[i + 1] ?? '';
        if (CODE_FENCE.test(line)) { fenced = !fenced; continue; }
        if (fenced) continue;
        if (RULE_LINE.test(line) || UNDERLINE.test(line) || BARE_QUOTE.test(line)) { found.add(i); continue; }
        let end = i;
        if (TABLE_HEAD.test(line) && TABLE_RULE.test(next)) while (end < lines.length && lines[end].trim() && !CODE_FENCE.test(lines[end])) found.add(end++);
        else if (ONE_COLUMN_ROW.test(line) && ONE_COLUMN_RULE.test(next)) { found.add(end++); found.add(end++); while (end < lines.length && ONE_COLUMN_ROW.test(lines[end])) found.add(end++); }
        if (end > i) i = end - 1;
    }
    return found;
}
/** 통째 접기(문단 수가 달라 줄마다 못 맞출 때)의 요약 · 본문: 빈 줄로 나뉜 문단마다 <p> 하나. 문단 안 줄바꿈은 <br>.
 *  예전엔 <br><br> 로 이어서 첫 줄 들여쓰기가 첫 문단에만 걸렸다. <p> 면 본문 문단과 같은 규칙(간격 · 들여쓰기 · 대사 조판)이 그대로 걸리고,
 *  번역 기능이나 테마를 꺼도 문단이 붙지 않는다. 줄 중간에 있으므로 마크다운의 블록 처리에 걸리지 않고, 실리태번 정화 뒤에도 summary > p 로 남는다 (격리 서버 확인) */
/** 6.9.6 번역 실패 표시 줄(index.js failMarkOf · BLOCKED_CHUNK_MARK — 「[… — 원문 그대로]」)이 든 글인가. 그런 글은 메시지 · 문단 캐시에 넣지도 쓰지도 않는다 */
const FAIL_LINE = /^\[[^\n]* — 원문 그대로\][ \t]*$/m;
export const hasFailMark = text => typeof text === 'string' && FAIL_LINE.test(text);

export function paragraphBlocks(text) {
    return String(text ?? '').split(/\n[\t ]*\n(?:[\t ]*\n)*/).filter(part => part.trim())
        .map(part => `<p>${part.replace(/^\n+|\n+$/g, '').replace(/\n/g, '<br>')}</p>`).join('');
}

/**
 * 2026-10-06 줄을 넘는 강조(*기울임* · **굵게** · ***둘 다***)를 줄마다 닫고 다시 연다: '*그녀가 걷는다⏎천천히.*' → '*그녀가 걷는다*⏎*천천히.*'.
 * 함께 보기(접기 · 원문 먼저 · 펼침)는 줄마다 따로 감싸서 줄을 넘는 강조 짝이 감싸개 사이에서 끊겨 기울임이 통째로 사라지거나 * 가 글자로 보였다.
 * '사용 안 함' 화면(한 문단 안에서 줄을 넘는 강조 = 두 줄 다 기울임)과 같게 만든다. 줄 수는 그대로라 원문 · 번역문 줄 맞춤이 안 바뀐다.
 * 같은 문단(빈 줄 없이 이어진 줄) 안에서 짝이 맞는 것만 — 짝 없는 * (5 * 3, 목록 표시)는 손대지 않는다. 코드 블록 · `코드` · \* · 태그(<…>)가 든 줄은 건너뛴다.
 */
const EMPH_RUN = /\\\*|`[^`\n]*`|\*{1,3}/g;
const EMPH_INSERT = /^[ \t>]*(?:(?:[-+*]|\d{1,9}\.)[ \t]+)?(?:#{1,6}[ \t]+)?[ \t]*/;
export function splitCrossLineEmphasis(text) {
    const src = String(text ?? '');
    if (!src.includes('*') || !src.includes('\n')) return src;
    const lines = src.split('\n');
    let fence = false, para = [];
    const flush = () => { if (para.length > 1) balanceParagraph(lines, para); para = []; };
    lines.forEach((line, i) => {
        if (CODE_FENCE.test(line)) { flush(); fence = !fence; return; }
        if (fence || !line.trim()) { flush(); return; }
        para.push(i);
    });
    flush();
    return lines.join('\n');
}
function balanceParagraph(lines, idx) {
    const stack = [], spans = [];
    for (let k = 0; k < idx.length; k++) {
        const line = lines[idx[k]];
        if (/[<>]/.test(line.replace(/^[ \t>]*/, ''))) { stack.length = 0; continue; } // 태그 줄: 그 앞뒤로 짝을 잇지 않는다
        EMPH_RUN.lastIndex = 0;
        let m;
        while ((m = EMPH_RUN.exec(line))) {
            const run = m[0];
            if (run[0] !== '*') continue; // \* · `코드`
            const before = line[m.index - 1], after = line[m.index + run.length];
            const canOpen = after !== undefined && !/\s/.test(after);
            const canClose = before !== undefined && !/\s/.test(before);
            const top = stack[stack.length - 1];
            if (top && top.run === run && canClose) { stack.pop(); if (top.k < k) spans.push({ run, from: top.k, to: k, at: top.at }); }
            else if (canOpen) stack.push({ run, k, at: m.index });
        }
    }
    if (!spans.length) return;
    // 줄 경계마다 그 경계를 넘는 강조: 앞 줄 끝에 안쪽부터 닫고, 뒷줄 머리(표시 · 들여쓰기 뒤)에 바깥부터 다시 연다
    for (let k = 0; k < idx.length - 1; k++) {
        const over = spans.filter(s => s.from <= k && k < s.to).sort((a, b) => a.from - b.from || a.at - b.at);
        if (!over.length) continue;
        const open = over.map(s => s.run).join(''), close = over.map(s => s.run).reverse().join('');
        const a = idx[k], b = idx[k + 1];
        lines[a] = lines[a].replace(/[ \t]*$/, (tail) => close + tail);
        const head = EMPH_INSERT.exec(lines[b])[0];
        lines[b] = head + open + lines[b].slice(head.length);
    }
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
const MARK_ALT = /^[ \t]*【\s*(\d+)\s*】[ \t]*[:：]?[ \t]*/; // 모델이 괄호를 바꿔 쓴 답 — 원래 표시가 하나도 없을 때만 (본문의 각주 【1】 과 헷갈리지 않게)
const SQUARE_MARK = /^[ \t]*\[[ \t]*(\d+)[ \t]*\][ \t]*[:：]?[ \t]*/; // 5.4.1: [3] — ⟦ · 【 가 하나도 없을 때 (⟦ 답 안에서는 바로 다음 번호일 때만)
export const BATCH_HEADER = '[Translate every numbered passage below using the translation instructions above. Each passage starts with a marker like ⟦3⟧. Keep every marker exactly as it is at the start of its translated passage, translate the passage after it completely, keep markup and placeholders, and do not merge, split, reorder, add or drop passages. If the translation instructions request annotations, put the references and notes inside their passage after its text. Footnote numbers like [1] or [^1] are not passage markers.]\n\n';
export function batchPayload(bodies) {
    return BATCH_HEADER + bodies.map((text, id) => `⟦${id}⟧ ${text}`).join('\n\n');
}

// 5.3.4: 답에 덧붙은 머리말 · 꼬리 메모. 원문 문단에는 빈 줄이 없으니(segmentParagraphs) 빈 줄 뒤에 따로 붙은 "Note: …" 는 번역이 아니다.
const NOTE_OPEN = String.raw`^[\s>*_(\[（【]*`;
const NOTE_BLOCK = new RegExp(`${NOTE_OPEN}(?:(?:translator'?s?|translation|tl)\\s*notes?|notes?|n\\.b\\.|번역\\s*(?:메모|노트|참고|주석)|역주|참고|주석|訳注|注|備考)\\s*[)\\]】）*_]*\\s*[:：]|${NOTE_OPEN}※`, 'i');
// 5.3.6: 문단 수가 원문과 같아도 걷는 '분명한' 번역 메모 (이야기 글에 나올 일이 없는 머리)
const STRONG_NOTE = new RegExp(`${NOTE_OPEN}(?:(?:translator'?s?|translation|tl)\\s*notes?|번역\\s*(?:메모|노트|참고|주석)|역주|訳注)\\s*[)\\]】）*_]*\\s*[:：]`, 'i');
const RULE_BLOCK = /^[\t ]*(?:-{3,}|\*{3,}|_{3,})[\t ]*$/;
// 5.3.6: '번역' 을 말하는 순수 머리말만 (예전엔 "Okay, here is what we do:" 같은 이야기 줄도 걷었다)
const PREAMBLE_BLOCK = new RegExp('^(?:' + [
    String.raw`(?:(?:okay|ok|sure|certainly|of course|alright)[,!.]?\s+)?(?:here(?:'s| is| are)|below is|the following is)\s+(?:[\w-]+\s+){0,4}translat(?:ion|ed)\b[^\n:：]{0,60}`,
    String.raw`(?:[a-z]+\s+)?translation(?:\s*\([^)\n]{0,30}\))?`,
    String.raw`(?:한국어\s*|영어\s*|일본어\s*)?번역(?:문|본|\s*결과)?(?:\s*\([^)\n]{0,30}\))?(?:입니다|이에요|예요)?`,
    String.raw`(?:다음은|아래는|여기)[^\n]{0,40}번역[^\n]{0,30}`,
].join('|') + ')\\s*[:：]\\s*$', 'i');
const paragraphsOf = text => String(text ?? '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n(?:[\t ]*\n)*/).map(p => p.trim()).filter(Boolean);
/** 덩이가 번역 메모인가 — 맨 위의 구분선(---, ***, ___) 줄은 건너뛰고 본다 ("---\nNote: …") */
const noteBlock = (block, pattern = NOTE_BLOCK) => {
    const lines = block.split('\n');
    while (lines.length && (!lines[0].trim() || RULE_BLOCK.test(lines[0]))) lines.shift();
    return lines.length > 0 && pattern.test(lines.join('\n'));
};
// 5.3.7: 원문 없이 볼 때(견줄 게 없을 때) ※ 줄은 번역 이야기를 할 때만 메모로 본다 — "[상태창]\n***\n※ 호감도 +5" 같은 상태창이 흔하다
const META_WORDS = /번역|역주|원문|translat|original|\bTL\b|訳|原文|翻译|翻譯/i;
const MARK_LINE = /^[\s>*_(\[（【]*※/;
const noteNoSource = block => noteBlock(block) && (!noteBlock(block, new RegExp(`${NOTE_OPEN}※`)) || META_WORDS.test(block));
/** 원문 문단이 메모 · 상태창 꼴을 품었나 — 메모 꼴 덩이, 아무 줄이나 메모 머리(※ · 참고: · Note: …), 또는 구분선 밑에 내용이 있음 */
const noteLike = block => noteBlock(block) || block.split('\n').some(line => NOTE_BLOCK.test(line) || MARK_LINE.test(line)) ||
    /(?:^|\n)[\t ]*(?:-{3,}|\*{3,}|_{3,})[\t ]*\n[\s\S]*\S/.test(block);
/** 5.3.6: 맨 끝 덩이가 번역 메모일 때만 (그 앞 구분선과 함께) 걷는다. 가운데 문단이 ※ · 참고: 로 시작해도 뒤를 버리지 않는다.
 *  source 를 주면 견준다: 문단 수가 원문과 같으면 '분명한' 메모(Translator's note · 역주 …)만 걷는다.
 *  5.3.7: 원문 끝 문단에 짝이 되는 덩이(메모 꼴 · ※ 줄 · 구분선 밑 내용 = 상태창)가 있으면 그 번역이니 걷지 않는다 —
 *         원문에 없는 '분명한' 메모가 문단 수보다 더 붙었을 때만 걷는다. 원문이 없으면 ※ 줄은 번역 이야기일 때만 메모로 본다.
 *  첫 덩이는 건드리지 않는다. 마지막 덩이 안에서 본문 바로 밑에 붙은 "---\nNote: …" 도 (원문에 그런 꼴이 없을 때만) 걷는다. */
export function stripTrailingNote(text, source) {
    const protectedNotes = maskTranslatorNotes(text);
    if (protectedNotes.changed) return protectedNotes.restore(stripTrailingNote(protectedNotes.text, source));
    const blocks = String(text ?? '').split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    const src = source == null ? null : paragraphsOf(source);
    const srcTail = Boolean(src?.length) && noteLike(src.at(-1));
    const srcStrong = Boolean(src) && src.some(p => p.split('\n').some(line => STRONG_NOTE.test(line)));
    const count = () => blocks.filter((b, i) => i % 2 === 0 && b.trim()).length;
    const weak = src ? noteBlock : noteNoSource;
    let stripped = false;
    while (blocks.length >= 3) {
        const last = blocks.at(-1);
        if (!last.trim() || (stripped && RULE_BLOCK.test(last))) { blocks.splice(-2); continue; }
        const strong = noteBlock(last, STRONG_NOTE) && !srcStrong;
        const cut = srcTail ? strong && count() > src.length
            : strong || (/^\s*(?:-{3,}|\*{3,}|_{3,})[\t ]*\n/.test(last) && weak(last)) || (weak(last) && (!src || count() !== src.length));
        if (!cut) break;
        blocks.splice(-2); stripped = true;
    }
    // 빈 줄 없이 붙은 "본문\n---\nNote: …" — 구분선이 있을 때만 (구분선 없는 "Note:" 줄은 본문일 수 있다) · 원문 끝 문단에 짝이 있으면 두지 않는다
    const last = blocks.at(-1), rule = /\n[\t ]*(?:-{3,}|\*{3,}|_{3,})[\t ]*\n/.exec(last);
    const tail = rule && last.slice(rule.index + 1);
    if (rule && last.slice(0, rule.index).trim() && (srcTail ? noteBlock(tail, STRONG_NOTE) && !srcStrong : weak(tail))) {
        blocks[blocks.length - 1] = last.slice(0, rule.index);
        stripped = true;
    }
    return stripped ? blocks.join('').replace(/\s+$/, '') : blocks.join('');
}
// 6.5.3 번역 모델의 작업 메모 (사용자 10-15): 답 가운데에 「她 → 그녀. Kaito uses っす speech → Korean casual-polite … I'll use 해요체 …
//   The inner thoughts (VAR_0..3) … keep as is.」 같은 계획 문단 · 줄이 섞여 번역문에 그대로 보였다. 화살표가 있고, 라틴 글자가 반 넘고,
//   말투 · 번역 이야기 낱말이 둘 이상(또는 하나 + 한국어 말투 이름)인 덩이 · 줄만 걷는다 — 원문에 같은 꼴(화살표 + 그런 낱말)이 있으면 두지 않는다.
const PLAN_ARROW = /→|⇒|->|=>/;
const PLAN_WORDS = /\b(?:speech|speaks?|style|tone|polite|casual|honorifics?|formal|register|slang|keep (?:it |them )?as[- ]is|I'll|I will|translat(?:e|ed|es|ion|ing)|render(?:ed|ing)?|inner thoughts?|monologue|placeholders?|VAR_\d|in source|the source)\b/gi;
const KO_REGISTER = /해요체|하십시오체|합쇼체|반말|존댓말|존대|높임말/;
const planHits = text => (String(text).match(PLAN_WORDS) || []).length;
const planLike = text => PLAN_ARROW.test(text) && (planHits(text) >= 2 || (planHits(text) >= 1 && KO_REGISTER.test(text)));
// 2.6.8 작업 메모 줄 셋 더 (사용자 10-16 — 문단 사이에 「…sounded… translate.」 · 「… → 해요체 / 합쇼체 mix.」 · 「Keep spans and placeholders.」 가 보였고,
//       영어 남은 줄 다시 번역이 말투 메모를 「… → 해요체 / 합쇼체 혼용. … → 반말 속마음.」 한국어 메모로 바꿔 놓았다). 번역문이 라틴 글자가 아니고 원문에 같은 글이 없을 때만:
//   ① 반쪽 원문 + 「… translate.」 꼬리 — 꼬리 앞이 원문 글 그대로(라틴)인 줄
//   ② 지시문 되풀이 — 「Keep spans and placeholders.」 · 「Preserve the tags as-is.」 처럼 keep · preserve · don't translate … + 태그 · 자리표시 · 서식 낱말인 라틴 줄
//   ③ 한국어로 옮겨진 말투 메모 — 화살표 + 말투 이름(해요체 · 반말 …) + 번역 이야기 낱말(속마음 · 독백 · 어미 · 일인칭 · 혼용 · VAR …). 원문에 같은 꼴이 있으면 두지 않는다
const STUB_TAIL = /^(.{6,}?)[ \t]*(?:…+|\.{3,}|[—–]+)[ \t]*\(?[ \t]*(?:translate|translation|translating)[ \t]*[.:：!)]?[ \t]*$/i;
const INSTRUCTION_ECHO = /^[\s>*_(\[-]*(?:please\s+)?(?:keep|preserve|maintain|retain|leave|don'?t\s+(?:translate|change|touch|alter)|do\s+not\s+(?:translate|change|touch|alter))\b[^\n]{0,120}?\b(?:spans?|tags?|placeholders?|markup|format(?:ting)?|html|brackets?|VAR(?:_\d+)?|line\s*breaks?|structure|as[- ]is|unchanged|intact)\b[^\n]{0,60}$/i;
const KO_PLAN_WORDS = /속마음|독백|어미|일인칭|1인칭|이인칭|2인칭|말투|어조|혼용|평서형|경어|VAR|자리\s?표시|번역/g;
const latinMostly = text => { const letters = (String(text).match(/\p{L}/gu) || []).length, latin = (String(text).match(/\p{Script=Latin}/gu) || []).length; return latin >= 3 && latin >= letters * 0.6; };
/** ③ 화살표 + 말투 이름 + 번역 이야기 낱말 두 가지 이상 · 대사 괄호(「」 · 『』 · “” · "") 밖 — 이야기 속 「존댓말 → 반말로 말투 바꿔도 돼?」 는 두다 */
const koPlanLike = text => PLAN_ARROW.test(text) && KO_REGISTER.test(text) && new Set(String(text).match(KO_PLAN_WORDS) || []).size >= 2 && !/[「『“"]/.test(text);
/** 번역문이 한국어 · 일본어 같은 비라틴 글인가 — 글 전체의 갈래로 보면 짧은 문단 + 긴 영어 메모(문단 묶음 한 칸)가 라틴으로 세어진다. 비라틴 글자가 8자 이상 · 글자의 1/5 이상이면 */
const foreignOut = text => {
    const plain = String(text).replace(/<[^>]*>/g, ''), letters = (plain.match(/\p{L}/gu) || []).length;
    const other = (plain.match(/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Thai}\p{Script=Arabic}]/gu) || []).length;
    return other >= 8 && other >= letters * 0.2;
};
// 2.6.9 자리표시 · 서식 지키기 메모 (사용자 10-16 — 대사 뒤에 「부분 앞뒤 placeholder 유지.」 가 붙어 보였다: 모델이 감싸개 자리표시를 빠뜨리고 메모를 붙임).
//       번역 작업 낱말(placeholder · 자리표시자 · VAR · span · 마크업 …) + 지키기 낱말(유지 · 그대로 · keep …) · 대사 괄호 없음 — 줄(120자 안)은 통째로, 닫는 괄호 · 문장 끝 뒤 꼬리(80자 안)는 꼬리만
const FORMAT_WORD = /placeholders?|플레이스\s?홀더|자리\s?표시자|\bVAR(?:_\d+)?\b|\bspans?\b|마크업|\bmarkup\b|\bhtml\b/i;
const KEEP_WORD = /유지|보존|그대로|\bkeep\b|\bpreserve\b|\bretain\b|\bintact\b|\bas[- ]is\b|\bunchanged\b/i;
const formatNote = text => FORMAT_WORD.test(text) && KEEP_WORD.test(text) && !/[「」『』“”"]/.test(text);
const NOTE_TAIL = /(?<=[」』"”.!?。！？)\]~…])[ \t]+([^\n「」『』“”"]{2,80})$/;
/** 2.6.9 줄 끝 꼬리 메모를 뗀 줄 (없으면 그대로) */
function cutFormatTail(line, { srcKey }) {
    const m = NOTE_TAIL.exec(line);
    if (!m || !formatNote(m[1])) return line;
    const key = echoKey(m[1]), head = line.slice(0, m.index);
    if (!key || srcKey.includes(key) || !NON_LATIN_LETTER.test(head.replace(/<[^>]*>/g, ''))) return line;
    return head.replace(/[ \t]+$/, '');
}
/** 2.6.8 ①②③ (+ 2.6.9 서식 메모 줄) — line 은 태그를 뺀 줄, ctx = { srcKey, sourceKoPlan } */
function metaLine(line, { srcKey, sourceKoPlan }) {
    const key = echoKey(line);
    if (!key || srcKey.includes(key)) return false;
    if (line.length <= 120 && formatNote(line)) return true;
    const stub = STUB_TAIL.exec(line);
    if (stub && latinMostly(stub[1])) { const head = echoKey(stub[1]); if (head.length >= 8 && srcKey.includes(head)) return true; }
    if (line.length <= 200 && latinMostly(line) && INSTRUCTION_ECHO.test(line)) return true;
    return !sourceKoPlan && line.length <= 800 && koPlanLike(line);
}
function planningNote(block, sourcePlan) {
    const t = String(block ?? '').trim();
    if (!t || t.length > 800 || sourcePlan || !planLike(t)) return false;
    const letters = (t.match(/\p{L}/gu) || []).length, latin = (t.match(/\p{Script=Latin}/gu) || []).length;
    return letters > 0 && latin >= letters * 0.5;
}
/** 답에서 번역 모델의 작업 메모(계획 덩이 · 줄)를 걷는다. 걷을 게 없거나 걷으면 아무것도 안 남으면 같은 글 */
export function stripPlanningNotes(text, source) {
    const protectedNotes = maskTranslatorNotes(text);
    if (protectedNotes.changed) return protectedNotes.restore(stripPlanningNotes(protectedNotes.text, source));
    const out = String(text ?? '');
    if (!PLAN_ARROW.test(out) && !/translat|keep|preserve|maintain|retain|leave|don'?t|do not|placeholder|플레이스|자리\s?표시자|VAR|span|마크업|markup|html/i.test(out)) return out;
    const sourcePlan = source != null && planLike(String(source));
    // 2.6.8 ①②③ 은 원문과 견준다 — 원문이 없거나 번역문이 라틴 글자(영어로 옮김)면 예전 규칙만
    const extra = source != null && foreignOut(out)
        ? { srcKey: echoKey(String(source)), sourceKoPlan: koPlanLike(String(source)) } : null;
    const blocks = out.split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    let changed = false;
    for (let i = 0; i < blocks.length; i += 2) {
        const lines = blocks[i].split('\n');
        // 줄마다 본다 — 덩이 통째로 보면 메모 밑에 붙은 번역 줄까지 메모 덩이로 세어진다. 한 줄 덩이도 같은 규칙
        let kept = lines.filter(line => !planningNote(line, sourcePlan) && !(extra && metaLine(line.replace(/<[^>]*>/g, '').trim(), extra)));
        if (extra) kept = kept.map(line => cutFormatTail(line, extra));   // 2.6.9 줄 끝 서식 메모 꼬리
        if (kept.length === lines.length && kept.every((line, n) => line === lines[n])) continue;
        blocks[i] = kept.some(line => line.trim()) ? kept.join('\n') : '';
        changed = true;
    }
    if (!changed) return out;
    let joined = '';
    for (let i = 0; i < blocks.length; i += 2) {
        if (!blocks[i].trim()) continue;
        joined += (joined ? (blocks[i - 1] || '\n\n') : '') + (joined ? blocks[i] : blocks[i].replace(/^\n+/, ''));
    }
    return joined.trim() ? joined : out;
}
/** 평문 답: 앞의 "Here is the translation:" 같은 한 줄 머리말과 꼬리 메모를 걷는다 (머리말이 문단 하나로 세어져 자리가 밀리지 않게).
 *  5.3.6: source(보낸 원문)를 주면 견준다 — 원문 첫 문단이 같은 꼴이면 머리말로 보지 않고, 꼬리 메모는 stripTrailingNote 규칙대로. */
export function stripReplyWrapping(text, source) {
    const protectedNotes = maskTranslatorNotes(text);
    if (protectedNotes.changed) return protectedNotes.restore(stripReplyWrapping(protectedNotes.text, source));
    let out = stripPlanningNotes(String(text ?? '').replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, ''), source).trim();   // 6.5.3 작업 메모
    const first = /^([^\n]*)\n[\t ]*\n/.exec(out);
    const srcFirst = source == null ? '' : paragraphsOf(source)[0] ?? '';
    if (first && PREAMBLE_BLOCK.test(first[1].trim()) && !PREAMBLE_BLOCK.test(srcFirst)) out = out.slice(first[0].length).replace(/^\s*\n/, '');
    out = stripTrailingNote(out, source).trim();
    return source == null ? out : stripDraftLeaks(removeSourceEcho(source, out).trim(), source).trim(); // 5.4.1 · 6.6.5 초안 · 감싸개
}

// 6.6.5 번역 모델의 초안 · 혼잣말 · 감싸개 (사용자 제보 10-15): 답 가운데에
//   「쳐다보는 그녀의 정수리가 카운터 너머로 들썩이는 걸」 — let me write properly.⏎⏎<output>⏎<진짜 번역></output>
//   처럼 초안 줄 + 영어 혼잣말 꼬리를 남기고, 다시 쓴 문단을 지어낸 <output> 태그로 감싸 보냈다. 그대로 붙어 초안 · 영어가 보였고
//   <output> 요소가 문단을 깨뜨려 다음 대사 앞 간격 · 들여쓰기가 사라졌다. 원문과 견줘 걷는다 —
//   ① 원문에 없는 감싸개 태그(<output> · <translation> · <result> · <answer> · <korean> …)와 코드 펜스는 벗긴다 (내용은 둔다)
//   ② 번역문이 라틴 글자가 아닐 때(한국어 · 일본어 …) 라틴 글자뿐인 모델 메모 줄 · 줄 끝 꼬리(— let me … · Wait, … · (Note: …))를 걷는다. 원문에 같은 글이 있으면 둔다
//   ③ 꼬리를 걷은 초안 줄 바로 뒤에 감싼(또는 거의 같은) 문단이 오면 초안은 버리고 그 문단만 둔다. 꼬리 없는 초안 덩이는 답 덩이가 원문 문단보다 많을 때만
//   자리표시자 · 그림 자리(bl-asset-slot) · 태그는 원문에 있는 수만큼 남는 경우에만 버린다. 걷을 게 없으면 같은 글을 돌려준다.
const WRAP_NAMES = ['output', 'outputs', 'translation', 'translated', 'translated_text', 'translation_result', 'result', 'answer', 'final', 'final_answer', 'final_output', 'final_translation', 'response', 'korean', 'ko', 'kr', 'target', 'target_text'];
const WRAP_FENCE = /^[ \t]*`{3,}[\w-]*[ \t]*$/;
const META_PHRASE = String.raw`(?:let me\b|let'?s (?:try|redo|re-?write|fix|write|translate|start|do (?:it|this|that))\b|wait[,.!…]|wait\s*$|actually[,.]|hmm+\b|oops\b|scratch that|on second thought|no,? (?:that'?s|wait)\b|i(?:'ll| will| should| need to| must| meant| think i)\s+(?:re-?write|re-?do|re-?try|fix|translate|write|use|keep|go with|output|revise|correct|rephrase|make)\b|(?:re-?write|re-?do|re-?try|re-?translat\w*|revis(?:e|ed|ion)|correct(?:ed|ion)|draft|final(?: version| answer| output| translation)?|better(?: version| translation)?|proper(?: version| translation)?|cleaner(?: version)?|polished(?: version)?)\s*[:：]|here(?:'s| is| are)\s+(?:the |my |a )?(?:[\w-]+\s+){0,2}(?:translation|version|output|rendering|rewrite)\b|(?:translator'?s?\s+|tl\s+)?note\s*[:：]|(?:translate|translation)\s*[.:：!]?\s*$)`;
// 2.5.3 반쪽 문단 끝에 붙는 맨 「translate.」 · 「Translation:」 꼬리 — 이 꼬리일 때만 그 한 줄을 통째로 버린다 (stripDraftLeaks ③ 앞)
const BARE_TRANSLATE_TAIL = /^\(?[ \t]*(?:translate|translation)[ \t]*[.:：!]?[ \t]*$/i;
const META_LINE = new RegExp(String.raw`^[\s>*_\-—–(\[]*${META_PHRASE}`, 'i');
const META_TAIL = new RegExp(String.raw`(?:[ \t]*(?:[—–]+|-{1,2}|…+|\.{3})[ \t]*|(?<=[.!?。！？」』"”)\]>~*])[ \t]+)(\(?[ \t]*${META_PHRASE}[^\n]*)$`, 'i');
const NON_LATIN_LETTER = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Thai}\p{Script=Arabic}]/u;
const KEEP_TOKEN = /\[\[__VAR_\d+__\]\]|__MASK_[A-Z]+_\d+__|<span class="bl-asset-slot"[^>]*><\/span>|<[a-z][\w-]*/gi;
const tokenCounts = text => {
    const counts = new Map();
    for (const token of String(text).match(KEEP_TOKEN) || []) { const key = token.toLowerCase(); counts.set(key, (counts.get(key) || 0) + 1); }
    return counts;
};
const bigrams = key => { const set = new Set(); for (let i = 0; i < key.length - 1; i++) set.add(key.slice(i, i + 2)); return set; };
/** a 의 글자 짝(두 글자)이 b 에 얼마나 들어 있나 (0~1) — 초안과 다시 쓴 문단 견주기 */
const containment = (a, b) => {
    const left = bigrams(echoKey(a)), right = bigrams(echoKey(b));
    if (!left.size) return 0;
    let hit = 0;
    for (const pair of left) if (right.has(pair)) hit++;
    return hit / left.size;
};
/** 라틴 글자가 대부분인 메모인가 ("(Note: 他 → 그)" 처럼 원문 글자를 몇 자 품을 수 있다) — 원문에 같은 글이 있으면 아니다 */
const latinMeta = (text, srcKey) => {
    const plain = String(text).replace(/<[^>]*>/g, '');
    const latin = (plain.match(/\p{Script=Latin}/gu) || []).length, letters = (plain.match(/\p{L}/gu) || []).length;
    if (latin < 3 || latin < letters * 0.6) return false;
    const key = echoKey(plain);
    return key.length > 0 && !srcKey.includes(key);
};
// 2.6.4 생각 블록 · 메모 태그 (사용자 10-16 「<think>Rex uses casual-polite → Korean 해요체 …</think>렉스는 …」 처럼 말투 메모가 문단 앞에 붙어 보였다).
//       원문에 그 태그가 없을 때만. 낯선 태그(원문에 없고 HTML · 감정 태그가 아닌 이름)는 안이 원문에 없는 영어 메모일 때만 걷는다.
const THINK_NAMES = ['think', 'thinking', 'thought', 'reasoning', 'analysis', 'scratchpad', 'reflection', 'plan', 'planning', 'notes', 'note', 'translator_note', 'translation_note', 'tl_note', 'comment', 'meta'];
const HTML_NAMES = new Set('a abbr b bdi bdo blockquote br caption cite code col colgroup dd del details dfn div dl dt em figcaption figure font h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre q rp rt ruby s samp section small span strong style sub summary sup table tbody td tfoot th thead time tr u ul var wbr center big tt strike'.split(' '));
function stripThinkBlocks(out, src) {
    const lowSrc = src.toLowerCase();
    let text = out;
    for (const name of THINK_NAMES) {
        if (lowSrc.includes(`<${name}`)) continue;
        const pair = new RegExp(String.raw`[ \t]*<${name}\b[^>]*>[\s\S]*?<\/${name}\s*>[ \t]*\n?`, 'gi');
        text = text.replace(pair, '');
        const open = new RegExp(String.raw`^\s*<${name}\b[^>]*>[\s\S]*?(?=\n[ \t]*\n|$)`, 'i');   // 닫히지 않은 첫머리 생각 블록은 그 문단까지
        if (open.test(text) && !new RegExp(String.raw`<\/${name}\s*>`, 'i').test(text)) text = text.replace(open, '');
    }
    const srcKey = echoKey(src);
    text = text.replace(/[ \t]*<([a-z][\w-]*)\b[^>]*>([^<]{12,600})<\/\1\s*>[ \t]*\n?/gi, (whole, name, inner) => {
        const n = name.toLowerCase();
        if (HTML_NAMES.has(n) || lowSrc.includes(`<${n}`)) return whole;
        const latin = (inner.match(/\p{Script=Latin}/gu) || []).length, letters = (inner.match(/\p{L}/gu) || []).length;
        if (latin < 12 || latin < letters * 0.6) return whole;
        const key = echoKey(inner);
        return key && !srcKey.includes(key) ? '' : whole;
    });
    return text;
}
export function stripDraftLeaks(text, source) {
    const protectedNotes = maskTranslatorNotes(text);
    if (protectedNotes.changed) return protectedNotes.restore(stripDraftLeaks(protectedNotes.text, source));
    let out = String(text ?? '');
    if (source == null || !out.trim()) return out;
    const src = String(source), srcKey = echoKey(src);
    { const cleaned = stripThinkBlocks(out, src); if (cleaned !== out && cleaned.trim()) out = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^[ \t]*\n+/, ''); }
    { const cleaned = stripPlanningNotes(out, src); if (cleaned !== out && cleaned.trim()) out = cleaned; }   // 2.6.8 작업 메모 줄도 (모든 길 · 저장된 번역 그리기)
    const names = WRAP_NAMES.filter(name => !new RegExp(String.raw`<\/?${name}(?![\w-])`, 'i').test(src));
    const wrapTag = names.length ? new RegExp(String.raw`<(\/?)(?:${names.join('|')})(?:\s[^<>\n]*)?>`, 'gi') : null;
    const fences = !/`{3,}/.test(src);
    const parts = out.split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    const blocks = [];
    let carry = false, changed = false;
    // ① 감싸개 벗기기 — 여는 태그가 있던 덩이(태그만 있던 덩이면 다음 덩이)를 '감싼 덩이' 로 적어 둔다
    for (let i = 0; i < parts.length; i += 2) {
        let body = parts[i], wrapped = carry;
        if (wrapTag && wrapTag.test(body)) {
            wrapTag.lastIndex = 0;
            if (/<(?!\/)/.test(body.match(wrapTag).join(''))) wrapped = true;
            body = body.replace(wrapTag, '');
        }
        if (fences && body.split('\n').some(line => WRAP_FENCE.test(line))) {
            if (WRAP_FENCE.test(body.split('\n').find(line => line.trim()) ?? '')) wrapped = true;
            body = body.split('\n').filter(line => !WRAP_FENCE.test(line)).join('\n');
        }
        if (body !== parts[i]) { changed = true; body = body.replace(/^[\t ]*\n+/, '').replace(/\n[\t ]*$/, ''); }
        carry = !body.trim() && wrapped;
        blocks.push({ body, sep: parts[i - 1] ?? '', wrapped: wrapped && !!body.trim(), draft: false });
    }
    // ② 모델 메모 줄 · 꼬리 (번역문이 라틴 글자가 아닐 때만)
    const nonLatin = scriptOf(echoKey(out.replace(/<[^>]*>/g, ''))) !== 'latin';
    if (nonLatin) for (const block of blocks) {
        if (!block.body.trim()) continue;
        const lines = block.body.split('\n'), kept = [];
        for (const line of lines) {
            const bare = line.replace(/<[^>]*>/g, '').trim();
            if (bare.length <= 400 && META_LINE.test(bare) && latinMeta(bare, srcKey)) { changed = true; continue; }
            const tail = META_TAIL.exec(line);
            if (tail && NON_LATIN_LETTER.test(line.slice(0, tail.index)) && latinMeta(tail[1], srcKey)) {
                kept.push(line.slice(0, tail.index).replace(/[ \t]+$/, ''));
                block.draft = kept.length - 1; block.tail = tail[1]; changed = true; continue;
            }
            kept.push(line);
        }
        block.body = kept.join('\n');
    }
    // ③ 초안 + 다시 쓴 문단 → 다시 쓴 문단만
    const content = () => blocks.filter(b => b.body.trim());
    const srcCount = paragraphsOf(src).length, need = tokenCounts(src);
    const safeDrop = removed => {
        const rest = tokenCounts(content().map(b => b.body).join('\n\n').replace(removed, ''));
        for (const [token] of tokenCounts(removed)) if ((rest.get(token) || 0) < (need.get(token) || 0)) return false;
        return true;
    };
    // 2.5.3 원문에 없는 반쪽 문단 — 「서류 처리용 영혼 판정 파일 더미... translate.」 처럼 옮기다 만 한 줄 + 혼잣말 꼬리.
    //       문단 수가 원문보다 많을 때만, 지켜야 할 태그 · 자리표시를 품지 않았을 때만 버린다.
    //       6.7.5 꼬리가 맨 translate · translation 일 때만 — 전엔 Note: · Hmm · let me 꼬리가 붙은 정상 문장도 (모델이 문단을 둘로 나눠 문단 수가 많으면) 줄째 지웠다
    for (const block of content()) {
        if (block.draft === 0 && BARE_TRANSLATE_TAIL.test(block.tail ?? '') && !block.body.includes('\n') && content().length > srcCount && safeDrop(block.body)) { block.body = ''; changed = true; }
    }
    const live = content();
    for (let n = 0; n < live.length - 1; n++) {
        const block = live[n], next = live[n + 1];
        if (block.draft !== false) {
            const lines = block.body.split('\n'), draft = lines[block.draft];
            if (block.draft !== lines.length - 1 || !draft.trim()) continue;
            if ((next.wrapped || containment(draft, next.body) >= 0.5) && containment(draft, next.body) >= 0.3 && safeDrop(draft)) {
                lines.splice(block.draft, 1); block.body = lines.join('\n').replace(/\n+$/, ''); changed = true;
            }
        } else if (next.wrapped && !block.wrapped && content().length > srcCount && containment(block.body, next.body) >= 0.6 && safeDrop(block.body)) {
            block.body = ''; changed = true;
        }
    }
    if (!changed) return out;
    let joined = '';
    for (const block of blocks) {
        if (!block.body.trim()) continue;
        joined += joined ? (block.sep || '\n\n') + block.body : block.body.replace(/^\n+/, '');
    }
    return joined.trim() ? joined : out;
}

// 5.4.1: 원문 되풀이(에코). 모델이 "⟦1 Vere] <원문 문단 그대로>\n->\n\n<번역>" 처럼 원문을 베껴 쓰고 화살표 · 빈 줄 뒤에 번역을 붙인 답을
//        그대로 붙이고 문단 캐시 · 메시지 캐시에 넣어, 다시 번역해도 같은 영어+한국어가 나왔다.
//        견주기는 글자 · 숫자만 (태그 · 자리표시 · 문장부호 · 띄어쓰기 · 대소문자 무시) — 따옴표나 띄어쓰기만 바꿔 베낀 것도 잡는다.
const ECHO_ARROW = String.raw`(?:-{1,2}>|=>|→|⇒|⟶|➔|➜)`;
const ECHO_CUT = new RegExp(String.raw`\n|[ \t]*${ECHO_ARROW}`, 'g');
const ECHO_HEAD = new RegExp(String.raw`^\s*(?:${ECHO_ARROW}\s*)?`);
const ECHO_ARROW_HEAD = new RegExp(String.raw`^\s*${ECHO_ARROW}`);
/** 모양이 망가진 번호 표시 ⟦1 Vere] · ⟦1] · ⟦ 1 ⟧ · 닫는 괄호 없는 ⟦1 — ⟦ 는 본문에 나올 일이 없다 (묶음 요청에서만 붙인다) */
const LOOSE_MARK = /^[ \t]*⟦[ \t]*(\d+)(?!\d)(?:[^⟧\]\[\n]{0,40}?[⟧\]])?[ \t]*[:：]?[ \t]*/;
const LOOSE_MARK_LINES = new RegExp(LOOSE_MARK.source.replace('^[ \\t]*', '^([ \\t]*)'), 'gm');
// [2.3.1] 같은 글의 키는 한 번만 만든다 — 답 끝 hasSourceEcho 가 번역 덩이 × 원문 문단마다 같은 문단 · 문장을 거듭 정규화했다 (폰 리그 4배 45 ms).
//         글 자체를 열쇠로 기억하므로(글이 바뀌면 다른 칸) 결과는 늘 같고, 지금 도는 일이 끝나면(다음 마이크로태스크) 비워 오래 들고 있지 않는다.
const echoKeys = new Map();
const echoKey = text => {
    const s = String(text ?? '');
    let key = echoKeys.get(s);
    if (key !== undefined) return key;
    key = s.normalize('NFKC').replace(/<[^>]*>|\[\[__VAR_\d+__\]\]/g, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
    if (!echoKeys.size) queueMicrotask(() => echoKeys.clear());
    if (echoKeys.size < 4096) echoKeys.set(s, key);
    return key;
};
const SCRIPTS = [['hangul', /\p{Script=Hangul}/gu], ['cjk', /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu], ['latin', /\p{Script=Latin}/gu], ['cyrillic', /\p{Script=Cyrillic}/gu]];
/** 가장 많은 글자 갈래 (원문 언어 ≠ 번역 언어인지 가늠 — 번역 언어를 몰라도 된다) */
const scriptOf = key => {
    let best = '', most = 0;
    for (const [name, pattern] of SCRIPTS) { const n = (key.match(pattern) || []).length; if (n > most) { best = name; most = n; } }
    return best;
};
/** 5.4.2: 태그 · 자리표시 뼈대. 원문 문단을 그대로 둔 번역(맨 위 <tracker> 줄) 뒤에 태그가 다른 번역 문단이 오면 되풀이가 아니다 —
 *  5.4.1 은 다른 문단이 빈 줄로 갈라져 덩이가 하나 늘면 <tracker> 줄을 되풀이로 보고 걷었고, 메시지 캐시에도 넣지 않았다 */
const skeletonOf = text => (String(text ?? '').match(/<\/?[a-z][\w-]*|\[\[__VAR_\d+__\]\]/gi) || []).join(' ').toLowerCase();
/** 덩이 앞머리가 원문 문단 하나를 통째로 베낀 것이면(뒤에 화살표, 또는 줄바꿈 뒤 다른 글자의 번역) 번역만 돌려준다.
 *  원문+화살표뿐이면 '' (그 덩이를 뺀다), 해당 없으면 null. keys: 원문 문단 키 모음 */
function cutEcho(block, keys, longest, sources) {
    for (const cut of block.matchAll(ECHO_CUT)) {
        const head = echoKey(block.slice(0, cut.index));
        if (head.length > longest) break;
        if (head.length < 12 || !keys.has(head)) continue;
        const tail = block.slice(cut.index), arrow = ECHO_ARROW_HEAD.test(tail);
        const rest = tail.replace(ECHO_HEAD, ''), restKey = echoKey(rest);
        // 2.5.1 원문 문단이 원래 화살표로 끝났다면(주석 뒤 조각 「…结果) -->」) 번역하지 않고 둔 그 문단이지 원문+화살표가 아니다
        if (!restKey && arrow && sources?.has(block.trim())) return null;
        if (!restKey) return arrow && !rest.trim() ? '' : null; // 원문+화살표뿐인 덩이만 뺀다 (화살표 뒤 태그만 남는 "A → B → `<prose>`" 는 원문 그대로)
        if (arrow || (head.length >= 20 && !keys.has(restKey) && scriptOf(restKey) !== scriptOf(head) && skeletonOf(block.slice(0, cut.index)) === skeletonOf(rest))) return rest;
        return null;
    }
    return null;
}
/** 5.4.1: 답에서 원문 되풀이를 걷는다 — 줄머리의 모양 망가진 ⟦n …] 표시(원문에 ⟦ 가 없을 때), 원문 문단+화살표+번역의 앞 원문,
 *  원문 문단 그대로인 덩이+빈 줄+다른 글자의 번역 (답 덩이가 원문 문단보다 많을 때 넘친 수만큼만). 걷을 게 없으면 같은 글을 돌려준다. */
export function removeSourceEcho(source, output) {
    const protectedNotes = maskTranslatorNotes(output);
    if (protectedNotes.changed) return protectedNotes.restore(removeSourceEcho(source, protectedNotes.text));
    const src = String(source ?? ''), out = String(output ?? '');
    if (!src.trim() || !out.trim()) return out;
    const paras = paragraphsOf(src), keys = new Set(paras.map(echoKey).filter(k => k.length >= 12)), sources = new Set(paras);
    const longest = Math.max(0, ...[...keys].map(k => k.length));
    const blocks = out.split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    let changed = false;
    for (let i = 0; i < blocks.length; i += 2) {
        let block = blocks[i];
        if (!src.includes('⟦')) block = block.replace(LOOSE_MARK_LINES, '$1');
        const cut = keys.size ? cutEcho(block, keys, longest, sources) : null;
        if (cut !== null) block = cut;
        if (block !== blocks[i]) { blocks[i] = block; changed = true; }
    }
    const content = [];
    for (let i = 0; i < blocks.length; i += 2) if (blocks[i].trim()) content.push(i);
    // 원문 덩이 + 화살표만 있는 덩이 ("원문\n\n→\n\n번역")
    const arrowOnly = new RegExp(String.raw`^\s*${ECHO_ARROW}\s*$`);
    for (let n = 0; n < content.length - 1; n++) {
        const key = echoKey(blocks[content[n]]);
        if (key.length >= 12 && keys.has(key) && arrowOnly.test(blocks[content[n + 1]])) { blocks[content[n]] = blocks[content[n + 1]] = ''; changed = true; }
    }
    content.splice(0, content.length, ...content.filter(i => blocks[i].trim()));
    let extra = content.length - paras.length;
    for (let n = 0; extra > 0 && n < content.length - 1; n++) {
        const key = echoKey(blocks[content[n]]), next = echoKey(blocks[content[n + 1]]);
        if (key.length >= 20 && keys.has(key) && next && !keys.has(next) && scriptOf(next) !== scriptOf(key) &&
            skeletonOf(blocks[content[n]]) === skeletonOf(blocks[content[n + 1]])) { blocks[content[n]] = ''; extra--; changed = true; }
    }
    if (!changed) return out;
    let joined = '';
    for (let i = 0; i < blocks.length; i += 2) {
        if (!blocks[i].trim()) continue;
        joined += (joined ? (blocks[i - 1] || '\n\n') : '') + (joined ? blocks[i] : blocks[i].replace(/^\n+/, ''));
    }
    return joined;
}
/** 5.4.1: 한 문단의 번역이 원문을 길게 베껴 품었나 — 원문 문장(12자 이상)들이 원문의 60% 이상 그대로 들어 있고,
 *  베낀 것을 뺀 나머지가 다른 글자(언어)로 넉넉히 있을 때. 짧은 원문(40자 미만) · 이름 · 짧은 인용 · 번역하지 않고 그대로 둔 문단은 해당 없음. */
export function echoesSource(answer, source) {
    const protectedNotes = maskTranslatorNotes(answer);
    if (protectedNotes.changed) return echoesSource(protectedNotes.text, source);
    const sourceKey = echoKey(source);
    if (sourceKey.length < 40) return false;
    let rest = echoKey(answer), copied = 0;
    for (const sentence of String(source).split(/(?<=[.!?。！？…」』"”)])\s+|\n+/)) {
        const key = echoKey(sentence);
        if (key.length >= 12 && rest.includes(key)) { copied += key.length; rest = rest.replace(key, ''); }
    }
    return copied >= sourceKey.length * 0.6 && rest.length >= Math.max(12, sourceKey.length * 0.2) && scriptOf(rest) !== scriptOf(sourceKey);
}
/** 5.4.1: 한 문단 답을 원문과 견줘 고친다 — 표시 · 원문+화살표를 걷은 번역, 그래도 원문을 베껴 품었으면 null (형식 오류) */
export function cleanParagraphEcho(answer, source) {
    const cleaned = stripDraftLeaks(removeSourceEcho(source, answer), source).replace(/^\n+|\s+$/g, '');   // 6.6.5 초안 · 감싸개도
    return !cleaned.trim() || echoesSource(cleaned, source) ? null : cleaned;
}
const FAIL_BLOCK = /^\[[^\n\]]*원문 그대로\]/;
/** 5.4.1: 메시지 번역(캐시에 넣을 · 캐시에서 꺼낸 글)이 원문 되풀이를 품었나 — 걷을 게 있거나, 어느 덩이가 원문 문단을 길게 베꼈으면 참 */
export function hasSourceEcho(source, output) {
    const protectedNotes = maskTranslatorNotes(output);
    if (protectedNotes.changed) return hasSourceEcho(source, protectedNotes.text);
    const out = String(output ?? '');
    if (!out.trim() || !String(source ?? '').trim()) return false;
    if (removeSourceEcho(source, out) !== out) return true;
    if (stripDraftLeaks(out, source) !== out) return true;   // 6.6.5 초안 · 모델 혼잣말 · 지어낸 감싸개가 남은 옛 캐시는 다시 쓰지 않는다
    if (brokenComments(source, out)) return true;   // 2.5.1 숨긴 주석을 잃거나 닫는 --> 를 잃은 옛 번역 (화면에 「<!-- …」 가 보였다)
    const paras = paragraphsOf(source).filter(p => echoKey(p).length >= 40);
    if (!paras.length) return false;
    return paragraphsOf(out).some(block => !FAIL_BLOCK.test(block) && paras.some(p => echoesSource(block, p)));
}
/** meta.renumbered: 1부터 다시 매긴 답을 한 칸 내려 받았다 (문단 하나를 빼먹고 끝에 지어낸 답과 구별이 안 돼 캐시에 넣지 않는다)
 *  5.3.7: sources(보낸 원문 문단 배열)를 주면 꼬리 메모를 원문 문단과 견줘 걷는다 — 원문에 있는 상태창 · 메모 줄은 번역이다 */
export function parseBatchResult(raw, count, meta = {}, sources) {
    const protectedNotes = maskTranslatorNotes(raw);
    if (protectedNotes.changed) return parseBatchResult(protectedNotes.text, count, meta, sources).map(value => protectedNotes.restore(value));
    // 앞의 <think>…</think> · 코드 펜스 · 표시 앞의 설명문은 걷어 낸다. 개수 · 번호 · 중복 · 빈 글 검사는 엄격하다.
    const text = String(raw).replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*```[a-z]*[ \t]*\n|\n[ \t]*```\s*$/g, '').trim();
    // 5.4.1: ⟦ 가 있으면 모양이 망가진 표시(⟦1 Vere] · ⟦1] …)도 표시로 본다 — 전엔 그 줄이 앞 문단 답에 붙었다.
    //        ⟦ 도 【n】 도 없으면 [n] 표시. ⟦ 답 안의 [n] 줄은 바로 앞 번호 +1 이고 원문에 그런 줄이 없을 때만 표시로 본다.
    const mode = text.includes('⟦') ? 'loose' : text.split('\n').some(line => MARK_ALT.test(line)) ? 'alt' : 'square';
    const mark = mode === 'loose' ? LOOSE_MARK : mode === 'alt' ? MARK_ALT : SQUARE_MARK;
    const squareInSource = n => Boolean(sources?.some(s => new RegExp(String.raw`^[ \t]*\[[ \t]*${n}[ \t]*\]`, 'm').test(String(s ?? ''))));
    const fail = () => { throw Object.assign(Error('문단 번호나 응답 형식이 맞지 않아 번역을 적용하지 않았어요. 다시 시도해 주세요.'), { format: true }); };
    const found = new Map();
    let id = null, buffer = [];
    const flush = () => {
        if (id === null) return;
        const body = buffer.join('\n'); // 꼬리 메모는 번호를 맞춘 뒤(1부터 매긴 답) 원문 문단과 견줘 뺀다
        if (!body.trim() || found.has(id)) fail();
        found.set(id, body);
    };
    for (const line of text.split('\n')) {
        let hit = mark.exec(line);
        if (!hit && mode === 'loose' && id !== null) {
            const square = SQUARE_MARK.exec(line);
            if (square && Number(square[1]) === id + 1 && !found.has(id + 1) && !squareInSource(square[1])) hit = square;
        }
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
    return Array.from({length: count}, (_, i) => {
        let body = stripTrailingNote(stripPlanningNotes(found.get(i), sources?.[i]), sources?.[i]).replace(/^\n+|\s+$/g, '');   // 6.5.3 작업 메모도 // 빈 줄만 걷고 첫 줄 들여쓰기(코드 · 목록)는 둔다
        if (!body) fail();
        // 5.4.1: 원문+화살표+번역이면 번역만, 그래도 원문을 길게 베껴 품었으면 형식 오류 (통짜로 한 번 다시)
        if (sources?.[i] != null) body = cleanParagraphEcho(body, sources[i]) ?? fail();
        return body;
    });
}
/** 2.6.2 흘려받는 중인 묶음 답에서 닫힌 문단(다음 ⟦n⟧ 이 온 문단)만 — parseBatchResult 와 같은 표시 · 같은 걷어 내기. 바로 보기 · 진행 숫자에만 쓴다.
 *  번호는 0(또는 1부터 다시 매긴 답이면 1)부터 차례대로일 때까지만 센다. 걷어 내고 빈 문단 · 원문을 베낀 문단은 null (닫힘으로는 센다).
 *  from: 이미 본 문단 수 — 그 앞 문단은 걷어 내지 않고 undefined (조각마다 앞 문단을 다시 걷지 않게) */
export function streamedPassages(raw, count, sources, from = 0) {
    const protectedNotes = maskTranslatorNotes(raw);
    if (protectedNotes.changed) return streamedPassages(protectedNotes.text, count, sources, from).map(value => value == null ? value : protectedNotes.restore(value));
    let text = String(raw ?? '').replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '');
    if (/<think>/i.test(text) || !text.includes('⟦')) return [];   // 아직 생각 중 · 표시 전
    text = text.replace(/^\s*```[a-z]*[ \t]*\n/, '');
    const squareInSource = n => Boolean(sources?.some(s => new RegExp(String.raw`^[ \t]*\[[ \t]*${n}[ \t]*\]`, 'm').test(String(s ?? ''))));
    const bodies = [];
    let id = null, buffer = [];
    for (const line of text.split('\n')) {
        let hit = LOOSE_MARK.exec(line);
        if (!hit && id !== null) {
            const square = SQUARE_MARK.exec(line);
            if (square && Number(square[1]) === id + 1 && !squareInSource(square[1])) hit = square;
        }
        if (!hit) { if (id !== null) buffer.push(line); continue; }
        const n = Number(hit[1]);
        if (id === null ? n > 1 : n !== id + 1) break;   // 1 부터 매긴 답도 차례는 같다 (parseBatchResult 가 한 칸 내려 받는다)
        if (id !== null) bodies.push(buffer.join('\n'));
        id = n; buffer = [line.slice(hit[0].length)];
    }
    return bodies.slice(0, count).map((found, i) => {
        if (i < from) return undefined;
        const source = sources?.[i];
        let body = stripTrailingNote(stripPlanningNotes(found, source), source).replace(/^\n+|\s+$/g, '');
        if (body && source != null) body = cleanParagraphEcho(body, source);
        return body || null;
    });
}
/** 2.6.2 묶음 요청을 흘려받는 동안 문단이 닫힐 때만 알리고, 알림(바로 보기 · 진행 숫자)은 한 프레임에 한 번으로 묶는다 (글자마다 그리지 않는다).
 *  done(view, count): translateSegments 의 request 알림 — view = 끝난 묶음 + 흘려받는 묶음에서 닫힌 문단, count = 끝난 문단 수.
 *  settled() = 끝난 묶음의 번역 배열. follow(sources, offset) → 흘려받은 글을 받는 함수. keep = 끝난 작은 묶음(반 나누기) ·
 *  settle = 묶음이 끝남(밀린 알림은 버린다 — 묶음 끝 알림이 대신) · close = 요청이 끝남(그 뒤엔 아무것도 알리지 않는다) */
export function streamWatch({ done, settled, shape = text => text, frame = globalThis.requestAnimationFrame ? fn => globalThis.requestAnimationFrame(fn) : fn => setTimeout(fn, 16),
    cancel = globalThis.cancelAnimationFrame ? id => globalThis.cancelAnimationFrame(id) : id => clearTimeout(id) }) {
    const live = [], sure = [];   // 2.9.0 sure[i]: ⟦0⟧ 부터 매긴 답에서 닫힌 문단 (1부터 매긴 답은 한 칸 밀린 답과 구별이 안 돼 이어 하기에 남기지 않는다)
    let pending = false, queued = null, closed = false;
    const flush = () => {
        pending = false; queued = null;
        if (closed) return;
        const base = settled(), view = [...base];
        let count = base.length;
        for (let i = base.length; i < live.length; i++) if (i in live) { view[i] = live[i]; count++; }
        let safe = base.length;
        while (safe < live.length && safe in live && sure[safe]) safe++;
        done(view, count, safe);
    };
    const queue = () => { if (closed || pending) return; pending = true; queued = frame(flush); };
    const settle = () => { if (pending) cancel(queued); pending = false; queued = null; };
    return {
        follow(sources, offset) {
            let mark = -1, seen = 0, zero = null;
            return raw => {
                if (closed) return;
                // 새 ⟦n 표시가 다 왔을 때만 본다 (⟦1 까지만 온 ⟦12⟧ 는 다음 조각에서)
                const at = raw.lastIndexOf('⟦');
                if (at <= mark || !/^⟦[ \t]*\d+\D/.test(raw.slice(at, at + 16))) return;
                mark = at;
                const passages = streamedPassages(raw, sources.length, sources, seen);
                if (passages.length <= seen) return;
                if (zero === null) { const first = /⟦[ \t]*(\d+)/.exec(String(raw).replace(/<think>[\s\S]*?<\/think>/gi, '')); if (first) zero = Number(first[1]) === 0; }
                for (let k = seen; k < passages.length; k++) { live[offset + k] = passages[k] === null ? null : shape(passages[k]); sure[offset + k] = zero === true; }
                seen = passages.length;
                queue();
            };
        },
        keep(offset, list) { if (closed) return; list.forEach((text, k) => { live[offset + k] = text; sure[offset + k] = true; }); queue(); },
        settle,
        close() { settle(); closed = true; },
    };
}
// 2.5.1 partial(text): 캐시에서 온 문단 · 끝난 묶음의 문단은 번역문, 나머지는 원문인 글 (끝난 문단부터 번역문으로 보여 주기용)
export async function translateSegments({ parts, signature, request, check = () => {}, progress = () => {}, cacheable = () => true, blockedMarker, partial = null, protection = null }) {
    const stamp = epoch, output = [...parts], total = Math.ceil(parts.length / 2), missing = new Map();
    let reused = 0, translated = 0, blocked = 0, resumedCount = 0;
    const touched = [];   // 7.3.1 캐시에서 꺼내 쓴 문단 — 끝에 시각을 새로 써서 최근에 쓴 채팅이 밀려나지 않게 (LRU)
    // paragraph-v2: 서명이 준비된 프롬프트 전체가 아니라 짧은 요약(연결 · 프롬프트 · 용어집)이 됐다
    const keyed = [];
    for (let i = 0; i < parts.length; i += 2) {
        check();
        const body = parts[i];
        if (skipBody(body)) continue;
        const { key, map } = await segmentCacheKey(signature, body, protection);   // 3.0.1
        keyed.push([i, body, key, map]);
    }
    const saved = await readMany([...new Set(keyed.map(row => row[2]))]);
    const resumed = await readMany([...new Set(keyed.map(row => RESUME + row[2]))], RESUME_TTL);   // 2.9.0 끊긴 묶음에서 남긴 문단
    check();
    for (const [i, body, key, map] of keyed) {
        // 5.4.1: 예전에 캐시에 들어간 원문 되풀이 답(원문+화살표+번역 · 망가진 ⟦n] 표시)은 없는 셈 치고 다시 요청한다
        // 6.4.2 v2 지금 규칙으로 캐시에 넣지 않을 문단(예: 6.4.1 이하가 넣은 원문 한자 남은 문단)은 다시 쓰지 않고 번역한다 — 서명은 그대로라 다른 문단 캐시는 산다
        // 3.0.1 저장된 글의 자리표시자 번호(문단 안 차례)를 지금 번호로 되돌린 뒤 견주고 쓴다
        const hit = saved.has(key) ? restorePlaceholders(saved.get(key), map) : null;
        if (hit !== null && cleanParagraphEcho(hit, body) === hit.replace(/^\n+|\s+$/g, '') && cacheable(body, hit)) { output[i] = hit; reused++; touched.push([key, saved.get(key)]); continue; }
        const kept = resumed.has(RESUME + key) ? restorePlaceholders(resumed.get(RESUME + key), map) : null;
        if (kept && cleanParagraphEcho(kept, body) === kept.replace(/^\n+|\s+$/g, '') && cacheable(body, kept)) { output[i] = kept; reused++; resumedCount++; continue; }   // 2.9.0 이어 하기 · 7.3.1 resumed = 그중 이어 하기로 온 수
        if (!missing.has(key)) missing.set(key, { key, body, map, indices: [] });
        missing.get(key).indices.push(i);
    }
    const pending = [...missing.values()];
    // 2.5.5 묶음 번역 진행: batch = 이번에 보낼 문단 수, finished = 그중 끝난 수 (묶음이 끝날 때마다 — 「수정 문단 17/74」)
    // 7.3.1 resumed: 캐시 중 이어 하기(끊긴 묶음)에서 온 문단 수 — 알림 · 진행 문구가 「바뀐 문단 n개만」과 「남은 문단 n개 이어서」를 가른다
    progress({ stage: 'segments', done: reused, total, reused, resumed: resumedCount, translated, pending: pending.length, batch: pending.length, finished: 0 });
    const touch = async () => { if (touched.length && epoch === stamp) { try { await writeMany(touched.splice(0), stamp); } catch { /* 시각 새로 쓰기는 번역을 막지 않는다 */ } } };
    const tell = list => {
        if (!partial) return;
        const view = [...output];
        (list || []).forEach((text, n) => { const row = pending[n], clean = typeof text === 'string' && row ? cleanParagraphEcho(text, row.body) : null; if (clean) for (const i of row.indices) view[i] = clean; });
        try { partial(view.join('')); } catch { /* 보여 주기는 번역을 막지 않는다 */ }
    };
    if (reused && pending.length) tell([]);
    // 5.2.9: blockedMarker 는 문구 또는 (body, error?) => 문구
    const markOf = (body, error) => typeof blockedMarker === 'function' ? blockedMarker(body, error) : blockedMarker;
    // 2.9.0 끊기면 남길 문단: 알림이 준 앞쪽의 이어 붙여도 되는 문단(safe)까지만. 검사는 캐시와 같게, 실패해도 원래 오류를 가리지 않는다
    let closedRows = [];
    const keepClosed = async () => {
        try {
            const rows = [];
            closedRows.forEach((text, n) => {
                const row = pending[n];
                if (!row || typeof text !== 'string' || !text.trim()) return;
                const cleaned = cleanParagraphEcho(text, row.body);
                if (cleaned !== null && epoch === stamp && cacheable(row.body, cleaned)) rows.push([RESUME + row.key, localizeOut(cleaned, row.map)]);   // 3.0.1 문단 안 차례로 저장
            });
            if (rows.length) await writeMany(rows, stamp);
        } catch { /* 남기기 실패는 원래 오류를 바꾸지 않는다 */ }
    };
    if (pending.length) {
        let results;
        try {
            // 2.6.2 count: 흘려받는 묶음은 닫힌 문단까지 센다 (문단마다 — 「수정 문단 1/71」). 묶음 끝 알림은 예전처럼 배열 길이
            results = await request(pending.map(row => row.body), (done, count = done?.length ?? 0, safe = count) => {
                const finished = Math.min(count, pending.length);
                // 2.9.0 · 2.9.2 받은 글만 더한다 — 실패한 묶음은 끝에 null 배열로 한 번 더 알리는데(index.js done(translated)), 그때 앞서 닫힌 문단을 지워 이어 하기가 비었다
                if (Array.isArray(done)) done.slice(0, Math.min(safe, finished)).forEach((text, n) => { if (typeof text === 'string' && text.trim()) closedRows[n] = text; });
                progress({ stage: 'segments', done: reused + finished, total, reused, resumed: resumedCount, translated, pending: pending.length, batch: pending.length, finished });
                if (finished < pending.length) tell(done);
            });
        }
        catch (error) {
            await keepClosed();   // 2.9.0 이어 하기 — 이미 받은 문단은 하루 동안 남긴다
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
                    const row = pending[n];
                    // 5.4.1: 어느 경로로 온 답이든 원문+화살표+번역이면 번역만, 원문을 길게 베껴 품었으면 그 문단만 형식 오류 (붙이지도 캐시에 넣지도 않는다)
                    let result = results[n], echoed = null;
                    if (result !== null) {
                        const cleaned = cleanParagraphEcho(result, row.body);
                        if (cleaned === null) { result = null; echoed = Object.assign(Error('번역 답에 원문이 그대로 섞여 왔어요'), { format: true }); }
                        else if (cleaned !== result.replace(/^\n+|\s+$/g, '')) result = cleaned;
                    }
                    if (result === null) {
                        if (!blockedMarker) throw echoed ?? Error('일부 문단의 번역을 받지 못했어요.');
                        for (const i of row.indices) { output[i] = `${markOf(row.body, echoed ?? undefined)}\n${row.body}`; blocked++; }
                        continue;
                    }
                    if (epoch === stamp && cacheable(row.body, result)) rows.push([row.key, localizeOut(result, row.map)]);   // 3.0.1 문단 안 차례로 저장
                    for (const i of row.indices) { output[i] = result; translated++; }
                }
            } finally { if (epoch === stamp) rows.push(...touched.splice(0)); if (rows.length) await writeMany(rows, stamp); }   // 7.3.1 꺼내 쓴 문단도 같은 트랜잭션으로
            if (results.some(text => text === null)) await keepClosed();   // 2.9.0 일부 묶음만 실패 — 결과는 그대로(그 문단은 차단 표시), 받은 문단만 이어 하기로
        } else if (!blocked) throw Error('빈 번역 응답은 저장하지 않았어요.');
    }
    check();
    await touch();
    progress({ stage: 'segments', done: total, total, reused, resumed: resumedCount, translated, pending: 0 });
    return { text: output.join(''), reused, resumed: resumedCount, translated, blocked, total };
}

// ── 6.2.1 태그 짝 지키기 ──
// 보호 규칙이 태그를 자리표시자로 가려 보내면 모델이 닫는 태그 자리를 [[/__VAR_3__]] 처럼 바꿔 써서 되돌리지 못했고(태그가 사라지고 글자가 남음),
// 닫는 태그를 빠뜨린 번역도 있었다. 그러면 실리태번 표시 정규식(<true_thoughts …>…</true_thoughts> 같은 것)이 다음 짝까지 통째로 칠해
// 서술까지 속마음 모양이 됐다. 자리표시자의 변형을 되돌리고, 번역문의 태그 짝을 원문 구조대로 맞춘다.
const PLACEHOLDER_VARIANT = /\[{1,2}[ \t]*\/?[ \t]*_{1,2}[ \t]*(?:VAR|VARIABLE|[Vv]ar|변수)[ \t]*_[ \t]*(\d+)[ \t]*_{1,2}[ \t]*\/?[ \t]*\]{1,2}/g;
/** 모델이 바꿔 쓴 자리표시자([[/__VAR_3__]] · [[__VAR_3__/]] · [__VAR_3__] · [[ __VAR_3 __]] …)를 [[__VAR_3__]] 로 */
export function fixPlaceholderVariants(text) {
    return String(text ?? '').replace(PLACEHOLDER_VARIANT, (_, n) => `[[__VAR_${n}__]]`);
}
// 6.2.4 번역 모델이 원문에 없는 로마자 낱말 하나를 줄에 혼자 끼워 넣는다 (사용자 10-13 「Valladolid 이건 어디서 나온 거냐」 —
//       영어 원문 답에는 없고 한국어 번역에만 "…있었다.\n\nValladolid\n층수 표시등에…"). 번역문이 주로 한글 · 가나 · 한자일 때만,
//       줄 전체가 로마자 낱말 하나이고 그 낱말이 원문 어디에도 없을 때만 그 줄을 지운다. 영어로 옮긴 글 · 원문에 있는 낱말(이름 · 약어)은 그대로.
//       지운 줄 때문에 빈 줄이 겹치거나 맨 앞 · 맨 끝에 남으면 빈 줄 하나도 같이 지워 문단 수가 원문과 같게 남는다.
//       코드 울타리(``` · ~~~) 안은 보지 않는다. 낱말 견주기는 전각 · ’ · 소프트 하이픈 · 늘인 글자(Hmmm = Hmm)를 맞춰서.
const STRAY_WORD_LINE = /^[\t \r\u00a0]*([A-Za-z][A-Za-z'’-]*[A-Za-z])[\t \r\u00a0]*$/;   // 두 글자 이상
const FENCE_LINE = /^[\t ]*(?:`{3,}|~{3,})/;
const blankLine = line => line !== undefined && !line.trim();
const wordKey = text => String(text).normalize('NFKC').toLowerCase().replace(/\u00ad/g, '').replace(/[’‘]/g, "'").replace(/([a-z])\1{2,}/g, '$1$1');
/** drop[i] 인 줄을 지운다 — 지운 줄 때문에 빈 줄이 겹치거나 맨 앞 · 맨 끝에 남으면 빈 줄 하나도 같이 지워 문단 수가 그대로 남게 */
function dropLines(lines, drop) {
    const out = [];
    let skipBlank = false;
    lines.forEach((line, i) => {
        if (drop[i]) {
            const next = lines[i + 1];
            if (blankLine(out.at(-1)) && (next === undefined || blankLine(next))) out.pop();
            else if (!out.length && blankLine(next)) skipBlank = true;
            return;
        }
        if (skipBlank) { skipBlank = false; if (blankLine(line)) return; }
        out.push(line);
    });
    return out.join('\n');
}
export function dropStrayWords(text, source) {
    const protectedNotes = maskTranslatorNotes(text);
    if (protectedNotes.changed) return protectedNotes.restore(dropStrayWords(protectedNotes.text, source));
    let value = String(text ?? '');
    // 6.2.5 문단 번호 표시(⟦n⟧) 찌꺼기 — 번역 모델이 영어 혼잣말을 「… context-fitting title⟧ 번역문 …」처럼 줄 머리에 흘렸다
    //       (원문에는 없는 글귀). 원문에 ⟦ ⟧ 가 없을 때만:
    //       줄 머리의 로마자 · 기호뿐인 글귀 + ⟧ (한글 · 가나 · 한자가 섞이면 손대지 않는다), 그리고 남은 ⟦n⟧ 표시를 걷는다.
    //       글귀만 있던 줄이 비면 그 줄도 지운다 (빈 줄이 겹치지 않게 — 접힌 보기의 문단 사이가 벌어지지 않는다)
    if (/[⟦⟧]/.test(value) && !/[⟦⟧]/.test(String(source ?? ''))) {
        const before = value.split('\n');
        value = value.replace(/^([\t \u00a0]*)(?:⟦\d*⟧[\t ]*)?[A-Za-z][^\n⟦⟧\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]{0,200}?⟧[\t ]*/gm, '$1').replace(/⟦\d+⟧[\t ]*/g, '');
        const after = value.split('\n');
        if (after.length === before.length) {
            const emptied = after.map((line, i) => !line.trim() && !!before[i].trim());
            if (emptied.includes(true)) value = dropLines(after, emptied);
        }
    }
    if (!value.includes('\n')) return value;
    const src = wordKey(source ?? '');
    const lines = value.split('\n');
    let fenced = false;
    const stray = lines.map(line => {
        if (FENCE_LINE.test(line)) { fenced = !fenced; return false; }
        if (fenced) return false;
        const m = STRAY_WORD_LINE.exec(line);
        return !!m && !src.includes(wordKey(m[1]));
    });
    if (!stray.includes(true)) return value;
    // 어느 말로 옮긴 글인가는 그 줄들과 태그를 뺀 나머지로 본다 (짧은 번역에서 끼어든 낱말 · <font color=…> 같은 꾸밈이 판정을 뒤집지 않게)
    const rest = lines.filter((_, i) => !stray[i]).join('\n').replace(/<[^>]*>/g, '');
    const latin = rest.match(/[A-Za-z]/g)?.length ?? 0;
    const cjk = rest.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g)?.length ?? 0;
    if (cjk <= latin) return value;
    return dropLines(lines, stray);
}
// 6.4.5 줄 전체를 감싼 「」 — 꺾쇠 없이 쓴 원문 줄(속마음 · 서술)을 모델이 대사로 보고 번역문 줄만 통째로 「…」 로 감쌌다 (태그 안쪽까지).
//       번역 프롬프트의 「대사(「」 · 따옴표 안)」 안내가 꺾쇠 없는 일본어 줄에도 걸린 것. 원문 · 번역문 줄을 함께 보기(접기)와 같은 방식으로 맞춘다:
//       빈 줄 · 코드 블록 · 구조 줄(가로줄 · 표)을 뺀 줄 수가 같을 때만 같은 번째 줄끼리. 줄 수가 다르면(짝이 불확실) 아무것도 안 한다.
//       벗기는 것은 바깥 「」 하나뿐이고, 셋 다 맞을 때만:
//        · 번역문 줄의 앞뒤 껍데기(태그 · 자리표시자 · 공백 · * _)를 뺀 글이 「 로 시작해 그 짝 」 로 끝난다 (「가」 … 「나」 처럼 두 덩이면 아님)
//        · 원문 줄의 껍데기를 뺀 글 머리 · 끝에 따옴표(「『"“'‘ 와 닫는 짝)가 없다 — "…" 가 용어집으로 「」 가 된 대사는 그대로
//        · 번역문 줄의 따옴표 짝이 원문 줄보다 딱 하나 많다 — 원문 속 「」 · "…" 를 옮긴 것은 남는다
const WRAP_QUOTE_EDGE = /[「」『』"“”'‘’«»]/;
const WRAP_SHELL_HEAD = /^(?:[\t \r *_]|<[A-Za-z][^<>]*>|\[\[__VAR_\d+__\]\])*/;
const WRAP_CLOSE_TAG = /^<\/[A-Za-z][\w:-]*\s*>$/;
const WRAP_CLOSE_VAR = /\[\[\/__VAR_\d+__\]\]$/;
/** 줄 → [껍데기 뒤 시작, 껍데기 앞 끝] (뒤쪽은 정규식 $ 대신 끝에서부터 걷는다 — 긴 줄에서 되짚기가 없게) */
function wrapCoreRange(line) {
    const start = WRAP_SHELL_HEAD.exec(line)[0].length;
    let end = line.length;
    while (end > start) {
        const ch = line[end - 1];
        if (/[\t \r *_]/.test(ch)) { end--; continue; }
        if (ch === '>') {
            const open = line.lastIndexOf('<', end - 1);
            if (open >= start && WRAP_CLOSE_TAG.test(line.slice(open, end))) { end = open; continue; }
        }
        if (ch === ']') {
            const hit = WRAP_CLOSE_VAR.exec(line.slice(Math.max(start, end - 24), end));
            if (hit) { end -= hit[0].length; continue; }
        }
        break;
    }
    return [start, end];
}
/** 따옴표 짝 수 (「 · 『 · “ 는 여는 것, " 는 둘에 하나 · 태그 속성의 " 는 빼고) — 원문 · 번역문에 같은 셈 */
const quotePairs = line => {
    const text = line.replace(/<[^<>]*>/g, '');
    return (text.match(/[「『“]/g)?.length ?? 0) + Math.floor((text.match(/"/g)?.length ?? 0) / 2);
};
/** 빈 줄 · 코드 블록 · 구조 줄을 뺀 줄 번호 (함께 보기 줄 맞춤과 같은 판정) */
function wrapLineQueue(lines) {
    const structure = structureLines(lines);
    const queue = [];
    let fence = null, rawTag = null;
    lines.forEach((line, i) => {
        // HTML literal blocks and nested/different fence markers are content,
        // so never repair their quotation marks.
        if (!rawTag) {
            const marker = /^[\t ]*(`{3,}|~{3,})(.*)$/.exec(line);
            if (fence) {
                if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
                return;
            }
            if (marker) { fence = marker[1]; return; }
        }
        let literal = !!rawTag;
        for (const tag of line.matchAll(/<(\/?)(pre|code|script|style|textarea)\b[^<>]*>/gi)) {
            literal = true;
            const name = tag[2].toLowerCase();
            if (!tag[1] && !rawTag) rawTag = name;
            else if (tag[1] && rawTag === name) rawTag = null;
        }
        if (literal || !line.trim() || structure.has(i)) return;
        queue.push(i);
    });
    return queue;
}
export function dropWrapQuotes(text, source) {
    const value = String(text ?? '');
    if (!value.includes('「') || !value.includes('」')) return value;
    const lines = value.split('\n');
    const srcLines = String(source ?? '').split('\n');
    const outQueue = wrapLineQueue(lines), srcQueue = wrapLineQueue(srcLines);
    if (outQueue.length !== srcQueue.length) return value;
    let changed = false;
    outQueue.forEach((at, k) => {
        const line = lines[at];
        const [s, e] = wrapCoreRange(line);
        if (e - s < 3 || line[s] !== '「' || line[e - 1] !== '」') return;
        let depth = 0;
        for (let i = s; i < e - 1; i++) {
            if (line[i] === '「') depth++;
            else if (line[i] === '」' && --depth === 0) return;   // 「가」 … 「나」 — 처음 짝이 줄 끝 전에 닫힌다
        }
        if (depth !== 1 || !line.slice(s + 1, e - 1).trim()) return;
        const src = srcLines[srcQueue[k]];
        const [ss, se] = wrapCoreRange(src);
        if (se <= ss || WRAP_QUOTE_EDGE.test(src[ss]) || WRAP_QUOTE_EDGE.test(src[se - 1])) return;
        if (quotePairs(line) !== quotePairs(src) + 1) return;
        lines[at] = line.slice(0, s) + line.slice(s + 1, e - 1) + line.slice(e);
        changed = true;
    });
    return changed ? lines.join('\n') : value;
}
// 2.5.2 빠진 대사 괄호 되살리기 (사용자 10-15): 원문 색 대사 <span style="color:…">「…」</span> 29개 중 10개를 모델이 괄호를 빼고 옮겨(프롬프트에
//   「」 를 지키라고 적혀 있어도) 테마가 대사로 못 알아봐 형광펜 · 밝은 글자색이 빠지고 원래 인라인 색(어두운 배경에서 안 보임)이 그대로 나왔다.
//   원문과 같은 자리 줄 · 색 span 끼리 맞춰, 원문 쪽이 「…」 / 『…』 한 쌍으로 통째 감싸였는데 번역문 쪽 머리 · 끝에 그 괄호가 없으면 같은 괄호를 다시 붙인다.
//   dropWrapQuotes(원문에 없는 감싼 괄호를 벗김)의 거울 — 원문에 없는 괄호는 만들지 않는다. 맞추는 법(둘 중 되는 것):
//    ① 줄: 빈 줄로 나눈 문단 수가 같고 문단마다 줄 수가 같고, 줄 머리 태그(<span style=…> 같은 껍데기)가 같은 줄끼리
//    ② 색 span: 문단이 어긋나도 글 안의 <span …>…</span> 여는 태그 차례가 원문과 똑같으면 span 끼리
//   붙이지 않는 때: 원문 괄호가 줄 안에서 닫힘(「가」 … 「나」) · 줄을 넘는 대사 · 번역문이 다른 따옴표(" “ 『 …)로 바꿔 씀 · 그 괄호가 번역문에 이미 원문만큼 있음 · 코드 블록이 있는 글.
const BRACKET_CLOSE = { '「': '」', '『': '』' };
/** 글이 한 괄호로 통째 감싸였나 → 여는 괄호 (아니면 '') — 「가」 … 「나」 처럼 처음 짝이 끝 전에 닫히면 아님 */
function wrappingBracket(core) {
    const open = core[0], close = BRACKET_CLOSE[open];
    if (!close || core.length < 3 || core[core.length - 1] !== close) return '';
    let depth = 0;
    for (let i = 0; i < core.length - 1; i++) {
        if (core[i] === open) depth++;
        else if (core[i] === close && --depth === 0) return '';
    }
    return depth === 1 ? open : '';
}
/** 번역문 core 에 원문 core 의 감싼 괄호 중 빠진 쪽을 붙인 글 (고칠 게 없으면 null) */
function fillBracketEdges(srcCore, outCore) {
    const open = wrappingBracket(srcCore);
    if (!open || !outCore.trim()) return null;
    const close = BRACKET_CLOSE[open], count = (text, mark) => text.split(mark).length - 1;
    const needOpen = outCore[0] !== open, needClose = outCore[outCore.length - 1] !== close;
    if (!needOpen && !needClose) return null;
    // 모델이 다른 따옴표 · 괄호로 바꿔 쓴 대사는 두 번 감싸지 않는다
    if ((needOpen && /^["“”'‘’«»「」『』(（\[]/.test(outCore)) || (needClose && /["“”'‘’«»「」『』)）\]]$/.test(outCore))) return null;
    // 원문보다 그 괄호가 많아지지 않게 (번역문이 괄호를 안쪽으로 옮겨 쓴 것은 그대로)
    if ((needOpen && count(outCore, open) >= count(srcCore, open)) || (needClose && count(outCore, close) >= count(srcCore, close))) return null;
    return (needOpen ? open : '') + outCore + (needClose ? close : '');
}
const SHELL_TAGS = line => (/^(?:[\t \r]|<[A-Za-z][^<>]*>)*/.exec(line)[0].match(/<[A-Za-z][^<>]*>/g) || []).join('').toLowerCase().replace(/\s+/g, ' ');
const COLOR_SPAN = /<span\b[^<>]*>([^<>]*)<\/span>/gi;
export function restoreDialogueBrackets(source, output) {
    const src = String(source ?? '').replace(/\r\n?/g, '\n'), value = String(output ?? '');
    if (!/[「『]/.test(src) || !value.trim() || /```|~~~/.test(src) || /```|~~~/.test(value)) return value;
    const out = value.replace(/\r\n?/g, '\n');
    // ① 줄끼리
    const sParas = src.split(PARA_SPLIT), oParts = out.split(PARA_SPLIT);
    if (sParas.length === oParts.length) {
        const fixed = [...oParts];
        let aligned = true, changed = false;
        for (let p = 0; p < sParas.length && aligned; p += 2) {
            const sLines = sParas[p].split('\n'), oLines = fixed[p].split('\n');
            if (sLines.length !== oLines.length) { aligned = false; break; }
            sLines.forEach((line, k) => {
                const [ss, se] = wrapCoreRange(line), target = oLines[k], [os, oe] = wrapCoreRange(target);
                if (se - ss < 3 || oe <= os || SHELL_TAGS(line) !== SHELL_TAGS(target)) return;
                const filled = fillBracketEdges(line.slice(ss, se), target.slice(os, oe));
                if (filled === null) return;
                oLines[k] = target.slice(0, os) + filled + target.slice(oe);
                changed = true;
            });
            fixed[p] = oLines.join('\n');
        }
        if (aligned) return changed ? fixed.join('') : value;
    }
    // ② 색 span 끼리 (여는 태그 차례가 원문과 똑같을 때만)
    const sSpans = [...src.matchAll(COLOR_SPAN)], oSpans = [...out.matchAll(COLOR_SPAN)];
    const opener = m => m[0].slice(0, m[0].indexOf('>') + 1).toLowerCase().replace(/\s+/g, ' ');
    if (!sSpans.length || sSpans.length !== oSpans.length || sSpans.some((m, i) => opener(m) !== opener(oSpans[i]))) return value;
    let result = '', last = 0, changed = false;
    oSpans.forEach((m, i) => {
        const inner = m[1], lead = /^\s*/.exec(inner)[0], trail = /\s*$/.exec(inner)[0];
        const filled = fillBracketEdges(sSpans[i][1].trim(), inner.trim());
        if (filled === null) return;
        const at = m.index + m[0].indexOf('>') + 1;
        result += out.slice(last, at) + lead + filled + trail;
        last = at + inner.length;
        changed = true;
    });
    return changed ? result + out.slice(last) : value;
}

/** 저장된 번역문에 풀리지 못하고 남은 자리표시자를 걷는다 (원문에 그런 글이 없을 때만) — 보여 줄 때 고치기용 */
export function dropLeftoverPlaceholders(text, source) {
    const value = String(text ?? '');
    if (/__VAR_|__변수_/.test(String(source ?? ''))) return value;
    return value.replace(PLACEHOLDER_VARIANT, '');
}
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TAG_TOKEN = /<(\/?)([a-zA-Z][\w:-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
const PARA_SPLIT = /(\n[\t ]*\n(?:[\t ]*\n)*)/;
/** 짝을 이루는 태그만 (빈 요소 · <x/> 는 뺀다) → [{ close, name, raw, at, end }] */
function tagTokens(text) {
    const out = [];
    for (const m of String(text).matchAll(TAG_TOKEN)) {
        const name = m[2].toLowerCase();
        if (VOID_TAGS.has(name) || /\/\s*$/.test(m[3])) continue;
        out.push({ close: Boolean(m[1]), name, raw: m[0], at: m.index, end: m.index + m[0].length });
    }
    return out;
}
const countBy = list => { const map = new Map(); for (const t of list) map.set(t.name, (map.get(t.name) || 0) + 1); return map; };
/** 원문이 짝이 맞게 열고 닫혔나 (맞지 않으면 무엇이 맞는지 몰라 고치지 않는다) */
function wellFormed(tags) {
    const stack = [];
    for (const t of tags) {
        if (!t.close) stack.push(t.name);
        else if (stack.pop() !== t.name) return false;
    }
    return stack.length === 0;
}
/** 문단 앞머리 태그 줄(글자 앞 · 공백만 사이에 둔 태그들) */
function leadingTags(text, tags) {
    const run = []; let at = /^\s*/.exec(text)[0].length;
    for (const t of tags) { if (t.at !== at) break; run.push(t); at = t.end + /^\s*/.exec(text.slice(t.end))[0].length; }
    return run;
}
/** 번역 문단 하나를 고친다. stack: 앞 문단에서 열린 채 넘어온 태그(고친다) · src: 같은 자리 원문 문단(문단 수가 같을 때) · spanning: 원문에서 문단을 넘는 태그 이름 */
function repairBody(body, stack, src, spanning) {
    let text = body;
    // 1) 원문 문단 앞머리에 있는 여는 태그가 번역 문단에 하나도 없으면 원문의 그 태그를 같은 자리(앞머리)에 넣는다
    if (src) {
        const have = countBy(tagTokens(text).filter(t => !t.close)), srcLead = leadingTags(src.text, src.tags);
        srcLead.forEach((t, p) => {
            if (t.close || have.get(t.name)) return;
            const lead = leadingTags(text, tagTokens(text)), before = srcLead[p - 1];
            const anchor = before ? lead.find(x => x.name === before.name && x.close === before.close) : null;
            const at = anchor ? anchor.end : /^\s*/.exec(text)[0].length;
            text = text.slice(0, at) + t.raw + text.slice(at);
            have.set(t.name, 1);
        });
    }
    // 2) 차례로 짝을 본다: 안쪽에 열린 채 남은 태그는 바깥 태그를 닫기 전에 닫고, 열린 적 없는 닫는 태그는 뺀다.
    //    원문 문단이 여기서 닫지 않는 태그는 닫지 않는다 (예: 문단을 넘는 </prose> 를 일찍 닫은 번역). 모델이 원문보다 더 연 태그는 제 짝대로 둔다
    const budget = src ? countBy(src.tags.filter(t => t.close)) : null, opens = src ? countBy(src.tags.filter(t => !t.close)) : null;
    const spend = name => { if (budget?.has(name)) budget.set(name, budget.get(name) - 1); };
    let result = '', last = 0;
    for (const t of tagTokens(text)) {
        result += text.slice(last, t.at); last = t.end;
        if (!t.close) {
            const extra = Boolean(opens) && !(opens.get(t.name) > 0);
            if (opens?.has(t.name)) opens.set(t.name, opens.get(t.name) - 1);
            stack.push({ name: t.name, raw: t.raw, extra }); result += t.raw; continue;
        }
        let where = -1;
        for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === t.name) { where = k; break; }
        if (where < 0 || (budget && !stack[where].extra && !(budget.get(t.name) > 0))) continue;
        while (stack.length - 1 > where) { const inner = stack.pop(); result += `</${inner.name}>`; spend(inner.name); }
        stack.pop(); result += t.raw; spend(t.name);
    }
    result += text.slice(last);
    // 3) 문단 끝: 원문은 이 문단에서 닫았는데 번역에선 열린 채인 태그를 (안쪽부터) 닫는다
    let keep;
    if (src) { keep = 0; while (keep < stack.length && keep < src.open.length && stack[keep].name === src.open[keep]) keep++; }
    else { keep = stack.length; for (let k = 0; k < stack.length; k++) if (!spanning.has(stack[k].name)) { keep = k; break; } }
    if (stack.length > keep) {
        let closes = '';
        while (stack.length > keep) closes += `</${stack.pop().name}>`;
        result = result.replace(/\s*$/, tail => closes + tail);
    }
    return result;
}
/**
 * 번역문의 태그 짝을 원문 구조대로 맞춘다 → 고친 글 (고칠 게 없거나 원문 태그가 짝이 안 맞으면 받은 글 그대로).
 * 문단 수가 원문과 같으면 문단마다: 빠진 앞머리 여는 태그 넣기 · 빠진 닫는 태그를 그 문단 끝에 · 남는(열린 적 없는) 닫는 태그 빼기 · 꼬인 순서 바로잡기.
 * 문단 수가 다르면: 원문에서 한 문단 안에서만 열고 닫는 태그(<true_thoughts> · <span> …)는 열린 그 문단 끝에서 닫고, 남는 닫는 태그만 뺀다.
 * 코드 블록 · HTML 주석이 있는 글은 건드리지 않는다.
 */
// A truncated inline colour opener can swallow the following dialogue as an
// attribute. Recover only a prefix of a real source tag immediately before an
// opening dialogue quote. Older repairs may already have inserted that opener.
function repairTruncatedColourTags(sourceTags, output) {
    const openers = new Map();
    for (const tag of sourceTags) {
        if (tag.close || tag.name !== 'span') continue;
        const match = /^(<span\s+style=["']color:\s*#[\da-f]{3,8})(["']>)$/i.exec(tag.raw);
        if (match) openers.set(match[1].toLowerCase(), tag.raw);
    }
    return output.replace(/<span\s+style=["']color:\s*#[\da-f]{3,8}(?=[「『])/gi, (prefix, at, text) => {
        const opener = openers.get(prefix.toLowerCase());
        if (!opener) return prefix;
        // Do not leave two opens around a single translated dialogue.
        return text.slice(0, at).endsWith(opener) ? '' : opener;
    });
}
export function repairTagPairs(source, output) {
    const original = String(output ?? '');
    const src = String(source ?? '').replace(/\r\n?/g, '\n');
    let out = original.replace(/\r\n?/g, '\n');
    if (!/<[a-zA-Z]/.test(src) || !/[<\]]/.test(out) || /```|~~~|<!--/.test(src) || /```|~~~|<!--/.test(out)) return original;
    const srcTags = tagTokens(src);
    if (!srcTags.length || !wellFormed(srcTags)) return original;
    const repairedOpeners = repairTruncatedColourTags(srcTags, out);
    const openerChanged = repairedOpeners !== out;
    out = repairedOpeners;
    const sParts = src.split(PARA_SPLIT), oParts = out.split(PARA_SPLIT), aligned = sParts.length === oParts.length;
    const spanning = new Set(), opened = [], sources = [];
    for (let i = 0; i < sParts.length; i += 2) {
        const tags = tagTokens(sParts[i]);
        for (const t of tags) { if (t.close) opened.pop(); else opened.push(t.name); }
        opened.forEach(name => spanning.add(name));
        sources.push({ text: sParts[i], tags, open: [...opened] });
    }
    const stack = [];
    let changed = openerChanged;
    for (let i = 0; i < oParts.length; i += 2) {
        const fixed = repairBody(oParts[i], stack, aligned ? sources[i / 2] : null, spanning);
        if (fixed !== oParts[i]) { oParts[i] = fixed; changed = true; }
    }
    if (stack.length) { // 원문은 끝에서 다 닫혔다 — 번역에 남은 것도 닫는다
        let closes = '';
        while (stack.length) closes += `</${stack.pop().name}>`;
        const lastBody = oParts.length - 1 - ((oParts.length - 1) % 2);
        oParts[lastBody] = oParts[lastBody].replace(/\s*$/, tail => closes + tail);
        changed = true;
    }
    return changed ? oParts.join('') : original;
}
