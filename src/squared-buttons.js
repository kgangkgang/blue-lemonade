// Theme look: text buttons that SillyTavern or other extensions draw as thick pills or circles become
// slim rounded rectangles. Only a marker attribute is added; removing it restores the original shape.
// Switches, dots, badges, progress bars, avatars and icon-only round buttons keep their shape.
import { booting, afterBoot } from './boot-gate.js';

const ATTR = 'data-bl-squared';
const CANDIDATES = 'button,a,summary,label,[role="button"],[role="tab"],[tabindex],.menu_button,.qr--button,[class*="btn"],[class*="chip"],[class*="tab"],[class*="pill"]';
const SKIP_CLASS = /(switch|toggle|knob|dot|badge|spinner|progress|slider|avatar|thumb|count|indicator|scroll)/i;
const SKIP_AREA = '#send_form,.mes_buttons,.swipe_left,.swipe_right,[data-bl-native-ext-colors]';
// 7.5.4 상태를 나타내는 클래스는 생김새 열쇠에서 뺀다 (.on · .active · is-* 가 바뀌어도 같은 단추)
const STATE_CLASS = /^(?:on|off|active|inactive|selected|current|open|closed|hidden|disabled|focus(?:ed)?|hover|pressed|checked|is-|has-|bl-)/;
const SEEN_MAX = 400;
/** 7.5.4 표시한 단추의 생김새 열쇠: 태그 + 상태 아닌 클래스(정렬). 같은 생김새의 새 요소는 재지 않고 바로 표시한다 */
export function shapeKey(el) {
    const cls = typeof el.className === 'string' ? el.className : '';
    const tokens = cls.split(/\s+/).filter(t => t && !STATE_CLASS.test(t)).sort();
    return `${el.tagName}|${tokens.join(' ')}`;
}
let stop = null;

/** Keep connected roots whose ancestors are not already in this batch.
 * Walking ancestors avoids comparing every pair of sibling additions. */
export function compactRoots(nodes) {
    const roots = new Set([...nodes].filter(node => node?.isConnected));
    return [...roots].filter(node => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            if (roots.has(parent)) return false;
        }
        return true;
    });
}

export function syncSquaredButtons(on) {
    if (!on) { stop?.(); stop = null; return; }
    if (!stop) stop = watchSquaredButtons(document, window);
}

const alpha = color => {
    if (!color || color === 'transparent') return 0;
    const m = /rgba?\(([^)]+)\)/.exec(color); if (!m) return 1;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
};

/** 7.2.8 Checks that need no layout (same answers as the first lines of isRoundTextButton): run before offsetParent so
 *  marked, skipped and excluded elements never ask for layout. */
// 8.0.8: 뿌리 하나를 훑을 때는 건너뛸 구역(SKIP_AREA)을 뿌리 아래에서 한 번만 모아(`areas`) 후보마다 조상을 다시 오르지 않는다 —
//   메시지 300개의 .mes_button(실리태번이 tabindex 를 달아 후보가 됨) 수천 개가 저마다 closest(SKIP_AREA) 로 조상을 오르던 것.
//   판정은 같다: 뿌리 자신 · 뿌리의 조상이 구역이면 scan 이 뿌리째 건너뛰고, 뿌리 아래 구역은 areas 가 품는지로 본다.
//   (contains 가 없는 가짜 문서(시험)에서는 예전처럼 closest 로)
// 10-28: 구역은 Set 으로 들고, 후보에서 조상으로 오르며 구역인지 본다 — 예전에는 후보마다 구역 전부(메시지 300개면 .mes_buttons 300여 개)에
//   contains 를 물어 body 를 훑을 때 후보 수천 × 구역 수백 번이었다(긴 채팅 · 폰 4배에서 설정 슬라이더 한 걸음마다 약 0.7초). 판정은 같다(구역 자신 · 그 안 = 참).
export const inArea = (el, areas) => {
    if (!areas || typeof el.contains !== 'function') return !!el.closest(SKIP_AREA);
    if (!areas.size) return false;
    for (let p = el; p; p = p.parentElement) if (areas.has(p)) return true;
    return false;
};
function cheapSkip(el, view, areas = null) {
    if (!(el instanceof view.HTMLElement) || el.hasAttribute(ATTR)) return true;
    if (el.matches('input,select,textarea,img,svg') || inArea(el, areas)) return true;
    const cls = typeof el.className === 'string' ? el.className : '';
    return SKIP_CLASS.test(cls) || SKIP_CLASS.test(el.id);
}

/** True when the element is a painted, clickable text control whose corners make a pill or circle. */
export function isRoundTextButton(el, view = el.ownerDocument.defaultView, areas = null) {
    if (cheapSkip(el, view, areas)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.height < 24 || rect.width < 24) return false;
    const text = (el.innerText || '').trim();
    // A single glyph in a circle is an icon (?, ✕, ⚙); two or more characters are a label.
    if ([...text].length < 2) return false;
    const s = view.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const raw = s.borderTopLeftRadius;
    const radius = raw.endsWith('%') ? parseFloat(raw) * Math.min(rect.width, rect.height) / 100 : parseFloat(raw);
    if (!(radius > 10 && radius >= rect.height / 2 - 2)) return false;
    const painted = alpha(s.backgroundColor) > 0.03 || parseFloat(s.borderTopWidth) > 0 || s.backgroundImage !== 'none' || s.boxShadow !== 'none';
    if (!painted) return false;
    const clickable = el.matches('button,a,summary,[role="button"],[role="tab"],.menu_button') || s.cursor === 'pointer';
    return clickable;
}

// 7.8.5: 인라인 style 에서 padding 위 · 아래만 바뀐 것(control-ink 의 글자 세로 맞춤)은 모양 · 보임이 안 바뀐다 — 다시 재지 않는다.
// 예전에는 그 쓰기마다 이 감시가 다시 재기를 걸어, 확장 서랍을 열 때 화면 전체 다시 계산이 10번 남짓 났다(리그 CPU 4배)
const PADDING_ONLY = /^padding-(top|bottom)$/;
function styleMap(text) {
    const map = new Map();
    for (const part of String(text || '').split(';')) { const i = part.indexOf(':'); if (i > 0) map.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()); }
    return map;
}
export function paddingOnly(record) {
    if (record.type !== 'attributes' || record.attributeName !== 'style' || typeof record.target?.getAttribute !== 'function') return false;
    const before = styleMap(record.oldValue), after = styleMap(record.target.getAttribute('style'));
    let changed = false;
    for (const key of new Set([...before.keys(), ...after.keys()])) {
        if (before.get(key) === after.get(key)) continue;
        if (!PADDING_ONLY.test(key)) return false;
        changed = true;
    }
    return changed;
}

// (10-29 perf-persona) 테마 자신의 성능 표식(#chat 의 bl-chat-light · bl-chat-covered)만 바뀐 class 기록은 단추의 모양 · 보임을 바꾸지 않는다.
//   예전에는 그 기록도 #chat 을 뿌리로 넣어 메시지 300개의 후보(.mes_button 등 수천 개)를 offsetParent 로 다시 쟀다 — 서랍 덮개(chat-light.js)가
//   #chat 을 content-visibility:hidden 으로 둔 동안에는 그 읽기가 하나하나 건너뛴 내용을 그 자리에서 계산하게 해, 폰 리그에서 서랍 열기가 0.25 → 3.5초(재계산 284번)가 됐다.
// 8.2.7 폰: 몰입 읽기(reader.js)는 채팅을 내리고 올릴 때마다 body 에 bl-bars-hidden 을 붙였다 뗀다 — 위 바 · 입력판을 top · transform 으로 밀기만 해서
//   (css/29-reader-onehand.css) 단추 보임 · 크기 · 모서리는 같다. 예전에는 그때마다 body 를 뿌리로 문서 전체를 다시 쟀다(스크롤 중 0.3초대 끊김)
const PERF_MARKS = new Set(['bl-chat-light', 'bl-chat-covered', 'bl-bars-hidden']);
export function perfMarkOnly(record) {
    if (record.type !== 'attributes' || record.attributeName !== 'class' || typeof record.target?.getAttribute !== 'function') return false;
    const words = v => new Set(String(v || '').split(/\s+/).filter(Boolean));
    const before = words(record.oldValue), after = words(record.target.getAttribute('class'));
    let changed = false;
    for (const c of new Set([...before, ...after])) {
        if (before.has(c) === after.has(c)) continue;
        if (!PERF_MARKS.has(c)) return false;
        changed = true;
    }
    return changed;
}
const COVERED = '#chat.bl-chat-covered';
// 10-30 perf-icon: 속성을 같은 값으로 다시 쓴 기록(oldValue 가 지금 값과 같음)은 모양 · 보임을 바꾸지 않아요.
//   실리태번 refreshSwipeButtons 는 메시지가 하나 붙을 때마다 넘길 수 없는 메시지 전부에 classList.remove('swipes_visible', 'last_swipe') 를 불러
//   (없는 클래스를 빼도 class 기록이 나요) 메시지마다 기록이 하나씩 났고, 이 감시는 그때마다 메시지 하나하나를 다시 쟀어요(긴 채팅에서 메시지 1개 그리기마다 150번 남짓).
//   한 콜백에 같은 요소의 기록이 여럿이면 그중 하나라도 값이 달라졌으면 남으니, 「콜백 사이에 실제로 바뀐 것」만 남는 셈이에요.
// 같은 까닭으로, 실리태번이 메시지(.mes)에 다는 스와이프 표시 클래스(fade · last_swipe · swipes_visible)만 바뀐 기록도 다시 재지 않아요 —
//   실리태번 style.css 와 테마 css 가 이 클래스로 고르는 것은 .swipe_left · .swipe_right · .swipes-counter 뿐이고(투명도 · 숨김 · 전환),
//   그 셋은 이 감시가 처음부터 보지 않는 구역 · 클래스예요(SKIP_AREA · SKIP_CLASS 의 count). 「더 보기」로 메시지 100개를 붙이면 fade 가 메시지 전부에 붙어 150번 다시 쟀어요.
const SWIPE_MARKS = new Set(['fade', 'last_swipe', 'swipes_visible']);
export function swipeMarkOnly(record) {
    if (record.type !== 'attributes' || record.attributeName !== 'class' || typeof record.target?.getAttribute !== 'function' || !record.target.classList?.contains('mes')) return false;
    const words = v => new Set(String(v || '').split(/\s+/).filter(Boolean));
    const before = words(record.oldValue), after = words(record.target.getAttribute('class'));
    if (!before.has('mes')) return false;
    let changed = false;
    for (const c of new Set([...before, ...after])) {
        if (before.has(c) === after.has(c)) continue;
        if (!SWIPE_MARKS.has(c)) return false;
        changed = true;
    }
    return changed;
}
export function unchangedAttr(record) {
    return record.type === 'attributes' && record.oldValue !== undefined && typeof record.target?.getAttribute === 'function' && record.oldValue === record.target.getAttribute(record.attributeName);
}
// 10-30 perf-gaps: 긴 채팅 가볍게(chat-light.js)는 화면 밖 메시지(#chat > .mes)에 content-visibility:auto 를 걸어 안쪽 계산을 건너뛰어요.
//   그 안의 후보에 offsetParent 를 물으면 크롬이 그 메시지만 그 자리에서 풀어 계산해요 — 메시지 하나마다 스타일 · 배치 한 번씩이라
//   긴 채팅 300 열기(폰 4배)에서 배치 300번 · 약 5초, body class 가 바뀐 뒤 훑기(스크롤 중 데우스 하늘 표시 등)에서 0.5~6초였어요.
//   checkVisibility({ contentVisibilityAuto: true }) 는 풀지 않고 「건너뛴 채인지」만 알려 줘요(300개 1ms). 건너뛴 메시지 안 후보는 재지 않고
//   그 메시지를 적어 두었다가, 화면 가까이 와서 크롬이 계산을 시작할 때(contentvisibilityautostatechange · skipped=false — 보이기 전 여유 거리에서 와요)
//   다음 프레임 맨 앞에서 그 메시지만 재요. 판정 · 표시는 같아요(알려진 생김새는 예전처럼 변화 때 바로 붙음 · restamp).
//   서랍 덮개(bl-chat-covered · content-visibility:hidden)일 때는 예전 길 그대로예요.
export const LIGHT_MES = '#chat > .mes';
/** 후보가 「건너뛴 content-visibility:auto 메시지」 안이면 그 메시지, 아니면 null — 계산을 풀지 않는 읽기만 */
export function skippedMessageOf(el, view, cache = new Map()) {
    if (typeof el.checkVisibility !== 'function' || el.checkVisibility({ contentVisibilityAuto: true })) return null;
    const mes = el.closest?.(LIGHT_MES);
    if (!mes || mes === el) return null;
    if (!cache.has(mes)) cache.set(mes, mes.checkVisibility({ contentVisibilityAuto: true }) && view.getComputedStyle(mes).contentVisibility === 'auto');
    return cache.get(mes) ? mes : null;
}

export function watchSquaredButtons(doc, host) {
    const style = doc.createElement('style');
    style.dataset.blSquaredStyle = '';
    style.textContent = `[${ATTR}]{border-radius:var(--bl-r-btn,8px)!important}`;
    (doc.head || doc.documentElement).append(style);
    const roots = new Set(), waiting = new Set(), skippedMes = new Set();
    // 7.5.4 한 번 표시한 생김새 — 목록을 innerHTML 로 다시 그리는 확장(탭 · 칩이 새 요소가 됨)에서 새 요소가 0.3초 동안 둥글게 보였다가 네모가 되던 것을 막는다
    const seen = new Map();
    const remember = el => { if (seen.size >= SEEN_MAX) seen.clear(); seen.set(shapeKey(el), true); };
    // 뿌리 아래 건너뛸 구역 — 뿌리 자신(또는 조상)이 구역이면 null(뿌리째 건너뜀)
    const areasOf = root => (root.closest?.(SKIP_AREA) ? null : new Set(root.querySelectorAll?.(SKIP_AREA) || []));
    const restamp = el => {
        if (!seen.size) return;
        const areas = areasOf(el); if (!areas) return;
        const list = el.matches?.(CANDIDATES) ? [el, ...el.querySelectorAll(CANDIDATES)] : el.querySelectorAll?.(CANDIDATES) || [];
        for (const c of list) if (seen.has(shapeKey(c)) && !cheapSkip(c, host, areas)) c.setAttribute(ATTR, '');
    };
    let timer = 0, frame = 0, stopped = false;
    // Measure every candidate first, then mark: marking between reads re-dirtied style and forced one recalc per button.
    function scan(root, found) {
        if (!root?.isConnected) return;
        const areas = areasOf(root); if (!areas) return;
        const list = root.matches?.(CANDIDATES) ? [root, ...root.querySelectorAll(CANDIDATES)] : root.querySelectorAll(CANDIDATES);
        const light = !doc.getElementById?.('chat')?.classList?.contains('bl-chat-covered'), cache = new Map();
        for (const el of list) {
            if (cheapSkip(el, host, areas)) continue;
            const mes = light ? skippedMessageOf(el, host, cache) : null;
            if (mes) { skippedMes.add(mes); continue; }   // 화면 가까이 오면(onLightState) 그 메시지만 재요
            if (el.offsetParent !== null && isRoundTextButton(el, host, areas)) found.push(el);
        }
    }
    // 7.2.8 Measure at the start of a frame: the layout read there is the one the frame needs anyway. Read from the 300 ms timer,
    // it forced an extra full layout whenever the page changed again before the next paint (startup, chat open: 4x CPU 250-450 ms).
    function measure() {
        timer = 0; if (stopped) return;
        if (typeof host.requestAnimationFrame !== 'function') { flush(); return; }
        if (!frame) frame = host.requestAnimationFrame(flush);
    }
    function flush() {
        frame = 0; timer = 0; if (stopped) return;
        if (booting(doc)) { afterBoot(measure); return; }   // 7.7.4 시작 덮개 동안은 재지 않는다 — 걷힐 때 모아 둔 자리를 한 번에 (boot-gate.js)
        for (const mes of skippedMes) if (!mes.isConnected) skippedMes.delete(mes);
        const list = roots.has(doc.body) ? [doc.body] : compactRoots(roots);
        roots.clear();
        const found = [];
        for (const root of list) scan(root, found);
        for (const el of found) { el.setAttribute(ATTR, ''); remember(el); }
        // 새로 안 생김새는 건너뛰어 둔 메시지에도 바로 붙여요(예전처럼 재서 붙인 것과 같은 결과 · 배치 읽기 없음)
        if (found.length) for (const mes of skippedMes) restamp(mes);
    }
    const queueMany = nodes => {
        const ready = new Set();
        for (const node of nodes) {
            const el = node?.nodeType === 1 ? node : node?.parentElement;
            if (!el || !el.isConnected || el.closest?.('style,script')) continue;
            // Streaming changes a message repeatedly; inspect it once generation ends.
            if (doc.body.dataset.generating && el.closest?.('#chat')) { waiting.add(el.closest('.mes') || el); continue; }
            // (perf-persona) 서랍이 덮어 건너뛰는 채팅 안은 보이지 않는다 — 덮개가 걷힌 뒤에 잰다(건너뛴 내용을 재면 그 자리에서 계산을 강제한다)
            if (el.closest?.(COVERED)) { waiting.add(el.closest('.mes') || el); continue; }
            // Opening a closed drawer re-checks that subtree.
            if (el.closest?.('.drawer-content.closedDrawer')) continue;
            ready.add(el);
        }
        for (const el of ready.has(doc.body) ? [doc.body] : compactRoots(ready)) {
            restamp(el);   // Known shapes still update in the observer callback, before paint.
            roots.add(el);
        }
        if (roots.size && !timer && !frame) timer = host.setTimeout(measure, 300);
    };
    const queue = node => queueMany([node]);
    // Drawers and popups open by class/style changes, so attribute changes re-check that subtree.
    const observer = new host.MutationObserver(records => {
        const pending = new Set();
        for (const r of records) {
            // 긴 채팅 가볍게가 꺼지면(메시지가 줄어 bl-chat-light 가 빠짐) 건너뛰던 메시지는 사건 없이 그려져요 — 적어 둔 것을 다시 재요
            if (perfMarkOnly(r) && skippedMes.size && String(r.oldValue || '').split(' ').includes('bl-chat-light') && !r.target.classList?.contains('bl-chat-light')) { for (const mes of skippedMes) pending.add(mes); skippedMes.clear(); }
            if (perfMarkOnly(r)) { if (!r.target.classList?.contains('bl-chat-covered') && !doc.body.dataset.generating) { for (const node of waiting) pending.add(node); waiting.clear(); } continue; }
            if (r.attributeName === 'data-generating') { if (!doc.body.dataset.generating) { for (const node of waiting) pending.add(node); waiting.clear(); } continue; }
            if (unchangedAttr(r) || swipeMarkOnly(r)) continue;   // 10-30 perf-icon: 같은 값을 다시 쓴 기록 · 스와이프 표시만 바뀐 메시지는 다시 재지 않아요
            if (r.type === 'childList') r.addedNodes.forEach(node => pending.add(node)); else if (!paddingOnly(r)) pending.add(r.target);
        }
        queueMany(pending);
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'data-generating'] });
    const resize = () => queue(doc.body);
    host.addEventListener('resize', resize);
    const onLightState = event => {
        const mes = event.target;
        if (event.skipped || stopped || !skippedMes.delete(mes) || !mes.isConnected) return;
        restamp(mes); roots.add(mes);
        if (timer) { host.clearTimeout(timer); timer = 0; }
        if (typeof host.requestAnimationFrame !== 'function') flush(); else if (!frame) frame = host.requestAnimationFrame(flush);
    };
    doc.addEventListener?.('contentvisibilityautostatechange', onLightState, true);
    queue(doc.body);
    return () => {
        stopped = true; observer.disconnect(); host.clearTimeout(timer); if (frame) host.cancelAnimationFrame?.(frame); host.removeEventListener('resize', resize);
        doc.removeEventListener?.('contentvisibilityautostatechange', onLightState, true); skippedMes.clear();
        for (const el of doc.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
        style.remove();
    };
}
