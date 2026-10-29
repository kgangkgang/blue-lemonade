// 번역 리모컨 (translate-remote · src/addons/translator/remote.js) — 커뮤니티 공유 태번 헬퍼 스크립트 「✨️번역 리모컨」을 원작자의 허락으로 고쳐 넣은 것.
// 가짜 DOM 으로: 짧게 · 길게 누르기 · 우클릭 · 끌기 · 자리 3종 · 대표 기능 바꾸기 · 보이는 메시지 고르기 · 수정 열기/저장 · 삭제 확인 ·
//   자동 번역 켬/끔(전체 · 내 메시지 기억) · 다시 번역 확인 · 메뉴 항목 숨김 · 전체 번역 진행 · 원작 스크립트가 있을 때 쉬기 · 원작 설정 옮겨 오기.
// 그리고 번역 애드온(index.js · index.html · style.css)과 길게 누르기 설명 · 출처 표시가 이어져 있는지 글로 봐요.
//   node tools/tests/translator-remote.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const R = await import(pathToFileURL(path.join(root, 'src/addons/translator/remote.js')));
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log(`  PASS  ${name}`); };

// ── 작은 가짜 DOM ──
function parseCompound(c) {
    const out = { tag: null, id: null, classes: [], attrs: [] };
    const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/y;
    let m; re.lastIndex = 0;
    while (re.lastIndex < c.length && (m = re.exec(c))) {
        if (m[1]) out.tag = m[1].toUpperCase();
        else if (m[2]) out.id = m[2];
        else if (m[3]) out.classes.push(m[3]);
        else out.attrs.push([m[4], m[5]]);
    }
    if (re.lastIndex !== c.length) throw Error('selector ' + c);
    return out;
}
const matchOne = (el, c) => (!c.tag || el.tagName === c.tag) && (!c.id || el.id === c.id) && c.classes.every(k => el.classList.contains(k))
    && c.attrs.every(([k, v]) => el.hasAttribute(k) && (v === undefined || el.getAttribute(k) === v));
function matches(el, selector) {
    return selector.split(',').some(part => {
        const chain = part.trim().split(/\s+/).map(parseCompound);
        if (!matchOne(el, chain[chain.length - 1])) return false;
        let i = chain.length - 2;
        for (let up = el.parentElement; up && i >= 0; up = up.parentElement) if (matchOne(up, chain[i])) i--;
        return i < 0;
    });
}
class ClassList {
    constructor(el) { this.el = el; }
    get list() { return (this.el.attrs.class || '').split(/\s+/).filter(Boolean); }
    contains(c) { return this.list.includes(c); }
    add(...cs) { const l = this.list; for (const c of cs) if (!l.includes(c)) l.push(c); this.el.attrs.class = l.join(' '); }
    remove(...cs) { this.el.attrs.class = this.list.filter(c => !cs.includes(c)).join(' '); }
    toggle(c, force) { const on = force ?? !this.contains(c); if (on) this.add(c); else this.remove(c); return on; }
}
class Style {
    constructor() { this.props = {}; }
    setProperty(k, v) { this.props[k] = String(v); }
    removeProperty(k) { delete this.props[k]; }
    getPropertyValue(k) { return this.props[k] ?? ''; }
    set left(v) { this.props.left = v; } get left() { return this.props.left ?? ''; }
    set top(v) { this.props.top = v; } get top() { return this.props.top ?? ''; }
    set cssText(v) { this.props.cssText = v; }
}
class El {
    constructor(doc, tag) {
        this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.attrs = {}; this.children = []; this.parentElement = null;
        this.listeners = []; this.classList = new ClassList(this); this.style = new Style(); this._text = ''; this.rect = null; this.value = '';
        this.dataset = new Proxy({}, { get: (_, k) => this.attrs['data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase())], set: (_, k, v) => { this.attrs['data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = String(v); return true; } });
    }
    get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = v; }
    get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = v; }
    get hidden() { return 'hidden' in this.attrs; } set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; }
    set type(v) { this.attrs.type = v; } get type() { return this.attrs.type; }
    set title(v) { this.attrs.title = v; } get title() { return this.attrs.title || ''; }
    set tabIndex(v) { this.attrs.tabindex = String(v); }
    set min(v) { this.attrs.min = v; } set max(v) { this.attrs.max = v; } set step(v) { this.attrs.step = v; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    toggleAttribute(k, on) { if (on) this.attrs[k] = ''; else delete this.attrs[k]; }
    get isConnected() { let e = this; while (e.parentElement) e = e.parentElement; return e === this.ownerDocument.documentElement; }
    append(...kids) { for (const k of kids) { if (typeof k === 'string') { this._text += k; continue; } k.remove(); k.parentElement = this; this.children.push(k); this.ownerDocument._changed(this, k, 'add'); } }
    remove() { const p = this.parentElement; if (!p) return; p.children = p.children.filter(c => c !== this); this.parentElement = null; this.ownerDocument._changed(p, this, 'remove'); }
    contains(n) { for (let e = n; e; e = e.parentElement) if (e === this) return true; return false; }
    closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches?.(sel)) return e; return null; }
    matches(sel) { return matches(this, sel); }
    *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
    querySelectorAll(sel) { return [...this.walk()].filter(e => e.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(v) { for (const c of [...this.children]) c.remove(); this._text = String(v); }
    get offsetParent() { return this.hidden ? null : this.parentElement; }
    get offsetWidth() { return this.rect?.width ?? 220; } get offsetHeight() { return this.rect?.height ?? 300; }
    getBoundingClientRect() { this.ownerDocument.rectReads++; const r = this.rect || { left: 0, top: 0, width: 0, height: 0 }; return { ...r, right: r.left + r.width, bottom: r.top + r.height }; }
    addEventListener(type, fn, capture) { this.listeners.push({ type, fn, capture: !!capture }); }
    removeEventListener(type, fn, capture) { this.listeners = this.listeners.filter(l => !(l.type === type && l.fn === fn && l.capture === !!capture)); }
    focus() { this.ownerDocument.activeElement = this; }
    click() { this.ownerDocument.fire('click', this); }
    setPointerCapture(id) { this.captured = id; }
    scrollIntoView() {}
    setSelectionRange(a) { this.selectionStart = a; }
}
function makeDoc() {
    const doc = {
        rectReads: 0, activeElement: null, listeners: [], observers: [],
        createElement: tag => new El(doc, tag),
        getElementById: id => doc.documentElement.querySelector('#' + id),
        querySelector: sel => doc.documentElement.querySelector(sel),
        querySelectorAll: sel => doc.documentElement.querySelectorAll(sel),
        addEventListener(type, fn, capture) { doc.listeners.push({ type, fn, capture: !!capture }); },
        removeEventListener(type, fn, capture) { doc.listeners = doc.listeners.filter(l => !(l.type === type && l.fn === fn && l.capture === !!capture)); },
        _changed(parent, child, kind) { for (const o of doc.observers) if (o.target === parent) o.pending.push({ kind, child }); },
        fire(type, target, extra = {}) {
            const ev = { type, target, defaultPrevented: false, stopped: false, pointerId: 1, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, ...extra,
                preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
            for (const l of doc.listeners.filter(l => l.type === type && l.capture)) l.fn(ev);
            for (let e = target; e && !ev.stopped; e = e.parentElement) for (const l of e.listeners.filter(l => l.type === type)) l.fn(ev);
            if (!ev.stopped) for (const l of doc.listeners.filter(l => l.type === type && !l.capture)) l.fn(ev);
            return ev;
        },
    };
    doc.documentElement = new El(doc, 'html');
    doc.head = new El(doc, 'head'); doc.body = new El(doc, 'body');
    doc.documentElement.append(doc.head, doc.body);
    return doc;
}
function makeWin(doc) {
    let now = 0, seq = 0; const timers = new Map(), listeners = [];
    const win = {
        innerWidth: 400, innerHeight: 800, navigator: { vibrate() {} },
        setTimeout: (fn, ms = 0) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame: fn => win.setTimeout(fn, 16),
        addEventListener: (type, fn) => listeners.push({ type, fn }), removeEventListener: (type, fn) => { const i = listeners.findIndex(l => l.type === type && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
        MutationObserver: class { constructor(cb) { this.cb = cb; } observe(target) { this.target = target; this.pending = []; doc.observers.push(this); } disconnect() { doc.observers = doc.observers.filter(o => o !== this); } },
        now: () => now,
        async advance(ms) {
            const until = now + ms;
            for (;;) {
                const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                timers.delete(next[0]); now = Math.max(now, next[1].at); await next[1].fn(); await flush();
            }
            now = until; await flush();
        },
        flushObservers() { for (const o of doc.observers) if (o.pending.length) { const list = o.pending; o.pending = []; o.cb(list); } },
    };
    return win;
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
class Storage { constructor(init = {}) { this.map = new Map(Object.entries(init)); } getItem(k) { return this.map.has(k) ? this.map.get(k) : null; } setItem(k, v) { this.map.set(k, String(v)); } }

/** 채팅 · 입력줄 · 리모컨 한 벌 */
function setup({ storage = new Storage(), owner = { remote: { enabled: true } }, autoMode = 'none', translated = new Set([0, 1, 2, 3]), th = null, rects = null, dom = {} } = {}) {
    const doc = makeDoc(), win = makeWin(doc);
    const chat = doc.createElement('div'); chat.id = 'chat'; chat.rect = { left: 0, top: 40, width: 400, height: 660 };
    const form = doc.createElement('div'); form.id = 'send_form';
    const left = doc.createElement('div'); left.id = 'leftSendForm';
    const right = doc.createElement('div'); right.id = 'rightSendForm';
    if (!dom.noLeft) form.append(left);
    form.append(right);
    doc.body.append(chat, form);
    const heights = rects || [{ top: -900, height: 600 }, { top: -300, height: 500 }, { top: 200, height: 420 }, { top: 620, height: 300 }];
    heights.forEach((r, i) => {
        const mes = doc.createElement('div'); mes.className = 'mes'; mes.setAttribute('mesid', String(i)); mes.rect = { left: 0, width: 400, ...r };
        const text = doc.createElement('div'); text.className = 'mes_text'; text.textContent = `메시지 ${i} 번역문 본문`; text.rect = { ...mes.rect };
        mes.append(text); chat.append(mes);
    });
    const calls = [], asks = [], toasts = [];
    let mode = autoMode;
    const host = {
        doc, win, storage, now: win.now, bootGraceMs: 1000,
        settings: () => R.normalizeSettings(owner),
        save: () => calls.push(['save']),
        thSettings: () => th,
        autoMode: () => mode,
        setAutoMode: m => { mode = m; calls.push(['auto', m]); },
        hasTranslation: id => translated.has(Number(id)),
        editedByHand: id => host._edited?.has(Number(id)) || false,
        busy: id => host._busy?.has(Number(id)) || false,
        batch: () => host._batch || null,
        ask: async (text, opts) => { asks.push({ text, opts }); return host._answer ?? true; },
        toast: { info: t => toasts.push(['info', t]), warning: t => toasts.push(['warning', t]), success: t => toasts.push(['success', t]), error: t => toasts.push(['error', t]) },
        run: {
            translate: async id => calls.push(['translate', id]),
            retranslate: async id => calls.push(['retranslate', id]),
            delete: async id => calls.push(['delete', id]),
            toggleAll: async () => calls.push(['toggleAll']),
            translateAll: async () => calls.push(['translateAll']),
            edit: async id => {   // 번역 애드온의 editTranslation 흉내: 수정 창 + 저장 단추
                calls.push(['edit', id]);
                const mes = chat.querySelector(`.mes[mesid="${id}"]`);
                const ta = doc.createElement('textarea'); ta.className = 'edit_textarea translation_edit_textarea'; ta.value = mes.querySelector('.mes_text').textContent;
                const done = doc.createElement('div'); done.className = 'translation_edit_done';
                done.addEventListener('click', () => { calls.push(['save-edit', id]); ta.remove(); done.remove(); });
                mes.append(done, ta);
            },
        },
        onRest: state => calls.push(['rest', state]),
        changed: () => calls.push(['changed']),
    };
    const remote = R.createRemote(host);
    return { doc, win, chat, left, right, host, remote, owner, storage, calls, asks, toasts, get mode() { return mode; } };
}
const press = async (env, { hold = 0, move = null, button = 0, pointerType = 'touch' } = {}) => {
    const btn = env.doc.getElementById(R.BUTTON_ID);
    env.doc.fire('pointerdown', btn, { clientX: 10, clientY: 10, button, pointerType });
    if (hold) await env.win.advance(hold);
    if (move) for (const [x, y] of move) env.doc.fire('pointermove', btn, { clientX: x, clientY: y, pointerType });
    const last = move ? move[move.length - 1] : [10, 10];
    env.doc.fire('pointerup', btn, { clientX: last[0], clientY: last[1], pointerType });
    await flush();
    return btn;
};
const menuOpen = env => { const m = env.doc.getElementById(R.MENU_ID); return !!m && !m.hidden; };
const menuActions = env => env.doc.getElementById(R.MENU_ID).querySelectorAll('button').map(b => b.dataset.action || b.dataset.main || b.dataset.place || 'reset');

// ── 1. 순수 함수 ──
await test('설정 고치기: 잘못된 값은 기본값 · 숨김은 아는 기능만 · 기본은 꺼짐', () => {
    const owner = { remote: { enabled: 'yes', main: 'nope', hidden: ['edit', 'edit', 'zzz'], lastAuto: 'x' } };
    const s = R.normalizeSettings(owner);
    assert.deepEqual({ ...s }, { enabled: false, main: 'translate', hidden: ['edit'], lastAuto: 'ai' });
    assert.equal(R.normalizeSettings({}).enabled, false, '처음엔 꺼짐 (기존 사용자 화면이 갑자기 바뀌지 않게)');
    assert.equal(R.SETTINGS_DEFAULTS.enabled, false);
});
await test('자리 고치기: 원작 cfg 와 같은 이름 · 범위 밖은 잘라요', () => {
    assert.deepEqual(R.sanitizeLayout({ place: 'float', size: 999, x: -1, y: 2 }), { place: 'float', size: R.SIZE_MAX, x: 0, y: 1 });
    assert.deepEqual(R.sanitizeLayout(null), { ...R.LAYOUT_DEFAULTS });
    assert.equal(R.sanitizeLayout({ place: 'top' }).place, 'left');
});
await test('설정 이전: 이 기기에 원작 스크립트 설정만 있으면 위치 · 크기 · 대표 기능을 옮겨 와요 (한 번)', () => {
    const storage = new Storage({ [R.SCRIPT_KEY]: JSON.stringify({ place: 'float', size: 60, x: 0.5, y: 0.3, main: 'edit' }) });
    const env = setup({ storage, owner: { remote: { enabled: true } } });
    assert.deepEqual(env.remote.layout(), { place: 'float', size: 60, x: 0.5, y: 0.3 });
    assert.equal(env.owner.remote.main, 'edit', '대표 기능도');
    assert.deepEqual(JSON.parse(storage.getItem(R.LAYOUT_KEY)), { place: 'float', size: 60, x: 0.5, y: 0.3 }, '우리 열쇠에 저장');
    assert.ok(env.toasts.some(([, t]) => /옮겨 왔어요/.test(t)), '옮겨 왔다고 한 번 알려요');
    assert.ok(!setup({ storage }).toasts.some(([, t]) => /옮겨 왔어요/.test(t)), '두 번째부터는 조용히');
    // 이미 우리 자리가 있으면 원작 설정은 보지 않아요 · 사용자가 고른 대표 기능은 그대로
    const s2 = new Storage({ [R.LAYOUT_KEY]: JSON.stringify({ place: 'right', size: 44, x: 0.1, y: 0.1 }), [R.SCRIPT_KEY]: JSON.stringify({ place: 'float', main: 'delete' }) });
    const env2 = setup({ storage: s2, owner: { remote: { enabled: true, main: 'auto' } } });
    assert.equal(env2.remote.layout().place, 'right');
    assert.equal(env2.owner.remote.main, 'auto');
    const env3 = setup({ storage: new Storage({ [R.SCRIPT_KEY]: JSON.stringify({ main: 'delete' }) }), owner: { remote: { enabled: true, main: 'auto' } } });
    assert.equal(env3.owner.remote.main, 'auto', '이미 고른 대표 기능은 덮지 않아요');
    // 저장소가 깨져 있어도 기본값
    assert.deepEqual(R.readLayout({ getItem() { return '{oops'; }, setItem() { throw Error('막힘'); } }).layout, { ...R.LAYOUT_DEFAULTS });
});
await test('원작 감지: 요소 id 가 먼저 · 태번 헬퍼 전역 목록(폴더 안 · 이름 · id) · 전역 스크립트를 껐으면 아니에요', () => {
    const doc = makeDoc();
    assert.equal(R.detectOriginal(doc, null), '');
    const th = on => ({ script: { enabled: { global: on }, scripts: [{ type: 'folder', enabled: true, scripts: [{ type: 'script', enabled: true, name: '✨️번역 리모컨', id: 'x' }] }] } });
    assert.equal(R.detectOriginal(doc, th(true)), 'listed');
    assert.equal(R.detectOriginal(doc, th(false)), '', '전역 스크립트 끔');
    assert.equal(R.detectOriginal(doc, { script: { scripts: [{ type: 'script', enabled: false, name: '번역 리모컨', id: R.ORIGINAL.scriptId }] } }), '', '그 스크립트를 꺼 둠');
    assert.equal(R.detectOriginal(doc, { script: { scripts: [{ type: 'script', enabled: true, name: '내 이름', id: R.ORIGINAL.scriptId }] } }), 'listed', '이름을 바꿔도 id 로');
    const style = doc.createElement('style'); style.id = 'tcb-style'; doc.head.append(style);
    assert.equal(R.detectOriginal(doc, null), 'running');
});
await test('보이는 메시지: 채팅 칸 안에서 보이는 세로 길이가 가장 긴 것 · 아래에서 훑다 위로 벗어나면 멈춰요', () => {
    // 화면 위로 지나간 메시지 300개 + 보이는 쪽 4개
    const above = Array.from({ length: 300 }, (_, i) => ({ top: -100000 + i * 300, height: 280 }));
    const env = setup({ rects: [...above, { top: -900, height: 600 }, { top: -300, height: 500 }, { top: 200, height: 420 }, { top: 620, height: 300 }] });
    env.doc.rectReads = 0;
    const picked = R.pickVisibleMessage(env.doc, env.win);
    assert.equal(picked.getAttribute('mesid'), '302', '200~620 (420px 보임) — 620~700 은 80px, 40~200 은 160px');
    assert.ok(env.doc.rectReads <= 6, `잰 횟수 ${env.doc.rectReads} (채팅 1 + 보이는 쪽 3 + 위로 벗어난 첫 메시지 1 — 위쪽 300개는 재지 않아요)`);
    // 숨긴(크기 0) 메시지는 건너뛰되 멈추지 않아요
    const env2 = setup({ rects: [{ top: 100, height: 300 }, { top: 0, height: 0 }, { top: 0, height: 0 }] });
    assert.equal(R.pickVisibleMessage(env2.doc, env2.win).getAttribute('mesid'), '0');
    // 하나도 안 보이면 마지막 메시지 · 메시지가 없으면 null
    const env3 = setup({ rects: [{ top: -900, height: 100 }, { top: -500, height: 100 }] });
    assert.equal(R.pickVisibleMessage(env3.doc, env3.win).getAttribute('mesid'), '1');
    const env4 = setup({ rects: [] });
    assert.equal(R.pickVisibleMessage(env4.doc, env4.win), null);
});
await test('앵커: 고친 글에서도 읽던 조각을 찾고, 못 찾으면 비율로', () => {
    const text = '가나다라마바사아자차카타파하 첫 문단이에요. 둘째 문단은 여기서 시작해요. 셋째 문단.';
    const i = text.indexOf('둘째');
    const a = R.makeAnchor(text, i);
    assert.equal(R.locateAnchor('머리말을 더했어요. ' + text, a), '머리말을 더했어요. '.length + i);
    assert.equal(R.locateAnchor('완전히 다른 글', { after: 'zzzzzzzz', before: 'yyyyyyyy', ratio: 0.5 }), 4);
});

// ── 2. 단추 · 누르기 ──
await test('자리 3종: 입력칸 왼쪽(기본) · 오른쪽 · 플로팅, 단추 줄이 없으면 플로팅으로', async () => {
    const env = setup();
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    assert.equal(btn.parentElement, env.left, '기본은 입력칸 왼쪽 단추 줄');
    assert.equal(btn.getAttribute('role'), 'button');
    assert.ok(btn.classList.contains('interactable'), '옆 단추와 같은 칸 규칙(테마 · 실리태번)');
    env.remote.setPlace('right');
    assert.equal(btn.parentElement, env.right);
    env.remote.setPlace('float');
    assert.equal(btn.parentElement, env.doc.body);
    assert.ok(btn.classList.contains('llmt-remote-float'));
    assert.equal(btn.style.getPropertyValue('--llmt-remote-size'), '44px', '플로팅 기본 44 = 누르는 칸 44');
    assert.equal(btn.style.left, `${Math.round(0.96 * (400 - 44))}px`);
    env.remote.setPlace('left');
    assert.ok(!btn.classList.contains('llmt-remote-float'));
    assert.equal(btn.style.left, '', '입력줄로 돌아오면 떠 있는 자리값을 지워요');
    assert.equal(JSON.parse(env.storage.getItem(R.LAYOUT_KEY)).place, 'left', '기기마다 저장');
    const env2 = setup({ dom: { noLeft: true } });
    env2.remote.sync();
    assert.ok(env2.doc.getElementById(R.BUTTON_ID).classList.contains('llmt-remote-float'), '왼쪽 단추 줄이 없으면 떠 있게');
});
await test('짧게 누르기 = 대표 기능(번역)을 화면에서 가장 많이 보이는 메시지에 · 메뉴는 안 떠요', async () => {
    const env = setup();
    env.remote.sync();
    await press(env);
    assert.deepEqual(env.calls.filter(c => c[0] === 'translate'), [['translate', '2']]);
    assert.ok(!menuOpen(env));
});
await test('길게 누르기 = 메뉴(대표 기능은 빼고 + 설정) · 손을 떼도 대표 기능은 안 돌아요 · 다시 누르면 닫혀요', async () => {
    const env = setup();
    env.remote.sync();
    const btn = await press(env, { hold: R.LONG_PRESS_MS + 10 });
    assert.ok(menuOpen(env), '메뉴');
    assert.equal(env.calls.filter(c => c[0] === 'translate').length, 0, '대표 기능 안 돌기');
    assert.deepEqual(menuActions(env), ['auto', 'retranslate', 'edit', 'delete', 'toggleAll', 'translateAll', 'settings']);
    assert.equal(btn.getAttribute('aria-expanded'), 'true');
    const menu = env.doc.getElementById(R.MENU_ID);
    assert.equal(menu.getAttribute('role'), 'menu');
    assert.ok(menu.querySelectorAll('button').every(b => /^menuitem/.test(b.getAttribute('role'))));
    // 메뉴가 열린 채 단추를 누르면 닫기만
    await press(env);
    assert.ok(!menuOpen(env));
    assert.equal(env.calls.filter(c => c[0] === 'translate').length, 0);
});
await test('우클릭(contextmenu) = 메뉴 · 바깥을 누르면 닫혀요 · Esc 도', async () => {
    const env = setup();
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    const ev = env.doc.fire('contextmenu', btn);
    assert.ok(ev.defaultPrevented, '브라우저 메뉴 막기');
    assert.ok(menuOpen(env));
    env.doc.fire('pointerdown', env.chat);
    assert.ok(!menuOpen(env), '바깥 누름');
    env.doc.fire('contextmenu', btn);
    env.doc.fire('keydown', env.chat, { key: 'Escape' });
    assert.ok(!menuOpen(env), 'Esc');
    // 키보드: Enter = 대표 기능, Shift+F10 = 메뉴
    env.doc.fire('keydown', btn, { key: 'Enter' });
    await flush();
    assert.equal(env.calls.filter(c => c[0] === 'translate').length, 1);
    env.doc.fire('keydown', btn, { key: 'F10', shiftKey: true });
    assert.ok(menuOpen(env));
    assert.equal(env.doc.activeElement?.dataset.action, 'auto', '키보드로 열면 첫 항목에 초점');
});
await test('끌기(플로팅): 8px 넘게 움직이면 옮기고 자리를 비율로 저장 · 대표 기능 · 메뉴 없음, 입력줄에선 끌지 않아요', async () => {
    const env = setup({ storage: new Storage({ [R.LAYOUT_KEY]: JSON.stringify({ place: 'float', size: 44, x: 0.5, y: 0.5 }) }) });
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    btn.rect = { left: 178, top: 378, width: 44, height: 44 };
    env.doc.fire('pointerdown', btn, { clientX: 200, clientY: 400 });
    assert.equal(btn.captured, 1, '포인터 붙잡기');
    env.doc.fire('pointermove', btn, { clientX: 203, clientY: 402 });
    assert.equal(btn.style.left, `${Math.round(0.5 * 356)}px`, '8px 안쪽은 그대로');
    env.doc.fire('pointermove', btn, { clientX: 100, clientY: 100 });
    assert.ok(btn.classList.contains('is-dragging'));
    assert.equal(btn.style.left, '78px');
    btn.rect = { left: 78, top: 78, width: 44, height: 44 };
    await env.win.advance(R.LONG_PRESS_MS + 50);
    assert.ok(!menuOpen(env), '끄는 중엔 길게 누르기 메뉴가 안 떠요');
    env.doc.fire('pointerup', btn, { clientX: 100, clientY: 100 });
    await flush();
    const saved = JSON.parse(env.storage.getItem(R.LAYOUT_KEY));
    assert.ok(Math.abs(saved.x - 78 / 356) < 1e-9 && Math.abs(saved.y - 78 / 756) < 1e-9, JSON.stringify(saved));
    assert.equal(env.calls.filter(c => c[0] === 'translate').length, 0, '끌기는 실행이 아니에요');
    assert.ok(!btn.classList.contains('is-dragging'));
    // 입력줄
    const env2 = setup();
    env2.remote.sync();
    const b2 = env2.doc.getElementById(R.BUTTON_ID);
    env2.doc.fire('pointerdown', b2, { clientX: 10, clientY: 10 });
    env2.doc.fire('pointermove', b2, { clientX: 200, clientY: 200 });
    env2.doc.fire('pointerup', b2, { clientX: 200, clientY: 200 });
    await flush();
    assert.equal(b2.style.left, '');
    assert.equal(env2.calls.filter(c => c[0] === 'translate').length, 1, '입력줄 단추는 움직여도 누름');
    // 입력줄 단추에서 벗어나면(손가락을 밀어 냄) 길게 누르기 메뉴도 대표 기능도 없어요
    const env4 = setup();
    env4.remote.sync();
    const b4 = env4.doc.getElementById(R.BUTTON_ID);
    env4.doc.fire('pointerdown', b4); env4.doc.fire('pointerleave', b4);
    await env4.win.advance(R.LONG_PRESS_MS + 50);
    env4.doc.fire('pointerup', env4.chat);
    assert.ok(!menuOpen(env4)); assert.equal(env4.calls.filter(c => c[0] === 'translate').length, 0);
    // pointercancel(폰이 스크롤로 가져감)은 아무것도 안 해요
    const env3 = setup();
    env3.remote.sync();
    const b3 = env3.doc.getElementById(R.BUTTON_ID);
    env3.doc.fire('pointerdown', b3); env3.doc.fire('pointercancel', b3);
    await env3.win.advance(R.LONG_PRESS_MS + 50);
    assert.ok(!menuOpen(env3)); assert.equal(env3.calls.filter(c => c[0] === 'translate').length, 0);
});
await test('대표 기능 바꾸기: 메뉴 › 설정의 고르기 → 아이콘 · 이름 · 메뉴 항목이 따라와요', async () => {
    const env = setup();
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    assert.match(btn.querySelector('i').className, /fa-brain/);
    env.doc.fire('contextmenu', btn);
    const menu = env.doc.getElementById(R.MENU_ID);
    env.doc.fire('click', menu.querySelector('[data-action="settings"]'));
    assert.ok(!menu.querySelector('.llmt-remote-set').hidden, '빠른 설정 펼침');
    assert.deepEqual(menu.querySelectorAll('[data-place]').map(b => [b.dataset.place, b.getAttribute('aria-pressed')]), [['float', 'false'], ['left', 'true'], ['right', 'false']]);
    assert.equal(menu.querySelectorAll('input').length, 0, '입력줄에 있을 땐 크기 막대가 없어요');
    env.doc.fire('click', menu.querySelector('[data-main="edit"]'));
    assert.equal(env.owner.remote.main, 'edit');
    assert.ok(env.calls.some(c => c[0] === 'save') && env.calls.some(c => c[0] === 'changed'), '저장 · 설정 카드에 알림');
    assert.match(btn.querySelector('i').className, /fa-pen-to-square/);
    assert.match(btn.getAttribute('aria-label'), /번역 수정/);
    assert.ok(menuActions(env).includes('translate') && !menuActions(env).filter(a => a !== 'edit' || false).includes('nope'));
    assert.ok(!menu.querySelectorAll('.llmt-remote-item').some(b => b.dataset.action === 'edit'), '대표 기능은 메뉴 줄에서 빠져요');
    // 자리 → 플로팅: 크기 막대가 생겨요 · 처음대로
    env.doc.fire('click', menu.querySelector('[data-place="float"]'));
    assert.ok(btn.classList.contains('llmt-remote-float'));
    const range = menu.querySelector('input');
    assert.ok(range, '플로팅이면 크기 막대');
    range.value = '80';
    env.doc.fire('input', range);
    assert.equal(btn.style.getPropertyValue('--llmt-remote-size'), '80px');
    env.doc.fire('click', menu.querySelector('[data-reset]'));
    assert.equal(env.remote.layout().size, 44);
});
await test('메뉴 항목 숨기기: 설정에서 끈 기능은 길게 누르기 메뉴에 없어요', async () => {
    const env = setup({ owner: { remote: { enabled: true, hidden: ['toggleAll', 'translateAll', 'retranslate'] } } });
    env.remote.sync();
    env.remote.openMenu();
    assert.deepEqual(menuActions(env), ['auto', 'edit', 'delete', 'settings']);
});

// ── 3. 기능 ──
await test('자동 번역 켬/끔: 끔 ↔ AI(원작과 같게) · 전체/내 메시지로 쓰던 값은 기억했다 되살려요 · 켜짐 표시', async () => {
    const env = setup({ owner: { remote: { enabled: true, main: 'auto' } }, autoMode: 'all' });
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    assert.ok(btn.classList.contains('is-on'));
    assert.equal(btn.getAttribute('aria-pressed'), 'true');
    assert.match(btn.title, /켜짐\(전체\)/);
    await press(env);
    assert.equal(env.mode, 'none');
    assert.equal(env.owner.remote.lastAuto, 'all');
    assert.ok(!btn.classList.contains('is-on'));
    await press(env);
    assert.equal(env.mode, 'all', '다시 켜면 전에 쓰던 「전체」');
    const env2 = setup({ owner: { remote: { enabled: true, main: 'auto' } } });
    env2.remote.sync();
    await press(env2);
    assert.equal(env2.mode, 'ai', '처음 켜면 AI 메시지 (원작 기본)');
    assert.ok(env2.toasts.some(([, t]) => /자동 번역 켜짐/.test(t)), '짧은 알림');
    // 메뉴의 자동 번역 줄은 눌러도 메뉴가 닫히지 않고 켬/끔이 바로 보여요
    env2.owner.remote.main = 'translate';
    env2.remote.render();
    env2.remote.openMenu();
    const row = () => env2.doc.getElementById(R.MENU_ID).querySelector('[data-action="auto"]');
    assert.equal(row().getAttribute('aria-checked'), 'true');
    env2.doc.fire('click', row());
    await flush();
    assert.ok(menuOpen(env2));
    assert.equal(row().getAttribute('aria-checked'), 'false');
    assert.equal(row().querySelector('small').textContent, '끔');
});
await test('번역 삭제: 확인 창(지우기 · 붉은 단추)에서 고를 때만 · 번역이 없으면 묻지 않아요', async () => {
    const env = setup({ owner: { remote: { enabled: true, main: 'delete' } } });
    env.remote.sync();
    env.host._answer = false;
    await press(env);
    assert.equal(env.asks.length, 1);
    assert.match(env.asks[0].text, /#2/);
    assert.deepEqual(env.asks[0].opts, { ok: '지우기', cancel: '취소', danger: true });
    assert.equal(env.calls.filter(c => c[0] === 'delete').length, 0, '취소하면 안 지워요');
    env.host._answer = true;
    await press(env);
    assert.deepEqual(env.calls.filter(c => c[0] === 'delete'), [['delete', '2']]);
    const env2 = setup({ owner: { remote: { enabled: true, main: 'delete' } }, translated: new Set() });
    env2.remote.sync();
    await press(env2);
    assert.equal(env2.asks.length, 0);
    assert.ok(env2.toasts.some(([, t]) => /지울 번역문이 없어요/.test(t)));
});
await test('번역 수정: 첫 누름 = 그 메시지 수정 창 열기(아이콘이 ✓ 로) · 다시 누름 = 저장', async () => {
    const env = setup({ owner: { remote: { enabled: true, main: 'edit' } } });
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    await press(env);
    await env.win.advance(50);
    assert.deepEqual(env.calls.filter(c => c[0] === 'edit'), [['edit', '2']]);
    assert.ok(env.doc.querySelector('#chat .translation_edit_textarea'));
    assert.match(btn.querySelector('i').className, /fa-check/, '다시 누르면 저장한다는 표시');
    await press(env);
    await env.win.advance(700);
    assert.deepEqual(env.calls.filter(c => c[0] === 'save-edit'), [['save-edit', '2']]);
    assert.equal(env.doc.querySelector('#chat .translation_edit_textarea'), null);
    assert.match(btn.querySelector('i').className, /fa-pen-to-square/);
    // 번역이 없는 메시지는 열지 않고 알려요
    const env2 = setup({ owner: { remote: { enabled: true, main: 'edit' } }, translated: new Set([0]) });
    env2.remote.sync();
    await press(env2);
    assert.equal(env2.calls.filter(c => c[0] === 'edit').length, 0);
    assert.ok(env2.toasts.some(([, t]) => /아직 번역문이 없어요/.test(t)));
});
await test('다시 번역: 그 메시지 하나만 · 손으로 고친 번역이면 먼저 물어요 · 번역 중이면 안 보내요', async () => {
    const env = setup({ owner: { remote: { enabled: true, main: 'retranslate' } } });
    env.remote.sync();
    await press(env);
    assert.deepEqual(env.calls.filter(c => c[0] === 'retranslate'), [['retranslate', '2']]);
    assert.equal(env.asks.length, 0);
    env.host._edited = new Set([2]);
    env.host._answer = false;
    await press(env);
    assert.equal(env.asks.length, 1);
    assert.match(env.asks[0].text, /손으로 고친/);
    assert.equal(env.calls.filter(c => c[0] === 'retranslate').length, 1, '취소');
    env.host._busy = new Set([2]);
    await press(env);
    assert.equal(env.calls.filter(c => c[0] === 'retranslate').length, 1, '번역 중');
});
await test('채팅 전체 번역 · 모두 원문/번역: 메뉴에서 · 진행 중엔 「멈추기 n/N」과 깜빡임', async () => {
    const env = setup({ owner: { remote: { enabled: true, main: 'translateAll' } } });
    env.remote.sync();
    const btn = env.doc.getElementById(R.BUTTON_ID);
    await press(env);
    assert.deepEqual(env.calls.filter(c => c[0] === 'translateAll'), [['translateAll']]);
    env.host._batch = { done: 3, total: 12 };
    env.doc.fire('llm-translator:batch', env.doc.body);
    await env.win.advance(20);
    assert.match(btn.querySelector('i').className, /fa-circle-stop/);
    assert.ok(btn.classList.contains('is-busy'));
    assert.match(btn.title, /전체 번역 멈추기 3\/12/);
    env.owner.remote.main = 'translate';
    env.remote.render();
    env.remote.openMenu();
    const row = env.doc.getElementById(R.MENU_ID).querySelector('[data-action="translateAll"]');
    assert.match(row.textContent, /전체 번역 멈추기3\/12|전체 번역 멈추기 3\/12/);
    env.doc.fire('click', env.doc.getElementById(R.MENU_ID).querySelector('[data-action="toggleAll"]'));
    await flush();
    assert.deepEqual(env.calls.filter(c => c[0] === 'toggleAll'), [['toggleAll']]);
    assert.ok(!menuOpen(env), '기능을 고르면 메뉴는 닫혀요');
    env.host._batch = null;
    env.remote.render();
    assert.ok(!btn.classList.contains('is-busy'));
});
await test('메시지가 없으면 알리고 아무것도 안 보내요 · 오류는 알림으로', async () => {
    const env = setup({ rects: [] });
    env.remote.sync();
    await press(env);
    assert.equal(env.calls.filter(c => c[0] === 'translate').length, 0);
    assert.ok(env.toasts.some(([, t]) => /채팅 메시지가 없어요/.test(t)));
    const env2 = setup();
    env2.host.run.translate = async () => { throw new Error('연결이 끊겼어요'); };
    env2.remote.sync();
    const warn = console.warn; console.warn = () => {};
    await press(env2);
    console.warn = warn;
    assert.ok(env2.toasts.some(([k, t]) => k === 'error' && /연결이 끊겼어요/.test(t)));
    assert.ok(!env2.doc.getElementById(R.BUTTON_ID).classList.contains('is-busy'), '끝나면 깜빡임 멈춤');
});

// ── 4. 원작 스크립트와 겹치지 않기 ──
await test('원작 스크립트가 돌고 있으면(#tcb-style · #tcb-btn) 쉬고, 끄면 바로 나와요', async () => {
    const env = setup();
    const style = env.doc.createElement('style'); style.id = 'tcb-style'; env.doc.head.append(style);
    env.remote.sync();
    assert.equal(env.doc.getElementById(R.BUTTON_ID), null, '쉬기');
    assert.equal(env.remote.resting(), 'running');
    assert.deepEqual(env.calls.filter(c => c[0] === 'rest').at(-1), ['rest', 'running'], '설정 카드에 안내');
    style.remove();
    env.win.flushObservers();
    assert.ok(env.doc.getElementById(R.BUTTON_ID), '원작을 끄면(스타일을 뺌) 나와요');
    assert.equal(env.remote.resting(), '');
    // 늦게 켜져도: 원작이 head 에 스타일을 넣으면 우리 단추를 뗘요
    const s2 = env.doc.createElement('style'); s2.id = 'tcb-style'; env.doc.head.append(s2);
    env.win.flushObservers();
    assert.equal(env.doc.getElementById(R.BUTTON_ID), null);
    // 원작 단추 id 만 있어도
    const env2 = setup();
    const ob = env2.doc.createElement('div'); ob.id = 'tcb-btn'; env2.left.append(ob);
    env2.remote.sync();
    assert.equal(env2.doc.getElementById(R.BUTTON_ID), null);
});
await test('태번 헬퍼 목록에 원작이 켜져 있으면 시작 직후엔 기다렸다가, 끝내 안 돌면 나와요', async () => {
    const th = { script: { enabled: { global: true }, scripts: [{ type: 'script', enabled: true, name: '✨️번역 리모컨', id: R.ORIGINAL.scriptId }] } };
    const env = setup({ th });
    env.remote.sync();
    assert.equal(env.remote.resting(), 'starting');
    assert.equal(env.doc.getElementById(R.BUTTON_ID), null, '시작 직후 깜빡 두 단추가 안 보이게');
    await env.win.advance(1100);
    assert.equal(env.remote.resting(), '', '기다려도 안 돌면(태번 헬퍼 꺼짐 등) 나와요');
    assert.ok(env.doc.getElementById(R.BUTTON_ID));
});
await test('끄면 단추 · 메뉴 · 리스너를 다 떼요 · 다시 켜면 같은 자리', async () => {
    const env = setup();
    env.remote.sync();
    env.remote.openMenu();
    env.owner.remote.enabled = false;
    env.remote.sync();
    assert.equal(env.doc.getElementById(R.BUTTON_ID), null);
    assert.ok(!menuOpen(env));
    assert.equal(env.doc.listeners.length, 0, '문서 리스너 0');
    assert.equal(env.doc.observers.length, 0, 'head 감시 0');
    env.owner.remote.enabled = true;
    env.remote.sync();
    assert.equal(env.doc.getElementById(R.BUTTON_ID).parentElement, env.left);
});

// ── 5. 번역 애드온 함수를 꺼내 흉내 환경에서 돌려 보기 (모두 원문/번역 · 채팅 전체 번역) ──
const INDEX = read('src/addons/translator/index.js');
function grab(head) {   // 그 함수 · 상수 한 덩이 (중괄호 짝)
    const start = INDEX.indexOf(head);
    assert.ok(start >= 0, head);
    if (head.startsWith('const ')) return INDEX.slice(start, INDEX.indexOf('\n', start));
    let depth = 0, i = INDEX.indexOf('{', start);
    for (; i < INDEX.length; i++) { if (INDEX[i] === '{') depth++; else if (INDEX[i] === '}' && --depth === 0) break; }
    return INDEX.slice(start, i + 1);
}
const jq = () => { const o = { find: () => o, removeClass: () => o, addClass: () => o, text: () => o, data: () => o }; return o; };
await test('모두 원문/번역(흉내): 하나라도 번역을 보이면 모두 원문 → 다시 누르면 모두 번역 · 번역 중 메시지 그대로 · 저장 한 번 · 요청 0', async () => {
    const chat = [
        { mes: 'a', extra: { display_text: '가' } },
        { mes: 'b', extra: { display_text: 'b', original_translation_backup: '나' } },   // 이미 원문 보기
        { mes: 'c', extra: {} },                                                         // 번역 없음
        { mes: 'd', extra: { display_text: '라' } },                                     // 번역 중
        { mes: 'e', extra: { display_text: '마' } },                                     // 안 그려짐
    ];
    const log = [];
    const ctx = { chat, name1: 'U', saveChatDebounced() { log.push('save'); } };
    const fn = new Function('getContext', 'isTranslationInProgress', 'isTranslationCurrentlyDisplayed', 'substituteParams', 'document', 'refreshMessageBlock', '$', 'emitTranslationUIUpdate', 'toastr',
        `${grab('async function toggleAllTranslations()')}\nreturn toggleAllTranslations;`)(
        () => ctx, id => id === 3, id => !chat[id].extra.original_translation_backup, m => m, { querySelector: sel => (sel.includes('"4"') ? null : {}) },
        async id => log.push('draw ' + id), jq, (id, type) => log.push(`ui ${id} ${type}`), { info: t => log.push('toast ' + t) });
    assert.equal(await fn(), 2);
    assert.deepEqual(chat.map(m => m.extra.display_text), ['a', 'b', undefined, '라', 'e']);
    assert.deepEqual(chat.map(m => m.extra.original_translation_backup), ['가', '나', undefined, undefined, '마']);
    assert.deepEqual(log, ['draw 0', 'ui 0 show_original', 'save', 'toast 원문으로 모두 바꿨어요 (2개)'], '안 그려진 #4 는 자료만 · 저장 한 번');
    log.length = 0;
    assert.equal(await fn(), 3);
    assert.deepEqual(chat.map(m => m.extra.display_text), ['가', '나', undefined, '라', '마']);
    assert.ok(chat.every(m => !m.extra.original_translation_backup));
    assert.deepEqual(log.filter(l => l.startsWith('draw')), ['draw 0', 'draw 1']);
    assert.match(log.at(-1), /번역문으로 모두 바꿨어요 \(3개\)/);
});
await test('채팅 전체 번역(흉내): 확인 창에 번역이 없는 메시지 수 · 취소하면 요청 0 · 진행 done/total 알림 · 다 됐으면 묻지 않음', async () => {
    const make = () => [{ mes: 'a', extra: { display_text: '가' } }, { mes: 'b', extra: {} }, { mes: '  ', extra: {} }, { mes: 'd', extra: { display_text: '[원문 — 원문 그대로]' } }, { mes: 'e' }];
    const run = async ({ chat, answer = true }) => {
        const log = [], events = [];
        const ctx = { chat };
        const body = `let batchRun = null, isChatTranslationInProgress = false;\n${grab('const batchNeeded = ')}\n${grab('const emitBatch = ')}\n${grab('async function onTranslateChatClick()')}\nreturn onTranslateChatClick;`;
        const fn = new Function('guards', 'getContext', 'toastr', '$', 'ask', 'translateMessage', 'extensionSettings', 'MARK_TAIL', 'document', 'CustomEvent', body)(
            { capture: () => ({ assert() {} }) }, () => ctx, { info: t => log.push('info ' + t), warning: t => log.push('warn ' + t), success: t => log.push('ok ' + t), error: t => log.push('err ' + t) }, jq,
            async (text, opts) => { log.push({ text, opts }); return answer; }, async id => log.push('translate ' + id), { throttle_delay: '0' }, ' — 원문 그대로]',
            { dispatchEvent: e => events.push(e.detail) }, class { constructor(type, init) { this.type = type; this.detail = init.detail; } });
        await fn();
        return { log, events };
    };
    const a = await run({ chat: make() });
    assert.match(a.log[0].text, /^번역이 없는 메시지 3개를 차례로 번역할까요\?/, '빈 글 · 번역된 글은 빼고 실패 표시가 남은 글은 셈');
    assert.deepEqual(a.log[0].opts, { ok: '번역 시작', cancel: '취소', title: '채팅 전체 번역' });
    assert.deepEqual(a.log.filter(l => typeof l === 'string' && l.startsWith('translate')), ['translate 0', 'translate 1', 'translate 2', 'translate 3', 'translate 4'], '번역 함수가 메시지마다 건너뛸지 정하는 길은 그대로');
    assert.deepEqual(a.events.map(e => `${e.running ? 'run' : 'end'} ${e.done}/${e.total}`), ['run 0/3', 'run 1/3', 'run 2/3', 'run 3/3', 'end 3/3']);
    const b = await run({ chat: make(), answer: false });
    assert.equal(b.log.filter(l => typeof l === 'string' && l.startsWith('translate')).length, 0, '취소하면 요청 0');
    const c = await run({ chat: [{ mes: 'a', extra: { display_text: '가' } }] });
    assert.deepEqual(c.log, ['info 이 채팅은 이미 모두 번역돼 있어요.'], '확인 창도 요청도 없음');
});

// ── 6. 번역 애드온 · 테마와 이어진 곳 (글) ──
await test('index.js: 켰을 때만 remote.js 를 불러오고, 번역 함수를 바로 이어요 · 프리셋에 안 담고 골라도 지켜요', () => {
    const js = read('src/addons/translator/index.js');
    assert.ok(!/^import [^\n]*remote\.js/m.test(js), '정적 import 없음 (끈 사람은 안 읽음)');
    assert.match(js, /if \(!on && !remote\) return Promise\.resolve\(null\);\n    remoteLoad \?\?= import\('\.\/remote\.js'\)/);
    for (const wire of ['translate: id => handleTranslateButtonClick(id)', "retranslate: id => translateMessage(id, true, getContext().chat?.[id]?.extra?.display_text ? 'fresh' : 'manual')",
        'edit: id => editTranslation(id)', 'delete: id => deleteTranslationById(id)', 'toggleAll: () => toggleAllTranslations()', 'translateAll: () => onTranslateChatClick()',
        'thSettings: () => extension_settings.tavern_helper', 'ask: (text, options) => ask(text, options)']) assert.ok(js.includes(wire), wire);
    assert.equal((js.match(/delete settingsSnapshot\.remote;/g) || []).length, 2, '프리셋 저장 · 갱신 둘 다 빼요');
    assert.match(js, /const myRemote = extensionSettings\.remote;[^\n]*\n\n        \/\/ 3\. 기존 설정 싹 지우기/, '지우기 전에 잡아 두고');
    assert.match(js, /Object\.assign\(extensionSettings, deviceState\);\n        if \(myRemote\) extensionSettings\.remote = myRemote;/, '프리셋을 골라도 되살려요');
    assert.match(js, /syncRemote\(\);   \/\/ 번역 리모컨/);
    assert.match(js, /bindRemoteSettings\(\);/);
    assert.match(js, /eventSource\.on\(event_types\.CHAT_CHANGED, \(\) => \{ remote\?\.closeMenu\(\); remote\?\.sync\(\); \}\);/);
    assert.match(js, /extensionSettings\.auto_mode = \$\(this\)\.val\(\);\n        saveSettingsDebounced\(\);\n        remote\?\.render\(\);/);
});
await test('index.js 「다시 번역」(fresh)은 저장된 번역 · 문단 캐시를 건너뛰고 그 메시지만 새로 받아요', () => {
    const js = read('src/addons/translator/index.js');
    assert.match(js, /const cachedTranslation = lookedUp \? lookedUp\.value : source === 'fresh' \? null : await readCachedTranslation\(originalText\);/);
    assert.match(js, /const segmentCache = source !== 'fresh' && \(source !== 'handleTranslateButtonClick_retranslate'/);
    assert.match(js, /source === 'handleTranslateButtonClick_retranslate' \|\|\n            source === 'fresh'\) \{/, '시작 알림');
});
await test('index.js 채팅 전체 번역: 확인 창에 번역이 없는 메시지 수 · 다 번역돼 있으면 묻지 않음 · 진행 알림', () => {
    const js = read('src/addons/translator/index.js');
    const start = js.indexOf('async function onTranslateChatClick()'), body = js.slice(start, js.indexOf('// 입력창 번역 (단순화)', start));
    assert.match(body, /const pending = new Set\(messages\.filter\(batchNeeded\)\);/);
    assert.match(body, /if \(!pending\.size\) \{ toastr\.info\('이 채팅은 이미 모두 번역돼 있어요\.'\); return; \}/);
    assert.match(body, /await ask\(`번역이 없는 메시지 \$\{pending\.size\}개를 차례로 번역할까요\?/);
    assert.match(body, /if \(pending\.has\(message\)\) \{ run\.done\+\+; emitBatch\(run\); \}/);
    assert.ok(body.indexOf('const pending') < body.indexOf('batchRun = run'), '다 번역돼 있으면 자리를 잡지 않아요');
    assert.match(js, /const batchNeeded = message => !!String\(message\?\.mes \?\? ''\)\.trim\(\) && \(!message\.extra\?\.display_text \|\| String\(message\.extra\.display_text\)\.includes\(MARK_TAIL\)\);/);
    assert.match(js, /let shouldTranslate = forceTranslate \|\| !message\.extra\.display_text \|\| \(source === 'batch' && String\(message\.extra\.display_text\)\.includes\(MARK_TAIL\)\);/, 'batchNeeded 가 따라 하는 판단 그대로');
});
await test('index.js 모두 원문/번역: 돋보기와 같은 자료만 · 번역 중인 메시지는 그대로 · 그려진 것만 다시 그림 · 저장 한 번', () => {
    const js = read('src/addons/translator/index.js');
    const start = js.indexOf('async function toggleAllTranslations()'), body = js.slice(start, js.indexOf('\n}\n', start));
    assert.ok(start > 0);
    assert.match(body, /!isTranslationInProgress\(id\)/);
    assert.match(body, /original_translation_backup = message\.extra\.display_text/);
    assert.match(body, /if \(!document\.querySelector\(`#chat \.mes\[mesid="\$\{id\}"\]`\)\) continue;/);
    assert.equal((body.match(/saveChat/g) || []).length, 2, 'saveChatDebounced ?? saveChat 한 줄');
    assert.ok(!/translateMessage|translate\(/.test(body), '요청 없음');
});
await test('index.js 번역 수정 창: 원문 같이 보기 책 단추(글로만 넣음) · 닫을 때 같이 치움', () => {
    const js = read('src/addons/translator/index.js');
    assert.match(js, /\.addClass\('translation_edit_source_toggle interactable fa-solid fa-book-open'\)/);
    assert.match(js, /const sourceBox = \$\('<div>'\)\.addClass\('translation_edit_source'\)\.text\(originalMessageText\)/, '.text — HTML 로 읽지 않아요');
    assert.equal((js.match(/sourceBox\.remove\(\);/g) || []).length, 2, '취소 · 저장');
    assert.match(js, /editButtons\.append\(saveButton, cancelButton, sourceButton\);/);
});
await test('설정 카드(index.html): 기본 꺼짐 체크 · 대표 기능 7개 · 자리 3개 · 메뉴 항목 7개 · 감사 한 줄', () => {
    const html = read('src/addons/translator/index.html');
    const card = html.slice(html.indexOf('llmt-remote-card'), html.indexOf('</section>', html.indexOf('llmt-remote-card')));
    assert.match(card, /<input type="checkbox" id="llm_remote_enabled">/);
    const mains = [...card.matchAll(/<option value="(\w+)">/g)].map(m => m[1]);
    assert.deepEqual(mains, [...R.ORDER, 'left', 'right', 'float']);
    assert.deepEqual([...card.matchAll(/data-remote-item="(\w+)"/g)].map(m => m[1]), [...R.ORDER]);
    assert.match(card, /<div id="llm_remote_options" hidden>/, '켜기 전엔 세부 칸이 숨어 있어요');
    assert.match(card, /<small class="llmt-remote-credit">아이디어 · 원작: 번역 리모컨 스크립트 제작자님 💙<\/small>/);
    for (const label of ['자동 번역', '번역', '다시 번역', '번역 수정', '번역 삭제', '모두 원문/번역', '채팅 전체 번역']) assert.ok(Object.values(R.ACTIONS).some(a => a.label === label), label);
});
await test('스타일: 단추 · 플로팅 44 · 누르는 칸 44 · 메뉴 줄 · 고른 칸 650 · 테마 토큰만', () => {
    const css = read('src/addons/translator/style.css');
    const part = css.slice(css.indexOf('/* ── 번역 리모컨 (translate-remote'));
    for (const sel of ['#llmt_remote_button.llmt-remote-float {', '.llmt-remote-menu {', '.llmt-remote-item {', '.llmt-remote-chip[aria-pressed="true"]', '.translation_edit_source {', 'body.salty .llmt-remote-menu {'])
        assert.ok(part.includes(sel), sel);
    assert.match(part, /width: var\(--llmt-remote-size, 44px\);/);
    assert.match(part, /width: max\(100%, 44px\); height: max\(100%, 44px\);/);
    assert.match(part, /min-height: var\(--bl-h-menu, 40px\);/);
    assert.match(part, /font-weight: 650;/);
    const colors = part.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [];
    assert.deepEqual(colors, [], '임의 색 없음 — 팔레트 변수만');
    assert.ok(!/box-shadow: (?!none|var\()/.test(part.replace(/box-shadow: 0 8px 24px var\(--SmartThemeShadowColor, transparent\);/, '')), '그림자는 테마 토큰 · 실리태번 그림자 색만');
});
await test('길게 누르기 설명: 리모컨 단추는 자기 길게 누르기가 있어 설명을 띄우지 않아요 (사전 · 제외 목록 · SKIP)', async () => {
    const { SKIP, HOVER_SKIP } = await import(pathToFileURL(path.join(root, 'src/longpress-help.js')));
    assert.ok(SKIP.split(',').map(s => s.trim()).includes('#' + R.BUTTON_ID));
    assert.ok(!HOVER_SKIP.includes(R.BUTTON_ID), 'PC 마우스 올려 두기 설명은 보여요');
    const src = JSON.parse(read('tools/scripts-src/longpress-help/help.json'));
    assert.ok(src.excluded.some(x => x.selector === '#' + R.BUTTON_ID));
    assert.ok(src.entries.some(e => e.ids.includes(R.BUTTON_ID)));
});
await test('출처: THIRD-PARTY-NOTICES · 애드온 README · MODIFICATIONS 에 원작 스크립트 한 줄', () => {
    assert.match(read('THIRD-PARTY-NOTICES.md'), /번역 리모컨 — 커뮤니티 공유 태번 헬퍼 스크립트\(원작자의 허락으로 수정 · 통합\)/);
    assert.match(read('src/addons/translator/README.md'), /번역 리모컨 — 커뮤니티 공유 태번 헬퍼 스크립트\(원작자의 허락으로 수정 · 통합\)/);
    assert.match(read('src/addons/translator/MODIFICATIONS.md'), /번역 리모컨\): 커뮤니티에 공유된 태번 헬퍼 스크립트/);
    assert.match(read('src/addons/translator/remote.js'), /원작자의 허락으로 고쳐/);
});

console.log(`번역 리모컨: ${pass}개 통과했어요.`);
