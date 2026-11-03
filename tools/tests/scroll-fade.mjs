// 8.2.3 세로 스크롤 칸의 넘친 쪽 흐림 (src/scroll-fade.js) — 작은 DOM 흉내: 상태 계산 · 속성 쓰기(바뀔 때만 · 맞으면 뗌) · 선택자 묶기 · 제외 · 바이바이 쉼 · rAF 묶기 · 뿌리 다시 훑기 · CSS 짝
//   node tools/tests/scroll-fade.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const M = await import(pathToFileURL(path.join(root, 'src/scroll-fade.js')));
const { fadeStateY, applyFadeY, installScrollFade, FADE_Y_SELECTORS, SKIP_Y } = M;
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- DOM 흉내: sels = 이 요소가 맞는 선택자 조각들
const frames = [];
// (8.2.7) 진짜 ResizeObserver 처럼 처음 observe 하면 상자가 있는 칸만 다음 그리기 단계(여기서는 frames)에 한 번에 알려요
class FakeRO { constructor(cb) { this.cb = cb; this.targets = new Set(); this.queue = []; FakeRO.last = this; } observe(el, opts) { this.targets.add(el); this.opts = opts; if (!el.clientHeight) return; this.queue.push(el); if (this.queue.length === 1) frames.push(() => { const q = this.queue.splice(0); this.cb(q.map(target => ({ target }))); }); } unobserve(el) { this.targets.delete(el); } fire(el) { this.cb([{ target: el }]); } }
class FakeMO { constructor(cb) { this.cb = cb; FakeMO.made = (FakeMO.made || 0) + 1; } observe(el, opts) { this.el = el; this.opts = opts; el.mo = this; } disconnect() { this.dead = true; } takeRecords() { return []; } }
const win = { requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, ResizeObserver: FakeRO, MutationObserver: FakeMO, AbortController, getComputedStyle: n => ({ overflowY: n.overflowY }) };
const flush = () => { const fs = frames.splice(0); for (const fn of fs) fn(); };
const doc = { nodeType: 9, documentElement: {}, defaultView: win, children: [], listeners: {} };
// (8.2.7) scroll · click 은 문서에 capture 리스너 하나 — 흉내 이벤트도 문서 capture 를 먼저 지나요
doc.addEventListener = (type, fn, opts) => { (doc.listeners[type] ??= []).push(fn); (doc.opts ??= {})[type] = opts; };
function el(sels = [], box = {}) {
    const node = { nodeType: 1, sels, children: [], parentElement: null, ownerDocument: doc, isConnected: true, dataset: {}, listeners: {}, scrollTop: 0, clientHeight: 200, scrollHeight: 200, overflowY: 'auto', ...box };
    node.matches = selector => selector.split(',').map(s => s.trim()).some(s => sels.includes(s));
    node.closest = selector => { for (let n = node; n && n.nodeType === 1; n = n.parentElement) if (n.matches(selector)) return n; return null; };
    node.querySelectorAll = selector => node.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]);
    node.addEventListener = (type, fn, opts) => { (node.listeners[type] ??= []).push(fn); (node.opts ??= {})[type] = opts; opts?.signal?.addEventListener('abort', () => { node.listeners[type] = node.listeners[type].filter(f => f !== fn); }); };
    node.fire = type => { for (const fn of doc.listeners[type] || []) fn({ target: node }); for (const fn of node.listeners[type] || []) fn({ target: node }); };
    return node;
}
const add = (parent, child) => { child.parentElement = parent; parent.children.push(child); return child; };
doc.querySelectorAll = sel => doc.children.flatMap(c => [...(c.matches(sel) ? [c] : []), ...c.querySelectorAll(sel)]);
const body = add(doc, el(['body']));
body.parentElement = null;

await test('상태: 맞으면 빈 값, 아래가 더 있으면 bottom, 위는 top, 둘 다 both, 안 보이면(clientHeight 0) 빈 값', () => {
    const e = el([], { scrollHeight: 600 });
    assert.equal(fadeStateY(e), 'bottom'); e.scrollTop = 100; assert.equal(fadeStateY(e), 'both'); e.scrollTop = 400; assert.equal(fadeStateY(e), 'top');
    assert.equal(fadeStateY(el()), ''); assert.equal(fadeStateY(el([], { clientHeight: 0, scrollHeight: 600 })), ''); assert.equal(fadeStateY(null), '');
    assert.equal(fadeStateY(el([], { scrollHeight: 201 })), '', '1px 오차는 넘침이 아니다');
});
await test('applyFadeY 는 바뀔 때만 쓰고, 맞거나 overflow hidden 이면 떼요', () => {
    const e = el([], { scrollHeight: 600 }); let writes = 0;
    e.dataset = new Proxy({}, { set(t, k, v) { writes++; t[k] = v; return true; }, deleteProperty(t, k) { writes++; delete t[k]; return true; } });
    assert.equal(applyFadeY(e), 'bottom'); assert.equal(e.dataset.blFadeY, 'bottom'); applyFadeY(e); assert.equal(writes, 1, '같은 상태는 다시 안 쓴다');
    assert.equal(applyFadeY(e, false), ''); assert.equal('blFadeY' in e.dataset, false); applyFadeY(e, false); assert.equal(writes, 2);
    e.scrollHeight = 200; applyFadeY(e); assert.equal('blFadeY' in e.dataset, false);
});

// ---- 문서 묶기
const chars = add(body, el(['#rm_print_characters_block'], { scrollHeight: 2000 }));
const chatInner = add(add(body, el(['#chat'])), el(['.drawer-content'], { scrollHeight: 900 }));   // 제외 — #chat 안
const fontScroll = add(body, el(['.salty-fontscroll', '.drawer-content'], { scrollHeight: 900 }));   // 제외 — 자체 흐림
const drawer = add(body, el(['.drawer-content', '#rm_extensions_block'], { clientHeight: 0, scrollHeight: 0, overflowY: 'hidden' }));   // 닫힌 서랍
const wi = add(body, el(['#world_popup_entries_list'], { scrollHeight: 3000 }));
const hiddenPopup = add(body, el(['dialog.popup .popup-content'], { scrollHeight: 900, overflowY: 'hidden' }));   // 실리태번 기본 팝업: 넘쳐도 overflow hidden
let baibai = false;
const fade = installScrollFade(doc, { resting: f => f === 'worldInfo' && baibai });
await test('목록의 선택자만 묶고(캐릭터 목록 · 서랍 · 월드인포 · 팝업), #chat 안 · 자체 흐림 칸은 제외 — 두 번 설치해도 같은 api', () => {
    assert.ok(FADE_Y_SELECTORS.includes('#rm_print_characters_block') && FADE_Y_SELECTORS.includes('.drawer-content') && FADE_Y_SELECTORS.includes('dialog.popup .popup-content'));
    assert.ok(fade.has(chars) && fade.has(drawer) && fade.has(wi) && fade.has(hiddenPopup));
    assert.equal(fade.has(chatInner), false); assert.equal(fade.has(fontScroll), false);
    assert.equal(installScrollFade(doc), fade);
    for (const sel of ['#chat', '.mes_text', 'textarea', 'pre', 'iframe', '.salty-fonttags', '.salty-fontscroll', '[data-bl-fade]']) assert.ok(SKIP_Y.includes(sel), sel);
});
await test('처음 재기는 rAF 한 번에 묶여요: 넘치는 캐릭터 목록 bottom · 닫힌 서랍 없음 · overflow hidden 팝업 없음', () => {
    assert.equal(frames.length, 1, 'rAF 하나'); flush();
    assert.equal(chars.dataset.blFadeY, 'bottom'); assert.equal('blFadeY' in drawer.dataset, false); assert.equal('blFadeY' in hiddenPopup.dataset, false);
    assert.equal(wi.dataset.blFadeY, 'bottom');
});
await test('스크롤하면 passive 리스너가 다음 프레임에 both → top 으로 바꾸고, 같은 프레임의 여러 스크롤은 한 번만 재요', () => {
    chars.scrollTop = 500; chars.fire('scroll'); chars.fire('scroll'); chars.fire('scroll');
    assert.equal(frames.length, 1); flush(); assert.equal(chars.dataset.blFadeY, 'both');
    chars.scrollTop = 1800; chars.fire('scroll'); flush(); assert.equal(chars.dataset.blFadeY, 'top');
});
await test('서랍이 열려(ResizeObserver: 크기 0 → n · overflow auto) 넘치면 bottom, 다시 닫히면 떼요', () => {
    drawer.clientHeight = 600; drawer.scrollHeight = 1400; drawer.overflowY = 'auto'; FakeRO.last.fire(drawer); flush();
    assert.equal(drawer.dataset.blFadeY, 'bottom');
    drawer.clientHeight = 0; drawer.scrollHeight = 0; drawer.overflowY = 'hidden'; FakeRO.last.fire(drawer); flush();
    assert.equal('blFadeY' in drawer.dataset, false);
});
await test('자식이 바뀌면(목록 다시 그림) 다시 재고, 내용이 줄어 맞으면 떼요', () => {
    chars.scrollTop = 0; chars.scrollHeight = 200; chars.mo.cb([{ type: 'childList', target: chars }]); flush(); assert.equal('blFadeY' in chars.dataset, false);
    chars.scrollHeight = 2000; chars.mo.cb([{ type: 'childList', target: chars }]); flush(); assert.equal(chars.dataset.blFadeY, 'bottom');
    assert.equal(chars.mo.opts.subtree, undefined, '자식만 — subtree 감시 아님');
});
await test('확장 설정 서랍 안에서 누르면 애니메이션 뒤 그 서랍만 다시 훑어 새로 보이는 접힘 칸을 묶어요', async () => {
    drawer.clientHeight = 600; drawer.scrollHeight = 1400; drawer.overflowY = 'auto';
    const inline = add(drawer, el(['#rm_extensions_block .inline-drawer-content', '.inline-drawer-content'], { clientHeight: 240, scrollHeight: 900 }));
    assert.equal(fade.has(inline), false);
    drawer.fire('click'); await sleep(520); flush();
    assert.ok(fade.has(inline)); assert.equal(inline.dataset.blFadeY, 'bottom');
    assert.equal(drawer.opts.click.capture, true, '설정 창처럼 안쪽 처리기가 전파를 멈춰도 받게 capture'); assert.equal(doc.opts.click.capture, true); assert.equal(doc.opts.scroll.passive, true); assert.equal(doc.opts.scroll.capture, true, 'scroll 은 거품이 없어 capture');
});
await test('바이바이가 켜지면 월드인포 목록만 떼고(속성도), 꺼지면 다시 묶어요', () => {
    baibai = true; fade.refreshResting(); assert.equal(fade.has(wi), false); assert.equal('blFadeY' in wi.dataset, false); assert.ok(fade.has(chars));
    baibai = false; fade.refreshResting(); flush(); assert.ok(fade.has(wi)); assert.equal(wi.dataset.blFadeY, 'bottom');
});
await test('새 팝업을 scan(dialog) 으로 얹으면 그 안의 본문만 묶고, 떨어진 칸은 정리돼요', () => {
    const dialog = el(['dialog.popup']); const content = add(dialog, el(['dialog.popup .popup-content'], { scrollHeight: 700 })); add(dialog, el(['textarea']));
    add(body, dialog); assert.equal(fade.scan(dialog), 1); flush(); assert.equal(content.dataset.blFadeY, 'bottom');
    const before = fade.size(); dialog.isConnected = false; content.isConnected = false; body.children = body.children.filter(c => c !== dialog); fade.scan(doc);
    assert.equal(fade.size(), before - 1); assert.equal(fade.has(content), false);
});
await test('(8.2.7) 묶인 칸이 여럿이어도 자식 감시자는 하나 · 칸마다 scroll · click 리스너를 따로 걸지 않아요', () => {
    assert.ok(fade.size() >= 4);
    assert.equal(FakeMO.made, 1, '감시자 하나');
    assert.equal((chars.listeners.scroll || []).length + (chars.listeners.click || []).length, 0, '칸에는 리스너 없음');
});
await test('(8.2.7) ResizeObserver 가 상자 없음(높이 0)이라고 알리면 그 칸은 재지 않고 비워 두고, 다시 생기면 재요', () => {
    const box = add(body, el(['#rm_print_characters_block'], { scrollHeight: 900 }));
    fade.bind(box); flush(); assert.equal(box.dataset.blFadeY, 'bottom');
    let reads = 0; const real = box.scrollHeight; Object.defineProperty(box, 'scrollHeight', { configurable: true, get() { reads++; return real; } });
    FakeRO.last.cb([{ target: box, borderBoxSize: [{ blockSize: 0, inlineSize: 0 }] }]); flush();
    assert.equal(reads, 0, '숨은 칸은 안 읽어요'); assert.equal('blFadeY' in box.dataset, false, '숨으면 뗌');
    box.mo.cb([{ type: 'childList', target: box }]); box.fire('click'); flush(); assert.equal(reads, 0, '숨은 동안 자식 변화 · 누름에도 안 읽어요');
    FakeRO.last.cb([{ target: box, borderBoxSize: [{ blockSize: 200, inlineSize: 300 }] }]); flush();
    assert.ok(reads > 0); assert.equal(box.dataset.blFadeY, 'bottom');
    fade.unbind(box);
});
await test('(8.2.7) 묶을 때 상자가 없는 칸(닫힌 서랍)은 열릴 때까지 getComputedStyle 도 넘침도 읽지 않고, 열리면(ResizeObserver) 그 자리에서 재요', () => {
    const real = win.getComputedStyle; let styleReads = 0; win.getComputedStyle = n => { styleReads++; return real(n); };
    const closed = add(body, el(['.drawer-content'], { clientHeight: 0, scrollHeight: 0, overflowY: 'hidden' }));
    fade.bind(closed); closed.mo.cb([{ type: 'childList', target: closed }]); flush(); flush();
    assert.equal(styleReads, 0, '닫힌 서랍은 안 읽어요'); assert.equal('blFadeY' in closed.dataset, false);
    closed.clientHeight = 500; closed.scrollHeight = 1500; closed.overflowY = 'auto'; FakeRO.last.cb([{ target: closed, borderBoxSize: [{ blockSize: 500, inlineSize: 300 }] }]);
    assert.equal(closed.dataset.blFadeY, 'bottom', '알림 자리에서 바로(다음 프레임을 안 기다림)'); assert.ok(styleReads > 0);
    assert.equal(FakeRO.last.opts?.box, 'border-box');
    win.getComputedStyle = real; fade.unbind(closed);
});
await test('(8.2.7) 한 프레임의 여러 칸은 전부 읽은 다음에 써요(읽기 · 쓰기가 번갈지 않음)', () => {
    const log = []; const boxes = [0, 1, 2].map(() => add(body, el(['.bl-notice-body'], { scrollHeight: 900 })));
    for (const b of boxes) { const h = b.scrollHeight; Object.defineProperty(b, 'scrollHeight', { configurable: true, get() { log.push('r'); return h; } }); const ds = {}; b.dataset = new Proxy(ds, { set(t, k, v) { log.push('w'); t[k] = v; return true; } }); fade.bind(b); }
    log.length = 0; flush();
    assert.ok(log.length >= 6); assert.equal(log.join('').replace(/r+w+/, ''), '', '읽기 다 → 쓰기 다: ' + log.join(''));
    for (const b of boxes) { assert.equal(b.dataset.blFadeY, 'bottom'); fade.unbind(b); }
});
const cssRules = css => css.replace(/\/\*[\s\S]*?\*\//g, '').split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.includes('{'));
await test('CSS: 세로 흐림은 data-bl-fade-y 로(가로 data-bl-fade 와 따로) · 모두 mask(스크롤 칸 안에 가상 요소 없음) · 끄기 길 같음 · 스크롤바 규칙은 안 건드림', () => {
    const css = fs.readFileSync(path.join(root, 'css/73-scroll-fade.css'), 'utf8');
    for (const side of ['top', 'bottom', 'both']) assert.ok(css.includes(`[data-bl-fade-y="${side}"]`), side);
    const rules = cssRules(css);
    const masks = rules.filter(l => /mask-image: linear-gradient/.test(l));
    assert.equal(masks.length, 3, 'mask 규칙은 넘친 쪽 셋');
    for (const line of masks) assert.doesNotMatch(line, /(?:font(?:-size|-family|-weight)?|(?:min-)?height)\s*:|::(before|after)|position: sticky/);
    // 스크롤 칸(서랍 포함) 안에 가상 요소를 두면 있기만 해도 스크롤에 긴 작업이 생긴다(리그 10-29 · 10-30) · #top-settings-holder 의 가상 요소는 서랍 안이 바뀔 때마다 다시 맞춰져
    //   토글 · 서랍이 느려졌다(1.0.0 퇴행) — 이 파일에는 가상 요소가 하나도 없다(받침은 실제 요소 .bl-drawer-backing)
    for (const line of rules.filter(l => /::(before|after)/.test(l))) assert.fail('흐림 CSS 의 가상 요소 금지: ' + line.slice(0, 90));
    for (const line of rules.filter(l => /background:/.test(l))) assert.doesNotMatch(line, /#[0-9a-f]{3,8}|rgb|hsl/i, '바탕은 팔레트 변수만: ' + line.slice(0, 80));
    assert.doesNotMatch(css, /scrollbar/);
    assert.ok(css.includes('html:not(#bl-tab-scroll-off) body.salty [data-bl-fade-y]'));
    const built = fs.readFileSync(path.join(root, 'style.css'), 'utf8'); assert.ok(built.includes('[data-bl-fade-y="both"]'), 'style.css 에 들어감');
    const lazy = fs.existsSync(path.join(root, 'src/style-lazy.gen.css')) ? fs.readFileSync(path.join(root, 'src/style-lazy.gen.css'), 'utf8') : '';
    assert.ok((built + lazy).includes('#top-settings-holder > .bl-drawer-backing') && (built + lazy).includes('anchor-name: --bl-drawer'), '만든 CSS 에 서랍 받침도 들어감');
    assert.ok(!(built + lazy).includes('#top-settings-holder::after'), '만든 CSS 에 옛 받침 가상 요소가 없음');
});
await test('CSS: 흐림 영역에서 칸의 바탕이 투명해지지 않는다 — 자기 바탕을 칠하는 서랍 뒤에 같은 자리(앵커 위치) · 같은 색(01-smear 의 서랍 바탕 식)의 받침, 앵커가 없는 브라우저는 서랍 흐림만 끔', () => {
    const css = fs.readFileSync(path.join(root, 'css/73-scroll-fade.css'), 'utf8');
    const smear = fs.readFileSync(path.join(root, 'css/01-smear-topbar-drawers.css'), 'utf8');
    const sheet = /body\.salty \.drawer-content \{[^}]*background:\s*(var\([^;]*\))\s*!important/.exec(smear);
    assert.ok(sheet, '01-smear 의 서랍 바탕 규칙');
    const rules = cssRules(css);
    const anchor = rules.find(l => /anchor-name: --bl-drawer;/.test(l) && !l.startsWith('@supports'));
    assert.ok(anchor, '서랍에 앵커 이름'); assert.match(anchor, /#top-settings-holder \.drawer-content:is\(\[data-bl-fade-y="top"\], \[data-bl-fade-y="bottom"\], \[data-bl-fade-y="both"\]\)/, '위 막대 묶음 안 · 넘친 서랍만(off 값 제외)');
    const backdrop = rules.find(l => /#top-settings-holder > \.bl-drawer-backing \{/.test(l));
    assert.ok(backdrop, '받침 규칙');
    assert.match(backdrop, /display: block/); assert.match(backdrop, /position: fixed/); assert.match(backdrop, /z-index: -1/); assert.match(backdrop, /pointer-events: none/);
    assert.ok(backdrop.includes(`background: ${sheet[1]}`), `받침 색 = 서랍 바탕 식 ${sheet[1]}`);
    for (const side of ['top', 'left']) assert.ok(backdrop.includes(`${side}: anchor(--bl-drawer ${side}, 0px)`), side + ' 는 서랍 자리');
    for (const dim of ['width', 'height']) assert.ok(backdrop.includes(`${dim}: anchor-size(--bl-drawer ${dim}, 0px)`), dim + ' 는 서랍 크기 · 넘친 서랍이 없으면 0');
    assert.match(backdrop, /border-radius: 0 0 var\(--bl-r-lg\) var\(--bl-r-lg\)/, '서랍 아래 둥글기와 같게');
    assert.doesNotMatch(backdrop, /box-shadow|transition|will-change/, '받침은 바탕만(그림자를 겹치지 않음 · 층을 만들지 않음)');
    // 두 규칙 다 앵커 위치 @supports 안, 폴백(@supports not)은 서랍 mask 를 끈다
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');   // 머리 주석에도 같은 말이 있어 위치는 주석을 뺀 글에서 본다
    const sup = bare.indexOf('@supports (anchor-name: --bl-drawer)'), nsup = bare.indexOf('@supports not ((anchor-name: --bl-drawer)');
    assert.ok(sup > 0 && nsup > sup, '@supports 두 묶음');
    assert.ok(bare.indexOf('anchor-name: --bl-drawer;') > sup && bare.indexOf('.bl-drawer-backing') > sup && bare.indexOf('.bl-drawer-backing') < nsup, '받침이 보이는 규칙(display: block)은 앵커 위치 @supports 안에만 — 밖에서는 hidden 그대로');
    const off = rules.find(l => /\.drawer-content\[data-bl-fade-y\] \{/.test(l) && /mask-image: none/.test(l));
    assert.ok(off && bare.indexOf(off) > nsup, '앵커 없는 브라우저: 서랍 흐림 끔');
    // 다른 모듈이 같은 앵커 이름 · 받침을 쓰지 않고, 어느 모듈도 #top-settings-holder 에 가상 요소를 두지 않는다(1.0.0 퇴행 — 서랍 안이 바뀔 때마다 다시 맞춰짐)
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css'))) {
        const text = fs.readFileSync(path.join(root, 'css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.doesNotMatch(text, /#top-settings-holder(?:[.:#\[][^\s,{>~+]*)?::(?:before|after)/, f + ' 가 #top-settings-holder 에 가상 요소를 둬요');
        if (!f.startsWith('73-')) assert.doesNotMatch(text, /bl-drawer-backing|anchor-name: --bl-drawer/, f + ' 가 받침을 써요');
    }
});
await test('받침 요소: #top-settings-holder 맨 끝에 hidden · aria-hidden 으로 한 번만 붙고, 묶음이 없으면 아무것도 안 해요', () => {
    const made = [];
    const holder = { children: [], append(c) { this.children.push(c); } };
    const fakeDoc = { getElementById: id => id === 'top-settings-holder' ? holder : null, createElement: tag => { const attrs = {}; const c = { tag, className: '', hidden: false, attrs, setAttribute: (k, v) => { attrs[k] = v; }, classList: { contains: n => c.className.split(' ').includes(n) } }; made.push(c); return c; } };
    const el = M.ensureDrawerBacking(fakeDoc);
    assert.equal(el.tag, 'div'); assert.equal(el.className, M.BACKING_CLASS); assert.equal(el.hidden, true); assert.equal(el.attrs['aria-hidden'], 'true');
    assert.equal(holder.children.at(-1), el, '맨 끝(옛 ::after 와 같은 쌓임 차례)');
    assert.equal(M.ensureDrawerBacking(fakeDoc), el, '두 번째는 같은 요소'); assert.equal(made.length, 1);
    assert.equal(M.ensureDrawerBacking({ getElementById: () => null, createElement: () => assert.fail('묶음이 없으면 안 만든다') }), null);
    assert.equal(M.ensureDrawerBacking(null), null);
});
await test('index.js: 팝업 감시자(onPopupAdded)에 얹고, 바이바이 감지로 월드인포만 쉬게 연결했어요', () => {
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    assert.match(index, /installScrollFade\(document/); assert.match(index, /onPopupAdded\(dialog => \{ fade\.scan\(dialog\)/); assert.match(index, /presence\.onChange\(\(\) => fade\.refreshResting\(\)\)/);
    const guard = fs.readFileSync(path.join(root, 'src/popup-guard.js'), 'utf8'); assert.match(guard, /export function onPopupAdded/);
});
console.log(`스크롤 흐림: ${pass}개 통과했어요.`);
