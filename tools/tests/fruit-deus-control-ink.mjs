// 7.9.9 과일의 마음 · 데우스 빠른 설정 창의 글자 단추도 control-ink 가 맞춰요: body 밖(html 자식) 창 감시, 글자 크기 0 꺾쇠(<i>)가 든 고르기 단추 포함. 합성 DOM 만 써요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/control-ink.js'), 'utf8');
let count = 0; const test = (name, fn) => { fn(); console.log('PASS', name); count++; };

test('과일의 마음 창과 데우스 빠른 설정 창이 맞추는 창 목록에 있어요', () => {
    const roots = source.match(/const ROOTS = '([^']+)'/)[1].split(',').map(s => s.trim());
    assert.ok(roots.includes('#fruit-heart-v6'));
    assert.ok(roots.includes('#bl-deus-popover'));
});

function world({ arrowFontSize = '0px', arrowPosition = 'absolute' } = {}) {
    const frames = new Map(); let next = 0; const observed = [];
    const style = { values: new Map([['padding-top', ['7px', '']], ['padding-bottom', ['7px', '']]]), getPropertyValue(p) { return this.values.get(p)?.[0] || ''; }, getPropertyPriority(p) { return this.values.get(p)?.[1] || ''; }, setProperty(p, v, pr) { this.values.set(p, [v, pr]); }, removeProperty(p) { this.values.delete(p); } };
    const arrow = { tagName: 'I', children: [], textContent: '▾' };
    const control = { tagName: 'BUTTON', textContent: '스토리 고르게 밀기▾', style, closest: () => null, matches: () => false, querySelector: () => arrow, querySelectorAll: () => [arrow], getBoundingClientRect: () => ({ top: 0, bottom: 36, width: 120, height: 36 }) };
    const label = { textContent: '스토리 고르게 밀기', parentElement: control };
    const caret = { textContent: '▾', parentElement: arrow };
    const fruit = { id: 'fruit-heart-v6', nodeType: 1, isConnected: true, contains: e => e === fruit, matches: sel => sel.includes('#fruit-heart-v6'), getClientRects: () => [{}], checkVisibility: () => true, querySelectorAll: () => [control] };
    const body = { nodeType: 1, matches: () => false };
    const html = { children: [body, fruit] };
    const css = { fontStyle: 'normal', fontWeight: '400', fontSize: '15px', fontFamily: 'sans-serif', letterSpacing: 'normal', lineHeight: '21.75px', visibility: 'visible', writingMode: 'horizontal-tb', borderTopWidth: '0px', borderBottomWidth: '0px' };
    const document = {
        body, documentElement: html, fonts: { addEventListener() {} },
        querySelectorAll: sel => sel.includes('#fruit-heart-v6') ? [fruit] : [],
        createElement: () => ({ width: 76, height: 56, getContext: () => ({ measureText: () => ({ fontBoundingBoxAscent: 14, width: 60, actualBoundingBoxLeft: 0, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 0 }), fillText() {}, getImageData() { const data = new Uint8ClampedArray(76 * 56 * 4); for (let y = 8; y < 48; y++) data[(y * 76 + 8) * 4 + 3] = 255; return { data }; } }) }),
        createTreeWalker: () => { const nodes = [label, caret]; return { nextNode: () => nodes.shift() || null }; },
        createRange: () => { let target = null; return { selectNodeContents(n) { target = n; }, getClientRects: () => target === caret ? [] : [{ width: 80, height: 22, top: 10 + parseFloat(style.getPropertyValue('padding-top')) - 7 }] }; },
    };
    const sandbox = {
        document, window: { addEventListener() {} }, NodeFilter: { SHOW_TEXT: 4 },
        getComputedStyle: (el, pseudo) => pseudo ? { position: 'absolute', content: 'none' } : el === arrow ? { position: arrowPosition, fontSize: arrowFontSize } : { ...css, paddingTop: style.getPropertyValue('padding-top'), paddingBottom: style.getPropertyValue('padding-bottom') },
        MutationObserver: class { constructor(fn) { this.callback = fn; } observe(target, options) { observed.push([target, options]); } disconnect() {} },
        requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
        console, Uint8ClampedArray,
    };
    vm.createContext(sandbox); vm.runInContext(source.replace('export function syncControlInk', 'function syncControlInk') + '\nthis.sync = syncControlInk;', sandbox);
    const flush = () => { const jobs = [...frames.values()]; frames.clear(); jobs.forEach(f => f()); };
    return { sandbox, flush, observed, style, html, fruit, body };
}

test('body 밖 창: html 바로 아래 자식 변화와 그 창 안쪽을 함께 감시해요(head 안은 안 봐요)', () => {
    const w = world(); w.sandbox.sync(true, 'font-a'); w.flush();
    assert.ok(w.observed.some(([t, o]) => t === w.body && o.subtree), 'body 는 그대로 감시');
    assert.ok(w.observed.some(([t, o]) => t === w.html && o.childList && !o.subtree), 'html 은 자식 추가 · 삭제만');
    assert.ok(w.observed.some(([t, o]) => t === w.fruit && o.subtree), '과일 창 안쪽');
});

test('글자 크기 0 · 절대 위치 꺾쇠가 든 고르기 단추는 글자 단추로 맞춰요(여백 합은 그대로)', () => {
    const w = world(); w.sandbox.sync(true, 'font-a'); w.flush();
    const top = parseFloat(w.style.getPropertyValue('padding-top')), bottom = parseFloat(w.style.getPropertyValue('padding-bottom'));
    assert.equal(top + bottom, 14);
    assert.notEqual(top, 7, '잉크가 아래로 처진 단추는 위 여백이 바뀌어야 해요');
    assert.equal(w.style.getPropertyPriority('padding-top'), 'important');
});

test('보이는 아이콘(글자 크기 0 이 아닌 <i>)이 섞인 단추는 전처럼 건너뛰어요', () => {
    const w = world({ arrowFontSize: '12px' }); w.sandbox.sync(true, 'font-a'); w.flush();
    assert.equal(w.style.getPropertyValue('padding-top'), '7px');
    const w2 = world({ arrowPosition: 'static' }); w2.sandbox.sync(true, 'font-a'); w2.flush();
    assert.equal(w2.style.getPropertyValue('padding-top'), '7px');
});

console.log(`fruit-deus-control-ink: ${count} passed`);
