// 8.2.4 사후 검토(review-824): 코드 색 입히기 끄기(src/code-plain.js) — 다른 확장이 우리 뒤에 hljs.highlightElement 를 또 감쌌을 때 끄고 다시 켜도 되는지.
// 고치기 전: 끌 때 깨끗이 못 되돌리면 hooked 를 비워서, 다시 켤 때 「남의 감싼 함수(안에 우리 겹)」를 original 로 잡고 또 감쌌어요
//   → 메시지 밖 코드(팝업 · 다른 확장)를 칠하면 우리 겹 ↔ 남의 겹이 서로를 끝없이 불러 RangeError(호출 스택 넘침)가 났어요.
//   node tools/tests/code-plain-rewrap.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

let painted = 0;
const hljs = { highlightElement(el) { painted++; el.classList.add('hljs'); } };
globalThis.hljs = hljs;
const block = inMessage => { const classes = new Set(); return { classList: { add: c => classes.add(c), has: c => classes.has(c) }, classes, closest: sel => (inMessage && sel.includes('.mes_text') ? {} : null) }; };

const cp = await import(pathToFileURL(path.join(root, 'src/code-plain.js')));
cp.syncCodePlain(true);
// 다른 확장이 우리 뒤에 감싼다 (앞의 함수를 불러 주는 흔한 꼴)
const before = hljs.highlightElement;
let otherCalls = 0;
hljs.highlightElement = function other(el, ...rest) { otherCalls++; return before.call(this, el, ...rest); };

cp.syncCodePlain(false);
t('끄면: 남이 위에 감싸 깨끗이 못 되돌려도 메시지 코드는 다시 칠해져요', () => {
    const b = block(true); hljs.highlightElement(b); assert.ok(b.classes.has('hljs'));
});
cp.syncCodePlain(true);
t('다시 켜고 메시지 밖 코드를 칠해도 스택이 넘치지 않고 원래 함수가 한 번만 돌아요 (고치기 전 RangeError)', () => {
    painted = 0; otherCalls = 0;
    const b = block(false);
    assert.doesNotThrow(() => hljs.highlightElement(b));
    assert.equal(painted, 1); assert.ok(b.classes.has('hljs'));
});
t('다시 켠 뒤 메시지 안 코드는 건너뛰어요', () => {
    painted = 0;
    const b = block(true); hljs.highlightElement(b);
    assert.equal(painted, 0); assert.ok(b.classes.has('bl-code-plain'));
});
t('끄고 켜기를 여러 번 해도 같아요', () => {
    for (let i = 0; i < 3; i++) { cp.syncCodePlain(false); cp.syncCodePlain(true); }
    painted = 0; assert.doesNotThrow(() => hljs.highlightElement(block(false))); assert.equal(painted, 1);
    cp.syncCodePlain(false); painted = 0; hljs.highlightElement(block(true)); assert.equal(painted, 1);
});
console.log(`PASS code-plain-rewrap: ${n} checks`);
