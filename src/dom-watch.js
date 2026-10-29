// 공용 DOM 감시자 (8.2.7 perf-fade): 같은 뿌리(body · #chat · html)를 여러 모듈이 저마다 MutationObserver 로 보던 것을 뿌리마다 감시자 하나에 구독으로 묶어요.
// 왜: 감시자가 n 개면 변화 하나에 기록(MutationRecord)이 n 벌 만들어지고 콜백도 n 번 따로 돌아요. 실리태번 · 테마 · 애드온이 body 를 스무 군데 넘게 보고 있어,
//   채팅 300개 열기처럼 변화가 많은 장면에서 기록 만들기 · 콜백 오가기만으로도 시간이 들었어요(폰 4배 · 성능 관문 MO 콜백 시간 순정 2.6초 → 테마 12.4초).
// 쓰는 법:
//   import { watchDom } from './dom-watch.js';
//   const off = watchDom(document.body, { attributes: ['class'] }, records => { … });            // body 자기 class 만(subtree 없음)
//   const off = watchDom(chat, { childList: true, subtree: true, when: 'frame' }, records => { … }); // 다음 프레임에 한 번(그 사이 기록을 모아서)
//   off();   // 구독 끊기 — 마지막 구독이 끊기면 그 뿌리의 감시자도 끊어요
// spec: childList · subtree · attributes(true = 전부, 배열 = 그 이름만) · characterData · attributeOldValue · characterDataOldValue
//   · when: 'now'(기본 — 원래 MutationObserver 콜백과 같은 때) | 'frame'(다음 rAF 에 모아서 한 번) | 'idle'(한가할 때, timeout 기본 200ms)
//   · skip(record) → true 면 그 기록은 이 구독에 안 줘요(예: 내 단추 안 변화)
// 받는 기록은 그 구독이 원한 종류만이에요 — subtree 가 없는 구독은 뿌리 자신의 기록만, attributes 배열이면 그 이름만 받아요.
// 한 구독이 던져도 다른 구독은 그대로 받아요(콘솔 경고만). 'frame' · 'idle' 구독은 끊으면 모아 둔 기록을 버려요.
// subtree 가 없는 구독(뿌리 자신만)은 문서마다 감시자 하나로 여러 뿌리를 함께 봐요 — 기록의 target 이 곧 뿌리라 바로 나눠 줄 수 있어요.
const HUBS = Symbol.for('blue-lemonade.dom-watch.v1');

function unionOf(subs) {
    const o = { childList: false, subtree: false, characterData: false, attributeOldValue: false, characterDataOldValue: false };
    let attrs = null, allAttrs = false;
    for (const s of subs) {
        const p = s.spec;
        if (p.childList) o.childList = true;
        if (p.subtree) o.subtree = true;
        if (p.characterData) o.characterData = true;
        if (p.attributeOldValue) o.attributeOldValue = true;
        if (p.characterDataOldValue) o.characterDataOldValue = true;
        if (p.attributes === true) allAttrs = true;
        else if (Array.isArray(p.attributes)) { attrs ??= new Set(); for (const a of p.attributes) attrs.add(a); }
    }
    const out = {};
    for (const [k, v] of Object.entries(o)) if (v) out[k] = true;
    if (allAttrs) out.attributes = true;
    else if (attrs?.size) { out.attributes = true; out.attributeFilter = [...attrs]; }
    if (out.attributeOldValue && !out.attributes) delete out.attributeOldValue;
    if (out.characterDataOldValue && !out.characterData) delete out.characterDataOldValue;
    return out;
}
const sameOpts = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 이 구독이 받을 기록인가 */
function wants(sub, record, root) {
    const p = sub.spec;
    if (!p.subtree && record.target !== root) return false;
    if (record.type === 'childList') return !!p.childList;
    if (record.type === 'attributes') return p.attributes === true || (Array.isArray(p.attributes) && p.attributes.includes(record.attributeName));
    if (record.type === 'characterData') return !!p.characterData;
    return false;
}

function hubsOf(win) {
    let h = win[HUBS];
    if (!h) { h = win[HUBS] = { roots: new Map(), direct: null }; }
    return h;
}

function deliver(win, sub, list) {
    if (!list.length) return;
    if (sub.when === 'now') { call(sub, list); return; }
    for (const r of list) sub.pending.push(r);
    if (sub.timer) return;
    if (sub.when === 'idle' && typeof win.requestIdleCallback === 'function') sub.timer = { idle: win.requestIdleCallback(() => flushSub(sub), { timeout: sub.timeout }) };
    else if (sub.when === 'idle') sub.timer = { timeout: win.setTimeout(() => flushSub(sub), Math.min(sub.timeout, 50)) };
    else sub.timer = { raf: win.requestAnimationFrame(() => flushSub(sub)) };
}
function flushSub(sub) {
    sub.timer = null;
    if (sub.off) return;
    const list = sub.pending; sub.pending = [];
    if (list.length) call(sub, list);
}
const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
function call(sub, list) {
    const t = now();
    try { sub.fn(list); } catch (error) { console.warn('[Blue Lemonade] 감시 구독 오류', sub.name || '', error); }
    sub.calls++; sub.ms += now() - t;
}
function cancel(win, sub) {
    const t = sub.timer; sub.timer = null; sub.pending = [];
    if (!t) return;
    if (t.raf) win.cancelAnimationFrame?.(t.raf);
    if (t.idle) win.cancelIdleCallback?.(t.idle);
    if (t.timeout) win.clearTimeout(t.timeout);
}

function dispatch(win, subsOf, records) {
    // 구독마다 받을 기록을 모아서 한 번씩
    const lists = new Map();
    for (const r of records) {
        for (const [sub, root] of subsOf(r)) {
            if (sub.off || !wants(sub, r, root)) continue;
            if (sub.skip) { try { if (sub.skip(r)) continue; } catch { continue; } }
            let l = lists.get(sub); if (!l) lists.set(sub, l = []); l.push(r);
        }
    }
    for (const [sub, list] of lists) deliver(win, sub, list);
}

/**
 * root 아래 변화를 구독해요. 돌려주는 값은 끊는 함수예요.
 * @param {Node} root
 * @param {{childList?:boolean, subtree?:boolean, attributes?:boolean|string[], characterData?:boolean, attributeOldValue?:boolean, characterDataOldValue?:boolean, when?:'now'|'frame'|'idle', timeout?:number, skip?:(r:MutationRecord)=>boolean, name?:string}} spec
 * @param {(records: MutationRecord[]) => void} fn
 */
export function watchDom(root, spec, fn) {
    const win = root?.ownerDocument?.defaultView || root?.defaultView || globalThis;
    if (!root || typeof fn !== 'function' || typeof win.MutationObserver !== 'function') return () => {};
    const s = { ...spec };
    if (Array.isArray(s.attributes) && !s.attributes.length) delete s.attributes;
    const sub = { spec: s, fn, when: s.when || 'now', timeout: s.timeout ?? 200, skip: s.skip, name: s.name, pending: [], timer: null, off: false, calls: 0, ms: 0 };
    const hubs = hubsOf(win);
    if (s.subtree) {
        let hub = hubs.roots.get(root);
        if (!hub) {
            hub = { subs: new Set(), opts: null, mo: null };
            const pair = [null], only = () => pair;
            hub.mo = new win.MutationObserver(records => {
                // 감시자 옵션이 곧 그 구독이 원한 것(full)이면 기록을 하나씩 따지지 않고 그대로 넘겨요 — 구독이 하나뿐일 때(대부분)는 예전 감시자와 같은 일만 해요
                //   구독 차례(만든 순서)는 예전 감시자들이 불리던 순서와 같아요
                for (const x of hub.subs) {
                    if (x.off) continue;
                    if (x.full && !x.skip) { deliver(win, x, records); continue; }
                    pair[0] = [x, root]; dispatch(win, only, records);
                }
            });
            hubs.roots.set(root, hub);
        }
        hub.subs.add(sub);
        refit(hub, root);
        return () => {
            if (sub.off) return; sub.off = true; cancel(win, sub);
            hub.subs.delete(sub);
            if (!hub.subs.size) { hub.mo.disconnect(); hubs.roots.delete(root); } else refit(hub, root);
        };
    }
    // 뿌리 자신만 보는 구독: 문서마다 감시자 하나 — 기록의 target 이 뿌리
    let d = hubs.direct;
    if (!d) {
        d = hubs.direct = { byRoot: new Map(), opts: new Map(), mo: null, win, rebuild: false };
        // 기록을 뿌리(target)별로 묶어 그 뿌리 구독에만 — 구독이 원한 것과 같으면(full) 묶음 그대로
        d.handle = records => {
            const groups = new Map();
            for (const r of records) { if (!d.byRoot.has(r.target)) continue; let g = groups.get(r.target); if (!g) groups.set(r.target, g = []); g.push(r); }
            for (const [root, list] of groups) for (const x of d.byRoot.get(root) || []) {
                if (x.off) continue;
                if (x.full && !x.skip) { deliver(win, x, list); continue; }
                deliver(win, x, list.filter(r => { if (!wants(x, r, root)) return false; if (!x.skip) return true; try { return !x.skip(r); } catch { return false; } }));
            }
        };
        d.mo = new win.MutationObserver(records => d.handle(records));
    }
    let subs = d.byRoot.get(root); if (!subs) d.byRoot.set(root, subs = new Set());
    subs.add(sub);
    refitDirect(d);
    return () => {
        if (sub.off) return; sub.off = true; cancel(win, sub);
        subs.delete(sub);
        if (!subs.size) d.byRoot.delete(root);
        refitDirect(d);
    };
}
/** 감시자 옵션(opts)으로 오는 기록이 전부 이 구독이 원한 종류인가 */
function covers(spec, opts) {
    if (opts.childList && !spec.childList) return false;
    if (opts.characterData && !spec.characterData) return false;
    if (opts.subtree && !spec.subtree) return false;
    if (opts.attributes) {
        if (spec.attributes === true) return true;
        if (!Array.isArray(spec.attributes) || !opts.attributeFilter) return false;
        return opts.attributeFilter.every(a => spec.attributes.includes(a));
    }
    return true;
}
function refit(hub, root) {
    const opts = unionOf(hub.subs);
    for (const x of hub.subs) x.full = covers(x.spec, opts);
    if (hub.opts && sameOpts(hub.opts, opts)) return;
    hub.opts = opts;
    hub.mo.observe(root, opts);   // 같은 노드를 다시 observe 하면 옵션만 바뀌고 쌓인 기록은 그대로예요
}
function refitDirect(d) {
    // 끊긴 뿌리가 있으면 다음 마이크로태스크에 한 번 다시 걸어요(MutationObserver 는 노드 하나만 떼는 방법이 없어요 · 여럿을 끊어도 한 번) — 쌓인 기록은 그때 남은 구독에 나눠 줘요.
    //   새 뿌리 · 넓어진 옵션은 바로 걸어요(그 사이 변화를 놓치지 않게)
    let dropped = false;
    for (const root of d.opts.keys()) if (!d.byRoot.has(root)) { dropped = true; break; }
    if (dropped && !d.rebuild) {
        d.rebuild = true;
        queueMicrotask(() => {
            d.rebuild = false;
            const pending = typeof d.mo.takeRecords === 'function' ? d.mo.takeRecords() : [];
            d.mo.disconnect(); d.opts.clear();
            for (const [root, subs] of d.byRoot) { const o = unionOf(subs); for (const x of subs) x.full = covers(x.spec, o); d.opts.set(root, o); d.mo.observe(root, o); }
            if (pending.length) d.handle(pending);
        });
    }
    for (const [root, subs] of d.byRoot) {
        const o = unionOf(subs);
        for (const x of subs) x.full = covers(x.spec, o);
        if (d.opts.has(root) && sameOpts(d.opts.get(root), o)) continue;
        d.opts.set(root, o); d.mo.observe(root, o);
    }
}

/** 기록들에서 새로 붙은 요소만(중복 없이, 문서에 붙어 있는 것) — 구독 콜백에서 흔히 쓰는 모음 */
export function addedElements(records) {
    const out = new Set();
    for (const r of records) if (r.type === 'childList') for (const n of r.addedNodes) if (n.nodeType === 1 && n.isConnected) out.add(n);
    return out;
}

/** 진단 · 시험용: 문서에 걸린 공용 감시자 수와 구독 수 */
export function domWatchStats(win = globalThis) {
    const h = win[HUBS];
    if (!h) return { observers: 0, subscriptions: 0, roots: 0 };
    let subscriptions = 0;
    for (const hub of h.roots.values()) subscriptions += hub.subs.size;
    let direct = 0;
    if (h.direct) for (const s of h.direct.byRoot.values()) direct += s.size;
    // 구독마다 이름 · 받은 횟수 · 콜백 시간(ms) — 성능 관문은 감시자를 만든 파일(dom-watch.js)로만 세니, 누가 얼마나 쓰는지는 여기서 봐요
    const each = [];
    for (const hub of h.roots.values()) for (const s of hub.subs) each.push({ name: s.name || '(이름 없음)', subtree: true, calls: s.calls, ms: Math.round(s.ms * 10) / 10 });
    if (h.direct) for (const set of h.direct.byRoot.values()) for (const s of set) each.push({ name: s.name || '(이름 없음)', subtree: false, calls: s.calls, ms: Math.round(s.ms * 10) / 10 });
    return { observers: h.roots.size + (h.direct && h.direct.byRoot.size ? 1 : 0), subscriptions: subscriptions + direct, roots: h.roots.size + (h.direct ? h.direct.byRoot.size : 0), each };
}
