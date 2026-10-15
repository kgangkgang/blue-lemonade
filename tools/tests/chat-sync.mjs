// 6.7.0 다른 기기에서 바뀜 알림 — src/chat-sync.js
//   node tools/tests/chat-sync.mjs <테마 루트>
// 실리태번 · 브라우저 없이: 서버(/api/chats/recent)와 시계 · 타이머 · 묻는 창을 흉내 내고 감시 본체(createChatSync)만 돌린다.
// 인물 · 채팅 이름은 지어낸 것만 쓴다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
globalThis.location = { href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000' };
const S = await import(pathToFileURL(path.join(root, 'src/chat-sync.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const AVATAR = 'Mina.png', CHAT = 'Mina - 2026-10-15@10h00m00s';
const saveBody = (chat = CHAT, avatar = AVATAR) => JSON.stringify({ ch_name: 'Mina', file_name: chat, chat: [{ chat_metadata: { integrity: 'aaa' } }, { mes: '안녕' }], avatar_url: avatar, force: false });

/** 가짜 세계: 서버 파일 상태 · 타이머 · 묻는 창 답 */
function world({ answer = 'reload', hidden = false, integrity = 'aaa' } = {}) {
    // server: last_mes = 마지막 메시지 시각(실리태번이 돌려주는 값), mtime · bytes = 파일의 정확한 값 (/api/characters/get 의 date_last_chat · chat_size 로만 보임)
    const w = { server: { last_mes: 1000, file_size: '1.20kb', chat_items: 5, mes: '마지막 글', integrity, mtime: 50000, bytes: 1200 }, status: 200, calls: [], timers: [], now: 0, hidden, asked: 0, answer, strip: [], reloads: 0, busy: false, sends: 0 };
    w.ctx = { getCurrentChatId: () => CHAT, characterId: 0, characters: [{ avatar: AVATAR, chat: CHAT }], chatMetadata: { integrity: 'aaa' }, getRequestHeaders: () => ({ 'X-CSRF-Token': 't' }), reloadCurrentChat: async () => { w.reloads++; } };
    w.fetcher = async (url, init) => {
        const body = JSON.parse(init.body);
        w.calls.push({ url, body });
        if (w.status !== 200) return new Response('', { status: w.status });
        if (url === '/api/characters/get') return new Response(JSON.stringify({ avatar: body.avatar_url, date_last_chat: w.server.mtime, chat_size: w.server.bytes, description: '긴 카드 글' }), { status: 200 });
        const row = { file_name: `${CHAT}.jsonl`, avatar: AVATAR, last_mes: w.server.last_mes, file_size: w.server.file_size, chat_items: w.server.chat_items, mes: w.server.mes, ...(body.metadata ? { chat_metadata: { integrity: w.server.integrity } } : {}) };
        if (w.hold) await w.hold;   // 읽은 뒤 답이 늦게 오는 요청
        return new Response(JSON.stringify([row]), { status: 200 });
    };
    w.sync = S.createChatSync({
        getContext: () => w.ctx, fetcher: w.fetcher, now: () => w.now,
        setTimer: (fn, ms) => { const t = { fn, at: w.now + ms, done: false }; w.timers.push(t); return t; },
        clearTimer: (t) => { if (t) t.done = true; },
        hidden: () => w.hidden, ask: async () => { w.asked++; return w.answer; }, strip: (show) => w.strip.push(show), busy: () => w.busy,
    });
    /** 시계를 ms 만큼 돌리며 때가 된 타이머를 부른다 */
    w.tick = async (ms) => {
        const end = w.now + ms;
        for (;;) {
            const due = w.timers.filter(t => !t.done && t.at <= end).sort((a, b) => a.at - b.at)[0];
            if (!due) break;
            due.done = true; w.now = due.at; due.fn();
            await new Promise(r => setImmediate(r));
        }
        w.now = end;
        await new Promise(r => setImmediate(r));
    };
    w.save = (body = saveBody()) => w.sync.onSave('/api/chats/save', { method: 'POST', body }, async () => { w.sends++; w.server.last_mes += 500; w.server.chat_items++; w.server.mtime += 500; w.server.bytes += 100; return new Response('{}', { status: 200 }); });
    return w;
}
const stale = w => w.sync.state.stale;

await test('chatTarget · saveBodyKey · pickStat: 캐릭터 · 그룹 채팅 키가 저장 본문 키와 같다', () => {
    const t = S.chatTarget({ getCurrentChatId: () => CHAT, characterId: 0, characters: [{ avatar: AVATAR, chat: CHAT }] });
    assert.deepEqual(t, { file_name: `${CHAT}.jsonl`, avatar: AVATAR, key: `c|${AVATAR}|${CHAT}` });
    assert.equal(S.saveBodyKey('/api/chats/save', saveBody()), t.key);
    const g = S.chatTarget({ getCurrentChatId: () => 'group-1', groupId: 'g7' });
    assert.deepEqual(g, { file_name: 'group-1.jsonl', group: 'g7', key: 'g|group-1' });
    assert.equal(S.saveBodyKey('/api/chats/group/save', JSON.stringify({ id: 'group-1', chat: [] })), 'g|group-1');
    assert.equal(S.saveBodyKey('/api/chats/save', new Uint8Array(3)), null);   // 압축 본문은 못 읽음
    assert.equal(S.chatTarget({ getCurrentChatId: () => '' }), null);
    assert.deepEqual(S.pickStat([{ file_name: 'other.jsonl', avatar: AVATAR }], t), { missing: true });
    const p = S.pickStat([{ file_name: `${CHAT}.jsonl`, avatar: AVATAR, last_mes: 5, file_size: '1kb', chat_items: 2, mes: '비밀 글' }], t);
    assert.equal(p.items, 2);
    assert.ok(!JSON.stringify(p).includes('비밀'), '마지막 메시지 글은 지문만');
    const a = { last: '1', size: 'a', items: 1, mes: 'k' };
    assert.ok(S.chatChanged(a, { ...a, last: '2' }) && S.chatChanged(a, { ...a, mes: 'j' }) && S.chatChanged(a, { ...a, items: 2 }));
    assert.ok(!S.chatChanged(a, { ...a }));
    assert.ok(S.chatChanged(a, { missing: true }));
    // 정확한 값은 둘 다 있을 때만 비교
    assert.ok(!S.chatChanged({ ...a, charMtime: 1, charSize: 9 }, { ...a }));
    assert.ok(S.chatChanged({ ...a, charMtime: 1, charSize: 9 }, { ...a, charMtime: 2, charSize: 9 }));
    assert.ok(S.chatChanged({ ...a, charMtime: 1, charSize: 9 }, { ...a, charMtime: 1, charSize: 10 }));
    assert.equal(S.textKey('가나'), S.textKey('가나'));
    assert.notEqual(S.textKey('가나'), S.textKey('가다'));
});

await test('요청: 지금 채팅 하나만 pinned · max 0 으로 묻는다 (실리태번 머리 · CSRF 포함)', async () => {
    const w = world();
    w.sync.setOn(true);
    await w.tick(1600);
    assert.deepEqual(w.calls.map(c => c.url), ['/api/chats/recent', '/api/characters/get'], '기준 잡기는 정확한 값까지');
    assert.deepEqual(w.calls[0].body, { max: 0, pinned: [{ file_name: `${CHAT}.jsonl`, avatar: AVATAR }], metadata: false });
    assert.deepEqual(w.calls[1].body, { avatar_url: AVATAR });
    assert.equal(w.sync.state.base.charMtime, 50000);
    assert.equal(w.sync.state.base.items, 5);
    // 주기 확인은 ①만
    w.calls.length = 0;
    await w.tick(60000);
    assert.deepEqual(w.calls.map(c => c.url), ['/api/chats/recent']);
});

await test('다른 기기에서 바뀌면 띠가 뜨고, 다시 같은 값이면 그대로', async () => {
    const w = world();
    w.sync.setOn(true);
    await w.tick(1600);
    assert.ok(!stale(w));
    w.server.last_mes = 2000; w.server.file_size = '1.30kb';
    await w.tick(60000);   // 60초 주기
    assert.ok(stale(w));
    assert.deepEqual(w.strip, [true]);
});

await test('탭이 다시 보일 때 바로 보고, 숨은 탭에서는 주기 확인을 멈춘다', async () => {
    const w = world();
    w.sync.setOn(true);
    await w.tick(1600);
    w.hidden = true; w.sync.onVisible();
    const before = w.calls.length;
    w.server.last_mes = 3000;
    await w.tick(5 * 60000);
    assert.equal(w.calls.length, before, '숨은 동안 요청 없음');
    w.hidden = false; w.sync.onVisible();
    await w.tick(10);
    assert.ok(stale(w));
});

await test('우리 저장은 바뀜으로 치지 않는다 (저장 뒤 기준을 새로 잡음)', async () => {
    const w = world();
    w.sync.setOn(true);
    await w.tick(1600);
    const r = await w.save();
    assert.equal(r.status, 200);
    assert.equal(w.sends, 1);
    await w.tick(2000);   // REBASE
    assert.ok(!stale(w));
    assert.equal(w.sync.state.base.charMtime, 50500);
    await w.tick(60000);
    assert.ok(!stale(w));
    assert.equal(w.asked, 0);
});

await test('저장 직전 확인: 10초 넘게 안 봤으면 먼저 보고, 바뀌었으면 묻는다 → 새로 불러오기면 보내지 않고 다시 불러온다', async () => {
    const w = world({ answer: 'reload' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.now += 20000;
    w.server.last_mes = 9000;
    const r = await w.save();
    assert.equal(r.status, 200, '실리태번에는 성공으로');
    assert.equal(w.sends, 0, '옛 내용은 보내지 않음');
    assert.equal(w.asked, 1);
    await w.tick(10);
    assert.equal(w.reloads, 1);
    assert.ok(!stale(w));
});

await test('그래도 저장을 고르면 보내고 띠를 걷는다 · 같은 상태에서 다시 묻지 않는다', async () => {
    const w = world({ answer: 'save' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.last_mes = 9000;
    await w.tick(60000);
    assert.ok(stale(w));
    await w.save();
    assert.equal(w.sends, 1);
    assert.equal(w.asked, 1);
    assert.ok(!stale(w));
    await w.tick(2000);
    await w.save();
    assert.equal(w.asked, 1);
    assert.equal(w.sends, 2);
});

await test('창을 닫으면 이번 저장만 미루고 띠는 남는다 → 다음 저장에서 다시 묻는다', async () => {
    const w = world({ answer: 'later' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.last_mes = 9000;
    await w.tick(60000);
    await w.save();
    assert.equal(w.sends, 0);
    assert.ok(stale(w));
    await w.save();
    assert.equal(w.asked, 2);
});

await test('같이 온 저장은 한 번만 묻는다', async () => {
    const w = world({ answer: 'reload' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.last_mes = 9000;
    await w.tick(60000);
    const both = await Promise.all([w.save(), w.save()]);
    assert.deepEqual(both.map(r => r.status), [200, 200]);
    assert.equal(w.asked, 1);
    assert.equal(w.sends, 0);
});

await test('서버 파일이 다른 채팅(integrity 다름)이면 묻지 않고 실리태번 검사에 맡긴다', async () => {
    const w = world({ answer: 'reload', integrity: 'zzz' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.last_mes = 9000;
    await w.tick(60000);
    assert.ok(stale(w));
    await w.save();
    assert.equal(w.asked, 0);
    assert.equal(w.sends, 1, '실리태번이 서버 답(integrity 오류)을 받고 스스로 묻는다');
});

await test('다른 채팅 파일 저장(북마크 · 분기)은 건드리지 않는다', async () => {
    const w = world({ answer: 'reload' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.last_mes = 9000;
    await w.tick(60000);
    await w.sync.onSave('/api/chats/save', { body: saveBody('Mina - branch') }, async () => { w.sends++; return new Response('{}'); });
    assert.equal(w.asked, 0);
    assert.equal(w.sends, 1);
    assert.ok(stale(w), '지금 채팅의 띠는 그대로');
});

await test('확인 중에 우리 저장이 끼면 그 결과로 기준을 잡지 않는다', async () => {
    const w = world();
    w.sync.setOn(true);
    await w.tick(1600);
    let open; w.hold = new Promise(r => { open = r; });
    const pending = w.sync.check('visible');   // 서버의 옛 값(1000)을 읽고 답이 늦는 중
    await new Promise(r => setImmediate(r));
    w.hold = null;
    await w.save();                            // 그 사이 우리 저장 → 서버 1500
    open();
    await pending;
    await w.tick(2000);                        // 저장 뒤 기준 다시 잡기
    assert.ok(!stale(w), JSON.stringify(w.sync.state.base));
    assert.equal(w.sync.state.base.charMtime, 50500);
});

await test('옛 실리태번(API 없음)이면 조용히 멈춘다 · 끄면 그냥 통과', async () => {
    const w = world();
    w.status = 404;
    w.sync.setOn(true);
    await w.tick(1600);
    assert.ok(w.sync.state.unsupported);
    const n = w.calls.length;
    await w.tick(5 * 60000);
    assert.equal(w.calls.length, n);
    await w.save();
    assert.equal(w.sends, 1);
    const off = world({ answer: 'reload' });
    off.sync.setOn(true);
    await off.tick(1600);
    off.server.last_mes = 9;
    await off.tick(60000);
    off.sync.setOn(false);
    assert.ok(!stale(off));
    assert.equal(off.strip.at(-1), false, '끄면 띠도 걷음');
    await off.save();
    assert.equal(off.sends, 1);
    assert.equal(off.asked, 0);
});

await test('새로 불러오기는 답을 받는 중이면 끝난 뒤에 · 채팅을 바꾸면 띠를 걷는다', async () => {
    const w = world({ answer: 'reload' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.last_mes = 9000;
    await w.tick(60000);
    w.busy = true;
    const p = w.sync.reloadNow();
    await w.tick(2000);
    assert.equal(w.reloads, 0);
    w.busy = false;
    await w.tick(600);
    await p;
    assert.equal(w.reloads, 1);
    w.sync.state.stale = true;
    w.sync.reset();
    assert.ok(!stale(w));
});

await test('가운데 메시지 번역만 고침(메시지 수 · 크기 글 · 마지막 글 그대로): 주기 확인은 못 보지만 탭이 보일 때 · 저장 직전엔 잡는다', async () => {
    const w = world({ answer: 'reload' });
    w.sync.setOn(true);
    await w.tick(1600);
    w.server.mtime = 77777; w.server.bytes = 1260;   // 파일만 바뀜
    await w.tick(60000);
    assert.ok(!stale(w), '①만 보는 주기 확인은 못 봄');
    w.sync.onVisible();
    await w.tick(10);
    assert.ok(stale(w), '탭이 보일 때는 정확한 값으로 잡음');
    const v = world({ answer: 'reload' });
    v.sync.setOn(true);
    await v.tick(1600);
    v.server.mtime = 88888;
    v.now += 20000;
    await v.save();
    assert.equal(v.asked, 1, '저장 직전 확인도 정확한 값');
    assert.equal(v.sends, 0);
});

await test('이 기기에서 같은 캐릭터의 다른 채팅을 저장 · 지우면 기준만 다시 잡는다 (띠 없음)', async () => {
    const w = world();
    w.sync.setOn(true);
    await w.tick(1600);
    await w.sync.onSave('/api/chats/save', { body: saveBody('Mina - branch') }, async () => { w.sends++; w.server.mtime += 10; w.server.bytes += 4000; return new Response('{}'); });
    await w.tick(2000);
    w.sync.onVisible(); await w.tick(10);
    assert.ok(!stale(w));
    assert.equal(w.sync.state.base.charSize, 5200);
    await w.sync.afterWrite(Promise.resolve(new Response('{}')).then(r => { w.server.bytes -= 4000; w.server.mtime += 5; return r; }));
    await w.tick(2000);
    w.sync.onVisible(); await w.tick(10);
    assert.ok(!stale(w));
    assert.ok(w.sync.isWrite('/api/chats/delete', { method: 'POST' }) && w.sync.isWrite('/api/chats/rename', { method: 'POST' }) && !w.sync.isWrite('/api/chats/save', { method: 'POST' }));
});

await test('정확한 값을 못 받아도(옛 실리태번 · 오류) ①만으로 돈다', async () => {
    const w = world();
    const base = w.fetcher;
    w.sync = S.createChatSync({ getContext: () => w.ctx, fetcher: async (url, init) => (url === '/api/characters/get' ? new Response('', { status: 500 }) : base(url, init)), now: () => w.now, setTimer: (fn, ms) => { const t = { fn, at: w.now + ms, done: false }; w.timers.push(t); return t; }, clearTimer: t => { if (t) t.done = true; }, hidden: () => false, ask: async () => 'later', strip: x => w.strip.push(x), busy: () => false });
    w.sync.setOn(true);
    await w.tick(1600);
    assert.equal(w.sync.state.base.charMtime, undefined);
    w.server.chat_items = 9;
    w.sync.onVisible(); await w.tick(10);
    assert.ok(stale(w));
});

await test('isSave: POST 로 보내는 채팅 저장 두 곳만', () => {
    const w = world();
    assert.ok(w.sync.isSave('/api/chats/save', { method: 'POST' }));
    assert.ok(w.sync.isSave('http://127.0.0.1:8000/api/chats/group/save', { method: 'post' }));
    assert.ok(!w.sync.isSave('/api/chats/get', { method: 'POST' }));
    assert.ok(!w.sync.isSave('/api/chats/save', {}));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
