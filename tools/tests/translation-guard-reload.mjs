// 6.5.2 번역기 보호(translation-guard.js): 같은 채팅을 제자리에서 다시 불러와도(reloadCurrentChat → 배열 교체 · CHAT_CHANGED) 번역 대상을 잃지 않는다.
//   - 같은 열쇠의 CHAT_CHANGED 는 세대를 올리지 않는다 · 다른 채팅으로 가면 올린다 (갔다 돌아와도 옛 보호는 무효)
//   - 배열이 새 객체로 바뀌면 같은 자리 · 같은 글 · 같은 스와이프 · 같은 번역 표시의 메시지로 옮겨 탄다 (index · target)
//   - 다시 불러오는 사이(배열이 비었거나 짧은 순간)는 settled() 가 false
//   - 글이 달라졌거나 · 스와이프 · 편집(revision) · 표시가 바뀌면 전처럼 무효 (sameTarget 은 글만 달라진 것을 허용)
//   node tools/tests/translation-guard-reload.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { createGuards } = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-guard.js')).href);

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

function world() {
    const ctx = { groupId: null, characterId: 1, chatId: 'chat-A', chat: [] };
    const make = (n) => ({ mes: `답 ${n}`, name: '캐릭터', send_date: `2026-10-15 10:0${n}`, swipe_id: 0, is_user: false, extra: {} });
    ctx.chat = [make(0), make(1), make(2)];
    const guards = createGuards(() => ctx);
    // 실리태번의 reloadCurrentChat 흉내: 비우고(그 사이 잠깐 빈 배열) 파일에서 같은 글을 다시 채운다 → 새 객체 · CHAT_CHANGED
    const reload = (mutate = x => x) => { const copy = ctx.chat.map(m => mutate(JSON.parse(JSON.stringify(m)))); ctx.chat.length = 0; const settle = () => { ctx.chat.push(...copy); guards.chatChanged(); }; return settle; };
    return { ctx, guards, make, reload };
}

test('같은 채팅을 제자리에서 다시 불러오면 보호가 살아 있고 새 객체로 옮겨 탄다', () => {
    const { ctx, guards, reload } = world();
    const old = ctx.chat[2], g = guards.capture(old), c = guards.capture();
    assert.equal(g.valid(), true); assert.equal(g.index(), 2);
    const settle = reload();
    assert.equal(c.valid(), true, '채팅 보호: 열쇠가 같다');
    assert.equal(g.settled(), false, '비어 있는 동안은 아직 모름');
    assert.equal(g.valid(), false, '아직 자리가 없으니 지금은 무효 (부르는 쪽이 기다린다)');
    settle();
    assert.equal(c.valid(), true, 'CHAT_CHANGED 가 와도 같은 열쇠면 세대 그대로');
    assert.equal(g.settled(), true); assert.equal(g.valid(), true, '같은 자리 · 같은 글 → 유효');
    assert.notEqual(g.target(), old); assert.equal(g.target(), ctx.chat[2]); assert.equal(g.index(), 2);
    g.target().extra.display_text = '번역'; assert.equal(g.valid(), false, '옮겨 탄 뒤에도 표시가 바뀌면 무효');
    g.acceptDisplay(); assert.equal(g.valid(), true);
});
test('다시 불러온 글이 다르거나 스와이프 · 표시가 다르면 옮겨 타지 않는다 (sameTarget 은 글만 달라진 것을 허용)', () => {
    let w = world(); let g = w.guards.capture(w.ctx.chat[2]);
    w.reload(m => ({ ...m, mes: m.mes + ' (고침)' }))();
    assert.equal(g.valid(), false); assert.equal(g.index(), -1);
    assert.equal(g.sameTarget(), true, '같은 자리 · 같은 스와이프 · 같은 표시 → 글만 바뀐 같은 대상'); assert.equal(g.target(), w.ctx.chat[2]);
    w = world(); g = w.guards.capture(w.ctx.chat[2]);
    w.reload(m => ({ ...m, swipe_id: 1 }))();
    assert.equal(g.valid(), false); assert.equal(g.sameTarget(), false);
    w = world(); g = w.guards.capture(w.ctx.chat[2]);
    w.reload(m => ({ ...m, extra: { display_text: '다른 번역' } }))();
    assert.equal(g.valid(), false); assert.equal(g.sameTarget(), false);
    w = world(); g = w.guards.capture(w.ctx.chat[2]);
    w.reload(m => ({ ...m, is_user: true }))();
    assert.equal(g.valid(), false, '사용자 글이 그 자리에 오면 다른 메시지');
    w = world(); g = w.guards.capture(w.ctx.chat[2]);
    w.reload(m => ({ ...m, send_date: '다른 때' }))();
    assert.equal(g.valid(), false, '보낸 시각이 다르면 다른 메시지'); assert.equal(g.sameTarget(), false);
});
test('다른 채팅으로 가면 무효 · 돌아와도 옛 보호는 무효 (세대)', () => {
    const { ctx, guards, make } = world();
    const g = guards.capture(ctx.chat[1]), c = guards.capture();
    ctx.chatId = 'chat-B'; ctx.chat = [make(9)]; guards.chatChanged();
    assert.equal(c.valid(), false); assert.equal(g.valid(), false); assert.equal(g.sameTarget(), false);
    ctx.chatId = 'chat-A'; ctx.chat = [make(0), make(1), make(2)]; guards.chatChanged();
    assert.equal(c.valid(), false, '갔다 돌아온 것은 다른 세대'); assert.equal(g.valid(), false);
    const g2 = guards.capture(ctx.chat[1]); assert.equal(g2.valid(), true, '새 보호는 유효');
});
test('번역기가 채팅이 열린 뒤에 켜져 CHAT_CHANGED 를 본 적이 없어도, 같은 열쇠의 첫 CHAT_CHANGED 는 세대를 올리지 않는다', () => {
    const { ctx, guards, make } = world();
    const c = guards.capture();
    guards.chatChanged();
    assert.equal(c.valid(), true, '잡을 때의 열쇠와 같다 — 제자리 다시 불러오기');
    ctx.chatId = 'chat-B'; ctx.chat = [make(9)]; guards.chatChanged(); assert.equal(c.valid(), false, '다른 열쇠면 올린다');
    const g2 = createGuards(() => ctx); g2.chatChanged(); const c2 = g2.capture(); g2.chatChanged(); assert.equal(c2.valid(), true, '잡기 전에 본 열쇠와 같아도 그대로');
});
test('편집(revision) · 글 바뀜 · 앞 메시지 삭제 · 지움은 전처럼', () => {
    const { ctx, guards } = world();
    let g = guards.capture(ctx.chat[2]);
    guards.messageChanged(2); assert.equal(g.valid(), false); assert.equal(g.sameTarget(), false, 'MESSAGE_EDITED 뒤엔 같은 대상이 아니다');
    g = guards.capture(ctx.chat[2]); ctx.chat[2].mes = '다른 글'; assert.equal(g.valid(), false); assert.equal(g.sameTarget(), true, '글만 바뀜');
    g = guards.capture(ctx.chat[2]); ctx.chat.splice(0, 1); assert.equal(g.valid(), true, '객체가 남아 있으면 번호가 밀려도 유효'); assert.equal(g.index(), 1);
    const w = world(); g = w.guards.capture(w.ctx.chat[1]); w.ctx.chat.splice(1, 1);
    assert.equal(g.valid(), false, '지워진 메시지 (그 자리엔 다른 글)'); assert.equal(g.sameTarget(), false); assert.equal(g.settled(), true, '배열은 안정됐다');
    const w2 = world(); g = w2.guards.capture(w2.ctx.chat[2]); w2.ctx.chat.splice(2, 1);
    assert.equal(g.settled(), false, '마지막 메시지가 지워지면 다시 불러오는 중과 구별이 안 된다 — 부르는 쪽이 잠깐(최대 8초) 기다린 뒤 무효로 본다'); assert.equal(g.valid(), false);
});
test('메시지 없는 채팅 보호는 settled 가 늘 참', () => {
    const { guards, reload } = world();
    const c = guards.capture();
    const settle = reload(); assert.equal(c.settled(), true); assert.equal(c.valid(), true); settle(); assert.equal(c.valid(), true);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
