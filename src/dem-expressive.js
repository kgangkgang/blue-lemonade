import { syncDemSelection } from './dem-selection.js';
// 데우스 감정 대사: 「…」『…』 대사 살리기 (프롬프트 › 데우스 엑스 마키나 › 감정 대사 효과).
//
// 프리셋의 'DEM - Render Expressive Dialogue' 정규식은 "…" · “…” 대사만 알아본다. 「…」 대사에 붙은 <excited> 같은 태그는
// 정규식에 안 걸린 채 남고, 실리태번 정화기가 모르는 태그라 조용히 버린다 — 화면에는 맨 대사만 남아 효과가 걸릴 칸이 없다.
// 그래서 메시지 원문에서 '감정 태그 + 괄호 대사'를 찾아, 화면의 같은 대사를 프리셋이 만들었을 것과 같은
// <span class="custom-dem-expressive custom-dem-expressive--excited"> 로 감싼다. 원문 · 저장되는 글은 건드리지 않는다.
// 메시지가 그려졌다는 실리태번 이벤트 뒤에 훑고, 번역처럼 이벤트 없이 본문이 바뀌는 경우만 가벼운 감시자로 잡는다 (아래 onMutations).

const TAGS = 'shout|quiet|angry|excited|dizzy|crying|anxious|hurt|intoxicated|whispering|trembling|deadpan|allcaps|uppercase|nocaps|lowercase|titlecase|tiny|small|large|huge|spaced|wide|tight|bold|italic|mono|gradient|rainbow|red|orange|yellow|green|cyan|blue|purple|pink|white|gray|bright|dim|faded|glow|warm|cool';
// 4.7.0: 괄호 짝을 맞춘다 — 「『…』, …」 처럼 안에 『』가 든 대사를 첫 』에서 끊으면 대사 일부만 q 안쪽에 감싸게 되고,
// 형광펜 색 모드의 q 글자 마스크가 안쪽 inline-block 글자를 띠 투명도로 흐리고, 움직이면 q 상자 밖을 잘랐다 (2026-09-23 실측)
const FIND = new RegExp(`((?:<(?:${TAGS})\\b[^>\\r\\n]{0,240}>[ \\t]*){1,4})(?:<(?:span|font)\\b[^>\\r\\n]{0,240}>[ \\t]*)?(「[^」\\r\\n]{1,600}」|『[^』\\r\\n]{1,600}』)`, 'gi');
const TAG_NAME = new RegExp(`<(${TAGS})\\b`, 'gi');
const MADE = 'bl-fx-made';

let bound = null, timers = [], active = false;

/** 원문에서 [{ tags: ['excited'], text: '「…」' }] */
export function findExpressive(source) {
    const hits = [];
    for (const m of String(source || '').matchAll(FIND)) {
        const tags = [...m[1].matchAll(TAG_NAME)].map(t => t[1].toLowerCase());
        if (tags.length) hits.push({ tags, text: m[2] });
    }
    return hits;
}

function wrap(node, tags) {
    const span = document.createElement('span');
    span.className = `custom-dem-expressive ${tags.map(t => `custom-dem-expressive--${t}`).join(' ')} ${MADE}`;
    node.parentNode.insertBefore(span, node);
    span.appendChild(node);
}

/** 채팅 밖의 본문(북마크 카드 등)에도 같은 일을 한다 — 본문 요소를 직접 받는다. 효과를 꺼 두었으면 아무것도 안 한다 */
export function dressBody(body, message) {
    if (!active || !body || !message) return;
    dressInto(body, message);
    markLeads(body);
}

/** 한 메시지: 원문(번역본이 있으면 그것도)의 감정 대사를 화면에서 찾아 감싼다 */
function dress(mes, message) {
    const body = mes.querySelector('.mes_text');
    if (!body || !message) return;
    dressInto(body, message);
}
// 본문이 아직 문서에 붙기 전(북마크 카드를 글자로 만드는 중)에도 쓰이므로 isConnected 가 아니라 body 안인지로 본다
function dressInto(body, message) {
    const hits = [...findExpressive(message.extra?.display_text), ...findExpressive(message.mes)];
    if (!hits.length) return;
    // 1) 칸 하나가 통째로 그 대사인 경우(테마의 대사 칸 q · 대사 색상의 span/font): 가장 바깥 칸을 감싼다 — 프리셋이 만드는 모양(감정 칸 > 색 칸 > q)과 같게.
    //    q 안쪽에 넣으면 형광펜 · 줄 나눔 규칙과 엉켜 줄이 잘려 보였다 (2026-09-21 실제 화면에서 확인)
    const boxes = [...body.querySelectorAll('q, font, span[style]')];
    const rest = [];
    for (const hit of hits) {
        let box = boxes.find(el => body.contains(el) && el.textContent.trim() === hit.text && !el.closest('.custom-dem-expressive'));
        if (!box) { rest.push(hit); continue; }
        while (box.parentElement !== body && box.parentElement.matches('q, font, span[style]') && box.parentElement.textContent.trim() === hit.text) box = box.parentElement;
        wrap(box, hit.tags);
    }
    if (!rest.length) return;
    // 2) 문단 글 속에 섞인 대사: 그 글자 범위만
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.includes('「') || n.data.includes('『')) nodes.push(n);
    for (const hit of rest) {
        const node = nodes.find(n => body.contains(n) && n.data.includes(hit.text) && !n.parentElement.closest('.custom-dem-expressive'));
        if (!node) continue;
        const start = node.data.indexOf(hit.text);
        const target = start > 0 ? node.splitText(start) : node;
        if (target.data.length > hit.text.length) target.splitText(hit.text.length);
        wrap(target, hit.tags);
    }
}

/** 문단 맨 앞에 선 감정 칸인가 — 앞에 글자가 하나도 없을 때만 */
function leads(span) {
    const para = span.closest('p');
    if (!para) return false;
    for (let node = span; node && node !== para; node = node.parentNode) {
        for (let prev = node.previousSibling; prev; prev = prev.previousSibling) if (prev.textContent.trim()) return false;
    }
    return true;
}

// 감정 칸은 inline-block 이라 문단 들여쓰기를 물려받아 제 첫 줄을 한 번 더 들이고, 둘째 줄부터는 칸 왼쪽(= 들여쓴 자리)에 선다.
// 문단 맨 앞 칸에 표시를 달아 CSS 가 칸을 문단 왼쪽 끝으로 당기고 안에서 한 번만 들이게 한다 (프리셋이 만든 "…" 칸도 같이)
function markLeads(body) {
    body.querySelectorAll('.custom-dem-expressive:not(.custom-dem-expressive--)').forEach((span) => {
        if (span.parentElement.closest('.custom-dem-expressive')) return;
        span.classList.toggle('bl-fx-lead', leads(span));
    });
}

function undress(root = document) {
    root.querySelectorAll('.bl-fx-lead').forEach(span => span.classList.remove('bl-fx-lead'));
    root.querySelectorAll(`.${MADE}`).forEach((span) => {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        span.remove();
        parent.normalize();
    });
}

function sweep() {
    if (!active) return;
    const chat = SillyTavern.getContext().chat || [];
    document.querySelectorAll('#chat .mes[mesid]').forEach((mes) => {
        dress(mes, chat[Number(mes.getAttribute('mesid'))]);
        const body = mes.querySelector('.mes_text');
        if (body) markLeads(body);
    });
}

function schedule() {
    timers.forEach(clearTimeout);
    // 세 번: 바로 · 다른 확장이 본문을 고친 뒤 · 번역이 늦게 들어온 뒤. 이미 감싼 대사는 건너뛰니 되풀이해도 같다
    timers = [setTimeout(sweep, 80), setTimeout(sweep, 800), setTimeout(sweep, 3000)];
}

// 번역 확장은 본문을 번역문으로 갈아 끼울 때 실리태번 이벤트를 내지 않는다 — 그래서 번역이 늦게 오면 감싼 칸이 사라진 채로 남았다(새로고침해야 다시 움직임).
// #chat 에서 '본문이 통째로 바뀐 메시지'만 적어 두었다가 조용해진 뒤(0.4초) 그 메시지만 다시 감싼다. 스트리밍 중에는 글자가 올 때마다 미뤄져 끝난 뒤 한 번만 돈다.
let watcher = null, changed = new Set(), quiet = 0, dressing = false;
function onMutations(records) {
    if (dressing) return;
    for (const record of records) {
        const body = record.target.nodeType === 1 && record.target.classList.contains('mes_text') ? record.target : null;
        if (body && ![...record.addedNodes].every(n => n.nodeType === 1 && n.classList.contains(MADE))) changed.add(body);
    }
    if (!changed.size) return;
    clearTimeout(quiet);
    quiet = setTimeout(() => {
        const chat = SillyTavern.getContext().chat || [], bodies = [...changed]; changed = new Set();
        dressing = true;
        try {
            for (const body of bodies) { const mes = body.closest('.mes[mesid]'); if (mes?.isConnected) { dress(mes, chat[Number(mes.getAttribute('mesid'))]); markLeads(body); } }
        } finally { queueMicrotask(() => { watcher?.takeRecords(); dressing = false; }); }
    }, 400);
}

function bind() {
    if (bound) return;
    const chatBox = document.getElementById('chat');
    if (chatBox && !watcher) { watcher = new MutationObserver(onMutations); watcher.observe(chatBox, { childList: true, subtree: true }); }
    const { eventSource, event_types: t } = SillyTavern.getContext();
    const names = [t.CHAT_CHANGED, t.CHARACTER_MESSAGE_RENDERED, t.USER_MESSAGE_RENDERED, t.MORE_MESSAGES_LOADED, t.MESSAGE_UPDATED, t.MESSAGE_SWIPED, t.MESSAGE_EDITED].filter(Boolean);
    names.forEach(name => eventSource.on(name, schedule));
    bound = { eventSource, names };
}

function unbind() {
    if (!bound) return;
    watcher?.disconnect(); watcher = null; clearTimeout(quiet); changed = new Set();
    bound.names.forEach(name => bound.eventSource.removeListener(name, schedule));
    timers.forEach(clearTimeout);
    timers = [];
    bound = null;
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncDemExpressive(on) {
    active = !!on;
    syncDemSelection(active);
    if (active) { bind(); schedule(); } else { unbind(); undress(); }
}
