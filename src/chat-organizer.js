// 채팅 정리 (1.0.2 후보 · 기본 끔) — 캐릭터 관리 서랍 위에 「캐릭터 · 최근 채팅 · 폴더」 탭을 더해요.
//   최근 채팅: 캐릭터 · 그룹을 넘나드는 최근 대화(실리태번 /api/chats/recent 한 번 · 처음 50개, 「더 불러오기」로 50개씩) · 찾기 · 고정 · 날짜 묶음.
//   폴더: 채팅 폴더(만들기 · 이름 · 하위 폴더 3단 · 위아래 · 옮기기 · 지우기 — 지워도 채팅 파일은 그대로). 서버 요청 없이 저장값으로 그려요.
//   고르기: 여러 채팅을 골라 폴더로 옮기거나 지워요(실리태번 자체 삭제 함수 · 지금 채팅은 못 고름 · 확인 두 번).
// 계산은 chat-organizer-core.js(순수). 모양은 chat-organizer.css(켤 때만 받음). 테마 설정 chatOrganizer 에 저장(프리셋 · 채팅 파일에는 안 씀).
// 실리태번 목록(.scrollableInner)은 옮기지도 복제하지도 않아요 — 탭 줄을 그 앞에, 우리 칸을 그 뒤에 두고 고른 탭에 따라 숨기기만 해요.
// 같은 일을 하는 ChatsPlus(원작 · 한국어판)가 켜져 있으면 features.js 가 이 기능을 쉬게 해요(ext-presence.js).
// 참고: ChatsPlus (SoFizzticated/SillyTavern-ChatPlus) · ChatsPlus (Mod) (sdafaff346/stjchatMod), AGPL-3.0 — THIRD-PARTY-NOTICES.md
import { getSettings, saveSettings } from './settings.js';
import { watchDom } from './dom-watch.js';
import { pickRect } from './selects.js';
import { ask, attachUndo } from './ask.js';
import { mouseDevice } from './prompt-card-picker.js';
import * as core from './chat-organizer-core.js';

const PANEL = 'right-nav-panel';
const PAGE = 50;
const FRESH_MS = 60_000;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = () => SillyTavern.getContext();
const warn = (...a) => console.warn('[Blue Lemonade] 채팅 정리', ...a);

let wanted = false, unfind = null, tabs = null, pane = null, host = null, tab = 'chars', menu = null;
let rows = [], byKey = new Map(), fetchedAt = 0, max = PAGE, allLoaded = false, loading = null, stale = true, query = '', queryTimer = 0;
let picking = null, busy = false, tidied = null, bound = false, cssOn = false;
const off = [];
// 실리태번 본체 모듈은 쓸 때만(옛 판에 없는 이름이 있어도 이 모듈 전체가 깨지지 않게 · 시험이 바꿔 끼워요)
const st = { script: () => import('../../../../../script.js'), groups: () => import('../../../../group-chats.js') };

// ───────── 저장 ─────────
/** 다듬은 저장값(설정이 통째로 바뀌면 다시 다듬어요) */
function data() {
    const s = getSettings();
    if (s.chatOrganizer && s.chatOrganizer === tidied) return tidied;
    const next = core.tidyStore(s.chatOrganizer);
    next.on = s.chatOrganizer?.on === true;
    s.chatOrganizer = tidied = next;
    return next;
}
const save = () => saveSettings();
function offerUndo(before, message) {
    const toast = globalThis.toastr?.info?.(message, 'Blue Lemonade');
    attachUndo(toast, () => { const s = getSettings(); s.chatOrganizer = { ...before, on: s.chatOrganizer?.on === true }; tidied = null; save(); render(); });
}
const snapshot = () => structuredClone({ folders: data().folders, chats: data().chats });

// ───────── 실리태번 쪽 ─────────
function toMs(value) {
    try { const m = ctx().timestampToMoment?.(value); const v = m?.valueOf?.(); if (Number.isFinite(v) && v > 0) return v; } catch { /* 모름 */ }
    return core.defaultMs(value);
}
function ownerOf(r) {
    const c = ctx();
    if (r.k === 'g') { const g = (c.groups || []).find(x => x.id === r.o); return g ? { name: g.name || '그룹', img: g.avatar_url || '', group: g } : null; }
    const ch = (c.characters || []).find(x => x.avatar === r.o);
    return ch ? { name: ch.name || r.o, img: c.getThumbnailUrl?.('avatar', ch.avatar) || '' } : null;
}
const nameOf = r => ownerOf(r)?.name || '';
function isCurrent(r) {
    const c = ctx();
    const id = c.getCurrentChatId?.();
    if (!id || id !== r.f) return false;
    if (r.k === 'g') return String(c.groupId ?? '') === r.o;
    return c.groupId == null && c.characters?.[c.characterId]?.avatar === r.o;
}
const refOf = key => { const r = byKey.get(key); if (r) return r; const [k, o, f] = key.split('\u0001'); return { k, o, f, integrity: '' }; };

async function fetchRecent(limit) {
    const c = ctx();
    const body = { metadata: true, pinned: core.pinnedParam(data()) };
    if (Number.isFinite(limit)) body.max = limit;
    const res = await fetch('/api/chats/recent', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify(body), cache: 'no-cache' });
    if (!res.ok) throw Error(`최근 채팅 ${res.status}`);
    const list = await res.json();
    const out = [], seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
        const r = core.normalizeRow(item, toMs);
        if (!r || seen.has(core.rowKey(r))) continue;
        seen.add(core.rowKey(r)); out.push(r);
    }
    return { rows: out, all: !Number.isFinite(limit) || (Array.isArray(list) ? list.length : 0) < limit + body.pinned.length };
}
/** 최근 채팅 받기(같은 때 두 번 안 받음). full 이면 한도 없이 전부 */
let loadingFull = false;
function refresh({ full = false } = {}) {
    // 1.0.9: 짧은 목록을 받는 중에 전체 목록(이름 바뀐 채팅 찾기)을 부르면 그 짧은 결과로 「없음」을 판정하던 것 → 끝난 뒤 전체로 한 번 더
    if (loading) return full && !loadingFull ? loading.then(() => refresh({ full: true })) : loading;
    const limit = full ? Infinity : max;
    loadingFull = full;
    loading = (async () => {
        try {
            const got = await fetchRecent(limit);
            rows = got.rows; byKey = new Map(rows.map(r => [core.rowKey(r), r]));
            allLoaded = got.all; fetchedAt = Date.now(); stale = false;
            if (core.reconcile(data(), rows)) save();
        } catch (error) {
            warn(error);
            globalThis.toastr?.warning?.('최근 채팅을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'Blue Lemonade');
        } finally { loading = null; loadingFull = false; }
        render();
    })();
    render();
    return loading;
}
/** 열기 전에 파일이 있는지(없는 이름으로 열면 실리태번이 빈 채팅을 새로 만들어요) — true · false · null(서버에 못 물어봄) */
async function exists(r) {
    if (byKey.has(core.rowKey(r)) && Date.now() - fetchedAt < FRESH_MS) return true;
    if (r.k === 'g') return !!ownerOf(r)?.group?.chats?.includes?.(r.f);
    try {
        const res = await fetch('/api/characters/chats', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ avatar_url: r.o, simple: true }) });
        if (!res.ok) return null;   // 1.0.9: 통신 실패를 「파일 없음」으로 보면 멀쩡한 채팅을 목록에서 빼라고 안내했어요
        const list = await res.json();
        return Array.isArray(list) && list.some(x => core.fileIdOf(x?.file_id ?? x?.file_name) === r.f);
    } catch (error) { warn(error); return null; }
}
/** 이름이 밖에서 바뀐 채팅 찾기 — 저장해 둔 integrity 로 전체 목록에서 */
async function repair(r) {
    const id = core.findEntry(data(), r);
    const e = id && data().chats[id];
    if (!e?.i) return null;
    await refresh({ full: true });
    const hit = rows.find(x => x.k === e.k && x.o === e.o && x.integrity === e.i);
    if (!hit) return null;
    if (e.f !== hit.f) { e.f = hit.f; save(); }
    return hit;
}
async function openChat(r) {
    if (busy || isCurrent(r)) return;
    if (!ownerOf(r)) { globalThis.toastr?.warning?.('이 채팅의 캐릭터 · 그룹을 찾지 못했어요.', 'Blue Lemonade'); return; }
    busy = true;
    try {
        const found = await exists(r);
        if (found === null) { globalThis.toastr?.warning?.('채팅 목록을 서버에서 받지 못했어요. 연결을 확인하고 다시 눌러 주세요.', 'Blue Lemonade'); return; }
        if (!found) {
            const fixed = await repair(r);
            if (!fixed) { globalThis.toastr?.warning?.(`「${r.f}」 채팅 파일을 찾지 못했어요. 지워졌으면 ⋮ 메뉴에서 목록에서 빼 주세요.`, 'Blue Lemonade'); return; }
            r = fixed;
        }
        const c = ctx();
        if (r.k === 'g') {
            const groups = await st.groups();
            await groups.openGroupById?.(r.o);
            if (ctx().getCurrentChatId?.() !== r.f) await c.openGroupChat?.(r.o, r.f);
        } else {
            const at = (c.characters || []).findIndex(x => x.avatar === r.o);
            if (at < 0) return;
            await c.selectCharacterById?.(at, { switchMenu: false });
            if (ctx().getCurrentChatId?.() !== r.f) await c.openCharacterChat?.(r.f);
        }
    } catch (error) {
        warn(error);
        globalThis.toastr?.error?.('채팅을 열지 못했어요.', 'Blue Lemonade');
    } finally { busy = false; render(); }
}

// ───────── 화면 뼈대 ─────────
function ensureCss() {
    if (cssOn || document.getElementById('bl-chat-organizer-style')) { cssOn = true; return; }
    const link = document.createElement('link');
    link.id = 'bl-chat-organizer-style'; link.rel = 'stylesheet';
    link.href = new URL('./chat-organizer.css', import.meta.url).href;
    (document.head || document.documentElement).append(link);
    cssOn = true;
}
const panel = () => document.getElementById(PANEL);
/** 실리태번 목록 칸 — 서랍 바로 아래 .scrollableInner (우리 칸 말고) */
function stList(p = panel()) { return p ? [...p.children].find(el => el.classList?.contains('scrollableInner') && !el.classList.contains('bl-co-pane')) || null : null; }
function mount() {
    const p = panel(), list = stList(p);
    if (!p || !list) return false;
    if (tabs?.isConnected && pane?.isConnected && host === list) return true;
    tabs?.remove(); pane?.remove();
    host = list;
    tabs = document.createElement('div');
    tabs.className = 'bl-co-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '캐릭터 관리 보기');
    tabs.innerHTML = [['chars', '캐릭터'], ['recent', '최근 채팅'], ['folders', '폴더']].map(([id, label]) => `<button type="button" role="tab" data-co-tab="${id}" aria-selected="false">${label}</button>`).join('');
    pane = document.createElement('div');
    pane.className = 'bl-co-pane scrollableInner'; pane.setAttribute('role', 'tabpanel'); pane.hidden = true;
    pane.innerHTML = '<div class="bl-co-bar"><input type="search" class="text_pole bl-co-search" placeholder="이름 · 채팅 · 마지막 말 찾기" aria-label="채팅 찾기" autocomplete="off">'
        + '<button type="button" class="menu_button fa-solid fa-folder-plus bl-co-tool" data-co-act="new-folder" title="새 폴더" aria-label="새 폴더"></button>'
        + '<button type="button" class="menu_button fa-solid fa-list-check bl-co-tool" data-co-act="pick" title="여러 개 고르기" aria-label="여러 개 고르기"></button>'
        + '<button type="button" class="menu_button fa-solid fa-rotate bl-co-tool" data-co-act="refresh" title="새로고침" aria-label="새로고침"></button></div>'
        + '<div class="bl-co-list" role="list"></div>'
        + '<div class="bl-co-pickbar" hidden><small role="status" aria-live="polite"></small><div class="bl-co-pickbtns">'
        + '<button type="button" class="menu_button" data-co-act="pick-all">보이는 것 모두</button><button type="button" class="menu_button" data-co-act="pick-move">폴더로 옮기기</button>'
        + '<button type="button" class="menu_button bl-co-danger" data-co-act="pick-delete">지우기</button><button type="button" class="menu_button" data-co-act="pick-close">그만 고르기</button></div></div>';
    list.before(tabs); list.after(pane);
    tabs.addEventListener('click', onTabs);
    tabs.addEventListener('keydown', onTabKey);
    pane.addEventListener('click', onPane);
    pane.querySelector('.bl-co-search').addEventListener('input', onSearch);
    showTab(tab, { quiet: true });
    return true;
}
function unmount() {
    closeMenu();
    tabs?.remove(); pane?.remove();
    tabs = pane = host = null;
    delete panel()?.dataset.blCoTab;
}

function showTab(next, { quiet = false } = {}) {
    tab = next;
    const p = panel();
    if (!tabs || !pane || !p) return;
    for (const b of tabs.querySelectorAll('[data-co-tab]')) {
        const on = b.dataset.coTab === tab;
        b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    }
    if (tab === 'chars') { delete p.dataset.blCoTab; pane.hidden = true; picking = null; return; }
    p.dataset.blCoTab = tab; pane.hidden = false;
    pane.querySelector('[data-co-act="new-folder"]').hidden = tab !== 'folders';
    if (!quiet) pane.scrollTop = 0;
    // 폴더 탭은 서버에 묻지 않고 저장값으로 그려요(최근 탭에서 받아 둔 시각 · 마지막 말만 덧붙여요)
    if (tab === 'recent' && (stale || Date.now() - fetchedAt > FRESH_MS)) refresh();
    else render();
}
function onTabs(event) {
    const b = event.target.closest?.('[data-co-tab]');
    if (b) showTab(b.dataset.coTab);
}
function onTabKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const list = [...tabs.querySelectorAll('[data-co-tab]')], at = list.findIndex(b => b.dataset.coTab === tab);
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (at + (event.key === 'ArrowLeft' ? -1 : 1) + list.length) % list.length;
    event.preventDefault(); showTab(list[to].dataset.coTab); list[to].focus();
}
// 실리태번 서랍 위쪽 단추(캐릭터 목록 · 지금 캐릭터 · 즐겨찾기 아바타)를 누르면 캐릭터 탭으로
function onPanelClick(event) {
    if (tab === 'chars' || !event.target?.closest) return;
    if (event.target.closest('#rm_button_characters, #rm_button_selected_ch, #rm_button_create, #rm_button_group_chats, .hotswap .avatar, #rm_button_back')) showTab('chars');
}
function onSearch(event) {
    clearTimeout(queryTimer);
    queryTimer = setTimeout(() => { query = event.target.value || ''; render(); }, 200);
}

// ───────── 그리기 ─────────
function rowHtml(r, { entry = null, missing = false } = {}) {
    const key = core.rowKey(r), owner = ownerOf(r), cur = isCurrent(r);
    const name = owner?.name || (r.k === 'g' ? '(없는 그룹)' : '(없는 캐릭터)');
    const pinned = !!entry?.pin;
    const img = owner?.img ? `<img class="bl-co-ava" src="${esc(owner.img)}" alt="" loading="lazy" decoding="async">` : `<span class="bl-co-ava bl-co-ava-none"><i class="fa-solid ${r.k === 'g' ? 'fa-users' : 'fa-user'}" aria-hidden="true"></i></span>`;
    const picked = picking?.has(key);
    const check = picking ? `<input type="checkbox" class="bl-co-check" tabindex="-1" aria-hidden="true"${picked ? ' checked' : ''}${cur ? ' disabled' : ''}>` : '';
    const time = r.last ? `<small class="bl-co-time" title="${esc(core.fullTime(r.last))}">${esc(core.shortTime(r.last))}</small>` : '';
    const label = `${name} · ${r.f}${cur ? ' · 지금 채팅' : ''}${missing ? ' · 파일 확인 필요' : ''}`;
    return `<div class="bl-co-row${cur ? ' bl-co-current' : ''}${missing ? ' bl-co-missing' : ''}${picked ? ' bl-co-picked' : ''}" role="listitem" data-key="${esc(encodeURIComponent(key))}">`
        + `<button type="button" class="bl-co-open" data-co-act="open" aria-label="${esc(label)}"${picking ? ` aria-pressed="${!!picked}"${cur ? ' aria-disabled="true"' : ''}` : ''}>${check}${img}`
        + `<span class="bl-co-text"><span class="bl-co-who"><b>${esc(name)}</b>${r.k === 'g' ? '<i class="fa-solid fa-users" aria-hidden="true" title="그룹"></i>' : ''}${pinned ? '<i class="fa-solid fa-thumbtack bl-co-pin" aria-hidden="true" title="고정"></i>' : ''}</span>`
        + `<small class="bl-co-file">${esc(r.f)}</small>${r.mes ? `<span class="bl-co-mes">${esc(r.mes)}</span>` : ''}</span>${time}</button>`
        + (picking ? '' : `<button type="button" class="menu_button fa-solid fa-ellipsis-vertical bl-co-tool" data-co-act="row-menu" title="메뉴" aria-label="${esc(name)} 채팅 메뉴" aria-haspopup="menu"></button>`)
        + '</div>';
}
const entryRow = e => byKey.get(`${e.k}\u0001${e.o}\u0001${e.f}`) || { k: e.k, o: e.o, f: e.f, integrity: e.i || '', last: 0, count: 0, mes: '' };
function visibleRows() {
    const d = data();
    if (tab === 'recent') return rows.filter(r => ownerOf(r) && core.matches(r, query, nameOf));
    return Object.values(d.chats).filter(e => e.in).map(entryRow).filter(r => core.matches(r, query, nameOf));
}
function render() {
    if (!pane || pane.hidden) return;
    const list = pane.querySelector('.bl-co-list');
    const d = data();
    const entryOf = r => { const id = core.findEntry(d, r); return id ? d.chats[id] : null; };
    let html = '';
    if (tab === 'recent') {
        const shown = rows.filter(r => ownerOf(r) && core.matches(r, query, nameOf));
        const pinned = shown.filter(r => entryOf(r)?.pin), rest = shown.filter(r => !entryOf(r)?.pin);
        if (pinned.length) html += `<h4 class="bl-co-day">고정</h4>${pinned.sort((a, b) => b.last - a.last).map(r => rowHtml(r, { entry: entryOf(r) })).join('')}`;
        for (const g of core.groupByDay(rest)) html += `<h4 class="bl-co-day">${esc(g.label)}</h4>${g.rows.map(r => rowHtml(r, { entry: entryOf(r) })).join('')}`;
        if (!shown.length) html += `<p class="bl-co-empty">${loading ? '불러오는 중이에요…' : query ? '찾는 채팅이 없어요.' : '최근 채팅이 없어요.'}</p>`;
        if (!allLoaded && rows.length) html += `<button type="button" class="menu_button bl-co-moreload" data-co-act="more"${loading ? ' disabled' : ''}>${loading ? '불러오는 중…' : `더 불러오기 · 지금 ${rows.length}개${query ? ' 안에서 찾았어요' : ''}`}</button>`;
    } else {
        const tree = core.folderTree(d.folders);
        const inside = new Map();
        for (const e of Object.values(d.chats)) if (e.in) (inside.get(e.in) || inside.set(e.in, []).get(e.in)).push(e);
        const found = q => (inside.get(q) || []).map(entryRow).filter(r => core.matches(r, query, nameOf));
        // 찾는 중이면 맞는 채팅이 든 폴더(와 그 위 폴더)만 펼쳐 보여요
        const keep = new Set();
        if (query) for (const { folder } of tree) if (found(folder.id).length || core.matches({ f: folder.name, mes: '' }, query)) { let p = folder.id; while (p && !keep.has(p)) { keep.add(p); p = d.folders.find(x => x.id === p)?.parent || ''; } }
        const closed = new Set();
        for (const { folder, depth } of tree) {
            if (query && !keep.has(folder.id)) continue;
            if (folder.parent && closed.has(folder.parent)) { closed.add(folder.id); continue; }
            const open = query ? true : folder.open;
            if (!open) closed.add(folder.id);
            const chats = found(folder.id).sort((a, b) => (b.last - a.last) || a.f.localeCompare(b.f));
            const total = core.folderCount(d, folder.id, true);
            html += `<div class="bl-co-folder" data-folder="${esc(folder.id)}" data-depth="${depth}">`
                + `<button type="button" class="bl-co-fold" data-co-act="fold" aria-expanded="${open}"><i class="fa-solid fa-chevron-${open ? 'down' : 'right'} bl-co-caret" aria-hidden="true"></i><i class="fa-solid fa-folder${open ? '-open' : ''}" aria-hidden="true"></i><b>${esc(folder.name)}</b><small>${total}</small></button>`
                + (picking ? '' : `<button type="button" class="menu_button fa-solid fa-ellipsis-vertical bl-co-tool" data-co-act="folder-menu" title="폴더 메뉴" aria-label="「${esc(folder.name)}」 폴더 메뉴" aria-haspopup="menu"></button>`) + '</div>';
            if (open && chats.length) html += `<div class="bl-co-in" data-depth="${depth}">${chats.map(r => rowHtml(r, { entry: entryOf(r), missing: fetchedAt && allLoaded && !byKey.has(core.rowKey(r)) })).join('')}</div>`;
        }
        if (!d.folders.length) html = '<p class="bl-co-empty">폴더가 없어요. 위 <i class="fa-solid fa-folder-plus" aria-hidden="true"></i> 로 만들고, 채팅 ⋮ 메뉴에서 넣어요.</p>';
        else if (query && !keep.size) html = '<p class="bl-co-empty">찾는 채팅이 없어요.</p>';
    }
    list.innerHTML = html;
    const bar = pane.querySelector('.bl-co-pickbar');
    bar.hidden = !picking;
    if (picking) bar.querySelector('[role="status"]').textContent = `${picking.size}개 골랐어요`;
    for (const b of bar.querySelectorAll('[data-co-act="pick-move"], [data-co-act="pick-delete"]')) b.disabled = !picking?.size;
    pane.querySelector('[data-co-act="pick"]')?.setAttribute('aria-pressed', String(!!picking));
}

// ───────── 누르기 ─────────
function onPane(event) {
    const b = event.target.closest?.('[data-co-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.coAct, row = b.closest('.bl-co-row'), key = row ? decodeURIComponent(row.dataset.key) : '', folder = b.closest('.bl-co-folder')?.dataset.folder;
    if (act === 'open' && key) {
        if (picking) { const r = refOf(key); if (isCurrent(r)) return; if (picking.has(key)) picking.delete(key); else picking.add(key); render(); return; }
        openChat(refOf(key)); return;
    }
    if (act === 'row-menu' && key) return openRowMenu(refOf(key), b);
    if (act === 'fold' && folder) { const f = data().folders.find(x => x.id === folder); if (f && !query) { f.open = !f.open; save(); render(); pane.querySelector(`.bl-co-folder[data-folder="${CSS.escape(folder)}"] .bl-co-fold`)?.focus?.({ preventScroll: true }); } return; }
    if (act === 'folder-menu' && folder) return openFolderMenu(folder, b);
    if (act === 'new-folder') return newFolder('');
    if (act === 'refresh') { stale = true; refresh(); return; }
    if (act === 'more') { max += PAGE; refresh(); return; }
    if (act === 'pick') { picking = picking ? null : new Set(); render(); return; }
    if (act === 'pick-close') { picking = null; render(); return; }
    if (act === 'pick-all') { for (const r of visibleRows()) if (!isCurrent(r)) picking.add(core.rowKey(r)); render(); return; }
    if (act === 'pick-move') return openFolderPick(b, [...picking].map(refOf));
    if (act === 'pick-delete') return deleteFlow([...picking].map(refOf));
}

// 공용 고르기 목록 팝업(css/72) — 프롬프트 폴더 메뉴와 같은 틀
function closeMenu() {
    if (!menu) return;
    const { layer, off: done } = menu; menu = null; done();
    try { if (layer.matches(':popover-open')) layer.hidePopover(); } catch { /* popover 모름 */ }
    layer.remove();
}
function openMenu(anchor, items) {
    closeMenu();
    const layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-co-layer';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh;margin:0;padding:0;border:0;overflow:visible;max-width:none;max-height:none;background:transparent;color:inherit';
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-co-menu" role="menu"><div class="salty-pick-rows">${items.map((item, i) => `<button type="button" role="menuitem" data-i="${i}"${item.depth ? ` data-depth="${item.depth}"` : ''} class="${item.danger ? 'bl-co-danger' : ''}${item.on ? ' on' : ''}"${item.disabled ? ' disabled' : ''}><span>${esc(item.label)}</span>${item.on ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div></div>`;
    const box = layer.firstElementChild;
    layer.addEventListener('pointerdown', event => { if (event.target === layer) { event.preventDefault(); closeMenu(); } });
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) layer.addEventListener(type, event => event.stopPropagation());
    layer.addEventListener('click', event => {
        event.stopPropagation();
        const button = event.target.closest?.('button[data-i]');
        if (!button || button.disabled) return;
        const item = items[Number(button.dataset.i)];
        closeMenu();
        try { item?.run?.(); } catch (error) { warn(error); }
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

function openRowMenu(r, anchor) {
    const d = data(), id = core.findEntry(d, r), e = id ? d.chats[id] : null, cur = isCurrent(r);
    const missing = tab === 'folders' && allLoaded && fetchedAt && !byKey.has(core.rowKey(r));
    const items = [
        { label: e?.pin ? '고정 풀기' : '고정', run: () => setRef(r, { pin: !e?.pin }) },
        { label: e?.in ? '다른 폴더로 옮기기' : '폴더에 넣기', run: () => openFolderPick(anchor, [r]) },
        ...(e?.in ? [{ label: '폴더에서 빼기', run: () => moveTo([r], '') }] : []),
        ...(missing ? [{ label: '목록에서 빼기', run: () => { const before = snapshot(); core.dropEntries(data(), [r]); save(); render(); offerUndo(before, '목록에서 뺐어요(파일은 건드리지 않았어요).'); } }] : []),
        { label: '이름 바꾸기', disabled: !ownerOf(r), run: () => renameChat(r) },
        { label: cur ? '지우기 · 지금 채팅은 못 지워요' : '지우기', danger: true, disabled: cur, run: () => deleteFlow([r]) },
    ];
    openMenu(anchor, items);
}
function setRef(r, change) {
    core.setEntry(data(), r, change); save(); render();
}
function openFolderPick(anchor, refs) {
    const d = data();
    if (!d.folders.length) { newFolder('', refs); return; }
    const here = refs.length === 1 ? d.chats[core.findEntry(d, refs[0])]?.in || '' : null;
    const items = core.folderTree(d.folders).map(({ folder, depth }) => ({ label: folder.name, depth, on: folder.id === here, run: () => moveTo(refs, folder.id) }));
    items.push({ label: '새 폴더 만들어 넣기', run: () => newFolder('', refs) });
    openMenu(anchor, items);
}
function moveTo(refs, folderId) {
    const d = data(), before = snapshot(), name = d.folders.find(f => f.id === folderId)?.name;
    let n = 0;
    for (const r of refs) if (core.setEntry(d, r, { in: folderId }) || !folderId) n++;
    save(); picking = null; render();
    if (refs.length > 1 || !folderId) offerUndo(before, folderId ? `채팅 ${n}개를 「${name}」 폴더로 옮겼어요.` : '폴더에서 뺐어요.');
}
async function inputName(title, value = '') {
    const c = ctx();
    if (!c.callGenericPopup || !c.POPUP_TYPE) return null;
    const out = await c.callGenericPopup(title, c.POPUP_TYPE.INPUT, value, { okButton: '저장', cancelButton: '취소' });
    return typeof out === 'string' ? out.trim() : null;
}
async function newFolder(parent, refs = null) {
    const name = await inputName(parent ? '새 하위 폴더 이름' : '새 폴더 이름');
    if (!name) return;
    const d = data(), id = core.addFolder(d, name, parent);
    if (!id) { globalThis.toastr?.warning?.(`폴더는 ${core.LIMITS.folders}개까지예요.`, 'Blue Lemonade'); return; }
    for (const f of d.folders) if (f.id === parent) f.open = true;
    if (refs?.length) { for (const r of refs) core.setEntry(d, r, { in: id }); picking = null; }
    save();
    if (tab !== 'folders' && !refs) showTab('folders'); else render();
}
function openFolderMenu(id, anchor) {
    const d = data(), f = d.folders.find(x => x.id === id);
    if (!f) return;
    const sibs = d.folders.filter(x => x.parent === f.parent), at = sibs.indexOf(f);
    const targets = core.folderTree(d.folders).filter(({ folder }) => core.canNest(d.folders, id, folder.id) && folder.id !== f.parent);
    openMenu(anchor, [
        { label: '이름 바꾸기', run: async () => { const n = await inputName('폴더 이름', f.name); if (n && core.renameFolder(data(), id, n)) { save(); render(); } } },
        ...(core.depthOf(d.folders, id) < core.LIMITS.depth ? [{ label: '안에 새 폴더', run: () => newFolder(id) }] : []),
        ...(at > 0 ? [{ label: '위로', run: () => { core.shiftFolder(data(), id, -1); save(); render(); } }] : []),
        ...(at < sibs.length - 1 ? [{ label: '아래로', run: () => { core.shiftFolder(data(), id, 1); save(); render(); } }] : []),
        ...(targets.length || f.parent ? [{ label: '다른 폴더 안으로', run: () => openMenu(anchor, [
            ...(f.parent ? [{ label: '맨 위로', run: () => { core.nestFolder(data(), id, ''); save(); render(); } }] : []),
            ...targets.map(({ folder, depth }) => ({ label: folder.name, depth, run: () => { const dd = data(); core.nestFolder(dd, id, folder.id); for (const x of dd.folders) if (x.id === folder.id) x.open = true; save(); render(); } })),
        ]) }] : []),
        { label: '폴더 지우기', danger: true, run: () => removeFolder(id) },
    ]);
}
function removeFolder(id) {
    const d = data(), f = d.folders.find(x => x.id === id);
    if (!f) return;
    const before = snapshot(), parent = d.folders.find(x => x.id === f.parent);
    const { moved, lifted } = core.removeFolder(d, id);
    save(); render();
    const parts = [`「${f.name}」 폴더를 지웠어요(채팅 파일은 그대로예요)`];
    if (moved) parts.push(parent ? `채팅 ${moved}개는 「${parent.name}」 폴더로 올라갔어요` : `채팅 ${moved}개는 폴더 밖으로 나왔어요`);
    if (lifted) parts.push(`하위 폴더 ${lifted}개는 한 단 위로 올라갔어요`);
    offerUndo(before, parts.join(' · ') + '.');
}
async function renameChat(r) {
    const next = await inputName('채팅 이름', r.f);
    const clean = core.fileIdOf(next);
    if (!clean || clean === r.f) return;
    try {
        const script = await st.script();
        const c = ctx(), characterId = r.k === 'c' ? (c.characters || []).findIndex(x => x.avatar === r.o) : undefined;
        // 실리태번이 파일 이름을 바꾸고 CHAT_RENAMED 를 알려요 → onRenamed 가 저장 · 목록을 고쳐요
        await script.renameGroupOrCharacterChat({ characterId, groupId: r.k === 'g' ? r.o : undefined, oldFileName: r.f, newFileName: clean, loader: true });
    } catch (error) { warn(error); globalThis.toastr?.error?.('이름을 바꾸지 못했어요.', 'Blue Lemonade'); }
}

// ───────── 지우기 ─────────
async function deleteFlow(refs) {
    if (busy) return;
    const list = refs.filter(r => !isCurrent(r));
    const skipped = refs.length - list.length;
    if (!list.length) { globalThis.toastr?.info?.('지금 열려 있는 채팅은 지울 수 없어요.', 'Blue Lemonade'); return; }
    const shown = list.slice(0, 15).map(r => `· ${nameOf(r) || r.o} — ${r.f}`).join('\n') + (list.length > 15 ? `\n… 외 ${list.length - 15}개` : '');
    if (!(await ask(`${shown}${skipped ? `\n\n지금 열려 있는 채팅 ${skipped}개는 빼고 지워요.` : ''}`, { title: `채팅 ${list.length}개를 지울까요?`, ok: '다음', cancel: '취소' }))) return;
    if (!(await ask(`서버에서 채팅 파일 ${list.length}개가 지워지고 되돌릴 수 없어요. 고정 · 폴더에서도 빠져요.`, { title: '정말 지울까요?', ok: '지우기', cancel: '취소', danger: true }))) return;
    busy = true;
    const toast = globalThis.toastr?.info?.(`0 / ${list.length}`, '채팅 지우는 중', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    const done = [], failed = [];
    try {
        const script = await st.script();
        const groups = list.some(r => r.k === 'g') ? await st.groups() : null;
        // 하나씩 차례로 — 그룹 파일 · 캐릭터 카드(마지막 채팅)를 실리태번이 매번 고쳐 써요
        for (let i = 0; i < list.length; i++) {
            const r = list[i];
            try {
                if (isCurrent(r)) throw Error('지금 채팅');
                if (r.k === 'g') {
                    const g = ownerOf(r)?.group;
                    if (!g?.chats?.includes?.(r.f)) throw Error('그룹에 없는 채팅');
                    await groups.deleteGroupChatByName(r.o, r.f);
                    if (g.chats.includes(r.f)) throw Error('지워지지 않음');
                } else {
                    const at = (ctx().characters || []).findIndex(x => x.avatar === r.o);
                    if (at < 0) throw Error('캐릭터 없음');
                    await script.deleteCharacterChatByName(at, r.f);
                }
                done.push(r);
            } catch (error) { failed.push({ r, error }); }
            const msg = toast?.[0]?.querySelector?.('.toast-message') ?? toast?.find?.('.toast-message')?.[0];
            if (msg) msg.textContent = `${i + 1} / ${list.length}`;
        }
        // 캐릭터 채팅은 실리태번이 실패를 알려 주지 않아요 → 주인마다 목록을 한 번 받아 정말 없어졌는지 봐요
        for (const owner of new Set(done.filter(r => r.k === 'c').map(r => r.o))) {
            try {
                const res = await fetch('/api/characters/chats', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ avatar_url: owner, simple: true }) });
                const names = new Set((res.ok ? await res.json() : []).map(x => core.fileIdOf(x?.file_id ?? x?.file_name)));
                for (const r of done.filter(x => x.k === 'c' && x.o === owner && names.has(x.f))) { done.splice(done.indexOf(r), 1); failed.push({ r, error: Error('지워지지 않음') }); }
            } catch { /* 확인 못 함 — 지운 것으로 둬요 */ }
        }
    } catch (error) { warn(error); }
    finally {
        busy = false;
        if (toast) globalThis.toastr?.clear?.(toast);
    }
    if (done.length) { core.dropEntries(data(), done); save(); }
    for (const r of done) { const k = core.rowKey(r); byKey.delete(k); picking?.delete(k); }
    rows = rows.filter(r => byKey.has(core.rowKey(r)));
    picking = null; render();
    if (!failed.length) globalThis.toastr?.success?.(`채팅 ${done.length}개를 지웠어요.`, 'Blue Lemonade');
    else {
        globalThis.toastr?.warning?.(`${done.length}개 지움 · ${failed.length}개는 못 지웠어요. 자세한 것은 콘솔(F12)에 있어요.`, 'Blue Lemonade');
        warn('지우지 못한 채팅', failed.map(x => ({ 주인: x.r.o, 채팅: x.r.f, 까닭: String(x.error?.message || x.error) })));
    }
}

// ───────── 실리태번 알림 ─────────
function onRenamed(info) {
    const k = info?.groupId ? 'g' : 'c', o = String(info?.groupId || info?.avatarId || '');
    if (!o) return;
    const from = core.fileIdOf(info.oldFileName), to = core.fileIdOf(info.newFileName);
    if (core.renameEntries(data(), { k, o, from, to })) save();
    const r = byKey.get(`${k}\u0001${o}\u0001${from}`);
    if (r && to) { byKey.delete(core.rowKey(r)); r.f = to; byKey.set(core.rowKey(r), r); }
    render();
}
function onCharRenamed(from, to) { if (core.moveOwner(data(), from, to)) save(); for (const r of rows) if (r.k === 'c' && r.o === from) r.o = to; byKey = new Map(rows.map(r => [core.rowKey(r), r])); render(); }
function markStale() { stale = true; }
function onChatChanged() { stale = true; render(); }
function bindEvents() {
    if (bound) return;
    try {
        const { eventSource, event_types: T } = ctx();
        const on = (type, fn) => { if (!type) return; eventSource.on(type, fn); off.push(() => eventSource.removeListener?.(type, fn)); };
        on(T.CHAT_RENAMED, onRenamed);
        on(T.CHARACTER_RENAMED, onCharRenamed);
        on(T.CHAT_CHANGED, onChatChanged);
        for (const t of [T.CHAT_DELETED, T.GROUP_CHAT_DELETED, T.CHARACTER_DELETED, T.MESSAGE_SENT, T.MESSAGE_RECEIVED, T.CHAT_CREATED, T.GROUP_CHAT_CREATED]) on(t, markStale);
    } catch { /* 이벤트 없음 */ }
    const p = panel();
    if (p) { p.addEventListener('click', onPanelClick, true); off.push(() => p.removeEventListener('click', onPanelClick, true)); }
    bound = true;
}
function unbind() { while (off.length) { try { off.pop()(); } catch { /* 이미 뗌 */ } } bound = false; }

function attach() {
    if (!mount()) return false;
    unfind?.(); unfind = null;
    bindEvents();
    // 실리태번 · 다른 확장이 서랍 칸을 다시 만들면 다시 붙어요
    unfind = watchDom(panel(), { childList: true, when: 'frame', skip: r => [...r.addedNodes, ...r.removedNodes].every(n => n === tabs || n === pane || n.nodeType !== 1), name: '채팅 정리' }, () => { if (wanted && !(tabs?.isConnected && pane?.isConnected && stList() === host)) mount(); });
    return true;
}
export async function syncChatOrganizer(on) {
    wanted = !!on;
    if (!wanted) {
        unfind?.(); unfind = null;
        unbind(); unmount();
        clearTimeout(queryTimer);
        document.getElementById('bl-chat-organizer-style')?.remove(); cssOn = false;
        rows = []; byKey = new Map(); fetchedAt = 0; max = PAGE; allLoaded = false; stale = true; picking = null; tab = 'chars'; query = '';
        return;
    }
    ensureCss();
    if (attach()) return;
    // 서랍이 아직 없으면 생길 때
    unfind ??= watchDom(document.body, { childList: true, subtree: true, exclude: '#chat', when: 'frame', name: '채팅 정리 찾기' }, () => { if (wanted && stList()) { unfind?.(); unfind = null; attach(); } });
}

/** 시험용 */
export const _forTest = { st, state: () => ({ tab, rows, picking, allLoaded, max, fetchedAt }), render, showTab, refresh, openChat, deleteFlow, data };
