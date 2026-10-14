// 6.4.5 고른 글 지우기 — 채팅에서 글을 고르면 (북마크 단추가 있으면 그 옆에) 「삭제」 단추가 뜬다.
// 누르면 작은 창: 번역문에서만 · 본문에서만 · 본문+번역문 · 취소. 자리 찾기 · 다듬기는 delete-core.js (순수 함수).
// 원칙: 확실하지 않으면 지우지 않고 그 선택지를 끈다. 사용자가 보지 않은 글은 지우지 않는다 — 다른 쪽(번역문에서 골라 원문 · 그 반대)을 지울 때는
//   그 자리 앞뒤 글을 창에 보여 주고 한 번 더 확인받는다. 고쳐 붙이는 복구보다 거절이 낫다.
//  · 고른 범위는 실제로 겹치는 글자 노드로 줄인다(selection-range.js — 세 번 클릭이 늘린 끝 · 마지막 문단이면 메시지 글 안으로 · 접기 요약 줄이면 그 줄로).
//    쪽 판정 · 고른 글도 그 노드로: 번역기의 원문 칸 · 번역문 칸 ·
//    접기의 요약 / 펼친 쪽 · 원문 보기 · 번역 안 한 메시지. 닫힌 접기 칸 속 글(렌더되지 않음)은 빼고, 보이는 다른 쪽 글이 섞이면 'mixed'(취소만)
//  · 같은 쪽: 화면에서 몇 번째 + 앞뒤 보이는 글이 같을 때. 다른 쪽: 고른 글의 줄마다 개수 목록이 두 글에서 같고 고른 줄에 하나뿐일 때 (delete-core.js)
//  · 끝 검사: 지우기 전 · 뒤를 실리태번 그리기(messageFormatting — 표시 정규식 · 마크다운 · 소독)로 그려 견준다. 고른 글 말고 보이는 글 · 블록 ·
//    꾸밈 · 그림이 바뀌면 그 쪽을 끈다 (delete-core.js formatKept — 정리 단계가 고르지 않은 글이나 꼴을 바꾸는 것을 하나로 막는다)
//    어느 쪽 글인지 모르면(오래된 번역 · 칸 밖 글) 아무것도 지우지 않는다
//  · 번역문 원본: 「사용 안 함」 보기면 보이는 번역문 그대로, 원문 병기 보기면 번역 기록 — 그 기록으로 다시 만든 표시가 지금 표시와 같을 때만 (다르면 번역문 쪽을 끈다)
//  · 다른 쪽에 같은 글이 없으면(번역된 문단 등) 그 쪽은 끈다 — 모델로 짝을 찾지 않는다 (v3: 문단 통째 지우기가 고르지 않은 그림 · 감싼 태그까지 지웠다)
//  · 지우기는 손으로 고친 것처럼: 번역문은 번역기의 수정 창과 같게(번역 기록 · translation_edited = 그 원문의 해시 · 표시를 다시 만듦 · edit_save 알림),
//    본문은 실리태번의 편집과 같은 차례(MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 저장)와 스와이프 맞추기.
//    본문이 바뀌면 번역은 새 원문의 것으로 옮겨 적어(해시 · 기록) 「오래된 번역」으로 숨지 않게 한다
//  · 실리태번의 저장(saveChatConditional)은 실패를 스스로 알리고 던지지 않는다 — 되돌리기는 이 기능의 단계(기록 · 표시 · 그리기)가 실패할 때이고,
//    되돌린 뒤 (다시 그리기가 또 실패해도) 늘 다시 저장한다. 번역 기록은 시작 때 읽어 둔 그 원문의 원래 줄로 (없었으면 지운다)
//  · 6.4.5 지우기 되돌리기: 지운 직후 「지웠어요」 알림의 ↶ 단추. 지우기 전 본문 · 스와이프 · 번역 표시 · 해시 · 번역 기록 줄로 돌린다.
//    그사이 그 메시지(mes · swipe · display_text · 원문 보기)가 바뀌었으면 돌리지 않고 한 줄로 알린다. 저장 · 다시 그리기는 지우기와 같은 차례
//    (실리태번 편집 차례 · 기본 번역 확장이 지운 표시 되살리기). 채팅을 바꾸면 사라지고, 채팅마다 마지막 지우기 하나만 둔다
import { getSettings } from '../../../settings.js';
import { addonsEnabled } from '../../../usage-mode.js';
import { trimToRoot, paragraphEnd } from '../../../selection-range.js';
import { esc } from './core.js';
import { context, chatKey, exclusive, captureGuard, deleteEnabled, deleteHooks } from './state.js';
import * as D from './delete-core.js';

const CHIP_ID = 'llmt-select-delete';
const BOOKMARK_CHIP = 'cg-select-chip';
const RETRANSLATE_BAR = 'llmt-selection-selection';
const OBSTACLES = '.bwr_quickban:not([hidden]), #llmt-selection-selection';
const DELAY = 340;   // 북마크 단추(300ms)가 자리 잡은 뒤
const TEXT_INPUT = /^(text|search|url|tel|email|password|number)$/;
const BLOCKS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DETAILS', 'SUMMARY', 'TR', 'UL', 'OL', 'TABLE', 'HR']);
const MARKUP = /llm-translator-details|class="(?:translated|original)_text|llmt-para-gap/;
const MODES = { translation: '번역문에서만', original: '본문에서만', both: '본문+번역문' };

let chip = null, timer = 0, frame = 0, held = null, pending = null, pressTimer = 0, pressing = false, listening = false, watched = null, observer = null;
let dialog = null;
let lastDelete = null, undoToast = null;   // 6.4.5 마지막 지우기 하나 (채팅을 바꾸면 비움)

const translatorOn = () => {
    try { const theme = getSettings(); return !!theme && addonsEnabled(theme) && theme.addons?.translator === true; } catch { return false; }
};
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const elementOf = node => (node?.nodeType === 1 ? node : node?.parentElement) ?? null;
const textRoot = node => elementOf(node)?.closest?.('#chat .mes_text') ?? null;

function typingInField() {
    const element = document.activeElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && TEXT_INPUT.test(element.type));
}

/** 한 메시지의 화면 글(.mes_text) 안에서 고른 글이면 { range, root, index } — 범위는 실제로 겹치는 글자 노드로 줄인 것 */
function currentSelection() {
    if (typingInField()) return null;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
    const raw = selection.getRangeAt(0);
    let range = trimToRoot(raw, textRoot, { skip: unrendered });
    if (!range) return null;
    range = summaryOnly(raw, range) ?? range;
    const root = textRoot(range.startContainer);
    if (!root || root !== textRoot(range.endContainer)) return null;
    const mes = root.closest('.mes');
    if (!mes || mes.parentElement?.id !== 'chat' || mes.querySelector('.edit_textarea')) return null;
    const index = Number.parseInt(mes.getAttribute('mesid') ?? '', 10);
    if (!Number.isInteger(index) || index < 0) return null;
    return { range, root, index };
}

/**
 * 접기 · 원문 먼저 보기의 요약 줄을 세 번 클릭하면(문단 고르기) 누를 때마다 칸이 여닫혀 열린 채로 끝나고, 끝은 다음 칸 앞까지 늘어 펼친 쪽 글까지 고른다
 * → 요약 줄 안으로 줄인다 (덜 고르는 쪽으로만). 세 번 클릭의 꼴일 때만: 시작이 요약 줄 첫 글자이고 끝이 블록 경계(요소 경계 · 글자 노드 처음).
 * 끌어서 고른 범위(끝이 글자 가운데)는 그대로 둔다 — 두 쪽이 섞이면 취소만
 */
function summaryOnly(raw, range) {
    const summary = elementOf(range.startContainer)?.closest('summary');
    if (!summary || summary.contains(range.endContainer)) return null;
    if (!summary.parentElement?.matches('details.llm-translator-details, details.custom-llm-translator-details')) return null;
    if (!paragraphEnd(raw)) return null;
    const walker = document.createTreeWalker(summary, NodeFilter.SHOW_TEXT);
    let first = null, last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.data.trim()) { first ??= node; last = node; }
    if (!first || range.startContainer !== first || range.startOffset > first.data.search(/\S/)) return null;
    const out = document.createRange();
    out.setStart(range.startContainer, range.startOffset);
    out.setEnd(last, last.length);
    return out;
}

// ── 어느 쪽 글인가 ─────────────────────────────────────────

/** 번역기의 원문 보기: 번역문을 백업에 치워 두고 원문을 보여 주는 중 */
function showingOriginal(message, source) {
    const extra = message?.extra;
    return !!extra?.display_text && !!extra.original_translation_backup && extra.display_text === source;
}

/** 이 메시지의 화면 글 전체가 어느 쪽인가 (번역기 칸 표시가 없는 글자에 쓴다) */
function baseSide(message, source) {
    const extra = message?.extra;
    if (!extra?.display_text) return 'original';                 // 번역 안 한 메시지
    if (showingOriginal(message, source)) return 'original';
    const ours = extra.original_text_hash === deleteHooks()?.hashOf(source);
    if (!ours) return 'unknown';                                  // 다른 번역 · 오래된 번역
    // 원문 병기 칸 표시가 없고 원문이 통째로 들어 있지 않으면 번역문만 보이는 글('사용 안 함' 보기). 표시가 있으면 칸 밖 글자(보호 블록 등)는 어느 쪽인지 모른다
    const shown = extra.display_text;
    if (MARKUP.test(shown)) return 'unknown';
    return D.norm(shown).includes(D.norm(source)) ? 'unknown' : 'translation';
}

/** 글자 마디 하나의 쪽: 원문 칸 · 번역문 칸 · 접기(요약 / 펼친 쪽) · 그 밖은 base (실리태번은 메시지 글의 class 앞에 custom- 를 붙인다) */
function nodeSide(node, base) {
    const element = elementOf(node);
    if (!element) return base;
    if (element.closest('.original_text, .custom-original_text')) return 'original';
    if (element.closest('.translated_text, .custom-translated_text')) return 'translation';
    const details = element.closest('details.llm-translator-details, details.custom-llm-translator-details');
    if (details) {
        const inSummary = !!element.closest('summary');
        const originalFirst = details.classList.contains('mode-original-first') || details.classList.contains('custom-mode-original-first');
        return inSummary === originalFirst ? 'original' : 'translation';
    }
    return base;
}
/** 렌더되지 않는 글: 닫힌 접기 칸의 요약 밖 */
const unrendered = node => { const element = elementOf(node); const details = element?.closest('details'); return !!details && !details.open && !element.closest('summary'); };

/**
 * 고른 범위를 그 메시지 화면 글에 놓고 본다 → { side, text, screen, at }
 *  side: 겹친 보이는 글자 노드들의 쪽 (여럿이면 'mixed') · text: 그 쪽 노드 조각을 이은 고른 글 · screen: 그 쪽 화면 글 전체(블록 · 줄바꿈은 \n) · at: 고른 글의 시작 자리
 */
function readSelection(root, range, base) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: node => (node.nodeType === 1 && (node.tagName === 'BUTTON' || node.tagName === 'STYLE' || node.tagName === 'SCRIPT') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    const sides = new Set();
    for (const node of nodes) {
        if (node.nodeType !== 3 || !range.intersectsNode(node) || unrendered(node)) continue;
        const s = node === range.startContainer ? range.startOffset : 0, e = node === range.endContainer ? range.endOffset : node.length;
        if (e > s && node.data.slice(s, e).trim()) sides.add(nodeSide(node, base));
    }
    if (sides.size !== 1) return { side: sides.size ? 'mixed' : 'none', text: sides.size ? quoteOf(nodes, range, base) : '' };
    const side = [...sides][0];
    let screen = '', text = '', at = -1, inside = false;
    for (const node of nodes) {
        if (node.nodeType === 1) { if (node.tagName === 'BR' || BLOCKS.has(node.tagName)) { screen += '\n'; if (inside) text += '\n'; } continue; }
        if (nodeSide(node, base) !== side) continue;
        if (range.intersectsNode(node) && !unrendered(node)) {
            const s = node === range.startContainer ? range.startOffset : 0, e = node === range.endContainer ? range.endOffset : node.length;
            if (e > s) { if (at < 0) at = screen.length + s; text += node.data.slice(s, e); inside = true; }
        }
        screen += node.data;
        if (node === range.endContainer) inside = false;
    }
    return { side, text: text.trim(), screen, at };
}

/** 섞인 고르기(원문 · 번역문)의 미리 보기 글 — 줄바꿈 · 블록 자리와 쪽이 바뀌는 자리에서 줄을 바꿔 잇는다 (「…끝.알파…」처럼 붙지 않게) */
function quoteOf(nodes, range, base) {
    let text = '', inside = false, last = null;
    for (const node of nodes) {
        if (node.nodeType === 1) { if (inside && (node.tagName === 'BR' || BLOCKS.has(node.tagName))) text += '\n'; continue; }
        if (!range.intersectsNode(node) || unrendered(node)) continue;
        const s = node === range.startContainer ? range.startOffset : 0, e = node === range.endContainer ? range.endOffset : node.length;
        if (e <= s) continue;
        const piece = node.data.slice(s, e), side = nodeSide(node, base);
        if (piece.trim() && last && side !== last && !/\s$/.test(text)) text += '\n';
        if (piece.trim()) last = side;
        text += piece;
        inside = true;
        if (node === range.endContainer) break;
    }
    return text.trim();
}

/** 누르는 순간의 고른 글 — 화면이 바뀌기 전에 쪽 · 자리를 떠 둔다 */
function snapshotOf(target) {
    if (!target?.root?.isConnected) return null;
    const ctx = context(), message = ctx.chat?.[target.index];
    if (!message) return null;
    const source = ctx.substituteParams(message.mes, ctx.name1, message.name);
    const base = baseSide(message, source);
    const read = readSelection(target.root, target.range, base);
    if (read.side === 'none') return null;
    const text = read.text ?? '';
    if (read.side !== 'mixed' && (!text || text.length > 6000)) return null;
    const ordinal = read.side !== 'mixed' && read.at >= 0 ? D.screenOrdinal(read.screen, read.at, text) : null;
    return {
        index: target.index, message, text: text || target.range.toString().trim(), side: read.side, ordinal, screen: read.screen ?? '', source, chatKey: chatKey(), guard: captureGuard(message),
        mes: message.mes, swipe: message.swipe_id, display: message.extra?.display_text, backup: message.extra?.original_translation_backup,
        viewingOriginal: showingOriginal(message, source),
    };
}

// ── 지울 자리 정하기 ────────────────────────────────────────

/** 지운 글 (지울 수 없거나 지우면 비면 null — 비는 것은 plan.emptied 로 알린다) */
const result = (raw, span, plan) => {
    if (!raw || !span) return null;
    const r = D.deleteSpan(raw, span);
    if (!r) plan.shape = true;                       // 태그 · 줄을 넘는 강조 · 마크다운 꼴이 바뀜
    else if (!r.text.trim()) plan.emptied = true;
    return r && r.text.trim() ? r.text : null;
};

/** 실리태번 그리기 (표시 정규식 · 마크다운 · 소독 — 그 메시지 자리 그대로) → HTML. 없으면 null (끝 검사 없이 delete-core 의 검사만) */
function painter(message, index) {
    const ctx = context(), format = ctx.messageFormatting;
    if (typeof format !== 'function') return null;
    // 원래 글은 매크로를 바꾼 글로 그린다 — 첫 메시지(0번)를 그릴 때 실리태번이 채팅의 mes 를 바꿔 적는 일이 없게 (바꾼 글은 mes 와 다르다)
    return text => format(ctx.substituteParams(text, ctx.name1, message.name), message.name, !!message.is_system, !!message.is_user, index);
}

/** 무엇을 지울 수 있나 */
async function planOf(snap) {
    const hooks = deleteHooks();
    const message = snap.message, extra = message.extra ?? {};
    const hash = hooks.hashOf(snap.source);
    const hasTranslation = !!(extra.display_text || extra.original_translation_backup);
    const ours = hasTranslation && extra.original_text_hash === hash;
    const plan = { hash, ours, hasTranslation, trans: null, origSpan: null, transSpan: null, origCross: false, transCross: false, newMes: null, newTrans: null,
        emptied: false, shape: false, format: false, sameFail: false, crossFail: false, noTrans: false, why: '' };
    if (snap.side === 'unknown') { plan.why = '어느 쪽 글인지 알 수 없어 지우지 않아요.'; return plan; }
    // 번역문 원본: 「사용 안 함」 보기(칸 표시 없음)면 보이는 번역문 그대로, 칸 표시가 있으면 번역 기록 — 그 기록으로 다시 만든 표시가 지금 표시와 같을 때만
    if (ours) {
        const shown = snap.viewingOriginal ? extra.original_translation_backup : extra.display_text;
        if (typeof shown === 'string' && shown.trim() && !MARKUP.test(shown)) plan.trans = shown;
        else {
            let raw = null;
            try { raw = await hooks.rawTranslation(message, snap.source); } catch { raw = null; }
            if (typeof raw === 'string' && raw.trim() && hooks.render(snap.source, raw) === shown) plan.trans = raw;
        }
    }
    plan.noTrans = ours && !plan.trans;
    const sel = snap.text;
    if (snap.side === 'original') {
        plan.origSpan = D.pickSame(message.mes, sel, snap.ordinal, snap.screen);
        plan.sameFail = !plan.origSpan;
        if (plan.origSpan && plan.trans) { plan.transSpan = D.pickCross(plan.trans, sel, message.mes, plan.origSpan); plan.transCross = !!plan.transSpan; plan.crossFail = !plan.transSpan; }
    } else if (snap.side === 'translation' && plan.trans) {
        plan.transSpan = D.pickSame(plan.trans, sel, snap.ordinal, snap.screen);
        plan.sameFail = !plan.transSpan;
        if (plan.transSpan) { plan.origSpan = D.pickCross(message.mes, sel, plan.trans, plan.transSpan); plan.origCross = !!plan.origSpan; plan.crossFail = !plan.origSpan; }
    }
    plan.newMes = result(message.mes, plan.origSpan, plan);
    plan.newTrans = result(plan.trans, plan.transSpan, plan);
    // 끝 검사: 지우기 전 · 뒤를 실리태번 그리기로 견준다 — 고른 글 말고 보이는 글 · 블록 · 꾸밈 · 그림이 바뀌면 그 쪽을 끈다 (그리기가 던져도 끈다)
    const paint = painter(message, snap.index);
    if (paint) {
        const kept = (before, after) => {
            try {
                const next = paint(after), shape = D.renderShape(next);
                if (!shape.text.trim() && !shape.keeps.length) { plan.emptied = true; return false; }
                return D.formatKept(paint(before), next, sel);
            } catch { return false; }
        };
        if (plan.newMes && !kept(message.mes, plan.newMes)) { plan.newMes = null; plan.format = true; }
        if (plan.newTrans && !kept(plan.trans, plan.newTrans)) { plan.newTrans = null; plan.format = true; }
    }
    // 실제 번역기와 같은 격리 · 문단 큐로 확인한다. 한쪽 줄만 빠져 다른 문단이 짝지어지는 선택지는 끈다.
    if (ours && plan.trans && hooks.layout) {
        plan.layout = {};
        try {
            const before = hooks.layout(snap.source, plan.trans);
            if (before) {
                for (const mode of ['translation', 'original', 'both']) {
                    const mes = mode === 'translation' ? message.mes : plan.newMes;
                    const trans = mode === 'original' ? plan.trans : plan.newTrans;
                    if (!mes || !trans) { plan.layout[mode] = false; continue; }
                    const after = hooks.layout(context().substituteParams(mes, context().name1, message.name), trans);
                    plan.layout[mode] = !!after && before.original - after.original === before.translation - after.translation;
                    if (!plan.layout[mode]) plan.format = true;
                }
            }
        } catch { plan.layout = { translation: false, original: false, both: false }; plan.format = true; }
    }
    return plan;
}

/** 선택지마다 쓸 수 있나 */
function available(plan) {
    const keeps = !plan.ours || !!plan.trans;   // 번역문이 붙어 있으면 새 원문으로 옮겨 적을 수 있어야 한다
    return {
        translation: plan.ours && !!plan.newTrans && plan.layout?.translation !== false,
        original: !!plan.newMes && keeps && plan.layout?.original !== false,
        both: plan.ours && !!plan.trans && !!plan.newMes && !!plan.newTrans && plan.layout?.both !== false,
    };
}

/** 꺼 둔 선택지가 있을 때 한 줄 까닭 (고른 쪽에서 자리를 못 맞춘 것이 먼저 — 그때는 반대쪽 문구가 틀린 까닭이 된다) */
function offReason(plan) {
    if (plan.hasTranslation && !plan.ours) return '번역문이 지금 원문의 것이 아니에요.';
    if (plan.sameFail) return '화면 글과 원래 글의 자리를 맞추지 못했어요. 더 좁게 골라 보세요.';
    if (plan.emptied) return '지우면 글이 모두 없어지는 쪽은 꺼 두었어요. 메시지를 지우려면 메시지 삭제를 써 주세요.';
    if (plan.shape) return '지우면 서식(태그 · 제목 · 목록 같은)이 깨지는 쪽은 꺼 두었어요. 더 좁게 골라 보세요.';
    if (plan.format) return '지우면 서식이 바뀌는 쪽은 꺼 두었어요. 더 좁게 골라 보세요.';
    if (plan.noTrans) return '번역문이 지금 보기 설정으로 그린 모양과 달라 번역문 쪽은 지우지 않아요.';
    if (plan.crossFail) return '반대쪽 글은 같은 글이 줄마다 같은 수로 있고 그 줄에 하나뿐일 때만 지울 수 있어요.';
    return '지울 자리를 확실히 찾지 못했어요. 다시 골라 주세요.';
}

// ── 지우기 ─────────────────────────────────────────────────

function assertAlive(snap) {
    const ctx = context(), message = snap.message;
    try { snap.guard?.assert(); } catch { throw Object.assign(Error('메시지나 번역이 바뀌었어요. 다시 골라 주세요.'), { cancelled: true }); }   // 번역기 가드 문구(「번역을 멈췄어요」)는 지우기 창에 맞지 않는다
    if (chatKey() !== snap.chatKey || ctx.chat?.[snap.index] !== message || message.mes !== snap.mes || message.swipe_id !== snap.swipe
        || message.extra?.display_text !== snap.display || message.extra?.original_translation_backup !== snap.backup) {
        throw Object.assign(Error('메시지나 번역이 바뀌었어요. 다시 골라 주세요.'), { cancelled: true });
    }
    if (document.querySelector(`#chat .mes[mesid="${snap.index}"] .edit_textarea`)) throw Error('이 메시지를 고치는 중이에요. 고치기를 끝낸 뒤 다시 골라 주세요.');
    if (deleteHooks()?.busy?.(snap.index)) throw Error('이 메시지를 번역하는 중이에요. 끝난 뒤 다시 골라 주세요.');
}

/** mode: 'translation' | 'original' | 'both' */
function applyDelete(snap, plan, mode) {
    return exclusive(() => applyNow(snap, plan, mode));
}
async function applyNow(snap, plan, mode) {
    assertAlive(snap);
    if (!available(plan)[mode]) throw Error('지울 자리를 확실히 찾지 못했어요. 다시 골라 주세요.');
    const ctx = context(), hooks = deleteHooks(), message = snap.message, id = snap.index;
    const original = mode !== 'translation', translation = mode !== 'original';
    const newMes = original ? plan.newMes : message.mes;
    const newTrans = translation ? plan.newTrans : plan.trans;
    if (original && !newMes?.trim()) throw Error('본문이 모두 지워지거나 지울 자리를 확실히 찾지 못했어요.');
    if (translation && !newTrans?.trim()) throw Error('번역문이 모두 지워지거나 지울 자리를 확실히 찾지 못했어요.');
    message.extra ??= {};
    const extra = message.extra;
    const before = { mes: message.mes, swipe: message.swipes?.[message.swipe_id], extra: structuredClone(extra) };
    const key = original ? ctx.substituteParams(newMes, ctx.name1, message.name) : snap.source;
    // 번역 기록: key(번역문에서만이면 그 원문, 본문이 바뀌면 새 원문)의 줄을 쓴다 — 실패 · 되돌리기 때 돌릴 원래 줄을 지금 읽어 둔다
    //  (null = 없었음 → 지움, undefined = 못 읽음 → 기록은 건드리지 않고 둔다)
    const writesRow = plan.ours && plan.trans !== null;
    let rowBefore;
    if (writesRow) {
        try { rowBefore = await hooks.cachedTranslation?.(key); } catch { rowBefore = undefined; }
        if (rowBefore === undefined) throw Error('번역 기록을 읽지 못해 지우지 않았어요. 다시 시도해 주세요.');
    }
    assertAlive(snap);   // 기록을 기다리는 동안 바뀐 채팅 · 글은 덮어쓰지 않는다
    const restore = async () => {
        message.mes = before.mes;
        if (Array.isArray(message.swipes) && message.swipe_id !== undefined) message.swipes[message.swipe_id] = before.swipe;
        for (const name of Object.keys(extra)) delete extra[name];
        Object.assign(extra, before.extra);
        try { hooks.syncSwipe?.(id); await hooks.refresh(id, message); }
        catch { /* 다시 그리기가 또 실패해도 저장은 한다 */ }
        finally { await ctx.saveChat(); }   // 그사이 다른 확장이 저장한 상태를 되돌린 상태로 덮는다
    };
    try {
        // 번역: 손으로 고친 번역과 같은 표시 · 기록 (본문만 지울 때는 번역문 그대로 새 원문의 것으로 옮긴다)
        if (plan.ours && plan.trans !== null) {
            const keyHash = hooks.hashOf(key);
            const edited = translation || extra.translation_edited === plan.hash;
            await hooks.saveTranslation(key, newTrans);
            extra.original_text_hash = keyHash;
            if (edited) extra.translation_edited = keyHash; else delete extra.translation_edited;
            const display = hooks.render(key, newTrans);
            if (!display) throw Error('번역 표시를 만들지 못했어요.');
            if (snap.viewingOriginal) { extra.display_text = key; extra.original_translation_backup = display; }
            else { extra.display_text = display; delete extra.original_translation_backup; }
        }
        if (original) {
            message.mes = newMes;
            if (Array.isArray(message.swipes) && message.swipe_id !== undefined) message.swipes[message.swipe_id] = newMes;
            if (ctx.chatMetadata) ctx.chatMetadata.tainted = true;   // 실리태번의 수정과 같이 (첫 인사를 카드 글로 되돌리지 않게)
            const types = ctx.eventTypes ?? ctx.event_types;
            const kept = plan.ours && plan.trans !== null ? { display: extra.display_text, backup: extra.original_translation_backup } : null;
            await ctx.eventSource.emit(types.MESSAGE_EDITED, id);
            await hooks.refresh(id, message);
            await ctx.eventSource.emit(types.MESSAGE_UPDATED, id);
            // 실리태번 기본 번역 확장은 MESSAGE_UPDATED 에 (그 확장의 자동 번역이 꺼져 있으면) display_text 를 지운다.
            // 번역문은 위에서 새 원문의 것으로 옮겨 적었으니, 지워지기만 하고 다른 글로 바뀌지 않았으면 되살린다 (「오래된 번역」으로 숨지 않게)
            if (kept?.display && !extra.display_text) {
                extra.display_text = kept.display;
                if (kept.backup) extra.original_translation_backup = kept.backup;
                await hooks.refresh(id, message);
            }
        } else {
            await hooks.refresh(id, message);
        }
        hooks.syncSwipe?.(id);
    } catch (error) {
        await restore().catch(() => {});
        if (writesRow && rowBefore !== undefined) await putRow(hooks, key, rowBefore);
        throw error;
    }
    await ctx.saveChat();   // 실리태번의 저장은 실패를 스스로 알린다 (던지지 않음)
    if (translation && plan.ours) hooks.uiUpdate?.(id, 'edit_save');
    // 원문 보기 상태 표시 (번역기의 돋보기 단추가 이것을 본다 — 번역기가 하듯 다시 그린 뒤)
    setTimeout(() => {
        const block = globalThis.jQuery?.(`#chat .mes[mesid="${id}"] .mes_text`);
        if (block?.length && context().chat?.[id] === message) block.data('showing-original', !!snap.viewingOriginal && !!extra.original_translation_backup);
    }, 100);
    // 6.4.5 되돌리기 기록 (채팅마다 마지막 하나)
    lastDelete = {
        chatKey: snap.chatKey, index: id, message, original, translation, ours: plan.ours, viewingOriginal: snap.viewingOriginal,
        before,
        after: { mes: message.mes, swipeId: message.swipe_id, swipe: message.swipes?.[message.swipe_id], display: extra.display_text, backup: extra.original_translation_backup },
        row: writesRow ? { key, before: rowBefore, after: newTrans } : null,
    };
    return { mes: message.mes, translation: newTrans, undo: lastDelete };
}

/** 번역 기록 한 줄을 그 값으로 (null 이면 지움) — 실패는 삼킨다 (되돌리기의 끝손질) */
async function putRow(hooks, key, value) {
    try {
        if (value === null) await hooks.dropTranslation?.(key);
        else await hooks.saveTranslation(key, value);
    } catch { /* 없는 줄 지우기 등 */ }
}

/** 메시지를 그 상태(mes · 스와이프 · extra)로 */
function putState(message, state) {
    message.mes = state.mes;
    if (Array.isArray(message.swipes) && message.swipe_id !== undefined) message.swipes[message.swipe_id] = state.swipe;
    message.extra ??= {};
    for (const name of Object.keys(message.extra)) delete message.extra[name];
    Object.assign(message.extra, structuredClone(state.extra));
}

/**
 * 6.4.5 마지막 지우기를 되돌린다 — 그사이 메시지가 바뀌었으면 하지 않는다 (던짐).
 * 차례는 지우기와 같다: 번역 기록 줄 → 메시지 상태 → (본문이 바뀌었으면) MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 표시 되살리기 → 스와이프 → 저장
 */
async function undoNow(record) {
    const ctx = context(), hooks = deleteHooks(), message = record.message, id = record.index;
    const extra = message.extra ?? {};
    const after = record.after;
    if (chatKey() !== record.chatKey || ctx.chat?.[id] !== message || message.mes !== after.mes || message.swipe_id !== after.swipeId
        || message.swipes?.[message.swipe_id] !== after.swipe || extra.display_text !== after.display || extra.original_translation_backup !== after.backup) {
        throw Object.assign(Error('그사이 메시지가 바뀌어 되돌리지 않았어요.'), { cancelled: true });
    }
    if (document.querySelector(`#chat .mes[mesid="${id}"] .edit_textarea`)) throw Error('이 메시지를 고치는 중이라 되돌리지 않았어요.');
    if (hooks?.busy?.(id)) throw Error('이 메시지를 번역하는 중이라 되돌리지 않았어요.');
    const now = { mes: message.mes, swipe: message.swipes?.[message.swipe_id], extra: structuredClone(extra) };
    const rowBack = record.row && record.row.before !== undefined;
    try {
        if (rowBack) {
            if (record.row.before === null) { try { await hooks.dropTranslation?.(record.row.key); } catch { /* 이미 없음 */ } }
            else await hooks.saveTranslation(record.row.key, record.row.before);
        }
        putState(message, record.before);
        const back = message.extra;
        if (record.original) {
            if (ctx.chatMetadata) ctx.chatMetadata.tainted = true;
            const types = ctx.eventTypes ?? ctx.event_types;
            const kept = { display: back.display_text, backup: back.original_translation_backup };
            await ctx.eventSource.emit(types.MESSAGE_EDITED, id);
            await hooks.refresh(id, message);
            await ctx.eventSource.emit(types.MESSAGE_UPDATED, id);
            // 지우기와 같은 규칙: 기본 번역 확장이 표시를 지우기만 했으면(다른 글로 바꾸지 않았으면) 되살린다
            if (kept.display && !back.display_text) {
                back.display_text = kept.display;
                if (kept.backup) back.original_translation_backup = kept.backup;
                await hooks.refresh(id, message);
            }
        } else {
            await hooks.refresh(id, message);
        }
        hooks.syncSwipe?.(id);
    } catch (error) {
        // 되돌리다 실패하면 지운 상태로 다시 (기록 줄도) — 그 상태를 저장한다
        putState(message, now);
        if (rowBack) await putRow(hooks, record.row.key, record.row.after);
        try { hooks.syncSwipe?.(id); await hooks.refresh(id, message); }
        catch { /* 저장은 한다 */ }
        finally { await ctx.saveChat(); }
        throw Object.assign(Error(`되돌리지 못했어요: ${error?.message || '알 수 없는 까닭'}`), { cause: error });
    }
    await ctx.saveChat();
    if (record.translation && record.ours) hooks.uiUpdate?.(id, 'edit_save');
    setTimeout(() => {
        const block = globalThis.jQuery?.(`#chat .mes[mesid="${id}"] .mes_text`);
        const back = message.extra ?? {};
        if (block?.length && context().chat?.[id] === message) block.data('showing-original', !!record.viewingOriginal && !!back.original_translation_backup);
    }, 100);
}

function clearUndo() {
    lastDelete = null;
    if (undoToast) globalThis.toastr?.clear?.(undoToast, { force: true });   // 누른 단추에 초점이 남으면 force 없이는 안 닫힌다
    undoToast = null;
}

/** 알림의 ↶ — 마지막 지우기를 한 번만 되돌린다 (눌린 뒤에는 기록을 비운다) */
async function undoLast() {
    const record = lastDelete;
    clearUndo();
    if (!record) return;
    try {
        await exclusive(() => undoNow(record));
        globalThis.toastr?.success('되돌렸어요.', '', { timeOut: 1800 });
    } catch (error) {
        globalThis.toastr?.warning(error?.message || '되돌리지 못했어요.', '', { timeOut: 4000 });
    }
}

/** 「지웠어요」 알림 + 아이콘 단추 하나 (툴팁 없음 — 읽어 주기용 이름만) */
function showDeletedToast() {
    const toastr = globalThis.toastr;
    if (!toastr) return;
    if (undoToast) toastr.clear?.(undoToast, { force: true });
    undoToast = toastr.success('고른 글을 지웠어요. <button type="button" class="menu_button llmt-undo-delete" data-undo-delete aria-label="되돌리기"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>', '', {
        escapeHtml: false, closeButton: false, tapToDismiss: true, timeOut: 8000, extendedTimeOut: 6000,
        onclick: event => { if (event?.target?.closest?.('[data-undo-delete]')) void undoLast(); },
    });
}

// ── 고르는 창 ──────────────────────────────────────────────

function closeDialog() { dialog?.close(); }

async function makeDialog() {
    const { showThemeModal } = await import('../../../modal.js');   // 실리태번 창 도구 — 쓸 때 불러온다 (시험은 창 없이 돈다)
    closeDialog();
    const box = document.createElement('dialog');
    box.className = 'llmt-selection llmt-delete';
    box.setAttribute('aria-label', '고른 글 지우기');
    box.innerHTML = '<header><span class="llmt-selection-title"><i class="fa-solid fa-trash-can" aria-hidden="true"></i><h3>고른 글 지우기</h3></span><button type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="llmt-selection-body"></div><p class="llmt-selection-status" role="status" aria-live="polite"></p>';
    document.body.append(box);
    box.querySelector('[data-close]').onclick = () => box.close();
    // 화면 가운데 (선택 부분 재번역 창과 같게 — 폰 자판 · 확대에도)
    const fit = () => {
        const view = window.visualViewport, height = view?.height || innerHeight;
        box.style.maxHeight = `${Math.max(120, height - 24)}px`;
        box.style.top = `${(view?.offsetTop || 0) + Math.max(12, (height - box.offsetHeight) / 2)}px`;
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    observer?.observe(box);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    box.addEventListener('close', () => {
        observer?.disconnect();
        window.removeEventListener('resize', fit);
        window.visualViewport?.removeEventListener('resize', fit);
        box.remove();
        if (dialog === box) dialog = null;
    });
    showThemeModal(box);
    fit();
    dialog = box;
    return box;
}
const status = (box, text) => { const line = box.querySelector('[role=status]'); if (line) line.textContent = text; };

/** 다른 쪽 지울 자리 앞뒤 (보이는 글) — 「…앞 글[지울 글]뒤 글…」 */
function contextHtml(raw, span, selected) {
    const { text } = D.visibleText(raw);
    const k = D.occurrences(raw, selected).find(item => item.start === span.start)?.vis ?? -1;
    if (k < 0) return esc(D.norm(selected));
    const key = D.norm(selected), before = text.slice(Math.max(0, k - 30), k), after = text.slice(k + key.length, k + key.length + 30);
    return `${k > 30 ? '…' : ''}${esc(before)}<mark>${esc(key)}</mark>${esc(after)}${k + key.length + 30 < text.length ? '…' : ''}`;
}

async function openDialog(snap) {
    const box = await makeDialog(), body = box.querySelector('.llmt-selection-body');
    body.innerHTML = `<p class="llmt-delete-quote">${esc(snap.text)}</p><div class="llmt-delete-actions" data-actions></div>`;
    const actions = body.querySelector('[data-actions]');
    const cancel = () => box.close();
    const onlyCancel = (why) => { status(box, why); actions.innerHTML = '<button type="button" data-cancel>취소</button>'; actions.querySelector('[data-cancel]').onclick = cancel; };
    if (snap.side === 'mixed') { onlyCancel('원문 · 번역문 한쪽 글만 골라 주세요.'); return; }
    status(box, '찾는 중…');
    let plan;
    try { assertAlive(snap); plan = await planOf(snap); } catch (error) { onlyCancel(error.message || '지울 자리를 찾지 못했어요.'); return; }
    if (!box.isConnected) return;
    if (plan.why) { onlyCancel(plan.why); return; }
    const can = available(plan);
    const shown = plan.hasTranslation ? ['translation', 'original', 'both'] : ['original'];   // 번역 안 한 메시지는 본문만
    actions.innerHTML = shown.map(mode => `<button type="button" data-mode="${mode}" data-danger${can[mode] ? '' : ' disabled'}>${MODES[mode]}</button>`).join('') + '<button type="button" data-cancel>취소</button>';
    actions.querySelector('[data-cancel]').onclick = cancel;
    status(box, shown.some(mode => !can[mode]) ? offReason(plan) : '');
    let busy = false;
    const confirmStep = (html, label) => new Promise((resolve, reject) => {
        actions.innerHTML = `${html}<button type="button" data-confirm data-danger>${label}</button><button type="button" data-cancel>취소</button>`;
        actions.querySelector('[data-cancel]').onclick = cancel;
        actions.querySelector('[data-confirm]').onclick = resolve;
        box.addEventListener('close', () => reject(Object.assign(Error('취소'), { cancelled: true })), { once: true });
    });
    for (const button of actions.querySelectorAll('[data-mode]')) {
        button.onclick = async () => {
            if (busy) return;
            busy = true;
            const mode = button.dataset.mode;
            for (const other of actions.querySelectorAll('button')) other.disabled = true;
            try {
                const originalPart = mode !== 'translation', translationPart = mode !== 'original';
                if ((originalPart && plan.origCross) || (translationPart && plan.transCross)) {
                    // 다른 쪽 글은 사용자가 보고 있지 않다 — 그 자리 앞뒤를 보여 주고 확인받는다
                    const parts = [];
                    if (originalPart && plan.origCross) parts.push(`<details open><summary>지울 원문 자리</summary><p class="llmt-delete-context">${contextHtml(snap.message.mes, plan.origSpan, snap.text)}</p></details>`);
                    if (translationPart && plan.transCross) parts.push(`<details open><summary>지울 번역문 자리</summary><p class="llmt-delete-context">${contextHtml(plan.trans, plan.transSpan, snap.text)}</p></details>`);
                    parts.push('<p class="llmt-delete-note">같은 글이 줄마다 같은 수로 있어 같은 줄의 것으로 짝지었어요. 자리가 맞을 때만 지워 주세요.</p>');
                    status(box, '');
                    await confirmStep(parts.join(''), `${MODES[mode]} 지우기`);
                }
                for (const other of actions.querySelectorAll('button')) other.disabled = true;
                status(box, '지우는 중…');
                await applyDelete(snap, plan, mode);
                box.close();
                showDeletedToast();
            } catch (error) {
                if (error?.cancelled && !box.isConnected) return;
                status(box, error?.message || '지우지 못했어요.');
                for (const other of actions.querySelectorAll('button')) other.disabled = !!other.dataset.mode && !can[other.dataset.mode];
                actions.querySelector('[data-confirm]')?.setAttribute('disabled', '');
            } finally { busy = false; }
        };
    }
}

// ── 단추 ───────────────────────────────────────────────────

function ensureChip() {
    if (chip?.isConnected) return chip;
    chip = document.getElementById(CHIP_ID) ?? document.createElement('button');
    chip.id = CHIP_ID;
    chip.type = 'button';
    chip.className = 'llmt-select-delete';
    chip.hidden = true;
    chip.setAttribute('aria-label', '고른 글 지우기');
    chip.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i><span>삭제</span>';
    // 누르는 순간 선택이 풀리기 전에(초점 이동 · 안드로이드 탭) 쪽 · 자리를 떠 둔다 (북마크 단추와 같게)
    chip.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button > 0) return;
        pressing = true;
        clearTimeout(pressTimer);
        pending = held ? safeSnapshot(held) : null;
    });
    for (const type of ['pointerup', 'pointercancel']) {
        chip.addEventListener(type, () => {
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => { pressing = false; pending = null; schedule(); }, 600);
        });
    }
    chip.addEventListener('contextmenu', event => event.preventDefault());
    chip.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        commit();
    });
    document.body.append(chip);
    return chip;
}

function safeSnapshot(target) {
    try { return snapshotOf(target); } catch (error) { console.warn('[LLM Translator] 고른 글을 읽지 못했어요:', error); return null; }
}

export function hideDeleteChip() {
    clearTimeout(timer);
    timer = 0;
    if (chip) chip.hidden = true;
    held = null;
}

function rectsOf(range) {
    try { return [...range.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5); } catch { return []; }
}
const overlaps = (a, b, pad = 4) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

/** 북마크 단추가 보이면 그 오른쪽(자리가 없으면 왼쪽 · 아래), 없으면 북마크 단추와 같은 자리(고른 글의 마지막 줄 바로 아래). 폰은 선택 손잡이 자리를 피한다 */
function place() {
    frame = 0;
    if (!held || !chip) return;
    const rects = rectsOf(held.range);
    const chat = document.getElementById('chat')?.getBoundingClientRect();
    if (!rects.length || !held.root.isConnected) { hideDeleteChip(); return; }
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    const lastLine = rects.filter(rect => rect.bottom >= bottom - 2);
    const line = { left: Math.min(...lastLine.map(rect => rect.left)), right: Math.max(...lastLine.map(rect => rect.right)), top: Math.min(...lastLine.map(rect => rect.top)), bottom };
    const firstTop = Math.min(...rects.map(rect => rect.top));
    if (chat && (line.bottom < chat.top + 4 || firstTop > chat.bottom - 4)) { chip.hidden = true; return; }
    const viewport = window.visualViewport;
    const viewTop = (viewport?.offsetTop ?? 0) + 8, viewLeft = (viewport?.offsetLeft ?? 0) + 8;
    const viewBottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 8;
    const viewRight = (viewport ? viewport.offsetLeft + viewport.width : window.innerWidth) - 8;
    chip.hidden = false;
    const width = chip.offsetWidth, height = chip.offsetHeight;
    // 폰의 선택 손잡이(물방울): 끝 글자 아래 · 한 줄이면 시작 글자 아래 (x±18 × 줄 아래 30px — 북마크 단추와 같은 자리)
    const handleXs = coarse() ? [line.right, ...(firstTop >= line.top - 2 ? [Math.min(...rects.map(rect => rect.left))] : [])] : [];
    const handles = handleXs.map(x => ({ left: x - 18, right: x + 18, top: line.bottom, bottom: line.bottom + 30 }));
    const fits = box => box.left >= viewLeft && box.right <= viewRight && box.top >= viewTop && box.bottom <= viewBottom
        && !handles.some(handle => overlaps(box, handle, 0))
        && ![...document.querySelectorAll(OBSTACLES)].some(element => { const other = element.getBoundingClientRect(); return other.width && other.height && overlaps(box, other); });
    const at = (left, top) => ({ left, top, right: left + width, bottom: top + height });
    const bookmark = document.getElementById(BOOKMARK_CHIP);
    // 북마크 단추의 자리는 나타나는 움직임(transform) 없이 — 그 단추가 정한 left · top 그대로
    const markLeft = parseFloat(bookmark?.style.left ?? ''), markTop = parseFloat(bookmark?.style.top ?? '');
    const mark = bookmark && !bookmark.hidden && Number.isFinite(markLeft) && Number.isFinite(markTop) && bookmark.offsetWidth
        ? { left: markLeft, top: markTop, right: markLeft + bookmark.offsetWidth, bottom: markTop + bookmark.offsetHeight, width: bookmark.offsetWidth, height: bookmark.offsetHeight } : null;
    let box;
    if (mark?.width) {
        const top = mark.top + (mark.height - height) / 2;
        const below = Math.max(mark.bottom + 6, handles.length ? line.bottom + 36 : 0);
        box = [at(mark.right + 6, top), at(mark.left - 6 - width, top), at(mark.left, mark.bottom + 6)].find(fits)
            ?? at(Math.min(Math.max(mark.left, viewLeft), viewRight - width), Math.min(below, viewBottom - height));
    } else {
        const left = Math.min(Math.max((line.left + line.right) / 2 - width / 2, viewLeft), viewRight - width);
        const form = document.getElementById('send_form')?.getBoundingClientRect();
        const floor = form && form.height > 0 && form.top > viewTop + 60 ? Math.min(viewBottom, form.top - 8) : viewBottom;
        let top = line.bottom + (coarse() ? 30 : 8);
        if (![floor, ...(coarse() ? [viewBottom] : [])].some(limit => top + height <= limit)) {
            const above = firstTop - 8 - height;
            top = above >= Math.max(viewTop, chat ? chat.top + 4 : viewTop) ? above : Math.max(viewTop, Math.min(top, viewBottom - height));
        }
        box = at(left, top);
    }
    chip.style.left = `${Math.round(box.left)}px`;
    chip.style.top = `${Math.round(box.top)}px`;
    follow(bookmark);
}

/** 북마크 단추가 움직이거나 나타나면 따라간다 (스크롤 · 비키기 · 늦게 뜸) */
function follow(bookmark) {
    if (!bookmark || watched === bookmark || typeof MutationObserver !== 'function') return;
    observer?.disconnect();
    watched = bookmark;
    observer = new MutationObserver(() => { if (held && chip && !chip.hidden) reposition(); });
    observer.observe(bookmark, { attributes: true, attributeFilter: ['style', 'hidden'] });
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(check, DELAY);
}

/** 고른 글을 보고 단추를 띄운다. 싼 검사부터 — 선택이 없으면(탭 대부분) 테마 설정을 읽지 않는다 */
function check() {
    timer = 0;
    if (pressing) return;
    if (dialog || !deleteEnabled()) { hideDeleteChip(); return; }
    const found = currentSelection();
    if (!found) { hideDeleteChip(); return; }
    if (document.body.classList.contains('cg-previewing') || !translatorOn()) { hideDeleteChip(); return; }
    held = found;
    ensureChip();
    place();
}

function reposition() {
    if (!held || !chip || frame) return;
    frame = setTimeout(place, 24);
}

async function commit() {
    const snap = pending ?? (held ? safeSnapshot(held) : null);
    pending = null;
    pressing = false;
    clearTimeout(pressTimer);
    hideDeleteChip();
    document.getElementById(RETRANSLATE_BAR)?.remove();   // 선택이 풀리니 재번역 언어 단추도 (그 창이 이 창을 재번역 창으로 보지 않게)
    if (!snap) { globalThis.toastr?.warning('글을 다시 골라 주세요.', '', { timeOut: 1800 }); return; }
    document.getSelection()?.removeAllRanges();
    try { await openDialog(snap); } catch (error) { console.warn('[LLM Translator] 고른 글 지우기:', error); globalThis.toastr?.error(error?.message || '지우지 못했어요.'); }
}

const onSelection = () => { if (!held && typingInField()) return; schedule(); };
const onKey = (event) => { if (event.key === 'Escape' && chip && !chip.hidden) hideDeleteChip(); };
const onChat = () => { hideDeleteChip(); closeDialog(); clearUndo(); };   // 6.4.5 채팅을 바꾸면 되돌리기도 사라진다

/** 설정에 맞춰 켜고 끈다 (selection/index.js 의 syncSelectionRetranslate 가 부른다) */
export function syncSelectionDelete() {
    const on = deleteEnabled();
    if (on && !listening) {
        document.addEventListener('selectionchange', onSelection);
        document.getElementById('chat')?.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition);
        window.visualViewport?.addEventListener('resize', reposition);
        window.visualViewport?.addEventListener('scroll', reposition);
        document.addEventListener('keydown', onKey);
        context().eventSource.on(context().eventTypes.CHAT_CHANGED, onChat);
        listening = true;
    } else if (!on && listening) {
        document.removeEventListener('selectionchange', onSelection);
        document.getElementById('chat')?.removeEventListener('scroll', reposition);
        window.removeEventListener('resize', reposition);
        window.visualViewport?.removeEventListener('resize', reposition);
        window.visualViewport?.removeEventListener('scroll', reposition);
        document.removeEventListener('keydown', onKey);
        context().eventSource.removeListener(context().eventTypes.CHAT_CHANGED, onChat);
        observer?.disconnect(); observer = null; watched = null;
        hideDeleteChip(); closeDialog(); listening = false;
    }
}

// 시험용 (tools/tests/selection-delete.mjs)
export const _test = { currentSelection, snapshotOf, planOf, available, offReason, applyNow, assertAlive, undoNow, onChat: () => onChat(), lastDelete: () => lastDelete, check: () => check };
