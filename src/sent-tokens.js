// 메시지 머리 토큰 수 누르면 내역 (7.0.3 「· 보냄 N」 → 7.0.4 누를 때만): 머리에는 실리태번 숫자(token_count = 생각 + 본문)만 둔다.
// 숫자를 누르면(폰은 톡) 그 메시지 몫을 한 줄씩:
//   생각 A + 본문 B = 총 C t   (생각이 없으면 「본문 B t」) — A · B 는 같은 토크나이저(getTokenCountAsync)로, C 는 실리태번 숫자 그대로
//   다음 프롬에 들어가는 양 D t (본문보다 적으면 「(프롬용 정규식이 본문에서 B−D t 뺌)」) — D = 프롬프트용 정규식(깊이) → 매크로 뒤 본문, 생각 빠짐
//   숨긴(is_system) 메시지는 「숨긴 메시지라 프롬에 0t」. 머리의 작은 「· 숨김」은 CSS(.mes[is_system="true"]) 만.
// 7.0.3 은 보이는 메시지마다 쉬는 시간에 D 를 세어 머리에 붙였으나, 이제 누를 때만 센다(같은 글 · 깊이 · 정규식 목록이면 기억해 둔 값).
// 깊이 = 숨기지 않은 메시지 중 뒤에서 센 자리(실리태번 Generate 와 같음).
// 설정: 채팅 › 화면 「토큰 수 누르면 내역」 (chat.sentTokens — 열쇠 이름은 7.0.3 그대로, 기본 켬). 켜면 body.bl-sent-tokens.
import { groupedNumber } from './numbers.js';

const CACHE_MAX = 600;
const BODY_CLASS = 'bl-sent-tokens';

/** 글 해시 (FNV-1a) — 열쇠용 */
export function textHash(text) {
    const s = String(text ?? '');
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return `${(h >>> 0).toString(36)}.${s.length}`;
}

/** 숨기지 않은 메시지의 깊이 (메시지 번호 → 뒤에서 센 자리, 마지막 = 0) */
export function promptDepths(chat) {
    const depths = new Map();
    let depth = 0;
    for (let i = (chat?.length || 0) - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message || message.is_system) continue;
        depths.set(i, depth++);
    }
    return depths;
}

export function cacheKey(message, depth, stamp = '') {
    return `${message?.is_user ? 'u' : 'a'}|${depth}|${textHash(message?.mes)}|${stamp}`;
}

/** 다음 프롬프트에 들어갈 글 (실리태번 Generate: 프롬프트용 정규식(깊이) → 매크로). regex 가 없으면 원문 */
export function sentText(message, depth, { regex = null, substitute = null } = {}) {
    let text = String(message?.mes ?? '');
    const place = regex?.regex_placement;
    if (regex?.getRegexedString && place) text = regex.getRegexedString(text, message.is_user ? place.USER_INPUT : place.AI_OUTPUT, { isPrompt: true, depth });
    if (typeof substitute === 'function') text = substitute(text);
    return String(text ?? '');
}

const num = value => groupedNumber(Math.max(0, Math.round(Number(value) || 0)));

/** 내역 줄 — reasoning = A, body = B, total = C(실리태번 숫자), sent = D */
export function tokenLines({ reasoning = 0, body = 0, total = 0, sent = 0, hidden = false } = {}) {
    const first = reasoning > 0 ? `생각 ${num(reasoning)} + 본문 ${num(body)} = 총 ${num(total)}t` : `본문 ${num(body)}t`;
    if (hidden) return [first, '숨긴 메시지라 프롬에 0t'];
    const cut = Math.round(body) - Math.round(sent);
    return [first, `다음 프롬에 들어가는 양 ${num(sent)}t${cut > 0 ? ` (프롬용 정규식이 본문에서 ${num(cut)}t 뺌)` : ''}`];
}

let on = false, regexMod = null;
const cache = new Map();
const context = () => globalThis.SillyTavern?.getContext?.();
function loadRegex() {
    regexMod ??= import(new URL('../../../../extensions/regex/engine.js', import.meta.url).href).catch(() => null);
    return regexMod;
}
// 정규식 목록이 바뀌면 다른 결과 — id · 켜짐 · 고친 글 길이만으로 짧은 표
function regexStamp(regex) {
    try {
        const list = regex?.getRegexScripts?.() || [];
        return textHash(list.map(x => `${x.id}:${x.disabled ? 0 : 1}:${x.promptOnly ? 1 : 0}:${x.minDepth ?? ''}-${x.maxDepth ?? ''}:${String(x.findRegex ?? '').length}:${String(x.replaceString ?? '').length}`).join(','));
    } catch { return ''; }
}
function remember(key, value) {
    cache.set(key, value);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return value;
}
async function count(ctx, text, key = `t|${textHash(text)}`) {
    if (!text) return 0;
    if (cache.has(key)) return cache.get(key);
    return remember(key, Number(await ctx.getTokenCountAsync(text, 0)) || 0);
}

/** 메시지 하나의 내역 줄 (누를 때 부른다) — 못 세면 null */
export async function breakdown(id, shown = '') {
    const ctx = context(), message = ctx?.chat?.[id];
    if (!message || typeof ctx.getTokenCountAsync !== 'function') return null;
    const reasoning = await count(ctx, String(message.extra?.reasoning ?? ''));
    const body = await count(ctx, String(message.mes ?? ''));
    const total = Number(message.extra?.token_count) || Number(String(shown).replace(/[^\d]/g, '')) || reasoning + body;
    if (message.is_system) return tokenLines({ reasoning, body, total, hidden: true });
    const regex = await loadRegex();
    const depth = promptDepths(ctx.chat).get(id) ?? 0;
    const substitute = typeof ctx.substituteParams === 'function' ? text => ctx.substituteParams(text) : null;
    const sent = await count(ctx, sentText(message, depth, { regex, substitute }), `s|${cacheKey(message, depth, regexStamp(regex))}`);
    return tokenLines({ reasoning, body, total, sent });
}

const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function onClick(event) {
    const counter = event.target.closest?.('#chat .mes .tokenCounterDisplay');
    if (!on || !counter || !counter.textContent.trim()) return;
    const id = Number(counter.closest('.mes')?.getAttribute('mesid'));
    if (!Number.isFinite(id)) return;
    let lines = null;
    try { lines = await breakdown(id, counter.textContent); } catch (error) { console.warn('[Blue Lemonade] 토큰 내역', error); }
    if (!lines) return;
    // 실리태번 toastr 는 글을 이스케이프한다 — 줄바꿈만 쓰려고 직접 이스케이프한 줄을 <br> 로
    globalThis.toastr?.info?.(lines.map(escapeHtml).join('<br>'), `#${id} 토큰`, { escapeHtml: false, timeOut: 8000, preventDuplicates: true });
}

export function syncSentTokens(enabled) {
    on = !!enabled;
    // 8.2.7 표식은 body 대신 html 에 — body class 기록마다 실리태번 keyboard.js 가 body 아래 전부를 다시 훑고 body 를 보는 테마 감시자도 다시 돌았어요
    document.documentElement?.classList.toggle(BODY_CLASS, on);
    const chatEl = document.getElementById('chat');
    chatEl?.removeEventListener('click', onClick);
    if (on) chatEl?.addEventListener('click', onClick);
}

/** 시험용 */
export const _forTest = { cache, onClick };
