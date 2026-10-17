// TTS 1.9.9 기울임 안의 따옴표 낱말 — 「*왜 "낱말" 같은 말을 한 거야?!*」처럼 말 · 속마음 기울임 안에 인용 · 강조 낱말이 있으면
//   따옴표를 대사로 떼지 않고 그 기울임의 일부로 둔다 (떼면 기울임이 서술 둘로 갈라져 속마음 전체를 읽지 않았다). 누르기 · 이어 읽기 · 미리 만들기 · 원문 짝 모두.
//   기울임 밖 따옴표 · 문장 끝 부호가 있는 따옴표 · 따옴표뿐인 기울임은 그대로 대사.
//   인물 · 문장은 지어낸 것. 네트워크 · 실제 엔진 요청 없음.  node tools/tests/tts-italic-quote.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsItalicQuoteTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나' } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const toasts = [];
globalThis.window = { toastr: { info: (m) => toasts.push(m), warning: (m) => toasts.push(m), success() {}, error() {} } };
const G = 'const T = globalThis.__ttsItalicQuoteTest;\n';
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
const S = await mod('settings.js'), P = await mod('player.js'), C = await mod('clickplay.js'), PD = await mod('playback-details.js'), X = await mod('text.js');
const s = S.settings();
const gv = (voiceId, name, lang = '') => ({ uid: `minimax:${voiceId}`, provider: 'minimax', voiceId, name, lang, group: 'g', aliases: [], params: {}, mix: [] });
Object.assign(s, { enabled: true, voices: [gv('v_a', '미나 목소리', 'ja')], char_map: { 미나: 'minimax:v_a' }, default_voice: 'minimax:v_a', user_voice: 'minimax:v_a', narrator_voice: '',
    routes: { dialogue: 'character', narration: 'skip', action: 'character', thought: 'character', user_dialogue: 'user' }, read_preset: 'dialogue', no_dialogue_fallback: 'narration', join_paragraph: true, pregen: 'off',
    text_source: 'display', listen_lang: 'ja', pron_dict: '', mute_words: '', max_chars: 3000, wait_translation: 'off', extras: 'off', analysis: { ...s.analysis, enabled: false },
    providers: { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' } } });
const message = (orig, disp) => { const m = { name: '미나', is_user: false, mes: orig, extra: disp ? { display_text: disp } : {}, swipe_id: 0 }; T.ctx.chat.length = 0; T.ctx.chat.push(m); return m; };
const seg = (text) => X.segmentMessage(text, { paragraphs: true, final: true, routes: s.routes, charName: '미나', userName: '하람' });
const brief = (list) => list.map(g => `${g.kind}${g.speech ? '+' : ''}:${g.text}`);
// 지어낸 표본: 기울임(말 · 속마음) 사이에 서술, 두 번째 기울임 안에 따옴표 낱말
const D = '*멍청아,* 미나는 빵 봉지를 배낭에 밀어 넣으며 스스로를 나무랐다. *왜 "수용성" 같은 말을 한 거야?! 보통 사람은 편의점 계산대에서 화학을 읊지 않는다고! 수습해!*';
const DK = '*멍청아,* 미나는 빵 봉지를 배낭에 밀어 넣으며 스스로를 나무랐다. *왜 「수용성」 같은 말을 한 거야?! 수습해!*';
const O = '*Dummy,* Mina scolded herself, shoving the bread into her backpack. *Why did you say "water-soluble"?! Normal people do not recite chemistry at the corner-store counter! Fix it!*';
const LONG = '*왜 "수용성" 같은 말을 한 거야?! 보통 사람은 편의점 계산대에서 화학을 읊지 않는다고! 수습해!*';

await test('기울임 안의 "낱말" · 「낱말」 은 대사로 떼지 않고 그 기울임의 일부 — 기울임이 통째로 하나, 말 기울임(speech)', () => {
    for (const text of [D, DK, O]) {
        const list = seg(text);
        assert.equal(list.filter(g => g.kind === 'dialogue').length, 0, brief(list).join(' | '));
        const acts = list.filter(g => g.kind === 'action');
        assert.equal(acts.length, 2, brief(list).join(' | '));
        assert.ok(acts.every(g => g.speech), '서술이 낀 문단의 기울임 = 말 · 속마음');
        assert.ok(/^(왜 ["「]수용성["」] 같은 말을 한 거야\?!|Why did you say "water-soluble"\?!)/.test(acts[1].text), acts[1].text);
        assert.ok(!list.some(g => g.kind === 'narration' && /^(왜|Why)$|같은 말을|Normal people/.test(g.text)), '기울임이 서술로 갈라지지 않음');
    }
});

await test('기울임 밖의 따옴표 대사 · 문장 끝 부호가 있는 따옴표 · 기울임이 따옴표뿐이면 그대로 대사', () => {
    const a = seg('미나가 말했다. "가자." *그녀는 문을 열었다*');
    assert.deepEqual(brief(a).filter(x => x.startsWith('dialogue')), ['dialogue:가자.']);
    const b = seg('미나는 고개를 저었다. *그녀가 "안 돼!"라고 외쳤다*');
    assert.ok(b.some(g => g.kind === 'dialogue' && g.text === '안 돼!'), brief(b).join(' | '));
    const c = seg('미나는 고개를 저었다. *"그만"*');
    assert.ok(c.some(g => g.kind === 'dialogue' && g.text === '그만'), brief(c).join(' | '));
    const d = seg('*sighs* "Don\'t *ever* do that." *leaves*');
    assert.deepEqual(brief(d), ['action:sighs', 'dialogue:Don\'t ever do that.', 'action:leaves']);
});

await test('누르기: 기울임을 눌러도 · 따옴표 상자를 눌러도 그 기울임 통째로 읽고, 원문 기울임을 듣는 언어로 (화면 글을 옮기지 않음)', () => {
    const mes = message(O, D);
    const whole = '왜 "수용성" 같은 말을 한 거야?! 보통 사람은 편의점 계산대에서 화학을 읊지 않는다고! 수습해!';
    const a = C.segmentForHit(mes, { kind: 'action', strong: false, text: whole, raw: whole, line: 0 }, {});
    assert.ok(a && a.kind === 'action' && a.text === whole, JSON.stringify(a));
    const q = C.segmentForHit(mes, { kind: 'dialogue', text: '수용성', raw: '수용성', quoted: '"수용성"', color: null, speakerHint: null, line: 0 }, {});
    assert.ok(q && q.kind === 'action' && q.text === whole, '따옴표 상자 → 기울임 ' + JSON.stringify(q?.text));
    const jobs = P._forTest.tapJobs(0, mes, [q], {}).lines.flat();
    assert.ok(jobs.length >= 1);
    const got = jobs.flatMap(j => j.parts.map(p => p.original?.text));
    assert.ok(got.some(t => /^Why did you say "water-soluble"\?!/.test(t || '')), got.join(' | '));
    for (const j of jobs) {
        assert.ok(!j.parts.some(p => (p.original || p.seg)?.fromDisplay), '원문 짝');
        assert.equal(PD.playbackOriginalTitle(j), '지금 읽는 대사의 원문');
    }
    assert.equal(fetches, 0);
});

await test('이어 읽기 · 미리 만들기(tapSegments): 그 기울임이 누를 줄로 들어가고 「수용성」 낱말 조각은 따로 없음 · 원문 짝 paragraphPartner 도 같은 규칙', () => {
    const mes = message(O, D);
    const list = C.tapSegments(mes, {});
    const texts = list.map(x => x.text);
    assert.ok(texts.some(t => /^왜 "수용성" 같은 말을/.test(t)), texts.join(' | '));
    assert.ok(!texts.includes('수용성'), '낱말만 따로 읽지 않음');
    const disp = seg(D), orig = seg(O);
    const d1 = disp.filter(g => g.kind === 'action')[1];
    assert.match(P._forTest.paragraphPartner(d1, disp, orig, 'action').text, /^Why did you say "water-soluble"/);
    const solo = message(LONG, null);
    assert.ok(C.tapSegments(solo, {}).length === 0 || !C.tapSegments(solo, {}).some(x => x.text === '수용성'));
});

await test('판 1.9.9 이상 · README · CI 등록', () => {
    const v = (fs.readFileSync(path.join(theme, 'src/addons/tts/version.js'), 'utf8').match(/TTS_VERSION = '(\d+)\.(\d+)\.(\d+)'/) || []).slice(1).map(Number);
    assert.ok(v.length === 3 && (v[0] * 1e6 + v[1] * 1e3 + v[2]) >= 1009009, 'TTS 판 ' + v.join('.'));
    assert.match(fs.readFileSync(path.join(theme, 'src/addons/tts/README.md'), 'utf8'), /기울임 안의 따옴표 낱말/);
    assert.match(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/tts-italic-quote\.mjs \./);
});

console.log(`tts-italic-quote: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
