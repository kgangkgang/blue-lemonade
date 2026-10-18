// 번역기 2.9.1 통짜 길 흘려받기 · 이어 하기 — 틀은 translator-preview.mjs 와 같다 (가상 문장만)
//   ① translateChunks · translateSegments 의 partial 알림 (이어 쓴 덩이 · 캐시 문단은 처음에, 그다음 덩이 · 묶음마다)
//   ② translate() 의 onPreview: 끝난 곳은 번역문 · 남은 곳은 원문, 상태 카드 · 보호 블록 · 숨긴 주석은 원래 모양으로 되돌린 글 (카드 값 기억에는 안 넣음)
//   ③ translationPreview: 그 메시지 .mes_text 에만 그리고 진행 표시를 지킨다 · 대상이 바뀜 · 편집 중 · 스트리밍 중 · 헬퍼 코드는 그리지 않는다 · revert
// 가상 문장만 쓴다. node tools/tests/translator-preview.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
globalThis.keepChatReadingPosition = (await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js')))).keepChatReadingPosition;
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';   // 2.7.9 이미 한국어인 부분 판정 (korean-keep.js · KOREAN_TARGET)

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const notify = await import(pathToFileURL(path.join(root, 'src/rerender-notify.js')));
const frames = await import(pathToFileURL(path.join(dir, 'preview-frames.js')));   // 2.5.5

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const LINE = n => `Line ${n}: The lantern by the window flickered while the kettle hummed softly over the stove.`;
const LINE_KO = n => `${n}번째 줄: 창가의 등불이 깜박이는 동안 주전자가 화덕 위에서 나지막이 노래했다.`;
const ko = text => String(text).replace(/Line (\d+): The lantern by the window flickered while the kettle hummed softly over the stove\./g, (_, n) => LINE_KO(n)).replace(/Sunny weather/g, '맑은 날씨');
const COMMENT = '<!--  写作自检：\n此处检查节奏：\n\n我正在复盘细节\n（请按以上步骤思考后输出结果) -->';
const STATUS = '<status_bar>\n天气：Sunny weather\n</status_bar>';

// ── ① 알림 ──
await check('translateChunks tells finished chunks after each one (not after the last), resumed chunks first', async () => {
    await resume.clearCheckpoints();
    const seen = [];
    const chunks = ['a', 'b', 'c'];
    await resume.translateChunks({ key: 'k1', chunks, request: async body => body.toUpperCase(), partial: parts => seen.push(parts.map(p => p ?? '-').join('')) });
    assert.deepEqual(seen, ['A--', 'AB-']);
    // 이어하기: 앞 두 덩이가 저장된 채 끊긴 일
    seen.length = 0;
    let calls = 0;
    await assert.rejects(resume.translateChunks({ key: 'k2', chunks, request: async body => { if (++calls === 3) throw new Error('끊김'); return body.toUpperCase(); }, partial: parts => seen.push(parts.map(p => p ?? '-').join('')) }));
    seen.length = 0;
    await resume.translateChunks({ key: 'k2', chunks, request: async body => body.toUpperCase(), partial: parts => seen.push(parts.map(p => p ?? '-').join('')) });
    assert.deepEqual(seen, ['AB-'], 'resumed chunks shown at once');
    // 알림이 던져도 번역은 계속
    const out = await resume.translateChunks({ key: 'k3', chunks, request: async body => body, partial: () => { throw new Error('화면 오류'); } });
    assert.equal(out.text, 'a\n\nb\n\nc');
});
await check('translateSegments tells cached paragraphs first, then each finished group; failures stay original', async () => {
    await seg.clearSegmentCache();
    const parts = ['A one is here.', '\n\n', 'B two is here.', '\n\n', 'C three is here.'];
    const sig = () => 's';
    await seg.translateSegments({ parts: ['A one is here.'], signature: sig, request: async bodies => bodies.map(b => b.replace('A one', '가 하나')) });
    const seen = [];
    await seg.translateSegments({ parts, signature: sig, partial: text => seen.push(text), request: async (bodies, done) => {
        const out = [];
        out.push(bodies[0].replace('B two', '나 둘')); done(out);
        out.push(null); done(out);   // 마지막 묶음 — 다 끝났으니 알리지 않는다
        return out;
    }, blockedMarker: '[막힘]' });
    assert.deepEqual(seen, ['가 하나 is here.\n\nB two is here.\n\nC three is here.', '가 하나 is here.\n\n나 둘 is here.\n\nC three is here.']);
});
await check('display card restore can run quietly (no value learning from half-translated previews)', () => {
    const heard = [];
    const reserve = (() => { const blocks = []; return block => { blocks.push(block); return `[[__VAR_${blocks.length - 1}__]]`; }; })();
    const prepared = card.prepareDisplayCards(STATUS, { reserve, learn: (a, b) => heard.push([a, b]) });
    const answer = prepared.text.replace('Sunny weather', '맑은 날씨');
    assert.equal(prepared.restore(answer, { quiet: true }), STATUS.replace('Sunny weather', '맑은 날씨'));
    assert.equal(heard.length, 0);
    prepared.restore(answer);
    assert.equal(heard.length, 1, 'the final restore still learns');
});

// ── ② translate() onPreview ──
function cut(name) {
    const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re);
    assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
}
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';   // 2.5.2 대사 괄호 안내 한 줄 (모델에 가는 글에서 떼고 본다)
const S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled' };
const T = { chat: [], chatId: 'chat-A', formatted: [], refreshed: [], dom: new Map() };
const ctx = () => ({ chatMetadata: {}, chat: T.chat, chatId: T.chatId, streamingProcessor: T.processor, messageFormatting: (text, ...rest) => { T.formatted.push([text, ...rest]); return `<p>${text}</p>`; } });
const PREFIX = 'Translate visible text.\n\n';
const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, ...notify, ...frames, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: ctx,
    guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }),
    document: { getElementById: () => null, querySelector: selector => T.dom.get(selector) ?? null },
    BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
    buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
    looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
    tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
    runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
    correctBackticks: x => x, window: {}, toastr: { warning() {} }, BRACKET_NOTE, processTranslationText: (_o, t) => t, refreshMessageBlock: (id, message) => T.refreshed.push([id, message]),
    // 6.9.6 바뀐 문단만 · 넣은 문단 조판 (자세한 것은 translator-preview-steady.mjs)
    PREVIEW_GAP_MS: Number(/\nconst PREVIEW_GAP_MS = (\d+);/.exec(source)?.[1] ?? 250), livePreviews: new Set(), typesetRoot: () => {}, dressBody: () => {},
    isProgressBadge: node => node.nodeType === 1 && node.classList.contains('llmt-progress'),
};
function install(name) { env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env); return env[name]; }
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
    'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate', 'resolveTranslationTarget', 'dressPainted', 'previewText', 'translationPreview']) install(name);
env.tidyGlossaryOutput = (_s, x) => x;
const sent = [];
env.callLLMAPI = async prompt => { const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', ''); sent.push(body); return ko(body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body); };
const MESSAGE = [STATUS, ...[1, 2, 3].map(LINE), COMMENT, ...[4, 5, 6].map(LINE)].join('\n\n');
// ── 2.9.1 통짜 길 흘려받기 · 이어 하기 (위 틀은 translator-preview.mjs 와 같다) ──
const LONG = Array.from({ length: 12 }, (_, i) => LINE(i + 1)).join('\n\n');   // 12문단 ≈ 1000자 — 문단 캐시를 안 쓰는 길에서 통짜 한 번
// 가짜 흘려받기: 답을 문단마다 끊어 onStream(지금까지 모인 글)을 부른다. cutAfter 문단에서 연결이 끊긴다
const streaming = ({ cutAfter = null } = {}) => async (prompt, overrides = {}) => {
    const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', ''); sent.push(body);
    const out = ko(body).split('\n\n');
    let acc = '';
    for (let i = 0; i < out.length; i++) {
        acc += (i ? '\n\n' : '') + out[i];
        overrides.onStream?.(acc + (i < out.length - 1 ? '\n\n' : ''));
        if (cutAfter !== null && i + 1 === cutAfter) { overrides.onStream?.(acc + '\n\n' + out[i + 1].slice(0, 9)); throw Object.assign(Error('연결이 끊겼어요'), { transient: true }); }
    }
    return out.join('\n\n');
};
await check('2.9.1 통짜 길: 요청 1번 · 미리 보기가 문단마다 · 진행 표시에 「문단 n/전체」 · 결과는 예전과 같다', async () => {
    await resume.clearCheckpoints(); sent.length = 0;
    env.callLLMAPI = streaming();
    const previews = [], stages = [];
    const out = await env.translate(LONG, { onPreview: text => previews.push(text), onProgress: info => stages.push(info) });
    assert.equal(sent.length, 1, '요청 한 번');
    assert.equal(out, ko(LONG));
    assert.ok(previews.length >= 10, '닫힌 문단마다 미리 보기: ' + previews.length);
    assert.ok(previews[0].startsWith(LINE_KO(1)) && previews[0].includes(LINE(12)), '끝난 곳은 번역문 · 남은 곳은 원문');
    for (const view of previews) assert.equal(view.split('\n\n').length, 12, '문단 배치 그대로');
    const counted = stages.filter(s => s.stage === 'chunks');
    assert.ok(counted.length >= 10 && counted.every(s => s.total === 12), '「문단 n/12」');
    assert.equal(counted.at(-1).done, 11);
});
await check('2.9.1 통짜 길: 7문단 받고 끊김 → 다시 번역하면 남은 5문단만 한 번에 · 결과는 한 번에 받은 것과 같다', async () => {
    await resume.clearCheckpoints(); sent.length = 0;
    env.callLLMAPI = streaming({ cutAfter: 7 });
    await assert.rejects(env.translate(LONG, { onPreview: () => {}, onProgress: () => {} }), /연결이 끊겼어요/);
    sent.length = 0; env.callLLMAPI = streaming();
    const stages = [];
    const out = await env.translate(LONG, { onPreview: () => {}, onProgress: info => stages.push(info) });
    assert.equal(sent.length, 1);
    assert.ok(!sent[0].includes(LINE(7)) && sent[0].includes(LINE(8)) && sent[0].includes(LINE(12)), '8 ~ 12 문단만: ' + sent[0].slice(0, 60));
    assert.equal(out, ko(LONG));
    assert.ok(stages.some(s => s.stage === 'chunks' && s.resumed === 7), '「이어 번역」 표시');
    sent.length = 0; await env.translate(LONG, { onPreview: () => {}, onProgress: () => {} });
    assert.ok(sent[0].includes(LINE(1)), '끝나면 이어 하기 지움 — 다음엔 처음부터');
});
await check('2.9.1 통짜 길: 문단을 합쳐 쓴 답(짝이 안 맞음)은 맞는 앞 문단까지만 남긴다 · 진행 표시 · 미리 보기가 없으면 흘려받지 않는다', async () => {
    await resume.clearCheckpoints(); sent.length = 0;
    // 3번째 답 문단에 3 · 4 를 합쳐 씀 → 길이가 원문 3 의 3배를 넘지 않게 짧게 합치면 걸리지 않으니, 따옴표 모양을 다르게 해 짝이 깨지게 한다
    env.callLLMAPI = async (prompt, overrides = {}) => {
        const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', ''); sent.push(body);
        const out = ko(body).split('\n\n'); out[2] = '"' + out[2];
        overrides.onStream?.(out.slice(0, 5).join('\n\n') + '\n\n');
        throw Error('시간 초과');
    };
    await assert.rejects(env.translate(LONG, { onPreview: () => {}, onProgress: () => {} }));
    sent.length = 0; env.callLLMAPI = streaming();
    await env.translate(LONG, { onPreview: () => {}, onProgress: () => {} });
    assert.ok(!sent[0].includes(LINE(2)) && sent[0].includes(LINE(3)), '짝이 맞는 1 · 2 만 남김');
    await resume.clearCheckpoints(); sent.length = 0;
    let streamed = false;
    env.callLLMAPI = async (prompt, overrides = {}) => { streamed ||= typeof overrides.onStream === 'function'; return ko(prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', '')); };
    await env.translate(LONG);
    assert.equal(streamed, false, '보여 줄 곳이 없으면 예전처럼 한꺼번에');
});
env.callLLMAPI = async prompt => { const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', ''); sent.push(body); return ko(body); };
console.log(`translator-whole-stream: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
