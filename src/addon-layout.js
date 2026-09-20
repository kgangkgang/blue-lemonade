// Editor-only layout state; no chat observers or background work.
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toolSection(id, title, content, open = false, hint = '') {
    return `<section class="bl-tool-section" data-tool-section="${esc(id)}"><button type="button" class="bl-tool-heading" data-tool-fold aria-expanded="${open}"><span>${title}${hint ? `<small>${hint}</small>` : ''}</span><span class="bl-tool-chevron" aria-hidden="true">⌄</span></button><div class="bl-tool-body" ${open ? '' : 'hidden'}>${content}</div></section>`;
}
export function bindAddonLayout(root) {
    root._addonFolds ??= new Map();
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
