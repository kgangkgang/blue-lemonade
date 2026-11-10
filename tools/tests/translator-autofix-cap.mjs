// 코드 감사 2차 T7: 번역 점검 「의심 문단 자동 고치기는 메시지마다 3번까지」(check-view.js AUTO_MAX)가 의심 메시지 수와 상관없이 지켜져요.
// 고치기 전: 센 수(autoTries)가 200칸 LRU 라 의심 메시지가 200개를 넘으면 앞 메시지가 밀려나 0부터 다시 세어, 유료 다시 번역이 끝없이 나갔어요.
// 고친 뒤: 밀어내지 않고, 채팅이 바뀌면(scope 가 달라지면) 비워요.
//   흉내: act(다시 번역)가 번역문을 바꾸지만 의심은 그대로 남는 메시지 N개 — 실제처럼 다시 그려져 schedule 이 다시 불려요.
//   node tools/tests/translator-autofix-cap.mjs <테마 루트>   — 가짜 document · 네트워크 0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
globalThis.document = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null, body: { append() {} } };
globalThis.requestIdleCallback = fn => setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 50 }), 0);
const { createCheckView } = await import(pathToFileURL(path.join(root, 'src/addons/translator/check-view.js')).href);

function bench(N, ROUND_CAP = 8) {
    const version = new Array(N).fill(0), calls = new Array(N).fill(0);
    let chat = { id: 'a' };
    const stateOf = id => {
        if (!(id >= 0 && id < N)) return null;
        const source = `「こんにちは、今日はいい天気ですね。${id}番目の挨拶です」`;
        const translation = `"안녕하세요, 오늘은 날씨가 좋네요. ${id}번째 인사예요 (판 ${version[id]})"`;   // 다른 따옴표라 「대사 괄호가 원문보다 적어요」가 남아요
        return { source, translation, protect: [], key: `${id}:${version[id]}` };
    };
    let view;
    const act = async (kind, id) => {
        calls[id]++;
        if (calls[id] >= ROUND_CAP) return;   // 시험이 끝나게 (고치기 전에는 계속 돌아요)
        await null;
        version[id]++;
        view.schedule(id);
    };
    view = createCheckView({ stateOf, rerender() {}, act, scope: () => chat, autoFixOn: () => true });
    const settle = async () => { for (let i = 0; i < 400; i++) await new Promise(r => setTimeout(r, 0)); };
    return {
        calls, settle,
        async scheduleAll() { for (let id = 0; id < N; id++) view.schedule(id); await settle(); },
        bump(id) { version[id]++; view.schedule(id); },
        switchChat() { chat = { id: 'b' }; },
    };
}
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };

await test('의심 메시지 150개: 메시지마다 자동 다시 번역 3번까지(예전과 같음)', async () => {
    const b = bench(150);
    await b.scheduleAll();
    assert.equal(Math.max(...b.calls), 3);
});
await test('의심 메시지 250개: 그래도 메시지마다 3번까지 (고치기 전: 8번에서 시험이 끊음 · 모두 2,000번)', async () => {
    const b = bench(250);
    await b.scheduleAll();
    assert.equal(Math.max(...b.calls), 3);
    assert.equal(b.calls.reduce((a, c) => a + c, 0), 750);
});
await test('채팅이 바뀌면 센 수를 비워 새 채팅의 메시지는 다시 3번까지 고쳐요', async () => {
    const b = bench(2);
    await b.scheduleAll();
    assert.deepEqual(b.calls, [3, 3]);
    b.bump(0); await b.settle();
    assert.equal(b.calls[0], 3, '같은 채팅에서는 더 보내지 않아요');
    b.switchChat();
    b.bump(0); await b.settle();
    assert.ok(b.calls[0] > 3 && b.calls[0] <= 6, '새 채팅에서 다시 셈: ' + b.calls[0]);
});
await test('LRU 밀어내기 줄이 남아 있지 않아요', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/translator/check-view.js'), 'utf8');
    assert.doesNotMatch(src, /autoTries\.size > \d+/);
});
await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-autofix-cap.mjs .'));
});
console.log(`translator-autofix-cap: ${pass} passed`);
process.exit(0);
