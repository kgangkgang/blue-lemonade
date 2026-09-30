// TTS 음량 고르기: ITU-R BS.1770 근사 측정 → 이득 → 소프트 리미터 → 16비트 모노 WAV
// ST 모듈을 들여오지 않는다 (순수 계산 부분은 node 에서 그대로 테스트 가능)

const LOUD_OFFSET = -0.691;  // BS.1770 상수
const ABS_GATE = -70;        // 절대 게이트 (LUFS)
const REL_GATE = -10;        // 상대 게이트 (LU)
const STEP_MS = 100;         // 400 ms 블록, 75 % 겹침 → 100 ms 걸음
const GAIN_MIN = -12, GAIN_MAX = 18;   // 이득 한계 (dB)
const LIMIT_DB = -1.5;       // 이 위로는 소프트 클립
const DECODE_RATE = 44100;   // OfflineAudioContext 표본율 (디코드 결과도 이 표본율)

// K-가중 필터 규격값 (BS.1770-4)
export const K_SHELF = { f0: 1681.974450955533, G: 3.999843853973347, Q: 0.7071752369554196 };
export const K_HPF = { f0: 38.13547087602444, Q: 0.5003270373238773 };

/** 표본율에 맞는 K-가중 바이쿼드 두 단 { shelf, hpf } (a0 = 1 로 정규화) */
export function kWeighting(rate) {
    const fs = Number(rate) > 0 ? Number(rate) : 48000;
    // 1단: 고역 셸프 (+4 dB)
    let K = Math.tan(Math.PI * K_SHELF.f0 / fs);
    const Vh = Math.pow(10, K_SHELF.G / 20);
    const Vb = Math.pow(Vh, 0.499666774155);
    let a0 = 1 + K / K_SHELF.Q + K * K;
    const shelf = {
        b0: (Vh + Vb * K / K_SHELF.Q + K * K) / a0,
        b1: 2 * (K * K - Vh) / a0,
        b2: (Vh - Vb * K / K_SHELF.Q + K * K) / a0,
        a1: 2 * (K * K - 1) / a0,
        a2: (1 - K / K_SHELF.Q + K * K) / a0,
    };
    // 2단: 저역 차단 (RLB) — 규격대로 b = [1, -2, 1]
    K = Math.tan(Math.PI * K_HPF.f0 / fs);
    a0 = 1 + K / K_HPF.Q + K * K;
    const hpf = {
        b0: 1, b1: -2, b2: 1,
        a1: 2 * (K * K - 1) / a0,
        a2: (1 - K / K_HPF.Q + K * K) / a0,
    };
    return { shelf, hpf };
}

/** 바이쿼드 제자리 필터 (전치 직접형 II) */
export function biquad(x, c) {
    const { b0, b1, b2, a1, a2 } = c;
    let s1 = 0, s2 = 0;
    for (let i = 0; i < x.length; i++) {
        const v = x[i];
        const y = b0 * v + s1;
        s1 = b1 * v - a1 * y + s2;
        s2 = b2 * v - a2 * y;
        x[i] = y;
    }
    return x;
}

/** K-가중 신호 (새 배열) */
export function kWeight(samples, rate) {
    const y = new Float32Array(samples);
    const c = kWeighting(rate);
    biquad(y, c.shelf);
    biquad(y, c.hpf);
    return y;
}

const toLufs = (meanSq) => (meanSq > 0 ? LOUD_OFFSET + 10 * Math.log10(meanSq) : null);

/** 이미 K-가중된 신호의 게이트 적용 통합 음량 (LUFS). 잴 게 없으면 null */
export function gatedLoudness(w, rate) {
    const n = w.length;
    if (!n) return null;
    const step = Math.max(1, Math.round((Number(rate) || 48000) * STEP_MS / 1000));
    const block = step * 4;
    if (n < block) {
        // 400 ms 미만: 전체 RMS
        let s = 0;
        for (let i = 0; i < n; i++) s += w[i] * w[i];
        const l = toLufs(s / n);
        return l !== null && l > ABS_GATE ? l : null;
    }
    // 100 ms 조각 제곱합 → 400 ms 블록(75 % 겹침)의 평균 제곱
    const parts = Math.floor(n / step);
    const sums = new Float64Array(parts);
    for (let p = 0; p < parts; p++) {
        let s = 0;
        const o = p * step;
        for (let i = 0; i < step; i++) { const v = w[o + i]; s += v * v; }
        sums[p] = s;
    }
    const nb = parts - 3;
    const z = new Float64Array(nb);
    for (let j = 0; j < nb; j++) z[j] = (sums[j] + sums[j + 1] + sums[j + 2] + sums[j + 3]) / block;
    // 절대 게이트
    const absZ = Math.pow(10, (ABS_GATE - LOUD_OFFSET) / 10);
    let cnt = 0, acc = 0;
    for (let j = 0; j < nb; j++) if (z[j] > absZ) { acc += z[j]; cnt++; }
    if (!cnt) return null;
    // 상대 게이트: 절대 게이트 통과분 평균보다 10 LU 아래
    const relZ = (acc / cnt) * Math.pow(10, REL_GATE / 10);
    cnt = 0; acc = 0;
    for (let j = 0; j < nb; j++) if (z[j] > absZ && z[j] > relZ) { acc += z[j]; cnt++; }
    if (!cnt) return null;
    return toLufs(acc / cnt);
}

/** 원 신호의 통합 음량 (LUFS, 소수 첫째 자리). 무음이면 null */
export function integratedLoudness(samples, rate) {
    const l = gatedLoudness(kWeight(samples, rate), rate);
    return l === null ? null : Math.round(l * 10) / 10;
}

/**
 * 적용할 이득 (dB), clamp −12..+18. 1.2.5: 목소리 보정이 둘 —
 *   autoGainDb = 목소리 목록가 잰 원본 보정 (목표 − 그 목소리 샘플의 평균 LUFS) · gainDb = 사용자가 슬라이더로 준 추가 보정.
 * 음량 고르기 켬: (목표 − 이 소리의 측정 LUFS) + gainDb. 측정이 이미 목소리마다의 차이를 맞추므로 autoGainDb 는 더하지 않는다
 *   (1.2.4 는 목록 값이 gainDb 로 들어와 두 번 맞춤 → 일부 목소리는 작고, 다른 목소리는 리미터에 눌려 음색이 바뀜).
 * 끔 (또는 켬인데 디코드는 됐지만 무음이라 LUFS 를 못 잰 소리): autoGainDb + gainDb — 목록 값이 대신 맞춘다.
 *   디코드가 안 되면 prepare 가 여기 오기 전에 원본을 그대로 돌려준다 (이득 없음)
 */
export function computeGain(lufs, { normalize = true, targetLufs = -16, gainDb = 0, autoGainDb = 0 } = {}) {
    let g = Number(gainDb) || 0;
    if (normalize && Number.isFinite(lufs)) g += (Number.isFinite(Number(targetLufs)) ? Number(targetLufs) : -16) - lufs;
    else g += Number(autoGainDb) || 0;
    return Math.max(GAIN_MIN, Math.min(GAIN_MAX, g));
}

/** 이득 적용 + 소프트 리미터 (−1.5 dBFS 위는 e/(1+e) 무릎, 1.0 을 넘지 않음). 새 배열 */
export function applyGain(samples, gainDb) {
    const g = Math.pow(10, (Number(gainDb) || 0) / 20);
    const T = Math.pow(10, LIMIT_DB / 20);
    const R = 1 - T;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        let v = samples[i] * g;
        const a = v < 0 ? -v : v;
        if (a > T) {
            const e = (a - T) / R;
            const l = T + R * (e / (1 + e));
            v = v < 0 ? -l : l;
        }
        out[i] = v;
    }
    return out;
}

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** 16비트 PCM 모노 WAV (ArrayBuffer) */
export function encodeWav(samples, rate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    const tag = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    tag(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); tag(8, 'WAVE');
    tag(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);            // PCM
    dv.setUint16(22, 1, true);            // 모노
    dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * 2, true);     // 바이트/초
    dv.setUint16(32, 2, true);            // 블록 정렬
    dv.setUint16(34, 16, true);           // 비트
    tag(36, 'data'); dv.setUint32(40, n * 2, true);
    const pcm = LITTLE_ENDIAN ? new Int16Array(buf, 44, n) : null;
    for (let i = 0; i < n; i++) {
        let v = samples[i];
        v = v > 1 ? 1 : v < -1 ? -1 : v;
        const s = Math.round(v < 0 ? v * 32768 : v * 32767);
        if (pcm) pcm[i] = s; else dv.setInt16(44 + i * 2, s, true);
    }
    return buf;
}

// ---------- 브라우저 부분 (Web Audio)

let ctx = null;
async function decode(blob) {
    if (typeof OfflineAudioContext === 'undefined' || !blob || typeof blob.arrayBuffer !== 'function') return null;
    try {
        const buf = await blob.arrayBuffer();
        if (!ctx) ctx = new OfflineAudioContext(1, 1, DECODE_RATE);
        return await ctx.decodeAudioData(buf);
    } catch {
        return null;   // 디코드 실패 → 호출자가 원본 그대로 씀
    }
}

/** 채널 평균 → 모노 */
function monoOf(audio) {
    const ch = audio.numberOfChannels;
    if (ch === 1) return audio.getChannelData(0);
    const n = audio.length;
    const out = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
        const d = audio.getChannelData(c);
        for (let i = 0; i < n; i++) out[i] += d[i];
    }
    const k = 1 / ch;
    for (let i = 0; i < n; i++) out[i] *= k;
    return out;
}

/** 통합 음량만 재기 (LUFS | null) */
export async function measure(blob) {
    const audio = await decode(blob);
    if (!audio || !audio.length) return null;
    return integratedLoudness(monoOf(audio), audio.sampleRate);
}

/**
 * 음량 고르기: { normalize, targetLufs, gainDb, autoGainDb, lufs? } → { blob, lufs }
 * lufs 를 이미 알면(캐시) 다시 재지 않는다. 디코드 실패·이득 0 이면 원본 blob 그대로
 */
export async function prepare(blob, opts = {}) {
    const normalize = opts.normalize !== false;
    const gainDb = Number(opts.gainDb) || 0;
    const autoGainDb = Number(opts.autoGainDb) || 0;
    const known = Number.isFinite(opts.lufs) ? opts.lufs : null;
    if (!normalize && !gainDb && !autoGainDb) return { blob, lufs: known };
    const audio = await decode(blob);
    if (!audio || !audio.length) return { blob, lufs: known };
    const mono = monoOf(audio);
    const rate = audio.sampleRate;
    const lufs = known ?? integratedLoudness(mono, rate);
    const g = computeGain(lufs, { normalize, targetLufs: opts.targetLufs, gainDb, autoGainDb });
    if (Math.abs(g) < 0.05) return { blob, lufs };
    const wav = encodeWav(applyGain(mono, g), rate);
    return { blob: new Blob([wav], { type: 'audio/wav' }), lufs };
}
