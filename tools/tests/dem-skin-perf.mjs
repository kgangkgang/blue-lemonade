// 데우스 상태창 꾸미기 화면 성능(8.2.3 뒤) — node tools/tests/dem-skin-perf.mjs <테마 루트>
//   폰 실측(상태창 30개 긴 채팅 · 폰 4배): 「테두리 빛」 한 칸에 4~7초, 「폰에서 접어 두기」 한 번에 7~10초. 원인별 고침이 그대로인지 본다.
//   1) 테두리 빛(--bl-dem-glow)은 :root 변수 시트가 아니라 상태창 요소(.custom-dem-modules · 트래커)에만 두는 시트(#salty-dem-vars) — 값이 같으면 쓰지 않음,
//      끄는 동안(미리보기 모드)은 설정 창 표본만 새 값 · 채팅은 마지막 확정 값
//   2) 폰 접기는 body 클래스(salty-dem-fold)가 아니라 body[data-bl-dem-fold] — 실리태번 keyboard.js(class 감시)가 문서 전체를 훑지 않게. CSS · demskin.js · 미리보기 사본이 모두 속성
//   3) 「폰에서 접어 두기」 토글은 설정 창을 다시 그리지 않음 · 「테두리 빛」 슬라이더는 누른 동안 표본만
//   4) 상태창 복제(fruit-type-snapshot): content 없는 가상 요소는 읽지 않고, 부모와 같은 물려받는 속성은 쓰지 않음(모양 같음)
//   5) 커스텀 CSS 조절의 <head> 서명은 시트 글 전체를 이어 붙이지 않음(노드별 번호) — 같은 글이면 같은 서명, 바뀌면 다른 서명
//   6) 큰 숫자 쉼표 · 메뉴 단추 고정은 설정 적용마다가 아니라 모양 서명이 바뀔 때만 다시 훑음
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), url = pathToFileURL(root + '/');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

// ── 1) 테두리 빛 시트 ──
const glow = await import(new URL('src/dem-glow.js', url));
function fakeDoc() {
    const head = { children: [], appendChild(el) { this.children.push(el); } };
    const doc = { head, els: new Map(), writes: 0, getElementById(id) { return this.els.get(id) || null; }, createElement() { const doc0 = this; const el = { _t: '', get textContent() { return this._t; }, set textContent(v) { this._t = v; doc0.writes++; } }; Object.defineProperty(el, 'id', { set(v) { doc0.els.set(v, el); }, get() { return [...doc0.els].find(([, e]) => e === el)?.[0]; } }); return el; } };
    return doc;
}
check('값: 0~100 → 0~1, 없으면 35 → .35, 범위 밖은 끝값', () => {
    assert.equal(glow.demGlowValue(55), '0.55'); assert.equal(glow.demGlowValue(undefined), '0.35'); assert.equal(glow.demGlowValue('abc'), '0.35');
    assert.equal(glow.demGlowValue(250), '1'); assert.equal(glow.demGlowValue(-3), '0');
});
check('시트는 상태창 요소에만 — :root · body 없음', () => {
    const css = glow.demGlowCss('0.55');
    assert.ok(css.includes('.custom-dem-modules') && css.includes('.custom-dem-track') && css.includes('.custom-dem-track-recovery'), '상태창 묶음 · 트래커');
    assert.ok(!/:root|\bbody\b|\bhtml\b/.test(css), ':root 나 body 에 두지 않는다');
    assert.ok(!css.includes(':has('), ':has 없음(무효화 범위)');
});
check('같은 값이면 시트를 다시 쓰지 않고, 바뀌면 한 번만 쓴다', () => {
    glow.resetDemGlowState(); const doc = fakeDoc();
    glow.syncDemGlow(35, doc); glow.syncDemGlow(35, doc); glow.syncDemGlow('35', doc);
    assert.equal(doc.writes, 1); assert.ok(doc.getElementById('salty-dem-vars').textContent.includes('--bl-dem-glow: 0.35'));
    glow.syncDemGlow(55, doc); assert.equal(doc.writes, 2); assert.ok(doc.getElementById('salty-dem-vars').textContent.includes('--bl-dem-glow: 0.55'));
});
check('끄는 동안(미리보기)은 설정 창 표본만 새 값, 채팅은 확정 값 — 떼면 한 시트로 합쳐진다', () => {
    glow.resetDemGlowState(); const doc = fakeDoc();
    glow.syncDemGlow(35, doc);
    glow.setDemGlowPreview(true); assert.equal(glow.demGlowPreviewing(), true);
    const css = glow.syncDemGlow(70, doc);
    const [chat, preview] = css.split('\n');
    assert.ok(chat.includes('--bl-dem-glow: 0.35') && !chat.includes('.salty-panel'), '채팅 쪽은 확정 값 그대로');
    assert.ok(preview.includes('.salty-panel') && preview.includes('.bl-ft-sample-host') && preview.includes('--bl-dem-glow: 0.7'), '표본만 새 값');
    glow.syncDemGlow(80, doc); assert.ok(doc.getElementById('salty-dem-vars').textContent.split('\n')[0].includes('0.35'), '끄는 중엔 채팅 값이 안 움직인다');
    glow.setDemGlowPreview(false); const done = glow.syncDemGlow(80, doc);
    assert.ok(!done.includes('\n') && done.includes('--bl-dem-glow: 0.8'), '떼면 채팅 · 표본이 같은 값 한 줄');
    glow.resetDemGlowState();
});

// ── 2) 폰 접기: body 속성 ──
const applySrc = read('src/apply.js'), skinCss = read('css/30-dem-skin.css'), previewCss = read('css/23-preview.gen.css'), demskinSrc = read('src/demskin.js');
check('apply.js: 테두리 빛은 :root 변수 목록에 없고 syncDemGlow 로, 접기는 body 클래스 대신 data-bl-dem-fold 속성', () => {
    assert.ok(!/'--bl-dem-glow'\s*:/.test(applySrc), ':root 변수 목록에 --bl-dem-glow 가 없다');
    assert.ok(applySrc.includes("import { syncDemGlow } from './dem-glow.js'") && applySrc.includes('syncDemGlow(s.chat.demGlow)'));
    assert.ok(!applySrc.includes("want.add('salty-dem-fold')"), 'body 클래스 salty-dem-fold 를 더 이상 달지 않는다');
    assert.ok(applySrc.includes("setAttribute('data-bl-dem-fold'") && applySrc.includes("removeAttribute('data-bl-dem-fold')"));
    assert.ok(applySrc.includes("hasAttribute('data-bl-dem-fold') !== fold"), '같은 상태면 속성을 건드리지 않는다');
});
check('CSS: 접기 규칙은 전부 body.salty.salty-dem-skin[data-bl-dem-fold] (특이도 같음) · 클래스 선택자 없음 · 미리보기 사본도 같이', () => {
    for (const [name, css] of [['30-dem-skin', skinCss], ['23-preview.gen', previewCss]]) {
        assert.ok(!/\.salty-dem-fold\b/.test(css), `${name}: .salty-dem-fold 선택자 없음`);
        const n = (css.match(/body\.salty\.salty-dem-skin\[data-bl-dem-fold\] /g) || []).length;
        assert.ok(n >= 14, `${name}: 속성 선택자 규칙 ${n}개(14개 이상)`);
    }
    if (fs.existsSync(path.join(root, 'style.css'))) assert.ok(!/\.salty-dem-fold\b/.test(read('style.css')), 'style.css 에도 클래스 선택자 없음(빌드 반영)');
});
check('demskin.js: 접기 여부는 body 속성으로 — 1000px 아래 · 속성 있을 때만 트래커 누름이 펼침을 토글한다', async () => {
    const handlers = {}; let fold = true;
    const track = { cls: new Set(), classList: { toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }, _s: null } }; track.classList._s = track.cls;
    const target = { closest(sel) { if (sel === '.mes_text') return {}; if (sel === 'summary') return null; if (sel === 'a, button, summary, input') return null; if (sel === '.custom-dem-track, .custom-dem-track-recovery') return track; return null; } };
    const Element = function () {}; Object.setPrototypeOf(target, Element.prototype);
    globalThis.Element = Element;
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    globalThis.document = { addEventListener(type, fn) { handlers[type] = fn; }, removeEventListener(type) { delete handlers[type]; }, body: { hasAttribute: name => name === 'data-bl-dem-fold' && fold, classList: { contains: () => { throw new Error('클래스로 보면 안 된다'); } } } };
    const mod = await import(new URL('src/demskin.js', url));
    assert.ok(demskinSrc.includes("hasAttribute('data-bl-dem-fold')") && !demskinSrc.includes("contains('salty-dem-fold')"));
    mod.syncDemSkin(true, { demFold: true }); assert.ok(handlers.click, '누름을 받는다');
    handlers.click({ target }); assert.ok(track.cls.has('bl-dem-shown'), '속성 있음 → 펼침');
    fold = false; handlers.click({ target }); assert.ok(track.cls.has('bl-dem-shown'), '속성 없음 → 아무 일 없음');
    mod.syncDemSkin(false, {}); assert.ok(!handlers.click, '끄면 듣기를 뗀다');
});

// ── 3) 설정 창 ──
const panelSrc = read('src/panel.js'), ftSrc = read('src/fruit-type-ui.js');
check('panel.js: 접어 두기 토글은 다시 그리기 목록에 없고(모양은 CSS), 테두리 빛은 누른 동안 표본만 · 떼면 채팅', () => {
    const m = panelSrc.match(/update\(st => setPath\(st, path, target\.checked\), \[([^\]]+)\]\.includes\(path\)\)/);
    assert.ok(m, '스위치 다시 그리기 목록');
    assert.ok(!m[1].includes("'chat.demFold'"), 'chat.demFold 는 다시 그리지 않는다');
    assert.ok(m[1].includes("'chat.demSkin'"), '카드 스킨(줄이 늘고 줆)은 그대로 다시 그린다');
    assert.ok(panelSrc.includes("from './dem-glow.js'") && panelSrc.includes('setDemGlowPreview(true)') && panelSrc.includes('setDemGlowPreview(false)'));
    assert.ok(/input\[data-range="chat\.demGlow"\]/.test(panelSrc));
});
check('fruit-type-ui.js: 표본 다시 옮기기는 body 속성 · #salty-dem-vars 도 보고, 테두리 빛은 계산 스타일 대신 설정값으로 본다', () => {
    assert.ok(ftSrc.includes("attributeFilter:['class','data-bl-dem-fold']"));
    assert.ok(ftSrc.includes("['salty-vars','salty-dem-vars']"));
    assert.ok(!ftSrc.includes("getPropertyValue('--bl-dem-glow')"), '계산 스타일에서 --bl-dem-glow 를 읽지 않는다(문서 전체 재계산을 당기지 않게)');
    assert.ok(ftSrc.includes('getSettings().chat?.demGlow'));
});

// ── 4) 상태창 복제 ──
check('fruit-type-snapshot: content 없는 가상 요소는 속성을 읽지 않고, 부모와 같은 물려받는 속성은 자식에 쓰지 않는다', async () => {
    const { copyFruitPreview } = await import(new URL('src/fruit-type-snapshot.js', url));
    const reads = { main: 0, pseudo: 0 };
    const props = { color: 'rgb(1, 2, 3)', 'font-size': '18px', width: '300px', display: 'block', 'line-height': '27px' };
    const childProps = { ...props, width: '120px', display: 'inline-block', 'font-size': '14px' };
    const style = (vals, pseudo, content) => Object.assign(Object.keys(vals), { content, getPropertyValue(k) { reads[pseudo ? 'pseudo' : 'main']++; return vals[k]; } });
    const view = { getComputedStyle: (el, pseudo) => style(el.tag === 'child' ? childProps : props, pseudo, pseudo === '::after' && el.tag === 'parent' ? '"★"' : 'none') };
    const doc = { defaultView: view, fonts: new Set() };
    const el = (tag, children = []) => ({ nodeType: 1, tag, tagName: 'DIV', localName: 'div', namespaceURI: 'http://www.w3.org/1999/xhtml', attributes: [], childNodes: children, ownerDocument: doc, getClientRects: () => [{}], querySelectorAll: () => [] });
    const child = el('child'), parent = el('parent', [child]);
    const made = []; const mk = () => { const o = { style: {}, kids: [], attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(c) { this.kids.push(c); } }; made.push(o); return o; };
    const pseudoStyle = { textContent: '' };
    const target = { createElement: mk, createElementNS: mk, createTextNode: t => ({ t }), querySelector: () => ({ replaceChildren() {}, setAttribute() {} }), getElementById: () => pseudoStyle, fonts: new Set() };
    assert.ok(copyFruitPreview(parent, target));
    const [p, c] = made;
    assert.ok(p.style.cssText.includes('color:rgb(1, 2, 3)') && p.style.cssText.includes('font-size:18px'), '맨 위 요소는 전부 쓴다');
    assert.ok(!c.style.cssText.includes('color:'), '자식: 부모와 같은 color 는 생략(물려받음)');
    assert.ok(!c.style.cssText.includes('line-height:'), '자식: 같은 line-height 생략');
    assert.ok(c.style.cssText.includes('font-size:14px') && c.style.cssText.includes('width:120px') && c.style.cssText.includes('display:inline-block'), '다른 값 · 물려받지 않는 속성은 쓴다');
    assert.equal(reads.pseudo, Object.keys(props).length, '가상 요소 읽기는 content 가 있는 ::after 하나(부모)만');
    assert.ok(pseudoStyle.textContent.includes('::after') && !pseudoStyle.textContent.includes('::before'));
});

// ── 5) <head> 서명 ──
check('head-signature: 큰 시트 글을 이어 붙이지 않고(짧은 서명), 같은 글이면 같고 바뀌면 다르다', async () => {
    const { headSignature } = await import(new URL('src/addons/customstyle/head-signature.js', url));
    assert.ok(read('src/addons/customstyle/index.js').includes("from './head-signature.js'"), '커스텀 CSS 조절이 이 서명을 쓴다');
    const big = 'body{}'.repeat(100000);
    const style = { tagName: 'STYLE', textContent: big, getAttribute: () => null, sheet: { cssRules: { length: 100000 } } };
    const link = { tagName: 'LINK', getAttribute: k => k === 'href' ? 'style.css' : null, sheet: { cssRules: { length: 3 } } };
    const doc = { documentElement: { getAttribute: () => 'salty' }, head: { querySelectorAll: () => [style, link] } };
    const win = { innerWidth: 384, innerHeight: 800, devicePixelRatio: 3 };
    const a = headSignature(doc, win), b = headSignature(doc, win);
    assert.equal(a, b); assert.ok(a.length < 400, `서명이 짧다(${a.length})`);
    style.textContent = big + 'p{}'; const c = headSignature(doc, win); assert.notEqual(c, a, '글이 바뀌면 다르다');
    style.textContent = big; const d = headSignature(doc, win); assert.notEqual(d, a, '되돌려도 새 번호(바뀐 적이 있으니 다시 읽는다 — 예전과 같은 결과)');
    assert.equal(headSignature(doc, win), d, '그대로면 같다');
    assert.equal(headSignature({ documentElement: null, head: null }, win), '', '모르면 빈 서명 = 늘 읽는다');
});

// ── 6) 설정 적용마다 되풀이하던 훑기 ──
check('numcomma · mes-pins: 모양 서명이 같으면 다시 훑지 않는다 (features.js 가 서명을 넘긴다)', () => {
    const nc = read('src/numcomma.js'), mp = read('src/mes-pins.js'), ft = read('src/features.js');
    assert.ok(/export function syncNumComma\(want, key = null\)/.test(nc) && nc.includes('key !== lookKey'));
    assert.ok(ft.includes('syncNumComma(numComma, numKey)') && /const numKey = JSON\.stringify\(\[s\.palette/.test(ft));
    assert.ok(mp.includes('if (key !== pinsKey) { pinsKey = key; sweep(); }'));
});
console.log(`dem-skin-perf: ${passed} passed`);
