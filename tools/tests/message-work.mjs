// 메시지 작업 순서 (src/message-work.js, 테마 6.5.2 세션3) — 메시지별 직렬 큐 · 쓰기 기록 · 옛 글 → 지금 글 대응 · 보이는 글 비교
//   node tools/tests/message-work.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const file = path.join(root, 'src/message-work.js');
if (!fs.existsSync(file)) { console.log('skip: 이 트리에는 message-work.js 가 없어요 (6.5.2 이전)'); process.exit(0); }
const X = await import(pathToFileURL(file).href);

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

await test('run: 같은 메시지의 일은 차례로, 다른 메시지는 서로 기다리지 않음 · 앞 일이 실패해도 다음 일은 돈다', async () => {
    const W = X.createMessageWork();
    const a = { mes: 'a' }, b = { mes: 'b' }, log = [];
    const p1 = W.run(a, 'rewrite', async () => { log.push('a1 start'); await sleep(40); log.push('a1 end'); return 1; });
    const p2 = W.run(a, 'assets', async () => { log.push('a2'); throw new Error('boom'); });
    const p3 = W.run(a, 'translator', () => { log.push('a3'); return 3; });
    const pb = W.run(b, 'assets', () => { log.push('b1'); });
    assert.equal(W.busy(a), true);
    await pb;
    assert.deepEqual(log, ['a1 start', 'b1'], '다른 메시지는 기다리지 않는다');
    assert.equal(await p1, 1);
    await assert.rejects(p2, /boom/);
    assert.equal(await p3, 3);
    assert.deepEqual(log, ['a1 start', 'b1', 'a1 end', 'a2', 'a3']);
    await sleep(5);
    assert.equal(W.busy(a), false);
    assert.equal(await W.run(null, 'x', () => 7), 7, '메시지가 없으면 바로');
});

await test('noteWrite · writesOf · rebase: 기록된 사슬로 이어지면 known, 기록 없는 변화가 끼면 unknown', () => {
    const W = X.createMessageWork({ now: () => 5 });
    const m = { mes: 'v0' };
    assert.equal(W.noteWrite(m, { by: 'rewrite', before: 'v0', after: 'v0' }), false, '같은 글은 기록 안 함');
    assert.deepEqual(W.rebase(m, 'v0'), { known: true, by: [], text: 'v0' }, '안 바뀜');
    m.mes = 'v1'; W.noteWrite(m, { by: 'assets', before: 'v0', after: 'v1' });
    m.mes = 'v2'; W.noteWrite(m, { by: 'rewrite', before: 'v1', after: 'v2' });
    assert.deepEqual(W.rebase(m, 'v0'), { known: true, by: ['assets', 'rewrite'], text: 'v2' });
    assert.deepEqual(W.rebase(m, 'v1'), { known: true, by: ['rewrite'], text: 'v2' });
    m.mes = 'v3 (헬퍼가 바꿈)';
    assert.equal(W.rebase(m, 'v0').known, false, '기록 없는 변화');
    assert.deepEqual(W.rebase(m, 'v0').by, ['assets', 'rewrite']);
    assert.equal(W.rebase(m, '없는 글').known, false);
    assert.equal(W.writesOf(m).length, 2);
    assert.equal(W.writesOf(m)[0].at, 5);
    const S = X.createMessageWork({ limit: 2 });
    const n = { mes: '' };
    for (let i = 0; i < 5; i++) S.noteWrite(n, { by: 'x', before: String(i), after: String(i + 1) });
    assert.equal(S.writesOf(n).length, 2, '기록 수 상한');
});

await test('sameVisible: 머리의 생각 블록 · 그림 자리 span · 빈 줄 차이는 같은 글 · 문장이 바뀌면 다른 글 · ignore 로 표식 등록', () => {
    const W = X.createMessageWork();
    const body = '<status_bar>\n날짜\n</status_bar>\n\n<content>\nHe pushed his glasses up.\n\n「おはよう」\n</content>';
    const withEcot = '<ECoT>\n[语言检定] 생각\n</ECoT>\n' + body;
    const withSlots = body.replace('\n\n「おはよう」', '\n\n<span class="bl-asset-slot" data-asset-slot="asa1234567890ab"></span>\n\n「おはよう」');
    assert.equal(W.sameVisible(withEcot, body), true, '과일의 마음이 ECoT 를 떼어 냄');
    assert.equal(W.sameVisible(body, withSlots), true, '에셋이 자리를 넣음');
    assert.equal(W.sameVisible(withEcot, withSlots), true, '둘 다');
    assert.equal(W.sameVisible(body, body.replace('glasses', 'gaze')), false, '다시 쓰기가 문장을 고침');
    assert.equal(W.sameVisible('<think>a</think>\n\nx', 'x'), true);
    const off = W.ignore('other-slot', /<span class="other-slot"[^>]*><\/span>/g);
    assert.equal(W.sameVisible(body, body + '\n\n<span class="other-slot" data-x="1"></span>'), true, '다른 확장의 표식 등록');
    off();
    assert.equal(W.sameVisible(body, body + '\n\n<span class="other-slot" data-x="1"></span>'), false);
    assert.equal(W.strip('  a \n\n\n b  '), 'a\nb');
});

await test('전역 다리: installMessageWork 는 한 번만 세우고 같은 것을 돌려준다 · 버전', () => {
    const g = {};
    const first = X.installMessageWork(g);
    assert.equal(X.installMessageWork(g), first);
    assert.equal(g[X.BRIDGE], first);
    assert.equal(first.version, X.VERSION);
    assert.equal(typeof X.messageWork(), 'object');
    assert.equal(X.messageWork(), globalThis[X.BRIDGE]);
});

await test('공개 글: 금지 글자 없음 · 순수 모듈', () => {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/import\s.*from\s+['"]/.test(text));
    assert.ok(!/\uAC24|\uC624\uD1A0\uD53D|\uC9D1\uC0AC|\uBCC4\uD3B8|\uC0DD\uD65C\uAE30\uB85D\uBD80|\uBCF4\uC774\uC2A4|Scene\x56oice/.test(text));
});

console.log(`message-work: ${passed} passed`);
