// 과일 프리셋 호환 — 「생성 중」 판정 배선 (테마 6.5.2 세션3): main-chat-rules.js 의 isMainChatGenerating · holdGenerationState · whenMainChatIdle 과
//   세 애드온(다시 쓰기 · 번역 · 에셋)이 그것을 쓰는지. 순수 판정은 generation-state.mjs 가 본다.
//   node tools/tests/fruit-compat-generating.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
if (!fs.existsSync(path.join(root, 'src/generation-state.js'))) { console.log('skip: 이 트리에는 generation-state.js 가 없어요 (6.5.2 이전)'); process.exit(0); }

// 실리태번 흉내: eventSource.on 으로 받은 처리기를 모아 두고 직접 부른다. streamingProcessor 는 바꿀 수 있게
const handlers = {};
const ctx = { streamingProcessor: null };
const E = { GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended', GENERATION_STOPPED: 'generation_stopped', CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready' };
globalThis.SillyTavern = { getContext: () => ({ event_types: E, eventSource: { on: (name, fn) => { (handlers[name] ||= []).push(fn); } }, streamingProcessor: ctx.streamingProcessor }) };
const emit = (name, ...args) => { for (const fn of handlers[name] || []) fn(...args); };
const M = await import(pathToFileURL(path.join(root, 'src/main-chat-rules.js')).href);

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

await test('배선: 본채팅 GENERATION_STARTED ~ ENDED/STOPPED 만 생성 중 · 헬퍼의 STOPPED(생성 id) 는 끝이 아님 · 조용한 생성은 아님', () => {
    M.startMainChatRules();
    for (const key of ['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED']) assert.ok(handlers[E[key]]?.length, key + ' 처리기');
    assert.equal(M.isMainChatGenerating(), false);
    emit(E.GENERATION_STARTED, 'normal', {}, false);
    assert.equal(M.isMainChatGenerating(), true);
    emit(E.GENERATION_STOPPED, '7fdcd2d4-helper-generation-id');
    assert.equal(M.isMainChatGenerating(), true, '헬퍼의 멈춤은 이 답의 끝이 아니다');
    emit(E.GENERATION_ENDED, 3);
    assert.equal(M.isMainChatGenerating(), false);
    emit(E.GENERATION_STARTED, 'quiet', {}, false);
    assert.equal(M.isMainChatGenerating(), false, '조용한 생성 (다른 확장 · 헬퍼 generateRaw)');
    emit(E.GENERATION_STARTED, 'normal', {}, true);
    assert.equal(M.isMainChatGenerating(), false, '드라이런');
    emit(E.GENERATION_STARTED, 'swipe', {}, false);
    emit(E.GENERATION_STOPPED);
    assert.equal(M.isMainChatGenerating(), false, '사용자의 멈춤');
    assert.equal(M.generationLockReason(), '');
});

await test('살아 있는 스트림은 창 없이도 생성 중 · 끝난 스트림은 아님', () => {
    ctx.streamingProcessor = { messageId: 4, isFinished: false, isStopped: false };
    assert.equal(M.isMainChatGenerating(), true);
    assert.equal(M.generationLockReason(), 'main');
    ctx.streamingProcessor.isFinished = true;
    assert.equal(M.isMainChatGenerating(), false);
    ctx.streamingProcessor = null;
});

await test('테마의 붙잡음(다시 쓰기 · 에셋): 생성 중은 아니지만 까닭 hold · whenMainChatIdle 이 풀리길 기다린다', async () => {
    const release = M.holdGenerationState('rewrite');
    assert.equal(M.isMainChatGenerating(), false);
    assert.equal(M.generationLockReason(), 'hold');
    assert.deepEqual(M.generationState.snapshot.holds, { rewrite: 1 });
    let settled = null;
    M.whenMainChatIdle({ quietMs: 20, maxMs: 2000, tickMs: 10 }).then(v => { settled = v; });
    await sleep(60); assert.equal(settled, null, '붙잡는 동안');
    release(); release();
    await sleep(80); assert.equal(settled, true);
    assert.equal(M.generationLockReason(), '');
    assert.equal(await M.whenMainChatIdle({ quietMs: 10, maxMs: 500, tickMs: 10 }), true, '쉬고 있으면 바로');
    emit(E.GENERATION_STARTED, 'regenerate', {}, false);
    assert.equal(await M.whenMainChatIdle({ quietMs: 10, maxMs: 80, tickMs: 10 }), false, '상한');
    emit(E.GENERATION_ENDED, 9);
});

await test('세 애드온이 공용 판정을 쓴다 (앵커)', () => {
    const rewrite = read('src/addons/rewrite/index.js');
    const check = rewrite.slice(rewrite.indexOf('async function checkLastMessage()'), rewrite.indexOf('const { chat } = getContext();', rewrite.indexOf('async function checkLastMessage()')));
    assert.ok(check.includes('isMainChatGenerating()') && check.includes('whenMainChatIdle('), '다시 쓰기 단추: 본채팅 생성 중이면 기다렸다가 이어서');
    assert.ok(!check.includes("dataset.generating === 'true'"), '다시 쓰기 단추가 body[data-generating] 을 안 본다');
    assert.ok(/import \{[^}]*isMainChatGenerating[^}]*\} from '\.\.\/\.\.\/main-chat-rules\.js'/.test(rewrite));
    const reroll = read('src/addons/rewrite/reroll.js');
    assert.ok(reroll.includes("holdGenerationState('rewrite')") && reroll.includes('releaseState()'), '다시 쓰기 붙잡음 등록 · 풀기');
    assert.ok(/const onStop = \(id\) => \{ if \(typeof id === 'string' && id\) return; controller\.abort\(\); \};/.test(reroll), '헬퍼의 GENERATION_STOPPED(생성 id) 는 멈춤이 아니다');
    const translator = read('src/addons/translator/index.js');
    const after = translator.slice(translator.indexOf('function afterGeneration('), translator.indexOf('\n}\n', translator.indexOf('function afterGeneration(')));
    assert.ok(after.includes('whenMainChatIdle({ quietMs })') && !after.includes('MutationObserver'), '번역 다시 하기는 생성 상태를 기다린다');
    assert.ok(translator.includes("const onStop = (id) => { if (typeof id === 'string' && id) return; stopped = true; };"), '보내기 번역의 멈춤도 헬퍼 id 는 무시');
    const selection = read('src/addons/translator/selection/state.js');
    assert.ok(selection.includes("import { isMainChatGenerating } from '../../../main-chat-rules.js'") && selection.includes('if (isMainChatGenerating()) throw Error') && !selection.includes("import('/script.js')"), '고른 글 재번역 · 분석');
    assert.ok(rewrite.includes('reanchorRewrite(current.mes, visibleText(current), visible, result.text)'), '글 바뀜 되살리기');
    assert.ok(rewrite.includes("messageWork().noteWrite(message, { by: 'rewrite'"), '다시 쓰기의 쓰기 기록');
    const afterReply = read('src/addons/assets/after-reply.js');
    assert.equal((afterReply.match(/messageWork\(\)\.noteWrite\(message, \{ by: 'assets'/g) || []).length, 3, '에셋의 쓰기 기록 (자리 넣기 · 모르는 자리 지우기 · ··· 메뉴 다시 고르기의 자리 넣기)');
    const prompt = read('src/addons/assets/prompt.js');
    assert.ok(prompt.includes("holdGenerationState('assets')") && prompt.includes("if ((typeof arg === 'string' && arg) || isMainChatGenerating()) return;"), '에셋: 붙잡음 등록 · 남의 끝 신호 무시');
    const ci = read('.github/workflows/release-check.yml');
    assert.ok(ci.includes('node tools/tests/generation-state.mjs .') && ci.includes('node tools/tests/fruit-compat-generating.mjs .'), 'CI 등록');
});

await test('reanchorRewrite(core.js): 생각 블록이 떨어져 나가도 · 자리 줄이 들어와도 고친 글을 지금 글에 다시 끼운다 · 문장이 바뀌면 null', async () => {
    const C = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/core.js')).href);
    const visible = '<content>\nHe pushed his wire-rimmed glasses up his nose.\n\n「おはよう」\n</content>';
    const fixed = visible.replace('his wire-rimmed glasses up his nose', 'the hair from his brow');
    const ecot = '<ECoT>\n생각\n</ECoT>\n';
    // 고칠 때는 <ECoT> 가 붙어 있었고(visibleText 가 뺀 글이 visible), 헬퍼가 그 사이 블록을 떼어 냄 → 지금 글 = visible
    assert.equal(C.reanchorRewrite(visible, visible, visible, fixed), fixed);
    // 블록이 그대로 남은 글에도 (지금 글 = ECoT + visible, 보이는 부분 = visible)
    assert.equal(C.reanchorRewrite(ecot + visible, visible, visible, fixed), ecot + fixed);
    // 자리 줄이 들어온 글
    const slot = '<span class="bl-asset-slot" data-asset-slot="asa0123456789ab"></span>';
    const withSlot = visible.replace('\n\n「おはよう」', `\n\n${slot}\n\n「おはよう」`);
    assert.equal(C.reanchorRewrite(withSlot, withSlot, visible, fixed), fixed.replace('\n\n「おはよう」', `\n\n${slot}\n\n「おはよう」`));
    // 다른 문장이 바뀌었으면 버린다
    assert.equal(C.reanchorRewrite(visible.replace('おはよう', 'こんにちは'), visible.replace('おはよう', 'こんにちは'), visible, fixed), null);
    assert.equal(C.reanchorRewrite('', '', visible, fixed), null);
    assert.equal(C.reanchorRewrite(visible, 'elsewhere', visible, fixed), null);
});

await test('공개 글: 바뀐 파일에 금지 글자 없음', () => {
    for (const rel of ['src/generation-state.js', 'src/main-chat-rules.js', 'src/addons/rewrite/index.js', 'src/addons/rewrite/reroll.js', 'src/addons/translator/selection/state.js', 'src/addons/assets/prompt.js']) {
        assert.ok(!/\uAC24|\uC624\uD1A0\uD53D|\uC9D1\uC0AC|\uBCC4\uD3B8|\uC0DD\uD65C\uAE30\uB85D\uBD80|Scene\x56oice/.test(read(rel)), rel);
    }
});

console.log(`fruit-compat-generating: ${passed} passed`);
