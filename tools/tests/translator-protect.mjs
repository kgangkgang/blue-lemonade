// 6.1.8 번역기 보호 블록 (그림 자리 같은 것): 런타임 보호 규칙의 순서 · 중복 · 해제, 빠진 블록 되돌리기, 접기 보기에서 한 번만 그리기,
// 대기열이 글만 바뀐 답을 버리지 않기, 다시 그린 뒤 알림, 'HTML 이면 거절' 검사에서 보호 블록 빼기.
// index.js 안의 함수를 잘라 node 에서 돌린다 (브라우저 · 실리태번 · 네트워크 없음).
//   node tools/tests/translator-protect.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dev = path.resolve(process.argv[2] || '.');
const dir = path.join(dev, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
function cut(name) {
    let start = source.indexOf(`\nfunction ${name}(`);
    if (start < 0) start = source.indexOf(`\nexport function ${name}(`);
    if (start < 0) start = source.indexOf(`\nasync function ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let j = source.indexOf(') {', start) + 2; j < source.length; j++) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return source.slice(start + 1, j + 1).replace(/^export /, '');
    }
    throw new Error('unbalanced ' + name);
}
const constLine = name => { const m = new RegExp(`\\nconst ${name} = [^\\n]*`).exec(source); assert.ok(m, 'missing const ' + name); return m[0].slice(1); };
const url = file => JSON.stringify(pathToFileURL(path.join(dir, file)).href);
const names = ['getCombinedRegexes', 'compileUserPattern', 'getNoFoldRegexes', 'protectBlock', 'unprotectBlock', 'runtimeRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks',
    'resolveQueuedTarget', 'refreshMessageBlock', 'localOrDisplayedTranslation', 'originalHashOf',
    'processTranslationText', 'applyIsolation', 'analyzeStructure', 'extractPureText', 'renderTranslation', 'renderAllInOne', 'renderInterleaved', 'createDetailsTag', 'restoreContent'];
const module = `import { withDisplayCardsProtected, withoutDisplayCards, displayCardBlocks, matchesDisplayCardStructure } from ${url('display-cards.js')};
import { splitBlockPrefix, structureLines, isHeadingUnderline, isBareQuote, paragraphBlocks, splitCrossLineEmphasis, dropTokens } from ${url('translation-segments.js')};
import { createGuards } from ${url('translation-guard.js')};
export const extensionSettings = { translation_display_mode: 'disabled', force_sequential_matching: false, user_defined_regexes: [], user_no_fold_regexes: [] };
export const T = { chat: [], chatId: 'chat-A', groupId: null, characterId: 1, rendered: [], events: [], editing: false, cached: null, notified: [] };
const getContext = () => ({ chat: T.chat, chatId: T.chatId, groupId: T.groupId, characterId: T.characterId, getCurrentChatId: () => T.chatId });
export const guards = createGuards(getContext);
const window = {}, toastr = { error() {}, warning() {} };
const correctBackticks = input => input;
const getStringHash = text => { let h = 0; for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; };
const readCachedTranslation = async () => T.cached;
const updateMessageBlock = (id) => { T.rendered.push(Number(id)); };
const document = { querySelector: () => ({ querySelector: () => (T.editing ? {} : null) }), dispatchEvent: event => { T.events.push(event); return true; } };
class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
const notifyRerender = async (id) => { T.notified.push(Number(id)); return false; };   // 6.5.2 src/rerender-notify.js 흉내 (index.js 의 import 는 여기 없다)
${constLine('runtimeProtections')}
${constLine('FOLD_MARKUP')}
${names.map(cut).join('\n')}
export { getCombinedRegexes, getNoFoldRegexes, protectBlock, unprotectBlock, protectedBlockRegexes, isProtectedBlock, withoutProtectedBlocks, resolveQueuedTarget, refreshMessageBlock, localOrDisplayedTranslation, originalHashOf };
export function render(orig, trans, mode = 'folded', force = false) {
    extensionSettings.translation_display_mode = mode; extensionSettings.force_sequential_matching = force;
    return processTranslationText(orig, trans);
}
`;
const file = path.join(os.tmpdir(), `llmt-protect-${process.pid}.mjs`);
fs.writeFileSync(file, module);
const M = await import(pathToFileURL(file).href);
fs.unlinkSync(file);
const { restoreDroppedPlaceholders, droppedPlaceholders, dropTokens, segmentParagraphs } = await import(pathToFileURL(path.join(dir, 'translation-segments.js')).href);
const { extensionSettings: S, T } = M;

// 다른 확장이 본문에 넣는 그림 자리 (예시 모양 — 테마는 어떤 모양이든 protect() 로 등록된 규칙만 본다)
const SLOT = id => `<span class="picture-slot" data-picture-slot="${id}">[그림]</span>`;
const SLOT_RULE = /<span class="picture-slot"(?: data-picture-slot="[a-zA-Z0-9-]+")?>\[그림\]<\/span>/g;
const count = (text, needle) => String(text).split(needle).length - 1;
// translate() 와 같은 가리기: 규칙 차례대로, 규칙 안에서는 글 차례대로 [[__VAR_n__]]
function mask(text) {
    const blocks = [];
    let masked = text;
    for (const regex of M.getCombinedRegexes()) masked = masked.replace(regex, match => { blocks.push(match); return `[[__VAR_${blocks.length - 1}__]]`; });
    return { masked, blocks };
}
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

// ── 1. 런타임 보호 규칙 ──
test('runtime rules come after built-in and user rules, so earlier placeholder numbers never move', () => {
    S.user_defined_regexes = ['/<note>[\\s\\S]*?<\\/note>/g'];
    const text = `<think>x</think>\n\nA <note>n</note>\n\n${SLOT('s1')}\n\nB`;
    const before = mask(text);
    assert.equal(M.protectBlock('picture', SLOT_RULE, { noFold: true }), true);
    const after = mask(text);
    const sources = M.getCombinedRegexes().map(r => r.source);
    assert.equal(sources.at(-1), SLOT_RULE.source, 'registered rule is last');
    assert.equal(sources.indexOf('<note>[\\s\\S]*?<\\/note>'), sources.length - 2, 'user rule stays before it');
    assert.deepEqual(after.blocks.slice(0, before.blocks.length), before.blocks, 'earlier blocks keep their numbers');
    assert.equal(after.blocks.at(-1), SLOT('s1'));
    assert.ok(after.masked.includes(`\n\n[[__VAR_${after.blocks.length - 1}__]]\n\nB`), 'slot paragraph is a placeholder-only paragraph');
    const parts = segmentParagraphs(after.masked);
    assert.ok(parts.some(p => /^\[\[__VAR_\d+__\]\]$/.test(p)), 'the segment path sees a placeholder-only paragraph (skipped, never sent)');
});
test('the same source already in the user list is not added twice; noFold rules join the fold-protection list; memory only', () => {
    const settingsBefore = JSON.stringify(S);
    S.user_defined_regexes = [`/${SLOT_RULE.source}/g`];
    S.user_no_fold_regexes = [`/${SLOT_RULE.source}/g`];
    assert.equal(M.getCombinedRegexes().filter(r => r.source === SLOT_RULE.source).length, 1);
    assert.equal(M.getNoFoldRegexes().filter(r => r.source === SLOT_RULE.source).length, 1);
    S.user_defined_regexes = []; S.user_no_fold_regexes = [];
    assert.equal(M.getNoFoldRegexes().filter(r => r.source === SLOT_RULE.source).length, 1, 'registered noFold rule is a fold-protection rule');
    assert.equal(M.protectBlock('text-only', /<keep>x<\/keep>/g, { noFold: false }), true);
    assert.equal(M.getNoFoldRegexes().some(r => r.source === '<keep>x<\\/keep>'), false, 'noFold:false stays out of the fold list');
    assert.equal(M.getCombinedRegexes().some(r => r.source === '<keep>x<\\/keep>'), true);
    assert.equal(M.unprotectBlock('text-only'), true); assert.equal(M.unprotectBlock('text-only'), false);
    assert.equal(M.getCombinedRegexes().some(r => r.source === '<keep>x<\\/keep>'), false);
    assert.equal(JSON.stringify({ ...S, user_defined_regexes: [], user_no_fold_regexes: [] }), JSON.stringify({ ...JSON.parse(settingsBefore), user_defined_regexes: [], user_no_fold_regexes: [] }), 'settings untouched');
});
test('protect accepts strings and adds g; rejects empty ids, bad patterns and rules that match empty text; fresh RegExp objects each call', () => {
    assert.equal(M.protectBlock('s', '/<x-slot>[^<]*<\\/x-slot>/i'), true);
    const rule = M.getCombinedRegexes().find(r => r.source === '<x-slot>[^<]*<\\/x-slot>');
    assert.ok(rule && rule.flags.includes('g') && rule.flags.includes('i'));
    assert.notEqual(rule, M.getCombinedRegexes().find(r => r.source === '<x-slot>[^<]*<\\/x-slot>'));
    assert.equal(M.protectBlock('', SLOT_RULE), false);
    assert.equal(M.protectBlock('empty', /x*/g), false);
    const error = console.error; console.error = () => {}; // 잘못된 정규식은 compileUserPattern 이 콘솔에 남긴다
    try { assert.equal(M.protectBlock('bad', '/(/g'), false); } finally { console.error = error; }
    M.unprotectBlock('s');
});

// ── 2. 빠진 보호 블록 되돌리기 ──
test('a dropped standalone protected paragraph goes back to its source position', () => {
    assert.equal(restoreDroppedPlaceholders('A\n\n[[__VAR_0__]]\n\nB', '가\n\n나', ['[[__VAR_0__]]']), '가\n\n[[__VAR_0__]]\n\n나');
    assert.equal(restoreDroppedPlaceholders('[[__VAR_0__]]\n\nA', '가', ['[[__VAR_0__]]']), '[[__VAR_0__]]\n\n가');
    assert.equal(restoreDroppedPlaceholders('A\n\n[[__VAR_0__]]', '가', ['[[__VAR_0__]]']), '가\n\n[[__VAR_0__]]');
    assert.equal(restoreDroppedPlaceholders('A\n\n[[__VAR_0__]]\n\n[[__VAR_1__]]\n\nB', '가\n\n나', ['[[__VAR_0__]]', '[[__VAR_1__]]']), '가\n\n[[__VAR_0__]]\n\n[[__VAR_1__]]\n\n나');
});
test('a protected block dropped inside a paragraph returns to that paragraph (front or back as in the source)', () => {
    assert.equal(restoreDroppedPlaceholders('A [[__VAR_0__]] B\n\nC', '가 나\n\n다', ['[[__VAR_0__]]']), '가 나 [[__VAR_0__]]\n\n다');
    assert.equal(restoreDroppedPlaceholders('[[__VAR_0__]] A\n\nC', '가\n\n다', ['[[__VAR_0__]]']), '[[__VAR_0__]] 가\n\n다');
    assert.equal(restoreDroppedPlaceholders('[[__VAR_0__]]\nA', '가', ['[[__VAR_0__]]']), '[[__VAR_0__]]\n가');
});
test('when paragraph counts do not line up the block is appended at the end; present or unknown placeholders are left alone', () => {
    assert.equal(restoreDroppedPlaceholders('A\n\nB\n\n[[__VAR_0__]]\n\nC', '가나다', ['[[__VAR_0__]]']), '가나다\n\n[[__VAR_0__]]');
    assert.equal(restoreDroppedPlaceholders('A\n\n[[__VAR_0__]]', '가\n\n[[__VAR_0__]]', ['[[__VAR_0__]]']), '가\n\n[[__VAR_0__]]');
    assert.equal(restoreDroppedPlaceholders('A', '가', ['[[__VAR_5__]]']), '가');
});
test('dropped placeholders are counted by value: the correction bundle sends a block twice and one copy in the answer is enough', () => {
    const blocks = [SLOT('a'), SLOT('a'), '<think>t</think>'];
    const keep = value => SLOT_RULE.test(value) && !(SLOT_RULE.lastIndex = 0) && value.replace(SLOT_RULE, '') === '';
    assert.deepEqual(droppedPlaceholders(blocks, 'X\n\n[[__VAR_0__]]', '번역\n\n[[__VAR_1__]]', keep), [], 'answer kept the other copy');
    assert.deepEqual(droppedPlaceholders(blocks, 'X\n\n[[__VAR_0__]]', '번역', keep), ['[[__VAR_0__]]']);
    assert.deepEqual(droppedPlaceholders(blocks, 'X [[__VAR_2__]]', '번역', keep), [], 'non-protected blocks are not forced back');
    assert.equal(M.isProtectedBlock(SLOT('a')), true, 'registered slot rule makes a protected block');
    assert.equal(M.isProtectedBlock('<think>t</think>'), false);
    assert.equal(M.isProtectedBlock(SLOT('a') + ' tail'), false, 'only a whole match counts');
});

// ── 3. 접기 보기: 보호 블록은 번역문 쪽에만 ──
test('fold views draw a mid-line protected block once (folded, original-first, unfolded)', () => {
    const orig = `Hello ${SLOT('m1')} world.\n\nBye.`, trans = `안녕 ${SLOT('m1')} 세상.\n\n잘 가.`;
    for (const mode of ['folded', 'original_first', 'unfolded']) {
        const html = M.render(orig, trans, mode);
        assert.equal(count(html, 'data-picture-slot="m1"'), 1, mode + ': ' + html);
        assert.ok(html.includes('Hello  world.') || html.includes('Hello world.'), mode + ': original text kept');
    }
});
test('when line counts differ (whole-message view with masks) the protected block is drawn once, not again in the full original', () => {
    const orig = `A.\nB.\n\n${SLOT('w1')}\n\nC.`, trans = `가. 나.\n\n${SLOT('w1')}\n\n다.`;
    const html = M.render(orig, trans, 'folded');
    assert.equal(count(html, 'data-picture-slot="w1"'), 1, html);
    assert.ok(html.includes('A.') && html.includes('다.'));
});
test('a block missing from an old translation still shows once (taken from the original side)', () => {
    const html = M.render(`Hello ${SLOT('o1')} world.`, '안녕 세상.', 'folded');
    assert.equal(count(html, 'data-picture-slot="o1"'), 1, html);
});
test('standalone protected lines stay one MASK node; disabled view is the raw translation', () => {
    const orig = `A.\n\n${SLOT('x')}\n\nB.`, trans = `가.\n\n${SLOT('x')}\n\n나.`;
    assert.equal(count(M.render(orig, trans, 'folded'), 'data-picture-slot="x"'), 1);
    assert.equal(M.render(orig, trans, 'disabled'), trans);
    assert.equal(dropTokens('a __MASK_COMBINED_ORIG_1__ b __MASK_COMBINED_ORIG_1__', ['__MASK_COMBINED_ORIG_1__']), 'a  b ');
});

// ── 4. 대기열: 글만 바뀐 답은 지금 글로 ──
test('a queued auto translation survives a text-only change and still drops chat, swipe, revision and display changes', () => {
    const message = { mes: 'Reply.', swipe_id: 0, extra: {} };
    T.chat.length = 0; T.chat.push({ mes: 'user', extra: {} }, message); T.chatId = 'chat-A';
    const ref = () => ({ message, guard: M.guards.capture(message), mes: message.mes, chatId: T.chatId });
    let r = ref();
    assert.equal(M.resolveQueuedTarget(1, r), 1, 'unchanged');
    message.mes = 'Reply.\n\n' + SLOT('q1');
    assert.equal(M.resolveQueuedTarget(1, r), 1, 'text-only change keeps the task (translate the current text)');
    T.chat.unshift({ mes: 'older', extra: {} });
    assert.equal(M.resolveQueuedTarget(1, r), 2, 'follows the message when an earlier one is inserted');
    T.chat.shift();
    r = ref(); message.swipe_id = 1; assert.equal(M.resolveQueuedTarget(1, r), null, 'swipe change'); message.swipe_id = 0;
    r = ref(); M.guards.messageChanged(1); assert.equal(M.resolveQueuedTarget(1, r), null, 'revision change (MESSAGE_EDITED)');
    r = ref(); message.extra.display_text = 'done'; assert.equal(M.resolveQueuedTarget(1, r), null, 'someone else wrote the translation'); delete message.extra.display_text;
    r = ref(); M.guards.chatChanged(); assert.equal(M.resolveQueuedTarget(1, r), 1, '6.5.2 same chat reloaded in place keeps the target');
    r = ref(); T.chatId = 'chat-B'; M.guards.chatChanged(); T.chatId = 'chat-A'; M.guards.chatChanged(); assert.equal(M.resolveQueuedTarget(1, r), null, 'chat changed (away and back)');
    r = ref(); T.chatId = 'chat-B'; message.mes += '!'; assert.equal(M.resolveQueuedTarget(1, r), null, 'other chat'); T.chatId = 'chat-A';
    r = ref(); T.chat.splice(1, 1); message.mes += '?'; assert.equal(M.resolveQueuedTarget(1, r), null, 'message deleted');
    assert.equal(M.resolveQueuedTarget(3, null), 3, 'no ref: plain number');
    assert.equal(M.resolveQueuedTarget(3, { message: null }), null);
});

// ── 5. 다시 그린 뒤 알림 ──
test('refreshMessageBlock announces llm-translator:rendered after redrawing, not while the edit box is open', () => {
    T.rendered.length = 0; T.events.length = 0; T.editing = false; T.notified.length = 0;
    M.refreshMessageBlock('4', {});
    assert.deepEqual(T.rendered, [4]);
    assert.deepEqual(T.notified, [4], '6.5.2 다시 그린 뒤 헬퍼 알림 (문서 이벤트 다음)');
    assert.equal(T.events.length, 1); assert.equal(T.events[0].type, 'llm-translator:rendered'); assert.deepEqual(T.events[0].detail, { messageId: 4 });
    T.editing = true; M.refreshMessageBlock(5, {}); T.editing = false;
    assert.deepEqual(T.rendered, [4]); assert.equal(T.events.length, 1);
    assert.deepEqual(T.notified, [4], '편집 창이 열려 있으면 알리지 않는다');
});

// ── 6. 'HTML 이면 거절' 검사에서 보호 블록 빼기 ──
{ // async — test() 는 동기라 따로 센다
    const original = `Hello.\n\n${SLOT('r1')}\n\nBye.`;
    const message = { mes: original, extra: { original_text_hash: M.originalHashOf(original), display_text: `안녕.\n\n${SLOT('r1')}\n\n잘 가.` } };
    T.cached = null;
    assert.equal(await M.localOrDisplayedTranslation(message, original), message.extra.display_text);
    message.extra.display_text = `안녕 <b>굵게</b>.\n\n${SLOT('r1')}`;
    assert.equal(await M.localOrDisplayedTranslation(message, original), null, 'other HTML still refused');
    message.extra.display_text = `<details class="llm-translator-details mode-folded"><summary>${SLOT('r1')}</summary></details>`;
    assert.equal(await M.localOrDisplayedTranslation(message, original), null, 'fold markup refused even if only protected blocks remain');
    message.extra.display_text = '<span class="translated_text">x</span>';
    assert.equal(await M.localOrDisplayedTranslation(message, original), null);
    message.extra.original_text_hash = 'stale'; message.extra.display_text = '안녕.';
    assert.equal(await M.localOrDisplayedTranslation(message, original), null, 'stale hash refused');
    assert.equal(M.withoutProtectedBlocks(`a${SLOT('z')}b`), 'ab');
    passed++; console.log('PASS a plain-view translation that only carries protected blocks is reused; fold markup / other HTML / stale hash are still refused');
}
// ── 7. 6.5.4 과일 · 데우스 생각 블록은 번역하지 않음 (본문 · 속마음 · 상태 카드는 그대로 번역) ──
test('6.5.4 Fruit ECoT, a headless reply-start thought and Deus Scene Plan are protected; story, true thoughts and cards are not', () => {
    S.user_defined_regexes = []; M.unprotectBlock('picture');
    const fruit = '<ECoT>\n思考 plan\n</ECoT>\n<content>\n"Hello."\n<true_thoughts character="A">quiet</true_thoughts>\n</content>\n<status_bar>Time: noon</status_bar>';
    const f = mask(fruit);
    assert.deepEqual(f.blocks, ['<ECoT>\n思考 plan\n</ECoT>']);
    assert.ok(f.masked.startsWith('[[__VAR_0__]]\n<content>') && f.masked.includes('<true_thoughts character="A">quiet</true_thoughts>') && f.masked.includes('<status_bar>Time: noon</status_bar>'));
    for (const close of ['</ECoT>', '</thinking>']) {
        const headless = mask(`planning first\nmore notes\n${close}\n<content>\nStory.\n</content>`);
        assert.deepEqual(headless.blocks, [`planning first\nmore notes\n${close}`], 'a reply that starts inside the thought block');
    }
    const late = mask('<content>\nStory.\n</content>\nstray </ECoT>');
    assert.deepEqual(late.blocks, [], 'a closing tag after the story never swallows the story');
    const deus = mask('<scene_plan>\n<summary>Scene Plan</summary>\n<details>- Prose Plan: x</details>\n</scene_plan>\n<prose>\nStory <span style="color:#e63946">"Hi."</span>\n</prose>\n<tracker>Day 1</tracker>');
    assert.equal(deus.blocks.length, 1);
    assert.ok(deus.blocks[0].startsWith('<scene_plan>') && deus.blocks[0].endsWith('</scene_plan>'));
    assert.ok(deus.masked.includes('<prose>\nStory') && deus.masked.includes('<tracker>Day 1</tracker>'));
    assert.deepEqual(mask('<scene_reasoning id="r">why</scene_reasoning>B').blocks, ['<scene_reasoning id="r">why</scene_reasoning>']);
    const plain = mask('<think>x</think>\n\nA <note>n</note>');
    assert.deepEqual(plain.blocks, ['<think>x</think>'], 'replies without these blocks keep their placeholder numbers');
    assert.ok(M.protectBlock('picture', SLOT_RULE, { noFold: true }));
});
M.unprotectBlock('picture');
assert.equal(M.getCombinedRegexes().some(r => r.source === SLOT_RULE.source), false);
console.log(`translator-protect: ${passed} groups passed`);
