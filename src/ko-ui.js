// 6.9.0 실리태번 한국어 화면 다듬기 — 언어가 ko-kr 일 때만 index.js 가 불러온다 (다른 언어는 이 파일 · 표를 받지도 않는다).
// ① ko-kr.json 에 없는 키: 실리태번 공식 길 getContext().addLocaleData 로 더한다.
// ② 어색한 기존 번역: addLocaleData 는 있는 키를 덮지 않으므로(i18n.js — Object.hasOwn 이면 건너뜀)
//    translate() 가 읽는 바로 그 표를 한 번 찾아 값만 바꾼다. 못 찾으면 ②만 건너뛴다.
// ③ 이미 그려진 data-i18n 요소 중 바뀐 키만 한 번 다시 적는다 (실리태번 translateElement 와 같은 규칙) — 보이는 곳은 바로, 닫힌 서랍은 쉬는 틈에.
// ④ i18n 없이 뜨는 글: 알림(toastr)은 띄울 때 같은 표에서 한 번 찾고, 채팅 맨 위 「Show more messages」는 실리태번이 단추를 다시 만들 때마다(#chat 자식 감시자 · 이벤트),
//    ✦ 메뉴에서 표보다 먼저 만들어진 항목은 시작 · APP_READY 때 한 번.
// 감시자는 #chat 바로 아래 자식만 보는 것 하나(7.7.9) · 반복 타이머 없음. 새로 그려지는 data-i18n 요소는 실리태번 자기 감시자가 고친 표로 번역한다.
import { ADD, FIX, TOASTS } from './ko-ui-data.js';
import { onShowMoreButton } from './show-more-watch.js';

export const LOCALE = 'ko-kr';
/** 7.7.9 한국어 화면인가: 실리태번은 언어를 고르지 않으면 브라우저 언어(navigator.language → 'ko' 또는 'ko-kr')를 그대로 쓰고,
 *  addLocaleData 는 그 값과 똑같은 id 만 받는다 — 'ko-kr' 만 보면 'ko' 인 폰(삼성 · 크롬 일부)에서 이 파일이 통째로 꺼져 「Show more messages」가 영어였다 */
export const isKoreanLocale = locale => /^ko(?:[-_]|$)/i.test(String(locale ?? ''));
const PROBE = '\u0000bl-ko-ui-probe';
// data-i18n 없이 글이 박힌 곳 중 자주 보는 몇 군데만 (✦ 메뉴 · API 설명 · Claude 프리필 경고). 문서 전체는 훑지 않는다
const RELABEL = '#extensionsMenu, #claude_function_prefill_warning, #koboldcpp_hint, strong.toggle-description';
// 시작할 때 이미 보이는 곳 — 여기만 바로 고치고 나머지(닫힌 서랍)는 쉬는 틈에
const VISIBLE = '#send_form, #options, #chat > .welcomePanel, dialog[open]';

/** translate() 가 그 순간 읽는 객체를 그대로 돌려준다(비었어도) — 못 찾으면 null */
export function probeLocaleMap(translate) {
    let map = null;
    try {
        Object.defineProperty(Object.prototype, PROBE, { configurable: true, get() { map = this; return undefined; } });
        translate(PROBE);
    } catch { map = null; } finally { delete Object.prototype[PROBE]; }
    return map && map !== Object.prototype ? map : null;
}

/** translate() 가 읽는 언어 표(i18n.js 의 localeData). 공개 함수가 없어 translate 를 한 번 불러 그 표를 받는다 — 못 찾으면 null */
export function findLocaleMap(translate) {
    const map = probeLocaleMap(translate);
    // 엉뚱한 객체를 잡지 않게: 실리태번 ko-kr 표에는 늘 있는 키로 확인
    return map && Object.hasOwn(map, 'Delete') && Object.hasOwn(map, 'Persona') ? map : null;
}

/** 8.2.7 실리태번이 언어 표를 못 받아 표가 텅 빈 경우(브라우저 언어 'ko' — lang.json 엔 ko-kr 만 있어요)에만: 더할 키를 「목록에 안 잡히는」(enumerable: false) 칸으로 넣어요.
 *  translate() · 실리태번 감시자(translateElement)는 표[키] 로 읽으니 번역은 그대로 되고, applyLocale 은 Object.keys(표) 가 0 이라 순정처럼 바로 돌아가요
 *  — 공식 addLocaleData 로 채우면 그때부터 템플릿을 그릴 때마다 DOMParser 문서를 새로 만들어 jQuery 로 훑어요(순정 'ko' 엔 없던 일).
 *  표가 이미 차 있으면(ko-kr · 다른 확장이 먼저 더함) 순정도 그 값을 내니 건드리지 않고 false. 넣은 뒤 translate 로 한 번 확인하고, 안 맞으면 되돌리고 false(공식 길로) */
export function addQuietLocaleData(map, data, translate) {
    if (!map || typeof map !== 'object' || Object.getPrototypeOf(map) !== Object.prototype || !Object.isExtensible(map)) return false;
    if (Object.keys(map).length !== 0) return false;
    const added = [];
    try {
        const props = {};
        for (const [key, value] of Object.entries(data)) {
            if (Object.hasOwn(map, key)) continue; // 공식 addLocaleData 처럼 있는 키는 덮지 않아요
            props[key] = { value, writable: true, configurable: true, enumerable: false };
            added.push(key);
        }
        Object.defineProperties(map, props);
        const sample = added.find(key => data[key]);
        if (Object.keys(map).length === 0 && (!sample || translate(sample) === data[sample])) return true;
    } catch { /* 아래에서 되돌려요 */ }
    for (const key of added) { try { delete map[key]; } catch { /* 넘어가요 */ } }
    return false;
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

/** 쪽수 고르기(「5 / page」): 실리태번은 목록을 그릴 때 t`/ page` 로 글을 박아 넣어요(utils.js renderPaginationDropdown — data-i18n 없음).
 *  이 표는 index.js 가 기다리지 않고 불러오니, 표가 늦게 오면(폰 · 바쁜 PC) 페르소나 · 캐릭터 목록이 먼저 그려져 영어로 남았어요(8.1.3 미리 통합 사진).
 *  → 표를 넣은 뒤 이미 그려진 쪽수 고르기만 고쳐요. 바꾼 개수를 돌려줘요 */
export const PAGE_SIZE_OPTIONS = '.J-paginationjs-size-select option';
export function relabelPageSize(root, translate) {
    const label = translate('/ page');
    if (!root || !label || label === '/ page') return 0;
    let changed = 0;
    for (const option of root.querySelectorAll(PAGE_SIZE_OPTIONS)) {
        const m = /^(\d+) \/ page$/.exec(String(option.textContent).trim());
        if (m) { option.textContent = `${m[1]} ${label}`; changed++; }
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
    const locale = ctx?.getCurrentLocale?.();
    if (started || !isKoreanLocale(locale)) return null;
    const { translate, addLocaleData, eventSource, event_types } = ctx;
    if (typeof translate !== 'function' || typeof addLocaleData !== 'function') return null; // 언어 표 함수가 없는 옛 실리태번
    started = true;
    const t0 = performance.now();
    // 8.2.7 표가 빈 'ko' 는 숨은 칸으로(템플릿마다 드는 번역 비용을 순정과 같게), 그 밖엔 공식 길 — 실리태번은 지금 언어 id(ko · ko-kr)와 같은 것만 받는다
    const quiet = addQuietLocaleData(probeLocaleMap(translate), ADD, translate);
    if (!quiet) addLocaleData(locale, ADD);
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
    // 표보다 먼저 그려진 쪽수 고르기: 지금 한 번. 그런 게 있었으면 실리태번 쪽수 모듈이 쪽을 넘길 때 그때 받은 옛 글로 다시 그리니,
    // 쪽수 줄 안을 누르거나 고를 때만 한 번 더 고쳐요(목록을 새로 그리면 실리태번이 고친 표로 적어서 그 뒤로는 할 일이 없어요).
    // 쪽수 모듈은 click · change 를 return false 로 막아 문서까지 안 올라와요 → 잡기 단계에서 받아, 모듈이 다시 그린 뒤 화면에 그리기 전(rAF)에 고쳐요
    const pageSizes = relabelPageSize(document, translate);
    if (pageSizes) {
        const again = event => { if (event.target?.closest?.('.paginationjs')) requestAnimationFrame(() => relabelPageSize(document, translate)); };
        document.addEventListener('click', again, true);
        document.addEventListener('change', again, true);
    }
    const t2 = performance.now();
    const result = { add: Object.keys(ADD).length, quiet, fix: map ? Object.keys(FIX).length : 0, changed, relabeled, pageSizes, msData: +(t1 - t0).toFixed(2), msVisible: +(t2 - t1).toFixed(2), msIdle: 0, done: false };
    inIdleSlices([...document.querySelectorAll('[data-i18n]')], (el) => {
        const s = performance.now();
        result.changed += retranslateElement(el, keys, lookup, known);
        result.msIdle += performance.now() - s;
    }, () => { result.done = true; result.msIdle = +result.msIdle.toFixed(2); });
    let templates = null;
    const localize = text => localizeToastText(text, translate, () => (templates ??= compileTemplates(TOASTS, translate)));
    wrapToasts(window.toastr, localize);
    // 채팅 맨 위 「Show more messages」: script.js printMessages 가 i18n 없이 만든다. 7.7.9 — 채팅이 바뀔 때 한 번만 고치니
    // 실리태번이 단추를 다시 만들 때(메시지 추가 · 스와이프 · 더 보기 뒤 · 번역 뒤 다시 그리기)마다 영어로 돌아왔다(사용자 사진, 번역 9/62 진행 중).
    // → #chat 의 바로 아래 자식만 보는 감시자 하나(subtree 없음, 메시지 본문은 보지 않음) + 단추가 다시 생기는 실리태번 이벤트에서 같은 함수.
    const showMore = () => {
        const el = document.getElementById('show_more_messages');
        if (el && el.textContent === 'Show more messages') el.textContent = translate('Show more messages');
    };
    showMore();
    for (const name of ['CHAT_CHANGED', 'MORE_MESSAGES_LOADED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MESSAGE_UPDATED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED']) {
        if (event_types?.[name]) eventSource?.on?.(event_types[name], showMore);
    }
    onShowMoreButton(showMore);   // #chat 자식 감시자(show-more-watch.js) — 단추가 다시 생길 때마다
    // 이 모듈보다 늦게 불러온 확장이 표가 들어오기 전에 ✦ 메뉴에 단 항목: 앱 준비가 끝날 때 한 번 더
    if (document.getElementById('loader')) eventSource?.once?.(event_types?.APP_READY, menu);
    state = result;
    return result;
}
