// 코드 감사 2차 T3: 묶음 번역 답 읽기(translation-segments.js parseBatchResult)에서 문단 하나가 빠지면 한 칸씩 밀려 붙던 것.
// 고치기 전: 모델이 0번 문단을 빠뜨리고 1번 안에 원문에 없는 [2] 줄을 쓰면, ⟦n⟧ 답 안의 [n] 줄을 표시로 받는 규칙(5.4.1)과
//   「1부터 다시 매긴 답은 한 칸 내려 받기」가 겹쳐 미나 문단 자리에 렉스 번역이 붙고 형식 오류가 나지 않았어요.
// 고친 뒤: [n] 줄을 표시로 받은 답은 내려 받지 않고 형식 오류(다시 물음)로 봐요. 진짜 1부터 매긴 답 · 0부터 맞는 [n] 섞인 답은 예전 그대로.
//   node tools/tests/translator-batch-shift.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const S = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')).href);
const sources = ['Mina opened the door and looked down the long corridor.', 'Rex said nothing; he only folded the letter twice and put it away.'];
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

test('0번 문단을 빠뜨리고 지어낸 [2] 줄을 쓴 답은 형식 오류예요 (고치기 전: 한 칸 밀려 붙음)', () => {
    const meta = {};
    assert.throws(() => S.parseBatchResult('⟦1⟧ 렉스는 아무 말도 하지 않았다.\n[2] 그는 편지를 두 번 접어 넣었을 뿐이다.', 2, meta, sources), e => e.format === true);
    assert.notEqual(meta.renumbered, true);
});
test('진짜 1부터 다시 매긴 ⟦n⟧ 답은 예전처럼 한 칸 내려 받아요', () => {
    const meta = {};
    const out = S.parseBatchResult('⟦1⟧ 미나는 문을 열고 긴 복도를 내려다보았다.\n\n⟦2⟧ 렉스는 아무 말도 하지 않았다.', 2, meta, sources);
    assert.deepEqual(out, ['미나는 문을 열고 긴 복도를 내려다보았다.', '렉스는 아무 말도 하지 않았다.']);
    assert.equal(meta.renumbered, true);
});
test('0부터 맞게 매기고 표시가 [n] 으로 망가진 답은 예전처럼 받아요', () => {
    const meta = {};
    const out = S.parseBatchResult('⟦0⟧ 미나는 문을 열고 긴 복도를 내려다보았다.\n[1] 렉스는 아무 말도 하지 않았다.', 2, meta, sources);
    assert.deepEqual(out, ['미나는 문을 열고 긴 복도를 내려다보았다.', '렉스는 아무 말도 하지 않았다.']);
    assert.notEqual(meta.renumbered, true);
});
test('[n] 만 쓴 1부터 매긴 답(⟦ 없음)은 예전처럼 내려 받아요', () => {
    const meta = {};
    const out = S.parseBatchResult('[1] 미나는 문을 열고 긴 복도를 내려다보았다.\n[2] 렉스는 아무 말도 하지 않았다.', 2, meta, sources);
    assert.deepEqual(out, ['미나는 문을 열고 긴 복도를 내려다보았다.', '렉스는 아무 말도 하지 않았다.']);
    assert.equal(meta.renumbered, true);
});
test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-batch-shift.mjs .'));
});
console.log(`translator-batch-shift: ${pass} passed`);
