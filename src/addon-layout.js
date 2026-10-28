// Editor-only layout state; no chat observers or background work.
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toolSection(id, title, content, open = false, hint = '') {
    return `<section class="bl-tool-section" data-tool-section="${esc(id)}"><button type="button" class="bl-tool-heading" data-tool-fold aria-expanded="${open}"><span>${title}${hint ? `<small>${hint}</small>` : ''}</span><span class="bl-tool-chevron" aria-hidden="true">⌄</span></button><div class="bl-tool-body" ${open ? '' : 'hidden'}>${content}</div></section>`;
}
// 10-28 제보: 넓은 배치(편집기 720 이상) 묶음 쪽에서 왼쪽 칸(.bl-addon-main)은 자기 도구가 끝날 때까지 묶음 위에 붙는다(css/52-tool-editor.css).
// 왼쪽 칸이 묶음 칸보다 길면 top 을 (칸 높이 − 왼쪽 키)만큼 음수로 — 바닥까지 다 본 뒤에 붙어서 아래쪽이 가려지지 않는다.
function stickMains(root) {
    root._mainStickRO?.disconnect(); root._mainStickRO = null;
    const group = root.querySelector('.bl-extension-page > .bl-addon-group');
    if (!group || typeof ResizeObserver !== 'function') return;
    const mains = [...group.querySelectorAll(':scope > .bl-addon-embedded-layout > .bl-addon-main')];
    const fit = () => { const height = group.clientHeight; for (const main of mains) main.style.setProperty('--bl-main-stick', `${Math.min(0, Math.round(height - main.offsetHeight))}px`); };
    root._mainStickRO = new ResizeObserver(fit);
    root._mainStickRO.observe(group);
    for (const main of mains) root._mainStickRO.observe(main);
}
export function bindAddonLayout(root) {
    root._addonFolds ??= new Map();
    stickMains(root);
    const route = root._editorRoute;
    for (const section of root.querySelectorAll('[data-tool-section]')) {
        const saved = root._addonFolds.get(`${route}/${section.dataset.toolSection}`);
        if (saved === undefined) continue;
        section.querySelector(':scope > [data-tool-fold]').setAttribute('aria-expanded', String(saved));
        section.querySelector(':scope > .bl-tool-body').hidden = !saved;
    }
    if (root._addonFoldBound) return;
    root._addonFoldBound = true;
    root.addEventListener('click', event => {
        const button = event.target.closest('[data-tool-fold]');
        if (!button || !root.contains(button)) return;
        const section = button.parentElement, open = button.getAttribute('aria-expanded') !== 'true';
        root._addonFolds.set(`${root._editorRoute}/${section.dataset.toolSection}`, open);
        button.setAttribute('aria-expanded', String(open));
        section.querySelector(':scope > .bl-tool-body').hidden = !open;
    });
}
