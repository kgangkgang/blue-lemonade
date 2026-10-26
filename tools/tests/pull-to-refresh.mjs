import test from 'node:test';
import assert from 'node:assert/strict';
import { createPullGesture, installedTouchMode, trackRefreshWrites } from '../../src/pull-to-refresh.js';
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
test('저장 실패는 같은 저장이 성공하기 전까지 보호해요', async () => {
    let t = 0, ok = false;
    const win = { fetch: async () => ({ ok }), location: { href: 'https://example.test/', origin: 'https://example.test' } };
    const tracker = trackRefreshWrites(win, () => t, 1500);
    await win.fetch('/api/chats/save', { method: 'POST' }); t = 1000; assert.match(tracker.reason(), /저장을 확인하지/);
    ok = true; await win.fetch('/api/chats/save', { method: 'POST' }); t = 2000; assert.equal(tracker.reason(), ''); tracker.dispose();
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
