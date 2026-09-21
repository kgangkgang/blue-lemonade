// 북마크 — 모아 보기 패널
import { restorePreviewRules } from '../../lite.js';
import { hooks, settings, saveSettings, applyTheme, applyColors, colorsFor, currentChatKey, iconName } from './state.js';
import { getOwner, currentRecord, listOtherChats, loadRecord, findBookmark, bookmarkAt, addBookmark } from './data.js';
import { escapeHtml, formatDate, renderMessageHtml, renderReasoningHtml, renderNoteHtml, noteToPlainText, messageText, avatarForMessage, hydrateHtmlBlocks, highlightMatches, clearHighlights } from './render.js';
import { hasOpenSheet, closeTopSheet, confirmSheet } from './ui-kit.js';
import { openNoteEditor, openMessageEditor, openContextViewer, confirmDeleteBookmark, enterPreview, isPreviewing, openTranslationEditor, confirmClearTranslation } from './viewers.js';
import { hasTranslator, hasTranslation, isShowingOriginal, translateMessage, restoreTranslation } from './translate.js';
import { renderSettingsPage, disposeSettingsPage } from './settings-view.js';

const view = {
    root: null,
    owner: null,
    /** @type {import('./data.js').ChatRecord[]} 현재 채팅 + 북마크가 있는 다른 채팅 */
    records: [],
    selectedKey: null,
    page: 1,
    query: '',
    noteOnly: false,
    allMessages: false, // 북마크만이 아니라 이 채팅의 모든 메시지에서 찾는다
    loadingOthers: false,
    progress: '',
    expanded: new Set(),
    subOpen: null, // 번역 줄이 펼쳐진 북마크 id (한 번에 하나만)
    session: 0, // 새로 열 때마다 늘려서, 늦게 도착한 이전 요청 결과를 버린다.
    open: false,
};

const $ = selector => view.root.querySelector(selector);

// ── 뼈대 ────────────────────────────────────────────────────

function buildShell() {
    const root = document.createElement('div');
    root.id = 'cg-panel';
    root.className = 'cg-root cg-overlay';
    root.hidden = true;
    root.innerHTML = `
        <div class="cg-window" role="dialog" aria-modal="true" aria-label="북마크">
            <header class="cg-header">
                <button type="button" class="cg-icon-btn cg-drawer-toggle" data-act="drawer" title="채팅 목록" aria-label="채팅 목록"><i class="fa-solid fa-bars-staggered"></i></button>
                <img class="cg-hero-avatar" alt="" onerror="this.src='img/ai4.png'">
                <div class="cg-titles">
                    <div class="cg-eyebrow"><i class="fa-solid ${iconName()}"></i>북마크</div>
                    <div class="cg-title"></div>
                </div>
                <div class="cg-header-actions">
                    <button type="button" class="cg-icon-btn" data-act="search" title="검색" aria-label="검색"><i class="fa-solid fa-magnifying-glass"></i></button>
                    <button type="button" class="cg-icon-btn" data-act="settings" title="설정" aria-label="설정"><i class="fa-solid fa-sliders"></i></button>
                    <button type="button" class="cg-icon-btn" data-act="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </header>
            <div class="cg-searchbar" hidden>
                <label class="cg-search-field">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" placeholder="메시지·메모 검색" enterkeyhint="search" autocomplete="off">
                    <button type="button" class="cg-search-clear" data-act="search-clear" title="지우기" aria-label="검색어 지우기" hidden><i class="fa-solid fa-circle-xmark"></i></button>
                </label>
                <button type="button" class="cg-chip" data-act="all-messages" aria-pressed="false" aria-label="전체 메시지에서 찾기"><i class="fa-solid fa-comments"></i><span>전체 메시지</span></button>
                <button type="button" class="cg-chip" data-act="note-only" aria-pressed="false"><i class="fa-solid fa-feather-pointed"></i><span>메모만</span></button>
            </div>
            <div class="cg-body">
                <aside class="cg-sidebar">
                    <div class="cg-side-head"><span>채팅</span><span class="cg-side-total"></span></div>
                    <div class="cg-chat-list"></div>
                </aside>
                <div class="cg-scrim" data-act="drawer-close"></div>
                <main class="cg-main">
                    <div class="cg-toolbar">
                        <div class="cg-toolbar-info" data-act="drawer">
                            <div class="cg-toolbar-chat"></div>
                            <div class="cg-toolbar-meta"></div>
                        </div>
                        <button type="button" class="cg-chip" data-act="sort"><i class="fa-solid fa-arrow-down-short-wide"></i><span></span></button>
                    </div>
                    <div class="cg-list"></div>
                    <nav class="cg-pager" hidden></nav>
                </main>
            </div>
            <section class="cg-settings-page" hidden></section>
        </div>`;
    document.body.append(root);
    view.root = root;

    root.addEventListener('click', onClick);
    const input = $('.cg-searchbar input');
    let searchTimer = null;
    input.addEventListener('input', () => {
        $('.cg-search-clear').hidden = !input.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            view.query = input.value.trim();
            view.page = 1;
            renderMain();
        }, 160);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
    });

    // 이미지·iframe이 늦게 그려져도 '전체 보기' 버튼이 맞게 나오도록 본문 크기를 지켜본다.
    view.bodyObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const card = entry.target.closest('.cg-card');
            if (card) updateExpandButton(card);
        }
    });
}

// ── 열기·닫기 ────────────────────────────────────────────────

export function isPanelOpen() {
    return view.open;
}

export async function openPanel({ keepState = false } = {}) {
    restorePreviewRules(); // 카드 본문은 채팅 서식의 사본 규칙(.salty-preview)을 쓴다 — 테마가 시작 때 꺼 둔 것을 켠다
    if (!view.root) buildShell();
    // 알림 없이 메시지 번호가 바뀌었을 수 있으니 현재 채팅의 북마크 번호부터 맞춘다 (미리보기 중이면 하지 않는다).
    hooks.syncBookmarks();
    const reuse = (keepState || isPreviewing()) && view.records.length > 0;

    if (!reuse) {
        const owner = getOwner();
        if (!owner) {
            toastr.info('캐릭터나 그룹 채팅을 먼저 열어 주세요.', '북마크');
            return;
        }
        view.session++;
        view.owner = owner;
        const current = currentRecord();
        view.records = current ? [current] : [];
        view.selectedKey = current?.key ?? null;
        view.page = 1;
        view.query = '';
        view.noteOnly = false;
        view.allMessages = false;
        view.expanded.clear();
        view.subOpen = null;
        const input = $('.cg-searchbar input');
        input.value = '';
        $('.cg-search-clear').hidden = true;
        $('.cg-searchbar').hidden = true;
        $('[data-act="note-only"]').setAttribute('aria-pressed', 'false');
        $('[data-act="note-only"]').hidden = false;
        $('[data-act="all-messages"]').setAttribute('aria-pressed', 'false');
        $('.cg-window').classList.remove('is-drawer-open');
    }

    applyTheme(view.root);
    view.root.hidden = false;
    void view.root.offsetWidth;
    view.root.classList.add('is-open');
    view.open = true;
    applyColors(colorsFor(view.selectedKey ?? currentChatKey()));
    renderAll();

    if (!reuse) {
        loadOthers();
        // 현재 채팅이 없으면(드문 경우) 다른 채팅을 불러온 뒤 첫 채팅을 고른다.
    }
}

export function closePanel({ keepColors = false } = {}) {
    if (!view.open) return;
    view.open = false;
    closeSettings({ immediate: true });
    view.root.classList.remove('is-open');
    setTimeout(() => {
        if (!view.open) view.root.hidden = true;
    }, 200);
    if (!keepColors) applyColors(colorsFor(currentChatKey()));
}

export async function refreshPanel() {
    if (!view.open) return;
    applyTheme(view.root);
    // 테마 색을 따라가는 중에 에이드가 바뀌었거나, 따라가기를 켜고 껐을 때 색도 다시 고른다
    applyColors(colorsFor(view.selectedKey ?? currentChatKey()));
    renderAll();
}

/** 채팅이 바뀌면 패널이 열려 있을 때만 새로 채운다. */
export function onChatChanged() {
    if (view.open && !isPreviewing()) openPanel();
}

hooks.openPanel = openPanel;
hooks.closePanel = closePanel;
hooks.refreshPanel = refreshPanel;
hooks.isPanelOpen = isPanelOpen;

// ── 다른 채팅 불러오기 ──────────────────────────────────────

function lastMesTime(record) {
    const time = new Date(record.lastMes).getTime();
    return Number.isFinite(time) ? time : 0;
}

async function loadOthers() {
    const session = view.session;
    view.loadingOthers = true;
    view.progress = '';
    renderSidebar();
    try {
        const others = await listOtherChats(view.owner, (done, total) => {
            if (session !== view.session) return;
            view.progress = `${done}/${total}`;
            renderSidebar();
        });
        if (session !== view.session) return;
        others.sort((a, b) => lastMesTime(b) - lastMesTime(a) || a.key.localeCompare(b.key));
        // 목록을 읽는 사이에 번역이 끝난 채팅은(그룹 채팅은 여기서 이미 읽어 둔다) 골랐을 때 다시 불러온다.
        for (const record of others) {
            if (staleKeys.delete(record.key)) record.loaded = false;
        }
        view.records = [...view.records.filter(record => record.isCurrent), ...others];
        if (!view.selectedKey) {
            const first = others.find(record => record.favorites.length > 0);
            if (first) await selectChat(first.key);
        }
    } catch (error) {
        console.warn('[북마크] 다른 채팅 목록을 불러오지 못했습니다:', error);
        if (session === view.session) toastr.warning('다른 채팅 목록을 불러오지 못했어요.', '북마크');
    } finally {
        if (session === view.session) {
            view.loadingOthers = false;
            view.progress = '';
            renderHeader();
            renderSidebar();
        }
    }
}

function selectedRecord() {
    return view.records.find(record => record.key === view.selectedKey) ?? null;
}

function listedRecords() {
    // 전체 메시지 검색 중에는 북마크가 없는 채팅도 고를 수 있다.
    if (view.allMessages) return view.records;
    return view.records.filter(record => record.isCurrent || record.favorites.length > 0);
}

async function selectChat(key) {
    const record = view.records.find(item => item.key === key);
    if (!record) return;
    closeDrawer();
    if (key === view.selectedKey && record.loaded) return;
    view.selectedKey = key;
    view.page = 1;
    view.expanded.clear();
    view.subOpen = null;
    applyColors(colorsFor(key));
    renderSidebar();
    if (!record.loaded) {
        renderToolbar(record, null);
        renderListState('loading');
        try {
            await loadRecord(record);
        } catch (error) {
            console.warn('[북마크] 채팅을 불러오지 못했습니다:', error);
            if (view.selectedKey === key) renderListState('error', error.message);
            return;
        }
        if (view.selectedKey !== key) return;
    }
    renderMain();
    $('.cg-list').scrollTop = 0;
}

// ── 그리기 ──────────────────────────────────────────────────

function renderAll() {
    renderHeader();
    renderSidebar();
    renderMain();
}

function renderHeader() {
    const owner = view.owner;
    $('.cg-hero-avatar').src = owner?.avatarUrl ?? 'img/ai4.png';
    $('.cg-eyebrow i').className = `fa-solid ${iconName()}`;
    $('.cg-title').textContent = owner?.name ?? '북마크';
}

function renderSidebar() {
    const records = listedRecords();
    const total = records.reduce((sum, record) => sum + record.favorites.length, 0);
    $('.cg-side-total').textContent = view.loadingOthers ? '' : `${total}`;
    const items = records.map((record) => {
        const active = record.key === view.selectedKey;
        const accent = colorsFor(record.key).accent;
        return `
            <button type="button" class="cg-chat-item${active ? ' is-active' : ''}" data-chat-key="${escapeHtml(record.key)}" title="${escapeHtml(record.key)}" style="--cg-dot:${accent}">
                <span class="cg-chat-dot"></span>
                <span class="cg-chat-text">
                    <span class="cg-chat-name">${escapeHtml(record.label)}</span>
                    <span class="cg-chat-meta">${record.isCurrent ? '<em>현재 채팅</em> · ' : ''}메시지 ${record.messageCount ?? 0}</span>
                </span>
                <span class="cg-chat-count">${record.favorites.length}</span>
            </button>`;
    }).join('');
    const loading = view.loadingOthers
        ? `<div class="cg-chat-loading"><span class="cg-spinner"></span>다른 채팅 확인 중${view.progress ? ` · ${escapeHtml(view.progress)}` : '…'}</div>`
        : '';
    const empty = !records.length && !view.loadingOthers ? '<div class="cg-chat-loading">북마크가 있는 채팅이 없어요.</div>' : '';
    $('.cg-chat-list').innerHTML = items + loading + empty;
}

function visibleBookmarks(record) {
    const direction = settings().sortOrder === 'desc' ? -1 : 1;
    const toIndex = fav => {
        const index = Number.parseInt(fav.messageId, 10);
        return Number.isFinite(index) ? index : Number.MAX_SAFE_INTEGER;
    };
    if (view.allMessages) return searchAllMessages(record, direction);
    const items = record.favorites
        .map(fav => ({ fav, index: toIndex(fav) }))
        .sort((a, b) => (a.index - b.index) * direction);
    if (!view.query) return items;
    const query = view.query.toLowerCase();
    return items.filter(({ fav, index }) => {
        const note = noteToPlainText(fav.note).toLowerCase();
        if (view.noteOnly) return note.includes(query);
        const message = record.messages?.[index];
        const haystack = `${note}\n${messageText(message)}\n${message?.mes ?? ''}\n${message?.name ?? fav.sender ?? ''}`.toLowerCase();
        return haystack.includes(query);
    });
}

/** 북마크가 없는 검색 결과에 붙이는 임시 북마크 (id는 'm:번호'). 카드에서 북마크 버튼을 누르면 진짜가 된다. */
function virtualFav(record, index) {
    const message = record.messages?.[index];
    return { id: `m:${index}`, messageId: String(index), sender: message?.name ?? '', role: message?.is_user ? 'user' : 'character', note: '', virtual: true };
}

/** 전체 메시지 검색: 검색어가 있을 때만, 이 채팅의 모든 메시지에서 찾는다. */
function searchAllMessages(record, direction) {
    if (!view.query) return [];
    const query = view.query.toLowerCase();
    const messages = record.messages ?? [];
    const items = [];
    for (let index = 0; index < messages.length; index++) {
        const message = messages[index];
        if (!message) continue;
        const haystack = `${messageText(message)}\n${message.mes ?? ''}\n${message.name ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) continue;
        items.push({ fav: bookmarkAt(record, index) ?? virtualFav(record, index), index });
    }
    if (direction < 0) items.reverse();
    return items;
}

function renderToolbar(record, counts) {
    $('.cg-toolbar-chat').innerHTML = record
        ? `${escapeHtml(record.label)}${record.isCurrent ? '<span class="cg-badge">현재 채팅</span>' : ''}<i class="fa-solid fa-chevron-down cg-toolbar-caret"></i>`
        : '';
    let meta = '';
    if (counts && view.allMessages) meta = view.query ? `검색 결과 ${counts.shown} / 메시지 ${counts.messages}` : `메시지 ${counts.messages}개`;
    else if (counts) meta = view.query ? `검색 결과 ${counts.shown} / ${counts.total}` : `북마크 ${counts.total}개`;
    $('.cg-toolbar-meta').textContent = meta;
    const sortButton = $('[data-act="sort"]');
    const descending = settings().sortOrder === 'desc';
    sortButton.querySelector('span').textContent = descending ? '최근부터' : '처음부터';
    sortButton.querySelector('i').className = `fa-solid ${descending ? 'fa-arrow-up-wide-short' : 'fa-arrow-down-short-wide'}`;
}

function renderListState(state, detail = '') {
    const list = $('.cg-list');
    $('.cg-pager').hidden = true;
    if (state === 'loading') {
        list.innerHTML = Array.from({ length: 3 }, () => `
            <div class="cg-card cg-skeleton" aria-hidden="true">
                <div class="cg-skel-line is-short"></div><div class="cg-skel-line"></div><div class="cg-skel-line"></div><div class="cg-skel-line is-mid"></div>
            </div>`).join('');
        return;
    }
    const states = {
        error: ['fa-triangle-exclamation', '불러오지 못했어요', escapeHtml(detail)],
        empty: [`fa-${settings().iconStyle === 'star' ? 'star' : 'bookmark'}`, '아직 북마크가 없어요', `채팅 메시지의 <i class="fa-regular fa-${settings().iconStyle === 'star' ? 'star' : 'bookmark'}"></i> 아이콘을 누르면 여기에 모여요.`],
        nochat: ['fa-comments', '볼 채팅이 없어요', '왼쪽 목록에서 채팅을 골라 주세요.'],
        nomatch: ['fa-magnifying-glass', view.allMessages ? '찾는 메시지가 없어요' : '찾는 북마크가 없어요', `“${escapeHtml(view.query)}”${view.noteOnly && !view.allMessages ? ' · 메모에서만 찾았어요' : ''}`],
        typequery: ['fa-comments', '이 채팅의 모든 메시지에서 찾아요', '검색어를 넣으면 북마크가 아닌 메시지도 나와요.'],
    };
    const [icon, title, text] = states[state];
    list.innerHTML = `
        <div class="cg-empty">
            <div class="cg-empty-icon"><i class="fa-regular ${icon}"></i></div>
            <b>${title}</b>
            <p>${text}</p>
        </div>`;
}

function renderMain() {
    view.bodyObserver?.disconnect();
    const record = selectedRecord();
    if (!record) {
        renderToolbar(null, null);
        renderListState('nochat');
        return;
    }
    if (!record.loaded) {
        renderToolbar(record, null);
        renderListState('loading');
        return;
    }

    const items = visibleBookmarks(record);
    renderToolbar(record, { shown: items.length, total: record.favorites.length, messages: record.messages?.length ?? record.messageCount ?? 0 });
    clearHighlights();
    if (view.allMessages) {
        if (!view.query) return renderListState('typequery');
        if (!items.length) return renderListState('nomatch');
    } else {
        if (!record.favorites.length) return renderListState('empty');
        if (!items.length) return renderListState('nomatch');
    }

    const perPage = settings().itemsPerPage;
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    view.page = Math.min(Math.max(1, view.page), totalPages);
    const pageItems = items.slice((view.page - 1) * perPage, view.page * perPage);

    const list = $('.cg-list');
    list.innerHTML = pageItems.map(({ fav, index }) => renderCard(record, fav, index)).join('');
    list.querySelectorAll('.cg-card').forEach(activateCard);
    renderPager(totalPages);
}

// 휴대폰에서는 버튼 여섯 개가 한 줄에 들어가도록 짧은 이름을 쓴다.
const SHORT_ACTION_LABELS = { preview: '채팅', context: '문맥', note: '메모', edit: '원문', translate: '번역', delete: '삭제', mark: '북마크' };

function actionButton(act, icon, label, { disabled = false, className = '', expanded = null } = {}) {
    const aria = expanded === null ? '' : ` aria-expanded="${expanded}"`;
    return `<button type="button" class="cg-action ${className}" data-card-act="${act}" aria-label="${label}"${aria} ${disabled ? 'disabled' : ''}>
        <i class="fa-solid ${icon}"></i><span class="cg-label-long">${label}</span><span class="cg-label-short">${SHORT_ACTION_LABELS[act] ?? label}</span>
    </button>`;
}

// ── 번역 (LLM 번역기 연동) ──────────────────────────────────

/** 번역이 진행 중인 메시지: "채팅 키\n번호". 패널을 닫았다 열어도 진행 표시가 이어진다. */
const translating = new Set();
const translatingKey = (record, index) => `${record.key}\n${index}`;
const isTranslating = (record, index) => translating.has(translatingKey(record, index));

function translateButton(fav, record, index, message, missing) {
    const busy = !missing && isTranslating(record, index);
    const open = !missing && (busy || view.subOpen === fav.id);
    return actionButton('translate', busy ? 'fa-spinner fa-spin' : 'fa-language', '번역', {
        disabled: missing,
        className: `cg-action--translate${open ? ' is-open' : ''}`,
        expanded: open,
    });
}

/** 번역 버튼 아래에 펼쳐지는 줄. 닫혀 있으면 빈 문자열. 번역하는 동안은 진행 표시만 보여 준다. */
function translateRow(fav, record, index, message, missing) {
    if (missing) return '';
    const busy = isTranslating(record, index);
    if (!busy && view.subOpen !== fav.id) return '';
    if (busy) {
        return '<div class="cg-card-sub" role="status"><span class="cg-sub-status"><span class="cg-spinner"></span>LLM 번역기로 번역하는 중…</span></div>';
    }
    const translated = hasTranslation(message);
    // 채팅 화면에서 '원문 보기'를 눌러 둔 메시지는 번역문이 치워져 있을 뿐이니, 새로 번역하지 않고 되살리는 버튼을 보여 준다.
    const showingOriginal = isShowingOriginal(message);
    const note = showingOriginal ? '원문을 보여 주는 중 (번역문 있음)'
        : !hasTranslator() ? 'LLM 번역기 확장이 꺼져 있어요'
            : translated ? '번역문을 보여 주는 중' : '아직 번역문이 없어요';
    const runLabel = showingOriginal ? '번역문 보기' : translated ? '다시 번역' : '번역하기';
    return `
        <div class="cg-card-sub" role="group" aria-label="번역">
            <span class="cg-sub-note">${note}</span>
            <button type="button" class="cg-sub-btn is-primary" data-card-act="translate-run"><i class="fa-solid ${showingOriginal ? 'fa-eye' : 'fa-wand-magic-sparkles'}"></i><span>${runLabel}</span></button>
            <button type="button" class="cg-sub-btn" data-card-act="translate-edit"><i class="fa-solid fa-pen-nib"></i><span>${translated ? '직접 고치기' : '직접 쓰기'}</span></button>
            <button type="button" class="cg-sub-btn is-danger" data-card-act="translate-clear" ${translated ? '' : 'disabled'}><i class="fa-solid fa-eraser"></i><span>지우기</span></button>
        </div>`;
}

function cardElement(favId) {
    return view.root?.querySelector(`.cg-card[data-fav-id="${CSS.escape(favId)}"]`) ?? null;
}

/** 카드를 통째로 다시 그리지 않고(안의 iframe이 다시 뜨지 않게) 번역 버튼과 아래 줄만 새로 그린다. */
function refreshTranslateUi(record, fav, index) {
    const card = cardElement(fav.id);
    if (!card) return;
    const message = record.messages?.[index];
    const missing = !message;
    card.querySelector('[data-card-act="translate"]').outerHTML = translateButton(fav, record, index, message, missing);
    card.querySelector('.cg-card-sub')?.remove();
    const row = translateRow(fav, record, index, message, missing);
    if (row) card.querySelector('.cg-card-actions').insertAdjacentHTML('afterend', row);
}

/** 데이터가 바뀐 카드가 지금 보이면 다시 그린다. 다른 채팅·다른 페이지를 보고 있으면 다음에 그릴 때 반영된다. */
function refreshCardIfVisible(record, favId) {
    if (!view.open || selectedRecord()?.key !== record.key) return;
    if (cardElement(favId)) rerenderCard(favId);
}

function toggleTranslateRow(record, fav, index) {
    const previous = view.subOpen;
    view.subOpen = previous === fav.id ? null : fav.id;
    if (previous && previous !== fav.id) {
        const previousFav = findBookmark(record, previous);
        const previousCard = cardElement(previous);
        if (previousFav && previousCard) refreshTranslateUi(record, previousFav, Number(previousCard.dataset.index));
    }
    refreshTranslateUi(record, fav, index);
}

/** 편집 창·확인 창이 떠 있는 메시지 (두 번 눌러 창이 겹치지 않게) */
const dialogs = new Set();

async function withDialog(record, index, task) {
    const key = translatingKey(record, index);
    if (dialogs.has(key)) return false;
    dialogs.add(key);
    try {
        return await task();
    } finally {
        dialogs.delete(key);
    }
}

/** 번역이 끝났는데 목록에 아직 그 채팅의 record가 없을 때(다른 채팅을 불러오는 중) 기억해 두었다가, 목록이 채워지면 다시 불러오게 한다. */
const staleKeys = new Set();

/** 같은 채팅의 새 record를 그 자리에서 다시 불러온다 (페이지·펼침·스크롤은 그대로 둔다). */
function reloadInPlace(live) {
    loadRecord(live, { force: true })
        .then(() => {
            if (view.open && selectedRecord() === live) renderMain();
        })
        .catch(error => console.warn('[북마크] 채팅을 다시 불러오지 못했습니다:', error));
}

/**
 * 오래 걸리는 일이 끝난 뒤 화면 맞추기.
 * 기다리는 사이에 패널을 다시 열었으면 같은 채팅이 새 record 객체로 바뀌어 있다. 그때는 그쪽을 다시 불러와 보여 준다
 * (파일에는 이미 반영되어 있다). changed가 아니면(실패) 카드를 통째로 다시 그리지 않고 번역 줄만 되돌린다.
 */
function afterTranslate(record, fav, index, changed) {
    const live = view.records.find(item => item.key === record.key) ?? null;
    if (!live) {
        if (changed) staleKeys.add(record.key);
        return;
    }
    if (live === record) {
        if (!view.open || selectedRecord() !== record) return;
        if (changed) refreshCardIfVisible(record, fav.id);
        else refreshTranslateUi(record, fav, index);
        return;
    }
    if (!changed) {
        if (view.open && selectedRecord() === live) refreshTranslateUi(live, fav, index);
        return;
    }
    if (live.isCurrent) refreshCardIfVisible(live, fav.id);
    else reloadInPlace(live);
}

async function runTranslate(record, fav, index) {
    if (isTranslating(record, index)) return;
    const key = translatingKey(record, index);
    const message = record.messages?.[index];

    // 채팅 화면에서 '원문 보기'로 치워 둔 번역문은 번역기를 부르지 않고 되살리기만 한다.
    if (isShowingOriginal(message)) {
        translating.add(key);
        refreshTranslateUi(record, fav, index);
        let changed = false;
        try {
            changed = await restoreTranslation(record, index);
            if (changed && view.subOpen === fav.id) view.subOpen = null;
            if (changed) toastr.success('번역문을 다시 보여 줘요.', '북마크', { timeOut: 1800 });
        } catch (error) {
            toastr.error(error.message, '북마크 번역', { timeOut: 8000 });
        } finally {
            translating.delete(key);
            afterTranslate(record, fav, index, changed);
        }
        return;
    }

    if (!hasTranslator()) {
        toastr.warning('LLM 번역기 확장이 꺼져 있거나 설치되어 있지 않아요. 확장 관리에서 켜 주세요.', '북마크');
        return;
    }
    // 이미 번역문이 있으면 저장된 것을 쓰지 않고 새로 번역한다 (돈이 드니 한 번 묻는다).
    const fresh = hasTranslation(message);
    if (fresh) {
        const confirmed = await withDialog(record, index, () => confirmSheet('이미 번역문이 있어요. LLM 번역기로 새로 번역해서 바꿀까요?', { title: '다시 번역', okLabel: '다시 번역', icon: 'fa-wand-magic-sparkles' }));
        if (!confirmed || isTranslating(record, index)) return;
    }

    translating.add(key);
    refreshTranslateUi(record, fav, index);
    let changed = false;
    try {
        const { fromCache } = await translateMessage(record, index, { fresh });
        changed = true;
        if (view.subOpen === fav.id) view.subOpen = null;
        toastr.success(fromCache ? '저장해 둔 번역문을 가져왔어요.' : '번역했어요.', '북마크', { timeOut: 1800 });
    } catch (error) {
        console.warn('[북마크] 번역하지 못했습니다:', error);
        toastr.error(error.message, '북마크 번역', { timeOut: 8000 });
    } finally {
        translating.delete(key);
        afterTranslate(record, fav, index, changed);
    }
}

function renderCard(record, fav, index) {
    const message = record.messages?.[index];
    const missing = !message;
    const isUser = message ? !!message.is_user : fav.role === 'user';
    const formatIndex = record.isCurrent ? index : null;
    const name = message?.name ?? fav.sender ?? '알 수 없음';
    const date = message ? formatDate(message.send_date) : '';
    const note = renderNoteHtml(fav.note);
    const reasoning = message ? renderReasoningHtml(message, formatIndex) : '';
    const body = message
        ? renderMessageHtml(message, formatIndex)
        : '<p class="cg-missing-text"><i class="fa-solid fa-link-slash"></i> 원본 메시지를 찾을 수 없어요. 지워졌거나 번호가 바뀌었을 수 있어요.</p>';
    const collapsed = settings().collapseLong && !view.expanded.has(fav.id);
    const indexLabel = Number.isFinite(index) && index !== Number.MAX_SAFE_INTEGER ? `#${index}` : '#?';
    const footer = fav.virtual
        ? `${actionButton('preview', 'fa-eye', '채팅에서', { disabled: missing })}
           ${actionButton('context', 'fa-layer-group', '앞뒤 문맥', { disabled: missing })}
           ${actionButton('mark', iconName(), '북마크', { className: 'cg-action--mark', disabled: missing })}`
        : `${actionButton('preview', 'fa-eye', '채팅에서', { disabled: missing })}
           ${actionButton('context', 'fa-layer-group', '앞뒤 문맥', { disabled: missing })}
           ${actionButton('note', 'fa-feather-pointed', fav.note ? '메모 수정' : '메모')}
           ${actionButton('edit', 'fa-pen-to-square', '원문 수정', { disabled: missing })}
           ${translateButton(fav, record, index, message, missing)}
           ${actionButton('delete', 'fa-trash-can', '삭제', { className: 'is-danger' })}`;

    return `
        <article class="cg-card ${isUser ? 'is-user' : 'is-ai'}${missing ? ' is-missing' : ''}${fav.virtual ? ' is-virtual' : ''}" data-fav-id="${escapeHtml(fav.id)}" data-index="${index}"${fav.virtual ? ' data-virtual="1"' : ''}>
            <span class="cg-ribbon" aria-hidden="true"></span>
            <header class="cg-card-head">
                <img class="cg-card-avatar" src="${escapeHtml(avatarForMessage(message ?? { is_user: isUser }, record.owner))}" alt="" loading="lazy" onerror="this.src='img/ai4.png'">
                <div class="cg-card-who">
                    <b>${escapeHtml(name)}</b>
                    <span>${indexLabel}${date ? ` · ${escapeHtml(date)}` : ''}</span>
                </div>
            </header>
            ${note ? `<div class="cg-note"><i class="fa-solid fa-quote-left" aria-hidden="true"></i><div class="salty-preview cg-chatlike" data-prev="bookmark"><div class="mes" is_user="${isUser}"><div class="mes_block"><div class="cg-note-text mes_text">${note}</div></div></div></div></div>` : ''}
            ${reasoning ? `<details class="cg-reasoning"><summary><i class="fa-solid fa-brain"></i> 생각 과정</summary><div class="mes_text">${reasoning}</div></details>` : ''}
            <div class="cg-card-body${collapsed ? ' is-collapsed' : ''}"><div class="salty-preview cg-chatlike" data-prev="bookmark"><div class="mes" is_user="${isUser}"><div class="mes_block"><div class="cg-mes mes_text">${body}</div></div></div></div></div>
            <button type="button" class="cg-expand" hidden><span>전체 보기</span><i class="fa-solid fa-chevron-down"></i></button>
            <footer class="cg-card-actions">
                ${footer}
            </footer>
            ${fav.virtual ? '' : translateRow(fav, record, index, message, missing)}
        </article>`;
}

function activateCard(card) {
    const mes = card.querySelector('.cg-mes');
    hydrateHtmlBlocks(mes);
    const noteRoot = card.querySelector('.cg-note-text');
    if (noteRoot) hydrateHtmlBlocks(noteRoot);
    view.bodyObserver.observe(mes);
    updateExpandButton(card);
    if (view.query) {
        highlightMatches(mes, view.query);
        const note = card.querySelector('.cg-note-text');
        if (note) highlightMatches(note, view.query);
    }
}

function updateExpandButton(card) {
    const body = card.querySelector('.cg-card-body');
    const button = card.querySelector('.cg-expand');
    if (!body || !button) return;
    if (!settings().collapseLong) {
        body.classList.remove('is-overflowing');
        button.hidden = true;
        return;
    }
    const expanded = view.expanded.has(card.dataset.favId);
    const overflows = !expanded && body.scrollHeight > body.clientHeight + 4;
    // 넘칠 때만 아래를 흐리게 한다 (짧은 메시지의 끝이 흐려지지 않게).
    body.classList.toggle('is-overflowing', overflows);
    button.hidden = !expanded && !overflows;
    button.classList.toggle('is-expanded', expanded);
    button.querySelector('span').textContent = expanded ? '접기' : '전체 보기';
}

function toggleExpand(card) {
    const id = card.dataset.favId;
    const expanding = !view.expanded.has(id);
    if (expanding) view.expanded.add(id);
    else view.expanded.delete(id);
    card.querySelector('.cg-card-body').classList.toggle('is-collapsed', !expanding);
    updateExpandButton(card);
    // 접을 때는 카드 머리로 돌아가서 읽던 자리를 잃지 않게 한다.
    if (!expanding) {
        const list = $('.cg-list');
        if (card.offsetTop < list.scrollTop) list.scrollTop = card.offsetTop - 8;
    }
}

function rerenderCard(favId) {
    const record = selectedRecord();
    const old = view.root.querySelector(`.cg-card[data-fav-id="${CSS.escape(favId)}"]`);
    const fav = record && (old?.dataset.virtual ? virtualFav(record, Number(old.dataset.index)) : findBookmark(record, favId));
    if (!old || !fav) return renderMain();
    const holder = document.createElement('div');
    holder.innerHTML = renderCard(record, fav, Number(old.dataset.index));
    const card = holder.firstElementChild;
    old.replaceWith(card);
    activateCard(card);
}

function renderPager(totalPages) {
    const pager = $('.cg-pager');
    if (totalPages <= 1) {
        pager.hidden = true;
        pager.innerHTML = '';
        return;
    }
    pager.hidden = false;
    pager.innerHTML = `
        <button type="button" class="cg-page-btn" data-page="${view.page - 1}" ${view.page <= 1 ? 'disabled' : ''} aria-label="이전 페이지"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" class="cg-page-now" data-act="jump" title="눌러서 페이지 번호 입력"><span class="cg-page-label"><b>${view.page}</b><span>/ ${totalPages}</span></span></button>
        <button type="button" class="cg-page-btn" data-page="${view.page + 1}" ${view.page >= totalPages ? 'disabled' : ''} aria-label="다음 페이지"><i class="fa-solid fa-chevron-right"></i></button>`;
    pager.dataset.total = String(totalPages);
}

function goToPage(page) {
    const total = Number($('.cg-pager').dataset.total || 1);
    const next = Math.min(total, Math.max(1, page));
    if (next === view.page) return;
    view.page = next;
    renderMain();
    $('.cg-list').scrollTop = 0;
}

function startPageJump(button) {
    const total = Number($('.cg-pager').dataset.total || 1);
    button.innerHTML = `<input type="number" inputmode="numeric" min="1" max="${total}" value="${view.page}" aria-label="페이지 번호"><span>/ ${total}</span>`;
    const input = button.querySelector('input');
    input.focus();
    input.select();
    const finish = () => {
        const page = Number.parseInt(input.value, 10);
        if (Number.isFinite(page) && page !== view.page) goToPage(page);
        else renderPager(total);
    };
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
        if (event.key === 'Escape') {
            event.stopPropagation();
            input.value = String(view.page);
            input.blur();
        }
    });
    input.addEventListener('blur', finish, { once: true });
    input.addEventListener('click', event => event.stopPropagation());
}

// ── 설정 화면·서랍 ──────────────────────────────────────────

function openSettings() {
    const page = $('.cg-settings-page');
    const record = selectedRecord();
    renderSettingsPage(page, record ? { key: record.key, label: record.label } : null, () => closeSettings());
    page.hidden = false;
    void page.offsetWidth;
    page.classList.add('is-open');
}

function closeSettings({ immediate = false } = {}) {
    const page = view.root && $('.cg-settings-page');
    if (!page || page.hidden) return;
    page.classList.remove('is-open');
    const hide = () => {
        // 닫히는 동안 다시 열었으면 새로 그린 설정 화면을 지우지 않는다.
        if (page.classList.contains('is-open')) return;
        page.hidden = true;
        page.replaceChildren();
        disposeSettingsPage();
    };
    if (immediate) hide();
    else setTimeout(hide, 220);
    // 저장하지 않은 색 미리보기를 되돌린다.
    applyColors(colorsFor(view.selectedKey ?? currentChatKey()));
}

function isSettingsOpen() {
    const page = view.root && $('.cg-settings-page');
    return !!page && !page.hidden && page.classList.contains('is-open');
}

// 채팅 목록 서랍은 좁은 화면에서만 쓴다 (넓은 화면은 왼쪽에 항상 보인다).
const NARROW_SCREEN = window.matchMedia('(max-width: 760px)');

function toggleDrawer(force) {
    if (!NARROW_SCREEN.matches) return;
    const windowElement = $('.cg-window');
    windowElement.classList.toggle('is-drawer-open', force ?? !windowElement.classList.contains('is-drawer-open'));
}

function closeDrawer() {
    view.root && $('.cg-window').classList.remove('is-drawer-open');
}

function isDrawerOpen() {
    return !!view.root && $('.cg-window').classList.contains('is-drawer-open');
}

// ── 이벤트 ──────────────────────────────────────────────────

async function onCardAction(action, card) {
    const record = selectedRecord();
    const index = Number(card.dataset.index);
    const fav = record && (card.dataset.virtual ? virtualFav(record, index) : findBookmark(record, card.dataset.favId));
    if (!fav) return;
    switch (action) {
        case 'mark': {
            // 전체 메시지 검색에서 찾은 메시지를 북마크로 만든다. 이미 있으면 그대로 둔다.
            if (bookmarkAt(record, index)) break;
            try {
                await addBookmark(record, index);
            } catch (error) {
                toastr.error(error.message, '북마크');
                break;
            }
            const scrollTop = $('.cg-list').scrollTop;
            renderSidebar();
            renderMain();
            $('.cg-list').scrollTop = scrollTop;
            hooks.refreshMessageIcons();
            toastr.success('북마크에 넣었어요.', '북마크', { timeOut: 1800 });
            break;
        }
        case 'preview':
            await enterPreview(record, index);
            break;
        case 'context':
            await openContextViewer(record, index);
            break;
        case 'note':
            await openNoteEditor(record, fav);
            if (view.open) rerenderCard(fav.id);
            break;
        case 'edit':
            // 번역을 기다리는 사이에 원문을 바꾸면 번역문이 엉뚱한 글에 붙으니 끝난 뒤에 고치게 한다.
            if (isTranslating(record, index)) {
                toastr.info('번역이 끝난 뒤에 원문을 고쳐 주세요.', '북마크');
                break;
            }
            if (await openMessageEditor(record, index)) rerenderCard(fav.id);
            break;
        case 'translate':
            toggleTranslateRow(record, fav, index);
            break;
        case 'translate-run':
            await runTranslate(record, fav, index);
            break;
        case 'translate-edit':
            if (isTranslating(record, index)) break;
            if (await withDialog(record, index, () => openTranslationEditor(record, index))) {
                if (view.subOpen === fav.id) view.subOpen = null;
                afterTranslate(record, fav, index, true);
            }
            break;
        case 'translate-clear':
            if (isTranslating(record, index)) break;
            if (await withDialog(record, index, () => confirmClearTranslation(record, index))) {
                if (view.subOpen === fav.id) view.subOpen = null;
                afterTranslate(record, fav, index, true);
                toastr.success('번역문을 지웠어요.', '북마크', { timeOut: 1800 });
            }
            break;
        case 'delete':
            if (await confirmDeleteBookmark(record, fav)) {
                const scrollTop = $('.cg-list').scrollTop;
                renderSidebar();
                renderMain();
                $('.cg-list').scrollTop = scrollTop;
                hooks.refreshMessageIcons();
                toastr.success('북마크를 지웠어요.', '북마크', { timeOut: 1800 });
            }
            break;
    }
}

/** 전체 메시지 검색을 켜고 끈다. 끌 때 북마크 없는 다른 채팅을 보고 있었으면 현재 채팅으로 돌아간다. */
function setAllMessages(on) {
    view.allMessages = on;
    view.page = 1;
    $('[data-act="all-messages"]').setAttribute('aria-pressed', String(on));
    if (on && view.noteOnly) {
        view.noteOnly = false;
        $('[data-act="note-only"]').setAttribute('aria-pressed', 'false');
    }
    $('[data-act="note-only"]').hidden = on;
    if (!on) {
        const record = selectedRecord();
        if (record && !record.isCurrent && !record.favorites.length) {
            const current = view.records.find(item => item.isCurrent);
            view.selectedKey = current?.key ?? null;
            applyColors(colorsFor(view.selectedKey ?? currentChatKey()));
        }
    }
    renderSidebar();
    renderMain();
}

function onClick(event) {
    const target = event.target;
    if (target === view.root) return closePanel();

    const cardAction = target.closest('[data-card-act]');
    if (cardAction) {
        onCardAction(cardAction.dataset.cardAct, cardAction.closest('.cg-card'));
        return;
    }
    const expand = target.closest('.cg-expand');
    if (expand) return toggleExpand(expand.closest('.cg-card'));

    const chatItem = target.closest('[data-chat-key]');
    if (chatItem) return selectChat(chatItem.dataset.chatKey);

    const pageButton = target.closest('[data-page]');
    if (pageButton && !pageButton.disabled) return goToPage(Number(pageButton.dataset.page));

    const action = target.closest('[data-act]')?.dataset.act;
    switch (action) {
        case 'close':
            return closePanel();
        case 'drawer':
            return toggleDrawer();
        case 'drawer-close':
            return closeDrawer();
        case 'settings':
            return openSettings();
        case 'search': {
            const bar = $('.cg-searchbar');
            bar.hidden = !bar.hidden;
            if (!bar.hidden) {
                bar.querySelector('input').focus();
            } else if (view.query || view.allMessages) {
                bar.querySelector('input').value = '';
                $('.cg-search-clear').hidden = true;
                view.query = '';
                if (view.allMessages) setAllMessages(false);
                else renderMain();
            }
            return;
        }
        case 'all-messages':
            setAllMessages(!view.allMessages);
            $('.cg-searchbar input').focus();
            return;
        case 'search-clear': {
            event.preventDefault();
            const input = $('.cg-searchbar input');
            input.value = '';
            $('.cg-search-clear').hidden = true;
            view.query = '';
            view.page = 1;
            renderMain();
            input.focus();
            return;
        }
        case 'note-only': {
            view.noteOnly = !view.noteOnly;
            target.closest('[data-act]').setAttribute('aria-pressed', String(view.noteOnly));
            view.page = 1;
            renderMain();
            return;
        }
        case 'sort':
            settings().sortOrder = settings().sortOrder === 'desc' ? 'asc' : 'desc';
            saveSettings();
            view.page = 1;
            renderMain();
            $('.cg-list').scrollTop = 0;
            return;
        case 'jump':
            if (!target.closest('input')) startPageJump(target.closest('[data-act]'));
            return;
    }
}

// Esc: 맨 위 창부터 하나씩 닫는다. 실리태번의 Esc 처리보다 먼저 받는다.
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    let handled = false;
    if (hasOpenSheet()) handled = closeTopSheet();
    else if (view.open && isSettingsOpen()) { closeSettings(); handled = true; }
    else if (view.open && isDrawerOpen()) { closeDrawer(); handled = true; }
    else if (view.open) { closePanel(); handled = true; }
    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }
}, true);
