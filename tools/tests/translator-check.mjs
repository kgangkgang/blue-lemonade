// 번역기 2.6.0 번역 점검 · 문단만 다시 번역 · 생각 블록 번역 (가상 인물 · 가상 문장으로 만든 재현).
// 오늘 실제로 난 문제 꼴(초안 · 혼잣말 누출, 숨김 주석 깨짐, 끊긴 번역, 빠진 대사 괄호, 빠진 문단)을 원문과 견줘 문단마다 고르고,
// 정상 번역 · 번역 관례(대사 속 『』 → '')는 고르지 않는지, 표시가 저장 글을 안 건드리고 괄호 되살리기 · 주석 가리기와 같이 도는지,
// 문단만 다시 번역이 그 문단 캐시 줄만 잊고 그 문단만 갈아 끼우는지, 생각 블록 번역이 원문을 그대로 두는지 본다.
//   node tools/tests/translator-check.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';   // 2.7.9 이미 한국어인 부분 판정 (korean-keep.js · KOREAN_TARGET)

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const check = await import(pathToFileURL(path.join(dir, 'translation-check.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const notify = await import(pathToFileURL(path.join(root, 'src/rerender-notify.js')));

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const join = (...parts) => parts.join('\n\n');
const A = text => `<span style="color:#7a9cc6">${text}</span>`;   // 가상 인물 하나 (소라)
const B = text => `<span style="color:#d9a066">${text}</span>`;   // 가상 인물 둘 (하나)
const COMMENT = '<!--  写作自检：\n检查节奏：\n\n我正在复盘细节\n（请按以上步骤思考后输出结果) -->';
const SRC = [
    'The rain tapped against the greenhouse glass while Sora watered the ferns along the long wooden table.',
    A('「今日は早いね、ハナ。雨なのに来てくれたんだ」'),
    COMMENT,
    'Hana shook the water from her umbrella and laughed softly, her boots squeaking on the tiles.',
    B('「傘、壊れちゃった。『修理』してくれる？昨日の風で骨が二本も折れちゃって、もう閉じられないの」'),
    'Sora took the umbrella and turned it over in his hands, frowning at the bent ribs.',
];
const KO = [
    '소라가 긴 나무 탁자를 따라 고사리에 물을 주는 동안 빗방울이 온실 유리를 두드렸다.',
    A('「오늘은 일찍 왔네, 하나. 비 오는데 와 줬구나」'),
    COMMENT,
    '하나는 우산의 물기를 털며 나직이 웃었고, 장화가 타일 위에서 뽀득거렸다.',
    B("「우산, 망가졌어. '수리'해 줄래? 어제 바람에 살이 두 개나 부러져서 이제 안 접혀」"),
    '소라는 우산을 받아 손안에서 이리저리 돌려 보며 휘어진 살을 보고 얼굴을 찌푸렸다.',
];
const PROTECT = [/<!--[\s\S]*?-->/g];
const run = (src, out) => check.checkTranslation(join(...src), join(...out), { protect: PROTECT });
const reasonsAt = (result, index) => result.paragraphs.find(p => p.index === index)?.reasons ?? [];

// ── 1. 판정 ──
await test('a clean translation: nothing flagged, quotes inside dialogue rendered as \'\' are fine', () => {
    const result = run(SRC, KO);
    assert.equal(result.aligned, true);
    assert.equal(result.flagged, 0);
    assert.deepEqual(result.message, []);
    assert.equal(result.warn, false);
});
await test('paragraphs split like the translator: blank lines inside comments, fences and protected blocks do not split', () => {
    const text = join('one', COMMENT, '```\na\n\nb\n```', '<tracker>\nx\n\ny\n</tracker>', 'two');
    assert.equal(check.paragraphSlices(text, PROTECT).length, 5 + 1);   // <tracker> 는 보호 규칙이 없으면 두 문단
    assert.equal(check.paragraphSlices(text, [...PROTECT, /<tracker>[\s\S]*?<\/tracker>/g]).length, 5);
});
await test('draft leak (2.5.0 case): the draft line and the made-up wrapper are flagged, cleaning restores the clean translation', () => {
    const out = [...KO.slice(0, 3), '「하나는 우산의 물기를 털며」 — let me write properly.', `<output>\n${KO[3]}</output>`, ...KO.slice(4)];
    const result = run(SRC, out);
    assert.deepEqual(result.message, ['count'], 'one extra paragraph is only a note');
    assert(reasonsAt(result, 3).includes('leak'));
    assert(reasonsAt(result, 4).includes('leak'));
    assert.equal(result.warn, true);
    assert.equal(check.cleanLeaks(join(...SRC), join(...out)), join(...KO));
    assert.equal(check.cleanLeaks(join(...SRC), join(...KO)), join(...KO), 'nothing to clean');
});
await test('broken hidden comment (2.5.1 case): an open <!-- or a lone --> half is flagged; markers go to the visible paragraph before', () => {
    const open = [...KO.slice(0, 2), '<!--  쓰기 점검:\n리듬 점검:', ...KO.slice(3)];
    const result = run(SRC, open);
    assert.deepEqual(reasonsAt(result, 2), ['comment']);
    assert(result.message.includes('comments'));
    assert.equal(result.aligned, true, 'an unclosed <!-- does not swallow the paragraphs after it');
    const marked = check.markParagraphs(join(...open), [2], i => `[${i}]`, PROTECT);
    assert(marked.includes(`${KO[1]}[2]`), marked);
    assert(seg.hideOpenComments(marked).includes(`${KO[1]}[2]`), 'marker survives comment hiding');
    const lone = [...KO.slice(0, 2), '나는 세부를 복기 중\n（请按以上步骤思考后输出结果) -->', ...KO.slice(3)];
    assert.deepEqual(reasonsAt(run(SRC, lone), 2), ['comment']);
    assert(seg.hideOpenComments(check.markParagraphs(join(...lone), [2], i => `[${i}]`, PROTECT)).includes(`${KO[1]}[2]`));
    // 태그뿐인 마지막 문단(</content>)의 표시는 앞의 글 있는 문단 끝에
    assert.equal(check.markParagraphs(join('<content>\n첫 문단.', '둘째 문단.', '</content>'), [2], i => `[${i}]`, PROTECT), join('<content>\n첫 문단.', '둘째 문단.[2]', '</content>'));
    // 그림 자리뿐인 끝 문단 → 앞 문단, 그 문단 끝에 줄을 따로 차지한 닫는 태그는 건너 글 끝에
    assert.equal(check.markParagraphs(join('<content>\n첫 문단.', `${A('「대사」')}\n</content>`, '<span class="bl-asset-slot"></span>'), [2], i => `[${i}]`, PROTECT),
        join('<content>\n첫 문단.', `${A('「대사」')}[2]\n</content>`, '<span class="bl-asset-slot"></span>'));
    // 원문 그대로 둔 닫힌 주석(빈 줄을 품은)은 한 문단 · 정상
    assert.equal(run(SRC, KO).flagged, 0);
    // 깨진 주석 뒤에 주석이 또 와도 앞 <!-- 가 뒤 주석의 --> 까지 문단을 삼키지 않는다
    assert.equal(check.paragraphSlices(join('a', '<!-- open', 'b', COMMENT, 'c'), PROTECT).length, 5);
});
await test('cut translation (2.5.1): a paragraph that stops mid-sentence with the tag left open', () => {
    const out = [...KO.slice(0, 4), B('「우산, 망가졌어. \'수리'), KO[5]];
    assert(reasonsAt(run(SRC, out), 4).includes('cut'));
});
await test('dialogue brackets (2.5.2): restorable losses are not flagged (the render hook fills them); unrestorable ones are', () => {
    const lost = [KO[0], A('오늘은 일찍 왔네, 하나. 비 오는데 와 줬구나'), ...KO.slice(2)];
    assert.equal(run(SRC, lost).flagged, 0);
    const merged = [KO[0], A('소라가 말했다. 「오늘은 일찍 왔네, 하나. 비 오는데 와 줬구나」'), ...KO.slice(2)];
    assert.deepEqual(reasonsAt(run(SRC, merged), 1), ['brackets']);
    // 서술 · 속마음 속 인용 「…」 을 '…' 로 옮긴 것은 대사가 아니다
    const quote = ['She muttered 「not again」 under her breath and kept walking down the rainy street.'];
    assert.equal(check.checkTranslation(join(...quote), "그녀는 '또야'라고 중얼거리며 비 오는 거리를 계속 걸었다.", { protect: PROTECT }).flagged, 0);
});
await test('untranslated paragraph, blocked marker and echoed source are flagged', () => {
    assert.deepEqual(reasonsAt(run(SRC, [SRC[0], ...KO.slice(1)]), 0), ['same']);
    assert.deepEqual(reasonsAt(run(SRC, [`[차단된 문단 — 원문 그대로]\n${SRC[0]}`, ...KO.slice(1)]), 0), ['blocked']);
    assert(reasonsAt(run(SRC, [`${SRC[0]}\n->\n${KO[0]}`, ...KO.slice(1)]), 0).includes('echo'));
    // 원문이 한국어인 글을 그대로 둔 것 · 상태 카드 · 보호 블록은 원문 그대로가 당연하다
    assert.equal(check.checkTranslation('그는 웃었다. 오늘은 비가 그칠 것 같지 않다고 그녀가 말했다.\n\nNext line here for the test.', '그는 웃었다. 오늘은 비가 그칠 것 같지 않다고 그녀가 말했다.\n\n테스트를 위한 다음 줄.', { protect: PROTECT }).flagged, 0);
});
await test('lost paragraphs: the message is suspicious and the gap (with the missing source range) is found', () => {
    const pairs = [
        ['The greenhouse smelled of wet soil.', '온실에서는 젖은 흙냄새가 났다.'],
        [A('「おはよう」'), A('「좋은 아침」')],
        ['Sora rolled up his sleeves, pulled the heavy watering can from beneath the potting bench and began on the ferns along the far wall.', '소라는 소매를 걷어붙이고 분갈이 작업대 밑에서 무거운 물뿌리개를 끌어내 맞은편 벽을 따라 늘어선 고사리부터 물을 주기 시작했다.'],
        [B('「手伝おうか？傘はもう乾いたし、今日は時間がたっぷりあるから」'), B('「도와줄까? 우산은 벌써 말랐고, 오늘은 시간이 넉넉하거든」')],
        ['Hana hung her coat on the hook.', '하나는 외투를 고리에 걸었다.'],
        ['Outside, the rain thinned to a drizzle and a pale light crept across the rows of seedlings, catching on every droplet clinging to the glass.', '밖에서는 비가 이슬비로 잦아들었고, 옅은 빛이 모종 줄 위로 기어들어 유리에 매달린 물방울마다 걸렸다.'],
        [A('「じゃあ、そっちの棚を頼む」'), A('「그럼 저쪽 선반을 부탁해」')],
        ['She nodded.', '그녀가 고개를 끄덕였다.'],
        ['For a while neither of them spoke; there was only the patter of water on leaves and the low hum of the heater in the corner.', '한동안 둘 다 말이 없었다. 잎사귀에 떨어지는 물소리와 구석 난방기의 나지막한 웅웅거림뿐이었다.'],
        [B('「ねえ、この鉢、名前つけてもいい？」'), B('「있잖아, 이 화분에 이름 붙여도 돼?」')],
        ['Sora laughed despite himself and told her she could name every pot in the greenhouse if she wanted.', '소라는 저도 모르게 웃고는, 원한다면 온실의 화분마다 이름을 붙여도 된다고 했다.'],
        [A('「好きにしな」'), A('「마음대로 해」')],
    ];
    const src = pairs.map(p => p[0]), out = pairs.map(p => p[1]);
    const cut = [...out.slice(0, 5), ...out.slice(9)];   // 덩이 하나(문단 5~8)가 통째로 빠짐
    const result = check.checkTranslation(join(...src), join(...cut), { protect: PROTECT });
    assert.deepEqual(result.message, ['lost']);
    assert.equal(result.warn, true);
    const gap = result.paragraphs.find(p => p.reasons.includes('gap'));
    assert(gap, JSON.stringify(result.paragraphs));
    assert.equal(gap.index, 4);
    assert.deepEqual(gap.missing, [5, 8]);
    assert.equal(check.paragraphRange(join(...src), 5, 8, PROTECT), join(...src.slice(5, 9)));
    // 빠진 자리를 못 찾으면(짝을 믿을 수 없음) 마지막 문단에 메시지 단위 표시 하나 — 누를 곳이 있어야 메시지 다시 번역을 고른다
    const flat = check.checkTranslation(join(...src), join('뭉뚱그린 번역 하나.', '뭉뚱그린 번역 둘.', '뭉뚱그린 번역 셋.'), { protect: PROTECT });
    assert.deepEqual(flat.message, ['lost']);
    assert.deepEqual(flat.paragraphs.map(p => [p.index, p.reasons]), [[2, ['lost']]]);
    // 한두 문단을 합친 번역은 알림만 (의심 아님)
    const merged = [...out.slice(0, 4), `${out[4]} ${out[5]}`, ...out.slice(6)];
    const note = check.checkTranslation(join(...src), join(...merged), { protect: PROTECT });
    assert.deepEqual(note.message, ['count']);
    assert.equal(note.warn, false);
});

// ── 2. 갈아 끼우기 · 표시 ──
await test('replaceParagraph / insertAfterParagraph leave every other byte alone', () => {
    const text = join(...KO);
    const next = check.replaceParagraph(text, 3, '\n새 번역 문단.\n\n둘째 줄\n', PROTECT);
    assert.equal(next, join(...KO.slice(0, 3), '새 번역 문단.\n둘째 줄', ...KO.slice(4)), 'blank lines inside a single answer become one line break');
    assert.equal(check.insertAfterParagraph(text, 1, '끼운 하나\n\n끼운 둘', PROTECT), join(...KO.slice(0, 2), '끼운 하나', '끼운 둘', ...KO.slice(2)));
    assert.equal(check.replaceParagraph(text, 99, 'x', PROTECT), null);
    assert.equal(check.replaceParagraph(text, 0, '   ', PROTECT), null);
});
await test('standaloneParagraphs: balanced inline tags only, no open comment or fence', () => {
    assert.equal(check.standaloneParagraphs(SRC[1]), true);
    assert.equal(check.standaloneParagraphs(join(...SRC)), true);
    assert.equal(check.standaloneParagraphs('<span style="color:red">「opened here'), false);
    assert.equal(check.standaloneParagraphs('closed later</span>'), false);
    assert.equal(check.standaloneParagraphs('text <!-- open'), false);
    assert.equal(check.standaloneParagraphs('```\ncode'), false);
});

// ── 3. index.js 연결 (잘라 낸 함수 + 가짜 실리태번) ──
function cut(name) {
    const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re);
    assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
}
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';
const ko = text => { let value = String(text); SRC.forEach((line, i) => { if (i !== 2) value = value.split(line).join(KO[i]); }); return value; };
const S = { llm_prompt_chat: 'Translate visible text.', compact_tags: false, glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled' };
const T = { chat: [], chatId: 'chat-A', saved: 0, refreshed: [], events: [], stored: [], forgot: [] };
const PREFIX = 'Translate visible text.\n\n';
const hash = t => String([...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, ...notify, ...check, cardValues: cardValueModule.cardValues, getStringHash: hash, extensionSettings: S,
    getContext: () => ({ chatMetadata: {}, chat: T.chat, chatId: T.chatId, name1: 'You', saveChat: async () => { T.saved++; } }),
    guards: { capture: () => ({ assert() {}, valid: () => true, settled: () => true }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
    buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
    looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
    tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
    runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
    correctBackticks: x => x, window: {}, toastr: { info() {}, warning() {}, success() {}, error() {} }, BRACKET_NOTE, processTranslationText: (_o, t) => t,
    refreshMessageBlock: id => T.refreshed.push(id), originalHashOf: hash, markTranslatedOriginal: (message, text) => { message.extra.original_text_hash = hash(text); }, rememberTranslation: () => {}, // 6.9.5 기기 간 공유 기록 (translation-source.mjs 가 본다)
    storeTranslationQuietly: async (src, out) => T.stored.push([src, out]), eventSource: { emit: (...args) => T.events.push(args) }, emitTranslationUIUpdate: () => {}, syncMesToSwipe: () => {},
    publishArchiveReady: () => {}, translationInProgress: {}, afterWorkEnds: new WeakMap() /* 2.7.4 번역 표 → 뒷일 다리 끝 함수 (index.js 모듈 상수) */, progressBadge: () => ({ update() {}, remove() {} }), translateMessage: async () => {}, loadCheckLib: async () => check,
    FOLD_MARKUP: new Function(`return ${source.match(/^const FOLD_MARKUP = (\/.+\/);$/m)[1]}`)(),   // 6.9.6 함께 보기 HTML 은 점검하지 않는다 (translator-check-fold.mjs)
};
function install(name) { env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env); return env[name]; }
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
    'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate',
    'beginTranslation', 'endTranslation', 'isTranslationInProgress', 'checkStateOf', 'saveCheckedTranslation', 'runCheckAction', 'hideBrokenCommentsOnRender', 'installCheckHooks']) install(name);
env.forgetSegments = async (parts, signature) => { T.forgot.push(parts.filter((_, i) => i % 2 === 0)); return seg.forgetSegments(parts, signature); };
const sent = [];
env.callLLMAPI = async prompt => { const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', ''); sent.push(body); return ko(body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body); };

await test('translate({ forget: [n] }) forgets only those paragraphs of the message (other paragraph cache rows stay)', async () => {
    await seg.clearSegmentCache(); sent.length = 0; T.forgot.length = 0;
    const message = join(...SRC);
    assert.equal(await env.translate(message, { segmentCache: true }), join(...KO));
    const first = sent.length;
    await env.translate(message, { segmentCache: true, forget: [3] });
    assert.equal(T.forgot.at(-1).length, 1);
    assert.equal(T.forgot.at(-1)[0], SRC[3]);
    sent.length = 0;
    assert.equal(await env.translate(message, { segmentCache: true }), join(...KO));
    assert.equal(sent.length, 1, 'one request');
    assert(sent[0].includes(SRC[3]) && !sent[0].includes(SRC[0]) && !sent[0].includes(SRC[5]), 'only the forgotten paragraph is sent again');
    assert(first >= 1);
});
await test('「이 문단만 다시 번역」 replaces just that paragraph, saves, caches and re-checks; nothing else changes', async () => {
    await seg.clearSegmentCache(); sent.length = 0; T.saved = 0; T.stored.length = 0; T.refreshed.length = 0; T.events.length = 0;
    const view = { schedule: id => T.scheduled = id, close() {}, mark: (_id, mes) => mes, finish: x => x };
    env.checkView = view;
    const broken = [...KO.slice(0, 4), B('「우산, 망가졌어. \'수리'), KO[5]];
    const message = { mes: join(...SRC), name: 'Hana', extra: { display_text: join(...broken), original_text_hash: hash(join(...SRC)), reasoning: 'x' } };
    T.chat = [{ mes: 'hi', extra: {} }, message];
    const state = env.checkStateOf(1);
    assert(state, 'checkable');
    const result = check.checkTranslation(state.source, state.translation, { protect: state.protect });
    const row = result.paragraphs.find(p => p.index === 4);
    assert(row?.reasons.includes('cut') && row.sure);
    await env.runCheckAction('retry', 1, 4, row);
    assert.equal(message.extra.display_text, join(...KO));
    assert.equal(sent.length, 1);
    assert(sent[0].includes(SRC[4]) && !sent[0].includes(SRC[3]), 'only that paragraph was sent');
    assert.equal(T.saved, 1);
    assert.deepEqual(T.stored.at(-1), [join(...SRC), join(...KO)]);
    assert.deepEqual(T.refreshed, [1]);
    assert.equal(T.events[0][0], 'EXTENSION_LLM_TRANSLATE_DONE');
    assert.equal(T.scheduled, 1, 're-checked after the work ended');
    assert.equal(message.mes, join(...SRC), 'source untouched');
    assert.equal(message.extra.reasoning, 'x');
});
await test('the paragraph is not replaced when the translation changed meanwhile; clean / fill paths', async () => {
    const broken = [...KO.slice(0, 4), B('「우산, 망가졌어. \'수리'), KO[5]];
    const message = { mes: join(...SRC), extra: { display_text: join(...broken), original_text_hash: hash(join(...SRC)) } };
    T.chat = [message];
    const realTranslate = env.translate;
    env.translate = async (text, options) => { const out = await realTranslate(text, options); if (!options.forget) message.extra.display_text = 'changed on another device'; return out; };
    await env.runCheckAction('retry', 0, 4, { source: 4, sure: true, reasons: ['cut'] });
    env.translate = realTranslate;
    assert.equal(message.extra.display_text, 'changed on another device');
    // 걷어 내기 — 요청 없음
    sent.length = 0;
    const leaky = [...KO.slice(0, 3), '「하나는 우산의 물기를 털며」 — let me write properly.', `<output>\n${KO[3]}</output>`, ...KO.slice(4)];
    message.extra.display_text = join(...leaky);
    await env.runCheckAction('clean', 0, 3, { source: 3, sure: true, reasons: ['leak'] });
    assert.equal(message.extra.display_text, join(...KO));
    assert.equal(sent.length, 0, 'no request');
    // 빠진 문단 채우기
    message.extra.display_text = join(...KO.slice(0, 4), KO[5]);
    await env.runCheckAction('fill', 0, 3, { source: 3, sure: true, reasons: ['gap'], missing: [4, 4] });
    assert.equal(message.extra.display_text, join(...KO));
});
await test('not checkable: folded display modes, original view, stale hash, translation in progress, user messages', () => {
    const message = { mes: join(...SRC), extra: { display_text: join(...KO), original_text_hash: hash(join(...SRC)) } };
    T.chat = [message];
    assert(env.checkStateOf(0));
    assert.equal(env.checkStateOf(0, 'another text'), null, 'only the stored translation is marked');
    S.translation_display_mode = 'folded'; assert.equal(env.checkStateOf(0), null); S.translation_display_mode = 'disabled';
    S.translation_check = false; assert.equal(env.checkStateOf(0), null); delete S.translation_check;
    message.extra.original_translation_backup = 'x'; assert.equal(env.checkStateOf(0), null); delete message.extra.original_translation_backup;
    message.extra.original_text_hash = 'old'; assert.equal(env.checkStateOf(0), null); message.extra.original_text_hash = hash(join(...SRC));
    const token = env.beginTranslation(0, message); assert.equal(env.checkStateOf(0), null); env.endTranslation(0, token);
    message.is_user = true; assert.equal(env.checkStateOf(0), null);
});
await test('render hooks: markers on the stored translation only, brackets still restored, hidden comments still hidden, data untouched', async () => {
    const { createCheckView } = await import(pathToFileURL(path.join(dir, 'check-view.js')));
    globalThis.document = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
    const view = createCheckView({ stateOf: env.checkStateOf, rerender: () => {}, act: async () => {} });
    env.checkView = view;
    const hooks = [];
    env.getContext = () => ({ chatMetadata: {}, chat: T.chat, chatId: T.chatId, name1: 'You', saveChat: async () => {}, messageFormatter: { stage: { BEFORE_REGEX: 'b', AFTER_MARKDOWN: 'a' }, order: { EARLIEST: 0, LATEST: 100 }, addHook: (fn, options) => hooks.push({ fn, options }) } });
    env.commentHookAdded = false; env.checkHooksAdded = false;
    install('tidyNamesShown'); install('hideBrokenCommentsOnRender'); install('installCheckHooks');
    env.hideBrokenCommentsOnRender(); env.installCheckHooks(); env.installCheckHooks();
    assert.equal(hooks.length, 3, 'one comment hook (2.5.1) + two 2.6.0 hooks, once');
    // 괄호를 잃은 대사 줄(되살린다) + 끊긴 문단(표시) + 깨진 주석
    const stored = join(KO[0], A('오늘은 일찍 왔네, 하나. 비 오는데 와 줬구나'), '<!--  쓰기 점검:\n리듬 점검:', KO[3], B('「우산, 망가졌어. \'수리'), KO[5]);
    const message = { mes: join(...SRC), extra: { display_text: stored, original_text_hash: hash(join(...SRC)) } };
    T.chat = [message];
    const before = hooks[0].fn(stored, { messageId: 0 });
    assert(!before.includes('llmt-mark'), 'not checked yet: no marker (checked when idle)');
    view.resultOf(env.checkStateOf(0));   // 한가할 때 하는 판정을 지금
    const shown = hooks[0].fn(stored, { messageId: 0 });
    assert(shown.includes(A('「오늘은 일찍 왔네, 하나. 비 오는데 와 줬구나」')), 'brackets restored on the line');
    assert(!shown.includes('<!--  쓰기'), 'open comment hidden');
    assert(shown.includes(`${A('「오늘은 일찍 왔네, 하나. 비 오는데 와 줬구나」')}</llmt-mark-2>`), 'comment paragraph marker on the visible paragraph before (brackets still restored there)');
    assert(shown.includes(`${B('「우산, 망가졌어. \'수리」')}</llmt-mark-4>`), 'cut paragraph marker at its end (after the restored bracket)');
    const html = hooks.find(h => h.options.stage === 'a').fn(`<p>${shown}</p>`, { messageId: 0 });
    assert(/<span class="llmt-flag" data-llmt-mes="0" data-llmt-para="4" role="button" tabindex="0"[^>]*><\/span>/.test(html), html);
    assert(!html.includes('llmt-mark-'), 'no placeholder left');
    assert.equal(hooks.find(h => h.options.stage === 'a').fn('&lt;/llmt-mark-1&gt;', { messageId: 0 }).includes('data-llmt-para="1"'), true, 'encoded tags too');
    assert.equal(message.extra.display_text, stored, 'stored data untouched');
    assert.equal(hooks[0].fn(message.mes, { messageId: 0 }), message.mes, 'original view untouched');
});

// ── 4. 생각 블록 ──
await test('reasoning card: translation shown only when switched on and still matching; the original reasoning stays', async () => {
    const { createReasoningView } = await import(pathToFileURL(path.join(dir, 'reasoning-view.js')));
    const chat = [];
    const calls = [], saved = [], drawn = [];
    globalThis.document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    globalThis.toastr = { info() {}, error(...args) { calls.push(['error', ...args]); } };
    const view = createReasoningView({ getContext: () => ({ chat }), hashOf: hash, translate: async text => { calls.push(text); return `번역: ${text.slice(0, 8)}`; },
        progressText: () => '번역 중', save: async id => saved.push(id), redraw: id => drawn.push(id), enabled: () => true });
    const THOUGHT = '[语言检定]\n这次的语言要求很清楚：旁白用英文，对白用日语。\n\n[本轮任务]\n让角色在雨天的温室里慢慢聊天。';
    const message = { mes: 'body', extra: { reasoning: THOUGHT } };
    chat.push(message);
    assert.equal(view.render(THOUGHT, { messageId: 0, isReasoning: true }), THOUGHT, 'nothing before translating');
    await view.toggle(0);
    assert.deepEqual(calls, [THOUGHT]);
    assert.equal(message.extra.reasoning, THOUGHT, 'original reasoning untouched');
    assert.deepEqual(message.extra.llmt_reasoning, { hash: hash(THOUGHT), text: `번역: ${THOUGHT.slice(0, 8)}`, shown: true });
    assert.equal(view.render(THOUGHT, { messageId: 0, isReasoning: true }), message.extra.llmt_reasoning.text);
    assert.deepEqual(saved, [0]); assert.deepEqual(drawn, [0]);
    await view.toggle(0);   // 원문 보기 — 요청 없이
    assert.equal(calls.length, 1);
    assert.equal(message.extra.llmt_reasoning.shown, false);
    assert.equal(view.render(THOUGHT, { messageId: 0, isReasoning: true }), THOUGHT);
    await view.toggle(0);
    assert.equal(calls.length, 1, 'switching back uses the stored translation');
    // 생각 글이 바뀌면(편집) 옛 번역은 안 쓴다 · 실리태번 기본 번역 확장의 표시는 존중
    message.extra.reasoning = THOUGHT + '\n追加';
    assert.equal(view.render(message.extra.reasoning, { messageId: 0, isReasoning: true }), message.extra.reasoning);
    message.extra.reasoning = THOUGHT; message.extra.reasoning_display_text = '다른 확장의 번역';
    assert.equal(view.render('다른 확장의 번역', { messageId: 0, isReasoning: true }), '다른 확장의 번역');
    assert.equal(view.languageOf(THOUGHT), '중국어');
    assert.equal(view.languageOf('「雨だね」と彼女は言った。ゆっくり歩こうか。まだ時間はあるし、傘もあるから大丈夫だよ。'), '일본어');
});

// ── 5. 판 · 연결 ──
await test('wiring: hooks at start-up, endTranslation re-checks, version 2.6.0, release check runs this test', () => {
    assert(/\n {4}installCheckHooks\(\);/.test(source));
    assert(/checkView\.schedule\(messageId\)/.test(cut('endTranslation')));
    assert(/checkView\.paintFromCache\(messageId\)/.test(source));
    // 판정 · 화면 모듈은 필요할 때만 불러온다 (시작할 때 정적 import 없음)
    assert(!/^import .*from '\.\/(?:translation-check|check-view)\.js'/m.test(source), 'no static import of the check modules');
    assert(/import\('\.\/check-view\.js'\)/.test(source) && /import\('\.\/translation-check\.js'\)/.test(source));
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
    assert(version.localeCompare('2.6.0', undefined, { numeric: true }) >= 0, version);   // 올라가도 깨지지 않게
    assert(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(`>v${version}<`));
    assert(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('id="llm_translation_check"'));
    assert(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-check.mjs .'));
});

console.log(`translator-check: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
