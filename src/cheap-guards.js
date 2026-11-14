// 1.4.x 최적화 3차: 값싼 지킴 꼴 되돌리기 — 빌드(tools/css-light-guards.cjs)가 테마 시트의 지킴 갈래
//   `[data-bl-native-ext-colors] *`(다른 확장 원래 색 유지 표식 안) · `.salty-panel *`(테마 설정 창 안)를 `…:not(*)` 로 적어 둬요.
//   그 요소가 문서에 없을 때는 두 꼴이 같은 요소를 고르고(아무것도 안 고름), `:not(*)` 꼴은 요소마다 조상을 걷지 않아요.
//   그 요소를 문서에 넣기 바로 전에 armGuard(가족)를 불러 실행 중 시트의 그 갈래만 원래 글(`X *`)로 되돌리고,
//   더 쓰지 않게 되면 disarmGuard(가족)로 다시 `X:not(*)` 로 — 되돌린 동안의 선택자는 예전 빌드의 글과 글자 하나까지 같아요.
//   · 'ext'   : 표식을 붙이는 곳(src/extension-colors.js · src/ext-compat.js keepNative · 성능 보조 창 stamp)이 붙이기 전에 불러요. 한 번 켜면 그 세션 동안 그대로예요.
//   · 'panel' : 테마 설정 창을 만들 때(src/panel.js mountPanel) 켜고, 마지막 창을 뗄 때(unmountPanel) 꺼요.
//   켜진 동안 새로 받는 테마 시트는 문서 load(잡기 단계)에서, 글로 넣는 <style>(src/lite.js · src/split-css.js)은 넣은 자리에서 guardSheet 로 바로 맞춰요.
//   규칙의 원래 글(가벼운 꼴)은 시트마다 한 번 읽어 기억해요 — 규칙 수가 바뀌거나 기억한 규칙이 시트에서 빠지면 그 시트만 다시 읽어요.
const FAMILIES = { ext: '[data-bl-native-ext-colors]', panel: '.salty-panel' };
const TOKEN_OF = { '[data-bl-native-ext-colors]': 'ext', '.salty-panel': 'panel' };
const LIGHT = /(\[data-bl-native-ext-colors\]|\.salty-panel):not\(\*\)/g;
const FULL = /(\[data-bl-native-ext-colors\]|\.salty-panel) \*(?=\s*[,)])/g;
const ROOT = (() => { try { return new URL('../', import.meta.url).href; } catch { return ''; } })();
const armed = new Set();
const cache = new WeakMap();   // CSSStyleSheet → { length, entries: [[rule, base]] }
let listening = false;
export const guardStats = { scans: 0, writes: 0 };

/** 실행 중 꼴 → 빌드 꼴(견주기용 · src/lite.js sameShape) — 되돌린 갈래를 다시 `X:not(*)` 로 */
export function lightSelector(text) { return String(text ?? '').replace(FULL, '$1:not(*)'); }
const render = base => base.replace(LIGHT, (match, token) => (armed.has(TOKEN_OF[token]) ? `${token} *` : match));

/** 테마가 넣은 시트인가 — 테마 폴더의 <link> 이거나 글로 넣은 <style>(테마 · 실리태번 :focus-visible 사본 칸). 다른 확장 · 실리태번 파일 시트는 안 읽어요 */
function ours(sheet) {
    const href = sheet?.href;
    if (href) return !!ROOT && href.startsWith(ROOT);
    return sheet?.ownerNode?.localName === 'style';
}
function collect(rules, known, out) {
    for (const rule of rules) {
        const text = rule.selectorText;
        if (typeof text === 'string') {
            const base = known.get(rule) ?? (text.includes(':not(*)') && (LIGHT.lastIndex = 0, LIGHT.test(text)) ? text : null);
            if (base !== null) out.push([rule, base]);
        }
        let inner = null;
        try { inner = rule.cssRules; } catch { inner = null; }
        if (inner?.length) collect(inner, known, out);
    }
}
function entriesOf(sheet) {
    let rules;
    try { rules = sheet.cssRules; } catch { return null; }   // 다른 출처
    if (!rules) return null;
    const had = cache.get(sheet);
    if (had && had.length === rules.length && had.entries.every(([rule]) => rule.parentStyleSheet === sheet)) return had.entries;
    const known = new Map(had?.entries || []);
    const entries = [];
    collect(rules, known, entries);
    guardStats.scans++;
    cache.set(sheet, { length: rules.length, entries });
    return entries;
}
/** 시트 하나를 지금 켜진 가족에 맞춰요(켜진 것이 없으면 처음 보는 시트는 읽지 않아요) */
export function guardSheet(sheet) {
    if (!sheet || (!armed.size && !cache.has(sheet)) || !ours(sheet)) return 0;
    const entries = entriesOf(sheet);
    if (!entries) return 0;
    let n = 0;
    for (const [rule, base] of entries) {
        const want = render(base);
        if (rule.selectorText !== want) { try { rule.selectorText = want; n++; } catch { /* 이 브라우저가 못 읽는 글이면 그대로 */ } }
    }
    guardStats.writes += n;
    return n;
}
function syncAll(doc) {
    let n = 0;
    for (const sheet of doc?.styleSheets || []) n += guardSheet(sheet);
    return n;
}
function onLoad(event) {
    const el = event.target;
    if (armed.size && (el?.localName === 'link' || el?.localName === 'style')) guardSheet(el.sheet);
}
/** family = 'ext' | 'panel' — 그 지킴 요소를 문서에 넣기 바로 전에 */
export function armGuard(family, doc = globalThis.document) {
    if (!FAMILIES[family] || armed.has(family)) return false;
    armed.add(family);
    if (!listening && doc?.addEventListener) { doc.addEventListener('load', onLoad, true); listening = true; }
    syncAll(doc);
    return true;
}
/** 그 지킴 요소가 문서에 더는 없을 때 — 지금 문서에 남아 있으면 그대로 둬요 */
export function disarmGuard(family, doc = globalThis.document) {
    if (!armed.has(family)) return false;
    try { if (doc?.querySelector?.(FAMILIES[family])) return false; } catch { return false; }
    armed.delete(family);
    syncAll(doc);
    return true;
}
export const guardArmed = family => armed.has(family);
/** 시험용 */
export function _resetGuards() { armed.clear(); listening = false; guardStats.scans = guardStats.writes = 0; }
