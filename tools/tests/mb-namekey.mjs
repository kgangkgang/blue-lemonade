// 1.7.9 이름이 앞에 온 변화 줄도 읽기(src/mb-namekey.js) — 모델이 「Mira: aff +3 trust +4」 처럼 사람 이름을 키로 쓴 줄을
//   그 확장이 아는 「aff: Mira +3」 · 「trust: Mira +4」 로 나눠 서랍에 적어요. 그 확장은 가짜(opInfo · 지금 상태)로 대신해요 — 실제 계산은 리그에서 봐요.
//   이름은 지어낸 것(Mira · Oskar · Sua)이에요.  node tools/tests/mb-namekey.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
globalThis.document = { documentElement: { getAttribute: () => null }, body: { classList: { contains: () => true }, getAttribute: () => null, hasAttribute: () => false }, querySelectorAll: () => [], dispatchEvent: () => true, addEventListener: () => {} };
globalThis.CustomEvent ??= class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
let N = null;
try { N = await import(pathToFileURL(path.join(root, 'src/mb-namekey.js')).href); } catch (error) { console.log('FAIL src/mb-namekey.js 를 못 읽어요 —', error.message); process.exit(1); }
const W = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
let n = 0, failed = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('ok', name); } catch (error) { failed++; console.log('FAIL', name, '—', error.message); } };
const okA = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (error) { failed++; console.log('FAIL', name, '—', error.message); } };

// 그 확장 키 표를 흉내(일부): 애정 · 우정 키 낱말 · 수치 칸 이름(지금 상태의 bars)
const KEYS = { aff: 'aff', affection: 'aff', '호감': 'aff', trust: 'trust', friendship: 'trust', '우정': 'trust', loc: 'loc', npc: 'npc', event: 'event', rel: 'rel', stat: 'stat' };
const state = { data: { stats: { bars: [{ name: 'Workload' }] }, rel: { user: [{ name: 'Mira', aliases: ['미라'] }, { name: 'Oskar' }] }, profile: { list: [{ name: 'Sua', role: 'user' }, { name: 'Mira' }] } } };
const opInfo = (s, k) => { const w = String(k).trim().toLowerCase(); let key = KEYS[w] ?? null; if (!key && s?.data?.stats?.bars?.some(b => b.name.toLowerCase() === w)) key = 'stat'; return { key }; };
const keyOf = w => opInfo(state, w).key;
const names = N.personNames(state, 'Sua');

ok('인물 표 이름 · 별칭(사용자 빼고)', () => {
    assert.deepEqual([...names].sort(), ['mira', 'oskar', '미라']);
});
ok('값 나누기: 애정 · 우정 키와 숫자만', () => {
    assert.deepEqual(N.deltaPairs('aff +3 trust +4', keyOf), [['aff', '+3'], ['trust', '+4']]);
    assert.deepEqual(N.deltaPairs('trust −1', keyOf), [['trust', '-1']]);
    assert.deepEqual(N.deltaPairs('호감 +2, 우정 +1', keyOf), [['호감', '+2'], ['우정', '+1']]);
    assert.equal(N.deltaPairs('smiled at her +3', keyOf), null, '다른 글이 섞이면 안 나눠요');
    assert.equal(N.deltaPairs('Workload +2', keyOf), null, '수치 칸은 애정 · 우정이 아니에요');
    assert.equal(N.deltaPairs('aff +3 because tea', keyOf), null);
});
ok('실제 꼴: 「이름: aff +3 trust +4」 줄을 그 확장 꼴로(아는 줄 · 모르는 이름 · 수치 칸 · 글 값은 그대로)', () => {
    const ops = [['loc', 'Office'], ['Mira', 'aff +3 trust +4'], ['Oskar', 'trust +1'], ['Nobody', 'aff +2'], ['Workload', '+5'], ['미라', 'aff +1'], ['Mira', 'waved hello'], ['aff', 'Oskar +2']];
    const r = N.rewriteOps(ops, keyOf, names);
    assert.ok(r);
    assert.deepEqual(r.ops, [['loc', 'Office'], ['aff', 'Mira +3'], ['trust', 'Mira +4'], ['trust', 'Oskar +1'], ['Nobody', 'aff +2'], ['Workload', '+5'], ['aff', '미라 +1'], ['Mira', 'waved hello'], ['aff', 'Oskar +2']]);
    assert.deepEqual(r.was, [['Mira', 'aff +3 trust +4'], ['Oskar', 'trust +1'], ['미라', 'aff +1']]);
    assert.equal(N.rewriteOps([['aff', 'Mira +1']], keyOf, names), null, '바꿀 것 없으면 null');
    assert.equal(N.rewriteOps([['Sua', 'aff +1']], keyOf, names), null, '사용자 이름은 안 나눠요');
});
ok('줄인 키(별칭 표): 「fri: 이름 +2」 → 「trust: 이름 +2」 · 표에 없는 줄임 · 모르는 이름 · 글 값은 그대로', () => {
    assert.deepEqual(N.KEY_ALIASES, { fri: 'trust' }, '실제로 나온 별칭만');
    const ops = [['fri', 'Mira +2'], ['fri', 'Oskar −1, 미라 +1'], ['frnd', 'Mira +2'], ['fri', 'Nobody +2'], ['fri', 'Mira smiled'], ['Fri', 'Oskar +3']];
    const r = N.rewriteOps(ops, keyOf, names);
    assert.deepEqual(r.ops, [['trust', 'Mira +2'], ['trust', 'Oskar -1, 미라 +1'], ['frnd', 'Mira +2'], ['fri', 'Nobody +2'], ['fri', 'Mira smiled'], ['trust', 'Oskar +3']]);
    assert.deepEqual(r.was, [['fri', 'Mira +2'], ['fri', 'Oskar −1, 미라 +1'], ['Fri', 'Oskar +3']]);
    const known = w => (String(w).toLowerCase() === 'fri' ? 'stat' : keyOf(w));
    assert.equal(N.rewriteOps([['fri', 'Mira +2']], known, names), null, '그 확장이 fri 를 아는 키(수치 칸 등)로 읽으면 안 건드려요');
});
ok('메시지: 지금 서랍 · 다른 스와이프 서랍 · 원래 줄 남김 · 본문에 블록이 있으면 안 건드림', () => {
    const m = { is_user: false, mes: 'story', swipe_id: 0, extra: { statussim: { bySwipe: { 0: [['Mira', 'aff +3 trust +4']], 1: [['aff', 'Oskar +1']] } } },
        swipe_info: [{ extra: null }, { extra: { statussim: { bySwipe: { 1: [['Oskar', 'trust +2']] } } } }] };
    m.swipe_info[0].extra = m.extra;
    assert.equal(N.fixMessage(m, keyOf, names), 2);
    assert.deepEqual(m.extra.statussim.bySwipe[0], [['aff', 'Mira +3'], ['trust', 'Mira +4']]);
    assert.deepEqual(m.extra[N.STATE][0], [['Mira', 'aff +3 trust +4']]);
    assert.deepEqual(m.swipe_info[1].extra.statussim.bySwipe[1], [['trust', 'Oskar +2']]);
    assert.equal(m.mes, 'story', '본문 그대로');
    assert.equal(N.fixMessage(m, keyOf, names), 0, '두 번 돌려도 그대로');
    const raw = { is_user: false, mes: 'x <meatball>Mira: aff +1</meatball>', extra: { statussim: { bySwipe: { 0: [['Mira', 'aff +1']] } } } };
    assert.equal(N.fixMessage(raw, keyOf, names, { hasStatus: t => t.includes('<meatball>') }), 0);
    assert.equal(N.fixMessage({ is_user: true, extra: { statussim: { bySwipe: { 0: [['Mira', 'aff +1']] } } } }, keyOf, names), 0, '내 메시지는 안 봐요');
});
await okA('채팅 훑기: 바꾸면 저장 · 새로고침 한 번 · 스위치 끄면 안 해요', async () => {
    let saved = 0, refreshed = 0;
    N.useCore({ app: { current: { state }, refreshNow: () => { refreshed++; } } });
    const chat = [{ is_user: true, mes: 'hi' }, { is_user: false, mes: 'a', swipe_id: 0, extra: { statussim: { bySwipe: { 0: [['Mira', 'aff +2']] } } } }];
    const c = { chat, name1: 'Sua', chatMetadata: { statussim: { base: state } }, extensionSettings: {}, saveChat: async () => { saved++; } };
    const eng = { opInfo, hasStatus: () => false };
    assert.equal(await N.sweep(c, { eng }), 1);
    assert.deepEqual(chat[1].extra.statussim.bySwipe[0], [['aff', 'Mira +2']]);
    assert.equal(saved, 1); assert.equal(refreshed, 1);
    assert.equal(await N.sweep(c, { eng }), 0); assert.equal(saved, 1, '바뀐 게 없으면 저장 안 해요');
    chat[1].extra.statussim.bySwipe[0] = [['Oskar', 'trust +1']];
    const offDoc = { documentElement: { getAttribute: a => (a === W.MB_OFF_ATTR ? 'namekey' : null) } };
    assert.equal(await N.sweep(c, { eng, doc: offDoc }), 0);
    assert.deepEqual(chat[1].extra.statussim.bySwipe[0], [['Oskar', 'trust +1']], '끄면 그대로');
    N.useCore(undefined);
});
ok('스위치 · 시작 자리 · CI', () => {
    const sw = W.switchOf('namekey'); assert.ok(sw, '스위치 없음'); assert.equal(sw.kind, 'data'); assert.equal(sw.file, 'src/mb-namekey.js');
    assert.equal(W.switchOn({ chat: {} }, 'namekey'), true, '기본 켬');
    assert.ok(fs.readFileSync(path.join(root, 'src/mb-hidden.js'), 'utf8').includes("import('./mb-namekey.js').then(m => m.startNameKey(doc))"));
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/mb-namekey.mjs .'));
});
ok('버그 사냥 6 점자 빈칸(U+2800) 변화 줄: 「⠀Mira⠀」 를 「Mira」 로 — 같은 사람 한 칸 · 원래 줄은 남김 · 인물 표가 비어도 · 다른 줄은 그대로', () => {
    const B = '⠀';
    const ops = [['mind', `${B}Mira${B}|${B}내일${B}아침에${B}보자고`], [`${B}aff${B}`, `${B}Mira${B}+2`], ['loc', 'Lobby>Desk']];
    const r = N.rewriteOps(ops, keyOf, names);
    assert.ok(r);
    assert.deepEqual(r.ops[0], ['mind', 'Mira | 내일 아침에 보자고']);
    assert.deepEqual(r.ops[1], ['aff', 'Mira +2']);
    assert.deepEqual(r.ops[2], ['loc', 'Lobby>Desk'], '점자 빈칸 없는 줄은 그대로');
    assert.deepEqual(r.was.map(x => x[0]), ['mind', `${B}aff${B}`]);
    assert.ok(N.rewriteOps([['mind', `${B}Mira${B}| 글`]], keyOf, new Set()), '인물 표가 아직 비어도');
    assert.equal(N.rewriteOps([['mind', 'Mira | 글']], keyOf, names), null, '바꿀 것 없으면 null');
    // 이미 갈라진 기록: 서랍 줄을 다시 셈하면 한 이름 — 메시지 둘(앞은 「Mira」 · 뒤는 「⠀Mira⠀」)
    const m1 = { extra: { statussim: { bySwipe: { 0: [['mind', 'Mira | 첫 속마음']] } } } }, m2 = { extra: { statussim: { bySwipe: { 0: [['mind', `${B}Mira${B}|${B}둘째`]] } } } };
    assert.equal(N.fixMessage(m1, keyOf, names), 0); assert.equal(N.fixMessage(m2, keyOf, names), 1);
    const who = [m1, m2].map(m => m.extra.statussim.bySwipe[0][0][1].split('|')[0].trim());
    assert.deepEqual(who, ['Mira', 'Mira'], '두 메시지의 이름이 같아요');
    assert.deepEqual(m2.extra[N.STATE][0][0], ['mind', `${B}Mira${B}|${B}둘째`], '원래 줄 남김');
    assert.equal(N.blankLine(`${B}${B}a${B}${B}b${B}`), 'a b');
});
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log(`mb-namekey: ${n}개 통과`);
