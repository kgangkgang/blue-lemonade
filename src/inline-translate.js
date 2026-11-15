// 칸 옆 번역 보기 — 공용 부품 (1.5.3 후보 · 전개 지시 「번역 보기」를 뽑아 냄)
// 프롬프트가 든 칸 위에 번역본(읽기 전용 면), 아래에 원문 — 한글화 패널 항목의 「번역 · 원문」 차례 그대로.
// 원본 입력칸(textarea)의 값은 읽기만 해요. 번역본은 따로 만든 상자에만 들어가서, 실리태번의 저장 · 내보내기 · 프롬프트 조립에는 언제나 원문만 가요.
// 칸마다 상태 하나(key → 펼침 · 번역한 원문 · 번역문 · 진행 · 실패). 목록을 다시 그려도(쪽 넘김 · 접기 · 펴기) 상태는 남고, 새로 그린 줄은 paint 로 다시 칠해요.
// 쓰는 곳: 전개 지시(프롬프트 쪽 · 설정의 전개 지시 프롬프트) · 한글화 패널의 제자리 번역(월드인포 · 프리셋 프롬프트 · 봇카드 칸 · 페르소나 설명).
//
// engine(): 처음 누를 때 한 번 부르는 비동기 함수 → { cached(source, key), translate(source, key, ui) }
//   cached 는 글(string)이나 { text, stale } 를(또는 그것을 주는 약속을) 돌려줘요. stale = 그 번역이 지금 원문보다 옛 원문의 것(한글화 패널이 적어 둔 원문과 다름).
//   translate 의 ui = { state, paint } — 진행 부품을 state.prog 에 두면 상자 안 진행 자리에 붙여요(목록을 다시 그려도 같은 요소를 옮겨 붙임).

export const TR_ICON = 'fa-solid fa-language';   // 한글화 패널 「번역」 단추와 같은 아이콘
export const TR_FAIL = '번역하지 못했어요. 번역 연결을 확인해 주세요.';
// 제자리 번역 단추의 그림: 위 TR_ICON 과 같은 모양(Font Awesome Free 6.5.2 「language」, CC BY 4.0 · Fonticons, Inc.)을 SVG 로.
// 글자 아이콘은 줄 기준선이 CSS 화소에 맞춰 놓여 면 안 잉크가 자리마다 0.5 ~ 1.2px 비켜났어요(리그 실측) — 도형이라 면 가운데에 그대로 놓여요. 높이 0.75em = 그 글자의 잉크 높이
export const TR_SVG = '<svg class="jj-tr-svg" viewBox="0 0 640 384" aria-hidden="true" focusable="false"><path fill="currentColor" transform="matrix(1 0 0 -1 0 384)" d="M0 320Q1 347 19 365Q37 383 64 384H256H576Q603 383 621 365Q639 347 640 320V64Q639 37 621 19Q603 1 576 0H320H64Q37 1 19 19Q1 37 0 64V320ZM320 320V64V320V64H576V320H320ZM178 272Q173 283 160 284Q147 283 142 272L78 128Q72 111 88 102Q105 96 114 112L123 132H197L206 112Q215 96 232 102Q248 111 242 128L178 272ZM160 215 179 172 160 215 179 172H141L160 215ZM448 284Q466 282 468 264V260H512H528Q546 258 548 240Q546 222 528 220H526L524 215Q511 179 485 150Q486 149 488 148L506 137Q521 126 513 110Q502 95 486 103L467 114Q460 118 454 123Q438 111 420 103L416 102Q399 96 390 112Q384 129 400 138L404 140Q413 144 422 150L410 162Q398 176 410 190Q424 202 438 190L453 176V175Q472 195 483 220H448H376Q358 222 356 240Q358 258 376 260H428V264Q430 282 448 284Z"/></svg>';
/** 단추 그림: 쉴 때 TR_SVG · 도는 동안 스피너 — 전개 지시 · 제자리 번역이 같이 써요 */
export const trIconHtml = busy => (busy ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>' : TR_SVG);
export const trNorm = text => String(text ?? '').trim();

/** 번역본 상자 속. progress 를 켜면 진행 자리(한글화 패널의 진행 막대 · 글이 들어감)가 번역 글 위에 생겨요 */
export function trBoxInner(redoClass, { progress = false, note = '' } = {}) {
    return `<div class="jj-tr-head"><span class="jj-tr-label">번역</span><span class="jj-tr-stale" hidden>원문이 바뀌었어요</span><button type="button" class="${redoClass} jj-tr-redo" data-pact="translate-redo" hidden><span>다시 번역</span></button></div>`
        + (progress ? '<div class="jj-tr-prog" hidden></div>' : '')
        + '<div class="jj-tr-text" aria-live="polite"></div>'
        + `<div class="jj-tr-label jj-tr-orig">원문${note ? `<span class="jj-tr-note"> · ${note}</span>` : ''}</div>`;
}

/**
 * 펼친 번역 상자를 둘레에 맞춰요(상자를 펼칠 때 · 화면 폭이 바뀔 때 한 번):
 *  - 바로 아래가 원문 입력칸이면 번역 면을 그 칸과 같은 둥글기 · 안쪽 여백으로(--kt-radius · --kt-pad)
 *  - 위 형제 → 상자 · 상자 → 아래 형제 간격을 테마 눈금 8 로(--kt-mt · --kt-mb). 칸마다 실리태번 · 테마의 줄 간격(flex gap · 바깥 여백 · 겹침)이 달라 실제로 재서 고쳐요
 */
export function fitBox(box, force = false) {
    if (!box?.isConnected || box.hidden || typeof box.getBoundingClientRect !== 'function' || !box.getClientRects?.().length) return;
    const win = box.ownerDocument?.defaultView || globalThis, vw = win.innerWidth || 0;
    if (!force && box.__ktVw === vw && box.__ktFit) return;
    const prev = box.previousElementSibling, next = box.nextElementSibling;
    try {
        const text = box.querySelector('.jj-tr-text');
        if (text && next?.tagName === 'TEXTAREA') {
            const cs = win.getComputedStyle(next);
            text.style.setProperty('--kt-radius', cs.borderRadius);
            text.style.setProperty('--kt-pad', `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`);
        }
        for (let pass = 0; pass < 2; pass++) {
            const cs = win.getComputedStyle(box), b = box.getBoundingClientRect();
            let mt = parseFloat(cs.marginTop) || 0, mb = parseFloat(cs.marginBottom) || 0, moved = false;
            if (prev?.getClientRects().length) { const g = b.top - prev.getBoundingClientRect().bottom; if (Math.abs(g - 8) > 0.25) { mt += 8 - g; moved = true; } }
            if (next?.getClientRects().length) { const g = next.getBoundingClientRect().top - b.bottom; if (Math.abs(g - 8) > 0.25) { mb += 8 - g; moved = true; } }
            if (!moved) break;
            box.style.setProperty('--kt-mt', `${mt}px`); box.style.setProperty('--kt-mb', `${mb}px`);
        }
    } catch (e) { /* 재지 못하면 CSS 기본 눈금 그대로 */ }
    box.__ktVw = vw; box.__ktFit = true;
}

export function createInlineTranslate({ sourceOf, rootOf, engine, memo: useMemo = true, memoMax = 50, tag = '[번역 보기]', iconHtml = null }) {
    const states = new Map();
    const memo = new Map();   // 원문 → 번역문 (이번 접속) — 한글화 패널 캐시가 원본인 곳은 끔
    let loaded = null;

    function state(key) {
        if (!states.has(key)) states.set(key, { open: false, source: '', text: '', busy: false, error: '', staleHit: false, prog: null });
        return states.get(key);
    }

    /** 상태대로 번역 단추 · 번역본 상자를 칠한다. root 를 주면 그 안(막 만든 줄)만 */
    function paint(key, root = rootOf(key)) {
        if (!root?.querySelectorAll) return;
        const st = state(key);
        for (const button of root.querySelectorAll('.jj-tr-btn')) {
            if (button.dataset.tr !== key) continue;
            const label = st.open ? '번역 접기' : '번역 보기';
            button.setAttribute('aria-label', label);
            button.title = label;
            button.setAttribute('aria-expanded', String(st.open));
            button.setAttribute('aria-busy', String(st.busy));
            button.classList?.toggle('is-on', st.open);
            button.classList?.toggle('is-failed', !!st.error);
            // 같은 아이콘이면 다시 쓰지 않아요(목록 감시 · 스타일 재계산을 깨우지 않게)
            const icon = st.busy ? 'fa-solid fa-spinner fa-spin' : TR_ICON;
            if (iconHtml) { const sig = st.busy ? 'busy' : 'idle'; if (button.dataset.ic !== sig) { button.innerHTML = iconHtml(st.busy); button.dataset.ic = sig; } }
            else if (button.firstElementChild?.className !== icon) button.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
        }
        for (const box of root.querySelectorAll('.jj-tr')) {
            if (box.dataset.tr !== key) continue;
            const wasHidden = box.hidden;
            box.hidden = !st.open;
            if (!st.open) continue;
            if (wasHidden && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fitBox(box));
            const stale = !st.busy && !st.error && (st.staleHit || (!!st.source && trNorm(sourceOf(key)) !== st.source));
            box.classList.toggle('is-stale', stale);
            box.querySelector('.jj-tr-stale').hidden = !stale;
            const redo = box.querySelector('.jj-tr-redo');
            redo.hidden = st.busy || !(stale || st.error);
            redo.querySelector('span').textContent = st.error ? '다시 시도' : '다시 번역';
            const slot = box.querySelector('.jj-tr-prog');
            if (slot) {
                slot.hidden = !st.prog;
                if (st.prog && st.prog.parentElement !== slot) slot.replaceChildren(st.prog);
            }
            const text = box.querySelector('.jj-tr-text');
            text.classList.toggle('is-muted', st.busy || !!st.error || !st.text);
            text.textContent = st.busy ? '번역하는 중…' : st.error || st.text || '번역할 글이 없어요.';
        }
    }

    const hitOf = hit => (hit && typeof hit === 'object' ? { text: hit.text || '', stale: !!hit.stale } : { text: hit || '', stale: false });

    async function run(key, { redo = false } = {}) {
        const st = state(key);
        if (st.busy) return;
        const source = trNorm(sourceOf(key));
        Object.assign(st, { source, error: '', text: '', staleHit: false });
        const remembered = useMemo && source && memo.get(source);
        if (!source || remembered) {
            st.text = remembered || '';
            paint(key);
            return;
        }
        st.busy = true;
        paint(key);
        try {
            loaded = await engine();
            const hit = hitOf(await loaded.cached?.(source, key));   // 패널 캐시를 찾는 곳은 비동기(자료를 읽어 항목 꼴로)
            let text = hit.text;
            if (text && !(redo && hit.stale)) st.staleHit = hit.stale;
            else text = await loaded.translate(source, key, { state: st, paint: () => paint(key) });
            if (!trNorm(text)) throw new Error('빈 번역');
            if (useMemo) {
                if (memo.size >= memoMax) memo.delete(memo.keys().next().value);
                memo.set(source, text);
            }
            st.text = text;
        } catch (error) {
            console.warn(tag, error);
            st.error = error?.userMessage ? error.message : TR_FAIL;
        } finally {
            st.busy = false;
            paint(key);
        }
    }

    /** 번역 단추: 펼치면 그 칸의 지금 원문을 번역(캐시에 있으면 바로) · 다시 누르면 접는다 */
    function toggle(key) {
        const st = state(key);
        st.open = !st.open;
        if (st.open && !st.busy && (!st.source || trNorm(sourceOf(key)) !== st.source || st.error)) return run(key);
        paint(key);
    }

    function onAct(act, key) {
        if (!key) return;
        if (act === 'translate') return toggle(key);
        if (act === 'translate-redo' && state(key).open) return run(key, { redo: true });
    }

    /** 다른 곳(한글화 패널)에서 번역이 바뀌었을 때: 펼친 칸만 캐시를 다시 읽어 칠해요 — 요청은 보내지 않아요 */
    async function reread(key) {
        const st = states.get(key);
        if (!st?.open || st.busy || !loaded) return;
        const source = trNorm(sourceOf(key));
        const hit = hitOf(source && await loaded.cached?.(source, key));
        if (!hit.text || st.busy || !st.open) return;
        Object.assign(st, { source, text: hit.text, staleHit: hit.stale, error: '' });
        paint(key);
    }

    return { states, memo, state, paint, run, toggle, onAct, reread };
}
