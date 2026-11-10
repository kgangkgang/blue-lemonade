// 코드 감사 2차 T2: 번역기 슬래시 명령의 messageId 다듬기(index.js validateAndNormalizeMessageId).
// 고치기 전: 틀린 번호 · 범위 밖 · 음수 · 'abc' 가 오류가 아니라 'last'(마지막 메시지)로 바뀌고 '12abc' · '4.9' 는 12 · 4 로 읽혀,
//   /llmDBDeleteTranslation 은 마지막 메시지 번역을 지우고 /LlmRetranslate… 는 유료 요청을 엉뚱한 메시지에 보냈어요.
// 고친 뒤: 빈 값 · 'last' 만 마지막 메시지, 나머지 틀린 값은 null 이라 명령이 알림만 내고 멈춰요.
//   node tools/tests/translator-slash-message-id.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
const lines = src.split(/\r?\n/);
function cutFunction(name) {
    const start = lines.findIndex(line => line.startsWith(`function ${name}(`));
    assert.ok(start >= 0, '함수를 찾아요: ' + name);
    let end = start;
    while (end < lines.length && lines[end] !== '}') end++;
    return lines.slice(start, end + 1).join('\n');
}
let chat = Array.from({ length: 50 }, (_, i) => ({ mes: `m${i}` }));
const warnings = [];
const toastr = { warning: m => warnings.push(m) };
const { validateAndNormalizeMessageId: v, badMessageIdNotice } = new Function('getContext', 'toastr', `${cutFunction('validateAndNormalizeMessageId')}\n${cutFunction('badMessageIdNotice')}\nreturn { validateAndNormalizeMessageId, badMessageIdNotice };`)(() => ({ chat }), toastr);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

test('맞는 번호 · 빈 값 · last 는 예전 그대로', () => {
    assert.equal(v('12'), '12');
    assert.equal(v('0'), '0');
    assert.equal(v('49'), '49');
    assert.equal(v(' 7 '), '7');
    assert.equal(v(''), 'last');
    assert.equal(v(undefined), 'last');
    assert.equal(v('last'), 'last');
});
test('틀린 값은 마지막 메시지로 가지 않아요 (고치기 전: 6개가 다른 메시지로 감)', () => {
    for (const bad of ['50', '57', '-1', 'abc', '12abc', '4.9', '1e2']) assert.equal(v(bad), null, bad);
});
test('채팅이 비어 있으면 예전처럼 last (부르는 쪽이 「메시지 없음」으로 멈춤)', () => {
    const keep = chat; chat = [];
    try { assert.equal(v('3'), 'last'); } finally { chat = keep; }
});
test('알림 글: 넣은 값과 고를 수 있는 범위를 알려요', () => {
    const text = badMessageIdNotice('57');
    assert.match(text, /「57」/);
    assert.match(text, /0부터 49/);
    assert.equal(warnings.length, 1);
});
test('validateAndNormalizeMessageId 를 부르는 명령 7곳이 모두 null 이면 멈춰요', () => {
    const calls = src.match(/validateAndNormalizeMessageId\(parsedArgs\.messageId\);\n[^\n]*/g) || [];
    assert.equal(calls.length, 7);
    for (const c of calls) assert.match(c, /if \(messageIdStr === null\) return badMessageIdNotice\(parsedArgs\.messageId\);/);
});
test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-slash-message-id.mjs .'));
});
console.log(`translator-slash-message-id: ${pass} passed`);
