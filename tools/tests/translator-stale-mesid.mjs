// 번역 애드온이 화면에 붙인 단추(생각 칸 「번역해서 보기」 · 번역 점검 표시)는 누를 때 **지금** 메시지 번호를 써요.
//   앞 메시지를 지우면 실리태번은 .mes 의 mesid 속성만 다시 매기고 다시 그리지 않아요(script.js updateViewMessageIds) — 단추에 적어 둔 번호(dataset)는 그대로 낡아요.
//   1.5.8 까지 두 곳 모두 dataset 을 먼저 봐서, 생각 칸은 다른 메시지의 생각 글을 번역했고(요청이 엉뚱한 메시지로) 점검 표시는 다른 메시지를 가리켰어요.
//   실제 줄을 떼어, 번호가 당겨진 가짜 단추로 돌려요.
//   node tools/tests/translator-stale-mesid.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const lineOf = (rel, needle) => { const line = fs.readFileSync(path.join(root, rel), 'utf8').split('\n').find(l => l.includes(needle)); assert.ok(line, `${rel}: 「${needle}」 줄을 찾아요`); return line.trim(); };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
// 꾸밀 때는 5번이었고, 앞 메시지를 지워 지금은 4번인 메시지 안의 단추
const inMes = (now, baked) => ({ dataset: { mesid: String(baked), llmtMes: String(baked), llmtPara: '2' }, closest: sel => (sel === '.mes' ? { getAttribute: () => String(now) } : null) });
const outside = baked => ({ dataset: { mesid: String(baked), llmtMes: String(baked), llmtPara: '2' }, closest: () => null });

const toggleLine = lineOf('src/addons/translator/reasoning-view.js', 'toggle(Number(button.');
const toggled = button => { let got; new Function('toggle', 'button', toggleLine)(id => { got = id; }, button); return got; };
test('생각 칸 「번역해서 보기」: 지금 번호의 메시지를 번역해요', () => {
    assert.equal(toggled(inMes(4, 5)), 4, '고치기 전: 5 (다른 메시지)');
    assert.equal(toggled(inMes(7, 7)), 7);
    assert.equal(toggled(outside(3)), 3, '.mes 밖(미리보기 등)에서는 적어 둔 번호');
});

const openLine = lineOf('src/addons/translator/check-view.js', "const id = Number(flag.");
const opened = flag => new Function('flag', `${openLine}\nreturn [id, index];`)(flag);
test('번역 점검 표시: 지금 번호의 메시지 · 그 문단', () => {
    assert.deepEqual(opened(inMes(4, 5)), [4, 2], '고치기 전: [5, 2]');
    assert.deepEqual(opened(outside(3)), [3, 2]);
});
console.log(`translator-stale-mesid: ${passed} passed`);
