// TTS 1.9.0 통화 소리 효과 (src/addons/tts/src/fx-call.js) — 노드 묶음 구성 · 소리 크기 순서 · 끄면 정리
//   node tools/tests/tts-call-fx.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실제 소리(스펙트럼 · 음량)는 브라우저의 OfflineAudioContext 로 따로 잰다. 여기서는 그래프를 흉내 낸 가짜 맥락으로 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; };

// ---------- 가짜 WebAudio: 잇기 · 끊기 · 시작 · 멈춤 · 값 예약을 기록한다
class Param {
    constructor(v) { this.value = v; this.events = []; }
    setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; return this; }
    setTargetAtTime(v, t, c) { this.events.push(['target', v, t, c]); this.target = v; return this; }
    linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); return this; }
    exponentialRampToValueAtTime(v, t) { assert.ok(v > 0, '지수 램프는 0 보다 커야 해요'); this.events.push(['exp', v, t]); return this; }
    cancelScheduledValues(t) { this.events.push(['cancel', t]); this.target = undefined; return this; }
    get settled() { return this.target ?? this.value; }
}
class Node {
    constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outs = new Set(); this.ins = 0; ctx.made.push(this); }
    /** 이 노드의 값들(gain · frequency …)에 주인을 적어 둔다 */
    own() { for (const v of Object.values(this)) if (v instanceof Param) v.owner = this; return this; }
    connect(to) { assert.ok(to, `${this.kind} 를 빈 곳에 이으려 했어요`); this.outs.add(to); if (to instanceof Node) to.ins++; return to; }
    disconnect() { this.outs.clear(); this.cut = true; }
}
class Source extends Node {
    start(t) { assert.ok(!this.started, `${this.kind} 를 두 번 시작했어요`); this.started = t ?? 0; this.ctx.live.add(this); }
    stop() { this.stopped = true; this.ctx.live.delete(this); if (this.onended) this.onended(); }
}
class FakeContext {
    constructor(rate = 48000) { this.sampleRate = rate; this.currentTime = 0; this.made = []; this.live = new Set(); this.destination = new Node(this, 'destination'); }
    createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n.own(); }
    createBiquadFilter() { const n = new Node(this, 'biquad'); n.type = 'lowpass'; n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); return n.own(); }
    createWaveShaper() { const n = new Node(this, 'shaper'); n.curve = null; return n; }
    createDynamicsCompressor() { const n = new Node(this, 'compressor'); for (const k of ['threshold', 'ratio', 'attack', 'release', 'knee']) n[k] = new Param(0); return n; }
    createDelay() { const n = new Node(this, 'delay'); n.delayTime = new Param(0); return n.own(); }
    createOscillator() { const n = new Source(this, 'osc'); n.type = 'sine'; n.frequency = new Param(440); n.detune = new Param(0); return n.own(); }
    createBufferSource() { const n = new Source(this, 'buffer'); n.buffer = null; n.loop = false; n.playbackRate = new Param(1); return n.own(); }
    createBuffer(ch, len, rate) { const data = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: rate, getChannelData: () => data }; }
}
/** from 에서 to 까지 이어진 길 (BFS) — 지나는 노드 목록, 없으면 null */
function route(from, to) {
    const seen = new Map([[from, null]]), q = [from];
    while (q.length) {
        const n = q.shift();
        if (n === to) { const p = []; for (let x = n; x; x = seen.get(x)) p.unshift(x); return p; }
        for (const o of n.outs) {
            const next = o instanceof Param ? o.owner : o;   // 값(AudioParam)으로 이은 흔들개는 그 값의 노드로 이어진 셈
            if (next instanceof Node && !seen.has(next)) { seen.set(next, n); q.push(next); }
        }
    }
    return null;
}
/** 가짜 타이머: 걸린 것을 손으로 돌린다 */
function fakeTimers() {
    const map = new Map(); let id = 0;
    return { map, set(f, ms) { map.set(++id, { f, ms }); return id; }, clear(i) { map.delete(i); }, fireAll() { const all = [...map]; map.clear(); for (const [, { f }] of all) f(); } };
}
// 화면 숨김 흉내 (document.visibilitychange)
const doc = Object.assign(new EventTarget(), { hidden: false });
globalThis.document = doc;

const fx = await import(pathToFileURL(path.join(root, 'src/fx-call.js')));
const dB = g => 20 * Math.log10(g);

await test('목소리 필터: 휴대폰은 입력 → 고역 통과(약 300 Hz) → 저역 통과(약 3400 Hz) → 포화 → 압축 → 출력', async () => {
    const ctx = new FakeContext();
    const c = fx.voiceChain(ctx, { filter: 'phone', amount: 1 });
    const p = route(c.input, c.output);
    assert.ok(p, '입력에서 출력까지 이어져야 해요');
    const hp = p.filter(n => n.kind === 'biquad' && n.type === 'highpass'), lp = p.filter(n => n.kind === 'biquad' && n.type === 'lowpass');
    assert.equal(hp.length, 2); assert.equal(lp.length, 2);
    for (const n of hp) assert.ok(Math.abs(n.frequency.value - 300) < 1);
    for (const n of lp) assert.ok(Math.abs(n.frequency.value - 3400) < 1);
    const kinds = p.map(n => n.kind);
    assert.ok(kinds.indexOf('shaper') > kinds.lastIndexOf('biquad') - 1 && kinds.includes('compressor'));
    assert.ok(kinds.indexOf('shaper') < kinds.indexOf('compressor'), '포화 뒤에 압축');
    assert.ok(p.find(n => n.kind === 'shaper').curve.length > 0);
    // 선 잡음: 시작된 고리 하나가 출력으로 아주 작게 들어간다 (-45 dB 보다 작게)
    const hiss = [...ctx.live];
    assert.equal(hiss.length, 1);
    const hp2 = route(hiss[0], c.output);
    assert.ok(hp2);
    assert.ok(dB(hp2.filter(n => n.kind === 'gain').reduce((a, g) => a * g.gain.value, 1)) < -45);
});

await test('목소리 필터: 무전기는 더 좁고 스피커폰은 더 넓다 · 세기가 줄면 대역이 넓어진다', async () => {
    const band = (filter, amount) => {
        const ctx = new FakeContext();
        const c = fx.voiceChain(ctx, { filter, amount });
        const p = route(c.input, c.output);
        const f = t => p.filter(n => n.kind === 'biquad' && n.type === t)[0]?.frequency.value;
        c.dispose();
        return { lo: f('highpass'), hi: f('lowpass') };
    };
    const phone = band('phone', 1), radio = band('radio', 1), speaker = band('speaker', 1), soft = band('phone', 0.4);
    assert.ok(radio.lo > phone.lo && radio.hi < phone.hi);
    assert.ok(speaker.lo < phone.lo && speaker.hi > phone.hi);
    assert.ok(soft.lo < phone.lo && soft.hi > phone.hi);
    for (const id of fx.FILTERS.map(f => f.id)) assert.ok(band(id, 0.7).lo > 20);
});

await test('목소리 필터: 끔 · 세기 0 · 모르는 이름은 그대로 통과 (노드 하나, 소리 고리 없음)', async () => {
    for (const opts of [{ filter: 'phone', amount: 0 }, { filter: 'nope' }, { filter: '' }]) {
        const ctx = new FakeContext();
        const c = fx.voiceChain(ctx, opts);
        assert.equal(c.input, c.output);
        assert.equal(ctx.live.size, 0);
    }
});

await test('목소리 필터: dispose 하면 고리가 멈추고 모든 노드가 끊긴다 (스피커폰의 되먹임 지연까지)', async () => {
    for (const filter of fx.FILTERS.map(f => f.id)) {
        const ctx = new FakeContext();
        const c = fx.voiceChain(ctx, { filter, amount: 0.8 });
        c.dispose();
        assert.equal(ctx.live.size, 0, `${filter}: 멈추지 않은 소리`);
        for (const n of ctx.made) if (n.kind !== 'destination') assert.ok(n.cut, `${filter}: 안 끊긴 ${n.kind}`);
        c.dispose();   // 두 번 불러도 괜찮다
    }
});

await test('생활 소음: 장면마다 소리가 출력에 닿고, 가장 커도 -30 dBFS(말소리 -20 보다 10 dB 작게) · 말하는 동안 9 dB 더 작게 · 크기 순서', async () => {
    for (const { id } of fx.SCENES) {
        const ctx = new FakeContext();
        const timers = fakeTimers();
        const a = fx.ambience(ctx, { scene: id, level: 1, timers, hidden: () => false, watchVisibility: false });
        assert.ok(a.running);
        assert.ok(ctx.live.size >= 2, `${id}: 층이 너무 적어요`);
        for (const s of ctx.live) assert.ok(route(s, ctx.destination), `${id}: 출력에 안 닿는 ${s.kind}`);
        const loud = a.gain;
        assert.ok(dB(loud) <= -30 + 1e-9, `${id}: ${dB(loud).toFixed(1)} dB`);
        a.duck(true);
        assert.ok(Math.abs(dB(a.gain) - (dB(loud) - 9)) < 1e-6);
        a.duck(false);
        a.setLevel(0.4);
        const mid = a.gain;
        assert.ok(Math.abs(dB(mid) + 42) < 1e-6, '기본 크기 0.4 = -42 dBFS');
        a.setLevel(0.1);
        const low = a.gain;
        assert.ok(loud > mid && mid > low && low > 0);
        a.setLevel(0);
        assert.equal(a.gain, 0);
        a.stop();
    }
});

await test('생활 소음: 전화선 대역(band)을 주면 배경도 같은 대역 거르개를 지난다', async () => {
    const ctx = new FakeContext();
    const a = fx.ambience(ctx, { scene: 'subway', level: 0.5, band: 'phone', amount: 1, timers: fakeTimers(), hidden: () => false, watchVisibility: false });
    const src = [...ctx.live][0];
    const p = route(src, ctx.destination);
    const hp = p.filter(n => n.kind === 'biquad' && n.type === 'highpass');
    assert.ok(hp.some(n => Math.abs(n.frequency.value - 300) < 1));
    a.stop();
});

await test('생활 소음: 사건음은 타이머 하나로만 (stop 하면 타이머 · 소리 · 노드 · 화면 감시 모두 풀림)', async () => {
    const ctx = new FakeContext();
    const timers = fakeTimers();
    const a = fx.ambience(ctx, { scene: 'street', level: 0.5, timers, hidden: () => false, watchVisibility: false });
    assert.equal(timers.map.size, 1);
    const before = ctx.made.length;
    timers.fireAll();                               // 차 지나가는 소리 하나
    assert.ok(ctx.made.length > before, '사건음 노드가 생겨야 해요');
    assert.equal(timers.map.size, 1, '다음 사건음 하나만 걸려 있어야 해요');
    a.stop();
    assert.equal(timers.map.size, 0);
    // 사건음은 stop 으로 끊지 않아도 끝나면(onended) 스스로 풀린다 — 여기서는 남은 것도 멈춘다
    for (const s of [...ctx.live]) s.stop();
    for (const n of ctx.made.slice(0, before)) if (n.kind !== 'destination') assert.ok(n.cut, `안 끊긴 ${n.kind}`);
    a.duck(true); a.setLevel(1); a.stop();      // 멈춘 뒤 불러도 조용히
    assert.equal(ctx.live.size, 0);
    const room = fx.ambience(new FakeContext(), { scene: 'room', timers, hidden: () => false, watchVisibility: false });
    assert.equal(timers.map.size, 0, '조용한 방은 사건음 타이머가 없어요');
    room.stop();
});

await test('생활 소음: 화면이 숨으면 멈추고 돌아오면 다시 깔린다, stop 뒤엔 감시도 없다', async () => {
    const ctx = new FakeContext();
    const timers = fakeTimers();
    doc.hidden = true;
    const a = fx.ambience(ctx, { scene: 'cafe', level: 0.5, timers, hidden: () => doc.hidden });
    assert.equal(a.running, false);
    assert.equal(ctx.live.size, 0);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(a.running, true);
    assert.ok(ctx.live.size > 0);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(a.running, false);
    assert.equal(ctx.live.size, 0);
    assert.equal(timers.map.size, 0);
    a.stop();
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(a.running, false);
    assert.equal(ctx.live.size, 0);
});

await test('생활 소음: 모르는 장면은 거절, 잡음 고리는 쓰는 동안 한 번만 만들고 다 끝나면 버린다', async () => {
    assert.throws(() => fx.ambience(new FakeContext(), { scene: 'moon', watchVisibility: false }));
    const ctx = new FakeContext();
    let made = 0;
    const orig = ctx.createBuffer.bind(ctx);
    ctx.createBuffer = (...a) => { made++; return orig(...a); };
    const keep = fx.voiceChain(ctx, { filter: 'phone' });   // 살아 있는 묶음이 있으면 고리를 들고 있다
    for (let i = 0; i < 3; i++) fx.ambience(ctx, { scene: 'rain', timers: fakeTimers(), hidden: () => false, watchVisibility: false }).stop();
    assert.equal(made, 3, '흰 · 갈색 · 빗방울 고리 세 개만');
    keep.dispose();                                          // 다 풀리면 버리고, 다음 통화에 다시 만든다
    fx.ambience(ctx, { scene: 'rain', timers: fakeTimers(), hidden: () => false, watchVisibility: false }).stop();
    assert.equal(made, 6);
});

await test('배경 추천: 마지막에 나온 장소, 비슷한 낱말은 피한다', async () => {
    assert.equal(fx.suggestScene('지금 지하철 타고 가는 중이야'), 'subway');
    assert.equal(fx.suggestScene('카페에서 나와서 버스 정류장으로 걸어가'), 'bus');
    assert.equal(fx.suggestScene('버스에서 내려 카페에 들어왔어'), 'cafe');
    assert.equal(fx.suggestScene('밖에 비가 와서 우산을 폈어'), 'rain');
    assert.equal(fx.suggestScene('준비가 다 됐어'), '');
    assert.equal(fx.suggestScene('거리가 너무 멀어'), '');
    assert.equal(fx.suggestScene("I'm on the subway now"), 'subway');
    assert.equal(fx.suggestScene(''), '');
});

await test('불러오기: 다른 확장용 API 에서 부를 때만 불러오고, 다른 곳에서 미리 읽지 않는다', async () => {
    const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    assert.ok(/callFx: \(\) => import\('\.\/src\/fx-call\.js'\)/.test(index));
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
    for (const f of walk(root)) {
        if (f.endsWith('fx-call.js')) continue;
        const s = fs.readFileSync(f, 'utf8');
        assert.ok(!/^\s*import\b[^;]*fx-call/m.test(s), `${path.basename(f)} 가 fx-call.js 를 바로 불러와요`);
    }
});

console.log(`tts-call-fx: ${passed} passed, 0 failed`);
