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

// ---------- 저음 '쿵' 줄이기 (5.6.3, 2026-10-06)
// 사용자 제보: 폰에서 문장 끝(。 · 、 · .) 쉼마다 '똥' 하는 소리. 내려받은 음원 실측(우지엘 속마음): 쉼 자리에 40~70 ms 덩어리,
//   에너지의 90~99 % 가 150 Hz 아래 (주파수 45~55 Hz), 크기는 말소리만큼 (−11~−15 dBFS). 목소리가 아니라 복제 음성이 만드는 저음 덩어리.
//   PC 스피커는 이 대역을 거의 못 내서 안 들리고, 폰 이어폰에서 들린다.
// 70 Hz 저역 차단만으로는 5 dB 밖에 안 줄고(덩어리가 150 Hz 까지 퍼짐), 더 올리면 낮은 목소리의 기본음(73~80 Hz)이 깎인다.
// 그래서 '150 Hz 위가 거의 없는(< 8 %) 30 ms 창이 이어진 짧은(≤ 160 ms) 구간'이면서 '바로 앞이나 뒤 80 ms 가 무음(< −42 dBFS)'인 것만
// −30 dB 로 줄인다 (5 ms 램프). 덧붙여 구간 전체의 70 Hz 아래 비율이 40 % 이상인 것만 (목소리 기본음보다 낮은 소리) — 이 비율은
// 구간 앞뒤 50 ms 를 붙여 앞으로 · 뒤로 두 번 거른(지연 없는) 저역으로 잰다. 한쪽 방향 필터는 지연 때문에 소리가 잦아드는 창에서
// 비율이 1 을 넘게 부풀어 낮은 목소리의 말끝 꼬리 · 짧은 '응/うん' 을 쿵으로 잘못 봤다 (검토 실측: 꼬리 0.03~0.28 · 쿵 0.55~0.71).
// 무음 쪽 가장자리는 쿵 자신의 시작음 · 꼬리(무음 기준보다 큰 칸, 창 하나까지)를 덮도록 넓힌다 (말끝에 붙은 쿵 32.39 초가 8 → 30 dB).
// 말소리 창은 모음 에너지가 300~800 Hz 라 150 Hz 위 비율이 8 % 아래로 떨어지지 않는다.
export const THUMP = Object.freeze({
    hiHz: 150,        // 이 위가 말소리
    winMs: 30,        // 판단 창 (낮은 목소리 기본음 두 주기 이상)
    hopMs: 5,
    maxShare: 0.08,   // 창 에너지 중 150 Hz 위 비율이 이보다 작으면 저음뿐
    subHz: 70,        // 목소리 기본음(실측 최저 73 Hz)보다 낮은 대역
    minSub: 0.4,      // 구간 전체(지연 없는 저역)의 70 Hz 아래 비율이 이만큼은 돼야 '쿵' (실측 쿵 0.55~0.71 · 낮은 목소리 꼬리 · '음/ん' 0.03~0.28)
    padMs: 50,        // 지연 없는 저역을 잴 때 구간 앞뒤로 붙이는 길이
    minDb: -50,       // 이보다 조용한 창은 그냥 무음
    maxMs: 160,       // 이보다 긴 저음 구간은 건드리지 않음
    quietDb: -42,     // 앞 · 뒤 무음 기준
    edgeMs: [10, 90], // 구간 끝에서 10~90 ms 떨어진 곳을 앞 · 뒤로 봄
    floorDb: -30,     // 줄이는 정도
    rampMs: 5,
});

/** 4차 Butterworth (두 단) 계수 — low: 저역 통과, 아니면 고역 통과 */
function butter4(fc, rate, low = false) {
    const K = Math.tan(Math.PI * fc / rate);
    return [0.5411961, 1.3065630].map(Q => {
        const a0 = 1 + K / Q + K * K;
        const b = low ? [K * K / a0, 2 * K * K / a0, K * K / a0] : [1 / a0, -2 / a0, 1 / a0];
        return { b0: b[0], b1: b[1], b2: b[2], a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
    });
}

/** 바이쿼드 단들을 제자리로 (전치 직접형 II) */
function runStages(y, stages) { for (const c of stages) biquad(y, c); return y; }
/**
 * [start, end) 의 70 Hz 아래 에너지 비율 — 앞뒤 pad 를 붙여 앞으로 거르고 뒤집어 한 번 더 거른다 (지연 · 울림이 양쪽으로 상쇄돼
 * 잦아드는 소리에서도 비율이 1 을 넘지 않는다). 후보 구간에만 쓰므로 비용이 작다
 */
function lowShare(samples, start, end, stages, pad) {
    const lo = Math.max(0, start - pad), hi = Math.min(samples.length, end + pad);
    const y = runStages(samples.slice(lo, hi), stages);
    y.reverse(); runStages(y, stages); y.reverse();
    let e = 0, l = 0;
    for (let i = start; i < end; i++) { const v = samples[i], w = y[i - lo]; e += v * v; l += w * w; }
    return e > 0 ? l / e : 0;
}

/**
 * 쉼 자리 저음 덩어리를 줄인다 → { samples, regions }. 고칠 곳이 없으면 samples 는 받은 배열 그대로 (복사 안 함).
 * regions: [{ start, end }] 표본 위치 (시험 · 기록용).
 * 메모리: 150 Hz 고역 한 벌을 한 번 훑으며 5 ms 칸마다 제곱합만 모은다 (칸 배열은 표본의 1/220). 70 Hz 아래 비율은 후보 구간(± 50 ms)에만
 * 지연 없는 저역으로 잰다. 고친 곳이 있을 때만 출력 사본 하나.
 */
export function dethump(samples, rate, opts = {}) {
    const P = { ...THUMP, ...opts };
    const n = samples.length;
    const fs = Number(rate) > 0 ? Number(rate) : 44100;
    const H = Math.max(1, Math.round(fs * P.hopMs / 1000));     // 칸 = 걸음
    const M = Math.max(2, Math.round(P.winMs / P.hopMs));        // 창 = 칸 M 개
    const nb = Math.floor(n / H);
    if (nb < M * 2) return { samples, regions: [] };
    // 칸마다 제곱합: 원 신호 · 150 Hz 위
    const bx = new Float64Array(nb), bh = new Float64Array(nb);
    const [h1, h2] = butter4(P.hiHz, fs);
    let hs1 = 0, hs2 = 0, ht1 = 0, ht2 = 0;
    for (let i = 0, end = nb * H; i < end; i++) {
        const v = samples[i];
        // 고역 두 단 (전치 직접형 II)
        let y = h1.b0 * v + hs1; hs1 = h1.b1 * v - h1.a1 * y + hs2; hs2 = h1.b2 * v - h1.a2 * y;
        const u = y; y = h2.b0 * u + ht1; ht1 = h2.b1 * u - h2.a1 * y + ht2; ht2 = h2.b2 * u - h2.a2 * y;
        const k = (i / H) | 0;
        bx[k] += v * v; bh[k] += y * y;
    }
    const px = new Float64Array(nb + 1), ph = new Float64Array(nb + 1);
    for (let k = 0; k < nb; k++) { px[k + 1] = px[k] + bx[k]; ph[k + 1] = ph[k] + bh[k]; }
    const lowCoef = butter4(P.subHz, fs, true);
    const pad = Math.round(fs * P.padMs / 1000);
    // 칸 [a, b) 의 평균 dB (범위 밖 = 무음: 소리 끝 · 시작은 무음 옆으로 친다)
    const levelDb = (a, b) => { a = Math.max(0, a); b = Math.min(nb, b); return b > a ? 10 * Math.log10((px[b] - px[a]) / ((b - a) * H) + 1e-20) : -200; };
    const minE = Math.pow(10, P.minDb / 10) * M * H;
    const nw = nb - M + 1;                                       // 창 k = 칸 k .. k+M-1
    const flag = new Uint8Array(nw);
    for (let k = 0; k < nw; k++) {
        const e = px[k + M] - px[k];
        if (e >= minE && (ph[k + M] - ph[k]) / e < P.maxShare) flag[k] = 1;
    }
    const regions = [];
    const e0 = Math.round(P.edgeMs[0] / P.hopMs), e1 = Math.round(P.edgeMs[1] / P.hopMs);
    const maxBlocks = Math.round(P.maxMs / P.hopMs);
    for (let k = 0; k < nw; k++) {
        if (!flag[k]) continue;
        let j = k;
        while (j + 1 < nw && flag[j + 1]) j++;
        // 저음뿐인 창 전체가 구간 — 첫 · 끝 창 안쪽은 이미 저음뿐이라고 판정된 곳 (말끝에 바로 붙은 쿵의 앞머리까지)
        const a = k, b = j + M;                                  // 칸 범위 [a, b)
        k = j;
        if (b - a > maxBlocks) continue;
        const after = levelDb(b + e0, b + e1), before = levelDb(a - e1, a - e0);
        if (!(after < P.quietDb || before < P.quietDb)) continue;
        if (lowShare(samples, a * H, Math.min(n, b * H), lowCoef, pad) < P.minSub) continue;
        // 무음 쪽 가장자리: 쿵 자신의 시작음 · 꼬리 (무음 기준보다 큰 칸이 바로 붙어 있으면 창 하나까지 넓힘)
        let s = a, t = b;
        if (before < P.quietDb) for (let q = 0; q < M && s > 0 && levelDb(s - 1, s) >= P.quietDb; q++) s--;
        if (after < P.quietDb) for (let q = 0; q < M && t < nb && levelDb(t, t + 1) >= P.quietDb; q++) t++;
        regions.push({ start: s * H, end: Math.min(n, t * H) });
    }
    if (!regions.length) return { samples, regions };
    // 줄이기: 구간 안 floor, 양끝 램프. 가까운 구간의 램프가 겹치면 작은 쪽 (곱하지 않음)
    const floor = Math.pow(10, P.floorDb / 20);
    const ramp = Math.max(1, Math.round(fs * P.rampMs / 1000));
    const gainAt = (i, r) => {
        if (i >= r.start && i < r.end) return floor;
        const d = i < r.start ? r.start - i : i - (r.end - 1);
        return d > ramp ? 1 : floor + (1 - floor) * (d / ramp);
    };
    const out = new Float32Array(samples);
    for (let g = 0; g < regions.length; g++) {
        const r = regions[g];
        const lo = Math.max(0, r.start - ramp), hi = Math.min(n, r.end + ramp);
        for (let i = lo; i < hi; i++) {
            let m = gainAt(i, r);
            if (g > 0) m = Math.min(m, gainAt(i, regions[g - 1]));
            if (g + 1 < regions.length) m = Math.min(m, gainAt(i, regions[g + 1]));
            out[i] = samples[i] * m;
        }
    }
    return { samples: out, regions };
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
/** 16비트 PCM WAV (ArrayBuffer). samples = Float32Array(모노) 또는 채널별 Float32Array 배열 (1.6.2: 효과음은 채널을 지킨다) */
export function encodeWav(samples, rate) {
    const chs = Array.isArray(samples) ? samples : [samples];
    const ch = chs.length, n = chs[0].length;
    const buf = new ArrayBuffer(44 + n * ch * 2);
    const dv = new DataView(buf);
    const tag = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    tag(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); tag(8, 'WAVE');
    tag(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);            // PCM
    dv.setUint16(22, ch, true);           // 채널 수
    dv.setUint32(24, rate, true);
    dv.setUint32(28, rate * ch * 2, true);     // 바이트/초
    dv.setUint16(32, ch * 2, true);            // 블록 정렬
    dv.setUint16(34, 16, true);           // 비트
    tag(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const pcm = LITTLE_ENDIAN ? new Int16Array(buf, 44, n * ch) : null;
    for (let i = 0; i < n; i++) {
        for (let c = 0; c < ch; c++) {
            let v = chs[c][i];
            v = v > 1 ? 1 : v < -1 ? -1 : v;
            const s = Math.round(v < 0 ? v * 32768 : v * 32767);
            if (pcm) pcm[i * ch + c] = s; else dv.setInt16(44 + (i * ch + c) * 2, s, true);
        }
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

/** 1.6.3 디코드 (AudioBuffer | null) — mute.js 단어 음소거가 같은 디코더를 쓴다 */
export const decodeAudio = decode;

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
 * 음량 고르기: { normalize, targetLufs, gainDb, autoGainDb, dethump, lufs? } → { blob, lufs }
 * 1.6.2 효과음용 옵션: maxSeconds(디코드 길이가 넘으면 원본 그대로 — 긴 환경음의 메모리), keepChannels(스테레오 유지 · 쿵 줄이기와 함께 못 씀),
 *   peakSafe(참 봉우리가 리미터 무릎 −1.5 dBFS 를 넘지 않게 이득을 깎는다 — 짧은 타격음이 찌그러지지 않게)
 * lufs 를 이미 알면(캐시) 다시 재지 않는다. 디코드 실패, 또는 이득 0 이고 줄일 '쿵'도 없으면 원본 blob 그대로
 */
export async function prepare(blob, opts = {}) {
    const normalize = opts.normalize !== false;
    const gainDb = Number(opts.gainDb) || 0;
    const autoGainDb = Number(opts.autoGainDb) || 0;
    const known = Number.isFinite(opts.lufs) ? opts.lufs : null;
    const thump = opts.dethump !== false;   // 5.6.3 저음 '쿵' 줄이기 (기본 켬)
    if (!normalize && !gainDb && !autoGainDb && !thump) return { blob, lufs: known };
    const audio = await decode(blob);
    if (!audio || !audio.length) return { blob, lufs: known };
    const maxSeconds = Number(opts.maxSeconds) || 0;
    if (maxSeconds > 0 && audio.length > maxSeconds * audio.sampleRate) return { blob, lufs: known, tooLong: true };   // 1.6.2
    const chs = opts.keepChannels === true && !thump && audio.numberOfChannels > 1 ? Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c)) : null;
    let mono = monoOf(audio);
    const rate = audio.sampleRate;
    // 음량은 원본으로 잰다 (캐시의 LUFS 와 같은 기준 — 줄인 덩어리는 에너지의 0.1 % 도 안 돼 값이 거의 같다)
    const lufs = known ?? integratedLoudness(mono, rate);
    let cleaned = false;
    if (thump) {
        const r = dethump(mono, rate);
        if (r.regions.length) { mono = r.samples; cleaned = true; }
    }
    let g = computeGain(lufs, { normalize, targetLufs: opts.targetLufs, gainDb, autoGainDb });
    if (opts.peakSafe === true) {   // 1.6.2 효과음: 참 봉우리가 리미터 무릎을 넘지 않게 — 타격음을 리미터로 뭉개지 않는다
        let pk = 0;
        for (const d of (chs || [mono])) for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > pk) pk = a; }
        if (pk > 0) g = Math.max(GAIN_MIN, Math.min(g, LIMIT_DB - 20 * Math.log10(pk)));
    }
    const useGain = Math.abs(g) >= 0.05;
    if (!useGain && !cleaned) return { blob, lufs };
    const wav = chs ? encodeWav(chs.map(d => (useGain ? applyGain(d, g) : d)), rate) : encodeWav(useGain ? applyGain(mono, g) : mono, rate);
    return { blob: new Blob([wav], { type: 'audio/wav' }), lufs, gainDb: g };
}
