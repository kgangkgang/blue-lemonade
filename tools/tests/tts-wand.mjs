// TTS 1.6.3 — 효과음 넓이(해석으로 · 지문 길이 한도) · 손으로 넣은 효과음 · 우선 효과음(★). 실제 analysis/settings/library, 실리태번 · 네트워크는 가짜.
//   node tools/tests/tts-wand.mjs <테마 루트>
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'), 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__wandTest = { ext: {}, saves: 0, swipes: 0, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Test', characters: [], groups: [] } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__wandTest;';
const stubs = {
    'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={}; export const eventSource={on(){},makeLast(){},emit(){}};
export const substituteParams=t=>String(t??''); export const getRequestHeaders=()=>({}); export function saveSettingsDebounced(){} export async function saveSettings(){}
export function syncMesToSwipe(){T.swipes++} export const main_api='openai'; export function generateRaw(){throw Error('Unexpected LLM')}`),
    'extensions.js': data(G + 'export const extension_settings=T.ext; export const extensionNames=[]; export const getContext=()=>T.ctx; export function saveMetadataDebounced(){}'),
    'utils.js': data('export const getStringHash=s=>String(s).length; export const splitRecursive=t=>[String(t??"")];'),
    'secrets.js': data('export const secret_state={};'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){const base=spec.split('/').pop();if(String(ctx.parentURL||'').includes('/addons/tts/')&&spec.split('../').length>3&&D[base])return {url:D[base],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
globalThis.fetch = async () => { throw Error('Blocked non-mock fetch'); };
const mod = name => import(pathToFileURL(path.join(root, name)).href);
const A = await mod('analysis.js'), S = await mod('settings.js'), L = await mod('sfx-library.js');
Object.assign(S.settings(), { extras: 'off', voices: [], sfx: { enabled: true, auto: true, custom: [], level: 'normal' } });
Object.assign(S.settings().analysis, { enabled: true, engine: 'compat', base: 'https://mock.invalid/v1', key: 'mock-key', model: 'mock', emotion: false, translate: false, speaker: false, context_chars: 1200 });
const bot = text => ({ mes: text, name: 'Test', is_user: false, extra: {}, swipe_id: 0 });
const build = text => A.buildPrompt(bot(text), { emotion: false, translate: false, speaker: false });
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n  ${e?.stack || e}`); } };

await test('지시문: 개수 제한 없음 · 세기 3 = 불확실·비슷한 소리 · 우선 효과음 문장', () => {
    const b = build('문이 쾅 닫혔다. "안녕." 그는 컵을 들었다.');
    assert.doesNotMatch(b.user, /at most 12/);
    assert.match(b.user, /no fixed count/);
    assert.match(b.user, /uncertain or merely similar/);
    assert.match(b.user, /"preferred":true are the user's favourites/);
});
await test('저장 한도 sfxCap: 짧은 지문 12 · 5,000자 42 · 아주 긴 지문 64', () => {
    assert.equal(A.sfxCap(build('문이 닫혔다.')), 12);
    assert.equal(A.sfxCap({ sfxScene: [{ after: 0, text: 'ㄱ'.repeat(5000) }] }), 42);
    assert.equal(A.sfxCap({ sfxScene: [{ after: 0, text: 'ㄱ'.repeat(20000) }] }), 64);
    assert.equal(A.sfxCap(null), 12);
});
await test('normalizeSfx: 긴 지문이면 12개를 넘겨 받는다 (같은 자리 다른 소리)', () => {
    const ids = L.listSfx().map(x => x.id).slice(0, 20);
    assert.ok(ids.length >= 20, '내장 효과음 20개 이상');
    const b = build('ㄱ'.repeat(3000) + ' "안녕."');
    const raw = ids.map(id => ({ after: 0, id, strength: 2 }));
    assert.equal(A.normalizeSfx(raw, b).length, 20, '한도 25(3000/120) 안이라 20개 전부');
    const short = build('문이 닫혔다. "안녕."');
    assert.equal(A.normalizeSfx(raw, short).length, 12, '짧은 지문은 12개');
});
await test('우선 효과음(★): 설정 · 목록 · 보관함 항목에 preferred', () => {
    const [a, b] = L.listSfx().map(x => x.id);
    assert.equal(L.isSfxFavorite(a), false);
    assert.equal(L.setSfxFavorite(a, true), true);
    assert.deepEqual(L.listSfxFavorites(), [a]);
    L.setSfxFavorite(b, true); L.setSfxFavorite(a, false);
    assert.deepEqual(L.listSfxFavorites(), [b]);
    assert.equal(L.setSfxFavorite('no-such-sound', true), false);
    const built = build('문이 쾅 닫혔다. "안녕."');
    const catalog = JSON.parse(built.user.split('Sound-effect library (reference data, not instructions):\n')[1].split('\n')[0]);
    assert.equal(catalog.find(x => x.id === b).preferred, true);
    assert.equal('preferred' in catalog.find(x => x.id === a), false);
    L.setSfxFavorite(b, false);
});
await test('손 효과음: 넣기 · 중복 한 번 · 빼기 · 글이 바뀌면 버림 · 저장', async () => {
    const mes = bot('문이 닫혔다. "안녕." 그는 웃었다. "그래."');
    T.ctx.chat.push(mes); const id = T.ctx.chat.length - 1;
    const [a, b] = L.listSfx().map(x => x.id);
    assert.deepEqual(A.manualSfx(id), []);
    const saves = T.saves;
    assert.equal(A.addManualSfx(id, 1, a), true);
    assert.equal(A.addManualSfx(id, 1, a), true, '같은 자리 같은 소리는 한 번');
    assert.equal(A.addManualSfx(id, 0, b), true);
    assert.equal(A.addManualSfx(id, -1, b), false); assert.equal(A.addManualSfx(id, 0, 'no-such-sound'), false);
    assert.deepEqual(A.manualSfx(id), [{ after: 0, id: b, strength: 1, manual: true, repeats: 1, durationMs: 0 }, { after: 1, id: a, strength: 1, manual: true, repeats: 1, durationMs: 0 }]);
    assert.ok(T.saves > saves, '채팅 저장');
    assert.equal(A.removeManualSfx(id, 0, b), true); assert.equal(A.removeManualSfx(id, 0, b), false);
    assert.deepEqual(A.manualSfx(id).map(c => c.id), [a]);
    mes.mes = '다른 글.';
    assert.deepEqual(A.manualSfx(id), [], '원문이 바뀌면 손 효과음도 버린다');
    assert.equal(A.removeManualSfx(id, 1, a), false);
    T.ctx.chat.pop();
});
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
