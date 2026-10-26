import test from 'node:test';
import assert from 'node:assert/strict';
import { createPullGesture, createRefreshGate, installedTouchMode, trackRefreshWrites, FAIL_HOLD_MS, FORCE_WINDOW_MS } from '../../src/pull-to-refresh.js';
import { preserveDraftForReload } from '../../src/draft.js';

test('작은 당김은 취소되고 충분한 세로 당김만 준비돼요', () => {
    const g = createPullGesture(20, 100, 0);
    assert.equal(g.move(20, 105, 40).claimed, false);
    assert.equal(g.move(22, 170, 100).armed, false);
    assert.equal(g.move(22, 220, 200).armed, true);
    assert.equal(g.move(22, 180, 300).armed, false);
});
test('가로·위쪽·대각선·다중 터치·길게 누르기는 다시 준비되지 않아요', () => {
    for (const step of [[60, 102, 30, 1], [20, 80, 30, 1], [90, 160, 30, 1], [20, 130, 30, 2], [20, 130, 700, 1]]) {
        const g = createPullGesture(20, 100, 0);
        assert.equal(g.move(...step).cancelled, true);
        assert.equal(g.move(20, 250, 800).cancelled, true);
    }
});
test('취소 뒤 같은 손짓으로 새로고침하지 않아요', () => {
    const g = createPullGesture(20, 100, 0); g.move(20, 230, 100); g.cancel();
    assert.equal(g.move(20, 250, 150).cancelled, true);
});
test('설치형·터치 조건을 모두 만족할 때만 켜져요', () => {
    const mode = (standalone, coarse, touch = 1) => ({ navigator: { maxTouchPoints: touch }, matchMedia: q => ({ matches: q.includes('standalone') ? standalone : coarse }) });
    assert.equal(installedTouchMode(mode(true, true)), true);
    for (const w of [mode(false, true), mode(true, false), mode(true, true, 0)]) assert.equal(installedTouchMode(w), false);
});
test('진행 중인 저장과 지연 저장 대기 동안 새로고침을 막아요', async () => {
    let t = 0, finish;
    const original = () => new Promise(r => { finish = r; });
    const win = { fetch: original, location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const tracker = trackRefreshWrites(win, () => t, 1500);
    const p = win.fetch('/api/settings/save', { method: 'POST' });
    assert.match(tracker.reason(), /저장 중/); finish({ ok: true }); await p;
    t = 301; assert.equal(tracker.reason(), ''); tracker.changed(); t = 1700; assert.match(tracker.reason(), /저장 중/);
    t = 1802; assert.equal(tracker.reason(), ''); tracker.dispose(); assert.equal(win.fetch, original);
});
test('저장 실패는 같은 저장이 다시 성공하면 바로 풀려요', async () => {
    let t = 0, ok = false;
    const win = { fetch: async () => ({ ok, status: ok ? 200 : 500 }), location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const tracker = trackRefreshWrites(win, () => t, 1500);
    await win.fetch('/api/chats/save', { method: 'POST' }); t = 1000; assert.match(tracker.reason(), /저장을 확인하지/); assert.equal(tracker.state(), 'failed');
    ok = true; await win.fetch('/api/chats/save', { method: 'POST' }); t = 2000; assert.equal(tracker.reason(), ''); tracker.dispose();
});
test('저장 실패는 같은 경로가 다시 성공하지 않아도 정해진 시간 뒤에는 막지 않아요', async () => {
    let t = 0;
    const win = { fetch: async () => { throw new TypeError('Failed to fetch'); }, location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const tracker = trackRefreshWrites(win, () => t, 1500);
    await assert.rejects(win.fetch('/api/settings/save', { method: 'POST' }));
    t = 1000; assert.equal(tracker.state(), 'failed');
    t = FAIL_HOLD_MS - 1; assert.equal(tracker.state(), 'failed');
    t = FAIL_HOLD_MS; assert.equal(tracker.state(), ''); assert.equal(tracker.reason(), '');
    // 기준은 마지막 실패 시각이에요. 나중에 다시 실패하면 그때부터 다시 세요.
    await assert.rejects(win.fetch('/api/settings/save', { method: 'POST' })); t += 1000; assert.equal(tracker.state(), 'failed');
    t += FAIL_HOLD_MS; assert.equal(tracker.state(), ''); tracker.dispose();
});
test('없는 주소·없는 파일(404)과 부른 쪽이 취소한 요청은 저장 실패로 보지 않아요', async () => {
    let t = 0, next;
    const win = { fetch: async () => next(), location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const tracker = trackRefreshWrites(win, () => t, 1500);
    for (const status of [404, 405, 410, 501]) { next = () => ({ ok: false, status }); await win.fetch('/api/files/delete', { method: 'POST' }); }
    next = () => { throw new DOMException('그만', 'AbortError'); }; await assert.rejects(win.fetch('/api/images/upload', { method: 'POST' }));
    t = 1000; assert.equal(tracker.state(), ''); assert.equal(tracker.reason(), '');
    next = () => ({ ok: false, status: 400 }); await win.fetch('/api/chats/save', { method: 'POST' }); t = 1400; assert.equal(tracker.state(), 'failed'); tracker.dispose();
});
test('조회 실패와 외부 요청은 저장 실패로 오판하지 않아요', async () => {
    let t = 0;
    const win = { fetch: async () => ({ ok: false }), location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const tracker = trackRefreshWrites(win, () => t, 1500);
    await win.fetch('/api/settings/get', { method: 'POST' }); t = 1000; assert.equal(tracker.reason(), '');
    await win.fetch('https://other.test/api/settings/save', { method: 'POST' }); assert.equal(tracker.reason(), ''); tracker.dispose();
});
test('초안은 마지막 글자까지 보관하고 저장 불가·시작 화면·초과 길이는 취소해요', () => {
    let text = '작성 중인 마지막 글자까지 🍋', id = '합성 대화'; const data = new Map();
    globalThis.document = { getElementById: () => ({ value: text }) };
    globalThis.SillyTavern = { getContext: () => ({ chatId: id }) };
    globalThis.localStorage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
    assert.equal(preserveDraftForReload(), true); assert.equal(JSON.parse(data.get('bl-drafts'))[id].t, text);
    text += '새 글'; localStorage.setItem = () => { throw Error('저장 공간 없음'); }; assert.equal(preserveDraftForReload(), false);
    text = 'a'.repeat(100001); assert.equal(preserveDraftForReload(), false);
    text = '시작 화면 입력'; id = null; assert.equal(preserveDraftForReload(), false);
    text = ''; assert.equal(preserveDraftForReload(), true);
    delete globalThis.document; delete globalThis.SillyTavern; delete globalThis.localStorage;
});

const fakeWrites = initial => { let s = initial; return { set(v) { s = v; }, state: () => s, reason: () => s === 'failed' ? '저장을 확인하지 못했어요. 한 번 더 당기면 그래도 새로고침해요.' : s === 'busy' ? '저장 중이에요. 잠시 뒤 다시 당겨 주세요.' : '' }; };
test('실패가 없으면 첫 당김에 바로 새로고침해요(기존 동작)', () => {
    let t = 0; const gate = createRefreshGate({ host: {}, writes: fakeWrites(''), now: () => t });
    assert.deepEqual(gate.check(), { reason: '', forced: false, failed: false });
    assert.equal(gate.release().reason, '');
});
test('저장 실패만 남았을 때는 안내 뒤 한 번 더 당기면 새로고침해요', () => {
    let t = 0; const gate = createRefreshGate({ host: {}, writes: fakeWrites('failed'), now: () => t });
    const first = gate.check(); assert.equal(first.forced, false); assert.match(first.reason, /한 번 더 당기면 그래도 새로고침해요/);
    assert.match(gate.release().reason, /한 번 더 당기면/);
    t = 3000; const again = gate.check(); assert.equal(again.reason, ''); assert.equal(again.forced, true);
    assert.equal(gate.release().reason, '');
    gate.clear(); assert.match(gate.check().reason, /한 번 더 당기면/);
});
test('다시 당기기가 늦으면 다시 안내부터 해요', () => {
    let t = 0; const gate = createRefreshGate({ host: {}, writes: fakeWrites('failed'), now: () => t });
    gate.release(); t = FORCE_WINDOW_MS + 1; assert.match(gate.check().reason, /한 번 더 당기면/);
    assert.match(gate.release().reason, /한 번 더 당기면/); t += 500; assert.equal(gate.check().forced, true);
});
test('생성 중·채팅 저장 중·편집 중·저장 진행 중에는 두 번 당겨도 막아요', () => {
    let t = 0;
    for (const [host, editing, pattern] of [
        [{ isGenerating: () => true }, false, /답변 생성 중/], [{ is_send_press: true }, false, /답변 생성 중/], [{ is_group_generating: true }, false, /답변 생성 중/],
        [{ isChatSaving: true }, false, /채팅 저장 중/], [{}, true, /메시지 편집/],
    ]) {
        const gate = createRefreshGate({ host, writes: fakeWrites('failed'), now: () => t, editing: () => editing });
        for (let i = 0; i < 3; i++) { assert.match(gate.release().reason, pattern); t += 200; }
        assert.equal(gate.check().forced, false);
    }
    const writes = fakeWrites('failed'); const gate = createRefreshGate({ host: {}, writes, now: () => t });
    gate.release(); writes.set('busy'); assert.match(gate.check().reason, /저장 중이에요/); assert.match(gate.release().reason, /저장 중이에요/);
    // 실패를 보고 한 번 당긴 뒤 생성이 시작되면 그 허락은 생성 보호를 넘지 못해요.
    const host = {}; const w2 = fakeWrites('failed'); const g2 = createRefreshGate({ host, writes: w2, now: () => t });
    g2.release(); host.is_send_press = true; assert.match(g2.release().reason, /답변 생성 중/);
});
test('실제 추적기와 함께: 실패 뒤 두 번 당기기와 저장 진행 중 보호', async () => {
    let t = 0, finish;
    const responses = [() => Promise.reject(new TypeError('Failed to fetch')), () => new Promise(r => { finish = r; })];
    const win = { fetch: () => responses.shift()(), location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const writes = trackRefreshWrites(win, () => t, 1500);
    const gate = createRefreshGate({ host: {}, writes, now: () => t });
    await assert.rejects(win.fetch('/api/images/upload', { method: 'POST' })); t = 400;
    assert.match(gate.release().reason, /한 번 더 당기면/); t = 900;
    const p = win.fetch('/api/chats/save', { method: 'POST' });
    assert.match(gate.release().reason, /저장 중/);
    finish({ ok: false, status: 500 }); await p; t = 1300; assert.equal(gate.check().forced, true);
    t = 1300 + FAIL_HOLD_MS; assert.deepEqual(gate.check(), { reason: '', forced: false, failed: false }); writes.dispose();
});
