// 8.0.8 단추 아이콘 › 화면에서 고르기 — 확장이 더한 단추(요술봉 메뉴 항목 · 입력줄 아이콘 · 메시지 단추 …)를 화면에서 눌러 고른다.
//
// 1) 고르기(startPicking): 설정 창을 닫은 채 화면 위 단추들을 고를 수 있게 표시하고, 하나를 누르면 그 단추의 「열쇠」를 만든다.
//    열쇠 '<어디>|<무엇으로>|<값>' (role-icons-core.js parsePickKey) — id → data-* → title/aria-label → 클래스(메시지 단추) → 글자 → 몇 번째.
//    확장이 꺼졌다 켜져도, 새로고침 뒤에도 같은 단추를 다시 찾아야 하므로 자리(좌표) · 생성된 번호 같은 것은 쓰지 않는다.
// 2) 다시 찾기(syncPicks): 저장된 열쇠마다 단추를 찾아 data-bl-pick="<해시>" 표식을 단다 — CSS(role-icons-core.js buildRoleCss)는 그 표식으로 건다.
//    요술봉 메뉴 · 채팅 메시지처럼 나중에 그려지거나 다시 그려지는 곳은 MutationObserver 가 「새로 붙은 가지」 안에서만 다시 찾는다(고른 단추가 없으면 감시도 없다).
// 3) 글자 옆 아이콘(「<i> 번역」 같은 메뉴 항목)은 아이콘 칸(<i> · <div class="fa-…">)에 표식을 달아 글자는 그대로 두고 그림만 바뀐다.
//    svg · img 아이콘은 가상 요소를 못 가지니 단추 자체에 data-bl-pick-inline 을 달고 CSS 가 아이콘을 숨긴 뒤 새 그림을 글자 앞에 끼운다.
import { parsePickKey, pickSlug, tidyPickedIcons, PICK_ATTR, PICK_INLINE_ATTR } from './role-icons-core.js';

// 고를 수 있는 것 — 단추 노릇을 하는 요소 (실리태번 · 확장이 흔히 쓰는 모양)
export const CANDIDATES = 'button, [role="button"], .menu_button, .list-group-item, .drawer-icon, .interactable, summary, .mes_button, .extensionsMenuExtensionButton, #leftSendForm > *, #rightSendForm > *, #nonQRFormItems > .fa-solid, #nonQRFormItems > .fa-regular, .extraMesButtons > *, .mes_buttons > *';   // css/49-role-icons.css 의 고르기 표시 목록과 같게
// 고르는 동안에도 눌러서 열어야 하는 것 — 메뉴 여는 단추(안의 항목을 고르려면 열어야 한다) · 메시지 「…」(숨은 단추를 펼친다). 이들은 내장 역할로 바꾼다
const OPENERS = '#options_button, #extensionsMenuButton, .extraMesButtonsHint';
// 글자 옆 아이콘 칸
const ICON_CHILD = ':scope > i, :scope > svg, :scope > img, :scope > div.fa-solid, :scope > div.fa-regular, :scope > div.fa-brands, :scope > span.fa-solid, :scope > .extensionsMenuExtensionButton';
const GENERIC_CLASS = /^(fa-|fas$|far$|fab$|interactable$|mes_button$|menu_button$|list-group-item$|displayNone$|is-|active$|toggleEnabled$|toggled$|disabled$|flex|align|margin|padding|text|bl-|salty-|ds-)/;
const SKIP_DATA = /^(i18n|bl|v|tooltip|toggle|target|id-|index|key$)/;
const stableId = id => typeof id === 'string' && /^[A-Za-z_][\w-]*$/.test(id) && !/\d{3,}/.test(id) && !/^(ui-id|jq|el|tmp|ember|react|v-)/.test(id);
const norm = s => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();

/** 눌린 자리에서 「단추」 하나로 — 없으면 null */
export function pickTarget(el) {
    if (!el?.closest) return null;
    let target = el.closest(CANDIDATES);
    if (!target) return null;
    // 메뉴 항목 안의 아이콘 칸을 눌렀으면 항목이 단추 (closest 는 가장 안쪽을 주므로 다른 묶음은 그대로 안쪽 것)
    if (target.classList.contains('extensionsMenuExtensionButton') && target.parentElement?.closest(CANDIDATES)) target = target.parentElement.closest(CANDIDATES);
    return target;
}

// 자기 글자(아이콘 칸 밖의 글자)
function ownText(el) {
    let text = '';
    for (const node of el.childNodes) {
        if (node.nodeType === 3) text += node.nodeValue;
        else if (node.nodeType === 1 && !node.matches?.('i, svg, img, .fa-solid, .fa-regular, .fa-brands, .extensionsMenuExtensionButton') && !node.hidden) text += ' ' + (node.textContent || '');
    }
    return norm(text).slice(0, 60);
}
function iconChild(el) {
    try { return el.querySelector(ICON_CHILD); } catch { return null; }
}
function iconHint(el) {
    const src = (el.matches?.('.fa-solid, .fa-regular, .fa-brands') ? el : iconChild(el)) || el;
    const classes = [...(src.classList || [])].filter(c => /^fa-(solid|regular|brands|[a-z0-9-]+)$/.test(c) && c !== 'fa-fw');
    const family = classes.find(c => /^fa-(solid|regular|brands)$/.test(c)), name = classes.find(c => !/^fa-(solid|regular|brands|fw|lg|sm|xs)$/.test(c));
    return family && name ? `${family} ${name}` : '';
}
function whereOf(el) {
    if (el.closest('.mes')) return '#chat';
    for (let p = el.parentElement; p; p = p.parentElement) if (stableId(p.id)) return `#${p.id}`;
    return '';
}
function dataKey(el) {
    for (const { name, value } of el.attributes || []) {
        if (!name.startsWith('data-')) continue;
        const key = name.slice(5);
        if (SKIP_DATA.test(key) || !/^[a-z][a-z0-9-]*$/.test(key)) continue;
        const v = norm(value);
        if (!v || v.length > 120 || /\d{4,}/.test(v) || /[|<>"'\\]/.test(v)) continue;
        return `${key}=${v}`;
    }
    return '';
}
function clsKey(el) {
    return [...el.classList].find(c => /^[A-Za-z_][\w-]*$/.test(c) && !GENERIC_CLASS.test(c) && !/\d{3,}/.test(c)) || '';
}
function candidatesIn(scope) {
    try { return [...scope.querySelectorAll(CANDIDATES)]; } catch { return []; }
}

/**
 * 단추 → { key, label, icon } — 저장할 열쇠와 이름(사람이 보는 것) · 지금 아이콘(Font Awesome 클래스, 미리보기용)
 * 우선: 자기 id → data-* → title/aria-label → (메시지 안이면) 클래스 → 글자 → 어디 안 몇 번째
 */
export function describePick(el) {
    const target = pickTarget(el);
    if (!target) return null;
    const where = whereOf(target);
    const title = norm(target.getAttribute?.('aria-label') || target.getAttribute?.('title') || '').slice(0, 120);
    const text = ownText(target);
    const label = (title || text || (stableId(target.id) ? target.id : '') || clsKey(target) || '단추').slice(0, 40);
    const icon = iconHint(target);
    const make = (by, value) => ({ key: `${where}|${by}|${value}`, label, icon, target });
    if (where === '#chat') { const cls = clsKey(target); if (cls) return make('cls', cls); }
    if (stableId(target.id)) return make('id', target.id);
    const data = dataKey(target);
    if (data) return make('data', data);
    if (title && !/[|]/.test(title)) return make('title', title);
    if (text && !/[|]/.test(text) && text.length <= 40) return make('text', text);
    const scope = where ? target.ownerDocument.querySelector(where) : target.ownerDocument.body;
    const index = scope ? candidatesIn(scope).indexOf(target) : -1;
    return index >= 0 ? make('nth', String(index)) : null;
}

const escapeCss = v => (globalThis.CSS?.escape ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&'));
/** 열쇠로 단추 찾기 — root 안(기본 문서 전체)에서, 여러 개면 전부(메시지 단추) */
export function findByKey(doc, key, root = null) {
    const k = typeof key === 'string' ? parsePickKey(key) : key;
    if (!k || !doc) return [];
    const scope = k.where ? doc.querySelector(k.where) : doc.body || doc;
    if (!scope) return [];
    // root(새로 붙은 가지)가 있으면 그 안에서만 — 가지가 어디 밖이면 없음, 가지가 어디를 통째로 담으면 어디 안
    let within = scope;
    if (root && root !== doc) { if (scope.contains(root)) within = root; else if (!root.contains(scope)) return []; }
    const inScope = el => scope === within || scope.contains(el);
    const all = sel => { try { const out = within.matches?.(sel) ? [within] : []; out.push(...within.querySelectorAll(sel)); return out.filter(inScope); } catch { return []; } };
    switch (k.by) {
        case 'id': { const el = doc.getElementById(k.value); return el && (!root || root === doc || root.contains(el)) ? [el] : []; }
        case 'data': { const i = k.value.indexOf('='); return all(`[data-${k.value.slice(0, i)}="${escapeCss(k.value.slice(i + 1))}"]`).slice(0, 1); }
        case 'title': { const v = escapeCss(k.value); return all(`[aria-label="${v}"], [title="${v}"]`).filter(el => el.matches(CANDIDATES)).slice(0, 1); }
        case 'cls': return all(`.${escapeCss(k.value)}`).filter(el => el.matches(CANDIDATES));
        case 'text': return all(CANDIDATES).filter(el => ownText(el) === k.value).slice(0, 1);
        case 'nth': { if (within !== scope) return []; const el = candidatesIn(scope)[Number(k.value)]; return el ? [el] : []; }
        default: return [];
    }
}

// ───────── 표식 달기 ─────────
function tag(el, slug) {
    const child = iconChild(el);
    const inline = child && ownText(el);
    if (inline && (child.localName === 'svg' || child.localName === 'img')) { el.setAttribute(PICK_INLINE_ATTR, slug); return; }
    (inline ? child : el).setAttribute(PICK_ATTR, slug);
}
function untagAll(doc, keep) {
    for (const attr of [PICK_ATTR, PICK_INLINE_ATTR]) for (const el of doc.querySelectorAll(`[${attr}]`)) if (!keep.has(el.getAttribute(attr))) el.removeAttribute(attr);
}
let observer = null, current = {};   // 지금 걸린 고른 단추 { slug: 열쇠 }
function tagIn(doc, root) {
    for (const [slug, key] of Object.entries(current)) for (const el of findByKey(doc, key, root)) tag(el, slug);
}
/** 설정 pickedIcons → 단추에 표식. 고른 단추가 없으면 표식을 걷고 감시도 끈다 (apply.js applyAll 이 부른다) */
export function syncPicks(picks, doc = globalThis.document) {
    if (!doc?.querySelectorAll) return;
    const next = {};
    for (const [slug, e] of Object.entries(tidyPickedIcons(picks))) next[slug] = e.key;
    const same = Object.keys(next).length === Object.keys(current).length && Object.keys(next).every(k => current[k] === next[k]);
    current = next;
    if (!same) untagAll(doc, new Set(Object.keys(current)));
    if (!Object.keys(current).length) { observer?.disconnect(); observer = null; return; }
    if (same && observer) return;   // applyAll 이 자주 불려도(슬라이더) 바뀐 게 없으면 다시 찾지 않는다 — 새로 붙는 단추는 감시가 잡는다
    tagIn(doc, null);
    if (observer || !globalThis.MutationObserver || !doc.body) return;
    observer = new MutationObserver((records) => {
        for (const r of records) for (const node of r.addedNodes) if (node.nodeType === 1 && !node.hasAttribute?.(PICK_ATTR)) tagIn(doc, node);
    });
    observer.observe(doc.body, { childList: true, subtree: true });
}
/** 시험용: 감시 상태 */
export const pickState = () => ({ observing: !!observer, slugs: Object.keys(current) });

// ───────── 화면에서 고르기 ─────────
const BAR_CLASS = 'bl-roleicon-pickbar';
const PICKING = 'bl-roleicon-picking';
let picking = null;
/**
 * 고르기 시작. onPick({ key, label, icon, slug }) · onCancel() — 둘 중 하나가 불린 뒤 끝난다.
 * 메뉴 여는 단추(≡ · 요술봉 · 메시지 …)는 그대로 눌려 열리고, 그 밖의 단추는 눌러도 동작하지 않고 골라진다.
 */
export function startPicking({ onPick, onCancel, doc = globalThis.document } = {}) {
    if (picking) stopPicking();
    const bar = doc.createElement('div');
    bar.className = BAR_CLASS;
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>바꿀 단추를 누르세요</span><button type="button" class="salty-btn">취소</button>';
    doc.body.append(bar);
    doc.documentElement.classList.add(PICKING);
    const finish = (result) => {
        stopPicking();
        if (result) onPick?.(result); else onCancel?.();
    };
    const onClick = (event) => {
        if (bar.contains(event.target)) { if (event.target.closest('button')) { event.preventDefault(); finish(null); } return; }
        if (event.target.closest?.(OPENERS)) return;   // 메뉴를 열어 안의 항목을 고를 수 있게
        const desc = describePick(event.target);
        if (!desc) return;   // 단추가 아닌 곳은 그대로 (채팅 스크롤 · 메뉴 밖 누르기)
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        finish({ key: desc.key, label: desc.label, icon: desc.icon, slug: pickSlug(desc.key) });
    };
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(null); } };
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', onKey, true);
    picking = { bar, doc, onClick, onKey };
    return true;
}
export function stopPicking() {
    if (!picking) return;
    const { bar, doc, onClick, onKey } = picking;
    picking = null;
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.documentElement.classList.remove(PICKING);
    bar.remove();
}
export const isPicking = () => !!picking;
