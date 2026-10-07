// TTS 1.3.7 엔진 자동 맞춤 — src/addons/tts/src/voices.js (twinOf · preferVoice · previewPrefer · voiceFor)
//   1.3.8: 정확한 이름 짝 · stock · charKeyOf · 지운 목소리 · 캐릭터 이름 짝의 이어받기 · 엔진 고정 · 「나」 자동
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
    // 1.3.8 칸 (앞 시험이 남긴 값 지움)
    s.account_removed = {};
    s.prefer_keep = {};
    s.prefer_declined = {};
    s.extra_map = {};
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

// ---------- 1.3.8 (TTS 5.7.2 검증 · 사용자 제보 10-08) — 이 판에만 있는 함수는 없으면 건너뛴다 (공개 저장소의 1.3.7 로 돌릴 때)
const has138 = typeof V.charKeyOf === 'function' && typeof V.isPinned === 'function';
if (!has138) console.log('  (1.3.8 시험 건너뜀: 이 트리는 1.3.7)');
if (has138) {
    test('twinOf: 정확히 같은 이름이 괄호 붙은 이름보다 먼저 — 「세라프 (긴 참조)」가 먼저 등록돼 있어도 「세라프」', () => {
        reset('');
        const s = settings();
        s.voices = s.voices.filter(x => x.uid !== 'elevenlabs:el_seraph');
        s.voices.push(v('elevenlabs', 'el_seraph_long', '세라프 (긴 참조)'), v('elevenlabs', 'el_seraph', '세라프'));
        assert.equal(V.twinOf(V.findVoice('minimax:cj_seraph01'), 'elevenlabs').uid, 'elevenlabs:el_seraph');
        s.prefer_provider = 'elevenlabs';
        assert.equal(uid(V.voiceFor('Seraph')), 'elevenlabs:el_seraph');
    });

    test('twinOf: 캐릭터 이름(1점)으로는 엔진의 기본 목소리(stock)를 짝으로 안 고름 · 표시 없는 옛 목소리는 1.3.7 그대로 · 계정 맞춤이 stock 표시를 채움', () => {
        reset('');
        const s = settings();
        s.voices.push(v('minimax', 'cj_alice01', '앨리스'), v('elevenlabs', 'el_alice_pre', 'Alice', { stock: true }));
        s.char_map.Alice = 'minimax:cj_alice01';
        s.prefer_provider = 'elevenlabs';
        assert.equal(uid(V.voiceFor('Alice')), 'minimax:cj_alice01', '기본 목소리 Alice 는 캐릭터 Alice 의 짝이 아님');
        delete V.findVoice('elevenlabs:el_alice_pre').stock;
        assert.equal(uid(V.voiceFor('Alice')), 'elevenlabs:el_alice_pre', '표시가 없으면 1.3.7 처럼');
        V.syncAccount('elevenlabs', [{ voiceId: 'el_seraph', own: true }, { voiceId: 'el_lucifer', own: true }, { voiceId: 'el_choco', own: true }, { voiceId: 'el_gabe', own: true }, { voiceId: 'el_alice_pre', own: false }]);
        assert.equal(V.findVoice('elevenlabs:el_alice_pre').stock, true, '계정 목록의 own 이 아닌 줄 → stock');
        assert.equal(V.findVoice('elevenlabs:el_seraph').stock, undefined, '내 목소리는 표시 없음');
        assert.equal(uid(V.voiceFor('Alice')), 'minimax:cj_alice01');
        assert.equal(uid(V.voiceFor('Lucifer')), 'elevenlabs:el_lucifer', '내 목소리는 캐릭터 이름으로 그대로 짝');
        assert.equal(toVoice({ voiceId: 'x', stock: true }, 'elevenlabs').stock, true);
        assert.equal('stock' in toVoice({ voiceId: 'x' }, 'elevenlabs'), false);
    });

    test('charKeyOf: 분석이 한글로 준 「루시퍼」 → 목소리 「루시퍼 (Lucifer)」 → 연결표 Lucifer (엑스트라 · 다른 목소리로 새지 않음)', () => {
        reset('');
        assert.equal(V.charKeyOf('루시퍼'), 'Lucifer');
        assert.equal(V.charKeyOf('lucifer'), 'Lucifer');
        assert.equal(V.charKeyOf('진우 쿠키'), '', '빌린 목소리 이름은 그 목소리를 쓰는 캐릭터로 바뀌지 않음');
        assert.equal(uid(V.voiceFor('루시퍼')), 'minimax:crk_jinu01', '「지정한 그대로」면 Lucifer 의 목소리 (루시퍼 (Lucifer) 아님)');
        settings().prefer_provider = 'elevenlabs';
        assert.equal(uid(V.voiceFor('루시퍼')), 'elevenlabs:el_lucifer');
        assert.equal(V.hasOwnVoice('루시퍼'), true, '엑스트라 표에 안 적힘');
    });

    test('voiceByName: 괄호 앞 이름 · 괄호 안 영문 이름 (연결 없는 새 사용자) · 계정에 없는 목소리는 이름으로 안 고름', () => {
        reset('');
        const s = settings();
        s.char_map = {};
        assert.equal(uid(V.voiceByName('Lucifer')), 'elevenlabs:el_lucifer');
        V.findVoice('elevenlabs:el_lucifer').gone = true;
        assert.equal(V.voiceByName('Lucifer'), null);
    });

    test('preferVoice: 「엔진」의 키를 지우면 지정한 목소리 그대로 · 계정에 없는(gone) 짝은 안 씀', () => {
        reset('elevenlabs');
        const s = settings();
        V.findVoice('elevenlabs:el_seraph').gone = true;
        assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01', '지운 짝으로 읽지 않음');
        delete V.findVoice('elevenlabs:el_seraph').gone;
        s.providers.elevenlabs.key = '';
        assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01', '키 없는 엔진으로 보내 모두 멈추지 않게');
    });

    test('syncAccount → 새 내 목소리가 캐릭터 이름으로만 이어지는 짝이면 원어 · 묶음만 (빌린 목소리 이름은 다른 이름으로 안 넣음) · 이름이 같은 짝이면 다른 이름도', () => {
        reset('');
        const s = settings();
        s.voices = s.voices.filter(x => !['elevenlabs:el_lucifer', 'elevenlabs:el_seraph'].includes(x.uid));
        Object.assign(V.findVoice('minimax:crk_jinu01'), { lang: 'ko', group: '쿠키런: 킹덤' });
        Object.assign(V.findVoice('minimax:cj_seraph01'), { lang: 'ja', group: '천지합동청', aliases: ['Seraph'] });
        const r = V.syncAccount('elevenlabs', [{ voiceId: 'el_luc2', name: '루시퍼 (Lucifer)', own: true }, { voiceId: 'el_ser2', name: '세라프', own: true }, { voiceId: 'el_choco', own: true }, { voiceId: 'el_gabe', own: true }]);
        assert.equal(r.added, 2);
        const luc = s.voices.find(x => x.uid === 'elevenlabs:el_luc2'), ser = s.voices.find(x => x.uid === 'elevenlabs:el_ser2');
        assert.equal(luc.lang, 'ko');
        assert.equal(luc.group, '쿠키런: 킹덤');
        assert.ok(!luc.aliases.includes('진우 쿠키'), '진우 쿠키를 쓰는 Jinu 가 루시퍼로 바뀌지 않게');
        assert.equal(ser.lang, 'ja');
        assert.equal(ser.group, '천지합동청');
        assert.ok(ser.aliases.includes('Seraph'));
        s.prefer_provider = 'elevenlabs';
        assert.equal(uid(V.voiceFor('Jinu')), 'minimax:crk_jinu01');
    });

    test('inheritNew (불러오기): 새로 들어온 내 목소리도 원어 · 묶음을 이어받음', () => {
        reset('');
        const s = settings();
        s.voices = s.voices.filter(x => x.uid !== 'elevenlabs:el_seraph');
        Object.assign(V.findVoice('minimax:cj_seraph01'), { lang: 'ja', group: '천지합동청' });
        V.upsertVoices([{ voiceId: 'el_seraph', name: '세라프', group: '복제', own: true }], 'elevenlabs');
        assert.equal(V.findVoice('elevenlabs:el_seraph').group, '복제');
        assert.equal(V.inheritNew('elevenlabs', ['el_seraph']), 1);
        assert.equal(V.findVoice('elevenlabs:el_seraph').lang, 'ja');
        assert.equal(V.findVoice('elevenlabs:el_seraph').group, '천지합동청');
    });

    test('지운 계정 목소리는 계정 맞춤이 다시 넣지 않음 · 불러오기 · 붙여넣기로 넣으면 풂 · 계정에 없어 지운 것은 기억 안 함', () => {
        reset('');
        const s = settings();
        V.removeVoice('elevenlabs:el_seraph');
        assert.deepEqual(V.removedIds('elevenlabs'), ['el_seraph']);
        const list = [{ voiceId: 'el_seraph', name: '세라프', own: true }, { voiceId: 'el_lucifer', own: true }, { voiceId: 'el_choco', own: true }, { voiceId: 'el_gabe', own: true }];
        assert.equal(V.syncAccount('elevenlabs', list).added, 0, '다시 안 들어옴');
        assert.ok(!V.findVoice('elevenlabs:el_seraph'));
        V.upsertVoices([{ voiceId: 'el_seraph', name: '세라프' }], 'elevenlabs');
        assert.deepEqual(V.removedIds('elevenlabs'), [], '직접 넣으면 풂');
        V.findVoice('elevenlabs:el_choco').gone = true;
        assert.equal(V.removeGone(), 1);
        assert.deepEqual(V.removedIds('elevenlabs'), [], '계정에 없어 지운 것은 기억 안 함 (다시 생기면 들어옴)');
        V.syncAccount('elevenlabs', list.concat([{ voiceId: 'el_choco', name: '다크초코 쿠키 (권성혁)', own: true }]));
        assert.ok(V.findVoice('elevenlabs:el_choco'));
        assert.deepEqual(s.account_removed, {}, '빈 칸은 지움');
    });

    test('엔진 고정 (prefer_keep): 고정한 캐릭터는 「엔진」을 따르지 않음 · 셈에서 빠짐 · 목소리를 지우면 고정도 지움', () => {
        reset('elevenlabs');
        const s = settings();
        s.prefer_keep = { Seraph: true };
        assert.equal(V.isPinned('Seraph'), true);
        assert.equal(V.isPinned('seraph'), true, '대소문자');
        assert.equal(V.isPinned('Lil'), false);
        assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01', '고정 → 연결표 목소리 (MiniMax)');
        assert.equal(uid(V.voiceFor('Gabriel')), 'elevenlabs:el_gabe', '나머지는 「엔진」대로');
        const r = V.previewPrefer('elevenlabs', Object.keys(s.char_map));
        assert.ok(!r.moved.includes('Seraph') && !r.kept.includes('Seraph'), '고정한 캐릭터는 셈에서 뺌');
        V.removeVoice('minimax:cj_seraph01');
        assert.ok(!('Seraph' in s.prefer_keep), '연결이 없어지면 고정도');
    });

    test('「나」 자동 (@auto): 페르소나도 목소리를 안 정한 화자처럼 — 연결표 → 엑스트라 → 기본 · (없음)은 1.3.7 처럼 null · 쓰는 uid 목록엔 안 들어감', () => {
        reset('');
        const s = settings();
        s.user_voice = '@auto';
        assert.equal(uid(V.voiceFor('Dreamju', { isUser: true })), 'minimax:cj_lil01', '엑스트라가 없으면 기본 목소리');
        s.extras = 'auto';
        s.extra_map = { Dreamju: { g: 'f', a: 'a', l: 'ja', t: 1, v: { minimax: 'cj_seraph_new' } } };
        assert.equal(uid(V.voiceFor('Dreamju', { isUser: true })), 'minimax:cj_seraph_new', '엑스트라 목소리');
        s.char_map.Dreamju = 'minimax:cj_gabriel01';
        assert.equal(uid(V.voiceFor('Dreamju', { isUser: true })), 'minimax:cj_gabriel01', '엑스트라 줄에서 고르면 그 목소리');
        assert.ok(!V.usedUids().has('@auto'));
        s.user_voice = '';
        assert.equal(V.voiceFor('Dreamju', { isUser: true }), null, '(없음) = 읽지 않음 (1.3.7 그대로)');
        s.user_voice = 'minimax:cj_seraph01';
        assert.equal(uid(V.voiceFor('Dreamju', { isUser: true })), 'minimax:cj_seraph01');
    });

    test('seedDefault · clearGone: 처음 들어온 목소리면 기본 목소리 (한국어 먼저) · 직접 입력 서버가 숨긴 표시 되돌림', () => {
        reset('');
        const s = settings();
        s.default_voice = '';
        s.voices.push(v('openai', 'alloy', 'Alloy', { lang: '' }), v('openai', 'nova', 'Nova', { lang: 'ko' }));
        assert.equal(V.seedDefault(5, 'openai'), null, '이미 목소리가 있었으면 안 함');
        assert.equal(uid(V.seedDefault(0, 'openai')), 'openai:nova');
        assert.equal(s.default_voice, 'openai:nova');
        V.findVoice('minimax:cj_lil_new').gone = true;
        V.findVoice('minimax:cj_seraph_new').gone = true;
        assert.equal(V.clearGone('minimax'), 2);
        assert.equal(V.hiddenCounts().gone, 0);
    });
    test('charKeyOf: voiceByName 과 같은 차례 — 이름이 정확히 「Lil」인 목소리가 있으면 다른 목소리에 남은 옛 다른 이름 「Lil」 로 Seraph 가 되지 않음 · 고정도 안 샘 (리뷰 p04)', () => {
        reset('');
        const s = settings();
        V.findVoice('minimax:cj_seraph01').aliases = ['Seraph', 'Lil'];
        s.voices.push(v('minimax', 'cj_lil_exact', 'Lil'));
        delete s.char_map.Lil;
        assert.equal(V.charKeyOf('Lil'), '');
        assert.equal(uid(V.voiceFor('Lil')), 'minimax:cj_lil_exact');
        s.prefer_provider = 'elevenlabs';
        s.prefer_keep = { Seraph: true };
        assert.equal(V.isPinned('Lil'), false, 'Seraph 의 고정이 Lil 로 새지 않음');
        // 같은 이름의 목소리가 엔진마다 있으면 연결표 이름을 다른 이름으로 가진 쪽에서 (MiniMax 세라프 · ElevenLabs 세라프 [Seraph])
        reset('');
        V.findVoice('elevenlabs:el_seraph').aliases = ['Seraph'];
        assert.equal(V.charKeyOf('세라프'), 'Seraph');
        assert.equal(V.charKeyOf('진우 쿠키'), '', '빌린 목소리 이름은 그대로 (그 목소리를 쓰는 Lucifer 가 아님)');
    });

    test('고정은 「엔진」이 있을 때만: 「지정한 그대로」면 isPinned=false (칩 · 안내와 같게) · 기록은 남아 previewPrefer 셈에선 빠지고 다시 켜면 고정 (리뷰 p03)', () => {
        reset('elevenlabs');
        const s = settings();
        s.prefer_keep = { Seraph: true };
        assert.equal(V.isPinned('Seraph'), true);
        s.prefer_provider = '';
        assert.equal(V.isPinned('Seraph'), false);
        assert.equal(V.isPinned('Seraph', { raw: true }), true);
        const r = V.previewPrefer('elevenlabs', Object.keys(s.char_map));
        assert.ok(!r.moved.includes('Seraph') && !r.kept.includes('Seraph'), '다시 켜면 고정되니 셈에서 뺌');
        s.prefer_provider = 'elevenlabs';
        assert.equal(V.isPinned('Seraph'), true);
        assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01');
    });

    test('엔진에 원래 있는 목소리(OpenAI nova)는 stock 표시가 없는 1.3.7 목록이어도 캐릭터 이름만으로 짝이 안 됨 · 직접 만든 이름 같은 목소리는 짝 (리뷰 p13)', () => {
        reset('openai');
        const s = settings();
        s.providers.openai = { key: 'oa-test' };
        s.voices.push(v('minimax', 'cj_nova01', '노바'), v('openai', 'nova', 'nova'));
        s.char_map.Nova = 'minimax:cj_nova01';
        assert.equal(uid(V.voiceFor('Nova')), 'minimax:cj_nova01', 'OpenAI 기본 nova 는 캐릭터 Nova 의 짝이 아님');
        s.voices.push(v('openai', 'custom_nova', 'Nova'));
        assert.equal(uid(V.voiceFor('Nova')), 'openai:custom_nova', '기본 목록에 없는 id 는 그대로 짝');
    });
}

console.log(`\ntts-prefer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
