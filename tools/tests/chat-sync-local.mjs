// 6.7.1 다른 기기 바뀜 헛경보: 감싸개를 안 거친 이 기기 저장(성능 보조 워커 저장 등)은 서버가 화면 채팅과 같으므로 띠를 띄우지 않는다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
globalThis.location = { href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000' };
const S = await import(pathToFileURL(path.join(root, 'src/chat-sync.js')).href);
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
const AVATAR = 'Mina.png', CHAT = 'Mina - 2026-10-15@10h00m00s';
function world() {
    const chat = [{ name: 'Mina', mes: '첫 글', send_date: 't1' }, { name: 'You', mes: '안녕', send_date: 't2' }];
    const w = { chat, server: null, strip: [], now: 0, timers: [] };
    const fromLocal = () => { const last = w.chat[w.chat.length - 1]; return { last_mes: last.send_date, file_size: `${w.chat.length}kb`, chat_items: w.chat.length, mes: last.mes, mtime: w.chat.length * 100, bytes: w.chat.length * 1000 }; };
    w.server = fromLocal();
    w.writeOwn = () => { w.server = fromLocal(); };   // 이 기기의 저장이 감싸개를 안 거치고 서버에 닿음
    w.ctx = { chat, getCurrentChatId: () => CHAT, characterId: 0, characters: [{ avatar: AVATAR, chat: CHAT }], getRequestHeaders: () => ({}) };
    w.sync = S.createChatSync({
        getContext: () => w.ctx,
        fetcher: async (url) => url === '/api/characters/get'
            ? new Response(JSON.stringify({ date_last_chat: w.server.mtime, chat_size: w.server.bytes }), { status: 200 })
            : new Response(JSON.stringify([{ file_name: `${CHAT}.jsonl`, avatar: AVATAR, last_mes: w.server.last_mes, file_size: w.server.file_size, chat_items: w.server.chat_items, mes: w.server.mes }]), { status: 200 }),
        now: () => w.now, setTimer: (fn, ms) => { const t = { fn, at: w.now + ms }; w.timers.push(t); return t; }, clearTimer: () => {},
        hidden: () => false, ask: async () => 'later', strip: show => w.strip.push(show), busy: () => false,
    });
    w.sync.state.on = true;
    return w;
}
await check('sameAsLocal: count, last message and its time', () => {
    const chat = [{ mes: 'a', send_date: 'x' }];
    assert.equal(S.sameAsLocal({ items: 1, mes: S.textKey('a'), last: 'x' }, chat), true);
    assert.equal(S.sameAsLocal({ items: 2, mes: S.textKey('a'), last: 'x' }, chat), false);
    assert.equal(S.sameAsLocal({ items: 1, mes: S.textKey('b'), last: 'x' }, chat), false);
    assert.equal(S.sameAsLocal({ items: 1, mes: S.textKey('a'), last: 'y' }, chat), false);
    assert.equal(S.sameAsLocal({ items: 1, mes: S.textKey('[The message is empty]'), last: 'x' }, [{ mes: '', send_date: 'x' }]), true);
    assert.equal(S.sameAsLocal({ missing: true }, chat), false);
});
await check('own save that skipped the wrapper: no strip', async () => {
    const w = world();
    await w.sync.check('load');
    w.chat.push({ name: 'Mina', mes: '새 답', send_date: 't3' }); w.writeOwn();
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, false); assert(!w.strip.includes(true));
});
await check('a strip raised earlier clears once the server matches the screen', async () => {
    const w = world();
    await w.sync.check('load');
    w.server = { ...w.server, chat_items: 9, mes: '남의 글', last_mes: 'tx', mtime: 1, bytes: 1 };
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, true);
    w.writeOwn();
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, false);
});
await check('real change from elsewhere still raises the strip', async () => {
    const w = world();
    await w.sync.check('load');
    w.server = { ...w.server, chat_items: w.chat.length + 1, mes: '다른 기기 글', last_mes: 't9', mtime: 999, bytes: 9999 };
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, true);
});
await check('worker save signal clears the strip and rebases; inside our wrapper it is ignored', async () => {
    const w = world();
    await w.sync.check('load');
    w.sync.state.stale = true;
    w.sync.state.saving = 1; w.sync.onExternalSave('/api/chats/save', null);
    assert.equal(w.sync.state.stale, true);
    w.sync.state.saving = 0; w.sync.onExternalSave('/api/chats/save', null);
    assert.equal(w.sync.state.stale, false); assert.equal(w.sync.state.rebase, true);
});
await check('perfassist announces chat saves', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(path.join(root, 'src/addons/perf/perfassist.js'), 'utf8');
    assert(src.includes("return announceChatSave(input, init, saver.send(input, init));"));
    assert(src.includes("new CustomEvent('bl:chat-saved'"));
    const sync = fs.readFileSync(path.join(root, 'src/chat-sync.js'), 'utf8');
    assert(sync.includes("window.addEventListener('bl:chat-saved'"));
});
console.log(`chat-sync-local: ${passed} passed, 0 failed`);
