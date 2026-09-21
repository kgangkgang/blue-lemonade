// 확장 순서 — 위쪽 버튼 줄의 아이콘과, 눌렀을 때 뜨는 순서 창
//
// 설정 서랍을 따로 두지 않는다. 서랍을 두면 이 확장도 목록에 한 줄을 차지해서,
// 정작 줄 세우려던 목록을 스스로 어지럽힌다. (사용자: "밑에있으니까 얘도 확장프로그램같아서 별로네")
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { settings, saveSettings, resetSettings, VERSION, TITLE } from './state.js';
import { scan, desired, applyNow } from './order.js';

const BUTTON_ID = 'po-open';

/** 순서 창이 열려 있는 동안의 뿌리. 닫히면 비운다. */
let dialogRoot = null;
const inlineRoots = new Set();
const pendingInline = new Set();

function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]
    ));
}

/** 확장 서랍 맨 위 버튼 줄에 아이콘 하나를 놓는다. */
export function mountButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const anchor = document.getElementById('third_party_extension_button');
    if (!anchor || !anchor.parentElement) return;

    const button = document.createElement('div');
    button.id = BUTTON_ID;
    button.className = 'menu_button po-open';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    // 이름표는 읽어 주는 기계용으로만 둔다. 마우스를 올렸을 때 뜨는 설명은 넣지 않는다.
    button.setAttribute('aria-label', TITLE);
    button.innerHTML = '<i class="fa-solid fa-arrow-down-short-wide"></i>';
    button.addEventListener('click', openDialog);
    button.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDialog();
    });
    anchor.insertAdjacentElement('afterend', button);
}

function buildContent() {
    const root = document.createElement('div');
    root.className = 'po-dialog';
    root.innerHTML = `
        <h3 class="po-title"><i class="fa-solid fa-arrow-down-short-wide"></i> ${TITLE} <span class="po-version ext-version">v${VERSION}</span></h3>
        <p class="po-hint">확장 설정 창이 보이는 차례를 정해요. 압정을 누른 확장은 줄 위에 붙어 있어요.</p>

        <label class="checkbox_label po-opt" for="po_auto">
            <input type="checkbox" id="po_auto">
            <span>가나다순으로 자동 정렬</span>
        </label>
        <label class="checkbox_label po-opt" for="po_divider">
            <input type="checkbox" id="po_divider">
            <span>고정한 확장 아래에 줄 긋기</span>
        </label>
        <label class="checkbox_label po-opt" for="po_two">
            <input type="checkbox" id="po_two">
            <span>넓은 화면에서 두 칸 (왼쪽 고정 · 오른쪽 나머지)</span>
        </label>

        <div class="po-list"></div>

        <div class="po-foot">
            <span class="po-count"></span>
            <button type="button" class="menu_button" id="po_reset">처음으로</button>
        </div>`;

    root.querySelector('#po_auto').addEventListener('change', event => {
        const store = settings();
        const on = event.target.checked;
        // 끄는 경우에는 auto를 바꾸기 전에 '지금 보이는 차례'를 먼저 읽어 둔다.
        // 먼저 바꿔 버리면 예전에 잡아 둔 순서가 읽혀서 화면이 갑자기 뒤섞인다.
        const visible = on ? null : visibleRestKeys();
        store.auto = on;
        if (!on) captureVisibleOrder(visible);
        saveSettings();
        applyNow();
        renderList();
    });

    root.querySelector('#po_divider').addEventListener('change', event => {
        settings().divider = event.target.checked;
        saveSettings();
        applyNow();
        renderList();
    });

    root.querySelector('#po_two').addEventListener('change', event => {
        settings().twoColumns = event.target.checked;
        saveSettings();
        applyNow();
        renderList();
    });

    root.querySelector('#po_reset').addEventListener('click', () => {
        resetSettings();
        applyNow();
        renderList();
    });

    root.querySelector('.po-list').addEventListener('click', event => {
        const button = event.target.closest('button[data-act]');
        if (!button || button.disabled) return;
        const item = button.closest('.po-item');
        if (!item) return;
        act(item.dataset.key, item.dataset.group, button.dataset.act);
    });

    return root;
}

export async function openDialog() {
    const embedded=[...inlineRoots].find(root=>root.isConnected);
    if(embedded){embedded.scrollIntoView({block:'nearest'});return;}
    if(dialogRoot)return;
    const content = buildContent();
    dialogRoot = content;
    renderList();
    try {
        await callGenericPopup(content, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: popup => popup?.dlg?.classList.add('bl-roomy-dialog') });
    } finally {
        dialogRoot = null;
        for(const mount of pendingInline)mount();pendingInline.clear();
    }
}

/** 지금 화면에 보이는, 고정하지 않은 확장들의 이름표 */
function visibleRestKeys() {
    return desired(scan()).rest.map(panel => panel.key);
}

/**
 * ▲▼를 누르기 전에 목록을 채워 둔다.
 * 꺼 둔 확장의 자리는 절대 지우지 않는다 — 지우면 그 확장을 다시 켰을 때 맨 뒤로 밀린다.
 */
function ensureOrder(visibleKeys = visibleRestKeys()) {
    const store = settings();
    const kept = [...store.order];
    for (const key of visibleKeys) if (!kept.includes(key)) kept.push(key);
    store.order = kept;
    return store.order;
}

/**
 * 자동 정렬을 끌 때: 지금 보이는 차례를 그대로 옮겨 적는다.
 * 꺼 둔 확장의 자리는 잃지 않게 뒤에 남겨 둔다.
 */
function captureVisibleOrder(visibleKeys) {
    const store = settings();
    const hidden = store.order.filter(key => !visibleKeys.includes(key));
    store.order = [...visibleKeys, ...hidden];
    return store.order;
}

/**
 * 보이는 이웃과 자리를 맞바꾼다.
 * 목록에는 꺼 둔 확장의 이름표도 섞여 있어서, 칸 번호로 옮기면 화면이 그대로인 채 눌리기만 한다.
 */
function swapWithNeighbour(list, visibleKeys, key, delta) {
    const at = visibleKeys.indexOf(key);
    if (at < 0) return;
    const neighbour = visibleKeys[at + delta];
    if (neighbour === undefined) return;
    const a = list.indexOf(key);
    const b = list.indexOf(neighbour);
    if (a < 0 || b < 0) return;
    [list[a], list[b]] = [list[b], list[a]];
}

function act(key, group, action) {
    const store = settings();
    if (action === 'pin') {
        const at = store.pinned.indexOf(key);
        if (at >= 0) store.pinned.splice(at, 1);
        else {
            store.pinned.push(key);
            store.order = store.order.filter(k => k !== key);
        }
        // 고정을 풀었으면 아래쪽 목록에 자리가 있어야 한다
        if (!store.auto) ensureOrder();
    } else {
        // 바꾸기 전의 보이는 차례를 먼저 읽어 둔다
        const visible = group === 'pin'
            ? desired(scan()).pinned.map(panel => panel.key)
            : visibleRestKeys();
        const list = group === 'pin' ? store.pinned : ensureOrder(visible);
        swapWithNeighbour(list, visible, key, action === 'up' ? -1 : 1);
    }
    saveSettings();
    applyNow();
    renderList();
}

function rowHtml(panel, group, index, total, movable) {
    const pinned = group === 'pin';
    const locked = movable ? '' : ' disabled';
    const up = locked || (index === 0 ? ' disabled' : '');
    const down = locked || (index === total - 1 ? ' disabled' : '');
    return `<div class="po-item" data-key="${esc(panel.key)}" data-group="${group}">
        <button type="button" class="po-pin${pinned ? ' is-on' : ''}" data-act="pin" aria-label="${pinned ? '고정 풀기' : '위에 고정하기'}"><i class="fa-solid fa-thumbtack"></i></button>
        <span class="po-label">${esc(panel.label)}</span>
        <button type="button" class="po-move" data-act="up" aria-label="위로"${up}><i class="fa-solid fa-chevron-up"></i></button>
        <button type="button" class="po-move" data-act="down" aria-label="아래로"${down}><i class="fa-solid fa-chevron-down"></i></button>
    </div>`;
}

export function renderList() {
    for(const root of [dialogRoot,...inlineRoots].filter(Boolean)) renderRoot(root);
}
function renderRoot(root) {
    const store = settings();
    const { pinned, rest } = desired(scan());

    root.querySelector('#po_auto').checked = store.auto;
    root.querySelector('#po_divider').checked = store.divider;
    root.querySelector('#po_two').checked = store.twoColumns !== false;

    const rows = [];
    pinned.forEach((panel, i) => rows.push(rowHtml(panel, 'pin', i, pinned.length, true)));
    if (store.divider && pinned.length && rest.length) rows.push('<div class="po-line" aria-hidden="true"></div>');
    rest.forEach((panel, i) => rows.push(rowHtml(panel, 'rest', i, rest.length, !store.auto)));

    const list = root.querySelector('.po-list');
    list.innerHTML = rows.length ? rows.join('') : '<div class="po-empty">보이는 확장이 없어요</div>';
    root.querySelector('.po-count').textContent = `${pinned.length + rest.length}개`;
}

export function mountInline(host) {
    let root=null,alive=true;
    const mount=()=>{if(!alive)return;root=buildContent();inlineRoots.add(root);host.replaceChildren(root);renderRoot(root);};
    if(dialogRoot){host.textContent='열린 설정창을 닫으면 여기에 표시돼요.';pendingInline.add(mount);}else mount();
    return ()=>{alive=false;pendingInline.delete(mount);if(root){inlineRoots.delete(root);root.remove();}};
}
