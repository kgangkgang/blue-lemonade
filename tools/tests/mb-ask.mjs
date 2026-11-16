// 1.6.1 미트볼의 「묻지 않고 바로 지우는」 단추에 테마 확인 창 덧대기(src/mb-ask.js)
//   ① 표의 단추만 잡아요(그 확장 화면 안 · 스스로 묻는 단추 · 되돌릴 수 있는 한 줄 지우기는 아님) ② 누름을 멈추고 묻고, 「지우기」 면 같은 단추를 한 번 다시 눌러요
//   ③ 취소면 아무 일도 없어요 ④ 「원작 그대로 보기」 · 테마 꺼짐 · 확인 창이 없는 환경이면 안 막아요 ⑤ 화면이 다시 그려졌으면 같은 단추를 새 화면에서 찾아요 ⑥ 그 확장 요소에 아무것도 안 써요
//   node tools/tests/mb-ask.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// ── 작은 가짜 문서: 요소 · 후손 선택자(태그 · .클래스 · [속성] · [속성="값"]) · 잡는 단계 누름 ─────────────
let writes = 0;
const one = (el, part) => {
    const m = /^([\w-]+)?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/.exec(part); assert.ok(m, part);
    if (m[1] && el.tag !== m[1]) return false;
    for (const c of m[2].split('.').filter(Boolean)) if (!el.cls.includes(c)) return false;
    for (const a of m[3].match(/\[[^\]]+\]/g) || []) { const [, k, , v] = /^\[([\w-]+)(="([^"]*)")?\]$/.exec(a); if (!(k in el.attrs) || (v !== undefined && el.attrs[k] !== v)) return false; }
    return true;
};
const matchSel = (el, sel) => {
    const parts = sel.trim().split(/\s+/); let at = el;
    if (!one(at, parts.pop())) return false;
    while (parts.length) { const want = parts.pop(); at = at.parent; while (at && !one(at, want)) at = at.parent; if (!at) return false; }
    return true;
};
class El {
    constructor(doc, tag, cls = '', attrs = {}) { this.ownerDocument = doc; this.tag = tag; this.cls = cls.split(' ').filter(Boolean); this.attrs = attrs; this.kids = []; this.parent = null; this.clicks = 0; }
    add(...kids) { for (const k of kids) { k.parent = this; this.kids.push(k); } return this; }
    get isConnected() { let at = this; while (at.parent) at = at.parent; return at === this.ownerDocument.body; }
    matches(list) { return list.split(',').some(s => matchSel(this, s)); }
    closest(list) { for (let at = this; at; at = at.parent) if (at.matches(list)) return at; return null; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    hasAttribute(k) { return k in this.attrs; }
    setAttribute() { writes++; } removeAttribute() { writes++; }
    get classList() { return { contains: c => this.cls.includes(c) }; }
    click() { this.ownerDocument.fire(this); }
}
const makeDoc = ({ salty = true, raw = false } = {}) => {
    const doc = { listeners: [], reached: [] };
    doc.body = new El(doc, 'body', salty ? 'salty' : '', raw ? { 'data-bl-ext-raw': '' } : {});
    doc.addEventListener = (type, fn, capture) => { assert.equal(type, 'click'); assert.equal(capture, true); doc.listeners.push(fn); };
    doc.createElement = tag => { const el = new El(doc, tag); el.append = (...k) => el.add(...k.filter(x => x instanceof El)); return el; };
    doc.querySelectorAll = list => { const out = []; const walk = el => { for (const c of el.kids) { if (c.matches(list)) out.push(c); walk(c); } }; walk(doc.body); return out; };
    // 잡는 단계 듣는 곳이 멈추지 않았으면 그 확장의 처리까지 간 것으로 세요
    doc.fire = target => { let stopped = false, prevented = false; const ev = { target, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } }; for (const fn of doc.listeners) { if (stopped) break; fn(ev); } if (!stopped) { target.clicks++; doc.reached.push(target); } return { stopped, prevented }; };
    return doc;
};
const inbox = doc => { const btn = new El(doc, 'button', 'ss-btn sm ghost', { 'data-clear': '1' }); const icon = new El(doc, 'i', 'fa-solid'); btn.add(icon); doc.body.add(new El(doc, 'dialog', 'popup ss-dlg').add(new El(doc, 'div', 'ss-root ss-scope ss-inbox').add(btn))); return { btn, icon }; };
const tick = () => new Promise(r => setTimeout(r, 0));
const fresh = async () => import(pathToFileURL(path.join(root, 'src/mb-ask.js')).href + `?t=${Math.random()}`);   // 모듈마다 한 번만 시작하니 시험마다 새로 받아요

await ok('① 표: 그 확장이 스스로 묻지 않는 단추만 — 화면 밖 같은 속성 · 한 줄 지우기 · 스스로 묻는 단추는 안 잡아요', async () => {
    const m = await fresh(); const doc = makeDoc();
    const { btn, icon } = inbox(doc);
    assert.equal(m.askTarget(icon, doc).el, btn);                       // 단추 안 아이콘을 눌러도 단추
    const panel = new El(doc, 'div', 'ss-panel ss-scope'); doc.body.add(panel);
    const mk = (attrs, wrap) => { const b = new El(doc, 'button', 'ss-ib', attrs); (wrap || panel).add(b); return b; };
    const story = new El(doc, 'div', 'ss-story'); panel.add(story);
    assert.ok(m.askTarget(mk({ 'data-act': 'cmsgre', 'data-arg': 'm1' }), doc));
    for (const st of ['secdel', 'memdel', 'maildel']) assert.ok(m.askTarget(mk({ 'data-st': st, 'data-arg': 'x' }, story), doc), st);
    for (const act of ['ndel', 'gdel', 'brdel', 'delevent', 'memodel', 'cmsgdel', 'reset', 'wipemod', 'regen', 'rollclear']) assert.equal(m.askTarget(mk({ 'data-act': act }), doc), null, act);
    for (const st of ['debtclear', 'susclear', 'secgen', 'scan']) assert.equal(m.askTarget(mk({ 'data-st': st }, story), doc), null, st);
    const outside = new El(doc, 'button', '', { 'data-act': 'cmsgre' }); doc.body.add(new El(doc, 'div', 'other-ext').add(outside));
    assert.equal(m.askTarget(outside, doc), null);                      // 같은 속성을 쓰는 다른 화면
    const src = fs.readFileSync(path.join(root, 'src/mb-ask.js'), 'utf8');
    assert.ok(!/MutationObserver|setInterval|setTimeout|extension_settings|chat_metadata/.test(src));   // 감시자 · 타이머 · 그 확장 자료에 손대지 않아요
});

await ok('② 누름을 멈추고 묻고, 확인하면 같은 단추를 딱 한 번 다시 눌러요(창 글 · 단추 글도)', async () => {
    const m = await fresh(); const doc = makeDoc(); const { btn, icon } = inbox(doc);
    const asked = []; let answer;
    m.startMbAsk(doc, { ask: (...a) => { asked.push(a.slice(0, 2).concat(a[3])); return new Promise(r => { answer = r; }); }, can: () => true });
    assert.equal(m.startMbAsk(doc), false);                             // 두 번 시작해도 듣는 곳은 하나
    assert.equal(doc.listeners.length, 1);
    const first = doc.fire(icon);
    assert.deepEqual(first, { stopped: true, prevented: true }); assert.equal(doc.reached.length, 0);
    await tick(); assert.deepEqual(asked, [['알림함을 모두 비울까요?', '이 채팅의 알림이 전부 지워져요. 되돌릴 수 없어요.', '지우기']]);
    assert.deepEqual(doc.fire(icon), { stopped: true, prevented: true }); await tick(); assert.equal(asked.length, 1);   // 창이 떠 있는 동안 겹친 누름은 버려요
    answer(true); await tick();
    assert.deepEqual(doc.reached, [btn]); assert.equal(btn.clicks, 1);
    doc.fire(btn); await tick(); assert.equal(asked.length, 2);          // 다음 누름은 다시 물어요(통과 표식이 남지 않아요)
    assert.equal(writes, 0);
});

await ok('③ 취소하면 아무 일도 없어요 · 「다시 받기」 는 단추 글이 「다시 받기」', async () => {
    const m = await fresh(); const doc = makeDoc();
    const re = new El(doc, 'button', 'ss-ib', { 'data-act': 'cmsgre', 'data-arg': 'm7' }); doc.body.add(new El(doc, 'div', 'ss-panel ss-scope').add(re));
    const asked = [];
    m.startMbAsk(doc, { ask: async (...a) => { asked.push(a[3]); return false; }, can: () => true });
    doc.fire(re); await tick();
    assert.deepEqual(asked, ['다시 받기']); assert.equal(doc.reached.length, 0); assert.equal(re.clicks, 0);
});

await ok('④ 「원작 그대로 보기」 · 테마 꺼짐 · 확인 창이 없는 환경이면 안 막아요(원래대로 바로)', async () => {
    for (const [opt, can] of [[{ raw: true }, true], [{ salty: false }, true], [{}, false]]) {
        const m = await fresh(); const doc = makeDoc(opt); const { btn } = inbox(doc); let asks = 0;
        m.startMbAsk(doc, { ask: async () => { asks++; return true; }, can: () => can });
        assert.deepEqual(doc.fire(btn), { stopped: false, prevented: false }); await tick();
        assert.equal(asks, 0); assert.equal(btn.clicks, 1);
    }
    const m = await fresh(); const doc = makeDoc(); const { btn } = inbox(doc);   // 묻는 사이 「원작 그대로 보기」 를 켰으면 다시 누르지 않아요
    m.startMbAsk(doc, { ask: async () => { doc.body.attrs['data-bl-ext-raw'] = ''; return true; }, can: () => true });
    doc.fire(btn); await tick(); assert.equal(btn.clicks, 0);
});

await ok('⑤ 묻는 사이 화면이 다시 그려졌으면 같은 값의 단추를 새 화면에서 찾아 눌러요 · 없으면 아무것도 안 해요', async () => {
    const m = await fresh(); const doc = makeDoc();
    const panel = new El(doc, 'div', 'ss-panel ss-scope'); doc.body.add(panel);
    const story = new El(doc, 'div', 'ss-story'); panel.add(story);
    const old = new El(doc, 'button', 'ss-btn', { 'data-st': 'secdel', 'data-arg': '가' }); story.add(old);
    let answer; m.startMbAsk(doc, { ask: () => new Promise(r => { answer = r; }), can: () => true });
    doc.fire(old); await tick();
    story.kids = []; old.parent = null;                                  // 그 확장이 다시 그림
    const other = new El(doc, 'button', 'ss-btn', { 'data-st': 'secdel', 'data-arg': '나' }), again = new El(doc, 'button', 'ss-btn', { 'data-st': 'secdel', 'data-arg': '가' });
    story.add(other, again);
    answer(true); await tick();
    assert.deepEqual(doc.reached, [again]); assert.equal(other.clicks, 0);
    assert.equal(m.sameButton(doc, Object.assign(new El(doc, 'button', '', { 'data-st': 'memdel', 'data-arg': '다' }), { parent: null })), null);
});

await ok('⑥ 미트볼 문에서만 받아요(index.js) · 공개 시험 목록에 있어요', () => {
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    const gate = index.split('\n').find(line => line.includes("import('./src/mb-ask.js')"));
    assert.ok(gate && gate.includes("document.getElementById('ss-settings')") && gate.indexOf("getElementById('ss-settings')") < gate.indexOf('mb-ask.js'));
    assert.ok(!/from '\.\/src\/mb-ask\.js'/.test(index));               // 정적으로 싣지 않아요(없는 사람은 한 바이트도 안 받아요)
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/mb-ask.mjs .'));
});
console.log(`mb-ask: ${n}개 통과`);
