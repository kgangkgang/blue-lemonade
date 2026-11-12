// 코드 감사 2차 · 1.1.3 로 미룬 TTS 항목(V3 · V4 · V6 ~ V12) — 고치기 전에는 항목마다 실패했어요.
//   실리태번 모듈은 data: 스텁, 진짜 TTS 모듈 · 가짜 fetch (네트워크 없음).
//   node tools/tests/audit113-tts.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__audit113Tts = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const G = 'const T = globalThis.__audit113Tts;\n';
const stubs = {
    'script.js': js(G + `export const chat = T.ctx.chat; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = t => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export const main_api = 'openai'; export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + 'export const extension_settings = T.ext; export const extensionNames = []; export function getContext() { return T.ctx; } export function saveMetadataDebounced() {}'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { return null; }'),
    'utils.js': js('export function getStringHash(s) { let h = 0; for (const c of String(s ?? \'\')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function splitRecursive(t) { return [String(t ?? \'\')]; }'),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {}; export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) { const parent = String(ctx.parentURL || ''); if (parent.includes('/addons/tts/')) { const base = spec.split('/').pop(); if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true }; } return next(spec, ctx); }`), { data: { st: stubs } });
const mod = name => import(pathToFileURL(path.join(root, name)).href);
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const S = await mod('settings.js');
const A = await mod('analysis.js');
S.settings();

await test('V3 듣는 언어 · 대사 분석 엔진: 프롬프트가 요구한 {"lines":[…]} 와 맨 배열을 읽어요', async () => {
    const s = S.settings();
    s.analysis = { ...(s.analysis || {}), enabled: true, engine: 'compat', base: 'https://llm.invalid/v1', key: 'test-key', model: 'm', translate: true };
    const reply = content => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    const keep = globalThis.fetch;
    try {
        for (const content of ['{"lines":["こんにちは","さようなら"]}', '["こんにちは","さようなら"]', '```json\n{"lines":["こんにちは","さようなら"]}\n```']) {
            let sent = 0;
            globalThis.fetch = async () => { sent++; return reply(content); };
            assert.deepEqual(await A.translateLines(['안녕', '잘 가'], 'ja'), ['こんにちは', 'さようなら'], content);   // 고치기 전: [null, null]
            assert.equal(sent, 1);
        }
    } finally { globalThis.fetch = keep; }
    // 대사 분석 답 읽기는 예전 그대로
    assert.equal(A.parseReply('{"lines":["a"]}'), null);
    assert.deepEqual(A.parseReply('noise {"segs":[{"i":0}]} tail'), { segs: [{ i: 0 }] });
});

await test('V4 이어 쓰기: 묻지 않는 앞줄(known)의 번역은 기다리지 않아요', () => {
    const mes = { name: 'Mina', is_user: false, mes: '미나가 웃었다.\n"안녕하세요, 오랜만이에요."\n그녀가 손을 흔들었다.\n"오늘은 날씨가 정말 좋네요."' };
    T.ctx.chat.push(mes);
    const built = A.buildPrompt(mes, { langs: ['ja'], translate: true, emotion: true, speaker: false, known: [0] });
    const asked = [...String(built.user).matchAll(/^\[(\d+)\]/gm)].map(m => Number(m[1]));
    assert.deepEqual(asked, [1]);
    assert.deepEqual(built.needs, { 1: ['ja'] });   // 고치기 전: {0:[ja], 1:[ja]} → 「빠진 번역」으로 답을 버림
    const fresh = A.buildPrompt(mes, { langs: ['ja'], translate: true, emotion: true, speaker: false });
    assert.deepEqual(fresh.needs, { 0: ['ja'], 1: ['ja'] });
    T.ctx.chat.length = 0;
});

await test('V7 효과음: 「못 내는 소리」 낱말이 있어도 다른 소리 낱말은 살아요', async () => {
    const L = await mod('sfx-library.js');
    const id = t => L.matchSfx(t)?.id ?? null;
    assert.equal(id('Her phone vibrated on the desk'), 'daily_phone_vibration');   // 고치기 전: null
    assert.match(String(id('He carefully closed the door')), /^door_/);              // carefully 의 car 때문에 null 이었어요
    assert.equal(id('She laughed and knocked on the door'), 'knock');
    // 못 내는 소리만 있는 문장은 예전처럼 다른 소리로 바꾸지 않아요
    assert.equal(id('The dog barked'), null);
    assert.equal(id('Her phone rang'), null);
    assert.equal(id('A car engine roared'), null);
});

const player = read('player.js');
await test('V6 페르소나 목소리를 묻는 사이 멈춤 · 다른 줄 · 채팅 바뀜이 있으면 옛 작업을 읽지 않아요(코드 꼴)', () => {
    const calls = player.match(/askPersonaVoice\(\)\.then\(ok => \{[^}]*\}/g) || [];
    assert.equal(calls.length, 2, '부르는 곳 둘 (speakNow · speakSegments)');
    for (const c of calls) assert.match(c, /if \(ok && gen === asked && msg\(mesId\) === mes\)/, c);   // 고치기 전: if (ok)
    assert.equal((player.match(/const asked = gen; void askPersonaVoice\(\)/g) || []).length, 2);
});

const cutPlayer = name => {
    const at = [`\nexport async function ${name}(`, `\nexport function ${name}(`, `\nasync function ${name}(`, `\nfunction ${name}(`].map(h => player.indexOf(h)).find(i => i >= 0) ?? -1;
    assert.ok(at >= 0, name);
    const end = player.indexOf('\n}\n', at);
    return player.slice(at + 1, end + 2);
};
await test('V8 「전체 내려받기」: 셋씩 차례로 · 멈춤과 첫 실패에서 남은 줄을 보내지 않아요', async () => {
    const body = cutPlayer('downloadMessage');
    assert.doesNotMatch(body, /Promise\.all\(jobs\.map\(ensureAudio\)\)/);   // 고치기 전: 모든 줄을 한꺼번에
    // 잘라 온 일꾼 부분만 돌려 봐요: 6줄 · 둘째 줄 실패
    const start = body.indexOf('const results = new Array(jobs.length)'), stop = body.indexOf('if (failed) { fail(failed); return false; }');
    assert.ok(start > 0 && stop > start);
    const run = new Function('env', `with (env) { return (async () => { ${body.slice(start, stop)} return { failed, results }; })(); }`);
    const sent = [], exportJobs = new Set();
    let gen = 0;
    const jobs = Array.from({ length: 6 }, (_, i) => ({ i, ctrl: { abort() { this.aborted = true; } } }));
    const ensureAudio = async j => { sent.push(j.i); await new Promise(r => setTimeout(r, j.i === 1 ? 1 : 10)); if (j.i === 1) throw new Error('합성 실패'); return { blob: j.i }; };
    const out = await run({ jobs, ensureAudio, exportJobs, get gen() { return gen; } });
    assert.equal(out.failed?.message, '합성 실패');
    assert.ok(sent.length <= 3, `보낸 줄 ${sent}`);                // 고치기 전: 6줄 모두
    assert.equal(exportJobs.size, 0);
    // 멈춤(gen 이 바뀜): 그 뒤 줄은 보내지 않아요
    sent.length = 0;
    const ok = async j => { sent.push(j.i); await new Promise(r => setTimeout(r, 5)); if (j.i === 0) gen++; return { blob: j.i }; };
    const stopped = await run({ jobs: jobs.map(j => ({ ...j })), ensureAudio: ok, exportJobs, get gen() { return gen; } });
    assert.match(stopped.failed?.message ?? '', /멈췄어요/);
    assert.ok(sent.length <= 3, `멈춘 뒤 보낸 줄 ${sent}`);
});

await test('V9 재생 중 <audio> 오류는 「들었음」이 아니에요(코드 꼴)', () => {
    const body = cutPlayer('playAudio');
    assert.match(body, /const how = await done;[\s\S]*?return how === 'ended';/);   // 고치기 전: return how !== 'cut'
    assert.match(body, /onErr = \(\) => res\('error'\)/);
});

await test('V10 ⟲ 이전 소리: 기다리는 사이 줄이 넘어가도 옛 사본을 버려요(코드 꼴)', () => {
    const body = cutPlayer('revertCurrent');
    const restore = body.indexOf('cache.restoreTake(j.key)'), forget = body.indexOf('forgetClip(j.key)'), moved = body.indexOf('current !== j');
    assert.ok(restore > 0 && forget > restore && moved > forget, `되돌림 ${restore} · 버림 ${forget} · 넘어감 ${moved}`);   // 고치기 전: 넘어갔으면 버리기 전에 return
    assert.doesNotMatch(body, /if \(!ok \|\| current !== j\) return/);
});

await test('V11 계속 커지던 모음에 상한 · 끌 때 메모리 소리 사본을 비워요(코드 꼴)', () => {
    assert.match(cutPlayer('stopForAddon'), /stop\(\);\s*\n\s*forgetClips\(\);/);                  // 고치기 전: warm · prepared 가 남음
    assert.match(player, /premade\.add\(job\.key\); if \(premade\.size > 500\) premade\.delete\(premade\.values\(\)\.next\(\)\.value\);/);
    assert.match(cutPlayer('toastOnce'), /if \(toastSeen\.size > 200\)/);
    assert.match(player, /CHAT_CHANGED, \(\) => \{[^}]*premade\.clear\(\);/);
});

await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/audit113-tts.mjs .'));
});
console.log(`audit113-tts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
