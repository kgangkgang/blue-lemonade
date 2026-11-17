// 1.0.1 프롬프트 폴더 (src/prompt-folders-core.js · src/prompt-folders.js): 순수 계산 + 가짜 브라우저(leak-dom)에서 프롬프트 관리자 목록에 입히기.
//   · 줄은 옮기지 않고 머리 줄만 끼운다 — 실리태번 끌기 저장(toArray data-pm-identifier) 순서가 그대로인지
//   · 접기 · 프리셋을 바꿨다 돌아와도 폴더가 남는지 · 끌어 옮기면 놓인 자리의 폴더로 · 모두 켜기는 택1 묶음을 지키고 저장 한 번
//   · 폴더 택1이 택1 클릭 연결(prompt-choice)에 더해지는지 · 끄면 흔적 없이 정리
//   · 1.0.2: 접기는 제자리에서(머리 줄 그대로) · 폴더째 위 · 아래로 · 하위 폴더를 풀면 항목은 위 폴더로 · 모두 켜기 · 하나만 켜기 되돌리기 · 다 꺼진 폴더 옅게
//   · 1.0.3: 폴더 창 하나(모든 폴더 · 이 폴더 · 새 폴더) — 접는 하위 줄 · 위 · 아래 · 빼기 · 모든 항목에서 넣기 · 창 안 하나만 켜기 · 끝 표시로 구역 닫기
//   node tools/tests/prompt-folders.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/prompt-folders-core.js'));
const choice = await import(url('src/prompt-choice-core.js'));

// ───────── 순수 계산 ─────────
await test('다듬기: 모르는 칸 · 깨진 값은 버리고 한 항목은 앞 폴더 하나에만 · 이름 40자', () => {
    const out = core.tidyFolderStore({ on: 'x', presets: { P: { folders: [
        { id: 'a', name: '  문체   폴더 ', ids: ['x', 'y', 'x', 3] },
        { id: 'a', name: '', ids: ['y', 'z'], open: false, pick: true },
        null, 'junk',
    ] }, __proto__: { folders: [] }, Q: 'nope', R: { folders: [] } } });
    assert.equal(out.on, true);
    assert.deepEqual(Object.keys(out.presets), ['P'], '빈 프리셋 · 깨진 칸은 없음');
    const [a, b] = out.presets.P.folders;
    assert.equal(a.name, '문체 폴더'); assert.deepEqual(a.ids, ['x', 'y']);
    assert.notEqual(b.id, 'a', '같은 id 는 새 id'); assert.equal(b.name, '폴더'); assert.deepEqual(b.ids, ['z']); assert.equal(b.open, false); assert.equal(b.pick, true);
    assert.equal(core.tidyFolders([{ name: 'ㄱ'.repeat(80), ids: [] }])[0].name.length, 40);
    assert.equal(core.tidyFolderStore({ on: false }).on, false);
});
const F = (id, ids, extra = {}) => ({ id, name: id, ids, open: true, pick: false, ...extra });
await test('구간: 이어지는 항목마다 머리 하나 · 떨어지면 「이어서」 구간(part)', () => {
    const order = ['h', 'a1', 'a2', 'x', 'a3', 'b1', 'b2'];
    const runs = core.folderRuns(order, [F('A', ['a1', 'a2', 'a3']), F('B', ['b1', 'b2'])]);
    assert.deepEqual(runs.map(r => [r.folder.id, r.start, r.end, r.part, r.parts]), [['A', 1, 2, 0, 2], ['A', 4, 4, 1, 2], ['B', 5, 6, 0, 1]]);
    assert.deepEqual(core.folderRuns(order, []), []);
});
await test('옮김 찾기: 하나를 아래로 · 위로 옮긴 것만 · 둘이 바뀌면 null', () => {
    const before = ['a', 'b', 'c', 'd', 'e'];
    assert.equal(core.detectMove(before, ['a', 'c', 'd', 'b', 'e']), 'b');
    assert.equal(core.detectMove(before, ['a', 'd', 'b', 'c', 'e']), 'd');
    assert.equal(core.detectMove(before, ['b', 'a', 'c', 'd', 'e']) !== null, true, '이웃 둘 바꿈 = 하나 옮김');
    assert.equal(core.detectMove(before, before.slice()), null);
    assert.equal(core.detectMove(before, ['e', 'b', 'c', 'd', 'a']), null);
    assert.equal(core.detectMove(before, ['a', 'b']), null);
});
await test('끌어 놓은 자리로 소속: 같은 폴더 사이 → 들어감(펼침) · 원래 폴더 밖 → 빠짐 · 폴더 끝에 붙으면 그대로', () => {
    const fs1 = [F('A', ['a1', 'a2'], { open: false }), F('B', ['b1', 'b2'])];
    assert.equal(core.adoptMove(fs1, ['a1', 'x', 'a2', 'b1', 'b2'], 'x'), true);
    assert.deepEqual(fs1[0].ids, ['a1', 'x', 'a2']); assert.equal(fs1[0].open, true);
    assert.equal(core.adoptMove(fs1, ['a1', 'x', 'a2', 'b1', 'b2'], 'x'), false, '이미 그 폴더');
    const fs2 = [F('A', ['a1', 'a2', 'a3'])];
    assert.equal(core.adoptMove(fs2, ['a1', 'a2', 'a3'], 'q'), false, '순서에 없는 항목');
    assert.equal(core.adoptMove(fs2, ['a1', 'a3', 'y', 'z', 'a2'], 'a2'), true); assert.deepEqual(fs2[0].ids, ['a1', 'a3']);
    const fs3 = [F('A', ['a1', 'a2'])];
    assert.equal(core.adoptMove(fs3, ['x', 'a1', 'a2', 'y'], 'a2'), false, '폴더 끝 그대로');
    const fs4 = [F('A', ['a1', 'a2']), F('B', ['b1', 'b2'])];
    assert.equal(core.adoptMove(fs4, ['a1', 'b1', 'b2', 'a2'], 'a2'), true, 'B 사이가 아니라 B 뒤 — A 밖이라 빠짐');
    assert.deepEqual(fs4[0].ids, ['a1']);
    const fs5 = [F('A', ['a1', 'a2']), F('B', ['b1', 'b2'])];
    assert.equal(core.adoptMove(fs5, ['b1', 'a2', 'b2', 'a1'], 'a2'), true); assert.deepEqual(fs5[1].ids, ['b1', 'a2', 'b2']); assert.deepEqual(fs5[0].ids, ['a1']);
});
await test('항목 넣기 · 한곳에 모으기', () => {
    const list = [F('A', ['a1']), F('B', ['b1', 'b2'])];
    core.assignIds(list, list[0], ['b2', 'a1', 'n'], ['a1', 'b1', 'b2', 'n']);
    assert.deepEqual(list[0].ids, ['a1', 'b2', 'n']); assert.deepEqual(list[1].ids, ['b1']);
    assert.deepEqual(core.gatherOrder(['x', 'a1', 'y', 'a2', 'z', 'a3'], F('A', ['a1', 'a2', 'a3'])), ['x', 'a1', 'a2', 'a3', 'y', 'z']);
    assert.equal(core.gatherOrder(['x', 'a1', 'a2'], F('A', ['a1', 'a2'])), null);
});
await test('1.0.2 폴더 풀기: 하위 폴더를 풀면 항목은 위 폴더로(실제 순서대로) · 맨 위 폴더를 풀면 하위 폴더는 맨 위로', () => {
    const order = ['a1', 's1', 's2', 'a2', 'x'];
    const one = [F('A', ['a1', 'a2']), F('S', ['s1', 's2'], { parent: 'A' }), F('B', ['x'])];
    const out = core.ungroupFolder(one, 'S', order);
    assert.deepEqual(out.map(f => f.id), ['A', 'B']);
    assert.deepEqual(out[0].ids, ['a1', 's1', 's2', 'a2'], '위 폴더로 · 실제 순서대로');
    const two = [F('A', ['a1', 'a2']), F('S', ['s1', 's2'], { parent: 'A' })];
    const top = core.ungroupFolder(two, 'A', order);
    assert.deepEqual(top.map(f => [f.id, f.parent, f.ids]), [['S', '', ['s1', 's2']]], '하위는 맨 위로 · 위 폴더 항목은 폴더 밖');
    const same = [F('A', ['a1'])];
    assert.equal(core.ungroupFolder(same, 'nope', order), same, '없는 폴더는 그대로');
});
await test('1.0.2 폴더째 한 칸 옮기기: 보이는 한 칸(폴더 밖 항목 · 같은 단 폴더 통째)과 자리 바꿈 · 하위는 위 폴더 안에서만 · 맨 끝 · 떨어진 폴더는 null', () => {
    const order = ['x', 'a1', 'a2', 'y', 'b1', 'b2', 'z'];
    const fs1 = [F('A', ['a1', 'a2']), F('B', ['b1', 'b2'])];
    assert.deepEqual(core.moveFolderBlock(order, fs1, 'A', -1), ['a1', 'a2', 'x', 'y', 'b1', 'b2', 'z']);
    assert.deepEqual(core.moveFolderBlock(order, fs1, 'A', 1), ['x', 'y', 'a1', 'a2', 'b1', 'b2', 'z']);
    assert.deepEqual(core.moveFolderBlock(order, fs1, 'B', 1), ['x', 'a1', 'a2', 'y', 'z', 'b1', 'b2']);
    assert.deepEqual(core.moveFolderBlock(['a1', 'a2', 'b1', 'b2'], fs1, 'B', -1), ['b1', 'b2', 'a1', 'a2'], '옆 폴더는 통째로');
    assert.equal(core.moveFolderBlock(['a1', 'a2', 'x'], fs1, 'A', -1), null, '맨 위');
    assert.equal(core.moveFolderBlock(['x', 'a1', 'a2'], fs1, 'A', 1), null, '맨 아래');
    assert.equal(core.moveFolderBlock(['a1', 'x', 'a2'], fs1, 'A', 1), null, '떨어진 폴더');
    assert.equal(core.moveFolderBlock(order, fs1, 'A', 0), null);
    const fs2 = [F('A', ['a1', 'a2']), F('S', ['s1', 's2'], { parent: 'A' })];
    const o2 = ['a1', 's1', 's2', 'a2', 'x'];
    assert.deepEqual(core.moveFolderBlock(o2, fs2, 'S', -1), ['s1', 's2', 'a1', 'a2', 'x']);
    assert.deepEqual(core.moveFolderBlock(o2, fs2, 'S', 1), ['a1', 'a2', 's1', 's2', 'x']);
    assert.equal(core.moveFolderBlock(['a1', 'a2', 's1', 's2', 'x'], fs2, 'S', 1), null, '위 폴더 밖으로는 안 나가요');
    assert.deepEqual(core.moveFolderBlock(o2, fs2, 'A', 1), ['x', 'a1', 's1', 's2', 'a2'], '위 폴더는 하위째');
});
await test('모두 켜기: 택1 묶음은 하나만(이미 켜진 것 우선) · 켤 수 없는 줄 건너뜀 · 끄기는 켜진 것만 · 택1 폴더는 켜기 없음', () => {
    const ids = ['m', 'p1', 'p2', 'p3', 'q'];
    const groups = [{ id: 'g', ids: ['p1', 'p2', 'p3'] }];
    assert.deepEqual(core.planToggleAll(ids, new Set(['p2']), true, { groups, allowed: id => id !== 'm' }), [['q', true]]);
    assert.deepEqual(core.planToggleAll(ids, new Set(), true, { groups }), [['m', true], ['p1', true], ['q', true]]);
    assert.deepEqual(core.planToggleAll(['p1', 'q'], new Set(['p3']), true, { groups: [{ id: 'g', ids: ['p1', 'p3'] }] }), [['q', true]], '폴더 밖 짝이 켜져 있으면 안 켬');
    assert.deepEqual(core.planToggleAll(ids, new Set(['p1', 'q', 'zz']), false, {}), [['p1', false], ['q', false]]);
    assert.equal(core.planToggleAll(ids, new Set(), true, { pick: true }), null);
});
await test('구분선으로 폴더 계획: 장식 이름 + 빈 내용 · 🔻PICK 머리 · 글자 없는 구분선은 닫기만 · 마커 · 내용 있는 줄은 아님', () => {
    const P = { d1: { name: '━━ 🔹 문체 🔹 ━━', content: '' }, s1: { name: '대사 규칙', content: '말투' }, s2: { name: '묘사', content: '…' },
        end: { name: '━━━━━━━━', content: '' }, loose: { name: '따로', content: '?' },
        pick: { name: '🔻PICK: 시점🔻', content: '' }, v1: { name: '「 1인칭 」', content: 'a' }, v2: { name: '「 3인칭 」', content: 'b' },
        main: { name: 'Main Prompt', content: '', marker: true }, lone: { name: '★ 혼자 ★', content: '{{// 메모 }}' } };
    const order = ['main', 'd1', 's1', 's2', 'end', 'loose', 'pick', 'v1', 'v2', 'lone'];
    const plans = core.planFromDividers(order, id => P[id]);
    assert.deepEqual(plans, [{ name: '문체', ids: ['d1', 's1', 's2'], children: [] }, { name: 'PICK: 시점', ids: ['pick', 'v1', 'v2'], children: [] }]);
    assert.equal(core.isDivider(P.main), false); assert.equal(core.isDivider(P.s1), false); assert.equal(core.isDivider({ name: '-----', content: '' }), true);
    assert.equal(core.isDivider({ name: 'Plain', content: '' }), false, '장식 없는 빈 줄은 아님');
    assert.equal(core.dividerTitle('◆◇ 상태창 (선택) ◇◆'), '상태창 (선택)');
});
await test('1.0.3 폴더 창 계산: 항목 한 칸 위 · 아래(같은 폴더 직속끼리 자리만 바꿈) · 보일 폴더(전부 / 그 폴더와 하위, 실제 순서대로 · 빈 폴더는 끝)', () => {
    const A = F('A', ['a1', 'a2', 'a3']);
    assert.deepEqual(core.shiftInFolder(['a1', 'a2', 'x', 'a3'], A, 'a2', 1), ['a1', 'a3', 'x', 'a2'], '사이 줄은 그대로');
    assert.deepEqual(core.shiftInFolder(['a1', 'a2', 'a3'], A, 'a2', -1), ['a2', 'a1', 'a3']);
    assert.equal(core.shiftInFolder(['a1', 'a2', 'a3'], A, 'a1', -1), null, '맨 앞');
    assert.equal(core.shiftInFolder(['a1', 'a2', 'a3'], A, 'a3', 1), null, '맨 끝');
    assert.equal(core.shiftInFolder(['a1', 'q'], A, 'q', 1), null, '폴더 밖 항목');
    const list = [F('B', ['b1']), F('E', []), { ...F('S', ['s1']), parent: 'A' }, A];
    const order = ['s1', 'a1', 'a2', 'a3', 'b1'];
    assert.deepEqual(core.scopeFolders(list, '', order).map(f => f.id), ['S', 'A', 'B', 'E'], '먼저 나오는 폴더부터 · 빈 폴더 끝');
    assert.deepEqual(core.scopeFolders(list, 'A', order).map(f => f.id), ['S', 'A'], '그 폴더와 하위만');
    assert.deepEqual(core.scopeFolders(list, 'S', order).map(f => f.id), ['S']);
});
await test('1.0.3 자동 초안: 같은 이름의 끝 표시(「━━ 문체 끝 ━━」)는 새 폴더를 열지 않고 그 구역을 닫아요 · 이름이 다른 「끝」 글자는 그대로 구분선', () => {
    const P = { d1: { name: '━━ 🔹 문체 🔹 ━━', content: '' }, a: { name: 'A', content: 'x' }, b: { name: 'B', content: 'x' }, end: { name: '━━ 문체 끝 ━━', content: '' },
        x: { name: 'X', content: 'x' }, d2: { name: '◆ 끝맺음 ◆', content: '' }, c: { name: 'C', content: 'x' }, e: { name: 'E', content: 'x' } };
    assert.deepEqual(core.planFromDividers(Object.keys(P), id => P[id]), [
        { name: '문체', ids: ['d1', 'a', 'b', 'end'], children: [] },
        { name: '끝맺음', ids: ['d2', 'c', 'e'], children: [] },
    ], 'X 는 폴더 밖');
});
await test('폴더 택1 → 택1 묶음(prompt-choice-core)에 더해져 같은 규칙으로 꺼요 · 메타 모양 그대로', () => {
    const prompts = ['a', 'b', 'c'].map(identifier => ({ identifier, name: identifier }));
    const order = [{ identifier: 'a', enabled: true }, { identifier: 'b', enabled: false }, { identifier: 'c', enabled: true }];
    const folders = [F('L', ['a', 'b'], { pick: true }), F('N', ['c'], { pick: true }), F('O', ['a', 'c'])];
    const meta = choice.withFolderChoices({ version: 1, groups: [{ id: 'x', ids: ['b', 'c'] }] }, folders);
    assert.deepEqual(meta.groups.map(g => g.id), ['x', 'bl-folder:L']);
    assert.deepEqual(choice.preparePromptChoice(prompts, order, meta, 'b').sort(), ['a', 'c']);
    const plain = { version: 1, groups: [] };
    assert.equal(choice.withFolderChoices(plain, [F('O', ['a', 'c'])]), plain, '택1 폴더가 없으면 같은 객체');
    assert.deepEqual(choice.folderChoiceGroups([{ id: 'q', pick: true, ids: ['a', 'a', 7, 'b'] }, { pick: true, ids: ['a', 'b'] }, 'x']), [{ id: 'bl-folder:q', ids: ['a', 'b'] }]);
});

await test('2단 폴더: 사슬대로 머리를 끼우고(위 폴더 구간이 하위를 품음) · 3단은 맨 위로 · 위 폴더 항목 전부', () => {
    const list = core.tidyFolders([{ id: 'P', name: 'P', ids: ['p1', 'p2'] }, { id: 'C', name: 'C', ids: ['c1', 'c2'], parent: 'P' }, { id: 'D', name: 'D', ids: ['d1'], parent: 'C' }, { id: 'S', name: 'S', ids: ['s1'], parent: 'S' }, { id: 'N', name: 'N', ids: ['n1'], parent: '없음' }]);
    assert.deepEqual(list.map(f => f.parent), ['', 'P', '', '', ''], '하위의 하위 · 자기 자신 · 없는 폴더는 맨 위로');
    const order = ['x', 'p1', 'c1', 'c2', 'p2', 'y'];
    assert.deepEqual(core.folderRuns(order, list).map(r => [r.folder.id, r.depth, r.start, r.end]), [['P', 0, 1, 4], ['C', 1, 2, 3]]);
    assert.deepEqual(core.folderItems(list[0], list), ['p1', 'p2', 'c1', 'c2']);
    assert.deepEqual(core.folderRuns(['c1', 'x', 'c2'], list).map(r => [r.folder.id, r.depth, r.part]), [['P', 0, 0], ['C', 1, 0], ['P', 0, 1], ['C', 1, 1]], '떨어지면 이어서');
});
await test('2단 끌기: 하위 폴더 사이 → 하위로 · 위 폴더 직속과 하위 사이 → 위 폴더로 · 밖으로 → 빠짐 · 빈 폴더 정리', () => {
    const make = () => core.tidyFolders([F('P', ['p1', 'p2']), { ...F('C', ['c1', 'c2'], { open: false }), parent: 'P' }]);
    let list = make();
    assert.equal(core.adoptMove(list, ['p1', 'c1', 'x', 'c2', 'p2'], 'x'), true); assert.deepEqual(list[1].ids, ['c1', 'x', 'c2']); assert.equal(list[1].open, true);
    list = make();
    assert.equal(core.adoptMove(list, ['p1', 'x', 'c1', 'c2', 'p2'], 'x'), true); assert.deepEqual(list[0].ids, ['p1', 'x', 'p2'], '직속과 하위 사이는 공통 폴더 P');
    list = make();
    assert.equal(core.adoptMove(list, ['p1', 'c1', 'p2', 'y', 'c2'], 'c2'), true); assert.deepEqual(list[1].ids, ['c1']);
    assert.deepEqual(core.dropEmpty([F('A', []), { ...F('B', ['b']), parent: 'C' }, F('C', [])]).map(f => f.id), ['B', 'C'], '하위가 있는 빈 위 폴더는 남음');
});
await test('자동 초안: 시작 · 끝 짝 → 안쪽 구역은 하위 · 짝 없는 시작은 무시 · 같은 이모지 빈 줄 묶음은 구분선 아님 · 이름 없는 빈 줄은 닫기', () => {
    const P = { o: { name: '⤵ 문체 시작', content: '' }, a: { name: 'A', content: 'x' }, i: { name: '<lore>', content: 'x' }, b: { name: 'B', content: 'x' }, c2: { name: 'C', content: 'x' }, ic: { name: '</lore>', content: 'x' }, d: { name: '◆ 대사 ◆', content: '' }, e: { name: 'E', content: 'x' }, f: { name: 'F', content: 'x' }, oc: { name: '⤴ 문체 끝', content: '' },
        s: { name: '이야기 시작 규칙', content: 'x' }, n1: { name: '🚫 하나', content: '' }, n2: { name: '🚫 둘', content: '' }, n3: { name: '🚫 셋', content: '' }, h: { name: '★ 뒤 ★', content: '' }, g: { name: 'G', content: 'x' }, blank: { name: '', content: '' }, z: { name: 'Z', content: 'x' } };
    const plans = core.planFromDividers(Object.keys(P), id => P[id]);
    assert.deepEqual(plans, [
        { name: '문체', ids: ['o', 'a', 'oc'], children: [{ name: 'lore', ids: ['i', 'b', 'c2', 'ic'] }, { name: '대사', ids: ['d', 'e', 'f'] }] },
        { name: '뒤', ids: ['h', 'g'], children: [] },
    ]);
    const long = Array.from({ length: 24 }, (_, i) => 'k' + i), one = { name: '★ 전부 ★', content: '' };
    assert.deepEqual(core.planFromDividers(long, id => (id === 'k0' ? one : { name: id, content: 'x' })), [], '긴 목록의 절반 넘게 덮는 폴더는 안 만듦');
});
await test('다른 프리셋에서 가져오기: 같은 id → 같은 이름(하나일 때) → 없으면 뺌 · 새 항목은 앞뒤가 같은 폴더면 안으로 · 하위 · 택1 유지 · 판 번호 줄기', () => {
    const source = [F('A', ['a1', 'old', 'gone'], { pick: true }), { ...F('B', ['b1', 'dup']), parent: 'A' }];
    const prompts = [['a1', 'A1'], ['renamed', '옛 이름'], ['new', '새 항목'], ['b1', 'B1'], ['free', '밖'], ['d1', '같음'], ['d2', '같음']].map(([identifier, name]) => ({ identifier, name }));
    const r = core.remapFolders(source, { old: '옛 이름', gone: '없어짐', dup: '같음' }, prompts, ['a1', 'new', 'renamed', 'free', 'b1']);
    assert.deepEqual(r.folders[0].ids, ['a1', 'new', 'renamed']); assert.equal(r.folders[0].pick, true);
    assert.deepEqual(r.folders[1].ids, ['b1']); assert.equal(r.folders[1].parent, r.folders[0].id); assert.notEqual(r.folders[0].id, 'A', '새 id');
    assert.deepEqual(r.stats, { kept: 2, byName: 1, missing: 2, placed: 1 });
    assert.equal(source[0].ids.length, 3, '원본 폴더는 그대로');
    assert.equal(core.presetStem('레모나 6.6'), core.presetStem('레모나 6.2')); assert.notEqual(core.presetStem('레모나 6.6'), core.presetStem('과일 6.6'));
});
await test('프리셋 칸 읽기: version 1 만 · 깨진 값은 빈 목록', () => {
    assert.deepEqual(core.readPresetFolders({ blPromptFolders: { version: 1, folders: [{ id: 'a', name: '문체', ids: ['x'] }] } }).map(f => f.ids), [['x']]);
    for (const value of [undefined, {}, { blPromptFolders: { version: 2, folders: [] } }, { blPromptFolders: 'x' }, { blPromptFolders: { version: 1, folders: 'x' } }]) assert.deepEqual(core.readPresetFolders(value), []);
});
// 1.5.2 프리셋 파일 폴더 따라가기: 접기 · 펼치기(보기 상태)는 open 칸에만, 식구는 사용자가 고친 폴더만 덮어써요.
//   예전(1.5.1 까지)엔 한 번 접으면 그때 폴더가 통째로 굳어, 같은 이름 프리셋의 새 판이 더한 항목이 폴더 밖이 되고 같은 머리가 「이어서」로 되풀이됐어요.
const SEED7 = () => core.tidyFolders([
    { id: 'L', name: '분량 · 리듬', ids: ['h', 'slow', 'rhythm'] },
    { id: 'S', name: '분량', ids: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'], pick: true, parent: 'L' },
]);
const ORDER7 = ['h', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 'slow', 'rhythm'];
const FROZEN3 = () => ({ folders: [
    { id: 'L', name: '분량 · 리듬', ids: ['h', 'slow', 'rhythm'], open: true },
    { id: 'S', name: '분량', ids: ['t2', 't5', 't6'], open: false, pick: true, parent: 'L' },
] });
await test('1.5.2 굳은 옛 설정 + 식구가 늘어난 새 판: 옮김 한 번으로 풀려 머리 1 · 하위 머리 1 · 식구 7 · 접힘은 그대로', () => {
    const slot = core.migrateFolderSlot(FROZEN3(), SEED7());
    const list = core.mergeFolders(SEED7(), slot);
    const runs = core.folderRuns(ORDER7, list);
    assert.deepEqual(runs.map(r => [r.folder.id, r.part]), [['L', 0], ['S', 0]], '머리 둘(위 · 하위) · 이어서 없음');
    assert.equal(core.folderItems(list.find(f => f.id === 'S'), list).length, 7);
    assert.equal(list.find(f => f.id === 'S').open, false, '접힘(보기 상태)은 그대로');
    assert.equal(list.find(f => f.id === 'S').pick, true);
    // 옛 굳은 목록이 그때 파일과 같았으면 「손 안 댐」 — 식구는 파일 정의를 따라가요
    const same = core.migrateFolderSlot({ folders: SEED7().map(f => ({ ...f, open: f.id !== 'S' })) }, SEED7());
    assert.equal(same.folders, undefined, '손 안 댄 칸은 식구를 저장하지 않아요');
    assert.deepEqual(same.open, { L: true, S: false });
});
await test('1.5.3 옛 칸 옮김이 합친 항목은 restored 에 남고(알림 · 되돌리기용) · 되돌리면 그 항목만 다시 밖 — 그 뒤 새 판이 더한 항목은 안', () => {
    const slot = core.migrateFolderSlot(FROZEN3(), SEED7());
    assert.deepEqual(slot.restored, { S: ['t1', 't3', 't4', 't7'] }, '굳은 목록에 없고 파일에 있던 넷');
    assert.equal(core.migrateFolderSlot({ folders: SEED7() }, SEED7()).restored, undefined, '손 안 댄 칸은 알릴 것 없음');
    const undone = core.undoRestored(slot);
    assert.equal(undone.restored, undefined);
    const next = core.tidyFolders([...SEED7().filter(f => f.id !== 'S'), { id: 'S', name: '분량', ids: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'], pick: true, parent: 'L' }]);
    const S = core.mergeFolders(next, undone).find(f => f.id === 'S');
    assert.deepEqual([...S.ids].sort(), ['t2', 't5', 't6', 't8'], '되돌린 넷은 밖 · 새로 더한 t8 은 안');
    assert.equal(core.undoRestored({ v: 2, folders: [] }).restored, undefined, 'restored 없으면 그대로');
});
await test('1.5.2 옛 설정 옮김은 두 번 돌아도 같은 결과(멱등) · 이미 옮긴 칸은 그대로', () => {
    for (const raw of [FROZEN3(), { folders: [] }, { folders: [], seed: 'x' }, { folders: SEED7() }]) {
        const once = core.migrateFolderSlot(structuredClone(raw), SEED7());
        assert.deepEqual(core.migrateFolderSlot(structuredClone(once), SEED7()), once);
        assert.deepEqual(core.mergeFolders(SEED7(), core.migrateFolderSlot(structuredClone(once), SEED7())), core.mergeFolders(SEED7(), once));
    }
});
await test('1.5.2 사용자가 고친 폴더: 뺀 항목은 새 판에서도 밖 · 새 판이 새로 더한 항목은 안 · 손 안 댄 폴더는 파일 정의(이름까지)', () => {
    const seed = SEED7();
    const mine = seed.map(f => ({ ...f, ids: f.id === 'S' ? f.ids.filter(id => id !== 't3') : [...f.ids] }));
    const slot = { v: 2, open: {}, folders: mine, base: core.seedBase(seed) };
    const next = core.tidyFolders([
        { id: 'L', name: '분량과 리듬', ids: ['h', 'slow', 'rhythm', 'r2'] },
        { id: 'S', name: '분량', ids: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'], pick: true, parent: 'L' },
    ]);
    const list = core.mergeFolders(next, slot);
    const S = list.find(f => f.id === 'S'), L = list.find(f => f.id === 'L');
    assert.ok(!S.ids.includes('t3'), '사용자가 뺀 것은 밖');
    assert.ok(S.ids.includes('t8'), '새 판이 더한 것은 안');
    assert.deepEqual(L.ids, ['h', 'slow', 'rhythm', 'r2']); assert.equal(L.name, '분량과 리듬', '손 안 댄 폴더는 파일을 따라가요');
    // 다른 폴더로 옮긴 항목은 옮긴 자리 그대로(파일의 원래 폴더가 다시 가져가지 않아요)
    const moved = seed.map(f => ({ ...f, ids: f.id === 'S' ? f.ids.filter(id => id !== 't1') : f.id === 'L' ? [...f.ids, 't1'] : [...f.ids] }));
    const list2 = core.mergeFolders(next, { v: 2, open: {}, folders: moved, base: core.seedBase(seed) });
    assert.equal(core.folderIndex(list2).get('t1').id, 'L');
});
await test('조정자 도구 preset-folders: 초안 · 넣기 · 원본 안 바꿈 · 덮어쓰기 거절 · 없는 identifier 뺌', async () => {
    const tool = await import(url('tools/preset-folders.mjs'));
    const preset = { temperature: 1, prompts: [['d', '━━ 🔹 문체 🔹 ━━', ''], ['a', 'A', 'x'], ['b', 'B', 'x']].map(([identifier, name, content]) => ({ identifier, name, content })), prompt_order: [{ character_id: 100000, order: [{ identifier: 'b', enabled: true }] }, { character_id: 100001, order: ['d', 'a', 'b', 'ghost'].map(identifier => ({ identifier, enabled: true })) }], extensions: { blPromptChoices: { version: 1, groups: [] } } };
    assert.deepEqual(tool.presetOrder(preset), ['d', 'a', 'b']);
    const draft = tool.draftFolders(preset);
    assert.deepEqual(draft.map(f => [f.name, f.ids]), [['문체', ['d', 'a', 'b']]]);
    const { folders, missing } = tool.normalizeFolders(preset, [{ name: '위', ids: ['a', 'ghost'], children: [{ name: '아래', ids: ['b'], pick: true }] }, { name: '빈', ids: ['없음'] }]);
    assert.deepEqual(missing, ['ghost', '없음']);
    assert.deepEqual(folders.map(f => [f.id, f.name, f.ids, f.parent, f.pick]), [['f1', '위', ['a'], '', false], ['f2', '아래', ['b'], 'f1', true]]);
    const next = tool.withFolders(preset, folders);
    assert.equal(preset.extensions.blPromptFolders, undefined, '원본 객체 그대로');
    assert.deepEqual(core.readPresetFolders(next.extensions).map(f => f.name), ['위', '아래'], '테마가 그대로 읽어요');
    assert.deepEqual(next.extensions.blPromptChoices, preset.extensions.blPromptChoices); assert.equal(next.temperature, 1);
    const dir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || '.', 'pf-tool-'));
    const input = path.join(dir, 'in.json'), output = path.join(dir, 'out.json'), body = JSON.stringify(preset, null, 4) + '\n';
    fs.writeFileSync(input, body);
    const { spawnSync } = await import('node:child_process');
    const run = (...a) => spawnSync(process.execPath, [path.join(root, 'tools/preset-folders.mjs'), ...a], { encoding: 'utf8' });
    assert.equal(run(input, '--out', output).status, 0);
    assert.equal(fs.readFileSync(input, 'utf8'), body, '원본 파일 그대로');
    const written = fs.readFileSync(output, 'utf8');
    assert.deepEqual(core.readPresetFolders(JSON.parse(written).extensions).map(f => f.name), ['문체']);
    assert.ok(written.startsWith('{\n    "temperature"'), '들여쓰기 그대로');
    assert.equal(run(input, '--out', output).status, 1, '있는 파일은 거절');
    assert.equal(run(input, '--out', input).status, 1, '원본 자리에는 안 씀');
    fs.rmSync(dir, { recursive: true, force: true });
});

// ───────── 가짜 브라우저에서 입히기 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, promptFolders: { on: true, presets: {} } };
const { ctx, eventSource } = dom.installBrowser({ settings });
let preset = 'P1';
ctx.getPresetManager = () => ({ getSelectedPresetName: () => preset });
const N = 60;
const ids = Array.from({ length: N }, (_, i) => `p${i}`);
const order = ids.map((identifier, i) => ({ identifier, enabled: i % 3 !== 0 }));
const prompts = ids.map((identifier, i) => (i === 9 ? { identifier, name: '━━ 🔹 시점 🔹 ━━', content: '' } : { identifier, name: `항목 ${i}`, content: 'x', marker: i === 59 }));
const calls = { render: 0, save: 0 };
const pmStub = {
    activeCharacter: { id: 100001 }, serviceSettings: { prompts, extensions: {} }, tokenHandler: { getCounts: () => ({}) },
    getPromptOrderForCharacter: () => order, getPromptOrderEntry: (_, id) => order.find(e => e.identifier === id),
    getPromptById: id => prompts.find(p => p.identifier === id), isPromptToggleAllowed: p => !p?.marker,
    removePromptOrderForCharacter() {}, addPromptOrderForCharacter() {},
    render() { calls.render++; drawList(); }, saveServiceSettings() { calls.save++; },
};
ctx.promptManager = pmStub; ctx.chatCompletionSettings = { preset_settings_openai: 'P1' };
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const list = document.getElementById('completion_prompt_manager_list');
const footer = document.createElement('div'); footer.className = 'completion_prompt_manager_footer';
footer.innerHTML = '<select></select><a class="menu_button" id="prompt-manager-import"></a><a class="menu_button"></a>';
list.before(footer);
// 실리태번 renderPromptManagerListItems 흉내: 목록을 통째로 새로 그림
function drawList() {
    list.innerHTML = order.map(e => `<li class="completion_prompt_manager_prompt completion_prompt_manager_prompt_draggable${e.enabled ? '' : ' completion_prompt_manager_prompt_disabled'}" data-pm-identifier="${e.identifier}"><span class="completion_prompt_manager_prompt_name" data-pm-name="${e.identifier}"><a class="prompt-manager-inspect-action">${prompts.find(p => p.identifier === e.identifier).name}</a></span><span><span class="prompt_manager_prompt_controls"><span class="prompt-manager-toggle-action"></span></span></span><span class="prompt_manager_prompt_tokens" data-pm-tokens="10">10</span></li>`).join('');
}
drawList();
settings.promptFolders.presets.P1 = { folders: [
    { id: 'fa', name: '문체', ids: ['p2', 'p3', 'p4', 'p5'], open: true },
    { id: 'fb', name: '시점', ids: ['p9', 'p10', 'p11', 'p12'], open: false },
    { id: 'fc', name: '떨어짐', ids: ['p20', 'p22'], open: true },
] };
const pf = await import(url('src/prompt-folders.js'));
const settle = async () => { await dom.clock.advance(40); for (let i = 0; i < 6; i++) await null; };
const heads = () => [...list.children].filter(el => el.classList.contains('bl-pf-head'));
const toArray = () => [...list.querySelectorAll('.completion_prompt_manager_prompt_draggable')].map(el => el.getAttribute('data-pm-identifier'));
const row = id => list.querySelector(`[data-pm-identifier="${id}"]`);

await pf.syncPromptFolders(true);
await settle();
await test('머리 줄만 끼우고 줄은 그대로: 끌기 저장 순서(toArray) = 실제 순서 · 머리는 식별자 · 끌기 클래스 없음', () => {
    assert.deepEqual(heads().map(h => [h.dataset.pfId, h.dataset.pfPart]), [['fa', '0'], ['fb', '0'], ['fc', '0'], ['fc', '1']]);
    assert.deepEqual(toArray(), ids);
    for (const h of heads()) { assert.equal(h.getAttribute('data-pm-identifier'), null); assert.equal(h.classList.contains('completion_prompt_manager_prompt_draggable'), false); }
    assert.equal(heads()[0].nextElementSibling, row('p2'), '구간 첫 줄 바로 앞');
    assert.ok(row('p3').classList.contains('bl-pf-in')); assert.ok(!row('p6').classList.contains('bl-pf-in'));
    assert.ok(row('p11').classList.contains('bl-pf-hide'), '접힌 폴더 줄은 숨김'); assert.ok(!row('p3').classList.contains('bl-pf-hide'));
    assert.match(heads()[0].querySelector('.bl-pf-count').textContent, /^3\/4$/, '켜짐 3/4 (p3 꺼짐)');
    assert.equal(heads()[0].querySelector('.bl-pf-tok').textContent, '30');
    assert.match(heads()[3].querySelector('.bl-pf-count').textContent, /이어서/);
    assert.ok(list.classList.contains('bl-pf-on'));
    assert.ok(footer.querySelector('.bl-pf-tools'), '도구 줄 폴더 단추');
    assert.equal(footer.querySelector('.bl-pf-tools').nextElementSibling?.id, 'prompt-manager-import', '가져오기 앞');
    assert.ok(document.getElementById('bl-prompt-folders-style'), 'CSS 는 켤 때만');
});
await test('한 줄 걸러 톤: 보이는 줄만 번갈아(머리 다음 첫 줄은 기본 톤)', () => {
    assert.ok(!row('p2').classList.contains('bl-pf-alt')); assert.ok(row('p3').classList.contains('bl-pf-alt'));
    assert.ok(!row('p11').classList.contains('bl-pf-alt'), '숨긴 줄은 톤 없음');
});
await test('실리태번이 목록을 다시 그려도(토글 · 다시 그리기) 다음 프레임에 다시 입혀요', async () => {
    drawList(); await settle();
    assert.equal(heads().length, 4); assert.deepEqual(toArray(), ids);
});
await test('접기 · 펼치기: 머리 누르면 저장 + 숨김만 바뀜(실리태번 다시 그리기 없음) · 1.0.2 머리 줄은 그대로(제자리에서)', async () => {
    const before = calls.render;
    const head0 = heads()[0], all0 = heads();
    heads()[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.equal(settings.promptFolders.presets.P1.open.fa, false, '1.5.2 접힘은 보기 상태(open 칸)로');
    assert.ok(row('p3').classList.contains('bl-pf-hide'));
    assert.equal(heads()[0].querySelector('.bl-pf-name').getAttribute('aria-expanded'), 'false');
    assert.equal(calls.render, before);
    assert.equal(heads()[0], head0, '누른 머리 줄을 다시 만들지 않아요(초점이 남아요)');
    assert.ok(all0.every((h, i) => heads()[i] === h), '다른 머리 줄도 그대로');
    assert.ok(heads()[0].classList.contains('bl-pf-closed')); assert.ok(heads()[0].querySelector('.bl-pf-caret').classList.contains('fa-chevron-right'));
    assert.ok(!row('p3').classList.contains('bl-pf-alt'), '숨긴 줄은 톤 없음');
    heads()[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.ok(!row('p3').classList.contains('bl-pf-hide'));
});
await test('프리셋을 바꾸면 그 프리셋 폴더(없음)로, 돌아오면 전 폴더 · 접힘 그대로', async () => {
    preset = 'P2'; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.equal(heads().length, 0); assert.ok(!list.classList.contains('bl-pf-on'));
    assert.ok(!list.querySelector('.bl-pf-in'), '클래스도 남지 않음');
    preset = 'P1'; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.equal(heads().length, 4); assert.ok(row('p11').classList.contains('bl-pf-hide'));
});
await test('프리셋 이름을 바꾸면 폴더 칸이 새 이름으로 따라가요 · 다른 API · 새 이름 칸이 있으면 그대로(버그 사냥 4)', async () => {
    const before = JSON.stringify(settings.promptFolders.presets.P1);
    preset = 'P1 새'; await eventSource.emit(ctx.event_types.PRESET_RENAMED, { apiId: 'openai', oldName: 'P1', newName: 'P1 새' }); drawList(); await settle();
    assert.equal(JSON.stringify(settings.promptFolders.presets['P1 새']), before);
    assert.ok(!Object.hasOwn(settings.promptFolders.presets, 'P1'));
    assert.equal(heads().length, 4, '폴더가 그대로 보여요'); assert.ok(row('p11').classList.contains('bl-pf-hide'), '접힘도');
    await eventSource.emit(ctx.event_types.PRESET_RENAMED, { apiId: 'textgenerationwebui', oldName: 'P1 새', newName: 'X' });
    assert.ok(Object.hasOwn(settings.promptFolders.presets, 'P1 새'), '다른 API 프리셋 이름 바뀜은 무시');
    settings.promptFolders.presets.Q = { v: 2, open: {} };
    pf._forTest.onRenamed({ apiId: 'openai', oldName: 'P1 새', newName: 'Q' });
    assert.ok(Object.hasOwn(settings.promptFolders.presets, 'P1 새'), '새 이름 칸이 있으면 덮지 않아요');
    delete settings.promptFolders.presets.Q;
    pf._forTest.onRenamed({ apiId: 'openai', oldName: 'P1 새', newName: 'P1' });
    preset = 'P1'; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.equal(heads().length, 4);
});
await test('끌어 옮김(실리태번 sortable 이 줄 하나를 옮기고 순서 저장): 같은 폴더 사이에 놓으면 그 폴더로, 밖으로 빼면 빠짐', async () => {
    // p7 을 p3 과 p4 사이로
    const [moved] = order.splice(7, 1); order.splice(4, 0, moved);
    row('p4').before(row('p7')); await settle();
    const fa = settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa');
    assert.deepEqual(fa.ids, ['p2', 'p3', 'p7', 'p4', 'p5']);
    assert.deepEqual(toArray(), order.map(e => e.identifier), '저장 순서는 실리태번 것 그대로');
    // p7 을 다시 맨 끝으로
    const at = order.findIndex(e => e.identifier === 'p7'); const [back] = order.splice(at, 1); order.push(back);
    list.append(row('p7')); await settle();
    assert.deepEqual(settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa').ids, ['p2', 'p3', 'p4', 'p5']);
});
await test('모두 켜기: 켤 수 있는 줄만 켜고 실리태번 저장 한 번 · 택1 폴더는 끄기만', async () => {
    const r0 = calls.render, s0 = calls.save;
    heads()[0].querySelector('.bl-pf-all').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.ok(['p2', 'p3', 'p4', 'p5'].every(id => order.find(e => e.identifier === id).enabled));
    assert.equal(calls.save - s0, 1); assert.equal(calls.render - r0, 1);
    assert.ok(heads()[0].querySelector('.bl-pf-all').classList.contains('bl-pf-lit'));
    heads()[0].querySelector('.bl-pf-all').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.ok(['p2', 'p3', 'p4', 'p5'].every(id => !order.find(e => e.identifier === id).enabled), '다 켜져 있으면 모두 끄기');
    settings.promptFolders.presets.P1.folders.find(f => f.id === 'fb').pick = true; drawList(); await settle();
    const fbHead = heads().find(h => h.dataset.pfId === 'fb');
    assert.match(fbHead.querySelector('.bl-pf-count').textContent, /^\d\/3 · 택1$/, '구분선 줄(p9)은 켜진 수에서 빠짐');
    const s1 = calls.save;
    fbHead.querySelector('.bl-pf-all').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.ok(['p10', 'p11', 'p12'].every(id => !order.find(e => e.identifier === id).enabled), '택1 폴더 = 끄기');
    assert.equal(order.find(e => e.identifier === 'p9').enabled, false, '구분선 줄은 건드리지 않음(처음 꺼짐 그대로)');
    assert.equal(calls.save - s1, 1);
    const s2 = calls.save;
    heads().find(h => h.dataset.pfId === 'fb').querySelector('.bl-pf-all').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(calls.save, s2, '다 꺼진 택1 폴더는 아무것도 안 함');
});
await test('폴더 택1이 택1 클릭 연결에 더해져요(prompt-choice setFolderSource) — 하나를 켜면 같은 폴더의 다른 것을 꺼요', async () => {
    const pc = await import(url('src/prompt-choice.js'));
    let handler = null;
    const off = pc.bindPromptChoices({ addEventListener: (n, fn) => { handler = fn; }, removeEventListener() {} }, () => ({ ...pmStub, containerElement: { contains: () => true }, getTokenHandler: () => pmStub.tokenHandler }));
    order.find(e => e.identifier === 'p10').enabled = true;
    const toggle = { closest: () => ({ dataset: { pmIdentifier: 'p12' } }) };
    handler({ target: { closest: () => toggle } });
    assert.equal(order.find(e => e.identifier === 'p10').enabled, false);
    off();
});
await test('버그 사냥 9: 폴더 메뉴는 뒤로 가기 겹을 올려요 — 뒤로 가기 = 메뉴만 닫기 · ✕ 로 닫으면 기록도 물러나요', async () => {
    const stack = [null]; let at = 0; const pops = [];
    const fire = () => { for (const fn of pops) fn({ type: 'popstate', state: stack[at] }); };
    const keepH = globalThis.history, keepAdd = globalThis.addEventListener;
    globalThis.history = { get state() { return stack[at]; }, pushState(s) { stack.length = at + 1; stack.push(s); at++; }, go(n) { at = Math.max(0, at + n); setTimeout(fire, 0); } };
    globalThis.addEventListener = (type, fn, opt) => { if (type === 'popstate') pops.push(fn); else keepAdd?.call(globalThis, type, fn, opt); };
    try {
        const depth = () => Number(stack[at]?.blLayer) || 0;
        const more = () => heads().find(h => h.dataset.pfId === 'fc').querySelector('.bl-pf-more').dispatchEvent(new Event('click', { bubbles: true }));
        more(); assert.ok(document.querySelector('.bl-pf-layer'), '메뉴 층'); assert.equal(depth(), 1, '메뉴를 열면 기록 한 칸');
        at--; fire(); await settle();
        assert.ok(!document.querySelector('.bl-pf-layer'), '뒤로 가기에 메뉴만 닫혀요'); assert.equal(depth(), 0);
        more(); assert.equal(depth(), 1);
        document.dispatchEvent(new Event('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
        assert.ok(!document.querySelector('.bl-pf-layer')); assert.equal(depth(), 0, 'Esc 로 닫으면 남는 칸 없이 물러나요');
    } finally { globalThis.history = keepH; globalThis.addEventListener = keepAdd; }
});
await test('폴더 메뉴(공용 고르기 목록 팝업) → 「폴더 풀기」 → 알림의 되돌리기로 그대로 돌아와요', async () => {
    const toastBox = document.createElement('div'); const msg = document.createElement('div'); msg.className = 'toast-message'; toastBox.append(msg);
    let toastText = ''; globalThis.toastr.info = text => { toastText = text; return [toastBox]; };
    const before = JSON.stringify(settings.promptFolders.presets.P1.folders.map(f => f.id));
    heads().find(h => h.dataset.pfId === 'fc').querySelector('.bl-pf-more').dispatchEvent(new Event('click', { bubbles: true }));
    const layer = document.querySelector('.salty-pick-layer.bl-pf-layer');
    assert.ok(layer, '메뉴 층'); assert.equal(layer.querySelector('[role="menu"]')?.classList.contains('salty-pick-float'), true);
    const labels = [...layer.querySelectorAll('button')].map(b => b.textContent);
    assert.deepEqual(labels, ['이 폴더 고치기', '안에 새 폴더', '하나만 켜기', '한곳에 모으기', '폴더 풀기'], '떨어진 폴더라 「한곳에 모으기」가 있어요');
    assert.equal(layer.querySelector('[role="menuitemcheckbox"]').getAttribute('aria-checked'), 'false');
    [...layer.querySelectorAll('button')].find(b => b.textContent === '폴더 풀기').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.ok(!document.querySelector('.bl-pf-layer'), '고르면 닫혀요');
    assert.ok(!settings.promptFolders.presets.P1.folders.some(f => f.id === 'fc'));
    assert.ok(!heads().some(h => h.dataset.pfId === 'fc'));
    assert.match(toastText, /「떨어짐」 폴더를 풀었어요/);
    msg.querySelector('.bl-toast-undo').dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.equal(JSON.stringify(settings.promptFolders.presets.P1.folders.map(f => f.id)), before);
    assert.equal(heads().filter(h => h.dataset.pfId === 'fc').length, 2);
});
await test('하위 폴더 머리: 들여 그리고 접힌 위 폴더 안이면 숨김 · 위 폴더 숫자는 하위까지', async () => {
    const folders = settings.promptFolders.presets.P1.folders;
    folders.push({ id: 'fs', name: '안쪽', ids: ['p6', 'p7'], open: true, parent: 'fa' });
    drawList(); await settle();
    const sub = heads().find(h => h.dataset.pfId === 'fs');
    assert.ok(sub.classList.contains('bl-pf-sub')); assert.ok(row('p6').classList.contains('bl-pf-in2'));
    assert.match(heads().find(h => h.dataset.pfId === 'fa').querySelector('.bl-pf-count').textContent, /\/6$/, '위 폴더는 하위까지 6개');
    settings.promptFolders.presets.P1.open.fa = false; drawList(); await settle();
    assert.ok(heads().find(h => h.dataset.pfId === 'fs').classList.contains('bl-pf-hide')); assert.ok(row('p7').classList.contains('bl-pf-hide'));
    assert.deepEqual(toArray(), order.map(e => e.identifier));
    settings.promptFolders.presets.P1.folders = settings.promptFolders.presets.P1.folders.filter(f => f.id !== 'fs'); settings.promptFolders.presets.P1.open.fa = true; drawList(); await settle();
});
await test('프리셋 파일의 폴더: 내 폴더가 없으면 초깃값 · 없는 항목은 조용히 건너뜀 · 고치면 테마 설정 우선 · 다 풀어도 안 되살아남 · 프리셋 파일에는 안 씀', async () => {
    preset = 'P3'; pmStub.serviceSettings.extensions = { blPromptFolders: { version: 1, folders: [{ id: 's1', name: '씨앗', ids: ['p30', 'p31', 'no-such'], open: true }] } };
    const fileBefore = JSON.stringify(pmStub.serviceSettings.extensions);
    await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.deepEqual(heads().map(h => h.dataset.pfId), ['s1']);
    assert.match(heads()[0].querySelector('.bl-pf-count').textContent, /\/2$/, '없는 항목은 세지 않아요');
    assert.equal(settings.promptFolders.presets.P3, undefined, '보기만 하면 설정에 안 적어요');
    heads()[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(settings.promptFolders.presets.P3.open.s1, false, '접힘은 테마 설정의 보기 상태로');
    assert.equal(settings.promptFolders.presets.P3.folders, undefined, '1.5.2 접기만 해서는 식구를 굳히지 않아요');
    pmStub.serviceSettings.extensions.blPromptFolders.folders[0].name = '바뀐 프리셋'; drawList(); await settle();
    assert.equal(heads()[0].querySelector('.bl-pf-title').textContent, '바뀐 프리셋', '손 안 댄 폴더는 프리셋 파일을 따라가요');
    assert.ok(heads()[0].classList.contains('bl-pf-closed'), '접힘은 그대로');
    pmStub.serviceSettings.extensions.blPromptFolders.folders[0].name = '씨앗';
    heads()[0].querySelector('.bl-pf-more').dispatchEvent(new Event('click', { bubbles: true }));
    [...document.querySelectorAll('.bl-pf-layer button')].find(b => b.textContent === '폴더 풀기').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(heads().length, 0, '다 풀면 초깃값이 되살아나지 않아요');
    assert.deepEqual(settings.promptFolders.presets.P3.folders, []);
    assert.deepEqual(settings.promptFolders.presets.P3.base?.ids, ['p30', 'p31', 'no-such'], '1.5.2 그때 파일 폴더를 기억해요');
    drawList(); await settle();
    assert.equal(heads().length, 0, '같은 파일이면 다시 그려도 안 되살아나요');
    assert.equal(JSON.stringify(pmStub.serviceSettings.extensions), fileBefore, '프리셋 칸에 쓰지 않아요');
    // 1.1.3 같은 이름의 새 판 프리셋 파일이 다른 폴더를 들고 오면 받아요 (예전엔 빈 칸이 막았어요)
    pmStub.serviceSettings.extensions = { blPromptFolders: { version: 1, folders: [{ id: 's2', name: '새 판 폴더', ids: ['p30', 'p31'], open: true }] } };
    drawList(); await settle();
    assert.deepEqual(heads().map(h => h.dataset.pfId), ['s2'], '새 판 파일의 폴더');
    // 지문이 없는 옛 빈 칸(1.1.2 까지 다 푼 것)은 예전처럼 그대로
    settings.promptFolders.presets.P3 = { folders: [] };
    drawList(); await settle();
    assert.equal(heads().length, 0, '옛 빈 칸은 그대로');
    delete settings.promptFolders.presets.P3;
    pmStub.serviceSettings.extensions = {}; preset = 'P1'; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
});
// 1.5.2 솔라 「분량 · 리듬」이 네 번 쪼개진 꼴: 위 폴더(p40 머리 · p48 · p49) 안의 하위 「분량」(택1)이 새 판에서 셋 → 일곱
const seedFile = sIds => ({ blPromptFolders: { version: 1, folders: [
    { id: 'f16', name: '분량 · 리듬', ids: ['p40', 'p48', 'p49'], open: true },
    { id: 'f17', name: '분량', ids: sIds, open: true, pick: true, parent: 'f16' },
] } });
const SEVEN = ['p41', 'p42', 'p43', 'p44', 'p45', 'p46', 'p47'];
const headsOf = id => heads().filter(h => h.dataset.pfId === id);
const usePreset = async (name, extensions) => { preset = name; pmStub.serviceSettings.extensions = extensions; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle(); };
const restoreToast = { text: '', count: 0, undo: null };
const watchToast = () => {
    const box = document.createElement('div'), msg = document.createElement('div'); msg.className = 'toast-message'; box.append(msg);
    restoreToast.undo = () => msg.querySelector('.bl-toast-undo').dispatchEvent(new Event('click', { bubbles: true }));
    globalThis.toastr.info = text => { restoreToast.text = text; restoreToast.count++; return [box]; };
};
watchToast();
await test('1.5.2 굳은 옛 설정 + 식구가 늘어난 새 판: 머리 1 · 하위 머리 1 · 식구 7/7 · 택1 숫자와 택1 지킴이도 일곱 전부', async () => {
    settings.promptFolders.presets.P6 = { folders: [
        { id: 'f16', name: '분량 · 리듬', ids: ['p40', 'p48', 'p49'], open: true },
        { id: 'f17', name: '분량', ids: ['p42', 'p45', 'p46'], open: true, pick: true, parent: 'f16' },
    ] };
    await usePreset('P6', seedFile(SEVEN));
    assert.match(restoreToast.text, /다시 채웠어요: 「분량」 4개\(항목 41 · 항목 43 · 항목 44 · 항목 47\)\. 예전에 일부러 폴더에서 뺀 항목이면 되돌리기/, '한 번 알림');
    assert.equal(restoreToast.count, 1);
    drawList(); await settle();
    assert.equal(restoreToast.count, 1, '다시 그려도 또 묻지 않아요');
    assert.equal(headsOf('f16').length, 1, '위 폴더 머리 하나');
    assert.equal(headsOf('f17').length, 1, '하위 폴더 머리 하나');
    assert.match(headsOf('f17')[0].querySelector('.bl-pf-count').textContent, /^\d\/7 · 택1$/, '택1 숫자가 식구 일곱 전부');
    assert.ok(SEVEN.every(id => row(id).classList.contains('bl-pf-in2')), '일곱 모두 하위 폴더 안');
    // 1.5.3 합친 항목이 있으면 처음 그릴 때 한 번 알리고(되돌리기 단추) 옮긴 칸을 저장해 다시 묻지 않아요
    assert.equal(settings.promptFolders.presets.P6.v, 2, '알린 순간 옮긴 칸을 저장');
    assert.deepEqual(settings.promptFolders.presets.P6.restored, { f17: ['p41', 'p43', 'p44', 'p47'] });
    // 택1 지킴이(prompt-choice)도 새 식구까지 — p41 이 켜진 채 새 식구 p47 을 켜면 p41 이 꺼져요
    const pc = await import(url('src/prompt-choice.js'));
    let handler = null;
    const off = pc.bindPromptChoices({ addEventListener: (n, fn) => { handler = fn; }, removeEventListener() {} }, () => ({ ...pmStub, containerElement: { contains: () => true }, getTokenHandler: () => pmStub.tokenHandler }));
    for (const id of SEVEN) order.find(e => e.identifier === id).enabled = id === 'p41';
    handler({ target: { closest: () => ({ closest: () => ({ dataset: { pmIdentifier: 'p47' } }) }) } });
    assert.equal(order.find(e => e.identifier === 'p41').enabled, false);
    off();
});
await test('1.5.2 접기 · 펼치기만 한 뒤 프리셋 새 판: 새 항목이 폴더 안(식구는 저장하지 않고 보기 상태만)', async () => {
    await usePreset('P7', seedFile(['p41', 'p42', 'p43']));
    assert.equal(headsOf('f16').length, 2, '바탕: 셋뿐이라 p44~p47 이 끼어 위 폴더가 이어서로 갈라져요');
    headsOf('f17')[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    headsOf('f17')[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(settings.promptFolders.presets.P7.folders, undefined, '식구를 굳히지 않아요');
    assert.equal(settings.promptFolders.presets.P7.open.f17, true);
    pmStub.serviceSettings.extensions = seedFile(SEVEN); drawList(); await settle();   // 같은 이름 프리셋의 새 판으로 덮어씀
    assert.equal(headsOf('f16').length, 1); assert.equal(headsOf('f17').length, 1);
    assert.ok(row('p47').classList.contains('bl-pf-in2'), '새 항목이 폴더 안');
});
await test('1.5.2 「이 폴더 고치기」로 뺀 항목은 새 판에서도 밖 · 새 판이 새로 더한 항목은 안', async () => {
    await usePreset('P8', seedFile(['p41', 'p42', 'p43', 'p44', 'p45', 'p46']));
    headsOf('f17')[0].querySelector('.bl-pf-more').dispatchEvent(new Event('click', { bubbles: true }));
    [...document.querySelectorAll('.bl-pf-layer button')].find(b => b.textContent === '이 폴더 고치기').dispatchEvent(new Event('click', { bubbles: true }));
    const editor = document.querySelector('dialog.bl-pf-editor');
    editor.querySelector('.bl-pf-left .bl-pf-item[data-id="p43"] [data-pf-item="out"]').dispatchEvent(new Event('click', { bubbles: true }));
    editor.querySelector('[data-card-done]').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.ok(!settings.promptFolders.presets.P8.folders.find(f => f.id === 'f17').ids.includes('p43'));
    pmStub.serviceSettings.extensions = seedFile(SEVEN); drawList(); await settle();
    assert.ok(!row('p43').classList.contains('bl-pf-in2'), '뺀 것은 새 판에서도 밖');
    assert.ok(row('p47').classList.contains('bl-pf-in2'), '새 판이 더한 것은 안');
});
await test('1.5.3 알림의 되돌리기: 합친 항목만 다시 밖(일부러 뺀 사용자) · 그 뒤 새 판이 더한 항목은 안 · 다시 묻지 않음', async () => {
    restoreToast.count = 0; watchToast();
    settings.promptFolders.presets.P10 = { folders: [
        { id: 'f16', name: '분량 · 리듬', ids: ['p40', 'p48', 'p49'], open: true },
        { id: 'f17', name: '분량', ids: ['p41', 'p42', 'p44', 'p45', 'p46'], open: true, pick: true, parent: 'f16' },
    ] };   // 1.5.1 에서 p43 을 일부러 뺀 사람 · 파일은 여섯(p41~p46)
    await usePreset('P10', seedFile(['p41', 'p42', 'p43', 'p44', 'p45', 'p46']));
    assert.equal(restoreToast.count, 1);
    assert.ok(row('p43').classList.contains('bl-pf-in2'), '알림 전까지는 합쳐 보여요');
    restoreToast.undo(); await settle();
    assert.ok(!row('p43').classList.contains('bl-pf-in2'), '되돌리면 뺀 항목은 다시 밖');
    assert.equal(settings.promptFolders.presets.P10.restored, undefined);
    pmStub.serviceSettings.extensions = seedFile(SEVEN); drawList(); await settle();   // 새 판이 p47 을 더함
    assert.ok(!row('p43').classList.contains('bl-pf-in2'), '새 판에서도 밖');
    assert.ok(row('p47').classList.contains('bl-pf-in2'), '새 판이 새로 더한 것은 안');
    assert.equal(restoreToast.count, 1, '다시 묻지 않아요');
});
await test('1.5.3 이미 1.5.2 에서 옮김을 지난 칸(합쳐진 채 저장 · 기록 없음): 알림은 없고, 사용자가 한 번 다시 빼면 그 뒤 새 판에서도 밖', async () => {
    restoreToast.count = 0; watchToast();
    const seed6 = seedFile(['p41', 'p42', 'p43', 'p44', 'p45', 'p46']);
    const seedList = core.readPresetFolders(seed6);
    settings.promptFolders.presets.P11 = { v: 2, open: { f16: true, f17: true }, folders: seedList.map(({ open, ...f }) => f), base: core.seedBase(seedList) };
    await usePreset('P11', seed6);
    assert.equal(restoreToast.count, 0, '1.5.2 칸은 합친 기록이 없어 알리지 않아요');
    assert.ok(row('p43').classList.contains('bl-pf-in2'), '돌아온 채로 보여요');
    headsOf('f17')[0].querySelector('.bl-pf-more').dispatchEvent(new Event('click', { bubbles: true }));
    [...document.querySelectorAll('.bl-pf-layer button')].find(b => b.textContent === '이 폴더 고치기').dispatchEvent(new Event('click', { bubbles: true }));
    const editor = document.querySelector('dialog.bl-pf-editor');
    editor.querySelector('.bl-pf-left .bl-pf-item[data-id="p43"] [data-pf-item="out"]').dispatchEvent(new Event('click', { bubbles: true }));
    editor.querySelector('[data-card-done]').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    pmStub.serviceSettings.extensions = seedFile(SEVEN); drawList(); await settle();
    assert.ok(!row('p43').classList.contains('bl-pf-in2'), '다시 뺀 것은 새 판에서도 밖');
    assert.ok(row('p47').classList.contains('bl-pf-in2'), '새 판이 더한 것은 안');
    pmStub.serviceSettings.extensions = seed6; drawList(); await settle();
    assert.ok(!row('p43').classList.contains('bl-pf-in2'), '같은 판으로 돌아가도 밖');
    for (const key of ['P10', 'P11']) delete settings.promptFolders.presets[key];
});
await test('1.5.2 식구 0 인 「이어서」 머리는 그리지 않아요(위 폴더 이어서 밑이 하위 폴더 머리뿐일 때) · 위 폴더를 접으면 그 자리에 접힌 머리', async () => {
    await usePreset('P9', { blPromptFolders: { version: 1, folders: [
        { id: 'u', name: '위', ids: ['p30', 'p31'], open: true },
        { id: 'k', name: '안', ids: ['p33', 'p34'], open: true, parent: 'u' },
    ] } });
    assert.deepEqual(heads().map(h => [h.dataset.pfId, h.dataset.pfPart]), [['u', '0'], ['k', '0']], '위 0 · 안 0 — 빈 「위 · 이어서」 없음');
    assert.ok(!heads().some(h => /이어서/.test(h.textContent)));
    const proto = Object.getPrototypeOf(heads()[0]), focus0 = proto.focus; let focused = null;
    proto.focus = function () { focused = this; };
    heads()[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    proto.focus = focus0;
    assert.deepEqual(heads().map(h => [h.dataset.pfId, h.dataset.pfPart]), [['u', '0'], ['u', '1'], ['k', '0']], '접으면 숨은 식구 자리를 알리는 접힌 이어서 머리');
    assert.ok(headsOf('k')[0].classList.contains('bl-pf-hide')); assert.ok(row('p33').classList.contains('bl-pf-hide'));
    assert.equal(focused, heads()[0].querySelector('.bl-pf-name'), '다시 그려도 누른 머리에 초점이 돌아가요');
    heads()[0].querySelector('.bl-pf-name').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(headsOf('u').length, 1);
    for (const key of ['P6', 'P7', 'P8', 'P9']) delete settings.promptFolders.presets[key];
    await usePreset('P1', {});
    assert.equal(heads().length, 4);
});
// 원작 1.4.4 와 같은 꼴(11-15 원작 따라가기): 폴더가 하나도 없는 프리셋 · 프리셋 파일 폴더만 있는 프리셋에서 창을 연 채 실리태번이 목록을 다시 그려도
//   저장이 설정에 남아야 해요. 테마는 창 안에서 사본만 고치고 저장할 때 그 프리셋 칸에 새로 써서, 그 사이 칸이 바뀌어도 잃지 않아요.
await test('창을 연 채 목록이 다시 그려져도 저장이 남아요: 폴더 없는 프리셋의 새 폴더 · 프리셋 파일 폴더만 있는 프리셋 고치기', async () => {
    const editor = () => document.querySelector('dialog.bl-pf-editor');
    const tools = () => { footer.querySelector('.bl-pf-tools').dispatchEvent(new Event('click', { bubbles: true })); return [...document.querySelectorAll('.bl-pf-layer button')]; };
    const press = (buttons, label) => buttons.find(b => b.textContent === label).dispatchEvent(new Event('click', { bubbles: true }));
    preset = 'P4'; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.equal(heads().length, 0); assert.equal(settings.promptFolders.presets.P4, undefined);
    press(tools(), '새 폴더');
    assert.ok(editor()?.open, '새 폴더 창');
    editor().querySelector('[data-pf-name]').value = '새 묶음';
    editor().querySelector('[data-pf-name]').dispatchEvent(new Event('input', { bubbles: true }));
    for (const id of ['p40', 'p41']) editor().querySelector(`.bl-pf-right .bl-prompt-card-choice[data-id="${id}"]`).dispatchEvent(new Event('click', { bubbles: true }));
    drawList(); await settle();   // 창이 열린 동안 실리태번이 목록을 다시 그림(입히기가 그 프리셋 칸을 다시 읽음)
    editor().querySelector('[data-card-done]').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.ok(!editor(), '닫혀요');
    assert.deepEqual(settings.promptFolders.presets.P4?.folders?.map(f => [f.name, f.ids]), [['새 묶음', ['p40', 'p41']]], '설정에 남아요');
    assert.deepEqual(heads().map(h => h.querySelector('.bl-pf-title').textContent), ['새 묶음']);
    preset = 'P5'; pmStub.serviceSettings.extensions = { blPromptFolders: { version: 1, folders: [{ id: 's5', name: '파일 폴더', ids: ['p50', 'p51'], open: true }] } };
    await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.equal(settings.promptFolders.presets.P5, undefined, '보기만 하면 설정에 안 적어요');
    press(tools(), '모든 폴더 고치기');
    editor().querySelector('[data-pf-name]').value = '고친 이름';
    editor().querySelector('[data-pf-name]').dispatchEvent(new Event('input', { bubbles: true }));
    drawList(); await settle();
    editor().querySelector('[data-card-done]').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(settings.promptFolders.presets.P5?.folders?.[0]?.name, '고친 이름', '프리셋 파일 폴더를 고친 것도 설정에 남아요');
    assert.equal(heads()[0]?.querySelector('.bl-pf-title').textContent, '고친 이름');
    assert.equal(pmStub.serviceSettings.extensions.blPromptFolders.folders[0].name, '파일 폴더', '프리셋 파일은 그대로');
    delete settings.promptFolders.presets.P4; delete settings.promptFolders.presets.P5;
    pmStub.serviceSettings.extensions = {}; preset = 'P1'; await eventSource.emit(ctx.event_types.OAI_PRESET_CHANGED_AFTER); drawList(); await settle();
    assert.equal(heads().length, 4);
});
// 원작 1.4.3 과 같은 꼴(11-15 원작 따라가기): 테마가 프롬프트 줄에 display 를 !important 로 걸면 숨긴 줄이 다시 보일 수 있어요.
//   테마 폴더는 줄을 복제하지 않고 제자리에 둔 채 클래스로만 숨겨서, 숨김 규칙이 줄 display 규칙보다 늘 이겨야 해요.
await test('접힌 폴더 숨김이 테마의 줄 display 규칙(!important)보다 이겨요 · 줄은 복제하지 않아요', () => {
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
    const splitTop = s => { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
    // 단순 선택자 특이도 [id, class, type] — :is · :not · :has 는 안쪽 가장 큰 것, :where 와 가상 요소 글자는 0
    const spec = sel => {
        const n = [0, 0, 0];
        let s = sel.replace(/::[\w-]+/g, '');
        s = s.replace(/:(is|not|has|where)\(((?:[^()]|\([^()]*\))*)\)/g, (_, fn, inner) => {
            if (fn !== 'where') { const best = splitTop(inner).map(spec).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0]; n[0] += best[0]; n[1] += best[1]; n[2] += best[2]; }
            return ' ';
        });
        n[0] += (s.match(/#[\w-]+/g) || []).length;
        n[1] += (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length;
        n[2] += (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|:[\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
        return n;
    };
    const beats = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    const rules = file => [...strip(fs.readFileSync(file, 'utf8')).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sels: splitTop(m[1].trim()), body: m[2], file: path.basename(file) }));
    const hide = rules(path.join(root, 'src/prompt-folders.css')).find(r => r.sels.some(s => s.endsWith('.bl-pf-hide')) && /display:\s*none\s*!important/.test(r.body));
    assert.ok(hide, '숨김 규칙(display: none !important)');
    const hideSpec = hide.sels.map(spec).sort((a, b) => beats(a, b))[0];
    const cssDir = path.join(root, 'css');
    const rivals = fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).flatMap(f => rules(path.join(cssDir, f)))
        .filter(r => /(^|;)\s*display:\s*(?!none)[\w-]+\s*!important/.test(r.body))
        .flatMap(r => r.sels.filter(s => /completion_prompt_manager_prompt\b/.test(s.split(/[\s>+~]+/).pop() || '')).map(s => ({ s, file: r.file, n: spec(s) })));
    assert.ok(rivals.length >= 1, '테마의 줄 display 규칙을 찾아요(css/14)');
    for (const r of rivals) assert.ok(beats(hideSpec, r.n) > 0, `${r.file}: ${r.s} [${r.n}] 보다 숨김 [${hideSpec}] 이 세야 해요`);
    const js = fs.readFileSync(path.join(root, 'src/prompt-folders.js'), 'utf8');
    assert.ok(!/cloneNode\(/.test(js), '프롬프트 줄을 복제하지 않아요(실리태번 단추 · 다른 확장 표시가 그대로)');
});
// 1.0.2: 순서를 바꿔 쓰는 동작(한곳에 모으기 · 폴더째 옮기기)을 실제로 반영하는 가짜
pmStub.addPromptOrderForCharacter = (_, next) => { order.splice(0, order.length, ...next); };
const toastOf = () => {
    const box = document.createElement('div'), msg = document.createElement('div'); msg.className = 'toast-message'; box.append(msg);
    const got = { text: '', undo: () => msg.querySelector('.bl-toast-undo').dispatchEvent(new Event('click', { bubbles: true })) };
    globalThis.toastr.info = text => { got.text = text; return [box]; };
    return got;
};
const menuOf = id => { heads().find(h => h.dataset.pfId === id).querySelector('.bl-pf-more').dispatchEvent(new Event('click', { bubbles: true })); return [...document.querySelectorAll('.bl-pf-layer button')]; };
const pick = (buttons, label) => buttons.find(b => b.textContent === label).dispatchEvent(new Event('click', { bubbles: true }));
const idsNow = () => order.map(e => e.identifier);
await test('1.0.2 폴더째 위 · 아래로: 옮길 수 있을 때만 메뉴에 · 보이는 한 칸과 자리 바꿈 · 실리태번 저장 한 번 · 되돌리기', async () => {
    const start = idsNow(), s0 = calls.save;
    const labels = menuOf('fa').map(b => b.textContent);
    assert.deepEqual(labels, ['이 폴더 고치기', '안에 새 폴더', '하나만 켜기', '위로 옮기기', '아래로 옮기기', '폴더 풀기']);
    const t = toastOf();
    pick(menuOf('fa'), '위로 옮기기'); await settle();
    assert.deepEqual(idsNow().slice(0, 7), ['p0', 'p2', 'p3', 'p4', 'p5', 'p1', 'p6'], '바로 위 p1 과 자리 바꿈');
    assert.equal(calls.save - s0, 1, '저장 한 번');
    assert.match(t.text, /「문체」 폴더를 위로 옮겼어요\. 보내는 순서도 바뀌었어요\./);
    assert.deepEqual(toArray(), idsNow(), '목록 = 실제 순서');
    assert.equal(heads()[0].nextElementSibling, row('p2'));
    assert.deepEqual(settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa').ids, ['p2', 'p3', 'p4', 'p5'], '소속은 그대로(끌어 옮김으로 보지 않아요)');
    t.undo(); await settle();
    assert.deepEqual(idsNow(), start, '되돌리기');
    assert.ok(!menuOf('fc').some(b => /옮기기/.test(b.textContent)), '떨어진 폴더는 옮기기 없음(먼저 한곳에 모으기)');
    document.dispatchEvent(new Event('keydown')); document.querySelector('.bl-pf-layer')?.remove();
});
await test('1.0.2 하위 폴더를 풀면 항목은 위 폴더로 올라가요(빠지지 않음) · 되돌리기', async () => {
    const folders = settings.promptFolders.presets.P1.folders;
    folders.push({ id: 'fs', name: '안쪽', ids: ['p6', 'p8'], open: true, pick: false, parent: 'fa' });
    drawList(); await settle();
    assert.ok(heads().some(h => h.dataset.pfId === 'fs'));
    const t = toastOf();
    pick(menuOf('fs'), '폴더 풀기'); await settle();
    const fa = settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa');
    assert.deepEqual(fa.ids, ['p2', 'p3', 'p4', 'p5', 'p6', 'p8'], '위 폴더로 · 실제 순서대로');
    assert.ok(!settings.promptFolders.presets.P1.folders.some(f => f.id === 'fs'));
    assert.match(t.text, /「안쪽」 폴더를 풀었어요\. 항목은 「문체」 폴더로 올라갔어요\./);
    assert.ok(row('p8').classList.contains('bl-pf-in'), '위 폴더 안 줄로 그려요');
    t.undo(); await settle();
    assert.ok(settings.promptFolders.presets.P1.folders.some(f => f.id === 'fs'));
    settings.promptFolders.presets.P1.folders = settings.promptFolders.presets.P1.folders.filter(f => f.id !== 'fs');
    settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa').ids = ['p2', 'p3', 'p4', 'p5'];
    drawList(); await settle();
});
await test('1.0.2 다 꺼진 폴더 머리는 옅게 · 모두 켜기 되돌리기 · 「하나만 켜기」 되돌리면 택1 표시도 풀려요', async () => {
    const fa = () => settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa');
    const lit = () => ['p2', 'p3', 'p4', 'p5'].filter(id => order.find(e => e.identifier === id).enabled);
    assert.deepEqual(lit(), []); assert.ok(heads()[0].classList.contains('bl-pf-off'), '0/4 = 옅게');
    const t = toastOf();
    heads()[0].querySelector('.bl-pf-all').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(lit().length, 4); assert.ok(!heads()[0].classList.contains('bl-pf-off'));
    assert.match(t.text, /「문체」 4개를 켰어요\./);
    t.undo(); await settle();
    assert.deepEqual(lit(), [], '되돌리면 다시 다 꺼짐'); assert.ok(heads()[0].classList.contains('bl-pf-off'));
    heads()[0].querySelector('.bl-pf-all').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    const t2 = toastOf();
    pick(menuOf('fa'), '하나만 켜기'); await settle();
    assert.equal(fa().pick, true); assert.deepEqual(lit(), ['p2']);
    assert.match(t2.text, /만 남기고 껐어요/);
    t2.undo(); await settle();
    assert.equal(fa().pick, false, '택1 표시도 풀려요'); assert.equal(lit().length, 4);
    for (const id of ['p2', 'p3', 'p4', 'p5']) order.find(e => e.identifier === id).enabled = id !== 'p3';
    drawList(); await settle();
});
await test('1.0.2 편집 창: 바뀐 게 없이 저장을 누르면 설정을 저장하지 않고 닫기만 · 바꾸면 저장', async () => {
    let saves = 0; const keep = ctx.saveSettingsDebounced; ctx.saveSettingsDebounced = () => { saves++; };
    const was = JSON.stringify(settings.promptFolders.presets.P1.folders);
    pick(menuOf('fa'), '이 폴더 고치기');
    let dlg = document.querySelector('dialog.bl-pf-editor');
    assert.ok(dlg?.open, '편집 창이 열려요');
    dlg.querySelector('[data-card-done]').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(saves, 0, '저장 안 함'); assert.ok(!document.querySelector('dialog.bl-pf-editor'), '닫혀요');
    assert.equal(JSON.stringify(settings.promptFolders.presets.P1.folders), was);
    pick(menuOf('fa'), '이 폴더 고치기');
    dlg = document.querySelector('dialog.bl-pf-editor');
    dlg.querySelector('[data-pf-name]').value = '문체 새 이름';
    dlg.querySelector('[data-card-done]').dispatchEvent(new Event('click', { bubbles: true })); await settle();
    assert.equal(saves, 1, '이름을 바꾸면 저장');
    settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa').name = '문체';
    ctx.saveSettingsDebounced = keep; drawList(); await settle();
});
const win = () => document.querySelector('dialog.bl-pf-editor');
const click = el => el.dispatchEvent(new Event('click', { bubbles: true }));
const secs = () => [...win().querySelectorAll('.bl-pf-sec')];
const itemIds = folder => [...win().querySelectorAll(`.bl-pf-item[data-folder="${folder}"]`)].map(el => el.dataset.id);
const rightRow = id => win().querySelector(`.bl-pf-right .bl-prompt-card-choice[data-id="${id}"]`);
const toolsMenu = () => { footer.querySelector('.bl-pf-tools').dispatchEvent(new Event('click', { bubbles: true })); return [...document.querySelectorAll('.bl-pf-layer button')]; };
await test('1.0.3 도구 줄 「모든 폴더 고치기」: 모든 폴더를 한 창에(실제 순서대로 접는 줄) · 「모든 항목」은 프롬프트 전부 · 눌러 넣으면 다른 폴더에서 옮겨 와요 · 순서가 그대로면 알림 없이 저장', async () => {
    const menuButtons = toolsMenu();
    assert.deepEqual(menuButtons.map(b => b.textContent).slice(0, 3), ['새 폴더', '모든 폴더 고치기', '구분선으로 폴더 만들기']);
    pick(menuButtons, '모든 폴더 고치기');
    assert.ok(win()?.open); assert.equal(win().querySelector('h3').textContent, '모든 폴더 고치기');
    assert.deepEqual(secs().map(b => b.dataset.pfSec), ['fa', 'fb', 'fc']);
    assert.equal(secs()[0].getAttribute('aria-current'), 'true', '첫 폴더를 골라 둬요');
    assert.deepEqual(itemIds('fa'), ['p2', 'p3', 'p4', 'p5']);
    assert.equal(win().querySelectorAll('.bl-pf-right .bl-prompt-card-choice').length, N, '모든 항목');
    assert.equal(win().querySelector('.bl-pf-item[data-id="p2"] > span').className, '', '보통 이름은 전처럼 줄을 바꿔 다 보여요');
    const css = fs.readFileSync(path.join(root, 'src/prompt-folders.css'), 'utf8');
    assert.match(css, /\.bl-pf-item > span\.bl-pf-rule \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/, '구분선 이름은 한 줄(폰 360 에서 선이 두 줄로 꺾이던 것)');
    assert.match(rightRow('p9').textContent, /지금 「시점」 폴더/);
    click(secs()[2]);   // 「떨어짐」을 고르고
    assert.equal(win().querySelector('[data-pf-name]').value, '떨어짐');
    click(rightRow('p5'));   // 「문체」에 있던 p5 를 넣으면 옮겨 와요
    assert.deepEqual(itemIds('fc'), ['p5', 'p20', 'p22']); assert.deepEqual(itemIds('fa'), ['p2', 'p3', 'p4']);
    assert.equal(win().querySelector('[role="status"]').textContent, '「떨어짐」에 넣어요');
    assert.match(secs()[2].querySelector('small').textContent, /^3( · 택1)?$/, '목록 머리와 같은 수');
    const t = toastOf(); t.text = '';
    click(win().querySelector('[data-card-done]')); await settle();
    assert.ok(!win(), '닫혀요');
    const saved = settings.promptFolders.presets.P1.folders;
    assert.deepEqual(saved.find(f => f.id === 'fc').ids, ['p5', 'p20', 'p22']); assert.deepEqual(saved.find(f => f.id === 'fa').ids, ['p2', 'p3', 'p4']);
    assert.equal(t.text, '', '순서가 그대로면 알림 없음');
    saved.find(f => f.id === 'fc').ids = ['p20', 'p22']; saved.find(f => f.id === 'fa').ids = ['p2', 'p3', 'p4', 'p5'];
    drawList(); await settle();
});
await test('1.0.3 「이 폴더 고치기」: 그 폴더와 안의 하위 폴더만 · 하위 폴더는 같은 창 안의 접는 줄 · 이름 · 하나만 켜기 · 빼기 · 되돌리기', async () => {
    const folders = settings.promptFolders.presets.P1.folders;
    folders.push({ id: 'fs', name: '안쪽', ids: ['p6', 'p7'], open: true, pick: false, parent: 'fa' });
    drawList(); await settle();
    pick(menuOf('fa'), '이 폴더 고치기');
    assert.equal(win().querySelector('h3').textContent, '「문체」 고치기');
    assert.deepEqual(secs().map(b => [b.dataset.pfSec, b.classList.contains('bl-pf-d1')]), [['fa', false], ['fs', true]], '하위는 들여 쓴 접는 줄');
    assert.ok(!win().querySelector('[data-pf-sec="fb"]'), '다른 폴더는 안 보여요');
    assert.equal(win().querySelectorAll('.bl-pf-right .bl-prompt-card-choice').length, N, '「모든 항목」은 그대로 전부');
    click(secs()[1]);   // 하위 고름
    assert.equal(secs()[1].getAttribute('aria-current'), 'true'); assert.equal(win().querySelector('.bl-pf-place').hidden, true, '하위는 이 창에서 넣을 곳을 안 바꿔요');
    click(secs()[1]);   // 다시 누르면 접힘
    assert.equal(secs()[1].getAttribute('aria-expanded'), 'false'); assert.deepEqual(itemIds('fs'), []);
    click(secs()[0]);
    const name = win().querySelector('[data-pf-name]'); name.value = '문체 2'; name.dispatchEvent(new Event('input', { bubbles: true }));
    assert.equal(secs()[0].querySelector('b').textContent, '문체 2', '이름이 줄에 바로');
    click(win().querySelector('.bl-pf-item[data-id="p4"] [data-pf-item="out"]'));
    assert.deepEqual(itemIds('fa'), ['p2', 'p3', 'p5']);
    const box = win().querySelector('[data-pf-pick]'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
    const lit = () => ['p2', 'p3', 'p5', 'p6', 'p7'].filter(id => order.find(e => e.identifier === id).enabled);
    const was = lit();
    assert.ok(was.length > 1, '켜진 항목이 여럿');
    const t = toastOf();
    click(win().querySelector('[data-card-done]')); await settle();
    const fa = settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa');
    assert.equal(fa.name, '문체 2'); assert.equal(fa.pick, true); assert.deepEqual(fa.ids, ['p2', 'p3', 'p5']);
    assert.deepEqual(lit(), [was[0]], '하나만 켜기: 실제 순서 첫 켜진 항목만');
    assert.match(t.text, /하나만 켜기로 \d+개를 껐어요/);
    t.undo(); await settle();
    const back = settings.promptFolders.presets.P1.folders.find(f => f.id === 'fa');
    assert.equal(back.name, '문체'); assert.equal(back.pick, false); assert.deepEqual(back.ids, ['p2', 'p3', 'p4', 'p5']); assert.deepEqual(lit(), was, '되돌리면 켬 · 폴더 그대로');
    settings.promptFolders.presets.P1.folders = settings.promptFolders.presets.P1.folders.filter(f => f.id !== 'fs');
    drawList(); await settle();
});
await test('1.0.3 폴더 창 위 · 아래: 저장하면 보내는 순서가 바뀌고(실리태번 저장 한 번) 되돌리기로 돌아와요 · 모든 폴더 창의 새 폴더 · 빈 폴더는 안 남아요', async () => {
    const start = idsNow();
    pick(menuOf('fa'), '이 폴더 고치기');
    const first = win().querySelector('.bl-pf-item[data-id="p2"]');
    assert.equal(first.querySelector('[data-pf-item="up"]').disabled, true, '맨 앞은 위로 없음');
    click(first.querySelector('[data-pf-item="down"]'));
    assert.deepEqual(itemIds('fa'), ['p3', 'p2', 'p4', 'p5']);
    const s0 = calls.save, t = toastOf();
    click(win().querySelector('[data-card-done]')); await settle();
    assert.deepEqual(idsNow().slice(0, 6), ['p0', 'p1', 'p3', 'p2', 'p4', 'p5']); assert.deepEqual(toArray(), idsNow());
    assert.equal(calls.save - s0, 1, '순서 저장 한 번');
    assert.match(t.text, /보내는 순서도 바뀌었어요/);
    t.undo(); await settle();
    assert.deepEqual(idsNow(), start, '되돌리기');
    pick(toolsMenu(), '모든 폴더 고치기');
    click(win().querySelector('[data-pf-add]'));
    assert.equal(secs().at(-1).getAttribute('aria-current'), 'true', '새 폴더를 골라 둬요');
    click(rightRow('p30')); click(rightRow('p31'));
    const name = win().querySelector('[data-pf-name]'); name.value = '새로'; name.dispatchEvent(new Event('input', { bubbles: true }));
    click(win().querySelector('[data-pf-add]'));   // 빈 폴더 하나 더
    click(win().querySelector('[data-card-done]')); await settle();
    const made = settings.promptFolders.presets.P1.folders;
    assert.deepEqual(made.filter(f => !['fa', 'fb', 'fc'].includes(f.id)).map(f => [f.name, f.ids]), [['새로', ['p30', 'p31']]], '빈 폴더는 안 남아요');
    assert.ok(heads().some(h => h.querySelector('.bl-pf-title').textContent === '새로'));
    settings.promptFolders.presets.P1.folders = made.filter(f => ['fa', 'fb', 'fc'].includes(f.id));
    drawList(); await settle();
});
await test('1.0.6 다른 도구 그룹은 편집창에서 확인하고 저장해요 · 취소·되돌리기·원본 보존', async () => {
    const before = structuredClone(settings.promptFolders.presets.P1.folders), originalOrder = structuredClone(order), saves = calls.save;
    const foreign = { presetPromptGroups: { groups: [{ id: 'g1', name: '分组甲', order: 0, collapsed: false }, { id: 'g2', name: '분류 나', order: 1 }], prompts: { p1: { groupId: 'g1' }, p8: { groupId: 'g1' }, p17: { groupId: 'g2' }, missing: { groupId: 'g1' } } } };
    pmStub.serviceSettings.extensions = { baibaiToolkit: foreign };
    const originalFile = JSON.stringify(pmStub.serviceSettings.extensions);
    pick(toolsMenu(), '보물상자 그룹 가져오기');
    assert.ok(win()?.open); assert.equal(win().querySelector('h3').textContent, '보물상자 그룹 가져오기');
    assert.equal(win().querySelector('[data-pf-translate]').hidden, false);
    assert.deepEqual(settings.promptFolders.presets.P1.folders, before, '미리 보기만으로 저장하지 않아요');
    click(win().querySelector('[data-card-clear]')); await settle();
    assert.deepEqual(settings.promptFolders.presets.P1.folders, before);
    const toast = toastOf(); pick(toolsMenu(), '보물상자 그룹 가져오기');
    const input = win().querySelector('[data-pf-name]'); input.value = '고친 이름'; input.dispatchEvent(new Event('input', { bubbles: true }));
    click(win().querySelector('[data-card-done]')); await settle();
    assert.deepEqual(settings.promptFolders.presets.P1.folders.map(f => [f.name, f.ids]), [['고친 이름', ['p1', 'p8']], ['분류 나', ['p17']]]);
    assert.deepEqual(order, originalOrder); assert.equal(calls.save, saves, '보내는 순서와 켬/끔은 그대로예요');
    assert.equal(JSON.stringify(pmStub.serviceSettings.extensions), originalFile);
    toast.undo(); await settle(); assert.deepEqual(settings.promptFolders.presets.P1.folders, before);
    pmStub.serviceSettings.extensions = {}; drawList(); await settle();
});
await test('1.0.6 다른 확장이 도구 줄을 감싸도 폴더 단추는 그 묶음 앞에 한 번만 붙어요', async () => {
    footer.querySelector('.bl-pf-tools').remove();
    const native = document.getElementById('prompt-manager-import'), wrapper = document.createElement('div');
    native.before(wrapper); wrapper.append(native); drawList(); await settle();
    const button = footer.querySelector('.bl-pf-tools');
    assert.equal(button.parentElement, footer); assert.equal(button.nextElementSibling, wrapper);
    drawList(); await settle(); assert.equal(footer.querySelectorAll('.bl-pf-tools').length, 1);
    wrapper.before(native); wrapper.remove();
});
await test('끄면 흔적 없이: 머리 · 클래스 · 도구 단추 · CSS 링크를 떼고 택1 출처도 뺌', async () => {
    await pf.syncPromptFolders(false); await settle();
    assert.equal(heads().length, 0); assert.ok(!list.querySelector('[class*="bl-pf-"]')); assert.ok(!list.classList.contains('bl-pf-on'));
    assert.ok(!footer.querySelector('.bl-pf-tools')); assert.ok(!document.getElementById('bl-prompt-folders-style'));
    assert.deepEqual(toArray(), order.map(e => e.identifier));
    drawList(); await settle();
    assert.equal(heads().length, 0, '꺼진 뒤 다시 그려도 안 붙음');
});
await test('연결: 설정 기본값 · 다듬기 · 초기화 보존 · 변경 목록 제외 · 경로 · 이름표 · 검색 · 설정 줄 · 기능 켜기 · 다른 확장 쉼 · 켜기 동그라미 공용 규칙 · CI', () => {
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    const s = read('src/settings.js');
    assert.match(s, /promptFolders: \{ on: true, presets: \{\} \}/);
    assert.match(s, /RESET_KEEP = \[[^\]]*'promptFolders'/);
    assert.match(read('src/settings-differences.js'), /omittedPaths = new Set\(\['promptFolders\.presets'/);
    assert.match(read('src/settings-differences.js'), /'promptFolders'\]\.includes\(scope\)\) return \{tab:'chat',sub:'etc'\}/);
    assert.match(read('src/settings-labels.js'), /"promptFolders\.on":"프롬프트 폴더"/);
    assert.match(read('src/settings-search.js'), /\['chat','etc','프롬프트 폴더',[^\]]*'promptFolders\.on'\]/);
    assert.match(read('src/panel.js'), /row\('프롬프트 폴더', toggle\('promptFolders\.on', s\.promptFolders\?\.on !== false\)[^\n]*restNote\('promptFolders'\)/);
    assert.match(read('src/features.js'), /const promptFolders = on && s\.usageMode !== 'extensions' && s\.promptFolders\?\.on !== false && !restingFor\('promptFolders'\);/);
    assert.match(read('src/ext-presence.js'), /promptFolders: \['promptgroups'\]/);
    const compact = read('css/27-compact.css');
    assert.match(compact, /li\.bl-pf-head \.bl-pf-all::before \{/); assert.match(compact, /li\.bl-pf-head \.bl-pf-all\.bl-pf-lit::after \{/);
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(read('src/prompt-folders.css').replace(/\/\*[\s\S]*?\*\//g, '')), '폴더 CSS 에 생 색값 없음');
    assert.ok(!/<style|\.style\.(color|background)/.test(read('src/prompt-folders.js')), '스크립트가 색을 박지 않음');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-folders\.mjs \./);
});
await test('서랍 문: 확장 감지로 쉬게 되면 문이 열려도 폴더를 켜지 않아요(묵은 「켜기」 대기를 빈 대기로 덮어요 · 월드인포 가볍게도 같은 꼴)', async () => {
    globalThis.document ??= { getElementById: () => null, addEventListener() {}, readyState: 'complete' };
    globalThis.window ??= globalThis; globalThis.requestAnimationFrame ??= f => setTimeout(f, 0);
    const { onGate, fireGate } = await import(url('src/boot-layers.js'));
    const src = fs.readFileSync(path.join(root, 'src/features.js'), 'utf8');
    for (const key of ['promptfolders', 'wilight']) assert.ok(src.includes(`, '${key}');\n    else onGate('drawer', () => {}, '${key}');`), key);
    // features.js 와 같은 꼴: 처음엔 쉼 없음(켬) → 확장 감지 뒤 쉼(끔 · 모듈은 아직 없음) → 문
    const modules = {}, got = [];
    const sync = resting => { const v = !resting; if (v || modules.pf) onGate('drawer', () => { modules.pf = 1; got.push(v); }, 'pf-test'); else onGate('drawer', () => {}, 'pf-test'); };
    sync(false); sync(true); fireGate('drawer', { cascade: false });
    assert.deepEqual(got, [], '쉬는데 켜기가 불리지 않아요');
});
console.log(`\n프롬프트 폴더 검사 ${passed}개를 통과했어요.`);
process.exit(0);
