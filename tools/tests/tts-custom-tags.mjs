// ElevenLabs 직접 태그: 합성 HTTP·저장·캐시·미리듣기·공통 편집칸 계약을 확인해요. 실제 네트워크는 없어요.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const mod = (name) => pathToFileURL(path.join(root, name)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

// ---------- 공유 상태 · 스텁
const T = globalThis.__elevenCustomTagsTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Char', characters: [], groups: [] } };
const G = 'const T = globalThis.__elevenCustomTagsTest;\n';
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
        if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

// localStorage (Map) — 막힌 저장소도 흉내 낼 수 있게
const LS = new Map();
let lsBroken = false;
globalThis.localStorage = {
    getItem: (k) => { if (lsBroken) throw new Error('denied'); return LS.has(k) ? LS.get(k) : null; },
    setItem: (k, v) => { if (lsBroken) throw new Error('denied'); LS.set(k, String(v)); },
    removeItem: (k) => { LS.delete(k); },
};

// fetch: route(c) 가 응답을 만든다 (없으면 실패 — 모르는 요청은 시험 실패)
const calls = [];
let route = null;
globalThis.fetch = async (url, init = {}) => {
    const c = { url: String(url), method: init.method || 'GET', headers: { ...(init.headers || {}) }, body: init.body };
    calls.push(c);
    if (!route) throw new Error(`시험 중 네트워크 요청: ${c.url}`);
    return route(c);
};
const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const AUDIO = () => new Response(new Uint8Array([0xff, 0xf3, 1, 2]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
const WAV_B64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
const SYNTH = (c) => {
    if (c.url.includes('/t2a_v2')) return J({ data: { audio: 'fff3' }, base_resp: { status_code: 0 }, extra_info: { usage_characters: 3 } });
    if (c.url.includes(':generateContent')) return J({ candidates: [{ content: { parts: [{ inlineData: { data: WAV_B64, mimeType: 'audio/wav' } }] } }] });
    return AUDIO();
};
const header = (c, name) => { const k = Object.keys(c.headers).find(h => h.toLowerCase() === name.toLowerCase()); return k ? c.headers[k] : undefined; };

T.ext.lemon_voice = { version: 8, enabled: true, providers: {}, voices: [], usage: { month: '', chars: 0, requests: 0, models: {} }, ui: { tab: 'engine', provider_tab: 'minimax' } };

const fs = await import('node:fs');
const vm = await import('node:vm');
const S = await import(mod('settings.js'));
const E = await import(mod('providers/elevenlabs.js'));
const P = await import(mod('player.js'));
const provider = E.default;
const field = provider.params.find(f => f.key === 'voice_tags_custom');
let passed = 0;
async function check(name, fn) { calls.length = 0; route = null; await fn(); passed++; console.log('통과 · ' + name); }
function reset(model = 'eleven_v4') {
    const s = S.settings(); s.providers = { elevenlabs: { key: 'fixture-key', model } };
    s.voices = []; s.emotion_strength = 'normal'; s.enabled = true;
    S.providerConfig(provider.id, provider.defaults); return s;
}
const voice = (params = {}, id = 'fixture-a') => S.toVoice({ voiceId: id, name: '시험 목소리', params }, 'elevenlabs');
function job(v, emotion = '') {
    const params = P._forTest.paramsFor(provider, v);
    const j = { provider, voice: v, params, lang: 'ko', emotion, text: '테스트 문장이에요.' };
    j.key = P.keyOf(j); return j;
}
async function request(j, fallback = false) {
    route = c => {
        if (fallback && c.url.includes('/with-timestamps')) return J({ detail: '지원하지 않아요' }, 422);
        if (c.url.includes('/with-timestamps')) return J({ audio_base64: 'AQID' });
        return AUDIO();
    };
    return provider.synth({ ...j, cfg: P.voiceCfg(provider, j.voice), signal: new AbortController().signal });
}
await check('쉼표·줄바꿈 직접 입력과 괄호 안 쉼표를 구분해요', () => {
    assert.deepEqual(E.customVoiceTagsOf('low, male\nsoftly'), ['[low]', '[male]', '[softly]']);
    assert.deepEqual(E.customVoiceTagsOf('[low, gravelly voice] [male]'), ['[low, gravelly voice]', '[male]']);
    assert.deepEqual(E.customVoiceTagsOf(' [Low] , [low] \n[male] '), ['[Low]', '[male]']);
    assert.equal(E.customVoiceTagText('  '), undefined);
});
await check('혼합·빈 괄호·닫히지 않은 괄호와 한도를 저장 전에 알려요', () => {
    for (const text of ['[low] 대사', 'low [male]', '[low', 'low]', '[]', '[[low]]', '[low\u0000]', 'a'.repeat(401), 'a'.repeat(81), 'a,b,c,d,e,f,g,h,i']) {
        assert.ok(/[가-힣]/u.test(field.validate(text)), text); assert.throws(() => E.customVoiceTagsOf(text));
    }
    assert.equal(field.validate('[low, gravelly voice]'), '');
});
await check('v3·v4는 선택 말투 뒤·감정 앞에 직접 태그를 붙이고 괄호 안 쉼표를 보존해요', async () => {
    for (const model of ['eleven_v3', 'eleven_v4']) {
        reset(model); calls.length = 0;
        const j = job(voice({ voice_tags: ['tired', 'whispers'], voice_tags_custom: '[low, gravelly voice] [whispers] [male]' }), 'whisper');
        await request(j); const body = JSON.parse(calls.at(-1).body);
        assert.equal(body.text, '[tired] [low, gravelly voice] [male] [whispers] 테스트 문장이에요.');
        assert.equal(body.model_id, model); assert.equal(body.instructions, undefined);
    }
    assert.equal(provider.caps.instructions, false);
});
await check('정상 합성과 시간표 없는 대체 요청에 같은 태그가 들어가요', async () => {
    reset(); await request(job(voice({ voice_tags_custom: 'low, male' })), true);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[0].body).text, JSON.parse(calls[1].body).text);
});
await check('잘못된 저장값도 HTTP 요청 전에 멈춰요', async () => {
    reset(); const v = voice({ voice_tags_custom: '[low] 잘못 섞인 대사' });
    assert.throws(() => job(v), /괄호/);
    await assert.rejects(() => provider.synth({ text: '원래 대사', voice: v, params: v.params, cfg: { key: 'fixture-key', model: 'eleven_v4' } }), /괄호/);
    assert.equal(calls.length, 0);
});
await check('지원 전 모델에서는 유효·무효 직접 입력 모두 전송·캐시에서 빠져요', async () => {
    reset('eleven_multilingual_v2'); const base = job(voice());
    for (const value of ['low, male', '[닫히지 않음']) {
        const j = job(voice({ voice_tags_custom: value }));
        assert.equal(j.key, base.key); assert.equal(j.params.voice_tags_custom, undefined);
        await request(j); assert.equal(JSON.parse(calls.at(-1).body).text, base.text);
    }
});
await check('빈값은 기존 캐시이고 같은 태그 표기는 같은 캐시, 다른 태그는 다른 캐시예요', () => {
    reset(); const base = job(voice());
    for (const value of ['', '   ', '\n\t']) assert.equal(job(voice({ voice_tags_custom: value })).key, base.key);
    const a = job(voice({ voice_tags_custom: 'low, male' }));
    assert.equal(a.key, job(voice({ voice_tags_custom: '[low] [male]' })).key);
    assert.notEqual(a.key, base.key); assert.notEqual(a.key, job(voice({ voice_tags_custom: 'high' })).key);
});
await check('목소리별 저장과 다시 불러오기가 다른 목소리·과거 설정을 바꾸지 않아요', () => {
    const s = reset(), old = voice({ stability: .7 }, 'fixture-b'), changed = voice({ voice_tags_custom: '[low, gravelly voice]' });
    s.voices = [changed, old]; const before = JSON.stringify(s);
    const restored = JSON.parse(JSON.stringify(s.voices)).map(v => S.toVoice(v, v.provider));
    assert.equal(restored[0].params.voice_tags_custom, '[low, gravelly voice]');
    assert.deepEqual(restored[1], old); job(restored[0]); job(restored[1]); assert.equal(JSON.stringify(s), before);
    s.providers.elevenlabs.voice_tags_custom = '전역 값';
    assert.equal(job(old).params.voice_tags_custom, undefined, '목소리 전용 값은 전역 설정에서 상속하지 않아요');
});
const uiSource = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');
function section(name, next) { const a = uiSource.indexOf('function ' + name + '('), b = uiSource.indexOf('function ' + next + '(', a); assert.ok(a >= 0 && b > a); return uiSource.slice(a, b); }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function domContext() {
    const c = vm.createContext({ EDF: new Map([[field.key, field]]), esc, collectHelp() {}, coerce: (_f, el) => el.value, settings: () => ({}), readMix: () => [] });
    vm.runInContext(section('edControl', 'mixRowHtml') + '\n' + section('validateEditor', 'readEditor') + '\n' + section('visibleFields', 'fieldsHtml'), c);
    return c;
}
await check('공통 편집칸은 목소리 전용이고 예시·도움말·길이 제한이 보여요', () => {
    const c = domContext();
    assert.equal(c.visibleFields([field], { model: 'eleven_v4' }).length, 0);
    assert.equal(field.show({ model: 'eleven_v4' }), true); assert.equal(field.show({ model: 'eleven_multilingual_v2' }), false);
    const html = c.edParam(field, { voice_tags_custom: '[low, gravelly voice]' }, {}, {});
    assert.match(html, /lv-wide/); assert.match(html, /maxlength="400"/); assert.match(html, /aria-label="말투 직접 입력"/);
    assert.match(html, /low, gravelly voice/); assert.match(html, /쉼표나 줄바꿈/);
    assert.match(c.edParam(field, {}, {}, {}), /disabled/);
});
await check('편집 저장 전 검사에서 이전 입력을 고칠 기회를 주고 기본값은 통과해요', () => {
    const c = domContext(); let useDefault = false;
    const box = { dataset: { key: field.key }, querySelector: s => s === '.lv-def-chk' ? { checked: useDefault } : { value: '[low] 대사' } };
    const el = { querySelector: () => ({ value: '시험 목소리' }), querySelectorAll: () => [box] };
    assert.match(c.validateEditor(el, { isNew: false }), /섞지/);
    useDefault = true; assert.equal(c.validateEditor(el, { isNew: false }), null);
});
await check('따옴표와 HTML처럼 보이는 직접 입력도 화면 문법으로 나오지 않아요', () => {
    const value = '</textarea><img src=x onerror="alert(1)"><script>throw 1</script>\' & "';
    const c = domContext(), html = c.edParam(field, { voice_tags_custom: value }, {}, {});
    assert.ok(!html.includes('<img ')); assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;/textarea&gt;')); assert.ok(html.includes('&quot;')); assert.ok(html.includes('&#39;'));
});
// HTML 파서 경로를 세 번째 인자로 주면 실제 DOM 트리도 확인해요. 브라우저나 네트워크는 쓰지 않아요.
if (process.argv[3]) await check('HTML 파서에서도 입력은 textarea 안 글자로만 남아요', async () => {
    const parser = await import(pathToFileURL(path.resolve(process.argv[3])));
    const value = '</textarea><img src=x onerror="alert(1)"><script>throw 1</script>\' & "';
    const html = domContext().edParam(field, { voice_tags_custom: value }, {}, {});
    const tree = parser.parseFragment(html), nodes = [];
    const visit = n => { nodes.push(n); for (const c of n.childNodes || []) visit(c); };
    visit(tree);
    assert.equal(nodes.filter(n => n.tagName === 'textarea').length, 1);
    assert.equal(nodes.filter(n => n.tagName === 'img' || n.tagName === 'script').length, 0);
    assert.equal(nodes.find(n => n.tagName === 'textarea').childNodes.map(n => n.value || '').join(''), value);
    assert.ok(nodes.every(n => !(n.attrs || []).some(a => /^on/i.test(a.name))));
});
await check('실제 미리듣기 진입 함수도 같은 정규화·캐시·HTTP 본문을 사용해요', async () => {
    const s = reset(), v = voice({ voice_tags_custom: '[low, gravelly voice]' }); s.voices = [v];
    const text = fs.readFileSync(path.join(root, 'player.js'), 'utf8');
    const start = text.indexOf('export function speakText('), end = text.indexOf('\n/**', start);
    let captured;
    const c = vm.createContext({ runtimeEnabled: () => true, settings: () => s, findVoice: () => v, allVoices: () => [v], applyPron: t => t, detectLang: () => 'ko', finishJobs: P._forTest.finishJobs, enqueue: jobs => { captured = jobs[0]; jobs.at(-1).done(true); }, toast() {} });
    vm.runInContext(text.slice(start, end).replace('export ', ''), c);
    await c.speakText('테스트 문장이에요.', v.uid);
    const normal = job(v); assert.equal(captured.params.voice_tags_custom, normal.params.voice_tags_custom); assert.equal(captured.key, normal.key);
    await request(captured); assert.equal(JSON.parse(calls.at(-1).body).text, '[low, gravelly voice] 테스트 문장이에요.');
});
console.log(`직접 말투 태그 ${passed}개 통과 · 실제 네트워크 0회`);

