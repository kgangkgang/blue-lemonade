// 메모 애드온 — 체크 상자 누름이 원문의 맞는 줄을 고치는지: 줄 첫머리 인라인 코드(```글``` · ~~~글~~~)는 코드 칸이 아니다
//   node tools/tests/notes-task-fence.mjs <테마 루트>   (공개 저장소는 '.')
// src/addons/notes/index.js 의 toggleTask 와 그 정규식(TASK_RE · FENCE_RE)을 잘라 내 그대로 돌린다 (translation-source.mjs 와 같은 방식).
// 그린 보기(실리태번 messageFormatting = showdown)는 한 줄 안에서 닫히는 ```npm test``` · ~~~가림~~~ 을 코드 칸으로 보지 않아서
// 그 뒤 체크 목록을 상자로 그리고 0, 1, … 번호를 붙인다. toggleTask 는 그 줄을 코드 칸 시작으로 세어 뒤 체크 줄을 건너뛴다 →
//   · 상자를 눌러도 아무것도 안 바뀌거나 (첫째 경우)
//   · 진짜 코드 칸 안의 '- [ ]' 줄이 대신 [x] 로 바뀐다 (둘째 경우 — 메모 글이 엉뚱하게 고쳐짐)
// 이 시험은 메모 1.3.3 에서 위 두 경우가 실패한다 (보고한 버그). FENCE_RE 가 같은 줄에 다시 나오는 ` · ~ 를 막으면 통과한다.
// 진짜 코드 칸(``` · ```js · ```` · ~~~ · 인용 안 ```)을 건너뛰는 지금 동작은 그대로 지켜야 한다 (셋째 경우).
// 시험 글은 지어낸 문장만 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/addons/notes/index.js'), 'utf8');
const line = name => { const m = source.match(new RegExp(`\\nconst ${name} = [^\\n]+`)); assert.ok(m, 'missing ' + name); return m[0].slice(1); };
function cut(name) {
    const start = source.indexOf(`\nfunction ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let j = source.indexOf(') {', start) + 2; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}' && --depth === 0) return source.slice(start + 1, j + 1);
    }
    throw new Error('unbalanced ' + name);
}
const toggleTask = vm.runInNewContext(`${line('TASK_RE')}\n${line('FENCE_RE')}\n${cut('toggleTask')}\ntoggleTask`);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
// k 번째 상자를 누르면 at 줄만 next 로 바뀌어야 한다
const expectFlip = (lines, k, at, next) => { const want = [...lines]; want[at] = next; assert.equal(toggleTask(lines.join('\n'), k), want.join('\n'), `k=${k}`); };

await test('줄 첫머리 ```인라인 코드``` 뒤 체크 목록: 0 번 상자 = 첫 체크 줄, 1 번 = 둘째 (그린 보기와 같은 번호)', () => {
    const lines = ['```npm test``` 먼저 돌리기', '- [ ] 하나', '- [ ] 둘'];
    expectFlip(lines, 0, 1, '- [x] 하나');
    expectFlip(lines, 1, 2, '- [x] 둘');
    const tilde = ['~~~가림~~~ 먼저', '- [ ] 하나', '- [ ] 둘'];
    expectFlip(tilde, 0, 1, '- [x] 하나');
});

await test('인라인 코드 줄 뒤에 진짜 코드 칸이 있어도 코드 칸 안 줄은 안 바뀐다 (그린 보기의 상자는 하나 · 셋 두 개)', () => {
    const lines = ['```npm test``` 먼저', '- [ ] 하나', '```', '- [ ] 코드 속 예시', '```', '- [ ] 셋'];
    expectFlip(lines, 0, 1, '- [x] 하나');
    expectFlip(lines, 1, 5, '- [x] 셋');
    assert.equal(toggleTask(lines.join('\n'), 2), lines.join('\n'), '셋째 상자는 없다');
});

await test('진짜 코드 칸은 지금처럼 건너뛴다: ``` · ```js · ```` · ~~~ · 인용 안 ``` (지금도 통과 — 고친 뒤에도 지켜야 함)', () => {
    const lines = ['- [ ] 하나', '```js', '- [ ] 코드', '```', '````', '- [ ] 네 개 코드', '````', '~~~', '- [ ] 물결 코드', '~~~', '> ```', '> - [ ] 인용 코드', '> ```', '- [ ] 둘'];
    expectFlip(lines, 0, 0, '- [x] 하나');
    expectFlip(lines, 1, 13, '- [x] 둘');
    assert.equal(toggleTask(lines.join('\n'), 2), lines.join('\n'));
});

console.log(`notes-task-fence: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
