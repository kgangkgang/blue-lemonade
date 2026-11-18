// 1.7.6 본문을 고치면 미트볼 수치도 따라 바꾸기(src/mb-editsync.js) — 본문에서 더는 안 나오는 인물의 애정 · 우정 몫을 그 답에 묶인 편집 기록으로 빼고, 돌아오면 되살려요.
//   그 확장 계산은 작은 흉내예요(처음 상태 + 답마다 서랍의 변화 + 편집 기록 · 통째 저장은 덮기 · 애정 상한 · 답에 묶인 기록(an) · 시간 순 차례에서 뒤 자리 당기기까지).
//   실제 계산은 리그(미트볼 2.8.0 · 2.9.0)에서 봐요. 이름은 지어낸 것(Mira · Oskar · Sua · Jisua)이에요.  node tools/tests/mb-editsync.mjs [저장소 뿌리]
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
const KEYS = { aff: 'aff', '호감': 'aff', trust: 'trust', '우정': 'trust', cash: 'cash', '위치': 'loc' };
function applyOp(s, k0, v) {
    const k = KEYS[String(k0).trim().toLowerCase()];
    if (k === 'cash') { const m = /^([+\-−])?\s*([\d.]+)$/.exec(String(v).trim()); if (m) s.data.wallet.cash = Math.max(0, m[1] ? s.data.wallet.cash + Number(m[2]) * (m[1] === '+' ? 1 : -1) : Number(m[2])); return; }
    if (k !== 'aff' && k !== 'trust') return;
    for (const part of String(v).split(/\s*,\s*(?=[^\d\s,])/)) {
        const m = /^(.+?)\s*([=+\-−])\s*([\d.]+)$/.exec(part.trim()); if (!m) continue;
        const key = m[1].trim().replace(/\s+/g, '').toLowerCase(), al = s.data.rel.alias?.[key];
        const r = s.data.rel.user.find(x => x.name === (al ?? m[1].trim())); if (!r) continue;
        const d = Number(m[3]);
        r[k] = clamp(Math.round(m[2] === '=' ? d : r[k] + (m[2] === '+' ? d : -d)), -100, 100);
    }
}
const story = m => !!m && !m.is_user && (!m.is_system || !m.extra?.type);
const anchorOf = m => `${m.is_user ? 'u' : 'a'}:${m.name}:${m.send_date}|${m.swipe_id ?? 0}`;
const fake = {
    anchorOf,
    opInfo: (_s, raw) => ({ key: KEYS[String(raw).trim().toLowerCase()] ?? null }),
    compute(limit, opts = {}) {
        const meta = C.chatMetadata.statussim, chat = C.chat;
        const s = { data: clone(meta.base.data) };
        const nn = Math.min(limit ?? chat.length, chat.length);
        // 묶인 기록: 그 답이 그 스와이프로 있을 때만 · 자리는 그 답 바로 뒤
        const idx = new Map(chat.map((m, i) => [anchorOf(m), i]));
        for (const a of meta.adjust) { a._off = false; if (a.an) { const i = idx.get(a.an); if (i === undefined) a._off = true; else a.at = i + 1; } }
        // 차례: 시간 순으로 보되 뒤 기록보다 자리가 뒤인 안 묶인 기록은 그 자리로 당겨요(그 확장 orderAdjust 와 같은 뜻)
        const byT = meta.adjust.slice().sort((a, b) => a.t - b.t); let min = Infinity;
        for (let i = byT.length - 1; i >= 0; i--) { if (byT[i]._off) continue; if (!byT[i].an && byT[i].at > min) byT[i].at = min; min = Math.min(min, byT[i].at); }
        const adj = byT.filter(a => !a._off).sort((a, b) => a.at - b.at || a.t - b.t);
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
let stamp = 0;
const ai = (mes, ...ops) => ({ is_user: false, is_system: false, name: 'Narr', send_date: 'd' + (++stamp), mes, swipe_id: 0, swipes: [mes], swipe_info: [{ extra: {} }], extra: { statussim: { bySwipe: { 0: ops } } } });
const me = () => ({ is_user: true, is_system: false, name: 'You', send_date: 'd' + (++stamp), mes: 'u' });
const LONG = ['Mira 가 문을 열었다.', '창밖에는 비가 내렸다.', 'Oskar 가 우산을 건넸다.', 'Mira 는 웃으며 받았다.', '둘은 골목으로 걸었다.',
    '가게 불이 하나씩 켜졌다.', 'Mira 가 먼저 말을 꺼냈다.', '빗소리가 조금 잦아들었다.', '골목 끝에 찻집이 보였다.', 'Mira 는 발걸음을 늦췄다.',
    'Sua 가 찻집에서 손을 흔들었다.', 'Sua 는 따뜻한 차를 내왔다.', 'Jisua 도 구석에서 고개를 들었다.', 'Sua 가 자리를 권했다.', 'Jisua 는 다시 책으로 눈을 돌렸다.'];
const people = () => ({ user: ['Mira', 'Oskar', 'Sua', 'Jisua'].map(name => ({ name, aff: 0, trust: 0 })) });
function world() {
    const chat = [me(), ai('Mira 가 인사했다.', ['aff', 'Mira +10']), me(),
        ai(LONG.join('\n\n'), ['aff', 'Mira +5, Oskar +2'], ['trust', 'Mira +3'], ['호감', 'Sua +4'], ['우정', 'Sua +3'], ['aff', 'Jisua +1'], ['cash', '+50'], ['위치', '찻집']),
        me(), ai('Mira 가 손을 흔들었다.', ['aff', 'Mira +7'])];
    C = { chat, chatMetadata: { statussim: { base: { data: { rel: people(), wallet: { cash: 100 } } }, startAt: 0, adjust: [] } }, getCurrentChatId: () => 'chat-1', saveMetadata: async () => {}, saveChat: async () => {} };
    globalThis.SillyTavern = { getContext: () => C };
    return C;
}
const now = () => Object.fromEntries(fake.compute().state.data.rel.user.map(r => [r.name, [r.aff, r.trust]]));
const ours = () => C.chatMetadata.statussim.adjust.filter(a => a.bl_sub);
const edit = (i, text) => { const before = C.chat[i].mes; C.chat[i].mes = text; return before; };

globalThis.document = { documentElement: { getAttribute: () => null }, body: { classList: { contains: c => c === 'salty' } } };
const E = await import(pathToFileURL(path.join(root, 'src/mb-editsync.js')).href);
const S = await import(pathToFileURL(path.join(root, 'src/mb-autosub.js')).href);
E.useCore({ app: { refreshNow() {} } });
const go = (i, before) => E.applyEdit(C, i, before, { eng: fake });

await ok('지금(원작): 아래 문단을 지워도 숫자가 그대로예요', async () => {
    world(); assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [4, 3], Jisua: [1, 0] });
    edit(3, LONG.slice(0, 10).join('\n\n'));
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [4, 3], Jisua: [1, 0] });
});
await ok('15문단 가운데 아래 5문단을 지우면: 거기에만 나온 인물 몫이 빠지고 · 남은 인물 몫은 그대로 · 돈 · 장소는 안 건드려요', async () => {
    world(); const before = edit(3, LONG.slice(0, 10).join('\n\n'));
    const r = await go(3, before);
    assert.deepEqual(r.cut.sort(), ['Jisua', 'Sua']); assert.equal(r.changed, true);
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [0, 0], Jisua: [0, 0] });
    assert.equal(fake.compute().state.data.wallet.cash, 150);
    const rec = ours(); assert.equal(rec.length, 2);
    for (const a of rec) { assert.equal(a.bl_sub.k, 'edit'); assert.equal(a.an, anchorOf(C.chat[3]), '그 답 · 그 스와이프에 묶어요'); assert.equal(a.silent, true); assert.equal(a.keep, true); assert.match(a.label, /^본문 고침 #3: (Sua|Jisua) 뺌 \(블루레몬\)$/); }
    assert.deepEqual(rec.find(a => a.bl_sub.who === 'sua').ops.map(o => o.join(' ')).sort(), ['aff Sua -4', 'trust Sua -3']);
    assert.deepEqual(C.chat[3].extra.statussim.bySwipe[0].length, 7, '서랍(원래 변화 줄)은 그대로');
    assert.deepEqual(Object.keys(C.chat[3].extra[E.STATE]['0'].off).sort(), ['jisua', 'sua']);
    assert.deepEqual(C.chat[3].swipe_info[0].extra[E.STATE], C.chat[3].extra[E.STATE], '스와이프 칸에도 같이');
});
await ok('되돌리기(다시 붙여 넣기): 이름이 본문에 돌아오면 기록을 지워 원래대로', async () => {
    const before = edit(3, LONG.slice(0, 12).join('\n\n'));   // Sua 만 돌아옴
    const r = await go(3, before);
    assert.deepEqual(r.back, ['Sua']); assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [4, 3], Jisua: [0, 0] });
    assert.equal(ours().length, 1);
    await go(3, edit(3, LONG.join('\n\n')));
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [4, 3], Jisua: [1, 0] }); assert.equal(ours().length, 0);
    assert.equal(C.chat[3].extra[E.STATE], undefined, '상태 칸도 치워요');
});
await ok('이름 꼬리 겹침: 「Sua」 는 「Jisua」 안의 글자로는 나온 것이 아니에요 · 고치기 전에도 안 나온 인물은 안 빼요', async () => {
    world();
    assert.equal(E.mentions('Jisua 가 웃었다', 'Sua'), false); assert.equal(E.mentions('옆의 Sua 가 웃었다', 'Sua'), true); assert.equal(E.mentions('지수아가 웃었다', '수아'), false); assert.equal(E.mentions('「수아」가 웃었다', '수아'), true);
    const r = await go(3, edit(3, LONG.filter(p => !/\bSua\b/.test(p.replace('Jisua', ''))).join('\n\n')));   // Sua 문단만 지움 · Jisua 는 남음
    assert.deepEqual(r.cut, ['Sua']); assert.deepEqual(now().Jisua, [1, 0]); assert.deepEqual(now().Sua, [0, 0]);
    // 이름 없이 대명사로만 나온 인물(변화 줄에는 있음): 고치기 전 본문에 이름이 없으니 문단을 지워도 안 빼요
    world(); C.chat[3].mes = '그녀가 문을 열었다.\n\nOskar 가 우산을 건넸다.';
    const r2 = await go(3, edit(3, '그녀가 문을 열었다.'));
    assert.deepEqual(r2.cut, ['Oskar']); assert.deepEqual(now().Mira, [22, 3], 'Mira 몫은 그대로');
});
await ok('한 줄에 여러 인물(「Mira +5, Oskar +2」): 그 인물 조각만 빼요', async () => {
    world(); const r = await go(3, edit(3, LONG.filter(p => !p.includes('Oskar')).join('\n\n')));
    assert.deepEqual(r.cut, ['Oskar']); assert.deepEqual(now(), { Mira: [22, 3], Oskar: [0, 0], Sua: [4, 3], Jisua: [1, 0] });
    assert.deepEqual(E.withoutPeople([['aff', 'Mira +5, Oskar +2'], ['cash', '+50']], fake, new Set(['oskar'])), [['aff', 'Mira +5'], ['cash', '+50']]);
    assert.deepEqual(E.partsOf('Mira +2, trust: Mira +1, 쪽지').map(p => p.name), ['Mira', 'Mira', '']);
});
await ok('합친 이름 · 화면 번역 이름으로 본문에 나와도 「나왔다」 로 봐요', async () => {
    const rel = { user: [{ name: 'Mira' }], alias: { '미라': 'Mira' } };
    assert.ok(E.formsOf('Mira', { rel }).includes('미라'));
    assert.ok(E.formsOf('Mira Vale (미라)', {}).includes('Vale')); assert.ok(E.formsOf('Mira Vale (미라)', {}).includes('미라'));
    assert.ok(E.formsOf('Mira', { tr: s => (s === 'Mira' ? '미라' : s) }).includes('미라'));
    world(); C.chat[3].mes = '미라가 문을 열었다.\n\nSua 가 손을 흔들었다.'; C.chatMetadata.statussim.base.data.rel.alias = { '미라': 'Mira' };
    const r = await go(3, edit(3, '미라가 문을 열었다.'));
    assert.deepEqual(r.cut, ['Sua']);
});
await ok('상한에 닿은 값도 원작 계산 그대로 되돌아가요(98 에 +5 → 100, 빼면 98)', async () => {
    world(); C.chatMetadata.statussim.base.data.rel.user[2].aff = 98;
    assert.deepEqual(now().Sua, [100, 3]);
    await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    assert.deepEqual(now().Sua, [98, 0]);
});
await ok('그 답 뒤에 칸 통째 저장이 있으면(맨 끝 · 그 확장이 자리를 당긴 꼴 포함) 그 저장 뒤 값도 맞춰요 · 뒤 기록의 자리를 끌어내리지 않아요', async () => {
    world(); const meta = C.chatMetadata.statussim;
    meta.adjust.push({ at: 6, t: 100, set: { mod: 'rel', data: clone(fake.compute(6, { bake: true }).state.data.rel) }, label: '' });
    await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [0, 0], Jisua: [0, 0] });
    assert.equal(meta.adjust.find(a => a.set).at, 6, '통째 저장의 자리는 그대로(시간 순 당기기에 안 걸려요)');
    const hid = ours().filter(a => a.bl_sub.k === 'hid'); assert.equal(hid.length, 1); assert.equal(hid[0].bl_sub.of, 100);
    // 되살리면 이어 맞추기 기록도 같이 빠져요
    await go(3, edit(3, LONG.join('\n\n')));
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [4, 3], Jisua: [1, 0] }); assert.equal(ours().length, 0);
    // 뺀 뒤에 한 통째 저장(이미 빠진 값이 담김)은 다시 빼지 않아요
    await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    await new Promise(r => setTimeout(r, 3));
    meta.adjust.push({ at: 6, t: Date.now(), set: { mod: 'rel', data: clone(fake.compute(6, { bake: true }).state.data.rel) }, label: '' });
    S.syncHidden(C, fake);
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [0, 0], Jisua: [0, 0] });
    // 그 뒤 앞 답을 지워 저장 자리가 당겨져도(그 확장 clampAdjust) 묶인 기록은 그 답을 따라가요
    await new Promise(r => setTimeout(r, 3));
    const snap = S.remember(C.chat, meta); C.chat.splice(1, 1); for (const a of meta.adjust) if (!a.an && a.at > C.chat.length) a.at = C.chat.length;
    S.syncGone(C, fake, snap); S.syncHidden(C, fake);
    assert.deepEqual(now(), { Mira: [12, 3], Oskar: [2, 0], Sua: [0, 0], Jisua: [0, 0] });
});
await ok('스와이프: 기록은 그 스와이프에만 묶여요 — 다른 스와이프로 넘기면 쉬고 돌아오면 살아나요 · 답을 지우면 같이 쉬어요', async () => {
    world(); await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    const m = C.chat[3]; m.swipe_id = 1; m.extra.statussim.bySwipe[1] = [['aff', 'Sua +9']]; m.mes = 'Sua 가 웃었다.';
    assert.deepEqual(now().Sua, [9, 0], '다른 스와이프의 몫은 안 건드려요');
    m.swipe_id = 0; m.mes = LONG.slice(0, 10).join('\n\n');
    assert.deepEqual(now().Sua, [0, 0]);
    C.chat.splice(3, 1);
    assert.deepEqual(now(), { Mira: [17, 0], Oskar: [0, 0], Sua: [0, 0], Jisua: [0, 0] }, '지운 답의 몫도 · 묶인 기록도 같이 빠져요(음수로 내려가지 않아요)');
});
await ok('관리 탭에서 그 기록을 지우면(되돌리기) 그 인물은 그 답에서 다시 저절로 빼지 않아요', async () => {
    world(); await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    const meta = C.chatMetadata.statussim; meta.adjust = meta.adjust.filter(a => a.bl_sub?.who !== 'sua');
    await go(3, edit(3, LONG.slice(0, 9).join('\n\n')));
    assert.deepEqual(now().Sua, [4, 3]); assert.equal(C.chat[3].extra[E.STATE]['0'].keep.sua, true);
    assert.deepEqual(now().Jisua, [0, 0], '다른 인물의 기록은 그대로');
});
await ok('연필 단추로 변화 줄을 고친 뒤(그 확장이 서랍을 바꿈): 뺀 기록을 새 변화 줄에 맞게 다시 구해요 · 줄에서 사라진 인물은 상태를 치워요', async () => {
    world(); await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    C.chat[3].extra.statussim.bySwipe[0] = [['aff', 'Mira +5, Oskar +2'], ['aff', 'Sua +9']];
    await go(3, null);
    assert.deepEqual(now(), { Mira: [22, 0], Oskar: [2, 0], Sua: [0, 0], Jisua: [0, 0] });
    assert.deepEqual(ours().map(a => a.ops), [[['aff', 'Sua -9']]]);
    assert.deepEqual(Object.keys(C.chat[3].extra[E.STATE]['0'].off), ['sua']);
});
await ok('안 하는 때: 내 메시지 · 상태창 없는 채팅 · 그 확장을 끔 · 굳힌 옛 답 · 변화 줄이 없는 답 · 스위치 끔', async () => {
    world(); assert.equal(await go(2, 'x'), null, '내 메시지');
    world(); C.chatMetadata.statussim.startAt = 5; await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    assert.equal(ours().length, 0, '굳힌 답에는 기록을 안 끼워요');
    world(); delete C.chat[3].extra.statussim; const r = await go(3, edit(3, 'x')); assert.deepEqual(r.cut, []);
    world(); C.chatMetadata.statussim.off = true; assert.equal(await go(3, edit(3, 'x')), null);
    world(); fake.hasStatus = t => /<meatball>/.test(t); assert.equal(await go(3, edit(3, 'Mira 가 웃었다. <meatball>aff: Mira +1</meatball>')), null, '변화 블록이 본문에 있는 답'); assert.equal(ours().length, 0); delete fake.hasStatus;
    const W = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
    const sw = W.switchOf('editsync'); assert.ok(sw); assert.equal(sw.kind, 'data'); assert.equal(sw.group, 'data'); assert.equal(sw.name, '본문을 고치면 수치도 따라 바꾸기');
    assert.equal(W.switchOn({ chat: {} }, 'editsync'), true, '기본 켬');
    assert.equal(E.active(), true);
    globalThis.document.documentElement.getAttribute = a => (a === W.MB_OFF_ATTR ? 'editsync' : null);
    assert.equal(E.active(), false);
    globalThis.document.documentElement.getAttribute = () => null;
});
await ok('사건 연결: 사용자가 편집 단추로 연 답만 봐요(번역 · 다른 확장이 바꾼 글에는 안 움직여요) · 스위치를 끄면 쉬어요', async () => {
    world(); S.useEngine(fake);
    const bus = {}, listeners = {}; C.eventSource = { on: (t, fn) => { (bus[t] ||= []).push(fn); } }; C.event_types = { MESSAGE_EDITED: 'edited', CHAT_CHANGED: 'chat' };
    const doc = { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, removeEventListener() {}, querySelector: () => null, documentElement: globalThis.document.documentElement, body: globalThis.document.body };
    assert.equal(E.startEditSync(doc), true); assert.equal(E.startEditSync(doc), false, '한 번만 걸어요');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const pen = id => ({ closest: sel => (sel === '.mes_edit' ? { closest: () => ({ getAttribute: () => String(id) }) } : null) });
    // 편집 단추 없이 글이 바뀜(다른 확장) → 그대로
    edit(3, LONG.slice(0, 10).join('\n\n')); for (const fn of bus.edited) fn(3); await wait(500);
    assert.equal(ours().length, 0);
    // 편집 단추 → 저장
    C.chat[3].mes = LONG.join('\n\n'); for (const fn of listeners.click) fn({ target: pen(3) });
    edit(3, LONG.slice(0, 10).join('\n\n')); for (const fn of bus.edited) fn(3); await wait(500);
    assert.equal(ours().length, 2); assert.deepEqual(now().Sua, [0, 0]);
    // 스위치 끔 → 더는 안 해요(이미 넣은 기록은 그대로)
    const W = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
    globalThis.document.documentElement.getAttribute = a => (a === W.MB_OFF_ATTR ? 'editsync' : null);
    for (const fn of listeners.click) fn({ target: pen(3) }); edit(3, LONG.join('\n\n')); for (const fn of bus.edited) fn(3); await wait(500);
    assert.equal(ours().length, 2, '끄면 그대로');
    globalThis.document.documentElement.getAttribute = () => null; S.useEngine(null);
});
await ok('칩 표식: 뺀 인물의 애정 · 우정 칩에만 data-bl-cut · 되살리면 떼요', async () => {
    const chip = (text, cls = '') => { const attrs = {}; return { textContent: text, classList: { contains: c => cls.split(' ').includes(c) }, hasAttribute: k => k in attrs, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; }, attrs }; };
    const chips = [chip('찻집'), chip('Sua +4'), chip('Sua +3'), chip('Jisua +1'), chip('Mira +5'), chip('', 'edit')];
    const mes = { querySelectorAll: () => chips };
    assert.equal(E.markChips(mes, ['Sua']), 2);
    assert.deepEqual(chips.map(c => E.CUT_ATTR in c.attrs), [false, true, true, false, false, false]);
    assert.equal(E.markChips(mes, []), 0); assert.ok(chips.every(c => !(E.CUT_ATTR in c.attrs)));
    assert.match(fs.readFileSync(path.join(root, 'src/ext-status.css'), 'utf8'), /\/\* @mb editsync \*\/\n[^@]*\.ss-mchip\[data-bl-cut\] \{[^}]*line-through/);
    assert.ok(fs.readFileSync(path.join(root, 'src/ext-status.gen.css'), 'utf8').includes('data-bl-mb-off~="editsync"'), '생성 시트에 스위치 문');
});
await ok('1.7.7 칩 표식 훑기: 뺀 인물이 없고 표식을 단 적도 없는 답은 칩을 찾지 않아요(채팅을 열 때 메시지마다 훑지 않게) · 되살린 답은 한 번 떼고 그 뒤로 안 훑어요', async () => {
    const prev = globalThis.SillyTavern;
    const chip = text => { const attrs = {}; return { textContent: text, classList: { contains: () => false }, hasAttribute: k => k in attrs, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; }, attrs }; };
    let scans = 0;
    const mk = (id, chips) => ({ getAttribute: k => (k === 'mesid' ? String(id) : null), querySelectorAll: () => { scans++; return chips; }, chips });
    const chat = Array.from({ length: 40 }, () => ({ is_user: false, mes: '글', swipe_id: 0, extra: {} }));
    const list = chat.map((_, i) => mk(i, [chip('Sua +4'), chip('Mira +5')]));
    globalThis.SillyTavern = { getContext: () => ({ chat, chatMetadata: {} }) };
    try {
        assert.equal(await E.paint(list), 0); assert.equal(scans, 0, '뺀 인물이 없는 답 40개를 훑었어요: ' + scans);
        chat[7].extra[E.STATE] = { 0: { off: { sua: { name: 'Sua', t: 1 } }, keep: {} } };
        assert.equal(await E.paint(list), 1); assert.equal(scans, 1, '뺀 인물이 있는 답만');
        assert.ok(E.CUT_ATTR in list[7].chips[0].attrs && !(E.CUT_ATTR in list[7].chips[1].attrs));
        delete chat[7].extra[E.STATE];
        assert.equal(await E.paint(list), 0); assert.equal(scans, 2, '되살린 답은 표식을 떼러 한 번');
        assert.ok(!(E.CUT_ATTR in list[7].chips[0].attrs), '표식을 뗐어요');
        assert.equal(await E.paint(list), 0); assert.equal(scans, 2, '뗀 뒤로는 다시 안 훑어요');
    } finally { globalThis.SillyTavern = prev; }
});
await ok('원작 파일 · 서랍은 안 고치고 · 알림을 안 띄우고 · 감시자 · 타이머 돌리기가 없어요', async () => {
    const src = fs.readFileSync(path.join(root, 'src/mb-editsync.js'), 'utf8');
    assert.ok(!/toastr|\.emit\(|MutationObserver|setInterval/.test(src));
    assert.ok(!/eng(?:ine)?\.\w+\s*=[^=]/.test(src), '그 확장 함수를 바꿔 끼우지 않아요');
    assert.match(fs.readFileSync(path.join(root, 'src/mb-hidden.js'), 'utf8'), /startEditSync\(doc/);
});
await ok('CI 등록(release-check.yml)', async () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/mb-editsync.mjs .'));
});
console.log(`mb-editsync: ${n}개 통과`);
