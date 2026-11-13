// 공용 DOM 감시자 (8.2.7 perf-fade → 9.0.4 허브): 같은 뿌리(body · #chat · html)를 여러 모듈이 저마다 MutationObserver 로 보던 것을 감시자 하나에 구독으로 묶어요.
// 왜: 감시자가 n 개면 변화 하나에 기록(MutationRecord)이 n 벌 만들어지고 콜백도 n 번 따로 돌아요. 실리태번 · 테마 · 애드온이 body 를 스무 군데 넘게 보고 있어,
//   채팅 300개 열기처럼 변화가 많은 장면에서 기록 만들기 · 콜백 오가기만으로도 시간이 들었어요(폰 4배 · MO 콜백 순정 1,851ms → 테마 5,761ms).
// 쓰는 법:
//   import { watchDom } from './dom-watch.js';
//   const off = watchDom(document.body, { attributes: ['class'] }, records => { … });                 // body 자기 class 만(subtree 없음)
//   const off = watchDom(document.body, { childList: true, subtree: true, exclude: '#chat', when: 'frame' }, records => { … });  // 채팅 밖 문서 전체 · 다음 프레임에 한 번
//   const off = watchDom(chat, { childList: true, subtree: true, when: 'frame' }, records => { … });   // #chat 안
//   off();          // 구독 끊기 — 마지막 구독이 끊기면 그 뿌리의 감시자도 끊어요
//   off.quiet();    // 지금까지 쌓인 기록을 이 구독만 버려요(콜백 안에서 내가 바꾼 것 — 예전 observer.takeRecords() 자리). 다른 구독은 그대로 받아요
//   off.flush();    // 지금까지 쌓인 기록을 바로 나눠 줘요(콜백 밖에서 DOM 을 바꾸기 전에 — 그 뒤 quiet() 가 내 변화만 버리게)
// spec: childList · subtree · attributes(true = 전부, 배열 = 그 이름만) · characterData · attributeOldValue · characterDataOldValue
//   · when: 'now'(기본 — 원래 MutationObserver 콜백과 같은 때) | 'frame'(문서마다 rAF 하나에 모든 'frame' 구독을 만든 순서대로) | 'idle'(한가할 때, timeout 기본 200ms)
//   · exclude: 선택자(문자열 · 배열) — 그 요소 안 기록은 안 줘요. body · html 뿌리의 '#chat'(· html 의 'head')은 감시 자체를 그 가지 밖에만 걸어요(아래 「구역」)
//   · match: 선택자 — 기록이 일어난 요소(글자면 그 부모)가 그 선택자 안일 때만 줘요
//   · skip(record) → true 면 그 기록은 이 구독에 안 줘요(예: 내 단추 안 변화)
// 받는 기록은 그 구독이 원한 종류만이에요 — subtree 가 없는 구독은 뿌리 자신의 기록만, attributes 배열이면 그 이름만 받아요.
// 한 구독이 던져도 다른 구독은 그대로 받아요(콘솔 경고만). 'frame' · 'idle' 구독은 끊으면 모아 둔 기록을 버려요.
//
// 구역(9.0.4): html · head · body · #chat 을 뿌리로 하는 subtree 구독은 문서마다 감시자 「하나」가 맡아요. 문서를 네 구역으로 나눠
//   html(html 아래 · head · body 밖 — 과일의 마음 창처럼 html 바로 아래 붙는 창) · head · body(#chat 밖) · chat(#chat 안) 마다 그 구역을 원하는 구독의 옵션 합으로 걸어요.
//   body 구역은 body 와 #chat 의 조상(#sheld)만 자기 자신으로 걸고(자식 추가 · 속성), 나머지 자식 가지는 통째(subtree)로 걸어 #chat 은 body 구역 감시에 걸리지 않아요.
//   그래서 exclude:'#chat' 구독은 채팅이 바뀌어도(스트리밍 · 채팅 열기) 기록조차 만들어지지 않아요 — 브라우저가 #chat 쪽 기록은 chat 구역을 원하는 구독 몫으로 한 벌만 만들어요.
//   다른 점: ① body · #sheld 바로 아래 새로 붙은 가지는 콜백에서 다시 걸어요 — 붙은 뒤 같은 작업 안에서 그 가지 안이 또 바뀐 기록은 오지 않아요
//   (붙은 요소는 콜백 때 이미 바뀐 모습이라, 붙은 요소를 훑는 구독은 결과가 같아요) ② 문서에서 떨어진 노드의 기록은 버려요
//   ③ body · #sheld 바로 아래 글자 노드의 글자 변화(characterData)는 오지 않아요(그런 노드가 없어요).
const HUBS = Symbol.for('blue-lemonade.dom-watch.v2');
let seq = 0;

function unionOf(specs) {
    const o = { childList: false, subtree: false, characterData: false, attributeOldValue: false, characterDataOldValue: false };
    let attrs = null, allAttrs = false;
    for (const p of specs) {
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
    else if (attrs?.size) { out.attributes = true; out.attributeFilter = [...attrs].sort(); }
    if (out.attributeOldValue && !out.attributes) delete out.attributeOldValue;
    if (out.characterDataOldValue && !out.characterData) delete out.characterDataOldValue;
    return out;
}
const sameOpts = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const emptyOpts = o => !o.childList && !o.attributes && !o.characterData;

/** 이 구독이 받을 기록 종류인가(subtree 가 없으면 뿌리 자신의 기록만) */
function wants(sub, record, root) {
    const p = sub.spec;
    if (!p.subtree && record.target !== root) return false;
    if (record.type === 'childList') return !!p.childList;
    if (record.type === 'attributes') return p.attributes === true || (Array.isArray(p.attributes) && p.attributes.includes(record.attributeName));
    if (record.type === 'characterData') return !!p.characterData;
    return false;
}
const elementOf = r => (r.target?.nodeType === 1 ? r.target : r.target?.parentElement || null);
// 선택자 안인가 — 한 번 나눠 주는 동안 (선택자, 요소) 답을 적어 둬요
function inside(el, sel, memo) {
    if (!el || typeof el.closest !== 'function') return false;
    let m = memo.get(sel); if (!m) memo.set(sel, m = new Map());
    let v = m.get(el); if (v === undefined) { try { v = !!el.closest(sel); } catch { v = false; } m.set(el, v); }
    return v;
}
/** 거르개(exclude · match · skip)를 지나는가 */
function passes(sub, r, memo) {
    if (sub.exclude || sub.match) {
        const el = elementOf(r);
        if (sub.exclude && inside(el, sub.exclude, memo)) return false;
        if (sub.match && !inside(el, sub.match, memo)) return false;
    }
    if (sub.skip) { try { if (sub.skip(r)) return false; } catch { return false; } }
    return true;
}
const plain = sub => !sub.skip && !sub.exclude && !sub.match;
// 1.1.4 기록 종류 비트(자식 목록 1 · 속성 2 · 글자 4) — 묶음에 그 구독이 받을 종류가 하나도 없으면 기록을 하나씩 따지지 않고 건너뛰어요
const KIND = { childList: 1, attributes: 2, characterData: 4 };
const kindsOf = spec => (spec.childList ? 1 : 0) | (spec.attributes === true || Array.isArray(spec.attributes) ? 2 : 0) | (spec.characterData ? 4 : 0);
// 허브가 기록 묶음 하나를 나눠 주는 데 쓴 시간(거르기 + 바로 부른 콜백) — 구독별 콜백 시간(ms)과 따로 세요
function tally(win, t0, count) { const c = hubsOf(win).cost; c.batches++; c.records += count; c.ms += now() - t0; }

function hubsOf(win) {
    let h = win[HUBS];
    if (!h) {
        h = win[HUBS] = { roots: new Map(), zones: new Map(), direct: null, frame: { subs: [], raf: 0, timer: 0 }, cost: { batches: 0, records: 0, ms: 0 } };
        // 1.1.4 측정 도구가 묶음(dist) 밖에서 읽는 길: globalThis[Symbol.for('blue-lemonade.dom-watch.v2')].stats() → domWatchStats() 와 같은 값
        h.stats = () => domWatchStats(win);
    }
    return h;
}

// ── 묶어 부르기 ──
function deliver(win, sub, list) {
    if (!list.length || sub.off) return;
    if (sub.when === 'now') { checkpoint(sub); call(sub, list); return; }
    for (const r of list) sub.pending.push(r);
    if (sub.when === 'frame') { queueFrame(win, sub); return; }
    if (sub.timer) return;
    if (typeof win.requestIdleCallback === 'function') sub.timer = { idle: win.requestIdleCallback(() => flushSub(sub), { timeout: sub.timeout }) };
    else sub.timer = { timeout: win.setTimeout(() => flushSub(sub), Math.min(sub.timeout, 50)) };
}
// 'frame' 구독은 문서마다 rAF 하나 — 그 프레임에 기록이 있는 구독을 만든 순서대로 한 번씩 불러요.
//   숨은 탭은 rAF 가 멈추니 그때만 타이머(250ms)로도 걸어 둬요(기록이 끝없이 쌓이지 않게)
function queueFrame(win, sub) {
    const f = hubsOf(win).frame;
    if (!sub.queued) { sub.queued = true; f.subs.push(sub); }
    if (f.raf || f.timer) return;
    const run = () => flushFrame(win);
    if (typeof win.requestAnimationFrame === 'function') {
        f.raf = win.requestAnimationFrame(run);
        if (win.document?.hidden) f.timer = win.setTimeout(run, 250);
    } else f.timer = win.setTimeout(run, 16);
}
function flushFrame(win) {
    const f = hubsOf(win).frame;
    if (f.raf) win.cancelAnimationFrame?.(f.raf);
    if (f.timer) win.clearTimeout(f.timer);
    f.raf = 0; f.timer = 0;
    const subs = f.subs.sort((a, b) => a.seq - b.seq); f.subs = [];
    for (const s of subs) {
        s.queued = false;
        if (s.off) continue;
        const list = s.pending; s.pending = [];
        if (list.length) call(s, list);
    }
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
    sub.calls++; sub.records += list.length; sub.ms += now() - t;
}
function cancel(win, sub) {
    const t = sub.timer; sub.timer = null; sub.pending = [];
    if (!t) return;
    if (t.idle) win.cancelIdleCallback?.(t.idle);
    if (t.timeout) win.clearTimeout(t.timeout);
}

// 'now' 구독을 부르기 전에, 앞서 부른 구독들이 이번 나눠 주기 중에 만든 기록을 먼저 떼어 둬요(모두에게 — 이 구독 포함, 나눠 주기 뒤에).
//   그래야 이 구독의 quiet() 가 버리는 것은 「이 구독 콜백이 만든 기록」뿐이에요(예전 감시자마다 takeRecords 하던 범위와 같아요)
function checkpoint(sub) {
    const hub = sub.hub;
    if (!hub?.dispatching || typeof hub.mo?.takeRecords !== 'function') return;
    const pre = hub.mo.takeRecords();
    if (pre.length) hub.carry.push({ records: pre, except: null });
}
// 콜백 안에서 부른 quiet() 의 기록은 지금 나눠 주기가 끝난 뒤 다른 구독에만 — 예전 기록보다 먼저 받는 구독이 없게
function runCarried(win, hub) {
    while (hub.carry.length) {
        const { records, except } = hub.carry.shift();
        hub.handle(records, except);
    }
}
// 지금까지 쌓인 기록을 바로 나눠 줘요(모두에게) — 내가 DOM 을 바꾸기 전에 불러 두면, 뒤의 quiet() 가 버리는 것은 내가 바꾼 기록뿐이에요
function flushFor(win, hub) {
    const pre = typeof hub.mo?.takeRecords === 'function' ? hub.mo.takeRecords() : [];
    if (!pre.length) return;
    hub.carry.push({ records: pre, except: null });
    if (!hub.dispatching) runCarried(win, hub);
}
function quietFor(win, hub, sub) {
    const taken = typeof hub.mo.takeRecords === 'function' ? hub.mo.takeRecords() : [];
    sub.pending = [];
    if (!taken.length) return;
    hub.carry.push({ records: taken, except: sub });
    if (!hub.dispatching) runCarried(win, hub);
}

function makeSub(spec, fn) {
    const s = { ...spec };
    if (Array.isArray(s.attributes) && !s.attributes.length) delete s.attributes;
    const list = v => (v == null || v === '' ? [] : Array.isArray(v) ? v.filter(Boolean) : [v]);
    return {
        seq: ++seq, spec: s, fn, when: s.when || 'now', timeout: s.timeout ?? 200, skip: s.skip, name: s.name,
        excludeList: list(s.exclude), exclude: list(s.exclude).join(',') || '', match: list(s.match).join(',') || '',
        pending: [], timer: null, queued: false, off: false, calls: 0, records: 0, ms: 0, full: false, kinds: kindsOf(s),
    };
}

/**
 * root 아래 변화를 구독해요. 돌려주는 값은 끊는 함수예요(off.quiet() 로 쌓인 기록을 이 구독만 버려요).
 * @param {Node} root
 * @param {{childList?:boolean, subtree?:boolean, attributes?:boolean|string[], characterData?:boolean, attributeOldValue?:boolean, characterDataOldValue?:boolean, when?:'now'|'frame'|'idle', timeout?:number, exclude?:string|string[], match?:string|string[], skip?:(r:MutationRecord)=>boolean, name?:string}} spec
 * @param {(records: MutationRecord[]) => void} fn
 */
export function watchDom(root, spec, fn) {
    const win = root?.ownerDocument?.defaultView || root?.defaultView || globalThis;
    const none = () => {}; none.quiet = none.flush = () => {};
    if (!root || typeof fn !== 'function' || typeof win.MutationObserver !== 'function') return none;
    const sub = makeSub(spec || {}, fn);
    const hubs = hubsOf(win);
    if (sub.spec.subtree) {
        const doc = root.ownerDocument || (root.nodeType === 9 ? root : null);
        const zone = doc ? zoneRootOf(doc, root) : null;
        if (zone) return zoneWatch(win, hubs, doc, zone, sub);
        return rootWatch(win, hubs, root, sub);
    }
    return directWatch(win, hubs, root, sub);
}

// ── 뿌리 하나(subtree) — 구역 밖 뿌리(창 · 서랍 · 목록 같은 요소) ──
function rootWatch(win, hubs, root, sub) {
    let hub = hubs.roots.get(root);
    if (!hub) {
        hub = { subs: new Set(), opts: null, mo: null, carry: [], dispatching: false };
        hub.handle = (records, except = null) => {
            hub.dispatching = true;
            const t0 = now();
            try {
                const memo = new Map();
                for (const x of hub.subs) {
                    if (x.off || x === except) continue;
                    // 감시자 옵션이 곧 그 구독이 원한 것(full)이고 거르개가 없으면 기록을 하나씩 따지지 않고 그대로 넘겨요
                    if (x.full && plain(x)) { deliver(win, x, records); continue; }
                    deliver(win, x, records.filter(r => wants(x, r, root) && passes(x, r, memo)));
                }
            } finally { hub.dispatching = false; tally(win, t0, records.length); }
            runCarried(win, hub);
        };
        hub.mo = new win.MutationObserver(records => hub.handle(records));
        hubs.roots.set(root, hub);
    }
    hub.subs.add(sub); sub.hub = hub;
    refit(hub, root);
    const off = () => {
        if (sub.off) return; sub.off = true; cancel(win, sub);
        hub.subs.delete(sub);
        if (!hub.subs.size) { hub.mo.disconnect(); hubs.roots.delete(root); } else refit(hub, root);
    };
    off.quiet = () => quietFor(win, hub, sub); off.flush = () => flushFor(win, hub);
    return off;
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
    const opts = unionOf([...hub.subs].map(x => x.spec));
    for (const x of hub.subs) x.full = covers(x.spec, opts);
    if (hub.opts && sameOpts(hub.opts, opts)) return;
    hub.opts = opts;
    hub.mo.observe(root, opts);   // 같은 노드를 다시 observe 하면 옵션만 바뀌고 쌓인 기록은 그대로예요
}

// ── 뿌리 자신만(subtree 없음): 문서마다 감시자 하나 — 기록의 target 이 뿌리 ──
function directWatch(win, hubs, root, sub) {
    let d = hubs.direct;
    if (!d) {
        d = hubs.direct = { byRoot: new Map(), opts: new Map(), mo: null, win, rebuild: false, carry: [], dispatching: false };
        // 기록을 뿌리(target)별로 묶어 그 뿌리 구독에만 — 구독이 원한 것과 같으면(full) 묶음 그대로
        d.handle = (records, except = null) => {
            d.dispatching = true;
            const t0 = now();
            try {
                const groups = new Map(), memo = new Map();
                for (const r of records) { if (!d.byRoot.has(r.target)) continue; let g = groups.get(r.target); if (!g) groups.set(r.target, g = []); g.push(r); }
                for (const [root, list] of groups) for (const x of d.byRoot.get(root) || []) {
                    if (x.off || x === except) continue;
                    if (x.full && plain(x)) { deliver(win, x, list); continue; }
                    deliver(win, x, list.filter(r => wants(x, r, root) && passes(x, r, memo)));
                }
            } finally { d.dispatching = false; tally(win, t0, records.length); }
            runCarried(win, d);
        };
        d.mo = new win.MutationObserver(records => d.handle(records));
    }
    let subs = d.byRoot.get(root); if (!subs) d.byRoot.set(root, subs = new Set());
    subs.add(sub); sub.hub = d;
    refitDirect(d);
    const off = () => {
        if (sub.off) return; sub.off = true; cancel(win, sub);
        subs.delete(sub);
        if (!subs.size) d.byRoot.delete(root);
        refitDirect(d);
    };
    off.quiet = () => quietFor(win, d, sub); off.flush = () => flushFor(win, d);
    return off;
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
            for (const [root, subs] of d.byRoot) { const o = unionOf([...subs].map(x => x.spec)); for (const x of subs) x.full = covers(x.spec, o); d.opts.set(root, o); d.mo.observe(root, o); }
            if (pending.length) d.handle(pending);
        });
    }
    for (const [root, subs] of d.byRoot) {
        const o = unionOf([...subs].map(x => x.spec));
        for (const x of subs) x.full = covers(x.spec, o);
        if (d.opts.has(root) && sameOpts(d.opts.get(root), o)) continue;
        d.opts.set(root, o); d.mo.observe(root, o);
    }
}

// ── 구역(html · head · body · #chat) — 문서마다 감시자 하나 ──
const ZONES = ['html', 'head', 'body', 'chat'];
const COVER = { html: ['html', 'head', 'body', 'chat'], head: ['head'], body: ['body', 'chat'], chat: ['chat'] };
function chatOf(doc) {
    const chat = typeof doc.getElementById === 'function' ? doc.getElementById('chat') : null;
    return chat && doc.body && chat !== doc.body && doc.body.contains?.(chat) ? chat : null;
}
function zoneRootOf(doc, root) {
    if (root === doc.documentElement && doc.documentElement) return 'html';
    if (root === doc.body && doc.body) return 'body';
    if (root === doc.head && doc.head) return 'head';
    if (root.id === 'chat' && chatOf(doc) === root) return 'chat';
    return null;
}
function zoneHub(win, hubs, doc) {
    let z = hubs.zones.get(doc);
    if (z) return z;
    z = { doc, subs: [], mo: null, carry: [], dispatching: false, opts: null, chain: new Set(), chat: null, wiredKey: '', rewireSoon: false, pruneSoon: null };
    z.handle = (records, except = null) => zoneHandle(win, z, records, except);
    z.mo = new win.MutationObserver(records => z.handle(records));
    hubs.zones.set(doc, z);
    return z;
}
function zoneWatch(win, hubs, doc, rootZone, sub) {
    const z = zoneHub(win, hubs, doc);
    const covered = new Set(COVER[rootZone]);
    // '#chat' · 'head' 를 빼 달라는 구독은 그 구역을 아예 안 받아요(그 구역을 원하는 구독이 없으면 감시도 안 걸려요). 나머지 선택자는 기록마다 걸러요
    const rest = [];
    for (const sel of sub.excludeList) {
        const s = String(sel).trim();
        if (s === '#chat') covered.delete('chat');
        else if (s === 'head' && rootZone === 'html') covered.delete('head');
        else rest.push(s);
    }
    sub.exclude = rest.join(',');
    sub.zones = covered; sub.rootZone = rootZone;
    z.subs.push(sub); sub.hub = z;
    rewire(z);
    const off = () => {
        if (sub.off) return; sub.off = true; cancel(win, sub);
        z.subs = z.subs.filter(x => x !== sub);
        if (!z.subs.length) { z.mo.disconnect(); z.opts = null; z.wiredKey = ''; hubs.zones.delete(doc); return; }
        rewire(z);
    };
    off.quiet = () => quietFor(win, z, sub); off.flush = () => flushFor(win, z);
    return off;
}
function zoneOpts(z) {
    const out = {};
    for (const name of ZONES) out[name] = unionOf(z.subs.filter(s => !s.off && s.zones.has(name)).map(s => s.spec));
    for (const s of z.subs) s.full = [...s.zones].every(name => covers(s.spec, out[name]));
    return out;
}
const asSelf = o => { const c = { ...o, childList: true }; delete c.subtree; return c; };   // 자기 자신만 + 자식 추가는 늘(가지를 다시 걸려고)
const asTree = o => ({ ...o, subtree: true });
// 구역마다 걸 노드와 옵션을 정해요. 옵션이 그대로고 문서 모양(#chat 조상 사슬)도 그대로면 다시 걸지 않아요
function plan(z) {
    const doc = z.doc, html = doc.documentElement, head = doc.head, body = doc.body, chat = chatOf(doc);
    const opts = zoneOpts(z);
    const regs = [], chain = new Set();
    if (html && !emptyOpts(opts.html)) {
        regs.push([html, asSelf(opts.html)]); chain.add(html);
        for (const c of html.children) if (c !== head && c !== body) regs.push([c, asTree(opts.html)]);
    }
    if (head && !emptyOpts(opts.head)) regs.push([head, asTree(opts.head)]);
    if (body && !emptyOpts(opts.body)) {
        if (chat) {
            const path = [];
            for (let p = chat.parentElement; p; p = p.parentElement) { path.push(p); if (p === body) break; }
            for (const p of path) { chain.add(p); regs.push([p, asSelf(opts.body)]); }
            for (const p of path) for (const c of p.children) if (!chain.has(c) && c !== chat) regs.push([c, asTree(opts.body)]);
        } else regs.push([body, asTree(opts.body)]);
    }
    if (chat && !emptyOpts(opts.chat)) regs.push([chat, asTree(opts.chat)]);
    return { opts, regs, chain, chat };
}
// 한가할 때 한 번(없으면 0.2초 뒤) — 돌려주는 값으로 취소해요
function whenIdle(win, fn) {
    if (typeof win.requestIdleCallback === 'function') { const id = win.requestIdleCallback(fn, { timeout: 1000 }); return { cancel: () => win.cancelIdleCallback?.(id) }; }
    const id = win.setTimeout(fn, 200); return { cancel: () => win.clearTimeout(id) };
}
function rewire(z) {
    if (z.pruneSoon) { z.pruneSoon.cancel(); z.pruneSoon = null; }   // 통째로 다시 걸면 빠진 가지도 같이 떼져요
    const p = plan(z);
    const key = JSON.stringify(p.opts) + '|' + (p.chat ? 'c' : '') + '|' + p.regs.length;
    // 옵션 · 걸 노드가 그대로면 아무것도 안 해요(구독이 늘어도 옵션이 같으면 감시는 그대로)
    if (key === z.wiredKey && p.regs.every(([n]) => z.wired?.has(n))) { z.opts = p.opts; return; }
    const pending = typeof z.mo.takeRecords === 'function' && z.wired?.size ? z.mo.takeRecords() : [];
    if (z.wired?.size) z.mo.disconnect();   // 처음 걸 때는 끊을 것이 없어요
    z.wired = new Set();
    for (const [node, o] of p.regs) { z.mo.observe(node, o); z.wired.add(node); }
    z.opts = p.opts; z.chain = p.chain; z.chat = p.chat; z.wiredKey = key;
    if (pending.length) { z.carry.push({ records: pending, except: null }); if (!z.dispatching) runCarried(null, z); }
}
// 기록이 어느 구역인가 — 조상을 따라 올라가 처음 만나는 #chat · head · body · html. 문서에서 떨어진 노드면 null(버려요)
function zoneFinder(z) {
    const doc = z.doc, html = doc.documentElement, head = doc.head, body = doc.body, chat = z.chat;
    const memo = new Map();
    return node => {
        const path = []; let found = null;
        for (let n = node; n; n = n.parentNode) {
            const known = memo.get(n); if (known !== undefined) { found = known; break; }
            if (n === chat) { found = 'chat'; break; }
            if (n === head) { found = 'head'; break; }
            if (n === body) { found = 'body'; break; }
            if (n === html) { found = 'html'; break; }
            path.push(n);
        }
        for (const n of path) memo.set(n, found);
        return found;
    };
}
function zoneHandle(win, z, records, except) {
    z.dispatching = true;
    let again = false, pruned = false;
    const t0 = now();
    try {
        const zoneOf = zoneFinder(z), zones = new Array(records.length);
        // 1.1.4 구역마다 이 묶음에 든 기록 종류(비트 합) — 구독의 구역에 그 구독이 받을 종류가 하나도 없으면 아래에서 기록을 돌지 않아요.
        //   스트리밍 · 채팅 열기처럼 #chat 기록만 든 묶음은 채팅 밖 구독(구독의 대부분)을 구독마다 한 번의 비교로 지나가요(예전: 구독 × 기록 수만큼 돌며 건너뜀). 받는 기록 · 차례는 같아요
        const seen = { html: 0, head: 0, body: 0, chat: 0 };
        let stray = 0;   // 문서에서 떨어진 노드의 기록 수(버려요) · 종류를 모르는 기록 수
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const zone = zones[i] = zoneOf(r.target);
            if (zone && KIND[r.type]) seen[zone] |= KIND[r.type]; else stray++;
            // body · #sheld · html 바로 아래 가지가 바뀌면 새 가지를 걸어요. 빠진 가지가 있으면 다 나눠 준 뒤 한 번 다시 걸어요(떨어진 가지의 등록을 떼려고)
            if (r.type === 'childList' && z.chain.has(r.target)) {
                for (const n of r.addedNodes || []) {
                    if (n.nodeType !== 1) continue;
                    if (n === z.chat || n === z.doc.body || n === z.doc.head || (z.chat && n.contains?.(z.chat))) { again = true; continue; }
                    const zone = r.target === z.doc.documentElement ? 'html' : 'body';
                    if (z.opts && !emptyOpts(z.opts[zone]) && !z.wired?.has(n)) { z.mo.observe(n, asTree(z.opts[zone])); z.wired?.add(n); }
                }
                for (const n of r.removedNodes || []) if (n.nodeType === 1 && z.wired?.has(n)) { pruned = true; break; }
            }
        }
        const memo = new Map();
        for (const x of z.subs) {
            if (x.off || x === except) continue;
            let list = null;
            let here = 0;
            for (const name of x.zones) here |= seen[name];
            if (!(here & x.kinds)) continue;
            const fast = x.full && plain(x);
            // 묶음의 기록이 전부 이 구독의 구역 안이고 걸러 낼 것이 없으면 새 목록을 만들지 않고 묶음 그대로 넘겨요(뿌리 구독과 같은 꼴 — 채팅 구독이 채팅 열기 묶음을 받을 때)
            if (fast && !stray && (x.spec.childList || !(here & 1)) && ZONES.every(name => !seen[name] || x.zones.has(name))) { deliver(win, x, records); continue; }
            for (let i = 0; i < records.length; i++) {
                const zone = zones[i];
                if (!zone || !x.zones.has(zone)) continue;
                const r = records[i];
                if (fast) { if (r.type === 'childList' && !x.spec.childList) continue; }   // body · #sheld 자기 자식 기록은 가지를 걸려고 늘 받아요 — 원한 구독에만
                else if (!(wants(x, r, null) && passes(x, r, memo))) continue;
                (list ??= []).push(r);
            }
            if (list) deliver(win, x, list);
        }
    } finally { z.dispatching = false; tally(win, t0, records.length); }
    if (again && !z.rewireSoon) {
        z.rewireSoon = true;
        queueMicrotask(() => { z.rewireSoon = false; if (z.subs.length) { z.wiredKey = ''; rewire(z); } });
    }
    // 1.4.x opt-chat-open(고침안 6): 빠지기만 한 가지(알림 상자 · 팝업 · 확장 창이 body 에서 빠짐)는 한가할 때 한 번에 떼요.
    //   예전에는 그 마이크로태스크에 감시를 통째로 끊고 다시 걸어(observe 수십 번) 채팅을 여는 도중(알림이 뜨고 사라짐)에 폰 4배 22ms 가 들었어요.
    //   그동안 떨어진 가지의 기록은 구역을 못 찾아 버려요(②) — 받는 기록은 같고, 등록만 조금 늦게 떼요. 구조가 바뀐(again) 다시 걸기는 예전처럼 바로예요
    if (pruned && !again && !z.pruneSoon) z.pruneSoon = whenIdle(win || globalThis, () => { z.pruneSoon = null; if (z.subs.length) { z.wiredKey = ''; rewire(z); } });
    runCarried(win, z);
}

/**
 * 뿌리 여럿을 한 콜백으로 — 진짜 창이면 허브 구독, 시험이 넘긴 가짜 창(host)이면 그 창의 MutationObserver 하나(예전 감시자와 같은 모양 · 시험이 콜백을 바로 부름).
 * @param {object} host 창(window) — 모듈이 host 를 받는 경우(squared-buttons · fruit-type-shortcuts · tab-scroll)
 * @param {[Node, object][]} pairs [뿌리, watchDom spec] 목록
 */
export function watchWith(host, pairs, fn) {
    const doc = pairs[0]?.[0]?.ownerDocument || null;
    const real = !host || host === globalThis || host === doc?.defaultView;
    if (!real && typeof host.MutationObserver === 'function') {
        const mo = new host.MutationObserver(fn);
        for (const [node, spec] of pairs) if (node) {
            const o = unionOf([spec]);
            if (spec.subtree) o.subtree = true;
            mo.observe(node, o);
        }
        const off = () => mo.disconnect(); off.quiet = () => { mo.takeRecords?.(); }; off.flush = () => {};
        return off;
    }
    const offs = pairs.filter(([node]) => node).map(([node, spec]) => watchDom(node, spec, fn));
    const off = () => { for (const o of offs) o(); }; off.quiet = () => { for (const o of offs) o.quiet(); }; off.flush = () => { for (const o of offs) o.flush(); };
    return off;
}

/** 기록들에서 새로 붙은 요소만(중복 없이, 문서에 붙어 있는 것) — 구독 콜백에서 흔히 쓰는 모음 */
export function addedElements(records) {
    const out = new Set();
    for (const r of records) if (r.type === 'childList') for (const n of r.addedNodes) if (n.nodeType === 1 && n.isConnected) out.add(n);
    return out;
}

/**
 * 진단 · 시험용: 문서에 걸린 공용 감시자 수와 구독 수 · 구독마다 이름 · 받은 횟수 · 기록 수 · 콜백 시간(ms).
 * 1.1.4: hub = 허브가 기록 묶음을 나눠 준 횟수 · 기록 수 · 시간(거르기 + 바로 부른 'now' 콜백 포함 · 'frame' · 'idle' 콜백은 each 의 ms 에만).
 *   어느 구독이 비싼지는 each 를 ms 큰 차례로 보면 돼요. 측정 도구는 장면 앞뒤로 읽어 차이를 내요(값은 계속 쌓여요).
 */
export function domWatchStats(win = globalThis) {
    const h = win[HUBS];
    if (!h) return { observers: 0, subscriptions: 0, roots: 0, zones: 0, hub: { batches: 0, records: 0, ms: 0 }, each: [] };
    const each = [];
    const row = (s, subtree, where) => ({ name: s.name || '(이름 없음)', subtree, where, when: s.when, calls: s.calls, records: s.records, ms: Math.round(s.ms * 10) / 10 });
    for (const hub of h.roots.values()) for (const s of hub.subs) each.push(row(s, true, 'root'));
    for (const z of h.zones.values()) for (const s of z.subs) each.push(row(s, true, s.rootZone + (s.rootZone !== 'chat' && s.rootZone !== 'head' && !s.zones.has('chat') ? ' (#chat 밖)' : '')));
    let direct = 0;
    if (h.direct) for (const set of h.direct.byRoot.values()) for (const s of set) { direct++; each.push(row(s, false, 'self')); }
    const zoneSubs = [...h.zones.values()].reduce((n, z) => n + z.subs.length, 0);
    const rootSubs = [...h.roots.values()].reduce((n, hub) => n + hub.subs.size, 0);
    return {
        observers: h.roots.size + h.zones.size + (h.direct && h.direct.byRoot.size ? 1 : 0),
        subscriptions: rootSubs + zoneSubs + direct,
        roots: h.roots.size + h.zones.size + (h.direct ? h.direct.byRoot.size : 0),
        zones: h.zones.size,
        hub: { batches: h.cost?.batches || 0, records: h.cost?.records || 0, ms: Math.round((h.cost?.ms || 0) * 10) / 10 },
        each,
    };
}
