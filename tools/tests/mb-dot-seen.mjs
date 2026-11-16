// 1.5.9 미트볼 칸의 빨간 점(.ss-t-dot) — 눌러서 펼쳐 본 칸의 점만 테마 시트로 숨기고, 새 AI 답 · 채팅 바꾸기 · 그 확장이 스스로 끈 뒤에는 다시 보여요(src/ext-compat.js)
//   그 확장의 요소 · 자료는 안 건드려요(시트 한 장만) · 「원작 그대로 보기」 에서는 안 숨겨요
//   node tools/tests/mb-dot-seen.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// ── 가짜 문서 · 띠 ─────────────────────────────
const handlers = new Map();
const eventSource = { on: (name, fn) => { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); } };
const emit = name => { for (const fn of handlers.get(name) || []) fn(); };
globalThis.SillyTavern = { getContext: () => ({ eventSource, event_types: { MESSAGE_RECEIVED: 'message_received', CHAT_CHANGED: 'chat_id_changed' } }) };
const listeners = new Map();
const sheets = new Map();
const doc = {
    body: { hasAttribute: () => false, dataset: {} }, head: { appendChild: el => { sheets.set(el.id, el); } },
    createElement: () => ({ id: '', textContent: '' }), getElementById: id => sheets.get(id) || null,
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    querySelector: () => null, querySelectorAll: () => [], defaultView: globalThis,
};
let touched = 0;   // 그 확장 요소에 쓰기가 한 번이라도 나면 실패
const tileOf = (key, { dot = true, edit = false } = {}) => {
    const tile = {
        dot, classList: { contains: c => (c === 'edit' ? edit : c === 'ss-t') }, getAttribute: a => (a === 'data-k' ? key : null),
        querySelector: sel => (sel === ':scope > .ss-t-dot' && tile.dot ? {} : null),
        setAttribute() { touched++; }, removeAttribute() { touched++; }, style: { setProperty() { touched++; } },
    };
    tile.closest = sel => (sel === '.ss-tb .ss-t[data-k]' ? tile : null);
    return tile;
};
const inner = tile => ({ closest: sel => tile.closest(sel) });   // 칸 안쪽 글자를 누름
const boardOf = tiles => ({ classList: { contains: c => c === 'ss-tb' }, querySelector: sel => { const m = /data-k="([^"]+)"/.exec(sel); return tiles.find(t => t.getAttribute('data-k') === m?.[1]) || null; }, querySelectorAll: () => [], closest: () => null });

const m = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href);
const css = () => sheets.get(m.DOT_SHEET)?.textContent ?? '';

await ok('① 시트 글: 본 칸만 · 원작 그대로 보기는 빼고 · 이상한 이름은 버려요', () => {
    assert.equal(m.dotCss([]), '');
    const text = m.dotCss(['date', 'loc', 'a"]{}', '']);
    assert.match(text, /^body\.salty:not\(\[data-bl-ext-raw\]\) \.ss-tb \.ss-t:is\(\[data-k="date"\],\[data-k="loc"\]\) > \.ss-t-dot \{ display: none !important; \}$/);
});
await ok('② 점 켜진 칸을 누르면 그 칸만 숨겨요 — 점 없는 칸 · 편집 중인 칸 · 칸 밖은 아님', () => {
    const date = tileOf('date'), loc = tileOf('loc');
    assert.equal(m.seeDot(doc, inner(tileOf('mood', { dot: false }))), '');
    assert.equal(m.seeDot(doc, inner(tileOf('time', { edit: true }))), '');
    assert.equal(m.seeDot(doc, { closest: () => null }), '');
    assert.equal(css(), '', '아직 시트 없음');
    assert.equal(m.seeDot(doc, inner(date)), 'date');
    assert.match(css(), /\[data-k="date"\]/); assert.doesNotMatch(css(), /\[data-k="loc"\]/);
    assert.equal(m.seeDot(doc, inner(date)), '', '두 번째 누름은 새로 적지 않아요');
    assert.equal(m.seeDot(doc, inner(loc)), 'loc');
    assert.match(css(), /\[data-k="date"\],\[data-k="loc"\]/);
});
await ok('③ 띠가 다시 그려져도 점이 남아 있으면 계속 숨기고, 그 확장이 점을 끄면 그 칸을 잊어요', () => {
    assert.equal(m.syncDots(doc, boardOf([tileOf('date'), tileOf('loc')])), 2);
    assert.equal(m.syncDots(doc, boardOf([tileOf('date')])), 2, '이 띠에 없는 칸은 그대로');
    assert.equal(m.syncDots(doc, boardOf([tileOf('date', { dot: false }), tileOf('loc')])), 1);
    assert.doesNotMatch(css(), /\[data-k="date"\]/); assert.match(css(), /\[data-k="loc"\]/);
});
await ok('④ 새 답 · 채팅 바꾸기에 모두 잊어요 — 다음 점은 다시 보여요', () => {
    assert.equal(m.clearDots(doc), 1); assert.equal(css(), ''); assert.equal(m.clearDots(doc), 0);
});
await ok('⑤ 실제 길: 문서 누름(잡는 단계) → 숨김 → 메시지 받음 신호 → 다시 보임 · 누름은 막지 않아요', () => {
    m.startExtCompat(doc);
    const click = listeners.get('click')?.[0]; assert.ok(click, '누름 받기');
    let stopped = 0; const date = tileOf('date');
    click({ target: inner(date), stopPropagation() { stopped++; }, preventDefault() { stopped++; } });
    assert.match(css(), /\[data-k="date"\]/); assert.equal(stopped, 0);
    assert.ok(handlers.get('message_received')?.length === 1 && handlers.get('chat_id_changed')?.length === 1, '신호는 한 번씩만 걸어요');
    emit('message_received'); assert.equal(css(), '');
    click({ target: inner(date), stopPropagation() { stopped++; }, preventDefault() { stopped++; } });
    assert.match(css(), /\[data-k="date"\]/);
    assert.equal(handlers.get('message_received').length, 1, '다시 걸지 않아요');
    emit('chat_id_changed'); assert.equal(css(), '');
    // 다시 그려진 띠 신호(0.001초 키프레임)로도 맞춰요
    click({ target: inner(date), stopPropagation() { }, preventDefault() { } });
    const anim = listeners.get('animationstart')?.[0]; assert.ok(anim);
    anim({ animationName: 'ss-pulse', target: boardOf([tileOf('date', { dot: false })]) });
    assert.equal(css(), '');
});
await ok('⑥ 그 확장 요소에는 아무것도 쓰지 않아요', () => { assert.equal(touched, 0); });
console.log(`mb-dot-seen: ${n}개 통과`);
