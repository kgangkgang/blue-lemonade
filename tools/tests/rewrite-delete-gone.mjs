// 다시 쓰기: 금지 묘사 · 예외 삭제 확인 창이 떠 있는 사이 다른 기기 합치기가 그 항목을 먼저 뺐을 때 (예측점검-애드온 1029).
//   예전엔 settings.rules.splice(settings.rules.indexOf(rule), 1) — indexOf 가 -1 이면 맨 끝 항목(엉뚱한 규칙)을 지웠어요.
//   이름은 지어낸 것. 네트워크 없음.  node tools/tests/rewrite-delete-gone.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const guards = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/guards.js')).href);
const merge = await import(pathToFileURL(path.join(root, 'src/settings-merge.js')).href);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

check('확인하는 사이 합치기가 그 규칙을 뺐으면 아무것도 지우지 않아요 (맨 끝 규칙이 남아요)', () => {
    assert.equal(typeof guards.removeListed, 'function', 'guards.js 에 removeListed 가 있어야 해요');
    const keep = { id: 'r1', name: '지어낸 규칙 1', updated: 5 }, doomed = { id: 'r2', name: '지어낸 규칙 2', updated: 5 }, last = { id: 'r3', name: '지어낸 규칙 3', updated: 5 };
    const rules = [keep, doomed, last];
    // 다른 기기에서 r2 를 지운 기록이 합치기로 들어와 목록에서 빠진다 (확인 창은 아직 떠 있음)
    merge.mergeById({ local: rules, remote: [keep, last], remoteGone: { r2: 10 }, now: 20 });
    assert.deepEqual(rules.map(r => r.id), ['r1', 'r3']);
    // 확인 창에서 「확인」 → 쥐고 있던 r2 로 지우기
    assert.equal(guards.removeListed(rules, doomed), false);
    assert.deepEqual(rules.map(r => r.id), ['r1', 'r3'], '맨 끝 r3 가 지워지면 안 돼요');
});
check('있으면 그 항목 하나만 빼요', () => {
    const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' }, list = [a, b, c];
    assert.equal(guards.removeListed(list, b), true);
    assert.deepEqual(list, [a, c]);
    assert.equal(guards.removeListed(undefined, a), false);
});
check('배선: 금지 묘사 · 예외 삭제가 removeListed 를 써요 (indexOf 를 그대로 splice 하지 않아요)', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/rewrite/index.js'), 'utf8');
    assert.doesNotMatch(src, /\.splice\(settings\.(rules|exceptions)\.indexOf\(/);
    assert.match(src, /if \(!removeListed\(settings\.rules, rule\)\)/);
    assert.match(src, /if \(!removeListed\(settings\.exceptions, exception\)\)/);
});
console.log(`rewrite delete gone: ${passed} passed`);
