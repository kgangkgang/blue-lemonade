// 1.5.5 번역이 끝난 메시지에서 누른 줄의 원문(일본어)을 못 찾고 한국어 화면 글로 읽던 것 (11-15 사용자 제보 · 실제 폰 1.5.4)
//   ① 원문의 색 태그 속 빈칸이 점자 빈칸(U+2800 · 「공백마다 점자 빈칸」 우회 프리셋)이라 `<span⠀style="color:…">` 를 태그로 못 알아보고 `"color:#…"` 를 대사로 셌어요
//      → 원문 대사 수가 번역문의 두 배 · 색 없음 → 짝이 어긋나 화면 글로 읽음. 화면은 그 프리셋 정규식이 보통 빈칸으로 되돌려 보여 줘요.
//   인물 · 문장은 지어낸 것. 네트워크 · 실제 엔진 요청 없음.  node tools/tests/tts-orig-found.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
({ keepChatReadingPosition: globalThis.keepChatReadingPosition, readerRestsIn: globalThis.readerRestsIn } = await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js'))));   // 7.7.4 readerRestsIn

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
const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
const P = await mod('player.js');
const C = await mod('clickplay.js');
const TR = await mod('translation.js');
const MS = await mod('message-segments.js');
const { settings } = S;
const gv = (voiceId, name) => ({ uid: `minimax:${voiceId}`, provider: 'minimax', voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [] });
function reset(extra = {}) {
    const s = settings();
    s.enabled = true;
    s.voices = [gv('v_mina', '미나 목소리'), gv('v_haram', '하람 목소리')];
    s.char_map = { 미나: 'minimax:v_mina' };
    s.default_voice = 'minimax:v_mina'; s.user_voice = 'minimax:v_haram'; s.narrator_voice = ''; s.prefer_provider = '';
    s.routes = { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'character', user_dialogue: 'user' };
    s.read_preset = 'dialogue'; s.no_dialogue_fallback = 'skip'; s.join_paragraph = true; s.pregen = 'off';
    s.text_source = 'original'; s.listen_lang = ''; s.pron_dict = ''; s.mute_words = ''; s.max_chars = 3000; s.wait_translation = 'off'; s.extras = 'off';
    s.analysis = { ...s.analysis, enabled: false };
    s.providers = { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' } };
    Object.assign(s, extra);
    T.ctx.chatMetadata = {};
}
const API = Symbol.for('blue-lemonade.translator');
const bridge = (mes, text) => { globalThis[API] = { previewText: (m) => (m === mes ? text : null) }; };
const jobsOf = (mes, seg, opts) => P._forTest.tapJobs(0, mes, [seg], opts).lines.flat();
const B = '\u2800';
// 색 태그로 감싼 대사 셋(둘째는 겹낫표 속 인용이 든 긴 대사) — 원문은 태그 속 빈칸이 점자 빈칸, 번역문은 보통 빈칸
const tag = (sp, color, line) => `<span${sp}style="color:${color}">${line}</span>`;
const JA = [['#424c59', '「おはようございます、ミナさん」'], ['#ff5a3c', '「『なお、本日の朝礼前に七階へ入る者は、所定の挨拶をすること』って書いてあるの。読める？」'], ['#3ccfbf', '「……はい、読めます」']];
const KO = [['#424c59', '「좋은 아침이에요, 미나 씨」'], ['#ff5a3c', '「『아울러, 금일 조례 전에 7층에 들어가는 자는 정해진 인사를 할 것』이라고 적혀 있어. 읽을 수 있겠어?」'], ['#3ccfbf', '「……네, 읽을 수 있어요」']];
const NARR_JA = ['雨の朝だった。', 'ミナは紙を見つめた。', '沈黙が落ちた。'], NARR_KO = ['비 오는 아침이었다.', '미나는 종이를 바라보았다.', '침묵이 내려앉았다.'];
const build = (sp, lines, narr) => lines.map(([c, l], i) => `${narr[i]}\n\n${tag(sp, c, l)}`).join('\n\n');
const ORIGINAL = build(B, JA, NARR_JA), DISPLAY = build(' ', KO, NARR_KO);
function message(display = DISPLAY) {
    const mes = { name: '미나', is_user: false, mes: ORIGINAL, extra: display ? { display_text: display } : {}, swipe_id: 0 };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    return mes;
}
const LINE = KO[1][1].slice(1, -1);
const hit = (text, color) => ({ kind: 'dialogue', text, raw: text, quoted: `「${text}」`, color, speakerHint: null, line: 0 });

await test('① 점자 빈칸 태그: 원문 대사 수 · 색이 번역문과 같음 (전: 원문 대사가 두 배 · 색 없음)', () => {
    reset();
    const mes = message();
    delete globalThis[API];
    const src = MS.sourcesOf(mes, settings(), { final: true });
    const dl = (l) => l.filter(x => x.kind === 'dialogue');
    assert.equal(dl(src.orig).length, dl(src.disp).length, `${dl(src.orig).length} vs ${dl(src.disp).length}`);
    assert.deepEqual(dl(src.orig).map(x => x.color), dl(src.disp).map(x => x.color));
    assert.ok(!dl(src.orig).some(x => /color:/.test(x.text)), '태그 속 글을 대사로 세지 않음');
});
await test('① 번역이 끝난 메시지에서 겹낫표 긴 대사를 누름 → 일본어 원문을 읽음 · 화면 글 아님', () => {
    reset();
    const mes = message();
    delete globalThis[API];
    const seg = C.segmentForHit(mes, hit(LINE, '#ff5a3c'), { preview: true });
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].text, JA[1][1].slice(1, -1));
    assert.ok(!jobs[0].parts.some(p => p.original?.fromDisplay), '원문 짝을 찾음');
    assert.equal(fetches, 0);
});

// ② 번역이 끝나는 틈 · 다시 번역: 저장된 번역문과 미리 보기 글 중 한쪽으로 못 찾으면 다른 쪽으로 · 「덜 온 줄」 알림은 번역이 정말 진행 중일 때만
const half = [build(' ', [KO[0]], [NARR_KO[0]]), build(B, JA.slice(1), NARR_JA.slice(1))].join('\n\n');   // 앞 문단만 번역된 미리 보기
await test('② 번역이 끝나 저장됐는데 미리 보기 기록이 아직 남은 틈(그 줄이 미리 보기엔 아직 원문) → 저장된 번역문으로 원문을 찾음 · 알림 없음', () => {
    reset();
    const mes = message();
    bridge(mes, half);
    assert.deepEqual(TR.shownDisplay(mes, { preview: true }), { text: DISPLAY, preview: false }, '지금 글의 번역문이 먼저');
    toasts.length = 0;
    const seg = C.segmentForHit(mes, hit(LINE, '#ff5a3c'), { preview: true });
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.equal(jobs[0].text, JA[1][1].slice(1, -1));
    assert.ok(!jobs[0].parts.some(p => p.original?.fromDisplay || p.original?.fromPreview));
    assert.equal(toasts.length, 0, toasts.join(' / '));
});
await test('② 같은 원문을 다시 번역하는 중(저장된 옛 번역문엔 그 줄이 없고 미리 보기 새 글에 있음) → 미리 보기 글로 한 번 더 찾아 원문', () => {
    reset();
    const OLD = DISPLAY.replace('『아울러', '『그리고');
    const mes = message(OLD);
    bridge(mes, DISPLAY);
    const seg = C.segmentForHit(mes, hit(LINE, '#ff5a3c'), { preview: true });
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.equal(jobs[0].text, JA[1][1].slice(1, -1));
    assert.ok(!jobs[0].parts.some(p => p.original?.fromDisplay));
});
await test('② 번역이 정말 진행 중(저장된 번역문 없음)이고 미리 보기에도 없는 줄 → 예전처럼 화면 글 · 「덜 온 줄」 알림', () => {
    reset();
    const mes = message(null);
    bridge(mes, half);
    toasts.length = 0;
    const seg = C.segmentForHit(mes, hit('전혀 다른 줄이야', '#ff5a3c'), { preview: true });
    const jobs = jobsOf(mes, seg, { preview: true });
    assert.ok(jobs[0].parts.some(p => p.original?.fromPreview && p.original?.fromDisplay));
});

console.log(`tts-orig-found: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
