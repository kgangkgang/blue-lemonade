// 성능 보조 · 저장 정리 — 밀린 채팅 저장 되살리기 · 채팅 바꾸기 전 남은 저장 마치기 · 답 받는 중 바꾸기 막기
//   (src/addons/perf/recovery.js · switchflush.js · switchguard.js)
//   node tools/tests/perf-save-recovery.mjs <테마 루트>
// 셋 다 환경(env)을 받는 순수 모듈이라 가짜 시계 · 가짜 저장 · 가짜 채팅으로 진짜 함수를 그대로 돌린다. 실리태번 모듈 없음.
// 확인하는 것:
//   1) bodyKey(저장 본문) 와 liveChatFrom(getContext) 이 같은 채팅을 같은 키로 (캐릭터 c|아바타|파일 · 그룹 g|id) — 다르면 복구가 엉뚱한 채팅을 막거나 저장한다
//   2) 밀린 저장: 앞 저장이 끝나고 조용해지면 같은 채팅을 한 번 다시 저장 · 그 사이 새 내용을 실은 저장이 있었으면 안 함 ·
//      채팅이 바뀌면 안 함(요청 직전에 바뀌면 막음) · 비워졌다 다시 불러오는 중이면 기다림 · 몇 번 해 보고/2분 뒤 포기 · 끄면 멈춤 · 가려지면 바로
//   3) 바꾸기 전 저장: 실리태번 1초 저장 타이머만 · 채팅별로 세고 취소 · 남은 저장이 있을 때만 붙잡아 한 번 저장 ·
//      실패하면 취소한 타이머 대신 「저장 안 됨」을 남겨 계속 붙잡음 · 오래 걸리면 끊지 않고 timeout(마지막 저장의 2배까지) · 답을 받는 중이면 blocked
//   4) 바꾸기 막기: 생성 중 · 다시 쓰기 잠금(상한 없음) · 마무리 중(20초 상한) · 끊긴 스트림의 답이 저장 전인지 · 슬래시 명령은 한 번만 감쌈 · 누른 곳 찾기
// 지어낸 캐릭터 이름만 쓴다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const perfDir = path.join(root, 'src/addons/perf');
const R = await import(pathToFileURL(path.join(perfDir, 'recovery.js')).href);
const F = await import(pathToFileURL(path.join(perfDir, 'switchflush.js')).href);
const G = await import(pathToFileURL(path.join(perfDir, 'switchguard.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
function clock(start = 0) {
    let t = start;
    const timers = new Set();
    return {
        now: () => t,
        setTimer(fn, ms) { const id = { at: t + (ms || 0), fn }; timers.add(id); return id; },
        clearTimer(id) { timers.delete(id); },
        async advance(ms) {
            const end = t + ms;
            for (;;) {
                let next = null;
                for (const x of timers) if (x.at <= end && (!next || x.at < next.at)) next = x;
                if (!next) break;
                timers.delete(next); t = Math.max(t, next.at); next.fn(); await flush();
            }
            t = end;
        },
    };
}
const KEY = 'c|mina.png|Mina - 2026-01-02';
const OTHER = 'c|juno.png|Juno - 2026-02-03';

await test('bodyKey 와 liveChatFrom 은 같은 채팅을 같은 키로 (따옴표 · 한글 이름도) · 모르는 본문은 null', () => {
    const character = { name: 'Mina "the" Baker', avatar: 'mina.png', chat: 'Mina - 2026-01-02 \\ 빵집' };
    const ctx = { characterId: 0, characters: [character], chat: [{}, {}, {}], chatMetadata: { integrity: 'int-1' } };
    const body = JSON.stringify({ ch_name: character.name, file_name: character.chat, chat: [{ mes: '"따옴표"와 \\역슬래시' }], avatar_url: character.avatar, force: false });
    const live = R.liveChatFrom(ctx);
    assert.deepEqual(live, { key: `c|mina.png|${character.chat}`, integrity: 'int-1', length: 3 });
    assert.equal(R.bodyKey('/api/chats/save', body), live.key);
    assert.equal(R.bodyKey('/api/chats/save', body.replace('"force":false', '"force":true')), live.key);
    const group = { groupId: 'tea-party', getCurrentChatId: () => 'tea-party-2026', chat: [], chatMetadata: {} };
    assert.equal(R.bodyKey('/api/chats/group/save', JSON.stringify({ id: 'tea-party-2026', chat: [] })), R.liveChatFrom(group).key);
    assert.equal(R.liveChatFrom(group).key, 'g|tea-party-2026');
    for (const unknown of [new Uint8Array([1, 2]), JSON.stringify({ file_name: 'x', ch_name: 'y', chat: [], avatar_url: 'a', force: false }), body.slice(0, -1), '', null])
        assert.equal(R.bodyKey('/api/chats/save', unknown), null);
    assert.equal(R.bodyKey('/api/chats/group/save', '{"chat":[],"id":"x"}'), null);
    assert.equal(R.liveChatFrom({ characterId: '', characters: [character] }).key, null);
    assert.equal(R.liveChatFrom({ characterId: 0, characters: [{ avatar: 'mina.png' }] }).key, null);
    assert.equal(R.liveChatFrom(null), null);
});

// ── 밀린 저장 되살리기
function recovery(options = {}) {
    const c = clock(5000);
    const w = { c, saving: false, live: { key: KEY, integrity: 'int-1', length: 4 }, saves: 0, enabled: true, hidden: false, mode: 'ok', requestKey: undefined, blocks: [] };
    w.r = R.createRecovery({
        now: c.now, setTimer: c.setTimer, isSaving: () => w.saving, saveTimeout: () => 1000, live: () => w.live, enabled: () => w.enabled, hidden: () => w.hidden,
        save: async () => {
            w.saves++;
            w.beforeRequest?.();
            if (w.mode === 'none') return;
            // fetch 감싸개가 하는 일: 보내기 전에 묻고, 결과를 알린다
            const { block, token } = w.r.onSaveRequest({ key: w.requestKey === undefined ? w.live?.key ?? null : w.requestKey, own: true });
            w.blocks.push(block);
            if (!block) w.r.onSaveResult(token, w.mode !== 'fail', { skipped: w.mode === 'skip' });
        },
    }, options);
    return w;
}

await test('밀린 저장: 앞 저장이 끝나고 0.3초 조용하면 같은 채팅을 한 번 다시 저장한다 (recovered) · 겹친 경고는 하나로', async () => {
    const w = recovery();
    w.saving = true;
    w.r.onDrop();
    await w.c.advance(500);
    w.r.onDrop();
    assert.equal(w.r.pending().drops, 2);
    await w.c.advance(1000);
    assert.equal(w.saves, 0, 'waits while the earlier save runs');
    w.saving = false;
    await w.c.advance(200);
    assert.equal(w.saves, 0, 'waits for quiet');
    await w.c.advance(300);
    assert.equal(w.saves, 1);
    assert.equal(w.r.stats.recovered, 1); assert.equal(w.r.pending(), null);
    await w.c.advance(2000);
    assert.equal(w.saves, 1, 'only once');
});

await test('그 사이 새 내용을 실은 저장이 성공했으면 다시 저장하지 않는다 · 경고 전에 시작한 저장은 새 내용으로 치지 않는다', async () => {
    const w = recovery();
    w.saving = true;
    w.r.onDrop();
    await w.c.advance(100);
    const later = w.r.onSaveRequest({ key: KEY, own: false });
    w.r.onSaveResult(later.token, true);
    w.saving = false;
    await w.c.advance(1000);
    assert.equal(w.saves, 0); assert.equal(w.r.stats.coveredByOther, 1);
    const v = recovery();
    const early = v.r.onSaveRequest({ key: KEY, own: false });
    await v.c.advance(2000);
    v.saving = true;
    v.r.onDrop();
    v.r.onSaveResult(early.token, true);
    v.saving = false;
    await v.c.advance(1000);
    assert.equal(v.saves, 1, 'a save that started before the dropped one does not carry its content');
    assert.equal(v.r.stats.recovered, 1);
});

await test('채팅이 바뀌면 저장하지 않는다 · 복구 저장 직전에 바뀌거나 다른 채팅 본문이면 요청을 막는다 · 비워졌다 다시 불러오는 중이면 기다린다', async () => {
    const a = recovery();
    a.r.onDrop();
    a.live = { key: OTHER, integrity: 'int-9', length: 2 };
    await a.c.advance(1000);
    assert.equal(a.saves, 0); assert.equal(a.r.stats.chatChanged, 1);
    const b = recovery();
    b.r.onDrop();
    b.live = { ...b.live, integrity: 'int-2' };
    await b.c.advance(1000);
    assert.equal(b.saves, 0, 'same file name but reloaded (integrity differs)');
    const c = recovery();
    c.r.onDrop();
    c.beforeRequest = () => { c.live = { key: OTHER, integrity: 'int-9', length: 2 }; };
    await c.c.advance(1000);
    assert.deepEqual(c.blocks, [true]); assert.equal(c.r.stats.blocked, 1); assert.equal(c.r.stats.chatChanged, 1);
    const d = recovery();
    d.r.onDrop();
    d.requestKey = OTHER;
    await d.c.advance(1000);
    assert.deepEqual(d.blocks, [true], 'the body belongs to another chat');
    const e = recovery();
    e.r.onDrop();
    e.live = { ...e.live, length: 0 };
    await e.c.advance(2000);
    assert.equal(e.saves, 0, 'chat emptied while reloading: wait');
    e.live = { ...e.live, length: 4 };
    await e.c.advance(1000);
    assert.equal(e.saves, 1); assert.deepEqual(e.blocks, [false]);
});

await test('복구 호출이 요청으로 이어지지 않으면 3번 해 보고 · 앞 저장이 2분 넘게 안 끝나면 포기 · 끄면 멈춤 · 같은 본문이라 건너뛴 것도 성공', async () => {
    const a = recovery();
    a.mode = 'none';
    a.r.onDrop();
    await a.c.advance(5000);
    assert.equal(a.saves, 3); assert.equal(a.r.stats.gaveUp, 1); assert.equal(a.r.pending(), null);
    const b = recovery();
    b.saving = true;
    b.r.onDrop();
    await b.c.advance(119000);
    assert.ok(b.r.pending(), 'still waiting before 2 minutes');
    await b.c.advance(2000);
    assert.equal(b.r.pending(), null); assert.equal(b.saves, 0); assert.equal(b.r.stats.gaveUp, 1);
    const c = recovery();
    c.r.onDrop();
    c.enabled = false;
    await c.c.advance(1000);
    assert.equal(c.saves, 0); assert.equal(c.r.pending(), null); assert.equal(c.r.stats.gaveUp, 0);
    c.r.onDrop();
    assert.equal(c.r.pending(), null, 'disabled: drops are ignored');
    const d = recovery();
    d.mode = 'skip';
    d.r.onDrop();
    await d.c.advance(1000);
    assert.equal(d.r.stats.alreadySaved, 1);
    const e = recovery();
    e.live = { key: null, integrity: undefined, length: 0 };
    e.r.onDrop();
    assert.equal(e.r.pending(), null, 'no chat open');
});

await test('페이지가 가려지면 조용한 시간을 기다리지 않고 바로 저장한다', async () => {
    const w = recovery();
    w.r.onDrop();
    w.hidden = true;
    w.r.kick();
    await w.c.advance(100);
    assert.equal(w.saves, 1);
});

// ── 바꾸기 전 저장 마치기
await test('저장 타이머: 실리태번 1초 저장 타이머만 · 채팅별로 세고 · 그 채팅 것만 취소 · 끝까지 도는 동안 running', async () => {
    const c = clock();
    let stack = '', on = true, live = { key: KEY, integrity: 'int-1' };
    const t = F.createSaveTimers({ nativeSet: (fn, ms) => c.setTimer(fn, ms), nativeClear: id => c.clearTimer(id), delay: () => 1000, stack: () => stack, live: () => live, enabled: () => on, now: c.now });
    const fired = [];
    const at = (name, s) => { stack = s; return name; };
    t.setTimeout(() => fired.push('chat-a'), 1000, at('a', 'Error\n    at saveChatDebounced (http://st.test/script.js:1:1)'));
    stack = 'Error\n    at Object.saveMetadataDebounced (http://st.test/script.js:2:2)';
    t.setTimeout(() => fired.push('meta-a'), 1000);
    stack = 'Error\n    at somethingElse (http://st.test/other.js:3:3)';
    t.setTimeout(() => fired.push('other'), 1000);
    stack = 'Error\n    at saveChatDebounced (http://st.test/script.js:1:1)';
    t.setTimeout(() => fired.push('short'), 500);
    assert.equal(t.waitingFor(), 2); assert.equal(t.waitingFor(live), 2);
    live = { key: OTHER, integrity: 'int-9' };
    t.setTimeout(() => fired.push('chat-b'), 1000);
    assert.equal(t.waitingFor(live), 1); assert.equal(t.waitingFor({ key: KEY, integrity: 'int-1' }), 2); assert.equal(t.waitingFor({ key: KEY, integrity: 'int-2' }), 0);
    on = false;
    t.setTimeout(() => fired.push('off'), 1000);
    on = true;
    t.cancelFor({ key: KEY, integrity: 'int-1' });
    assert.equal(t.stats.flushed, 2); assert.equal(t.waitingFor(), 1);
    let release;
    t.setTimeout(() => { fired.push('slow-b'); return new Promise(r => { release = r; }); }, 1000);
    const id = t.setTimeout(() => fired.push('cleared'), 1000);
    t.clearTimeout(id);
    assert.equal(t.stats.cleared, 1);
    await c.advance(1000);
    assert.deepEqual(fired.sort(), ['chat-b', 'off', 'other', 'short', 'slow-b']);
    assert.equal(t.running(), 1, 'the timer callback is still saving'); assert.equal(t.waitingFor(), 0);
    release(); await flush();
    assert.equal(t.running(), 0);
    assert.equal(F.timerKind('saveChatDebounced@http://st.test/script.js:1:1'), 'chat');
    assert.equal(F.timerKind('    at async saveMetadataDebounced (x.js:1:1)'), 'meta');
    assert.equal(F.timerKind('    at notsaveChatDebouncedReally (x.js:1:1)'), null);
});

function switchFlush(options = {}) {
    const c = clock(1000);
    const w = { c, saving: false, live: { key: KEY, integrity: 'int-1', length: 3 }, saves: 0, okAt: new Map(), generating: false, mode: 'ok', lastSaveMs: 0, recovery: null, fired: 0 };
    w.timers = F.createSaveTimers({ nativeSet: (fn, ms) => c.setTimer(fn, ms), nativeClear: id => c.clearTimer(id), delay: () => 1000, stack: () => 'Error\n    at saveChatDebounced (http://st.test/script.js:1:1)', live: () => w.live, enabled: () => true, now: c.now });
    w.flush = F.createSwitchFlush({
        now: c.now, sleep: ms => new Promise(r => c.setTimer(r, ms)), isSaving: () => w.saving, timers: w.timers, live: () => w.live,
        recoveryPending: () => w.recovery, recoveryBusy: () => false,
        save: () => {
            w.saves++;
            const started = c.now(), key = w.live.key;
            if (w.mode === 'hang') return new Promise(() => {});
            if (w.mode === 'ok') w.okAt.set(key, started);
            return Promise.resolve();
        },
        savedSince: (key, since) => (w.okAt.get(key) ?? -Infinity) >= since,
        lastSaveMs: () => w.lastSaveMs, generating: () => w.generating,
    }, options);
    w.edit = () => w.timers.setTimeout(() => { w.fired++; }, 1000);
    w.run = async () => {
        const t0 = c.now();
        let result;
        const p = w.flush.run().then(r => { result = r; });
        for (let i = 0; i < 2000 && result === undefined; i++) await c.advance(10);
        await p;
        return { result, ms: c.now() - t0 };
    };
    return w;
}

await test('바꾸기 전 저장: 남은 것이 없으면 붙잡지도 저장하지도 않음 · 1초 저장 대기가 있으면 그 타이머를 취소하고 한 번 저장(saved)', async () => {
    const w = switchFlush();
    assert.equal(w.flush.pending(), false);
    assert.equal((await w.run()).result, 'nothing'); assert.equal(w.saves, 0);
    w.edit();
    assert.equal(w.flush.pending(), true);
    const r = await w.run();
    assert.equal(r.result, 'saved'); assert.equal(w.saves, 1); assert.equal(w.flush.stats.saved, 1);
    await w.c.advance(3000);
    assert.equal(w.fired, 0, 'the debounced save was replaced, not run twice');
    assert.equal(w.flush.pending(), false);
    const v = switchFlush();
    v.recovery = { key: KEY, since: v.c.now() };
    assert.equal(v.flush.pending(), true);
    assert.equal((await v.run()).result, 'saved', 'a pending recovery for this chat is saved before switching');
});

await test('저장이 실패하면 failed · 취소한 타이머 대신 「저장 안 됨」을 남겨 다음 바꾸기도 붙잡는다 · 성공하면 풀린다', async () => {
    const w = switchFlush();
    w.mode = 'fail';
    w.edit();
    assert.equal((await w.run()).result, 'failed');
    assert.equal(w.timers.waitingFor(), 0, 'the debounce was cancelled');
    assert.equal(w.flush.pending(), true, 'the unsaved edit is still remembered');
    w.mode = 'ok';
    assert.equal((await w.run()).result, 'saved');
    assert.equal(w.saves, 2);
    assert.equal(w.flush.pending(), false);
});

await test('저장이 오래 걸리면 끊지 않고 timeout (5초 · 마지막 저장이 길었으면 그 2배) · 답을 받는 중이면 blocked · 채팅이 바뀌면 chat-changed', async () => {
    const a = switchFlush();
    a.mode = 'hang';
    a.edit();
    const ra = await a.run();
    assert.equal(ra.result, 'timeout'); assert.ok(ra.ms >= 5000 && ra.ms < 5600, `about 5 s (${ra.ms})`);
    const b = switchFlush();
    b.mode = 'hang'; b.lastSaveMs = 4000;
    b.edit();
    const rb = await b.run();
    assert.equal(rb.result, 'timeout'); assert.ok(rb.ms >= 8000 && rb.ms < 8600, `twice the last save (${rb.ms})`);
    const c = switchFlush();
    c.generating = true;
    c.edit();
    assert.equal((await c.run()).result, 'blocked'); assert.equal(c.saves, 0);
    const d = switchFlush();
    d.edit();
    d.saving = true;
    d.c.setTimer(() => { d.live = { key: OTHER, integrity: 'int-9', length: 1 }; d.saving = false; }, 300);
    assert.equal((await d.run()).result, 'chat-changed'); assert.equal(d.saves, 0, 'never saves into another chat');
});

// ── 답 받는 중 바꾸기 막기
await test('바꾸기 막기: 생성 중 · 다시 쓰기 잠금(상한 없음)은 generating · 마무리 중은 20초까지 finishing · 끊긴 답이 저장 전인지', () => {
    let gen = false, locked = false, proc = null, t = 0;
    const savedAt = new Map(), chat = [];
    const g = G.createSwitchGuard({ isGenerating: () => gen, processor: () => proc, messageAt: id => chat[id], now: () => t, savedSinceWall: (key, wall) => (savedAt.get(key) ?? -Infinity) > wall, pageLocked: () => locked });
    assert.equal(g.state(), null);
    gen = true; assert.equal(g.state(), 'generating');
    gen = false; locked = true; t += 60000; assert.equal(g.state(), 'generating', 'rewrite lock has no time limit');
    locked = false;
    proc = { isStopped: false, messageDom: { isConnected: true }, messageId: 1 };
    assert.equal(g.state(), 'finishing');
    t += 19000; assert.equal(g.state(), 'finishing');
    t += 2000; assert.equal(g.state(), null, 'stuck finishing stops holding after 20 s');
    proc = { ...proc }; assert.equal(g.state(), 'finishing', 'a new reply starts a new window');
    proc.messageDom = { isConnected: false }; assert.equal(g.state(), null, 'the chat was already switched');
    const live = { key: KEY };
    proc = { isStopped: true, messageDom: { isConnected: true }, messageId: 1, createdAt: '2026-01-02T03:00:00Z' };
    chat[1] = { gen_finished: '2026-01-02T03:04:05Z' };
    assert.equal(g.erroredUnsaved(live), true);
    savedAt.set(KEY, Date.parse('2026-01-02T03:04:06Z'));
    assert.equal(g.erroredUnsaved(live), false, 'saved after the reply');
    chat[1] = { gen_finished: 'not a date' };
    savedAt.set(KEY, Date.parse('2026-01-02T02:00:00Z'));
    assert.equal(g.erroredUnsaved(live), true, 'falls back to the processor start');
    assert.equal(g.erroredUnsaved({ key: null }), false);
    chat[1] = undefined; assert.equal(g.erroredUnsaved(live), false);
    proc = { ...proc, isStopped: false }; chat[1] = { gen_finished: '2026-01-02T03:04:05Z' };
    assert.equal(g.erroredUnsaved(live), false, 'not an errored stream');
});

await test('슬래시 명령은 한 번만 감싼다 (/delchat 포함) · 누른 곳 찾기: 지난 채팅 칸 안의 내보내기는 제외 · 이름 바꾸기는 그 단추로', () => {
    const calls = [];
    const commands = { go: { callback: () => calls.push('go') }, delchat: { callback: () => calls.push('delchat') }, echo: { callback: () => calls.push('echo') } };
    const done = new WeakSet(), wrap = original => function wrapped(...args) { calls.push('guard'); return original.apply(this, args); };
    assert.ok(G.GUARD_COMMANDS.includes('delchat') && G.GUARD_COMMANDS.includes('go') && !G.GUARD_COMMANDS.includes('echo'));
    assert.equal(G.wrapCommands(commands, G.GUARD_COMMANDS, wrap, done), 2);
    assert.equal(G.wrapCommands(commands, G.GUARD_COMMANDS, wrap, done), 0, 'not wrapped twice');
    commands.go.callback(); commands.echo.callback(); commands.delchat.callback();
    assert.deepEqual(calls, ['guard', 'go', 'echo', 'guard', 'delchat']);
    assert.equal(G.wrapCommands(null, G.GUARD_COMMANDS, wrap, done), 0);
    // 작은 가짜 요소: class 목록과 부모만
    const node = (classes, parent = null) => ({
        classes, parentElement: parent,
        closest(sel) { for (let n = this; n; n = n.parentElement) if (sel.split(',').some(s => n.classes.includes(s.trim().slice(1)))) return n; return null; },
        contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; },
    });
    const block = node(['select_chat_block']);
    const title = node(['ch_name'], block), exportBtn = node(['exportChatButton'], block), rename = node(['renameChatButton'], block);
    assert.equal(F.matchSwitchEntry(title), block);
    assert.equal(F.matchSwitchEntry(exportBtn), null, 'export inside the past chat row does not switch');
    assert.equal(F.matchSwitchEntry(rename), rename, 'rename reloads the chat: matched as its own entry');
    assert.equal(F.matchSwitchEntry({ nodeType: 3, parentElement: title }), block, 'a text node uses its parent');
    assert.equal(F.matchSwitchEntry(node(['swipe_picker_branch'])).classes[0], 'swipe_picker_branch');
    assert.equal(F.matchSwitchEntry(node(['mes_text'])), null);
});

console.log(`perf-save-recovery: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
