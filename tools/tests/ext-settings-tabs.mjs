// 1.2.x 긴 확장 설정 칸의 분류 탭(src/ext-compat.js) — 가짜 DOM, 브라우저 없음
//   ① 묶음 머리를 그때 읽어 탭을 만들어요(이름을 박아 두지 않아요) · 머리 없는 앞머리는 「기본」
//   ② 그 확장의 요소를 옮기거나 지우지 않아요 — 차례 · 개수 그대로, 표식(data-bl-tab-g · data-bl-tab-off)만
//   ③ 고른 묶음만 보이고, 두 번 불러도 한 번만 만들어요 · 지난번 탭을 이름으로 기억해요
//   ④ 머리가 둘 미만이면 아무것도 하지 않아요
//   ⑤ 안내 한 줄: 확인한 판이면 「맞춰 뒀어요」, 다른 판이면 지금 판을 알려요
//   ⑥ 감시자 · 타이머를 쓰지 않아요 · 맞춤 시트는 한 번만 붙여요
//   ⑦ 누름 길(문서 누름 감시자 하나 · 잡는 단계): 머리줄 누를 때 늦게 만들기 · 탭 누름 · 원래 이름으로 기억
//   ⑧ 공용 가로 탭 줄 등록부: 모듈이 먼저 떠도(등록부 없음) 머리줄 · 확장 서랍 단추 · 탭을 누를 때 한 번만 넣어요 — 감시자 · 타이머 없이, 두 번 넣지 않아요
//   ⑨ 그 확장이 설정 칸을 다시 그려도 확장 서랍 단추를 누를 때 다시 봐요 · 머리줄 그림 글자에는 표식을 달지 않아요(선 아이콘 글꼴이 그려요)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

let page;
const listeners = {};
const doc = {
    head: null, createElement: tag => new El(tag), querySelector: sel => page.querySelector(sel),
    getElementById: id => doc.head.children.find(k => k.id === id) || null,
    addEventListener(type, fn, capture) { (listeners[type] ||= []).push(fn); (listeners.capture ||= []).push(capture); },   // 받아 두었다가 누름을 직접 불러 봐요
};
class El {
    constructor(tag, cls = '', kids = [], id = '') {
        this.localName = tag; this.id = id; this.className = cls; this.dataset = {}; this.style = {}; this.attrs = {}; this.children = []; this.childNodes = []; this.parentElement = null;
        const self = this;
        this.classList = {
            contains: c => self.className.split(/\s+/).includes(c),
            toggle(c, on) { const set = new Set(self.className.split(/\s+/).filter(Boolean)); if (on) set.add(c); else set.delete(c); self.className = [...set].join(' '); },
        };
        for (const k of kids) this.append(k);
    }
    append(k) { if (typeof k === 'string') { this.childNodes.push({ nodeType: 3, nodeValue: k }); return; } k.parentElement = this; this.children.push(k); this.childNodes.push(k); }
    prepend(k) { k.parentElement = this; this.children.unshift(k); this.childNodes.unshift(k); }
    get nodeType() { return 1; }
    get ownerDocument() { return doc; }
    get textContent() { return this.childNodes.map(n => (n.nodeType === 3 ? n.nodeValue : n.textContent)).join(''); }
    set textContent(v) { this.children = []; this.childNodes = [{ nodeType: 3, nodeValue: String(v) }]; }
    setAttribute(n, v) { this.attrs[n] = String(v); }
    getAttribute(n) { return this.attrs[n] ?? null; }
    is(part) {
        const m = part.match(/^([a-z]*)((?:[.#][\w-]+)*)$/i);
        if (!m) throw Error('시험 DOM 이 모르는 선택자: ' + part);
        if (m[1] && m[1] !== this.localName) return false;
        return (m[2].match(/[.#][\w-]+/g) || []).every(t => (t[0] === '#' ? this.id === t.slice(1) : this.classList.contains(t.slice(1))));
    }
    all(out = []) { for (const k of this.children) { out.push(k); k.all(out); } return out; }
    querySelectorAll(sel) {
        if (sel.startsWith(':scope > ')) return this.children.filter(k => k.is(sel.slice(9)));
        const parts = sel.split(/\s+/);
        return this.all().filter(e => {
            if (!e.is(parts.at(-1))) return false;
            let up = e.parentElement;
            for (let i = parts.length - 2; i >= 0; i--) { while (up && !up.is(parts[i])) up = up.parentElement; if (!up) return false; up = up.parentElement; }
            return true;
        });
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest(sel) { for (let e = this; e; e = e.parentElement) if (e.is(sel)) return e; return null; }
}
const el = (tag, cls, ...kids) => new El(tag, cls, kids);
doc.head = new El('head');
const settings = (version, heads, icon = '') => {
    const content = el('div', 'inline-drawer-content', el('label', 'checkbox_label', '사용'), el('div', 'ss-set-btns'));
    for (const [name, extra] of heads) {
        content.append(extra ? el('b', 'ss-set-h', name, el('small', '', extra)) : el('b', 'ss-set-h', name));
        content.append(el('label', '', name + ' 칸'));
        content.append(el('small', '', '설명'));
    }
    const drawer = el('div', 'inline-drawer', el('div', 'inline-drawer-header', el('b', '', icon + '이름 ', el('small', '', 'v' + version))), content);
    const box = new El('div', 'ss-settings', [drawer], 'ss-settings');
    page = el('body', 'salty', box);
    return { box, content };
};
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };

const { SETS, FIRST_TAB, buildTabs, showGroup, headLabel, versionOf, compatText, attachSheet, startExtCompat, ensureStrip } = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href);
const SET = SETS[0];
const tabsOf = box => box.querySelector('.bl-ext-tabs').children;
const shown = content => content.children.filter(k => 'blTabG' in k.dataset && !('blTabOff' in k.dataset));

test('① 그때 있는 머리를 읽어 탭을 만들고 앞머리는 「기본」이에요', () => {
    const { box } = settings('2.6.1', [['언어 · 번역'], ['연락'], ['💗 보정 ', '(기본 꺼짐)']]);
    assert.equal(buildTabs(box, SET), true);
    assert.deepEqual(tabsOf(box).map(t => t.textContent), [FIRST_TAB, '언어 · 번역', '연락', '💗 보정']);
    assert.equal(headLabel(el('b', 'ss-set-h', '  알림  ')), '알림');
});
test('② 그 확장의 요소는 차례 · 개수 그대로예요(탭 줄은 맨 앞 · 안내는 맨 뒤에 더할 뿐)', () => {
    const { box, content } = settings('2.6.1', [['가'], ['나']]);
    const before = [...content.children];
    buildTabs(box, SET);
    assert.deepEqual(content.children.slice(1, -1), before);
    assert.ok(content.children[0].classList.contains('bl-ext-tabs') && content.children.at(-1).classList.contains('bl-ext-compat'));
    assert.deepEqual(before.map(k => k.dataset.blTabG), ['0', '0', '1', '1', '1', '2', '2', '2']);
    assert.equal(content.children[0].style.display, 'none', '탭 줄은 숨겨 두고 테마 CSS 가 보여요 — 테마를 끄면 원래 긴 꼴');
    assert.equal(content.children.at(-1).style.display, 'none');
    assert.equal(content.children[0].getAttribute('role'), 'tablist');
    assert.match(content.children[0].getAttribute('aria-label') || '', /설정 분류$/, '탭 줄 이름(읽어 주는 이름)');
    assert.ok(content.children[0].children.every(t => t.getAttribute('role') === 'tab' && t.type === 'button'));
});
test('③ 고른 묶음만 보이고 두 번 불러도 한 번만 만들어요', () => {
    const { box, content } = settings('2.6.1', [['가'], ['나']]);
    buildTabs(box, SET);
    assert.equal(buildTabs(box, SET), false);
    assert.equal(content.querySelectorAll(':scope > .bl-ext-tabs').length, 1);
    assert.equal(shown(content).length, 2, '처음은 앞머리');
    showGroup(box, 2);
    assert.deepEqual(shown(content).map(k => k.textContent), ['나', '나 칸', '설명']);
    assert.deepEqual(tabsOf(box).map(t => t.getAttribute('aria-selected')), ['false', 'false', 'true']);
    assert.equal(box.dataset.blTabs, '2');
});
test('③-2 지난번에 고른 탭을 이름으로 기억해요(묶음이 늘어도 같은 탭)', () => {
    localStorage.setItem('bl-ext-tab:ss-settings', '나');
    const { box } = settings('2.6.1', [['새 묶음'], ['가'], ['나']]);
    buildTabs(box, SET);
    assert.equal(box.dataset.blTabs, '3');
    localStorage.store = {};
});
test('④ 머리가 둘 미만이면 아무것도 하지 않아요', () => {
    const { box, content } = settings('2.6.1', [['하나뿐']]);
    const before = content.children.length;
    assert.equal(buildTabs(box, SET), false);
    assert.equal(content.children.length, before);
    assert.ok(content.children.every(k => !('blTabG' in k.dataset)));
});
test('⑤ 안내 한 줄 — 확인한 판 · 다른 판', () => {
    assert.equal(versionOf('v2.6.1'), '2.6.1');
    assert.match(compatText(SET, SET.verified[0]), /화면에 맞춰 뒀어요/);
    const other = compatText(SET, '9.9.9');
    assert.ok(other.includes('9.9.9') && other.includes(SET.verified.at(-1)) && /어긋나 보일 수 있어요/.test(other), other);
    const { box, content } = settings('9.9.9', [['가'], ['나']]);
    buildTabs(box, SET);
    assert.ok(content.children.at(-1).textContent.includes('지금 판은 9.9.9'));
    const unread = compatText(SET, '');
    assert.ok(/읽지 못했어요/.test(unread) && !/맞춰 뒀어요/.test(unread), '판을 못 읽으면 맞는 판처럼 적지 않아요: ' + unread);
    assert.deepEqual(SET.verified, ['2.6.1', '2.7.0', '2.7.1', '2.7.2', '2.7.9', '2.7.11', '2.7.15', '2.7.17'], '확인한 판(리그 사진 · 점검 대본으로 본 것만)');
    for (const v of SET.verified) assert.match(compatText(SET, v), /화면에 맞춰 뒀어요/);
});
test('⑥ 감시자 · 타이머가 없고 맞춤 시트는 한 번만 붙여요', () => {
    const src = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
    assert.ok(!/MutationObserver|ResizeObserver|IntersectionObserver|setInterval|setTimeout|requestAnimationFrame|watchDom|watchWith/.test(src));
    assert.ok(!/innerHTML|\.remove\(|removeChild|replaceWith|insertBefore/.test(src), '그 확장의 요소를 지우거나 다시 만들지 않아요');
    const head = el('head', ''); const d = { head, createElement: tag => new El(tag), getElementById: id => head.children.find(k => k.id === id) || null };
    assert.equal(attachSheet(d, SET, 'http://x/scripts/extensions/third-party/t/src/ext-compat.js'), true);
    assert.equal(attachSheet(d, SET, 'http://x/scripts/extensions/third-party/t/src/ext-compat.js'), false, '두 번째는 붙이지 않아요');
    assert.equal(head.children.length, 1);
    assert.equal(head.children[0].href, 'http://x/scripts/extensions/third-party/t/src/ext-status.css');
    assert.ok(fs.existsSync(path.join(root, 'src/ext-status.css')));
});
test('⑦ 누름 길: 머리줄을 누르면 늦게 그려진 칸에 탭을 만들고, 탭을 누르면 그 묶음만 보이고 원래 이름으로 기억해요', () => {
    localStorage.store = { 'bl-ext-compat': 'ss-settings' };     // 지난번에 그 확장의 설정 칸이 있었던 기기(index.js 가 남긴 표시 — 있었던 칸 id)
    page = el('body', 'salty');                                   // 아직 그 확장의 설정 칸이 없을 때 시작
    startExtCompat(doc);
    assert.equal(listeners.click.length, 1, '문서 누름 감시자는 하나');
    assert.equal(listeners.capture[0], true, '잡는 단계 — 실리태번이 서랍을 펼치며 높이를 재기 전에 탭을 만들어요');
    assert.equal(doc.head.children.length, 1, '맞춤 시트는 설정 칸보다 먼저 붙어요');
    assert.match(doc.head.children[0].id, /^bl-ext-css-ss-settings$/, '시트 id 는 선택자에서');
    const { box, content } = settings('2.6.1', [['가'], ['나']]);   // 뒤늦게 그려짐
    assert.equal(box.querySelector('.bl-ext-tabs'), null);
    listeners.click[0]({ target: box.querySelector('.inline-drawer-header').children[0] });   // 머리줄 안의 <b> 를 누름
    assert.ok(box.querySelector('.bl-ext-tabs'), '머리줄을 누를 때 탭을 만들어요');
    listeners.click[0]({ target: content.children[2] });           // 설정 줄을 누르는 것은 아무 일도 없어요
    assert.equal(box.dataset.blTabs, '0');
    const tab = tabsOf(box)[2];
    tab.childNodes = [{ nodeType: 3, nodeValue: '번역된 글자' }];   // 그 확장의 화면 번역이 탭 글자를 바꿔도
    listeners.click[0]({ target: tab });
    assert.equal(box.dataset.blTabs, '2');
    assert.deepEqual(shown(content).map(k => k.textContent), ['나', '나 칸', '설명']);
    assert.equal(localStorage.getItem('bl-ext-tab:ss-settings'), '나', '기억은 원래 이름으로');
    startExtCompat(doc);
    assert.equal(listeners.click.length, 1, '두 번 불러도 감시자는 하나');
    assert.equal(doc.head.children.length, 1);
});
test('⑧ 공용 가로 탭 줄 등록부: 모듈이 먼저 떠도 등록부가 생긴 뒤 누를 때 한 번만 넣어요', () => {
    const KEY = Symbol.for('blue-lemonade.tab-scroll.v1');
    assert.equal(doc[KEY], undefined, '⑦ 은 등록부 없이 돌았어요 — 그때는 조용히 넘어가요');
    assert.equal(ensureStrip(doc), false);
    const calls = [];
    doc[KEY] = { owner: 'blue-lemonade', ver: 1, add(list) { calls.push(list); } };   // 확장 서랍을 열면 생겨요(src/tab-scroll.js)
    const { box } = settings('2.6.1', [['가'], ['나']]);
    listeners.click[0]({ target: box.querySelector('.inline-drawer-header').children[0] });   // 머리줄 누름
    assert.deepEqual(calls, [['.bl-ext-tabs', '.ss-scope .ss-tabs']], '머리줄을 누를 때 분류 탭 줄과 그 확장의 안쪽 탭 줄(한 줄 · 스크롤바 없음으로 바꾼 줄)을 넣어요');
    listeners.click[0]({ target: box.querySelector('.inline-drawer-header').children[0] });
    listeners.click[0]({ target: tabsOf(box)[1] });
    startExtCompat(doc);
    assert.equal(calls.length, 1, '두 번 넣지 않아요(누름 · 다시 부름 모두)');
    assert.equal(ensureStrip(doc), true);
    assert.ok(fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8').includes("Symbol.for('blue-lemonade.tab-scroll.v1')"), 'src/tab-scroll.js 와 같은 열쇠');
    assert.ok(fs.readFileSync(path.join(root, 'src/tab-scroll.js'), 'utf8').includes("Symbol.for('blue-lemonade.tab-scroll.v1')"));
});
const freshCompat = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href + '?strip');   // 「아직 안 넣음」 상태의 새 모듈(⑧-2)
test('⑧-2 안쪽 탭 줄(감사 고침): 설정 서랍을 거치지 않아도 등록부가 생긴 뒤 아무 데나 처음 누를 때 넣어요 — 그 전 누름은 조용히 넘어가요', () => {
    const KEY = Symbol.for('blue-lemonade.tab-scroll.v1'), fresh = freshCompat;
    const page = { head: { children: [], append(n) { this.children.push(n); } }, documentElement: {}, taps: [], createElement: () => ({ dataset: {} }), getElementById: () => null, querySelector: () => null, addEventListener(type, fn) { if (type === 'click') this.taps.push(fn); } };
    fresh.startExtCompat(page);
    assert.equal(page.taps.length, 1);
    page.taps[0]({ target: { closest: () => null } });   // 등록부가 없을 때의 누름(상태 띠 · 채팅 …)
    const calls = [];
    page[KEY] = { owner: 'blue-lemonade', ver: 1, add(list) { calls.push(list); } };
    page.taps[0]({ target: { closest: () => null } });   // 그 확장의 판을 여는 누름(설정 서랍 머리줄 · 분류 탭이 아님)
    assert.deepEqual(calls, [['.bl-ext-tabs', '.ss-scope .ss-tabs']]);
    page.taps[0]({ target: { closest: () => null } });
    assert.equal(calls.length, 1, '한 번만');
    assert.deepEqual(SET.strips, ['.ss-scope .ss-tabs']);
    const css = fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8');
    assert.match(css, /body\.salty \.ss-scope \.ss-tabs \{ flex-wrap: nowrap; overflow-x: auto;[^}]*scrollbar-width: none;/, '맞춤 시트가 그 줄을 한 줄 · 스크롤바 없음으로 바꿔요 — 그래서 등록부에 넣어요');
});
test('⑨ 그 확장이 칸을 다시 그려도 확장 서랍 단추를 누르면 다시 봐요 · 머리줄 그림 글자에는 표식을 달지 않아요', () => {
    const again = settings('2.7.0', [['가'], ['나']], '\u{1F63C} ');   // 그 확장이 설정 칸을 다시 그림(2.7.0 판 올림 창 뒤)
    const toggle = el('div', 'drawer-toggle');
    new El('div', 'drawer', [toggle], 'extensions-settings-button');
    listeners.click[0]({ target: toggle });                         // 확장 서랍 단추
    assert.ok(again.box.querySelector('.bl-ext-tabs'), '서랍이 그려지기 전에 탭을 만들어요');
    assert.ok(!('blExtIcon' in again.box.dataset), '머리줄 그림 글자는 선 아이콘 글꼴이 그려요 — 표식 · 글자 바꾸기 없음');
    const fresh = settings('2.7.0', [['가'], ['나']], '\u{1F63C} ');
    const other = el('div', 'drawer-toggle');
    new El('div', 'drawer', [other], 'user-settings-button');
    listeners.click[0]({ target: other });                          // 다른 서랍 단추 — 아무 일 없음
    assert.equal(fresh.box.querySelector('.bl-ext-tabs'), null);
    const mod = fs.readFileSync(path.join(root, 'src/ext-compat.js'), 'utf8');
    assert.ok(!/blExtIcon|data-bl-ext-icon|markIcon/.test(mod));
});
console.log(`ext-settings-tabs: ${passed}개 통과`);
