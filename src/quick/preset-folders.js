// 프리셋 고르기 목록 폴더 (1.0.3, 기본 꺼짐) — 채팅 완성 프리셋 고르기 칸(#settings_preset_openai)을 누르면 폴더로 묶인 목록이 떠요.
// 1.0.2 「프롬프트 폴더」는 프리셋 *안의 항목* 폴더이고, 이것은 프리셋 *목록 자체*의 폴더예요. 프리셋이 많을 때 드롭다운이 길어지던 것.
// 목록 모양은 공용 고르기 목록 팝업(.salty-pick · css/72)과 같아요: 폴더 머리(누르면 접고 펼침 · ⋯ 메뉴) → 그 안 프리셋 → 폴더 밖 프리셋 · 맨 아래 「새 폴더」.
//   지금 프리셋이 든 폴더는 펼쳐서 열어요. 프리셋이 많으면 찾기 칸(폴더 이름도 함께 보여 줌).
// 고르면 실리태번 칸의 값을 바꾸고 input · change 를 쏴요 — 실리태번 프리셋 바꾸기(onSettingsPresetChange)가 그대로 돌아요. 칸 자체 · 프리셋 파일은 건드리지 않아요.
// 폴더 ⋯ 메뉴: 이름 · 프리셋 고르기(창) · 앞 · 뒤로 · 폴더 지우기(프리셋은 폴더 밖으로 — 물어요). 폴더 순서 = 목록 순서, 폴더 안 차례 = 넣은 차례.
// 프리셋 파일을 여러 개 지우는 일은 하지 않아요(실리태번 프리셋 지우기 단추가 하나씩 물으며 해요 — 되돌릴 수 없는 일이라).
// 비용: 켤 때만 받는 모듈. 리스너는 창(window)의 누름 · 키 갈고리 몇 개(그 칸일 때만 일함). 목록을 연 동안에만 바깥 누름 · Esc · 창 크기를 들어요.
import { getSettings, saveSettings } from '../settings.js';
import { pickRect } from '../selects.js';
import { showThemeModal } from '../modal.js';
import { ask } from '../ask.js';
import { splitCssReady } from '../lite.js';
import { esc, ensureQuickCss, openMenu, closeMenu } from './shared.js';
import { tidyFolders, newFolderId, groupPresets, searchPresets, assignPresets, moveFolder, removeFolder, folderOf, MAX_FOLDERS, MAX_NAME } from './preset-list-core.js';

const SELECT = 'settings_preset_openai';
const SEARCH_FROM = 12;
const GRACE = 700;
let wanted = false, bound = false, layer = null, off = null, touch = null, openedAt = 0;

const select = () => document.getElementById(SELECT);
const isOurs = target => target instanceof Element && target.id === SELECT && wanted && document.body.classList.contains('salty');
const names = sel => [...(sel?.options || [])].filter(o => !o.hidden).map(o => o.text);
function store() {
    const s = getSettings();
    if (!s.presetFolders || typeof s.presetFolders !== 'object' || Array.isArray(s.presetFolders)) s.presetFolders = { on: true, folders: [] };
    return s.presetFolders;
}
const folders = () => tidyFolders(store().folders);
function writeFolders(list) { store().folders = tidyFolders(list); saveSettings(); }

// ───────── 목록 팝업 ─────────
function close() {
    off?.(); off = null;
    if (!layer) return;
    try { if (layer.matches(':popover-open')) layer.hidePopover(); } catch { /* popover 모름 */ }
    layer.remove(); layer = null;
    closeMenu();
}
function row(name, current, depth, small = '') {
    const on = name === current;
    return `<button type="button" role="option" data-v="${esc(name)}" aria-selected="${on}" class="bl-pfo-item${on ? ' on' : ''}"${depth ? ' data-depth="1"' : ''}><span>${esc(name)}${small ? `<small>${esc(small)}</small>` : ''}</span><i aria-hidden="true"></i></button>`;
}
function rowsHtml(sel, query = '') {
    const list = names(sel), current = sel.selectedOptions?.[0]?.text ?? sel.options[sel.selectedIndex]?.text ?? '', all = folders();
    if (query.trim()) {
        const found = searchPresets(list, all, query);
        return found.length ? found.map(x => row(x.name, current, 0, x.folder)).join('') : '<div class="salty-pick-empty">찾는 프리셋이 없어요</div>';
    }
    const { groups, loose } = groupPresets(list, all);
    const here = folderOf(all, current);
    const out = [];
    for (const { folder, items } of groups) {
        const open = folder.open || folder.id === here;
        out.push(`<div class="bl-pfo-head${open ? '' : ' closed'}" data-f="${esc(folder.id)}"><button type="button" class="bl-pfo-fold" data-pfo="fold" aria-expanded="${open}"><i class="fa-solid ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" aria-hidden="true"></i><span>${esc(folder.name)}</span><small>${items.length}</small></button><button type="button" class="bl-pfo-more" data-pfo="menu" aria-label="「${esc(folder.name)}」 폴더 메뉴"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button></div>`);
        if (open) for (const name of items) out.push(row(name, current, 1));
    }
    if (groups.length && loose.length) out.push('<div class="salty-pick-group">폴더 밖</div>');
    for (const name of loose) out.push(row(name, current, 0));
    out.push(`<button type="button" class="bl-pfo-new" data-pfo="new"${all.length >= MAX_FOLDERS ? ' disabled' : ''}><span><i class="fa-solid fa-folder-plus" aria-hidden="true"></i> 새 폴더</span></button>`);
    return out.join('');
}
function place(box, sel) {
    const vv = window.visualViewport;
    const v = vv && vv.height > 0 ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height } : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    box.style.width = 'max-content';
    const at = pickRect(sel.getBoundingClientRect(), v, { w: box.offsetWidth, h: box.scrollHeight || 120 });
    box.style.width = `${at.width}px`; box.style.left = `${at.left}px`; box.style.top = `${at.top}px`; box.style.maxHeight = `${at.maxHeight}px`;
    box.classList.toggle('up', at.up);
}
function pick(sel, name) {
    close();
    const index = [...sel.options].findIndex(o => o.text === name);
    if (index < 0 || index === sel.selectedIndex) return;
    sel.selectedIndex = index;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
}
function setOpen(id, open) {
    const list = folders(), f = list.find(x => x.id === id);
    if (!f) return;
    f.open = open;
    writeFolders(list);
}

function open(sel) {
    if (layer) { close(); return; }
    ensureQuickCss();
    openedAt = Date.now();
    const host = sel.closest('dialog[open]') || document.body;
    layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-pfo-layer';
    layer.dataset.blPopup = 'pick';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh';
    const search = sel.options.length > SEARCH_FROM;
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-pfo-menu" role="listbox" aria-label="프리셋 고르기">${search ? '<div class="salty-pick-search"><input type="search" placeholder="찾기" autocomplete="off" spellcheck="false" aria-label="프리셋 찾기"></div>' : ''}<div class="salty-pick-rows">${rowsHtml(sel)}</div></div>`;
    const box = layer.firstElementChild, rows = box.querySelector('.salty-pick-rows'), input = box.querySelector('input');
    const redraw = () => { rows.innerHTML = rowsHtml(sel, input?.value || ''); };
    layer.addEventListener('pointerdown', event => { if (event.target === layer) { event.preventDefault(); close(); } });
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) layer.addEventListener(type, event => event.stopPropagation());
    layer.addEventListener('click', event => {
        event.stopPropagation();
        const button = event.target.closest?.('button');
        if (!button || button.disabled) return;
        if (button.dataset.v !== undefined) { pick(sel, button.dataset.v); return; }
        const act = button.dataset.pfo, id = button.closest('.bl-pfo-head')?.dataset.f;
        if (act === 'fold' && id) { const head = button.closest('.bl-pfo-head'); setOpen(id, head.classList.contains('closed')); redraw(); return; }
        if (act === 'menu' && id) { folderMenu(sel, id, button); return; }
        if (act === 'new') { close(); openEditor(sel, null); }
    });
    input?.addEventListener('input', () => { rows.scrollTop = 0; redraw(); });
    box.addEventListener('keydown', event => {
        const items = [...rows.querySelectorAll('button:not([disabled])')];
        const at = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1)]?.focus(); }
        else if (event.key === 'Enter' && event.target === input && !event.isComposing) { event.preventDefault(); rows.querySelector('button[data-v]')?.click(); }
    });
    const key = event => { if (event.key === 'Escape' && layer) { event.preventDefault(); event.stopPropagation(); close(); sel.focus?.({ preventScroll: true }); } };
    const width = window.innerWidth;
    const resize = () => { if (!layer) return; if (window.innerWidth !== width || !sel.isConnected) close(); else place(box, sel); };
    const scroll = event => { if (layer && !layer.contains(event.target) && (event.target === document || event.target?.contains?.(sel)) && Date.now() - openedAt > GRACE) close(); };
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', resize);
    document.addEventListener('scroll', scroll, true);
    off = () => { document.removeEventListener('keydown', key, true); window.removeEventListener('resize', resize); document.removeEventListener('scroll', scroll, true); };
    host.append(layer);
    if (typeof layer.showPopover === 'function') { try { layer.setAttribute('popover', 'manual'); layer.showPopover(); } catch { layer.removeAttribute('popover'); } }
    place(box, sel);
    const on = rows.querySelector('button.on');
    if (on) rows.scrollTop = Math.max(0, on.offsetTop - rows.clientHeight / 2);
    if (input && matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus();
}

function folderMenu(sel, id, anchor) {
    const list = folders(), f = list.find(x => x.id === id);
    if (!f) return;
    const i = list.indexOf(f);
    openMenu(anchor, [
        { label: '이름 · 프리셋 고치기', run: () => { close(); openEditor(sel, id); } },
        ...(i > 0 ? [{ label: '위로 옮기기', run: () => { const next = moveFolder(folders(), id, -1); if (next) writeFolders(next); refresh(sel); } }] : []),
        ...(i < list.length - 1 ? [{ label: '아래로 옮기기', run: () => { const next = moveFolder(folders(), id, 1); if (next) writeFolders(next); refresh(sel); } }] : []),
        { label: '폴더 지우기', danger: true, run: () => dropFolder(sel, id) },
    ]);
}
function refresh(sel) {
    const rows = layer?.querySelector('.salty-pick-rows');
    if (rows) rows.innerHTML = rowsHtml(sel, layer.querySelector('input')?.value || '');
}
async function dropFolder(sel, id) {
    const f = folders().find(x => x.id === id);
    if (!f) return;
    close();
    if (!await ask(`「${f.name}」 폴더를 지울까요?\n안의 프리셋은 폴더 밖으로 나오고, 프리셋 파일은 그대로예요.`, { ok: '폴더 지우기', danger: true, title: '프리셋 폴더' })) return;
    writeFolders(removeFolder(folders(), id));
}

// ───────── 폴더 고치기 창 (프롬프트 폴더 창과 같은 틀 · css/78) ─────────
async function openEditor(sel, id) {
    if (document.querySelector('dialog.bl-pfo-editor[open]')) return;
    await splitCssReady().catch(() => false);   // 창 틀(css/78)은 둘째 장 — 서랍을 열었으면 이미 받았어요
    if (document.querySelector('dialog.bl-pfo-editor[open]')) return;
    const all = folders(), current = id ? all.find(f => f.id === id) : null;
    if (id && !current) return;
    const list = names(sel), present = new Set(list);
    const chosen = new Set((current?.items || []).filter(name => present.has(name)));
    const owner = new Map();
    for (const f of all) if (f.id !== id) for (const name of f.items) owner.set(name, f.name);
    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-prompt-card-picker bl-pfo-editor';
    dialog.setAttribute('aria-label', current ? '프리셋 폴더 고치기' : '새 프리셋 폴더');
    dialog.innerHTML = `<header><h3>${current ? '프리셋 폴더 고치기' : '새 프리셋 폴더'}</h3><button type="button" data-card-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>`
        + `<input type="text" class="text_pole" data-pfo-name maxlength="${MAX_NAME}" placeholder="폴더 이름" aria-label="폴더 이름" autocomplete="off" value="${esc(current?.name || '')}">`
        + '<input type="search" class="text_pole" data-card-search placeholder="프리셋 찾기" aria-label="프리셋 찾기" autocomplete="off">'
        + '<div class="bl-prompt-card-list" aria-label="프리셋 목록"></div>'
        + '<footer><small role="status" aria-live="polite"></small><span class="bl-prompt-card-actions"><button type="button" data-card-clear>취소</button><button type="button" data-card-done>저장</button></span></footer>';
    const name = dialog.querySelector('[data-pfo-name]'), search = dialog.querySelector('[data-card-search]');
    const box = dialog.querySelector('.bl-prompt-card-list'), status = dialog.querySelector('[role="status"]');
    const fold = text => String(text || '').normalize('NFKC').toLocaleLowerCase();
    function render() {
        const words = fold(search.value).trim().split(/\s+/).filter(Boolean);
        const fragment = document.createDocumentFragment();
        for (const preset of list) {
            if (words.length && !words.every(w => fold(preset).includes(w))) continue;
            const choice = document.createElement('button');
            choice.type = 'button'; choice.className = 'bl-prompt-card-choice'; choice.dataset.v = preset;
            choice.setAttribute('aria-pressed', String(chosen.has(preset)));
            const copy = document.createElement('span'), title = document.createElement('b');
            title.textContent = preset; copy.append(title);
            if (owner.has(preset)) { const small = document.createElement('small'); small.textContent = `지금 「${owner.get(preset)}」 폴더`; copy.append(small); }
            const check = document.createElement('i'); check.className = 'fa-solid fa-check'; check.setAttribute('aria-hidden', 'true'); check.hidden = !chosen.has(preset);
            choice.append(copy, check);
            fragment.append(choice);
        }
        if (!fragment.childNodes.length) { const empty = document.createElement('p'); empty.textContent = list.length ? '찾는 프리셋이 없어요.' : '프리셋이 없어요.'; fragment.append(empty); }
        box.replaceChildren(fragment);
        status.textContent = `${chosen.size}개 골랐어요`;
    }
    box.addEventListener('click', event => {
        const choice = event.target.closest?.('.bl-prompt-card-choice');
        if (!choice) return;
        const preset = choice.dataset.v;
        if (chosen.has(preset)) chosen.delete(preset); else chosen.add(preset);
        choice.setAttribute('aria-pressed', String(chosen.has(preset)));
        choice.querySelector('i').hidden = !chosen.has(preset);
        status.textContent = `${chosen.size}개 골랐어요`;
    });
    search.addEventListener('input', () => { box.scrollTop = 0; render(); });
    dialog.querySelector('[data-card-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-card-clear]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-card-done]').addEventListener('click', () => {
        let next = folders(), fid = id;
        if (!fid) {
            if (next.length >= MAX_FOLDERS) { dialog.close(); return; }
            fid = newFolderId(new Set(next.map(f => f.id)));
            next.push({ id: fid, name: '', open: true, items: [] });
        }
        next = assignPresets(next, fid, list.filter(preset => chosen.has(preset)), present);
        const f = next.find(x => x.id === fid);
        f.name = String(name.value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || f.name || `폴더 ${next.length}`;
        writeFolders(next);
        dialog.close();
    });
    let backdrop = false;
    const outside = e => { const r = dialog.getBoundingClientRect(); return e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
    dialog.addEventListener('pointerdown', e => { backdrop = outside(e); });
    dialog.addEventListener('click', e => { if (backdrop && outside(e)) dialog.close(); backdrop = false; });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    render();
    document.body.append(dialog);
    showThemeModal(dialog);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) name.focus();
}

// ───────── 칸 갈고리: 창(window) 캡처라 테마 공용 고르기 목록(selects.js · 문서 캡처)보다 먼저 받아요 ─────────
function onPointerDown(event) {
    if (!isOurs(event.target)) return;
    event.stopPropagation();
    event.preventDefault();   // 마우스: 뒤따르는 mousedown(OS 목록이 열리는 순간)까지 막혀요. 손가락은 touchend 에서 열어요
    if (event.pointerType !== 'touch') open(event.target);
}
function onTouchStart(event) {
    if (!isOurs(event.target)) return;
    event.stopPropagation();
    const t = event.touches?.[0];
    touch = t ? { x: t.clientX, y: t.clientY, el: event.target } : null;
}
function onTouchEnd(event) {
    if (!isOurs(event.target)) { touch = null; return; }
    event.stopPropagation();
    const t = event.changedTouches?.[0], start = touch; touch = null;
    if (!start || start.el !== event.target || (t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10)) return;
    event.preventDefault();
    open(event.target);
}
function onSwallow(event) { if (isOurs(event.target)) { event.preventDefault(); event.stopPropagation(); } }
function onKey(event) {
    if (!isOurs(event.target)) return;
    if (event.key === 'Enter' || event.key === ' ' || (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))) {
        event.preventDefault(); event.stopPropagation();
        open(event.target);
    }
}
const HOOKS = [['pointerdown', onPointerDown], ['touchstart', onTouchStart], ['touchend', onTouchEnd], ['mousedown', onSwallow], ['click', onSwallow], ['keydown', onKey]];

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncPresetFolders(on) {
    wanted = !!on;
    if (wanted && !bound) {
        bound = true;
        for (const [type, fn] of HOOKS) window.addEventListener(type, fn, { capture: true, passive: type === 'touchstart' });
    } else if (!wanted && bound) {
        bound = false;
        for (const [type, fn] of HOOKS) window.removeEventListener(type, fn, { capture: true });
        close();
    }
}

/** 시험용 */
export const _forTest = { open, close, pick, rowsHtml, openEditor, folderMenu, dropFolder, layer: () => layer, select };
