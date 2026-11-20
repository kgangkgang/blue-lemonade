// 1.9.4 환영 화면 다듬기 — 채팅이 없을 때 뜨는 환영 화면 두 군데를 「보이는 것만」 바로잡아요(채팅 자료 · 메시지 원문은 안 건드려요).
// ① 도우미 첫 인사(실리태번 welcome-screen.js getAssistantGreeting 의 기본 글 = 첫 줄 + '\n***\n' + '**Hint:** …')
//    11-21 폰 제보: 「… 물어보세요! *** *팁:* 아무 캐릭터나 …」 처럼 한 줄로 보였어요. 까닭은 번역이 아니라, 쓰는 채팅 프리셋의 화면 정규식
//    「줄 잇기(Unwrap Hard-Wrapped Lines · AI 출력 · 화면만)」가 홑 줄바꿈을 띄어쓰기로 바꿔서 가로줄(***) · 굵게(**팁:**)가 문단 안 별표로 남은 것.
//    실리태번은 이 인사를 AI 답처럼 그려(messageFormatting → AI_OUTPUT 정규식) 순정 + 그 프리셋에서도 똑같이 깨져요. 프리셋은 고치지 않고(원작 그대로 쓰게),
//    기본 인사 글과 똑같은 메시지인데 가로줄이 없으면 그 칸만 원래 꼴(문단 · 가로줄 · 굵은 「팁:」 문단)로 다시 적어요. 사용자가 정한 도우미 캐릭터의 첫 메시지는 그대로예요.
// ② 최근 채팅 미리보기(템플릿 welcomePanel.html 의 {{mes}} — 마지막 메시지 끝 400자를 글자로 넣어요)
//    순정도 메시지 속 HTML 이 「<span style="…">」 처럼 날것으로 보여요. 미리보기 글 · 툴팁에서 태그만 떼어 보여요(글자는 그대로 · 원문 자료는 그대로).
// 감시는 #chat 바로 아래 자식 감시자(show-more-watch.js)를 나눠 써요(subtree 없음 — 본문 · 스트리밍 글자는 안 봐요 · 감시자를 늘리지 않아요).
import { onChatChildren } from './show-more-watch.js';

export const GREETING_KEY = "If you're connected to an API, try asking me something!";
export const HINT_KEY = '**Hint:** Set any character as your welcome page assistant from their "More..." menu.';
export const RULE = '\n***\n';

/** 실리태번이 만들 수 있는 기본 인사 글(영어 · 지금 언어 표) */
export function defaultGreetings(translate) {
    const set = new Set([GREETING_KEY + RULE + HINT_KEY]);
    if (typeof translate === 'function') { try { set.add(translate(GREETING_KEY) + RULE + translate(HINT_KEY)); } catch { /* 표가 없으면 영어만 */ } }
    return set;
}

/** 기본 인사 글을 원래 꼴(<p> · <hr> · <p><strong>…</strong> …</p>)로 — 글은 textContent 로만 넣어요 */
export function greetingNodes(doc, mes) {
    const cut = mes.indexOf(RULE);
    const first = mes.slice(0, cut).trim(), second = mes.slice(cut + RULE.length).trim();   // blank-ok: 실리태번 기본 인사 상수(채팅 글 아님)
    const p1 = doc.createElement('p'); p1.textContent = first;
    const p2 = doc.createElement('p');
    const bold = /^\*\*(.+?)\*\*\s*([\s\S]*)$/.exec(second);   // blank-ok: 실리태번 기본 인사 상수(채팅 글 아님)
    if (bold) { const b = doc.createElement('strong'); b.textContent = bold[1]; p2.append(b, doc.createTextNode(' ' + bold[2])); }
    else p2.textContent = second;
    return [p1, doc.createElement('hr'), p2];
}

/** 실리태번 messageFormatting 으로 두 문단을 따로 그려 가로줄로 이어요(따옴표 색 · 말줄임표가 순정 그대로) — 문단 안엔 줄바꿈이 없어 줄 잇기 정규식이 할 일이 없어요.
 *  그리기 함수가 없거나 결과가 이상하면 null(그때는 greetingNodes 로) */
export function formattedGreeting(doc, mes, format) {
    if (typeof format !== 'function') return null;
    const cut = mes.indexOf(RULE);
    try {
        const a = format(mes.slice(0, cut).trim()), b = format(mes.slice(cut + RULE.length).trim());   // blank-ok: 실리태번 기본 인사 상수(채팅 글 아님)
        if (typeof a !== 'string' || typeof b !== 'string' || !a.trim() || !b.trim()) return null;   // blank-ok: 실리태번 기본 인사 상수(채팅 글 아님)
        const box = doc.createElement('div');
        box.innerHTML = a + '<hr>' + b;   // 둘 다 실리태번이 소독한 HTML 이에요
        if (box.querySelectorAll('hr').length !== 1 || !box.querySelector('strong')) return null;
        return [...box.childNodes];
    } catch { return null; }
}

/**
 * 환영 도우미 메시지 요소 하나를 본다. 돌려주는 값: 'fixed' | 'ok'(이미 가로줄이 있음) | 'skip'(기본 인사가 아님 · 편집 중 등).
 * message: 채팅 배열의 그 메시지 · greetings: defaultGreetings() · format: 글 → HTML(실리태번 messageFormatting · 없어도 돼요)
 */
export function tidyGreeting(el, message, greetings, format) {
    if (!el || message?.extra?.type !== 'assistant_message' || typeof message.mes !== 'string') return 'skip';
    if (!greetings.has(message.mes) || !message.mes.includes(RULE)) return 'skip';
    const body = el.querySelector('.mes_text');
    if (!body || body.querySelector('textarea, [contenteditable="true"]')) return 'skip';
    if (body.querySelector('hr')) return 'ok';
    const doc = body.ownerDocument;
    body.replaceChildren(...(formattedGreeting(doc, message.mes, format) ?? greetingNodes(doc, message.mes)));
    body.setAttribute('data-bl-greeting', 'tidy');
    return 'fixed';
}

const TAG = /<\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>/g;   // blank-ok: 태그만 떼요 · 점자 빈칸은 글자 그대로 둬요
/** 미리보기 글에서 태그만 떼요. 태그가 없으면 그대로 돌려줘요(같은 문자열) */
export function plainPreview(text) {
    if (typeof text !== 'string' || !/[<>]/.test(text)) return text;
    let s = text
        .replace(/<(style|script)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')   // 꾸밈 · 스크립트는 안의 글까지 · blank-ok: 태그만 떼요 · 점자 빈칸은 글자 그대로 둬요
        .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')   // blank-ok: 태그만 떼요 · 점자 빈칸은 글자 그대로 둬요
        .replace(TAG, ' ')
        // 서버가 끝 400자만 자르며 앞에 '...' 를 붙여 첫 태그가 반쯤 잘려 남을 때(예: '...le="color:#424C59">')
        .replace(/^(\s*\.\.\.)[^<>]*?=\s*["'][^<>]*?>/, '$1 ');   // blank-ok: 태그만 떼요 · 점자 빈칸은 글자 그대로 둬요
    s = s.replace(/[ \t ]{2,}/g, ' ').replace(/ *\n */g, '\n').trim();   // blank-ok: 태그만 떼요 · 점자 빈칸은 글자 그대로 둬요
    return s === text.trim() ? text : s;   // blank-ok: 태그만 떼요 · 점자 빈칸은 글자 그대로 둬요
}

/** 환영 화면 하나의 최근 채팅 미리보기 — 바꾼 칸 수 */
export function tidyRecentChats(panel) {
    let n = 0;
    for (const box of panel?.querySelectorAll?.('.recentChat .chatMessage') ?? []) {
        const before = box.textContent, after = plainPreview(before);
        if (after !== before) { box.textContent = after; n++; }
        const title = box.getAttribute('title');
        const clean = plainPreview(title);
        if (title && clean !== title) box.setAttribute('title', clean);
    }
    return n;
}

let off = null, watched = null, pending = [];
const context = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };
function run() {
    const nodes = pending; pending = [];
    if (!watched?.isConnected) return;
    let ctx = null, greetings = null;
    for (const node of nodes) {
        if (!node.isConnected) continue;
        try {
            if (node.classList.contains('welcomePanel')) { tidyRecentChats(node); continue; }
            if (!node.classList.contains('mes') || node.getAttribute('type') !== 'assistant_message') continue;
            ctx ??= context();
            greetings ??= defaultGreetings(ctx?.translate);
            const id = Number(node.getAttribute('mesid')), message = ctx?.chat?.[id];
            const format = typeof ctx?.messageFormatting === 'function' ? text => ctx.messageFormatting(text, message?.name ?? '', false, false, -1) : null;
            tidyGreeting(node, message, greetings, format);
        } catch (error) { console.warn('[Blue Lemonade] welcome-tidy', error); }
    }
}
function onChildren(records) {
    const was = pending.length;
    for (const r of records) for (const node of r.addedNodes) {
        if (node.nodeType === 1 && (node.classList.contains('welcomePanel') || node.getAttribute('type') === 'assistant_message')) pending.push(node);
    }
    if (!was && pending.length) queueMicrotask(run);
}

/** 켠다 — 지금 떠 있는 환영 화면도 한 번 봐요. 시험용 chat 요소를 받을 수 있어요. 돌려주는 함수로 뗘요 */
export function installWelcomeTidy(chat = globalThis.document?.getElementById?.('chat')) {
    if (!chat) return uninstallWelcomeTidy;
    if (watched === chat && off) return uninstallWelcomeTidy;
    off?.();
    watched = chat;
    off = onChatChildren(onChildren, chat);
    pending.push(...chat.querySelectorAll(':scope > .welcomePanel, :scope > .mes[type="assistant_message"]'));
    if (pending.length) queueMicrotask(run);
    return uninstallWelcomeTidy;
}
export function uninstallWelcomeTidy() {
    if (!off) return false;
    off(); off = null; watched = null; pending = [];
    return true;
}
