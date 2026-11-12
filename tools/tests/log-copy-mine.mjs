// 1.2.0 받은 글꾸 관리(점검 1112 「테마 마」) — DOM 없는 부분: src/log-copy-mine.js · mart-import.js 의 다시 받기 · settings.js 의 표 정리 · mart-retake.js 의 줄 글.
//   ① 받을 때 표(받은 날 · 틀 지문 · 판) ② 다시 받기 견주기 · 「조절 값 지키고 틀만 새로」 ③ 내 글꾸 차례(즐겨찾기 → 최근 → 받은 차례) ④ 지우기 · 되돌리기 ⑤ n/20
//   node tools/tests/log-copy-mine.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack || error}`); } };

const M = await import(url('src/log-copy-mine.js'));
const { readMart, addMartItems, findDupes, summary, CUSTOM_MAX } = await import(url('src/mart-import.js'));
const fixture = JSON.parse(read('tools/tests/fixtures/geulkku-set-mart.json'));
const packOf = id => structuredClone(fixture.packs[id]);
const ID = Object.keys(fixture.packs)[0];
const NOW = new Date(2026, 10, 12, 9, 0).getTime();

await test('① 표: 틀 지문은 같은 글이면 같고 한 글자만 달라도 달라요 · 받은 날 · 마트가 실어 보낸 판 · 고친 날만 읽어요', () => {
    assert.match(M.fingerprint('<div>가</div>'), /^[0-9a-f]{8}$/);
    assert.equal(M.fingerprint('<div>가</div>'), M.fingerprint('<div>가</div>'));
    assert.notEqual(M.fingerprint('<div>가</div>'), M.fingerprint('<div>나</div>'));
    assert.deepEqual(M.metaOf({}), {});
    assert.deepEqual(M.metaOf({ rev: 3, updated: '2026-11-12T03:00:00Z' }), { rev: '3', updated: '2026-11-12' });
    assert.deepEqual(M.metaOf({ rev: '<b>', updated: '어제' }), {}, '틀린 꼴은 버려요');
    const info = M.stampInfo({ frame: { html: '<div>틀</div>' }, rev: '2', updated: '2026-11-10' }, NOW);
    assert.deepEqual(info, { got: '2026-11-12', hash: M.fingerprint('<div>틀</div>'), rev: '2', updated: '2026-11-10' });
    assert.deepEqual(Object.keys(M.stampInfo({ template: '<div></div>' }, NOW)), ['got', 'hash'], '판을 안 실은 지금 마트 꾸러미');
    assert.equal(M.infoLabel({ info }), '11월 12일 받음 · 판 2 · 11월 10일 고침');
    assert.equal(M.infoLabel({ info: { got: '2026-11-12', hash: 'abcdef01' } }), '11월 12일 받음');
    assert.equal(M.infoLabel({}), '', '표가 없는 옛 글꾸');
    assert.deepEqual(M.tidyInfo({ got: '2026-11-12', hash: 'abcdef01', rev: '<x>', etc: 1 }), { got: '2026-11-12', hash: 'abcdef01' });
    assert.equal(M.tidyInfo({ got: 'x' }), null);
});

await test('① 받으면 내 글꾸에 표가 붙고 설정 정리(settings.js)를 지나도 남아요 · 모르는 칸 · 틀린 값은 버려요', async () => {
    const s = { logCopy: { custom: [] } };
    const items = readMart(JSON.stringify(packOf(ID))).items;
    assert.equal(items.length, 1);
    addMartItems(s, items);
    const mine = s.logCopy.custom[0];
    assert.match(mine.info.got, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(mine.info.hash, M.fingerprint(mine.frame.html));
    const src = read('src/settings.js');
    assert.match(src, /isObj\(c\.info\)[^\n]*\(got\|hash\|rev\|updated\)[^\n]*typeof x === 'string'/, 'tidyLogCopy 가 표를 남겨요(글자 값만)');
    // 마트가 판을 실어 보내면(마트-③) 그대로
    const pack = packOf(ID); pack.items[0].rev = 4; pack.items[0].updated = '2026-11-11';
    const s2 = { logCopy: { custom: [] } };
    addMartItems(s2, readMart(JSON.stringify(pack)).items);
    assert.equal(s2.logCopy.custom[0].info.rev, '4'); assert.equal(s2.logCopy.custom[0].info.updated, '2026-11-11');
});

await test('② 다시 받기 견주기: 틀이 같은가 · 테마에서 바꾼 조절 값이 사라지나 · 「틀만 새로」가 되나', () => {
    const item = readMart(JSON.stringify(packOf(ID))).items[0];
    const fresh = { id: item.id, frame: item.frame, set: structuredClone(item.set) };
    assert.deepEqual(M.retakeOf(fresh, item), { frame: 'same', tuned: false, keepable: true }, '받은 그대로면 물을 것 없음');
    const tuned = { ...fresh, set: { ...fresh.set, easy: { style: 'soft' } } };
    assert.deepEqual(M.retakeOf(tuned, item), { frame: 'same', tuned: true, keepable: true });
    const older = { ...tuned, frame: { ...item.frame, html: item.frame.html.replace('<div', '<div data-old') } };
    assert.equal(M.retakeOf(older, item).frame, 'new', '틀 글이 다르면 마트 판이 바뀐 것');
    assert.deepEqual(M.retakeOf({ id: 'x', template: '<div></div>' }, { kind: 'geulkku', template: '<div></div>' }), { frame: 'same', tuned: false, keepable: true }, '옛 틈 템플릿 글꾸는 색이 같으면 사라질 것이 없어요');
    assert.deepEqual(M.retakeOf({ id: 'x', html: '<div></div>' }, { kind: 'geulkku', template: '<div></div>' }), { frame: 'same', tuned: false, keepable: false }, '직접 붙인 HTML 글꾸는 지킬 조절 값이 없어요');
    assert.equal(M.retakeOf({ ...fresh, set: { blGeulkku: 2 } }, item).tuned, false, '조절 값이 기본이면 사라질 것이 없어요');
});

await test('② 넣기: keep 에 든 id 는 새 틀 + 옛 조절 값 · replace 만이면 마트 값으로 · 요약에 「조절 값 지킨 것」', () => {
    const pack = packOf(ID);
    const item = readMart(JSON.stringify(pack)).items[0];
    const mySet = { ...structuredClone(item.set), easy: { style: 'soft' } };
    const oldFrame = { ...item.frame, html: item.frame.html.replace('<div', '<div data-old') };
    const make = () => ({ logCopy: { custom: [{ id: item.id, name: '옛 이름', html: '', emoji: '💬', frame: structuredClone(oldFrame), set: structuredClone(mySet), slot: null }] } });
    // 그만두기(= 예전 건너뛰기)
    let s = make();
    assert.deepEqual(findDupes(s, [item]).map(x => x.id), [item.id]);
    let r = addMartItems(s, [item]);
    assert.deepEqual(r.geulkku, []); assert.match(r.skipped[0].reason, /이미 있어서/);
    assert.deepEqual(s.logCopy.custom[0].set, mySet); assert.equal(s.logCopy.custom[0].frame.html, oldFrame.html);
    // 덮어쓰기
    s = make();
    r = addMartItems(s, [item], { replace: new Set([item.id]) });
    assert.deepEqual(s.logCopy.custom[0].set, item.set, '마트에서 담은 값으로');
    assert.equal(s.logCopy.custom[0].frame.html, item.frame.html);
    assert.deepEqual(r.kept, []);
    assert.match(summary(r).head, /\(덮어쓴 것 1개\)$/);
    // 조절 값 지키고 틀만 새로
    s = make();
    r = addMartItems(s, [item], { replace: new Set([item.id]), keep: new Set([item.id]) });
    assert.deepEqual(s.logCopy.custom[0].set, mySet, '테마에서 바꾼 조절 값 그대로');
    assert.notEqual(s.logCopy.custom[0].set, mySet, '같은 객체를 나눠 쓰지 않아요');
    assert.equal(s.logCopy.custom[0].frame.html, item.frame.html, '틀은 새것');
    assert.equal(s.logCopy.custom[0].name, item.name);
    assert.equal(s.logCopy.custom[0].info.hash, M.fingerprint(item.frame.html));
    assert.deepEqual(r.kept, [item.name]); assert.deepEqual(r.replaced, [item.name]);
    assert.match(summary(r).head, /\(덮어쓴 것 1개 · 조절 값 지킨 것 1개\)$/);
    // keep 만 있고 replace 가 없으면 건너뛰어요(덮어쓰기가 먼저)
    s = make();
    r = addMartItems(s, [item], { keep: new Set([item.id]) });
    assert.deepEqual(r.geulkku, []);
});

await test('② 다시 받기 창의 줄 글(mart-retake.js): 틀이 같은지 · 조절 값이 있는지를 사람 말로', async () => {
    const src = read('src/mart-retake.js');
    assert.match(src, /data-retake="keep">조절 값 지키고 틀만 새로</);
    assert.match(src, /data-retake="replace">덮어쓰기</);
    assert.ok(src.includes(`data-retake="cancel">\${more ? '이미 있는 것은 그대로' : '그만두기'}<`), '새것이 같이 든 꾸러미면 단추 글을 실제 동작대로(검토 9)');
    assert.match(src, /let answer = 'cancel';/, 'Esc · 바깥 닫기 = 그만두기');
    assert.match(read('src/mart-import-ui.js'), /const \{ replace, keep \} = await askRetake\(getSettings\(\), dupes, items\.length > dupes\.length\);[\s\S]*?addMartItems\(settings, items, \{ replace, keep, taken,/);
    assert.ok(!/import \{ ask \} from '\.\/ask\.js'/.test(read('src/mart-import-ui.js')), '옛 「덮어쓸까요?」 둘 갈래는 mart-retake.js 로 옮겼어요');
});

await test('③ 내 글꾸 차례: 즐겨찾기 → 최근 → 받은 차례(원래 배열은 그대로)', () => {
    const custom = ['a', 'b', 'c', 'd'].map(id => ({ id }));
    assert.deepEqual(M.mineOrder(custom).map(c => c.id), ['a', 'b', 'c', 'd']);
    assert.deepEqual(M.mineOrder(custom, ['c'], ['d', 'kkangtong', 'c']).map(c => c.id), ['c', 'd', 'a', 'b']);
    assert.deepEqual(M.mineOrder(custom, ['d', 'b'], ['a']).map(c => c.id), ['b', 'd', 'a', 'c'], '즐겨찾기끼리는 받은 차례');
    assert.deepEqual(custom.map(c => c.id), ['a', 'b', 'c', 'd']);
});

await test('④ 지우기는 즐겨찾기 · 최근에서도 빼고, 되돌리면 제자리로 · 그새 꽉 찼거나 같은 id 를 다시 받았으면 되돌리지 않아요', () => {
    const s = { custom: ['a', 'b', 'c'].map(id => ({ id, name: id })), fav: ['kkangtong', 'b'], recent: ['b', 'card'] };
    assert.equal(M.removeMine(s, 'zz'), null);
    const undo = M.removeMine(s, 'b');
    assert.deepEqual(s.custom.map(c => c.id), ['a', 'c']); assert.deepEqual(s.fav, ['kkangtong']); assert.deepEqual(s.recent, ['card']);
    assert.equal(M.restoreMine(s, undo), true);
    assert.deepEqual(s.custom.map(c => c.id), ['a', 'b', 'c']); assert.deepEqual(s.fav, ['kkangtong', 'b']); assert.deepEqual(s.recent, ['b', 'card']);
    assert.equal(M.restoreMine(s, undo), false, '이미 있어요');
    const undo2 = M.removeMine(s, 'a');
    s.custom = Array.from({ length: M.MINE_MAX }, (_, i) => ({ id: `n${i}` }));
    assert.equal(M.restoreMine(s, undo2), false, '꽉 찼어요');
    assert.equal(s.custom.length, M.MINE_MAX);
});

await test('② 고침(검토 1): 「블루레몬 추천」 판에서 바꾼 조절 값(logCopy.pickSet[id])도 다시 받기에 걸려요 · 「지키기」면 그 값을 새 글꾸 set 으로', () => {
    const item = readMart(JSON.stringify(packOf(ID))).items[0];
    const mine = { ...structuredClone(item.set), easy: { style: 'soft' } };
    const make = (set = mine) => ({ logCopy: { custom: [], pickSet: { [item.id]: structuredClone(set) } } });
    let s = make();
    assert.deepEqual(findDupes(s, [item]).map(x => x.id), [item.id], '추천 판에서 바꾼 조절 값이 있으면 물어요');
    assert.deepEqual(findDupes(make({ blGeulkku: 2 }), [item]), [], '안 바꾼 판은 그냥 받아요');
    assert.deepEqual(findDupes(make(item.set), [item]), [], '마트 값과 같으면 사라질 것이 없어요');
    assert.deepEqual(findDupes({ logCopy: { custom: [] } }, [item]), []);
    assert.deepEqual(M.retakeOf(M.oldOf(s.logCopy, item), item), { frame: 'same', tuned: true, keepable: true });
    assert.match(read('src/mart-retake.js'), /const old = isGeulkku\(item\) \? oldOf\(settings\?\.logCopy, item\) : null;/, '다시 받기 창도 같은 옛것을 봐요');
    let r = addMartItems(s, [item]);
    assert.deepEqual(r.geulkku, [], '건너뛰면 추천 판 그대로'); assert.equal(s.logCopy.custom.length, 0);
    r = addMartItems(s, [item], { replace: new Set([item.id]), keep: new Set([item.id]) });
    assert.deepEqual(s.logCopy.custom[0].set, mine, '추천 판에서 바꾼 값 그대로');
    assert.notEqual(s.logCopy.custom[0].set, s.logCopy.pickSet[item.id], '같은 객체를 나눠 쓰지 않아요');
    assert.deepEqual(r.kept, [item.name]);
    assert.match(summary(r).head, /조절 값 지킨 것 1개/);
    s = make();
    addMartItems(s, [item], { replace: new Set([item.id]) });
    assert.deepEqual(s.logCopy.custom[0].set, item.set, '덮어쓰기는 마트 값');
});

await test('② 고침(검토 2 · 6): 옛 틈 템플릿 글꾸는 저장한 색이 조절 값 · 「지키기」는 색을 옮기고, 안 고친 글꾸는 마트 값을 그대로 받아요', () => {
    const T = '<div>{{head}}{{body}}{{info}}{{tail}}</div>';
    const old = { id: 't1', name: '옛', html: '', template: T, colors: { a: '#111111', b: '#333333' } };
    const item = { kind: 'geulkku', id: 't1', name: '새', template: T, colors: { a: '#222222', b: '#333333' }, messages: 'box', tail: '', emoji: '' };
    assert.deepEqual(M.retakeOf(old, item), { frame: 'same', tuned: true, keepable: true });
    assert.equal(M.retakeOf({ ...old, colors: { a: '#222222', b: '#333333' } }, item).tuned, false, '색이 같으면 물을 것 없음');
    assert.equal(M.retakeOf({ ...old, colors: { a: '#222222', b: '#333333'.toUpperCase() } }, item).tuned, false, '대소문자만 다른 색');
    assert.deepEqual(M.keepTuning({ id: 't1', template: T, colors: item.colors }, old).colors, old.colors);
    const s = { logCopy: { custom: [structuredClone(old)] } };
    const r = addMartItems(s, [item], { replace: new Set(['t1']), keep: new Set(['t1']) });
    assert.deepEqual(s.logCopy.custom[0].colors, old.colors, '저장한 색 그대로');
    assert.equal(s.logCopy.custom[0].name, '새');
    assert.deepEqual(r.kept, ['새']);
    // 6: 한 꾸러미에 고친 것 · 안 고친 것 — 「지키기」는 고친 줄만
    const simple = readMart(JSON.stringify(packOf(ID))).items[0];
    const both = { custom: [structuredClone(old), { id: simple.id, frame: simple.frame, set: { blGeulkku: 2 } }] };
    assert.deepEqual([item, simple].map(x => M.retakeOf(M.oldOf(both, x), x).tuned), [true, false]);
    assert.match(read('src/mart-retake.js'), /keep: new Set\(rows\.filter\(r => r\.tuned\)/, '안 고친 글꾸의 마트 조절 값은 버리지 않아요');
});

await test('② 고침(검토 5): 「지키기」로 받은 글꾸에는 「틀만 받았어요」 줄을 붙이지 않아요', () => {
    const item = { ...readMart(JSON.stringify(packOf(ID))).items[0], warn: '틀만 받았어요' };
    const s = { logCopy: { custom: [{ id: item.id, frame: item.frame, set: { blGeulkku: 2, easy: { style: 'soft' } } }] } };
    const r = addMartItems(s, [item], { replace: new Set([item.id]), keep: new Set([item.id]) });
    assert.deepEqual(r.kept, [item.name]); assert.deepEqual(r.warned, []);
    const s2 = { logCopy: { custom: [] } };
    assert.equal(addMartItems(s2, [item]).warned.length, 1, '새로 받을 때는 그대로 알려요');
});

await test('④ 고침(검토 7): 둘을 지우고 지운 차례대로 되돌려도 받은 차례 그대로', () => {
    for (const gone of [['a', 'b'], ['b', 'a'], ['b', 'c'], ['d', 'a'], ['c', 'd']]) for (const order of [[0, 1], [1, 0]]) {
        const s = { custom: ['a', 'b', 'c', 'd'].map(id => ({ id })), fav: [], recent: [] };
        const undo = gone.map(id => M.removeMine(s, id));
        for (const i of order) assert.equal(M.restoreMine(s, undo[i]), true);
        assert.deepEqual(s.custom.map(c => c.id), ['a', 'b', 'c', 'd'], `지운 차례 ${gone} · 되돌린 차례 ${order}`);
    }
    // 지운 뒤 새로 받은 것은 끝에 그대로 · 되돌린 것은 제자리
    const n = { custom: ['a', 'b', 'c'].map(id => ({ id })), fav: [], recent: [] };
    const ub = M.removeMine(n, 'b'); n.custom = [...n.custom, { id: 'z' }];
    const ua = M.removeMine(n, 'a');
    M.restoreMine(n, ub); M.restoreMine(n, ua);
    assert.deepEqual(n.custom.map(c => c.id), ['a', 'b', 'c', 'z']);
    const s = { custom: ['a', 'b', 'c'].map(id => ({ id })), fav: [], recent: [] };
    const u = M.removeMine(s, 'c');
    M.restoreMine(s, u);
    assert.deepEqual(s.custom.map(c => c.id), ['a', 'b', 'c'], '끝의 것은 끝으로');
});

await test('⑤ 「내 글꾸 n/20」 — 꽉 차면 할 일까지 · 상한은 받기 쪽과 같은 값', () => {
    assert.equal(M.MINE_MAX, CUSTOM_MAX);
    assert.deepEqual(M.countLine(3), { full: false, text: '내 글꾸 3/20' });
    const full = M.countLine(20);
    assert.equal(full.full, true); assert.match(full.text, /20\/20 꽉 찼어요.*✕ 로 지워요/);
});

await test('시작 그래프 밖 · CI 등록', () => {
    // 새 모듈 셋을 불러오는 곳은 늦게 받는 조각(로그 복사 시트 · 마트 가져오기)뿐이에요
    const late = new Set(['log-copy-sheet.js', 'mart-import.js', 'mart-import-ui.js', 'mart-retake.js']);
    for (const file of fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js') && !f.endsWith('.gen.js') && f !== 'build-info.js')) {
        const code = read(`src/${file}`);
        for (const mod of ['log-copy-mine.js', 'mart-retake.js', 'log-copy-handoff.js']) if (new RegExp(`from '\\./${mod.replace('.', '\\.')}'`).test(code)) assert.ok(late.has(file), `${file} 가 ${mod} 를 불러요`);
    }
    assert.match(read('src/log-copy.js'), /import\('\.\/log-copy-sheet\.js'\)/, '시트는 import() 로만');
    assert.ok(!/from '\.\/mart-import(-ui)?\.js'/.test(read('src/panel.js') + read('src/log-copy.js')), '마트 받기도 import() 로만');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-mine\.mjs \./);
});

console.log(`log-copy-mine: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
