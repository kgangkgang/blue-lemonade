// 1.5.9 채팅 이름표를 인물 색으로(src/name-people.js · 설정 chat.namePeople · 기본 끔)
//   ① 시트 글: 인물표에 색이 있는 사람만 · 별칭까지 · 같은 색은 한 규칙 · 바탕에 묻히면 밝기만 맞춤 · 그러데이션 건 쪽은 빼요 ② 켬 · 끔(표식 · 시트 · 인물표 바뀜 받기)
//   ③ 지금 채팅 이름(내 이름 · 카드)도 인물표에 물어요 ④ 설정 등록(기본 끔 · 설정 창 · 찾기 · 이름표 · 적용 · CI). 이름은 지어낸 것이에요.
//   node tools/tests/name-people.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// ── 가짜 문서 ─────────────────────────────
const listeners = new Map(), sheets = new Map(), attrs = new Set();
const handlers = new Map();
const ctx = { name1: '여행자', name2: '별빛여관', eventSource: { on: (t, fn) => { if (!handlers.has(t)) handlers.set(t, []); handlers.get(t).push(fn); } }, event_types: { CHAT_CHANGED: 'chat_id_changed' } };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
const timers = []; globalThis.setTimeout = fn => { timers.push(fn); return timers.length; };
const flush = () => { for (const fn of timers.splice(0)) fn(); };
const doc = globalThis.document = {
    body: { hasAttribute: a => attrs.has(a), toggleAttribute: (a, on) => { if (on) attrs.add(a); else attrs.delete(a); } },
    head: { appendChild: el => { sheets.set(el.id, el); } }, createElement: () => ({ id: '', textContent: '' }), getElementById: id => sheets.get(id) || null,
    addEventListener: (t, fn) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); }, removeEventListener: (t, fn) => { listeners.get(t)?.delete(fn); },
    dispatchEvent: ev => { for (const fn of [...(listeners.get(ev.type) || [])]) fn(ev); }, defaultView: globalThis,
};
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const m = await load('src/name-people.js');
const P = await load('src/people.js');
const { contrast } = await load('src/shared/ink-paint.js');
const css = () => sheets.get(m.NAME_SHEET)?.textContent ?? '';

const ROSE = '#d98aa5', SKY = '#7fb2e5', NAVY = '#1a2340';
await ok('① 시트 글: 색 있는 사람만 · 별칭 · 같은 색 묶음 · 이상한 글자 · 시스템 메시지 제외', () => {
    assert.equal(m.nameCss([]), ''); assert.equal(m.nameCss(null), '');
    const text = m.nameCss([{ name: '미나', names: ['미나', 'Mina "M" Park'], color: ROSE }, { name: '레온', names: ['레온'], color: SKY }, { name: '색없음', names: ['색없음'], color: null }, { name: '베스', names: ['베스'], color: '#D98AA5' }, { name: '이상', color: 'red' }]);
    const rules = text.split('\n');
    assert.equal(rules.length, 2, '색 둘 = 규칙 둘');
    assert.equal(rules[0], 'body.salty[data-bl-name-people] #chat .mes.mes:is([ch_name="미나"],[ch_name="Mina \\"M\\" Park"],[ch_name="베스"]):not([is_system="true"]):not(.smallSysMes) .name_text { color: #d98aa5 !important; }');
    assert.ok(rules[1].includes('[ch_name="레온"])') && rules[1].includes('color: #7fb2e5 !important'));
    assert.ok(!text.includes('색없음') && !text.includes('이상'));
});
await ok('② 바탕에 묻히는 색은 밝기만 옮겨 대비 4.5 — 잘 보이는 색은 그대로(낮 · 밤)', () => {
    const inkOf = text => /color: (#[0-9a-f]{6})/.exec(text)[1];
    const night = inkOf(m.nameCss([{ name: '가', color: NAVY }], { bg: '#1c1e21' }));
    assert.notEqual(night, NAVY); assert.ok(contrast(night, '#1c1e21') >= 4.5, `밤 ${night}`);
    const day = inkOf(m.nameCss([{ name: '가', color: '#f2e9a0' }], { bg: '#ffffff' }));
    assert.ok(contrast(day, '#ffffff') >= 4.5, `낮 ${day}`);
    assert.equal(inkOf(m.nameCss([{ name: '가', color: SKY }], { bg: '#1c1e21' })), SKY, '이미 잘 보이면 그대로');
    assert.equal(inkOf(m.nameCss([{ name: '가', color: SKY }], { bg: 'var(--x)' })), SKY, '바탕을 못 읽으면 색 그대로');
});
await ok('③ 이름 글자 그러데이션을 건 쪽은 빼요', () => {
    const list = [{ name: '가', color: ROSE }];
    assert.ok(m.nameCss(list, { skipChar: true }).includes(')[is_user="true"]:not([is_system'));
    assert.ok(m.nameCss(list, { skipUser: true }).includes('):not([is_user="true"]):not([is_system'));
    assert.equal(m.nameCss(list, { skipChar: true, skipUser: true }), '');
});
await ok('④ 켬: 표식 · 시트 · 인물표가 바뀌면 다시 써요 · 지금 채팅 이름(내 이름)도 물어요 · 끔: 표식 떼고 시트 비움', () => {
    assert.equal(m.syncNamePeople(false, {}, doc), ''); assert.equal(sheets.size, 0, '끈 채로는 시트를 안 만들어요'); assert.equal(attrs.has(m.NAME_MARK), false);
    const book = new Map([['미나', ROSE]]);
    const drop = P.registerPeopleSource('test', { names: () => [...book.keys()], person: names => { for (const x of names) if (book.has(x)) return { color: book.get(x) }; return null; } });
    flush();
    m.syncNamePeople(true, { bg: '#1c1e21' }, doc);
    assert.equal(attrs.has(m.NAME_MARK), true);
    assert.ok(css().includes('[ch_name="미나"]')); assert.ok(!css().includes('여행자'));
    book.set('여행자', SKY); book.set('레온', SKY); P.peopleChanged(); flush();
    assert.ok(css().includes('[ch_name="레온"]'), '인물표 바뀜에 다시 썼어요'); assert.ok(css().includes('[ch_name="여행자"]'));
    // 채팅 바꾸기: 명단에는 없지만 색이 잡히는 이름(카드 이름)
    book.delete('여행자'); book.delete('레온'); P.invalidatePeople();
    const person = names => (names.includes('달빛서점') ? { color: ROSE } : null);
    const drop2 = P.registerPeopleSource('alias', { names: () => [], person }); flush();
    ctx.name2 = '달빛서점'; for (const fn of handlers.get('chat_id_changed') || []) fn();
    assert.ok(css().includes('[ch_name="달빛서점"]'));
    assert.equal(handlers.get('chat_id_changed').length, 1);
    m.syncNamePeople(true, { bg: '#ffffff' }, doc); assert.equal(handlers.get('chat_id_changed').length, 1, '신호는 한 번만 걸어요');
    assert.equal(m.syncNamePeople(false, {}, doc), ''); assert.equal(css(), ''); assert.equal(attrs.has(m.NAME_MARK), false);
    book.set('새사람', SKY); P.peopleChanged(); flush(); assert.equal(css(), '', '끈 뒤에는 인물표가 바뀌어도 안 써요');
    drop(); drop2(); flush();
});
await ok('⑤ 설정 등록: 기본 끔 · 설정 창 · 찾기 · 이름표 · 적용(켠 때만 모듈) · 스타일에 안 담음 · CI', () => {
    const settings = read('src/settings.js');
    assert.ok(settings.includes('inkContrast: true, namePeople: false,')); assert.ok(settings.includes('s.chat.namePeople = flag(s.chat.namePeople, false);'));
    assert.ok(read('src/panel.js').includes("row('이름표를 인물 색으로', toggle('chat.namePeople', s.chat.namePeople === true)"));
    assert.ok(read('src/settings-search.js').includes("'chat.namePeople']"));
    assert.ok(read('src/settings-labels.js').includes('"chat.namePeople":"이름표를 인물 색으로"'));
    assert.ok(read('src/apply.js').includes("const on = want.has('salty') && s.chat.namePeople === true; lateSync('namePeople', () => import('./name-people.js'), on,"));
    assert.ok(read('src/styles.js').includes("'mbFaceLook', 'namePeople',")); assert.ok(settings.includes("'mbFaceLook', 'namePeople',"));
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/name-people.mjs .'));
});
console.log(`name-people: ${n}개 통과`);
