// 테마 확인 창 (7.0.1): 브라우저 기본 confirm() 대신 실리태번 Popup — 단추 이름은 하는 일(「지우기」 · 「취소」), 되돌릴 수 없는 일은 붉은 단추.
//   ask(message, { ok, cancel, danger, title }) → true(확인 단추) | false(취소 단추 · Esc · 바깥)
//   message 는 글(줄바꿈 그대로, HTML 로 읽지 않음). Popup 이 없는 환경(시험 · 아주 이른 시점)이면 기본 confirm 으로.
//   실리태번 모듈을 import 하지 않는다(getContext 로만) — 애드온 · 테마 어디서든, node 시험에서도 불러올 수 있게.
export async function ask(message, { ok = '확인', cancel = '취소', danger = false, title = '' } = {}) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const doc = globalThis.document;
    if (!ctx?.Popup || !ctx?.POPUP_TYPE || !doc?.createElement) return !!globalThis.confirm?.(String(message ?? ''));
    const box = doc.createElement('div');
    box.className = 'bl-ask';
    if (title) { const head = doc.createElement('h3'); head.textContent = String(title); box.append(head); }
    const text = doc.createElement('p');
    text.style.whiteSpace = 'pre-line';
    text.style.textAlign = 'left';
    text.textContent = String(message ?? '');
    box.append(text);
    const popup = new ctx.Popup(box, ctx.POPUP_TYPE.CONFIRM, '', { okButton: ok, cancelButton: cancel });
    if (danger) popup.okButton?.classList?.add('redWarningBG');
    const result = await popup.show();
    return result === ctx.POPUP_RESULT?.AFFIRMATIVE;
}

/** 7.0.1 알림 끝에 ↶ 단추 하나 (아이콘 · aria-label, 툴팁 없음). toastr 가 돌려준 알림(jQuery)에 붙인다 — 누르면 onUndo 를 한 번만 부르고 알림을 닫는다.
 *  toastr 는 글을 HTML 로 읽지 않으니(escapeHtml) 단추는 요소로 붙인다 */
export function attachUndo(toast, onUndo, { label = '되돌리기' } = {}) {
    const el = toast?.[0] ?? toast;
    const host = el?.querySelector?.('.toast-message') || el;
    const doc = globalThis.document;
    if (!host?.append || !doc?.createElement || typeof onUndo !== 'function') return null;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'bl-toast-undo';
    button.setAttribute('aria-label', label);
    button.style.cssText = 'margin-left:8px;min-width:36px;min-height:32px;padding:4px 10px;border:1px solid currentColor;border-radius:8px;background:none;color:inherit;cursor:pointer;font-size:1em;line-height:1.4;vertical-align:middle';
    button.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>';
    let used = false;
    button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (used) return;
        used = true; button.disabled = true;
        try { globalThis.toastr?.clear?.(toast); } catch { /* 이미 닫힘 */ }
        Promise.resolve().then(onUndo).catch(error => console.warn('[Blue Lemonade] 되돌리기', error));
    });
    host.append(button);
    return button;
}
