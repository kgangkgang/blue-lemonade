// 7.3.1 (저장 정리 1.1.6) 빈 채팅 덮어쓰기 막기 — src/addons/perf/emptyguard.js 판단 + savededupe.js 연결
//   실리태번이 채팅을 다시 불러오는 사이(배열을 먼저 비움 · 메타데이터는 남음)에 저장이 끼거나, 다시 읽기가 실패한 뒤 「서버에 있게」 저장이 돌면
//   머리줄만 있는 파일(메시지 0개)이 써져 메시지가 다 사라졌다 (사용자 채팅 메시지 16개). 그런 저장은 보내지 않고 409.
//   흔한 저장(지금 채팅에 메시지가 있음) · 막지 않는 저장은 모두 동기로 그대로 지나간다(null) — 겹친 저장의 차례가 바뀌지 않게.
//   지어낸 캐릭터 · 파일 이름만 쓴다.   node tools/tests/empty-chat-guard-731.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { createEmptyGuard, messagesInBody, GUARD_STATUS, GUARD_ERROR, createSaveFailMute } = await import(pathToFileURL(path.join(root, 'src/addons/perf/emptyguard.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const K = 'c|harbor-keeper.png|Harbor Keeper - 2026-10-20';
const body = (n, file = 'Harbor Keeper - 2026-10-20') => JSON.stringify({ ch_name: 'Harbor Keeper', file_name: file, chat: [{ chat_metadata: { integrity: 'x' }, user_name: 'unused', character_name: 'unused' }, ...Array.from({ length: n }, (_, i) => ({ mes: 'line ' + i }))], avatar_url: 'harbor-keeper.png', force: false });
function rig({ server = 16 } = {}) {
    const state = { key: K, length: 16 }, blocks = [], suspects = [];
    let asked = 0;
    const g = createEmptyGuard({ live: () => ({ ...state }), serverCount: async () => { asked++; return server; }, onBlock: i => blocks.push(i), onSuspect: i => suspects.push(i) });
    return { g, state, blocks, suspects, asked: () => asked };
}
const outcome = async value => (value === null ? { block: false, sync: true } : { ...(await value), sync: false });

await test('본문의 메시지 수 (머리줄 뺌) · 못 읽으면 null', () => {
    assert.equal(messagesInBody('/api/chats/save', body(0)), 0);
    assert.equal(messagesInBody('/api/chats/save', body(3)), 3);
    assert.equal(messagesInBody('/api/chats/save', 'x'), null);
    assert.equal(GUARD_STATUS, 409); assert.equal(GUARD_ERROR, 'bl_empty_chat_guard');
});
await test('흔한 저장(지금 채팅 · 메시지 있음)은 본문을 읽지 않고 동기로 지나간다', async () => {
    const r = rig(); r.g.onChatOpened();
    assert.equal(r.g.precheck('/api/chats/save', body(16), K), null);
    assert.equal(r.g.stats.checked, 0, 'body not parsed');
});
await test('다시 불러오는 사이(배열이 빔): 메시지가 있던 파일로 가는 0개 저장은 막는다 (이 페이지에서 본 수)', async () => {
    const r = rig(); r.g.onChatOpened(); r.state.length = 0;
    const res = await outcome(r.g.precheck('/api/chats/save', body(0), K));
    assert.equal(res.block, true); assert.equal(res.reason, 'known'); assert.equal(res.had, 16); assert.equal(r.asked(), 0);
    assert.equal(r.blocks.length, 1);
});
await test('불러오기가 비어 끝남: 「의심」 — 0개 · 1개 저장 모두 막고, 제대로 다시 열리면 풀린다', async () => {
    const r = rig(); r.g.onChatOpened(); r.state.length = 0; r.g.onChatOpened();
    assert.equal(r.suspects.length, 1);
    assert.equal((await outcome(r.g.precheck('/api/chats/save', body(0), K))).block, true);
    r.state.length = 1;
    const one = await outcome(r.g.precheck('/api/chats/save', body(1), K));
    assert.equal(one.block, true); assert.equal(one.reason, 'suspect');
    r.state.length = 16; r.g.onChatOpened();
    assert.equal(r.g.precheck('/api/chats/save', body(16), K), null);
});
await test('사용자가 메시지를 다 지움(MESSAGE_DELETED → 0개): 빈 저장도 그대로 보낸다', async () => {
    const r = rig(); r.g.onChatOpened(); r.state.length = 0; r.g.onMessageDeleted();
    const res = await outcome(r.g.precheck('/api/chats/save', body(0), K));
    assert.equal(res.block, false); assert.equal(res.sync, true);
});
await test('이 페이지에서 본 적 없는 파일의 0개 저장: 서버에 묻는다 — 메시지가 있으면 막음', async () => {
    const r = rig({ server: 16 }); r.state.length = 0;
    const res = await outcome(r.g.precheck('/api/chats/save', body(0), K));
    assert.equal(res.block, true); assert.equal(res.reason, 'server'); assert.equal(r.asked(), 1);
});
await test('첫 인사 없는 새 채팅(서버에도 0개)은 그대로 · 서버를 모르면 막는다', async () => {
    const r = rig({ server: 0 }); r.state.length = 0;
    assert.equal((await outcome(r.g.precheck('/api/chats/save', body(0, 'new'), 'c|harbor-keeper.png|new'))).block, false);
    const u = rig({ server: null }); u.state.length = 0;
    assert.equal((await outcome(u.g.precheck('/api/chats/save', body(0), K))).block, true);
});
await test('지금 채팅이 비어도 다른 파일로 가는, 메시지가 있는 저장은 동기로 지나간다 (겹친 저장 차례 그대로)', async () => {
    const r = rig(); r.state.length = 0;
    assert.equal(r.g.precheck('/api/chats/save', body(5, 'other'), 'c|harbor-keeper.png|other'), null);
    const unknownLive = createEmptyGuard({ live: () => null, serverCount: async () => 16 });
    assert.equal(unknownLive.precheck('/api/chats/save', body(5), K), null, 'live chat unknown: a save with messages is not delayed');
    assert.equal(unknownLive.precheck('/api/chats/save', 'not json', K), null);
});
await test('끄면(설정) 막지 않는다', () => {
    const state = { key: K, length: 0 };
    const g = createEmptyGuard({ live: () => state, serverCount: async () => 16, enabled: () => false });
    assert.equal(g.precheck('/api/chats/save', body(0), K), null);
});
await test('연결: savededupe 1.1.6 의 fetch 감싸개가 저장마다 precheck → 막으면 409 · 기본 켬 · 설정 스위치 · 사건은 emptyguard.js 로 맨 앞 · 판(JS = CSS) · CI', () => {
    const src = read('src/addons/perf/savededupe.js');
    const guard = read('src/addons/perf/emptyguard.js');
    assert.match(src, /import \{ createEmptyGuard, createSaveFailMute, guardWanted, guardSlot, guardResponse, notifyBlocked, notifySuspect, createServerCount, bindGuardEvents, quickLiveFrom \} from '\.\/emptyguard\.js';/);
    assert.match(src, /const VERSION = '1\.1\.7';/);   // 7.4.1 저장 실패 알림 숨김
    assert.match(read('src/addons/perf/style.css'), /--sv-css-version: "1\.1\.7";/);
    // 8.2.6 알림 · 숨기기는 emptyguard.js notifyBlocked 하나 (독립 모듈과 같은 글)
    assert.match(src, /if \(typeof toastr !== 'undefined'\) notifyBlocked\(toastr, saveFailMute\);/);
    assert.match(guard, /mute\?\.wrap\(toast\);\s*mute\?\.arm\(\);\s*toast\.warning\(BLOCK_TEXT, NOTICE_TITLE,/, 'arm the mute before BL warns (ST toasts after the 409)');
    assert.match(src, /emptyGuard: true \}\);/);
    assert.match(src, /enabled: \(\) => guardWanted\(extensions\.extension_settings\),/);
    assert.match(src, /pre = emptyGuard \? emptyGuard\.precheck\(path, init\?\.body, bodyKey\(path, init\?\.body\)\) : null;/);
    assert.match(src, /result => \(result\?\.block \? guardResponse\(result\) : handleSave\(self, input, init, path\)\)/);
    assert.match(src, /return handleSave\(this, input, init, path\);/);
    assert.match(src, /bindGuardEvents\(\{\s*guard: \(\) => emptyGuard,/);
    assert.match(guard, /on\(eventTypes\?\.CHAT_CHANGED, \(\) => \{ if \(active\(\)\) guard\(\)\.onChatOpened\(\); \}\);/);
    assert.match(guard, /on\(eventTypes\?\.MESSAGE_DELETED, \(\) => \{ if \(active\(\)\) guard\(\)\.onMessageDeleted\(\); \}\);/);
    assert.match(guard, /if \(typeof eventSource\.makeFirst === 'function'\) eventSource\.makeFirst\(type, fn\);/, '두 사건 모두 맨 앞');
    assert.match(src, /bind\('#sv_empty', 'emptyGuard'\);/);
    assert.ok(src.includes('빈 채팅으로 덮어쓰는 저장 막기'));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/empty-chat-guard-731\.mjs \./);
});

await test('7.4.1 (1.1.7) 막은 직후 실리태번의 저장 실패 알림(영 · 한 · 그룹)만 숨김 — 막기 전 · 6초 뒤 · 다른 오류는 그대로', () => {
    let clock = 1000;
    const shown = [];
    const fake = { error(message, title) { shown.push(`${title}|${message}`); return 'toast'; } };
    const mute = createSaveFailMute({ now: () => clock, windowMs: 6000 });
    assert.equal(mute.wrap(fake), true); assert.equal(mute.wrap(fake), false, 'wraps once');
    const EN = ['Check the server connection and reload the page to prevent data loss.', 'Chat could not be saved'];
    const KO = ['데이터를 잃지 않게 서버 연결을 확인하고 페이지를 다시 불러오세요.', '채팅을 저장하지 못했어요'];
    assert.equal(fake.error(...EN), 'toast', 'not armed: shown');
    mute.arm();
    assert.equal(fake.error(...EN), undefined); assert.equal(fake.error(...KO), undefined);
    assert.equal(fake.error(EN[0], 'Group Chat could not be saved'), undefined, 'group chat too');
    assert.equal(fake.error('Something else broke', 'Chat could not be saved'), 'toast', 'other text: shown');
    assert.equal(fake.error(EN[0], 'Settings could not be saved'), 'toast', 'settings save failure is not ours: shown');
    clock += 6001;
    assert.equal(fake.error(...EN), 'toast', 'after the window: shown again');
    assert.equal(mute.muted, 3); assert.equal(shown.length, 4);
});

console.log(`empty-chat-guard-731: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
