// 입력 중 목록 갱신 미루기 (src/persona-defer.js) — 페르소나 설명 칸의 실리태번 input 핸들러(onPersonaDescriptionInput)만 미루고 떠날 때 바로 돌린다
//   node tools/tests/persona-defer.mjs <테마 루트>
// 가짜 DOM · 가짜 jQuery(_data 의 handleObj) · 가짜 타이머로 본다:
//   미루기(연속 입력 = 0번 → 멈춘 뒤 1번) · 즉시 실행 경로(포커스 잃음 · 서랍 닫힘 · 다른 페르소나 고르기 클릭 · 창 닫힘 · beforeunload 와 pagehide · 화면 가려짐 · 생성 시작)
//   · 조합 중에는 타이머로 끼지 않음 · 미룬 사이 페르소나가 바뀌면 타이머 실행은 버림 · 다른 input 리스너는 그대로 · 핸들러가 없거나 모양이 다르면 아무것도 안 걸고 한 줄만 · 끄면 원래 핸들러로.
// 연결: features.js(chat.personaDefer · 기본 켬) · settings.js 기본값 · 보정 · 동작 값 목록(styles.js 도) · 설정 줄 · 라벨 · 검색.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const M = await import(pathToFileURL(path.join(root, 'src/persona-defer.js')).href);

// ---------------------------------------------------------------- 가짜 DOM
class Target {
    constructor(id) { this.id = id; this.l = new Map(); this.parent = null; this.classes = new Set(); const self = this; this.classList = { contains: c => self.classes.has(c), add: c => { self.classes.add(c); mutate(self); }, remove: c => { self.classes.delete(c); mutate(self); } }; }
    addEventListener(type, fn, opts) { const capture = opts === true || !!opts?.capture; const k = `${type}|${capture}`; if (!this.l.has(k)) this.l.set(k, []); this.l.get(k).push(fn); }
    removeEventListener(type, fn, opts) { const capture = opts === true || !!opts?.capture; const a = this.l.get(`${type}|${capture}`); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    contains(t) { for (let n = t; n; n = n.parent) if (n === this) return true; return false; }
}
const observers = [];
function mutate(el) { for (const o of observers) if (o.live && o.target === el) o.cb([{ type: 'attributes', attributeName: 'class' }]); }
class FakeMO { constructor(cb) { this.cb = cb; this.live = true; observers.push(this); } observe(el, opts) { this.target = el; this.opts = opts; } disconnect() { this.live = false; } }
/** 캡처(문서 → 대상) · 대상 · 버블(대상 → 문서) 순서로 — bubbles 가 아니면 버블 없음(캡처는 지남) */
function dispatch(target, type, init = {}) {
    const ev = { type, target, bubbles: init.bubbles !== false, key: init.key, isComposing: !!init.isComposing, stopped: false };
    const pathUp = []; for (let n = target; n; n = n.parent) pathUp.push(n);
    const call = (node, capture) => { for (const fn of [...(node.l.get(`${type}|${capture}`) || [])]) fn.call(node, ev); };
    for (const n of pathUp.slice().reverse()) if (n !== target) call(n, true);
    call(target, true); call(target, false);
    if (ev.bubbles) for (const n of pathUp.slice(1)) call(n, false);
    return ev;
}
function makeWorld({ withHandler = true, handlerName = 'onPersonaDescriptionInput', withJQuery = true } = {}) {
    const win = new Target('window');
    const doc = new Target('document'); doc.parent = null; doc.visibilityState = 'visible';
    const body = new Target('body'); body.parent = doc;
    const drawer = new Target('persona-management-block'); drawer.parent = body; drawer.classes.add('openDrawer');
    const field = new Target('persona_description'); field.parent = drawer; field.value = '';
    const avatar = new Target('avatar-other'); avatar.parent = drawer;
    const dialog = new Target('dialog'); dialog.parent = body;
    const ids = { persona_description: field, 'persona-management-block': drawer };
    doc.getElementById = id => ids[id] || null;
    const calls = [];   // 실리태번 핸들러가 본 값
    const st = { user_avatar: 'a.png', saved: {} };
    const named = { [handlerName]: function () { calls.push(field.value); st.saved[st.user_avatar] = field.value; } }[handlerName];
    named.guid = 7;
    const events = { input: [] };
    if (withHandler) events.input.push({ type: 'input', origType: 'input', handler: named, guid: 7, selector: undefined, namespace: '' });
    const other = []; events.input.push({ type: 'input', origType: 'input', handler: function other1() { other.push(field.value); }, guid: 8, selector: undefined, namespace: '' });
    const $ = withJQuery ? { _data: (el, key) => (el === field && key === 'events' ? events : undefined) } : undefined;
    // jQuery 가 하는 일 흉내: 칸의 input 버블 리스너 하나가 events.input 의 handler 를 차례로 부른다(handleObj.handler 를 그때그때 읽는다)
    field.addEventListener('input', function (e) { for (const h of [...events.input]) h.handler.call(field, { originalEvent: e, type: 'input' }); });
    const timers = new Map(); let tid = 0, now = 0;
    const setTimer = (fn, ms) => { const id = ++tid; timers.set(id, { fn, at: now + ms }); return id; };
    const clearTimer = id => { timers.delete(id); };
    const advance = ms => { const end = now + ms; for (;;) { const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > end) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); } now = end; };
    const listeners = new Map();
    const eventSource = { on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); }, removeListener(ev, fn) { const a = listeners.get(ev) || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }, emit(ev) { for (const fn of [...(listeners.get(ev) || [])]) fn(); } };
    const logs = [];
    const type = (text, opts = {}) => { for (const ch of text) { field.value += ch; dispatch(field, 'input', opts); advance(opts.gap ?? 120); } };
    const install = (extra = {}) => M.installPersonaDefer({ $, document: doc, window: win, MutationObserver: FakeMO, eventSource, eventTypes: { GENERATION_STARTED: 'generation_started' }, owner: () => st.user_avatar, setTimer, clearTimer, log: (...a) => logs.push(a.join(' ')), ...extra });
    return { win, doc, body, drawer, field, avatar, dialog, calls, other, st, events, named, advance, type, install, eventSource, logs, timers };
}

let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.stack || e.message}`); } };

test('미루기: 120ms 사이로 50자를 치는 동안 실리태번 핸들러는 0번 · 마지막 글자 뒤 DELAY 에 한 번(마지막 값) · 다른 input 리스너는 글자마다 그대로', () => {
    const w = makeWorld(); const r = w.install(); assert.equal(r.ok, true);
    const text = '지어낸 설명을 이어 써 봐요. 바닷가 마을에서 자란 지도 제작자예요. 비 오는 날을 좋아해요. 1234'.slice(0, 50);
    w.type(text);
    assert.equal(w.calls.length, 0, '치는 동안은 미룬다');
    assert.equal(w.other.length, 50, '다른 리스너는 글자마다');
    w.advance(M.DELAY);
    assert.deepEqual(w.calls, [text], '멈춘 뒤 한 번 · 마지막 값');
    assert.equal(w.st.saved['a.png'], text);
    w.advance(5000); assert.equal(w.calls.length, 1, '더 돌지 않는다');
    assert.equal(M.DELAY >= 250 && M.DELAY <= 400, true, 'DELAY 250~400ms');
});
test('천천히 치면(DELAY 보다 긴 쉼) 쉼마다 한 번씩 — 미룬 값이 쌓이지 않는다', () => {
    const w = makeWorld(); w.install();
    w.type('가나', { gap: M.DELAY + 50 });
    assert.deepEqual(w.calls, ['가', '가나']);
});
test('즉시 실행 ① 칸이 포커스를 잃으면(blur) 기다리지 않고 바로', () => {
    const w = makeWorld(); w.install(); w.type('abc', { gap: 50 });
    assert.equal(w.calls.length, 0); dispatch(w.field, 'blur', { bubbles: false });
    assert.deepEqual(w.calls, ['abc']); w.advance(2000); assert.equal(w.calls.length, 1, '타이머가 다시 돌지 않는다');
});
test('즉시 실행 ② 서랍이 닫히면(openDrawer 가 빠짐 — 바깥 누름 · 코드로 닫아도)', () => {
    const w = makeWorld(); w.install(); w.type('abc', { gap: 50 });
    w.drawer.classList.remove('openDrawer');
    assert.deepEqual(w.calls, ['abc']);
    const mo = observers.filter(o => o.live && o.target === w.drawer).at(-1); assert.deepEqual(mo.opts, { attributes: true, attributeFilter: ['class'] }, '서랍 class 만 본다(subtree 없음)');
});
test('즉시 실행 ③ 다른 페르소나를 누르면 — 캡처 단계라 실리태번의 고르기 처리보다 먼저 옛 페르소나에 저장', () => {
    const w = makeWorld(); w.install(); w.type('옛 설명', { gap: 50 });
    // 실리태번의 고르기 처리(버블 · 문서 위임): 페르소나를 바꾸고 칸 글을 새 페르소나 것으로
    w.doc.addEventListener('click', () => { w.st.user_avatar = 'b.png'; w.field.value = '새 페르소나 설명'; });
    dispatch(w.avatar, 'click');
    assert.equal(w.st.saved['a.png'], '옛 설명', '옛 페르소나에 마지막 글까지');
    assert.equal(w.st.saved['b.png'], undefined, '새 페르소나에 옛 글을 쓰지 않는다');
    w.advance(2000); assert.equal(w.calls.length, 1);
});
test('즉시 실행 ④ 창(dialog)이 닫히면 · Esc 를 누르면', () => {
    const w = makeWorld(); w.install(); w.type('창', { gap: 50 });
    dispatch(w.dialog, 'close', { bubbles: false });
    assert.deepEqual(w.calls, ['창']);
    w.type('창2', { gap: 50 }); dispatch(w.field, 'keydown', { key: 'Escape' });
    assert.equal(w.calls.at(-1), '창창2');
    w.type('x', { gap: 50 }); dispatch(w.field, 'keydown', { key: 'y' }); assert.equal(w.calls.at(-1), '창창2', '칸 안의 보통 키는 미룬 채로');
});
test('즉시 실행 ⑤ 페이지를 떠날 때(beforeunload · pagehide) · 화면이 가려질 때 · 생성 시작', () => {
    for (const how of ['beforeunload', 'pagehide', 'hidden', 'generate']) {
        const w = makeWorld(); w.install(); w.type('끝', { gap: 50 });
        if (how === 'hidden') { w.doc.visibilityState = 'hidden'; dispatch(w.doc, 'visibilitychange'); }
        else if (how === 'generate') w.eventSource.emit('generation_started');
        else dispatch(w.win, how);
        assert.deepEqual(w.calls, ['끝'], how);
    }
});
test('칸 안을 눌러(커서 옮기기) · 미룬 것이 없을 때는 돌리지 않는다', () => {
    const w = makeWorld(); w.install(); w.type('ab', { gap: 50 });
    dispatch(w.field, 'click'); assert.equal(w.calls.length, 0, '칸 안 클릭은 떠남이 아니다');
    w.advance(M.DELAY); assert.equal(w.calls.length, 1);
    dispatch(w.avatar, 'click'); dispatch(w.field, 'blur', { bubbles: false }); dispatch(w.win, 'beforeunload');
    assert.equal(w.calls.length, 1, '미룬 것이 없으면 아무것도');
});
test('한글 조합: compositionstart ~ end 사이에는 타이머로 끼지 않고, 끝난 뒤 DELAY 에 한 번', () => {
    const w = makeWorld(); w.install();
    dispatch(w.field, 'compositionstart');
    for (const step of ['ㅁ', '미', '미ㅇ', '미아', '미안']) { w.field.value = step; dispatch(w.field, 'input', { isComposing: true }); w.advance(M.DELAY * 3); }
    assert.equal(w.calls.length, 0, '조합 중에는 아무리 기다려도 돌지 않는다');
    assert.equal(w.timers.size, 0, '조합 중에는 타이머도 걸지 않는다');
    dispatch(w.field, 'compositionend');
    w.advance(M.DELAY - 1); assert.equal(w.calls.length, 0);
    w.advance(1); assert.deepEqual(w.calls, ['미안']);
});
test('한글 조합: 조합 중 isComposing 으로만 알려 와도(compositionstart 를 놓침) 끼지 않는다', () => {
    const w = makeWorld(); w.install();
    w.field.value = '해'; dispatch(w.field, 'input', { isComposing: true }); w.advance(M.DELAY * 2);
    assert.equal(w.calls.length, 0);
    dispatch(w.field, 'compositionend'); w.advance(M.DELAY); assert.deepEqual(w.calls, ['해']);
});
test('한글 조합: compositionend 가 오지 않아도(리그 CDP 확정) 조합이 끝난 input(isComposing:false)이 오면 그 뒤 DELAY 에 한 번', () => {
    const w = makeWorld(); w.install();
    dispatch(w.field, 'compositionstart');
    w.field.value = '미'; dispatch(w.field, 'input', { isComposing: true }); w.advance(M.DELAY * 3);
    assert.equal(w.calls.length, 0, '조합 중');
    w.field.value = '미안'; dispatch(w.field, 'input', { isComposing: false });
    w.advance(M.DELAY); assert.deepEqual(w.calls, ['미안']);
});
test('미룬 사이 다른 길로 페르소나가 바뀌면(칸 글이 이미 새 페르소나 것) 타이머 실행은 버린다', () => {
    const w = makeWorld(); w.install(); w.type('a', { gap: 50 });
    w.st.user_avatar = 'b.png'; w.field.value = 'B 설명';
    w.advance(M.DELAY); assert.equal(w.calls.length, 0); assert.equal(w.st.saved['b.png'], undefined);
});
test('핸들러가 없거나(실리태번 판이 바뀜) jQuery 가 없으면 아무것도 걸지 않고 한 줄만 · 칸의 input 은 그대로 흐른다', () => {
    for (const opts of [{ withHandler: false }, { handlerName: 'somethingElse' }, { withJQuery: false }]) {
        const w = makeWorld(opts); const before = [...w.doc.l.keys()].length;
        const r = w.install();
        assert.equal(r.ok, false, JSON.stringify(opts)); assert.equal(r.reason, 'no-handler');
        assert.equal(w.logs.length, 1); assert.match(w.logs[0], /쉬어요/);
        assert.equal([...w.doc.l.keys()].length, before, '문서에 리스너를 걸지 않는다');
        w.type('ab', { gap: 50 }); assert.equal(w.other.length, 2, '다른 리스너는 그대로');
        r.uninstall();
    }
    const none = M.installPersonaDefer({ document: { getElementById: () => null }, window: new Target('w') });
    assert.equal(none.ok, false); assert.equal(none.reason, 'no-field');
});
test('두 번 감싸지 않는다 · guid 를 옮겨 .off(핸들러) 가 맞는다 · 끄면 미룬 것을 돌리고 원래 핸들러 · 리스너를 되돌린다', () => {
    const w = makeWorld(); const r = w.install();
    const h = w.events.input[0];
    assert.notEqual(h.handler, w.named); assert.equal(h.handler.guid, w.named.guid);
    const again = w.install(); assert.equal(again.ok, false); assert.equal(again.reason, 'already');
    w.type('zz', { gap: 50 });
    r.uninstall();
    assert.deepEqual(w.calls, ['zz'], '끌 때 미룬 것을 바로');
    assert.equal(h.handler, w.named, '원래 핸들러로');
    w.type('q', { gap: 50 }); assert.equal(w.calls.at(-1), 'zzq', '끈 뒤에는 글자마다 원래대로');
    const leftovers = [...w.doc.l.values(), ...w.win.l.values()].reduce((a, v) => a + v.length, 0);
    assert.equal(leftovers, 0, '문서 · 창 리스너를 다 뗀다');
    assert.equal(observers.filter(o => o.live && o.target === w.drawer).length, 0);
});
test('소스: 입력칸 글 · 선택 · 포커스는 건드리지 않는다(value 쓰기 · setSelectionRange · focus 없음)', () => {
    const src = read('src/persona-defer.js').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.value\s*=(?!=)/.test(src)); assert.ok(!/setSelectionRange|\.select\(|\.focus\(/.test(src));
    assert.match(src, /'\.\.\/\.\.\/\.\.\/\.\.\/personas\.js'/, 'user_avatar 는 실리태번 personas.js 에서(src/ 기준 네 단계 위)');
});
test('연결: features.js · 설정 기본값 · 보정 · 동작 값 목록 · 설정 줄 · 라벨 · 검색', () => {
    assert.match(read('src/features.js'), /const personaDefer = on && s\.chat\?\.personaDefer !== false;\n\s*if \(personaDefer \|\| modules\.personadefer\) load\('personadefer', '\.\/persona-defer\.js'\)\.then\(m => m\?\.syncPersonaDefer\(personaDefer\)\);/);
    const settings = read('src/settings.js');
    assert.match(settings, /chatLight: true, personaDefer: true,/);
    assert.match(settings, /s\.chat\.personaDefer = flag\(s\.chat\.personaDefer, true\);/);
    assert.match(settings, /'chatLight', 'personaDefer'\]\) \{/);
    assert.match(read('src/styles.js'), /'chatLight', 'personaDefer'\];/);
    assert.match(read('src/panel.js'), /row\('입력 중 목록 갱신 미루기', toggle\('chat\.personaDefer', s\.chat\.personaDefer !== false\)/);
    assert.match(read('src/settings-labels.js'), /"chat\.personaDefer":"입력 중 목록 갱신 미루기"/);
    assert.match(read('src/settings-search.js'), /'입력 중 목록 갱신 미루기'.*'chat\.personaDefer'\]/);
});

console.log(`\n${n} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
