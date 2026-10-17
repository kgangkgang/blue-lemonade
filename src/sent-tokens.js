// 7.0.3 메시지 머리 토큰 두 숫자: 실리태번 숫자(만든 양 = 생각 + 본문, token_count)는 그대로 두고, 옆에 「· 보냄 3,994t」 —
// 다음 답 프롬프트에 그 메시지가 다시 들어가는 양의 추정(프롬프트 전용 정규식 · 매크로를 거친 본문, 생각은 빠짐). 숨긴(is_system) 메시지는 「보냄 0t · 숨김」.
// 그리기: 실리태번 .tokenCounterDisplay 에 data-bl-sent 만 달고 글은 CSS(css/05-chat.css) ::after 가 붙인다 — 실리태번이 .text() 로 숫자를 바꿔도 남는다.
// 계산: 화면에 보이는 메시지만(앞뒤 조금), 쉬는 시간(requestIdleCallback)에. 결과는 (사용자 · 깊이 · 글 해시 · 정규식 목록 표) 열쇠로 기억해
// 긴 채팅을 넘겨 보거나 같은 화면으로 돌아와도 다시 세지 않는다. 깊이 = 숨기지 않은 메시지 중 뒤에서 센 자리(실리태번 Generate 와 같음).
// 누르면(폰은 톡) 한 줄 설명. 설정: 채팅 › 화면 「메시지 토큰에 보낸 양도」 (chat.sentTokens, 기본 켬)
import { groupedNumber } from './numbers.js';

const MARGIN = 400;       // 화면 위아래로 이만큼 더 (넘기자마자 비어 보이지 않게)
const CACHE_MAX = 600;
const EXPLAIN = '앞 숫자 = 만든 양(생각 + 본문) · 보냄 = 다음 답 프롬프트에 다시 보내는 양 추정(프롬프트용 정규식 · 매크로 뒤 본문, 생각 빠짐) · 숨긴 메시지는 0';

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

/** 표시 글 — data-bl-sent 값 */
export function sentLabel(tokens, hidden = false) {
    return hidden ? '0t · 숨김' : `${groupedNumber(Math.max(0, Math.round(Number(tokens) || 0)))}t`;
}

/** 보이는 .mes (위아래 margin 포함) — 메시지는 위에서 아래로 놓여 있어 첫 칸을 반으로 나눠 찾는다(긴 채팅에서도 위치 읽기 몇 번) */
export function visibleMessages(chatEl, margin = MARGIN) {
    const list = chatEl?.querySelectorAll?.('.mes') || [];
    if (!list.length) return [];
    const box = chatEl.getBoundingClientRect(), top = box.top - margin, bottom = box.bottom + margin;
    let lo = 0, hi = list.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid].getBoundingClientRect().bottom <= top) lo = mid + 1; else hi = mid; }
    const out = [];
    for (let i = lo; i < list.length; i++) { if (list[i].getBoundingClientRect().top >= bottom) break; out.push(list[i]); }
    return out;
}

let on = false, bound = false, timer = 0, idle = 0, scrollTimer = 0, regexMod = null, observer = null, running = false, again = false;
const cache = new Map();
const offs = [];
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

function schedule(delay = 120) {
    if (!on) return;
    clearTimeout(timer); timer = setTimeout(() => {
        // 쉬는 시간에 (숨은 탭에서도 timeout 으로 돈다)
        if (typeof requestIdleCallback === 'function') { globalThis.cancelIdleCallback?.(idle); idle = requestIdleCallback(() => void run(), { timeout: 1500 }); }
        else void run();
    }, delay);
}

async function run() {
    if (!on) return;
    if (running) { again = true; return; }
    running = true;
    try {
        const ctx = context(), chatEl = document.getElementById('chat');
        if (!ctx?.chat || !chatEl) return;
        const regex = await loadRegex();
        const stamp = regexStamp(regex), depths = promptDepths(ctx.chat);
        const substitute = typeof ctx.substituteParams === 'function' ? text => ctx.substituteParams(text) : null;
        for (const el of visibleMessages(chatEl)) {
            if (!on) return;
            const counter = el.querySelector('.tokenCounterDisplay');
            const id = Number(el.getAttribute('mesid')), message = ctx.chat[id];
            if (!counter || !message || !Number.isFinite(id)) continue;
            if (message.is_system) { setLabel(counter, sentLabel(0, true)); continue; }
            const depth = depths.get(id) ?? 0, key = cacheKey(message, depth, stamp);
            let tokens = cache.get(key);
            if (tokens === undefined) {
                try { tokens = await ctx.getTokenCountAsync(sentText(message, depth, { regex, substitute }), 0); }
                catch { continue; }
                cache.set(key, tokens);
                if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
            }
            setLabel(counter, sentLabel(tokens));
        }
    } finally {
        running = false;
        if (again) { again = false; schedule(); }
    }
}

function setLabel(counter, text) {
    if (counter.dataset.blSent !== text) counter.dataset.blSent = text;
}

function onClick(event) {
    const counter = event.target.closest?.('#chat .mes .tokenCounterDisplay[data-bl-sent]');
    if (!counter) return;
    globalThis.toastr?.info?.(EXPLAIN, '토큰', { timeOut: 5000, preventDuplicates: true });
}

function onScroll() { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => schedule(0), 200); }

export function syncSentTokens(enabled) {
    on = !!enabled;
    if (!on) {
        clearTimeout(timer); clearTimeout(scrollTimer);
        for (const off of offs.splice(0)) off();
        observer?.forEach(o => o.disconnect()); observer = null; bound = false;
        document.querySelectorAll('#chat .tokenCounterDisplay[data-bl-sent]').forEach(el => { delete el.dataset.blSent; });
        return;
    }
    if (!bound) {
        bound = true;
        try {
            const { eventSource, event_types: types } = context();
            const listen = (name, fn) => { if (types?.[name]) { eventSource.on(types[name], fn); offs.push(() => eventSource.removeListener?.(types[name], fn)); } };
            const later = () => schedule();
            for (const name of ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'GENERATION_ENDED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MORE_MESSAGES_LOADED']) listen(name, later);
            // 정규식 · 프리셋이 바뀌면 열쇠의 정규식 표가 달라져 저절로 다시 센다 — 그래도 보이는 칸은 바로 다시
            for (const name of ['SETTINGS_UPDATED', 'OAI_PRESET_CHANGED_AFTER', 'PRESET_CHANGED']) listen(name, later);
        } catch { /* 이벤트를 못 걸면 넘길 때만 */ }
        const chatEl = document.getElementById('chat');
        chatEl?.addEventListener('scroll', onScroll, { passive: true });
        chatEl?.addEventListener('click', onClick);
        offs.push(() => { chatEl?.removeEventListener('scroll', onScroll); chatEl?.removeEventListener('click', onClick); });
        // 숨기기 · 숨김 풀기(/hide)는 이벤트 없이 .mes 의 is_system 속성만 바뀌고, 채팅을 다시 그리는 길 중엔 이벤트 없이 .mes 만 붙는 것도 있다
        // (#chat 바로 아래 자식만 봄 — 스트리밍 중 글자 바뀜은 안 걸린다)
        if (chatEl && typeof MutationObserver === 'function') {
            // 같은 관찰자로 같은 칸을 두 번 observe 하면 앞 설정이 바뀌어 버려 둘로 나눈다
            observer = [new MutationObserver(() => schedule()), new MutationObserver(() => schedule())];
            observer[0].observe(chatEl, { childList: true });
            observer[1].observe(chatEl, { subtree: true, attributes: true, attributeFilter: ['is_system'] });
        }
    }
    schedule(0);
}

/** 시험용 */
export const _forTest = { run, cache, explain: EXPLAIN };
