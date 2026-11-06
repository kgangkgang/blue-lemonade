import assert from 'node:assert/strict';
import { readBoxPresetFolders, LIMITS } from '../../src/prompt-folders-core.js';
import { planFolderNames, folderLabelsJson, parseFolderLabels, applyFolderNamePlan } from '../../src/prompt-folder-labels.js';
let count = 0;
const test = (name, run) => { run(); count++; console.log(`통과 ${count}: ${name}`); };
test('그룹 순서·현재 프롬프트 순서·접힘을 읽고 원본은 바꾸지 않아요', () => {
    const ext = { baibaiToolkit: { presetPromptGroups: { groups: [{ id: 'a', name: '分组甲', order: 2 }, { id: 'b', name: '분류 나', order: 0, collapsed: false }, { id: 'empty', name: '빈 폴더' }], prompts: { p1: { groupId: 'a' }, p2: { groupId: 'a' }, p3: { groupId: 'b' }, old: { groupId: 'a' }, orphan: { groupId: 'missing' } } } } };
    const before = structuredClone(ext), out = readBoxPresetFolders(ext, ['p3', 'p2', 'p1', 'orphan']);
    assert.deepEqual(out.map(f => [f.name, f.ids, f.open, f.pick]), [['분류 나', ['p3'], true, false], ['分组甲', ['p2', 'p1'], false, false]]);
    assert.deepEqual(ext, before); assert.ok(out.every(f => f.parent === ''));
});
test('없는 형식·중복 그룹·잘못된 참조는 가져오지 않아요', () => {
    for (const ext of [null, {}, { baibaiToolkit: { presetPromptGroups: [] } }]) assert.deepEqual(readBoxPresetFolders(ext, ['p']), []);
    const out = readBoxPresetFolders({ baibaiToolkit: { presetPromptGroups: { groups: [{ id: 'a', name: '앞' }, { id: 'a', name: '뒤' }, { id: '__proto__', name: '금지' }], prompts: { p: { groupId: 'a' }, q: { groupId: '__proto__' } } } } }, ['p', 'p', 'q']);
    assert.deepEqual(out.map(f => [f.name, f.ids]), [['앞', ['p']]]);
});
test('숫자 그룹 번호와 항목 수 상한도 안전하게 읽어요', () => {
    const ids = Array.from({ length: LIMITS.ids + 10 }, (_, i) => `p${i}`);
    const out = readBoxPresetFolders({ baibaiToolkit: { presetPromptGroups: { groups: [{ id: 0, name: '분류' }], prompts: Object.fromEntries(ids.map(id => [id, { groupId: 0 }])) } } }, ids);
    assert.equal(out.length, 1); assert.equal(out[0].ids.length, LIMITS.ids);
});
test('번역 요청에는 외국어 이름만 있고 폴더 번호·프롬프트 본문은 없어요', () => {
    const folders = [{ id: 'secret-id', name: '分组甲', ids: ['prompt-body'] }, { id: 'b', name: '분류 나' }, { id: 'c', name: '分组甲' }, { id: 'd', name: 'テスト' }];
    const plan = planFolderNames(folders);
    assert.deepEqual(plan.names, ['分组甲', 'テスト']); assert.equal(plan.entries.length, 3);
    assert.deepEqual(JSON.parse(folderLabelsJson(plan.names)), { n0: '分组甲', n1: 'テスト' });
    assert.ok(!folderLabelsJson(plan.names).includes('secret-id')); assert.ok(!folderLabelsJson(plan.names).includes('prompt-body'));
});
test('JSON 키로 짝을 찾아 순서가 달라도 맞추고 잘못된 답은 거부해요', () => {
    const names = ['分组甲', 'テスト'];
    assert.deepEqual(parseFolderLabels(names, '```json\n{"n1":"시험","n0":"분류 가"}\n```'), ['분류 가', '시험']);
    for (const raw of ['설명만 있어요', '[]', '{"n0":"하나"}', '{"n0":"하나","wrong":"둘"}', '{"n0":"","n1":"둘"}']) assert.throws(() => parseFolderLabels(names, raw));
});
test('기다리는 사이 직접 고친 이름·지운 폴더는 덮어쓰지 않아요', () => {
    const folders = [{ id: 'a', name: '分组甲' }, { id: 'b', name: 'テスト' }, { id: 'c', name: '分组甲' }];
    const plan = planFolderNames(folders); folders[0].name = '직접 고침'; folders.splice(1, 1);
    assert.equal(applyFolderNamePlan(folders, plan, ['분류 가', '시험']), 1);
    assert.deepEqual(folders, [{ id: 'a', name: '직접 고침' }, { id: 'c', name: '분류 가' }]);
});
console.log(`폴더 가져오기·이름 번역 계산 ${count}개를 통과했어요.`);
