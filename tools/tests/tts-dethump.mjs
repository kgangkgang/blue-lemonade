// TTS 쉼 자리 저음 '쿵' 줄이기 (src/addons/tts/src/loudness.js dethump) — 합성 신호로 확인
//   node tools/tests/tts-dethump.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const { dethump, THUMP } = await import(pathToFileURL(path.join(root, 'loudness.js')));

const RATE = 44100;
const sec = s => Math.round(s * RATE);
const dbOf = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return 10 * Math.log10(s / Math.max(1, b - a) + 1e-20); };

/** 모음 비슷한 소리: f0 배음 + 500 · 1500 Hz 근처 강조 (말소리는 에너지가 150 Hz 위에 많다) */
function vowel(x, from, to, f0, amp = 0.3) {
    for (let i = sec(from); i < sec(to); i++) {
        const t = i / RATE;
        let v = 0;
        for (let h = 1; h * f0 < 4000; h++) {
            const f = h * f0;
            const w = Math.exp(-((f - 500) ** 2) / (2 * 200 ** 2)) + 0.5 * Math.exp(-((f - 1500) ** 2) / (2 * 300 ** 2)) + 0.15;
            v += w * Math.sin(2 * Math.PI * f * t) / h ** 0.3;
        }
        const env = Math.min(1, (i - sec(from)) / sec(0.01), (sec(to) - i) / sec(0.01));
        x[i] += amp * 0.25 * v * env;
    }
}
/** '쿵': 50 Hz 한 번 출렁이는 덩어리 (Hann 창) */
function thump(x, at, ms = 50, hz = 50, amp = 0.2) {
    const n = sec(ms / 1000), a = sec(at);
    for (let i = 0; i < n; i++) x[a + i] += amp * Math.sin(Math.PI * i / n) ** 2 * Math.sin(2 * Math.PI * hz * i / RATE);
}
/** 낮은 목소리 '음/ん': 기본음이 센 콧소리 (f0 + 약한 배음 · 250 Hz 콧소리 공명) */
function hum(x, from, to, f0, amp = 0.3) {
    for (let i = sec(from); i < sec(to); i++) {
        const t = i / RATE;
        let v = Math.sin(2 * Math.PI * f0 * t);
        for (let h = 2; h * f0 < 2000; h++) v += (h * f0 < 400 ? 0.45 : 0.12) * Math.sin(2 * Math.PI * h * f0 * t) / h ** 0.5;
        const env = Math.min(1, (i - sec(from)) / sec(0.01), (sec(to) - i) / sec(0.01));
        x[i] += amp * 0.4 * v * env;
    }
}
const noise = (x, db = -70) => { let s = 12345; const a = 10 ** (db / 20); for (let i = 0; i < x.length; i++) { s = (s * 1103515245 + 12345) >>> 0; x[i] += a * ((s / 2 ** 32) * 2 - 1); } };

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// 1) 말 → 쿵 → 쉼 → 말: 쿵만 잡고 −20 dB 넘게 줄인다. 말소리 표본은 그대로
{
    const x = new Float32Array(sec(3));
    vowel(x, 0.2, 1.0, 110);
    thump(x, 1.02, 50, 48);
    vowel(x, 1.6, 2.6, 110);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 1, `one region, got ${r.regions.length}`);
    const g = r.regions[0];
    ok(g.start <= sec(1.03) && g.end >= sec(1.06), 'region covers the thump');
    const before = dbOf(x, sec(1.02), sec(1.07)), after = dbOf(r.samples, sec(1.02), sec(1.07));
    ok(before - after > 20, `thump reduced ${before.toFixed(1)} → ${after.toFixed(1)} dB`);
    let same = true;
    for (let i = sec(0.2); i < sec(0.98); i++) if (r.samples[i] !== x[i]) { same = false; break; }
    for (let i = sec(1.6); i < sec(2.6); i++) if (r.samples[i] !== x[i]) { same = false; break; }
    ok(same, 'speech samples untouched');
    ok(r.samples !== x, 'returns a new array when something changed');
}

// 2) 쉼 한가운데 혼자 있는 쿵 (앞뒤 다 무음)
{
    const x = new Float32Array(sec(2));
    vowel(x, 0.1, 0.6, 140);
    thump(x, 0.95, 60, 45);
    vowel(x, 1.4, 1.9, 140);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 1 && r.regions[0].start <= sec(0.96), 'isolated thump caught');
}

// 3) 낮은 목소리(기본음 75 · 80 Hz)의 모음은 건드리지 않음 — 길게 · 짧게 · 쉼 사이에 짧게
for (const f0 of [73, 80, 95]) {
    const x = new Float32Array(sec(2));
    vowel(x, 0.2, 1.4, f0, 0.35);
    vowel(x, 1.6, 1.72, f0, 0.35);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 0, `low vowel f0=${f0} untouched (got ${r.regions.length})`);
    ok(r.samples === x, 'no copy when nothing changed');
}

// 4) 낮은 목소리의 짧은 '음/ん' (쉼 사이 120 ms) — 70 Hz 아래 비율이 낮아 건드리지 않음
for (const f0 of [75, 85, 100]) {
    const x = new Float32Array(sec(1.5));
    vowel(x, 0.1, 0.5, f0);
    hum(x, 0.7, 0.82, f0);
    vowel(x, 1.0, 1.4, f0);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 0, `short hum f0=${f0} untouched (got ${r.regions.length})`);
}

// 5) 160 ms 보다 긴 저음은 그대로 (배경음 · 의도한 소리일 수 있음)
{
    const x = new Float32Array(sec(2));
    vowel(x, 0.1, 0.5, 120);
    thump(x, 0.8, 300, 45);
    noise(x);
    ok(dethump(x, RATE).regions.length === 0, 'long low sound untouched');
}

// 6) 무음 · 아주 짧은 소리 · 표본율 22.05 kHz · 48 kHz
{
    const silent = new Float32Array(sec(1));
    const r = dethump(silent, RATE);
    ok(r.regions.length === 0 && r.samples === silent, 'silence passes through');
    const tiny = new Float32Array(100);
    ok(dethump(tiny, RATE).samples === tiny, 'very short input passes through');
    for (const rate of [22050, 48000]) {
        const n = Math.round(2 * rate), x = new Float32Array(n);
        const R = RATE;
        // 같은 장면을 다른 표본율로
        for (let i = 0; i < n; i++) {
            const t = i / rate;
            if (t > 0.2 && t < 0.9) x[i] += 0.1 * (Math.sin(2 * Math.PI * 500 * t) + 0.5 * Math.sin(2 * Math.PI * 1200 * t) + 0.3 * Math.sin(2 * Math.PI * 120 * t));
            if (t >= 0.92 && t < 0.97) x[i] += 0.2 * Math.sin(Math.PI * (t - 0.92) / 0.05) ** 2 * Math.sin(2 * Math.PI * 48 * (t - 0.92));
        }
        void R;
        const r2 = dethump(x, rate);
        ok(r2.regions.length === 1, `rate ${rate}: thump caught (got ${r2.regions.length})`);
    }
}

// 7) 검토에서 나온 실제 같은 경우 (2026-10-06): 한쪽 방향 저역의 지연으로 비율이 부풀어 잘렸던 목소리
/** 기본음만 남은 꼬리: 배음은 빨리(τ 6 ms) · 기본음은 천천히(τ 30 ms) 잦아들고 그 뒤 무음 */
function decayingTail(x, from, dur, f0, amp = 0.3) {
    for (let i = 0; i < sec(dur); i++) {
        const t = i / RATE, a = sec(from) + i;
        let v = Math.exp(-t / 0.03) * Math.sin(2 * Math.PI * f0 * t);
        for (let h = 2; h * f0 < 3000; h++) v += 0.5 * Math.exp(-t / 0.006) * Math.sin(2 * Math.PI * h * f0 * t) / h;
        x[a] += amp * v;
    }
}
/** 어두운 '응/うん': 기본음이 크고 (2배음은 16 dB 아래) 잦아드는 120 ms 콧소리, 앞뒤 무음, 약 −21 dBFS */
function darkHum(x, from, f0, ms = 120) {
    const n = sec(ms / 1000);
    for (let i = 0; i < n; i++) {
        const t = i / RATE, env = Math.min(1, i / sec(0.008)) * Math.exp(-t / 0.08);
        x[sec(from) + i] += 0.12 * env * (Math.sin(2 * Math.PI * f0 * t) + 0.16 * Math.sin(2 * Math.PI * 2 * f0 * t) + 0.05 * Math.sin(2 * Math.PI * 3 * f0 * t));
    }
}
for (const f0 of [80, 86]) {
    const x = new Float32Array(sec(1.5));
    vowel(x, 0.2, 0.6, f0, 0.35);
    decayingTail(x, 0.6, 0.12, f0);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 0, `voiced tail f0=${f0} after a vowel untouched (got ${r.regions.length})`);
}
for (const f0 of [75, 80]) {
    const x = new Float32Array(sec(1.5));
    vowel(x, 0.1, 0.5, f0);
    darkHum(x, 0.75, f0);
    vowel(x, 1.05, 1.4, f0);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 0, `dark hum f0=${f0} between pauses untouched (got ${r.regions.length})`);
}
// 쿵 앞에 붙은 3~5 ms 넓은 대역 시작음도 같이 줄인다 (램프만이 아니라 −30 dB 가까이)
{
    const x = new Float32Array(sec(2));
    vowel(x, 0.1, 0.6, 140);
    let s = 7;
    const at = sec(1.0), atk = sec(0.004);
    for (let i = 0; i < atk; i++) { s = (s * 1103515245 + 12345) >>> 0; x[at + i] += 0.1 * ((s / 2 ** 32) * 2 - 1); }
    thump(x, 1.0 + 0.004, 50, 48);
    vowel(x, 1.5, 1.9, 140);
    noise(x);
    const r = dethump(x, RATE);
    ok(r.regions.length === 1, `attack + thump caught (got ${r.regions.length})`);
    const before = dbOf(x, at, at + atk), after = dbOf(r.samples, at, at + atk);
    ok(before - after > 20, `attack reduced ${before.toFixed(1)} → ${after.toFixed(1)} dB`);
}

// 8) 설정값 형태
ok(Object.isFrozen(THUMP) && THUMP.hiHz === 150 && THUMP.subHz === 70 && THUMP.minSub === 0.4, 'THUMP constants');

console.log(`tts-dethump: ${checks} checks passed`);
