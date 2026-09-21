// Layout state is local to the open editor; theme values and controls stay intact.
export function openEditorCatalog(root, open, search = false) {
    const catalog = root.querySelector('.bl-editor-catalog');
    if (!catalog) return;
    root._catalogOpen = !!open; catalog.hidden = !open;
    for (const el of root.querySelectorAll(':scope > .salty-nav,:scope > .bl-editor-workspace')) el.inert = !!open;
    root.querySelector('[data-act="editor-catalog"]')?.setAttribute('aria-expanded', String(!!open));
    const target = open ? (search ? catalog.querySelector('[data-settings-search]') : catalog.querySelector('.bl-editor-directory [data-act="editor-catalog-close"]')) : root.querySelector('[data-act="editor-catalog"]');
    target?.focus({ preventScroll: true });
}

export function bindEditor(root) {
    root.addEventListener('change', () => setTimeout(() => summarizeEditorGroups(root), 0));
    // 긴 안내 글은 두 줄까지만 보이고, 누르면 펴진다 (4.1.2)
    root.addEventListener('click', (event) => {
        const note = event.target.closest?.('.bl-editor-group-body .salty-note');
        if (note && !event.target.closest('a,button,input,select,label')) note.classList.toggle('open');
    });
    root.addEventListener('keydown', event => {
        const catalog = root.querySelector('.bl-editor-catalog');
        if (!catalog || catalog.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); openEditorCatalog(root, false); }
        if (event.key !== 'Tab') return;
        const items = [...catalog.querySelectorAll('button,input,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || !catalog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
}

export function selectEditorGroup(root, group, toggle = false) {
    const route = root._editorRoute;
    const open = !(toggle && group.querySelector('.bl-editor-group-toggle').getAttribute('aria-expanded') === 'true');
    root._editorGroups.set(route, open ? group.dataset.group : null);
    for (const item of root.querySelectorAll('.bl-editor-group')) {
        const expanded = open && item === group;
        item.querySelector('.bl-editor-group-toggle').setAttribute('aria-expanded', String(expanded));
        item.querySelector('.bl-editor-group-body').hidden = !expanded;
    }
    root.dispatchEvent(new Event('bl:preview-resize'));
}

// 접힌 묶음 제목 옆의 '지금 값' (4.1.2): 펼치지 않고도 훑어볼 수 있게. 고른 칩 · 켠 스위치만 읽는다 (설정 값은 건드리지 않음)
function groupSummary(body) {
    const pins = body.querySelector('.bl-mespins');
    if (pins) { const n = pins.querySelectorAll('button.on').length; return n ? `${n}개` : '없음'; }
    const parts = [];
    const seg = body.querySelector('.salty-seg:not(.salty-mini) > button.on');
    if (seg) parts.push(seg.textContent.trim());
    const switches = [...body.querySelectorAll('.salty-switch input')];
    if (switches.length) { const on = switches.filter(i => i.checked).length; parts.push(on ? (switches.length === 1 ? '켬' : `${on}개 켬`) : '끔'); }
    return parts.join(' · ').slice(0, 24);
}
export function summarizeEditorGroups(root) {
    for (const group of root.querySelectorAll('.bl-editor-group')) {
        const out = group.querySelector('.bl-editor-group-summary');
        if (out) out.textContent = groupSummary(group.querySelector('.bl-editor-group-body'));
    }
}

export function revealEditorTarget(root, target) {
    const group = target?.closest('.bl-editor-group');
    if (group) selectEditorGroup(root, group);
}

export function arrangeEditor(root, route, title) {
    root._editorGroups ??= new Map(); root._editorScroll ??= new Map(); root._editorRoute = route;
    const section = root.querySelector('.salty-sec'), preview = section.querySelector(':scope > .salty-prevbox');
    const workspace = document.createElement('div'); workspace.className = 'bl-editor-workspace';
    section.before(workspace);
    if (preview) {
        const stage = document.createElement('div'); stage.className = 'bl-editor-stage';
        const caption = document.createElement('div'); caption.className = 'bl-editor-caption'; caption.textContent = '미리보기';
        stage.append(caption, preview);
        const tint = section.querySelector(':scope > .bl-palette-tint');
        if (tint) stage.append(tint);
        workspace.append(stage);
    } else workspace.classList.add('bl-editor-no-preview');
    workspace.append(section);
    workspace.inert = !!root._catalogOpen;
    root.querySelector('.salty-nav').inert = !!root._catalogOpen;
    if(route.startsWith('extensions/')) { section.classList.add('bl-extension-page'); workspace.classList.add('bl-extension-workspace'); return; }
    const elements = [...section.children], groups = []; let current;
    const makeGroup = (label, anchor) => {
        const group = document.createElement('div'); group.className = 'bl-editor-group'; group.dataset.group = label;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'bl-editor-group-toggle'; button.dataset.act = 'editor-group';
        const name = document.createElement('span'); name.textContent = label; const summary = document.createElement('small'); summary.className = 'bl-editor-group-summary'; button.append(name, summary);
        if (anchor) button.dataset.searchAnchor = anchor;
        const body = document.createElement('div'); body.className = 'bl-editor-group-body';
        group.append(button, body); groups.push(group); section.append(group); current = body;
    };
    for (const element of elements) {
        if (element.classList.contains('salty-label')) {
            const label = [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim() || element.textContent.trim();
            makeGroup(label, element.dataset.searchAnchor); const hint = element.querySelector('.salty-hint');
            if (hint) { hint.className = 'salty-note'; current.append(hint); }
            element.remove();
        } else {
            if (!current) makeGroup('기본 설정');
            current.append(element);
        }
    }
    if (groups.length === 1) { groups[0].classList.add('bl-editor-single'); groups[0].querySelector('.bl-editor-group-toggle').hidden = true; }
    summarizeEditorGroups(root);
    const remembered = root._editorGroups.get(route);
    const selected = remembered === null ? null : groups.find(g => g.dataset.group === remembered) || groups[0];
    for (const group of groups) {
        const open = group === selected || groups.length === 1;
        group.querySelector('.bl-editor-group-toggle').setAttribute('aria-expanded', String(open));
        group.querySelector('.bl-editor-group-body').hidden = !open;
    }
}
