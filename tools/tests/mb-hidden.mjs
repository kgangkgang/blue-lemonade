// 1.6.0 눈 감긴 답을 미트볼 상태에서 빼기(src/mb-hidden.js) — 눈 단추로 감긴 AI 답에만 표식(extra.type)을 적고, 뜨면 지워요.
//   그 확장이 적어 둔 자료(extra.statussim · 채팅 메타)는 한 글자도 안 바꿔요 · 다른 확장 · 명령이 감긴 답은 안 건드려요 · 다시 계산은 그 확장의 공개 명령으로만.
//   node tools/tests/mb-hidden.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// ── 가짜 실리태번 · 문서 ─────────────────────────────
const handlers = new Map();
const eventSource = { on: (name, fn) => { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); }, emit() { throw new Error('실리태번 사건을 지어내 쏘면 안 돼요'); } };
const ran = []; let saves = 0;
const OPS = () => ({ bySwipe: { 0: [['npc', 'Nell | met at the vault'], ['aff', 'Mira +3']] }, chips: { 0: ['a'] } });
const freshChat = () => [
    { is_user: false, is_system: false, mes: 'a', extra: { statussim: OPS() } },
    { is_user: true, is_system: false, mes: 'u' },
    { is_user: false, is_system: false, mes: 'b', extra: { statussim: OPS() } },
    { is_user: false, is_system: false, mes: 'c', swipe_id: 0 },
    { is_user: false, is_system: true, mes: 'narr', extra: { type: 'narrator' } },
];
const C = { chat: freshChat(), chatMetadata: { statussim: { base: { data: {} }, startAt: 0, paused: false, adjust: [] } }, eventSource, event_types: { CHAT_CHANGED: 'chat_id_changed', GENERATION_STARTED: 'generation_started' },
    SlashCommandParser: { commands: { 'ss-resume': {}, 'ss-pause': {} } }, executeSlashCommandsWithOptions: async text => { ran.push(text); }, saveChat: async () => { saves++; } };
globalThis.SillyTavern = { getContext: () => C };
const listeners = new Map();
const attrs = new Map();
const doc = { body: { hasAttribute: a => attrs.has(a), getAttribute: a => attrs.get(a) ?? null }, addEventListener: (type, fn, cap) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push([fn, cap]); } };
globalThis.document = doc;
const toasts = []; globalThis.toastr = { info: m => toasts.push(m) };
const M = await import(pathToFileURL(path.join(root, 'src/mb-hidden.js')).href);
const now = ms => Promise.resolve();   // 기다림 없이
const snap = () => JSON.stringify(C.chat.map(m => m.extra?.statussim ?? null)) + JSON.stringify(C.chatMetadata.statussim);
const eye = (id, hide) => { const mes = { getAttribute: a => (a === 'mesid' ? String(id) : null) }; const el = { classList: { contains: c => c === (hide ? 'mes_hide' : 'mes_unhide') }, closest: sel => (sel === '.mes' ? mes : null) }; return { target: { closest: sel => (sel === '.mes_hide, .mes_unhide' ? el : null) } }; };

await ok('꺼 두면 감겨도 아무것도 안 적어요', async () => {
    C.chat[2].is_system = true;
    assert.equal(await M.onEye(2, true, { c: C, on: false, wait: now }), 'none');
    assert.equal(C.chat[2].extra.type, undefined); assert.equal(ran.length, 0); assert.equal(saves, 0);
});
const before = snap();
await ok('켜고 눈으로 감기면: 표식 한 칸 · 저장 한 번 · 그 확장의 공개 명령으로 다시 계산', async () => {
    assert.equal(await M.onEye(2, true, { c: C, on: true, wait: now }), 'out');
    assert.equal(C.chat[2].extra.type, M.MARK); assert.deepEqual(ran, ['/ss-resume']); assert.equal(saves, 1);
});
await ok('그 확장이 적어 둔 자료는 그대로', async () => { assert.equal(snap(), before); });
await ok('같은 답을 또 감겨도 한 번만', async () => { assert.equal(await M.onEye(2, true, { c: C, on: true, wait: now }), 'none'); assert.equal(ran.length, 1); });
await ok('눈을 뜨면 표식을 지우고 다시 계산', async () => {
    C.chat[2].is_system = false;
    assert.equal(await M.onEye(2, false, { c: C, on: true, wait: now }), 'in');
    assert.equal('type' in C.chat[2].extra, false); assert.deepEqual(ran, ['/ss-resume', '/ss-resume']); assert.equal(snap(), before);
});
await ok('멈춰 둔 채팅은 멈춤 명령으로(멈춤이 안 풀려요)', async () => {
    C.chatMetadata.statussim.paused = true; C.chat[0].is_system = true;
    assert.equal(await M.onEye(0, true, { c: C, on: true, wait: now }), 'out'); assert.equal(ran.at(-1), '/ss-pause');
    C.chatMetadata.statussim.paused = false;
});
await ok('extra 가 없던 답도 · 내 메시지 · 이미 종류가 적힌 답은 안 건드려요', async () => {
    C.chat[3].is_system = true; assert.equal(M.mark(C.chat[3]), true); assert.equal(C.chat[3].extra.type, M.MARK);
    C.chat[1].is_system = true; assert.equal(M.mark(C.chat[1]), false); assert.equal(C.chat[1].extra, undefined); C.chat[1].is_system = false;
    assert.equal(M.mark(C.chat[4]), false); assert.equal(C.chat[4].extra.type, 'narrator');
    assert.equal(M.unmark(C.chat[4]), false); assert.equal(C.chat[4].extra.type, 'narrator');
    assert.equal(M.mark({ is_user: false, is_system: false }), false, '보이는 답에는 안 적어요');
});
await ok('실리태번이 값을 아직 안 바꿨으면 기다렸다가 · 끝내 안 바뀌면 그만', async () => {
    const c2 = { ...C, chat: [{ is_user: false, is_system: false }] }; let waits = 0;
    assert.equal(await M.onEye(0, true, { c: c2, on: true, wait: async () => { if (++waits === 2) c2.chat[0].is_system = true; } }), 'out');
    const c3 = { ...C, chat: [{ is_user: false, is_system: false }] };
    assert.equal(await M.onEye(0, true, { c: c3, on: true, wait: now }), 'none'); assert.equal(c3.chat[0].extra, undefined);
});
await ok('치우기: 다른 길로 뜬 답의 표식은 조용히 지우고, 감긴 채 남길 것은 남겨요', async () => {
    const r0 = ran.length;
    C.chat[3].is_system = false;   // /unhide 같은 다른 길
    const r = await M.tidy(C, true, true);
    assert.deepEqual(r, { removed: 1, back: 0, adopted: 0 }); assert.equal('type' in C.chat[3].extra, false);
    assert.equal(C.chat[0].extra.type, M.MARK, '감긴 답은 그대로'); assert.equal(ran.length, r0, '보이는 답만 치웠으면 다시 계산 안 불러요');
});
await ok('치우기: 기능을 끄면 감긴 답의 표식도 지우고 다시 계산', async () => {
    const r0 = ran.length;
    assert.deepEqual(await M.tidy(C, false, true), { removed: 1, back: 1, adopted: 0 }); assert.equal('type' in C.chat[0].extra, false); assert.equal(ran.length, r0 + 1);
    assert.deepEqual(await M.tidy(C, false, true), { removed: 0, back: 0, adopted: 0 }); assert.equal(snap(), before);
    C.chat[0].is_system = false;
});
await ok('상태창이 없는 채팅 · 명령이 없는 판에서는 조용히', async () => {
    const c4 = { ...C, chatMetadata: {}, chat: [{ is_user: false, is_system: true }] };
    assert.equal(await M.onEye(0, true, { c: c4, on: true, wait: now }), 'none'); assert.equal(c4.chat[0].extra, undefined);
    const c5 = { ...C, SlashCommandParser: { commands: {} } }; assert.equal(await M.nudge(c5), false);
    const c6 = { ...C, chatMetadata: {}, chat: [{ is_user: false, is_system: true, extra: { type: M.MARK } }] };
    assert.deepEqual(M.reconcile(c6, true), { removed: 1, back: 1 }, '상태창이 사라진 채팅의 표식은 치워요');
});
await ok('설정을 아직 모르면(테마가 표식을 안 입힘) 아무것도 안 해요 — 켜 둔 사람의 표식을 시작 틈에 지우지 않게', async () => {
    const c7 = { ...C, chat: [{ is_user: false, is_system: true, extra: { type: M.MARK } }] };
    assert.deepEqual(await M.tidy(c7, false, false), { removed: 0, back: 0, adopted: 0 }); assert.equal(c7.chat[0].extra.type, M.MARK);
});
await ok('그 확장을 통째로 껐거나 이 채팅에서 껐으면 상태창이 없는 것으로', async () => {
    assert.equal(M.sheetOf({ chatMetadata: { statussim: { base: {}, off: true } } }), null);
    assert.equal(M.sheetOf({ chatMetadata: { statussim: { base: {} } }, extensionSettings: { statussim: { enabled: false } } }), null);
    assert.ok(M.sheetOf({ chatMetadata: { statussim: { base: {} } }, extensionSettings: { statussim: { enabled: true } } }));
});
await ok('이미 감긴 답: 테마 「접기」 로 감긴 것만 받아 표식 · 알림 한 줄 — 자동으로 감긴 옛 답 · 접기 전부터 감겨 있던 답은 그대로', async () => {
    const c8 = { ...C, chat: [
        { is_user: false, is_system: true, mes: 'auto', extra: { statussim: OPS() } },                                   // 요약 · 자동 숨김
        { is_user: false, is_system: true, mes: 'auto2' },
        { is_user: false, is_system: true, mes: 'fold', extra: { bl_folded: true, statussim: OPS() } },                   // 접기
        { is_user: false, is_system: true, mes: 'was', extra: { bl_folded: true, bl_fold_was_hidden: true } },            // 접기 전부터 감겨 있던 답
        { is_user: false, is_system: false, mes: 'open', extra: { bl_folded: true } },
        { is_user: true, is_system: true, mes: 'u', extra: { bl_folded: true } },
    ] };
    toasts.length = 0; const r0 = ran.length;
    const r = await M.tidy(c8, true, true);
    assert.equal(r.adopted, 1); assert.deepEqual(c8.chat.map(m => m.extra?.type ?? null), [null, null, M.MARK, null, null, null]);
    assert.equal(toasts.length, 1); assert.ok(/1개/.test(toasts[0])); assert.equal(ran.length, r0 + 1);
    assert.equal((await M.tidy(c8, true, true)).adopted, 0); assert.equal(toasts.length, 1, '두 번째는 조용히');
    assert.equal((await M.tidy(c8, false, true)).back, 1, '끄면 돌려놔요');
});
await ok('굳힌 기록 안의 답이면 한 번 알려요', async () => {
    C.chatMetadata.statussim.startAt = 3; C.chat[2].is_system = true; toasts.length = 0;
    assert.equal(await M.onEye(2, true, { c: C, on: true, wait: now, toast: globalThis.toastr }), 'out'); assert.equal(toasts.length, 1);
    C.chatMetadata.statussim.startAt = 0; C.chat[2].is_system = false; await M.onEye(2, false, { c: C, on: true, wait: now });
});
await ok('걸기: 문서 누름 하나(잡는 단계) · 설정 바뀜 · 채팅 바뀜 · 생성 시작만 — 감시자 없음', async () => {
    assert.equal(M.startMbHidden(doc), true); assert.equal(M.startMbHidden(doc), false);
    assert.deepEqual([...listeners.keys()].sort(), ['bl-mb-hidden-sync', 'bl-mes-fold', 'click']); assert.equal(listeners.get('click')[0][1], true);
    assert.deepEqual([...handlers.keys()].sort(), ['chat_id_changed', 'generation_started']);
    const src = fs.readFileSync(path.join(root, 'src/mb-hidden.js'), 'utf8');
    assert.ok(!/MutationObserver|setInterval|\.emit\(/.test(src), '감시자 · 되풀이 타이머 · 사건 쏘기 없음');
    assert.ok(!/statussim[^\n]*=[^=]/.test(src.replace(/const META = 'statussim';/, '')), '그 확장 칸에 쓰는 줄 없음');
    // 꺼 둔 채 감기는 누름은 흘려보내요
    const r0 = ran.length; C.chat[2].is_system = true; listeners.get('click')[0][0](eye(2, true)); await new Promise(r => setTimeout(r, 150));
    assert.equal(C.chat[2].extra.type, undefined); assert.equal(ran.length, r0);
    attrs.set(M.ATTR, 'on'); listeners.get('click')[0][0](eye(2, true)); await new Promise(r => setTimeout(r, 200));
    assert.equal(C.chat[2].extra.type, M.MARK); assert.equal(ran.length, r0 + 1);
    attrs.set(M.ATTR, 'off'); listeners.get('bl-mb-hidden-sync')[0][0](); await new Promise(r => setTimeout(r, 50));
    assert.equal('type' in C.chat[2].extra, false, '끄면 바로 돌려놔요'); assert.equal(ran.length, r0 + 2);
    // 테마 접기 사건: 접은 답(bl_folded)만 · 펼치면 돌려놔요
    attrs.set(M.ATTR, 'on'); const fold = id => listeners.get('bl-mes-fold')[0][0]({ detail: { id } });
    fold(2); await new Promise(r => setTimeout(r, 30)); assert.equal(C.chat[2].extra.type, undefined, '접기 표식이 없으면 안 건드려요');
    C.chat[2].extra.bl_folded = true; fold(2); await new Promise(r => setTimeout(r, 30)); assert.equal(C.chat[2].extra.type, M.MARK);
    C.chat[2].is_system = false; delete C.chat[2].extra.bl_folded; fold(2); await new Promise(r => setTimeout(r, 30)); assert.equal('type' in C.chat[2].extra, false);
    const fsrc = fs.readFileSync(path.join(root, 'src/mes-fold.js'), 'utf8'); assert.ok(fsrc.includes(`new CustomEvent('${M.FOLD_EVENT}', { detail: { id } })`), '접기가 끝나면 사건을 내요');
});
await ok('연결: 미트볼 문 · 설정 표식 · 기본 켬', async () => {
    const idx = fs.readFileSync(path.join(root, 'index.js'), 'utf8'), apply = fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8'), set = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
    assert.ok(/getElementById\('ss-settings'\)\) \{[^\n]*import\('\.\/src\/mb-hidden\.js'\)\.then\(m => m\.startMbHidden\(\)\)/.test(idx), '미트볼 설정 칸이 있을 때만 받아요');
    assert.ok(apply.includes("s.chat.mbHiddenSync !== false ? 'on' : 'off'") && apply.includes(`setAttribute('${M.ATTR}', on)`) && apply.includes(`new Event('${M.EVENT}')`));
    assert.ok(set.includes('s.chat.mbHiddenSync = flag(s.chat.mbHiddenSync, true);'));
});
console.log(`mb-hidden: ${n}개 통과`);
