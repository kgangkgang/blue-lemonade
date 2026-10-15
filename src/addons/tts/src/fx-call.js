// TTS 1.9.0 통화 소리 효과 — 다른 확장이 자기 재생 길(<audio> → AudioContext)에 끼우는 WebAudio 노드 묶음.
// window.LemonVoice.callFx() 가 그때 이 파일을 불러온다 (통화를 시작할 때만 — 평소엔 읽지도 않는다).
// 소리 파일은 건드리지 않는다: 캐시된 음성은 그대로이고, 재생하는 동안에만 효과가 붙는다.
//   voiceChain(ctx, { filter, amount }) → { input, output, dispose() }   목소리 필터 (휴대폰 · 무전기 · 스피커폰)
//   ambience(ctx, { scene, level, band, amount, destination }) → { output, duck(on), setLevel(v), stop() }
//       생활 소음 — 음원 없이 합성 (걸러 낸 잡음 + 낮은 웅웅거림 + 가끔 짧은 사건음). 말소리보다 늘 작고, 말하는 동안 더 줄어든다.
//       화면이 숨으면 멈췄다가 돌아오면 다시 깔린다. stop() 하면 바로 조용해지고 노드 · 타이머가 모두 풀린다.
//   suggestScene(text) → 'subway' | 'bus' | … | ''   글 속 낱말로 배경 추천 (마지막에 나온 장소)

export const FILTERS = Object.freeze([
    { id: 'phone', label: '휴대폰' },
    { id: 'radio', label: '무전기' },
    { id: 'speaker', label: '스피커폰' },
]);
export const SCENES = Object.freeze([
    { id: 'subway', label: '지하철' },
    { id: 'bus', label: '버스' },
    { id: 'street', label: '거리' },
    { id: 'cafe', label: '카페' },
    { id: 'rain', label: '비 오는 날' },
    { id: 'room', label: '조용한 방' },
]);

// 대역 (amount 1 일 때). amount 가 작으면 넓은 대역(60 Hz ~ 12 kHz)에서 여기로 좁아진다 (기본 0.7 이면 거의 다 좁아짐)
const BANDS = {
    phone: { lo: 300, hi: 3400, peak: 1800, peakDb: 3, drive: 2.5, comp: -24, ratio: 4, hiss: 0.0028 },
    radio: { lo: 480, hi: 2700, peak: 1500, peakDb: 5, drive: 7, comp: -28, ratio: 6, hiss: 0.006 },
    speaker: { lo: 200, hi: 5200, peak: 900, peakDb: 2.5, drive: 1.2, comp: -22, ratio: 3, hiss: 0.0012, room: 0.28 },
};
// 크기 맞춤 (dB, amount 0.25 · 0.5 · 0.75 · 1 에서 잰 값 — 사이는 직선). 압축기의 자동 보정 · 포화 때문에 커지는 만큼을
// 되돌려 -20 dBFS 말소리가 필터를 지나도 1 dB 안쪽으로 작게 나오게 (브라우저 OfflineAudioContext 로 잼)
const VOICE_TRIM = {
    phone: [-6.4, -4.3, -5.0, -5.6],
    radio: [-8.6, -8.8, -9.2, -8.8],
    speaker: [-5.8, -4.9, -3.7, -4.1],
};
const NOISE_RATE = 22050;   // 잡음 고리는 이 표본율로 한 번 만든다 (4초 = 88 200 표본, 약 350 KB)
const NOISE_SEC = 4;
const clamp01 = v => Math.min(1, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0));
const lerpLog = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const ease = t => 1 - (1 - t) ** 2;
/** [0.25, 0.5, 0.75, 1] 에서 잰 값 사이를 직선으로 (0 에서는 0) */
const table = (row, t) => {
    const x = clamp01(t) * 4, i = Math.floor(x), pts = [0, ...row];
    return i >= 4 ? pts[4] : pts[i] + (pts[i + 1] - pts[i]) * (x - i);
};
const dbToGain = db => 10 ** (db / 20);

/** 같은 씨앗 → 같은 잡음 (시험이 매번 같은 값) */
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 맥락별 잡음 고리 (흰 · 갈색 · 덜컹 · 빗방울). 쓰는 묶음이 하나라도 살아 있는 동안만 들고 있다 (다 풀리면 버림 — 고리 하나 약 350 KB)
const buffers = new WeakMap();
const users = new WeakMap();
const hold = ctx => users.set(ctx, (users.get(ctx) || 0) + 1);
const letGo = ctx => { const n = (users.get(ctx) || 1) - 1; if (n > 0) users.set(ctx, n); else { users.delete(ctx); buffers.delete(ctx); } };
function noise(ctx, kind) {
    let m = buffers.get(ctx);
    if (!m) buffers.set(ctx, m = new Map());
    if (m.has(kind)) return m.get(kind);
    const len = NOISE_RATE * NOISE_SEC;
    const b = ctx.createBuffer(1, len, NOISE_RATE);
    const d = b.getChannelData(0);
    const r = rng(kind.length * 7919 + 17);
    if (kind === 'white') {
        for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    } else if (kind === 'brown') {
        let v = 0;
        for (let i = 0; i < len; i++) { v = (v + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = v * 3.5; }
        // 고리 이음매가 '톡' 하지 않게 끝을 처음 값으로 0.1초 동안 이어 준다
        const n = NOISE_RATE / 10;
        for (let i = 0; i < n; i++) { const t = i / n; d[len - n + i] = d[len - n + i] * (1 - t) + d[i] * t; }
    } else if (kind === 'clack') {
        // 덜-컹: 레일 이음매 두 번 (0 · 0.17초), 짧게 사그라지는 잡음 덩어리
        for (const at of [0.05, 0.22, 2.05, 2.22]) {
            const s = Math.round(at * NOISE_RATE);
            for (let i = 0; i < NOISE_RATE * 0.05; i++) d[s + i] += (r() * 2 - 1) * Math.exp(-i / (NOISE_RATE * 0.012));
        }
    } else if (kind === 'drops') {
        // 빗방울: 성기게 떨어지는 아주 짧은 '톡'
        for (let k = 0; k < 70; k++) {
            const s = Math.floor(r() * (len - 400));
            const a = 0.3 + r() * 0.7;
            for (let i = 0; i < 300; i++) d[s + i] += a * (r() * 2 - 1) * Math.exp(-i / 45);
        }
    }
    m.set(kind, b);
    return b;
}

/** 부드러운 포화: tanh(k·x)/tanh(k) — drive 1 이면 거의 그대로 */
function satCurve(drive) {
    const n = 1024, c = new Float32Array(n), k = Math.max(0.01, drive), norm = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
    return c;
}

/** 하나의 소리 덩어리 기록: 다 만들고 나면 한꺼번에 멈추고 끊는다 */
function bag(ctx) {
    const nodes = [], sources = [];
    let holding = false;
    return {
        node(n) { nodes.push(n); return n; },
        src(s) { sources.push(s); nodes.push(s); return s; },
        filter(type, freq, q = 0.707, gainDb = 0) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; if (gainDb) f.gain.value = gainDb; return this.node(f); },
        gain(v) { const g = ctx.createGain(); g.gain.value = v; return this.node(g); },
        loop(kind, rate = 1) {
            if (!holding) { holding = true; hold(ctx); }
            const s = ctx.createBufferSource(); s.buffer = noise(ctx, kind); s.loop = true; s.playbackRate.value = rate; return this.src(s);
        },
        osc(type, freq) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return this.src(o); },
        start(t) { for (const s of sources) { try { s.start(t); } catch { /* 이미 시작 */ } } },
        free() {
            for (const s of sources) { try { s.stop(); } catch { /* 시작 전 · 이미 멈춤 */ } }
            for (const n of nodes) { try { n.disconnect(); } catch { /* 이미 끊김 */ } }
            nodes.length = 0; sources.length = 0;
            if (holding) { holding = false; letGo(ctx); }
        },
        get size() { return nodes.length; },
    };
}

/** 대역 거르개 두 단(24 dB/옥타브) — 목소리와 배경이 같은 전화선을 지나게 */
function bandNodes(b, ctx, id, amount) {
    const p = BANDS[id];
    if (!p) return null;
    const t = clamp01(amount);
    const e = ease(t);
    const lo = lerpLog(60, p.lo, e), hi = lerpLog(12000, p.hi, e);
    const list = [b.filter('highpass', lo), b.filter('highpass', lo), b.filter('lowpass', hi), b.filter('lowpass', hi)];
    for (let i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]);
    return { input: list[0], output: list.at(-1) };
}

/**
 * 목소리 필터. ctx 는 재생하는 쪽의 AudioContext (또는 OfflineAudioContext).
 * source → input … output → destination 으로 잇고, 다 쓰면 dispose() (잡음 고리까지 멈춘다).
 * filter 가 모르는 값이면 그대로 통과(input === output 인 Gain 하나).
 */
export function voiceChain(ctx, { filter = 'phone', amount = 0.7 } = {}) {
    const b = bag(ctx);
    const p = BANDS[filter];
    const t = clamp01(amount);
    const input = b.gain(1);
    if (!p || t <= 0) return { input, output: input, filter: '', nodes: b.size, dispose: () => b.free() };
    const band = bandNodes(b, ctx, filter, t);
    const peak = b.filter('peaking', p.peak, 0.9, p.peakDb * t);
    const shaper = b.node(ctx.createWaveShaper());
    shaper.curve = satCurve(1 + (p.drive - 1) * t);
    const comp = b.node(ctx.createDynamicsCompressor());
    comp.threshold.value = p.comp * t;
    comp.ratio.value = 1 + (p.ratio - 1) * t;
    comp.attack.value = 0.008;
    comp.release.value = 0.15;
    const output = b.gain(dbToGain(table(VOICE_TRIM[filter], t)));
    input.connect(band.input);
    band.output.connect(peak).connect(shaper).connect(comp).connect(output);
    if (p.room) {
        // 스피커폰: 방에 한 번 울린 소리 (짧은 되먹임 지연 — 잔향 파일 없이)
        const send = b.gain(p.room * t), delay = b.node(ctx.createDelay(0.1)), fb = b.gain(0.32), damp = b.filter('lowpass', 2400);
        delay.delayTime.value = 0.021;
        comp.connect(send).connect(delay).connect(damp).connect(fb).connect(delay);
        damp.connect(output);
    }
    if (p.hiss > 0) {
        // 아주 약한 선 잡음 (말하는 동안만 — 줄이 끝나면 dispose 로 같이 멈춘다)
        const hiss = b.loop('white', 1);
        hiss.connect(b.filter('bandpass', 2000, 0.5)).connect(b.gain(p.hiss * t)).connect(output);
        b.start(ctx.currentTime);
    }
    return { input, output, filter, nodes: b.size, dispose: () => b.free() };
}

// ---------- 생활 소음
// 배경 크기: level 0~1 → RMS -50 ~ -30 dBFS (기본 0.4 = -42). TTS 말소리는 -20 dBFS 언저리라 가장 커도 10 dB 작다
const LEVEL_DB = [-50, -30];
const DUCK_DB = -9;   // 말하는 동안 더 줄임
// 장면마다 합친 층을 0 dBFS RMS 로 맞추는 값 (dB) — 대역 없음 · 전화선 대역(amount 1)별로 잼. 사이는 ease(amount) 로 직선.
// 좁은 대역이 저음을 거의 다 걷어 내는 장면은 32 dB 안팎까지만 올린다 (잡음만 커지지 않게) — 그래서 전화선을 지나면 조금 더 작다
const BED_TRIM = {
    subway: { '': 15.7, phone: 30.4, radio: 32, speaker: 23.9 },
    bus: { '': 15.3, phone: 32, radio: 32, speaker: 26.2 },
    street: { '': 19.2, phone: 24.4, radio: 27.4, speaker: 22.8 },
    cafe: { '': 26.2, phone: 32, radio: 32, speaker: 31.3 },
    rain: { '': 20.3, phone: 23.6, radio: 25, speaker: 21.9 },
    room: { '': 23.5, phone: 34, radio: 34, speaker: 30 },
};
const SCENE_DEF = {
    subway: {
        bed(b, out) {
            const rumble = b.loop('brown', 1);
            const swell = b.gain(0.8);
            rumble.connect(b.filter('lowpass', 180)).connect(swell).connect(out);
            const lfo = b.osc('sine', 0.11), depth = b.gain(0.22);
            lfo.connect(depth).connect(swell.gain);
            b.osc('sine', 52).connect(b.gain(0.05)).connect(out);
            b.osc('sine', 104).connect(b.gain(0.02)).connect(out);
            b.loop('white', 0.93).connect(b.filter('bandpass', 2600, 0.8)).connect(b.gain(0.035)).connect(out);
            b.loop('clack', 1).connect(b.filter('lowpass', 900)).connect(b.gain(0.5)).connect(out);
        },
        every: [35, 80],
        event: (ctx, out, t) => chime(ctx, out, t, [[0, 784], [0.3, 659], [0.6, 523]], 0.05),
    },
    bus: {
        bed(b, out) {
            b.loop('brown', 0.9).connect(b.filter('lowpass', 150)).connect(b.gain(0.9)).connect(out);
            const engine = b.osc('sawtooth', 34);
            const rev = b.osc('sine', 0.07), revDepth = b.gain(5);
            rev.connect(revDepth).connect(engine.frequency);
            engine.connect(b.filter('lowpass', 120)).connect(b.gain(0.06)).connect(out);
            b.loop('white', 1.07).connect(b.filter('bandpass', 900, 0.5)).connect(b.gain(0.025)).connect(out);
        },
        every: [20, 50],
        event: (ctx, out, t, r) => (r() < 0.6 ? hissBurst(ctx, out, t, 3200, 0.7, 0.06) : chime(ctx, out, t, [[0, 1760]], 0.035)),
    },
    street: {
        bed(b, out) {
            b.loop('brown', 1).connect(b.filter('lowpass', 600)).connect(b.gain(0.55)).connect(out);
            b.loop('white', 0.97).connect(b.filter('bandpass', 1200, 0.4)).connect(b.gain(0.03)).connect(out);
        },
        every: [6, 16],
        event: (ctx, out, t, r) => { carPass(ctx, out, t, 2.5 + r() * 2); if (r() < 0.12) horn(ctx, out, t + 0.8); },
    },
    cafe: {
        bed(b, out) {
            const murmur = b.gain(0.06);
            b.loop('white', 1).connect(b.filter('bandpass', 600, 0.7)).connect(murmur).connect(out);
            for (const [hz, d] of [[0.7, 0.02], [1.3, 0.015], [0.37, 0.015]]) b.osc('sine', hz).connect(b.gain(d)).connect(murmur.gain);
            b.loop('white', 0.9).connect(b.filter('bandpass', 1700, 1)).connect(b.gain(0.012)).connect(out);
            b.loop('brown', 1).connect(b.filter('lowpass', 250)).connect(b.gain(0.25)).connect(out);
        },
        every: [5, 14],
        event: (ctx, out, t, r) => (r() < 0.8 ? clink(ctx, out, t, 1 + (r() - 0.5) * 0.1) : hissBurst(ctx, out, t, 2000, 1.4, 0.012)),
    },
    rain: {
        bed(b, out) {
            b.loop('white', 1).connect(b.filter('highpass', 900)).connect(b.filter('lowpass', 7000)).connect(b.gain(0.11)).connect(out);
            b.loop('brown', 1).connect(b.filter('lowpass', 400)).connect(b.gain(0.4)).connect(out);
            b.loop('drops', 1).connect(b.filter('bandpass', 3000, 0.9)).connect(b.gain(0.18)).connect(out);
        },
        every: [40, 90],
        event: (ctx, out, t) => thunder(ctx, out, t),
    },
    room: {
        quiet: -8,   // 조용한 방은 다른 장면보다 8 dB 작게
        bed(b, out) {
            b.loop('brown', 1).connect(b.filter('lowpass', 160)).connect(b.gain(0.35)).connect(out);
            b.osc('sine', 60).connect(b.gain(0.004)).connect(out);
            b.loop('white', 1).connect(b.filter('highpass', 4000)).connect(b.gain(0.004)).connect(out);
        },
        every: null,
    },
};

// 사건음: 모두 스스로 멈추고 끝나면 끊긴다 (기록이 필요 없다)
function selfFree(...ns) { ns[0].onended = () => { for (const n of ns) { try { n.disconnect(); } catch { /* 이미 */ } } }; }
function chime(ctx, out, t, notes, vol) {
    for (const [at, hz] of notes) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = hz; o2.frequency.value = hz * 2.01;
        const s = t + at;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(vol, s + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.9);
        const g2 = ctx.createGain(); g2.gain.value = 0.25;
        o.connect(g); o2.connect(g2).connect(g); g.connect(out);
        o.start(s); o2.start(s); o.stop(s + 0.95); o2.stop(s + 0.95);
        selfFree(o, g); selfFree(o2, g2);
    }
}
function hissBurst(ctx, out, t, hz, len, vol) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(ctx, 'white'); f.type = 'highpass'; f.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + len + 0.05);
    selfFree(s, f, g);
}
function carPass(ctx, out, t, len) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(ctx, 'brown'); s.loop = true; f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900, t + len / 2);
    f.frequency.linearRampToValueAtTime(320, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + len / 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + len + 0.05);
    selfFree(s, f, g);
}
function horn(ctx, out, t) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + 0.02);
    g.gain.setValueAtTime(0.02, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    f.connect(g).connect(out);
    const os = [415, 523].map(hz => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz; o.connect(f); o.start(t); o.stop(t + 0.32); return o; });
    os[0].onended = () => { for (const n of [...os, f, g]) { try { n.disconnect(); } catch { /* 이미 */ } } };
}
function clink(ctx, out, t, pitch) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.012, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    g.connect(out);
    const os = [2650, 3970, 5210].map(hz => { const o = ctx.createOscillator(); o.frequency.value = hz * pitch; o.connect(g); o.start(t); o.stop(t + 0.32); return o; });
    os[0].onended = () => { for (const n of [...os, g]) { try { n.disconnect(); } catch { /* 이미 */ } } };
}
function thunder(ctx, out, t) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise(ctx, 'brown'); s.loop = true; f.type = 'lowpass'; f.frequency.value = 110;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.2, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + 4.1);
    selfFree(s, f, g);
}

/**
 * 생활 소음 한 판. destination 에 바로 이어진다 (기본 ctx.destination).
 * level 0~1 (기본 0.4) — RMS -50 ~ -30 dBFS 라 말소리(보통 -20 dBFS 언저리)보다 늘 작다.
 * band: 목소리 필터 id 를 주면 배경도 같은 전화선 대역을 지난다 (상대 쪽 소리가 전화로 들리듯).
 * timers: 시험용 { set, clear } (기본 setTimeout). hidden: 화면 숨김 여부 함수 (기본 document.hidden).
 */
export function ambience(ctx, { scene = 'room', level = 0.4, band = '', amount = 0.7, destination = null, seed = 1, timers = null, hidden = null, watchVisibility = true } = {}) {
    const def = SCENE_DEF[scene];
    if (!def) throw new Error(`모르는 배경이에요: ${scene}`);
    const T = timers || { set: (f, ms) => setTimeout(f, ms), clear: id => clearTimeout(id) };
    const isHidden = hidden || (() => !!globalThis.document?.hidden);
    const r = rng(seed);
    const outer = bag(ctx);
    const master = outer.gain(0);
    const trims = BED_TRIM[scene];
    const bandId = BANDS[band] ? band : '';
    const bus = outer.gain(dbToGain(trims[''] + (bandId ? (trims[bandId] - trims['']) * ease(clamp01(amount)) : 0) + (def.quiet || 0)));
    let tail = master;
    const wire = bandNodes(outer, ctx, band, amount);
    if (wire) { master.connect(wire.input); tail = wire.output; }
    bus.connect(master);
    tail.connect(destination || ctx.destination);
    let lvl = clamp01(level), ducked = false, layers = null, timer = null, stopped = false;
    const target = () => (lvl <= 0 ? 0 : dbToGain(LEVEL_DB[0] + (LEVEL_DB[1] - LEVEL_DB[0]) * lvl + (ducked ? DUCK_DB : 0)));
    const glide = (v, tc = 0.12) => { const now = ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(v, now, tc); };
    const schedule = () => {
        if (!def.every || stopped || !layers) return;
        const [a, z] = def.every;
        timer = T.set(() => {
            timer = null;
            if (stopped || !layers) return;
            try { def.event(ctx, bus, ctx.currentTime + 0.05, r); } catch { /* 사건음 하나 빠져도 그만 */ }
            schedule();
        }, (a + r() * (z - a)) * 1000);
    };
    const up = () => {
        if (layers || stopped) return;
        layers = bag(ctx);
        def.bed(layers, bus);
        layers.start(ctx.currentTime);
        glide(target(), 0.6);   // 서서히 깔린다
        schedule();
    };
    const down = () => {
        if (timer != null) { T.clear(timer); timer = null; }
        if (!layers) return;
        master.gain.cancelScheduledValues(0);
        master.gain.setValueAtTime(0, ctx.currentTime);
        layers.free();
        layers = null;
    };
    const onVis = () => (isHidden() ? down() : up());
    const doc = watchVisibility ? globalThis.document : null;
    doc?.addEventListener?.('visibilitychange', onVis);
    if (!isHidden()) up();
    return {
        scene,
        output: tail,
        get running() { return !!layers; },
        get gain() { return target(); },
        /** 말하는 동안 true — 배경이 9 dB 더 줄어든다 */
        duck(on) { ducked = !!on; if (layers) glide(target()); },
        setLevel(v) { lvl = clamp01(v); if (layers) glide(target()); },
        /** 바로 조용히. 노드 · 고리 · 타이머 · 화면 감시 모두 풀린다 (다시 쓰려면 새로 만든다) */
        stop() {
            if (stopped) return;
            stopped = true;
            down();
            doc?.removeEventListener?.('visibilitychange', onVis);
            outer.free();
        },
    };
}

// ---------- 배경 추천 (선택 사항): 글에 나온 장소 중 마지막 것
const HINTS = [
    ['subway', /지하철|전철|지하철역|승강장|스크린도어|환승|\bsubway\b|\bmetro\b|\bplatform\b|\bunderground\b/gi],
    ['bus', /버스|정류장|\bbus\b|\bbus stop\b/gi],
    ['cafe', /카페|커피숍|커피 ?전문점|\bcaf[eé]\b|\bcoffee ?shop\b/gi],
    ['rain', /(?<![가-힣])비가 (?:와|오|내리|쏟)|(?<![가-힣])비 오는|빗소리|빗줄기|빗방울|소[나]기|장맛비|우산을|\braining\b|\brain\b|\bdownpour\b/gi],
    ['street', /길거리|거리를 (?:걷|걸)|거리에서|길가|횡단보도|사거리|교차로|\bstreet\b|\bcrosswalk\b|\bsidewalk\b/gi],
    ['room', /방 ?안|침대|이불|자취방|기숙사|\bbedroom\b|\bin bed\b/gi],
];
export function suggestScene(text) {
    const s = String(text || '');
    let best = '', at = -1;
    for (const [id, re] of HINTS) {
        re.lastIndex = 0;
        let m, last = -1;
        while ((m = re.exec(s))) last = m.index;
        if (last > at) { at = last; best = id; }
    }
    return best;
}
