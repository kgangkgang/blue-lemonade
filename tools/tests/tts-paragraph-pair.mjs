// TTS 1.9.9 같은 문단에서 원문 짝 찾기 — 메시지 전체 차례 짝(alignLists)이 다른 문단의 기울임 수 차이로 어긋나면, 누른 말 기울임 · 속마음의
//   원문을 같은 문단 안 같은 종류 조각끼리 찾는다(서술은 건너뜀). 수가 다르면 원문을 이어 붙이거나 가장 가까운 것. 화면 글을 옮겨 읽는 건 마지막 수단.
//   제보: 「*(짧은 기울임)* (서술) *(긴 기울임)*」 문단에서 기울임을 누르면 원문이 있는데도 「원문을 못 찾았어요 — 화면 글을 옮겨 읽는 중」.
//   인물 · 문장은 지어낸 것. 네트워크 · 실제 엔진 요청 없음.  node tools/tests/tts-paragraph-pair.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsParaPairTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '미나' } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const toasts = [];
globalThis.window = { toastr: { info: (m) => toasts.push(m), warning: (m) => toasts.push(m), success() {}, error() {} } };
const G = 'const T = globalThis.__ttsParaPairTest;\n';
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
const S = await mod('settings.js'), P = await mod('player.js'), C = await mod('clickplay.js'), PD = await mod('playback-details.js');
const s = S.settings();
const gv = (voiceId, name, lang = '') => ({ uid: `minimax:${voiceId}`, provider: 'minimax', voiceId, name, lang, group: 'g', aliases: [], params: {}, mix: [] });
Object.assign(s, { enabled: true, voices: [gv('v_a', '미나 목소리', 'ja')], char_map: { 미나: 'minimax:v_a' }, default_voice: 'minimax:v_a', user_voice: 'minimax:v_a', narrator_voice: '',
    routes: { dialogue: 'character', narration: 'skip', action: 'character', thought: 'character', user_dialogue: 'user' }, read_preset: 'dialogue', no_dialogue_fallback: 'narration', join_paragraph: true, pregen: 'off',
    text_source: 'display', listen_lang: 'ja', pron_dict: '', mute_words: '', max_chars: 3000, wait_translation: 'off', extras: 'off', analysis: { ...s.analysis, enabled: false },
    providers: { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' } } });
const message = (orig, disp) => { const m = { name: '미나', is_user: false, mes: orig, extra: { display_text: disp }, swipe_id: 0 }; T.ctx.chat.length = 0; T.ctx.chat.push(m); return m; };
const tap = (mes, text) => {
    const seg = C.segmentForHit(mes, { kind: 'action', strong: false, text, raw: text, quoted: `*${text}*`, color: null, speakerHint: null, line: 0 }, {});
    assert.ok(seg, 'hit ' + text);
    return P._forTest.tapJobs(0, mes, [seg], {}).lines.flat();
};
const originalsOf = jobs => jobs.flatMap(j => j.parts.map(p => p.original?.text));
// 앞 문단: 원문 기울임 둘 → 번역문 하나 (번역기가 합침) — 메시지 전체 차례 짝이 어긋나는 원인
const LEAD_O = 'Mina looked at the shelf. *Calcium again.* *Seriously.*';
const LEAD_D = '미나는 선반을 봤다. *또 칼슘이야. 진짜로.*';
const O = '*Ignore him,*\nshe ordered her nervous system. *You are a mute civilian who just really loves calcium. Read the nutritional label. Memorize the riboflavin percentage.*';
const D = '*무시해.* 그녀가 자신의 신경계에 명령했다. *너는 그냥 칼슘을 진짜 좋아하는 말 못 하는 민간인이야. 영양성분표 읽어. 리보플라빈 함량이나 외워.*';

await test('제보 그대로: 앞 문단의 기울임 수가 달라도 누른 기울임 둘 다 같은 문단의 원문을 찾는다 (원문을 듣는 언어로 · 화면 글을 옮기지 않음)', () => {
    const mes = message(`${LEAD_O}\n\n${O}`, `${LEAD_D}\n\n${D}`);
    for (const text of ['무시해.', '너는 그냥 칼슘을 진짜 좋아하는 말 못 하는 민간인이야. 영양성분표 읽어. 리보플라빈 함량이나 외워.']) {
        const jobs = tap(mes, text);
        assert.ok(jobs.length >= 1);
        for (const j of jobs) {
            assert.ok(!j.parts.some(p => (p.original || p.seg)?.fromDisplay), '원문 짝을 찾음');
            assert.equal(PD.playbackOriginalTitle(j), '지금 읽는 대사의 원문');
        }
        const got = originalsOf(jobs);
        assert.ok(got.includes('Ignore him,') && got.some(t => /^You are a mute civilian/.test(t || '')), got.join(' | '));
    }
    assert.equal(fetches, 0);
});

await test('그 문단에서 번역이 원문 기울임 둘을 하나로 합쳤으면 원문 둘을 이어 읽는다 · 번역이 하나를 둘로 나눴으면 가까운 원문', () => {
    const merged = message(`${LEAD_O}\n\n*Ignore him.* *Breathe.* she told herself. *Read the label.*`, `${LEAD_D}\n\n*무시하고 숨 쉬어.* 그녀가 스스로에게 말했다. *라벨이나 읽어.*`);
    const j1 = originalsOf(tap(merged, '무시하고 숨 쉬어.'));
    assert.ok(j1.includes('Ignore him. Breathe.'), j1.join(' | '));
    const j2 = originalsOf(tap(merged, '라벨이나 읽어.'));
    assert.ok(j2.includes('Read the label.'), j2.join(' | '));
    const split = message(`${LEAD_O}\n\n*Ignore him and read the label.* she told herself.`, `${LEAD_D}\n\n*무시해.* *라벨이나 읽어.* 그녀가 스스로에게 말했다.`);
    for (const text of ['무시해.', '라벨이나 읽어.']) {
        const got = originalsOf(tap(split, text));
        assert.ok(got.includes('Ignore him and read the label.'), got.join(' | '));
    }
});

await test('paragraphPartner: 문단 정보 없음 · 문단 수가 다름 · 그 문단 원문에 같은 종류가 없음 → null (예전처럼 마지막 수단) · 속마음도 같은 규칙', () => {
    const f = P._forTest.paragraphPartner;
    const g = (kind, text, para) => ({ kind, text, para });
    const d1 = g('action', '하나', 1);
    assert.equal(f({ kind: 'action', text: 'x' }, [], [], 'action'), null);
    assert.equal(f(d1, [g('action', 'a', 0), d1], [g('action', 'A', 0), g('action', 'B', 1), g('action', 'C', 2)], 'action'), null, '문단 수가 다름');
    assert.equal(f(d1, [g('narration', 'n', 0), d1], [g('narration', 'N', 0), g('narration', 'only narration', 1)], 'action'), null, '그 문단 원문에 기울임 없음');
    const t1 = g('thought', '생각 둘', 4), O2 = [g('thought', 'one', 7), g('narration', 'mid', 7), g('thought', 'two', 7)];
    assert.equal(f(t1, [g('thought', '생각 하나', 4), g('narration', '서술', 4), t1], O2, 'thought').text, 'two', '서술은 건너뛰고 같은 번째 (문단 번호가 달라도 차례로)');
});

await test('판 1.9.9 이상 · README 절 · CI 등록', () => {
    const v = (fs.readFileSync(path.join(theme, 'src/addons/tts/version.js'), 'utf8').match(/TTS_VERSION = '(\d+)\.(\d+)\.(\d+)'/) || []).slice(1).map(Number);
    assert.ok(v.length === 3 && (v[0] * 1e6 + v[1] * 1e3 + v[2]) >= 1009009, 'TTS 판 ' + v.join('.'));
    assert.match(fs.readFileSync(path.join(theme, 'src/addons/tts/README.md'), 'utf8'), /^## 1\.9\.9 같은 문단에서 원문 찾기/m);
    assert.match(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/tts-paragraph-pair\.mjs \./);
});

console.log(`tts-paragraph-pair: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
