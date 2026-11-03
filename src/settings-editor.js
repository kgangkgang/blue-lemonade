// Layout state is local to the open editor; theme values and controls stay intact.
import { applyAdvanced, moveLongNotes } from './settings-advanced.js';   // 1.0.0 간단화: 화면 맨 아래 「고급」 접힘 · 긴 설명은 묶음 제목 옆 ? 로
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
    // 긴 안내 글은 두 줄까지만 보이고, 누르면 펴진다 (4.1.2)
    root.addEventListener('click', (event) => {
        const note = event.target.closest?.('.bl-editor-group-body .salty-note');
        if (note && !event.target.closest('a,button,input,select,label')) note.classList.toggle('open');
    });
    root.addEventListener('click', event => {
        const help = event.target.closest?.('[data-act="group-help"]');
        if (help) { event.preventDefault(); const h = root._groupHelp?.[Number(help.dataset.help)]; if (h) import('./help-sheet.js').then(m => m.openHelpSheet(h)); return; }
        const chip = event.target.closest?.('.bl-group-chips [data-group-chip]');
        if (!chip) return;
        showChipGroup(root, root._chipGroups?.[Number(chip.dataset.groupChip)], true);
        const sec = root.querySelector('.salty-sec'); if (sec) sec.scrollTop = 0;
    });
    root.addEventListener('keydown', event => {
        const catalog = root.querySelector('.bl-editor-catalog');
        if (!catalog || catalog.hidden) return;
        if (event.key === 'Escape') {
            if (event.target.closest?.('.bl-settings-search')?.querySelector('[data-settings-search]')?.value) return;
            event.preventDefault(); event.stopPropagation(); openEditorCatalog(root, false);
        }
        if (event.key !== 'Tab') return;
        const items = [...catalog.querySelectorAll('button,input,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || !catalog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
}

// 1.0.0 묶음 접기를 없앴어요 — 화면의 묶음은 늘 펼쳐 두고, 묶음 이름은 그냥 제목(누를 것 0)이에요.
//   묶음 틀(.bl-editor-group[data-group] · .bl-editor-group-body)은 남겨 검색 이동 · 자동 검사가 묶음 이름으로 찾을 수 있어요.

const sharedScroll = new Map();   // 화면마다 본문 스크롤 자리 (창을 다시 열어도 이어서)

// 1.0.0 묶음 칩(10-31 사용자 「칩이 있는 편이 낫지 않나」): 묶음을 다 펼치면 폰 384 에서 1,500px 를 넘는 화면은 맨 위 칩 줄로 한 번에 한 묶음만 보여요.
//   고른 칩은 화면마다 기억해요(옛 「펼친 묶음」 열쇠 salty_editor_groups 그대로 — 예전에 펼쳐 둔 묶음이 그 칩으로 이어져요). 검색 · 바로 가기로 오면 그 묶음 칩이 골라져요.
const CHIP_ROUTES = new Set(['chat/screen', 'prompt/deus', 'prompt/fruit']);
const CHIP_KEY = 'salty_editor_groups', chipMemory = new Map();
try { for (const [route, label] of Object.entries(JSON.parse(localStorage.getItem(CHIP_KEY) || '{}'))) if (typeof label === 'string') chipMemory.set(route, label); } catch { /* 저장소를 못 쓰면 이번 화면 동안만 */ }
function showChipGroup(root, group, remember) {
    const groups = root._chipGroups || [];
    if (!groups.includes(group)) return false;
    groups.forEach((g, i) => {
        g.hidden = g !== group;
        const chip = root.querySelector(`.bl-group-chips [data-group-chip="${i}"]`);
        chip?.classList.toggle('on', g === group); chip?.setAttribute('aria-pressed', String(g === group));
    });
    if (remember) {
        chipMemory.set(root._editorRoute, group.dataset.group);
        try { localStorage.setItem(CHIP_KEY, JSON.stringify(Object.fromEntries([...chipMemory].slice(-40)))); } catch { /* 위와 같음 */ }
    }
    root.dispatchEvent(new Event('bl:preview-resize'));
    return true;
}

/** 그 묶음이 보이게 해요 — 칩 화면이면 그 칩을 고르고, 아니면 본문을 굴려요 */
export function selectEditorGroup(root, group) {
    const sec = root.querySelector('.salty-sec');
    if (!sec || !group) return;
    if (showChipGroup(root, group, true)) { sec.scrollTop = 0; return; }
    // 「고급」 안 묶음: 그 칩을 고르고 접힘을 펼친 뒤 굴려요
    const outer = root._chipGroups?.find(g => g.contains(group));
    if (outer) showChipGroup(root, outer, true);
    for (let p = group.parentElement; p && p !== sec; p = p.parentElement) if (p.matches('details')) p.open = true;
    sec.scrollTop += group.getBoundingClientRect().top - sec.getBoundingClientRect().top;
}
export function summarizeEditorGroups() { /* 1.0.0: 접힌 묶음이 없어 「지금 값」 요약도 없어요 */ }

/** 검색 · 바로 가기로 찾아온 설정이 숨은 칩 묶음에 있으면 그 칩을 골라요.
 *  찾아온 것이 묶음 제목 줄이면(칩 화면에서는 숨김) 대신 표시할 그 칩을 돌려줘요 */
export function revealEditorTarget(root, target) {
    // 「고급」 접힘 안이면 펼쳐요(검색 · 바로 가기)
    for (let p = target?.parentElement; p && p !== root; p = p.parentElement) if (p.matches?.('details.bl-advanced')) p.open = true;
    const group = root._chipGroups?.find(g => g.contains(target));   // 고급 안의 묶음도 바깥 칩 묶음으로
    if (!group) return null;
    if (group.hidden) showChipGroup(root, group, true);
    return target.matches('.bl-editor-group-head') && target.parentElement === group ? root.querySelector(`.bl-group-chips [data-group-chip="${root._chipGroups.indexOf(group)}"]`) : null;
}

export function arrangeEditor(root, route, title) {
    root._editorScroll ??= sharedScroll; root._editorRoute = route;
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
    const makeGroup = (label, anchor, named = true) => {
        const group = document.createElement('div'); group.className = 'bl-editor-group'; group.dataset.group = label;
        if (named) {
            const head = document.createElement('h4'); head.className = 'bl-editor-group-head'; head.textContent = label;
            if (anchor) head.dataset.searchAnchor = anchor;
            group.append(head);
        }
        const body = document.createElement('div'); body.className = 'bl-editor-group-body';
        group.append(body); groups.push(group); section.append(group); current = body;
    };
    for (const element of elements) {
        if (element.classList.contains('bl-screen-chips')) { section.append(element); continue; }   // 합친 화면의 칩 줄은 묶음 밖 맨 위
        if (element.classList.contains('salty-label')) {
            const label = [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim() || element.textContent.trim();
            makeGroup(label, element.dataset.searchAnchor); const hint = element.querySelector('.salty-hint');
            if (hint) { hint.className = 'salty-note'; current.append(hint); }
            element.remove();
        } else {
            if (!current) makeGroup('기본 설정', '', false);   // 첫 묶음 이름 전의 항목: 이름 줄 없이
            current.append(element);
        }
    }
    // 안에 고칠 것이 하나도 없는 묶음(제목 + 짧은 예시 글뿐)은 자리만 차지한다 — 그리지 않는다
    for (const group of [...groups]) {
        const body = group.querySelector('.bl-editor-group-body');
        if ([...body.children].some(el => !el.classList.contains('salty-note')) || body.textContent.trim().length > 24) continue;
        group.remove(); groups.splice(groups.indexOf(group), 1);
    }
    root._chipGroups = null;
    const chipped = CHIP_ROUTES.has(route) && groups.length > 1;
    const kept = applyAdvanced(section, groups, route, chipped);
    groups.splice(0, groups.length, ...kept);
    if (chipped && groups.length > 1) {
        const chips = document.createElement('div'); chips.className = 'salty-seg bl-screen-chips bl-group-chips';
        chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', `${title} 묶음`);
        groups.forEach((g, i) => {
            const b = document.createElement('button'); b.type = 'button'; b.dataset.groupChip = String(i);
            b.textContent = g.querySelector(':scope > .bl-editor-group-head') ? g.dataset.group : '기본';
            chips.append(b);
        });
        section.prepend(chips); section.classList.add('bl-group-chipped'); root._chipGroups = groups;
        const remembered = chipMemory.get(route);
        showChipGroup(root, groups.find(g => g.dataset.group === remembered) || groups[0], false);
    }
    moveLongNotes(root, section, route, title, !!root._chipGroups);
}
