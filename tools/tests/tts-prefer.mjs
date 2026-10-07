// TTS 1.3.7 엔진 자동 맞춤 — src/addons/tts/src/voices.js (twinOf · preferVoice · previewPrefer · voiceFor)
//   node tools/tests/tts-prefer.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈은 data: 스텁으로 (settings.js 가 extension_settings 를 읽는다). 네트워크 없음.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsPreferTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'Dreamju', name2: '천지합동청' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const G = 'const T = globalThis.__ttsPreferTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
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

const { settings, toVoice } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const V = await import(pathToFileURL(path.join(root, 'voices.js')).href);

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 5).join('\n       ')); }
}
const v = (provider, voiceId, name, extra = {}) => ({ uid: `${provider}:${voiceId}`, provider, voiceId, name, lang: 'ja', group: 'g', aliases: [], params: {}, mix: [], ...extra });
function reset(prefer = '') {
    const s = settings();
    s.voices = [
        v('minimax', 'cj_seraph01', '세라프'),
        v('minimax', 'cj_seraph_new', '세라프 (새 참조)'),
        v('minimax', 'cj_lil01', '릴'),
        v('minimax', 'cj_lil_new', '릴 (새 참조)'),
        v('minimax', 'crk_jinu01', '진우 쿠키'),
        v('minimax', 'crk_darkchoco01', '다크초코 쿠키 (최원형)'),
        v('minimax', 'mix1', '섞은 목소리', { mix: [{ voiceId: 'a', weight: 50 }] }),
        v('elevenlabs', 'el_seraph', '세라프'),
        v('elevenlabs', 'el_lucifer', '루시퍼 (Lucifer)'),
        v('elevenlabs', 'el_choco', '다크초코 쿠키 (권성혁)'),
        v('elevenlabs', 'el_gabe', 'Gabe', { aliases: ['가브리엘'] }),
        v('minimax', 'cj_gabriel01', '가브리엘'),
    ];
    s.char_map = { Seraph: 'minimax:cj_seraph01', Lil: 'minimax:cj_lil01', Lucifer: 'minimax:crk_jinu01', Jinu: 'minimax:crk_jinu01', Choco: 'minimax:crk_darkchoco01', Gabriel: 'minimax:cj_gabriel01' };
    s.default_voice = 'minimax:cj_lil01';
    s.user_voice = 'minimax:cj_seraph01';
    s.narrator_voice = '';
    s.prefer_provider = prefer;
    s.providers = { minimax: { key: 'mm-test' }, elevenlabs: { key: 'el-test' } };
}
const uid = (x) => x && x.uid;

test('지정한 그대로(기본): voiceFor 는 1.3.6 과 같다', () => {
    reset('');
    assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01');
    assert.equal(uid(V.voiceFor('Lucifer')), 'minimax:crk_jinu01');
    assert.equal(uid(V.voiceFor('Nobody')), 'minimax:cj_lil01', '모르는 이름 → 기본');
    assert.equal(uid(V.voiceFor('Dreamju', { isUser: true })), 'minimax:cj_seraph01');
    assert.equal(settings().prefer_provider, '');
});

test('ElevenLabs 로: 같은 이름(세라프) · 괄호 안 영문 이름(루시퍼 (Lucifer) ← 캐릭터 Lucifer) · 다른 이름(Gabe ← 가브리엘)', () => {
    reset('elevenlabs');
    assert.equal(uid(V.voiceFor('Seraph')), 'elevenlabs:el_seraph');
    assert.equal(uid(V.voiceFor('Lucifer')), 'elevenlabs:el_lucifer', '진우 쿠키를 빌려 쓰는 Lucifer → 루시퍼 (Lucifer)');
    assert.equal(uid(V.voiceFor('Gabriel')), 'elevenlabs:el_gabe', '다른 이름에 가브리엘');
    assert.equal(uid(V.voiceFor('Dreamju', { isUser: true })), 'elevenlabs:el_seraph', '나 목소리도');
});

test('ElevenLabs 로: 맞는 이름이 없으면 원래 목소리 — 같은 목소리를 빌린 다른 캐릭터(Jinu)에 루시퍼가 붙지 않음 · 한글 괄호 설명은 이름이 아님', () => {
    reset('elevenlabs');
    assert.equal(uid(V.voiceFor('Lil')), 'minimax:cj_lil01', 'ElevenLabs 에 릴이 없음');
    assert.equal(uid(V.voiceFor('Jinu')), 'minimax:crk_jinu01', '진우 쿠키 · Jinu 둘 다 루시퍼가 아님');
    assert.equal(uid(V.voiceFor('Choco')), 'elevenlabs:el_choco', '괄호 앞 「다크초코 쿠키」 가 같음 (괄호 안 성우 이름은 다르지만 같은 캐릭터)');
    assert.equal(uid(V.voiceFor('Nobody')), 'minimax:cj_lil01', '기본(릴)도 ElevenLabs 짝이 없어 그대로');
});

test('MiniMax 로 되돌리기: 같은 이름이 여럿이면 정확히 같은 이름 · 같은 점수면 먼저 등록한 것 · 섞은 목소리는 짝이 아님', () => {
    reset('minimax');
    const s = settings();
    s.char_map.Seraph = 'elevenlabs:el_seraph';
    assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01', '세라프 (새 참조) 보다 정확히 같은 세라프');
    s.char_map.Lucifer = 'elevenlabs:el_lucifer';
    assert.equal(uid(V.voiceFor('Lucifer')), 'elevenlabs:el_lucifer', 'MiniMax 에 루시퍼 · Lucifer 가 없음 → 그대로');
    assert.equal(V.twinOf(V.findVoice('minimax:cj_seraph01'), 'minimax').uid, 'minimax:cj_seraph01', '같은 엔진이면 자기 자신');
    assert.equal(V.twinOf(V.findVoice('elevenlabs:el_seraph'), 'minimax').uid, 'minimax:cj_seraph01');
    s.voices.push(v('elevenlabs', 'el_mixname', '섞은 목소리'));
    assert.equal(V.twinOf(V.findVoice('elevenlabs:el_mixname'), 'minimax'), null, '섞은 목소리는 짝으로 안 고름');
});

test('「새 참조」 같은 한글 괄호 설명끼리 맞지 않음', () => {
    reset('elevenlabs');
    const s = settings();
    s.voices.push(v('elevenlabs', 'el_x', '아무개 (새 참조)'));
    s.char_map.Lil = 'minimax:cj_lil_new';   // 릴 (새 참조)
    assert.equal(uid(V.voiceFor('Lil')), 'minimax:cj_lil_new', '「새 참조」 로 아무개에 붙지 않음');
});

test('previewPrefer: 바뀌는 캐릭터와 그대로인 캐릭터를 센다', () => {
    reset('');
    const r = V.previewPrefer('elevenlabs', Object.keys(settings().char_map));
    assert.deepEqual(r.moved.sort(), ['Choco', 'Gabriel', 'Lucifer', 'Seraph']);
    assert.deepEqual(r.kept.sort(), ['Jinu', 'Lil']);
    const m = V.previewPrefer('minimax', Object.keys(settings().char_map));
    assert.equal(m.kept.length, 0, '이미 MiniMax 면 다 moved(그대로 쓸 수 있음)');
});

test('removeVoice: 그 엔진 목소리가 다 없어지면 자동 맞춤도 끔', () => {
    reset('elevenlabs');
    for (const x of settings().voices.filter(x => x.provider === 'elevenlabs').map(x => x.uid)) V.removeVoice(x);
    assert.equal(settings().prefer_provider, '');
    assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01');
});

// ---------- 1.3.7 목록 = 연결된 계정
test('shownVoices: 계정에 없음 · 키 없는 엔진 · 「엔진」으로 고른 다른 엔진을 숨기고 hiddenCounts 가 까닭별로 셈', () => {
    reset('');
    const s = settings();
    s.voices.push(v('typecast', 'tc1', '타입캐스트'));          // 키 없음
    s.voices.find(x => x.uid === 'minimax:cj_lil_new').gone = true;
    let shown = V.shownVoices().map(x => x.uid);
    assert.ok(!shown.includes('minimax:cj_lil_new'), '계정에 없음');
    assert.ok(!shown.includes('typecast:tc1'), '키 없는 엔진');
    assert.ok(shown.includes('elevenlabs:el_seraph') && shown.includes('minimax:cj_seraph01'));
    assert.deepEqual(V.hiddenCounts(), { gone: 1, nokey: 1, engine: 0 });
    s.prefer_provider = 'elevenlabs';
    shown = V.shownVoices().map(x => x.uid);
    assert.ok(shown.length && shown.every(u => u.startsWith('elevenlabs:')), '엔진 = ElevenLabs 면 그 엔진만');
    assert.equal(V.hiddenCounts().engine, s.voices.filter(x => x.provider === 'minimax' && !x.gone).length);
    s.providers.elevenlabs.key = '';
    assert.equal(V.shownVoices().length, 0, '고른 엔진의 키를 지우면 아무것도 안 보임');
    assert.equal(V.engineUsable('browser'), true, '키가 필요 없는 엔진');
    assert.equal(V.engineUsable('nope'), false);
});

test('syncAccount: 계정에 없는 목소리 gone · 다시 생기면 되돌림 · 새 내 목소리(own)만 자동 추가 · 섞은 목소리는 재료가 하나라도 없으면 gone · 빈 목록은 아무것도 안 함', () => {
    reset('');
    const s = settings();
    const n0 = s.voices.length;
    const account = [
        { voiceId: 'cj_seraph01', own: true }, { voiceId: 'cj_lil01', own: true }, { voiceId: 'crk_jinu01', own: true },
        { voiceId: 'crk_darkchoco01', own: true }, { voiceId: 'cj_gabriel01', own: true },
        { voiceId: 'cj_new01', name: 'cj_new01', own: true },          // 새 복제 → 자동 추가
        { voiceId: 'Wise_Woman', name: 'Wise Woman', own: false },      // 시스템 → 안 넣음
        // 섞은 목소리(mix1)의 재료 a 는 계정에 없음 → mix1 도 gone
    ];
    const r = V.syncAccount('minimax', account);
    assert.equal(r.added, 1);
    assert.ok(s.voices.some(x => x.uid === 'minimax:cj_new01'));
    assert.ok(!s.voices.some(x => x.voiceId === 'Wise_Woman'));
    const gone = s.voices.filter(x => x.provider === 'minimax' && x.gone).map(x => x.voiceId).sort();
    assert.deepEqual(gone, ['cj_lil_new', 'cj_seraph_new', 'mix1'], JSON.stringify(gone));
    assert.equal(r.gone, 3);
    assert.ok(!s.voices.some(x => x.provider === 'elevenlabs' && x.gone), '다른 엔진은 그대로');
    assert.equal(s.voices.length, n0 + 1);
    const r2 = V.syncAccount('minimax', [...account, { voiceId: 'cj_seraph_new', own: true }, { voiceId: 'a' }]);
    assert.equal(r2.back, 2, '세라프 (새 참조) · 섞은 목소리(재료 a 가 생김)');
    assert.equal(r2.added, 0, '이미 있는 목소리는 다시 안 넣음');
    const before = JSON.stringify(s.voices);
    const r3 = V.syncAccount('minimax', []);
    assert.equal(JSON.stringify(s.voices), before, '빈 목록은 아무것도 안 바꿈');
    assert.equal(r3.gone, 0);
});

test('removeGone: 계정에 없는 목소리를 지우되 캐릭터 · 기본 · 나 · 내레이터에 연결된 것은 남김 · toVoice 가 gone 을 지킴', () => {
    reset('');
    const s = settings();
    s.voices.find(x => x.uid === 'minimax:cj_lil_new').gone = true;
    s.voices.find(x => x.uid === 'minimax:cj_lil01').gone = true;          // 기본 · Lil 에 연결됨
    assert.equal(V.removeGone(), 1);
    assert.ok(!s.voices.some(x => x.uid === 'minimax:cj_lil_new'));
    assert.ok(s.voices.some(x => x.uid === 'minimax:cj_lil01'), '연결된 것은 남김');
    assert.equal(toVoice({ voiceId: 'x', gone: true }, 'minimax').gone, true);
    assert.equal('gone' in toVoice({ voiceId: 'x' }, 'minimax'), false);
});

console.log(`\ntts-prefer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
