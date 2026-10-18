// 테마 6.9.6 — 번역 중 미리 보기에서 대사를 누르면 TTS 가 그 미리 보기 글로 원문 짝을 찾는다 (듣는 언어로 다시 옮기지 않는다).
//   전: 미리 보기는 화면(.mes_text)에만 그리고 display_text 는 번역이 끝나야 저장돼, 누른 한국어 줄의 원문을 못 찾고 「원문을 못 찾았어요 — 화면 글을
//       옮겨 읽는 중」 · 듣는 언어(일본어)로 옮기는 요청을 한 번 더 냈다 (말투도 원문과 달라짐).
//   ① 번역기: translationPreview 가 그린 글을 previewText(message) 로 내준다 — 그 메시지 · 화면에 그려져 있을 때만 · 끝나면(done) · 되돌리면 · 실리태번이 다시 그리면 null
//   ② TTS: shownDisplay(preview) · segmentForHit(preview) · tapJobs(preview) — 누른 번역 줄은 원문(일본어)으로 읽고 옮길 줄이 없다.
//      아직 원문인 문단은 그대로 · 미리 보기 글에도 없는 줄만 예전처럼 화면 글을 옮겨 읽되 칸 제목 · 알림이 그 까닭을 말한다.
//      미리 만들기(lineJobs · tapSegments 기본)와 「번역이 왔나」(displayReady)는 저장된 글만 본다.
// 인물 · 문장은 지어낸 것. 네트워크 · 실제 엔진 요청 없음.  node tools/tests/tts-preview-source.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
globalThis.keepChatReadingPosition = (await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js')))).keepChatReadingPosition;

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsPreviewTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나' } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const toasts = [];
globalThis.window = { toastr: { info: (m) => toasts.push(m), warning: (m) => toasts.push(m), success() {}, error() {} } };
const G = 'const T = globalThis.__ttsPreviewTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 지어낸 답장: 일본어 원문 · 한국어 번역 (미리 보기 = 앞 두 문단만 번역, 나머지는 아직 원문) ──
const JA = ['雨上がりの路地で、ミナは傘をたたんだ。', '「いらっしゃい。今日は遅かったね」', 'カウンターの奥で、レックスが顔を上げた。', '「ちょっと仕事が長引いちゃって」'];
const KO = ['비 갠 골목에서 미나는 우산을 접었다.', '「어서 와. 오늘은 늦었네」', '카운터 안쪽에서 렉스가 고개를 들었다.', '「일이 좀 길어져서」'];
const ORIGINAL = JA.join('\n\n');
const PREVIEW = [KO[0], KO[1], JA[2], JA[3]].join('\n\n');
const strip = (q) => q.replace(/^「|」$/g, '');

// ── ① 번역기 previewText (index.js 에서 잘라 작은 DOM 흉내 위에서) ──
const source = fs.readFileSync(path.join(theme, 'src/addons/translator/index.js'), 'utf8');
const frames = await import(pathToFileURL(path.join(theme, 'src/addons/translator/preview-frames.js')));
function cut(name) {
    const at = source.search(new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('));
    assert(at >= 0, name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2).replace(/^export /, '');
}
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
    get children() { return this.childNodes.filter(n => n instanceof El); }
    matches(sel) { return sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : this.tagName === sel.toUpperCase(); }
    querySelectorAll(sel) { const out = []; const walk = el => { for (const c of el.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}
const fakeDoc = { createElement: tag => new El(tag, '', fakeDoc) };
function parseHtml(html, owner) {
    const top = new El('root', '', owner), stack = [top];
    for (const m of String(html).matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi)) {
        if (m[4] !== undefined) { stack.at(-1).appendChild(new TextNode(m[4])); continue; }
        if (m[1]) { stack.pop(); continue; }
        const el = new El(m[2], m[3], owner); stack.at(-1).appendChild(el); stack.push(el);
    }
    return [...top.childNodes].map(n => top.removeChild(n));
}
const D = { dom: new Map(), refreshed: [] };
const format = (text) => String(text ?? '').split('\n\n').map(p => `<p>${p}</p>`).join('');
const tx = {
    ...frames, extensionSettings: {}, getContext: () => ({ chat: T.ctx.chat, chatId: 'chat-A', messageFormatting: format }),
    document: { querySelector: s => D.dom.get(s) ?? null }, processTranslationText: (_o, t) => t, refreshMessageBlock: (id, m, o) => D.refreshed.push([id, o]),
    PREVIEW_GAP_MS: 0, livePreviews: new Set(), typesetRoot: () => {}, dressBody: () => {}, isProgressBadge: node => node.nodeType === 1 && node.classList.contains('llmt-progress'),
    resolveTranslationTarget: (message) => T.ctx.chat.indexOf(message),
};
for (const name of ['dressPainted', 'previewText', 'translationPreview']) tx[name] = new Function('env', `with(env){return (${cut(name)});}`)(tx);
function screen(id, html) {
    const host = new El('div', ' class="mes_text"', fakeDoc);
    host.innerHTML = html;
    D.dom.set(`#chat .mes[mesid="${id}"]`, { querySelector: s => (s === '.mes_text' ? host : null) });
    D.dom.set(`#chat .mes[mesid="${id}"] .mes_text`, host);
    return host;
}

await test('① previewText: 그 메시지에 그려진 미리 보기 글만 · 다른 메시지 · 끝남(done) · 되돌림 · 실리태번이 다시 그림이면 null · 저장하지 않음', () => {
    const mes = { name: '미나', is_user: false, mes: ORIGINAL, extra: {}, swipe_id: 0 }, other = { name: '미나', mes: 'x', extra: {} };
    T.ctx.chat.length = 0; T.ctx.chat.push(other, mes);
    const host = screen(1, format(ORIGINAL));
    let preview = tx.translationPreview(1, mes, mes.mes, 'chat-A', ORIGINAL);
    assert.equal(tx.previewText(mes), null, '그리기 전');
    preview.show(PREVIEW);
    assert.equal(tx.previewText(mes), PREVIEW);
    assert.equal(tx.previewText(other), null);
    assert.deepEqual(mes.extra, {}, 'display_text 는 그대로 없음');
    host.innerHTML = format(ORIGINAL);   // 실리태번이 통째로 다시 그림 → 화면은 저장된 글
    assert.equal(tx.previewText(mes), null);
    preview.show(PREVIEW);
    assert.equal(tx.previewText(mes), PREVIEW, '다시 그리면 다시');
    preview.done();
    assert.equal(tx.previewText(mes), null, '최종본을 그린 뒤');
    preview = tx.translationPreview(1, mes, mes.mes, 'chat-A', ORIGINAL);
    preview.show(PREVIEW);
    preview.revert();
    assert.equal(tx.previewText(mes), null, '되돌린 뒤');
    assert.deepEqual(D.refreshed.at(-1), [1, { gently: true }], '되돌리기도 바뀐 문단만');
});

// ── ② TTS ──
const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
const P = await mod('player.js');
const C = await mod('clickplay.js');
const TR = await mod('translation.js');
const PD = await mod('playback-details.js');
const { settings } = S;
const gv = (voiceId, name) => ({ uid: `minimax:${voiceId}`, provider: 'minimax', voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [] });
function reset(extra = {}) {
    const s = settings();
    s.enabled = true;
    s.voices = [gv('v_mina', '미나 목소리'), gv('v_haram', '하람 목소리')];
    s.char_map = { 미나: 'minimax:v_mina' };
    s.default_voice = 'minimax:v_mina'; s.user_voice = 'minimax:v_haram'; s.narrator_voice = ''; s.prefer_provider = '';
    s.routes = { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip', user_dialogue: 'user' };
    s.read_preset = 'dialogue'; s.no_dialogue_fallback = 'narration'; s.join_paragraph = true; s.pregen = 'off';
    s.text_source = 'original'; s.listen_lang = 'ja'; s.pron_dict = ''; s.mute_words = ''; s.max_chars = 3000; s.wait_translation = 'off'; s.extras = 'off';
    s.analysis = { ...s.analysis, enabled: false };
    s.providers = { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' } };
    Object.assign(s, extra);
    T.ctx.chatMetadata = {};
}
function message() {
    const mes = { name: '미나', is_user: false, mes: ORIGINAL, extra: {}, swipe_id: 0 };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    return mes;
}
const API = Symbol.for('blue-lemonade.translator');
const bridge = (mes, text) => { globalThis[API] = { previewText: (m) => (m === mes ? text : null) }; };
const hit = (text) => ({ kind: 'dialogue', text, raw: text, quoted: `「${text}」`, color: null, speakerHint: null, line: 0 });
const jobsOf = (mes, seg, opts) => P._forTest.tapJobs(0, mes, [seg], opts).lines.flat();

await test('② shownDisplay: 미리 보기 글은 누르기 길(preview)에서만 · 없으면 저장된 display_text · displayReady 는 미리 보기를 다 온 번역으로 치지 않음', () => {
    const mes = message();
    bridge(mes, PREVIEW);
    assert.deepEqual(TR.shownDisplay(mes, { preview: true }), { text: PREVIEW, preview: true });
    assert.deepEqual(TR.shownDisplay(mes), { text: '', preview: false });
    assert.equal(TR.displayReady(mes), false);
    delete globalThis[API];
    assert.deepEqual(TR.shownDisplay(mes, { preview: true }), { text: '', preview: false }, '번역기가 없거나 옛 판');
});
await test('② 미리 보기 중 번역된 대사를 누름 → 원문(일본어) 그대로 읽음 · 듣는 언어로 옮길 줄 없음 (전: 즉석 한국어 조각 → 옮겨 읽기 요청)', () => {
    reset();
    const mes = message();
    bridge(mes, PREVIEW);
    const seg = C.segmentForHit(mes, hit(strip(KO[1])), { preview: true });
    assert.equal(seg.text, strip(KO[1]));
    assert.equal(seg.dialogueIndex, 0, '미리 보기 글의 대화문 번호');
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].text, strip(JA[1]), '원문을 읽는다');
    assert.ok(!jobs[0].listen && !jobs[0].listenPending, '옮길 줄 없음 (추가 번역 요청 0)');
    assert.ok(!jobs[0].parts.some(p => p.original?.fromDisplay), '원문 짝을 찾음');
    assert.equal(PD.playbackOriginalTitle(jobs[0]), '지금 읽는 대사의 원문');
    // 예전 길 (미리 보기를 모름): 짝이 없어 한국어 화면 글을 일본어로 옮겨 읽으려 한다 — 이번 판이 고친 것
    const old = C.segmentForHit(mes, hit(strip(KO[1])));
    assert.equal(old.dialogueIndex, -1, '즉석 조각');
    const oldJobs = jobsOf(mes, old, {});
    assert.ok(oldJobs[0].listenPending, '예전엔 듣는 언어 번역 요청이 필요했다');
    assert.equal(fetches, 0);
});
await test('② 아직 원문인 문단을 누름 → 그대로 · 읽을 글이 화면 글(text_source display)이어도 번역된 줄은 원문 짝으로', () => {
    reset();
    const mes = message();
    bridge(mes, PREVIEW);
    const seg = C.segmentForHit(mes, hit(strip(JA[3])), { preview: true });
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.equal(jobs[0].text, strip(JA[3]));
    assert.ok(!jobs[0].listenPending);
    reset({ text_source: 'display' });
    const seg2 = C.segmentForHit(mes, hit(strip(KO[1])), { preview: true });
    const jobs2 = jobsOf(mes, seg2, { preview: true });
    assert.equal(jobs2[0].text, strip(JA[1]), '듣는 언어(일본어)면 짝인 원문');
    assert.ok(!jobs2[0].listenPending);
});
await test('② 미리 보기 글에도 없는 줄(덜 온 문단 · 화면과 다름) → 예전처럼 화면 글을 옮겨 읽되 칸 제목 · 알림이 까닭을 말함', () => {
    reset();
    const mes = message();
    bridge(mes, PREVIEW);
    toasts.length = 0;
    const seg = C.segmentForHit(mes, hit('전혀 다른 줄이야'), { preview: true });
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.ok(jobs[0].listenPending, '원문이 없으니 옮겨 읽음');
    assert.ok(jobs[0].parts.some(p => p.original?.fromPreview && p.original?.fromDisplay));
    assert.equal(PD.playbackOriginalTitle(jobs[0]), PD.ORIGINAL_PREVIEW_LISTEN);
    assert.equal(PD.playbackOriginalIn(jobs[0], mes.mes).title, PD.ORIGINAL_PREVIEW_LISTEN);
    assert.ok(toasts.some(t => /번역이 아직 덜 온 줄/.test(t)), toasts.join(' / '));
    // 미리 보기가 아닌 예전 「원문 짝 없음」은 예전 제목 그대로
    assert.equal(PD.playbackOriginalTitle({ listen: {}, parts: [{ original: { fromDisplay: true } }] }), PD.ORIGINAL_MISSING_LISTEN);
});
await test('② 미리 만들기는 저장된 글만 (lineJobs · tapSegments 기본) — 덜 온 미리 보기 글로 소리를 사지 않는다', () => {
    reset();
    const mes = message();
    bridge(mes, PREVIEW);
    const segs = C.tapSegments(mes);
    assert.deepEqual(segs.filter(x => x.kind === 'dialogue').map(x => x.text), [strip(JA[1]), strip(JA[3])], '원문 목록');
    const withPreview = C.tapSegments(mes, { preview: true });
    assert.deepEqual(withPreview.filter(x => x.kind === 'dialogue').map(x => x.text), [strip(KO[1]), strip(JA[3])], '이어 듣기는 화면(미리 보기) 목록');
    const seg = C.segmentForHit(mes, hit(strip(KO[1])), { preview: true });
    assert.ok(P.lineJobs(0, mes, [seg]).jobs[0].listenPending, 'lineJobs 는 미리 보기를 안 본다');
});
await test('② 연결: 대사 누르기 · 이어 듣기만 preview — 미리 만들기 build · 다음 한 줄 · 번역 기다리기는 그대로', () => {
    const cp = fs.readFileSync(path.join(root, 'clickplay.js'), 'utf8');
    assert.equal((cp.match(/segmentForHit\(mes, (?:thought|hit), \{ preview: true \}\)/g) || []).length, 2, 'onClick 의 속마음 · 대화문');
    const pl = fs.readFileSync(path.join(root, 'player.js'), 'utf8');
    assert.match(pl, /const t = tapJobs\(mesId, mes, segs, \{ readThoughts: thoughts, expand, preview: true \}\);/);
    assert.match(pl, /const tapFlat = \(\) => tapJobs\(mesId, mes, segs, \{ readThoughts: thoughts, expand, preview: true \}\)\.lines\.flat\(\);/);
    assert.match(pl, /const t = tapJobs\(mesId, mes, segs \|\| \[\], \{ readThoughts: null, awaitDisplay \}\);/, 'lineJobs 는 preview 없이');
    const pg = fs.readFileSync(path.join(root, 'pregen.js'), 'utf8');
    assert.match(pg, /nextLine\(tapSegments\(at\.mes, \{ thoughts, preview: true \}\), last, \{ thoughts \}\)/, '이어 듣기');
    assert.equal((pg.match(/preview: true/g) || []).length, 1, '미리 만들기 · 다음 한 줄은 그대로');
    assert.match(source, /previewText: message => previewText\(message\),/, '번역기 다리');
    assert.match(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/tts-preview-source\.mjs \./);
});

console.log(`tts-preview-source: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
