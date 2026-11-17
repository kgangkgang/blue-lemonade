// 1.7.4 눈 감기 · 삭제 바로 반영(src/mb-autosub.js) — 미트볼 칸 통째 저장 뒤에도 감긴 · 지운 답의 변화가 빠지게, 그 저장 바로 뒤에 빼는 편집 기록을 끼워요.
//   그 확장 계산(engine.compute)은 여기서는 작은 흉내(처음 상태 + 답마다 변화 + 편집 기록 · 통째 저장은 덮기 · 애정 상한 -100~100)로 갈음해요 — 실제 계산은 리그에서 사용자 자료 사본으로 봐요.
//   이름은 지어낸 것(Mira · Oskar)이에요.  node tools/tests/mb-autosub.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const clone = x => JSON.parse(JSON.stringify(x));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── 그 확장 계산 흉내 ─────────────────────────────
let C;
function applyOp(s, k, v) {
    if (k === 'cash') { const w = s.data.wallet; const m = /^([+\-−])?\s*([\d.]+)$/.exec(String(v).trim()); if (!m) return; const d = Number(m[2]) * (m[1] === '-' || m[1] === '−' ? -1 : 1); w.cash = Math.max(0, m[1] ? w.cash + d : Number(m[2])); return; }
    if (k !== 'aff' && k !== 'trust') return;
    for (const part of String(v).split(/\s*,\s*(?=[^\d\s,])/)) {
        const m = /^(.+?)\s*([=+\-−])\s*([\d.]+)$/.exec(part.trim()); if (!m) continue;
        const r = s.data.rel.user.find(x => x.name === m[1].trim()); if (!r) continue;
        const d = Number(m[3]);
        r[k] = clamp(Math.round(m[2] === '=' ? d : r[k] + (m[2] === '+' ? d : -d)), -100, 100);
    }
}
const story = m => !!m && !m.is_user && (!m.is_system || !m.extra?.type);
const fake = {
    calls: 0,
    compute(limit, opts = {}) {
        this.calls++;
        const meta = C.chatMetadata.statussim, chat = C.chat;
        const s = { data: clone(meta.base.data) };
        const nn = Math.min(limit ?? chat.length, chat.length);
        const adj = meta.adjust.slice().sort((a, b) => a.at - b.at || a.t - b.t);
        let ai = 0;
        const run = a => { if (a.set?.data) s.data[a.set.mod] = clone(a.set.data); for (const [k, v] of a.ops ?? []) applyOp(s, k, v); };
        for (let i = meta.startAt ?? 0; i < nn; i++) {
            while (ai < adj.length && adj[ai].at <= i) run(adj[ai++]);
            const m = chat[i]; if (!story(m)) continue;
            for (const [k, v] of m.extra?.statussim?.bySwipe?.[m.swipe_id ?? 0] ?? []) applyOp(s, k, v);
        }
        const lim = opts.bake ? nn : Infinity;
        while (ai < adj.length && adj[ai].at <= lim) run(adj[ai++]);
        return { state: s };
    },
};
const ai = (...ops) => ({ is_user: false, is_system: false, name: 'Narr', mes: 'x', swipe_id: 0, extra: { statussim: { bySwipe: { 0: ops } } } });
const me = () => ({ is_user: true, is_system: false, name: 'You', mes: 'u' });
const rel = (mira, oskar = [0, 0]) => ({ user: [{ name: 'Mira', aff: mira[0], trust: mira[1] }, { name: 'Oskar', aff: oskar[0], trust: oskar[1] }] });
const now = () => { const s = fake.compute().state; return Object.fromEntries(s.data.rel.user.map(r => [r.name, [r.aff, r.trust]])); };
function world({ baseMira = [0, 0] } = {}) {
    const chat = [me(), ai(['aff', 'Mira +10']), me(), ai(['aff', 'Mira +20, Oskar +4'], ['trust', 'Mira +5']), me(), ai(['aff', 'Mira +7'])];
    const meta = { base: { data: { rel: rel(baseMira), wallet: { cash: 100, currency: 'G' } } }, startAt: 0, adjust: [] };
    C = { chat, chatMetadata: { statussim: meta }, getCurrentChatId: () => 'chat-1', saveMetadata: async () => {} };
    globalThis.SillyTavern = { getContext: () => C };
    // 영어 저장 바꾸기처럼 그때 계산값으로 관계 칸을 통째 저장(라벨 없음) — 4번 뒤
    const at4 = fake.compute(4, { bake: true }).state.data.rel;
    meta.adjust.push({ at: 4, t: 100, set: { mod: 'rel', data: clone(at4) }, label: '' });
    meta.adjust.push({ at: 6, t: 200, ops: [['_read', 'x']], label: '' });
    return C;
}
const hide = i => { C.chat[i].is_system = true; (C.chat[i].extra ??= {}).type = 'bl-hidden'; };
const unhide = i => { C.chat[i].is_system = false; delete C.chat[i].extra.type; };

globalThis.document = { documentElement: { getAttribute: () => null }, body: { classList: { contains: c => c === 'salty' } } };
const S = await import(pathToFileURL(path.join(root, 'src/mb-autosub.js')).href);

await ok('지금(고치기 전): 통째 저장 앞 답을 감겨도 숫자가 그대로예요(그 확장 계산)', async () => {
    world(); assert.deepEqual(now(), { Mira: [37, 5], Oskar: [4, 0] });
    hide(3); assert.deepEqual(now(), { Mira: [37, 5], Oskar: [4, 0] }, '저장 값에 굳어 안 빠져요');
});
await ok('감기면: 그 저장 바로 뒤에 빼는 기록(그 확장 편집 기록 꼴)을 끼우고 숫자가 내려가요', async () => {
    const r = S.syncHidden(C, fake);
    assert.equal(r.changed, true);
    const adj = C.chatMetadata.statussim.adjust;
    assert.equal(adj.length, 3); assert.equal(adj[1][S.TAG].of, 100, '배열에서도 그 저장 바로 뒤');
    const e = adj[1];
    assert.equal(e.at, 4); assert.ok(e.t > 100 && e.t < 200, '그 저장과 다음 기록 사이 시각');
    assert.deepEqual(e.ops, [['aff', 'Mira -20'], ['trust', 'Mira -5'], ['aff', 'Oskar -4']], '한 줄에 둘 쓴 꼴도 나눠서');
    assert.equal(e.label, '눈 감긴 답 #3 빼기 (블루레몬)'); assert.equal(e.silent, true); assert.equal(e.keep, true);
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
    assert.deepEqual(C.chatMetadata.bl_mbsub, { ent: [[adj[1].t, 100]], no: [] }, '테마 메타 칸 하나에 적어요');
    assert.deepEqual(adj[0].set.data, rel([30, 5], [4, 0]), '통째 저장 값은 그대로');
});
await ok('다시 맞춰도 그대로(두 번 빼지 않아요)', async () => {
    const e = C.chatMetadata.statussim.adjust[1];
    const r = S.syncHidden(C, fake); assert.equal(r.changed, false); assert.equal(C.chatMetadata.statussim.adjust[1], e);
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
});
await ok('눈을 뜨면 기록을 빼서 정확히 돌아와요', async () => {
    unhide(3); const r = S.syncHidden(C, fake);
    assert.equal(r.changed, true); assert.equal(C.chatMetadata.statussim.adjust.length, 2); assert.equal(C.chatMetadata.bl_mbsub, undefined, '빈 메타 칸은 지워요');
    assert.deepEqual(now(), { Mira: [37, 5], Oskar: [4, 0] });
});
await ok('상한에 잘린 몫까지: 감기면 실제로 더해진 만큼만 빼고, 뜨면 잘린 그대로 돌아와요', async () => {
    world({ baseMira: [80, 0] }); assert.deepEqual(now().Mira, [100, 5]);   // 80 +10 = 90, +20 → 100(10 잘림), +7 → 100
    hide(3); S.syncHidden(C, fake);
    assert.deepEqual(C.chatMetadata.statussim.adjust[1].ops[0], ['aff', 'Mira -10'], '잘린 몫은 안 빼요');
    assert.deepEqual(now().Mira, [97, 0]);   // 90 + 7
    unhide(3); S.syncHidden(C, fake); assert.deepEqual(now().Mira, [100, 5]);
});
await ok('여러 답 · 여러 통째 저장: 저장마다 그때까지 감긴 답 몫을 빼고 끝 숫자는 저장이 없을 때와 같아요', async () => {
    world();
    const meta = C.chatMetadata.statussim;
    C.chat.push(me(), ai(['aff', 'Mira +3'], ['trust', 'Oskar +6']));   // 6 · 7
    meta.adjust.push({ at: 7, t: 300, set: { mod: 'rel', data: clone(fake.compute(7, { bake: true }).state.data.rel) }, label: '' });
    C.chat.push(me(), ai(['aff', 'Mira +1']));
    hide(1); hide(3); hide(7);
    const want = (() => { const keep = meta.adjust; meta.adjust = keep.filter(a => !a.set); const v = now(); meta.adjust = keep; return v; })();
    const r = S.syncHidden(C, fake);
    assert.equal(r.made.length, 2);
    assert.deepEqual(now(), want); assert.deepEqual(want, { Mira: [8, 0], Oskar: [0, 0] });
    assert.equal(meta.adjust.find(a => a[S.TAG]?.of === 300).label, '눈 감긴 답 #1 · #3 빼기 (블루레몬)', '저장 자리(7) 뒤의 #7 은 그 저장에 안 들어가요');
    unhide(3); S.syncHidden(C, fake);
    assert.deepEqual(now(), { Mira: [28, 5], Oskar: [4, 0] }, '하나만 뜨면 그 답 만큼만 올라요');
});
await ok('이미 뺀 뒤에 다시 통째 저장된 칸은 건너뛰어요(두 번 빼지 않아요)', async () => {
    world(); hide(3); S.syncHidden(C, fake);
    const meta = C.chatMetadata.statussim;
    meta.adjust.push({ at: 6, t: 250, set: { mod: 'rel', data: clone(fake.compute(6, { bake: true }).state.data.rel) }, label: '' });   // 테마가 뺀 뒤에 또 영어 저장 바꾸기
    S.syncHidden(C, fake);
    assert.equal(meta.adjust.filter(a => a[S.TAG]).length, 1, '앞 저장에만');
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
});
await ok('관리 탭에서 그 기록을 지우면(원작 undoAt) 그 저장에는 다시 안 끼워요 · 저장을 지우면 끼운 기록도 같이 빠져요', async () => {
    world(); hide(3); S.syncHidden(C, fake);
    const meta = C.chatMetadata.statussim;
    meta.adjust = meta.adjust.filter(a => !a[S.TAG]);   // 사용자가 골라서 지움
    const r = S.syncHidden(C, fake);
    assert.deepEqual(r.declined, [100]); assert.equal(meta.adjust.some(a => a[S.TAG]), false); assert.deepEqual(C.chatMetadata.bl_mbsub.no, [100]);
    assert.deepEqual(now(), { Mira: [37, 5], Oskar: [4, 0] });
    world(); hide(3); S.syncHidden(C, fake);
    C.chatMetadata.statussim.adjust = C.chatMetadata.statussim.adjust.filter(a => !a.set);   // 통째 저장을 지움
    const r2 = S.syncHidden(C, fake); assert.equal(r2.changed, true); assert.equal(C.chatMetadata.statussim.adjust.some(a => a[S.TAG]), false);
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
});
await ok('답을 지우면: 지우기 전 기억으로 그 답 몫을 저장 뒤에서 빼요(되살릴 수 없어 다시 구하지 않아요)', async () => {
    world();
    const snap = S.remember(C.chat);
    C.chat.splice(3, 1);   // 실리태번 지우기
    assert.deepEqual(now(), { Mira: [37, 5], Oskar: [4, 0] }, '지금은 지워도 그대로');
    const r = S.syncGone(C, fake, snap);
    assert.equal(r.changed, true);
    const e = C.chatMetadata.statussim.adjust.find(a => a[S.TAG]);
    assert.equal(e[S.TAG].k, 'del'); assert.equal(e.label, '지운 답 #3 빼기 (블루레몬)');
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
    assert.equal(S.syncHidden(C, fake).changed, false, '감긴 답 맞추기가 지운 답 기록을 건드리지 않아요');
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
});
await ok('감긴 채로 지운 답: 감긴 답 기록이 빠지고 지운 답 기록이 대신해요(숫자 그대로)', async () => {
    world(); hide(3); S.syncHidden(C, fake); assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
    const snap = S.remember(C.chat); C.chat.splice(3, 1);
    S.syncGone(C, fake, snap); S.syncHidden(C, fake);
    const ours = C.chatMetadata.statussim.adjust.filter(a => a[S.TAG]);
    assert.deepEqual(ours.map(a => a[S.TAG].k), ['del']);
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0] });
});
// 리그(사용자 자료 사본)에서 본 꼴: 원작은 답을 지워도 저장 자리(at)를 안 당겨서, 저장 바로 뒤 답이 저장 앞으로 들어와요
const world2 = (afterHidden) => {
    const chat = [me(), ai(['aff', 'Mira +10']), me(), ai(['aff', 'Mira +20']), ai(['aff', 'Mira +5']), me(), ai(['aff', 'Mira +7'])];
    const meta = { base: { data: { rel: rel([0, 0]) } }, startAt: 0, adjust: [] };
    C = { chat, chatMetadata: { statussim: meta }, getCurrentChatId: () => 'chat-2', saveMetadata: async () => {} };
    meta.adjust.push({ at: 4, t: 100, set: { mod: 'rel', data: clone(fake.compute(4, { bake: true }).state.data.rel) }, label: '' });
    if (afterHidden) hide(4);
    return C;
};
await ok('저장 앞 보이는 답을 지우면: 저장 뒤에 있던 감긴 답을 저장 몫으로 잘못 빼지 않아요(참 자리)', async () => {
    world2(true); S.syncHidden(C, fake); assert.deepEqual(now().Mira, [37, 0]);   // 10 + 20 + 7(4번은 감김)
    const snap = S.remember(C.chat); C.chat.splice(1, 1);
    S.syncGone(C, fake, snap); S.syncHidden(C, fake);
    assert.deepEqual(now().Mira, [27, 0], '20 + 7');
    assert.deepEqual(C.chatMetadata.bl_mbsub.pos, { 100: 3 }, '저장의 참 자리를 당겨 적어요');
});
await ok('저장 앞 보이는 답을 지우면: 저장 뒤에 있던 보이는 답도 저장에 덮이지 않아요', async () => {
    world2(false); assert.deepEqual(now().Mira, [42, 0]);
    const snap = S.remember(C.chat); C.chat.splice(1, 1);
    S.syncGone(C, fake, snap); S.syncHidden(C, fake);
    assert.deepEqual(now().Mira, [32, 0], '20 + 5 + 7');
    hide(3); S.syncHidden(C, fake); assert.deepEqual(now().Mira, [27, 0], '그 뒤 감겨도 맞아요(20 + 7)');
    unhide(3); S.syncHidden(C, fake); assert.deepEqual(now().Mira, [32, 0], '뜨면 돌아와요');
});
await ok('저장 앞 답을 지워도: 같은 자리에서 저장보다 먼저 한 편집(합치기 등)은 「저장 당시」 계산에 그대로 들어가요', async () => {
    world2(false);
    const meta = C.chatMetadata.statussim;
    meta.adjust = [{ at: 4, t: 90, ops: [['aff', 'Oskar +9']], label: '' }];   // 합치기처럼 저장 바로 앞 같은 자리
    meta.adjust.push({ at: 4, t: 100, set: { mod: 'rel', data: clone(fake.compute(4, { bake: true }).state.data.rel) }, label: '' });
    assert.deepEqual(now().Oskar, [9, 0]);
    const snap = S.remember(C.chat); C.chat.splice(1, 1);
    S.syncGone(C, fake, snap); S.syncHidden(C, fake);
    assert.deepEqual(now(), { Mira: [32, 0], Oskar: [9, 0] });
});
await ok('지운 답 기록을 관리 탭에서 지우면 다음 맞추기가 그 몫을 다시 메우지 않아요', async () => {
    world();
    C.chat.push(me(), ai(['aff', 'Mira +3']));   // 6 · 7
    const meta = C.chatMetadata.statussim;
    meta.adjust.push({ at: 7, t: 300, set: { mod: 'rel', data: clone(fake.compute(7, { bake: true }).state.data.rel) }, label: '' });
    const snap = S.remember(C.chat); C.chat.splice(3, 1);
    S.syncGone(C, fake, snap); S.syncHidden(C, fake);
    assert.deepEqual(now().Mira, [20, 0], '10 + 7 + 3');
    const last = meta.adjust.filter(a => a[S.TAG]).sort((a, b) => b.at - a.at)[0];
    meta.adjust = meta.adjust.filter(a => a !== last);   // 원작 undoAt
    const r = S.syncHidden(C, fake);
    assert.deepEqual(r.declined, [300]);
    assert.deepEqual(now().Mira, [37, 5], '뒤 저장(7번 뒤)은 원작 계산 그대로(그때 값 37 · 지운 뒤 앞으로 밀린 +3 은 원작처럼 덮여요)');
    assert.equal(S.syncHidden(C, fake).changed, false, '또 맞춰도 그대로');
});
await ok('지운 스와이프: 옛 스와이프 몫을 빼고 지금 스와이프 몫을 더해요', async () => {
    world();
    const m = C.chat[3]; m.swipes = ['a', 'b']; m.extra.statussim.bySwipe[1] = [['aff', 'Mira +2']];
    const snap = S.remember(C.chat).map((x, i) => (i === 3 ? { ...x, swDel: true } : x));
    m.swipe_id = 0; m.mes = 'b'; m.extra.statussim.bySwipe = { 0: [['aff', 'Mira +2']] }; m.swipes = ['b'];
    S.syncGone(C, fake, snap);
    const e = C.chatMetadata.statussim.adjust.find(a => a[S.TAG]);
    assert.equal(e.label, '지운 스와이프 #3 빼기 (블루레몬)');
    assert.deepEqual(now(), { Mira: [19, 0], Oskar: [0, 0] });   // 10 + 2 + 7
});
await ok('돈도 같은 원리(지갑 통째 저장)', async () => {
    world();
    C.chat[3].extra.statussim.bySwipe[0].push(['cash', '+50']);
    C.chatMetadata.statussim.adjust.push({ at: 4, t: 150, set: { mod: 'wallet', data: { cash: 150, currency: 'G' } }, label: '' });
    hide(3); S.syncHidden(C, fake);
    const w = C.chatMetadata.statussim.adjust.find(a => a[S.TAG]?.of === 150);
    assert.deepEqual(w.ops, [['cash', '-50']]); assert.equal(fake.compute().state.data.wallet.cash, 100);
});
await ok('조용히 반영: 알림 0개 · 남는 것은 편집 기록 줄(번호만 · 인물 이름 없음)', async () => {
    // 11-17 사용자 「팝업 띄울 게 아니라 바로 반영되게」 · 조정자: 이름이 저장 이름(영어)으로 새던 알림을 없애요
    world(); S.useEngine(fake);
    const toasts = []; const was = globalThis.toastr; globalThis.toastr = { info: t => toasts.push(t), success: t => toasts.push(t), warning: t => toasts.push(t) };
    hide(1); await S.applyHidden(C, { kind: 'hid' });
    hide(3); await S.applyHidden(C, { kind: 'hid' });
    unhide(3); await S.applyHidden(C, { kind: 'open' });
    hide(3); await S.applyHidden(C, { kind: 'hid' });
    C.chatMetadata.statussim.adjust = C.chatMetadata.statussim.adjust.filter(a => !a[S.TAG]);
    await S.applyHidden(C, { kind: 'tidy' });
    world(); const snap = S.remember(C.chat); C.chat.splice(3, 1); await S.applyGone(C, snap);
    await new Promise(r => setTimeout(r, 1700));   // 예전 알림 묶음 시간(1.5초)보다 길게
    assert.deepEqual(toasts, [], '알림 없음');
    const labels = C.chatMetadata.statussim.adjust.filter(a => a[S.TAG]).map(a => a.label);
    assert.deepEqual(labels, ['지운 답 #3 빼기 (블루레몬)']);
    for (const l of labels) assert.ok(!/Mira|Oskar/.test(l), '편집 기록 줄에 저장 이름(번역 전)이 안 들어가요');
    const src = fs.readFileSync(path.join(root, 'src/mb-autosub.js'), 'utf8');
    assert.ok(!/toastr|\.info\(/.test(src), '이 모듈은 알림을 안 띄워요');
    globalThis.toastr = was; S.useEngine(null);
});
await ok('할 일이 없으면 계산을 안 돌리고 · 같은 꼴로 또 정리하면 다시 안 돌려요', async () => {
    world(); S.useEngine(fake);
    const C0 = C; C0.chatMetadata.statussim.adjust = C0.chatMetadata.statussim.adjust.filter(a => !a.set);
    let k = fake.calls; assert.equal(await S.applyHidden(C0, { kind: 'tidy' }), false); assert.equal(fake.calls, k, '통째 저장이 없으면 0번');
    world(); hide(3); await S.applyHidden(C, { kind: 'tidy' });
    k = fake.calls; assert.equal(await S.applyHidden(C, { kind: 'tidy' }), false); assert.equal(fake.calls, k, '같은 꼴이면 0번');
    await new Promise(r => setTimeout(r, 20)); S.useEngine(null);
});
await ok('스위치: 미트볼 맞춤 「데이터를 고치는 것」 · 기본 켬 · 끄면 쉬어요', async () => {
    const W = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
    const sw = W.switchOf('autosub'); assert.ok(sw); assert.equal(sw.kind, 'data'); assert.equal(sw.group, 'data'); assert.equal(sw.name, '눈 감기 · 삭제 바로 반영');
    assert.equal(W.switchOn({ chat: {} }, 'autosub'), true);
    assert.equal(S.active(), true);
    globalThis.document.documentElement.getAttribute = a => (a === W.MB_OFF_ATTR ? 'hidden autosub' : null);
    assert.equal(S.active(), false);
    globalThis.document.documentElement.getAttribute = () => null;
});
await ok('원작 파일 · 원작 함수는 안 고쳐요(그 확장 모듈은 읽어 부르기만)', async () => {
    const src = fs.readFileSync(path.join(root, 'src/mb-autosub.js'), 'utf8');
    assert.ok(!/\.emit\(|MutationObserver|setInterval/.test(src));
    assert.ok(!/eng(?:ine)?\.\w+\s*=[^=]/.test(src), '그 확장 함수를 바꿔 끼우지 않아요');
});
await ok('CI 등록(release-check.yml)', async () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/mb-autosub.mjs .'));
});
console.log(`mb-autosub: ${n}개 통과`);
