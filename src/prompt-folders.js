// 프롬프트 폴더 (1.0.1, 1.0.2 · 1.0.3 더함) — 프롬프트 관리자 목록의 항목을 폴더로 묶어 접고 펼쳐요.
// 계산은 prompt-folders-core.js(순수). 여기는 화면 · 저장 · 실리태번 연결만.
//
// 줄은 옮기지도 복제하지도 않아요: 실제 순서에서 같은 폴더 항목이 이어지는 구간마다 머리 줄(li.bl-pf-head) 하나를 그 구간 앞에 끼우고,
//   항목 줄에는 클래스만(bl-pf-in · bl-pf-hide · bl-pf-alt) 붙여요. 머리 줄에는 data-pm-identifier 가 없어 실리태번 끌기 저장(toArray)에 안 섞여요.
// 끌어 옮긴 줄의 소속은 놓인 자리로(core adoptMove). 하나만 켜기는 택1 묶음(prompt-choice)에 더해서 같은 규칙으로.
// 모양: src/prompt-folders.css(이 기능이 켜질 때만 받음) + css/27-compact.css 의 프롬프트 켜기 동그라미(.bl-pf-all 을 같은 규칙에).
// 같은 일을 하는 다른 확장(PromptFolders · 「프롬프트 그룹」)이 켜져 있으면 features.js 가 이 기능을 쉬게 해요(ext-presence.js).
// 프리셋 파일의 extensions.blPromptFolders 는 읽기만 해요: 내 폴더가 없는 프리셋의 초깃값이고, 고치면 테마 설정이 우선이에요. 테마가 프리셋 파일에 쓰지는 않아요(tools/preset-folders.mjs 가 넣어요).
// 1.0.2: 접고 펼치기는 머리 줄을 다시 만들지 않고 제자리에서(refold) · 폴더째 위 · 아래로 옮기기 · 하위 폴더를 풀면 항목은 위 폴더로 ·
//   모두 켜기 · 끄기와 「하나만 켜기」에 되돌리기 · 다 꺼진 폴더 머리는 꺼진 줄처럼 옅게 · 바뀐 게 없으면 저장 안 함.
// 1.0.3: 폴더 창 하나로 — 도구 줄 「모든 폴더 고치기」(모든 폴더) · 폴더 메뉴 「이 폴더 고치기」(그 폴더와 안의 하위 폴더) · 「새 폴더」가 같은 창이에요.
//   두 목록(폴더 · 모든 항목)을 넓으면 좌우 · 좁으면 위아래로, 하위 폴더는 같은 창 안의 접는 줄, 항목은 위 · 아래 · 빼기, 창 안에서 「하나만 켜기」.
import { getSettings, saveSettings } from './settings.js';
import { watchDom } from './dom-watch.js';
import { groupedNumber } from './numbers.js';
import { pickRect } from './selects.js';
import { ask, attachUndo } from './ask.js';
import { showThemeModal } from './modal.js';
import { mouseDevice } from './prompt-card-picker.js';
import { promptChoiceGroups, withFolderChoices } from './prompt-choice-core.js';
import { setFolderSource } from './prompt-choice.js';
import { LIMITS, tidyFolders, newFolderId, folderRuns, detectMove, adoptMove, assignIds, gatherOrder, runStats, planToggleAll, planFromDividers, isDivider, folderItems, dropEmpty, remapFolders, presetStem, readPresetFolders, readBoxPresetFolders, folderIndex, ungroupFolder, moveFolderBlock, shiftInFolder, scopeFolders } from './prompt-folders-core.js';
import { planFolderNames, applyFolderNamePlan } from './prompt-folder-labels.js';

const CONTAINER = 'completion_prompt_manager';
const LIST = 'completion_prompt_manager_list';
const ROW = 'li.completion_prompt_manager_prompt[data-pm-identifier]';
const DISABLED = 'completion_prompt_manager_prompt_disabled';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let wanted = false, api = null, loading = null, unwatch = null, unfind = null, lastIds = null, lastPreset = null, menu = null, frame = 0;
const timings = [];
/** 마지막 입히기 시간들(ms, 최근 20번) — 리그에서 긴 목록 무게를 잴 때 */
export function promptFolderTimings() { return timings.slice(); }

const manager = () => api?.promptManager || null;
// 구분선 줄(내용이 빈 장식 이름 · 🔻PICK 머리)은 폴더 안에 보이기만 하고 켜진 수 · 모두 켜기 · 하나만 켜기에서는 빼요
const counted = id => { try { return !isDivider(manager()?.getPromptById?.(id)); } catch { return true; } };
function presetName() {
    try { const name = SillyTavern.getContext().getPresetManager?.('openai')?.getSelectedPresetName?.(); if (name) return String(name); } catch { /* 없음 */ }
    return String(api?.oai_settings?.preset_settings_openai || 'Default');
}
/** 지금 프리셋의 폴더(다듬은 것). create 면 칸을 만들어 둬요 — 고친 뒤 save() */
function store() {
    // 설정 파일의 칸 모양은 여기서 다듬어요(settings.js 는 기본값만 — 시작 그래프에 안 싣게)
    const s = getSettings();
    if (!s.promptFolders || typeof s.promptFolders !== 'object' || Array.isArray(s.promptFolders)) s.promptFolders = { on: true, presets: {} };
    const p = s.promptFolders.presets;
    if (!p || typeof p !== 'object' || Array.isArray(p)) s.promptFolders.presets = {};
    return s.promptFolders;
}
function bucket(create = false) {
    const box = store();
    const key = presetName();
    let slot = Object.hasOwn(box.presets, key) ? box.presets[key] : null;
    if (slot && typeof slot === 'object') { slot.folders = tidyFolders(slot.folders); return slot; }
    slot = { folders: presetSeed() };
    if (create) box.presets[key] = slot;
    return slot;
}
const folders = () => bucket().folders;
/** 프리셋 파일에 든 폴더(지금 프리셋) — 내 폴더가 없을 때의 초깃값 */
function presetSeed() { return readPresetFolders(manager()?.serviceSettings?.extensions); }
function boxFolders() {
    let data = manager()?.serviceSettings?.extensions?.baibaiToolkit;
    if (!data) try { data = SillyTavern.getContext().getPresetManager?.('openai')?.readPresetExtensionField?.({ path: 'baibaiToolkit' }); } catch { /* 저장 형식이 없으면 메뉴를 만들지 않아요. */ }
    return readBoxPresetFolders({ baibaiToolkit: data }, (hostOrder() || []).map(item => item.identifier));
}
function importBoxFolders() {
    const imported = boxFolders();
    if (imported.length) openEditor({ imported });
}
function save(slot) {
    // 다 푼 뒤에도 프리셋 초깃값이 되살아나지 않게, 프리셋에 폴더가 들어 있으면 빈 칸을 남겨요
    if (slot && !slot.folders.length && !presetSeed().length) delete store().presets[presetName()];
    saveSettings();
}

// ───────── 입히기 ─────────
function rowsOf(list) { return [...list.children].filter(el => el.matches?.(ROW)); }
function cleanup(list) {
    for (const el of list.querySelectorAll(':scope > li.bl-pf-head')) el.remove();
    for (const el of list.querySelectorAll(':scope > li.bl-pf-in, :scope > li.bl-pf-alt')) el.classList.remove('bl-pf-in', 'bl-pf-in2', 'bl-pf-hide', 'bl-pf-alt');
    list.classList.remove('bl-pf-on');
}
function shownName(row) {
    const el = row.querySelector('.completion_prompt_manager_prompt_name :is(a.prompt-manager-inspect-action, span[title])');
    return (el?.textContent || row.querySelector('[data-pm-name]')?.dataset.pmName || row.dataset.pmIdentifier || '').replace(/\s+/g, ' ').trim();
}
function headMarkup(run, stats) {
    const f = run.folder, open = f.open !== false;
    const allOn = stats.total > 0 && stats.on === stats.total;
    const count = `${stats.on}/${stats.total}${f.pick ? ' · 택1' : ''}${run.part > 0 ? ' · 이어서' : ''}`;
    const allLabel = f.pick ? (stats.on ? '이 폴더 끄기' : '켜려면 항목 하나를 켜요') : (allOn ? '이 폴더 모두 끄기' : '이 폴더 모두 켜기');
    return `<button type="button" class="bl-pf-name" data-pf-act="fold" aria-expanded="${open}"><i class="fa-solid ${open ? 'fa-chevron-down' : 'fa-chevron-right'} bl-pf-caret" aria-hidden="true"></i><span class="bl-pf-title">${esc(f.name)}</span><small class="bl-pf-count">${count}</small></button>`
        + `<small class="bl-pf-tok">${stats.tokens ? groupedNumber(stats.tokens) : ''}</small>`   // span 이 아니에요 — css/14 의 「빈 둘째 span = 조작 칸」 규칙에 안 걸리게
        + `<span class="bl-pf-ctl"><button type="button" class="bl-pf-more fa-solid fa-ellipsis-vertical" data-pf-act="menu" aria-label="폴더 메뉴" title="폴더 메뉴"></button>`
        + `<button type="button" class="bl-pf-all${allOn || (f.pick && stats.on) ? ' bl-pf-lit' : ''}" data-pf-act="all" role="switch" aria-checked="${allOn}" aria-label="${allLabel}" title="${allLabel}"${f.pick && !stats.on ? ' aria-disabled="true"' : ''}></button></span>`;
}
function apply() {
    frame = 0;
    const list = document.getElementById(LIST);
    if (!list) return;
    const t0 = performance.now();
    cleanup(list);
    if (!wanted) return;
    ensureToolButton();
    const rows = rowsOf(list), ids = rows.map(row => row.dataset.pmIdentifier);
    const key = presetName(), slot = bucket();
    // 끌어 옮긴 줄: 놓인 자리로 소속을 정해요(같은 프리셋 · 하나만 옮겼을 때)
    if (lastPreset === key && lastIds && slot.folders.length) {
        const moved = detectMove(lastIds, ids);
        if (moved && adoptMove(slot.folders, ids, moved)) { slot.folders = dropEmpty(slot.folders); store().presets[key] = slot; save(slot); }
    }
    lastIds = ids; lastPreset = key;
    const list2 = slot.folders;
    if (!list2.length) { note(t0, rows.length, 0); return; }
    const runs = folderRuns(ids, list2);
    if (!runs.length) { note(t0, rows.length, 0); return; }
    list.classList.add('bl-pf-on');
    const enabled = new Set(), tokens = new Map();
    rows.forEach((row, i) => {
        if (!row.classList.contains(DISABLED)) enabled.add(ids[i]);
        const t = row.querySelector('.prompt_manager_prompt_tokens')?.dataset.pmTokens;
        if (t && t !== '-') tokens.set(ids[i], t);
    });
    // 머리 숫자는 폴더 전체(떨어진 구간까지) 기준
    const totals = new Map();
    const present = new Set(ids);
    for (const f of list2) totals.set(f, runStats(folderItems(f, list2).filter(id => present.has(id) && counted(id)), enabled, tokens));
    for (const run of runs) {
        const head = document.createElement('li');
        const open = run.folder.open !== false;
        const shut = run.depth > 0 && list2.find(f => f.id === run.folder.parent)?.open === false;   // 접힌 위 폴더 안의 머리
        const stats = totals.get(run.folder);
        // 다 꺼진 폴더(0/n)는 꺼진 프롬프트 줄처럼 이름을 옅게(css/59 의 꺼진 줄 규칙과 같은 색)
        head.className = `bl-pf-head${open ? '' : ' bl-pf-closed'}${run.depth ? ' bl-pf-sub' : ''}${shut ? ' bl-pf-hide' : ''}${stats.total && !stats.on ? ' bl-pf-off' : ''}`;
        head.dataset.pfId = run.folder.id;
        head.dataset.pfPart = String(run.part);
        head.innerHTML = headMarkup(run, stats);
        rows[run.start].before(head);
        for (let i = run.start; i <= run.end; i++) rows[i].classList.add(run.depth ? 'bl-pf-in2' : 'bl-pf-in');
        if (!open) for (let i = run.start; i <= run.end; i++) rows[i].classList.add('bl-pf-hide');
    }
    retone(list);
    note(t0, rows.length, runs.length);
}
/** 한 줄 걸러 톤: 머리 · 숨긴 줄 때문에 nth-child 짝이 어긋나 보이는 줄만 다시 매겨요(css 가 bl-pf-on 일 때 nth-child 톤을 끔) */
function retone(list) {
    let n = 0;
    for (const el of list.children) {
        if (el.classList.contains('bl-pf-head')) { n = 0; continue; }
        if (!el.matches(ROW)) continue;
        const alt = !el.classList.contains('bl-pf-hide') && n++ % 2 === 1;
        if (el.classList.contains('bl-pf-alt') !== alt) el.classList.toggle('bl-pf-alt', alt);
    }
}
/** 접힘만 바뀌었을 때(1.0.2): 머리 줄은 그대로 두고 클래스만 — 누른 단추에 초점이 남고 목록을 다시 만들지 않아요. 모양이 맞지 않으면 다시 입혀요 */
function refold() {
    const list = document.getElementById(LIST);
    if (!list?.classList.contains('bl-pf-on')) return apply();
    const all = folders(), byId = new Map(all.map(f => [f.id, f])), of = folderIndex(all);
    const shut = f => !!f && (f.open === false || (!!f.parent && byId.get(f.parent)?.open === false));
    for (const el of list.children) {
        if (el.classList.contains('bl-pf-head')) {
            const f = byId.get(el.dataset.pfId);
            if (!f) return apply();
            const open = f.open !== false;
            el.classList.toggle('bl-pf-closed', !open);
            el.classList.toggle('bl-pf-hide', !!f.parent && byId.get(f.parent)?.open === false);
            el.querySelector('.bl-pf-name')?.setAttribute('aria-expanded', String(open));
            const caret = el.querySelector('.bl-pf-caret');
            caret?.classList.toggle('fa-chevron-down', open); caret?.classList.toggle('fa-chevron-right', !open);
        } else if (el.matches(ROW) && (el.classList.contains('bl-pf-in') || el.classList.contains('bl-pf-in2'))) {
            el.classList.toggle('bl-pf-hide', shut(of.get(el.dataset.pmIdentifier)));
        }
    }
    retone(list);
}
function note(t0, rows, heads) {
    timings.push({ ms: Math.round((performance.now() - t0) * 100) / 100, rows, heads });
    if (timings.length > 20) timings.shift();
}
function schedule() { if (!frame) frame = requestAnimationFrame(apply); }

function ensureToolButton() {
    const footer = document.querySelector(`#${CONTAINER} .completion_prompt_manager_footer`);
    if (!footer || footer.querySelector('.bl-pf-tools')) return;
    // 실리태번 도구 아이콘(가져오기 · 내보내기 …)과 같은 <a class="menu_button"> — 모양은 그 줄의 공용 규칙 그대로. 가져오기 앞에(맨 끝 「새 프롬프트」 자리는 그대로)
    const button = document.createElement('a');
    button.className = 'menu_button fa-solid fa-fw fa-folder-tree bl-pf-tools';
    button.setAttribute('role', 'button'); button.tabIndex = 0;
    button.title = '프롬프트 폴더'; button.setAttribute('aria-label', '프롬프트 폴더');
    button.dataset.pfAct = 'tools';
    let before = footer.querySelector('#prompt-manager-import');
    while (before && before.parentElement !== footer) before = before.parentElement;
    if (before) before.before(button); else footer.append(button);
}

// ───────── 누름 ─────────
function onClick(event) {
    const target = event.target?.closest?.('[data-pf-act]');
    if (!target || !target.closest(`#${CONTAINER}`)) return;
    event.preventDefault(); event.stopPropagation();
    const act = target.dataset.pfAct;
    if (act === 'tools') return openToolsMenu(target);
    const head = target.closest('li.bl-pf-head');
    const id = head?.dataset.pfId;
    if (!id) return;
    if (act === 'fold') return setOpen(id, head.classList.contains('bl-pf-closed'));
    if (act === 'menu') return openFolderMenu(id, target);
    if (act === 'all') return toggleAll(id);
}
function onKey(event) {
    if ((event.key === 'Enter' || event.key === ' ') && event.target?.matches?.('.bl-pf-tools')) { event.preventDefault(); event.target.click(); }
}
function setOpen(id, open) {
    const slot = bucket(true), f = slot.folders.find(x => x.id === id);
    if (!f) return;
    f.open = open;
    save(slot); refold();
}
function setAllOpen(open) {
    const slot = bucket(true);
    for (const f of slot.folders) f.open = open;
    save(slot); refold();
}

/** 실리태번 순서 · 켜짐 */
function hostOrder() {
    const pm = manager();
    if (!pm?.activeCharacter) return null;
    try { return pm.getPromptOrderForCharacter(pm.activeCharacter) || null; } catch { return null; }
}
/** 택1 묶음에 넘길 폴더: 하위 폴더 항목까지 · 구분선 줄 빼고 */
function choiceFolders() {
    const list = folders();
    return list.map(f => (f.pick ? { ...f, ids: folderItems(f, list).filter(counted) } : f));
}
function choiceGroupsNow(order, except = '') {
    const pm = manager(), settings = pm?.serviceSettings;
    const list = choiceFolders().filter(f => f.id !== except);
    try { return promptChoiceGroups(settings?.prompts || [], order, withFolderChoices(settings?.extensions?.blPromptChoices, list)); } catch { return []; }
}
function writeEnabled(changes) {
    const pm = manager();
    if (!pm || !changes.length) return;
    const counts = pm.tokenHandler?.getCounts?.() ?? pm.getTokenHandler?.()?.getCounts?.();
    for (const [id, on] of changes) {
        const entry = pm.getPromptOrderEntry(pm.activeCharacter, id);
        if (!entry) continue;
        entry.enabled = on;
        if (counts) counts[id] = null;
    }
    pm.render();
    pm.saveServiceSettings();
}
function toggleAll(id) {
    const pm = manager(), order = hostOrder();
    const list = folders(), f = list.find(x => x.id === id);
    if (!pm || !order || !f) return;
    const inOrder = new Set(order.map(e => e.identifier));
    const ids = folderItems(f, list).filter(x => inOrder.has(x) && counted(x));
    const enabled = new Set(order.filter(e => e.enabled).map(e => e.identifier));
    const allowed = x => { try { return pm.isPromptToggleAllowed(pm.getPromptById(x)); } catch { return false; } };
    const usable = ids.filter(allowed);
    const allOn = usable.length > 0 && usable.every(x => enabled.has(x));
    const on = f.pick ? false : !allOn;
    if (f.pick && !usable.some(x => enabled.has(x))) return;
    const plan = planToggleAll(ids, enabled, on, { groups: choiceGroupsNow(order, f.id), allowed, pick: f.pick });
    if (!plan?.length) return;
    writeEnabled(plan);
    // 둘 이상 바뀌면 되돌리기(하나는 그 줄 켜기 동그라미를 다시 누르면 돼요)
    if (plan.length < 2) return;
    const before = plan.map(([x]) => [x, enabled.has(x)]), key = presetName();
    const toast = globalThis.toastr?.info?.(`「${f.name}」 ${plan.length}개를 ${on ? '켰어요' : '껐어요'}.`, 'Blue Lemonade');
    attachUndo(toast, () => { if (presetName() === key) writeEnabled(before); });
}

// ───────── 메뉴 (공용 고르기 목록 팝업 · css/72) ─────────
function closeMenu() {
    if (!menu) return;
    const { layer, off } = menu; menu = null; off();
    try { if (layer.matches(':popover-open')) layer.hidePopover(); } catch { /* popover 모름 */ }
    layer.remove();
}
function openMenu(anchor, items) {
    closeMenu();
    const layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-pf-layer';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh;margin:0;padding:0;border:0;overflow:visible;max-width:none;max-height:none;background:transparent;color:inherit';
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-pf-menu" role="menu"><div class="salty-pick-rows">${items.map((item, i) => `<button type="button" role="${item.check === undefined ? 'menuitem' : 'menuitemcheckbox'}" data-i="${i}"${item.check !== undefined ? ` aria-checked="${!!item.check}" class="${item.check ? 'on' : ''}"` : ''}${item.disabled ? ' disabled' : ''}><span>${esc(item.label)}</span>${item.check !== undefined ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div></div>`;
    const box = layer.firstElementChild;
    layer.addEventListener('pointerdown', event => { if (event.target === layer) { event.preventDefault(); closeMenu(); } });
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) layer.addEventListener(type, event => event.stopPropagation());
    layer.addEventListener('click', event => {
        event.stopPropagation();
        const button = event.target.closest?.('button[data-i]');
        if (!button || button.disabled) return;
        const item = items[Number(button.dataset.i)];
        closeMenu();
        try { item?.run?.(); } catch (error) { console.warn('[Blue Lemonade] 프롬프트 폴더 메뉴', error); }
    });
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); } };
    const width = window.innerWidth;
    const resize = () => { if (window.innerWidth !== width || !anchor.isConnected) closeMenu(); else place(); };
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', resize);
    menu = { layer, off: () => { document.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize); } };
    document.body.append(layer);
    if (typeof layer.showPopover === 'function') { try { layer.setAttribute('popover', 'manual'); layer.showPopover(); } catch { layer.removeAttribute('popover'); } }
    function place() {
        const vv = window.visualViewport;
        const v = vv && vv.height > 0 ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height } : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
        box.style.width = 'max-content';
        // 높이는 테두리까지(1.0.3): 안쪽 높이만 재면 2px 모자라 세로 스크롤 칸이 생기고 그만큼 글이 「…」로 잘렸어요(메뉴 줄이 다섯일 때)
        const r = pickRect(anchor.getBoundingClientRect(), v, { w: box.offsetWidth, h: box.scrollHeight + box.offsetHeight - box.clientHeight });
        box.style.width = `${r.width}px`; box.style.left = `${r.left}px`; box.style.top = `${r.top}px`; box.style.maxHeight = `${r.maxHeight}px`;
        box.classList.toggle('up', r.up);
    }
    place();
    if (mouseDevice()) box.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
}
function openToolsMenu(anchor) {
    const list = folders();
    const anyOpen = list.some(f => f.open !== false);
    openMenu(anchor, [
        { label: '새 폴더', run: () => openEditor({ fresh: true }) },
        ...(list.length ? [{ label: '모든 폴더 고치기', run: () => openEditor() }] : []),
        { label: '구분선으로 폴더 만들기', run: autoFolders },
        ...(importable().length ? [{ label: '다른 프리셋에서 가져오기', run: () => openImportMenu(anchor) }] : []),
        ...(boxFolders().length ? [{ label: '보물상자 그룹 가져오기', run: importBoxFolders }] : []),
        ...(list.length ? [{ label: anyOpen ? '모두 접기' : '모두 펼치기', run: () => setAllOpen(!anyOpen) }, { label: '폴더 모두 풀기', run: ungroupAll }] : []),
    ]);
}
function openFolderMenu(id, anchor) {
    const list = folders(), f = list.find(x => x.id === id);
    if (!f) return;
    const order = (hostOrder() || []).map(e => e.identifier);
    const split = folderRuns(order, list).filter(run => run.folder === f).length > 1;
    // 위 · 아래로: 옮길 수 있을 때만(맨 끝 · 떨어진 폴더는 없음)
    const moves = [[-1, '위로 옮기기'], [1, '아래로 옮기기']].filter(([dir]) => moveFolderBlock(order, list, id, dir)).map(([dir, label]) => ({ label, run: () => moveFolder(id, dir) }));
    openMenu(anchor, [
        { label: '이 폴더 고치기', run: () => openEditor({ scope: id }) },
        ...(f.parent ? [] : [{ label: '안에 새 폴더', run: () => openEditor({ fresh: true, parent: id }) }]),
        { label: '하나만 켜기', check: !!f.pick, run: () => setPick(id, !f.pick) },
        ...moves,
        ...(split ? [{ label: '한곳에 모으기', run: () => gather(id) }] : []),
        { label: '폴더 풀기', run: () => ungroup(id) },
    ]);
}

// ───────── 동작 ─────────
function snapshot() { return structuredClone(bucket().folders); }
function offerUndo(before, message) {
    const key = presetName();
    const toast = globalThis.toastr?.info?.(message, 'Blue Lemonade');
    attachUndo(toast, () => {
        if (presetName() !== key) return;
        const box = store();
        const slot = box.presets[key] = { folders: before };
        save(slot); apply();
    });
}
function setPick(id, on) {
    const slot = bucket(true), f = slot.folders.find(x => x.id === id);
    if (!f) return;
    f.pick = on;
    save(slot);
    if (on) {
        const pm = manager(), order = hostOrder();
        const items = folderItems(f, slot.folders);
        const lit = (order || []).filter(e => e.enabled && items.includes(e.identifier) && counted(e.identifier));
        if (pm && lit.length > 1) {
            const keep = lit[0].identifier;
            const before = lit.map(e => e.identifier);
            writeEnabled(lit.slice(1).map(e => [e.identifier, false]));
            const keepName = shownNameById(keep), key = presetName();
            const toast = globalThis.toastr?.info?.(`「${f.name}」에서 「${keepName}」만 남기고 껐어요.`, 'Blue Lemonade');
            // 되돌리면 「하나만 켜기」도 풀어요 — 켠 줄만 되살리면 택1 지킴이가 다음 클릭에 다시 꺼요
            attachUndo(toast, () => {
                if (presetName() !== key) return;
                const now = bucket(true), g = now.folders.find(x => x.id === id);
                if (g) { g.pick = false; save(now); }
                writeEnabled(before.map(x => [x, true]));
            });
            return;
        }
    }
    apply();
}
function shownNameById(id) {
    const row = document.querySelector(`#${LIST} > ${ROW}[data-pm-identifier="${CSS.escape(id)}"]`);
    return row ? shownName(row) : String(manager()?.getPromptById?.(id)?.name || id);
}
function ungroup(id) {
    const before = snapshot();
    const slot = bucket(true), f = slot.folders.find(x => x.id === id);
    if (!f) return;
    const up = f.parent ? slot.folders.find(x => x.id === f.parent) : null;
    // 하위 폴더는 맨 위로 · 하위 폴더를 풀면 항목은 위 폴더로(1.0.2)
    slot.folders = ungroupFolder(slot.folders, id, (hostOrder() || []).map(e => e.identifier));
    store().presets[presetName()] = slot;
    save(slot); apply();
    offerUndo(before, up ? `「${f.name}」 폴더를 풀었어요. 항목은 「${up.name}」 폴더로 올라갔어요.` : `「${f.name}」 폴더를 풀었어요. 항목은 그대로예요.`);
}
async function ungroupAll() {
    const before = snapshot();
    if (!before.length) return;
    if (!await ask(`폴더 ${before.length}개를 모두 풀까요?\n항목과 순서는 그대로예요.`, { ok: '모두 풀기' })) return;
    const slot = store().presets[presetName()] = { folders: [] };
    save(slot); apply();
    offerUndo(before, `폴더 ${before.length}개를 풀었어요.`);
}
/** 실제 순서를 id 배열대로 바꿔 써요(실리태번 저장 한 번). 배열에 없는 항목은 뒤에 그대로 */
function writeOrder(ids) {
    const pm = manager(), entries = hostOrder();
    if (!pm || !entries) return;
    const byId = new Map(entries.map(e => [e.identifier, e])), want = new Set(ids);
    const next = [...ids.filter(x => byId.has(x)).map(x => byId.get(x)), ...entries.filter(e => !want.has(e.identifier))];
    lastIds = null;   // 우리가 바꾼 순서 — 「끌어 옮김」으로 보지 않아요
    pm.removePromptOrderForCharacter(pm.activeCharacter); pm.addPromptOrderForCharacter(pm.activeCharacter, next); pm.render(); pm.saveServiceSettings();
}
/** 실제 순서를 바꿔 쓰고 되돌리기 알림 — 한곳에 모으기 · 폴더째 옮기기 */
function rewriteOrder(order, next, message) {
    const ids = order.map(e => e.identifier), key = presetName();
    writeOrder(next);
    const toast = globalThis.toastr?.info?.(message, 'Blue Lemonade');
    attachUndo(toast, () => { if (presetName() === key) writeOrder(ids); });
}
function gather(id) {
    const pm = manager(), order = hostOrder();
    const f = folders().find(x => x.id === id);
    if (!pm || !order || !f) return;
    const next = gatherOrder(order.map(e => e.identifier), { ids: folderItems(f, folders()) });
    if (next) rewriteOrder(order, next, `「${f.name}」 항목을 한곳에 모았어요. 보내는 순서도 바뀌었어요.`);
}
/** 폴더째 한 칸 위 · 아래로(1.0.2) — 보이는 한 칸(폴더 밖 항목 하나, 또는 같은 단의 폴더 통째)과 자리를 바꿔요. 보내는 순서가 바뀌어요 */
function moveFolder(id, dir) {
    const pm = manager(), order = hostOrder();
    const list = folders(), f = list.find(x => x.id === id);
    if (!pm || !order || !f) return;
    const next = moveFolderBlock(order.map(e => e.identifier), list, id, dir);
    if (next) rewriteOrder(order, next, `「${f.name}」 폴더를 ${dir < 0 ? '위로' : '아래로'} 옮겼어요. 보내는 순서도 바뀌었어요.`);
}
async function autoFolders() {
    const pm = manager(), order = hostOrder();
    if (!pm || !order) return;
    const ids = order.map(e => e.identifier);
    const plans = planFromDividers(ids, id => pm.getPromptById(id));
    if (!plans.length) { globalThis.toastr?.info?.('구분선으로 쓰인 항목(내용이 비고 이름에 장식이 있는 줄)을 찾지 못했어요.', 'Blue Lemonade'); return; }
    const size = p => p.ids.length + p.children.reduce((n, c) => n + c.ids.length, 0);
    const lines = plans.slice(0, 12).map(p => `· ${p.name} (${size(p)}${p.children.length ? ` · 하위 ${p.children.length}` : ''})`).join('\n') + (plans.length > 12 ? `\n· 그 밖에 ${plans.length - 12}개` : '');
    const had = folders().length;
    if (!await ask(`폴더 ${plans.length}개를 만들어요.${had ? `\n지금 폴더 ${had}개는 풀고 새로 만들어요.` : ''}\n\n${lines}`, { ok: '만들기', title: '구분선으로 폴더 만들기' })) return;
    const before = snapshot();
    const taken = new Set();
    const fresh = () => { const id = newFolderId(taken); taken.add(id); return id; };
    const made = plans.flatMap(p => { const id = fresh(); return [{ id, name: p.name, ids: p.ids, open: false, pick: false, parent: '' }, ...p.children.map(c => ({ id: fresh(), name: c.name, ids: c.ids, open: false, pick: false, parent: id }))]; });
    store().presets[presetName()] = { folders: tidyFolders(made) };
    saveSettings(); lastIds = null; apply();
    offerUndo(before, `폴더 ${made.length}개를 만들었어요.`);
}
/** 폴더가 있는 다른 프리셋 — 같은 프리셋의 다른 판(이름에서 판 번호만 다름)을 위에, 그 안에서는 새 판부터 */
function importable() {
    const here = presetName(), stem = presetStem(here);
    return Object.entries(store().presets).filter(([key, slot]) => key !== here && Array.isArray(slot?.folders) && slot.folders.length)
        .map(([key, slot]) => ({ key, count: slot.folders.length, near: !!stem && presetStem(key) === stem }))
        .sort((a, b) => (b.near - a.near) || b.key.localeCompare(a.key, undefined, { numeric: true }));
}
function openImportMenu(anchor) {
    openMenu(anchor, importable().map(item => ({ label: `${item.key} · 폴더 ${item.count}개`, run: () => importFrom(item.key) })));
}
async function importFrom(key) {
    const pm = manager(), order = hostOrder();
    if (!pm || !order) return;
    let names = {};
    try { names = Object.fromEntries((SillyTavern.getContext().getPresetManager?.('openai')?.getCompletionPresetByName?.(key)?.prompts || []).map(p => [p.identifier, p.name || ''])); } catch { /* 프리셋이 없으면 번호로만 */ }
    const { folders: made, stats } = remapFolders(tidyFolders(store().presets[key]?.folders), names, pm.serviceSettings?.prompts || [], order.map(e => e.identifier));
    if (!made.length) { globalThis.toastr?.info?.(`「${key}」 폴더의 항목이 이 프리셋에 없어요.`, 'Blue Lemonade'); return; }
    const had = folders().length;
    const line = `같은 번호 ${stats.kept} · 같은 이름 ${stats.byName} · 없는 항목 ${stats.missing} · 새 항목을 옆 폴더에 ${stats.placed}`;
    if (!await ask(`폴더 ${made.length}개를 가져와요.${had ? `\n지금 폴더 ${had}개는 풀고 바꿔요.` : ''}\n\n${line}`, { ok: '가져오기', title: key })) return;
    const before = snapshot();
    store().presets[presetName()] = { folders: tidyFolders(made) };
    saveSettings(); lastIds = null; apply();
    offerUndo(before, `폴더 ${made.length}개를 가져왔어요.`);
}

// ───────── 폴더 창 (1.0.3 — 공용 고르기 창 틀 · css/78 + 이 기능 css) ─────────
// 한 창 두 목록: 「폴더」(넓으면 왼쪽 · 좁으면 위) = 보이는 폴더와 그 항목 — 폴더는 접는 줄, 항목은 위 · 아래 · 빼기,
//   「모든 항목」(넓으면 오른쪽 · 좁으면 아래) = 프롬프트 전부 — 누르면 고른 폴더에 넣고 빼요(다른 폴더에 있던 것은 옮겨 와요). 창 높이는 고정.
// scope 없음 = 모든 폴더(도구 줄 「모든 폴더 고치기」) · scope = 그 폴더와 안의 하위 폴더(폴더 메뉴 「이 폴더 고치기」) · fresh = 새 폴더 하나.
// 저장 전까지는 사본만 고쳐요. 바뀐 게 없으면 저장 안 함(1.0.2), 보내는 순서가 바뀌거나 「하나만 켜기」로 꺼진 항목이 있으면 되돌리기 알림.
const ICON = (act, icon, label, off = false) => `<button type="button" class="bl-pf-ib fa-solid ${icon}" data-pf-item="${act}" aria-label="${label}" title="${label}"${off ? ' disabled' : ''}></button>`;
function openEditor({ scope = '', fresh = false, parent = '', imported = null } = {}) {
    const list = document.getElementById(LIST);
    if (!list || document.querySelector('dialog.bl-pf-editor')?.open) return;
    const rows = rowsOf(list);
    const names = new Map(rows.map(row => [row.dataset.pmIdentifier, shownName(row)]));
    const order0 = rows.map(row => row.dataset.pmIdentifier);
    let order = order0.slice();
    const key = presetName(), had = Object.hasOwn(store().presets, key);
    const saved = bucket().folders, was = JSON.stringify(saved);
    const importBefore = imported ? snapshot() : null;
    const work = structuredClone(imported ? tidyFolders(imported) : saved), picked0 = new Map(work.map(f => [f.id, f.pick]));
    const byId = id => work.find(f => f.id === id) || null;
    if (fresh) {
        const f = { id: newFolderId(new Set(work.map(x => x.id))), name: '', ids: [], open: true, pick: false, parent: work.some(x => x.id === parent && !x.parent) ? parent : '' };
        work.push(f); scope = f.id;
    }
    if (scope && !byId(scope)) return;
    let target = scope || scopeFolders(work, '', order)[0]?.id || '';
    const shut = new Set();   // 창 안에서만 접은 폴더(저장 안 함)
    const present = new Set(order);
    const rank = () => new Map(order.map((x, i) => [x, i]));
    const label = f => String(f?.name || '').replace(/\s+/g, ' ').trim() || '새 폴더';

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-prompt-card-picker bl-pf-editor';
    const title = imported ? '보물상자 그룹 가져오기' : fresh ? '새 폴더' : scope ? `「${label(byId(scope))}」 고치기` : '모든 폴더 고치기';
    dialog.setAttribute('aria-label', title);
    dialog.innerHTML = `<header><h3>${esc(title)}</h3><button type="button" data-card-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>`
        + '<div class="bl-pf-fields"><input type="text" data-pf-name maxlength="40" placeholder="폴더 이름" aria-label="폴더 이름" autocomplete="off">'
        + '<label class="bl-pf-pick"><input type="checkbox" data-pf-pick><span>하나만 켜기</span></label></div>'
        + '<label class="bl-pf-place"><span>넣을 곳</span><select data-pf-parent aria-label="넣을 곳"></select></label>'
        + '<div class="bl-pf-body"><section class="bl-pf-pane" aria-label="폴더"><div class="bl-prompt-card-list bl-pf-left"></div></section>'
        + '<section class="bl-pf-pane" aria-label="모든 항목"><input type="search" data-card-search placeholder="모든 항목에서 찾기" aria-label="모든 항목에서 찾기" autocomplete="off"><div class="bl-prompt-card-list bl-pf-right" aria-label="모든 항목"></div></section></div>'
        + '<footer><small role="status" aria-live="polite"></small><span class="bl-prompt-card-actions"><button type="button" data-pf-translate hidden>이름 한국어로</button><button type="button" data-card-clear>취소</button><button type="button" data-card-done>저장</button></span></footer>';
    const $ = sel => dialog.querySelector(sel);
    const name = $('[data-pf-name]'), pick = $('[data-pf-pick]'), place = $('.bl-pf-place'), parentField = $('[data-pf-parent]');
    const left = $('.bl-pf-left'), right = $('.bl-pf-right'), search = $('[data-card-search]'), status = $('[role="status"]'), done = $('[data-card-done]');
    const translate = $('[data-pf-translate]'); let translating = false;
    const fold = text => String(text || '').normalize('NFKC').toLocaleLowerCase();

    // 고른 폴더의 칸: 이름 · 하나만 켜기 · 넣을 곳(맨 위 폴더만 위 폴더가 될 수 있어요 — 2단까지. 「이 폴더 고치기」에서는 그 폴더만 옮길 수 있어요)
    function drawFields() {
        const f = byId(target);
        name.disabled = pick.disabled = !f;
        name.value = f?.name || ''; pick.checked = !!f?.pick;
        const tops = work.filter(x => !x.parent && x.id !== target);
        const can = !!f && tops.length && !work.some(x => x.parent === f.id) && (!scope || f.id === scope);
        place.hidden = !can;
        if (can) parentField.innerHTML = `<option value="">맨 위</option>${tops.map(x => `<option value="${esc(x.id)}"${x.id === f.parent ? ' selected' : ''}>${esc(label(x))}</option>`).join('')}`;
    }
    function drawLeft() {
        const top = left.scrollTop, shown = scopeFolders(work, scope, order), ids = new Set(shown.map(f => f.id)), r = rank();
        const fragment = document.createDocumentFragment();
        const section = (f, depth) => {
            const items = f.ids.filter(x => present.has(x)).sort((a, b) => r.get(a) - r.get(b));
            const kids = shown.filter(c => c.parent === f.id), open = !shut.has(f.id);
            const head = document.createElement('button');
            head.type = 'button'; head.className = `bl-pf-sec${depth ? ' bl-pf-d1' : ''}`; head.dataset.pfSec = f.id;
            head.setAttribute('aria-expanded', String(open));
            if (f.id === target) head.setAttribute('aria-current', 'true');
            head.innerHTML = `<i class="fa-solid ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" aria-hidden="true"></i><b>${esc(label(f))}</b><small>${folderItems(f, work).filter(x => present.has(x) && counted(x)).length}${f.pick ? ' · 택1' : ''}</small>`;   // 목록 머리 줄과 같은 수(하위까지 · 구분선 빼고)
            fragment.append(head);
            if (!open) return;
            items.forEach((x, i) => {
                const row = document.createElement('div');
                row.className = `bl-pf-item${depth ? ' bl-pf-d1' : ''}`; row.dataset.id = x; row.dataset.folder = f.id;
                const nm = names.get(x) || x;
                // 구분선 이름(━ ◆ 문체 ◆ ━ 같은 선 · 도형 글자)은 꺾이면 선이 두 줄로 갈라져 보여요 → 한 줄 · 넘치면 … (이름 전체는 title)
                const rule = /[─-╿■-◿]/.test(nm) ? ' class="bl-pf-rule"' : '';
                row.innerHTML = `<span${rule} title="${esc(nm)}">${esc(nm)}</span>${ICON('up', 'fa-arrow-up', '위로', i === 0)}${ICON('down', 'fa-arrow-down', '아래로', i === items.length - 1)}${ICON('out', 'fa-xmark', '폴더에서 빼기')}`;
                fragment.append(row);
            });
            if (!items.length && !kids.length) { const empty = document.createElement('p'); empty.textContent = '비어 있어요. 「모든 항목」에서 눌러 더해요.'; fragment.append(empty); }
            for (const c of kids) section(c, depth + 1);
        };
        for (const f of shown) if (!f.parent || !ids.has(f.parent)) section(f, 0);
        // 새 폴더: 모든 폴더 창이면 맨 위에, 맨 위 폴더 하나 창이면 그 안에(하위 폴더 창 · 새 폴더 창에는 없음)
        const host = scope ? byId(scope) : null;
        if (!fresh && (!scope || (host && !host.parent)) && work.length < LIMITS.folders) {
            const add = document.createElement('button');
            add.type = 'button'; add.className = 'bl-prompt-card-more bl-pf-add'; add.dataset.pfAdd = scope;
            add.innerHTML = `<i class="fa-solid fa-plus" aria-hidden="true"></i><span>${scope ? '안에 새 폴더' : '새 폴더'}</span>`;
            fragment.append(add);
        }
        left.replaceChildren(fragment);
        left.scrollTop = top;
    }
    function drawRight() {
        const top = right.scrollTop, words = fold(search.value).trim().split(/\s+/).filter(Boolean);
        const f = byId(target), mine = new Set(f?.ids || []), owner = folderIndex(work);
        const fragment = document.createDocumentFragment();
        for (const x of order) {
            const text = names.get(x) || x;
            if (words.length && !words.every(w => fold(text).includes(w))) continue;
            const row = document.createElement('button');
            row.type = 'button'; row.className = 'bl-prompt-card-choice'; row.dataset.id = x;
            row.setAttribute('aria-pressed', String(mine.has(x)));
            const copy = document.createElement('span'), b = document.createElement('b');
            b.textContent = text; copy.append(b);
            const other = owner.get(x);
            if (other && other !== f) { const small = document.createElement('small'); small.textContent = `지금 「${label(other)}」 폴더`; copy.append(small); }
            const check = document.createElement('i'); check.className = 'fa-solid fa-check'; check.setAttribute('aria-hidden', 'true'); check.hidden = !mine.has(x);
            row.append(copy, check);
            fragment.append(row);
        }
        if (!fragment.childNodes.length) { const empty = document.createElement('p'); empty.textContent = order.length ? '찾는 프롬프트가 없어요.' : '프롬프트가 없어요.'; fragment.append(empty); }
        right.replaceChildren(fragment);
        right.scrollTop = top;
    }
    function count() {
        // 「모든 항목」에서 누르면 어디로 가는지
        const f = byId(target), n = f ? f.ids.filter(x => present.has(x)).length : 0;
        status.textContent = (imported ? `폴더 ${work.length}개를 확인한 뒤 저장해요. ` : '') + (f ? `「${label(f)}」에 넣어요` : '폴더가 없어요');
        translate.hidden = !translating && !planFolderNames(scopeFolders(work, scope, order)).names.length;
        translate.disabled = translating;
        dialog.classList.toggle('bl-pf-has-translate', !translate.hidden);
        done.disabled = translating || (fresh && !n);
    }
    const draw = () => { drawLeft(); drawRight(); count(); };
    // 목록 칸 안에서만 스크롤해서 보여 줘요(창 · 화면은 그대로): 고른 폴더 줄은 위에, 「모든 항목」은 그 폴더 첫 항목을 가운데로
    const reveal = (box, el, middle) => {
        if (!el) return;
        const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
        if (!middle && r.top >= b.top && r.bottom <= b.bottom) return;
        box.scrollTop = Math.max(0, box.scrollTop + r.top - b.top - (middle ? box.clientHeight / 2 : 6));
    };
    const choose = id => {
        target = id; shut.delete(id); drawFields(); draw();
        reveal(left, left.querySelector('[aria-current="true"]'));
        reveal(right, right.querySelector('[aria-pressed="true"]'), true);
    };

    left.addEventListener('click', event => {
        const sec = event.target.closest?.('[data-pf-sec]');
        if (sec) {
            const id = sec.dataset.pfSec;
            if (id !== target) return choose(id);
            if (shut.has(id)) shut.delete(id); else shut.add(id);
            return drawLeft();
        }
        const add = event.target.closest?.('[data-pf-add]');
        if (add) {
            const f = { id: newFolderId(new Set(work.map(x => x.id))), name: '', ids: [], open: true, pick: false, parent: add.dataset.pfAdd || '' };
            work.push(f); choose(f.id);
            if (mouseDevice()) name.focus();
            return;
        }
        const button = event.target.closest?.('[data-pf-item]');
        const row = button?.closest('.bl-pf-item'), f = byId(row?.dataset.folder);
        if (!button || button.disabled || !f) return;
        const x = row.dataset.id, act = button.dataset.pfItem;
        if (act === 'out') f.ids = f.ids.filter(y => y !== x);
        else { const next = shiftInFolder(order, f, x, act === 'up' ? -1 : 1); if (!next) return; order = next; }
        if (f.id !== target) { target = f.id; drawFields(); }
        draw();
        // 옮긴 항목의 같은 단추에 초점을 남겨요(키보드로 여러 칸 옮길 때)
        if (act !== 'out') left.querySelector(`.bl-pf-item[data-id="${CSS.escape(x)}"] [data-pf-item="${act}"]:not([disabled])`)?.focus({ preventScroll: false });
    });
    let lastId = '';
    right.addEventListener('click', event => {
        const row = event.target.closest?.('.bl-prompt-card-choice'), f = byId(target);
        if (!row || !f) return;
        const x = row.dataset.id, on = !f.ids.includes(x);
        // Shift+클릭: 지난번 누른 줄부터 이 줄까지 같은 상태로(보이는 줄만)
        const seen = [...right.querySelectorAll('.bl-prompt-card-choice')].map(el => el.dataset.id), from = seen.indexOf(lastId), to = seen.indexOf(x);
        const range = event.shiftKey && from >= 0 ? seen.slice(Math.min(from, to), Math.max(from, to) + 1) : [x];
        if (on) assignIds(work, f, [...f.ids, ...range], order); else f.ids = f.ids.filter(y => !range.includes(y));
        lastId = x;
        draw();
    });
    name.addEventListener('input', () => { const f = byId(target); if (f) { f.name = name.value; drawLeft(); count(); } });
    pick.addEventListener('change', () => { const f = byId(target); if (f) { f.pick = pick.checked; drawLeft(); } });
    parentField.addEventListener('change', () => { const f = byId(target); if (f) { f.parent = parentField.value; drawLeft(); } });
    search.addEventListener('input', () => { right.scrollTop = 0; lastId = ''; drawRight(); });
    translate.addEventListener('click', async () => {
        if (translating) return;
        const plan = planFolderNames(scopeFolders(work, scope, order));
        if (!plan.names.length) return;
        translating = true; count();
        status.textContent = `폴더 이름 ${plan.names.length}개를 한글화 패널의 연결로 번역하고 있어요.`;
        let message = '';
        try {
            const { waitAddonModule } = await import('./addons.js');
            const panel = await waitAddonModule('prompt');
            if (!dialog.isConnected) return;
            if (presetName() !== key) throw Error('프리셋이 바뀌어서 적용하지 않았어요. 편집창을 다시 열어 주세요');
            if (typeof panel?.translateFolderLabels !== 'function') throw Error('한글화 패널을 켜고 번역 연결을 설정해 주세요');
            const names = await panel.translateFolderLabels(plan.names);
            if (!dialog.isConnected) return;
            if (presetName() !== key) throw Error('프리셋이 바뀌어서 적용하지 않았어요. 편집창을 다시 열어 주세요');
            const changed = applyFolderNamePlan(work, plan, names);
            message = `이름 ${changed}개를 바꿨어요. 확인한 뒤 저장해 주세요.`;
        } catch (error) { message = error?.message || '이름을 번역하지 못했어요'; }
        finally { translating = false; if (dialog.isConnected) { drawFields(); draw(); status.textContent = message; } }
    });
    $('[data-card-close]').addEventListener('click', () => dialog.close());
    $('[data-card-clear]').addEventListener('click', () => dialog.close());
    done.addEventListener('click', () => {
        if (translating) return;
        if (presetName() !== key) { globalThis.toastr?.info?.('프리셋이 바뀌어서 저장하지 않았어요. 편집창을 다시 열어 주세요.'); dialog.close(); return; }
        const f0 = byId(target);
        if (f0 && !name.disabled) f0.name = name.value;   // 입력 이벤트 없이 바뀐 값(붙여넣기 · 자동 완성)도
        if (fresh && !f0?.ids.some(x => present.has(x))) return;
        const r = rank();
        work.forEach((f, i) => {
            f.name = String(f.name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || `폴더 ${i + 1}`;
            f.ids.sort((a, b) => (r.get(a) ?? 1e9) - (r.get(b) ?? 1e9));
        });
        if (fresh && f0?.parent) for (const up of work) if (up.id === f0.parent) up.open = true;
        const next = dropEmpty(tidyFolders(work));
        const moved = order.some((x, i) => x !== order0[i]), changed = JSON.stringify(next) !== was;
        // 「하나만 켜기」를 새로 켠 폴더에 켜진 항목이 둘 이상이면 실제 순서 첫 항목만 남겨요(메뉴 「하나만 켜기」와 같은 규칙)
        const lit = new Set((hostOrder() || []).filter(e => e.enabled).map(e => e.identifier)), offs = [];
        for (const f of next) if (f.pick && !picked0.get(f.id)) { const items = new Set(folderItems(f, next).filter(counted)); offs.push(...order.filter(x => items.has(x) && lit.has(x)).slice(1)); }
        if (!changed && !moved) {
            if (!had) delete store().presets[key];
            dialog.close();
            return;
        }
        const before = structuredClone(saved);
        if (changed) { const slot = store().presets[key] = { folders: next }; save(slot); }
        if (moved) writeOrder(order);
        if (offs.length) writeEnabled(offs.map(x => [x, false]));
        dialog.close(); apply();
        if (!moved && !offs.length) { if (importBefore) offerUndo(importBefore, `폴더 ${next.length}개를 가져왔어요.`); return; }
        const message = ['폴더를 고쳤어요.', moved ? '보내는 순서도 바뀌었어요.' : '', offs.length ? `하나만 켜기로 ${offs.length}개를 껐어요.` : ''].filter(Boolean).join(' ');
        const toast = globalThis.toastr?.info?.(message, 'Blue Lemonade');
        attachUndo(toast, () => {
            if (presetName() !== key) return;
            const slot = store().presets[key] = { folders: before };
            save(slot);
            if (moved) writeOrder(order0);
            if (offs.length) writeEnabled(offs.map(x => [x, true]));
            apply();
        });
    });
    let backdrop = false;
    const outside = e => { const b = dialog.getBoundingClientRect(); return e.target === dialog && (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom); };
    dialog.addEventListener('pointerdown', e => { backdrop = outside(e); });
    dialog.addEventListener('click', e => { if (backdrop && outside(e)) dialog.close(); backdrop = false; });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    drawFields(); draw();
    document.body.append(dialog);
    showThemeModal(dialog);
    // 「모든 항목」은 고른 폴더의 첫 항목이 보이게(목록이 길면 고른 줄이 아래에 있어요) — 창 밖은 스크롤하지 않아요
    reveal(right, right.querySelector('[aria-pressed="true"]'), true);
    if (mouseDevice()) name.focus({ preventScroll: true });
}

// ───────── 켜고 끄기 ─────────
function ensureCss() {
    if (document.getElementById('bl-prompt-folders-style')) return;
    const link = document.createElement('link');
    link.id = 'bl-prompt-folders-style'; link.rel = 'stylesheet';
    link.href = new URL('./prompt-folders.css', import.meta.url).href;
    (document.head || document.documentElement).append(link);
}
// 내가 끼운 머리 줄 · 도구 단추만 바뀐 기록은 버려요(되먹임 없음)
const ownNode = node => node.nodeType !== 1 || !!node.classList?.contains('bl-pf-head') || !!node.classList?.contains('bl-pf-tools');
const ownRecord = record => [...record.addedNodes, ...record.removedNodes].every(ownNode);
function watchList() {
    if (unwatch) return;
    const host = document.getElementById(CONTAINER);
    if (host) {
        unfind?.(); unfind = null;
        unwatch = watchDom(host, { childList: true, subtree: true, when: 'frame', skip: ownRecord, name: '프롬프트 폴더' }, () => apply());
        apply();
        return;
    }
    // 프롬프트 관리자가 아직 없으면(다른 API · 이른 시점) 생길 때 붙어요
    unfind ??= watchDom(document.body, { childList: true, subtree: true, exclude: '#chat', when: 'frame', name: '프롬프트 폴더 찾기' }, () => { if (document.getElementById(CONTAINER)) watchList(); });
}
function onPreset() { lastIds = null; schedule(); }
let presetBound = false;
export async function syncPromptFolders(on) {
    wanted = !!on;
    if (!wanted) {
        unwatch?.(); unwatch = null; unfind?.(); unfind = null;
        cancelAnimationFrame(frame); frame = 0;
        closeMenu();
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKey, true);
        setFolderSource(null);
        const list = document.getElementById(LIST);
        if (list) cleanup(list);
        document.querySelector(`#${CONTAINER} .bl-pf-tools`)?.remove();
        document.getElementById('bl-prompt-folders-style')?.remove();
        lastIds = null;
        return;
    }
    try {
        loading ??= import('../../../../openai.js');
        api = await loading;
    } catch (error) {
        loading = null;
        console.warn('[Blue Lemonade] 프롬프트 폴더 — 프롬프트 관리자를 불러오지 못했어요', error);
        return;
    }
    if (!wanted) return;
    ensureCss();
    setFolderSource(choiceFolders);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    if (!presetBound) {
        presetBound = true;
        try { const { eventSource, event_types } = SillyTavern.getContext(); if (event_types?.OAI_PRESET_CHANGED_AFTER) eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, () => { if (wanted) onPreset(); }); } catch { /* 이벤트 없음 */ }
    }
    watchList();
}

/** 시험용 */
export const _forTest = { apply, refold, headMarkup, setApi(next) { api = next; }, setWanted(v) { wanted = v; }, reset() { lastIds = null; lastPreset = null; } };
