// 9.0.4 메시지 꾸미기 한 함수(src/message-decor.js) 계약 — 조판 · 글자색 · 아이콘 표식 · 데우스 하늘 · 감정 대사가 #chat 을 따로 보던 감시자 다섯을 묶은 것
//   ① 메시지 이벤트(그려짐 · 고침 · 스와이프)는 다음 프레임에 그 메시지만 한 번 — 같은 변화로 적어 둔 이벤트 밖 몫은 지워요(두 번 안 꾸밈)
//   ② 이벤트 없는 변화(번역 · 다른 확장)는 꾸미기마다 조용한 시간(settle) 뒤 한 번 · 번역 진행 표시(.llmt-progress) 안 글은 안 셈
//   ③ 답이 오는 동안(body[data-generating])은 미뤘다가 끝나면 한 번 — live 꾸미기만 바로
//   ④ CHAT_CHANGED 는 채팅 전체 · MORE_MESSAGES_LOADED 는 새로 붙은 메시지만
//   ⑤ 꾸미기가 만든 변화로 다시 꾸미지 않아요(quiet) · 차례(order) · filter · kinds
//   ⑥ 다 끊으면 #chat 감시 · 이벤트 리스너가 남지 않아요
//   node tools/tests/message-decor.mjs <테마 루트>   (가짜 브라우저 tools/tests/leak-dom.mjs)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
const { eventSource, event_types: T } = dom.installBrowser({});
const { addMessageDecorator, messageDecorStats } = await import(pathToFileURL(path.join(root, 'src/message-decor.js')).href);
const { domWatchStats } = await import(pathToFileURL(path.join(root, 'src/dom-watch.js')).href);
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const chat = document.getElementById('chat');
const msgs = [0, 1, 2].map(i => dom.messageElement(i));
chat.append(...msgs);
await dom.clock.advance(50);
const ids = list => list.map(m => m.getAttribute('mesid')).join(',');
const listeners0 = eventSource.count();

await test('① 이벤트는 다음 프레임에 그 메시지만 한 번 — 같은 변화의 이벤트 밖 몫은 지워요', async () => {
    const got = [];
    const off = addMessageDecorator('A', (list, kind) => got.push(kind + ':' + ids(list)), { settle: 120 });
    // 실리태번처럼: 메시지 본문을 다시 그리고(이벤트 밖 변화로도 잡힘) 같은 작업 안에서 이벤트
    msgs[1].querySelector('.mes_text').innerHTML = '<p>고친 글</p>';
    await eventSource.emit(T.MESSAGE_UPDATED, 1);
    await dom.clock.advance(20);
    assert.deepEqual(got, ['event:1'], '다음 프레임에 그 메시지만');
    await dom.clock.advance(300);
    assert.deepEqual(got, ['event:1'], '조용한 시간 뒤에 또 꾸미지 않아요');
    off();
});

await test('② 이벤트 없는 변화는 조용한 시간 뒤 한 번 · 진행 표시 안 글은 안 셈', async () => {
    const got = [];
    const off = addMessageDecorator('B', (list, kind) => got.push(kind + ':' + ids(list)), { settle: 120 });
    const text = msgs[2].querySelector('.mes_text');
    text.append(dom.documentLite.createElement('span'));
    await dom.clock.advance(60);
    text.append(dom.documentLite.createElement('span'));   // 조용한 시간을 뒤로 밀어요
    await dom.clock.advance(100);
    assert.deepEqual(got, [], '아직 조용하지 않아요');
    await dom.clock.advance(40);
    assert.deepEqual(got, ['dom:2'], '마지막 변화 120ms 뒤 한 번');
    const badge = dom.documentLite.createElement('div'); badge.className = 'llmt-progress'; text.append(badge);
    await dom.clock.advance(200); got.length = 0;
    badge.textContent = '번역 중 3초'; badge.textContent = '번역 중 4초';
    await dom.clock.advance(300);
    assert.deepEqual(got, [], '진행 표시 안 글 변화는 메시지 변화가 아니에요');
    badge.remove(); await dom.clock.advance(300);
    off();
});

await test('③ 답이 오는 동안은 미뤘다가 끝나면 한 번 — live 꾸미기만 바로', async () => {
    const slow = [], live = [];
    const offS = addMessageDecorator('느린', list => slow.push(ids(list)), { settle: 120 });
    const offL = addMessageDecorator('바로', list => live.push(ids(list)), { settle: 0, live: true });
    document.body.setAttribute('data-generating', 'true');
    for (let i = 0; i < 4; i++) { msgs[2].querySelector('.mes_text').innerHTML = `<p>조각 ${i}</p>`; await dom.clock.advance(200); }
    assert.deepEqual(slow, [], '느린 꾸미기는 미뤄요');
    assert.ok(live.length >= 3 && live.every(x => x === '2'), `live 는 바로(${live.length}번)`);
    document.body.removeAttribute('data-generating');
    await dom.clock.advance(200);
    assert.deepEqual(slow, ['2'], '끝나면 한 번');
    offS(); offL();
});

await test('④ CHAT_CHANGED 는 채팅 전체 · MORE_MESSAGES_LOADED 는 새로 붙은 것만', async () => {
    const got = [];
    const off = addMessageDecorator('C', (list, kind) => got.push(kind + ':' + ids(list)), { settle: 400 });
    await eventSource.emit(T.CHAT_CHANGED, 'chat-0');
    await dom.clock.advance(20);
    assert.deepEqual(got, ['chat:0,1,2']);
    got.length = 0;
    const older = dom.messageElement(9); chat.prepend(older);
    await dom.clock.advance(5);
    await eventSource.emit(T.MORE_MESSAGES_LOADED);
    await dom.clock.advance(20);
    assert.deepEqual(got, ['event:9'], '새로 붙은 메시지만 다음 프레임에');
    await dom.clock.advance(500);
    assert.deepEqual(got, ['event:9'], '조용한 시간 뒤 또 안 꾸밈');
    older.remove(); await dom.clock.advance(500);
    off();
});

await test('⑤ 꾸미기가 만든 변화로 다시 꾸미지 않아요 · 차례 · filter · kinds', async () => {
    const order = [];
    const offA = addMessageDecorator('뒤', () => order.push('뒤'), { order: 90 });
    const offB = addMessageDecorator('앞', list => { order.push('앞'); for (const m of list) m.querySelector('.mes_text').append(dom.documentLite.createElement('i')); }, { order: 10 });
    const offC = addMessageDecorator('본문 통째', () => order.push('통째'), { kinds: ['dom'], filter: r => r.target.classList?.contains('mes_text') });
    await eventSource.emit(T.CHARACTER_MESSAGE_RENDERED, 0);
    await dom.clock.advance(20);
    assert.deepEqual(order, ['앞', '뒤'], '차례대로 · dom 만 받는 꾸미기는 이벤트에 안 불려요');
    await dom.clock.advance(300);
    assert.deepEqual(order, ['앞', '뒤'], '앞 꾸미기가 붙인 <i> 로 다시 꾸미지 않아요');
    msgs[0].querySelector('.mes_text p').append(dom.documentLite.createElement('b'));   // 본문 통째가 아닌 안쪽 변화
    await dom.clock.advance(20);
    assert.ok(!order.includes('통째'), 'filter 가 거른 기록은 안 셈');
    msgs[0].querySelector('.mes_text').innerHTML = '<p>번역</p>';
    await dom.clock.advance(20);
    assert.ok(order.includes('통째'), '본문이 통째로 바뀌면');
    offA(); offB(); offC();
});

await test('⑥ 다 끊으면 #chat 감시 · 이벤트 리스너가 남지 않아요', async () => {
    const offs = [addMessageDecorator('x', () => {}), addMessageDecorator('y', () => {}, { settle: 400 })];
    assert.equal(messageDecorStats().started, true);
    for (const off of offs) off();
    assert.equal(messageDecorStats().started, false);
    assert.equal(domWatchStats().subscriptions, 0, '허브 구독 0');
    assert.equal(eventSource.count(), listeners0, '이벤트 리스너도 처음과 같아요');
});

console.log(`메시지 꾸미기: ${pass}개 통과했어요.`);
process.exit(0);
