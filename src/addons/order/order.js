// 확장 순서 — 설정 창들을 찾아서 원하는 차례로 옮기는 부분
//
// 실리태번은 확장 설정을 두 칸(#extensions_settings, #extensions_settings2)에 나눠 붙인다.
// 두 칸 모두 세로 flex라 창 하나하나가 그대로 flex 항목이고, 사이에 낀 .extension_container 는
// display:contents 라서 자리만 잡아 줄 뿐 보이지 않는다.
//
// 한 줄로 세우려면 칸을 넘나들어야 해서, 모든 창을 첫째 칸으로 모으고 빈 둘째 칸은 숨긴다.
// (폰에서는 두 칸이 100% 너비로 위아래에 쌓이기 때문에, 안 모으면 둘째 칸 창을 위로 올릴 수가 없다.)
// 넓은 화면(1001px 이상)에서는 두 칸이 나란히 서므로, 설정(twoColumns)이 켜져 있고 고정한 창과 나머지가 둘 다 있으면
// 왼쪽 칸 = 고정한 창, 오른쪽 칸 = 나머지 로 나눈다. 구분선은 한 줄일 때만 긋는다.
import { settings } from './state.js';

const COLUMNS = ['extensions_settings', 'extensions_settings2'];
const HOME = 'extensions_settings';
export const DIVIDER_ID = 'po-divider';
const WIDE = '(min-width: 1001px)'; // 실리태번 mobile-styles 가 1000px 이하에서 두 칸을 위아래로 쌓는다

/** 설정 창일 리 없는 것들 — 칸에 끼어 있어도 줄 세우기에서 뺀다 */
const NOT_PANEL = new Set(['STYLE', 'SCRIPT', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

/** 제목에서 빼고 읽을 것들 — 버전 배지, 아이콘, 접기 화살표, 버튼 */
const STRIP = '.ext-version, [class*="-version"], [class*="_version"], .inline-drawer-icon, i, svg, button, input, select, textarea';

function isPanel(el) {
    return el instanceof HTMLElement && el.id !== DIVIDER_ID && !NOT_PANEL.has(el.tagName);
}

/**
 * 창을 알아보는 이름표. 새로고침해도 같아야 해서 제목이 아니라 id·class로 만든다.
 * class 는 순서가 뒤바뀔 수 있어 정렬해서 붙인다.
 * (번역 칸에는 실리태번 기본 '채팅 번역'과 우리 '번역'이 같이 들어 있는데,
 *  둘 다 translation_settings 를 갖고 있어서 class 를 전부 이어 붙여야 구별된다.)
 */
export function keyOf(el) {
    if (el.id) return `id:${el.id}`;
    const cls = [...el.classList].filter(Boolean).sort().join('.');
    return cls ? `cls:${cls}` : `tag:${el.tagName.toLowerCase()}`;
}

/** 창 제목. 못 찾으면 이름표를 그대로 쓴다. */
export function labelOf(el) {
    const head = el.querySelector('.inline-drawer-toggle, .inline-drawer-header')
        ?? el.querySelector('b, h3, h4');
    if (!head) return keyOf(el);
    const title = head.querySelector('b, h3, h4') ?? head;
    const clone = title.cloneNode(true);
    clone.querySelectorAll(STRIP).forEach(node => node.remove());
    const text = clone.textContent
        .replace(/\s+/g, ' ')
        .trim()
        // 앞뒤에 남은 물음표 같은 장식을 떼어 낸다 (글자·숫자로 시작하고 끝나게)
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/[^\p{L}\p{N})\]]+$/u, '');
    return text || keyOf(el);
}

/** 두 칸에 들어 있는 설정 창을 모두 찾는다. */
export function scan() {
    const used = new Set();
    const panels = [];

    const take = (el, box) => {
        if (!isPanel(el)) return;
        // 한 번 정한 이름표는 그 창에 적어 두고 계속 쓴다.
        // 다시 셀 때마다 번호를 새로 매기면, 이름표가 겹치는 창끼리 번호가 뒤바뀌면서
        // 고정해 둔 것이 엉뚱한 창으로 옮겨 가 화면이 열 때마다 뒤집힌다.
        let key = el.dataset.poKey;
        if (!key || used.has(key)) {
            const base = keyOf(el);
            key = base;
            let nth = 1;
            while (used.has(key)) key = `${base}#${++nth}`;
            el.dataset.poKey = key;
        }
        used.add(key);
        // 칸(.extension_container)에 이 창 하나뿐이면 창이 아니라 칸째로 옮긴다.
        // 정규식은 '#regex_container 안의 …' 로 자기 목록을 찾기 때문에, 칸에서 꺼내면
        // 일괄 편집(전체 선택·켜고 끄기·삭제·내보내기)이 아무 말 없이 죽는다.
        const node = box && box.children.length === 1 ? box : el;
        panels.push({ el, key, label: labelOf(el), node });
    };

    for (const colId of COLUMNS) {
        const col = document.getElementById(colId);
        if (!col) continue;
        for (const child of [...col.children]) {
            // .extension_container 는 display:contents 라 그 안의 창이 진짜 항목이다
            if (child.classList?.contains('extension_container')) {
                for (const kid of [...child.children]) take(kid, child);
            } else {
                take(child, null);
            }
        }
    }
    return panels;
}

/** 설정대로 줄 세운 결과 — 위(고정)와 아래(나머지) */
export function desired(panels) {
    const store = settings();
    const byKey = new Map(panels.map(panel => [panel.key, panel]));

    // 설정이 망가져 있어도 줄 세우기는 계속돼야 한다 (관찰자 안에서 터지면 다시는 못 세운다)
    const pinnedKeys = Array.isArray(store.pinned) ? store.pinned : [];
    const orderKeys = Array.isArray(store.order) ? store.order : [];

    const pinned = [];
    for (const key of pinnedKeys) {
        const panel = byKey.get(key);
        if (!panel) continue; // 꺼 둔 확장 — 건너뛴다
        pinned.push(panel);
        byKey.delete(key);
    }

    const rest = [...byKey.values()];
    if (store.auto) {
        rest.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    } else {
        const rank = new Map(orderKeys.map((key, i) => [key, i]));
        rest.sort((a, b) => {
            // 목록에 없는 새 확장은 맨 뒤에 가나다순으로 붙인다
            const ra = rank.has(a.key) ? rank.get(a.key) : Number.MAX_SAFE_INTEGER;
            const rb = rank.has(b.key) ? rank.get(b.key) : Number.MAX_SAFE_INTEGER;
            return ra - rb || a.label.localeCompare(b.label, 'ko');
        });
    }
    return { pinned, rest };
}

function makeDivider() {
    const hr = document.createElement('div');
    hr.id = DIVIDER_ID;
    hr.className = 'po-divider';
    hr.setAttribute('aria-hidden', 'true');
    return hr;
}

/** 한 칸에 지금 보이는 창의 차례 (빈 칸막이는 건너뛰고, 구분선은 '|' 로) */
function sequenceOf(col) {
    const out = [];
    for (const child of col.children) {
        if (child.id === DIVIDER_ID) { out.push('|'); continue; }
        if (child.classList?.contains('extension_container')) {
            for (const kid of child.children) if (isPanel(kid)) out.push(kid);
            continue;
        }
        if (isPanel(child)) out.push(child);
    }
    return out;
}

/** 창이 하나도 남지 않은 둘째 칸은 숨긴다 (가로 절반을 빈 칸이 차지하지 않도록). */
function hideEmptyColumn() {
    const col = document.getElementById(COLUMNS[1]);
    if (!col) return;
    col.style.display = sequenceOf(col).length ? '' : 'none';
}

/** 한 칸을 원하는 차례로 맞춘다. 앞에서부터 이미 맞는 만큼은 건드리지 않는다 (다 떼었다 붙이면 글 쓰던 칸의 초점과 한글 조합이 날아간다).
 *  돌려주는 값: 실제로 옮긴 것이 있는지 */
function reconcile(col, wantedPanels, wantedNodes) {
    const now = sequenceOf(col);
    let same = 0;
    while (same < now.length && same < wantedPanels.length && now[same] === wantedPanels[same]) same++;
    if (same === now.length && same === wantedPanels.length) return false;
    // 어긋나는 지점부터만 다시 붙인다 (appendChild 는 옮기기라 원래 자리에서 빠진다 — 다른 칸에 있던 창도 이리로 온다)
    const frag = document.createDocumentFragment();
    for (let i = same; i < wantedNodes.length; i++) frag.appendChild(wantedNodes[i]);
    col.appendChild(frag);
    // 남은 창(원하는 목록에 없는 것)은 뒤에 그대로 붙어 있으므로 다음 칸의 reconcile 이 가져간다
    return true;
}

let applying = false;

/** 설정대로 창을 옮긴다. */
export function apply() {
    if (applying) return;
    const home = document.getElementById(HOME);
    if (!home) return;

    const panels = scan();
    if (!panels.length) return;

    const store = settings();
    const { pinned, rest } = desired(panels);
    const other = document.getElementById(COLUMNS[1]);
    // 두 칸: 넓은 화면 · 설정 켬 · 고정한 창과 나머지가 둘 다 있을 때만 (한쪽이 비면 빈 칸이 가로 절반을 먹으니 한 줄로)
    const split = store.twoColumns !== false && !!other && pinned.length > 0 && rest.length > 0 && matchMedia(WIDE).matches;
    const ordered = split ? pinned : [...pinned, ...rest];
    const dividerAt = !split && store.divider && pinned.length && rest.length ? pinned.length : -1;

    let divider = document.getElementById(DIVIDER_ID);
    if (dividerAt < 0) { divider?.remove(); divider = null; }
    else if (!divider) divider = makeDivider();

    // 견줄 차례(창 자체)와 실제로 옮길 마디(칸 또는 창)를 나란히 만든다
    const wantedPanels = [];
    const wantedNodes = [];
    ordered.forEach((panel, i) => {
        if (divider && i === dividerAt) { wantedPanels.push('|'); wantedNodes.push(divider); }
        wantedPanels.push(panel.el);
        wantedNodes.push(panel.node);
    });
    const otherPanels = split ? rest.map(panel => panel.el) : [];
    const otherNodes = split ? rest.map(panel => panel.node) : [];

    // 둘째 칸에 남아 있으면 안 되는 창(한 줄일 때 전부, 두 칸일 때 고정한 창)이 있는지도 본다
    const otherNow = other ? sequenceOf(other) : [];
    const otherOk = otherNow.length === otherPanels.length && otherNow.every((el, i) => el === otherPanels[i]);
    const homeNow = sequenceOf(home);
    const homeOk = homeNow.length === wantedPanels.length && homeNow.every((el, i) => el === wantedPanels[i]);

    if (homeOk && otherOk) {
        hideEmptyColumn();
        refreshWatch();
        return;
    }

    applying = true;
    stopWatching();
    try {
        reconcile(home, wantedPanels, wantedNodes);
        if (other) reconcile(other, otherPanels, otherNodes);
        // 첫째 칸 뒤에 남은 것(둘째 칸이 가져가지 않은 창)은 없어야 하지만, 혹시 있으면 한 번 더
        if (sequenceOf(home).length !== wantedPanels.length) reconcile(home, wantedPanels, wantedNodes);
        hideEmptyColumn();
    } finally {
        applying = false;
        startWatching();
    }
}

let observer = null;
let timer = null;

function schedule(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; apply(); }, delay);
}

function startWatching() {
    if (observer) return;
    observer = new MutationObserver(() => { if (!applying) schedule(); });
    for (const colId of COLUMNS) {
        const col = document.getElementById(colId);
        if (!col) continue;
        // 칸과 그 안의 칸막이만 본다. 창 속까지 보면 목록이 새로 그려질 때마다 깨어난다.
        observer.observe(col, { childList: true });
        for (const box of col.querySelectorAll('.extension_container')) observer.observe(box, { childList: true });
    }
}

function stopWatching() {
    observer?.disconnect();
    observer = null;
}

/**
 * 칸막이는 나중에 생기기도 한다. 그때 그 칸막이도 지켜보게 다시 건다.
 * 안 걸면 늦게 생긴 칸막이 안에 붙은 창이 숨긴 둘째 칸에 갇혀 안 보인다.
 */
function refreshWatch() {
    stopWatching();
    startWatching();
}

/**
 * 창이 늦게 붙는 확장이 많고, 한글화 스크립트가 제목을 나중에 바꾸기도 한다.
 * 그래서 처음에 몇 번 더 줄을 세우고, 확장 서랍을 열 때마다 다시 세운다.
 */
export function startEngine() {
    apply();
    startWatching();
    for (const delay of [400, 1500, 4000]) setTimeout(apply, delay);
    document.querySelector('#extensions-settings-button > .drawer-toggle')
        ?.addEventListener('click', () => schedule(50));
    // 창 폭이 1000px 을 넘나들면 한 줄 ↔ 두 칸을 다시 세운다
    matchMedia(WIDE).addEventListener('change', () => schedule(50));
}

/** 설정을 바꾼 뒤 바로 다시 세운다. */
export function applyNow() {
    clearTimeout(timer);
    timer = null;
    apply();
}
