// 1.0.7 한글화 패널 — 원문이 바뀐 항목은 바뀐 줄 · 문단만 다시 번역(src/addons/prompt/paragraph-reuse.js)
//   node tools/tests/prompt-paragraph-reuse.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const { planReuse, missingText, fillPlan, worthReusing } = await import(pathToFileURL(path.join(root, 'src/addons/prompt/paragraph-reuse.js')).href);
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

const oldSrc = ['- Name: Aria', '- Age: 24', '- Likes: tea', '- Fears: storms'].join('\n');
const oldTr = ['- 이름: 아리아', '- 나이: 24', '- 좋아함: 차', '- 두려움: 폭풍'].join('\n');

test('한 줄만 바뀌면 그 줄만 보내고 나머지는 지난 번역을 그대로 써요', () => {
    const now = oldSrc.replace('- Likes: tea', '- Likes: coffee');
    const plan = planReuse(oldSrc, oldTr, now);
    assert.equal(plan.kind, 'line');
    assert.deepEqual(plan.missing, [2]);
    assert.equal(missingText(plan), '- Likes: coffee');
    assert.ok(worthReusing(plan));
    assert.equal(fillPlan(plan, '- 좋아함: 커피'), ['- 이름: 아리아', '- 나이: 24', '- 좋아함: 커피', '- 두려움: 폭풍'].join('\n'));
});
test('줄을 더하면 더한 줄만 · 지우거나 순서만 바꾸면 요청 없이 다시 짜요', () => {
    const added = planReuse(oldSrc, oldTr, oldSrc + '\n- Job: baker');
    assert.deepEqual(added.missing, [4]);
    assert.equal(fillPlan(added, '- 직업: 제빵사').split('\n').at(-1), '- 직업: 제빵사');
    const removed = planReuse(oldSrc, oldTr, oldSrc.split('\n').filter(l => !l.includes('Age')).reverse().join('\n'));
    assert.deepEqual(removed.missing, []);
    assert.equal(fillPlan(removed, ''), ['- 두려움: 폭풍', '- 좋아함: 차', '- 이름: 아리아'].join('\n'));
});
test('줄 수가 안 맞으면 빈 줄로 나눈 문단으로 맞대요 · 빈 줄 자리는 그대로', () => {
    const src = 'Aria is a baker.\nShe wakes early.\n\nShe fears storms.';
    const tr = '아리아는 제빵사다. 그녀는 일찍 일어난다.\n\n그녀는 폭풍을 두려워한다.';
    const plan = planReuse(src, tr, src.replace('She fears storms.', 'She loves storms.'));
    assert.equal(plan.kind, 'paragraph');
    assert.deepEqual(plan.missing, [1]);
    assert.equal(fillPlan(plan, '그녀는 폭풍을 좋아한다.'), '아리아는 제빵사다. 그녀는 일찍 일어난다.\n\n그녀는 폭풍을 좋아한다.');
    const lines = planReuse('a\n\nb\nc', '가\n\n나\n다', 'a\n\nb\nd');
    assert.equal(lines.kind, 'line');
    assert.equal(fillPlan(lines, '라'), '가\n\n나\n라');
});
test('맞댈 수 없으면 null(통째로 다시 번역) · 받은 줄 수가 다르면 null', () => {
    assert.equal(planReuse('한 덩어리 글', '번역', '바뀐 한 덩어리 글'), null);
    assert.equal(planReuse('a\nb', '가 나', 'a\nc'), null);
    assert.equal(planReuse('a\n\nb', '가\n나\n\n다', 'a\n\nc').kind, 'paragraph');   // 줄 수는 달라도 문단 수가 같으면 문단으로
    assert.equal(planReuse('a\nb\n\nc', '가\n\n나\n\n다', 'a\nb\n\nd'), null);
    const plan = planReuse(oldSrc, oldTr, oldSrc.replace('tea', 'coffee').replace('storms', 'dark'));
    assert.deepEqual(plan.missing, [2, 3]);
    assert.equal(fillPlan(plan, '- 좋아함: 커피'), null);
    assert.equal(fillPlan(plan, '- 좋아함: 커피\n- 두려움: 어둠').split('\n').length, 4);
});
test('같은 줄이 여러 번 나와도 순서대로 짝지어요 · 절반 넘게 바뀌면 통째로가 나아요', () => {
    const plan = planReuse('x\ny\nx', '엑스1\n와이\n엑스2', 'x\nx\nz');
    assert.deepEqual(plan.units.map(u => u.translation), ['엑스1', '엑스2', null]);
    const most = planReuse(oldSrc, oldTr, 'a\nb\nc\n- Fears: storms');
    assert.equal(worthReusing(most), false);
});

console.log(`prompt-paragraph-reuse: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
