// 8.2.4 「Chat History」 줄 경고 △ 설명 (프롬프트 관리자 › 프롬프트 목록).
// 실리태번(PromptManager.js renderPromptManagerListItems)은 프롬프트 전체가 예산(문맥 크기 − 최대 응답 길이)의 80%를 넘고
// 채팅 기록 줄 토큰이 적으면 그 줄 토큰 수 옆에 △(빨강: 거의 못 들어감 · 노랑: 몇 개만)를 띄우지만, 왜 뜨는지는 영어 툴팁 한 줄뿐이다.
// 그래서 △(또는 그 줄 토큰 수)를 누르면 이유 · 숫자 · 해결 방법을 한 창에 보여 준다. 폰은 툴팁이 없으니 톡만으로 열린다.
//
// 비용: 문서 click 리스너 하나(△가 아니면 바로 돌아감) + 영어 툴팁을 한국어로 바꾸려는 mouseover 리스너 하나(△일 때만 일함).
// 감시자 · 타이머 없음. 값은 누를 때 한 번만 읽는다. 테마를 끄면 둘 다 뗀다.
import { groupedNumber } from './numbers.js';

const LIST = '#completion_prompt_manager_list';
const TOKENS = `${LIST} .prompt_manager_prompt_tokens`;
const ICON = '.fa-triangle-exclamation';
const HISTORY = 'chatHistory';
const SHORT_REPLY = 8000;       // 응답 길이 추천값의 아래쪽 한도 (현재 값의 1/4 과 이 값 중 큰 쪽)
const TOP = 5;
const FLASH_MS = 2600;

let wanted = false, binding = null, loading = null, opening = false;

/** 숫자는 쉼표로, 모르면 null */
const num = value => (Number.isFinite(value) ? groupedNumber(Math.round(value)) : null);
const finite = value => (typeof value === 'number' && Number.isFinite(value) ? value : (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null));

// 숫자 뒤 조사: 끝자리 읽기(영 일 이 삼 사 오 육 칠 팔 구, 0 으로 끝나면 십 · 백 · 천 · 만 으로 받침 있음)로 정한다.
const NO_BATCHIM = new Set(['2', '4', '5', '9']);        // 이 사 오 구
const RIEUL = new Set(['1', '2', '4', '5', '7', '8', '9']);   // 로(ㄹ 받침이거나 받침 없음)
const hasBatchim = n => { const last = String(n).replace(/\D/g, '').slice(-1); return !NO_BATCHIM.has(last); };
export const eulReulNumber = n => (hasBatchim(n) ? '을' : '를');
export const euroNumber = n => (RIEUL.has(String(n).replace(/\D/g, '').slice(-1)) ? '로' : '으로');

/** 새 응답 길이 추천: 현재 값의 1/4 과 8,000 중 큰 쪽. 지금도 그 이하면 null (줄일 필요 없음) */
export function suggestReplyLength(current) {
    if (!(current > 0)) return null;
    const wantedLength = Math.max(SHORT_REPLY, Math.round(current / 4));
    return current > wantedLength ? wantedLength : null;
}

/** 채팅 기록 줄 토큰만큼 최근 메시지가 몇 개 들어가는지(메시지별 토큰 수가 모두 있을 때만). 숨긴(is_system) 메시지는 건너뛴다 */
export function fittingMessages(chat, tokens) {
    if (!Array.isArray(chat) || !Number.isFinite(tokens)) return null;
    let used = 0, count = 0;
    for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (!message || message.is_system) continue;
        const own = finite(message.extra?.token_count);
        if (own === null) return null;
        if (used + own > tokens) break;
        used += own; count++;
    }
    return count;
}

/** 팝업에 쓸 값 모으기. 읽지 못한 값은 null 로 둔다 */
export function readFacts({ manager, context, severity, shownTokens }) {
    const settings = manager?.serviceSettings || context?.chatCompletionSettings || null;
    const handler = manager?.tokenHandler ?? manager?.getTokenHandler?.();
    let counts = null;
    try { counts = handler?.getCounts?.() ?? null; } catch { counts = null; }
    let total = finite(manager?.tokenUsage);
    if (total === null) { try { total = finite(handler?.getTotal?.()); } catch { total = null; } }
    const maxContext = finite(settings?.openai_max_context);
    const maxReply = finite(settings?.openai_max_tokens);
    const budget = maxContext !== null && maxReply !== null ? maxContext - maxReply : null;
    const history = finite(counts?.[HISTORY]) ?? shownTokens;
    const others = counts ? Object.entries(counts)
        .filter(([id, value]) => id !== HISTORY && finite(value) > 0)
        .map(([id, value]) => ({ id, tokens: finite(value) }))
        .sort((a, b) => b.tokens - a.tokens || (a.id < b.id ? -1 : 1))
        .slice(0, TOP) : [];
    return {
        severity, maxContext, maxReply, budget, total, history, others,
        left: budget !== null && total !== null ? budget - total : null,
        messages: fittingMessages(context?.chat, history),
    };
}

const missing = facts => facts.maxContext === null || facts.maxReply === null || facts.total === null || facts.history === null;

/** 팝업 문장들 (시험이 그대로 견준다) */
export function summaryLine(facts) {
    const tokens = `${num(facts.history) ?? '?'}토큰`;
    return facts.severity === 'danger'
        ? `채팅 기록이 ${tokens}만 들어가고 있어요 — 프롬프트가 커서 기록이 낄 자리가 거의 없어요`
        : `채팅 기록이 ${tokens}만 들어가고 있어요 — 프롬프트가 커서 최근 메시지 몇 개만 들어가요`;
}
export function calcLine(facts) {
    const used = num(facts.total);
    const left = facts.left;
    const fit = facts.messages === null ? '' : `(${facts.messages === 0 ? '메시지 0~1개' : `메시지 약 ${facts.messages}개`})`;
    const actual = `실제로 ${num(facts.history)}토큰${fit}만 들어가요.`;
    const head = `문맥 ${num(facts.maxContext)} − 최대 응답 ${num(facts.maxReply)} = 프롬프트 자리 ${num(facts.budget)}.`;
    if (left >= 0) return `${head} 지금 프롬프트가 ${used}${eulReulNumber(used)} 써서 채팅 기록에는 ${num(left)}토큰만 남았고, ${actual}`;
    return `${head} 지금 프롬프트가 ${used}${eulReulNumber(used)} 써서 자리를 ${num(-left)}토큰 넘겼고, ${actual}`;
}
export function replyAdvice(facts) {
    const next = suggestReplyLength(facts.maxReply);
    if (next === null) return '지금 응답 길이는 이미 짧은 편이라 줄여도 자리가 크게 늘진 않아요.';
    const room = facts.maxContext - next - facts.total;
    return `최대 응답 길이를 ${num(facts.maxReply)} → ${num(next)}${euroNumber(num(next))} 줄이면 채팅 기록 자리가 ${num(room)}${euroNumber(num(room))} 늘어요.`;
}
export function contextAdvice(facts) {
    return `올릴 수 있으면 올려요(모델이 받아 주는 만큼만). 지금은 ${num(facts.maxContext)}이에요.`;
}

function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/** 팝업 본문. 값을 못 읽었으면 안내만. goto(selector) 는 「설정으로 가기」 단추가 부른다 */
export function buildBody(doc, facts, names, goto) {
    const box = el(doc, 'div', 'bl-hw');
    const danger = facts.severity === 'danger';
    const head = el(doc, 'h3', 'bl-hw-title');
    const icon = el(doc, 'span', `fa-solid fa-triangle-exclamation ${danger ? 'text_danger' : 'text_warning'}`);
    head.append(icon, el(doc, 'span', '', missing(facts) ? '채팅 기록 경고' : summaryLine(facts)));
    box.append(head);

    if (missing(facts)) {
        box.append(el(doc, 'p', 'bl-hw-calc', '값을 읽지 못했어요. 프롬프트 목록이 다시 그려진 뒤에 눌러 보세요.'));
    } else {
        box.append(el(doc, 'p', 'bl-hw-calc', calcLine(facts)));
        const rows = [
            ['문맥 크기', facts.maxContext], ['최대 응답 길이', facts.maxReply], ['프롬프트가 쓸 수 있는 예산', facts.budget],
            ['지금 프롬프트 전체', facts.total], ['채팅 기록(이 줄)', facts.history],
        ];
        const table = el(doc, 'dl', 'bl-hw-table');
        for (const [label, value] of rows) table.append(el(doc, 'dt', '', label), el(doc, 'dd', '', `${num(value)}토큰`));
        box.append(table);

        box.append(el(doc, 'h4', 'bl-hw-sub', `토큰을 많이 쓰는 프롬프트 상위 ${TOP}개`));
        if (facts.others.length) {
            const list = el(doc, 'dl', 'bl-hw-table');
            facts.others.forEach((item, index) => list.append(el(doc, 'dt', '', names[index] || item.id), el(doc, 'dd', '', `${num(item.tokens)}토큰`)));
            box.append(list);
        } else {
            box.append(el(doc, 'p', 'bl-hw-note', '켜진 다른 프롬프트의 토큰 수를 읽지 못했어요.'));
        }
    }

    box.append(el(doc, 'h4', 'bl-hw-sub', '해결 방법'));
    const steps = el(doc, 'ol', 'bl-hw-steps');
    const step = (title, detail, selector) => {
        const item = el(doc, 'li', 'bl-hw-step');
        const body = el(doc, 'div', 'bl-hw-step-text');
        body.append(el(doc, 'b', '', title), doc.createTextNode(' '), el(doc, 'span', '', detail));
        item.append(body);
        if (selector) {
            const button = el(doc, 'button', 'menu_button bl-hw-go', '설정으로 가기');
            button.type = 'button';
            button.dataset.blHwGo = selector;
            button.addEventListener('click', () => goto?.(selector));
            item.append(button);
        }
        steps.append(item);
    };
    const ok = !missing(facts);
    step('문맥 크기(최대 토큰)를 올려요.', ok ? contextAdvice(facts) : '모델이 받아 주는 만큼 올릴 수 있어요.', '#openai_max_context');
    step('최대 응답 길이를 줄여요.', ok ? replyAdvice(facts) : '응답이 짧아도 되면 줄일수록 기록 자리가 늘어요.', '#openai_max_tokens');
    step('안 쓰는 프롬프트를 꺼요.', '위 목록에서 토큰을 많이 쓰는 것부터 보세요. 프롬프트 안에 들어가는 캐릭터·페르소나·월드인포의 토큰을 줄여도 돼요.');
    box.append(steps);
    return box;
}

/** 설정 칸으로 스크롤하고 잠깐 강조. 못 찾으면 false */
export function focusSetting(doc, selector, schedule = (fn, ms) => setTimeout(fn, ms)) {
    const target = doc.querySelector(selector);
    if (!target) return false;
    const block = target.closest?.('.range-block') || target;
    try { block.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* 스크롤 못 해도 강조는 */ }
    block.classList.add('bl-hw-flash');
    schedule(() => block.classList.remove('bl-hw-flash'), FLASH_MS);
    return true;
}

async function promptNames(manager, items) {
    let translate = null;
    try { translate = (await import('./scripts/runtime.js')).translatedPromptName; } catch { /* 사전 없이 */ }
    return items.map(({ id }) => {
        let raw = id;
        try { raw = String(manager?.getPromptById?.(id)?.name || id); } catch { /* 이름 없음 */ }
        try { return translate?.(id, raw) || raw; } catch { return raw; }
    });
}

async function openExplain(getManager, icon, doc) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.Popup || !ctx?.POPUP_TYPE) return false;
    const manager = getManager();
    const shown = finite(icon.closest(TOKENS)?.dataset?.pmTokens);
    const severity = icon.classList.contains('text_danger') ? 'danger' : 'warning';
    let facts;
    try { facts = readFacts({ manager, context: ctx, severity, shownTokens: shown }); } catch { facts = { severity, others: [], messages: null, maxContext: null, maxReply: null, budget: null, total: null, history: shown, left: null }; }
    const names = await promptNames(manager, facts.others);
    let jump = null, popup = null;
    const body = buildBody(doc, facts, names, selector => { jump = selector; popup?.complete?.(ctx.POPUP_RESULT?.AFFIRMATIVE ?? 1); });
    popup = new ctx.Popup(body, ctx.POPUP_TYPE.TEXT, '', { okButton: '닫기', allowVerticalScrolling: true, onOpen: p => p?.dlg?.classList?.add('bl-roomy-dialog') });
    await popup.show();
    if (jump) focusSetting(doc, jump);
    return true;
}

/** 영어 툴팁을 한국어로 (표는 ko-ui-data.js 의 같은 영어 문장 키 — 한국어 화면이 아니면 그대로 영어) */
export function localizeTooltip(icon, translate) {
    if (!icon || icon.dataset?.blHw === '1' || typeof translate !== 'function') return false;
    const title = icon.getAttribute?.('title');
    if (!title) return false;
    let ko = title;
    try { ko = translate(title); } catch { return false; }
    if (typeof ko !== 'string' || !ko || ko === title) return false;
    icon.setAttribute('title', `${ko} 누르면 자세히 알려 줘요.`);
    icon.dataset.blHw = '1';
    return true;
}

/** 클릭한 곳이 채팅 기록 줄의 토큰 칸이면 그 칸의 △, 아니면 null (토큰 수를 눌러도 열리게 — 아이콘은 12px 라 손가락엔 작아요) */
export function warningIconAt(target) {
    const tokens = target?.closest?.(TOKENS);
    if (!tokens) return null;
    if (tokens.closest('[data-pm-identifier]')?.dataset?.pmIdentifier !== HISTORY) return null;
    return tokens.querySelector(ICON);
}

export function bindHistoryWarning(doc, getManager) {
    const click = event => {
        const icon = warningIconAt(event.target);
        if (!icon || opening) return;
        opening = true;
        openExplain(getManager, icon, doc)
            .catch(error => console.warn('[Blue Lemonade] 채팅 기록 경고 설명', error))
            .finally(() => { opening = false; });
    };
    const over = event => {
        const target = event.target;
        if (!target?.classList?.contains('fa-triangle-exclamation') || !target.closest?.(TOKENS)) return;
        localizeTooltip(target, globalThis.SillyTavern?.getContext?.()?.translate);
    };
    // 거품 단계: 실리태번의 다른 클릭 처리와 겹치지 않고, 폰의 톡도 click 으로 온다
    doc.addEventListener('click', click);
    doc.addEventListener('mouseover', over, { passive: true });
    return () => { doc.removeEventListener('click', click); doc.removeEventListener('mouseover', over); };
}

export async function syncHistoryWarning(enabled) {
    wanted = !!enabled;
    if (!wanted) { binding?.(); binding = null; return; }
    if (binding) return;
    try {
        loading ??= import('../../../../openai.js');
        const api = await loading;
        if (wanted && !binding) binding = bindHistoryWarning(document, () => api.promptManager);
    } catch (error) {
        loading = null;
        console.warn('[Blue Lemonade] 채팅 기록 경고 설명을 불러오지 못했어요', error);
    }
}
