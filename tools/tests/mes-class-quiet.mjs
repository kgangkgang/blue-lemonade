// 8.2.7(perf-rest): 메시지 class 의 같은 값 쓰기 막기(mes-class-quiet).
//   실리태번 refreshSwipeButtons 가 메시지 하나 그릴 때마다 넘길 수 없는 메시지 전부에 classList.remove('swipes_visible','last_swipe') 를 불러
//   없는 클래스를 빼도 같은 값 class 기록이 생겼고, keyboard.js 감시가 기록마다 그 메시지 아래를 훑었어요.
//   ① 그 흉내(메시지 150개 · 5번 그리기)에서 같은 값 기록 0 ② class 값 · 바뀐 기록은 예전과 같음 ③ 정리 안 된 글자 · 이상한 토큰 · 빈 값은 원래 함수
//   ④ #chat 바로 아래 .mes 만 ⑤ 끄면 원래대로 ⑥ index.js 가 테마 런타임에서 동적 import 로 켬(시작 그래프 밖)
//   node tools/tests/mes-class-quiet.mjs <테마 사본>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const file = path.join(root, 'src/mes-class-quiet.js');
assert.ok(fs.existsSync(file), 'src/mes-class-quiet.js 가 없어요(고치기 전)');
const { startMesClassQuiet, stopMesClassQuiet, guardMessage, nothingToWrite } = await import(pathToFileURL(file).href);

// 브라우저 DOMTokenList 흉내: add · remove 는 바뀌든 말든 update steps 로 class 를 다시 써 기록을 남겨요(속성이 없고 토큰도 없으면 안 씀)
const records = [];
class TokenList {
    constructor(el) { this.el = el; }
    get tokens() { const v = this.el.attrs.class; return v == null ? [] : [...new Set(v.split(/[\t\n\f\r ]+/).filter(Boolean))]; }
    get value() { return this.el.attrs.class ?? ''; }
    get length() { return this.tokens.length; }
    contains(t) { return this.tokens.includes(String(t)); }
    check(t) { t = String(t); if (!t) throw new SyntaxError('빈 토큰'); if (/[\t\n\f\r ]/.test(t)) throw new Error('InvalidCharacterError'); return t; }
    update(set) { if (this.el.attrs.class == null && !set.length) return; const old = this.el.attrs.class ?? null; this.el.attrs.class = set.join(' '); records.push({ target: this.el, oldValue: old, value: this.el.attrs.class }); }
    add(...ts) { ts = ts.map(t => this.check(t)); const set = this.tokens; for (const t of ts) if (!set.includes(t)) set.push(t); this.update(set); }
    remove(...ts) { ts = ts.map(t => this.check(t)); this.update(this.tokens.filter(t => !ts.includes(t))); }
    toggle(t, force) { t = this.check(t); const has = this.contains(t); if (has && force !== true) { this.remove(t); return false; } if (!has && force !== false) { this.add(t); return true; } return has; }
}
class El {
    constructor(cls, parent = null) { this.nodeType = 1; this.attrs = cls == null ? {} : { class: cls }; this.children = []; this._list = new TokenList(this); if (parent) parent.append(this); }
    get classList() { return this._list; }
    append(c) { c.parentElement = this; this.children.push(c); observers.forEach(o => o.node === this && o.queue.push({ addedNodes: [c] })); }
}
const observers = [];
class MO { constructor(fn) { this.fn = fn; this.queue = []; observers.push(this); } observe(node, opt) { assert.deepEqual(opt, { childList: true }, '#chat 바로 아래만'); this.node = node; } disconnect() { this.node = null; } }
const flush = () => observers.forEach(o => { const q = o.queue.splice(0); if (q.length && o.node) o.fn(q); });

const chat = new El(null);
const make = (i) => new El('mes' + (i % 7 === 0 ? ' last_mes' : ''), chat);
for (let i = 0; i < 150; i++) make(i);
const other = new El('mes', new El('wrapper', chat));   // #chat 바로 아래가 아닌 .mes(미리보기 등)는 건드리지 않아요
startMesClassQuiet(chat, MO);
// 실리태번 refreshSwipeButtons 흉내: 마지막만 넘길 수 있음 → 나머지는 없는 클래스 빼기
const refresh = () => { const list = chat.children.filter(c => c.attrs.class?.includes('mes')); list.forEach((div, i) => { div.classList.toggle('fade', true); if (i === list.length - 1) { div.classList.toggle('last_swipe', true); div.classList.toggle('swipes_visible', true); } else div.classList.remove('swipes_visible', 'last_swipe'); }); };
refresh(); flush(); records.length = 0;
for (let k = 0; k < 5; k++) { make(150 + k); refresh(); flush(); }
const same = records.filter(r => r.oldValue === r.value);
const changed = records.filter(r => r.oldValue !== r.value);
assert.equal(same.length, 0, `메시지 5개 그리는 동안 같은 값 class 기록 ${same.length}개`);
assert.ok(changed.length >= 5, '바뀐 기록(마지막 메시지 표시가 옮겨감)은 그대로 남아요');
assert.ok(chat.children.at(-1).classList.contains('last_swipe') && !chat.children.at(-2).classList.contains('last_swipe'), 'class 결과는 예전과 같아요');
// ② 하나하나: 없는 것 빼기 · 있는 것 붙이기 = 기록 없음 / 바뀌면 원래 함수
const m = chat.children[3]; records.length = 0;
m.classList.remove('nope'); m.classList.add('mes'); assert.equal(records.length, 0);
m.classList.add('mes', 'bl-x'); assert.equal(m.attrs.class, 'mes fade bl-x'); m.classList.remove('bl-x', 'nope'); assert.equal(m.attrs.class, 'mes fade'); assert.equal(records.length, 2);
// ③ 원래 함수가 글자를 다시 정리할 꼴 · 이상한 토큰 · 빈 값 · 인자 없음은 원래 함수 그대로
const u = new El('mes  fade ', chat); flush(); records.length = 0; u.classList.remove('nope'); assert.equal(u.attrs.class, 'mes fade', '정리 안 된 글자는 원래 함수가 정리해요'); assert.equal(records.length, 1);
const d = new El('mes mes', chat); flush(); records.length = 0; d.classList.add('mes'); assert.equal(d.attrs.class, 'mes'); assert.equal(records.length, 1);
assert.throws(() => m.classList.remove(''), SyntaxError, '빈 토큰은 원래처럼 던져요'); assert.throws(() => m.classList.add('a b'), /InvalidCharacter/);
assert.equal(nothingToWrite(m.classList, [], false), false, '인자 없는 remove() 는 원래 함수');
assert.equal(nothingToWrite(m.classList, [1], false), false, '글자 아닌 토큰은 원래 함수');
const empty = new El('', chat); flush(); assert.equal(nothingToWrite(empty.classList, ['x'], false), false, '빈 class 는 원래 함수');
// ④ #chat 바로 아래 .mes 만
records.length = 0; other.classList.remove('nope'); assert.equal(records.length, 1, '#chat 바로 아래가 아닌 메시지는 그대로'); assert.equal(Object.hasOwn(other.classList, 'remove'), false);
const notMes = new El('mes_block', chat); flush(); assert.equal(Object.hasOwn(notMes.classList, 'remove'), false, '.mes 가 아닌 자식은 그대로');
assert.equal(guardMessage(m), false, '두 번 감싸지 않아요');
// ⑤ 끄면 원래대로
stopMesClassQuiet(); assert.ok(chat.children.every(c => !Object.hasOwn(c.classList, 'remove') && !Object.hasOwn(c.classList, 'add')), '끄면 메시지 classList 가 원래 함수로');
records.length = 0; m.classList.remove('nope'); assert.equal(records.length, 1);
// ⑥ index.js 에서 테마 런타임이 시작될 때 동적 import(시작 그래프 밖)
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const rt = index.slice(index.indexOf('const startThemeRuntime'), index.indexOf('const startThemeRuntime') + 6000);
assert.match(rt, /import\('\.\/src\/mes-class-quiet\.js'\)\.then\(m => m\.startMesClassQuiet\(\)\)/, '테마 런타임에서 켜요');
assert.doesNotMatch(index, /^import .*mes-class-quiet/m, '정적 import 가 아니에요(시작 그래프 밖)');
console.log('mes-class-quiet: 같은 값 기록 0 · 결과 같음 · 원래 함수로 넘기는 경우 · 범위 · 끄기 · 시작 자리 통과');
