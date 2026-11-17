// 1.5.9 카드별 색 기억 — src/card-colors.js: 인물표 공급자 'card'(차례 50 · 이 채팅 대사 색 뒤 · 프리셋 색 앞)
//   node tools/tests/card-colors.mjs <테마 루트>
// 이름 · 색은 모두 지어낸 것이에요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(themeRoot, rel)).href;
const read = rel => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
globalThis.document = new EventTarget();
const P = await import(url('src/people.js'));
const K = await import(url('src/card-colors.js'));
const X = await import(url('src/ext-compat.js'));

// 가짜 실리태번: 카드 하나(a.png) · 설정의 카드별 색 기억
const handlers = new Map();
const es = { on(e, fn) { handlers.set(e, fn); }, removeListener(e, fn) { if (handlers.get(e) === fn) handlers.delete(e); } };
const cards = { 'a.png': { '#e0567f': 'Mina Park', '#3a8ee6': '레오', '#424C59': '{{user}}', '#77aa33': '{{char}}', 'red': '색 아님', '#123456': '  ' }, 'b.png': { '#ffe23c': '다른 카드' } };
const ctx = {
    characterId: 0, groupId: null, name1: '하나', name2: 'Corvin',
    characters: [{ avatar: 'a.png', name: 'Corvin' }, { avatar: 'b.png', name: '다른 카드' }],
    groups: [{ id: 'g', members: ['a.png', 'b.png'] }],
    extensionSettings: { lemon_voice: { card_colors: cards } },
    eventSource: es, eventTypes: { CHAT_CHANGED: 'chat', SETTINGS_UPDATED: 'settings', GROUP_UPDATED: 'group', CHARACTER_EDITED: 'edit', CHARACTER_RENAMED: 'rename' },
};
globalThis.SillyTavern = { getContext: () => ctx };

await test('표: 지금 카드만 · 색 → 이름을 이름 → 색으로 · 첫 낱말 · {{user}} · {{char}} 는 지금 이름 · 색 아닌 줄 · 빈 이름은 버려요', () => {
    const rows = K.cardColorRows(ctx);
    assert.deepEqual(rows.map(r => [r.name, r.color]), [['Mina Park', '#e0567f'], ['레오', '#3a8ee6'], ['하나', '#424c59'], ['Corvin', '#77aa33']]);
    const t = K.cardColorTable(ctx);
    assert.equal(K.tableColor(t, 'mina  park'), '#e0567f'); assert.equal(K.tableColor(t, 'Mina'), '#e0567f', '첫 낱말');
    assert.equal(K.tableColor(t, '다른 카드'), null, '다른 카드의 기억은 안 써요'); assert.equal(K.tableColor(t, '{{user}}'), null);
    assert.equal(K.cardColorTable({}).size, 0); assert.equal(K.cardColorTable(null).size, 0);
});
await test('그룹이면 구성원 카드 전부', () => {
    const t = K.cardColorTable({ ...ctx, groupId: 'g' });
    assert.equal(K.tableColor(t, '다른 카드'), '#ffe23c'); assert.equal(K.tableColor(t, '레오'), '#3a8ee6');
});
await test('미트볼 얼굴(ext-compat)은 같은 함수를 그대로 내보내요 — 두 벌이 아니에요', () => {
    assert.equal(X.cardColorTable, K.cardColorTable); assert.equal(X.tableColor, K.tableColor);
    assert.doesNotMatch(read('src/ext-compat.js'), /export function cardColorTable/);
});
await test('인물표: 대사가 없어도 people.get 이 카드 색을 줘요 · colorFrom = card · 유저 · 목록', () => {
    K._forTest.reset();
    K.syncCardColors(true);
    const m = P.people.get('Mina Park');
    assert.equal(m.color, '#e0567f'); assert.equal(m.colorFrom, 'card');
    assert.equal(P.people.get('레오').color, '#3a8ee6');
    assert.equal(P.people.get('하나').color, '#424c59', '유저({{user}}) 색');
    assert.equal(P.people.get('Corvin').color, '#77aa33', '{{char}} = 지금 카드 이름');
    assert.equal(P.people.get('모르는 사람'), null);
    assert.deepEqual(P.people.list().map(p => p.name), ['Mina Park', '레오', '하나', 'Corvin']);
});
await test('차례: 이 채팅 대사 색(TTS · 0) → 카드별 색 기억(50) → 프리셋(100)', () => {
    const tts = { person: names => names.includes('레오') ? { color: '#010203' } : null, names: () => [], stamp: () => 1 };
    const preset = { person: names => names.includes('레오') || names.includes('Mina Park') || names.includes('Zed') ? { color: '#0a0b0c' } : null, names: () => [], stamp: () => 1 };
    const offP = P.registerPeopleSource('preset', preset, { rank: 100 });   // 먼저 등록해도 차례는 뒤
    const offT = P.registerPeopleSource('tts', tts);
    assert.equal(P.people.get('레오').colorFrom, 'tts'); assert.equal(P.people.get('레오').color, '#010203');
    assert.equal(P.people.get('Mina Park').colorFrom, 'card'); assert.equal(P.people.get('Mina Park').color, '#e0567f');
    assert.equal(P.people.get('Zed').colorFrom, 'preset');
    // 미트볼 얼굴 · 개인 확장이 쓰는 거르기: 「프리셋 말고」 차례에서 카드 색이 나와요
    assert.equal(X.personColor(P.people, { from: 'other' }, 'Mina Park'), '#e0567f');
    assert.equal(X.personColor(P.people, { from: 'preset' }, 'Mina Park'), null);
    offT(); offP();
});
await test('바뀜: TTS 색 표에서 이름을 정하면(제자리 바꿈 + 인물표 판 올림) 바로 · 알림 없는 바꿈은 1.5초에 한 번까지 다시 읽어요 · 같으면 판 그대로', () => {
    const g0 = K._forTest.gen;
    assert.equal(P.people.get('레오').color, '#3a8ee6');
    assert.equal(K._forTest.gen, g0, '같은 표면 판이 안 올라가요');
    delete cards['a.png']['#3a8ee6']; cards['a.png']['#3a8ee7'] = '레오';
    P.invalidatePeople();                                  // TTS 가 표를 고칠 때 하는 일(speakers.js dirty · persist)
    assert.equal(P.people.get('레오').color, '#3a8ee7');
    delete cards['a.png']['#3a8ee7']; cards['a.png']['#3a8ee6'] = '레오';   // 알림 없이 되돌림(다른 기기 합치기)
    K._forTest.clearLook();
    assert.equal(P.people.get('레오').color, '#3a8ee6');
});
await test('이벤트: 채팅 · 설정 · 그룹 · 카드가 바뀌면 다시 읽고, 달라졌으면 bl:people-changed 한 번', async () => {
    assert.ok(handlers.has('chat') && handlers.has('settings') && handlers.has('group') && handlers.has('edit') && handlers.has('rename'));
    let fired = 0; const off = P.people.onChange(() => fired++);
    await new Promise(r => setTimeout(r, 150)); fired = 0;
    ctx.characterId = 1;                                   // 다른 카드의 채팅으로
    handlers.get('chat')();
    assert.equal(P.people.get('레오'), null); assert.equal(P.people.get('다른 카드').color, '#ffe23c');
    await new Promise(r => setTimeout(r, 150));
    assert.equal(fired, 1);
    handlers.get('settings')();                            // 같은 표
    await new Promise(r => setTimeout(r, 150));
    assert.equal(fired, 1, '달라지지 않았으면 알리지 않아요');
    ctx.characterId = 0; handlers.get('chat')(); off();
});
await test('끄면 공급자에서 빠지고 이벤트도 떼요', () => {
    K.syncCardColors(false);
    assert.equal(P.people.get('Mina Park'), null);
    assert.equal(handlers.size, 0);
});
await test('코드: 이름 · 색을 박지 않아요 · features 가 테마와 함께 켬', () => {
    assert.doesNotMatch(read('src/card-colors.js').replace(/^\s*\/\/.*$/gm, ''), /#[0-9a-fA-F]{6}\b/);
    assert.match(read('src/features.js'), /load\('cardcolors', '\.\/card-colors\.js'\)\.then\(m => m\?\.syncCardColors\(on\)\)/);
});
await test('1.6.2 첫 낱말: 그 첫 낱말을 가진 사람이 한 명이면 맞추고, 같은 첫 낱말이 둘이면 첫 낱말로는 안 맞춰요(전체 이름은 그대로)', () => {
    const one = { ...ctx, characterId: 0, extensionSettings: { lemon_voice: { card_colors: { 'a.png': { '#e0567f': 'Mina Park', '#3a8ee6': 'Rho Ann' } } } } };
    const t1 = K.cardColorTable(one);
    assert.equal(K.tableColor(t1, 'Mina'), '#e0567f'); assert.equal(K.tableColor(t1, 'Mina Kim'), '#e0567f', '한 명이면 다른 이름도 첫 낱말로');
    const two = { ...ctx, characterId: 0, extensionSettings: { lemon_voice: { card_colors: { 'a.png': { '#e0567f': 'Mina Park', '#2f9e6e': 'Mina Lee', '#3a8ee6': 'Rho Ann' } } } } };
    const t2 = K.cardColorTable(two);
    assert.equal(K.tableColor(t2, 'Mina'), null, '두 사람이 「mina」 — 누구인지 정하지 않아요');
    assert.equal(K.tableColor(t2, 'Mina Kim'), null, '첫 낱말만 같은 다른 사람은 남의 색을 안 받아요');
    assert.equal(K.tableColor(t2, 'Mina Park'), '#e0567f'); assert.equal(K.tableColor(t2, 'mina lee'), '#2f9e6e', '전체 이름은 그대로');
    assert.equal(K.tableColor(t2, 'Rho'), '#3a8ee6', '다른 첫 낱말은 한 명이라 그대로');
    const full = { ...ctx, characterId: 0, extensionSettings: { lemon_voice: { card_colors: { 'a.png': { '#e0567f': 'Mina Park', '#111111': 'Mina' } } } } };
    assert.equal(K.tableColor(K.cardColorTable(full), 'Mina'), '#111111', '첫 낱말이 다른 사람의 전체 이름이면 그 사람');
});

console.log(`card-colors: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
