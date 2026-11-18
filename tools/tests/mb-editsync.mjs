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
await ok('1.7.9 본문 고침 저장은 채팅 저장 한 번 — 실리태번 saveMetadata 는 saveChatConditional 그대로라 둘 다 부르면 채팅 전체를 두 번 써요', async () => {
    world(); let saves = 0; C.saveMetadata = async () => { saves++; }; C.saveChat = async () => { saves++; };
    const before = edit(3, LONG.slice(0, 10).join('\n\n'));
    const r = await go(3, before);
    assert.ok(r?.changed, '뺀 것이 있어야 저장해요');
    assert.equal(saves, 1, '저장 ' + saves + '번');
    // saveChat 이 없는 옛 실리태번이면 saveMetadata 로
    world(); saves = 0; C.saveMetadata = async () => { saves++; }; delete C.saveChat;
    const b2 = edit(3, LONG.slice(0, 10).join('\n\n')); await go(3, b2);
    assert.equal(saves, 1, '옛 판 저장 ' + saves + '번');
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
await ok('1.7.8 본문이 다른 언어 · 본명으로 이름을 부를 때(영어 저장 채팅 · 일본어 대사 · 「본명」): 로어북 인물 항목의 이름 줄로 같은 사람을 알아봐요', async () => {
    // 사용자 폰(1.7.7): 변화 줄은 영어 이름(「Mira +2」), 본문은 일본어 대사(「ミラ」) · 영어 지문 · 본명(「Rafe」)으로 불러서 「고치기 전에도 안 나온 사람」 으로 보고 아무도 안 뺐어요
    //   이름은 지어낸 것이에요. 로어북 항목: 이름(머리표) · Name 줄(영어 · 괄호 안 일본어) · Real Name 줄
    const lore = [
        { comment: '[천사]미라', content: '- **Name:** Mira (ミラ)\n- **Role:** Guard' },
        { comment: '[악마]오스카', content: '* Name: Oskar Vale (オスカー・ヴェイル)' },
        { comment: '[천사]수아', content: '- **Name:** Sua / Real Name: Rafe (a name set aside)' },
    ];
    const al = E.loreAliases(lore);
    assert.ok(E.formsOf('Mira', { lore: al }).includes('ミラ')); assert.ok(E.formsOf('Mira', { lore: al }).includes('미라'));
    assert.ok(E.formsOf('Sua', { lore: al }).includes('Rafe')); assert.ok(E.formsOf('Oskar', { lore: al }).includes('オスカー'));
    assert.ok(!E.formsOf('Mira', { lore: al }).includes('Guard'), '이름 줄만 봐요');
    // 다른 사람 항목의 부르는 말 목록으로도(이름 줄에 일본어가 없는 사람 — 「* Name: Mira」 만 있는 꼴)
    const al2 = E.loreAliases([{ comment: '[천사]수아', content: '* Name: Sua' }, { comment: '[악마]오스카', content: '- **Name:** Oskar\n- **Sua:** "スアさん" / (Privately) "スア."\n- **Role:** "Guard"' }]);
    assert.ok(E.formsOf('Sua', { lore: al2 }).includes('スア'), JSON.stringify(E.formsOf('Sua', { lore: al2 })));
    assert.ok(E.formsOf('Sua', { lore: al2 }).includes('수아'));
    assert.ok(!E.formsOf('Sua', { lore: E.loreAliases([{ content: '* Name: Sua' }, { content: '- **Sua:** "ぼくがうたうのは"' }]) }).includes('ぼくがうたうのは'), '히라가나 말은 이름이 아니에요');
    assert.ok(!E.formsOf('Oskar', { lore: al2 }).includes('Guard') && !(al2.get('role') || []).length, '영어 값 · 역할 줄은 안 봐요');
    world();
    const m = C.chat[3];
    m.extra.statussim.bySwipe[0] = [['aff', 'Mira +2, Sua +1'], ['trust', 'Oskar +1']];
    const before = ['「警備部のミラでも呼びましょうか？」', 'Oskar leans back. オスカー smiles.', 'He keeps the chocolate for when Rafe drops by.', 'ミラ laughs.'].join('\n\n');
    const after = 'Oskar leans back. オスカー smiles.';
    m.mes = before;
    E.useLore(null);
    let r = await go(3, edit(3, after));
    assert.deepEqual(r.cut, [], '로어북 없이는(예전처럼) 아무도 못 알아봐요');
    world(); C.chat[3].extra.statussim.bySwipe[0] = [['aff', 'Mira +2, Sua +1'], ['trust', 'Oskar +1']]; C.chat[3].mes = before;
    E.useLore(lore);
    r = await go(3, edit(3, after));
    assert.deepEqual(r.cut.sort(), ['Mira', 'Sua'], JSON.stringify(r));
    assert.deepEqual(now().Mira, [17, 0], 'Mira 는 이 답의 +2 만 빠져요(앞뒤 답 +10 · +7 은 그대로)'); assert.deepEqual(now().Oskar, [0, 1], 'Oskar 는 남은 문단에 있어 그대로');
    // 되돌리면 되살아나요(일본어 이름으로 돌아와도)
    r = await go(3, edit(3, before)); assert.deepEqual(r.back.sort(), ['Mira', 'Sua']);
    E.useLore(null);
});
await ok('1.7.8 상태창 시작점 앞(그 확장이 굳힌 답 · 다시 만든 상태창): 고쳐도 안 빼고 · 뺀 기록이 굳기로 사라진 것을 「되돌림」 으로 보지 않아요', async () => {
    // 사용자 폰(1.7.7): 답을 고쳐 네 사람을 뺐는데, 그 뒤 상태창 시작점이 12번 뒤로 옮겨지며(굳히기 · 다시 만들기) 뺀 기록이 사라졌어요.
    //   다음 편집 때 테마가 그걸 「사용자가 관리 탭에서 되돌림」 으로 읽어 칩 흐림을 풀었고, 시작점 앞 답이라 숫자도 못 바꾸는데 칩만 흐려지기도 했어요
    world(); const before = edit(3, LONG.slice(0, 10).join('\n\n'));
    await go(3, before);
    assert.equal(ours().length, 2);
    // 그 확장이 굳힘: 시작점을 뒤로 · 기록은 처음 상태에 녹이고 지움
    const meta = C.chatMetadata.statussim; meta.base.data = clone(fake.compute(6, { bake: true }).state.data); meta.startAt = 6; meta.adjust = [];
    const stBefore = JSON.stringify(C.chat[3].extra[E.STATE]);
    const r = await go(3, edit(3, LONG.slice(0, 9).join('\n\n')));
    assert.equal(r, null, '시작점 앞 답은 손대지 않아요');
    assert.equal(JSON.stringify(C.chat[3].extra[E.STATE]), stBefore, '뺀 표시를 「되돌림」 으로 바꾸지 않아요');
    assert.equal(ours().length, 0);
    // 처음부터 시작점 앞이던 답: 칩만 흐려지지 않아요
    world(); C.chatMetadata.statussim.startAt = 5;
    assert.equal(await go(3, edit(3, LONG.slice(0, 10).join('\n\n'))), null);
    assert.equal(C.chat[3].extra[E.STATE], undefined);
});
// 그 확장 rebindToUser 와 같은 뜻(묶인 기록을 그 답 다음 내 메시지로 옮김 · keep 를 안 봐요)
const rebind = () => { const idx = new Map(C.chat.map((m, i) => [anchorOf(m), i])); for (const a of C.chatMetadata.statussim.adjust) { if (typeof a.an !== 'string') continue; const i = idx.get(a.an); if (i === undefined || C.chat[i].is_user) continue; const u = C.chat[i + 1]; if (u?.is_user) a.an = anchorOf(u); } };
await ok('버그 사냥 4: 내 메시지를 보낸 뒤(그 확장이 기록을 내 메시지로 옮김) 다시 붙여 넣어도 되살아나요 · 옛 기록(만든 때 열쇠 없음)도', async () => {
    world(); await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    assert.deepEqual(now().Sua, [0, 0]);
    rebind(); assert.ok(ours().every(a => a.an.startsWith('u:')), '옮겨졌어요');
    await go(3, edit(3, LONG.join('\n\n')));
    assert.deepEqual(now(), { Mira: [22, 3], Oskar: [2, 0], Sua: [4, 3], Jisua: [1, 0] }); assert.equal(ours().length, 0);
    assert.deepEqual(C.chat[3].extra[E.STATE] ?? null, null, '되돌린 것(keep)으로 안 적어요');
    // 1.7.6 ~ 1.7.8 이 만든 기록(bl_sub.an 없음)
    world(); await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    for (const a of ours()) delete a.bl_sub.an;
    rebind(); await go(3, edit(3, LONG.join('\n\n')));
    assert.deepEqual(now().Sua, [4, 3]); assert.equal(ours().length, 0);
});
await ok('버그 사냥 4: 그 답 바로 뒤 자리에 칸 통째 저장이 있어도(끝 답 · 영어 저장 바꾸기 뒤) 빼요 · 상태를 지우지 않아요', async () => {
    world(); const meta = C.chatMetadata.statussim;
    C.chat.length = 4;
    meta.adjust.push({ at: 4, t: 100, set: { mod: 'rel', data: clone(fake.compute(4, { bake: true }).state.data.rel) }, label: '' });
    const r = await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    assert.deepEqual(r.cut.sort(), ['Jisua', 'Sua']);
    assert.deepEqual(now(), { Mira: [15, 3], Oskar: [2, 0], Sua: [0, 0], Jisua: [0, 0] }, '전엔 그대로(Sua [4,3])');
    assert.deepEqual(Object.keys(C.chat[3].extra[E.STATE]['0'].off).sort(), ['jisua', 'sua']);
    await go(3, edit(3, LONG.join('\n\n')));
    assert.deepEqual(now().Sua, [4, 3], '되살리기'); assert.equal(ours().length, 0);
});
await ok('버그 사냥 4: 앞 스와이프를 지우면 상태 칸 번호도 당겨요 — 다른 데를 고쳐도 뺀 몫이 되살아나지 않아요', async () => {
    world(); C.chat.length = 4;
    const m = C.chat[3]; const ops = m.extra.statussim.bySwipe[0];
    m.swipes = ['A0', 'A1', m.mes]; m.swipe_info = [{ extra: {} }, { extra: {} }, { extra: {} }];
    m.extra.statussim.bySwipe = { 0: [['aff', 'Mira +1']], 1: [['aff', 'Mira +1']], 2: ops }; m.swipe_id = 2;
    await go(3, edit(3, LONG.slice(0, 10).join('\n\n')));
    assert.deepEqual(now().Sua, [0, 0]);
    // 실리태번 deleteSwipe(0) + 그 확장 shiftSwipeAnchors 흉내
    const oldKey = anchorOf(m).replace(/\|\d+$/, '');
    m.swipes.shift(); m.swipe_info.shift(); m.extra.statussim.bySwipe = { 0: [['aff', 'Mira +1']], 1: ops }; m.swipe_id = 1;
    for (const a of C.chatMetadata.statussim.adjust) if (a.an?.startsWith(oldKey + '|')) a.an = `${oldKey}|${Number(a.an.split('|').pop()) - 1}`;
    assert.equal(E.shiftState(m, 0), true);
    assert.deepEqual(Object.keys(m.extra[E.STATE]), ['1']); assert.deepEqual(Object.keys(m.swipe_info[1].extra[E.STATE]), ['1'], '스와이프 칸 사본도');
    await go(3, edit(3, LONG.slice(0, 9).join('\n\n')));
    assert.deepEqual(now().Sua, [0, 0], '전엔 [4,3] 으로 되살아났어요'); assert.equal(ours().filter(a => a.bl_sub.k === 'edit').length, 2);
    assert.equal(E.shiftState(m, 5), true); assert.deepEqual(Object.keys(m.extra[E.STATE]), ['1'], '뒤 번호를 지우면 그대로');
    assert.equal(E.shiftState({ extra: {} }, 0), false);
});
await ok('버그 사냥 4: 연필 단추 뒤 확인 창을 Esc 로 닫으면 기다리던 듣는 곳을 떼요 · 여러 번 눌러도 하나뿐 · 스와이프 지움 사건을 들어요', async () => {
    const fresh = await import(pathToFileURL(path.join(root, 'src/mb-editsync.js')).href + '?hunt4-once');
    world();
    const bus = {}, listeners = {}; C.eventSource = { on: (t, fn) => { (bus[t] ||= []).push(fn); } }; C.event_types = { MESSAGE_EDITED: 'edited', CHAT_CHANGED: 'chat', MESSAGE_SWIPE_DELETED: 'swdel' };
    const doc = { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter(x => x !== fn); }, querySelector: () => null, documentElement: globalThis.document.documentElement, body: globalThis.document.body };
    assert.equal(fresh.startEditSync(doc), true);
    const chipTarget = { closest: sel => (sel === '.ss-mchip.edit[data-ss-edit]' ? { getAttribute: () => '3' } : null) };
    const base = listeners.click.length;
    for (let k = 0; k < 3; k++) for (const fn of [...listeners.click]) fn({ target: chipTarget });
    assert.equal(listeners.click.length, base + 1, '세 번 눌러도 기다리는 것은 하나');
    for (const fn of [...(listeners.keydown || [])]) fn({ key: 'Escape' });
    assert.equal(listeners.click.length, base, 'Esc 로 닫으면 떼요'); assert.equal((listeners.keydown || []).length, 0);
    assert.equal(bus.swdel?.length, 1, '스와이프 지움 사건');
});
await ok('1.8.1 고친 답을 맞추는 사이(로어북을 처음 읽는 동안) 채팅을 바꾸면: 새 채팅의 답 · 저장을 건드리지 않아요', async () => {
    // 실리태번은 채팅을 바꿀 때 메시지 배열은 그 자리에서 갈아 끼우고(chat.splice) 메타 칸은 새 객체로 바꿔요 — 읽는 동안 들고 있던 맥락(c)의 chat 은 새 채팅, 메타 칸은 옛 채팅이 돼요
    world();
    let release = null, saves = 0;
    C.chatMetadata.world_info = 'Book';
    C.loadWorldInfo = () => new Promise(r => { release = () => r({ entries: {} }); });
    C.saveChat = async () => { saves++; }; C.saveMetadata = async () => { saves++; };
    E.useLore(undefined);
    const before = edit(3, LONG.slice(0, 10).join('\n\n'));
    const job = go(3, before);
    for (let k = 0; k < 20 && !release; k++) await new Promise(r => setTimeout(r, 0));
    assert.ok(release, '로어북을 읽기 시작했어요');
    // 채팅을 바꿈: 같은 배열에 새 채팅의 답들 · 새 메타 칸 · 새 채팅 이름
    const other = [me(), ai('Sua 가 문을 닫았다.', ['aff', 'Sua +4']), me(), ai('Sua 는 창밖을 봤다.', ['aff', 'Sua +2']), me()];
    const otherCopy = clone(other);
    C.chat.splice(0, C.chat.length, ...other);
    const oldMeta = C.chatMetadata.statussim;
    C.chatMetadata = { statussim: { base: { data: { rel: people(), wallet: { cash: 100 } } }, startAt: 0, adjust: [] } };
    C.getCurrentChatId = () => 'chat-2';
    release();
    const r = await job;
    assert.equal(r, null, '채팅이 바뀌었으면 손대지 않아요');
    assert.deepEqual(clone(C.chat), otherCopy, '새 채팅의 답은 그대로');
    assert.equal(saves, 0, '새 채팅을 저장하지 않아요');
    assert.equal(oldMeta.adjust.filter(a => a.bl_sub).length, 0, '옛 메타 칸(이미 버려진 객체)에도 안 적어요');
    delete C.loadWorldInfo;
    E.useLore(null);
});
await ok('1.8.1 연필을 눌렀다 취소한 뒤 스와이프가 바뀌고 다른 확장이 편집 사건만 내면: 옛 스와이프 글을 「고치기 전」 으로 보지 않아요', async () => {
    // 고치기 전: 연필 누름 때 기억한 본문이 취소 뒤에도 남아, 다른 스와이프로 넘긴 뒤 번역 · 명령이 낸 편집 사건에 옛 스와이프 글과 견줘 새 스와이프의 인물 몫을 뺐어요
    const E2 = await import(pathToFileURL(path.join(root, 'src/mb-editsync.js')).href + '?stale');
    E2.useCore({ app: { refreshNow() {} } });
    world(); S.useEngine(fake);
    const bus = {}, listeners = {}; C.eventSource = { on: (t, fn) => { (bus[t] ||= []).push(fn); } }; C.event_types = { MESSAGE_EDITED: 'edited', CHAT_CHANGED: 'chat' };
    const doc = { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, removeEventListener() {}, querySelector: () => null, documentElement: globalThis.document.documentElement, body: globalThis.document.body };
    assert.equal(E2.startEditSync(doc), true);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const at = (sel0, id) => ({ closest: sel => (sel === sel0 ? { closest: () => ({ getAttribute: () => String(id) }) } : null) });
    const m = C.chat[3];
    for (const fn of listeners.click) fn({ target: at('.mes_edit', 3) });   // 연필 → 취소(편집 사건 없음)
    for (const fn of listeners.click) fn({ target: at('.mes_edit_cancel', 3) });
    // 새 스와이프: Sua 가 안 나오는 글 · 변화 줄에는 Sua
    m.swipes = [m.mes, 'Mira 가 창가에 앉았다.']; m.swipe_id = 1; m.mes = m.swipes[1];
    m.extra.statussim.bySwipe[1] = [['aff', 'Mira +2'], ['호감', 'Sua +4']];
    for (const fn of bus.edited) fn(3); await wait(500);
    assert.equal(ours().length, 0, '연필로 고친 것이 아니에요');
    // 연필을 누른 채 스와이프만 바뀐 때도(취소 단추를 안 거침) 그 스와이프 글로 견주지 않아요
    for (const fn of listeners.click) fn({ target: at('.mes_edit', 3) });
    m.swipe_id = 0; m.mes = m.swipes[0];
    for (const fn of bus.edited) fn(3); await wait(500);
    assert.equal(ours().length, 0, '기억한 스와이프와 다르면 「고치기 전」 이 아니에요');
    S.useEngine(null);
});
await ok('CI 등록(release-check.yml)', async () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/mb-editsync.mjs .'));
});
console.log(`mb-editsync: ${n}개 통과`);
