// 북마크 — 메시지·메모 렌더링, 날짜·이름 표시
import { dressBody } from '../../dem-expressive.js';
import { typesetRoot } from '../../typography.js';
import { messageFormatting, getThumbnailUrl } from '../../../../../../../script.js';
import { user_avatar } from '../../../../../../personas.js';
import { timestampToMoment } from '../../../../../../utils.js';
import { findMatches } from './text-match.js';
import { settings } from './state.js';
import { fitHtmlFrame } from './frame-fit.js';
import { normalizeTrackerSpacing } from './tracker-spacing.js';
// lib.js의 export는 실리태번 버전마다 달라서, 예전부터 늘 있던 전역 DOMPurify를 쓴다.
const { DOMPurify } = globalThis;

export function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function formatDate(sendDate) {
    if (!sendDate) return '';
    const moment = timestampToMoment(sendDate);
    return moment.isValid() ? moment.format('YYYY.MM.DD HH:mm') : '';
}

/**
 * 채팅 파일 이름을 읽기 좋게 줄인다.
 * "캐릭터 - 2025-07-30@11h09m48s" → "2025.07.30 11:09", 직접 바꾼 이름은 그대로 둔다.
 */
export function chatLabel(key, characterName) {
    let name = String(key ?? '');
    if (characterName && name.startsWith(`${characterName} - `)) name = name.slice(characterName.length + 3);
    // 새 버전은 끝에 밀리초도 붙는다: 2026-09-10@17h42m19s908ms
    const stamp = name.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*@\s*(\d{1,2})h\s*(\d{1,2})m(?:\s*\d{1,2}s)?(?:\s*\d{1,3}ms)?(.*)$/);
    if (stamp) {
        const [, year, month, day, hour, minute, rest] = stamp;
        return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}${rest}`.trim();
    }
    return name || String(key ?? '');
}

/** 채팅 화면과 같이 번역문(display_text)이 있으면 그것을 보여 준다. */
export function messageText(message) {
    return message?.extra?.display_text ?? message?.mes ?? '';
}

/**
 * `</summary>` 바로 뒤에 같은 줄로 붙은 마크다운(### 제목, 목록, 인용, 표)은 마크다운 변환기가 HTML 덩어리로 보고
 * 글자 그대로 둔다(채팅 화면도 마찬가지다). 접이 카드를 쓰는 프리셋에서 자주 나오니 줄만 띄워 제대로 보이게 한다.
 * 평범한 글이 이어지는 경우는 건드리지 않는다.
 */
const MARKDOWN_AFTER_SUMMARY = /<\/summary>[ \t]*(?=(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\|))/gi;

function loosenMarkdown(text) {
    return String(text ?? '').replace(MARKDOWN_AFTER_SUMMARY, '</summary>\n\n');
}

/**
 * 채팅 화면과 같은 방식(마크다운, 정규식, <style> 글꾸)으로 그린다.
 * index는 현재 채팅일 때만 넘긴다. 다른 채팅의 번호로 현재 채팅 기준 정규식 깊이를 계산하면 틀리기 때문이다.
 */
/** 블루 레몬에이드의 화면 다듬기(데우스 감정 대사 칸 · 괄호 대사 첫 글자 붙이기)를 채팅과 똑같이 거친다 */
function themed(html, message) {
    const holder = document.createElement('div');
    holder.className = 'mes_text';
    holder.innerHTML = html;
    try { dressBody(holder, message); typesetRoot(holder.parentNode ?? wrapFor(holder)); } catch (error) { console.warn('[북마크] 테마 서식을 입히지 못했습니다:', error); }
    return holder.innerHTML;
}
function wrapFor(holder) { const wrap = document.createElement('div'); wrap.append(holder); return wrap; }

// 데우스 엑스 마키나 답은 장면 계획 · 트래커 · 상태창 같은 덩어리가 본문 앞뒤에 붙는다. '본문만 보기'면 <prose> 안만(없으면 그 덩어리들을 뺀 나머지) 그린다.
// 감정 대사 태그 · 대사 색 · 에셋 그림은 본문 안에 있으니 그대로 남는다. 원문은 건드리지 않는다 — 그리기 전의 사본에서만.
const DEUS_BLOCKS = /<(scene_plan|scene_reasoning|tracker|momentum|status|threads|conflict|cyoa|plotlines|psychological_states)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
export function proseOf(text) {
    const source = String(text ?? '');
    // 태그째 남긴다 — 프리셋의 화면 정규식이 <prose> 머리말("(with @True Thoughts …)")을 지우는 등 태그를 보고 일한다
    // 덩어리부터 뺀다: 장면 계획 글 안에도 "<prose> (with …) -> </prose>" 같은 설명이 적혀 있어, 먼저 찾으면 그걸 본문으로 잘못 집는다
    const rest = source.replace(DEUS_BLOCKS, '').trim();
    const prose = [...rest.matchAll(/<prose\b[^>]*>[\s\S]*?<\/prose\s*>/gi)].map(hit => hit[0]);
    // 태그 바로 안쪽의 빈 줄은 <br><br> 로 그려져 접힌 세 줄을 빈칸이 차지한다 → 붙여 준다
    const body = (prose.length ? prose.join('\n\n') : rest).replace(/(<prose\b[^>]*>)\s+/gi, '$1').replace(/\s+(<\/prose\s*>)/gi, '$1');
    return body || source; // 덩어리뿐인 답이면 원래대로
}

export function renderMessageHtml(message, index = null) {
    const text = settings().deusProseOnly ? proseOf(messageText(message)) : messageText(message);
    if (!text) return '<p class="cg-empty-text">[빈 메시지]</p>';
    try {
        // null is coerced to message 0 by ST, which applies greeting macros and
        // the wrong regex depth. Detached/other-chat previews use the -1 sentinel.
        return themed(messageFormatting(loosenMarkdown(text), message.name, !!message.is_system, !!message.is_user, Number.isInteger(index) && index >= 0 ? index : -1, {}, false), message);
    } catch (error) {
        console.warn('[북마크] 메시지를 그리지 못했습니다:', error);
        return escapeHtml(text).replace(/\n/g, '<br>');
    }
}

export function renderReasoningHtml(message, index = null) {
    const reasoning = message?.extra?.reasoning;
    if (!reasoning) return '';
    try {
        return messageFormatting(loosenMarkdown(reasoning), message.name, false, !!message.is_user, Number.isInteger(index) && index >= 0 ? index : -1, {}, true);
    } catch {
        return escapeHtml(reasoning).replace(/\n/g, '<br>');
    }
}

/**
 * 메모 속 마크다운 강조: ***굵은 기울기***, **굵게**, *기울기*.
 * 별표 안쪽이 공백으로 시작하거나 끝나면(예: "3 * 4 * 5") 강조로 보지 않는다.
 * 글자를 먼저 이스케이프한 뒤 바꾸므로 태그가 새로 끼어들 틈이 없다.
 */
export function emphasizeText(text) {
    return escapeHtml(text)
        .replace(/\*\*\*(?=\S)([^*\n]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(?=\S)([^*\n]*?\S)\*/g, '<em>$1</em>');
}

/** HTML 메모에서는 태그 속성은 건드리지 않고 글자 부분에만 강조를 적용한다. */
function emphasizeTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.includes('*') && !walker.currentNode.parentElement?.closest('code, pre, style, script')) nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
        const html = emphasizeText(node.nodeValue);
        if (html === escapeHtml(node.nodeValue)) continue;
        const template = document.createElement('template');
        template.innerHTML = html;
        node.replaceWith(template.content);
    }
}

/**
 * 메모는 원래 확장처럼 HTML(<b>, <br> …)을 쓸 수 있고, *기울기* · **굵게** 마크다운도 쓸 수 있다.
 * 태그가 없는 메모는 줄바꿈을 그대로 살린다.
 */
function renderPlainNoteHtml(note) {
    const text = String(note ?? '').trim();
    if (!text) return '';
    if (/<\/?[a-z][^>]*>/i.test(text)) {
        const holder = document.createElement('div');
        holder.innerHTML = DOMPurify.sanitize(text);
        emphasizeTextNodes(holder);
        return holder.innerHTML;
    }
    return text.split('\n').map(emphasizeText).join('<br>');
}

/** Notes use the same display-regex and markdown pipeline as translated AI text.
 * Never write the transformed result back into the saved note. */
export function renderNoteHtml(note) {
    const text = String(note ?? '').trim();
    if (!text) return '';
    try {
        return messageFormatting(loosenMarkdown(text), '', false, false, -1, {}, false);
    } catch (error) {
        console.warn('[북마크] 메모 정규식을 적용하지 못했습니다:', error);
        return renderPlainNoteHtml(text);
    }
}

/** 메모를 검색할 때 쓰는 순수 글자 */
export function noteToPlainText(note) {
    const holder = document.createElement('div');
    holder.innerHTML = renderPlainNoteHtml(note);
    return holder.textContent ?? '';
}

// ── 검색어 강조 (CSS Custom Highlight API: DOM을 건드리지 않아 iframe·이미지가 다시 뜨지 않는다) ──

const HIGHLIGHT_NAME = 'cg-hit';
let highlight = null;

function highlightRegistry() {
    if (highlight) return highlight;
    if (typeof Highlight === 'undefined' || !CSS.highlights) return null;
    highlight = new Highlight();
    CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    return highlight;
}

export function clearHighlights() {
    highlight?.clear();
}

/**
 * root 안의 글자에서 query(대소문자 무시)가 나오는 곳을 모두 강조한다. 지원하지 않는 브라우저에서는 아무 일도 없다.
 * 위치는 원래 글 기준으로 옮겨서 쓴다(text-match.js — İ처럼 소문자가 더 긴 글자). 강조가 실패해도 목록 그리기는 멈추지 않는다.
 */
export function highlightMatches(root, query) {
    const registry = highlightRegistry();
    if (!registry || !root || !String(query ?? '')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement?.closest('script, style')) continue;
        for (const [start, end] of findMatches(node.nodeValue, query)) {
            try {
                const range = new Range();
                range.setStart(node, Math.min(start, node.length));
                range.setEnd(node, Math.min(end, node.length));
                registry.add(range);
            } catch (error) {
                console.warn('[북마크] 검색어를 강조하지 못했습니다:', error);
            }
        }
    }
}

export function avatarForMessage(message, chat) {
    if (message?.force_avatar) return message.force_avatar;
    if (message?.is_user) return user_avatar ? getThumbnailUrl('persona', user_avatar) : 'img/ai4.png';
    return chat?.avatarUrl || 'img/ai4.png';
}

// ── HTML 코드 블록 → iframe (Tavern Helper와 같은 판별 기준) ─────────

const HTML_BLOCK_MARKERS = ['html>', '<head>', '<body'];
const BRIDGED_GLOBALS = ['getChatMessages', 'setChatMessages', 'createChatMessages', 'deleteChatMessages', 'getContext', 'toastr', 'log', 'jQuery', '$', '_'];
const BRIDGE_SCRIPT = `<script>(function(){try{${JSON.stringify(BRIDGED_GLOBALS)}.forEach(function(name){if(window.parent&&typeof window.parent[name]!=='undefined'){window[name]=window.parent[name];}});}catch(e){console.error('[북마크] iframe bridge',e);}})();<\/script>`;

function withBridge(code) {
    const head = code.match(/<head\s*>/i);
    if (!head) return BRIDGE_SCRIPT + code;
    const at = head.index + head[0].length;
    return code.slice(0, at) + BRIDGE_SCRIPT + code.slice(at);
}

/** onResize는 iframe 높이가 바뀔 때마다 불린다 (접힌 카드의 '전체 보기' 표시를 다시 계산하는 데 쓴다). */
export function hydrateHtmlBlocks(container, onResize = null) {
    normalizeTrackerSpacing(container);
    container.querySelectorAll('pre').forEach((pre) => {
        const code = pre.textContent ?? '';
        if (!HTML_BLOCK_MARKERS.some(marker => code.includes(marker))) return;
        const iframe = document.createElement('iframe');
        iframe.className = 'cg-html-frame';
        iframe.setAttribute('srcdoc', withBridge(code));
        iframe.addEventListener('load', () => {
            try {
                const doc = iframe.contentDocument;
                if (!doc?.body) return;
                const style = doc.createElement('style');
                style.textContent = 'html,body{margin:0;overflow:hidden;}';
                doc.head?.appendChild(style);
                fitHtmlFrame(iframe, onResize);
            } catch (error) {
                console.warn('[북마크] iframe 높이를 맞추지 못했습니다:', error);
            }
        }, { once: true });
        pre.replaceWith(iframe);
    });
    // 캐릭터 에셋 확장에게 이 칸의 {{img::이름}}을 그림으로 바꿔 달라고 알린다. 그 확장이 없으면 아무 일도 없다.
    // (채팅 화면에서는 그 확장이 #chat을 지켜보며 바꾸지만, 북마크 카드 · 앞뒤 문맥 창은 채팅 밖이라 알려 줘야 한다)
    document.dispatchEvent(new CustomEvent('char-assets:render', { detail: { root: container } }));
    document.dispatchEvent(new CustomEvent('chat-bookmarks:render', { detail: { root: container } }));
}
