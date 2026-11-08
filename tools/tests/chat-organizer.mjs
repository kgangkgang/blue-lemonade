// 1.0.2 채팅 정리 (src/chat-organizer-core.js · src/chat-organizer.js): 순수 계산 + 가짜 브라우저(leak-dom)에서 캐릭터 관리 서랍에 탭 붙이기.
//   · 저장값 다듬기 · 안정 키(integrity)로 밖에서 바뀐 이름 따라가기 · 폴더 계산(하위 3단 · 지우면 위로) · 날짜 이름표
//   · 실리태번 목록은 옮기지 않음 · 켜기만으로는 서버 요청 0 · 최근 탭에서 한 번 · 폴더 탭은 요청 없이
//   · 고정 · 폴더 넣기 · CHAT_RENAMED 따라가기 · 여러 개 지우기(지금 채팅 제외 · 확인 두 번 · 실리태번 삭제 함수) · 끄면 흔적 없음
//   node tools/tests/chat-organizer.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/chat-organizer-core.js'));

// ───────── 순수 계산 ─────────
await test('다듬기: 깨진 값 · 같은 id · 없는 부모 · 고리 · 너무 깊음 · 고정도 폴더도 아닌 항목은 버림 · 이름 40자', () => {
    const out = core.tidyStore({
        on: true,
        folders: [
            { id: 'a', name: '  긴   이름 ' + 'ㄱ'.repeat(60) }, { id: 'a', name: '같은 id' }, { id: 'b', name: 'B', parent: 'zzz' },
            { id: 'c', name: 'C', parent: 'd' }, { id: 'd', name: 'D', parent: 'c' },
            { id: 'e1', name: 'E1' }, { id: 'e2', name: 'E2', parent: 'e1' }, { id: 'e3', name: 'E3', parent: 'e2' }, { id: 'e4', name: 'E4', parent: 'e3' },
            null, 'junk', { id: '__proto__', name: 'x' },
        ],
        chats: {
            x1: { k: 'c', o: 'a.png', f: 'one.jsonl', pin: true, in: 'b', extra: 'drop' },
            x2: { k: 'c', o: 'a.png', f: 'two' },
            x3: { k: 'q', o: 'a.png', f: 'three', pin: true },
            x4: { k: 'g', o: 'g1', f: '../evil', pin: true },
            x5: { k: 'g', o: 'g1', f: 'ok', in: 'nope' },
            __proto__: { k: 'c', o: 'a.png', f: 'p', pin: true },
        },
    });
    assert.equal(out.on, true);
    assert.equal(out.folders[0].name.length, 40); assert.match(out.folders[0].name, /^긴 이름 /);
    assert.notEqual(out.folders[1].id, 'a', '같은 id 는 새 id');
    assert.equal(out.folders.find(f => f.name === 'B').parent, '', '없는 부모 → 맨 위');
    const c = out.folders.find(f => f.name === 'C'), d = out.folders.find(f => f.name === 'D');
    assert.ok(c.parent === '' || d.parent === '', '고리는 끊음');
    assert.equal(out.folders.find(f => f.name === 'E4').parent, '', '4단은 맨 위로');
    assert.equal(out.folders.find(f => f.name === 'E3').parent, 'e2', '3단은 그대로');
    assert.ok(!out.folders.some(f => f.id === '__proto__'));
    assert.deepEqual(Object.keys(out.chats), ['x1']);
    assert.deepEqual(out.chats.x1, { k: 'c', o: 'a.png', f: 'one', pin: true, in: 'b' });
    assert.equal(core.tidyStore(null).on, false);
});
await test('서버 줄: 캐릭터 · 그룹 · .jsonl 떼기 · integrity · 깨진 줄은 null', () => {
    const r = core.normalizeRow({ file_name: 'Ann - 2026.jsonl', file_id: 'Ann - 2026', avatar: 'ann.png', chat_items: 4, mes: 'hi', last_mes: 1000, chat_metadata: { integrity: 'u-1', big: 'x'.repeat(10) } });
    assert.deepEqual({ k: r.k, o: r.o, f: r.f, integrity: r.integrity, last: r.last, count: r.count }, { k: 'c', o: 'ann.png', f: 'Ann - 2026', integrity: 'u-1', last: 1000, count: 4 });
    assert.equal(core.normalizeRow({ file_name: 'g.jsonl', group: 'g1' }).k, 'g');
    assert.equal(core.normalizeRow({ file_name: 'a/b.jsonl', avatar: 'x.png' }), null);
    assert.equal(core.normalizeRow({ file_name: 'x.jsonl' }), null, '주인 없음');
    assert.equal(core.normalizeRow(null), null);
});
await test('안정 키: 밖에서 이름을 바꿔도 integrity 로 찾아 이름을 고쳐 적음 · 같은 이름의 다른 채팅은 안 건드림 · 비어 있던 integrity 채움', () => {
    const s = core.tidyStore({ folders: [{ id: 'f1', name: 'F' }], chats: {
        a: { k: 'c', o: 'ann.png', f: 'old name', i: 'u-1', in: 'f1' },
        b: { k: 'c', o: 'ann.png', f: 'same', i: 'u-2', pin: true },
        c: { k: 'c', o: 'bob.png', f: 'plain', pin: true },
    } });
    const rows = [
        { k: 'c', o: 'ann.png', f: 'new name', integrity: 'u-1' },
        { k: 'c', o: 'ann.png', f: 'same', integrity: 'u-9' },
        { k: 'c', o: 'bob.png', f: 'plain', integrity: 'u-3' },
    ];
    assert.equal(core.reconcile(s, rows), 2);
    assert.equal(s.chats.a.f, 'new name');
    assert.equal(s.chats.b.f, 'same'); assert.equal(s.chats.b.i, 'u-2', '다른 채팅(integrity 다름)은 그대로');
    assert.equal(s.chats.c.i, 'u-3');
    assert.equal(core.findEntry(s, rows[0]), 'a');
    assert.equal(core.findEntry(s, rows[1]), '', '이름은 같아도 integrity 가 다르면 다른 채팅');
    assert.equal(core.findEntry(s, { k: 'c', o: 'ann.png', f: 'same', integrity: '' }), 'b', 'integrity 모르면 이름으로');
});
await test('이름 · 주인 바뀜 따라가기 · 지운 것 빼기 · 고정도 폴더도 없으면 항목 없앰 · 서버 pinned 칸 꼴', () => {
    const s = core.tidyStore({ folders: [{ id: 'f1', name: 'F' }], chats: {} });
    const ref = { k: 'c', o: 'ann.png', f: 'one', integrity: '' };
    const id = core.setEntry(s, ref, { pin: true });
    assert.ok(id); assert.equal(s.chats[id].pin, true);
    assert.deepEqual(core.pinnedParam(s), [{ avatar: 'ann.png', file_name: 'one.jsonl' }]);
    core.setEntry(s, { k: 'g', o: 'g1', f: 'gc' }, { pin: true });
    assert.deepEqual(core.pinnedParam(s)[1], { group: 'g1', file_name: 'gc.jsonl' });
    assert.equal(core.renameEntries(s, { k: 'c', o: 'ann.png', from: 'one.jsonl', to: 'uno.jsonl' }), 1);
    assert.equal(s.chats[id].f, 'uno');
    assert.equal(core.moveOwner(s, 'ann.png', 'ann2.png'), 1);
    assert.equal(core.setEntry(s, { k: 'c', o: 'ann2.png', f: 'uno' }, { pin: false }), '', '고정을 풀면 항목이 없어짐');
    assert.equal(Object.keys(s.chats).length, 1);
    assert.equal(core.dropEntries(s, [{ k: 'g', o: 'g1', f: 'gc' }]), 1);
    assert.deepEqual(s.chats, {});
});
await test('폴더: 하위 3단까지 · 고리 막기 · 같은 단 위아래 · 다른 폴더 안으로 · 차례(트리)', () => {
    const s = core.tidyStore({});
    const a = core.addFolder(s, '가'), b = core.addFolder(s, '나'), a1 = core.addFolder(s, '가-1', a), a2 = core.addFolder(s, '가-1-1', a1);
    assert.equal(core.depthOf(s.folders, a2), 3);
    const tooDeep = core.addFolder(s, '넷째', a2);
    assert.equal(s.folders.find(f => f.id === tooDeep).parent, '', '4단은 맨 위에');
    assert.equal(core.canNest(s.folders, a, a2), false, '자기 아래로는 못 감');
    assert.equal(core.canNest(s.folders, a, b), false, '옮기면 4단이 되면 못 감');
    assert.equal(core.canNest(s.folders, b, a1), true);
    assert.ok(core.nestFolder(s, b, a1));
    assert.deepEqual(core.folderTree(s.folders).map(x => [s.folders.find(f => f.id === x.folder.id).name, x.depth]), [['가', 0], ['가-1', 1], ['가-1-1', 2], ['나', 2], ['넷째', 0]]);
    assert.ok(core.shiftFolder(s, b, -1));
    assert.deepEqual(core.folderTree(s.folders).filter(x => x.depth === 2).map(x => x.folder.name), ['나', '가-1-1']);
    assert.equal(core.shiftFolder(s, b, -1), false, '맨 위에서 더 위로는 안 감');
    assert.ok(core.renameFolder(s, b, '  다  '));
    assert.equal(s.folders.find(f => f.id === b).name, '다');
    assert.equal(core.renameFolder(s, b, '   '), false);
});
await test('폴더 지우기: 하위 폴더는 한 단 위로 · 안의 채팅은 위 폴더로 · 맨 위 폴더면 폴더 밖(고정이 아니면 항목 없앰)', () => {
    const s = core.tidyStore({});
    const top = core.addFolder(s, '위'), mid = core.addFolder(s, '가운데', top), low = core.addFolder(s, '아래', mid);
    core.setEntry(s, { k: 'c', o: 'a.png', f: 'm1' }, { in: mid });
    core.setEntry(s, { k: 'c', o: 'a.png', f: 't1' }, { in: top });
    core.setEntry(s, { k: 'c', o: 'a.png', f: 't2' }, { in: top, pin: true });
    assert.equal(core.folderCount(s, top, true), 3); assert.equal(core.folderCount(s, top), 2);
    assert.deepEqual(core.removeFolder(s, mid), { moved: 1, lifted: 1 });
    assert.equal(s.folders.find(f => f.id === low).parent, top);
    assert.equal(Object.values(s.chats).find(e => e.f === 'm1').in, top);
    assert.deepEqual(core.removeFolder(s, top), { moved: 3, lifted: 1 });
    assert.deepEqual(Object.values(s.chats).map(e => [e.f, e.in ?? null, !!e.pin]), [['t2', null, true]], '고정한 것만 남음');
    assert.equal(s.folders.find(f => f.id === low).parent, '');
});
await test('찾기: 낱말마다 이름 · 파일 · 마지막 말 어디든 · 대소문자 · 전각 무시', () => {
    const r = { f: 'Beach Trip', mes: '파도가 높아요' };
    const nameOf = () => '앤';
    assert.ok(core.matches(r, 'beach 앤', nameOf));
    assert.ok(core.matches(r, 'ＢＥＡＣＨ 파도', nameOf));
    assert.ok(!core.matches(r, 'beach 산', nameOf));
    assert.ok(core.matches(r, '   ', nameOf));
});
await test('날짜: 오늘 · 어제 · 이번 해 · 다른 해 이름표와 줄 끝 시각 · 날짜 묶음', () => {
    const now = new Date(2026, 10, 5, 12, 0).getTime();
    const at = (y, m, d, h = 9, mi = 5) => new Date(y, m, d, h, mi).getTime();
    assert.equal(core.dayLabel(at(2026, 10, 5), now), '오늘');
    assert.equal(core.dayLabel(at(2026, 10, 4), now), '어제');
    assert.equal(core.dayLabel(at(2026, 10, 3), now), '11월 3일 (화)');
    assert.equal(core.dayLabel(at(2025, 10, 3), now), '2025년 11월 3일 (월)');
    assert.equal(core.shortTime(at(2026, 10, 5, 15, 5), now), '오후 3:05');
    assert.equal(core.shortTime(at(2026, 10, 5, 0, 7), now), '오전 12:07');
    assert.equal(core.shortTime(at(2026, 10, 4), now), '어제');
    assert.equal(core.shortTime(at(2026, 10, 1), now), '11/1');
    assert.equal(core.shortTime(at(2025, 0, 2), now), '2025/1/2');
    assert.equal(core.dayLabel(0, now), '날짜 모름');
    const groups = core.groupByDay([{ last: at(2026, 10, 4) }, { last: at(2026, 10, 5, 8) }, { last: at(2026, 10, 5, 10) }], now);
    assert.deepEqual(groups.map(g => [g.label, g.rows.length]), [['오늘', 2], ['어제', 1]]);
    assert.ok(groups[0].rows[0].last > groups[0].rows[1].last, '새것 먼저');
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, chatOrganizer: { on: true, folders: [], chats: {} } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;

// 실리태번 캐릭터 관리 서랍 뼈대
const panel = document.getElementById('right-nav-panel');
panel.innerHTML = '<div id="right-nav-panelheader"></div><div id="CharListButtonAndHotSwaps"><div id="rm_button_characters"></div></div><div id="rm_PinAndTabs"></div><div class="scrollableInner"><div id="rm_characters_block"></div></div>';
const stList = panel.querySelector('.scrollableInner');
const before = [...panel.children];
ctx.characters = [{ name: '앤', avatar: 'ann.png' }, { name: '밥', avatar: 'bob.png' }];
ctx.groups = [{ id: 'g1', name: '모임', chats: ['g chat'] }];
ctx.characterId = 0; ctx.groupId = null;
let current = 'Ann now';
ctx.getCurrentChatId = () => current;
const now = Date.now();
let serverRows = [
    { file_name: 'Ann now.jsonl', avatar: 'ann.png', chat_items: 3, mes: '지금 이야기', last_mes: now - 1000, chat_metadata: { integrity: 'i-now' } },
    { file_name: 'Ann beach.jsonl', avatar: 'ann.png', chat_items: 9, mes: '바닷가에서', last_mes: now - 60_000, chat_metadata: { integrity: 'i-beach' } },
    { file_name: 'Bob shop.jsonl', avatar: 'bob.png', chat_items: 2, mes: '가게', last_mes: now - 86_400_000 * 3, chat_metadata: { integrity: 'i-shop' } },
    { file_name: 'g chat.jsonl', group: 'g1', chat_items: 5, mes: '모두 모여', last_mes: now - 5000 },
    { file_name: 'Ghost.jsonl', avatar: 'gone.png', chat_items: 1, mes: '', last_mes: now - 9000 },
];
const calls = { recent: [], list: 0 };
const files = { 'ann.png': () => serverRows.filter(r => r.avatar === 'ann.png'), 'bob.png': () => serverRows.filter(r => r.avatar === 'bob.png') };
globalThis.fetch = async (input, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : {};
    if (input === '/api/chats/recent') {
        calls.recent.push(body);
        const lim = Number.isFinite(body.max) ? body.max : Infinity;
        return { ok: true, json: async () => serverRows.slice(0, lim + (body.pinned?.length || 0)) };
    }
    if (input === '/api/characters/chats') { calls.list++; return { ok: true, json: async () => (files[body.avatar_url]?.() || []).map(r => ({ file_name: r.file_name, file_id: r.file_name.replace('.jsonl', '') })) }; }
    return { ok: false, json: async () => ({}) };
};
const opened = [];
ctx.selectCharacterById = async (at, opts) => { opened.push(['select', at, opts?.switchMenu]); ctx.characterId = at; ctx.groupId = null; };
ctx.openCharacterChat = async f => { opened.push(['open', f]); current = f; };
ctx.openGroupChat = async (g, f) => { opened.push(['group', g, f]); current = f; };
let inputAnswer = null;
ctx.callGenericPopup = async (text, type, value) => { assert.equal(type, ctx.POPUP_TYPE.INPUT); return inputAnswer; };
let confirms = [];
globalThis.confirm = msg => { confirms.push(msg); return true; };

const org = await import(url('src/chat-organizer.js'));
const deleted = [];
org._forTest.st.script = async () => ({
    deleteCharacterChatByName: async (at, f) => { deleted.push([ctx.characters[at].avatar, f]); serverRows = serverRows.filter(r => !(r.avatar === ctx.characters[at].avatar && r.file_name === `${f}.jsonl`)); },
    renameGroupOrCharacterChat: async () => {},
});
org._forTest.st.groups = async () => ({ openGroupById: async g => { opened.push(['openGroup', g]); ctx.groupId = g; }, deleteGroupChatByName: async (g, f) => { const gr = ctx.groups.find(x => x.id === g); gr.chats.splice(gr.chats.indexOf(f), 1); deleted.push([g, f]); } });
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
const pane = () => panel.querySelector('.bl-co-pane');
const tabsEl = () => panel.querySelector('.bl-co-tabs');
const click = el => el.dispatchEvent(new Event('click', { bubbles: true }));
const tabBtn = id => tabsEl().querySelector(`[data-co-tab="${id}"]`);
const rowEl = f => [...pane().querySelectorAll('.bl-co-row')].find(r => decodeURIComponent(r.dataset.key).endsWith('\u0001' + f));
const menuItems = () => [...document.querySelectorAll('.bl-co-menu button')];
const pickMenu = label => { const b = menuItems().find(x => x.textContent === label); assert.ok(b, `메뉴 「${label}」 없음: ${menuItems().map(x => x.textContent).join(', ')}`); click(b); };

await org.syncChatOrganizer(true);
await settle();
await test('켜기: 탭 줄은 실리태번 목록 앞 · 우리 칸은 뒤 · 실리태번 칸은 그대로(옮기지 · 복제하지 않음) · CSS 는 켤 때만 · 서버 요청 0', () => {
    assert.ok(tabsEl() && pane());
    assert.equal(tabsEl().nextElementSibling, stList); assert.equal(stList.nextElementSibling, pane());
    assert.deepEqual([...panel.children].filter(el => !el.classList.contains('bl-co-tabs') && !el.classList.contains('bl-co-pane')), before);
    assert.equal(stList.querySelector('#rm_characters_block')?.parentNode, stList);
    assert.ok(pane().classList.contains('scrollableInner'), '우리 칸도 서랍 목록과 같은 여백 규칙을 받게');
    assert.ok(pane().hidden); assert.equal(panel.dataset.blCoTab, undefined);
    assert.ok(document.getElementById('bl-chat-organizer-style'));
    assert.equal(calls.recent.length, 0, '켜기만으로는 요청 없음');
    assert.equal(tabBtn('chars').getAttribute('aria-selected'), 'true');
});
await test('최근 탭: 요청 한 번(처음 50개 · integrity 를 받으려고 metadata) · 날짜 묶음 · 없는 캐릭터 줄은 빼고 · 지금 채팅 표시', async () => {
    click(tabBtn('recent')); await settle();
    assert.equal(panel.dataset.blCoTab, 'recent'); assert.equal(pane().hidden, false);
    assert.equal(calls.recent.length, 1);
    assert.deepEqual({ max: calls.recent[0].max, metadata: calls.recent[0].metadata, pinned: calls.recent[0].pinned }, { max: 50, metadata: true, pinned: [] });
    const keys = [...pane().querySelectorAll('.bl-co-row')].map(r => decodeURIComponent(r.dataset.key).split('\u0001')[2]);
    assert.deepEqual(keys, ['Ann now', 'g chat', 'Ann beach', 'Bob shop']);
    assert.deepEqual([...pane().querySelectorAll('.bl-co-day')].map(h => h.textContent).slice(0, 1), ['오늘']);
    assert.ok(rowEl('Ann now').classList.contains('bl-co-current'));
    assert.ok(!pane().querySelector('.bl-co-moreload'), '다 받았으면 더 불러오기 없음');
    click(tabBtn('recent')); await settle();
    assert.equal(calls.recent.length, 1, '1분 안에 다시 눌러도 다시 받지 않음');
});
await test('찾기: 0.2초 모아서 · 이름 · 마지막 말로 거름', async () => {
    const input = pane().querySelector('.bl-co-search');
    input.value = '바닷가'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(100); assert.equal(pane().querySelectorAll('.bl-co-row').length, 4, '아직 안 거름');
    await settle(200); assert.deepEqual([...pane().querySelectorAll('.bl-co-row')].map(r => decodeURIComponent(r.dataset.key).split('\u0001')[2]), ['Ann beach']);
    input.value = '밥'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle(300);
    assert.deepEqual([...pane().querySelectorAll('.bl-co-row')].map(r => decodeURIComponent(r.dataset.key).split('\u0001')[2]), ['Bob shop']);
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); await settle(300);
});
await test('고정: ⋮ 메뉴 → 설정에 저장(integrity 와 함께) · 고정 칸이 맨 위 · 다음 요청에 pinned 로', async () => {
    click(rowEl('Bob shop').querySelector('[data-co-act="row-menu"]')); await settle();
    pickMenu('고정'); await settle();
    const e = Object.values(settings.chatOrganizer.chats)[0];
    assert.deepEqual(e, { k: 'c', o: 'bob.png', f: 'Bob shop', i: 'i-shop', pin: true });
    assert.equal(pane().querySelector('.bl-co-day').textContent, '고정');
    assert.equal(decodeURIComponent(pane().querySelector('.bl-co-row').dataset.key).split('\u0001')[2], 'Bob shop');
    click(pane().querySelector('[data-co-act="refresh"]')); await settle();
    assert.deepEqual(calls.recent.at(-1).pinned, [{ avatar: 'bob.png', file_name: 'Bob shop.jsonl' }]);
});
await test('폴더 탭: 서버 요청 없이 그림 · 새 폴더(이름 입력) · 채팅을 폴더에 넣기 · 접기', async () => {
    const n = calls.recent.length;
    click(tabBtn('folders')); await settle();
    assert.equal(calls.recent.length, n, '폴더 탭은 요청 없음');
    assert.match(pane().querySelector('.bl-co-empty').textContent, /폴더가 없어요/);
    inputAnswer = '바다 이야기';
    click(pane().querySelector('[data-co-act="new-folder"]')); await settle();
    assert.equal(settings.chatOrganizer.folders[0].name, '바다 이야기');
    click(tabBtn('recent')); await settle();
    click(rowEl('Ann beach').querySelector('[data-co-act="row-menu"]')); await settle();
    pickMenu('폴더에 넣기'); await settle();
    pickMenu('바다 이야기'); await settle();
    const fid = settings.chatOrganizer.folders[0].id;
    assert.equal(Object.values(settings.chatOrganizer.chats).find(e => e.f === 'Ann beach').in, fid);
    click(tabBtn('folders')); await settle();
    assert.equal(pane().querySelector('.bl-co-fold small').textContent, '1');
    assert.ok(rowEl('Ann beach'), '폴더 안 줄');
    assert.match(rowEl('Ann beach').querySelector('.bl-co-mes').textContent, /바닷가/, '받아 둔 마지막 말을 덧붙임');
    click(pane().querySelector('[data-co-act="fold"]')); await settle();
    assert.equal(settings.chatOrganizer.folders[0].open, false); assert.equal(rowEl('Ann beach'), undefined);
    click(pane().querySelector('[data-co-act="fold"]')); await settle();
});
await test('이름 바뀜: 실리태번 CHAT_RENAMED 를 따라 폴더 · 고정 항목 이름을 고침', async () => {
    await eventSource.emit(ctx.event_types.CHAT_RENAMED, { avatarId: 'ann.png', groupId: undefined, oldFileName: 'Ann beach.jsonl', newFileName: 'Ann sea.jsonl' });
    await settle();
    assert.equal(Object.values(settings.chatOrganizer.chats).find(e => e.i === 'i-beach').f, 'Ann sea');
    assert.ok(rowEl('Ann sea'));
});
await test('밖에서 이름이 바뀜(알림 없음): 다음 요청에서 integrity 로 찾아 고쳐 적음', async () => {
    serverRows = serverRows.map(r => (r.file_name === 'Ann beach.jsonl' ? { ...r, file_name: 'Ann ocean.jsonl' } : r));
    click(tabBtn('recent')); click(pane().querySelector('[data-co-act="refresh"]')); await settle();
    assert.equal(Object.values(settings.chatOrganizer.chats).find(e => e.i === 'i-beach').f, 'Ann ocean');
});
await test('열기: 캐릭터를 고르고(서랍 화면은 그대로) 그 채팅을 열어요 · 그룹 채팅 · 지금 채팅은 아무것도 안 함', async () => {
    click(rowEl('Bob shop').querySelector('[data-co-act="open"]')); await settle();
    assert.deepEqual(opened.slice(-2), [['select', 1, false], ['open', 'Bob shop']]);
    const n = opened.length;
    click(rowEl('Bob shop').querySelector('[data-co-act="open"]')); await settle();
    assert.equal(opened.length, n, '이미 열린 채팅');
    click(rowEl('g chat').querySelector('[data-co-act="open"]')); await settle();
    assert.deepEqual(opened.slice(-2), [['openGroup', 'g1'], ['group', 'g1', 'g chat']]);
    current = 'Ann now'; ctx.groupId = null; ctx.characterId = 0;
});
await test('여러 개 지우기: 지금 채팅은 못 고름 · 확인 두 번 · 실리태번 삭제 함수로 하나씩 · 고정 · 폴더에서도 빠짐', async () => {
    click(tabBtn('recent')); await settle();
    click(pane().querySelector('[data-co-act="pick"]')); await settle();
    assert.equal(pane().querySelector('.bl-co-pickbar').hidden, false);
    click(rowEl('Ann now').querySelector('[data-co-act="open"]'));
    click(rowEl('Bob shop').querySelector('[data-co-act="open"]'));
    click(rowEl('Ann ocean').querySelector('[data-co-act="open"]'));
    await settle();
    assert.equal(pane().querySelector('.bl-co-pickbar [role="status"]').textContent, '2개 골랐어요', '지금 채팅은 안 골라짐');
    assert.ok(rowEl('Ann now').querySelector('.bl-co-check').disabled);
    confirms = [];
    click(pane().querySelector('[data-co-act="pick-delete"]')); await settle();
    assert.equal(confirms.length, 2, '확인 두 번');
    assert.match(confirms[0], /Bob shop/); assert.match(confirms[1], /되돌릴 수 없어요/);
    assert.deepEqual(deleted, [['bob.png', 'Bob shop'], ['ann.png', 'Ann ocean']]);
    assert.deepEqual(settings.chatOrganizer.chats, {}, '고정 · 폴더 항목이 빠짐');
    assert.ok(!rowEl('Bob shop') && !rowEl('Ann ocean'));
    assert.equal(pane().querySelector('.bl-co-pickbar').hidden, true, '고르기 끝');
});
await test('확인에서 취소하면 아무것도 안 지움', async () => {
    globalThis.confirm = msg => { confirms.push(msg); return confirms.length < 2; };
    confirms = []; deleted.length = 0;
    await org._forTest.deleteFlow([{ k: 'g', o: 'g1', f: 'g chat' }]);
    assert.equal(confirms.length, 2); assert.equal(deleted.length, 0);
    assert.ok(ctx.groups[0].chats.includes('g chat'));
});
await test('폴더 지우기는 되돌리기 알림과 함께 · 채팅 파일은 안 건드림', async () => {
    const s = settings.chatOrganizer;
    const fid = s.folders[0].id;
    s.chats.k1 = { k: 'g', o: 'g1', f: 'g chat', in: fid }; org._forTest.render();
    click(tabBtn('folders')); await settle();
    click(pane().querySelector('[data-co-act="folder-menu"]')); await settle();
    deleted.length = 0;
    pickMenu('폴더 지우기'); await settle();
    assert.equal(settings.chatOrganizer.folders.length, 0); assert.deepEqual(settings.chatOrganizer.chats, {});
    assert.equal(deleted.length, 0);
});
await test('폴더에 든 채팅 파일이 밖에서 이름이 바뀌어 있으면: 열기 전에 있는지 보고 · integrity 로 전체에서 찾아 고친 뒤 열어요(없는 이름으로 열어 빈 채팅을 만들지 않음)', async () => {
    const s = settings.chatOrganizer;
    s.folders.push({ id: 'fx', name: '보관', parent: '', open: true });
    s.chats.k9 = { k: 'c', o: 'ann.png', f: 'Ann old', i: 'i-now', in: 'fx' };
    org._forTest.render();
    click(tabBtn('folders')); await settle();
    await dom.clock.advance(70_000);   // 받아 둔 목록이 오래됨 → 열기 전에 파일을 확인
    const list0 = calls.list, recent0 = calls.recent.length;
    current = 'Bob shop';
    click(rowEl('Ann old').querySelector('[data-co-act="open"]')); await settle();
    assert.equal(calls.list, list0 + 1, '주인 목록 한 번(파일 읽기 없음)');
    assert.equal(calls.recent.at(-1).max, undefined, '없으면 한도 없이 전체에서 integrity 로 찾음');
    assert.ok(calls.recent.length > recent0);
    assert.equal(s.chats.k9.f, 'Ann now', '이름을 고쳐 적음');
    assert.deepEqual(opened.slice(-2), [['select', 0, false], ['open', 'Ann now']]);
    current = 'Ann now'; ctx.characterId = 0;
    delete s.chats.k9; s.folders = s.folders.filter(f => f.id !== 'fx'); org._forTest.render();
});
await test('1.0.9 열기 전 확인에서 서버가 답하지 못하면: 「파일 없음 · 목록에서 빼기」 안내 대신 연결 안내 · 열지 않음 · 이름 그대로', async () => {
    const s = settings.chatOrganizer;
    s.folders.push({ id: 'fy', name: '보관2', parent: '', open: true });
    s.chats.k8 = { k: 'c', o: 'ann.png', f: 'Ann beach', i: 'i-beach', in: 'fy' };
    org._forTest.render();
    click(tabBtn('folders')); await settle();
    await dom.clock.advance(70_000);
    const real = globalThis.fetch, warned = [], toastr = globalThis.toastr, opened0 = opened.length;
    globalThis.fetch = async (input, init) => input === '/api/characters/chats' ? { ok: false, json: async () => ({}) } : real(input, init);
    globalThis.toastr = { ...(toastr || {}), warning: m => warned.push(m), info: () => ({}) };
    try {
        current = 'Bob shop';
        click(rowEl('Ann beach').querySelector('[data-co-act="open"]')); await settle();
        assert.equal(opened.length, opened0, '열지 않음');
        assert.equal(warned.length, 1); assert.match(warned[0], /서버에서 받지 못했어요/); assert.doesNotMatch(warned[0], /목록에서 빼/);
        assert.equal(s.chats.k8.f, 'Ann beach');
    } finally {
        globalThis.fetch = real; globalThis.toastr = toastr;
        current = 'Ann now'; ctx.characterId = 0;
        delete s.chats.k8; s.folders = s.folders.filter(f => f.id !== 'fy'); org._forTest.render();
    }
});
await test('더 불러오기: 50개를 넘으면 단추 · 누르면 100개로 다시 받음', async () => {
    const extra = Array.from({ length: 60 }, (_, i) => ({ file_name: `More ${i}.jsonl`, avatar: 'bob.png', chat_items: 1, mes: '', last_mes: now - 86_400_000 * 10 - i }));
    serverRows = [...serverRows, ...extra];
    click(tabBtn('recent')); click(pane().querySelector('[data-co-act="refresh"]')); await settle();
    const more = pane().querySelector('[data-co-act="more"]');
    assert.ok(more, '단추'); assert.match(more.textContent, /지금 50개/);
    click(more); await settle();
    assert.equal(calls.recent.at(-1).max, 100);
    assert.ok(!pane().querySelector('[data-co-act="more"]'), '다 받으면 단추 없음');
    serverRows = serverRows.filter(r => !r.file_name.startsWith('More'));
    click(pane().querySelector('[data-co-act="refresh"]')); await settle();
});
await test('서랍 위 캐릭터 목록 단추를 누르면 캐릭터 탭으로', async () => {
    click(tabBtn('recent')); await settle();
    click(panel.querySelector('#rm_button_characters')); await settle();
    assert.equal(panel.dataset.blCoTab, undefined); assert.ok(pane().hidden);
});
await test('끄기: 탭 · 칸 · CSS · 표시 · 리스너 흔적 없음, 실리태번 칸은 처음 그대로', async () => {
    await org.syncChatOrganizer(false); await settle();
    assert.deepEqual([...panel.children], before);
    assert.equal(panel.dataset.blCoTab, undefined);
    assert.equal(document.getElementById('bl-chat-organizer-style'), null);
    const n = calls.recent.length;
    await eventSource.emit(ctx.event_types.CHAT_RENAMED, { avatarId: 'ann.png', oldFileName: 'x.jsonl', newFileName: 'y.jsonl' });
    assert.equal(calls.recent.length, n);
    assert.equal(dom.errors.length, 0, dom.errors.map(String).join('\n'));
});
await test('features.js: 기본 끔 · 켤 때만 받음 · 확장만 모드 · ChatsPlus 가 켜져 있으면 쉼', async () => {
    const fs = await import('node:fs');
    const f = fs.readFileSync(path.join(root, 'src/features.js'), 'utf8');
    assert.match(f, /s\.chatOrganizer\?\.on === true && !restingFor\('chatOrganizer'\)/);
    assert.match(f, /load\('chatorganizer', '\.\/chat-organizer\.js'\)/);
    const st = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
    assert.match(st, /chatOrganizer: \{ on: false, folders: \[\], chats: \{\} \}/);
});

// ───────── 테마 쪽 호환 고침(ChatsPlus Mod 가 알려 준 두 가지) ─────────
{
    const fs = await import('node:fs');
    const { createRequire } = await import('node:module');
    const L = createRequire(import.meta.url)(path.join(root, 'tools/css-lib.cjs'));
    const css = f => fs.readFileSync(path.join(root, 'css', f), 'utf8');
    await test('캐릭터 서랍 목록 여백: 「서랍 바로 아래」(>)가 아니라 「서랍 안 가장 바깥 목록」으로 · 우선순위는 그대로', () => {
        for (const f of fs.readdirSync(path.join(root, 'css'))) assert.doesNotMatch(css(f).replace(/\/\*[\s\S]*?\*\//g, ''), /#right-nav-panel[^{,]*>\s*\.scrollableInner/, f);
        const sel = 'body.salty #right-nav-panel:not(#salty-none) .scrollableInner:where(:not(.scrollableInner .scrollableInner))';
        assert.equal(L.cmpSpec(L.spec(sel), L.spec('body.salty #right-nav-panel:not(#salty-none) > .scrollableInner')), 0);
        for (const f of ['09-st-align-brand-loader-greys.css', '13-characters.css', '27-compact.css']) assert.ok(css(f).includes(sel), f);
    });
    await test('공용 단추 색: 위험 단추 이름(.is-danger · ○○-danger · ○○_danger)은 위험 가족 · 직접 칠한 단추(style 의 color · background)는 덮지 않음 · 우선순위 그대로', () => {
        const c02 = css('02-controls.css'), c17 = css('17-semantic.css'), c93 = css('93-night-surfaces.css');
        const tree = L.parse(c02);
        const painting = L.flatRules(tree).filter(r => r.selector.startsWith('body.salty .menu_button:') && !r.selector.startsWith('body.salty .menu_button:is(.redWarningBG') && r.decls.some(d => d.important && ['color', 'background'].includes(d.lname)));
        assert.ok(painting.length >= 6);
        for (const r of painting) assert.ok(r.selector.includes('[style*="color:"], [style*="background:"]'), r.selector.slice(0, 120));
        assert.equal((c17.match(/body\.salty \.menu_button:is\(\.redWarningBG, \.red_button, \.danger, \.is-danger, \[class\*="-danger"\], \[class\*="_danger"\]\)/g) || []).length, 5);
        assert.equal(L.cmpSpec(L.spec('body.salty .menu_button:is(.redWarningBG, .red_button, .danger)'), L.spec('body.salty .menu_button:is(.redWarningBG, .red_button, .danger, .is-danger, [class*="-danger"], [class*="_danger"])')), 0);
        // 1.0.2 통합: 나이트 면 빼기는 실리태번 .menu_button 에만(:where 라 우선순위 0) — 우리 설정 창 .salty-btn-danger 는 예전처럼 나이트 면(리그 ui-census 384 밤 「변형 1」)
        assert.equal((c93.match(/\.danger,:where\(\.menu_button:is\(\.is-danger,\[class\*="-danger"\],\[class\*="_danger"\],\[style\*="color:"\],\[style\*="background:"\]\)\)/g) || []).length, 3);
        assert.equal(L.cmpSpec(L.spec('.a:not(.danger,.redWarningBG)'), L.spec('.a:not(.danger,:where(.menu_button:is(.is-danger,[class*="-danger"],[class*="_danger"],[style*="color:"],[style*="background:"])),.redWarningBG)')), 0);
        const night = L.flatRules(L.parse(c93)).filter(r => r.selector.includes(':where(.menu_button:is(.is-danger'));
        assert.equal(night.length, 3);
        assert.ok(!c93.includes('.danger,.is-danger,'), '빼기 목록에 맨 위험 이름이 남으면 .salty-btn-danger 도 나이트 면에서 빠져요');
    });
}
console.log(`PASS chat-organizer: ${passed} checks`);
