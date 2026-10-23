import { panelVisible } from './panel-hidden.js';
import {startMenuOrdering} from './menus.js';
import { keyOf as panelKeyOf, legacyKeyOf, migrateKeys } from './panel-keys.js';   // 1.2.4 공용 틀 창은 바깥 칸 id 로 · 예전 이름표 옮기기
import { getSettings as themeSettings, saveSettings as saveThemeSettings } from '../../settings.js';   // 1.2.4 확장 위 스위치(headSwitches)도 같은 이름표
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
import { settings, saveSettings } from './state.js';

const COLUMNS = ['extensions_settings', 'extensions_settings2'];
const HOME = 'extensions_settings';
export const DIVIDER_ID = 'po-divider';
const WIDE = 'not all and (max-width: 1000px)'; // 실리태번 mobile-styles 가 1000px 이하에서 두 칸을 위아래로 쌓는다

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
// 1.2.4 공용 틀 class(inline-drawer …)뿐인 창은 바깥 칸(.extension_container)의 id 로 — panel-keys.js
export function keyOf(el, box) {
    return panelKeyOf(el, box);
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
    const used = new Set(), usedLegacy = new Set();
    const panels = [];

    const take = (el, box) => {
        if (!isPanel(el)) return;
        // 한 번 정한 이름표는 그 창에 적어 두고 계속 쓴다.
        // 다시 셀 때마다 번호를 새로 매기면, 이름표가 겹치는 창끼리 번호가 뒤바뀌면서
        // 고정해 둔 것이 엉뚱한 창으로 옮겨 가 화면이 열 때마다 뒤집힌다.
        let key = el.dataset.poKey;
        if (!key || used.has(key)) {
            const base = keyOf(el, box ?? undefined);
            key = base;
            let nth = 1;
            while (used.has(key)) key = `${base}#${++nth}`;
            el.dataset.poKey = key;
        }
        used.add(key);
        // 1.2.4 예전(1.2.3) 이름표도 같은 방식(처음 본 차례로 번호)으로 적어 둔다 — 저장된 예전 이름표를 지금 가리키는 창의 새 이름표로 옮길 때 쓴다
        let legacy = el.dataset.poLegacy;
        if (!legacy || usedLegacy.has(legacy)) {
            const base = legacyKeyOf(el);
            legacy = base;
            let nth = 1;
            while (usedLegacy.has(legacy)) legacy = `${base}#${++nth}`;
            el.dataset.poLegacy = legacy;
        }
        usedLegacy.add(legacy);
        // 칸(.extension_container)에 이 창 하나뿐이면 창이 아니라 칸째로 옮긴다.
        // 정규식은 '#regex_container 안의 …' 로 자기 목록을 찾기 때문에, 칸에서 꺼내면
        // 일괄 편집(전체 선택·켜고 끄기·삭제·내보내기)이 아무 말 없이 죽는다.
        // 셀 때는 children 이 아니라 '창' 만 센다 — 그림 생성 확장처럼 칸 안에 설정 HTML 과 <style> 을
        // 같이 넣는 확장이 있어서, 그냥 세면 둘로 보여 창을 칸 밖으로 꺼내 버린다. 꺼내지면
        // 그 확장의 '#칸id 안의 …' 규칙이 통째로 안 걸려 제 색 변수가 사라진다(그림 생성 확장이 흰 글자로 남았음).
        const node = box && [...box.children].filter(isPanel).length === 1 ? box : el;
        panels.push({ el, key, legacy, label: labelOf(el), node });
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

/** 5.8.4: 서로 다른 수의 줄에서 가장 긴 증가 부분 줄(LIS)에 든 값들 */
function longestRun(values) {
    const ends = [], prev = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
        let lo = 0, hi = ends.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (values[ends[mid]] < values[i]) lo = mid + 1; else hi = mid; }
        prev[i] = lo ? ends[lo - 1] : -1;
        ends[lo] = i;
    }
    const out = new Set();
    for (let i = ends.length ? ends[ends.length - 1] : -1; i >= 0; i = prev[i]) out.add(values[i]);
    return out;
}

/** 한 칸을 원하는 차례로 맞춘다. 앞에서부터 이미 맞는 만큼은 건드리지 않는다 (다 떼었다 붙이면 글 쓰던 칸의 초점과 한글 조합이 날아간다).
 *  돌려주는 값: 실제로 옮긴 것이 있는지 */
function reconcile(col, wantedPanels, wantedNodes) {
    const now = sequenceOf(col);
    let same = 0;
    while (same < now.length && same < wantedPanels.length && now[same] === wantedPanels[same]) same++;
    if (same === now.length && same === wantedPanels.length) return false;
    // 어긋나는 지점부터의 마디를 칸 맨 뒤에 원하는 차례로 둔다 (다른 칸 · 칸막이 안에 있던 창도 이리로 온다).
    // 5.8.4: 예전엔 그 마디를 모두 떼었다 붙였다 — 부팅 중 늦게 붙는 창 하나마다 그 뒤의 창 전부(정규식 창만 2천 요소)를 다시 옮겼다
    // (폰 리그 4배 부팅 꼬리 reconcile 65~95 ms). 끝난 모양은 예전과 똑같다: 칸 맨 뒤에 이미 그 차례로 서 있는 마디는 그대로 두고 나머지만 그 사이에 끼운다.
    // 맨 뒤 구간(옮길 마디만 있는 곳)만 그대로 둘 수 있다 — 그 앞의 옮기지 않는 마디(원하는 목록에 없는 것)는 옮긴 마디들보다 앞에 남아야 하니까
    const moving = wantedNodes.slice(same);
    const rank = new Map(moving.map((node, i) => [node, i]));
    const kids = col.children;
    let tail = kids.length;
    while (tail > 0 && rank.has(kids[tail - 1])) tail--;
    const stay = longestRun(Array.from({ length: kids.length - tail }, (_, i) => rank.get(kids[tail + i])));
    // 뒤에서부터: 그대로 둘 마디는 다음 기준만 되고, 나머지는 바로 뒤 마디 앞에 (마지막 마디는 칸 맨 뒤에)
    let next = null;
    for (let i = moving.length - 1; i >= 0; i--) {
        if (!stay.has(i)) col.insertBefore(moving[i], next);
        next = moving[i];
    }
    // 남은 창(원하는 목록에 없는 것)은 뒤에 그대로 붙어 있으므로 다음 칸의 reconcile 이 가져간다
    return true;
}

let applying = false;

// 1.2.2: 목록 창은 열 때 한 번만 그렸다 — 늦게 붙는 확장(큰 번들을 읽은 뒤 설정 블록을 붙이는 프롬프트 템플릿 등)은
// 시작 때 이미 그려진 목록(테마 설정 서랍이 마지막 소분류를 기억해 바로 그린다)에 끝내 안 나왔다. 칸에 붙은 창의 구성이 바뀌면 알린다.
const panelListeners = new Set();
let lastPanels = '';
/** 창 구성(이름표 · 제목)이 바뀔 때마다 부를 함수. 해제 함수를 돌려준다 */
export function onPanelsChange(fn) { panelListeners.add(fn); return () => panelListeners.delete(fn); }
function notifyPanels(panels) {
    const now = panels.map(panel => panel.key + '\u0000' + panel.label).join('\u0001');
    if (now === lastPanels) return;
    lastPanels = now;
    for (const fn of panelListeners) { try { fn(); } catch (error) { console.warn('[Blue Lemonade] 확장 순서', error); } }
}

/**
 * 1.2.4 저장된 예전 이름표(1.2.3: 'cls:inline-drawer#2' 같은 것)를 지금 그 이름표가 가리키는 창의 새 이름표로 한 번 옮긴다.
 * 시작 때 창이 늦게 붙으니 줄 세울 때마다 보이는 창만큼 옮기고, 시작 뒤(4.5초) 마지막에 아무 창도 가리키지 않는 공용 틀 이름표를 빼고 끝낸다 (keyVersion 2).
 */
export function migrateLegacyKeys(panels, { finish = false } = {}) {
    const store = settings();
    if (!store || store.keyVersion >= 2) return 0;
    const map = new Map(panels.map(panel => [panel.legacy, panel.key]));
    const theme = themeSettings?.();
    const switches = theme && theme.headSwitches && typeof theme.headSwitches === 'object' ? theme.headSwitches : null;
    const before = switches ? JSON.stringify(switches) : '';
    const changed = migrateKeys(map, [store.pinned, store.order, store.panelHidden], switches, { drop: finish });
    if (finish) store.keyVersion = 2;
    if (changed || finish) saveSettings();
    if (switches && JSON.stringify(switches) !== before) saveThemeSettings();
    if (changed) console.info(`[Blue Lemonade] 확장 순서: 예전 창 이름표 ${changed}개를 새 이름표로 옮겼어요`);
    return changed;
}

/** 설정대로 창을 옮긴다. */
export function apply() {
    if (applying) return;
    const home = document.getElementById(HOME);
    if (!home) return;

    const panels = scan();
    if (!panels.length) return;
    migrateLegacyKeys(panels);   // 1.2.4
    notifyPanels(panels);

    const store = settings();
    for(const panel of panels)panel.el.classList.toggle('po-panel-hidden',!panelVisible(store,panel.key));
    const { pinned, rest } = desired(panels);
    const other = document.getElementById(COLUMNS[1]);
    // 두 칸: 넓은 화면 · 설정 켬 · 고정한 창과 나머지가 둘 다 있을 때만 (한쪽이 비면 빈 칸이 가로 절반을 먹으니 한 줄로)
    const split = store.twoColumns !== false && !!other && pinned.some(p=>panelVisible(store,p.key)) && rest.some(p=>panelVisible(store,p.key)) && matchMedia(WIDE).matches;
    const ordered = split ? pinned : [...pinned, ...rest];
    const dividerAt = !split && store.divider && pinned.some(p=>panelVisible(store,p.key)) && rest.some(p=>panelVisible(store,p.key)) ? pinned.length : -1;

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
    startMenuOrdering();
    apply();
    startWatching();
    for (const delay of [400, 1500, 4000]) setTimeout(apply, delay);
    setTimeout(() => { try { migrateLegacyKeys(scan(), { finish: true }); apply(); } catch (error) { console.warn('[Blue Lemonade] 확장 순서', error); } }, 4500);   // 1.2.4
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
