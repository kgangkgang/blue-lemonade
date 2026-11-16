// 여기부터 · 여기까지 (1.6.0, 기본 켬) — 여러 화면에 걸친 채팅 글을 한 번에 고르기.
// 제보(11-16 폰): 「스크롤 하면 선택된 게 끊겨서 두 개 따로따로 복사해야」 — 폰에서는 선택 손잡이를 끌어도 채팅 칸이 따라 내려가지 않고,
//   손가락으로 굴리면 손잡이가 화면 밖으로 나가 더 늘릴 수 없어요(브라우저 한계 · 테마가 고칠 수 없는 쪽).
// 쓰는 법: 글을 고르면 뜨는 도구 줄(selection-bar.js)의 「여기부터」 → 그 선택의 시작 자리를 기억하고 선택을 풀어요 →
//   편하게 굴린 뒤 끝낼 곳의 글(낱말 하나라도)을 고르면 줄에 「여기까지」 → 시작 표시부터 그 선택의 끝까지가 한 선택이 돼요(끝이 앞이면 뒤집어서).
//   그 뒤는 평소 선택과 같아요(로그 복사 · 북마크 …). 폰은 스크립트가 만든 선택에 제 메뉴(복사)를 안 띄울 수 있어 그 범위에만 줄에 「복사」를 더해요(브라우저의 복사 명령 그대로 — 평소 고른 글 복사와 같은 글).
// 시작 표시: 메시지 글 안의 「글자 자리」(앞에서 센 글자 수 + 앞뒤 글 조각)로 기억해요 — DOM 을 바꾸지 않아요.
//   보이는 표식은 둘: 그 자리의 첫 낱말을 테마 강조색으로 칠하는 Highlight API(글자에 붙어 굴러가요 · 없는 브라우저는 건너뜀)와 그 메시지 왼쪽의 얇은 강조색 줄(data 속성).
//   화면 위에는 안내 칩 「끝낼 곳의 글을 고른 뒤 여기까지 · 취소」(채팅 칸 맨 위 · 서랍 · 창보다는 아래 층).
// 거두는 때: 취소 · 채팅이 바뀜 · 그 메시지가 지워짐(사라짐 — 알림) · SPAN_TTL_MS(5분 — 알림) · 설정 끔 · 「여기까지」를 누름.
//   메시지가 다시 그려지면(스트리밍 · 편집 · 번역) 글자 자리를 앞뒤 글 조각으로 다시 찾고, 못 찾으면 그 메시지 맨 앞으로 옮겨요. 편집 칸이 열려 있는 동안은 기다려요.
//   채팅이 통째로 다시 그려지면(같은 채팅 · 같은 번호 · 같은 글 조각) 새 요소에 다시 붙여요.
// 「긴 채팅 가볍게」: 선택을 만들면 selectionchange 로 chat-light.js 의 「고르는 중」 표식이 붙어 평소 끌어 고르기와 같은 길을 타요(화면 밖 메시지도 그려져 선택이 잘리지 않아요).
// 비용: 켤 때만 받는 모듈. 시작 표시가 없는 동안은 감시 · 타이머가 없어요 — 표시가 있는 동안만 그 메시지 하나(subtree)와 #chat(childList)을 봐요.
import { registerSelectionTool, refreshSelectionBar, restoreSelection, textRoot, charOffset } from '../selection-bar.js';
import { getSettings } from '../settings.js';
import { ctx } from './shared.js';

export const SPAN_TTL_MS = 5 * 60 * 1000;
export const FLAG_ATTR = 'data-bl-span-from';
export const HIGHLIGHT = 'bl-span-from';
export const GUIDE_ID = 'bl-span-guide';
export const REFIND_MS = 120, LOST_MS = 900;
const CONTEXT = 24, FLAG_CHARS = 8, TITLE = '여기부터 · 여기까지';
let wanted = false, registered = false;
let mark = null;   // { mes, mesid, chars, before, after, chatId, ttl, refind, lost, mo, chatMo, off: [] }
let made = null;   // 「여기까지」가 만든 범위의 끝점 — 그 범위가 골라져 있는 동안만 「복사」
let guide = null;

const chatId = () => { try { const c = ctx(); return c.getCurrentChatId?.() ?? c.chatId ?? null; } catch { return null; } };
const toast = (kind, text) => { try { globalThis.toastr?.[kind]?.(text, TITLE, { timeOut: 3200 }); } catch { /* 알림 없음 */ } };
const mesText = mes => mes?.querySelector?.('.mes_text') ?? null;
const editing = mes => !!mes?.querySelector?.('.edit_textarea');

/** root 안에서 chars 번째 글자가 든 글자 노드와 그 안 자리 — 노드 경계면 다음 노드의 처음(칠할 글자가 있는 쪽). 끝이면 마지막 노드의 끝 */
export function charPoint(root, chars) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let left = Math.max(0, chars), last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (left < node.data.length) return [node, left];
        left -= node.data.length;
        last = node;
    }
    return last ? [last, last.data.length] : null;
}

/** 다시 그려진 글에서 표시 자리를 찾는다: 같은 자리 → 앞뒤 조각이 함께 맞는 가장 가까운 곳 → 뒤 조각 → 앞 조각. 못 찾으면 -1 */
export function locate(text, { chars, before = '', after = '' }) {
    if (after && text.startsWith(after, chars) && text.slice(Math.max(0, chars - before.length), chars) === before) return chars;
    const near = (needle, shift) => {
        if (needle.length < 4) return -1;   // 너무 짧은 조각은 아무 데나 맞아요
        let best = -1;
        for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
            if (best < 0 || Math.abs(at + shift - chars) < Math.abs(best + shift - chars)) best = at;
            else break;   // 멀어지기 시작하면 그만
        }
        return best < 0 ? -1 : best + shift;
    };
    let at = before && after ? near(before + after, before.length) : -1;
    if (at < 0) at = near(after, 0);
    if (at < 0) at = near(before, before.length);
    return at;
}

function remember(root, chars) {
    const text = root.textContent ?? '';
    mark.chars = Math.min(Math.max(0, chars), text.length);
    mark.before = text.slice(Math.max(0, mark.chars - CONTEXT), mark.chars);
    mark.after = text.slice(mark.chars, mark.chars + CONTEXT);
}

// ── 보이는 표식 ──
// 줄 표식: 테마가 메시지 그림자를 끄는 규칙(css/05-chat.css body.salty #chat .mes · !important)보다 한 칸 높게
const STYLE = `
body.salty #chat > .mes[${FLAG_ATTR}] { box-shadow: inset 3px 0 0 var(--salty-accent, var(--cg-accent, #a98bd9)) !important; }
:where(#chat > .mes[${FLAG_ATTR}]) ::highlight(${HIGHLIGHT}) { background-color: var(--salty-accent, var(--cg-accent, #a98bd9)); color: var(--salty-on-accent, var(--cg-accent-ink, #fff)); }
.bl-span-guide { position: fixed; top: 8px; left: 50%; z-index: 2900; display: inline-flex; align-items: stretch; min-height: 36px; max-width: calc(100vw - 16px); margin: 0; padding: 0; border: 0; border-radius: 999px; overflow: hidden; transform: translateX(-50%);
  background: var(--salty-accent, var(--cg-accent, #a98bd9)); color: var(--salty-on-accent, var(--cg-accent-ink, #fff)); font-family: var(--salty-font-ui, inherit); font-size: 13px; font-weight: 600; line-height: 1.2; letter-spacing: 0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .28); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.bl-span-guide > .bl-span-guide-text { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 0 12px 0 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bl-span-guide > .bl-span-guide-text > i { flex: none; font-size: 12px; color: inherit; }
.bl-span-guide > .bl-span-guide-sep { flex: none; align-self: center; width: 1px; height: 16px; background: currentColor; opacity: .35; }
.bl-span-guide > .bl-span-guide-cancel { flex: none; display: inline-flex; align-items: center; min-height: 36px; margin: 0; padding: 0 14px 0 12px; border: 0; border-radius: 0; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-shadow: none; box-shadow: none; cursor: pointer; }
.bl-span-guide > .bl-span-guide-cancel:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; border-radius: 999px; }
`;
function ensureStyle() {
    if (document.getElementById('bl-span-style')) return;
    const style = document.createElement('style');
    style.id = 'bl-span-style';
    style.textContent = STYLE;
    document.head.append(style);
}
const highlights = () => (typeof Highlight === 'function' && globalThis.CSS?.highlights ? globalThis.CSS.highlights : null);

/** 표시 자리의 첫 낱말(공백 전까지 · FLAG_CHARS 자까지 · 적어도 한 글자)을 칠하고 메시지에 줄을 단다 */
function paint() {
    if (!mark) return;
    const { mes } = mark;
    if (!mes.hasAttribute(FLAG_ATTR)) mes.setAttribute(FLAG_ATTR, '');
    const registry = highlights();
    if (!registry) return;
    const root = mesText(mes);
    const point = root && !editing(mes) ? charPoint(root, mark.chars) : null;
    if (!point || point[1] >= point[0].data.length) { registry.delete(HIGHLIGHT); return; }
    const [node, at] = point;
    let end = at + 1;
    while (end < node.data.length && end - at < FLAG_CHARS && !/\s/.test(node.data[end])) end++;
    try {
        const range = document.createRange();
        range.setStart(node, at); range.setEnd(node, end);
        registry.set(HIGHLIGHT, new Highlight(range));
    } catch { registry.delete(HIGHLIGHT); }
}

function placeGuide() {
    if (!guide?.isConnected) return;
    const box = document.getElementById('chat')?.getBoundingClientRect();
    const head = document.getElementById('top-bar')?.getBoundingClientRect();   // 머리줄이 채팅 위에 떠 있는 배치(스크롤하면 바 숨기기)에서는 그 아래로
    const viewTop = window.visualViewport?.offsetTop ?? 0;
    const top = Math.round(Math.max(viewTop, box?.top ?? 0, head && head.height > 0 ? head.bottom : 0) + 8);
    if (guide.style.top !== `${top}px`) guide.style.top = `${top}px`;
}
function showGuide() {
    ensureStyle();
    guide?.remove();
    guide = document.createElement('div');
    guide.id = GUIDE_ID;
    guide.className = 'bl-span-guide';
    guide.setAttribute('role', 'status');
    guide.setAttribute('aria-label', '여기부터 표시함');
    guide.innerHTML = '<span class="bl-span-guide-text"><i class="fa-solid fa-flag" aria-hidden="true"></i>끝낼 곳의 글을 고른 뒤 「여기까지」</span><span class="bl-span-guide-sep" aria-hidden="true"></span><button type="button" class="bl-span-guide-cancel" aria-label="여기부터 표시 취소">취소</button>';
    guide.addEventListener('pointerdown', event => event.preventDefault());   // 누른다고 고른 글 · 초점이 풀리지 않게
    guide.addEventListener('contextmenu', event => event.preventDefault());
    guide.addEventListener('click', (event) => { if (event.target.closest?.('.bl-span-guide-cancel')) { event.preventDefault(); clearMark(); } });
    document.body.append(guide);
    placeGuide();
}

// ── 시작 표시 ──
function refindSoon() {
    if (!mark) return;
    clearTimeout(mark.refind);
    mark.refind = setTimeout(refind, REFIND_MS);
}
/** 표시가 든 메시지가 다시 그려졌을 때 — 글자 자리를 다시 찾는다 (편집 칸이 열려 있으면 기다린다) */
function refind() {
    if (!mark) return;
    clearTimeout(mark.refind); mark.refind = 0;
    const { mes } = mark;
    if (!mes.isConnected || mes.parentElement?.id !== 'chat') { lostSoon(); return; }
    const root = mesText(mes);
    if (!root || editing(mes)) { highlights()?.delete(HIGHLIGHT); return; }
    const at = locate(root.textContent ?? '', mark);
    if (at < 0) { remember(root, 0); toast('info', '글이 바뀌어 시작 표시를 그 메시지 맨 앞으로 옮겼어요.'); } else remember(root, at);
    paint();
}
function lostSoon() {
    if (!mark || mark.lost) return;
    mark.lost = setTimeout(reattach, LOST_MS);
}
/** 표시가 든 메시지 요소가 사라졌다 — 같은 채팅이 다시 그려진 것이면 같은 번호 · 같은 글 조각의 메시지에 다시 붙이고, 아니면 거둔다 */
function reattach() {
    if (!mark) return;
    clearTimeout(mark.lost); mark.lost = 0;
    if (mark.mes.isConnected && mark.mes.parentElement?.id === 'chat') return;
    if (chatId() !== mark.chatId) { clearMark(); return; }
    const chat = document.getElementById('chat');
    // 11-17 버그 사냥 4: 앞 메시지를 지우면 실리태번이 붙어 있던 요소의 mesid 를 고쳐 둬요 — 표시할 때 적은 번호 대신 그 요소의 마지막 번호로 찾아요
    //   (전엔 지운 뒤 같은 채팅이 다시 그려지면 옛 번호의 다른 메시지를 보고 「사라져 표시를 거뒀어요」 라고 했어요)
    const mesid = mark.mes.getAttribute('mesid') ?? mark.mesid;
    let next = null;
    for (let el = chat?.firstElementChild; el; el = el.nextElementSibling) if (el.classList.contains('mes') && el.getAttribute('mesid') === mesid) { next = el; break; }
    const root = mesText(next);
    const at = root && !editing(next) ? locate(root.textContent ?? '', mark) : -1;
    if (at < 0) { clearMark(); toast('warning', '시작 표시를 둔 메시지가 사라져 표시를 거뒀어요.'); return; }
    mark.mes = next;
    remember(root, at);
    watch();
    paint();
}
function watch() {
    mark.mo?.disconnect();
    mark.mo = new MutationObserver(refindSoon);
    mark.mo.observe(mark.mes, { childList: true, subtree: true, characterData: true });
}

/** 지금 고른 글의 시작을 「시작 표시」로 기억한다 */
export function setMark(target) {
    clearMark({ quiet: true });
    target = restoreSelection(target);
    const range = target?.range;
    let root = range ? textRoot(range.startContainer) : null;
    const chars = root ? charOffset(root, range.startContainer, range.startOffset) : 0;
    if (!root) root = target?.roots?.[0] ?? null;   // 이름 줄에서 시작한 끌기 — 걸친 첫 메시지 글의 맨 앞
    const mes = root?.closest?.('#chat > .mes');
    if (!mes) { toast('warning', '글을 다시 골라 주세요.'); return false; }
    mark = { mes, mesid: mes.getAttribute('mesid'), chars: 0, before: '', after: '', chatId: chatId(), ttl: 0, refind: 0, lost: 0, mo: null, chatMo: null, off: [] };
    made = null;
    remember(root, Math.max(0, chars));
    mark.ttl = setTimeout(() => { if (!mark) return; clearMark(); toast('info', '5분이 지나 시작 표시를 거뒀어요.'); }, SPAN_TTL_MS);
    watch();
    const chat = document.getElementById('chat');
    if (chat) {
        mark.chatMo = new MutationObserver(() => { if (mark && !mark.mes.isConnected) lostSoon(); });
        mark.chatMo.observe(chat, { childList: true });
        let scrollTimer = 0;
        const onScroll = () => { if (!scrollTimer) scrollTimer = setTimeout(() => { scrollTimer = 0; placeGuide(); }, 250); };
        chat.addEventListener('scroll', onScroll, { passive: true });
        mark.off.push(() => { clearTimeout(scrollTimer); chat.removeEventListener('scroll', onScroll); });
    }
    window.addEventListener('resize', placeGuide);
    window.visualViewport?.addEventListener('resize', placeGuide);
    mark.off.push(() => { window.removeEventListener('resize', placeGuide); window.visualViewport?.removeEventListener('resize', placeGuide); });
    try {
        const c = ctx(), es = c.eventSource, T = c.eventTypes || c.event_types;
        const ev = T?.CHAT_CHANGED;
        if (es?.on && ev) {
            // 다른 채팅이면 바로 거두고, 같은 채팅이 다시 그려진 것이면 새 요소를 찾는다
            const onChat = () => { if (!mark) return; if (chatId() !== mark.chatId) clearMark(); else if (!mark.mes.isConnected) lostSoon(); };
            es.on(ev, onChat);
            mark.off.push(() => (es.removeListener || es.off)?.call(es, ev, onChat));
        }
    } catch { /* 실리태번 사건 없음 */ }
    paint();
    showGuide();
    refreshSelectionBar();
    return true;
}

/** 시작 표시를 거둔다 (감시 · 타이머 · 표식 · 안내 칩) */
export function clearMark({ quiet = false } = {}) {
    guide?.remove(); guide = null;
    if (!mark) return;
    const old = mark; mark = null;
    clearTimeout(old.ttl); clearTimeout(old.refind); clearTimeout(old.lost);
    old.mo?.disconnect(); old.chatMo?.disconnect();
    for (const off of old.off) { try { off(); } catch { /* 이미 뗌 */ } }
    if (old.mes.hasAttribute?.(FLAG_ATTR)) old.mes.removeAttribute(FLAG_ATTR);
    highlights()?.delete(HIGHLIGHT);
    if (!quiet) refreshSelectionBar();
}

/** 시작 표시부터 지금 고른 글의 끝까지 (표시가 뒤면 고른 글의 시작부터 표시까지 · 표시가 고른 글 안이면 고른 글 그대로) */
export function spanRange(target) {
    if (!mark || !target?.range) return null;
    const { mes } = mark;
    const root = mes.isConnected && !editing(mes) ? mesText(mes) : null;
    if (!root) return null;
    const at = locate(root.textContent ?? '', mark);
    remember(root, at < 0 ? 0 : at);
    const point = charPoint(root, mark.chars) ?? [root, 0];
    const picked = target.range, range = document.createRange();
    let side;
    try { side = picked.comparePoint(point[0], point[1]); } catch { return null; }
    if (side < 0) { range.setStart(point[0], point[1]); range.setEnd(picked.endContainer, picked.endOffset); }
    else if (side > 0) { range.setStart(picked.startContainer, picked.startOffset); range.setEnd(point[0], point[1]); }
    else { range.setStart(picked.startContainer, picked.startOffset); range.setEnd(picked.endContainer, picked.endOffset); }
    return range.collapsed ? null : range;
}

const mesIndex = node => Number.parseInt((node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('#chat > .mes')?.getAttribute('mesid') ?? '', 10);
function select(range) {
    const selection = document.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.rangeCount === 1 && !selection.getRangeAt(0).collapsed;
}
const edges = range => ({ sc: range.startContainer, so: range.startOffset, ec: range.endContainer, eo: range.endOffset });

/** 「여기까지」 — 한 선택으로 만들고 시작 표시를 거둔다 */
export function selectTo(target) {
    const range = spanRange(restoreSelection(target));
    if (!range) { toast('warning', '시작 표시를 찾지 못했어요. 「여기부터」를 다시 눌러 주세요.'); clearMark(); return false; }
    clearMark({ quiet: true });
    if (!select(range)) { toast('warning', '글을 다시 골라 주세요.'); refreshSelectionBar(); return false; }
    made = edges(document.getSelection().getRangeAt(0));
    const a = mesIndex(range.startContainer), b = mesIndex(range.endContainer);
    const count = Number.isInteger(a) && Number.isInteger(b) ? Math.abs(b - a) + 1 : 0;
    toast('success', count > 1 ? `메시지 ${count}개에 걸쳐 골랐어요.` : '시작 표시부터 여기까지 골랐어요.');
    refreshSelectionBar();
    return true;
}

/** 지금 고른 글이 「여기까지」가 만든 그 범위인가 (끝점만 견준다 — 글이 다시 그려졌으면 평소 선택으로 본다) */
export function isMade() {
    if (!made) return false;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount !== 1) return false;
    const now = selection.getRangeAt(0);
    return now.startContainer === made.sc && now.startOffset === made.so && now.endContainer === made.ec && now.endOffset === made.eo;
}

/** 화면에 보이는 글 — 브라우저의 복사(text/plain)와 같은 Selection.toString. 누르는 순간 선택이 풀렸으면 떠 둔 범위로 다시 세워 읽는다 */
export function shownText(target) {
    const selection = document.getSelection();
    let text = selection?.toString() ?? '';
    if (!text.trim() && target?.range && select(target.range)) text = selection.toString();
    return text.trim() ? text : null;
}
// http:// 로 연 폰(LAN 접속)에는 clipboard API 가 없다 — 옛 복사 명령으로 대신한다 (word-tools.js 와 같은 길)
async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* 아래 옛 방식 */ }
    const back = document.activeElement, area = document.createElement('textarea');
    area.value = text; area.readOnly = true; area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(area); area.select(); area.setSelectionRange(0, area.value.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove(); back?.focus?.({ preventScroll: true });
    return ok;
}
export async function copyMade({ target, captured }) {
    // 그 범위를 다시 골라 브라우저의 복사 명령을 그대로 부른다 — 평소 고른 글 복사(메뉴의 복사 · Ctrl+C)와 같은 글 · 같은 서식이 나가요.
    //   복사한 뒤에도 범위는 골라진 채로 둔다(이어서 로그 복사를 누를 수 있게). 명령이 막힌 곳만 떠 둔 글(Selection.toString)을 적어요.
    let ok = false;
    try {
        if (target?.range?.startContainer?.isConnected && select(target.range)) {
            made = edges(document.getSelection().getRangeAt(0));
            ok = document.execCommand('copy') === true;
        }
    } catch { ok = false; }
    if (!ok) ok = await copyText(captured);
    if (ok) toast('success', '고른 범위를 복사했어요.'); else toast('warning', '복사하지 못했어요.');
    return ok;
}

const usable = () => { try { return wanted && document.body.classList.contains('salty') && getSettings().quick?.selSpan !== false; } catch { return false; } };

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncSelSpan(on) {
    wanted = !!on;
    if (!wanted) { clearMark({ quiet: true }); made = null; }
    if (wanted && !registered) {
        registered = true;
        registerSelectionTool({ id: 'spanto', order: 4, label: '여기까지', aria: '시작 표시부터 여기까지 고르기', icon: () => 'fa-flag-checkered', enabled: usable, accepts: () => !!mark, run: ({ target }) => { selectTo(target); } });
        registerSelectionTool({ id: 'spancopy', order: 5, label: '복사', aria: '고른 범위 복사', icon: () => 'fa-clipboard', enabled: usable, accepts: () => isMade(), capture: shownText, run: copyMade });
        registerSelectionTool({ id: 'spanfrom', order: 30, label: '여기부터', aria: '여기부터 고르기 시작', icon: () => 'fa-flag', enabled: usable, accepts: () => !mark && !isMade(), run: ({ target }) => { setMark(target); } });
        return;
    }
    if (registered) refreshSelectionBar();
}

/** 시험용 */
export const _span = { state: () => (mark ? { mesid: mark.mesid, chars: mark.chars, before: mark.before, after: mark.after, mes: mark.mes, guide: !!guide?.isConnected } : null), made: () => made, refind, reattach };
