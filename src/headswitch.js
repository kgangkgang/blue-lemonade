// 확장 위 스위치 (6.0.4) — 확장 설정 창 안의 켜기·끄기 스위치를 창 제목 줄에도 보인다.
// 확장 스위치는 기본으로 안에만 두고, 안에서 켜면 밖에도 보이게.
// 기본은 전부 숨김. 켜기·끄기 스위치가 있는 창에는 안 맨 위에 「확장 탭에 보이기」 줄이 생기고, 켜면 제목 줄에 스위치가 붙어 안의 것과 같이 움직인다.
// 6.1.8: 줄 이름은 모든 창에서 「확장 탭에 보이기」 하나로 (전엔 「<켜기 이름>」 위에도 보이기). 이름이 제각각이라 산만하던 것.
// 안의 스위치 찾기: [data-bl-master] → id·name 에 enable/active/on/use 힌트 → 라벨 글에 사용/켜/enable 힌트 → 후보가 하나뿐이면 그것 (여럿인데 힌트가 없으면 안 건다).
// 설정: headSwitches { <창 열쇠>: true } — 열쇠는 창의 id, 없으면 class (확장 순서 애드온 keyOf 와 같은 규칙, data-po-key 가 있으면 그것).
//   공용 틀 class 뿐인 창은 이름 열쇠(t: · in: · x: · 이름이 없으면 u:) — 옛 번호 열쇠 옮기기 기록은 headSwitchMove(1.4.6 · 아래 「옛 열쇠 옮기기」).
import { getSettings, saveSettings } from './settings.js';
import { watchDom } from './dom-watch.js';   // 9.0.4 공용 감시 허브
import { spreadPending, whenSpreadSettled, lateAddonsDone, whenLateDone } from './addon-start-state.js';
import { ambiguousLegacyKey } from './addons/order/panel-keys.js';   // 1.4.6 검토 2: 공용 틀 class 기준을 확장 순서 애드온과 같게

const COLUMNS = ['extensions_settings', 'extensions_settings2'];
const STRIP = '.ext-version, [class*="-version"], [class*="_version"], .inline-drawer-icon, i, svg, button, input, select, textarea';
// 6.2.0 (ui-density-620d) on/use 는 id 의 맨 앞 · 맨 뒤 낱말일 때만 — 가운데 -use- (pt-use-proxy = 리버스 프록시 쓰기)는 켜기 스위치가 아니다
const HINT_ID = /enable|enabled|activ|master|toggle|switch|^(on|use)([_-]|$)|(^|[_-])(on|use)$/i;
const HINT_TEXT = /enable|enabled|activ|사용|켜|활성|작동/i;
export const ROW = 'bl-hs-row', SWITCH = 'bl-hs-switch', HEAD = 'bl-hs-head';
export const ROW_LABEL = '확장 탭에 보이기';   // 6.1.8 모든 창에서 같은 이름 (확장 이름 · 켜기 이름 없이)
let running = false, observer = null, timer = 0, ticker = 0, drawerWatch = null, deferredAt = 0, deferTimer = 0;
const masters = new WeakMap();   // 창 → { el, label } (창이 다시 그려져 떨어지면 다시 찾는다)

/** 창의 열쇠: 확장 순서 애드온이 붙인 data-po-key → id → class → 태그 */
export function keyOf(el) {
    if (el.dataset?.poKey) return el.dataset.poKey;
    if (el.id) return `id:${el.id}`;
    const cls = [...(el.classList || [])].filter(Boolean).sort().join('.');
    return cls ? `cls:${cls}` : `tag:${String(el.tagName || '').toLowerCase()}`;
}

// 1.4.x 통합(덧 3 · 조정자 결정 (라)): id 도 이름 있는 class 도 없는 창(cls:inline-drawer · #n)은 「처음 본 차례」 번호라
//   부팅마다 다른 창을 가리켰어요. 그런 창만 안정된 이름 열쇠로 — 제목의 data-i18n(언어와 상관없음) → 창을 감싼 가장 가까운 id → 제목 글자.
//   이름이 같은 창이 둘이면 #2 · #3 을 덧붙여요(문서 차례). id · data-po-key · 이름 있는 class 열쇠는 원래 안정돼 그대로예요.
// 1.4.6 검토 2: 「옛 번호 열쇠」 알아보기는 확장 순서 애드온과 같은 기준 — 공용 틀 class(inline-drawer · wide100p …)뿐인 열쇠(panel-keys.js)
export const isLegacyKey = key => ambiguousLegacyKey(key);
export const LEGACY_KEY = { test: isLegacyKey };   // 옛 이름(시험 · 다른 파일이 .test 로 불러요)
export const MOVED_MARK = '@moved:stable-keys';   // 1.4.5 가 headSwitches 안에 남긴 「옮겼음」 표시 — 1.4.6 은 설정 정리(settings.js)가 headSwitchMove 로 옮겨요
// 1.4.6 검토 7: 이름을 못 만든 창의 열쇠 머리 — 옛 번호 열쇠(cls:inline-drawer#n)와 글자가 겹치면 남겨 둔 남의 옛 값을 읽었어요
export const NAMELESS = 'u:';
// 1.4.6 검토 6: 제목 안 작은 단추 · 아이콘 · 판 글자의 data-i18n(「[title]…」 등)은 제목이 아니에요
const NOT_TITLE = 'button, a, i, svg, input, select, textarea, .menu_button, .ext-version, [class*="-version"], [class*="_version"], .inline-drawer-icon';
/** 제목 줄의 data-i18n 글 열쇠(속성 칸 [title] 만 있는 것 · 단추 안의 것은 건너뜀) — 없으면 '' */
export function titleI18n(head) {
    for (const el of head?.querySelectorAll?.('[data-i18n]') || []) {
        const skip = el.closest?.(NOT_TITLE);
        if (skip && head.contains(skip)) continue;
        const key = String(el.getAttribute('data-i18n') || '').split(';').map(p => p.trim()).filter(p => p && !p.startsWith('[')).pop();
        if (key) return key;
    }
    return '';
}
/** 제목 글 열쇠용: 판 번호(v1.2.3) · 숫자를 떼요(검토 5 — 확장을 업데이트하면 열쇠가 바뀌었어요) */
export const titleWords = text => String(text || '').replace(/(?:\bv)?\d+(?:[._-]\d+)*/gi, ' ').replace(/\(\s*\)|\[\s*\]/g, ' ').replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N})\]]+$/u, '').slice(0, 40);   // 앞뒤 기호(「?」 도움말 · 「·」)는 확장 순서 애드온 이름처럼 떼요
export function stableKeyOf(drawer, head = headOf(drawer)) {
    const k = keyOf(drawer);
    if (!isLegacyKey(k)) return k;
    const i18n = head ? titleI18n(head) : '';
    if (i18n) return `t:${i18n}`;
    const col = drawer.closest?.(COLUMNS.map(id => `#${id}`).join(', '));
    for (let n = drawer.parentElement; n && n !== col; n = n.parentElement) if (n.id) return `in:${n.id}`;
    // 1.4.6 검토 H4: 켜기 스위치의 id 를 제목 글보다 먼저 — 한글화가 제목 글을 언제 바꾸든 같은 열쇠예요(줄 · 머리 스위치는 켜기 스위치가 있을 때만 생겨요)
    const mid = typeof drawer.querySelector === 'function' ? masterFor(drawer)?.el?.id : '';
    if (mid) return `m:${mid}`;
    // 제목 글은 처음 본 글을 붙잡아요(빈 글은 붙잡지 않음) — 한글화가 뒤에 글을 바꿔도 같은 열쇠(검토 5: 한글화 전 원문 먼저)
    if (drawer.dataset && !drawer.dataset.blHsText && head) { const t = titleWords(textOf(head)); if (t) drawer.dataset.blHsText = t; }
    const text = drawer.dataset?.blHsText || (head ? titleWords(textOf(head)) : '');
    return text ? `x:${text}` : `${NAMELESS}${k}`;
}
/** 1.4.5 가 같은 창에 만들던 열쇠 그대로(제목의 첫 data-i18n → 감싼 id → 판 번호 든 제목 글 → 옛 열쇠) — 같은 이름은 refresh 가 1.4.5 처럼 #n 을 붙여요 */
export function stableKeyOf145(drawer, head = headOf(drawer)) {
    const k = keyOf(drawer);
    if (!/^cls:inline-drawer(#\d+)?$/.test(k)) return k;
    const i18n = head?.querySelector?.('[data-i18n]')?.getAttribute('data-i18n')?.trim();
    if (i18n) return `t:${i18n}`;
    const col = drawer.closest?.(COLUMNS.map(id => `#${id}`).join(', '));
    for (let n = drawer.parentElement; n && n !== col; n = n.parentElement) if (n.id) return `in:${n.id}`;
    const text = head ? textOf(head).slice(0, 40) : '';
    return text ? `x:${text}` : k;
}
/** 옛 열쇠를 지금 붙은 창의 이름 열쇠로 옮길 짝(순수 · 시험용)
 *  switches: headSwitches · done: 옮기기 기록(headSwitchMove.done) · pairs = [{ legacy, stable, master }] → [{ from, to }]
 *  켜 둔 옛 열쇠 중 아직 기록이 없고, 켜기 스위치가 있고 이름 열쇠가 있는 창에 짝지어진 것만 */
export function movesFor(switches, done, pairs) {
    const out = [];
    for (const { legacy, stable, master } of pairs) {
        if (!master || !legacy || switches?.[legacy] !== true || Object.hasOwn(done || {}, legacy)) continue;
        if (!stable || stable === legacy || stable.startsWith(NAMELESS) || out.some(m => m.from === legacy)) continue;
        out.push({ from: legacy, to: stable });
    }
    return out;
}
/** 옛 판 호환(시험용): 켤 이름 열쇠 목록 */
export function movedKeys(switches, pairs) { return movesFor(switches, {}, pairs.filter(p => isLegacyKey(p.legacy))).map(m => m.to); }

/** 후보 점수: data-bl-master 100 · id/name 힌트 3 · 라벨 힌트 2 · 그 밖 1 */
export function scoreOf({ master = false, id = '', name = '', text = '' } = {}) {
    if (master) return 100;
    if (HINT_ID.test(String(id)) || HINT_ID.test(String(name))) return 3;
    if (HINT_TEXT.test(String(text))) return 2;
    return 1;
}

function textOf(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll(STRIP).forEach(n => n.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
}
/** 스위치의 이름: aria-label · title → label[for] → 감싼 label → 부모 줄의 글 */
export function labelOf(control, scope) {
    const aria = (control.getAttribute('aria-label') || control.getAttribute('title') || '').trim();
    if (aria) return aria.slice(0, 40);
    const byFor = control.id && scope.querySelector ? scope.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null;
    const wrap = control.closest('label');
    let text = (byFor && textOf(byFor)) || (wrap && textOf(wrap)) || '';
    if (!text && control.parentElement) text = textOf(control.parentElement);
    return text.slice(0, 40);
}

const isOn = el => el.type === 'checkbox' ? !!el.checked : el.getAttribute('aria-checked') === 'true';
const contentOf = drawer => drawer.querySelector(':scope > .inline-drawer-content');
const headOf = drawer => drawer.querySelector(':scope > .inline-drawer-toggle, :scope > .inline-drawer-header');

/** 창 안의 켜기·끄기 스위치 (없으면 null) */
export function masterOf(drawer) {
    const content = contentOf(drawer) || drawer;
    const explicit = content.querySelector('[data-bl-master]');
    if (explicit) return explicit.dataset.blMaster === 'none' ? null : explicit;   // 6.2.0 data-bl-master="none" = 켜기 스위치가 없는 창 (줄을 만들지 않는다)
    const found = [...content.querySelectorAll('input[type="checkbox"], [role="switch"]')]
        .filter(el => !el.closest(`.${ROW}`) && !el.classList.contains(SWITCH));
    if (!found.length) return null;
    let best = null, bestScore = 0;
    for (const el of found) {
        const s = scoreOf({ id: el.id, name: el.getAttribute('name') || '', text: labelOf(el, content) });
        if (s > bestScore) { best = el; bestScore = s; }
    }
    return bestScore >= 2 || found.length === 1 ? best : null;
}
function masterFor(drawer) {
    const cached = masters.get(drawer);
    if (cached && cached.el.isConnected && drawer.contains(cached.el)) return cached;
    const el = masterOf(drawer);
    const next = el ? { el, label: labelOf(el, contentOf(drawer) || drawer) } : null;
    if (next) masters.set(drawer, next); else masters.delete(drawer);
    return next;
}

/** 확장 칸의 맨 바깥 창들 */
export function drawers() {
    const out = [];
    for (const id of COLUMNS) {
        const col = document.getElementById(id);
        if (!col) continue;
        for (const el of col.querySelectorAll('.inline-drawer')) {
            const outer = el.parentElement?.closest('.inline-drawer');
            if (outer && col.contains(outer)) continue;   // 창 안에 든 접이식은 창이 아니다
            if (contentOf(el) && headOf(el)) out.push(el);
        }
    }
    return out;
}

export function isShown(key) { return getSettings().headSwitches?.[key] === true; }
export function setShown(key, on) {
    const s = getSettings();
    if (!s.headSwitches || typeof s.headSwitches !== 'object') s.headSwitches = {};
    if (on) s.headSwitches[key] = true; else delete s.headSwitches[key];
    saveSettings();
}

// ── 1.4.6 옛 열쇠 옮기기(검토 1 · 3 · 4 · 7) ─────────────────────────────────────────────
// 1.4.5 는 늦은 애드온 뒤 「한 번에 끝」이었어요 — 그때 켜기 스위치가 아직 없던 창(캐릭터 에셋: 속은 서랍을 열 때 받음)은 짝을 못 찾고 그대로 끝났어요.
// 이제 짝을 못 찾은 옛 열쇠는 남겨 두고, 켜기 스위치가 새로 생길 때마다(서랍을 열어 늦은 속이 생길 때 포함) 다시 짝지어요. 기록은 headSwitches 밖
// (headSwitchMove.done { 옛 열쇠: 이름 열쇠 | '' })에 둬요. 「옮기지 못했어요」 알림은 확장 서랍을 실제로 열고 늦은 속이 다 생긴 뒤(조용해진 뒤)에도
// 남은 것만 한 번 — 그때 남은 옛 열쇠는 「못 옮김(끝)」으로 적어 다음 부팅에 엉뚱한 창과 짝지어지지 않게 해요. 옛 열쇠 자체는 계속 안 지워요(v1.4.4 로 되돌리기).
const QUIET_MS = 2500, OPEN_MIN_MS = 4000, MAX_WAIT_MS = 15000;
let numberedEarly = false, openedAt = 0, noticeTimer = 0, settled = false;
function moveState() {
    const s = getSettings();
    if (!s.headSwitchMove || typeof s.headSwitchMove !== 'object') s.headSwitchMove = { done: {}, noticed: false };
    if (!s.headSwitchMove.done || typeof s.headSwitchMove.done !== 'object') s.headSwitchMove.done = {};
    return s.headSwitchMove;
}
/** 아직 짝을 찾는 중인 켜 둔 옛 열쇠인가 */
const pendingLegacy = key => !!key && isLegacyKey(key) && isShown(key) && !Object.hasOwn(moveState().done, key);
/** 남은 옛 열쇠(순수 · 시험용): 켜 둔 옛 열쇠 중 기록이 없는 것 */
export function pendingLegacyKeys(switches, done) { return Object.keys(switches || {}).filter(k => switches[k] === true && isLegacyKey(k) && !Object.hasOwn(done || {}, k)); }
/** 짝을 찾는 동안은 옛 열쇠도 봐요(v1.4.4 와 같은 모습) — 이름을 못 만든 창은 옛 열쇠를 읽지 않아요(검토 7)
 *  1.4.5 가 이미 옮긴 설정(from145)은 1.4.5 처럼 이름 열쇠만 봐요(검토 H1 — 1.4.5 에서 끈 창이 옛 열쇠로 다시 보이지 않게) */
const shownFor = drawer => isShown(drawer.dataset.blHsStable) || (!drawer.dataset.blHsStable?.startsWith(NAMELESS) && !moveState().from145 && pendingLegacy(drawer.dataset.blHsKey));
/** 검토 H1(순수 · 시험용): 1.4.5 가 이미 옮긴 설정의 첫 정리 — 지금 켜기 스위치가 있는 창(1.4.5 도 그때 봤을 창)의 옛 열쇠는
 *  다시 켜지 않고 끝으로 적어요(이름 열쇠가 켜져 있으면 그 열쇠 · 꺼져 있으면 '' — 1.4.5 에서 끈 것). 켜기 스위치가 없던 창만 남겨 다시 짝지어요 */
export function settled145(switches, done, pairs) {
    const out = [];
    for (const { legacy, stable, master } of pairs) {
        if (!master || !legacy || switches?.[legacy] !== true || !isLegacyKey(legacy) || Object.hasOwn(done || {}, legacy) || out.some(m => m.from === legacy)) continue;
        out.push({ from: legacy, to: stable && switches?.[stable] === true ? stable : '' });
    }
    return out;
}
function setShownFor(drawer, on) {
    if (!on && pendingLegacy(drawer.dataset.blHsKey)) { const s = getSettings(); if (s.headSwitches) delete s.headSwitches[drawer.dataset.blHsKey]; }   // 짝을 찾기 전 끄기는 옛 열쇠도 같이
    setShown(drawer.dataset.blHsStable, on);
}
/** 짝짓기: 늦은 애드온까지 다 시작한 뒤 그릴 때마다 — 남은 옛 열쇠 · 1.4.5 이름 열쇠를 지금 창의 이름 열쇠로 옮겨 적어요 */
function pairLegacy(list) {
    const s = getSettings(), hs = s.headSwitches;
    if (!hs || typeof hs !== 'object') return;
    const mv = moveState(), moves = [], ends = [];
    // 1.4.5 이름 열쇠(제목 첫 data-i18n · 판 번호 든 제목 글)는 창 이름이라 차례와 상관없이 바로 — 검토 H2: 1.4.5 를 거친 설정에서 그때 있던 열쇠(names145)만,
    //   지금 어느 창의 열쇠이기도 한 것은 빼요(1.4.6 이 쓴 열쇠 · 같은 이름 #2 · 단추 data-i18n 겹침)
    const names = Array.isArray(mv.names145) ? mv.names145 : [];
    if (names.length) {
        const live = new Set(list.map(d => d.dataset.blHsStable));
        for (const d of list) { const old = d.dataset.blHsOld, to = d.dataset.blHsStable;
            if (old && names.includes(old) && !live.has(old) && to && !to.startsWith(NAMELESS) && hs[old] === true && !Object.hasOwn(mv.done, old) && !moves.some(m => m.from === old)) moves.push({ from: old, to }); }
    }
    // 옛 번호 열쇠는 번호가 이 부팅에서 제대로 매겨졌을 때만(검토 4 — 6초 한도로 나눠 시작 중에 번호를 매겼으면 다음 부팅으로 미뤄요)
    if (!numberedEarly && lateAddonsDone() && pendingLegacyKeys(hs, mv.done).length) {
        const pairs = list.map(d => ({ legacy: d.dataset.blHsKey, stable: d.dataset.blHsStable, master: !!masterFor(d) }));
        if (mv.from145) { ends.push(...settled145(hs, mv.done, pairs)); mv.from145 = false; }   // 검토 H1: 첫 정리 — 1.4.5 가 옮긴 것(그때 켜기 스위치가 있던 창)은 끝
        moves.push(...movesFor(hs, { ...mv.done, ...Object.fromEntries(ends.map(e => [e.from, e.to])) }, pairs));
    } else if (mv.from145 && !numberedEarly && lateAddonsDone()) { mv.from145 = false; ends.push({}); }
    if (!moves.length && !ends.length) return;
    for (const { from, to } of ends) if (from) mv.done[from] = to;
    for (const { from, to } of moves) { hs[to] = true; mv.done[from] = to; }
    saveSettings();
    if (moves.length) console.info('[Blue Lemonade] 확장 위 스위치 열쇠를 창 이름으로 옮겼어요:', moves.map(m => `${m.from} → ${m.to}`).join(' · '));
}
/** 확장 서랍을 연 뒤 조용해지면(늦은 속까지 다 생긴 뒤) 한 번: 남은 옛 열쇠를 「못 옮김」으로 적고, 알림을 아직 안 띄웠으면 그 수를 알려요 */
function armNotice() {
    clearTimeout(noticeTimer); noticeTimer = 0;
    if (!running || !openedAt || settled) return;
    // 검토 H3: 확장 칸이 계속 바뀌어도(시계 · 진행 막대) 서랍을 연 뒤 MAX_WAIT_MS 안에는 꼭 돌아요
    const now = Date.now(), wait = Math.min(Math.max(QUIET_MS, openedAt + OPEN_MIN_MS - now), Math.max(0, openedAt + MAX_WAIT_MS - now));
    noticeTimer = setTimeout(settleLegacy, wait);
}
function settleLegacy() {
    noticeTimer = 0;
    if (!running) return;
    if (numberedEarly) return;   // 번호를 믿을 수 없는 부팅 — 다음 부팅에 다시
    if (!lateAddonsDone()) { whenLateDone(armNotice); return; }
    if (spreadPending()) { whenSpreadSettled(armNotice); return; }
    settled = true;   // 이 부팅에서는 한 번만(아래 refresh 가 다시 재지 않게 먼저)
    refresh();   // 마지막으로 한 번 더 짝짓기
    const s = getSettings(), hs = s.headSwitches || {}, mv = moveState();
    const left = pendingLegacyKeys(hs, mv.done);
    if (Array.isArray(mv.names145) && mv.names145.length) { mv.names145 = []; if (!left.length) saveSettings(); }   // 1.4.5 이름 열쇠 옮기기도 여기서 끝
    if (!left.length) return;
    for (const k of left) mv.done[k] = '';
    const tell = !mv.noticed;
    mv.noticed = true;   // 기록을 먼저 남기고 알림(다시 안 떠요)
    saveSettings();
    if (tell) globalThis.toastr?.info(unmovedText(left.length), 'Blue Lemonade', { timeOut: 12000, extendedTimeOut: 4000 });
    refresh();
}
/** 옮기지 못한 옛 열쇠 수(순수 · 옛 판 시험용): 켜 둔 옛 열쇠 중 켜기 스위치가 있는 창에 짝지어지지 않은 것 */
export function unmovedCount(legacyOn, pairs) {
    const done = new Set(pairs.filter(p => p.master && p.stable && p.stable !== p.legacy && !p.stable.startsWith(NAMELESS)).map(p => p.legacy));
    return legacyOn.filter(k => !done.has(k)).length;
}
// 덧 4 · 조정자 결정 (아): 문구는 조정자가 정한 그대로
export const unmovedText = n => `확장 위로 꺼내 둔 스위치 ${n}개를 새 판으로 옮기지 못했어요. 확장 서랍에서 한 번만 다시 켜 주세요.`;

const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
function makeSwitch(cls) {
    const sw = document.createElement('button');
    sw.type = 'button'; sw.className = `${SWITCH} ${cls}`; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', 'false');
    sw.append(document.createElement('span'));
    return sw;
}
function makeRow(drawer) {
    const row = document.createElement('div'); row.className = ROW;
    const text = document.createElement('span'); text.className = 'bl-hs-text';
    const opt = makeSwitch('bl-hs-opt');
    opt.setAttribute('aria-label', ROW_LABEL);
    opt.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        setShownFor(drawer, opt.getAttribute('aria-checked') !== 'true');
        refresh();
    });
    row.append(text, opt);
    return row;
}
function makeHead(drawer) {
    const sw = makeSwitch(HEAD);
    sw.setAttribute('aria-label', '켜기 끄기');
    sw.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();   // 제목 줄(접기)로 올라가지 않게
        const m = masterFor(drawer);
        if (!m) return;
        m.el.click();
        setTimeout(sync, 50); setTimeout(sync, 400);
    });
    return sw;
}

/** 창마다: 안의 줄을 붙이고, 켜 둔 창은 제목 줄에 스위치를 붙인다 (여러 번 불러도 같다) */
export function refresh() {
    if (!running) return;
    // 1.4.x 통합: 애드온을 나눠 시작하는 동안은 기다렸다가 한 번에 — 그 사이 붙는 창 때문에 열쇠 번호(cls:…#n)가 밀리지 않게(addon-start-state.js)
    //   애드온 하나가 오래 안 끝나도 스위치가 영영 안 붙지 않게 6초까지만 기다려요
    if (spreadPending() && Date.now() - (deferredAt ||= Date.now()) < 6000) { whenSpreadSettled(schedule); clearTimeout(deferTimer); deferTimer = setTimeout(schedule, 6100); return; }
    const early = spreadPending();   // 6초 한도로 기다림을 그만둔 그리기 — 이때 새로 매긴 번호는 믿지 않아요(검토 4)
    // 1.4.5 를 거친 설정에 그때의 이름 열쇠(names145)가 남아 있을 때만 1.4.5 꼴을 다시 구해요(검토 H2 — 1.4.6 이 쓴 열쇠는 대상이 아님)
    const mvNow = moveState(), hsNow = getSettings().headSwitches || {};
    const oldNames = Array.isArray(mvNow.names145) && mvNow.names145.some(k => hsNow[k] === true && !Object.hasOwn(mvNow.done, k));
    deferredAt = 0; clearTimeout(deferTimer);
    const used = new Set(), usedStable = new Set(), usedOld = new Set();
    const rowsOn = getSettings().headSwitchRows !== false;   // 6.8.8 설정에서 줄을 끌 수 있다 (꺼내 둔 제목 줄 스위치는 그대로)
    const list = drawers();
    for (const drawer of list) {
        let key = drawer.dataset.blHsKey;   // 옛 번호 열쇠 — 옮기기 전 모습 · 옮길 짝을 찾는 데만 써요
        if (!key || used.has(key)) {
            const base = keyOf(drawer); key = base; let n = 1;
            while (used.has(key)) key = `${base}#${++n}`;
            drawer.dataset.blHsKey = key;
            if (early && isLegacyKey(key)) numberedEarly = true;
        }
        used.add(key);
        // 이름 열쇠는 그릴 때마다 새로 구해요 — 창이 감싸는 칸에 막 옮겨지는 중이면(캐릭터 에셋 등) 처음엔 제목 글자, 뒤엔 감싼 id 라 붙잡아 두면 부팅마다 달라져요
        const base = stableKeyOf(drawer); let stable = base, n = 1;
        while (usedStable.has(stable)) stable = `${base}#${++n}`;
        if (drawer.dataset.blHsStable !== stable) drawer.dataset.blHsStable = stable;
        usedStable.add(stable);
        // 1.4.5 꼴도 1.4.5 처럼 같은 이름에 문서 차례로 #n (검토 H2)
        let old = '';
        if (oldNames) { const ob = stableKeyOf145(drawer); old = ob; let m = 1; while (usedOld.has(old)) old = `${ob}#${++m}`; usedOld.add(old); }
        if (old && /^[tx]:/.test(old) && old !== stable) drawer.dataset.blHsOld = old; else if (drawer.dataset.blHsOld !== undefined) delete drawer.dataset.blHsOld;
    }
    // 짝짓기는 그릴 때마다(남은 것만) — 옛 번호 열쇠는 늦은 애드온까지 다 시작한 뒤에만, 그 전엔 옛 열쇠로 보여요
    pairLegacy(list);
    if (!lateAddonsDone()) whenLateDone(schedule);
    if (openedAt) armNotice();   // 서랍을 연 뒤의 그리기는 「조용해질 때까지」를 다시 재요
    for (const drawer of list) {
        const content = contentOf(drawer), head = headOf(drawer);
        let row = content.querySelector(`:scope > .${ROW}`);
        let sw = head.querySelector(`:scope > .${HEAD}`);
        const m = masterFor(drawer);
        if (!m) { row?.remove(); sw?.remove(); continue; }
        const want = shownFor(drawer);
        if (!rowsOn) row?.remove();
        else {
            if (!row) { row = makeRow(drawer); content.prepend(row); }
            setText(row.firstElementChild, ROW_LABEL);
            setAttr(row.lastElementChild, 'aria-checked', want ? 'true' : 'false');
        }
        if (!want) { sw?.remove(); continue; }
        if (!sw) {
            sw = makeHead(drawer);
            const icon = head.querySelector(':scope > .inline-drawer-icon');
            if (icon) head.insertBefore(sw, icon); else head.append(sw);
        }
        setAttr(sw, 'aria-label', `${m.label || '켜기'} 켜기 끄기`);
        setAttr(sw, 'aria-checked', isOn(m.el) ? 'true' : 'false');
    }
}
/** 제목 줄 스위치를 안의 스위치 상태에 맞춘다 (가볍다 — 켜 둔 창만) */
export function sync() {
    if (!running) return;
    for (const sw of document.querySelectorAll(`.${HEAD}`)) {
        const drawer = sw.closest('.inline-drawer');
        const m = drawer && masterFor(drawer);
        if (!m) { sw.remove(); continue; }
        setAttr(sw, 'aria-checked', isOn(m.el) ? 'true' : 'false');
    }
}

const mine = node => node?.nodeType === 1 && (node.classList.contains(ROW) || node.classList.contains(SWITCH) || !!node.closest?.(`.${ROW}, .${SWITCH}`));
const ours = r => mine(r.target) || ((r.addedNodes.length + r.removedNodes.length) > 0 && [...r.addedNodes, ...r.removedNodes].every(mine));
function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 250); }
function onChange() { setTimeout(sync, 0); }
function start() {
    const block = document.getElementById('rm_extensions_block') || document.body;
    // 9.0.4: 공용 감시 허브 구독 — 확장 칸이 아직 없어 body 를 보게 되면 채팅 가지는 감시도 안 걸어요
    observer = watchDom(block, { childList: true, subtree: true, attributes: ['aria-checked'], exclude: block === document.body ? '#chat' : undefined, name: '머리 스위치' }, (records) => {
        if (records.every(ours)) return;
        if (records.some(r => r.type === 'attributes')) setTimeout(sync, 0);
        if (records.some(r => r.type === 'childList')) schedule();
    });
    block.addEventListener('change', onChange, true);
    block.addEventListener('click', onChange, true);
    // 체크박스를 코드로 바꾸면 알림이 없다 — 확장 칸이 보이는 동안 2초마다 맞춘다
    // 6.4.5 서랍이 닫혀 있으면 offsetParent 를 읽지 않는다 — 읽을 때마다 렌더 중 문서 전체 스타일 계산을 강제했다 (닫힌 서랍은 원래도 null)
    // 1.1.4 유휴 타이머 정리: 확장 서랍이 닫혀 있는 동안(거의 늘)은 타이머를 아예 걸지 않아요 — 2초마다 깨어 「닫혔네」만 보고 돌아가던 것.
    //   서랍(.drawer-content)의 class 만 봐서(허브 · 자기 자신 구독) 열리면 걸고 닫히면 내려요. 서랍을 못 찾으면(확장 칸이 아직 없거나 서랍 밖) 예전처럼 늘 돌아요
    const drawer = document.getElementById('rm_extensions_block')?.closest('.drawer-content') || null;
    if (drawer) drawerWatch = watchDom(drawer, { attributes: ['class'], name: '머리 스위치 (확장 서랍 열림)' }, () => { armTicker(drawer); noteOpen(drawer); });
    armTicker(drawer);
    noteOpen(drawer);
}
/** 1.4.6: 확장 서랍을 처음 연 때를 적어요 — 「옮기지 못했어요」 알림은 그 뒤 늦은 속까지 다 생기고 조용해진 다음에 */
function noteOpen(drawer) {
    if (openedAt || !drawer?.classList.contains('openDrawer')) return;
    openedAt = Date.now(); armNotice();
}
function tick() {
    const b = document.getElementById('rm_extensions_block'); if (!b || b.closest('.drawer-content')?.classList.contains('openDrawer') === false) return; if (b.offsetParent !== null) sync(); else return;
    if (!openedAt) { openedAt = Date.now(); armNotice(); }   // 서랍을 못 찾은 화면: 확장 칸이 보이면 연 것으로
}
/** 확장 서랍이 열려 있을 때만(서랍을 모르면 늘) 2초 타이머를 걸어요 */
function armTicker(drawer) {
    const want = running && (!drawer || drawer.classList.contains('openDrawer'));
    if (want && !ticker) ticker = setInterval(tick, 2000);
    else if (!want && ticker) { clearInterval(ticker); ticker = 0; }
}
function stop() {
    observer?.(); observer = null; drawerWatch?.(); drawerWatch = null;
    clearTimeout(timer); clearInterval(ticker); clearTimeout(deferTimer); clearTimeout(noticeTimer); timer = 0; ticker = 0; deferTimer = 0; deferredAt = 0; noticeTimer = 0; openedAt = 0;
    const block = document.getElementById('rm_extensions_block') || document.body;
    block.removeEventListener('change', onChange, true);
    block.removeEventListener('click', onChange, true);
    document.querySelectorAll(`.${ROW}, .${HEAD}`).forEach(n => n.remove());
    running = false;
}

/** features.js 가 부른다: 테마가 켜져 있으면 시작, 꺼지면 붙인 것을 전부 뗀다 */
export function syncHeadSwitch(on) {
    if (on && !running) { running = true; start(); refresh(); }
    else if (!on && running) stop();
    else if (on) schedule();
}
