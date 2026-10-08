// TTS 1.3.7 엑스트라 목소리 · 목소리마다 모델 — src/addons/tts/src/voices.js (genderOf · storeStock · noteExtras · extraFor · voiceFor)
//   1.3.8: 기본 길이 1.3.7 과 같은 요청 · 캐시 키 (48줄 고정값) · ElevenLabs 감정 세기 · 말투 태그 · '?' 도움말 · 「나」 자동 프롬프트
//   · analysis.js composePrompt (엑스트라가 없으면 1.3.6 과 글자까지 같은 프롬프트) · settings.js toVoice (use_model · extra)
//   node tools/tests/tts-extras.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈은 data: 스텁으로. 네트워크 없음 (fetch 를 부르면 실패로 끝나고 옛 캐시를 씀).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsExtrasTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'Dreamju', name2: '천지합동청' } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsExtrasTest;\n';
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

const { settings, toVoice } = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const V = await import(pathToFileURL(path.join(root, 'voices.js')).href);
let A = null;
try { A = await import(pathToFileURL(path.join(root, 'analysis.js')).href); } catch (e) { console.log('  (analysis.js 를 못 불러와 프롬프트 시험은 건너뜀: ' + String(e.message || e).slice(0, 120) + ')'); }

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 5).join('\n       ')); }
}
const v = (provider, voiceId, name, extra = {}) => ({ uid: `${provider}:${voiceId}`, provider, voiceId, name, lang: 'ja', group: 'g', aliases: [], params: {}, mix: [], ...extra });
const MM_STOCK = [
    { voiceId: 'Korean_SweetGirl', name: 'Sweet Girl', lang: 'ko' },
    { voiceId: 'Korean_CalmLady', name: 'Calm Lady', lang: 'ko' },
    { voiceId: 'Korean_CheerfulBoyfriend', name: 'Cheerful Boyfriend', lang: 'ko' },
    { voiceId: 'Korean_WiseElderMan', name: 'Wise Elder Man', lang: 'ko' },
    { voiceId: 'Japanese_KindLady', name: 'Kind Lady', lang: 'ja' },
    { voiceId: 'Japanese_GentleButler', name: 'Gentle Butler', lang: 'ja' },
    { voiceId: 'Japanese_LoyalKnight', name: 'Loyal Knight', lang: 'ja' },
    { voiceId: 'Japanese_IntellectualSenior', name: 'Intellectual Senior', lang: 'ja' },   // 성별 모름 → 뺌
    { voiceId: 'cj_seraph01', name: 'cj_seraph01', own: true },                             // 내 목소리 → 뺌
];
function reset({ prefer = '', extras = 'auto', defaultLang = 'ja' } = {}) {
    const s = settings();
    s.voices = [
        v('minimax', 'cj_seraph01', '세라프'),
        v('minimax', 'cj_lil01', '릴', { lang: defaultLang }),
        v('elevenlabs', 'el_seraph', '세라프'),
        v('elevenlabs', 'el_lil', '릴'),
    ];
    s.char_map = { Seraph: 'minimax:cj_seraph01', Lil: 'minimax:cj_lil01' };
    s.default_voice = 'minimax:cj_lil01';
    s.user_voice = '';
    s.narrator_voice = '';
    s.prefer_provider = prefer;
    s.extras = extras;
    s.extra_map = {};
    s.providers = { minimax: { key: 'mm-test' }, elevenlabs: { key: 'el-test' } };
    store.clear();
}
const uid = (x) => x && x.uid;

await test('genderOf · ageOf: 엔진이 준 성별 먼저 · 아니면 이름 낱말 (CamelCase) · 둘 다 걸리거나 없으면 모름', () => {
    assert.equal(V.genderOf({ voiceId: 'Korean_SweetGirl' }), 'f');
    assert.equal(V.genderOf({ voiceId: 'Japanese_GentleButler' }), 'm');
    assert.equal(V.genderOf({ voiceId: 'Japanese_IntellectualSenior' }), '');
    assert.equal(V.genderOf({ voiceId: 'abc', name: 'Rachel', gender: 'female' }), 'f');
    assert.equal(V.genderOf({ voiceId: 'abc', name: 'Brother and Sister' }), '', '둘 다 걸림');
    assert.equal(V.genderOf({ voiceId: 'Woman_X' }), 'f', 'woman 은 man 으로 읽지 않음');
    assert.equal(V.ageOf({ voiceId: 'Korean_WiseElderMan' }), 'o');
    assert.equal(V.ageOf({ voiceId: 'Korean_SweetGirl' }), 'y');
    assert.equal(V.ageOf({ voiceId: 'x', age: 'middle_aged' }), 'a');
});

await test('storeStock: 내 목소리 · 섞은 목소리 · 성별 모름은 빼고 localStorage 에 (설정 파일엔 안 넣음)', () => {
    reset();
    const rows = V.storeStock('minimax', MM_STOCK);
    assert.equal(rows.length, 7);
    assert.ok(!rows.some(r => r.voiceId === 'cj_seraph01' || r.voiceId === 'Japanese_IntellectualSenior'));
    assert.deepEqual(V.stockOf('minimax').map(r => r.voiceId), rows.map(r => r.voiceId));
    assert.ok(!JSON.stringify(settings()).includes('Korean_SweetGirl'), '설정에는 없음');
});

await test('noteExtras → extraFor: 성별 · 언어(기본 목소리의 원어 = ja)에 맞는 기본 목소리 · 같은 이름은 늘 같은 목소리 · 다른 엑스트라와 겹치지 않게', async () => {
    reset();
    V.storeStock('minimax', MM_STOCK);
    const n = await V.noteExtras({ '카페 사장': { g: 'm', a: 'a' }, '편의점 알바': { g: 'f', a: 'y' }, '경비원': { g: 'm', a: '' } });
    assert.equal(n, 3);
    const boss = V.voiceFor('카페 사장'), clerk = V.voiceFor('편의점 알바'), guard = V.voiceFor('경비원');
    assert.ok(boss && clerk && guard);
    assert.ok(['minimax:Japanese_GentleButler', 'minimax:Japanese_LoyalKnight'].includes(uid(boss)), uid(boss));
    assert.equal(uid(clerk), 'minimax:Japanese_KindLady');
    assert.notEqual(uid(boss), uid(guard), '남자 둘은 다른 목소리');
    assert.equal(V.voiceFor('카페 사장'), boss, '같은 객체 (재생기가 줄을 합칠 수 있게)');
    assert.equal(boss.group, '엑스트라');
    assert.equal(boss.lang, 'ja');
    assert.equal(settings().extra_map['카페 사장'].v.minimax, boss.voiceId, '고른 목소리를 표에 적음');
    assert.equal(uid(V.voiceFor('카페 사장님')), uid(boss), '이름이 조금 달라도 같은 사람');
});

await test('목소리를 정한 이름 · 성별 모름 · 엑스트라 끔 · 맞는 목소리 없음 → 1.3.6 처럼 기본 목소리', async () => {
    reset();
    V.storeStock('minimax', MM_STOCK);
    await V.noteExtras({ Seraph: { g: 'f' }, '행인': { g: '' }, '점원': { g: 'f' } });
    assert.ok(!('Seraph' in settings().extra_map), '목소리를 정한 이름은 안 적음');
    assert.ok(!('행인' in settings().extra_map), '성별 모름');
    assert.equal(uid(V.voiceFor('Seraph')), 'minimax:cj_seraph01');
    assert.equal(uid(V.voiceFor('모르는 사람')), 'minimax:cj_lil01');
    settings().extras = 'off';
    assert.equal(uid(V.voiceFor('점원')), 'minimax:cj_lil01', '끄면 기본 목소리');
    settings().extras = 'auto';
    store.clear();
    settings().extra_map['점원'].v = {};
    assert.equal(uid(V.voiceFor('점원')), 'minimax:cj_lil01', '기본 목소리 목록이 아직 없으면 이번 줄은 기본 목소리');
    await new Promise(r => setTimeout(r, 20));
    assert.ok(fetches >= 1, '목록을 받으러 감 (실패하면 조용히)');
});

await test('「엑스트라로도 쓰기」를 켠 목소리가 있으면 그것들 가운데서 · 캐릭터에 연결된 목소리는 안 씀', async () => {
    reset();
    V.storeStock('minimax', MM_STOCK);
    const s = settings();
    s.voices.push(v('minimax', 'my_extra_f', '내 엑스트라 여자', { extra: 'f' }), v('minimax', 'cj_seraph01b', '세라프 2', { extra: 'f' }));
    s.char_map.Seraph2 = 'minimax:cj_seraph01b';
    await V.noteExtras({ '점원': { g: 'f' } });
    assert.equal(uid(V.voiceFor('점원')), 'minimax:my_extra_f');
    assert.equal(V.voiceFor('점원'), s.voices.find(x => x.voiceId === 'my_extra_f'), '목록의 목소리 그대로');
});

await test('엔진을 바꾸면(엔진 자동 맞춤) 그 엔진에서 따로 고르고, 되돌리면 원래 목소리', async () => {
    reset();
    V.storeStock('minimax', MM_STOCK);
    V.storeStock('elevenlabs', [{ voiceId: 'el_rachel', name: 'Rachel', gender: 'female', lang: 'en' }, { voiceId: 'el_adam', name: 'Adam', gender: 'male' }]);
    await V.noteExtras({ '점원': { g: 'f' } });
    const mm = uid(V.voiceFor('점원'));
    settings().prefer_provider = 'elevenlabs';
    assert.equal(uid(V.voiceFor('점원')), 'elevenlabs:el_rachel', '다국어 엔진은 언어가 안 맞아도 성별로');
    settings().prefer_provider = '';
    assert.equal(uid(V.voiceFor('점원')), mm);
    assert.deepEqual(Object.keys(settings().extra_map['점원'].v).sort(), ['elevenlabs', 'minimax']);
});

await test('표는 300명까지 (처음 본 지 오래된 것부터) · forgetExtra', async () => {
    reset();
    const s = settings();
    for (let i = 0; i < 305; i++) s.extra_map[`사람${i}`] = { g: 'm', a: '', l: '', t: i, v: {} };
    await V.noteExtras({ '새 사람': { g: 'f' } });
    assert.equal(Object.keys(s.extra_map).length, 300);
    assert.ok(!('사람0' in s.extra_map) && '새 사람' in s.extra_map);
    assert.equal(V.forgetExtra('새 사람'), true);
    assert.ok(!('새 사람' in s.extra_map));
});

await test('toVoice: use_model · extra 를 지키고 이상한 값은 버림 (없으면 칸도 없음 — 설정 파일이 안 늘게)', () => {
    assert.equal(toVoice({ voiceId: 'x', use_model: 'eleven_v4' }, 'elevenlabs').use_model, 'eleven_v4');
    assert.equal('use_model' in toVoice({ voiceId: 'x', use_model: 'bad model!' }, 'elevenlabs'), false);
    assert.equal('use_model' in toVoice({ voiceId: 'x' }, 'elevenlabs'), false);
    assert.equal(toVoice({ voiceId: 'x', extra: 'f' }, 'minimax').extra, 'f');
    assert.equal('extra' in toVoice({ voiceId: 'x', extra: 'x' }, 'minimax'), false);
});

await test('한국어 이름: 모델 id (아직 안 나온 것도 낱말 규칙) · 기본 목소리 이름 (MiniMax 시스템 목소리) — 값은 그대로', async () => {
    const { koModelLabel: KM } = await import(pathToFileURL(path.join(root, 'model-names.js')).href);
    const { koVoiceName: KV } = await import(pathToFileURL(path.join(root, 'voice-names.js')).href);
    assert.equal(KM('elevenlabs', 'eleven_v4_turbo'), '일레븐 v4 빠름');
    assert.equal(KM('elevenlabs', 'eleven_v5'), '일레븐 v5', '아직 없는 모델도');
    assert.equal(KM('minimax', 'speech-2.8-hd'), '스피치 2.8 고음질');
    assert.equal(KM('minimax', 'speech-3.0-turbo'), '스피치 3.0 빠름');
    assert.equal(KM('openai', 'tts-1-hd'), 'TTS-1 고음질');
    assert.equal(KM('openrouter', 'google/gemini-3.8-flash-tts'), '구글 · 제미나이 3.8 플래시');
    assert.equal(KV('Gentle Butler'), '다정한 집사');
    assert.equal(KV('Charming Elder Sister'), '매력적인 언니');
    assert.equal(KV('kind-hearted Girl'), '마음씨 착한 소녀');
    assert.equal(KV('Rachel'), 'Rachel', '사람 이름은 그대로');
    assert.equal(KV('세라프'), '세라프');
});

let P = null, PR = null;
try {
    P = await import(pathToFileURL(path.join(root, 'player.js')).href);
    PR = await import(pathToFileURL(path.join(root, 'providers/index.js')).href);
} catch (e) { console.log('  (player.js 를 못 불러와 목소리별 모델 시험은 건너뜀: ' + String(e.message || e).slice(0, 120) + ')'); }
if (P && PR) {
    await test('목소리별 모델 (use_model): 그 목소리만 그 모델로 요청 · 캐시 키도 다름 · 없으면 1.3.6 과 같은 설정 객체 · MiniMax 는 「목소리를 만든 모델」보다 먼저', () => {
        reset();
        const s = settings();
        const el = PR.getProvider('elevenlabs'), mm = PR.getProvider('minimax');
        s.providers.elevenlabs = { ...s.providers.elevenlabs, model: 'eleven_v4' };
        const plain = toVoice({ voiceId: 'el_seraph', name: '세라프' }, 'elevenlabs');
        const v2 = toVoice({ voiceId: 'el_seraph', name: '세라프', use_model: 'eleven_multilingual_v2' }, 'elevenlabs');
        const cfg = P.voiceCfg(el, plain);
        assert.equal(cfg, s.providers.elevenlabs, '정하지 않은 목소리는 엔진 설정 객체 그대로');
        assert.equal(P.voiceCfg(el, v2).model, 'eleven_multilingual_v2');
        assert.equal(s.providers.elevenlabs.model, 'eleven_v4', '엔진 설정은 안 바뀜');
        const job = (voice, provider) => ({ provider, voice, params: {}, lang: 'ja', emotion: '', text: 'こんにちは' });
        assert.notEqual(P.keyOf(job(plain, el)), P.keyOf(job(v2, el)), '다른 모델 → 다른 소리 (캐시 키)');
        assert.equal(P.keyOf(job(plain, el)), P.keyOf(job(toVoice({ voiceId: 'el_seraph', name: '세라프' }, 'elevenlabs'), el)));
        s.providers.minimax = { ...s.providers.minimax, model: 'speech-2.8-turbo', model_from: 'voice' };
        const made = toVoice({ voiceId: 'cj_x', model: 'speech-2.8-hd' }, 'minimax');
        assert.equal(mm.modelFor(made, P.voiceCfg(mm, made)), 'speech-2.8-hd', '1.3.6 그대로: 만든 모델');
        const pick = toVoice({ voiceId: 'cj_x', model: 'speech-2.8-hd', use_model: 'speech-2.6-turbo' }, 'minimax');
        assert.equal(mm.modelFor(pick, P.voiceCfg(mm, pick)), 'speech-2.6-turbo', '목소리에 고른 모델이 먼저');
        assert.equal(mm.modelFor(pick, s.providers.minimax), 'speech-2.6-turbo', '엔진 설정을 그대로 넘겨도');
        const gt = PR.getProvider('gtranslate');
        if (gt) assert.equal(P.voiceCfg(gt, toVoice({ voiceId: 'ko', use_model: 'x1' }, 'gtranslate')).model, undefined, '모델 칸이 없는 엔진은 무시');
    });
}

if (A) {
    const base = {
        lines: [{ i: 0, h: 'a', text: 'いらっしゃいませ。', speaker: '천지합동청', ask: false }, { i: 1, h: 'b', text: 'コーヒーを。', speaker: '카페 사장', ask: false }],
        needs: {}, context: 'narration', display: '', emotion: true, charName: '천지합동청', userName: 'Dreamju', speakers: [],
    };
    await test('composePrompt: 엑스트라를 켜도 (?) 줄 · 목소리 없는 화자가 없으면 1.3.6 과 글자까지 같다 (저장된 분석이 그대로)', () => {
        const off = A.composePrompt({ ...base });
        const on = A.composePrompt({ ...base, extras: true, unvoiced: [] });
        assert.equal(on.user, off.user);
        assert.equal(on.system, off.system);
    });
    await test('composePrompt: 목소리 없는 화자 → 「Speakers without a voice yet」 + people 과제 · (?) 줄 → 단역 이름도 받음', () => {
        const on = A.composePrompt({ ...base, extras: true, unvoiced: ['카페 사장'] });
        assert.match(on.user, /Speakers without a voice yet: 카페 사장/);
        assert.match(on.user, /"people"/);
        assert.match(on.user, /"people":\{"카페 사장":"f adult"\}/);
        const ask = A.composePrompt({ ...base, lines: [{ ...base.lines[1], speaker: '', ask: true }], speakers: ['Seraph'], extras: true, unvoiced: [] });
        assert.match(ask.user, /minor character/);
        assert.match(ask.user, /"people"/);
        const ask136 = A.composePrompt({ ...base, lines: [{ ...base.lines[1], speaker: '', ask: true }], speakers: ['Seraph'] });
        assert.match(ask136.user, /exactly one name from the known speakers/);
        assert.doesNotMatch(ask136.user, /people|minor/);
    });
    await test('composePrompt: 목소리 없는 화자라도 물을 줄에 없으면 안 적음', () => {
        const on = A.composePrompt({ ...base, extras: true, unvoiced: ['딴 사람'] });
        assert.doesNotMatch(on.user, /Speakers without a voice yet/);
    });
    await test('analyzeMessage → 단역 이름 · people 저장 → 엑스트라 표 → 그 줄을 엑스트라 목소리로 (1.3.6 분석은 그대로 씀)', async () => {
        reset();
        V.storeStock('minimax', MM_STOCK);
        const s = settings();
        s.analysis = { ...s.analysis, enabled: true, engine: 'compat', base: 'http://analysis.test/v1', key: 'k-test', model: 'm-test', emotion: true, translate: false, speaker: true, when: 'auto' };
        T.ctx.chat.length = 0;
        T.ctx.chat.push({ name: '천지합동청', is_user: false, mes: '카페 사장이 컵을 내려놓았다. "어서 오세요. 늘 드시던 걸로?"', extra: {} });
        let sent = null;
        const realFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
            sent = JSON.parse(init.body);
            const content = JSON.stringify({ segs: [{ i: 0, emotion: 'calm', speaker: '카페 사장' }], people: { '카페 사장': 'm adult', '모르는 이름': 'f young' } });
            return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
        };
        try {
            const a = await A.analyzeMessage(0, {});
            assert.ok(a, '분석 결과');
            const user = sent.messages[1].content;
            assert.match(user, /\[0\] \(\?\)/, '화자를 모르는 줄은 (?)');
            assert.match(user, /minor character/);
            assert.equal(a.segs[0].speaker, '카페 사장', '아는 이름 밖의 단역도 저장');
            assert.deepEqual(Object.keys(a.people), ['카페 사장'], '묻지 않은 이름은 버림');
            assert.equal(a.people['카페 사장'].g, 'm');
            assert.equal(a.people['카페 사장'].a, 'a');
            assert.ok(s.extra_map['카페 사장'], '엑스트라 표에 적힘');
            assert.ok(['minimax:Japanese_GentleButler', 'minimax:Japanese_LoyalKnight'].includes(uid(V.voiceFor('카페 사장'))));
            assert.equal(A.getAnalysis(0), a, '저장된 분석을 그대로 씀 (다시 안 물음)');
            // 1.3.6 판이 저장한 분석(엑스트라 문구 없는 프롬프트)도 그대로 — 업데이트 뒤 옛 메시지를 다시 묻지 않게
            const old = A.buildPrompt(T.ctx.chat[0], { langs: [], emotion: true, translate: false, speaker: true, extras: false });
            assert.doesNotMatch(old.user, /minor character|people/);
            A.clearAnalysis(0);
            s.extras = 'off';
            const b = await A.analyzeMessage(0, {});
            assert.ok(b && !b.people && !b.segs[0].speaker, '끄면 1.3.6 처럼 (아는 이름 밖은 안 받음 · people 없음)');
            s.extras = 'auto';
            assert.ok(A.getAnalysis(0), '엑스트라를 켠 뒤에도 끈 때(=1.3.6) 저장한 분석을 씀');
        } finally { globalThis.fetch = realFetch; }
    });
}

// ---------- 1.3.8 기본 길은 1.3.7 과 같은 요청 · 같은 캐시 키 (말투를 안 고르고 · 감정 세기 보통 · MiniMax 는 세기 모두)
//   GOLDEN_137 = 공개 1.3.7 (테마 5.7.1, git ea3f441) 의 player.lineJobs → 캐시 키 · 엔진 요청 본문 (MiniMax · ElevenLabs).
//   목소리: MiniMax(speech-2.8-hd · 공식 서버) · ElevenLabs(eleven_v4) · ElevenLabs(목소리 모델 다국어 v2) · OpenAI · Typecast · Cartesia ·
//   Gemini · Azure · OpenRouter · OpenAI 호환 · 브라우저 내장 · Google 번역 · 내 메시지(「나」 = ElevenLabs) — 11개 엔진 모두
const GOLDEN_137 = {
    "normal|Mina|plain": ["1fu7rlof75w", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"안녕하세요.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "normal|Mina|angry": ["210z0r5d5h4", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"화났어!\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"angry\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "normal|Mina|excited": ["1s00co5vfji", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"좋아!\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"happy\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "normal|Mina|whisper": ["1ewg4wehwl6", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.6-hd\",\"text\":\"쉿.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"whisper\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "normal|Mina|crying": ["5v3kfynp5t", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"흑흑.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"sad\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "normal|Ella|plain": ["1lz8qs92l2d", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"안녕하세요.\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "normal|Ella|angry": ["xx6s6ybg88", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"[angry] 화났어!\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "normal|Ella|excited": ["2myztyx6ft", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"[happy] 좋아!\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "normal|Ella|whisper": ["5bw7ix9i26", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"[whispers] 쉿.\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "normal|Ella|crying": ["1d77g6y1scc", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"[sad] 흑흑.\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "normal|Elma|plain": ["d5vur0zwaw", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_b\",\"body\":{\"text\":\"안녕하세요.\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1}}}"],
    "normal|Elma|angry": ["ffht12dsg", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_b\",\"body\":{\"text\":\"화났어!\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1}}}"],
    "normal|Elma|excited": ["241y5q34jn6", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_b\",\"body\":{\"text\":\"좋아!\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1}}}"],
    "normal|Elma|whisper": ["1gho5db393e", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_b\",\"body\":{\"text\":\"쉿.\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1}}}"],
    "normal|Elma|crying": ["2eer04nzzpm", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_b\",\"body\":{\"text\":\"흑흑.\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1}}}"],
    "normal|Ally|plain": ["bpolq6kdh3", null],
    "normal|Ally|angry": ["1nr4ndvrm99", null],
    "normal|Tia|plain": ["1qndhuzyr2r", null],
    "normal|Tia|angry": ["dywjgq5umv", null],
    "normal|Cara|plain": ["bk1kz2pbxk", null],
    "normal|Cara|angry": ["13ps0dr84aj", null],
    "normal|Gina|plain": ["2fn4rsch56m", null],
    "normal|Gina|angry": ["1475fops15r", null],
    "normal|Azu|plain": ["1c6we51yaip", null],
    "normal|Azu|angry": ["dt4kb8bgr2", null],
    "normal|Rory|plain": ["20l2kfd9znv", null],
    "normal|Rory|angry": ["1gdsv04c20z", null],
    "normal|Kiko|plain": ["235fn1t8urb", null],
    "normal|Kiko|angry": ["1ohrpmwtk2n", null],
    "normal|Bree|plain": ["280va4ggchy", null],
    "normal|Bree|angry": ["1o8f88dqqwq", null],
    "normal|Gogo|plain": ["8kq0k56mhg", null],
    "normal|Gogo|angry": ["2ar7kyjx4ke", null],
    "normal|User|plain": ["1lz8qs92l2d", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"안녕하세요.\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "normal|User|angry": ["xx6s6ybg88", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"[angry] 화났어!\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "weak|Mina|plain": ["1fu7rlof75w", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"안녕하세요.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "weak|Mina|angry": ["12cs8jlwwu0", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"화났어!\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "weak|Mina|excited": ["xl379u0vhb", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"좋아!\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "weak|Mina|whisper": ["1ewg4wehwl6", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.6-hd\",\"text\":\"쉿.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"whisper\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "weak|Mina|crying": ["1dwbjpei9op", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"흑흑.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "weak|Ally|plain": ["bpolq6kdh3", null],
    "weak|Ally|angry": ["104c2og95vb", null],
    "weak|Tia|plain": ["1qndhuzyr2r", null],
    "weak|Tia|angry": ["2c6ybtm6s5z", null],
    "weak|Cara|plain": ["bk1kz2pbxk", null],
    "weak|Cara|angry": ["1la4l4lhcx0", null],
    "weak|Gina|plain": ["2fn4rsch56m", null],
    "weak|Gina|angry": ["tvobp02p4p", null],
    "weak|Azu|plain": ["1c6we51yaip", null],
    "weak|Azu|angry": ["dkahr4ez0d", null],
    "weak|Rory|plain": ["20l2kfd9znv", null],
    "weak|Rory|angry": ["1nunyqm89ep", null],
    "weak|Kiko|plain": ["235fn1t8urb", null],
    "weak|Kiko|angry": ["28ixj4vm95k", null],
    "weak|Bree|plain": ["280va4ggchy", null],
    "weak|Bree|angry": ["11bhirey7sn", null],
    "weak|Gogo|plain": ["8kq0k56mhg", null],
    "weak|Gogo|angry": ["19xp3dlkemk", null],
    "strong|Mina|plain": ["1fu7rlof75w", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"안녕하세요.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "strong|Mina|angry": ["30xxke36p7", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"(breath)화났어!\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"angry\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "strong|Mina|excited": ["zyqw9qutmg", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"(laughs)좋아!\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"happy\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "strong|Mina|whisper": ["1ewg4wehwl6", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.6-hd\",\"text\":\"쉿.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"whisper\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "strong|Mina|crying": ["27m9fxa5p6e", "{\"url\":\"https://api.minimax.io/v1/t2a_v2\",\"body\":{\"model\":\"speech-2.8-hd\",\"text\":\"(sighs)흑흑.\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"mm_a\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"sad\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Korean\"}}"],
    "strong|Ella|plain": ["1lz8qs92l2d", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"안녕하세요.\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
    "strong|Elma|plain": ["d5vur0zwaw", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_b\",\"body\":{\"text\":\"안녕하세요.\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1}}}"],
    "strong|Ally|plain": ["bpolq6kdh3", null],
    "strong|Ally|angry": ["1nr4ndvrm99", null],
    "strong|Tia|plain": ["1qndhuzyr2r", null],
    "strong|Tia|angry": ["dywjgq5umv", null],
    "strong|Cara|plain": ["bk1kz2pbxk", null],
    "strong|Cara|angry": ["13ps0dr84aj", null],
    "strong|Gina|plain": ["2fn4rsch56m", null],
    "strong|Gina|angry": ["1475fops15r", null],
    "strong|Azu|plain": ["1c6we51yaip", null],
    "strong|Azu|angry": ["dt4kb8bgr2", null],
    "strong|Rory|plain": ["20l2kfd9znv", null],
    "strong|Rory|angry": ["1gdsv04c20z", null],
    "strong|Kiko|plain": ["235fn1t8urb", null],
    "strong|Kiko|angry": ["1ohrpmwtk2n", null],
    "strong|Bree|plain": ["280va4ggchy", null],
    "strong|Bree|angry": ["1o8f88dqqwq", null],
    "strong|Gogo|plain": ["8kq0k56mhg", null],
    "strong|Gogo|angry": ["2ar7kyjx4ke", null],
    "strong|User|plain": ["1lz8qs92l2d", "{\"url\":\"https://api.elevenlabs.io/v1/text-to-speech/el_a\",\"body\":{\"text\":\"안녕하세요.\",\"model_id\":\"eleven_v4\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ko\"}}"],
};
let TX = null;
try { TX = await import(pathToFileURL(path.join(root, 'text.js')).href); } catch { TX = null; }
const gv = (provider, voiceId, name, extra = {}) => ({ uid: `${provider}:${voiceId}`, provider, voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [], ...extra });
function goldenReset(strength) {
    const s = settings();
    s.voices = [gv('minimax', 'mm_a', 'Mina'), gv('elevenlabs', 'el_a', 'Ella'), gv('elevenlabs', 'el_b', 'Elma', { use_model: 'eleven_multilingual_v2' }), gv('openai', 'alloy', 'Ally'), gv('typecast', 'tc_a', 'Tia'), gv('cartesia', 'ca_a', 'Cara'), gv('gemini', 'Kore', 'Gina'), gv('azure', 'ko-KR-SunHiNeural', 'Azu'), gv('openrouter', 'alloy', 'Rory'), gv('openai_compat', 'af_bella', 'Kiko'), gv('browser', 'Google 한국의', 'Bree'), gv('gtranslate', 'ko', 'Gogo')];
    s.char_map = { Mina: 'minimax:mm_a', Ella: 'elevenlabs:el_a', Elma: 'elevenlabs:el_b', Ally: 'openai:alloy', Tia: 'typecast:tc_a', Cara: 'cartesia:ca_a', Gina: 'gemini:Kore', Azu: 'azure:ko-KR-SunHiNeural', Rory: 'openrouter:alloy', Kiko: 'openai_compat:af_bella', Bree: 'browser:Google 한국의', Gogo: 'gtranslate:ko' };
    s.default_voice = 'minimax:mm_a';
    s.user_voice = 'elevenlabs:el_a';
    s.narrator_voice = '';
    s.prefer_provider = '';
    s.emotion_strength = strength;
    s.pregen = 'dialogue';
    s.extras = 'auto';
    s.extra_map = {};
    s.analysis = { ...s.analysis, enabled: false };
    s.providers = {
        minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' },
        elevenlabs: { key: 'el-test', model: 'eleven_v4' },
        openai: { key: 'oa-test' }, typecast: { key: 'tc-test' }, cartesia: { key: 'ca-test' }, gemini: { key: 'ge-test' }, azure: { key: 'az-test', region: 'koreacentral' }, openrouter: { key: 'or-test' },
    };
    s.mini_player = false;
}
const G_LINES = { plain: '"안녕하세요."', angry: '<angry>"화났어!"</angry>', excited: '<excited>"좋아!"</excited>', whisper: '<whispering>"쉿."</whispering>', crying: '<crying>"흑흑."</crying>' };
/** 한 줄 → { job, body } (lineJobs = 대사를 눌렀을 때 · 미리 만들기와 같은 길) */
async function lineOf(speaker, text) {
    const mes = speaker === 'User' ? { name: 'User', is_user: true, mes: text, extra: {}, swipe_id: 0 } : { name: speaker, is_user: false, mes: text, extra: {}, swipe_id: 0 };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    T.ctx.name1 = 'User'; T.ctx.name2 = mes.name;
    const segs = TX.segmentMessage(text, { userName: 'User', charName: mes.name, knownNames: [], routes: settings().routes, final: true, skipTags: new Set(), stripRegex: [] }).filter(x => x.kind === 'dialogue' && x.text);
    const job = P.lineJobs(0, mes, segs).jobs[0];
    let body = null;
    if (job && ['minimax', 'elevenlabs'].includes(job.provider.id)) {
        const real = globalThis.fetch;
        globalThis.fetch = async (u, init = {}) => {
            body = { url: String(u).replace(/\?.*$/, ''), body: init.body ? JSON.parse(init.body) : null };
            if (/t2a_v2/.test(u)) return new Response(JSON.stringify({ data: { audio: 'fff344c4' }, extra_info: { usage_characters: 3 }, base_resp: { status_code: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
            return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
        };
        try { await job.provider.synth({ text: job.text, voice: job.voice, cfg: P.voiceCfg(job.provider, job.voice), params: job.params, lang: job.lang, emotion: job.emotion, signal: new AbortController().signal }); }
        finally { globalThis.fetch = real; }
    }
    return { job, body };
}
if (P && PR && TX && typeof P.lineJobs === 'function') {
    await test('1.3.7 과 같은 요청 · 캐시 키: 말투 없음 · 감정 세기 보통 (11개 엔진 모두) · MiniMax 는 약하게 · 강하게도 — 84줄', async () => {
        const name1 = T.ctx.name1, name2 = T.ctx.name2;
        try {
            let n = 0;
            for (const [k, [key, body]] of Object.entries(GOLDEN_137)) {
                const [strength, speaker, ln] = k.split('|');
                goldenReset(strength);
                const r = await lineOf(speaker, G_LINES[ln]);
                assert.ok(r.job, `${k}: 작업`);
                assert.equal(r.job.key, key, `${k}: 캐시 키`);
                assert.equal(r.body ? JSON.stringify(r.body) : null, body, `${k}: 요청 본문`);
                n++;
            }
            assert.equal(n, 84);
        } finally { T.ctx.name1 = name1; T.ctx.name2 = name2; }
    });
}
const EL = PR && PR.getProvider('elevenlabs');
if (P && PR && TX && EL && typeof EL.strengthFor === 'function') {
    const name1 = T.ctx.name1, name2 = T.ctx.name2;
    const elBody = (r) => r.body && r.body.body;
    await test('ElevenLabs 감정 세기: 약하게 = 안정감 1 · 감정 태그 없음 (속삭임은 남김) · v3·v4 는 느낌표 순하게 + 덤덤하게 (1.4.0) · 강하게 = 감정 줄만 안정감 −0.3 · 보통은 1.3.7 그대로', async () => {
        goldenReset('weak');
        let r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).voice_settings.stability, 1);
        assert.equal(elBody(r).text, '[flatly] 화났어.', '감정 태그 없음 · 1.4.0 느낌표 순하게 + 말투 없는 목소리엔 덤덤하게');
        assert.equal(r.job.params.emotion_strength, 'weak');
        r = await lineOf('Ella', G_LINES.whisper);
        assert.equal(elBody(r).text, '[whispers] 쉿.', '속삭임은 약하게여도 남김 (MiniMax 와 같은 규칙)');
        goldenReset('strong');
        r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).voice_settings.stability, 0.2);
        assert.equal(elBody(r).text, '[angry] 화났어!');
        assert.equal(r.job.params.emotion_strength, 'strong');
        r = await lineOf('Ella', G_LINES.plain);
        assert.equal(r.job.params.emotion_strength, undefined, '감정 없는 줄은 보통과 같은 요청 · 키');
        assert.equal(r.job.key, GOLDEN_137['normal|Ella|plain'][0]);
        settings().providers.elevenlabs.stability = 0;
        r = await lineOf('Ella', G_LINES.angry);
        assert.equal(r.job.params.emotion_strength, undefined, '이미 0 이면 바뀌는 게 없음 → 표시도 키도 보통과 같게');
        goldenReset('weak');
        settings().providers.elevenlabs.stability = 1;
        r = await lineOf('Ella', G_LINES.plain);
        assert.equal(r.job.params.emotion_strength, 'weak', '1.4.0 v4 는 이미 1 이어도 약하게 (글이 바뀜 — 덤덤하게)');
        assert.equal(elBody(r).text, '[flatly] 안녕하세요.');
        r = await lineOf('Elma', G_LINES.angry);
        assert.equal(r.job.params.emotion_strength, undefined, '태그 없는 모델(multilingual v2)은 예전처럼 — 이미 1 이면 같은 요청 · 키');
        assert.equal(elBody(r).text, '화났어!', 'v2 는 글을 안 건드림 (태그를 소리 내 읽는 모델)');
        T.ctx.name1 = name1; T.ctx.name2 = name2;
    });
    await test('ElevenLabs 감정 세기: v3 는 0 · 0.5 · 1 로 맞춘 뒤 같으면 표시 없음 · MiniMax 는 1.3.7 규칙 그대로 (strengthFor 없음)', () => {
        assert.equal(EL.strengthFor('strong', { params: { stability: 0.5 }, emotion: 'angry', cfg: { model: 'eleven_v3' } }), 'strong', '0.5 → 0.2 → v3 0');
        assert.equal(EL.strengthFor('strong', { params: { stability: 0.1 }, emotion: 'angry', cfg: { model: 'eleven_v3' } }), '', '0.1 → 0 · 둘 다 v3 0');
        assert.equal(EL.strengthFor('weak', { params: { stability: 0.9 }, emotion: '', cfg: { model: 'eleven_v3' } }), 'weak', '1.4.0 v3 · v4 는 약하게면 글이 바뀌어 늘 표시');
        assert.equal(EL.strengthFor('weak', { params: { stability: 1 }, emotion: '', cfg: { model: 'eleven_multilingual_v2' } }), '', 'v2: 이미 1 = 같은 요청');
        assert.equal(EL.strengthFor('weak', { params: { stability: 0.5 }, emotion: '', cfg: { model: 'eleven_multilingual_v2' } }), 'weak');
        assert.equal(EL.strengthFor('weak', { params: { stability: 0.9 }, emotion: '', cfg: { model: 'eleven_v4' } }), 'weak');
        assert.equal(EL.strengthFor('normal', { params: { stability: 0.5 }, emotion: 'angry', cfg: {} }), '');
        assert.equal(typeof PR.getProvider('minimax').strengthFor, 'undefined');
    });
    await test('1.4.0 계정 맞춤이 ElevenLabs 계정의 이름 바꿈을 따름 → 「엔진」 짝이 같은 이름의 새 목소리로 · 직접 바꾼 이름 · MiniMax 는 그대로', async () => {
        goldenReset('normal');
        const s = settings();
        V.upsertVoices([{ voiceId: 'mm_ella', name: 'Ella' }], 'minimax');
        const mmElla = s.voices.find(v => v.provider === 'minimax' && v.voiceId === 'mm_ella');
        assert.equal(V.twinOf(mmElla, 'elevenlabs')?.voiceId, 'el_a', '처음엔 예전 Ella');
        V.findVoice('elevenlabs:el_b').name = 'Elma (내 이름)';
        V.findVoice('elevenlabs:el_b').name_custom = true;
        const r = V.syncAccount('elevenlabs', [
            { voiceId: 'el_a', name: 'Ella (예전)', own: true },
            { voiceId: 'el_b', name: 'Elma', own: true },
            { voiceId: 'el_new', name: 'Ella', own: true },
        ]);
        assert.equal(r.renamed, 1, '이름이 바뀐 내 목소리 하나');
        assert.equal(V.findVoice('elevenlabs:el_a').name, 'Ella (예전)');
        assert.equal(V.findVoice('elevenlabs:el_b').name, 'Elma (내 이름)', '이 목록에서 직접 바꾼 이름은 그대로');
        assert.ok(s.voices.some(v => v.provider === 'elevenlabs' && v.voiceId === 'el_new' && v.name === 'Ella'), '새 목소리는 계정 맞춤이 넣음');
        assert.equal(V.twinOf(mmElla, 'elevenlabs')?.voiceId, 'el_new', '같은 이름(3점)이 「Ella (예전)」(2점)보다 앞');
        const before = V.findVoice('minimax:mm_a').name;
        const m = V.syncAccount('minimax', [{ voiceId: 'mm_a', name: 'something else', own: true }, { voiceId: 'mm_ella', name: 'x', own: true }]);
        assert.equal(m.renamed, 0, 'MiniMax 는 계정 이름을 따르지 않음 (이름이 목소리 id 거나 다를 수 있음)');
        assert.equal(V.findVoice('minimax:mm_a').name, before);
    });
    await test('1.4.0 목소리마다 감정 세기: 전체는 약하게여도 이 목소리만 보통 · 강하게 · 지우면 다시 전체 · 저장 정리에도 남음', async () => {
        goldenReset('weak');
        V.findVoice('elevenlabs:el_a').strength = 'normal';
        let r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).text, '[angry] 화났어!', '보통: 감정 태그 · 원문 그대로');
        assert.equal(r.job.params.emotion_strength, undefined, '보통이면 1.3.9 와 같은 요청 · 키');
        V.findVoice('elevenlabs:el_a').strength = 'strong';
        r = await lineOf('Ella', G_LINES.angry);
        assert.equal(r.job.params.emotion_strength, 'strong');
        assert.equal(elBody(r).voice_settings.stability, 0.2);
        delete V.findVoice('elevenlabs:el_a').strength;
        r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).text, '[flatly] 화났어.', '없으면 전체 설정(약하게)');
        assert.equal(toVoice({ voiceId: 'x', name: 'x', strength: 'normal' }, 'elevenlabs').strength, 'normal');
        assert.equal(toVoice({ voiceId: 'x', name: 'x', strength: 'loud' }, 'elevenlabs').strength, undefined, '모르는 값은 버림');
    });
    await test('1.4.0 ElevenLabs 약하게 = 글 순하게 (calmText) · 고른 말투가 있으면 그 말투만 · 속삭임 줄엔 덤덤하게 안 붙임', async () => {
        const EP = await import(pathToFileURL(path.join(root, 'providers/elevenlabs.js')).href);
        assert.equal(EP.calmText('「ちょっと待ってください！この書類、昨日も出しましたよね！？」'), '「ちょっと待ってください。この書類、昨日も出しましたよね？」');
        assert.equal(EP.calmText('えっ？ね～♪ すごーーい!!'), 'え？ね すごーい.');
        assert.equal(EP.calmText('……はぁ。もういいです。'), '……はぁ。もういいです。', '말줄임표 · 평범한 글은 그대로');
        assert.equal(EP.calmText('What?! No!'), 'What? No.');
        assert.ok(EP.VOICE_TAGS.some(t => t.value === 'flatly' && t.label === '덤덤하게'));
        goldenReset('weak');
        V.findVoice('elevenlabs:el_a').params = { voice_tags: ['tired'] };
        let r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).text, '[tired] 화났어.', '고른 말투가 있으면 덤덤하게를 더하지 않음');
        V.findVoice('elevenlabs:el_a').params = {};
        r = await lineOf('Ella', G_LINES.whisper);
        assert.equal(elBody(r).text, '[whispers] 쉿.', '속삭임 줄은 그대로');
        goldenReset('normal');
        r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).text, '[angry] 화났어!', '보통은 1.3.9 그대로');
    });
    await test('ElevenLabs 말투 (목소리마다 · 엔진 기본): v3 · v4 에서만 줄 맨 앞 (감정 태그 앞 · 같은 태그는 한 번) · 다른 모델은 요청 · 캐시 키가 말투 없음과 같음 · 빈 목록 = 없음', async () => {
        goldenReset('normal');
        const s = settings();
        V.findVoice('elevenlabs:el_a').params = { voice_tags: ['tired', 'whispers'] };
        let r = await lineOf('Ella', G_LINES.angry);
        assert.equal(elBody(r).text, '[tired] [whispers] [angry] 화났어!');
        assert.notEqual(r.job.key, GOLDEN_137['normal|Ella|angry'][0], '말투가 바뀌면 다른 소리');
        r = await lineOf('Ella', G_LINES.whisper);
        assert.equal(elBody(r).text, '[tired] [whispers] 쉿.', '감정 태그와 같은 말투는 한 번');
        V.findVoice('elevenlabs:el_b').params = { voice_tags: ['tired'] };
        r = await lineOf('Elma', G_LINES.angry);
        assert.equal(elBody(r).text, '화났어!', '다국어 v2 는 태그를 안 받음');
        assert.equal(r.job.params.voice_tags, undefined, '요청에 안 들어가는 값은 캐시 키에도 안 넣음');
        assert.equal(r.job.key, GOLDEN_137['normal|Elma|angry'][0]);
        V.findVoice('elevenlabs:el_a').params = { voice_tags: [] };
        r = await lineOf('Ella', G_LINES.angry);
        assert.equal(r.job.key, GOLDEN_137['normal|Ella|angry'][0], '빈 목록 = 말투 없음');
        s.providers.elevenlabs.voice_tags = ['distant'];
        V.findVoice('elevenlabs:el_a').params = {};
        r = await lineOf('Ella', G_LINES.plain);
        assert.equal(elBody(r).text, '[distant] 안녕하세요.', '엔진 기본 말투');
        V.findVoice('elevenlabs:el_a').params = { voice_tags: [] };
        r = await lineOf('Ella', G_LINES.plain);
        assert.equal(elBody(r).text, '안녕하세요.', '목소리에서 기본값을 끄고 다 비우면 이 목소리만 말투 없음');
        V.findVoice('elevenlabs:el_a').params = { voice_tags: ['nope', 'tired', 'tired'] };
        r = await lineOf('Ella', G_LINES.plain);
        assert.equal(elBody(r).text, '[tired] 안녕하세요.', '모르는 태그는 버림');
        T.ctx.name1 = name1; T.ctx.name2 = name2;
    });
    await test('말투 태그 목록: 공식 안내의 태그만 · 한국어 이름 · 목록 줄의 이름표 (tagLabels)', async () => {
        const mod = await import(pathToFileURL(path.join(root, 'providers/elevenlabs.js')).href);
        const vals = mod.VOICE_TAGS.map(t => t.value);
        assert.deepEqual(vals, ['tired', 'bored', 'distant', 'flatly', 'peaceful', 'softly', 'quietly', 'whispers', 'playful', 'sarcastic', 'hesitant', 'thoughtful', 'excited', 'nervous']);
        assert.ok(mod.VOICE_TAGS.every(t => /^[가-힣 ]+$/.test(t.label)), '이름은 한국어만');
        assert.deepEqual(EL.tagLabels(['tired', 'distant']), ['피곤하게', '무심하게']);
        const f = EL.params.find(x => x.key === 'voice_tags');
        assert.ok(f && f.type === 'tags' && f.default === undefined, '기본값 없음 (1.3.7 설정 · 키 그대로)');
        assert.equal(f.show({ model: 'eleven_v4' }), true);
        assert.equal(f.show({ model: 'eleven_multilingual_v2' }), false);
    });
}
if (PR) {
    await test("'?' 도움말: 엔진 항목에 한국어 도움말 (61 + 말투) · ElevenLabs 긴 설명은 ? 뒤로 (안정감 설명만 1.3.7 그대로)", () => {
        let n = 0;
        for (const p of PR.listProviders()) for (const f of [...(p.fields || []), ...(p.params || [])]) {
            if (!f.help) continue;
            n++;
            assert.equal(typeof f.help, 'string');
            assert.ok(/[가-힣]/.test(f.help), `${p.id}.${f.key} 한국어`);
            if (f.key !== 'model_custom' && !(p.id === 'openai_compat' && f.key === 'model')) assert.doesNotMatch(f.help, /eleven_|speech-\d|sonic-|ssfm-|gpt-4o|tts-1|google\//, `${p.id}.${f.key}: 직접 적는 칸이 아니면 모델 id 대신 한국어 이름`);
        }
        if (n === 0) return;   // 1.3.7 (도움말 없음)
        assert.equal(n, 62);
        const el = PR.getProvider('elevenlabs');
        const desc = (k) => el.params.find(x => x.key === k)?.desc;
        assert.equal(desc('stability'), 'v3는 0 · 0.5 · 1 중 가까운 값으로 보내요');
        assert.equal(desc('similarity_boost'), undefined);
        assert.equal(desc('style'), undefined);
        assert.equal(desc('use_speaker_boost'), undefined);
    });
}
if (A && typeof V.userAuto === 'function') {
    await test('「나」 자동: 페르소나도 목소리 없는 화자로 묻는다 (people) · 자동이 아니면 1.3.7 과 같은 프롬프트', async () => {
        reset();
        const s = settings();
        s.analysis = { ...s.analysis, enabled: true, engine: 'compat', base: 'http://analysis.test/v1', key: 'k-test', model: 'm-test', emotion: true, translate: false, speaker: true, when: 'auto' };
        T.ctx.chat.length = 0;
        T.ctx.chat.push({ name: '천지합동청', is_user: false, mes: 'Dreamju: "좋아."', extra: {} });
        const mes = T.ctx.chat[0];
        const opts = { langs: [], emotion: true, translate: false, speaker: true, extras: true };
        const before = A.buildPrompt(mes, opts);
        s.user_voice = '@auto';
        const auto = A.buildPrompt(mes, opts);
        // 1.3.8 리뷰(rig): 「내 대사」 = 읽지 않음이면 AI 답장 속 내 대사를 안 읽으니 자동이어도 페르소나를 묻지 않음 (프롬프트 · 저장된 분석이 안 바뀜)
        const routes0 = s.routes;
        s.routes = { ...routes0, user_dialogue: 'skip' };
        const skip = A.buildPrompt(mes, opts);
        s.routes = routes0;
        assert.equal(skip.user, before.user, '내 대사를 안 읽으면 1.3.7 과 같은 프롬프트');
        s.user_voice = '';
        const after = A.buildPrompt(mes, opts);
        assert.equal(after.user, before.user, '(없음)이면 그대로');
        if (before.lines.some(l => l.speaker === 'Dreamju')) {
            assert.doesNotMatch(before.user, /Speakers without a voice yet: .*Dreamju/);
            assert.match(auto.user, /Speakers without a voice yet: Dreamju/);
            assert.match(auto.user, /"people"/);
        }
        s.user_voice = '@auto';
        await V.noteExtras({ Dreamju: { g: 'f', a: 'a' } });
        assert.ok(s.extra_map.Dreamju, '페르소나도 엑스트라 표에');
        s.user_voice = '';
    });
}

// 1.4.0 사용자 제보 (10-08): 두 사람이 같은 대사(「다릅니다.」)를 하면 아래 줄을 눌러도 위 캐릭터 목소리로 — 같은 글이면 늘 첫째 조각을 골랐다
let CP = null;
try { CP = await import(pathToFileURL(path.join(root, 'clickplay.js')).href); } catch (e) { console.log('  (clickplay.js 를 못 불러와 같은 대사 시험은 건너뜀:', String(e && e.message || e).slice(0, 80), ')'); }
if (CP && TX) {
    await test('같은 대사를 두 사람이: 누른 번째의 조각 (탭 sameIndex) · 미리 만들기도 같은 번째 · 하나뿐이면 예전 그대로', async () => {
        goldenReset('normal');
        const text = '사탄은 고개를 들었다.\n\n<font color="#d03030">「다릅니다.」</font>\n\n<font color="#9370db">「다릅니다.」</font>\n\n<font color="#3a8a9a">「그게 그거잖아.」</font>';
        const mes = { name: '천지합동청', is_user: false, mes: text, extra: {}, swipe_id: 0 };
        T.ctx.chat.length = 0; T.ctx.chat.push(mes);
        const segs = CP.tapSegments(mes);
        const dl = segs.filter(x => x.kind === 'dialogue');
        assert.equal(dl.length, 3);
        const col = (x) => String(x.color || '').toLowerCase();
        assert.ok(col(dl[0]) && col(dl[1]) && col(dl[0]) !== col(dl[1]), `미리 만들기: 두 「다릅니다.」 가 서로 다른 색(사람) — ${col(dl[0])} / ${col(dl[1])}`);
        assert.equal(dl[0].dialogueIndex, 0);
        assert.equal(dl[1].dialogueIndex, 1, '둘째 「다릅니다.」 는 둘째 대화문');
        const first = CP.segmentForHit(mes, { kind: 'dialogue', text: '다릅니다.', raw: '다릅니다.', quoted: '「다릅니다.」', sameIndex: 0, line: 2 });
        const second = CP.segmentForHit(mes, { kind: 'dialogue', text: '다릅니다.', raw: '다릅니다.', quoted: '「다릅니다.」', sameIndex: 1, line: 4 });
        assert.equal(col(first), col(dl[0]));
        assert.equal(col(second), col(dl[1]), '아래 줄을 누르면 아래 사람');
        const only = CP.segmentForHit(mes, { kind: 'dialogue', text: '그게 그거잖아.', raw: '그게 그거잖아.', quoted: '「그게 그거잖아.」', line: 6 });
        assert.equal(only.dialogueIndex, 2, '같은 글이 하나뿐이면 sameIndex 없이도 예전처럼');
        const far = CP.segmentForHit(mes, { kind: 'dialogue', text: '다릅니다.', raw: '다릅니다.', quoted: '「다릅니다.」', sameIndex: 9, sameCount: 2, line: 4 });
        assert.ok(col(far), '번째가 넘치면 가까운 줄');
        // 검토(10-08): 조각만 맞고 재생기(clickedPair)가 다시 첫째를 골랐다 — 실제 재생 길(lineJobs)의 목소리까지 본다
        const SP = await import(pathToFileURL(path.join(root, 'speakers.js')).href);
        SP.setColor('#d03030', 'Ella'); SP.setColor('#9370db', 'Mina');
        const jobsOf = (seg) => P.lineJobs(0, mes, [seg]).jobs;
        assert.equal(jobsOf(first)[0].voice.provider, 'elevenlabs', '위 줄 = 위 사람(Ella)');
        assert.equal(jobsOf(second)[0].voice.provider, 'minimax', '아래 줄 = 아래 사람(Mina)');
        const pre = P.lineJobs(0, mes, CP.tapSegments(mes)).jobs.filter(j => /다릅니다/.test(j.text));
        assert.deepEqual(pre.map(j => j.voice.provider), ['elevenlabs', 'minimax'], '미리 만들기도 두 사람');
        assert.equal(pre[1].key, jobsOf(second)[0].key, '미리 만든 소리 = 누른 소리 (캐시 키 같음)');
        // 화면에 같은 대사가 더 있어도(속마음이 따라 적음) 색으로 고름
        const third = CP.segmentForHit(mes, { kind: 'dialogue', text: '다릅니다.', raw: '다릅니다.', quoted: '「다릅니다.」', color: '#9370db', sameIndex: 1, sameCount: 3, line: 4 });
        assert.equal(col(third), col(dl[1]));
    });
}

console.log(`\nTTS 엑스트라 · 목소리별 모델: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
