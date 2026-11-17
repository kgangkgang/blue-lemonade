// 1.7.4 미트볼 설정 칸의 「블루레몬」 레몬 탭 — 사용자(11-17): 「미트볼 맞춤을 테마 설정 창에 넣기보다는, 확장 탭에 미트볼 상태창에서 블루레몬 레몬 표시 누르면 옆에 생기는 걸로」
//   · 분류 탭 줄(src/ext-compat.js buildTabs)의 맨 끝(「다른 확장과 같이 쓰기」 옆)에 레몬 탭 하나 · 서랍 머리의 레몬 단추를 눌러도 그 탭으로 가요.
//   · 탭 안은 「미트볼 맞춤」 묶음 전체(전부 끄기 · 켜기 · 원작 그대로 보기 · 화면만 / 데이터 갈래 · 스위치) — 그리기 · 저장 · 동작은 테마 설정 창 것 그대로(src/panel.js mountMbFit · 스위치 표 src/mb-switch.js).
//     설정 창 모듈은 이 탭을 처음 열 때만 받아요(서랍을 그리기만 해서는 안 받아요).
//   · 맞춤을 전부 꺼도(「설정 칸 탭 나누기」 끔 · 원작 그대로 보기) 레몬 단추 · 탭 · 묶음은 남아요 — 그래야 다시 켤 수 있어요.
//     탭 줄이 안 보이는 때(탭 나누기 끔 · 원작 그대로 · 탭을 못 만든 판)는 칸 맨 위의 「블루레몬 · 미트볼 맞춤」 한 줄(.bl-ext-lemonbar)로 열고 닫아요.
//     그래서 모양은 묶음 문이 없는 제 시트(src/mb-lemon.css)에 둬요 — 맞춤 시트(src/ext-status.gen.css)의 스위치 문에 걸리지 않아요.
//   · 그 확장의 요소는 옮기거나 지우지 않아요 — 우리 칸(.bl-ext-lemonpane · .bl-ext-lemonbar · 탭 단추 · 머리 단추)만 끼워요.
//   시험: tools/tests/mb-lemon-tab.mjs
import { MB_SWITCHES } from './mb-switch.js';

export const LEMON = 'bl';            // 레몬 탭의 묶음 자리(data-bl-tab-to · data-bl-tab-g) — 숫자 묶음과 겹치지 않게 글자
export const LEMON_NAME = '블루레몬';
export const LEMON_TITLE = '블루레몬 · 미트볼 맞춤';
const SHEET_ID = 'bl-mb-lemon-css';
const PANEL = 'bl-ext-lemonpane', BAR = 'bl-ext-lemonbar', TAB = 'bl-ext-lemon-tab', OPEN = 'bl-ext-lemon-open', BODY = 'bl-ext-lemon-body';

/** 테마 설정 창에서 레몬 탭으로 옮긴 설정인가 — 설정 찾기 · 「변경한 설정」 · 즐겨찾기가 이 길이면 미트볼 설정 칸의 레몬 탭으로 데려가요.
 *  「@mb」 = 묶음 · 「@mb:열쇠」 = 표식만 쓰는 스위치 · 이미 있던 키(얼굴 표시 셋은 꾸미기 보기에 남아서 빼요) · 미트볼 문구 칸들 · 끈 열쇠 목록 */
const OLD_KEYS = new Set(MB_SWITCHES.map(sw => sw.setting).filter(p => p && !/^chat\.mbFace/.test(p)));
export function isLemonPath(path) {
    const p = String(path || '');
    return p === '@mb' || p.startsWith('@mb:') || p === 'chat.mbOff' || p === 'chat.mbAllWas' || /^chat\.mbPrompt/.test(p) || OLD_KEYS.has(p);
}

/** 제 시트 한 번(묶음 문 없음) */
function attachSheet(doc) {
    if (doc.getElementById?.(SHEET_ID)) return;
    const link = doc.createElement('link');
    link.id = SHEET_ID; link.rel = 'stylesheet'; link.href = new URL('./mb-lemon.css', import.meta.url).href;
    (doc.head || doc.documentElement).append(link);
}
const make = (doc, tag, cls, text = '') => { const el = doc.createElement(tag); el.className = cls; if (tag === 'button') el.type = 'button'; if (text) el.textContent = text; return el; };
const icon = doc => { const i = make(doc, 'i', 'bl-ext-lemon-ico'); i.setAttribute('aria-hidden', 'true'); return i; };

/** 서랍 머리 레몬 단추의 이름 · 색 표식 — on: 맞춤 화면이 걸려 있나(원작 그대로 보기 아님) · open: 레몬 탭이 열려 있나 */
export function paintHead(root) {
    const button = root?.querySelector?.('.inline-drawer-header > .bl-ext-view');
    if (!button) return;
    const raw = root.dataset.blView === 'raw', open = 'blLemon' in root.dataset;
    const label = `${LEMON_TITLE} ${open ? '닫기' : '열기'}${raw ? ' (지금 원작 그대로 보기)' : ''}`;
    button.setAttribute('aria-label', label); button.title = label;
    button.setAttribute('aria-expanded', String(open));
    button.removeAttribute('aria-pressed');
    button.toggleAttribute('data-bl-on', !raw);
    if (button.textContent) button.textContent = '';
}

/** 레몬 칸 · 한 줄 · 탭 단추 · 머리 단추를 끼워요(이미 있으면 빠진 것만). 칸이 없으면 false */
export function buildLemon(root) {
    const content = root?.querySelector?.('.inline-drawer-content');
    if (!content) return false;
    const doc = root.ownerDocument;
    attachSheet(doc);
    const nav = content.querySelector(':scope > .bl-ext-tabs');
    // 칸(탭 안) — 탭 줄 바로 아래(없으면 맨 위). 묶음 자리는 레몬(그 확장 묶음 번호와 안 겹쳐요)
    let panel = content.querySelector(`:scope > .${PANEL}`);
    if (!panel) {
        panel = make(doc, 'div', PANEL);
        panel.dataset.blTabG = LEMON;
        panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', LEMON_TITLE);
        const head = make(doc, 'b', 'bl-ext-lemon-h'); head.append(icon(doc), doc.createTextNode(LEMON_TITLE));
        panel.append(head, make(doc, 'small', 'bl-ext-lemon-note', '블루레몬이 이 확장 화면에 더하거나 고친 것을 하나씩 켜고 꺼요 · 끄면 그 부분만 원작 그대로예요. 다 꺼도 이 탭은 남아서 언제든 다시 켤 수 있어요.'), make(doc, 'div', BODY));
        if ('blTabs' in root.dataset && root.dataset.blTabs !== LEMON) panel.dataset.blTabOff = '';
    }
    // 탭 줄이 안 보일 때 여는 한 줄(맨 위)
    let bar = content.querySelector(`:scope > .${BAR}`);
    if (!bar) {
        bar = make(doc, 'div', BAR);
        const open = make(doc, 'button', OPEN); open.append(icon(doc), make(doc, 'span', '', LEMON_TITLE));
        open.setAttribute('aria-expanded', 'false');
        bar.append(open);
    }
    // 자리: 처음 끼울 때 탭 줄 바로 아래(없으면 맨 위). 그 뒤 탭 줄이 새로 생겨 칸이 그 위에 남았을 때만 다시 옮겨요(누를 때마다 옮기지 않아요)
    const fresh = !bar.parentElement || !panel.parentElement;
    const aboveNav = nav && (bar.compareDocumentPosition(nav) & 4);   // 4 = nav 가 뒤에 있음
    if (fresh || aboveNav) {
        if (nav) nav.after(bar); else content.prepend(bar);
        bar.after(panel);
    }
    // 탭 단추: 탭 줄 맨 끝(「다른 확장과 같이 쓰기」 옆)
    if (nav && !nav.querySelector(`:scope > .${TAB}`)) {
        const tab = make(doc, 'button', `bl-ext-tab ${TAB}`);
        tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', 'false');
        tab.dataset.blTabTo = LEMON; tab.dataset.blTabName = LEMON_NAME;
        tab.append(icon(doc), make(doc, 'span', '', LEMON_NAME));
        tab.title = LEMON_TITLE;
        nav.append(tab);
    }
    // 서랍 머리 레몬 단추(정리한 보기를 못 만든 때 · 탭 나누기를 끈 때도)
    const header = root.querySelector('.inline-drawer-header');
    if (header && !header.querySelector(':scope > .bl-ext-view')) {
        const button = make(doc, 'button', 'bl-ext-view');
        button.style.display = 'none';   // 테마가 켜져 있을 때만 제 시트가 보여요
        const at = header.querySelector('.inline-drawer-icon'); if (at) at.before(button); else header.append(button);
    }
    paintHead(root);
    return true;
}

/** 레몬 칸을 열거나 닫아요(표식 data-bl-lemon · 탭 줄 없는 때의 한 줄 단추 · 머리 단추) — 열면 묶음을 그려요 */
export function setLemon(root, on) {
    const was = 'blLemon' in root.dataset;
    if (was === !!on) return Promise.resolve(false);   // 바뀐 게 없으면 아무것도 안 해요(탭을 바꿀 때마다 불려요)
    if (on) root.dataset.blLemon = ''; else delete root.dataset.blLemon;
    root.querySelector(`.${OPEN}`)?.setAttribute('aria-expanded', String(!!on));
    paintHead(root);
    if (on) return mountBody(root);
    unmountBody(root);
    return Promise.resolve(false);
}

// 그리기: 테마 설정 창의 「미트볼 맞춤」 묶음을 그대로 — 처음 열 때 설정 창 모듈을 받아요(시험은 갈아 끼워요)
let loadPanel = () => import('./panel.js');
export function setPanelLoader(fn) { loadPanel = fn; }
const mounted = new WeakMap(), pending = new WeakMap();
/** 묶음을 그려요(이미 그렸으면 그대로 · 그리는 중이면 그 끝을 기다려요) → 그렸나 */
export function mountBody(root) {
    const body = root.querySelector(`.${BODY}`);
    if (!body) return Promise.resolve(false);
    if (mounted.has(body)) return Promise.resolve(true);
    if (!pending.has(body)) pending.set(body, drawBody(root, body).finally(() => pending.delete(body)));
    return pending.get(body);
}
async function drawBody(root, body) {
    try {
        const panel = await loadPanel();
        if (!('blLemon' in root.dataset) || !body.isConnected) return false;   // 받는 사이 닫았으면 그리지 않아요
        body.textContent = '';
        mounted.set(body, { panel, el: panel.mountMbFit(body) });
        return true;
    } catch (error) {
        mounted.delete(body);
        body.textContent = '';
        const note = make(root.ownerDocument, 'small', 'bl-ext-lemon-err', '맞춤 스위치를 그리지 못했어요. 테마 설정 › 설정 찾기에서 「미트볼 맞춤」을 찾아 주세요.');
        note.setAttribute('role', 'alert'); body.append(note);
        console.warn('[Blue Lemonade] 미트볼 레몬 탭', error);
        return false;
    }
}
function unmountBody(root) {
    const body = root.querySelector(`.${BODY}`), got = body && mounted.get(body);
    if (!got) return;
    mounted.delete(body);
    try { got.panel.unmountPanel(got.el); } catch { /* 칸만 비워요 */ }
    body.textContent = '';
}

/** 테마 설정(찾기 · 변경한 설정 · 즐겨찾기)에서 옮긴 설정을 고르면: 확장 서랍 → 미트볼 설정 칸 → 레몬 탭 → 그 줄
 *  path: isLemonPath 의 길(「@mb:열쇠」면 그 스위치 줄 · 키면 그 칸 줄). 칸이 없으면(미트볼이 없거나 꺼짐) 알리고 false */
export async function gotoMbLemon(path = '', doc = globalThis.document) {
    const root = doc.querySelector('#ss-settings');
    if (!root) { try { globalThis.toastr?.info?.('미트볼 상태창 확장이 켜져 있을 때 확장 탭의 미트볼 상태창 칸 › 「블루레몬」 탭에 있어요.', LEMON_TITLE); } catch { /* 알림 없이 */ } return false; }
    const drawer = doc.getElementById('rm_extensions_block');
    if (drawer && !drawer.classList.contains('openDrawer')) doc.querySelector('#extensions-settings-button .drawer-toggle')?.click();
    const content = root.querySelector('.inline-drawer-content');
    if (content && !content.getClientRects().length) root.querySelector('.inline-drawer-toggle')?.click();   // 실리태번 접힘 머리(그 확장의 서랍을 펼쳐요)
    // 탭이 보이면 탭으로, 아니면 한 줄로 — 문서 누름 감시자(src/ext-compat.js)가 받아요
    if (!('blLemon' in root.dataset)) {
        const tab = root.querySelector(`.${TAB}`), bar = root.querySelector(`.${OPEN}`);
        (tab && tab.getClientRects().length ? tab : bar)?.click();
    }
    const body = root.querySelector(`.${BODY}`);
    await mountBody(root);
    const key = path.startsWith('@mb:') ? path.slice(4) : '';
    const target = key === 'raw' ? body?.querySelector('[data-act="mb-fit-raw"]')
        : key ? body?.querySelector(`[data-act="mb-fit"][data-key="${key}"]`)
        : path && !path.startsWith('@mb') ? body?.querySelector(`[data-toggle="${path}"], [data-path="${path}"], [data-range="${path}"], [data-num="${path}"]`) : null;
    const row = target?.closest?.('.salty-row, .salty-stack, .salty-slider') || root.querySelector(`.${PANEL}`);
    if (row) {
        for (const old of root.querySelectorAll('[data-bl-lemon-hit]')) old.removeAttribute('data-bl-lemon-hit');
        if (target) row.setAttribute('data-bl-lemon-hit', '');
        row.scrollIntoView?.({ block: target ? 'center' : 'start', inline: 'nearest' });   // 묶음 전체면 그 머리부터
    }
    return true;
}
