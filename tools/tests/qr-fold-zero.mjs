// 제로(usageMode 'zero')에서는 QR 줄 접힘 클래스를 붙이지 않는지 (11-12 전체 점검 1부)
//   제로는 입력판 배치(startCompactLayout)를 돌리지 않아 줄 앞 « 가 없어요. 보통 모드에서 접어 둔 채(chat.qrFolded) 제로로 오면
//   salty-qr-folded 가 QR 버튼을 다 숨겨(css/35-qr-bar.css) 펼 길이 없었어요. 저장값은 그대로 두고 그리는 클래스만 빼요.
//   apply.js 의 실제 QR 접기 줄들을 떼어 그대로 돌려요.
//   node tools/tests/qr-fold-zero.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };

const apply = read('src/apply.js');
const start = apply.indexOf("if (s.chat.qrFold === false) want.add('salty-qr-fold-off');");
const endMark = "if (s.chat.qrCtxNames === true)";
const end = apply.indexOf(endMark, start);
assert.ok(start > 0 && end > start, 'apply.js 의 QR 접기 줄을 찾아요');
const body = apply.slice(start, end);
const classes = new Function('s', 'want', 'restingFor', `${body}; return [...want].sort();`);
const run = (chat, quick = {}, usageMode = 'both') => classes({ chat: { qrFold: true, qrFolded: false, ...chat }, quick, usageMode }, new Set(), () => false);

test('보통 모드: 접어 둔 줄은 접힌 채(salty-qr-folded)', () => {
    assert.ok(run({ qrFolded: true }).includes('salty-qr-folded'));
});
test('제로: 접어 둔 채 와도 접힘 클래스를 붙이지 않아요(줄 앞 « 가 없으니 QR 이 다 숨어요)', () => {
    assert.ok(!run({ qrFolded: true }, {}, 'zero').includes('salty-qr-folded'));
});
test('제로에서 나오면 접어 둔 모습이 돌아와요(저장값 그대로)', () => {
    assert.ok(run({ qrFolded: true }, {}, 'theme').includes('salty-qr-folded'));
});
test('요술봉 뒤 접기(quick.qrFold)를 쓰는 동안은 예전처럼 줄 앞 단추가 쉬어요', () => {
    const got = run({ qrFolded: true }, { qrFold: true });
    assert.ok(got.includes('salty-qr-fold-off'));
    assert.ok(!got.includes('salty-qr-folded'));
});
console.log(`qr-fold-zero: ${passed} 통과`);
