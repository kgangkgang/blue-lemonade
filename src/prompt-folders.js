// 프롬프트 폴더 (1.0.1) — 프롬프트 관리자 목록의 항목을 폴더로 묶어 접고 펼쳐요.
// 계산은 prompt-folders-core.js(순수). 여기는 화면 · 저장 · 실리태번 연결만.
//
// 줄은 옮기지도 복제하지도 않아요: 실제 순서에서 같은 폴더 항목이 이어지는 구간마다 머리 줄(li.bl-pf-head) 하나를 그 구간 앞에 끼우고,
//   항목 줄에는 클래스만(bl-pf-in · bl-pf-hide · bl-pf-alt) 붙여요. 머리 줄에는 data-pm-identifier 가 없어 실리태번 끌기 저장(toArray)에 안 섞여요.
// 끌어 옮긴 줄의 소속은 놓인 자리로(core adoptMove). 하나만 켜기는 택1 묶음(prompt-choice)에 더해서 같은 규칙으로.
// 모양: src/prompt-folders.css(이 기능이 켜질 때만 받음) + css/27-compact.css 의 프롬프트 켜기 동그라미(.bl-pf-all 을 같은 규칙에).
// 같은 일을 하는 다른 확장(PromptFolders · 「프롬프트 그룹」)이 켜져 있으면 features.js 가 이 기능을 쉬게 해요(ext-presence.js).
// 프리셋 파일의 extensions.blPromptFolders 는 읽기만 해요: 내 폴더가 없는 프리셋의 초깃값이고, 고치면 테마 설정이 우선이에요. 테마가 프리셋 파일에 쓰지는 않아요(tools/preset-folders.mjs 가 넣어요).
import { getSettings, saveSettings } from './settings.js';
import { watchDom } from './dom-watch.js';
import { groupedNumber } from './numbers.js';
import { pickRect } from './selects.js';
import { ask, attachUndo } from './ask.js';
import { showThemeModal } from './modal.js';
import { mouseDevice } from './prompt-card-picker.js';
import { promptChoiceGroups, withFolderChoices } from './prompt-choice-core.js';
import { setFolderSource } from './prompt-choice.js';
import { tidyFolders, newFolderId, folderRuns, detectMove, adoptMove, assignIds, gatherOrder, runStats, planToggleAll, planFromDividers, isDivider, folderItems, dropEmpty, remapFolders, presetStem, readPresetFolders } from './prompt-folders-core.js';

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
        head.className = `bl-pf-head${open ? '' : ' bl-pf-closed'}${run.depth ? ' bl-pf-sub' : ''}${shut ? ' bl-pf-hide' : ''}`;
        head.dataset.pfId = run.folder.id;
        head.dataset.pfPart = String(run.part);
        head.innerHTML = headMarkup(run, totals.get(run.folder));
        rows[run.start].before(head);
        for (let i = run.start; i <= run.end; i++) rows[i].classList.add(run.depth ? 'bl-pf-in2' : 'bl-pf-in');
        if (!open) for (let i = run.start; i <= run.end; i++) rows[i].classList.add('bl-pf-hide');
    }
    // 한 줄 걸러 톤: 머리 · 숨긴 줄 때문에 nth-child 짝이 어긋나 보이는 줄만 다시 매겨요(css 가 bl-pf-on 일 때 nth-child 톤을 끔)
    let n = 0;
    for (const el of list.children) {
        if (el.classList.contains('bl-pf-head')) { n = 0; continue; }
        if (!el.matches(ROW) || el.classList.contains('bl-pf-hide')) continue;
        if (n++ % 2 === 1) el.classList.add('bl-pf-alt');
    }
    note(t0, rows.length, runs.length);
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
    const before = footer.querySelector(':scope > #prompt-manager-import');
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
    save(slot); apply();
}
function setAllOpen(open) {
    const slot = bucket(true);
    for (const f of slot.folders) f.open = open;
    save(slot); apply();
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
    if (plan?.length) writeEnabled(plan);
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
        const r = pickRect(anchor.getBoundingClientRect(), v, { w: box.offsetWidth, h: box.scrollHeight });
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
        { label: '새 폴더', run: () => openEditor(null) },
        { label: '구분선으로 폴더 만들기', run: autoFolders },
        ...(importable().length ? [{ label: '다른 프리셋에서 가져오기', run: () => openImportMenu(anchor) }] : []),
        ...(list.length ? [{ label: anyOpen ? '모두 접기' : '모두 펼치기', run: () => setAllOpen(!anyOpen) }, { label: '폴더 모두 풀기', run: ungroupAll }] : []),
    ]);
}
function openFolderMenu(id, anchor) {
    const list = folders(), f = list.find(x => x.id === id);
    if (!f) return;
    const order = (hostOrder() || []).map(e => e.identifier);
    const split = folderRuns(order, list).filter(run => run.folder === f).length > 1;
    openMenu(anchor, [
        { label: '이름 · 항목 고치기', run: () => openEditor(id) },
        ...(f.parent ? [] : [{ label: '안에 새 폴더', run: () => openEditor(null, id) }]),
        { label: '하나만 켜기', check: !!f.pick, run: () => setPick(id, !f.pick) },
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
            const keepName = shownNameById(keep);
            const toast = globalThis.toastr?.info?.(`「${f.name}」에서 「${keepName}」만 남기고 껐어요.`, 'Blue Lemonade');
            attachUndo(toast, () => writeEnabled(before.map(x => [x, true])));
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
    slot.folders = slot.folders.filter(x => x !== f);
    for (const child of slot.folders) if (child.parent === f.id) child.parent = '';   // 하위 폴더는 맨 위로
    store().presets[presetName()] = slot;
    save(slot); apply();
    offerUndo(before, `「${f.name}」 폴더를 풀었어요. 항목은 그대로예요.`);
}
async function ungroupAll() {
    const before = snapshot();
    if (!before.length) return;
    if (!await ask(`폴더 ${before.length}개를 모두 풀까요?\n항목과 순서는 그대로예요.`, { ok: '모두 풀기' })) return;
    const slot = store().presets[presetName()] = { folders: [] };
    save(slot); apply();
    offerUndo(before, `폴더 ${before.length}개를 풀었어요.`);
}
function gather(id) {
    const pm = manager(), order = hostOrder();
    const f = folders().find(x => x.id === id);
    if (!pm || !order || !f) return;
    const ids = order.map(e => e.identifier);
    const next = gatherOrder(ids, { ids: folderItems(f, folders()) });
    if (!next) return;
    const byId = new Map(order.map(e => [e.identifier, e]));
    const write = list => { pm.removePromptOrderForCharacter(pm.activeCharacter); pm.addPromptOrderForCharacter(pm.activeCharacter, list.map(x => byId.get(x))); pm.render(); pm.saveServiceSettings(); };
    write(next);
    lastIds = null;   // 우리가 바꾼 순서 — 「끌어 옮김」으로 보지 않아요
    const toast = globalThis.toastr?.info?.(`「${f.name}」 항목을 한곳에 모았어요. 보내는 순서도 바뀌었어요.`, 'Blue Lemonade');
    attachUndo(toast, () => { lastIds = null; write(ids); });
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

// ───────── 편집 창 (공용 고르기 창 틀 · css/78 + 이 기능 css) ─────────
function openEditor(id, parentId = '') {
    const list = document.getElementById(LIST);
    if (!list) return;
    const old = document.querySelector('dialog.bl-pf-editor');
    if (old?.open) return;
    const rows = rowsOf(list);
    const items = rows.map(row => ({ id: row.dataset.pmIdentifier, name: shownName(row) }));
    const order = items.map(x => x.id);
    const current = id ? folders().find(f => f.id === id) : null;
    const present = new Set(order);
    const chosen = new Set((current ? current.ids : []).filter(x => present.has(x)));   // 이 프리셋에 없는 항목은 세지 않고 그대로 둬요
    const absent = (current ? current.ids : []).filter(x => !present.has(x));
    // 넣을 곳: 맨 위 폴더만 고를 수 있어요(2단까지). 하위 폴더가 있는 폴더는 맨 위에 남아요
    const tops = folders().filter(f => !f.parent && f.id !== id);
    const place = current ? current.parent : parentId;
    const canPlace = tops.length && !(current && folders().some(f => f.parent === id));
    const owner = new Map();
    for (const f of folders()) if (f.id !== id) for (const x of f.ids) owner.set(x, f.name);
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-prompt-card-picker bl-pf-editor';
    dialog.setAttribute('aria-label', current ? '폴더 고치기' : '새 폴더');
    dialog.innerHTML = `<header><h3>${current ? '폴더 고치기' : '새 폴더'}</h3><button type="button" data-card-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>`
        + `<input type="text" data-pf-name maxlength="40" placeholder="폴더 이름" aria-label="폴더 이름" autocomplete="off" value="${esc(current?.name || '')}">`
        + (canPlace ? `<label class="bl-pf-place"><span>넣을 곳</span><select data-pf-parent aria-label="넣을 곳"><option value="">맨 위</option>${tops.map(f => `<option value="${esc(f.id)}"${f.id === place ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>` : '')
        + `<input type="search" data-card-search placeholder="프롬프트 찾기" aria-label="프롬프트 찾기" autocomplete="off">`
        + '<div class="bl-prompt-card-list" aria-label="프롬프트 목록"></div>'
        + '<footer><small role="status" aria-live="polite"></small><span class="bl-prompt-card-actions"><button type="button" data-card-clear>취소</button><button type="button" data-card-done>저장</button></span></footer>';
    const name = dialog.querySelector('[data-pf-name]'), search = dialog.querySelector('[data-card-search]');
    const box = dialog.querySelector('.bl-prompt-card-list'), status = dialog.querySelector('[role="status"]'), done = dialog.querySelector('[data-card-done]');
    const fold = text => String(text || '').normalize('NFKC').toLocaleLowerCase();
    function render() {
        const words = fold(search.value).trim().split(/\s+/).filter(Boolean);
        const fragment = document.createDocumentFragment();
        for (const item of items) {
            if (words.length && !words.every(w => fold(item.name).includes(w))) continue;
            const row = document.createElement('button');
            row.type = 'button'; row.className = 'bl-prompt-card-choice'; row.dataset.id = item.id;
            row.setAttribute('aria-pressed', String(chosen.has(item.id)));
            const copy = document.createElement('span'), title = document.createElement('b');
            title.textContent = item.name; copy.append(title);
            if (owner.has(item.id)) { const small = document.createElement('small'); small.textContent = `지금 「${owner.get(item.id)}」 폴더`; copy.append(small); }
            const check = document.createElement('i'); check.className = 'fa-solid fa-check'; check.setAttribute('aria-hidden', 'true'); check.hidden = !chosen.has(item.id);
            row.append(copy, check);
            fragment.append(row);
        }
        if (!fragment.childNodes.length) { const empty = document.createElement('p'); empty.textContent = items.length ? '찾는 프롬프트가 없어요.' : '프롬프트가 없어요.'; fragment.append(empty); }
        box.replaceChildren(fragment);
        count();
    }
    function count() { status.textContent = `${chosen.size}개 골랐어요`; done.disabled = !chosen.size; }
    const mark = row => {
        const on = chosen.has(row.dataset.id);
        row.setAttribute('aria-pressed', String(on));
        row.querySelector('i').hidden = !on;
    };
    let lastRow = null;
    box.addEventListener('click', event => {
        const row = event.target.closest?.('.bl-prompt-card-choice');
        if (!row) return;
        const x = row.dataset.id, on = !chosen.has(x);
        // Shift+클릭: 지난번 누른 줄부터 이 줄까지 같은 상태로
        const rows = [...box.querySelectorAll('.bl-prompt-card-choice')], from = rows.indexOf(lastRow), to = rows.indexOf(row);
        const range = event.shiftKey && from >= 0 ? rows.slice(Math.min(from, to), Math.max(from, to) + 1) : [row];
        for (const item of range) { if (on) chosen.add(item.dataset.id); else chosen.delete(item.dataset.id); mark(item); }
        lastRow = row;
        count();
    });
    search.addEventListener('input', () => { box.scrollTop = 0; lastRow = null; render(); });
    dialog.querySelector('[data-card-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-card-clear]').addEventListener('click', () => dialog.close());
    done.addEventListener('click', () => {
        if (!chosen.size) return;
        const slot = bucket(true);
        let f = id ? slot.folders.find(x => x.id === id) : null;
        if (!f) {
            f = { id: newFolderId(new Set(slot.folders.map(x => x.id))), name: '', ids: [], open: true, pick: false, parent: parentId };
            slot.folders.push(f);
        }
        const parentField = dialog.querySelector('[data-pf-parent]');
        if (parentField) f.parent = parentField.value;
        for (const up of slot.folders) if (up.id === f.parent) up.open = true;
        f.name = String(name.value || '').replace(/\s+/g, ' ').trim().slice(0, 40) || `폴더 ${slot.folders.length}`;
        assignIds(slot.folders, f, [...chosen, ...absent], order);
        slot.folders = dropEmpty(slot.folders);
        store().presets[presetName()] = slot;
        save(slot); dialog.close(); apply();
    });
    let backdrop = false;
    const outside = e => { const r = dialog.getBoundingClientRect(); return e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
    dialog.addEventListener('pointerdown', e => { backdrop = outside(e); });
    dialog.addEventListener('click', e => { if (backdrop && outside(e)) dialog.close(); backdrop = false; });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    render();
    document.body.append(dialog);
    showThemeModal(dialog);
    // 고친 폴더의 첫 항목이 보이게(목록이 길면 고른 줄이 화면 아래에 있었어요)
    box.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'center' });
    if (mouseDevice()) name.focus();
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
export const _forTest = { apply, headMarkup, setApi(next) { api = next; }, setWanted(v) { wanted = v; }, reset() { lastIds = null; lastPreset = null; } };
