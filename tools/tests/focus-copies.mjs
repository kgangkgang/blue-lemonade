// 1.4.1 focus-copies.js — 실리태번 dynamic-styles.js 대신 테마가 키보드 초점(:focus-visible) 사본을 맡는 길.
//   작은 CSSOM 흉내에서 ① 사본 글이 실리태번 규칙과 같은지 ② 미리 받기 → stylesheet 로 붙고 사본은 #dynamic-styles 맨 뒤에 들어가는지
//   ③ 같은 사본이 다시 오면 한 벌만 남고 뒤로 가는지 ④ 실리태번 사본 자리가 없으면 예전처럼 그냥 붙는지를 봐요.
//   실제 실리태번 모듈과 진짜 브라우저로 견준 결과는 1.4.1 E 보고(같은 규칙 · 같은 차례)에 있어요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', process.argv[2] && process.argv[2] !== '.' ? process.argv[2] : '');

class Rule {}
class CSSStyleRule extends Rule { constructor(selectorText, cssText) { super(); this.selectorText = selectorText; this.style = { cssText }; } }
class Group extends Rule { constructor(conditionText, rules) { super(); this.conditionText = conditionText; this.cssRules = rules; } }
class CSSMediaRule extends Group {}
class CSSSupportsRule extends Group {}
class CSSContainerRule extends Group {}
class CSSImportRule extends Rule {}
Object.assign(globalThis, { CSSStyleRule, CSSMediaRule, CSSSupportsRule, CSSContainerRule, CSSImportRule });

class Sheet {
    constructor() { this.cssRules = []; this.log = []; }
    insertRule(text, at) { const rule = { cssText: text }; this.cssRules.splice(at, 0, rule); this.log.push(['+', text]); return at; }
    deleteRule(at) { this.log.push(['-', this.cssRules[at].cssText]); this.cssRules.splice(at, 1); }
}
const host = new Sheet();
const head = [];
let hostThere = true;
const listeners = {};
globalThis.document = {
    getElementById: id => (id === 'dynamic-styles' && hostThere ? { sheet: host } : null),
    head: { append: el => { head.push(el); el.isConnected = true; } },
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
};
globalThis.requestIdleCallback = undefined;
const link = (rules, { preload = true } = {}) => ({
    rel: '', as: '', isConnected: false, sheet: { cssRules: rules },
    relList: { supports: t => preload && t === 'preload' },
    removeAttribute(name) { this[name] = ''; },
    remove() { this.isConnected = false; const at = head.indexOf(this); if (at >= 0) head.splice(at, 1); },
});
const fire = el => el.onload?.();

const fc = await import(pathToFileURL(path.join(root, 'src/focus-copies.js')).href);
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`ok ${passed} - ${name}`); };

await test('사본 글: 짝 없는 :hover 만 · 규칙 전체 선택자 · 감싸개 · 가상 요소와 hover+focus 는 빼요', () => {
    const rules = [
        new CSSStyleRule('.a:hover', 'color: red;'),
        new CSSStyleRule('.b:hover, .c', 'color: blue;'),
        new CSSStyleRule('.b:focus-visible', 'color: green;'),   // .b 는 같은 감싸개에 짝이 있어 빼요
        new CSSStyleRule('.d:hover::after', 'content: "x";'),
        new CSSStyleRule('.e:hover:focus', 'color: pink;'),
        new CSSMediaRule('(max-width: 600px)', [new CSSStyleRule('.b:hover', 'color: teal;')]),   // 감싸개가 달라 짝이 아니에요
        new CSSSupportsRule('(display: grid)', [new CSSContainerRule('(min-width: 1px)', [new CSSStyleRule('.f:hover', 'opacity: 0.5;')])]),
    ];
    assert.deepEqual(fc.copiesOf(rules), [
        '.a:focus-visible { color: red; }',
        '@media (max-width: 600px) { .b:focus-visible { color: teal; } }',
        '@supports (display: grid) { @container (min-width: 1px) { .f:focus-visible { opacity: 0.5; } } }',
    ]);
});
await test('미리 받기로 붙였다가 stylesheet 로 바꾸고, 사본은 #dynamic-styles 맨 뒤에 한 번에', async () => {
    const boot = link([new CSSStyleRule('.x:hover', 'color: red;')]);
    const done = fc.loadSheet(boot);
    assert.equal(boot.rel, 'preload'); assert.equal(boot.as, 'style'); assert.equal(head.at(-1), boot);
    fire(boot); assert.equal(boot.rel, 'stylesheet'); assert.equal(boot.as, '');
    fire(boot); await done;
    assert.equal(host.cssRules.length, 0, '받은 작업에서는 아직 훑지 않아요(쉴 때)');
    assert.equal(fc.flushFocusCopies(), 1);
    assert.deepEqual(host.cssRules.map(r => r.cssText), ['.x:focus-visible { color: red; }']);
});
await test('전체 장이 같은 사본을 또 가져오면 한 벌만 — 앞의 것을 지우고 맨 뒤에(실리태번의 「뒤의 것이 이김」과 같은 차례)', async () => {
    host.insertRule('.st-own:focus-visible { color: black; }', host.cssRules.length);   // 그 사이 실리태번이 넣은 다른 확장 몫
    const full = link([new CSSStyleRule('.y:hover', 'color: blue;'), new CSSStyleRule('.x:hover', 'color: red;')]);
    const done = fc.loadSheet(full); fire(full); fire(full); await done;
    fc.flushFocusCopies();
    assert.deepEqual(host.cssRules.map(r => r.cssText), ['.st-own:focus-visible { color: black; }', '.y:focus-visible { color: blue; }', '.x:focus-visible { color: red; }']);
});
await test('키를 누르거나 초점이 움직이면 기다리던 사본을 그 자리에서 넣어요 · 떼어 낸 시트는 건너뛰어요', async () => {
    const gone = link([new CSSStyleRule('.gone:hover', 'color: red;')]);
    const kept = link([new CSSStyleRule('.z:hover', 'color: red;')]);
    for (const el of [gone, kept]) { const p = fc.loadSheet(el); fire(el); fire(el); await p; }
    gone.remove();
    assert.ok(listeners.keydown?.length && listeners.focusin?.length);
    listeners.focusin[0]();
    const texts = host.cssRules.map(r => r.cssText);
    assert.ok(texts.includes('.z:focus-visible { color: red; }'));
    assert.ok(!texts.some(t => t.startsWith('.gone')));
});
await test('못 받으면 거절 · 실리태번 사본 자리가 없거나 미리 받기를 모르면 예전처럼 rel=stylesheet', async () => {
    const bad = link([]); const p = fc.loadSheet(bad); bad.onerror(); await assert.rejects(p, /읽지 못/);
    hostThere = false;
    const plain = link([new CSSStyleRule('.p:hover', 'color: red;')]); const q = fc.loadSheet(plain);
    assert.equal(plain.rel, 'stylesheet'); fire(plain); await q;
    hostThere = true;
    const old = link([], { preload: false }); const r = fc.loadSheet(old); assert.equal(old.rel, 'stylesheet'); fire(old); await r;
    const before = host.cssRules.length; fc.flushFocusCopies(); assert.equal(host.cssRules.length, before, '예전 길은 실리태번 몫이라 테마가 넣지 않아요');
});
await test('애드온 · 번역기 시트가 이 길로 붙어요 · CI 등록', () => {
    const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
    const addons = read('src/addons.js');
    assert.match(addons, /loadSheet\(link,el=>document\.head\.append\(el\)\)/, '첫 장 · 한 장씩');
    assert.match(addons, /loadSheet\(full,\(\)=>\{if\(link\.isConnected\)link\.after\(full\);/, '전체 장(같은 자리)');
    assert.match(read('src/addons/translator/shell.js'), /loadSheet\(link\)\.catch\(\(\) => \{\}\)/, '번역기 첫 장');
    assert.match(read('src/addons/translator/index.js'), /loadSheet\(cssLink\[0\]\)\.catch\(\(\) => \{\}\)/, '번역기 전체 장');
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/focus-copies.mjs .'));
});
console.log(`focus-copies: ${passed} passed`);
