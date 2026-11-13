// 1.2.1 심플 새 틀 등록 값(src/log-copy-simple.gen.js)의 되풀이 그림 글 한 벌로 싣기 — 읽어 들인 등록 값이 도구가 만든 틀 값과 글자 하나 다르지 않은지,
//   생성물에 같은 긴 그림 글(data:image/svg+xml)이 두 번 실리지 않았는지 봐요(되돌리면 레몬 그림이 28번 실려 실패해요).
//   node tools/tests/log-copy-simple-pack.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };
const tool = await load('tools/mart/simple-frames.mjs');
const { SIMPLE_FRAMES } = await load('src/log-copy-simple.gen.js');
const text = fs.readFileSync(path.join(root, 'src/log-copy-simple.gen.js'), 'utf8');

await test('읽어 들인 등록 값 = 도구가 틀 파일에서 만든 값(차례 · 열쇠 · 글자 모두) · 얼린 배열', () => {
    const { entries } = tool.build();
    assert.equal(JSON.stringify(SIMPLE_FRAMES), JSON.stringify(entries));
    assert.ok(Object.isFrozen(SIMPLE_FRAMES));
    assert.ok(!JSON.stringify(SIMPLE_FRAMES).includes(''), '되채우지 못한 표시가 남았어요');
});

await test('같은 긴 그림 글은 생성물에 한 번만 실려요(레몬 그림 28틀 포함)', () => {
    const count = new Map();
    for (const m of text.matchAll(/data:image\/svg\+xml,[^'"()\\]{100,}/g)) count.set(m[0], (count.get(m[0]) || 0) + 1);
    const twice = [...count].filter(([, n]) => n > 1);
    assert.deepEqual(twice.map(([s, n]) => `${n}× ${s.slice(0, 60)}`), []);
    const lemon = JSON.stringify(SIMPLE_FRAMES).split('fill=%22%23FFE23C%22 fill-rule=%22evenodd%22').length - 1;
    assert.ok(lemon >= 28, `레몬 그림이 등록 값에 ${lemon}번`);
    assert.equal(text.split('fill=%22%23FFE23C%22 fill-rule=%22evenodd%22').length - 1, 1, '생성물에는 한 번');
});

await test('CI 등록', () => assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/log-copy-simple-pack.mjs .')));
console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
