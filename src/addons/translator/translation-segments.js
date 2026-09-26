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
    // 5.4.1: 통짜 · 덩이 · 평문 재시도 답도 먼저 원문 되풀이(원문+화살표+번역 · ⟦n …] 표시)를 걷는다 — 세 경로가 모두 이 함수를 지난다
    const src = String(source ?? ''), out = removeSourceEcho(src, String(output ?? ''));
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
const MARK_ALT = /^[ \t]*【\s*(\d+)\s*】[ \t]*[:：]?[ \t]*/; // 모델이 괄호를 바꿔 쓴 답 — 원래 표시가 하나도 없을 때만 (본문의 각주 【1】 과 헷갈리지 않게)
const SQUARE_MARK = /^[ \t]*\[[ \t]*(\d+)[ \t]*\][ \t]*[:：]?[ \t]*/; // 5.4.1: [3] — ⟦ · 【 가 하나도 없을 때 (⟦ 답 안에서는 바로 다음 번호일 때만)
export const BATCH_HEADER = '[Translate every numbered passage below using the translation instructions above. Each passage starts with a marker like ⟦3⟧. Keep every marker exactly as it is at the start of its translated passage, translate the passage after it completely, keep markup and placeholders, and do not merge, split, reorder, add or drop passages.]\n\n';
export function batchPayload(bodies) {
    return BATCH_HEADER + bodies.map((text, id) => `⟦${id}⟧ ${text}`).join('\n\n');
}
export function batchPayloadLegacy(bodies) {
    return '[Translate every numbered passage below using the translation instructions above. Each passage starts with a marker like ⟦3⟧. Keep every marker exactly as it is at the start of its translated passage, translate the passage after it completely, keep markup and placeholders, and do not merge, split, reorder, add or drop passages.]\n\n' +
        bodies.map((text, id) => `⟦${id}⟧ ${text}`).join('\n\n');
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
/** 평문 답: 앞의 "Here is the translation:" 같은 한 줄 머리말과 꼬리 메모를 걷는다 (머리말이 문단 하나로 세어져 자리가 밀리지 않게).
 *  5.3.6: source(보낸 원문)를 주면 견준다 — 원문 첫 문단이 같은 꼴이면 머리말로 보지 않고, 꼬리 메모는 stripTrailingNote 규칙대로. */
export function stripReplyWrapping(text, source) {
    let out = String(text ?? '').replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const first = /^([^\n]*)\n[\t ]*\n/.exec(out);
    const srcFirst = source == null ? '' : paragraphsOf(source)[0] ?? '';
    if (first && PREAMBLE_BLOCK.test(first[1].trim()) && !PREAMBLE_BLOCK.test(srcFirst)) out = out.slice(first[0].length).replace(/^\s*\n/, '');
    out = stripTrailingNote(out, source).trim();
    return source == null ? out : removeSourceEcho(source, out).trim(); // 5.4.1
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
const echoKey = text => String(text ?? '').normalize('NFKC').replace(/<[^>]*>|\[\[__VAR_\d+__\]\]/g, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
const SCRIPTS = [['hangul', /\p{Script=Hangul}/gu], ['cjk', /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu], ['latin', /\p{Script=Latin}/gu], ['cyrillic', /\p{Script=Cyrillic}/gu]];
/** 가장 많은 글자 갈래 (원문 언어 ≠ 번역 언어인지 가늠 — 번역 언어를 몰라도 된다) */
const scriptOf = key => {
    let best = '', most = 0;
    for (const [name, pattern] of SCRIPTS) { const n = (key.match(pattern) || []).length; if (n > most) { best = name; most = n; } }
    return best;
};
/** 덩이 앞머리가 원문 문단 하나를 통째로 베낀 것이면(뒤에 화살표, 또는 줄바꿈 뒤 다른 글자의 번역) 번역만 돌려준다.
 *  원문+화살표뿐이면 '' (그 덩이를 뺀다), 해당 없으면 null. keys: 원문 문단 키 모음 */
function cutEcho(block, keys, longest) {
    for (const cut of block.matchAll(ECHO_CUT)) {
        const head = echoKey(block.slice(0, cut.index));
        if (head.length > longest) break;
        if (head.length < 12 || !keys.has(head)) continue;
        const tail = block.slice(cut.index), arrow = ECHO_ARROW_HEAD.test(tail);
        const rest = tail.replace(ECHO_HEAD, ''), restKey = echoKey(rest);
        if (!restKey) return arrow && !rest.trim() ? '' : null; // 원문+화살표뿐인 덩이만 뺀다 (화살표 뒤 태그만 남는 "A → B → `<prose>`" 는 원문 그대로)
        if (arrow || (head.length >= 20 && !keys.has(restKey) && scriptOf(restKey) !== scriptOf(head))) return rest;
        return null;
    }
    return null;
}
/** 5.4.1: 답에서 원문 되풀이를 걷는다 — 줄머리의 모양 망가진 ⟦n …] 표시(원문에 ⟦ 가 없을 때), 원문 문단+화살표+번역의 앞 원문,
 *  원문 문단 그대로인 덩이+빈 줄+다른 글자의 번역 (답 덩이가 원문 문단보다 많을 때 넘친 수만큼만). 걷을 게 없으면 같은 글을 돌려준다. */
export function removeSourceEcho(source, output) {
    const src = String(source ?? ''), out = String(output ?? '');
    if (!src.trim() || !out.trim()) return out;
    const paras = paragraphsOf(src), keys = new Set(paras.map(echoKey).filter(k => k.length >= 12));
    const longest = Math.max(0, ...[...keys].map(k => k.length));
    const blocks = out.split(/(\n[\t ]*\n(?:[\t ]*\n)*)/);
    let changed = false;
    for (let i = 0; i < blocks.length; i += 2) {
        let block = blocks[i];
        if (!src.includes('⟦')) block = block.replace(LOOSE_MARK_LINES, '$1');
        const cut = keys.size ? cutEcho(block, keys, longest) : null;
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
        if (key.length >= 20 && keys.has(key) && next && !keys.has(next) && scriptOf(next) !== scriptOf(key)) { blocks[content[n]] = ''; extra--; changed = true; }
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
    const cleaned = removeSourceEcho(source, answer).replace(/^\n+|\s+$/g, '');
    return !cleaned.trim() || echoesSource(cleaned, source) ? null : cleaned;
}
const FAIL_BLOCK = /^\[[^\n\]]*원문 그대로\]/;
/** 5.4.1: 메시지 번역(캐시에 넣을 · 캐시에서 꺼낸 글)이 원문 되풀이를 품었나 — 걷을 게 있거나, 어느 덩이가 원문 문단을 길게 베꼈으면 참 */
export function hasSourceEcho(source, output) {
    const out = String(output ?? '');
    if (!out.trim() || !String(source ?? '').trim()) return false;
    if (removeSourceEcho(source, out) !== out) return true;
    const paras = paragraphsOf(source).filter(p => echoKey(p).length >= 40);
    if (!paras.length) return false;
    return paragraphsOf(out).some(block => !FAIL_BLOCK.test(block) && paras.some(p => echoesSource(block, p)));
}
/** meta.renumbered: 1부터 다시 매긴 답을 한 칸 내려 받았다 (문단 하나를 빼먹고 끝에 지어낸 답과 구별이 안 돼 캐시에 넣지 않는다)
 *  5.3.7: sources(보낸 원문 문단 배열)를 주면 꼬리 메모를 원문 문단과 견줘 걷는다 — 원문에 있는 상태창 · 메모 줄은 번역이다 */
export function parseBatchResult(raw, count, meta = {}, sources) {
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
        let body = stripTrailingNote(found.get(i), sources?.[i]).replace(/^\n+|\s+$/g, ''); // 빈 줄만 걷고 첫 줄 들여쓰기(코드 · 목록)는 둔다
        if (!body) fail();
        // 5.4.1: 원문+화살표+번역이면 번역만, 그래도 원문을 길게 베껴 품었으면 형식 오류 (통짜로 한 번 다시)
        if (sources?.[i] != null) body = cleanParagraphEcho(body, sources[i]) ?? fail();
        return body;
    });
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
        // 5.4.1: 예전에 캐시에 들어간 원문 되풀이 답(원문+화살표+번역 · 망가진 ⟦n] 표시)은 없는 셈 치고 다시 요청한다
        if (saved.has(key) && cleanParagraphEcho(saved.get(key), body) === saved.get(key).replace(/^\n+|\s+$/g, '')) { output[i] = saved.get(key); reused++; continue; }
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
