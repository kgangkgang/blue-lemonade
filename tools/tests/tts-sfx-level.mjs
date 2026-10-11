// TTS 1.6.2 효과음 크기 맞추기 (sfx.normalize) — src/addons/tts/src/sfx-library.js sfxBlob 이 목소리 음량 고르기(loudness.prepare)로 목표 음량(기본 −16 LUFS)에 맞춘다.
//   node tools/tests/tts-sfx-level.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
//   실리태번 모듈은 data: 스텁, IndexedDB 는 메모리, OfflineAudioContext 는 WAV 만 읽는 가짜. 합성 사인파, 네트워크 없음.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const data = text => `data:text/javascript,${encodeURIComponent(text)}`;
const T = globalThis.__sfxLevelTest = { ext: {}, decodes: 0 };
const stubs = {
    'script.js': data('export function saveSettingsDebounced(){}'),
    'extensions.js': data('export const extension_settings=globalThis.__sfxLevelTest.ext;'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){
if(spec.split('../').length>3&&D[spec.split('/').pop()])return {url:D[spec.split('/').pop()],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const records = new Map();
globalThis.indexedDB = { open() {
    const request = {};
    setTimeout(() => { request.result = { close() {}, transaction() {
        const tx = { objectStore() { return {
            put(blob, id) { records.set(id, blob); }, delete(id) { records.delete(id); },
            get(id) { const req = {}; queueMicrotask(() => { req.result = records.get(id); req.onsuccess?.(); }); return req; },
        }; }, abort() { tx.onabort?.(); } };
        setTimeout(() => tx.oncomplete?.(), 0); return tx;
    } }; request.onsuccess?.(); }, 0); return request;
} };
// 가짜 디코더: 16비트 PCM WAV 만 읽는다 (loudness.encodeWav 가 만든 것, 다채널 포함). 다른 바이트는 디코드 실패
function parseWav(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 44 || String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'RIFF') throw new Error('not wav');
    const ch = dv.getUint16(22, true), rate = dv.getUint32(24, true), n = Math.floor(dv.getUint32(40, true) / 2 / ch);
    const out = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = dv.getInt16(44 + (i * ch + c) * 2, true); out[c][i] = s < 0 ? s / 32768 : s / 32767; }
    return { sampleRate: rate, numberOfChannels: ch, length: n, duration: n / rate, getChannelData: c => out[c] };
}
globalThis.OfflineAudioContext = class { constructor() {} async decodeAudioData(buf) { T.decodes++; return parseWav(buf); } };

const mod = file => import(pathToFileURL(path.join(root, file)).href);
const Lo = await mod('loudness.js'), S = await mod('settings.js'), L = await mod('sfx-library.js');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const RATE = 44100;
const sine = (seconds, amp, hz = 440, rate = RATE) => { const n = Math.round(seconds * rate), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = amp * Math.sin(2 * Math.PI * hz * i / rate); return x; };
const wavBlob = (samples, rate = RATE) => new Blob([Lo.encodeWav(samples, rate)], { type: 'audio/wav' });
const decoded = async blob => parseWav(await blob.arrayBuffer());
const lufsOf = async blob => { const a = await decoded(blob); return Lo.integratedLoudness(a.getChannelData(0), a.sampleRate); };
const peakOf = async blob => { const a = await decoded(blob); let p = 0; for (let c = 0; c < a.numberOfChannels; c++) for (const v of a.getChannelData(c)) p = Math.max(p, Math.abs(v)); return p; };
const bytesOf = async blob => Buffer.from(await blob.arrayBuffer());

T.ext.lemon_voice = { sfx: { enabled: true, custom: [] } };
const s = S.settings();
assert.equal(s.sfx.normalize, false, '기본은 끔');
assert.equal(s.target_lufs, -16, '목표 음량 기본값');
const loud = await L.importSfx(wavBlob(sine(1.0, 0.5)), { name: '큰 소리' });       // 약 −9 LUFS
const quiet = await L.importSfx(wavBlob(sine(1.0, 0.04)), { name: '작은 소리' });   // 약 −31 LUFS
const loudRaw = await L.sfxBlob(loud.id, { raw: true }), quietRaw = await L.sfxBlob(quiet.id, { raw: true });
const loudLufs = await lufsOf(loudRaw), quietLufs = await lufsOf(quietRaw), loudBytes = await bytesOf(loudRaw);
assert.ok(loudLufs > -12 && quietLufs < -30 && loudLufs - quietLufs > 20, `원본 차이 ${loudLufs} / ${quietLufs}`);

await test('꺼져 있으면 원본 Blob 그대로 (같은 객체 · 디코드 없음)', async () => {
    const before = T.decodes;
    assert.equal(await L.sfxBlob(loud.id), loudRaw, '끄면 저장된 Blob 객체 그대로');
    assert.equal(T.decodes, before, '끈 때는 음량을 재지 않는다');
});
await test('켜면 큰 소리는 줄고 작은 소리는 커져 목표(−16 LUFS) 근처로 모인다 · WAV · 원본 바이트는 그대로', async () => {
    S.settings().sfx.normalize = true;
    assert.equal(L.sfxLevelOn(), true);
    const a = await L.sfxBlob(loud.id), b = await L.sfxBlob(quiet.id);
    assert.notEqual(a, loudRaw, '맞춘 것은 새 Blob');
    const la = await lufsOf(a), lb = await lufsOf(b);
    assert.ok(Math.abs(la + 16) <= 1 && Math.abs(lb + 16) <= 1, `맞춘 음량 ${la} / ${lb}`);
    assert.ok(Math.abs(la - lb) <= 1, '두 소리가 비슷한 크기');
    assert.equal(a.type, 'audio/wav');
    const r = await L.sfxBlob(loud.id, { raw: true });
    assert.equal(r, loudRaw, 'raw 는 저장된 원본 객체'); assert.ok(loudBytes.equals(await bytesOf(r)), '원본 바이트는 바뀌지 않는다');
    const tiny = await L.importSfx(wavBlob(sine(1.0, 0.02)), { name: '아주 작은 소리' });   // 약 −37 LUFS → 키우기 한도 +18 dB
    const lt = await lufsOf(await L.sfxBlob(tiny.id)), lr = await lufsOf(await L.sfxBlob(tiny.id, { raw: true }));
    assert.ok(Math.abs((lt - lr) - 18) <= 0.5, `키우기는 +18 dB 까지 (${lr} → ${lt})`);
});
await test('목표 음량(target_lufs)을 따라가고, 바꾸면 다시 맞춘다 (캐시 열쇠에 목표가 들어 있다)', async () => {
    const before = T.decodes;
    S.settings().target_lufs = -20;
    const b = await L.sfxBlob(quiet.id);
    assert.equal(T.decodes, before + 1, '목표가 바뀌면 한 번 다시 잰다');
    assert.ok(Math.abs((await lufsOf(b)) + 20) <= 1, `−20 LUFS 로 (${await lufsOf(b)})`);
    S.settings().target_lufs = -16;
    assert.equal(T.decodes, before + 1, '원래 목표의 결과는 캐시에서');
    assert.ok(Math.abs((await lufsOf(await L.sfxBlob(quiet.id))) + 16) <= 1);
});
await test('짧은 타격음은 찌그러지지 않는다: 참 봉우리가 −1.5 dBFS 를 넘지 않게 이득을 깎고 리미터 무릎 아래에 둔다', async () => {
    const x = new Float32Array(Math.round(0.5 * RATE)); const burst = sine(0.015, 0.5, 1000);
    x.set(burst, Math.round(0.1 * RATE));
    const hit = await L.importSfx(wavBlob(x), { name: '타격음' });
    const raw = await L.sfxBlob(hit.id, { raw: true }), out = await L.sfxBlob(hit.id);
    const pr = await peakOf(raw), po = await peakOf(out);
    assert.ok(pr > 0.49 && pr < 0.51, `원본 봉우리 ${pr}`);
    assert.ok(po <= 0.845 && po >= 0.75, `맞춘 봉우리 ${po} (−1.5 dBFS = 0.841 이하 · 그래도 키움)`);
    const a = await decoded(raw), b = await decoded(out), ga = [], i0 = Math.round(0.1 * RATE);
    for (let i = i0 + 5; i < i0 + burst.length - 5; i++) if (Math.abs(a.getChannelData(0)[i]) > 0.3) ga.push(b.getChannelData(0)[i] / a.getChannelData(0)[i]);
    const gmin = Math.min(...ga), gmax = Math.max(...ga);
    assert.ok(gmax / gmin < 1.06, `선형 이득 (리미터가 안 건드림): ${gmin.toFixed(3)}~${gmax.toFixed(3)}`);
});
await test('스테레오 효과음은 두 채널을 지키고(모노로 합치지 않음) 모노 합이 목표에 맞는다', async () => {
    const left = sine(1.0, 0.3, 440), right = sine(1.0, 0.3, 660);
    const st = await L.importSfx(new Blob([Lo.encodeWav([left, right], RATE)], { type: 'audio/wav' }), { name: '스테레오' });
    const raw = await decoded(await L.sfxBlob(st.id, { raw: true })); assert.equal(raw.numberOfChannels, 2);
    const out = await decoded(await L.sfxBlob(st.id));
    assert.equal(out.numberOfChannels, 2, '맞춘 WAV 도 2채널');
    const mono = new Float32Array(out.length); for (let i = 0; i < out.length; i++) mono[i] = (out.getChannelData(0)[i] + out.getChannelData(1)[i]) / 2;
    assert.ok(Math.abs(Lo.integratedLoudness(mono, out.sampleRate) + 16) <= 1, '모노 합이 −16 LUFS 근처');
    let diff = 0; for (let i = 0; i < 2000; i++) diff = Math.max(diff, Math.abs(out.getChannelData(0)[i] - out.getChannelData(1)[i]));
    assert.ok(diff > 0.05, '좌우가 서로 다른 채로 남는다');
});
await test('한 세션에 소리마다 한 번만 잰다 (캐시) · 같은 소리를 동시에 부르면 요청 하나', async () => {
    const before = T.decodes;
    const first = await L.sfxBlob(loud.id);
    assert.equal(T.decodes, before, '두 번째부터는 디코드 없음');
    assert.equal(await L.sfxBlob(loud.id), first, '같은 Blob 객체');
    const fresh = await L.importSfx(wavBlob(sine(0.6, 0.1, 660)), { name: '동시' });
    const decodesBefore = T.decodes;
    const [x, y] = await Promise.all([L.sfxBlob(fresh.id), L.sfxBlob(fresh.id)]);
    assert.equal(x, y); assert.equal(T.decodes, decodesBefore + 1, '동시 요청은 한 번만 디코드');
});
await test('2MB 넘는 파일 · 60초 넘는 소리 · 디코드 못 하는 파일은 원본 그대로 (예외 없음)', async () => {
    const big = await L.importSfx(wavBlob(sine(1_200_000 / RATE, 0.5)), { name: '큰 파일' });   // 2.4 MB WAV (27 초)
    let before = T.decodes;
    assert.equal(await L.sfxBlob(big.id), await L.sfxBlob(big.id, { raw: true }), '2MB 넘으면 같은 객체'); assert.equal(T.decodes, before, '디코드하지 않는다');
    const long = await L.importSfx(wavBlob(sine(70, 0.5, 440, 8000), 8000), { name: '긴 소리' });   // 8 kHz 70 초 ≈ 1.1 MB (바이트 한도 아래)
    before = T.decodes;
    assert.equal(await L.sfxBlob(long.id), await L.sfxBlob(long.id, { raw: true }), '60초 넘으면 원본'); assert.equal(T.decodes, before + 1, '디코드 뒤 길이를 보고 멈춘다');
    const bytes = new Uint8Array(4000); bytes.set([0x49, 0x44, 0x33, 4, 0, 0]);   // 'ID3' 헤더만 있는 가짜 MP3
    const broken = await L.importSfx(new Blob([bytes], { type: 'audio/mpeg' }), { name: '못 읽는 소리' });
    assert.equal(await L.sfxBlob(broken.id), await L.sfxBlob(broken.id, { raw: true }), '디코드 실패 → 원본');
});
await test('다시 끄면 원본으로 돌아간다 · 켜고 끄기는 효과음 목록을 건드리지 않는다', async () => {
    S.settings().sfx.normalize = false;
    assert.equal(await L.sfxBlob(quiet.id), quietRaw);
    assert.equal(L.listSfx().filter(r => r.custom).length, 9);
});
console.log(`\ntts-sfx-level: ${passed} passed, 0 failed`);
