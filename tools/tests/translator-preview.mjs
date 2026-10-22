// 번역기 2.5.1 번역 중 미리 보기 — 「문단 4/10」을 기다리는 동안 끝난 문단부터 번역문으로 (화면에만, 저장하지 않음, 멈추거나 실패하면 원래대로).
//   ① translateChunks · translateSegments 의 partial 알림 (이어 쓴 덩이 · 캐시 문단은 처음에, 그다음 덩이 · 묶음마다)
//   ② translate() 의 onPreview: 끝난 곳은 번역문 · 남은 곳은 원문, 상태 카드 · 보호 블록 · 숨긴 주석은 원래 모양으로 되돌린 글 (카드 값 기억에는 안 넣음)
//   ③ translationPreview: 그 메시지 .mes_text 에만 그리고 진행 표시를 지킨다 · 대상이 바뀜 · 편집 중 · 스트리밍 중 · 헬퍼 코드는 그리지 않는다 · revert
// 가상 문장만 쓴다. node tools/tests/translator-preview.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
({ keepChatReadingPosition: globalThis.keepChatReadingPosition, readerRestsIn: globalThis.readerRestsIn } = await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js'))));   // 7.7.4 readerRestsIn
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

await check('chunk path previews: finished chunks translated, the rest original, card and comment in their original shape', async () => {
    await resume.clearCheckpoints(); sent.length = 0;
    const previews = [];
    env.CHUNK_TARGET = 220;
    const out = await env.translate(MESSAGE, { onPreview: text => previews.push(text) });
    env.CHUNK_TARGET = 100000;
    assert(sent.length >= 3, 'chunked: ' + sent.length);
    assert.equal(previews.length, sent.length - 1, 'one preview per finished chunk but the last');
    assert.equal(out, ko(MESSAGE));
    const first = previews[0];
    assert(first.startsWith(ko(STATUS)), 'the finished first chunk (with its card) is translated');
    assert(first.includes(LINE(6)) && !first.includes(LINE_KO(6)), 'unfinished paragraphs stay original');
    assert(first.includes(COMMENT), 'comment in place, verbatim');
    assert(!/\[\[__VAR_\d+__\]\]/.test(previews.join('')), 'no placeholders leak into a preview');
    for (const view of previews) assert.equal(view.split('\n\n').length, MESSAGE.split('\n\n').length, 'paragraph layout matches the original');
});
await check('paragraph path previews: cached paragraphs at once, then finished groups', async () => {
    await seg.clearSegmentCache(); sent.length = 0;
    await env.translate([STATUS, LINE(1), LINE(2)].join('\n\n'), { segmentCache: true });   // 같은 설정(카드가 든 글)으로 캐시를 채운다
    const previews = [];
    const out = await env.translate(MESSAGE, { segmentCache: true, onPreview: text => previews.push(text) });
    assert.equal(out, ko(MESSAGE));
    assert(previews.length >= 1);
    assert(previews[0].includes(LINE_KO(1)) && previews[0].includes(LINE(4)), 'cached first, rest original');
});
await check('no previews for corrections, input translation or the single-request path', async () => {
    const previews = [];
    await env.translate([LINE(1), LINE(2)].join('\n\n'), { onPreview: text => previews.push(text) });
    await env.translate(MESSAGE, { isInputTranslation: true, onPreview: text => previews.push(text) });
    assert.equal(previews.length, 0);
});

// ── ③ 화면에만 그리기 ──
// 6.9.6 미리 보기는 바뀐 문단만 갈아 끼우므로 노드가 있는 작은 DOM 흉내 (translator-preview-frames.mjs 와 같은 꼴)
class TextNode { constructor(data) { this.data = data; this.parentNode = null; this.nodeType = 3; this.nodeName = '#text'; } get textContent() { return this.data; } get outerHTML() { return this.data; } }
class El {
    constructor(tag, attrs = '', doc) { this.tagName = this.nodeName = tag.toUpperCase(); this.nodeType = 1; this.attrs = attrs; this.childNodes = []; this.parentNode = null; this.ownerDocument = doc; this.dataset = {}; }
    get className() { return /class="([^"]*)"/.exec(this.attrs)?.[1] ?? ''; }
    get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
    get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
    get outerHTML() { return `<${this.tagName.toLowerCase()}${this.attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
    get innerHTML() { return this.childNodes.map(n => n.outerHTML).join(''); }
    set innerHTML(html) { for (const n of [...this.childNodes]) this.removeChild(n); for (const n of parseHtml(html, this.ownerDocument)) this.appendChild(n); }
    removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; return node; }
    appendChild(node) { node.parentNode?.removeChild(node); node.parentNode = this; this.childNodes.push(node); return node; }
    insertBefore(node, ref) { node.parentNode?.removeChild(node); node.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, node); return node; }
    prepend(node) { return this.childNodes.length ? this.insertBefore(node, this.childNodes[0]) : this.appendChild(node); }
    get children() { return this.childNodes.filter(n => n instanceof El); }
    matches(sel) { return sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
    querySelectorAll(sel) { const out = []; const walk = el => { for (const c of el.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}
const fakeDoc = { createElement: tag => new El(tag, '', fakeDoc) };
function parseHtml(html, owner) {
    const root = new El('root', '', owner), stack = [root];
    for (const m of String(html).matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi)) {
        if (m[4] !== undefined) { stack.at(-1).appendChild(new TextNode(m[4])); continue; }
        if (m[1]) { stack.pop(); continue; }
        const el = new El(m[2], m[3], owner); stack.at(-1).appendChild(el); stack.push(el);
    }
    return [...root.childNodes].map(n => root.removeChild(n));
}
const textOf = host => host.childNodes.filter(n => !(n.nodeType === 1 && n.classList.contains('llmt-progress'))).map(n => n.outerHTML).join('');   // 진행 표시를 뺀 본문
function fakeMessageDom(id) {
    const host = new El('div', ' class="mes_text"', fakeDoc);
    host.innerHTML = '<p>original</p>';
    const badge = new El('div', ' class="llmt-progress"', fakeDoc);
    const element = { editing: false, querySelector: s => (s === '.mes_text' ? host : s === '.edit_textarea' && element.editing ? {} : null) };
    T.dom.set(`#chat .mes[mesid="${id}"]`, element);
    T.dom.set(`#chat .mes[mesid="${id}"] .mes_text`, host);
    return { host, element, badge };
}
await check('paints only the message text, keeps the progress badge, never touches saved data', () => {
    const message = { mes: 'Original body.', name: 'Narrator', is_user: false, is_system: false, swipe_id: 0, extra: {} };
    T.chat = [{ mes: 'x', extra: {} }, message]; T.formatted.length = 0; T.refreshed.length = 0;
    const { host, badge } = fakeMessageDom(1);
    host.prepend(badge);
    const preview = env.translationPreview(1, message, message.mes, 'chat-A', message.mes);
    preview.show('번역된 앞부분\n\nOriginal tail.');
    assert.equal(textOf(host), '<p>번역된 앞부분\n\nOriginal tail.</p>');
    assert.deepEqual(T.formatted.at(-1).slice(1), ['Narrator', false, false, 1]);
    assert.equal(host.childNodes[0], badge, 'progress badge kept in place');
    assert.equal(host.dataset.llmtPreview, '1');
    assert.deepEqual(message.extra, {}, 'nothing saved');
    assert.equal(message.mes, 'Original body.');
    preview.stop();
    preview.show('늦게 온 미리 보기');
    assert.equal(textOf(host), '<p>번역된 앞부분\n\nOriginal tail.</p>', 'nothing after stop');
    preview.revert();
    assert.deepEqual(T.refreshed.map(([id]) => id), [1], 'revert re-renders from the saved data');
});
// 7.7.4 손으로 굴리는 동안엔 미리 보기를 그리지 않고 멈춘 뒤에 · 한 번 그리는 데 오래 걸리면(긴 답 · 폰) 그 두 배를 쉰 뒤에 다음 그림
await check('waits while the reader scrolls by hand, and paces slow paints by their cost', () => {
    const message = { mes: 'Original body.', name: 'Narrator', is_user: false, is_system: false, swipe_id: 0, extra: {} };
    T.chat = [message];
    const { host } = fakeMessageDom(0);
    let clock = 10000, perf = 0, rests = 400, slow = 0;
    const timers = [];
    Object.assign(env, { Date: { now: () => clock }, performance: { now: () => (perf += slow) }, readerRestsIn: () => rests,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {} });
    try {
        const preview = env.translationPreview(0, message, message.mes, 'chat-A', message.mes);
        preview.show('번역 하나');
        assert.equal(host.innerHTML, '<p>original</p>', 'not painted while the reader is moving');
        assert.ok(timers.at(-1).ms >= 400, 'retried after the gesture rests');
        rests = 0; slow = 300; timers.pop().fn();
        assert.equal(textOf(host), '<p>번역 하나</p>', 'painted once the reader rests');
        clock += 260; slow = 0;
        preview.show('번역 둘');
        assert.equal(textOf(host), '<p>번역 하나</p>', 'a 300 ms paint is not followed 260 ms later');
        assert.ok(timers.at(-1).ms >= 300, `waits about twice the paint cost (${timers.at(-1).ms})`);
        timers.pop().fn();
        assert.equal(textOf(host), '<p>번역 둘</p>');
        clock += 300; preview.show('번역 셋');   // 빠른 그림(0 ms) 뒤에는 예전처럼 250 ms 간격
        assert.equal(textOf(host), '<p>번역 셋</p>');
        preview.stop();
    } finally { for (const key of ['Date', 'performance', 'readerRestsIn', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) delete env[key]; }
});
await check('does not paint (or revert) when the target moved, is being edited, is streaming, or holds helper code', () => {
    const message = { mes: 'Original body.', name: 'Narrator', swipe_id: 0, extra: {} };
    T.chat = [message]; T.refreshed.length = 0;
    const { host, element } = fakeMessageDom(0);
    // 편집 중
    element.editing = true;
    let preview = env.translationPreview(0, message, message.mes, 'chat-A', message.mes);
    preview.show('번역'); assert.equal(host.innerHTML, '<p>original</p>'); preview.revert(); assert.equal(T.refreshed.length, 0, 'nothing painted, nothing reverted');
    element.editing = false;
    // 스트리밍 중
    T.processor = { messageId: 0, isFinished: false, isStopped: false };
    preview = env.translationPreview(0, message, message.mes, 'chat-A', message.mes);
    preview.show('번역'); assert.equal(host.innerHTML, '<p>original</p>'); preview.stop();
    T.processor = null;
    // 2.5.5 헬퍼가 그려 둔 틀을 지킬 수 없으면(새 글에 짝이 될 코드 블록이 없음) 지금 화면 그대로 — 지킬 수 있을 때는 translator-preview-frames.mjs
    const frame = host.appendChild(new El('div', ' class="TH-render"', fakeDoc));
    preview = env.translationPreview(0, message, message.mes, 'chat-A', message.mes);
    preview.show('번역'); assert.equal(textOf(host), '<p>original</p><div class="TH-render"></div>'); preview.stop();
    host.removeChild(frame);
    // 틀이 아직 없으면(헬퍼가 안 그렸거나 없음) 코드가 든 답도 그린다 — 화면에 이미 날 코드였다
    preview = env.translationPreview(0, message, message.mes, 'chat-A', '```html\n<html><body>card</body></html>\n```');
    preview.show('번역 코드'); assert.equal(host.innerHTML, '<p>번역 코드</p>'); preview.stop(); host.innerHTML = '<p>original</p>'; delete host.dataset.llmtPreview;
    // 글이 바뀜 · 채팅이 바뀜 · 스와이프
    preview = env.translationPreview(0, message, 'Older body.', 'chat-A', message.mes);
    preview.show('번역'); assert.equal(host.innerHTML, '<p>original</p>'); preview.stop();
    preview = env.translationPreview(0, message, message.mes, 'chat-B', message.mes);
    preview.show('번역'); assert.equal(host.innerHTML, '<p>original</p>'); preview.stop();
    preview = env.translationPreview(0, message, message.mes, 'chat-A', message.mes);
    preview.show('번역'); assert.equal(host.innerHTML, '<p>번역</p>');
    message.swipe_id = 1;   // 그 사이 스와이프 — 되돌리기는 실리태번이 이미 다시 그린 그 화면을 건드리지 않는다
    preview.revert(); assert.equal(T.refreshed.length, 0);
});

// ── 연결 ──
await check('translateMessage wiring: preview made with the badge, stopped before the final render, reverted on failure', () => {
    assert(/const preview = runToken\.preview = translationPreview\(messageId, message, sourceMes, chatId, originalText, runToken\.guard\);/.test(source));   // 2.9.0 guard 로 대상
    assert(/onProgress, onPreview: preview\.show, report \}\);\n[^\n]*\} finally \{\n[^\n]*preview\.stop\(\); badge\.remove\(\);/.test(source));   // 7.3.1 onProgress = 시작 알림 고르기 + badge.update
    assert(/const edited = Boolean\(message\.extra\.display_text\);[^\n]*\n[^\n]*const onProgress = stage => \{ const info = stage && typeof stage === 'object' \? \{ \.\.\.stage, edited \} : stage; if \(startToast\) \{ clearTimeout\(startTimer\); startToast\(startNotice\(info, messageId\)\); \} badge\.update\(info\); \};/.test(source));   // 3.0.0 edited 표시
    assert(/runToken\.error = error;\n[^\n]*runToken\.preview\?\.revert\(\);/.test(source));
});

console.log(`translator-preview: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
