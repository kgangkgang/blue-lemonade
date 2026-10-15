// 2.6.0 번역 점검 화면 (사용자 요청 10-15): 의심 문단 끝에 작고 조용한 표시 · 누르면 이유 한 줄 + 「이 문단만 다시 번역」 「원문 보기」,
//   번역 단추(뇌 · ⇄ 중 보이는 것)에는 메시지 상태(정상 · 의심 n개). 판정은 translation-check.js (번역할 때 쓰는 검사 함수 그대로).
// 비용: 판정은 그릴 때 바로 하지 않고 한가할 때(requestIdleCallback) 최근 메시지부터 — 결과는 글 지문으로 기억(300개)하고,
//   의심 문단이 있는 메시지만 한 번 다시 그려 표시를 단다 (정상 메시지는 다시 그리지 않는다). 상주 관찰자 · 타이머 없음.
// 표시는 그릴 때만 넣는다 (저장 글은 그대로): 서식 훅(정규식 · 마크다운 전)에서 문단 끝에 자리 글자 </llmt-mark-n> 를 넣고
//   마크다운 뒤 훅에서 작은 span 으로 바꾼다 — 닫는 태그 꼴이라 빠진 대사 괄호 되살리기(줄 끝 껍데기)가 건너뛰고, 혹시 남아도 정화기가 지운다.
import { checkTranslation, markParagraphs, paragraphAt, paragraphRange, standaloneParagraphs, cleanLeaks, CHECK_REASONS, MESSAGE_REASONS } from './translation-check.js';

const MARK = n => `</llmt-mark-${n}>`;
const MARK_FOUND = /<\/llmt-mark-(\d+)>|&lt;\/llmt-mark-(\d+)&gt;/g;
const LIMIT = 300;
const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(() => fn(null), 300));
const later = fn => setTimeout(fn, 0);
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
/** 원문 보기 칸의 글: 숨김 주석 · 태그를 걷은 맨 글 */
const plainText = text => String(text ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(/<[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();

/**
 * deps:
 *  stateOf(id, mes?) → { source, translation, protect, key } | null — 점검할 수 있는 메시지인가 (번역문 그대로 보기 · 지금 원문의 번역 · 번역 중 아님).
 *    mes 를 주면 그 글이 저장된 번역문일 때만.
 *  rerender(id) — 표시를 달려고 그 메시지를 다시 그린다.
 *  act(kind, id, index, row) → Promise — 'retry' 이 문단만 다시 번역 · 'fill' 빠진 문단 채우기 · 'clean' 초안 걷어 내기 · 'whole' 메시지 전체 다시 번역.
 */
export function createCheckView({ stateOf, rerender, act }) {
    const results = new Map();
    const remember = (key, value) => { results.delete(key); results.set(key, value); while (results.size > LIMIT) results.delete(results.keys().next().value); };
    const resultOf = state => {
        if (!results.has(state.key)) remember(state.key, checkTranslation(state.source, state.translation, { protect: state.protect }));
        return results.get(state.key);
    };

    // ── 번역 단추의 메시지 상태 ── 보이는 번역 단추 하나에만: 기존 번역(뇌) · 번역/전환(⇄) 중 숨기지 않은 앞의 것 (사용자가 이름 줄에 고정해 쓰는 단추)
    function paintBadge(id, result) {
        const buttons = [...document.querySelectorAll(`#chat .mes[mesid="${id}"] :is(.mes_legacy_translate, .mes_llm_translate)`)];
        const target = buttons.find(button => button.style.display !== 'none') ?? null;
        for (const button of buttons) {
            if (!result || button !== target) { delete button.dataset.llmtCheck; delete button.dataset.llmtCheckCount; button.removeAttribute('aria-description'); continue; }
            button.dataset.llmtCheck = result.warn ? 'warn' : 'ok';
            if (result.warn && result.flagged) button.dataset.llmtCheckCount = String(result.flagged); else delete button.dataset.llmtCheckCount;
            button.setAttribute('aria-description', result.warn ? `번역 점검: 의심 ${result.flagged ? `문단 ${result.flagged}개` : '있음'}` : '번역 점검: 이상 없음');
        }
    }
    /** 기억해 둔 결과로만 상태를 칠한다 (번역 단추를 새로 만들었을 때) */
    function paintFromCache(id) {
        later(() => {   // 단추 숨김 설정(updateButtonVisibility)이 먼저 칠해진 뒤에
            const state = stateOf(Number(id));
            paintBadge(id, state && results.has(state.key) ? results.get(state.key) : null);
        });
    }

    // ── 한가할 때 판정 (최근 메시지부터) ──
    const pending = new Set();
    let waiting = false;
    function schedule(id) {
        pending.add(Number(id));
        if (!waiting) { waiting = true; idle(drain); }
    }
    function drain(deadline) {
        waiting = false;
        let done = 0;
        for (const id of [...pending].sort((a, b) => b - a)) {
            if (done && deadline && !deadline.didTimeout && deadline.timeRemaining() < 4) break;
            pending.delete(id);
            const state = stateOf(id);
            if (!state) { paintBadge(id, null); continue; }
            const fresh = !results.has(state.key), result = resultOf(state);
            done++;
            paintBadge(id, result);
            if (fresh && result?.flagged) rerender(id);
        }
        if (pending.size && !waiting) { waiting = true; idle(drain); }
    }

    // ── 서식 훅 ──
    /** 정규식 · 마크다운 전: 의심 문단 끝에 자리 글자 (아직 판정 전이면 한가할 때 판정하도록 줄 세운다) */
    function mark(id, mes) {
        const state = stateOf(id, mes);
        if (!state) { later(() => paintBadge(id, null)); return mes; }
        if (!results.has(state.key)) { schedule(id); return mes; }
        const result = results.get(state.key);
        later(() => paintBadge(id, result));
        if (!result?.flagged) return mes;
        return markParagraphs(mes, result.paragraphs.map(row => row.index), MARK, state.protect);
    }
    /** 마크다운 뒤: 자리 글자 → 누를 수 있는 작은 표시 (정화기가 클래스 앞에 custom- 를 붙인다) */
    function finish(html, id) {
        if (typeof html !== 'string' || !html.includes('llmt-mark-')) return html;
        return html.replace(MARK_FOUND, (_, a, b) => `<span class="llmt-flag" data-llmt-mes="${Number(id)}" data-llmt-para="${Number(a ?? b)}" role="button" tabindex="0" title="번역 점검" aria-label="번역 점검: 이 문단을 확인해 보세요"></span>`);
    }

    // ── 누르면 뜨는 작은 창 ──
    let pop = null, unbind = null;
    function close() {
        unbind?.(); unbind = null;
        pop?.remove(); pop = null;
    }
    function rowOf(id, index) {
        const state = stateOf(id), result = state && results.get(state.key);
        return { state, result, row: result?.paragraphs.find(p => p.index === index) ?? null };
    }
    function open(flag) {
        close();
        const id = Number(flag.dataset.llmtMes ?? flag.closest('.mes')?.getAttribute('mesid')), index = Number(flag.dataset.llmtPara);
        const { state, result, row } = rowOf(id, index);
        if (!row) return;
        const missing = row.missing ? row.missing[1] - row.missing[0] + 1 : 0;
        const reasons = row.reasons.map(code => (code === 'gap' ? `이 문단 뒤에 원문 ${missing}문단이 번역에서 빠진 것 같아요.` : CHECK_REASONS[code])).filter(Boolean);
        const notes = result.message.map(code => (typeof MESSAGE_REASONS[code] === 'function' ? MESSAGE_REASONS[code](result.sourceCount, result.count) : MESSAGE_REASONS[code])).filter(Boolean);
        // 원문 보기 · 할 일
        const lostOnly = row.reasons.length === 1 && row.reasons[0] === 'lost';   // 빠진 자리를 못 찾은 메시지 — 메시지 다시 번역만
        const srcText = lostOnly ? null : row.missing ? paragraphRange(state.source, row.missing[0], row.missing[1], state.protect)
            : row.source >= 0 ? paragraphAt(state.source, row.source, state.protect) : null;
        const cleanable = row.reasons.some(code => code === 'leak' || code === 'echo') && cleanLeaks(state.source, state.translation) !== state.translation;
        let primary = null, why = '';
        if (cleanable) primary = ['clean', '걷어 내기', '요청 없이 초안 · 혼잣말만 걷어요.'];
        else if (lostOnly) primary = null;
        else if (row.missing) {
            if (srcText && standaloneParagraphs(srcText)) primary = ['fill', '빠진 문단 번역해 넣기', ''];
            else why = '빠진 부분이 앞뒤 문단과 태그로 이어져 있어 따로 번역하지 않아요.';
        } else if (row.source < 0 || !row.sure) why = '짝이 되는 원문 문단을 확실히 찾지 못했어요.';
        else if (!standaloneParagraphs(srcText)) why = '앞뒤 문단과 태그로 이어진 문단이라 혼자 다시 번역하지 않아요.';
        else primary = ['retry', '이 문단만 다시 번역', ''];
        const head = lostOnly ? '메시지 전체' : row.missing ? `${index + 1}번째 문단 뒤` : `${index + 1}번째 문단`;
        pop = document.createElement('div');
        pop.className = 'llmt-check-pop';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', '번역 점검');
        pop.innerHTML = `
            <div class="llmt-check-head"><span class="llmt-check-title">번역 점검</span><span class="llmt-check-where">${escapeHtml(head)}</span>
                <button type="button" class="llmt-check-x" data-act="close" aria-label="닫기" title="닫기"><i class="fa-solid fa-xmark"></i></button></div>
            ${reasons.map(text => `<p class="llmt-check-why">${escapeHtml(text)}</p>`).join('')}
            ${notes.map(text => `<p class="llmt-check-note">${escapeHtml(text)}</p>`).join('')}
            ${why ? `<p class="llmt-check-note">${escapeHtml(why)} 메시지 전체를 다시 번역해 주세요.</p>` : ''}
            ${primary?.[2] ? `<p class="llmt-check-note">${escapeHtml(primary[2])}</p>` : ''}
            <div class="llmt-check-src" hidden></div>
            <div class="llmt-check-actions">
                ${primary ? `<button type="button" class="menu_button llmt-check-btn is-primary" data-act="${primary[0]}">${escapeHtml(primary[1])}</button>`
                    : '<button type="button" class="menu_button llmt-check-btn is-primary" data-act="whole">메시지 다시 번역</button>'}
                ${srcText ? '<button type="button" class="menu_button llmt-check-btn" data-act="source" aria-expanded="false">원문 보기</button>' : ''}
            </div>`;
        pop.querySelector('.llmt-check-src').textContent = plainText(srcText);
        document.body.append(pop);
        place(flag);
        const onDown = event => { if (pop && !pop.contains(event.target) && !event.target.closest?.('.custom-llmt-flag, .llmt-flag')) close(); };
        const onKey = event => { if (event.key === 'Escape') { close(); flag.focus?.(); } };
        const onMove = () => close();
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onMove);
        document.getElementById('chat')?.addEventListener('scroll', onMove, { passive: true });
        unbind = () => {
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', onMove);
            document.getElementById('chat')?.removeEventListener('scroll', onMove);
        };
        pop.addEventListener('click', event => {
            const button = event.target.closest('button[data-act]');
            if (!button || button.disabled) return;
            const kind = button.dataset.act;
            if (kind === 'close') { close(); return; }
            if (kind === 'source') {
                const box = pop.querySelector('.llmt-check-src'), show = box.hidden;
                box.hidden = !show;
                button.textContent = show ? '원문 접기' : '원문 보기';
                button.setAttribute('aria-expanded', String(show));
                place(flag);
                return;
            }
            const label = button.textContent;
            pop.querySelectorAll('button[data-act]:not([data-act="close"])').forEach(other => { other.disabled = true; });
            button.textContent = kind === 'clean' ? '걷어 내는 중…' : '번역 중…';
            Promise.resolve(act(kind, id, index, row)).then(() => close(), () => {
                if (!pop) return;
                button.textContent = label;
                pop.querySelectorAll('button[data-act]').forEach(other => { other.disabled = false; });
            });
        });
        pop.querySelector('.llmt-check-btn')?.focus({ preventScroll: true });
    }
    /** 표시 아래(모자라면 위)에 화면 안쪽으로 */
    function place(flag) {
        if (!pop) return;
        const rect = flag.getBoundingClientRect(), gutter = 12, width = Math.min(340, window.innerWidth - gutter * 2);
        pop.style.width = `${width}px`;
        const left = Math.min(Math.max(gutter, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - gutter);
        const height = pop.offsetHeight, below = rect.bottom + 8;
        const top = below + height <= window.innerHeight - gutter ? below : Math.max(gutter, rect.top - height - 8);
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(top)}px`;
    }
    const isFlag = target => target?.closest?.('.custom-llmt-flag, .llmt-flag');
    document.addEventListener('click', event => {
        const flag = isFlag(event.target);
        if (!flag) return;
        event.preventDefault(); event.stopPropagation();
        if (pop && pop.dataset.for === `${flag.dataset.llmtMes}:${flag.dataset.llmtPara}`) { close(); return; }
        open(flag);
        if (pop) pop.dataset.for = `${flag.dataset.llmtMes}:${flag.dataset.llmtPara}`;
    }, true);
    document.addEventListener('keydown', event => {
        if ((event.key !== 'Enter' && event.key !== ' ') || !isFlag(event.target)) return;
        event.preventDefault();
        open(isFlag(event.target));
    }, true);

    /** 그 메시지의 판정을 잊는다 (다시 그리면 새로 판정) */
    function forget(id) {
        const state = stateOf(Number(id));
        if (state) results.delete(state.key);
    }
    return { mark, finish, paintFromCache, schedule, close, forget, resultOf };
}
