// 8.2.7 성능: 과일 글자 설정(fruit-type-runtime) · 바로가기(fruit-type-shortcuts) 감시가 채팅을 열고 바꿀 때 덜 일하는지 · 판정은 예전과 같은지 (가짜 문서)
//   1) 상태창 판정(fruitStructureChanged): 목록에 나오는 class · id · 태그가 하나도 없는 요소는 긴 뿌리 선택자로 matches 하지 않아요 · 자식 요소가 없으면 querySelector 도요.
//      같은 부모에 몰린 기록은 조상 거슬러 오르기를 한 번만 해요. 판정(참 · 거짓)은 예전 코드와 기록 묶음마다 같아요(지어낸 상태창 꼴 · :has 꼴 · iframe · 바로가기 단추).
//   2) 채팅을 바꾸며 메시지 수백 개가 떨어지면 떨어진 메시지 아래를 뿌리 선택자로 훑지 않아요 — 마지막 상태창이 빠졌을 때(글자 style 을 붙여 둔 채) · 지켜보던 iframe 이 빠졌을 때는 예전처럼 다시 봐요.
//   3) 바로가기도 떨어진 메시지 아래를 훑지 않고, 단추를 단 카드가 빠지면 다시 봐요.
// 폰 CPU 4배 측정(채팅 300개 열기 · 관문 장면): 과일 글자 감시 콜백 150ms → 65ms, 300 → 짧은 채팅 되돌리기 50ms → 4ms.
//   node tools/tests/fruit-watch-records.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.stack || e).split('\n').slice(0, 6).join('\n        ')}`); } };
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {} }) };
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);

// ── 작은 선택자: 태그 · #id · .class · :is(…) · :has(…) · 자손(빈칸) · 자식(>) · 쉼표
function splitTop(text, sep) { const out = []; let depth = 0, cur = ''; for (const ch of text) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (!depth && sep(ch)) { out.push(cur); cur = ''; continue; } cur += ch; } out.push(cur); return out; }
const parsed = new Map();
function parseList(selector) {
    let list = parsed.get(selector); if (list) return list;
    list = splitTop(selector, ch => ch === ',').map(s => s.trim()).filter(Boolean).map(complex => {
        const words = splitTop(complex.replace(/\s*>\s*/g, ' > '), ch => ch === ' ').filter(Boolean); const parts = [];
        for (const w of words) { if (w === '>') { parts.push('>'); continue; } if (parts.length && parts.at(-1) !== '>') parts.push(' '); parts.push(w); }
        return parts;
    });
    parsed.set(selector, list); return list;
}
function group(rest, at) { let depth = 0; for (let i = at; i < rest.length; i++) { if (rest[i] === '(') depth++; if (rest[i] === ')' && --depth === 0) return i; } throw Error('괄호가 안 닫혔어요: ' + rest); }
function compound(el, c) {
    if (!el || el.nodeType !== 1) return false;
    let rest = c; const tag = rest.match(/^[a-z*][\w-]*/i);
    if (tag) { if (tag[0] !== '*' && el.localName !== tag[0].toLowerCase()) return false; rest = rest.slice(tag[0].length); }
    while (rest) {
        let m;
        if ((m = rest.match(/^#([\w-]+)/))) { if (el.id !== m[1]) return false; rest = rest.slice(m[0].length); continue; }
        if ((m = rest.match(/^\.([\w-]+)/))) { if (!el.classList.contains(m[1])) return false; rest = rest.slice(m[0].length); continue; }
        if ((m = rest.match(/^\[([\w-]+)(?:(\^?=)"([^"]*)")?\]/))) { const v = el.getAttribute(m[1]); if (v === null || (m[2] === '=' && v !== m[3]) || (m[2] === '^=' && !v.startsWith(m[3]))) return false; rest = rest.slice(m[0].length); continue; }
        if (rest.startsWith(':is(')) { const end = group(rest, 3); if (!listMatch(el, rest.slice(4, end))) return false; rest = rest.slice(end + 1); continue; }
        if (rest.startsWith(':not(')) { const end = group(rest, 4); if (listMatch(el, rest.slice(5, end))) return false; rest = rest.slice(end + 1); continue; }
        if (rest.startsWith(':has(')) { const end = group(rest, 4); const inner = rest.slice(5, end); if (!el.all().some(d => parseList(inner).some(p => parts(d, p, p.length - 1, el)))) return false; rest = rest.slice(end + 1); continue; }
        throw Error('모르는 선택자 조각: ' + rest);
    }
    return true;
}
function parts(el, p, i, stop = null) {
    if (!compound(el, p[i])) return false; if (i === 0) return true;
    if (p[i - 1] === '>') { const up = el.parentElement; return !!up && up !== stop && parts(up, p, i - 2, stop); }
    for (let up = el.parentElement; up && up !== stop; up = up.parentElement) if (parts(up, p, i - 2, stop)) return true;
    return false;
}
const listMatch = (el, sel) => parseList(sel).some(p => parts(el, p, p.length - 1));

// ── 가짜 노드: 묻는 선택자 · 묻는 자리를 셉니다
const asked = { matches: [], closest: [], query: [] };
const resetAsked = () => { asked.matches.length = 0; asked.closest.length = 0; asked.query.length = 0; };
class Doc {
    constructor(mode = 'CSS1Compat') { this.nodeType = 9; this.compatMode = mode; this.fonts = null; this.documentElement = new El(this, 'html'); this.head = new El(this, 'head'); this.body = new El(this, 'body'); this.documentElement.append(this.head, this.body); }
    createElement(tag) { return new El(this, tag); }
    querySelector(sel) { return this.documentElement.matches(sel) ? this.documentElement : this.documentElement.querySelector(sel); }
    querySelectorAll(sel) { return this.documentElement.querySelectorAll(sel); }
    getElementById(id) { return this.documentElement.all().find(e => e.id === id) || null; }
    getElementsByTagName(tag) { return this.documentElement.getElementsByTagName(tag); }
    addEventListener() {} removeEventListener() {}
}
class El {
    constructor(doc, tag, attrs = {}) {
        this.ownerDocument = doc; this.nodeType = 1; this.localName = tag; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.children = []; this.parentElement = null; this.style = {}; this.dataset = {};
        const el = this; const names = () => String(el.attrs.class || '').split(/\s+/).filter(Boolean);
        this.classList = new Proxy({}, { get: (_, k) => k === 'contains' ? c => names().includes(c) : k === 'length' ? names().length : /^\d+$/.test(String(k)) ? names()[k] : k === 'add' ? c => { if (!names().includes(c)) el.attrs.class = [...names(), c].join(' '); } : k === 'remove' ? c => { el.attrs.class = names().filter(n => n !== c).join(' '); } : undefined });
    }
    get id() { return this.attrs.id || ''; }
    get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = String(v); }
    get firstElementChild() { return this.children[0] || null; }
    get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === this.ownerDocument.documentElement; }
    set textContent(v) { this.children = []; }
    all() { const out = []; const walk = e => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
    append(...nodes) { for (const n of nodes) { n.remove(); n.parentElement = this; this.children.push(n); } return nodes[0]; }
    after(n) { const p = this.parentElement; n.remove(); n.parentElement = p; p.children.splice(p.children.indexOf(this) + 1, 0, n); }
    remove() { const p = this.parentElement; if (p) p.children.splice(p.children.indexOf(this), 1); this.parentElement = null; }
    matches(sel) { asked.matches.push([this, sel]); return listMatch(this, sel); }
    closest(sel) { asked.closest.push([this, sel]); for (let n = this; n; n = n.parentElement) if (listMatch(n, sel)) return n; return null; }
    querySelectorAll(sel) { asked.query.push([this, sel]); return this.all().filter(e => listMatch(e, sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    getElementsByTagName(tag) { return this.all().filter(e => tag === '*' || e.localName === tag); }
    contains(n) { for (; n; n = n.parentElement) if (n === this) return true; return false; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; } hasAttribute(k) { return k in this.attrs; }
    addEventListener() {} removeEventListener() {}
}
const h = (doc, tag, attrs = {}, kids = []) => { const el = new El(doc, tag, attrs); for (const k of kids) el.append(k); return el; };
function fakeHost() {
    const frames = new Map(), timers = new Map(), observers = []; let next = 1;
    const host = {
        requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setInterval(fn) { const id = next++; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node) { this.node ??= node; } disconnect() { this.node = null; } },
    };
    const settle = () => { for (let i = 0; frames.size && i < 8; i++) { const b = [...frames.values()]; frames.clear(); b.forEach(fn => fn()); } };
    return { host, frames, observers, settle };
}

// 6f4045fc 의 판정 그대로(견줄 기준)
function legacyChanged(records, roots, panels = '') {
    const withoutHas = sel => { let out = ''; let i = 0; while (i < sel.length) { if (sel.startsWith(':has(', i)) { let d = 0, j = i + 4; for (; j < sel.length; j++) { if (sel[j] === '(') d++; else if (sel[j] === ')' && --d === 0) break; } i = j + 1; continue; } out += sel[i++]; } return out; };
    const pre = roots.includes(':has(') ? withoutHas(roots) : null;
    const hit = (node, sel) => node.matches?.(sel) || !!node.querySelector?.(sel);
    const contains = node => node?.nodeType === 1 && !node.matches?.('.bl-ft-shortcut') && (pre ? hit(node, pre) && hit(node, roots) : hit(node, roots));
    return records.some(record => { const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement; if (target?.closest?.('.bl-ft-shortcut')) return false; if (panels && target?.closest?.(panels)) return true; return [...record.addedNodes || [], ...record.removedNodes || []].some(contains); });
}
const { FRUIT_TYPES, typeMatch } = await imp('src/fruit-type-schema.js');
const ROOTS = FRUIT_TYPES.map(typeMatch).join(','), QG = FRUIT_TYPES.filter(t => t.owner === 'qingguo').map(typeMatch).join(',');
const SHORTCUT_WATCH = QG + ',iframe,#chat,#fruit-heart-v6,#bl-deus-popover', PANELS = '#fruit-heart-v6,#bl-deus-popover';
// 지어낸 채팅: 보통 메시지(단추 줄 · 문단) 사이에 과일 · 데우스 · 청과 상태창 꼴과 iframe · 바로가기 단추 · 꼴이 덜 갖춰진 것(:has 가 안 맞음)
function sampleChat(doc) {
    const mes = kids => h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'mes_buttons' }, [h(doc, 'div', { class: 'mes_button fa-solid fa-pen' }), h(doc, 'div', { class: 'mes_button' })]), h(doc, 'div', { class: 'mes_text' }, [h(doc, 'p'), ...kids])]);
    const chat = h(doc, 'div', { id: 'chat' }, [
        mes([]), mes([h(doc, 'span', { class: 'quote' })]),
        mes([h(doc, 'div', { class: 'fate-status-wrapper' }, [h(doc, 'div', { class: 'fate-top-grid' })])]),
        mes([h(doc, 'div', { class: 'custom-dem-status' }, [h(doc, 'span', { class: 'custom-dem-card__title' })])]),
        mes([h(doc, 'div', { class: 'forum-container' }, [h(doc, 'i', { class: 'live-indicator' }), h(doc, 'b', { class: 'subject-info' })])]),
        mes([h(doc, 'div', { class: 'forum-container' }, [h(doc, 'i', { class: 'live-indicator' })])]),
        mes([h(doc, 'div', { class: 'mbox' }, [h(doc, 'div', { class: 'm-head' }, [h(doc, 'span', { class: 'm-title' })]), h(doc, 'div', { class: 'm-scroll' })])]),
        mes([h(doc, 'div', { class: 'mbox' }, [h(doc, 'span', { class: 'm-title' }), h(doc, 'div', { class: 'm-scroll' })])]),
        mes([h(doc, 'div', { id: 'statusBar', class: 'dynamic-status-container' })]), mes([h(doc, 'div', { id: 'statusBar' })]),
        mes([h(doc, 'iframe')]), mes([h(doc, 'button', { class: 'bl-ft-shortcut' })]), mes([h(doc, 'div', { class: 'custom-rumor-board' }), h(doc, 'button', { class: 'bl-ft-shortcut' })]),
        mes([h(doc, 'div', { class: 'dem-track-recovery' })]), mes([h(doc, 'div', { class: 'dem-tracker' }, [h(doc, 'div', { class: 'dem-card__body' })])]),
    ]);
    const panel = h(doc, 'div', { id: 'fruit-heart-v6' }, [h(doc, 'div', { class: 'fh-item' }, [h(doc, 'span', { 'data-chip': 'x' })])]);
    doc.body.append(chat, panel, h(doc, 'div', { class: 'drawer-content' }, [h(doc, 'select')]));
    return chat;
}

await test('상태창 판정: 예전 코드와 기록 묶음마다 같은 답(과일 · 데우스 · 청과 :has 꼴 · iframe · 바로가기 단추 · 떨어진 노드 · quirks 문서)', async () => {
    const { fruitStructureChanged } = await imp('src/fruit-type-mutations.js');
    for (const mode of ['CSS1Compat', 'BackCompat']) {
        const doc = new Doc(mode); sampleChat(doc);
        const nodes = doc.documentElement.all(); let checked = 0, yes = 0;
        for (const [sel, panels] of [[ROOTS + ',iframe', ''], ['iframe', ''], [ROOTS, ''], [SHORTCUT_WATCH, PANELS]]) {
            const single = nodes.flatMap(n => [{ type: 'childList', target: n.parentElement, addedNodes: [n], removedNodes: [] }, { type: 'childList', target: n.parentElement, addedNodes: [], removedNodes: [n] }, { type: 'childList', target: n, addedNodes: [], removedNodes: [] }]);
            for (const r of single) { const want = legacyChanged([r], sel, panels); assert.equal(fruitStructureChanged([r], sel, panels), want, `${mode} ${sel.slice(0, 30)} · ${r.target?.localName}.${r.target?.attrs.class || ''} → ${(r.addedNodes[0] || r.removedNodes[0])?.attrs?.class || ''}`); checked++; if (want) yes++; }
            // 같은 부모에 몰린 묶음(앞 기록의 답을 외워 둬도 뒤 기록의 답이 같아요)
            for (let i = 0; i < single.length; i += 7) { const batch = single.slice(i, i + 23); assert.equal(fruitStructureChanged(batch, sel, panels), legacyChanged(batch, sel, panels)); checked++; }
        }
        assert.ok(checked > 1000 && yes > 50, `견준 수 ${checked} · 참 ${yes}`);
    }
});
await test('상태창 판정: 뿌리 class · id · 태그가 없는 요소는 긴 선택자로 matches 하지 않고, 자식이 없으면 querySelector 도 안 해요 · 뿌리 꼴 요소 · quirks · [속성] 선택자는 예전처럼 맞춰 봐요', async () => {
    const { fruitStructureChanged } = await imp('src/fruit-type-mutations.js');
    const doc = new Doc(); const chat = sampleChat(doc);
    const buttons = chat.all().filter(e => e.classList.contains('mes_button'));
    resetAsked();
    assert.equal(fruitStructureChanged(buttons.map(b => ({ type: 'childList', target: b.parentElement, addedNodes: [b], removedNodes: [] })), ROOTS + ',iframe'), false);
    assert.equal(asked.matches.filter(([, s]) => s.length > 100).length, 0, `단추마다 긴 선택자 matches ${asked.matches.filter(([, s]) => s.length > 100).length}번`);
    assert.equal(asked.query.length, 0, `자식 없는 단추 아래를 훑음 ${asked.query.length}번`);
    const wrapper = chat.all().find(e => e.classList.contains('fate-status-wrapper'));
    resetAsked(); assert.equal(fruitStructureChanged([{ type: 'childList', target: wrapper.parentElement, addedNodes: [wrapper], removedNodes: [] }], ROOTS + ',iframe'), true);
    assert.ok(asked.matches.some(([n, s]) => n === wrapper && s.length > 100), '뿌리 꼴 요소는 맞춰 봐요');
    const quirks = new Doc('BackCompat'); const qb = sampleChat(quirks).all().find(e => e.classList.contains('mes_button'));
    resetAsked(); fruitStructureChanged([{ type: 'childList', target: qb.parentElement, addedNodes: [qb], removedNodes: [] }], ROOTS + ',iframe');
    assert.ok(asked.matches.some(([, s]) => s.length > 100), 'quirks 문서는 예전처럼 다 맞춰 봐요');
    resetAsked(); fruitStructureChanged([{ type: 'childList', target: buttons[0].parentElement, addedNodes: [buttons[0]], removedNodes: [] }], '.mes_button:not(.x)');
    resetAsked(); assert.equal(fruitStructureChanged([{ type: 'childList', target: buttons[0].parentElement, addedNodes: [buttons[0]], removedNodes: [] }], ':not(.fh-item)'), true, '열쇠가 없는 꼴(:not 만)은 matches 로 맞춰 봐요');
});
await test('상태창 판정: 같은 부모에 몰린 기록 수백 개는 조상 거슬러 오르기를 부모마다 한 번만 · removed=false 면 떨어진 노드를 안 봐요', async () => {
    const { fruitStructureChanged } = await imp('src/fruit-type-mutations.js');
    const doc = new Doc(); const chat = sampleChat(doc); const row = chat.all().find(e => e.classList.contains('mes_buttons'));
    const records = Array.from({ length: 300 }, () => ({ type: 'childList', target: row, addedNodes: [h(doc, 'div', { class: 'mes_button' })], removedNodes: [] }));
    resetAsked(); assert.equal(fruitStructureChanged(records, SHORTCUT_WATCH, PANELS), false);
    assert.ok(asked.closest.length <= 2, `조상 거슬러 오르기 ${asked.closest.length}번(부모 하나)`);
    const gone = chat.children[2]; gone.remove();
    resetAsked(); assert.equal(fruitStructureChanged([{ type: 'childList', target: chat, addedNodes: [], removedNodes: [gone] }], ROOTS + ',iframe', '', false), false);
    assert.equal(asked.query.length + asked.matches.filter(([, s]) => s.length > 100).length, 0, '떨어진 메시지를 훑음');
    assert.equal(fruitStructureChanged([{ type: 'childList', target: chat, addedNodes: [], removedNodes: [gone] }], ROOTS + ',iframe'), true, '기본은 예전처럼 떨어진 노드도 봐요');
});
await test('글자 설정: 채팅을 바꾸며 메시지가 떨어지면 그 아래를 뿌리 선택자로 훑지 않아요 — 마지막 상태창이 빠지거나 지켜보던 iframe 이 빠지면 다시 봐요', async () => {
    const { watchFruitTypography } = await imp('src/fruit-type-runtime.js');
    const doc = new Doc(), H = fakeHost(); const chat = h(doc, 'div', { id: 'chat' }); doc.body.append(chat);
    const plain = () => h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'mes_text' }, [h(doc, 'p'), h(doc, 'p')]), h(doc, 'div', { class: 'mes_buttons' }, [h(doc, 'div', { class: 'mes_button' })])]);
    const status = h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'mes_text' }, [h(doc, 'div', { class: 'fate-status-wrapper' })])]);
    const framed = h(doc, 'div', { class: 'mes' }, [h(doc, 'iframe')]);
    const many = Array.from({ length: 40 }, plain); chat.append(...many, status, framed);
    const config = { on: true, ownerOn: { fruit: true }, types: { status: { layout: 'vertical' } } };
    const stop = watchFruitTypography(doc, H.host, () => config, () => ''); H.settle();
    const watcher = H.observers.find(o => o.node === chat); assert.ok(watcher, '채팅 감시');
    assert.ok(doc.head.children.some(s => 'blFruitTypography' in s.dataset), '상태창이 있으면 글자 style 을 붙여요');
    for (const m of many) m.remove();
    resetAsked(); watcher.fn([{ type: 'childList', target: chat, addedNodes: [], removedNodes: many }]);
    const intoRemoved = asked.query.filter(([n]) => many.some(m => m === n || m.contains(n))).length + asked.matches.filter(([n, s]) => s.length > 100 && many.some(m => m.contains(n))).length;
    assert.equal(intoRemoved, 0, `떨어진 메시지 아래를 ${intoRemoved}번 훑음`);
    assert.equal(H.frames.size, 0, '상태창이 남아 있으면 다시 볼 일이 없어요');
    status.remove(); watcher.fn([{ type: 'childList', target: chat, addedNodes: [], removedNodes: [status] }]);
    assert.equal(H.frames.size, 1, '마지막 상태창이 빠졌는데 다시 안 봄'); H.settle();
    assert.ok(!doc.head.children.some(s => 'blFruitTypography' in s.dataset), '상태창이 없으면 글자 style 을 떼요(예전과 같음)');
    framed.remove(); watcher.fn([{ type: 'childList', target: chat, addedNodes: [], removedNodes: [framed] }]);
    assert.equal(H.frames.size, 1, '지켜보던 iframe 이 빠졌는데 다시 안 봄'); H.settle();
    const back = h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'fate-status-wrapper' })]); chat.append(back);
    watcher.fn([{ type: 'childList', target: chat, addedNodes: [back], removedNodes: [] }]);
    assert.equal(H.frames.size, 1, '상태창이 붙으면 예전처럼 다시 봐요'); H.settle();
    stop();
});
await test('바로가기: 떨어진 메시지 아래를 훑지 않고, 단추를 단 청과 카드가 빠지면 다시 봐요 · 같은 부모 기록은 서랍 · 본문 확인을 한 번만', async () => {
    const { installFruitTypeShortcuts } = await imp('src/fruit-type-shortcuts.js');
    const doc = new Doc(), H = fakeHost(); const chat = h(doc, 'div', { id: 'chat' }); doc.body.append(chat);
    const card = h(doc, 'div', { class: 'custom-rumor-board' }); const holder = h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'mes_text' }, [card])]);
    const many = Array.from({ length: 30 }, () => h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'mes_text' }, [h(doc, 'p')]), h(doc, 'div', { class: 'mes_buttons' }, [h(doc, 'div', { class: 'mes_button' })])]));
    chat.append(...many, holder);
    const stop = installFruitTypeShortcuts(doc, H.host); H.settle();
    const button = card.parentElement.children.find(e => e.classList.contains('bl-ft-shortcut')); assert.ok(button, '청과 카드 옆 단추');
    const watcher = H.observers.find(o => o.node === doc.documentElement); assert.ok(watcher);
    for (const m of many) m.remove();
    resetAsked(); watcher.fn([{ type: 'childList', target: chat, addedNodes: [], removedNodes: many }]);
    const intoRemoved = asked.query.filter(([n]) => many.some(m => m === n || m.contains(n))).length;
    assert.equal(intoRemoved, 0, `떨어진 메시지 아래를 ${intoRemoved}번 훑음`); assert.equal(H.frames.size, 0);
    const row = h(doc, 'div', { class: 'extraMesButtons' }); holder.append(row);
    resetAsked(); watcher.fn(Array.from({ length: 200 }, () => ({ type: 'childList', target: row, addedNodes: [h(doc, 'div', { class: 'mes_button' })], removedNodes: [] })));
    assert.ok(asked.closest.filter(([n, s]) => n === row && s === '.drawer-content,select').length === 1, `서랍 확인 ${asked.closest.filter(([n, s]) => n === row && s === '.drawer-content,select').length}번`);
    assert.equal(H.frames.size, 0);
    card.remove(); watcher.fn([{ type: 'childList', target: card.parentElement || holder, addedNodes: [], removedNodes: [card] }]);
    assert.equal(H.frames.size, 1, '단추를 단 카드가 빠졌는데 다시 안 봄'); H.settle();
    assert.ok(!button.isConnected, '남은 단추를 떼요(예전과 같음)');
    stop();
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/fruit-watch-records\.mjs \./);
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
