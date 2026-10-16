// 장면 소리 합성 (6.9.8): WebAudio 노드 몇 개로 빗소리 · 바람 · 낮은 바람 · 물결 · 천둥을 만든다 — 음원 파일 없음(저작권 자료 없음 · 용량 0).
// 모든 소리의 재료는 4초짜리 흰 잡음 버퍼 하나(소리판마다 한 번 만들어 둔다). 필터 · 느린 LFO 로 결을 낸다.
// 타이머에 기대지 않는다(숨은 탭에서 타이머가 느려져도 소리가 끊기지 않게) — 천둥만 호출하는 쪽(scene-sound.js)이 때를 정한다.
// 순수하게 소리판(AudioContext 모양)만 받는다 → 시험은 가짜 소리판으로 (tools/tests/scene-sound.mjs).
const buffers = new WeakMap();   // ctx → 잡음 버퍼
const SECONDS = 4;

/** 소리판마다 한 번: 같은 씨앗으로 만든 흰 잡음 (반복해도 이음새가 안 들리게 끝을 처음에 살짝 섞는다) */
export function noiseBuffer(ctx) {
    let buffer = buffers.get(ctx);
    if (buffer) return buffer;
    const rate = ctx.sampleRate || 48000, length = Math.round(rate * SECONDS);
    buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e3779b1;
    for (let i = 0; i < length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = (seed / 4294967296) * 2 - 1; }
    const blend = Math.min(length >> 1, Math.round(rate * 0.05));
    for (let i = 0; i < blend; i++) { const t = i / blend; data[length - blend + i] = data[length - blend + i] * (1 - t) + data[i] * t; }
    buffers.set(ctx, buffer);
    return buffer;
}

function source(ctx, buffer, rate = 1, offset = 0) {
    const node = ctx.createBufferSource();
    node.buffer = buffer; node.loop = true;
    if (rate !== 1) node.playbackRate.value = rate;
    node._offset = offset;   // start(at, offset) — 두 잡음이 같은 자리에서 시작하면 한 소리로 들린다
    return node;
}
function filter(ctx, type, frequency, Q) {
    const node = ctx.createBiquadFilter();
    node.type = type; node.frequency.value = frequency; node.Q.value = Q;
    return node;
}
function gain(ctx, value) { const node = ctx.createGain(); node.gain.value = value; return node; }
/** 느린 사인 LFO: osc → depth → param (base 는 param 의 중심값) */
function lfo(ctx, hz, depth, param) {
    const osc = ctx.createOscillator(), amount = gain(ctx, depth);
    osc.type = 'sine'; osc.frequency.value = hz;
    osc.connect(amount); amount.connect(param);
    return [osc, amount];
}

/** 종류별 결: 소리의 기본 크기(trim)는 종류마다 달라 마스터 크기 하나로 비슷하게 들리게 */
export const TRIM = Object.freeze({ rain: 1, wind: 0.9, hush: 0.5, water: 0.9, file: 1 });

/** 목소리 하나: { kind, gain(출구 GainNode — 호출하는 쪽이 마스터에 잇는다), start(at), stop(at), nodes, file }
 *  buffer 를 주면 합성 대신 그 소리(내 파일)를 끊김 없이 반복한다 */
export function buildVoice(ctx, kind, { buffer = null } = {}) {
    const out = gain(ctx, 0);   // 페이드는 scene-sound.js 가 이 게인에 건다 (0 에서 시작)
    const nodes = [out], sources = [], oscs = [];
    const chain = (...list) => { for (let i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]); nodes.push(...list.filter(n => !nodes.includes(n))); };
    if (buffer) {
        const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
        chain(src, out); sources.push(src);
    } else {
        const noise = noiseBuffer(ctx);
        if (kind === 'rain') {
            // 몸통: 낮게 깔리는 쏴아 + 결: 높은 띠를 느린 LFO 두 개로 흔들어 빗방울이 고르지 않게
            const body = source(ctx, noise), low = filter(ctx, 'lowpass', 1000, 0.4), bodyGain = gain(ctx, 0.85);
            chain(body, low, bodyGain, out);
            const patter = source(ctx, noise, 1.17, 1.3), band = filter(ctx, 'bandpass', 2600, 0.9), patterGain = gain(ctx, 0.36);
            chain(patter, band, patterGain, out);
            const [o1, a1] = lfo(ctx, 0.37, 0.11, patterGain.gain), [o2, a2] = lfo(ctx, 2.3, 0.06, patterGain.gain);
            sources.push(body, patter); oscs.push(o1, o2); nodes.push(o1, a1, o2, a2);
        } else if (kind === 'wind' || kind === 'hush') {
            // 바람: 띠 필터의 중심을 천천히 옮기고(쉬이— 쉬이—) 크기도 다른 박자로 흔들어 돌풍처럼. 낮은 바람(눈 · 안개)은 더 낮고 작고 느리게
            const soft = kind === 'hush';
            const src = source(ctx, noise), band = filter(ctx, 'bandpass', soft ? 220 : 600, soft ? 0.7 : 0.9), level = gain(ctx, soft ? 0.3 : 0.8);
            chain(src, band, level, out);
            const [o1, a1] = lfo(ctx, soft ? 0.05 : 0.11, soft ? 90 : 280, band.frequency), [o2, a2] = lfo(ctx, soft ? 0.031 : 0.053, soft ? 0.11 : 0.28, level.gain);
            sources.push(src); oscs.push(o1, o2); nodes.push(o1, a1, o2, a2);
        } else if (kind === 'water') {
            // 물결: 낮은 쏴아를 아주 느린 LFO(큰 너울) + 조금 빠른 LFO(찰랑임)로, 그 위에 높은 띠를 살짝(물방울 · 거품)
            const src = source(ctx, noise), low = filter(ctx, 'lowpass', 420, 0.6), level = gain(ctx, 0.75);
            chain(src, low, level, out);
            const [o1, a1] = lfo(ctx, 0.09, 0.45, level.gain), [o2, a2] = lfo(ctx, 0.23, 0.18, level.gain);
            const spray = source(ctx, noise, 0.93, 2.1), band = filter(ctx, 'bandpass', 1800, 1.5), sprayGain = gain(ctx, 0.13);
            chain(spray, band, sprayGain, out);
            const [o3, a3] = lfo(ctx, 0.16, 0.1, sprayGain.gain);
            sources.push(src, spray); oscs.push(o1, o2, o3); nodes.push(o1, a1, o2, a2, o3, a3);
        } else throw new Error(`모르는 장면 소리: ${kind}`);
    }
    let started = false, stopped = false;
    return {
        kind, gain: out, file: !!buffer, trim: buffer ? TRIM.file : TRIM[kind], nodes: nodes.length,
        start(at = ctx.currentTime) {
            if (started) return; started = true;
            for (const src of sources) src.start(at, src._offset || 0);
            for (const osc of oscs) osc.start(at);
        },
        /** 페이드가 끝난 뒤에 부른다 — 모든 노드를 떼어 그래프에서 지운다 */
        stop(at = ctx.currentTime) {
            if (stopped) return; stopped = true;
            const tail = Math.max(at, ctx.currentTime);
            for (const src of sources) { try { if (started) src.stop(tail); } catch { /* 이미 멈춤 */ } }
            for (const osc of oscs) { try { if (started) osc.stop(tail); } catch { /* 이미 멈춤 */ } }
            const release = () => { for (const node of nodes) { try { node.disconnect(); } catch { /* 이미 뗌 */ } } };
            const wait = Math.max(0, (tail - ctx.currentTime) * 1000) + 20;
            if (typeof setTimeout === 'function') setTimeout(release, wait); else release();
        },
    };
}

/** 천둥 한 번: 낮은 잡음에 봉우리 → 긴 꼬리. 끝나면 스스로 떨어진다. dest 는 목소리 출구(비 게인) 또는 마스터.
 *  120Hz 아래만 남긴 흰 잡음은 아주 작아(힘의 0.5%) 봉우리 게인을 크게 둔다(THUNDER_BOOST) — 격리 측정(소리 크기 60%): 출력 RMS 봉우리가 빗소리의 약 1.9배, 클리핑 없음 */
export const THUNDER_BOOST = 5;
export function strikeThunder(ctx, dest, { at = ctx.currentTime, rand = Math.random() } = {}) {
    const r = Math.max(0, Math.min(1, Number(rand) || 0));
    const length = 3 + r * 3, peak = (0.55 + r * 0.35) * THUNDER_BOOST;
    const src = source(ctx, noiseBuffer(ctx), 0.6 + r * 0.3, 0.7), deep = filter(ctx, 'lowpass', 120, 1.4), shape = filter(ctx, 'lowpass', 220, 0.7), env = gain(ctx, 0);
    src.connect(deep); deep.connect(shape); shape.connect(env); env.connect(dest);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.15);
    env.gain.exponentialRampToValueAtTime(Math.max(0.05, peak * 0.4), at + 0.9);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.start(at, src._offset); src.stop(at + length + 0.1);
    src.onended = () => { for (const node of [src, deep, shape, env]) { try { node.disconnect(); } catch { /* 이미 뗌 */ } } };
    return { at, length, peak, stopAt: at + length + 0.1 };
}
