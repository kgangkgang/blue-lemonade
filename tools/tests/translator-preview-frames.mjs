// 번역기 2.5.5 — 묶음 번역 진행 숫자(「수정 문단 n/전체」)와 번역 중 미리 보기가 헬퍼(Tavern Helper)가 그린 상태창 틀을 지우지 않기.
//   ① paintKeepingFrames: div.TH-render(코드 블록 + iframe)는 같은 노드 그대로 제자리, 사이 글만 새로 · 짝이 안 맞으면 손대지 않음
//   ② translateSegments · progressLabel: 묶음이 끝날 때마다 끝난 문단 수가 늘고, 끝난 문단은 미리 보기에 번역문으로
// 가상 문장만 쓴다 (브라우저 없이 작은 DOM 흉내). node tools/tests/translator-preview-frames.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const { paintKeepingFrames } = await import(pathToFileURL(path.join(dir, 'preview-frames.js')));
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}

// ── 작은 DOM 흉내: 요소 · 글 노드 · innerHTML(단순 태그 해석) · querySelectorAll(.클래스 · 태그) · 노드 옮기기 기록 ──
const log = [];
class Text { constructor(data) { this.data = data; this.parentNode = null; } get textContent() { return this.data; } get outerHTML() { return this.data; } }
class El {
    constructor(tag, attrs = '', doc) { this.tagName = tag.toUpperCase(); this.attrs = attrs; this.childNodes = []; this.parentNode = null; this.ownerDocument = doc; }
    get className() { return /class="([^"]*)"/.exec(this.attrs)?.[1] ?? ''; }
    get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
    get outerHTML() { return `<${this.tagName.toLowerCase()}${this.attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
    get innerHTML() { return this.childNodes.map(n => n.outerHTML).join(''); }
    set innerHTML(html) { for (const n of [...this.childNodes]) this.removeChild(n); for (const n of parse(html, this.ownerDocument)) this.appendChild(n); }
    detach(node) { const at = node.parentNode?.childNodes.indexOf(node); if (at >= 0) { node.parentNode.childNodes.splice(at, 1); log.push(['detach', node]); } node.parentNode = null; }
    removeChild(node) { this.detach(node); return node; }
    appendChild(node) { if (node.parentNode) node.parentNode.detach(node); node.parentNode = this; this.childNodes.push(node); return node; }
    insertBefore(node, ref) { if (node.parentNode) node.parentNode.detach(node); node.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, node); return node; }
    get children() { return this.childNodes.filter(n => n instanceof El); }
    matches(sel) { return sel.startsWith('.') ? this.className.split(/\s+/).includes(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
    querySelectorAll(sel) { const out = []; const walk = el => { for (const c of el.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
}
const doc = { createElement: tag => new El(tag, '', doc) };
function parse(html, owner) {
    const root = new El('root', '', owner), stack = [root];
    for (const m of String(html).matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi)) {
        if (m[4] !== undefined) { stack.at(-1).appendChild(new Text(m[4].replace(/&lt;/g, '<').replace(/&gt;/g, '>'))); continue; }
        if (m[1]) { stack.pop(); continue; }
        const el = new El(m[2], m[3], owner); stack.at(-1).appendChild(el); stack.push(el);
    }
    const nodes = [...root.childNodes]; for (const n of nodes) root.detach(n); return nodes;
}
const CODE = '<pre><code>&lt;!DOCTYPE html&gt;&lt;html&gt;&lt;body&gt;card&lt;/body&gt;&lt;/html&gt;</code></pre>';
function drawnMessage() {
    const host = new El('div', ' class="mes_text"', doc);
    host.innerHTML = `<p>The lantern flickered.</p>${CODE}<p>She opened the window.</p>`;
    // 헬퍼가 그린 모양: pre 를 div.TH-render 로 감싸고 iframe 을 붙인다
    const pre = host.children[1], frame = new El('div', ' class="TH-render"', doc), iframe = new El('iframe', ' srcdoc="card"', doc);
    host.insertBefore(frame, pre); frame.appendChild(pre); frame.appendChild(iframe);
    log.length = 0;
    return { host, frame, iframe };
}

await check('helper frame (status card iframe) stays the very same node in place; only the prose around it changes', () => {
    const { host, frame, iframe } = drawnMessage();
    assert.equal(paintKeepingFrames(host, `<p>등불이 깜박였다.</p>${CODE}<p>그녀가 창문을 열었다.</p>`), true);
    assert.deepEqual(host.children.map(n => n.tagName), ['P', 'DIV', 'P']);
    assert.equal(host.children[1], frame);
    assert.equal(frame.childNodes.at(-1), iframe);
    assert.equal(host.children[0].textContent, '등불이 깜박였다.');
    assert.equal(host.children[2].textContent, '그녀가 창문을 열었다.');
    assert(!log.some(([, node]) => node === frame || node === iframe), 'the frame is never detached (an iframe would reload)');
    assert(!/&lt;!DOCTYPE|<!DOCTYPE/.test(host.children[0].textContent + host.children[2].textContent), 'no raw code text');
});
await check('two frames keep their order; text before, between and after is replaced', () => {
    const { host, frame } = drawnMessage();
    const second = new El('div', ' class="TH-render"', doc); host.appendChild(second); host.appendChild(new El('p', '', doc));
    log.length = 0;
    assert.equal(paintKeepingFrames(host, `<p>가</p>${CODE}<p>나</p>${CODE}<p>다</p>`), true);
    assert.deepEqual(host.childNodes.map(n => n.className || n.textContent), ['가', 'TH-render', '나', 'TH-render', '다']);
    assert.equal(host.children[1], frame); assert.equal(host.children[3], second);
});
await check('when frames cannot be paired (count differs, nested, code inside other blocks) nothing is touched', () => {
    for (const html of ['<p>코드 없음</p>', `${CODE}${CODE}`, `<details>${CODE}</details>`]) {
        const { host } = drawnMessage();
        const before = host.innerHTML, nodes = [...host.childNodes];
        assert.equal(paintKeepingFrames(host, html), false, html);
        assert.equal(host.innerHTML, before);
        assert(!log.some(([, node]) => nodes.includes(node)), 'no node of the message was moved');
    }
    const { host } = drawnMessage();
    const wrap = new El('details', '', doc); host.insertBefore(wrap, host.children[1]); wrap.appendChild(host.children[2]);
    assert.equal(paintKeepingFrames(host, `<p>가</p>${CODE}`), false, 'nested frame');
});
await check('no frames drawn: plain repaint as before', () => {
    const host = new El('div', '', doc); host.innerHTML = '<p>old</p>';
    assert.equal(paintKeepingFrames(host, `<p>new</p>${CODE}`), true);
    assert.equal(host.children[0].textContent, 'new');
});

// ── 진행 숫자 ──
await check('translateSegments reports finished/batch after every group; the label reads 「수정 문단 n/전체」', async () => {
    await seg.clearSegmentCache();
    const parts = [], stages = [];
    for (let i = 0; i < 6; i++) parts.push(`Passage ${i} is here.`, '\n\n');
    parts.pop();
    await seg.translateSegments({ parts, signature: () => 's', progress: info => stages.push(info), request: async (bodies, done) => {
        const out = [];
        for (let i = 0; i < bodies.length; i += 2) { out.push(...bodies.slice(i, i + 2).map(b => b.replace('Passage', '문단'))); done(out); }
        return out;
    } });
    assert.deepEqual(stages.map(s => [s.finished ?? null, s.batch ?? null]), [[0, 6], [2, 6], [4, 6], [6, 6], [null, null]]);
    const cut = name => { const at = source.indexOf(`\nfunction ${name}(`); return source.slice(at + 1, source.indexOf('\n}', at) + 2); };
    const progressLabel = new Function(`return (${cut('progressLabel')});`)();
    const started = Date.now() - 17000;
    assert.equal(progressLabel({ stage: 'segments', reused: 0, pending: 74, batch: 74, finished: 0, translated: 0 }, started), '캐시 0개 · 수정 문단 0/74 묶음 번역 중 · 17초');
    assert.equal(progressLabel({ stage: 'segments', reused: 3, pending: 74, batch: 74, finished: 17, translated: 0 }, started), '캐시 3개 · 수정 문단 17/74 묶음 번역 중 · 17초');
    assert.equal(progressLabel({ stage: 'segments', reused: 3, pending: 0, translated: 74 }, started), '캐시 3개 · 새 번역 74개 · 17초');
    assert.equal(progressLabel({ stage: 'segments', reused: 0, pending: 5, translated: 0 }, started), '캐시 0개 · 수정 문단 0/5 묶음 번역 중 · 17초', 'older callers without batch');
});
await check('real translate(): several batch groups → the count climbs and finished paragraphs show translated in the preview', async () => {
    const cut = name => { const re = new RegExp('\\n(?:async )?function ' + name + '\\('), at = source.search(re); return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2); };
    const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';
    const S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled', connection_mode: 'direct', llm_provider: 'x', parameters: { x: { max_length: 300 } } };
    const env = { ...card, ...seg, ...resume, ...auto, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ({ chatMetadata: {}, chat: [] }),
        guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
        BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
        buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
        looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
        tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
        runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
        correctBackticks: x => x, window: {}, toastr: { warning() {} }, globalThis: { toastr: { warning() {} } }, BRACKET_NOTE };
    for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
        'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'translate']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    env.tidyGlossaryOutput = (_s, x) => x;
    const LINE = n => `Line ${n}: The lantern by the window flickered while the kettle hummed softly over the stove.`;
    const ko = text => String(text).replace(/Line (\d+): The lantern by the window flickered while the kettle hummed softly over the stove\./g, (_, n) => `${n}번째 줄: 창가의 등불이 깜박이는 동안 주전자가 나지막이 노래했다.`);
    env.callLLMAPI = async prompt => { let body = prompt.slice(prompt.indexOf('\n\n') + 2); if (BRACKET_NOTE && body.startsWith(BRACKET_NOTE)) body = body.slice(BRACKET_NOTE.length + 2); return ko(body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body); };
    await seg.clearSegmentCache();
    const text = Array.from({ length: 12 }, (_, i) => LINE(i + 1)).join('\n\n'), stages = [], previews = [];
    const out = await env.translate(text, { segmentCache: true, onProgress: info => stages.push(info), onPreview: view => previews.push(view) });
    assert.equal(out, ko(text));
    const counts = stages.filter(s => s.stage === 'segments' && s.batch).map(s => s.finished);
    assert(counts.length >= 3 && counts[0] === 0 && counts.at(-1) === 12 && counts.every((n, i) => !i || n > counts[i - 1]), JSON.stringify(counts));
    assert(previews.length >= 1 && previews.every(view => view.split('\n\n').length === 12));
    assert(previews[0].startsWith('1번째 줄') && previews[0].endsWith(LINE(12)), 'finished first, the rest still original');
});
await check('wiring: the preview paints through paintKeepingFrames and keeps the badge; version 2.5.5', () => {
    assert(/if \(!paintKeepingFrames\(host, html\)\) return;/.test(source));
    assert(!/host\.innerHTML = html;/.test(source.slice(source.indexOf('function translationPreview('), source.indexOf('function settleGuard('))), 'no wholesale repaint left');
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;   // 올라가도 깨지지 않게 — 2.5.5 이상 · 화면 표시와 같음
    assert(version.localeCompare('2.5.5', undefined, { numeric: true }) >= 0, version);
    assert(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(`>v${version}<`));
});

console.log(`translator-preview-frames: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
