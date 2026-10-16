// 6.9.0 실리태번 한국어 화면 다듬기 — 언어가 ko-kr 일 때만 index.js 가 불러온다 (다른 언어는 이 파일 · 표를 받지도 않는다).
// ① ko-kr.json 에 없는 키: 실리태번 공식 길 getContext().addLocaleData 로 더한다.
// ② 어색한 기존 번역: addLocaleData 는 있는 키를 덮지 않으므로(i18n.js — Object.hasOwn 이면 건너뜀)
//    translate() 가 읽는 바로 그 표를 한 번 찾아 값만 바꾼다. 못 찾으면 ②만 건너뛴다.
// ③ 이미 그려진 data-i18n 요소 중 바뀐 키만 한 번 다시 적는다 (실리태번 translateElement 와 같은 규칙) — 보이는 곳은 바로, 닫힌 서랍은 쉬는 틈에.
// ④ i18n 없이 뜨는 글: 알림(toastr)은 띄울 때 같은 표에서 한 번 찾고, 채팅 맨 위 「Show more messages」는 채팅이 바뀔 때 한 번,
//    ✦ 메뉴에서 표보다 먼저 만들어진 항목은 시작 · APP_READY 때 한 번.
// 감시자(MutationObserver) · 반복 타이머 없음. 새로 그려지는 data-i18n 요소는 실리태번 자기 감시자가 고친 표로 번역한다.
import { ADD, FIX, TOASTS } from './ko-ui-data.js';

export const LOCALE = 'ko-kr';
const PROBE = '\u0000bl-ko-ui-probe';
// data-i18n 없이 글이 박힌 곳 중 자주 보는 몇 군데만 (✦ 메뉴 · API 설명 · Claude 프리필 경고). 문서 전체는 훑지 않는다
const RELABEL = '#extensionsMenu, #claude_function_prefill_warning, #koboldcpp_hint, strong.toggle-description';
// 시작할 때 이미 보이는 곳 — 여기만 바로 고치고 나머지(닫힌 서랍)는 쉬는 틈에
const VISIBLE = '#send_form, #options, #chat > .welcomePanel, dialog[open]';

/** translate() 가 읽는 언어 표(i18n.js 의 localeData). 공개 함수가 없어 translate 를 한 번 불러 그 표를 받는다 — 못 찾으면 null */
export function findLocaleMap(translate) {
    let map = null;
    try {
        Object.defineProperty(Object.prototype, PROBE, { configurable: true, get() { map = this; return undefined; } });
        translate(PROBE);
    } catch { map = null; } finally { delete Object.prototype[PROBE]; }
    // 엉뚱한 객체를 잡지 않게: 실리태번 ko-kr 표에는 늘 있는 키로 확인
    return map && map !== Object.prototype && Object.hasOwn(map, 'Delete') && Object.hasOwn(map, 'Persona') ? map : null;
}

/** 실리태번 translateElement 와 같게 적되, 표보다 늦게 붙은 자식 요소(아이콘 · 단추)는 지우지 않는다 */
function setText(el, value) {
    if (!el.childElementCount) { el.textContent = value; return; }
    let first = true;
    for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
        node.nodeValue = first ? value : '';
        first = false;
    }
}

/** data-i18n 요소 하나에서 keys 에 든 키만 다시 적는다. 바꾼 개수를 돌려준다.
 *  여러 키(;)가 같은 칸을 가리키면 실리태번처럼 뒤의 것이 이긴다 — 이기는 키가 우리 키일 때만 적는다 (known: 표에 번역이 있는 키) */
export function retranslateElement(el, keys, lookup, known = key => keys.has(key)) {
    const last = new Map(); // 칸('' = 글, 그 밖 = 속성 이름) → 이기는 키
    for (const part of (el.getAttribute('data-i18n') || '').split(';')) {
        const attr = part.match(/\[(\S+)\](.+)/);
        const key = attr ? attr[2] : part;
        if (keys.has(key) || known(key)) last.set(attr ? attr[1] : '', key);
    }
    let changed = 0;
    for (const [slot, key] of last) {
        if (!keys.has(key)) continue;
        const value = lookup(key);
        if (typeof value !== 'string') continue;
        if (slot) {
            if (el.getAttribute(slot) !== value) { el.setAttribute(slot, value); changed++; }
        } else if (el.textContent !== value) { setText(el, value); changed++; }
    }
    return changed;
}

/** root 안 data-i18n 요소를 한꺼번에 다시 적는다 (시험 · 작은 영역용) */
export function retranslate(root, keys, lookup, known) {
    let changed = 0;
    for (const el of root.querySelectorAll('[data-i18n]')) changed += retranslateElement(el, keys, lookup, known);
    return changed;
}

/** 긴 목록을 쉬는 틈에 조금씩 (한 번에 budget ms 안쪽) — 폰에서 시작할 때 긴 작업을 만들지 않게. 다 돌면 끝(반복 타이머 아님) */
export function inIdleSlices(items, work, done, budget = 8) {
    let i = 0;
    const idle = globalThis.requestIdleCallback;
    const schedule = () => (idle ? idle(run, { timeout: 1500 }) : setTimeout(run, 30));
    function run(deadline) {
        const end = performance.now() + Math.max(2, Math.min(budget, deadline?.timeRemaining?.() ?? budget));
        while (i < items.length && performance.now() < end) work(items[i++]);
        if (i < items.length) schedule(); else done?.();
    }
    schedule();
}

/** 표보다 먼저 translate() 로 만들어진 글(✦ 메뉴 항목 등): 글 조각이 표의 키와 똑같을 때만 바꾼다 */
export function relabel(root, translate) {
    if (!root) return 0;
    let changed = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue.trim();
        if (!text || !/[A-Za-z]/.test(text)) continue;
        const value = translate(text);
        if (value && value !== text) { node.nodeValue = node.nodeValue.replace(text, value); changed++; }
    }
    return changed;
}

/** 자리표시(${0} …)가 있는 알림 글 → 정규식. 처음 필요할 때 한 번 만든다 */
export function compileTemplates(keys, translate) {
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return keys.map((key) => {
        const order = [...key.matchAll(/\$\{(\d+)\}/g)].map(m => +m[1]);
        const source = key.split(/\$\{\d+\}/).map(escape).join('(.+?)');
        return { re: new RegExp(`^${source}$`, 's'), order, ko: translate(key) };
    }).filter(t => t.ko && t.ko !== '');
}

/** 알림 글 하나를 표에서 찾는다 — 똑같은 키, 아니면 자리표시가 있는 알림 틀 */
export function localizeToastText(text, translate, templates) {
    if (typeof text !== 'string' || !text || text.length > 400) return text;
    const exact = translate(text);
    if (exact && exact !== text) return exact;
    if (!/[A-Za-z]{3}/.test(text)) return text;
    for (const t of templates()) {
        const m = t.re.exec(text);
        if (m) return t.ko.replace(/\$\{(\d+)\}/g, (_, i) => m[t.order.indexOf(+i) + 1] ?? '');
    }
    return text;
}

/** toastr 의 네 가지 알림을 한 번 감싼다 — 알림이 뜰 때만 표를 한 번 본다 */
export function wrapToasts(toastr, localize) {
    if (!toastr || toastr.__blKoUi) return false;
    for (const kind of ['info', 'success', 'warning', 'error']) {
        const original = toastr[kind];
        if (typeof original !== 'function') continue;
        toastr[kind] = function (message, title, options) {
            return original.call(this, localize(message), localize(title), options);
        };
    }
    Object.defineProperty(toastr, '__blKoUi', { value: true });
    return true;
}

let started = false, state = null;
/** 진단 · 시험용: 시작 때 잰 값 (더한 키 · 고친 키 · 바꾼 요소 수 · 걸린 ms) */
export const koUiState = () => state;
/** index.js 가 ko-kr 일 때 한 번 부른다. 시간을 재서 돌려준다(진단용) */
export function startKoreanUi(ctx = SillyTavern.getContext()) {
    if (started || ctx?.getCurrentLocale?.() !== LOCALE) return null;
    const { translate, addLocaleData, eventSource, event_types } = ctx;
    if (typeof translate !== 'function' || typeof addLocaleData !== 'function') return null; // 언어 표 함수가 없는 옛 실리태번
    started = true;
    const t0 = performance.now();
    addLocaleData(LOCALE, ADD);
    const map = findLocaleMap(translate);
    if (map) Object.assign(map, FIX);
    else console.warn('[Blue Lemonade] 한국어 표를 찾지 못해 기존 번역 고치기는 건너뛰어요');
    const keys = new Set([...Object.keys(ADD), ...(map ? Object.keys(FIX) : [])]);
    const lookup = key => (map && Object.hasOwn(FIX, key) ? FIX[key] : ADD[key]);
    const known = key => translate(PROBE, key) !== PROBE; // 표에 번역이 있는 키 (여러 키 중 누가 이기는지 볼 때)
    const t1 = performance.now();
    // 지금 보이는 곳(입력줄 · ☰ 메뉴 · 환영 화면 · 열린 창)은 바로, 닫힌 서랍 속 나머지는 쉬는 틈에 조금씩
    let changed = 0;
    for (const root of document.querySelectorAll(VISIBLE)) changed += retranslate(root, keys, lookup, known);
    const menu = () => [...document.querySelectorAll(RELABEL)].reduce((sum, root) => sum + relabel(root, translate), 0);
    const relabeled = menu();
    const t2 = performance.now();
    const result = { add: Object.keys(ADD).length, fix: map ? Object.keys(FIX).length : 0, changed, relabeled, msData: +(t1 - t0).toFixed(2), msVisible: +(t2 - t1).toFixed(2), msIdle: 0, done: false };
    inIdleSlices([...document.querySelectorAll('[data-i18n]')], (el) => {
        const s = performance.now();
        result.changed += retranslateElement(el, keys, lookup, known);
        result.msIdle += performance.now() - s;
    }, () => { result.done = true; result.msIdle = +result.msIdle.toFixed(2); });
    let templates = null;
    const localize = text => localizeToastText(text, translate, () => (templates ??= compileTemplates(TOASTS, translate)));
    wrapToasts(window.toastr, localize);
    // 채팅 맨 위 「Show more messages」: script.js printMessages 가 i18n 없이 만든다 — 채팅이 바뀔 때 한 번만 고친다
    const showMore = () => {
        const el = document.getElementById('show_more_messages');
        if (el && el.textContent === 'Show more messages') el.textContent = translate('Show more messages');
    };
    showMore();
    eventSource?.on?.(event_types?.CHAT_CHANGED, showMore);
    // 이 모듈보다 늦게 불러온 확장이 표가 들어오기 전에 ✦ 메뉴에 단 항목: 앱 준비가 끝날 때 한 번 더
    if (document.getElementById('loader')) eventSource?.once?.(event_types?.APP_READY, menu);
    state = result;
    return result;
}
