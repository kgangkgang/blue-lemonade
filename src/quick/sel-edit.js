// 고른 글 고치기 (1.0.3, 기본 꺼짐) — 채팅에서 글을 고르면 뜨는 고른 글 도구 줄(selection-bar.js)에 「고치기」 단추 하나.
// 누르면 작은 창에 고른 부분의 원래 글(꾸밈 표시 그대로)이 나오고, 고쳐서 저장하면 그 자리만 바뀌어요 — 메시지 전체 편집을 열지 않아도 돼요.
// 자리 찾기 · 바꾸기는 sel-edit-core.js(순수). 확실하지 않으면 고치지 않고 이유를 알려요.
// 번역문이 있는 메시지는 건드리지 않아요(원문이 바뀌면 번역이 「오래된 번역」으로 숨어요) — 그런 메시지에서는 단추가 안 떠요.
// 저장은 실리태번의 편집과 같은 차례: 글 · 스와이프 → MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 저장. 저장 뒤 알림의 ↶ 로 한 번 되돌려요.
// 비용: 켤 때만 받는 모듈. 리스너 · 감시는 더하지 않아요(도구 줄이 이미 듣는 선택 바뀜을 같이 써요).
import { registerSelectionTool, refreshSelectionBar } from '../selection-bar.js';
import { getSettings } from '../settings.js';
import { showThemeModal } from '../modal.js';
import { attachUndo } from '../ask.js';
import { locateEdit, replaceSpan, spanContext, EDIT_REASONS } from './sel-edit-core.js';
import { ctx, esc, ensureQuickCss } from './shared.js';
import { splitCssReady } from '../lite.js';   // 창 틀(css/78)은 둘째 장(style-lazy) — 채팅에서 바로 열 때 받은 뒤에 띄워요

const BLOCKS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DETAILS', 'SUMMARY', 'TR', 'UL', 'OL', 'TABLE', 'HR']);
const TRANSLATOR = '.translated_text, .custom-translated_text, .original_text, .custom-original_text, details.llm-translator-details, details.custom-llm-translator-details';
let wanted = false, registered = false;


/** 메시지 화면 글(블록 · <br> 은 \n) 과 고른 글이 시작하는 자리. 닫힌 접기 칸 속 글 · 단추 · 스타일은 빼요 */
export function screenOf(root, range) {
    let text = '', at = -1;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            if (node.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
            if (node.tagName === 'BUTTON' || node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return NodeFilter.FILTER_REJECT;
            const details = node.parentElement?.closest?.('details');
            if (details && !details.open && node.tagName !== 'SUMMARY' && !node.closest('summary')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 1) { if (node.tagName === 'BR' || BLOCKS.has(node.tagName)) text += '\n'; continue; }
        if (at < 0) {
            if (node === range.startContainer) at = text.length + range.startOffset;
            else { try { if (range.intersectsNode(node)) at = text.length; } catch { /* 다른 문서 */ } }
        }
        text += node.data;
    }
    return { screen: text, at };
}

function messageOf(index) {
    const message = ctx().chat?.[index];
    return message && typeof message.mes === 'string' ? message : null;
}
const translated = message => !!message?.extra?.display_text && message.extra.display_text !== message.mes;

function accepts(target) {
    if (!wanted || !target?.single) return false;
    const message = messageOf(target.index);
    if (!message || translated(message)) return false;
    return !target.root.querySelector(TRANSLATOR);
}

function capture(target) {
    const message = messageOf(target.index);
    if (!message) return null;
    const selected = target.range.toString();
    const { screen, at } = screenOf(target.root, target.range);
    if (at < 0) return null;
    return { index: target.index, raw: message.mes, selected, screen, at };
}

async function writeMessage(index, message, next) {
    const c = ctx(), types = c.eventTypes ?? c.event_types;
    message.mes = next;
    if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id) && message.swipes[message.swipe_id] !== undefined) message.swipes[message.swipe_id] = next;
    if (c.chatMetadata) c.chatMetadata.tainted = true;   // 실리태번의 편집과 같이 (첫 인사를 카드 글로 되돌리지 않게)
    await c.eventSource.emit(types.MESSAGE_EDITED, index);
    c.updateMessageBlock(index, message);
    await c.eventSource.emit(types.MESSAGE_UPDATED, index);
    await c.saveChat();
}

/** 고치기 창 → 고친 글 또는 null(취소) */
async function openEditor(original, context) {
    ensureQuickCss();
    await splitCssReady().catch(() => false);
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'bl-tool-dialog bl-prompt-card-picker bl-qe-dialog';
        dialog.setAttribute('aria-label', '고른 글 고치기');
        dialog.innerHTML = `<header><h3>고른 글 고치기</h3><button type="button" data-card-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>`
            + `<p class="bl-qe-context"><span>${esc(context.before)}</span><mark>${esc(original)}</mark><span>${esc(context.after)}</span></p>`
            + `<textarea class="text_pole bl-qe-text" rows="5" aria-label="고친 글" spellcheck="false">${esc(original)}</textarea>`
            + '<footer><small>꾸밈 표시(* · 태그)도 원래 글 그대로예요.</small><span class="bl-prompt-card-actions"><button type="button" data-card-clear>취소</button><button type="button" data-card-done>고치기</button></span></footer>';
        const text = dialog.querySelector('textarea');
        let result = null;
        const done = () => { result = text.value; dialog.close(); };
        dialog.querySelector('[data-card-close]').addEventListener('click', () => dialog.close());
        dialog.querySelector('[data-card-clear]').addEventListener('click', () => dialog.close());
        dialog.querySelector('[data-card-done]').addEventListener('click', done);
        text.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); done(); } });
        dialog.addEventListener('close', () => { dialog.remove(); resolve(result); }, { once: true });
        document.body.append(dialog);
        showThemeModal(dialog);
        // 글자는 고른 글을 다 덮어(바로 칠 수 있게) — 폰에서는 자판이 화면을 덮지 않게 초점을 주지 않아요
        if (matchMedia('(hover: hover) and (pointer: fine)').matches) { text.focus(); text.select(); }
    });
}

async function run({ captured }) {
    const { index, raw, selected, screen, at } = captured;
    const message = messageOf(index);
    if (!message || message.mes !== raw) { toastr.warning(EDIT_REASONS.changed, '고른 글 고치기'); return; }
    if (translated(message)) { toastr.info(EDIT_REASONS.translated, '고른 글 고치기'); return; }
    const found = locateEdit(raw, selected, screen, at);
    if (!found.span) { toastr.warning(EDIT_REASONS[found.reason] || EDIT_REASONS.count, '고른 글 고치기'); return; }
    const original = raw.slice(found.span.start, found.span.end);
    const edited = await openEditor(original, spanContext(raw, found.span));
    if (edited === null || edited === original) return;
    const now = messageOf(index);
    if (now !== message || message.mes !== raw) { toastr.warning(EDIT_REASONS.changed, '고른 글 고치기'); return; }
    const next = replaceSpan(raw, found.span, edited);
    if (next === null || !next.trim()) { toastr.warning('메시지가 비게 돼요. 지우려면 메시지 지우기를 써 주세요.', '고른 글 고치기'); return; }
    await writeMessage(index, message, next);
    const toast = toastr.success(`#${index} 메시지의 고른 글을 고쳤어요.`, '고른 글 고치기', { timeOut: 6000 });
    attachUndo(toast, async () => {
        if (messageOf(index) !== message || message.mes !== next) { toastr.warning('그사이 메시지가 바뀌어 되돌리지 않았어요.', '고른 글 고치기'); return; }
        await writeMessage(index, message, raw);
    });
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncSelectionEdit(on) {
    wanted = !!on;
    if (wanted && !registered) {
        registered = true;
        registerSelectionTool({
            id: 'quickedit',
            order: 15,
            label: '고치기',
            aria: '고른 글 고치기',
            icon: () => 'fa-pen',
            enabled: () => { try { return wanted && document.body.classList.contains('salty') && getSettings().quick?.selEdit === true; } catch { return false; } },
            accepts,
            capture,
            run,
        });
        return;
    }
    if (registered) refreshSelectionBar();
}

/** 시험용 */
export const _forTest = { accepts, capture, run };
