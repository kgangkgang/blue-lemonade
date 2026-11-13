// 1.2.1 조판(src/typography.js writeRoot)은 이미 붙은 대사 줄 표시(mark.bl-line-dialogue)를 다시 쓰지 않아요.
//   브라우저는 같은 class 를 classList.add 해도 class 속성을 다시 써서 기록(MutationRecord)을 만들어요 — 실리태번 keyboard.js 는 class 기록마다
//   그 요소 아래 단추를 다시 훑고, #chat 감시 허브(lite 메시지 메뉴)도 깨어나요. 메시지가 다시 조판될 때마다(번역 · 스트리밍 끝 · 다른 확장) 형광펜 대사마다 하나씩.
//   ① 같은 메시지 HTML → 같은 결과 DOM · 같은 표식(처음 · 다시 조판 모두) ② 다시 조판해도 대사 줄 표시 class 를 다시 쓰지 않아요(되돌리면 실패)
//   node tools/tests/typeset-same-class.mjs <테마 루트>   (가짜 브라우저 tools/tests/leak-dom.mjs)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({});
// 글 속 요소는 inline 으로(가짜 브라우저 기본은 block)
const INLINE = /^(SPAN|MARK|Q|EM|STRONG|B|I|FONT)$/;
const base = globalThis.getComputedStyle;
globalThis.getComputedStyle = el => { const cs = base(el); return new Proxy({}, { get: (t, k) => (k === 'display' && INLINE.test(el?.nodeName) && !el.hidden ? 'inline' : k === 'whiteSpace' ? 'normal' : cs[k]) }); };
// 브라우저처럼: classList.add · remove 는 class 가 그대로여도 속성을 다시 써요 — 그 횟수를 세요
const proto = Object.getPrototypeOf(document.createElement('div'));
const desc = Object.getOwnPropertyDescriptor(proto, 'classList');
let rewrites = 0;
Object.defineProperty(proto, 'classList', { configurable: true, get() {
    const list = desc.get.call(this);
    return new Proxy(list, { get: (t, k) => {
        if (k === 'add') return (...cs) => { if (cs.every(c => t.contains(c))) rewrites++; return t.add(...cs); };
        if (k === 'remove') return (...cs) => { if (cs.every(c => !t.contains(c))) rewrites++; return t.remove(...cs); };
        return t[k];
    } });
} });
const T = await import(pathToFileURL(path.join(root, 'src/typography.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const HTML = '<p>앞 글이에요.<br><mark><q>"형광펜 대사예요"</q></mark> 뒤 글.<br><q>"그냥 대사예요"</q></p>';
const make = () => { const mes = dom.messageElement(0); mes.querySelector('.mes_text').innerHTML = HTML; document.getElementById('chat').append(mes); return mes; };
const shape = mes => mes.querySelector('.mes_text').innerHTML;
T.syncTypography(true);

test('① 같은 HTML → 같은 결과 DOM · 같은 표식 (처음 · 다시 조판)', () => {
    const a = make(), b = make();
    T.typesetRoots([a]); T.typesetRoots([b]);
    const first = shape(a);
    assert.equal(shape(b), first);
    assert.ok(a.querySelector('mark.bl-line-dialogue'), '형광펜 대사 줄 표시는 칸(mark)에');
    assert.ok(!a.querySelector('mark q.bl-line-dialogue'), '형광펜 안 대사(q)에는 줄 표시가 없어요');
    assert.ok(a.querySelector('q.bl-line-dialogue'), '그냥 대사 줄 표시');
    T.typesetRoots([a]); T.typesetRoots([a]);
    assert.equal(shape(a), first, '다시 조판해도 그대로');
    a.remove(); b.remove();
});

test('② 다시 조판해도 이미 붙은 대사 줄 표시 class 를 다시 쓰지 않아요', () => {
    const a = make();
    T.typesetRoots([a]);
    rewrites = 0;
    T.typesetRoots([a]); T.typesetRoots([a]);
    assert.equal(rewrites, 0, `그대로인 class 를 다시 쓴 횟수 ${rewrites}`);
    a.remove();
});
console.log(`typeset-same-class: ${pass} PASS`);
