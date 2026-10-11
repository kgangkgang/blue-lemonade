// TTS 1.6.3 단어 음소거 (설정 mute_words · mute_mode) — 로그를 공유할 때 이름 같은 말을 소리에서 감춘다. 화면 글은 그대로.
//   muteWords(src)                 → 말 목록 (한 줄에 하나 · 앞뒤 공백 제거 · 중복 없음 · 200개 · 각 80자 · 전체 2,000자)
//   muteText(text, words)          → 글에서 뺀 글 (text 모드 · 브라우저 내장) — 대소문자 구별 없음, 자리는 빈칸 하나
//   hasMuteWord(text, words) · findSpans(text, words) → [{ start, end }] 글자 번호 (겹치면 합침)
//   alignSpans(align, words, pad)  → [{ start, end }] ms — ElevenLabs with-timestamps 글자 시간표 (보낸 글 기준이라 태그 머리말이 앞에 붙어 있다)
//   estimateSpans(text, words, durationMs) → 시간표가 없을 때 글자 위치 비율로 어림 (앞뒤 max(120ms, 구간의 15%) 넉넉히 — 틀릴 수 있다)
//   mutedBlob(blob, { text, words, align, key }) → 구간을 무음(5ms 램프)으로 바꾼 WAV Blob | null (디코드 실패 · 지울 구간 없음)
//   muteSig(text, s)               → 이 글에 음소거가 걸리면 설정의 짧은 서명 (prepared 열쇠에 들어가 목록이 바뀌면 다시 만든다) · 아니면 ''
import { decodeAudio, encodeWav } from './loudness.js';
import { log } from './log.js';

export const MUTE_MAX_CHARS = 2000;
export const MUTE_MODES = Object.freeze(['audio', 'text']);
const MAX_WORDS = 200, MAX_WORD = 80;
const PAD_ALIGN_MS = 30, PAD_MIN_MS = 120, PAD_RATIO = 0.15, RAMP_MS = 5;

let wordsMemo = { src: null, list: [] };
/** 설정 글 → 말 목록 (같은 글이면 같은 배열) */
export function muteWords(src) {
    src = String(src || '').slice(0, MUTE_MAX_CHARS);
    if (wordsMemo.src === src) return wordsMemo.list;
    const seen = new Set(), list = [];
    for (const raw of src.split(/\r?\n/)) {
        const w = raw.trim().slice(0, MAX_WORD);
        if (!w || seen.has(w.toLowerCase())) continue;
        seen.add(w.toLowerCase());
        list.push(w);
        if (list.length >= MAX_WORDS) break;
    }
    wordsMemo = { src, list };
    return list;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reMemo = new Map();
function wordRe(w) {
    let re = reMemo.get(w);
    if (!re) { re = new RegExp(escapeRe(w), 'giu'); if (reMemo.size > 400) reMemo.clear(); reMemo.set(w, re); }
    re.lastIndex = 0;
    return re;
}
/** 글자 번호 구간 (겹치거나 맞닿으면 합침 · 긴 말부터 — '민수' 와 '민수야' 가 같이 있어도 한 구간) */
export function findSpans(text, words) {
    const t = String(text || '');
    const out = [];
    if (!t || !words?.length) return out;
    for (const w of [...words].sort((a, b) => b.length - a.length)) {
        const re = wordRe(w);
        let m;
        while ((m = re.exec(t))) { out.push({ start: m.index, end: m.index + m[0].length }); if (!m[0].length) re.lastIndex++; }
    }
    return mergeSpans(out);
}
export function hasMuteWord(text, words) { return findSpans(text, words).length > 0; }
/** 글에서 뺀 글 — 자리는 빈칸 하나 (앞뒤 빈칸과 겹치면 하나로) */
export function muteText(text, words) {
    const t = String(text || '');
    const spans = findSpans(t, words);
    if (!spans.length) return t;
    let out = '', at = 0;
    for (const sp of spans) { out += t.slice(at, sp.start) + ' '; at = sp.end; }
    out += t.slice(at);
    return out.replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '');
}
function mergeSpans(list) {
    const sorted = list.filter(x => x && x.end > x.start).sort((a, b) => a.start - b.start);
    const out = [];
    for (const sp of sorted) {
        const last = out[out.length - 1];
        if (last && sp.start <= last.end) last.end = Math.max(last.end, sp.end);
        else out.push({ start: sp.start, end: sp.end });
    }
    return out;
}
/** 시간표 모양 확인: chars 문자열 + 같은 길이의 start/end (ms 정수 배열) */
export function validAlign(a) {
    if (!a || typeof a !== 'object' || typeof a.chars !== 'string' || !Array.isArray(a.start) || !Array.isArray(a.end)) return false;
    const n = a.chars.length;
    return n > 0 && a.start.length === n && a.end.length === n;
}
/** 시간표에서 구간 (ms) — 글자 하나라도 시간이 이상하면 그 구간은 건너뛴다 */
export function alignSpans(align, words, padMs = PAD_ALIGN_MS) {
    if (!validAlign(align)) return [];
    const out = [];
    for (const sp of findSpans(align.chars, words)) {
        let s = Infinity, e = -Infinity;
        for (let i = sp.start; i < sp.end; i++) {
            const a = Number(align.start[i]), b = Number(align.end[i]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            if (a < s) s = a;
            if (b > e) e = b;
        }
        if (s === Infinity || e <= s) continue;
        out.push({ start: Math.max(0, s - padMs), end: e + padMs });
    }
    return mergeSpans(out);
}
/** 시간표가 없을 때: 글자 위치 비율 × 길이, 앞뒤를 max(120ms, 구간의 15%) 넓힌다 */
export function estimateSpans(text, words, durationMs) {
    const t = String(text || '');
    const dur = Number(durationMs) || 0;
    if (!t.length || dur <= 0) return [];
    const out = [];
    for (const sp of findSpans(t, words)) {
        const s = sp.start / t.length * dur, e = sp.end / t.length * dur;
        const pad = Math.max(PAD_MIN_MS, (e - s) * PAD_RATIO);
        out.push({ start: Math.max(0, s - pad), end: Math.min(dur, e + pad) });
    }
    return mergeSpans(out);
}
/** 표본에 무음 구간을 넣는다 (경계 5ms 선형 램프 — 딸깍 소리가 안 나게) */
export function silenceSpans(samples, rate, spansMs) {
    const n = samples.length, ramp = Math.max(1, Math.round(rate * RAMP_MS / 1000));
    const out = new Float32Array(samples);
    for (const sp of spansMs) {
        const a = Math.max(0, Math.round(sp.start / 1000 * rate)), b = Math.min(n, Math.round(sp.end / 1000 * rate));
        if (b <= a) continue;
        for (let i = Math.max(0, a - ramp); i < a; i++) out[i] *= (a - i) / ramp;
        out.fill(0, a, b);
        for (let i = b; i < Math.min(n, b + ramp); i++) out[i] *= (i - b + 1) / ramp;
    }
    return out;
}
const estimatedLogged = new Set();
/**
 * 소리에서 말을 지운 WAV. align(시간표)이 있고 그 안에 말이 있으면 정확히, 아니면 글자 위치 비율로 어림(기록에 한 줄).
 * 채널 수는 그대로. 디코드 실패 · 지울 구간이 없으면 null (부른 쪽이 원본을 쓴다)
 */
export async function mutedBlob(blob, { text = '', words = [], align = null, key = '' } = {}) {
    if (!(blob instanceof Blob) || !blob.size || !words?.length) return null;
    const audio = await decodeAudio(blob);
    if (!audio || !audio.length) return null;
    const rate = audio.sampleRate, durMs = audio.length / rate * 1000;
    let spans = alignSpans(align, words), exact = spans.length > 0;
    if (!exact) spans = estimateSpans(text, words, durMs);
    if (!spans.length) return null;
    if (!exact && !estimatedLogged.has(key)) {
        if (estimatedLogged.size > 500) estimatedLogged.clear();
        estimatedLogged.add(key);
        log('info', `어림 음소거 · 시간표 없음 · ${String(text || '').length}자 · ${spans.length}구간`);
    }
    const chs = [];
    for (let c = 0; c < audio.numberOfChannels; c++) chs.push(silenceSpans(audio.getChannelData(c), rate, spans));
    return new Blob([encodeWav(chs, rate)], { type: 'audio/wav' });
}
function hashOf(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}
/** 이 글에 소리 음소거가 걸리나 → 목록의 서명 ('' = 안 걸림 · text 모드 · 목록 없음) */
export function muteSig(text, s) {
    if (!s || s.mute_mode === 'text') return '';
    const words = muteWords(s.mute_words);
    if (!words.length || !hasMuteWord(text, words)) return '';
    return 'm' + hashOf(words.join('\n'));
}
