// AI 로 설정 바꾸기 (10-31, 기본 꺼짐) — 채팅 › 기타 「AI 로 설정 바꾸기」를 켠 사람이 검색창의 「AI 에게 맡기기」를 눌렀을 때만 받아요.
//   보내는 것: 검색창 문장 + 바꿀 수 있는 설정 목록(키 · 이름 · 지금 값 · 쓸 수 있는 값). 대화 · 캐릭터 · 페르소나 · 키는 보내지 않아요.
//   받는 것: JSON 변경 목록 → 목록 밖 키 · 범위 밖 값은 버리고 미리보기로만 보여 줘요. 바꾸는 것은 사용자가 「적용」을 누를 때(settings-search.js).
import { SEARCH_ENTRIES, quickAllowed, quickText } from './settings-search.js';
import { QUICK } from './settings-intents.js';
import { MARKDOWN_CONTROLS } from './markdown.js';

const MAX_CHANGES = 12, RESPONSE_TOKENS = 800;
const aiAllowed = path => quickAllowed(path) && !path.startsWith('searchAi.');

/** AI 가 바꿀 수 있는 설정: 결과 줄 조작 표(QUICK) · 마크다운 고르기 · 검색 목록의 켬/끔 */
export function allowList(read) {
    const list = [], seen = new Set();
    const add = item => { if (!seen.has(item.path) && aiAllowed(item.path)) { seen.add(item.path); list.push(item); } };
    for (const [path, q] of Object.entries(QUICK)) {
        if (q.num && typeof read(path) !== 'number') continue;
        add(q.num ? { path, label: q.label, kind: 'num', min: q.num[0], max: q.num[1], step: q.num[2], unit: q.unit || '' } : { path, label: q.label, kind: 'options', options: q.options });
    }
    for (const c of MARKDOWN_CONTROLS) add({ path: `markdown.${c.key}`, label: `마크다운 ${c.label}`, kind: 'options', options: c.options });
    for (const e of SEARCH_ENTRIES) if (e.path && typeof read(e.path) === 'boolean') add({ path: e.path, label: e.title, kind: 'bool' });
    return list;
}

const SYSTEM = 'SillyTavern 테마 Blue Lemonade 의 설정 도우미예요. 사용자의 요청을 아래 목록의 설정 변경으로 옮겨요. '
    + 'JSON 하나만 답해요: {"changes":[{"key":"설정 키","value":값}]}. 목록에 없는 키, 적힌 범위 · 값 밖의 값은 쓰지 않아요. '
    + '요청과 관계없는 설정은 건드리지 않아요. 바꿀 것이 없으면 {"changes":[]}.';
const allowed = item => item.kind === 'bool' ? 'true/false' : item.kind === 'num' ? `${item.min}~${item.max}${item.unit}` : item.options.map(([v, label]) => `${v}=${label}`).join(', ');
const shown = value => value === null || value === undefined ? '기본' : typeof value === 'number' ? String(Number(value.toFixed(4))) : String(value);
export function buildMessages(sentence, list, read) {
    const lines = list.map(item => `${item.path} | ${item.label} | ${shown(read(item.path))} | ${allowed(item)}`);
    return [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `설정 목록 (키 | 이름 | 지금 값 | 쓸 수 있는 값)\n${lines.join('\n')}\n\n요청: ${String(sentence).replace(/\s+/g, ' ').trim().slice(0, 300)}` },
    ];
}

// 응답에서 JSON 하나 꺼내기: 코드 울타리(```json) · 앞뒤 말 · 생각 칸이 붙어 와도
function extractJson(text) {
    const body = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
    try { return JSON.parse(body); } catch { /* 아래에서 잘라 봐요 */ }
    for (const [open, close] of [['{', '}'], ['[', ']']]) {
        const start = body.indexOf(open), end = body.lastIndexOf(close);
        if (start >= 0 && end > start) { try { return JSON.parse(body.slice(start, end + 1)); } catch { /* 다음 */ } }
    }
    return null;
}
const TRUE = new Set(['true', 'on', '켜기', '켬', '켜짐', 'yes', '1']), FALSE = new Set(['false', 'off', '끄기', '끔', '꺼짐', 'no', '0']);
function coerce(item, value) {
    if (item.kind === 'bool') {
        if (typeof value === 'boolean') return value;
        const word = String(value ?? '').trim().toLowerCase();
        return TRUE.has(word) ? true : FALSE.has(word) ? false : undefined;
    }
    if (item.kind === 'options') {
        const word = String(value ?? '').trim();
        return item.options.find(([v, label]) => String(v) === word || label === word)?.[0];
    }
    const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*-?\d+(?:\.\d+)?\s*[a-z%]*\s*$/i.test(value) ? parseFloat(value) : NaN;
    return Number.isFinite(n) && n >= item.min && n <= item.max ? Number(n.toFixed(4)) : undefined;
}
/** AI 응답 → { changes: [{ path, label, before, value, beforeText, afterText }], dropped } — 목록 밖 키 · 범위 밖 값은 dropped 로만 세요 */
export function parseChanges(text, list, read) {
    const byPath = new Map(list.map(item => [item.path, item]));
    const data = extractJson(text);
    const items = Array.isArray(data) ? data
        : Array.isArray(data?.changes) ? data.changes
            : data && typeof data === 'object' ? Object.entries(data).filter(([key]) => !['changes', 'note', 'reason'].includes(key)).map(([key, value]) => ({ key, value }))
                : [];
    const changes = [], seen = new Set();
    let dropped = 0;
    for (const raw of items.slice(0, 60)) {
        const key = raw && typeof raw === 'object' ? raw.key ?? raw.path ?? raw.setting : undefined;
        const item = typeof key === 'string' ? byPath.get(key.trim()) : undefined;
        const value = item ? coerce(item, raw.value) : undefined;
        if (!item || value === undefined) { dropped++; continue; }
        if (seen.has(item.path)) continue;
        seen.add(item.path);
        const before = read(item.path);
        if (Object.is(before, value) || String(before) === String(value) && typeof before === typeof value) continue;
        changes.push({ path: item.path, label: item.label, before, value, beforeText: quickText(item, before), afterText: quickText(item, value) });
    }
    return { changes: changes.slice(0, MAX_CHANGES), dropped: dropped + Math.max(0, changes.length - MAX_CHANGES) };
}

/** 요청 한 번의 토큰 수 (실리태번 토크나이저 · 없으면 글자 수로 어림) */
export async function countTokens(messages) {
    const text = messages.map(m => m.content).join('\n');
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        if (typeof ctx?.getTokenCountAsync === 'function') return await ctx.getTokenCountAsync(text);
    } catch { /* 어림으로 */ }
    return Math.ceil(text.length / 2);
}
/** 설정 창에 보이는 「요청 한 번 약 N 토큰」 (보기 문장으로 센 값) */
export const requestTokens = read => countTokens(buildMessages('글씨를 조금 크게, 밤에 눈부시지 않게', allowList(read), read));

// 실리태번 지금 연결(generateRaw) 또는 고른 연결 프로필로 한 번 — 프리셋 · 대화는 붙이지 않아요
async function sendToSillyTavern(messages, { profileId, signal }) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx) throw new Error('실리태번 연결을 찾지 못했어요');
    let request;
    if (profileId) {
        const service = ctx.ConnectionManagerRequestService;
        if (typeof service?.sendRequest !== 'function') throw new Error('연결 프로필을 쓸 수 없어요');
        request = service.sendRequest(profileId, messages, RESPONSE_TOKENS, { stream: false, signal, extractData: true, includePreset: false })
            .then(result => typeof result === 'string' ? result : result?.content ?? '');
    } else {
        if (typeof ctx.generateRaw !== 'function') throw new Error('실리태번 생성 함수를 찾지 못했어요');
        request = ctx.generateRaw({ prompt: messages, responseLength: RESPONSE_TOKENS, trimNames: false });
    }
    // 지금 연결(generateRaw)은 끊을 수 없어 멈추면 기다리지만 않아요
    return await Promise.race([request, new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('멈췄어요')), { once: true }))]);
}

/** 검색창 문장 하나로 AI 에게 한 번 묻기 — 바꾸지는 않아요(미리보기 거리만 돌려줘요) */
export async function askSettingsAi({ sentence, read, profileId = '', send = null, signal = null, onTokens = null }) {
    const list = allowList(read);
    const messages = buildMessages(sentence, list, read);
    const tokens = await countTokens(messages);
    onTokens?.(tokens);
    signal?.throwIfAborted?.();
    const text = await (send || sendToSillyTavern)(messages, { profileId, signal });
    return { ...parseChanges(text, list, read), tokens };
}
