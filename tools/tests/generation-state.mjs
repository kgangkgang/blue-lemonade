// 생성 상태 (src/generation-state.js, 테마 6.5.2 세션3) — 본채팅 생성만 생성 중 · 조용한 생성 · 헬퍼 generate · 테마의 붙잡음은 아님
//   node tools/tests/generation-state.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const file = path.join(root, 'src/generation-state.js');
if (!fs.existsSync(file)) { console.log('skip: 이 트리에는 generation-state.js 가 없어요 (6.5.2 이전)'); process.exit(0); }
const X = await import(pathToFileURL(file).href);

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

await test('본채팅 4종만 창을 연다 · quiet · impersonate · 드라이런 · 모르는 type 은 아니다', () => {
    const G = X.createGenerationState({ now: () => 1000 });
    for (const type of X.MAIN_TYPES) { assert.equal(G.started(type, false), true, type); assert.equal(G.mainGenerating(), true, type); assert.equal(G.ended(3), true); assert.equal(G.mainGenerating(), false); }
    for (const type of ['quiet', 'impersonate', 'first_message', 'command', 'extension', undefined, null, '']) { assert.equal(G.started(type, false), false, String(type)); assert.equal(G.mainGenerating(), false, String(type)); }
    assert.equal(G.started('normal', true), false, '드라이런 (프롬프트 관리자의 토큰 세기)');
    assert.equal(G.mainGenerating(), false);
    assert.deepEqual(G.snapshot, { main: null, holds: {} });
});

await test('끝 신호: GENERATION_ENDED(chat.length) · 실리태번 GENERATION_STOPPED() 은 닫고, 헬퍼의 GENERATION_STOPPED(생성 id) 는 안 닫는다', () => {
    const G = X.createGenerationState({ now: () => 1000 });
    G.started('normal', false);
    assert.equal(G.ended('7fdcd2d4-generation-id'), false, '헬퍼 멈춤');
    assert.equal(G.mainGenerating(), true);
    assert.equal(G.isHelperStop('abc'), true); assert.equal(G.isHelperStop(undefined), false); assert.equal(G.isHelperStop(12), false); assert.equal(G.isHelperStop(''), false);
    assert.equal(G.ended(12), true, 'ENDED(chat.length)');
    assert.equal(G.mainGenerating(), false);
    G.started('swipe', false);
    assert.equal(G.ended(undefined), true, 'STOPPED()');
    assert.equal(G.ended(undefined), false, '이미 닫힘');
});

await test('실리태번 isGenerating() 과 맞춰 본다: 창이 열려 있어도 쉬고 있으면 거짓 · 스트림이 살아 있으면 창 없이도 참 · TTL 넘긴 창은 닫힌다', () => {
    let t = 0;
    const G = X.createGenerationState({ now: () => t });
    G.started('normal', false);
    assert.equal(G.mainGenerating({ generating: true }), true);
    assert.equal(G.mainGenerating({ generating: false }), false, '슬래시 명령으로 끊긴 Generate — 끝 신호 없음');
    assert.equal(G.mainGenerating({ generating: undefined }), true, '모르면 창만');
    const live = { messageId: 3, isFinished: false, isStopped: false };
    assert.equal(G.mainGenerating({ processor: live, generating: false }), true, '스트림이 살아 있다');
    assert.equal(X.processorLive({ isFinished: true, isStopped: false }), false);
    assert.equal(X.processorLive({ isFinished: false, isStopped: true }), false, '끊긴 스트림');
    assert.equal(X.processorLive(null), false);
    const Q = X.createGenerationState({ now: () => t });
    Q.started('normal', false); t = X.MAIN_TTL + 1;
    assert.equal(Q.mainGenerating(), false, 'TTL');
    assert.equal(Q.snapshot.main, null);
    // 조용한 생성이 is_send_press 를 켜도 (generating: true) 창이 없으면 거짓
    const R = X.createGenerationState({ now: () => 0 });
    R.started('quiet', false);
    assert.equal(R.mainGenerating({ generating: true }), false, '조용한 생성 (헬퍼 generateRaw · 다른 확장의 Generate quiet)');
});

await test('테마의 붙잡음: hold → holding · lockReason hold · 풀기는 한 번만 · 같은 이름 여럿', () => {
    const G = X.createGenerationState({ now: () => 0 });
    assert.equal(G.lockReason(), '');
    const a = G.hold('rewrite'), b = G.hold('rewrite'), c = G.hold('assets');
    assert.equal(G.holding(), true); assert.equal(G.holding('rewrite'), true); assert.equal(G.holding('assets'), true); assert.equal(G.holding('tts'), false);
    assert.deepEqual(G.snapshot.holds, { rewrite: 2, assets: 1 });
    assert.equal(G.lockReason(), 'hold');
    assert.equal(G.mainGenerating(), false, '붙잡음은 생성 중이 아니다');
    a(); a();
    assert.deepEqual(G.snapshot.holds, { rewrite: 1, assets: 1 });
    b(); c();
    assert.equal(G.holding(), false); assert.equal(G.lockReason(), '');
    G.started('continue', false);
    assert.equal(G.lockReason({ generating: true }), 'main');
});

await test('whenIdle: 본채팅 생성과 붙잡음이 끝나고 quietMs 뒤 true · 조용한 생성은 기다리지 않음 · maxMs 넘기면 false · 알림으로 깬다', async () => {
    const G = X.createGenerationState({ now: () => Date.now() });
    G.started('normal', false);
    let generating = true;
    const p = G.whenIdle({ quietMs: 30, maxMs: 5000, generating: () => generating, tickMs: 10 });
    await sleep(60);
    let settled = null; p.then(v => { settled = v; });
    await sleep(10); assert.equal(settled, null, '생성 중엔 안 끝남');
    const release = G.hold('rewrite');
    G.ended(5); generating = false;    // 실리태번이 풀었지만 다시 쓰기가 붙잡고 있다
    await sleep(80); assert.equal(settled, null, '붙잡는 동안 안 끝남');
    release();
    await sleep(80); assert.equal(settled, true, '붙잡음이 풀리고 quietMs 뒤');
    // 조용한 생성(quiet)만 돌 때는 바로
    const Q = X.createGenerationState({ now: () => Date.now() });
    Q.started('quiet', false);
    assert.equal(await Q.whenIdle({ quietMs: 10, maxMs: 1000, generating: () => true, tickMs: 10 }), true);
    // 상한
    const T = X.createGenerationState({ now: () => Date.now() });
    T.started('normal', false);
    const t0 = Date.now();
    assert.equal(await T.whenIdle({ quietMs: 10, maxMs: 120, generating: () => true, tickMs: 10 }), false);
    assert.ok(Date.now() - t0 >= 100, '상한까지 기다림');
    // 붙잡음을 기다리지 않는 모드
    const H = X.createGenerationState({ now: () => Date.now() });
    const rel = H.hold('assets');
    assert.equal(await H.whenIdle({ quietMs: 10, maxMs: 1000, holds: false, tickMs: 10 }), true);
    rel();
    // 스트림 처리기가 살아 있으면 창 없이도 기다린다 (tick 으로 본다)
    const S = X.createGenerationState({ now: () => Date.now() });
    const proc = { messageId: 1, isFinished: false, isStopped: false };
    let done = null; S.whenIdle({ quietMs: 10, maxMs: 2000, processor: () => proc, tickMs: 10 }).then(v => { done = v; });
    await sleep(60); assert.equal(done, null);
    proc.isFinished = true;
    await sleep(80); assert.equal(done, true);
});

await test('공개 글: 금지 글자 없음 · 순수 모듈 (실리태번 import 없음)', () => {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/import\s.*from\s+['"]/.test(text), '실리태번 · 다른 모듈을 import 하지 않는다');
    assert.ok(!/\uAC24|\uC624\uD1A0\uD53D|\uC9D1\uC0AC|\uBCC4\uD3B8|\uC0DD\uD65C\uAE30\uB85D\uBD80|\uBCF4\uC774\uC2A4|Scene\x56oice/.test(text), '개인 확장 이름 · 금지 글자 없음');
});

console.log(`generation-state: ${passed} passed`);
