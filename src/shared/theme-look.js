// 9.0.4 테마 색 · 밝기 따라가기 한 구독: 개인 확장 · 애드온이 저마다 MutationObserver 로 html[style · class · data-theme] · body[class · style] ·
//   head(<style id="salty-vars"> 글)를 보던 감시자 여럿(북마크 · 전개 지시 · 에셋 · TTS …)를
//   공용 감시 허브(src/dom-watch.js) 구독 몇 개와 rAF 하나로 묶어요. 바뀐 종류를 모았다가 다음 프레임에 그 종류를 원하는 함수만 한 번씩 불러요.
// 쓰는 법:
//   (애드온 폴더에서는 src/shared/theme-look.js 를 상대 경로로 가져와요 — 예: src/addons/<폴더>/ 에서는 ../../shared/theme-look.js)
//   const off = onThemeLook(kinds => relook(), { watch: 'html body head', name: '내 애드온' });   // kinds: 이번 프레임에 바뀐 종류(Set)
// 종류: html.style · html.class · html.data-theme(합쳐 html) · body.class · body.style(합쳐 body) · head(head 안 무엇이든 — <style> 을 갈아 끼우거나 글을 바꿈) ·
//       vars(테마 색 변수 <style id="salty-vars"> · <style id="salty-dem-vars"> 안만)
// 실리태번은 스와이프 애니메이션마다 :root style 에 --slide-mes-* 를 썼다 지워요(script.js swipe) — 색과 무관해서 그것만 바뀐 html style 은 건너뛰어요(따로 깔던 런처 확장에 있던 거르기를 모두에게).
import { watchDom } from '../dom-watch.js';

const KEY = Symbol.for('blue-lemonade.theme-look.v1');
const VARS = new Set(['salty-vars', 'salty-dem-vars']);
const GROUPS = { html: ['html.style', 'html.class', 'html.data-theme'], body: ['body.class', 'body.style'] };

/** :root style 글에서 실리태번 스와이프 움직임 변수(--slide-mes-*)를 뺀 것 — 이것만 다르면 색이 바뀐 게 아니에요 */
export const withoutMotion = style => String(style || '').split(';').map(s => s.trim()).filter(s => s && !/^--slide-mes-[\w-]*\s*:/.test(s)).join(';');

function kindsOf(watch) {
    const out = new Set();
    for (const w of String(watch || 'html body').split(/[\s,]+/).filter(Boolean)) for (const k of GROUPS[w] || [w]) out.add(k);
    return out;
}

function state(doc) {
    const win = doc.defaultView || globalThis;
    let s = win[KEY];
    if (s && s.doc === doc) return s;
    s = win[KEY] = { doc, win, listeners: new Set(), pending: new Set(), raf: 0, offs: [], head: null };
    return s;
}
function schedule(s) {
    if (s.raf) return;
    const run = () => flush(s);
    s.rafTimer = !(typeof s.win.requestAnimationFrame === 'function' && !s.doc.hidden);   // 숨은 탭은 rAF 가 멈춰요
    s.raf = s.rafTimer ? s.win.setTimeout(run, 16) : s.win.requestAnimationFrame(run);
}
function cancelFlush(s) {
    if (!s.raf) return;
    if (s.rafTimer) s.win.clearTimeout(s.raf); else s.win.cancelAnimationFrame?.(s.raf);
    s.raf = 0;
}
function flush(s) {
    s.raf = 0;
    const kinds = s.pending; s.pending = new Set();
    if (!kinds.size) return;
    for (const l of [...s.listeners]) {
        if (!s.listeners.has(l)) continue;
        let hit = false; for (const k of kinds) if (l.kinds.has(k)) { hit = true; break; }
        if (!hit) continue;
        try { l.fn(kinds); } catch (error) { console.warn('[Blue Lemonade] 테마 색 따라가기', l.name || '', error); }
    }
}
const mark = (s, kind) => { s.pending.add(kind); schedule(s); };
function start(s) {
    const { doc } = s, html = doc.documentElement;
    if (html) s.offs.push(watchDom(html, { attributes: ['style', 'class', 'data-theme'], attributeOldValue: true, name: '테마 색 따라가기 (html)' }, records => {
        for (const r of records) {
            if (r.attributeName === 'style' && withoutMotion(r.oldValue) === withoutMotion(html.getAttribute('style'))) continue;
            mark(s, 'html.' + r.attributeName);
        }
    }));
    if (doc.body) s.offs.push(watchDom(doc.body, { attributes: ['class', 'style'], name: '테마 색 따라가기 (body)' }, records => { for (const r of records) mark(s, 'body.' + r.attributeName); }));
}
// head 는 원하는 함수가 있을 때만 봐요(<style> 이 많이 붙는 시작 때 기록이 많아요)
function syncHead(s) {
    const want = [...s.listeners].some(l => l.kinds.has('head') || l.kinds.has('vars'));
    if (want && !s.head && s.doc.head) {
        s.head = watchDom(s.doc.head, { childList: true, subtree: true, characterData: true, name: '테마 색 따라가기 (head)' }, records => {
            mark(s, 'head');
            for (const r of records) {
                let el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
                if (el && el !== s.doc.head && VARS.has(el.id)) { mark(s, 'vars'); break; }
                if (r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].some(n => VARS.has(n.id))) { mark(s, 'vars'); break; }
            }
        });
    } else if (!want && s.head) { s.head(); s.head = null; }
}

/**
 * 테마 색 · 밝기가 바뀌면 다음 프레임에 fn(바뀐 종류 Set) 을 불러요. 돌려주는 값은 끊는 함수예요.
 * @param {(kinds: Set<string>) => void} fn
 * @param {{ watch?: string, name?: string, doc?: Document }} [options]  watch: 'html body head vars' 중 원하는 것(기본 'html body')
 */
export function onThemeLook(fn, { watch = 'html body', name = '', doc = globalThis.document } = {}) {
    if (typeof fn !== 'function' || !doc?.documentElement) return () => {};
    const s = state(doc);
    const l = { fn, kinds: kindsOf(watch), name };
    if (!s.listeners.size && !s.offs.length) start(s);
    s.listeners.add(l);
    syncHead(s);
    return () => {
        if (!s.listeners.delete(l)) return;
        syncHead(s);
        if (!s.listeners.size) { for (const off of s.offs) off(); s.offs = []; cancelFlush(s); s.pending.clear(); }
    };
}

/** 진단 · 시험용 */
export function themeLookStats(doc = globalThis.document) {
    const s = doc?.defaultView?.[KEY] || globalThis[KEY];
    if (!s) return { listeners: 0, watching: false, head: false };
    return { listeners: s.listeners.size, watching: s.offs.length > 0, head: !!s.head, names: [...s.listeners].map(l => l.name) };
}
