// 8.2.6 빈 채팅 덮어쓰기 막기 — 성능 보조 없이도 (src/empty-guard-boot.js) · 직접 지워 비운 채팅은 통과 (src/addons/perf/emptyguard.js)
//   node tools/tests/empty-guard-standalone.mjs [테마 뿌리, 기본 .]
// 가짜 fetch · 가짜 DOM(문서 capture 클릭 · .mes.selected) · 가짜 eventSource(실리태번처럼 등록 차례대로 하나씩 await, makeFirst 는 맨 앞)로 본다.
//   1) 성능 보조 꺼짐: 빈 저장 막힘(409 · 알림 하나) · 정상 저장 통과(동기) · 저장 아닌 요청은 그대로(같은 인자 · 같은 약속)
//   2) 성능 보조 켜짐: 진짜 savededupe.js 를 실리태번 스텁으로 불러 — 표식을 넘겨받고, 독립 모듈은 무동작(판정 1겹 · 다시 설치해도 감싸지 않음)
//   3) 설정 끔(chat.emptyGuard · save_dedupe.emptyGuard 어느 쪽이든) → 통과 · 옛 설정 보정(없으면 켬 · 저장 정리에서 끈 사람은 끔)
//   4) 직접 지움: 하나씩 다 지움 · 여러 개 고르기로 다 지움 · /del 로 다 지움 → 통과 / 채팅 열기 실패 · 지운 직후 다른 채팅으로 바뀜 · 일부만 지운 뒤 빈 저장 → 막힘
// 지어낸 캐릭터 · 파일 이름 · 문장만 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const B = await import(url('src/empty-guard-boot.js'));
const G = await import(url('src/addons/perf/emptyguard.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const quietWarn = console.warn, quietInfo = console.info;
console.warn = () => {}; console.info = () => {};

// ── 가짜 실리태번 ─────────────────────────────────────────────
const AVATAR = 'lantern-keeper.png';
const FILE_A = 'Lantern Keeper - 2026-10-29@10h00m00s';
const FILE_B = 'Lantern Keeper - 2026-10-28@09h00m00s';
const keyOf = file => `c|${AVATAR}|${file}`;
const message = i => ({ name: i % 2 ? 'User' : 'Lantern Keeper', is_user: i % 2 === 1, mes: `지어낸 문장 ${i}` });
const saveBody = (file, chat) => JSON.stringify({ ch_name: 'Lantern Keeper', file_name: file, chat: [{ chat_metadata: { integrity: 'qa-integrity' }, user_name: 'unused', character_name: 'unused' }, ...chat], avatar_url: AVATAR, force: false });

function makeEvents() {
    const events = {};
    return {
        events,
        on(type, fn) { (events[type] ??= []).push(fn); },
        makeFirst(type, fn) { (events[type] ??= []).unshift(fn); },
        async emit(type, ...args) { for (const fn of [...(events[type] ?? [])]) await fn(...args); },
    };
}
const TYPES = { CHAT_CHANGED: 'chat_id_changed', MESSAGE_DELETED: 'message_deleted' };

function makeDoc() {
    const capture = [], selected = [];
    const el = (id, attrs = {}) => ({ id, getAttribute: name => attrs[name] ?? null, closest: sel => (sel === `#${id}` ? el(id) : null) });
    return {
        selected,
        addEventListener(type, fn, opts) { if (type === 'click' && (opts === true || opts?.capture)) capture.push(fn); },
        querySelectorAll(sel) { assert.equal(sel, '#chat .mes.selected'); return selected.map(i => el('mes', { mesid: String(i) })); },
        click(id) { const target = el(id); for (const fn of capture) fn({ target, type: 'click' }); },
        captureCount: () => capture.length,
    };
}

/** 성능 보조가 없는 페이지 하나: 창 · 문서 · 사건 · 표식 자리가 따로다 */
function makeRig({ messages = 16, file = FILE_A, server = 16, ext, beforeInstall } = {}) {
    const sent = [];
    const nativeFetch = function (input, init) {
        sent.push({ self: this, input, init });
        return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    const win = { fetch: nativeFetch };
    const doc = makeDoc(), es = makeEvents(), slotRoot = {};
    const toasts = [];
    const toast = { warning: (text, title) => toasts.push({ kind: 'warning', text, title }), error: (text, title) => toasts.push({ kind: 'error', text, title }) };
    const st = { file, chat: Array.from({ length: messages }, (_, i) => message(i)) };
    const settings = ext ?? { salty: { chat: { emptyGuard: true } } };
    let asked = 0;
    const rig = {
        win, doc, es, st, sent, toasts, toast, handle: null, slotRoot, settings, nativeFetch, asked: () => asked,
        /** 실리태번 saveChat 처럼 지금 배열을 저장 — 응답 상태 */
        async save(file = st.file, chat = st.chat) {
            const r = await win.fetch('/api/chats/save', { method: 'POST', cache: 'no-cache', headers: { 'Content-Type': 'application/json' }, body: saveBody(file, chat) });
            return r.status;
        },
        /** 채팅 열기 (CHAT_CHANGED) */
        async open(nextFile, count) { st.file = nextFile; st.chat.length = 0; for (let i = 0; i < count; i++) st.chat.push(message(i)); await es.emit(TYPES.CHAT_CHANGED); },
        /** 실리태번 deleteMessage: splice → (saveChatDebounced 는 1초 뒤) → MESSAGE_DELETED */
        async deleteMessage(id) { st.chat.splice(id, 1); await es.emit(TYPES.MESSAGE_DELETED, st.chat.length); },
        /** 실리태번 #dialogue_del_mes_ok: 고른 첫 메시지부터 끝까지 — chat.length 를 줄이고 saveChatConditional() 을 먼저 기다린 뒤 MESSAGE_DELETED */
        async bulkDelete(from) {
            doc.selected.length = 0;
            for (let i = from; i < st.chat.length; i++) doc.selected.push(i);
            doc.click('dialogue_del_mes_ok');        // capture 로 먼저 듣는다
            doc.selected.length = 0;                 // 실리태번 처리: 고른 표시를 걷고
            st.chat.length = from;
            const status = await rig.save();         // 저장을 먼저 기다리고
            await es.emit(TYPES.MESSAGE_DELETED, st.chat.length);   // 그 뒤에 사건
            return status;
        },
    };
    beforeInstall?.(rig);   // 우리보다 먼저 등록된 다른 확장의 사건 처리 등
    rig.handle = B.installEmptyGuardBoot({
        win, doc, origin: 'http://st.test', root: slotRoot,
        live: () => ({ key: st.file ? keyOf(st.file) : null, integrity: 'qa-integrity', length: st.chat.length }),
        serverCount: async () => { asked++; return server; },
        ext: () => settings, toast: () => toast, eventSource: es, eventTypes: TYPES,
    });
    return rig;
}
const blockedBody = async (rig) => { const r = await rig.win.fetch('/api/chats/save', { method: 'POST', body: saveBody(rig.st.file, []) }); return { status: r.status, json: await r.json() }; };

// ── 1) 성능 보조 꺼짐 ─────────────────────────────────────────
await test('성능 보조 꺼짐: 메시지가 있던 채팅을 0개로 덮는 저장은 서버로 안 가고 409 · 알림 하나(같은 문구) · 실리태번 저장 실패 알림은 숨김', async () => {
    const rig = makeRig();
    await rig.es.emit(TYPES.CHAT_CHANGED);    // 16개로 열림
    rig.st.chat.length = 0;                   // 다시 불러오는 사이(clearChat) 같은 때
    const { status, json } = await blockedBody(rig);
    assert.equal(status, 409); assert.equal(json.error, 'bl_empty_chat_guard'); assert.equal(json.reason, 'known'); assert.equal(json.had, 16);
    assert.equal(rig.sent.length, 0, '서버로 보내지 않음');
    assert.deepEqual(rig.toasts.map(t => [t.kind, t.title, t.text]), [['warning', G.NOTICE_TITLE, G.BLOCK_TEXT]]);
    assert.equal(G.BLOCK_TEXT, '채팅이 비어 있는 채로 저장하려 해서 막았어요. 파일은 그대로예요. 페이지를 새로 고친 뒤 채팅을 다시 열어 주세요.');
    rig.toasts.length = 0;
    // 409 를 받은 실리태번이 띄우는 알림은 숨는다 (막을 때 감싼 toastr.error) — 다른 오류 알림은 그대로
    assert.ok(rig.slotRoot[G.GUARD_SLOT].mute, '독립 모듈도 저장 실패 숨기기를 쓴다 (표식 자리에 하나)');
    rig.toast.error('Check the server connection and reload the page to prevent data loss.', 'Chat could not be saved');
    assert.equal(rig.toasts.length, 0);
    rig.toast.error('Something else', 'Other');
    assert.equal(rig.toasts.length, 1);
});

await test('성능 보조 꺼짐: 정상 저장(메시지 있음)은 본문을 읽지 않고 동기로 그대로 보낸다', async () => {
    const rig = makeRig();
    await rig.es.emit(TYPES.CHAT_CHANGED);
    const init = { method: 'POST', body: saveBody(rig.st.file, rig.st.chat) };
    const p = rig.win.fetch('/api/chats/save', init);
    assert.equal(rig.sent.length, 1, '같은 틱에 보냄 (겹친 저장 차례 그대로)');
    assert.equal(rig.sent[0].init, init);
    assert.equal((await p).status, 200);
    assert.equal(rig.handle.guard.stats.checked, 0, '본문을 읽지 않음');
    // 그룹 저장 경로도 같은 감싸개를 지난다 (본 적 없는 그룹의 0개 저장 → 서버에 묻는다)
    await rig.win.fetch('http://st.test/api/chats/group/save', { method: 'POST', body: JSON.stringify({ id: 'qa-group', chat: [] }) });
    assert.ok(rig.handle.guard.stats.checked > 0, '그룹 저장도 살핀다');
    assert.equal(rig.asked(), 1);
});

await test('성능 보조 꺼짐: 저장이 아닌 요청은 손대지 않는다 (같은 this · 같은 인자 · 같은 약속, 판정 0번)', async () => {
    const rig = makeRig();
    const calls = [
        ['/api/characters/all', undefined],
        ['/api/chats/get', { method: 'POST', body: '{"x":1}' }],
        ['/api/chats/save', { method: 'GET' }],
        ['/api/settings/save', { method: 'POST', body: '{}' }],
        [{ url: 'http://st.test/api/chats/recent', method: 'POST' }, undefined],
    ];
    for (const [input, init] of calls) {
        const self = { tag: 'self' };
        const before = rig.sent.length;
        const p = rig.win.fetch.call(self, input, init);
        assert.ok(p instanceof Promise);
        assert.equal(rig.sent.length, before + 1);
        const got = rig.sent.at(-1);
        assert.equal(got.self, self); assert.equal(got.input, input); assert.equal(got.init, init);
    }
    assert.equal(rig.handle.guard.stats.checked, 0);
    assert.equal(G.savePathOf('/api/characters/all', undefined, 'http://st.test'), '');
    assert.equal(G.savePathOf('/api/chats/save?x=1', { method: 'post' }, 'http://st.test'), '/api/chats/save');
});

// ── 3) 설정 ───────────────────────────────────────────────────
await test('설정 끔: chat.emptyGuard false 이거나 저장 정리 save_dedupe.emptyGuard false 면 빈 저장도 그대로 보낸다 · 감싸개를 끄면(setOn) 그냥 지나간다', async () => {
    for (const ext of [{ salty: { chat: { emptyGuard: false } } }, { salty: { chat: { emptyGuard: true } }, save_dedupe: { emptyGuard: false } }]) {
        const rig = makeRig({ ext });
        await rig.es.emit(TYPES.CHAT_CHANGED); rig.st.chat.length = 0;
        assert.equal(await rig.save(), 200); assert.equal(rig.sent.length, 1); assert.equal(rig.toasts.length, 0);
    }
    const rig = makeRig();
    await rig.es.emit(TYPES.CHAT_CHANGED);
    rig.handle.setOn(false); rig.st.chat.length = 0;
    assert.equal(await rig.save(), 200);
    rig.handle.setOn(true);   // 다시 켜면 기억을 비우고 새로 센다 — 서버에 묻는다
    const status = await rig.save();
    assert.equal(rig.asked(), 1); assert.equal(status, 409, '서버에 16개가 있다고 하면 막는다');
    assert.equal(G.guardWanted({}), true, '아무 설정도 없으면 켬');
    assert.equal(G.guardWanted({ salty: { chat: {} }, save_dedupe: {} }), true);
});

await test('옛 설정 보정: 칸이 없으면 켬 · 저장 정리에서 끈 사람은 처음 한 번 끔 · 직접 끈 값 · "false" 문자열은 끔 · 동작 값 목록에도 있음', async () => {
    const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], characterId: undefined, saveSettingsDebounced() {} };
    globalThis.SillyTavern = { getContext: () => ctx };
    const { getSettings, DEFAULTS } = await import(url('src/settings.js'));
    assert.equal(DEFAULTS.chat.emptyGuard, true);
    const load = (salty, extra = {}) => { ctx.extensionSettings = { ...extra, salty: structuredClone(salty) }; return getSettings(); };
    const old = structuredClone(DEFAULTS); delete old.chat.emptyGuard;
    assert.equal(load(old).chat.emptyGuard, true, '8.2.5 설정 → 켬');
    assert.equal(load({ version: 1, chat: { user: 'line' } }).chat.emptyGuard, true, '아주 옛 설정 → 켬');
    assert.equal(load(old, { save_dedupe: { emptyGuard: false } }).chat.emptyGuard, false, '저장 정리에서 끈 사람 → 끔');
    assert.equal(load(old, { save_dedupe: { emptyGuard: true } }).chat.emptyGuard, true);
    const on = structuredClone(DEFAULTS); on.chat.emptyGuard = true;
    assert.equal(load(on, { save_dedupe: { emptyGuard: false } }).chat.emptyGuard, true, '칸이 이미 있으면 보정하지 않는다 (실행 때 둘 중 하나라도 끄면 끔)');
    const off = structuredClone(DEFAULTS); off.chat.emptyGuard = 'false';
    assert.equal(load(off).chat.emptyGuard, false);
    delete globalThis.SillyTavern;
});

// ── 4) 직접 지움 ──────────────────────────────────────────────
await test('하나씩 다 지움(휴지통 · 첫 인사말까지) → 경고 없이 저장 · 앞선 확장이 지운 직후 저장해도 사건이 맨 앞이라 통과', async () => {
    const statuses = [];
    // 먼저 등록된 다른 확장: 지운 사건에서 바로 채팅을 저장한다 (예전처럼 on 이었으면 이 저장이 우리 판단보다 먼저 와 막혔다)
    const rig = makeRig({ messages: 4, beforeInstall: r => r.es.on(TYPES.MESSAGE_DELETED, async () => { statuses.push(await r.save()); }) });
    assert.equal(rig.es.events[TYPES.MESSAGE_DELETED].length, 2);
    await rig.es.emit(TYPES.CHAT_CHANGED);
    for (let i = 3; i >= 0; i--) await rig.deleteMessage(i);   // 마지막은 0번(인사말)
    assert.equal(await rig.save(), 200, '1초 뒤 늦은 저장');
    assert.deepEqual(statuses, [200, 200, 200, 200]);
    assert.equal(rig.toasts.length, 0); assert.equal(rig.handle.guard.stats.blocked, 0);
    assert.equal(G.messagesInBody('/api/chats/save', rig.sent.at(-1).init.body), 0, '빈 채팅이 서버로 갔다');
});

await test('여러 개 고르기로 다 지움(지우기 모드 · 0번부터) → 저장을 먼저 해도 통과 · 경고 없음', async () => {
    const rig = makeRig();
    await rig.es.emit(TYPES.CHAT_CHANGED);
    assert.equal(rig.doc.captureCount(), 1, '문서 capture 클릭 하나');
    assert.equal(await rig.bulkDelete(0), 200);
    assert.equal(rig.toasts.length, 0); assert.equal(rig.sent.length, 1);
    assert.equal(rig.handle.guard.stats.userCleared, 1);
    assert.equal(await rig.save(), 200, '그 뒤의 빈 저장도');
});

await test('/del 로 다 지움 — /del 16 (doMesCut: deleteMessage 를 끝에서부터 → saveChatConditional) · /del (지우기 모드 확인) 둘 다 통과', async () => {
    const rig = makeRig();
    await rig.es.emit(TYPES.CHAT_CHANGED);
    for (let id = rig.st.chat.length - 1; id >= 0; id--) await rig.deleteMessage(id);
    assert.equal(await rig.save(), 200);
    const mode = makeRig();
    await mode.es.emit(TYPES.CHAT_CHANGED);
    assert.equal(await mode.bulkDelete(0), 200);
    assert.equal(rig.toasts.length + mode.toasts.length, 0);
});

await test('채팅 열기 실패로 빈 저장 → 막힘 (의심 알림 · 그 뒤 새 메시지 하나도 16개를 덮지 못함) · 빈 채로 지우기 단추를 눌러도 못 뚫음', async () => {
    const rig = makeRig();
    await rig.es.emit(TYPES.CHAT_CHANGED);            // 16개
    await rig.open(FILE_A, 0);                         // 다시 열었는데 비어 있음
    assert.equal(rig.toasts.filter(t => t.text === G.SUSPECT_TEXT).length, 1);
    rig.doc.selected.length = 0; rig.doc.click('dialogue_del_mes_ok');   // 고른 것이 없음
    assert.equal(await rig.save(), 409);
    rig.st.chat.push(message(0));
    assert.equal(await rig.save(), 409, '새 메시지 하나로 16개를 덮지 않는다');
    rig.st.chat.length = 0;
    const r = await rig.win.fetch('/api/chats/save', { method: 'POST', body: saveBody(FILE_A, []) });
    assert.equal(r.status, 409);
    assert.equal(rig.sent.length, 0);
});

await test('지운 직후 다른 채팅으로 바뀌며 빈 저장 → 막힘 (누름은 CHAT_CHANGED 로 지워짐 · 다른 파일 · 다시 읽는 중인 같은 파일)', async () => {
    const rig = makeRig();
    await rig.open(FILE_B, 12);                        // B 를 한 번 열어 12개를 안다
    await rig.open(FILE_A, 16);
    // A 에서 지우기 모드 확인(0번부터)을 눌렀는데, 실리태번이 저장하기 전에 B 로 바뀐다
    for (let i = 0; i < 16; i++) rig.doc.selected.push(i);
    rig.doc.click('dialogue_del_mes_ok'); rig.doc.selected.length = 0;
    rig.st.file = FILE_B; rig.st.chat.length = 0;      // B 를 여는 중(clearChat)
    assert.equal(await rig.save(FILE_B, []), 409, '다른 파일(B)의 빈 저장');
    await rig.es.emit(TYPES.CHAT_CHANGED);             // B 가 비어 열림 → 누름은 버려짐
    assert.equal(rig.handle.guard.debug.intent(), null);
    assert.equal(await rig.save(FILE_A, []), 409, 'A 로 가는 늦은 빈 저장도 (지금 채팅이 아님)');
    // 같은 채팅을 다시 읽는 중(reloadCurrentChat → CHAT_CHANGED) — 누른 뒤 사건이 끼면 그 누름은 쓰지 않는다
    const re = makeRig();
    await re.es.emit(TYPES.CHAT_CHANGED);
    for (let i = 0; i < 16; i++) re.doc.selected.push(i);
    re.doc.click('dialogue_del_mes_ok'); re.doc.selected.length = 0;
    re.st.chat.length = 0; await re.es.emit(TYPES.CHAT_CHANGED);
    assert.equal(await re.save(), 409);
});

await test('느슨하지 않게: 일부만 고름(남을 수 > 0) · 누른 뒤 10초 넘음 · 누를 때 메시지가 아는 수보다 적음 → 빈 저장은 막힘', async () => {
    const part = makeRig();
    await part.es.emit(TYPES.CHAT_CHANGED);
    for (let i = 5; i < 16; i++) part.doc.selected.push(i);
    part.doc.click('dialogue_del_mes_ok'); part.doc.selected.length = 0;
    part.st.chat.length = 0;                           // 그런데 저장 본문은 0개 (다시 읽는 사이)
    assert.equal(await part.save(), 409);
    // 시간: 가짜 시계로
    let clock = 1000;
    const g = G.createEmptyGuard({ live: () => ({ key: keyOf(FILE_A), length: live }), serverCount: async () => 16, now: () => clock });
    let live = 16; g.onChatOpened();
    g.onUserDelete({ before: 16, after: 0 }); clock += G.DELETE_INTENT_MS + 1; live = 0;
    const late = await g.precheck('/api/chats/save', saveBody(FILE_A, []), keyOf(FILE_A));
    assert.equal(late?.block, true, '10초 뒤');
    live = 16; g.onChatOpened(); live = 3;              // 화면에 3개만 (아는 수 16)
    g.onUserDelete({ before: 3, after: 0 }); live = 0;
    const fewer = await g.precheck('/api/chats/save', saveBody(FILE_A, []), keyOf(FILE_A));
    assert.equal(fewer?.block, true, '누를 때 수 < 아는 수');
    live = 16; g.onChatOpened(); live = 17;             // 새 메시지를 보낸 직후(늦은 저장 전) 다 지움
    g.onUserDelete({ before: 17, after: 0 }); live = 0;
    assert.equal(g.precheck('/api/chats/save', saveBody(FILE_A, []), keyOf(FILE_A)), null, '누를 때 수 ≥ 아는 수 → 통과');
    assert.equal(G.DELETE_INTENT_MS, 10000);
});

// ── 2) 성능 보조 켜짐 — 진짜 savededupe.js 가 표식을 넘겨받는다 ──────────────
await test('성능 보조 켜짐: 표식이 이미 perf 면 독립 모듈은 아무것도 안 한다 (fetch 를 감싸지 않음 · 사건 · 클릭 안 걺)', () => {
    const slotRoot = { [G.GUARD_SLOT]: { owner: 'perf', guard: {}, mute: null } };
    const win = { fetch() {} }, before = win.fetch, es = makeEvents(), doc = makeDoc();
    const h = B.installEmptyGuardBoot({ win, doc, origin: 'http://st.test', root: slotRoot, live: () => null, serverCount: async () => 0, ext: () => ({}), toast: () => null, eventSource: es, eventTypes: TYPES });
    assert.equal(h, null); assert.equal(win.fetch, before);
    assert.deepEqual(es.events, {}); assert.equal(doc.captureCount(), 0);
    assert.equal(B.perfWillGuard({ addons: { perf: true }, addonUI: { perfLoad: {} } }), true);
    assert.equal(B.perfWillGuard({ addons: { perf: true }, addonUI: { perfLoad: { dedupe: false } } }), false, '저장 정리만 꺼 둠');
    assert.equal(B.perfWillGuard({ addons: { perf: false } }), false);
    assert.equal(B.perfWillGuard({ addons: { perf: true }, usageMode: 'theme' }), false, '테마만 모드');
    assert.equal(B.perfWillGuard({ addons: { perf: true }, enabled: false }), false);
});

{
    // 실리태번 · 테마 모듈 스텁 (perf-save-dedupe.mjs 와 같은 방식) — 같은 배열 · 같은 사건 · 같은 문서를 독립 모듈과 savededupe 가 같이 본다
    const perfDir = path.join(root, 'src/addons/perf');
    const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
    const T = globalThis.__egTest = {
        ext: { salty: { chat: { emptyGuard: true } }, save_dedupe: { enabled: true, recover: false, flushOnSwitch: false, guardGeneration: false } },
        chat: Array.from({ length: 16 }, (_, i) => message(i)),
        characters: [{ name: 'Lantern Keeper', avatar: AVATAR, chat: FILE_A }],
        es: makeEvents(),
    };
    const ST = {
        '../../addon-files-check.js': js('export function verifyAddonCss() {}'),
        './hub.js': js('export function pane() { return null; }'),
        '../../../../../../extensions.js': js('export const extension_settings = globalThis.__egTest.ext;\nexport function getContext() { return {}; }'),
        '../../../../../../../script.js': js("export const eventSource = globalThis.__egTest.es;\nexport const event_types = { APP_READY: 'app_ready', CHAT_CHANGED: 'chat_id_changed', MESSAGE_DELETED: 'message_deleted' };\nexport function saveSettingsDebounced() {}\nexport const chat = globalThis.__egTest.chat;\nexport const characters = globalThis.__egTest.characters;\nexport const this_chid = 0;\nexport const chat_metadata = {};\nexport function getCurrentChatId() { return globalThis.__egTest.characters[0].chat; }"),
        '../../../../../../openai.js': js('export const promptManager = null;'),
        '../../../../../../group-chats.js': js('export const selected_group = null;'),
    };
    register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(R) && S[spec]) return { url: S[spec], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, dir: pathToFileURL(perfDir).href } });

    const sent = [];
    const serverFetch = function (input, init = {}) {
        sent.push({ input, init });
        return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    const doc = makeDoc();
    const toasts = [];
    globalThis.window = { fetch: serverFetch, addEventListener() {}, removeEventListener() {} };
    globalThis.document = { visibilityState: 'visible', addEventListener: doc.addEventListener, querySelectorAll: doc.querySelectorAll, body: { dataset: {} } };
    globalThis.location = { origin: 'http://st.test', href: 'http://st.test/' };
    globalThis.jQuery = () => {};
    globalThis.toastr = { warning: (text, title) => toasts.push({ text, title }), error() {} };
    const live = () => G.quickLiveFrom({ characters: T.characters, getCurrentChatId: () => T.characters[0].chat, chat: T.chat, this_chid: 0, chat_metadata: {} }, { selected_group: null }, () => null);

    await test('성능 보조가 나중에 시작: savededupe 가 표식을 perf 로 넘겨받고 기억(본 수)을 그대로 쓴다 · 판정은 한 겹 · 알림 하나', async () => {
        // 독립 모듈이 먼저 (성능 보조를 기다리지 않은 경우 — 예: 저장 정리가 늦게 섬)
        const h = B.installEmptyGuardBoot({ win: window, doc, origin: location.origin, live, serverCount: async () => 16, ext: () => T.ext, toast: () => globalThis.toastr, eventSource: T.es, eventTypes: TYPES });
        assert.ok(h); assert.equal(G.guardSlot().owner, 'boot');
        await T.es.emit(TYPES.CHAT_CHANGED);
        assert.equal(h.guard.debug.known.get(keyOf(FILE_A)), 16);
        const bootFetch = window.fetch;
        await import(pathToFileURL(path.join(perfDir, 'savededupe.js')).href);
        const slot = G.guardSlot();
        assert.equal(slot.owner, 'perf'); assert.notEqual(slot.guard, h.guard);
        assert.equal(slot.guard, window.SaveDedupe.emptyGuard);
        assert.equal(slot.guard.debug.known, h.guard.debug.known, '같은 기억 객체를 넘겨받음');
        assert.notEqual(window.fetch, bootFetch, 'savededupe 가 바깥에서 감쌌다');
        const outer = window.fetch;
        assert.equal(B.installEmptyGuardBoot({ win: window, doc, origin: location.origin, live, serverCount: async () => 0, ext: () => T.ext, toast: () => null, eventSource: makeEvents(), eventTypes: TYPES }), null, '저장 정리가 맡은 뒤엔 다시 불러도 설치하지 않는다');
        assert.equal(window.fetch, outer);

        const bootChecked = h.guard.stats.checked;
        T.chat.length = 0;
        const r = await window.fetch('/api/chats/save', { method: 'POST', body: saveBody(FILE_A, []) });
        assert.equal(r.status, 409);
        assert.equal(sent.length, 0);
        assert.equal(toasts.length, 1, '알림 하나');
        assert.equal(slot.guard.stats.blocked, 1); assert.equal(h.guard.stats.blocked, 0);
        // 정상 저장: 저장 정리가 통과시키고, 안쪽의 독립 감싸개는 그냥 지나간다 (판정 1겹)
        for (let i = 0; i < 16; i++) T.chat.push(message(i));
        assert.equal((await window.fetch('/api/chats/save', { method: 'POST', body: saveBody(FILE_A, T.chat) })).status, 200);
        assert.equal(sent.length, 1);
        assert.equal(h.guard.stats.checked, bootChecked, '독립 판정은 돌지 않았다');
        // 사건도 한 겹: 지우기 모드로 다 지우면 저장 정리의 판정이 통과시킨다 (독립 쪽 사건 · 클릭은 active() 가 false)
        assert.equal(doc.captureCount(), 2, '클릭 듣기는 둘이 걸었지만');
        for (let i = 0; i < 16; i++) doc.selected.push(i);
        doc.click('dialogue_del_mes_ok'); doc.selected.length = 0;
        assert.equal(h.guard.debug.intent(), null, '독립 쪽은 적지 않음');
        assert.ok(slot.guard.debug.intent(), '저장 정리 쪽만 적음');
        T.chat.length = 0;
        assert.equal((await window.fetch('/api/chats/save', { method: 'POST', body: saveBody(FILE_A, []) })).status, 200);
        assert.equal(toasts.length, 1, '직접 지운 저장에는 알림 없음');
    });
}

// ── 연결 ──────────────────────────────────────────────────────
await test('연결: features.js(chat.emptyGuard · 기본 켬 · 확장만 모드도) · addons.js perfStarted · settings 기본값 · 보정 · 동작 값 목록 · 설정 줄 · 라벨 · 검색 · 도움말 · CI', () => {
    const features = read('src/features.js');
    assert.match(features, /const emptyGuard=\(on\|\|addonsOn\)&&s\.chat\?\.emptyGuard!==false;/);
    assert.match(features, /load\('emptyguard','\.\/empty-guard-boot\.js'\)\.then\(m=>m\?\.syncEmptyGuard\(emptyGuard\)\)/);
    const addons = read('src/addons.js');
    assert.match(addons, /export const perfStarted=new Promise/);
    assert.match(addons, /try\{await startAddonsOnce\(\);\}finally\{settlePerf\(\);\}/);
    assert.match(addons, /if\(ids\.includes\('perf'\)\)\{await startOne\('perf'\);[^\n]*\n    settlePerf\(\);/);
    const settings = read('src/settings.js');
    assert.match(settings, /chat: \{[^\n]*, emptyGuard: true,/);
    assert.match(settings, /s\.chat\.emptyGuard = flag\(s\.chat\.emptyGuard, true\);/);
    assert.match(settings, /if \(guardUnset && isObj\(s\.chat\) && ext\.save_dedupe\?\.emptyGuard === false\) s\.chat\.emptyGuard = false;/);
    assert.match(settings, /'mesPins'[^\]]*'emptyGuard'[^\]]*\]\) \{/);   // 초기화가 남기는 동작 값 목록 (사이 · 뒤에 다른 키가 붙어도 된다)
    assert.match(read('src/styles.js'), /'mesPins'[^\]]*'emptyGuard'[^\]]*\];/);
    assert.match(read('src/panel.js'), /row\('빈 채팅 덮어쓰기 막기', toggle\('chat\.emptyGuard', s\.chat\.emptyGuard !== false\),/);
    assert.match(read('src/settings-labels.js'), /"chat\.emptyGuard":"빈 채팅 덮어쓰기 막기"/);
    const search = read('src/settings-search.js').split('\n').find(line => line.includes("'chat.emptyGuard'"));
    assert.ok(search, '검색 항목');
    for (const word of ['빈 채팅', '날아감', '덮어쓰기', '저장 막기', '채팅 사라짐']) assert.ok(search.includes(word), word);
    assert.match(read('src/faq-data.js'), /8\.2\.6 부터는 성능 보조를 켜지 않아도 설정 › 채팅 › 기타 「빈 채팅 덮어쓰기 막기」/);
    const boot = read('src/empty-guard-boot.js');
    assert.match(boot, /from '\.\/addons\/perf\/emptyguard\.js';/, '판정은 emptyguard.js 재사용');
    assert.ok(!/function messagesInBody|function createEmptyGuard/.test(boot), '판정을 베끼지 않음');
    assert.match(read('src/addons/perf/recovery.js'), /export \{ bodyKey, liveChatFrom \} from '\.\/emptyguard\.js';/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/empty-guard-standalone\.mjs \./);
});

console.warn = quietWarn; console.info = quietInfo;
console.log(`empty-guard-standalone: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
