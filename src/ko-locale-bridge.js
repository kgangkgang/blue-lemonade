// 1.0.2 블루레몬에이드 제로 · 한국어 화면 잇기 — 제로에서 index.js 가 한국어 브라우저(언어 'ko' 처럼 실리태번 언어 목록에 없는 한국어)일 때만 받아요.
// 실리태번은 lang.json 에 'ko-kr' 만 있어 브라우저 언어가 'ko' 인 폰(삼성 · 크롬 일부)에서는 언어 표가 빈 채 영어로 떠요.
//   1.0.1 기본은 내장 한글화 스크립트 · 한국어 화면 다듬기(ko-ui.js, 사전 228KB)가 그 빈자리를 메웠는데, 제로는 둘 다 받지 않아 화면 전체가 영어였어요.
// 여기서는 테마 사전 없이 실리태번이 같이 내주는 공식 번역 파일(public/locales/ko-kr.json)을 그대로 받아 빈 표에 이어 줘요 — 'ko-kr' 을 고른 순정 화면과 같은 글이에요.
//   · 표는 「목록에 안 잡히는」 칸으로 넣어요(ko-ui.js addQuietLocaleData 와 같은 방식): translate() · 실리태번 감시자(새로 붙는 data-i18n 요소)는 그대로 번역하고,
//     applyLocale 은 표가 빈 것으로 보고 순정 'ko' 처럼 바로 돌아가요(템플릿마다 DOMParser 문서를 새로 만들지 않아요).
//   · 이미 그려진 data-i18n 요소는 실리태번 translateElement 규칙으로 한 번 다시 적어요 — 보이는 곳은 바로, 나머지는 쉬는 틈에 조금씩.
//   · 표에 이미 공식 번역이 있으면(언어 'ko-kr') 아무것도 안 해요. 테마 고유 문구는 원래 한국어라 사전이 필요 없어요.
// 시험 tools/tests/ko-locale-bridge.mjs
export const isKoreanLocale = locale => /^ko(?:[-_]|$)/i.test(String(locale ?? ''));
const PROBE = '\u0000bl-ko-bridge-probe';
// 시작할 때 이미 보이는 곳 — 여기만 바로 고치고 나머지(닫힌 서랍)는 쉬는 틈에
const VISIBLE = '#send_form, #options, #top-settings-holder, #chat > .welcomePanel, dialog[open]';

/** translate() 가 그 순간 읽는 언어 표(i18n.js localeData) — 못 찾으면 null */
export function probeLocaleMap(translate) {
    let map = null;
    try {
        Object.defineProperty(Object.prototype, PROBE, { configurable: true, get() { map = this; return undefined; } });
        translate(PROBE);
    } catch { map = null; } finally { delete Object.prototype[PROBE]; }
    return map && map !== Object.prototype ? map : null;
}

/** 공식 번역이 이미 들어 있는 표인가 (ko-kr 표에 늘 있는 키로 봐요) */
export const hasOfficialTable = map => !!map && Object.hasOwn(map, 'Delete') && Object.hasOwn(map, 'Persona');

/** 빈 칸만 숨은 칸으로 더해요(있는 키는 덮지 않아요 — 공식 addLocaleData 와 같아요). 더한 키 수, 못 넣으면 -1 */
export function addQuiet(map, data) {
    if (!map || typeof map !== 'object' || !Object.isExtensible(map)) return -1;
    const props = {};
    for (const [key, value] of Object.entries(data || {})) if (typeof value === 'string' && !Object.hasOwn(map, key)) props[key] = { value, writable: true, configurable: true, enumerable: false };
    try { Object.defineProperties(map, props); } catch { return -1; }
    return Object.keys(props).length;
}

/** 실리태번 translateElement 와 같게 적되, 표보다 늦게 붙은 자식 요소(아이콘 · 단추)는 지우지 않아요 */
function setText(el, value) {
    if (!el.childElementCount) { if (el.textContent !== value) el.textContent = value; return; }
    let first = true;
    for (const node of el.childNodes) {
        if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
        node.nodeValue = first ? value : '';
        first = false;
    }
}
/** data-i18n 요소 하나를 표로 다시 적어요(실리태번 규칙: 값이 있거나 빈 글이면 적음) */
export function translateElement(el, map) {
    for (const part of (el.getAttribute('data-i18n') || '').split(';')) {
        const attr = part.match(/\[(\S+)\](.+)/);
        const value = map[attr ? attr[2] : part];
        if (!value && value !== '') continue;
        if (attr) { if (el.getAttribute(attr[1]) !== value) el.setAttribute(attr[1], value); } else setText(el, value);
    }
}

const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(() => fn({ timeRemaining: () => 8 }), 50));
/** 쉬는 틈마다 조금씩(한 번에 8ms) */
function inIdleSlices(items, work) {
    let i = 0;
    const step = deadline => {
        const start = performance.now();
        while (i < items.length && (performance.now() - start < 8 || deadline?.timeRemaining?.() > 4)) work(items[i++]);
        if (i < items.length) idle(step);
    };
    if (items.length) idle(step);
}

let started = false, state = null;
export const koBridgeState = () => state;
/** 제로 · 한국어 브라우저에서 한 번. 공식 ko-kr.json 을 받아 빈 언어 표에 이어요 */
export async function startKoLocaleBridge(ctx = SillyTavern.getContext(), load = url => fetch(url).then(r => (r.ok ? r.json() : null))) {
    const locale = ctx?.getCurrentLocale?.();
    if (started || !isKoreanLocale(locale) || typeof ctx.translate !== 'function') return null;
    const map = probeLocaleMap(ctx.translate);
    if (hasOfficialTable(map)) return null;   // 실리태번이 이미 ko-kr 표를 받았어요
    started = true;
    const data = await load(new URL('locales/ko-kr.json', document.baseURI || location.href).href);
    if (!data || typeof data !== 'object') { started = false; return null; }
    let added = Object.keys(map || {}).length === 0 ? addQuiet(map, data) : -1;
    const quiet = added >= 0 && ctx.translate('Persona') === data.Persona;
    if (!quiet) ctx.addLocaleData?.(locale, data);   // 다른 확장이 먼저 표를 채웠거나 숨은 칸이 안 먹으면 공식 길로
    const table = probeLocaleMap(ctx.translate) || map;
    if (!table) return null;
    const box = document.getElementById('send_textarea');
    const placeholder = box?.getAttribute('placeholder'), was = box && [box.getAttribute('connected_text'), box.getAttribute('no_connection_text')];
    for (const root of document.querySelectorAll(VISIBLE)) for (const el of root.querySelectorAll('[data-i18n]')) translateElement(el, table);
    // 입력칸 안내 글은 실리태번이 연결 상태를 볼 때 data-i18n 속성에서 옮겨 적어요 — 이미 옛 글이 적혀 있으면 지금 한 번
    if (box && was) { const i = was.indexOf(placeholder); if (i >= 0) box.setAttribute('placeholder', box.getAttribute(i ? 'no_connection_text' : 'connected_text')); }
    inIdleSlices([...document.querySelectorAll('[data-i18n]')], el => translateElement(el, table));
    state = { locale, quiet, added: quiet ? added : Object.keys(data).length };
    return state;
}
