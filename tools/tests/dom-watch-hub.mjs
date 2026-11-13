// 9.0.4 감시 허브 계약(src/dom-watch.js 구역 · 한 프레임 묶음 · 거르개 · quiet · 누수 없음)
//   ① html · body · #chat 뿌리의 subtree 구독은 문서마다 감시자 하나 — exclude:'#chat' 구독만 있으면 #chat 가지에는 감시를 걸지 않아요(기록조차 안 생김)
//   ② body · #sheld 바로 아래 새 가지는 다시 걸고, 빠진 가지는 떼요(떨어진 노드를 보는 등록이 남지 않음 — 1.4.x 부터 떼기는 한가할 때)
//   ③ html 바로 아래(body 밖) 창은 html 뿌리 구독만 받아요
//   ④ 'frame' 구독은 뿌리가 달라도 rAF 하나에 만든 순서대로 · 숨은 탭은 타이머로도
//   ⑤ quiet(): 콜백 안에서 내가 바꾼 기록은 나만 버리고 다른 구독은 받아요
//   ⑥ match · exclude(선택자) 거르개 ⑦ 다 끊으면 감시자 0 · 등록 0
//   ⑧ (1.1.4) 묶음에 받을 종류가 없는 구독은 건너뛰어도 받는 기록 · 차례는 같아요 ⑨ (1.1.4) 구독별 · 허브 비용 통계와 묶음 밖에서 읽는 길
//   node tools/tests/dom-watch-hub.mjs <테마 루트>   (가짜 브라우저 tools/tests/leak-dom.mjs)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({});
const { watchDom, domWatchStats } = await import(pathToFileURL(path.join(root, 'src/dom-watch.js')).href);
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const tick = async () => { for (let i = 0; i < 8; i++) await null; };
let made = 0;
const RealMO = globalThis.MutationObserver;
const observed = [];   // [노드, 옵션] — 감시자가 건 등록
globalThis.MutationObserver = class extends RealMO {
    constructor(cb) { super(cb); made++; }
    observe(node, opts) { observed.push([node, opts]); return super.observe(node, opts); }
};
const body = document.body, html = document.documentElement;
const chat = document.getElementById('chat'), sheld = document.getElementById('sheld'), form = document.getElementById('form_sheld');
assert.ok(chat && sheld && form && chat.parentElement === sheld && sheld.parentElement === body, '가짜 문서 뼈대: body > #sheld > #chat · #form_sheld');
const baseline = dom.observerCounts().mo;
await tick();

await test('① body(#chat 밖) · #chat · body 전체 구독은 감시자 하나 — #chat 밖 구독만 있을 때는 #chat 가지를 걸지 않아요', async () => {
    const before = made;
    const out = [], inChat = [], all = [];
    observed.length = 0;
    const offOut = watchDom(body, { childList: true, subtree: true, attributes: ['class'], exclude: '#chat', name: '밖' }, r => out.push(...r));
    assert.equal(made - before, 1, '감시자 하나');
    assert.ok(!observed.some(([n, o]) => o.subtree && (n === body || n === sheld || n === chat || n.contains(chat))), '#chat 을 품은 노드에는 subtree 를 걸지 않아요');
    assert.ok(observed.some(([n, o]) => n === form && o.subtree), '#sheld 의 다른 자식(#form_sheld)은 통째로');
    assert.ok(observed.some(([n, o]) => n === body && !o.subtree && o.childList), 'body 는 자기 자신만(자식 추가 · 속성)');
    const mes = document.createElement('div'); mes.className = 'mes'; chat.append(mes); mes.append(document.createElement('span'));
    await tick();
    assert.equal(out.length, 0, '#chat 안 변화는 #chat 밖 구독에 안 와요');
    const offChat = watchDom(chat, { childList: true, subtree: true, name: '채팅' }, r => inChat.push(...r));
    const offAll = watchDom(body, { childList: true, subtree: true, name: '전체' }, r => all.push(...r));
    assert.equal(made - before, 1, '#chat 구독 · body 전체 구독도 같은 감시자');
    mes.append(document.createElement('b'));
    form.append(document.createElement('i'));
    body.classList.add('hub-test');
    await tick();
    assert.equal(inChat.length, 1, '#chat 구독은 #chat 안만'); assert.equal(inChat[0].target, mes);
    assert.deepEqual(all.map(r => r.target), [mes, form], 'body 전체 구독은 둘 다(속성은 안 원함)');
    assert.deepEqual(out.map(r => r.type + ':' + (r.target.id || r.target.localName)), ['childList:form_sheld', 'attributes:body'], '#chat 밖 구독은 #form_sheld · body class');
    offOut(); offChat(); offAll(); body.classList.remove('hub-test');
    assert.equal(domWatchStats().zones, 0, '다 끊으면 구역 감시자도 없어요');
});

await test('② body 바로 아래 새 가지는 다시 걸고, 빠진 가지는 떼요', async () => {
    const got = [];
    const off = watchDom(body, { childList: true, subtree: true, exclude: '#chat', name: '가지' }, r => got.push(...r));
    const pop = document.createElement('dialog'); body.append(pop);
    await tick();
    pop.append(document.createElement('p'));   // 붙은 뒤 다음 작업에서 안쪽이 바뀜
    await tick();
    assert.deepEqual(got.map(r => r.target.localName), ['body', 'dialog'], '새 가지 안 변화도 받아요');
    observed.length = 0;
    pop.remove();
    await tick(); await tick();
    // 1.4.x opt-chat-open: 빠지기만 한 가지는 그 자리에서 다시 걸지 않고(채팅 여는 도중 알림이 사라질 때마다 observe 수십 번) 한가할 때 한 번에 떼요
    assert.equal(observed.length, 0, '빠진 그 자리에서는 감시를 다시 걸지 않아요');
    got.length = 0;
    pop.append(document.createElement('p'));
    await tick();
    assert.equal(got.length, 0, '떼기 전에도 떨어진 창 안 변화는 안 와요');
    await dom.clock.advance(50); await tick();
    assert.ok(observed.length > 0, '한가할 때 다시 걸어요');
    assert.equal(dom.observerCounts().moDetached, 0, '떨어진 창을 보는 등록이 남지 않아요');
    got.length = 0;
    pop.append(document.createElement('p'));
    await tick();
    assert.equal(got.length, 0, '떨어진 창 안 변화는 안 와요');
    off();
});

await test('③ html 바로 아래(body 밖) 창은 html 뿌리 구독만 받아요', async () => {
    const h = [], b = [];
    const offH = watchDom(html, { childList: true, subtree: true, exclude: ['#chat', 'head'], name: 'html' }, r => h.push(...r));
    const offB = watchDom(body, { childList: true, subtree: true, exclude: '#chat', name: 'body' }, r => b.push(...r));
    const win = document.createElement('div'); win.id = 'fruit-heart-test'; html.append(win);
    await tick();
    win.append(document.createElement('span'));
    document.head.append(document.createElement('style'));
    await tick();
    assert.deepEqual(h.map(r => r.target.localName + (r.target.id ? '#' + r.target.id : '')), ['html', 'div#fruit-heart-test'], 'html 아래 창 · 그 안(head 는 뺌)');
    assert.equal(b.length, 0, 'body 구독은 body 밖을 안 받아요');
    offH(); offB(); win.remove(); await tick();
});

await test("④ 'frame' 구독은 뿌리가 달라도 rAF 하나에 만든 순서대로 — 숨은 탭은 타이머로도", async () => {
    const order = []; let rafs = 0;
    const realRaf = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = fn => { rafs++; return realRaf(fn); };
    const offA = watchDom(chat, { childList: true, subtree: true, when: 'frame', name: 'A' }, r => order.push('A' + r.length));
    const offB = watchDom(body, { attributes: ['class'], when: 'frame', name: 'B' }, r => order.push('B' + r.length));
    const offC = watchDom(form, { childList: true, subtree: true, when: 'frame', name: 'C' }, r => order.push('C' + r.length));
    form.append(document.createElement('i')); body.classList.add('f1'); chat.append(document.createElement('div')); chat.append(document.createElement('div'));
    await tick();
    assert.equal(order.length, 0, '프레임 전에는 안 불러요');
    assert.equal(rafs, 1, 'rAF 는 하나');
    await dom.clock.advance(20);
    assert.deepEqual(order, ['A2', 'B1', 'C1'], '만든 순서대로 한 번씩 · 그 사이 기록을 모아서');
    document._hiddenTab = true; order.length = 0; globalThis.requestAnimationFrame = () => 0;   // 숨은 탭: rAF 가 안 돌아요
    chat.append(document.createElement('div')); await tick();
    await dom.clock.advance(300);
    assert.deepEqual(order, ['A1'], '숨은 탭은 타이머로');
    document._hiddenTab = false; globalThis.requestAnimationFrame = realRaf;
    offA(); offB(); offC(); body.classList.remove('f1'); await dom.clock.advance(20);
});

await test('⑤ quiet(): 콜백 안에서 내가 바꾼 기록은 나만 버려요', async () => {
    const mine = [], other = [];
    let off = null;
    off = watchDom(chat, { childList: true, subtree: true, name: '꾸미기' }, r => {
        mine.push(...r);
        for (const rec of r) for (const n of rec.addedNodes) if (n.nodeType === 1 && n.className === 'mes') n.append(document.createElement('em'));
        off.quiet();
    });
    const offOther = watchDom(chat, { childList: true, subtree: true, name: '다른' }, r => other.push(...r));
    const mes = document.createElement('div'); mes.className = 'mes'; chat.append(mes);
    await tick(); await tick();
    assert.equal(mine.length, 1, '내 변화(em)는 안 와요');
    assert.equal(other.length, 2, '다른 구독은 mes · em 둘 다');
    off(); offOther();
});

await test('⑤-2 quiet() 는 그 구독 콜백이 만든 기록만 버려요 — 앞서 부른 구독이 같은 때 만든 변화는 받아요', async () => {
    const seenB = [];
    const offA = watchDom(chat, { childList: true, subtree: true, name: '앞' }, r => {
        for (const rec of r) for (const n of rec.addedNodes) if (n.className === 'mes2') n.append(document.createElement('u'));   // 앞 구독이 바꿈
    });
    let offB = null;
    offB = watchDom(chat, { childList: true, subtree: true, name: '뒤' }, r => {
        seenB.push(...r.map(x => [...x.addedNodes].map(n => n.localName).join(',')));
        for (const rec of r) for (const n of rec.addedNodes) if (n.className === 'mes2') n.append(document.createElement('s'));   // 뒤 구독이 바꿈
        offB.quiet();
    });
    const mes = document.createElement('div'); mes.className = 'mes2'; chat.append(mes);
    await tick(); await tick();
    assert.deepEqual(seenB, ['div', 'u'], '앞 구독의 <u> 는 받고, 내 <s> 는 안 받아요');
    offA(); offB(); mes.remove(); await tick();
});

await test('⑥ match · exclude(선택자) 거르개', async () => {
    const m = [], x = [];
    const drawer = document.createElement('div'); drawer.className = 'drawer-content'; document.getElementById('left-nav-panel').append(drawer);
    await tick();
    const offM = watchDom(body, { childList: true, subtree: true, exclude: '#chat', match: '.drawer-content', name: 'match' }, r => m.push(...r));
    const offX = watchDom(body, { childList: true, subtree: true, exclude: ['#chat', '.drawer-content'], name: 'exclude' }, r => x.push(...r));
    drawer.append(document.createElement('p')); document.getElementById('top-bar').append(document.createElement('p'));
    await tick();
    assert.deepEqual(m.map(r => r.target.className), ['drawer-content']);
    assert.deepEqual(x.map(r => r.target.id), ['top-bar']);
    offM(); offX();
});

await test('⑦ 다 끊으면 감시자 0 · 등록 0 (누수 없음)', async () => {
    const offs = [];
    for (let i = 0; i < 20; i++) offs.push(watchDom(i % 2 ? chat : body, { childList: true, subtree: true, when: i % 3 ? 'frame' : 'now', exclude: i % 4 ? '#chat' : undefined }, () => {}));
    offs.push(watchDom(body, { attributes: ['class'] }, () => {}));
    chat.append(document.createElement('div')); body.classList.add('z'); await tick();
    for (const off of offs) off();
    await dom.clock.advance(20);
    const s = domWatchStats();
    assert.equal(s.observers, 0, '감시자 0'); assert.equal(s.subscriptions, 0, '구독 0');
    assert.equal(dom.observerCounts().mo, baseline, '붙은 등록도 처음과 같아요');
    body.classList.remove('z');
});

await test('⑧ (1.1.4) 받을 종류가 없는 구독은 기록을 따지지 않고 건너뛰어요 — 받는 기록 · 차례는 예전과 같아요', async () => {
    const got = { kids: [], cls: [], text: [], out: [], both: [] };
    const offs = [
        watchDom(chat, { childList: true, subtree: true, name: '자식만' }, r => got.kids.push(...r.map(x => x.type))),
        watchDom(chat, { attributes: ['class'], subtree: true, name: '속성만' }, r => got.cls.push(...r.map(x => x.type + ':' + x.attributeName))),
        watchDom(chat, { characterData: true, subtree: true, name: '글자만' }, r => got.text.push(...r.map(x => x.type))),
        watchDom(body, { childList: true, subtree: true, attributes: ['class'], exclude: '#chat', name: '채팅 밖' }, r => got.out.push(...r.map(x => x.type))),
        watchDom(body, { childList: true, subtree: true, attributes: ['class', 'id'], name: '채팅 포함' }, r => got.both.push(...r.map(x => x.type + '@' + (chat.contains(x.target) ? 'chat' : 'body')))),
    ];
    const mes = document.createElement('div'); mes.className = 'mes'; chat.append(mes);
    await tick();
    assert.deepEqual(got.kids, ['childList'], '자식 목록 묶음: 자식만 구독이 받아요');
    assert.deepEqual(got.cls, [], '속성만 구독은 자식 목록 묶음을 안 받아요');
    assert.deepEqual(got.text, [], '글자만 구독도');
    assert.deepEqual(got.out, [], '채팅 밖 구독은 채팅 묶음을 안 받아요');
    assert.deepEqual(got.both, ['childList@chat']);
    mes.classList.add('last_mes'); mes.id = 'm1';
    await tick();
    assert.deepEqual(got.cls, ['attributes:class'], '속성 묶음: class 만(같은 묶음의 id 는 속성만 구독이 원하지 않았어요)');
    assert.deepEqual(got.kids, ['childList'], '자식만 구독은 속성 묶음을 안 받아요');
    assert.deepEqual(got.both, ['childList@chat', 'attributes@chat', 'attributes@chat']);
    const text = document.createTextNode('가'); mes.append(text);
    await tick();
    text.data = '가나';
    form.classList.add('busy');
    mes.append(document.createElement('p'));
    await tick();
    assert.deepEqual(got.text, ['characterData'], '섞인 묶음에서도 글자 기록만');
    assert.deepEqual(got.kids, ['childList', 'childList', 'childList'], '섞인 묶음에서도 자식 목록 기록만 · 차례 그대로');
    assert.deepEqual(got.out, ['attributes'], '채팅 밖 구독은 섞인 묶음에서 채팅 밖 기록만');
    assert.deepEqual(got.both.slice(3), ['childList@chat', 'attributes@body', 'childList@chat'], '둘 다 보는 구독은 기록 차례 그대로(글자 기록은 안 원함)');
    for (const off of offs) off();
    form.classList.remove('busy'); mes.remove();
    await tick();
});

await test('⑨ (1.1.4) 비용 통계: 구독마다 이름 · 횟수 · 기록 수 · 콜백 시간, 허브의 묶음 수 · 기록 수 · 시간 — 묶음(dist) 밖에서는 전역 열쇠의 stats() 로 읽어요', async () => {
    const before = domWatchStats().hub;
    const off = watchDom(chat, { childList: true, subtree: true, name: '통계 보기' }, () => { let x = 0; for (let i = 0; i < 2e4; i++) x += i; return x; });
    const offOut = watchDom(body, { childList: true, subtree: true, exclude: '#chat', name: '통계 밖' }, () => {});
    chat.append(document.createElement('div')); chat.append(document.createElement('div'));
    await tick();
    const s = domWatchStats();
    const mine = s.each.find(e => e.name === '통계 보기'), other = s.each.find(e => e.name === '통계 밖');
    assert.ok(mine && other, '이름으로 찾아요');
    assert.equal(mine.calls, 1); assert.equal(mine.records, 2); assert.equal(mine.where, 'chat'); assert.equal(typeof mine.ms, 'number');
    assert.equal(other.calls, 0, '채팅 밖 구독은 불리지 않았어요'); assert.equal(other.where, 'body (#chat 밖)');
    assert.equal(s.hub.batches - before.batches, 1, '허브 묶음 하나');
    assert.equal(s.hub.records - before.records, 2);
    assert.ok(s.hub.ms >= before.ms, '허브 시간은 쌓여요');
    const viaGlobal = globalThis[Symbol.for('blue-lemonade.dom-watch.v2')].stats();
    assert.deepEqual(viaGlobal.each.map(e => e.name).sort(), s.each.map(e => e.name).sort(), '전역 열쇠의 stats() 가 같은 표를 줘요');
    assert.deepEqual(Object.keys(viaGlobal.hub), ['batches', 'records', 'ms']);
    off(); offOut();
    await tick();
});

console.log(`감시 허브 계약: ${pass}개 통과했어요.`);
process.exit(0);
