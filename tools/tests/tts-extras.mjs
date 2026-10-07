// TTS 1.3.7 엑스트라 목소리 · 목소리마다 모델 — src/addons/tts/src/voices.js (genderOf · storeStock · noteExtras · extraFor · voiceFor)
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

console.log(`\nTTS 엑스트라 · 목소리별 모델: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
