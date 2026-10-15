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
function world({ answer = 'later' } = {}) {
    const chat = [{ name: 'Mina', mes: '첫 글', send_date: 't1', extra: { display_text: '첫 번역' } }, { name: 'You', mes: '안녕', send_date: 't2' }, { name: 'Mina', mes: '셋째 글', send_date: 't3' }];
    const w = { chat, server: null, serverChat: null, strip: [], now: 0, timers: [], gets: 0, getOk: true, asked: 0, answer, sends: 0 };
    const fromLocal = () => { const last = w.chat[w.chat.length - 1]; return { last_mes: last.send_date, file_size: `${w.chat.length}kb`, chat_items: w.chat.length, mes: last.mes, mtime: w.chat.length * 100, bytes: w.chat.length * 1000 }; };
    w.server = fromLocal(); w.serverChat = structuredClone(chat);
    w.writeOwn = () => { w.server = { ...fromLocal(), mtime: w.server.mtime + 7 }; w.serverChat = structuredClone(w.chat); };   // 이 기기의 저장이 감싸개를 안 거치고 서버에 닿음
    // 다른 기기가 가운데 메시지 번역문만 고침: 메시지 수 · 마지막 메시지 · 반올림된 크기는 그대로, 파일 시각만 움직임
    w.editElsewhere = () => { w.serverChat[0].extra.display_text = '다른 기기에서 고친 번역'; w.server = { ...w.server, mtime: w.server.mtime + 50 }; };
    w.ctx = { chat, getCurrentChatId: () => CHAT, characterId: 0, characters: [{ name: 'Mina', avatar: AVATAR, chat: CHAT }], chatMetadata: {}, getRequestHeaders: () => ({}) };
    w.sync = S.createChatSync({
        getContext: () => w.ctx,
        fetcher: async (url, init) => {
            if (url === '/api/characters/get') return new Response(JSON.stringify({ date_last_chat: w.server.mtime, chat_size: w.server.bytes }), { status: 200 });
            if (url === '/api/chats/get') { w.gets++; assert.deepEqual(JSON.parse(init.body), { ch_name: 'Mina', file_name: CHAT, avatar_url: AVATAR }); return w.getOk ? new Response(JSON.stringify([{ user_name: 'You', character_name: 'Mina', chat_metadata: {} }, ...w.serverChat]), { status: 200 }) : new Response('', { status: 500 }); }
            return new Response(JSON.stringify([{ file_name: `${CHAT}.jsonl`, avatar: AVATAR, last_mes: w.server.last_mes, file_size: w.server.file_size, chat_items: w.server.chat_items, mes: w.server.mes }]), { status: 200 });
        },
        now: () => w.now, setTimer: (fn, ms) => { const t = { fn, at: w.now + ms }; w.timers.push(t); return t; }, clearTimer: () => {},
        hidden: () => false, ask: async () => { w.asked++; return w.answer; }, strip: show => w.strip.push(show), busy: () => false,
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
    assert(src.includes("const send = () => announceChatSave(input, init, saver.send(input, init));"));
    assert(src.includes("new CustomEvent('bl:chat-saved'"));
    const sync = fs.readFileSync(path.join(root, 'src/chat-sync.js'), 'utf8');
    assert(sync.includes("window.addEventListener('bl:chat-saved'"));
});
// 6.7.5 (회귀검사 6.7.4): 가운데 메시지 번역을 다른 기기에서 고치면 sameAsLocal(메시지 수 · 마지막 메시지)만으로는 「같음」이라 띠가 안 떴다
await check('sameMessages: header line skipped, every message text, translation and swipe compared', () => {
    const chat = [{ mes: 'a', extra: { display_text: 'A' } }, { mes: 'b', swipe_id: 0 }];
    assert.equal(S.sameMessages([{ user_name: 'You', chat_metadata: {} }, ...structuredClone(chat)], chat), true);
    assert.equal(S.sameMessages(structuredClone(chat), chat), true);
    assert.equal(S.sameMessages([{ mes: 'a', extra: { display_text: 'A2' } }, { mes: 'b', swipe_id: 0 }], chat), false);
    assert.equal(S.sameMessages([{ mes: 'a', extra: { display_text: 'A' } }, { mes: 'b', swipe_id: 1 }], chat), false);
    assert.equal(S.sameMessages([{ mes: 'a', extra: { display_text: 'A' } }], chat), false);
    assert.equal(S.sameMessages({}, chat), null);
});
await check('middle translation edited on another device: strip, after one chat read', async () => {
    const w = world();
    await w.sync.check('load');
    w.editElsewhere();
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, true); assert.equal(w.gets, 1);
    assert.deepEqual(w.strip, [true]);
});
await check('own unseen save with the same messages: no strip; unreadable chat keeps the old quiet behaviour', async () => {
    const w = world();
    await w.sync.check('load');
    w.chat[1].mes = '안녕하세요'; w.writeOwn();
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, false); assert.equal(w.gets, 1);
    const q = world();
    await q.sync.check('load');
    q.editElsewhere(); q.getOk = false;
    await q.sync.check('visible');
    assert.equal(q.sync.state.stale, false);
});
await check('nothing moved on the server: no chat read', async () => {
    const w = world();
    await w.sync.check('load');
    await w.sync.check('visible'); await w.sync.check('period');
    assert.equal(w.gets, 0);
});
// 6.7.5 (회귀검사 6.7.4): 성능 보조 워커 저장은 감시 감싸개 바깥에서 저장을 보내 「덮어쓰기 전에 묻기」를 건너뛰었다 — 저장 관문을 먼저 부른다
await check('save guard: an outer wrapper (worker save) still asks before overwriting, once per request', async () => {
    const w = world({ answer: 'later' });
    await w.sync.check('load');
    w.server = { ...w.server, chat_items: 9, mes: '다른 기기 글', last_mes: 't9', mtime: 999 };
    await w.sync.check('visible');
    assert.equal(w.sync.state.stale, true);
    const guard = S.makeSaveGuard(w.sync);
    const body = JSON.stringify({ ch_name: 'Mina', file_name: CHAT, chat: [], avatar_url: AVATAR, force: false });
    const worker = () => { w.sends++; return Promise.resolve(new Response('{}', { status: 200 })); };
    const init = { method: 'POST', body };
    const res = await guard('/api/chats/save', init, () => guard('/api/chats/save', init, worker));   // 감시 감싸개 안에 또 관문 (겹침)
    assert.equal(w.asked, 1); assert.equal(w.sends, 0); assert.equal(res.ok, true);   // 닫음: 이번 저장만 미룸, 다른 기기 글은 남는다
    assert.equal(w.sync.state.stale, true);
    w.answer = 'save';
    await guard('/api/chats/save', { method: 'POST', body }, worker);
    assert.equal(w.asked, 2); assert.equal(w.sends, 1);
    await guard('/api/chats/recent', { method: 'POST', body: '{}' }, worker);   // 저장이 아닌 요청은 그대로
    assert.equal(w.asked, 2); assert.equal(w.sends, 2);
    const fs = await import('node:fs');
    const perf = fs.readFileSync(path.join(root, 'src/addons/perf/perfassist.js'), 'utf8');
    assert(perf.includes("Symbol.for('blue-lemonade.chat-save-guard')") && /typeof guard === 'function' \? guard\(input, init, send\) : send\(\)/.test(perf), 'perfassist calls the guard before the worker send');
    assert.equal(S.SAVE_GUARD, Symbol.for('blue-lemonade.chat-save-guard'));
});
console.log(`chat-sync-local: ${passed} passed, 0 failed`);
