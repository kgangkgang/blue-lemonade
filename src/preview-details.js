// 미리보기는 실행 코드를 옮기지 않고 details의 접기만 허용해요.
const DIRECT_SUMMARY = detail => [...detail.children].find(el => el.tagName === 'SUMMARY');
function toggleDetail(detail) {
    detail.open = !detail.open;
    if (detail.matches('.custom-dem-card')) detail.classList.toggle('bl-dem-shown', detail.open);
}
export function summaryAt(root, x, y) {
    const summaries = [...(root?.querySelectorAll?.('summary') || [])];
    for (let i = summaries.length - 1; i >= 0; i--) {
        const summary = summaries[i], detail = summary.parentElement;
        if (detail?.tagName !== 'DETAILS' || DIRECT_SUMMARY(detail) !== summary) continue;
        const rect = summary.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return summary;
    }
    return null;
}
export function togglePreviewAt(scene, clientX, clientY) {
    // iframe에는 실행 권한을 주지 않아요. 바깥의 실제 탭 좌표를 안쪽 좌표로 바꿔 제목만 찾아요.
    for (const frame of scene.querySelectorAll('iframe.bl-ft-preview')) {
        const rect = frame.getBoundingClientRect();
        if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        try {
            const x = (clientX - rect.left) * frame.offsetWidth / rect.width - frame.clientLeft;
            const y = (clientY - rect.top) * frame.offsetHeight / rect.height - frame.clientTop;
            const summary = summaryAt(frame.contentDocument?.querySelector('[data-bl-fruit-preview]'), x, y);
            if (summary) { toggleDetail(summary.parentElement); return true; }
        } catch { /* 다른 출처의 문서는 조작하지 않아요. */ }
    }
    for (const root of scene.querySelectorAll('[data-prev="regex"]')) {
        const summary = summaryAt(root, clientX, clientY);
        if (summary) { toggleDetail(summary.parentElement); return true; }
    }
    return false;
}

export function bindSnapshotDetails(doc, { state = new Map(), scope = '', demSkin = false, onToggle = () => {} } = {}) {
    const host = doc.querySelector('[data-bl-fruit-preview]');
    if (!host) return () => {};
    const keys = new WeakMap(), previous = new WeakMap(), occurrences = new Map(), relaxed = new Set();
    const rules = [];
    for (const detail of host.querySelectorAll('details')) {
        const summary = DIRECT_SUMMARY(detail); if (!summary) continue;
        const name = `${scope}|${detail.id || ''}|${detail.className}|${summary.textContent.replace(/\s+/g, ' ').trim()}`;
        const number = occurrences.get(name) || 0; occurrences.set(name, number + 1);
        const key = `${name}|${number}`; keys.set(detail, key);
        if (state.has(key)) detail.open = state.get(key);
        previous.set(detail, detail.open);
        // 계산된 높이와 격자 행 크기를 그대로 고정하면 접혀도 빈 자리가 남아요.
        if (detail.hasAttribute('data-bl-preview-node')) for (let el = detail; el && host.contains(el); el = el.parentElement) {
            if (relaxed.has(el)) continue; relaxed.add(el);
            for (const prop of ['height', 'block-size', 'grid-template-rows']) el.style.removeProperty(prop);
        }
        summary.style.pointerEvents = 'auto'; summary.style.cursor = 'pointer';
        const id = detail.getAttribute('data-bl-preview-node');
        if (!id || !/^\d+$/.test(id)) continue;
        const selector = `[data-bl-preview-node="${id}"]`;
        if (demSkin && detail.matches('.custom-dem-card,.dem-card,.custom-dem-modules,.dem-modules,.custom-dem-status__more,.dem-status__more,.custom-dem-charpage__head,.dem-charpage__head')) {
            rules.push(`${selector}:not([open])>summary::after{transform:rotate(-90deg)!important}${selector}[open]>summary::after{transform:none!important}`);
        }
        for (const caret of summary.querySelectorAll('.custom-dem-card__caret,.dem-card__caret,.custom-dem-modules__caret,.dem-modules__caret')) {
            const symbol = caret.textContent.trim(), caretId = caret.getAttribute('data-bl-preview-node');
            if (!caretId || !/^\d+$/.test(caretId)) continue;
            const right = ['▶', '▸', '›', '❯', '>', 'chevron_right'].includes(symbol);
            const down = ['▼', '▾', '⌄', '∨', 'v', 'expand_more'].includes(symbol);
            if (right || down) rules.push(`${selector}:not([open]) [data-bl-preview-node="${caretId}"]{transform:${right ? 'none' : 'rotate(-90deg)'}!important}${selector}[open] [data-bl-preview-node="${caretId}"]{transform:${right ? 'rotate(90deg)' : 'none'}!important}`);
        }
    }
    let style = doc.getElementById('preview-details-style');
    if (!style) { style = doc.createElement('style'); style.id = 'preview-details-style'; doc.head.append(style); }
    style.textContent = rules.join('\n');
    for (const control of host.querySelectorAll('button,input,select,textarea,a')) { control.inert = true; control.tabIndex = -1; }
    const toggle = event => {
        const detail = event.target, key = keys.get(detail);
        if (!key || previous.get(detail) === detail.open || !host.contains(detail)) return;
        previous.set(detail, detail.open); state.set(key, detail.open);
        if (state.size > 128) state.delete(state.keys().next().value);
        onToggle();
    };
    doc.addEventListener('toggle', toggle, true);
    return () => doc.removeEventListener('toggle', toggle, true);
}
