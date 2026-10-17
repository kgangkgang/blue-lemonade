// 6.9.8 장면 소리 (src/scene-sound-rules.js · scene-sound-synth.js · scene-sound.js · scene-sound-ui.js)
// 규칙: 날씨 → 소리 종류 · 설정 정리 · 크로스페이드 일정 · 다리 판정 / 합성: 가짜 소리판으로 노드 그래프 · 시작 · 멈춤 / 런타임: 켜기 · 바꾸기 · 끄기 · 숨은 탭 · 다리 / 설정 조각
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const load = file => import(pathToFileURL(path.join(root, file)));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('PASS', name); };

const rules = await load('src/scene-sound-rules.js');
const { tidySceneSound, effectiveModes, soundFor, ambientKinds, coversSfx, crossfadePlan, masterGain, thunderGap, FADE, KINDS, SFX_COVERED } = rules;

// ───────── 규칙 ─────────
await t('tidySceneSound: 기본 꺼짐 · 깨진 값 · 모르는 열쇠 · 파일 경로 거르기', () => {
    assert.deepEqual(tidySceneSound(undefined), { on: false, volume: 40, thunder: true, background: true, files: {}, music: { on: false, volume: 30, mood: 'auto', files: {} } });
    assert.deepEqual(tidySceneSound({ on: 'yes', volume: '250', thunder: 0, background: false, files: 'x', junk: 1 }), { on: false, volume: 100, thunder: true, background: false, files: {}, music: { on: false, volume: 30, mood: 'auto', files: {} } });
    const clean = tidySceneSound({ on: true, volume: 12.6, files: { rain: 'user/files/bl-scene-rain-1.mp3', wind: '/user/files/w.ogg', hush: 'https://evil/x.mp3', water: '/user/files/../x.wav', snow: '/user/files/a.mp3' } });
    assert.deepEqual(clean, { on: true, volume: 13, thunder: true, background: true, files: { rain: '/user/files/bl-scene-rain-1.mp3', wind: '/user/files/w.ogg' }, music: { on: false, volume: 30, mood: 'auto', files: {} } });
    assert.ok(!('snow' in clean.files), 'moden 열쇠만');
});
await t('effectiveModes: 고른 날씨 · 둘째 날씨 · 트래커는 날씨 모듈이 그리는 것', () => {
    assert.deepEqual(effectiveModes({ weather: 'rain', weather2: 'fog' }), ['rain', 'fog']);
    assert.deepEqual(effectiveModes({ weather: 'off', weather2: 'snow' }), ['snow']);
    assert.deepEqual(effectiveModes({ weather: 'tracker' }, null), []);
    assert.deepEqual(effectiveModes({ weather: 'tracker' }, { mode: 'snow', second: { mode: 'breeze' } }), ['snow', 'breeze']);
    assert.deepEqual(effectiveModes({ weather: 'tracker' }, { mode: 'off' }), []);
    assert.deepEqual(effectiveModes(null), []);
});
await t('soundFor: 비 > 물결 > 바람 > 낮은 바람, 그 밖은 없음', () => {
    assert.equal(soundFor(['rain']), 'rain'); assert.equal(soundFor(['fog', 'rain']), 'rain', '안개비는 빗소리');
    assert.equal(soundFor(['snow']), 'hush'); assert.equal(soundFor(['fog']), 'hush'); assert.equal(soundFor(['breeze']), 'wind');
    assert.equal(soundFor(['snow', 'breeze']), 'wind'); assert.equal(soundFor(['water', 'breeze']), 'water');
    for (const mode of ['sun', 'star', 'firefly', 'rainbow', 'shadow', 'lemon', 'petal', 'meteor', 'custom', 'glass']) assert.equal(soundFor([mode]), null, mode);
    assert.equal(soundFor([]), null); assert.equal(soundFor(null), null);
});
await t('ambientKinds · coversSfx: 비 + 천둥, 낮은 바람도 바람 효과음을 대신, 첨벙은 아무도 대신하지 않음', () => {
    assert.deepEqual(ambientKinds('rain', { thunder: true }), ['rain', 'thunder']);
    assert.deepEqual(ambientKinds('rain', { thunder: false }), ['rain']);
    assert.deepEqual(ambientKinds('hush', {}), ['hush']); assert.deepEqual(ambientKinds(null, {}), []);
    assert.equal(coversSfx(['rain', 'thunder'], 'daily_rain'), true); assert.equal(coversSfx(['rain', 'thunder'], 'thunder'), true);
    assert.equal(coversSfx(['rain'], 'thunder'), false); assert.equal(coversSfx(new Set(['hush']), 'wind'), true);
    assert.equal(coversSfx(['water'], 'daily_stream'), true); assert.equal(coversSfx(['water'], 'splash'), false);
    assert.equal(coversSfx([], 'wind'), false); assert.equal(coversSfx(['wind'], undefined), false);
    assert.deepEqual(Object.keys(SFX_COVERED).sort(), ['daily_rain', 'daily_rain_heavy', 'daily_rain_light', 'daily_stream', 'thunder', 'wind']);
    for (const id of ['daily_rain_light', 'daily_rain_heavy', 'daily_rain_storm']) assert.equal(coversSfx(['rain'], id), true, `7.0.1 비 단계 ${id}`);
    assert.equal(coversSfx(['wind'], 'daily_rain_light'), false); assert.equal(coversSfx(['rain'], 'daily_rainbow'), false);
});
await t('crossfadePlan: 같은 순간에 겹쳐 시작, 나가는 소리는 페이드 뒤에 멈춤', () => {
    const plan = crossfadePlan({ now: 10, outFrom: 0.9, inTo: 1 });
    assert.deepEqual(plan, [{ voice: 'out', from: 0.9, to: 0, at: 10, until: 11.5, stopAt: 11.55 }, { voice: 'in', from: 0, to: 1, at: 10, until: 11.5 }]);
    assert.deepEqual(crossfadePlan({ now: 3, outFrom: 0.5, out: FADE.out }), [{ voice: 'out', from: 0.5, to: 0, at: 3, until: 4.2, stopAt: 4.25 }]);
    assert.deepEqual(crossfadePlan({ now: 0, inTo: 0.5, fadeIn: 2 }), [{ voice: 'in', from: 0, to: 0.5, at: 0, until: 2 }]);
});
await t('masterGain · thunderGap', () => {
    assert.equal(masterGain(100), 1); assert.equal(masterGain(0), 0); assert.equal(masterGain(40), 0.253); assert.equal(masterGain('x'), 0);
    assert.equal(thunderGap(true, 0), 8); assert.equal(thunderGap(true, 1), 20); assert.equal(thunderGap(false, 0), 25); assert.equal(thunderGap(false, 1), 75); assert.equal(thunderGap(false, 0.5), 50);
});

// ───────── 가짜 소리판 ─────────
class Param {
    constructor(value) { this.value = value; this.log = []; }
    setValueAtTime(v, at) { this.log.push(['set', v, at]); this.value = v; return this; }
    linearRampToValueAtTime(v, at) { this.log.push(['lin', v, at]); this.value = v; return this; }
    exponentialRampToValueAtTime(v, at) { this.log.push(['exp', v, at]); this.value = v; return this; }
    cancelScheduledValues(at) { this.log.push(['cancel', at]); return this; }
}
class Node {
    constructor(ctx, type) { this.ctx = ctx; this.type = type; this.outputs = new Set(); this.started = null; this.stopped = null; ctx.nodes.push(this); }
    connect(dest) { this.outputs.add(dest); return dest; }
    disconnect() { this.outputs.clear(); this.disconnected = true; }
    start(at = 0, offset = 0) { this.started = { at, offset }; }
    stop(at = 0) { this.stopped = at; }
}
class FakeContext {
    constructor() { this.sampleRate = 48000; this.currentTime = 0; this.state = 'suspended'; this.nodes = []; this.destination = new Node(this, 'destination'); this.nodes.length = 0; this.resumes = 0; this.suspends = 0; }
    createGain() { const node = new Node(this, 'gain'); node.gain = new Param(1); return node; }
    createBiquadFilter() { const node = new Node(this, 'biquad'); node.frequency = new Param(350); node.Q = new Param(1); node.type = 'lowpass'; node.kind = 'biquad'; return node; }
    createOscillator() { const node = new Node(this, 'osc'); node.frequency = new Param(440); return node; }
    createBufferSource() { const node = new Node(this, 'source'); node.playbackRate = new Param(1); node.loop = false; node.buffer = null; return node; }
    createBuffer(channels, length, rate) { const data = new Float32Array(length); return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data }; }
    async decodeAudioData(bytes) { return { decoded: true, bytes: bytes.byteLength }; }
    async resume() { this.resumes++; this.state = 'running'; }
    async suspend() { this.suspends++; this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
}

// ───────── 합성 ─────────
const synth = await load('src/scene-sound-synth.js');
await t('noiseBuffer: 소리판마다 하나, 4초 · 이음새 섞기, 같은 씨앗', () => {
    const ctx = new FakeContext();
    const a = synth.noiseBuffer(ctx), b = synth.noiseBuffer(ctx);
    assert.equal(a, b); assert.equal(a.length, 48000 * 4);
    const data = a.getChannelData(0);
    assert.ok(data.some(v => v > 0.5) && data.some(v => v < -0.5), '흰 잡음');
    const other = synth.noiseBuffer(new FakeContext()).getChannelData(0);
    assert.equal(data[1000], other[1000], '씨앗이 같아 같은 잡음');
});
await t('buildVoice: 종류마다 노드 몇 개 · 모든 소스는 반복 · 출구 게인은 0 에서 시작 · 시작 · 멈춤', async () => {
    for (const [kind, expectNodes] of [['rain', 11], ['wind', 8], ['hush', 8], ['water', 13]]) {
        const ctx = new FakeContext(); ctx.currentTime = 5;
        const voice = synth.buildVoice(ctx, kind);
        assert.equal(voice.kind, kind); assert.equal(voice.nodes, expectNodes, `${kind} 노드 수`); assert.equal(voice.gain.gain.value, 0);
        const sources = ctx.nodes.filter(n => n.type === 'source');
        assert.ok(sources.length >= 1 && sources.every(s => s.loop && s.buffer), `${kind} 소스 반복`);
        voice.start(5); voice.start(5);
        assert.ok(sources.every(s => s.started?.at === 5), '한 번만 시작');
        assert.ok(ctx.nodes.filter(n => n.type === 'osc').every(o => o.started), 'LFO 시작');
        const master = ctx.createGain(); voice.gain.connect(master);
        voice.stop(7);
        assert.ok(sources.every(s => s.stopped === 7), '멈춤 예약');
        await new Promise(r => setTimeout(r, 2100));
        assert.ok(ctx.nodes.filter(n => n !== master && n.type !== 'destination').every(n => n.disconnected), `${kind} 전부 뗌`);
    }
    const ctx = new FakeContext();
    const file = synth.buildVoice(ctx, 'rain', { buffer: { fake: true } });
    assert.equal(file.file, true); assert.equal(file.nodes, 2); assert.equal(file.trim, 1);
    assert.throws(() => synth.buildVoice(ctx, 'sun'), /모르는 장면 소리/);
});
await t('strikeThunder: 봉우리 → 긴 꼬리, 끝나면 뗌', () => {
    const ctx = new FakeContext(); ctx.currentTime = 2;
    const dest = ctx.createGain();
    const hit = synth.strikeThunder(ctx, dest, { at: 2, rand: 0.5 });
    assert.equal(hit.length, 4.5); assert.equal(hit.stopAt, 6.6); assert.equal(Math.round(hit.peak * 100), Math.round(72.5 * synth.THUNDER_BOOST), '봉우리 = (0.55 + 0.5 × 0.35) × 보정');
    const env = ctx.nodes.find(n => n.type === 'gain' && n !== dest);
    assert.deepEqual(env.gain.log.map(x => x[0]), ['set', 'lin', 'exp', 'exp']);
    assert.ok(env.outputs.has(dest));
    const src = ctx.nodes.find(n => n.type === 'source');
    assert.equal(src.stopped, 6.6); src.onended();
    assert.ok(env.disconnected && src.disconnected);
});

// ───────── 런타임 ─────────
const timers = []; let clock = 1_000_000, timerSeq = 0;
const fakeHost = {
    AudioContext: () => FakeContext,
    doc: () => doc, now: () => clock, random: () => 0.5,
    fetch: async url => ({ ok: /ok\.mp3$/.test(url), status: 404, arrayBuffer: async () => new ArrayBuffer(16) }),
    setTimeout: (fn, ms) => { const id = ++timerSeq; timers.push({ id, fn, due: clock + ms }); return id; },
    clearTimeout: id => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); },
    weather: async () => ({ weatherState: () => ({ current: trackerCurrent }) }),
    context: () => ({ eventSource: { on: (name, fn) => (stEvents[name] ??= []).push(fn) }, event_types: { CHARACTER_MESSAGE_RENDERED: 'cmr', CHAT_CHANGED: 'cc' } }),
};
let trackerCurrent = null; const stEvents = {};
const doc = Object.assign(new EventTarget(), { hidden: false });
const runFakeTimers = (upTo = clock) => { for (const timer of timers.splice(0).sort((a, b) => a.due - b.due)) { if (timer.due <= upTo) timer.fn(); else timers.push(timer); } };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)); };
const ss = await load('src/scene-sound.js');
const { syncSceneSound, sceneSoundState, previewSceneSound, AMBIENT, _forTest } = ss;
_forTest.setHost(fakeHost);

await t('다리: 모듈을 불러오면 전역 창구가 서고, 꺼져 있을 때는 비어 있다', () => {
    const bridge = globalThis[AMBIENT];
    assert.equal(bridge, _forTest.bridge); assert.equal(bridge.version, 1);
    assert.equal(bridge.playing(), null); assert.deepEqual([...bridge.kinds], []); assert.equal(bridge.covers('daily_rain'), false);
    assert.equal(ss.installAmbientBridge({}).version, 1);
    const other = { playing() {}, covers() {} }; assert.equal(ss.installAmbientBridge({ [AMBIENT]: other }), other, '먼저 선 다리는 그대로');
});
await t('켜기: 비 → 빗소리 목소리 · 1.5초 페이드 인 · 마스터는 설정 크기 · 다리가 비 + 천둥을 알린다 · 천둥 예약', async () => {
    const seen = []; const off = _forTest.bridge.onChange(e => seen.push([e.kind, [...e.kinds]]));
    await syncSceneSound(true, { on: true, volume: 40 }, { weather: 'rain', weather2: 'off' }, true);
    await settle();
    const st = sceneSoundState();
    assert.equal(st.kind, 'rain'); assert.equal(st.nodes, 11); assert.equal(st.master, 0.253); assert.equal(st.context, 'running');
    assert.deepEqual(_forTest.context().nodes.find(n => n.type === 'gain' && n.gain.log.length && n.gain.log.at(-1)[0] === 'lin').gain.log.at(-1), ['lin', 1, 1.5]);
    assert.deepEqual(st.bridge, { playing: { kind: 'rain', since: clock }, kinds: ['rain', 'thunder'] });
    assert.equal(globalThis[AMBIENT].covers('daily_rain'), true); assert.equal(globalThis[AMBIENT].covers('thunder'), true); assert.equal(globalThis[AMBIENT].covers('wind'), false);
    assert.deepEqual(seen, [['rain', ['rain', 'thunder']]]);
    assert.equal(st.thunderDue, clock + 14000, '첫 천둥은 8~20초 (rand 0.5 → 14초)');
    off();
});
await t('같은 설정으로 또 불러도 목소리를 새로 만들지 않는다 · 크기만 바꾸면 마스터만 움직인다', async () => {
    const before = _forTest.context().nodes.length;
    await syncSceneSound(true, { on: true, volume: 40 }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(_forTest.context().nodes.length, before);
    await syncSceneSound(true, { on: true, volume: 100 }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(sceneSoundState().master, 1); assert.equal(_forTest.context().nodes.length, before);
});
await t('천둥: 때가 되면 한 번 치고 다음을 예약, 빗소리 게인으로 들어간다 · 천둥을 끄면 예약이 사라진다', async () => {
    const ctx = _forTest.context();
    clock += 14000; runFakeTimers();
    const st = sceneSoundState();
    assert.equal(st.thunderCount, 1); assert.equal(st.thunderDue, clock + 50000, '다음은 25~75초 (rand 0.5 → 50초)');
    const env = ctx.nodes.filter(n => n.type === 'gain').find(n => n.gain.log.some(x => x[0] === 'exp'));
    assert.ok(env, '천둥 봉투'); assert.ok([...env.outputs].some(o => o.gain && [...o.outputs].some(m => m === _forTest.masterNode())), '천둥 → 빗소리 게인 → 마스터');
    await syncSceneSound(true, { on: true, volume: 100, thunder: false }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(sceneSoundState().thunderDue, 0); assert.deepEqual(sceneSoundState().bridge.kinds, ['rain']);
});
await t('날씨가 눈으로 바뀌면 빗소리는 1.5초 페이드아웃 뒤 멈추고 낮은 바람이 겹쳐 들어온다', async () => {
    const ctx = _forTest.context(); ctx.currentTime = 20;
    await syncSceneSound(true, { on: true, volume: 100, thunder: false }, { weather: 'snow', weather2: 'off' }, true); await settle();
    const st = sceneSoundState();
    assert.equal(st.kind, 'hush'); assert.equal(st.nodes, 8);
    assert.deepEqual(st.outgoing, [{ kind: 'rain', gain: 0 }]);
    const rainSources = ctx.nodes.filter(n => n.type === 'source' && n.stopped != null && n.stopped > 10);   // 앞서 친 천둥 소스(4.6 에 멈춤)는 뺀다
    assert.ok(rainSources.length >= 2 && rainSources.every(s => Math.abs(s.stopped - 21.55) < 1e-9), '비 소스는 20 + 1.5 + 0.05 에 멈춤');
    const gains = ctx.nodes.filter(n => n.type === 'gain' && n.gain.log.length);
    assert.ok(gains.some(g => g.gain.log.some(x => x[0] === 'lin' && x[1] === 0 && Math.abs(x[2] - 21.5) < 1e-9)), '나가는 게인 → 0 @21.5');
    assert.ok(gains.some(g => g.gain.log.some(x => x[0] === 'lin' && x[1] === 0.5 && Math.abs(x[2] - 21.5) < 1e-9)), '들어오는 게인 → 0.5(낮은 바람 trim) @21.5');
    assert.deepEqual(st.bridge.kinds, ['hush']); assert.equal(globalThis[AMBIENT].covers('wind'), true, '낮은 바람이 바람 효과음을 대신');
    clock += 2000; runFakeTimers(); assert.deepEqual(sceneSoundState().outgoing, []);
});
await t('소리 없는 날씨(햇살)로 바뀌면 1.2초 페이드아웃 · 소리판은 잠든다 · 다리는 비어 있다', async () => {
    const ctx = _forTest.context(); ctx.currentTime = 30;
    await syncSceneSound(true, { on: true, volume: 100 }, { weather: 'sun', weather2: 'off' }, true); await settle();
    const st = sceneSoundState();
    assert.equal(st.kind, null); assert.equal(st.outgoing.length, 1); assert.equal(st.bridge.playing, null);
    assert.ok(ctx.nodes.some(n => n.type === 'source' && Math.abs(n.stopped - 31.25) < 1e-9), '30 + 1.2 + 0.05');
    clock += 1500; runFakeTimers();
    assert.equal(ctx.state, 'suspended'); assert.equal(sceneSoundState().outgoing.length, 0);
});
await t('트래커 따라: 날씨 모듈이 그리는 것을 읽고, 실리태번 메시지 이벤트 700ms 뒤 다시 본다', async () => {
    trackerCurrent = { mode: 'breeze', second: null };
    await syncSceneSound(true, { on: true, volume: 100 }, { weather: 'tracker' }, true); await settle();
    assert.equal(sceneSoundState().kind, 'wind'); assert.equal(_forTest.context().state, 'running');
    trackerCurrent = { mode: 'rain', second: { mode: 'fog' } };
    for (const fn of stEvents.cmr) fn();
    clock += 700; runFakeTimers(); await settle();
    assert.equal(sceneSoundState().kind, 'rain');
    trackerCurrent = { mode: 'off' };
    for (const fn of stEvents.cc) fn(); clock += 700; runFakeTimers(); await settle();
    assert.equal(sceneSoundState().kind, null);
});
await t('내 파일: 읽히면 파일 목소리(노드 2) · 못 읽으면 합성으로 · 파일이 바뀌면 크로스페이드', async () => {
    clock += 3000; runFakeTimers();   // 앞 시험의 페이드아웃을 걷는다
    await syncSceneSound(true, { on: true, volume: 100, files: { water: '/user/files/ok.mp3' } }, { weather: 'water', weather2: 'off' }, true); await settle();
    let st = sceneSoundState();
    assert.equal(st.kind, 'water'); assert.equal(st.file, '/user/files/ok.mp3'); assert.equal(st.nodes, 2);
    await syncSceneSound(true, { on: true, volume: 100, files: { water: '/user/files/missing.mp3' } }, { weather: 'water', weather2: 'off' }, true); await settle();
    st = sceneSoundState();
    assert.equal(st.kind, 'water'); assert.equal(st.file, ''); assert.equal(st.nodes, 13, '합성 물결');
    assert.deepEqual(st.outgoing.map(o => o.kind), ['water'], '파일 물결이 나간다 (앞 시험의 소리는 이미 걷힘)');
    clock += 2000; runFakeTimers();
});
await t('숨은 탭: 기본(계속)은 소리를 두고 천둥 타이머만 쉰다 · background 끄면 0.6초 페이드아웃 뒤 잠들고 돌아오면 이어진다', async () => {
    await syncSceneSound(true, { on: true, volume: 100 }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.ok(sceneSoundState().thunderDue > 0);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    let st = sceneSoundState();
    assert.equal(st.kind, 'rain'); assert.equal(st.resting, false); assert.equal(st.thunderDue, 0, '숨으면 천둥 타이머 멈춤');
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    assert.ok(sceneSoundState().thunderDue > 0, '돌아오면 다시 예약');
    await syncSceneSound(true, { on: true, volume: 100, background: false }, { weather: 'rain', weather2: 'off' }, true); await settle();
    const ctx = _forTest.context(); ctx.currentTime = 50;
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    st = sceneSoundState();
    assert.equal(st.kind, null); assert.equal(st.resting, true); assert.equal(st.bridge.playing, null);
    assert.ok(ctx.nodes.some(n => n.type === 'source' && Math.abs(n.stopped - 50.65) < 1e-9), '0.6초 페이드 + 0.05');
    clock += 1000; runFakeTimers(); assert.equal(ctx.state, 'running', '앞서 나가던 물결이 아직 걷히는 중이면 깨어 있다');
    clock += 1000; runFakeTimers(); assert.equal(ctx.state, 'suspended', '다 걷히면 잠든다');
    await syncSceneSound(true, { on: true, volume: 100, background: false }, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(sceneSoundState().kind, null, '쉬는 동안 설정이 와도 그대로');
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    st = sceneSoundState(); assert.equal(st.kind, 'rain'); assert.equal(st.resting, false); assert.equal(ctx.state, 'running');
});
await t('끄기(스위치 · 테마): 페이드아웃 · 다리 비움 · 날씨 꺼짐도 같다', async () => {
    await syncSceneSound(false, { on: false }, { weather: 'rain' }, true); await settle();
    assert.equal(sceneSoundState().kind, null); assert.equal(globalThis[AMBIENT].playing(), null);
    await syncSceneSound(true, { on: true }, { weather: 'rain' }, true); await settle(); assert.equal(sceneSoundState().kind, 'rain');
    await syncSceneSound(true, { on: true }, { weather: 'off' }, false); await settle(); assert.equal(sceneSoundState().kind, null);
});
await t('소리판이 멈춰 있으면(자동재생 정책) 첫 터치에서 깨운다', async () => {
    _forTest.reset(); _forTest.setHost(fakeHost);
    const Blocked = class extends FakeContext { async resume() { this.resumes++; if (this.allow) this.state = 'running'; } };
    _forTest.setHost({ ...fakeHost, AudioContext: () => Blocked });
    await syncSceneSound(true, { on: true }, { weather: 'breeze' }, true); await settle();
    const ctx = _forTest.context();
    assert.equal(ctx.state, 'suspended'); assert.equal(sceneSoundState().kind, 'wind', '목소리는 준비됨');
    ctx.allow = true; doc.dispatchEvent(new Event('pointerdown')); await settle();
    assert.equal(ctx.state, 'running');
    _forTest.reset(); _forTest.setHost(fakeHost);
});
await t('소리판이 없는 브라우저: 조용히 아무것도 안 한다', async () => {
    _forTest.setHost({ ...fakeHost, AudioContext: () => null });
    await syncSceneSound(true, { on: true }, { weather: 'rain' }, true); await settle();
    assert.equal(sceneSoundState().supported, false); assert.equal(sceneSoundState().kind, null);
    _forTest.reset(); _forTest.setHost(fakeHost);
});
await t('들어 보기: 0.3초 페이드 인 → ms 뒤 0.6초 페이드아웃 → 멈춤', async () => {
    const p = previewSceneSound('wind', 1000);
    await settle(); clock += 1000; runFakeTimers(); assert.equal(await p, true);
    const ctx = _forTest.context();
    const src = ctx.nodes.find(n => n.type === 'source');
    assert.ok(src.started && Math.abs(src.stopped - 0.65) < 1e-9);
    assert.equal(await previewSceneSound('sun'), false);
    _forTest.reset(); _forTest.setHost(fakeHost);
});

// ───────── 설정 조각 ─────────
const ui = await load('src/scene-sound-ui.js');
await t('sceneSoundMarkup: 꺼져 있으면 스위치 한 줄, 켜면 크기 · 천둥 · 화면 밖 · 내 파일(접힘, 종류마다 들어 보기 · 고르기 · 빼기)', () => {
    const calls = [];
    const h = { row: (l, c, note = '') => (calls.push(['row', l]), `<div class="salty-row"><span>${l}<small>${note}</small></span>${c}</div>`), stack: (l, c) => `<div class="salty-stack">${l}${c}</div>`, slider: (p, l) => (calls.push(['slider', p]), `<div class="salty-slider" data-range="${p}">${l}</div>`), toggle: (p, on) => `<input data-toggle="${p}" ${on ? 'checked' : ''}>` };
    const off = ui.sceneSoundMarkup({ sceneSound: { on: false } }, h);
    assert.ok(off.includes('data-toggle="sceneSound.on"') && !off.includes('sceneSound.volume') && !off.includes('bl-ss-files'));
    const on = ui.sceneSoundMarkup({ sceneSound: { on: true, files: { rain: '/user/files/bl-scene-rain-1700000000000.mp3' } } }, h);
    assert.ok(on.includes('data-toggle="sceneSound.on" checked'));
    assert.deepEqual(calls.filter(c => c[0] === 'slider'), [['slider', 'sceneSound.volume']]);
    assert.deepEqual(calls.filter(c => c[0] === 'row').map(c => c[1]), ['장면 소리', '장면 소리', '천둥', '화면 밖에서도', '분위기 음악'], '7.0.1 분위기 음악 스위치 한 줄(꺼짐)');
    assert.ok(on.includes('data-toggle="sceneSound.thunder" checked') && on.includes('data-toggle="sceneSound.background" checked'));
    assert.equal((on.match(/data-ss-act="preview"/g) || []).length, 4); assert.equal((on.match(/data-ss-act="pick"/g) || []).length, 4);
    assert.equal((on.match(/data-ss-act="clear"/g) || []).length, 1, '파일이 있는 종류만 빼기');
    assert.ok(on.includes('내 파일.mp3') && on.includes('>합성<') && on.includes('data-file="scene-sound"') && on.includes('data-md-fold="scene-sound-files"'));
    assert.ok(!/title="/.test(on), 'hover 툴팁 없음'); assert.ok(/aria-label="비 들어 보기"/.test(on));
});
await t('uploadSceneFile · deleteSceneFile: 이름 · 크기 검사, 서버 경로를 /user/files/… 로', async () => {
    const posts = [];
    const doFetch = async (url, init) => { posts.push([url, JSON.parse(init.body)]); return { ok: true, json: async () => ({ path: 'user/files/bl-scene-rain-5.mp3' }), text: async () => '' }; };
    const url = await ui.uploadSceneFile({ name: 'storm.MP3', size: 1000 }, 'rain', { fetch: doFetch, headers: () => ({ h: 1 }), now: () => 5, read: async () => 'QUJD' });
    assert.equal(url, '/user/files/bl-scene-rain-5.mp3'); assert.deepEqual(posts[0], ['/api/files/upload', { name: 'bl-scene-rain-5.mp3', data: 'QUJD' }]);
    await assert.rejects(ui.uploadSceneFile({ name: 'x.exe', size: 1 }, 'rain', { fetch: doFetch }), /mp3/);
    await assert.rejects(ui.uploadSceneFile({ name: 'x.wav', size: 13 * 1024 * 1024 }, 'rain', { fetch: doFetch }), /12MB/);
    await ui.deleteSceneFile('/user/files/bl-scene-rain-5.mp3', { fetch: doFetch, headers: () => ({}) });
    assert.deepEqual(posts[1], ['/api/files/delete', { path: 'user/files/bl-scene-rain-5.mp3' }]);
    assert.ok(rules.FILE_URL.test(url));
});

console.log(`scene-sound: ${n} PASS`);
