// TTS 1.6.3 단어 음소거 (설정 mute_words · mute_mode) — 로그를 공유할 때 이름 같은 말을 소리에서 감춘다. 화면 글은 그대로.
//   muteWords(src)                 → 말 목록 (한 줄에 하나 또는 쉼표(, ， 、)로 여럿 · 앞뒤 공백 제거 · 중복 없음 · 200개 · 각 80자 · 전체 2,000자)
//   muteText(text, words)          → 글에서 뺀 글 (text 모드 · 브라우저 내장) — 대소문자 구별 없음, 자리는 빈칸 하나
//   hasMuteWord(text, words) · findSpans(text, words) → [{ start, end }] 글자 번호 (겹치면 합침)
//   alignSpans(align, words, pad)  → [{ start, end }] ms — ElevenLabs with-timestamps 글자 시간표 (보낸 글 기준이라 태그 머리말이 앞에 붙어 있다)
//   estimateSpans(text, words, durationMs) → 시간표가 없을 때 글자 위치 비율로 어림 (앞뒤 max(120ms, 구간의 15%) 넉넉히 — 틀릴 수 있다)
//   mutedBlob(blob, { text, words, align, key }) → 구간을 무음(5ms 램프)으로 바꾼 WAV Blob | null (디코드 실패 · 지울 구간 없음)
//   muteSig(text, s)               → 이 글에 음소거가 걸리면 설정의 짧은 서명 (prepared 열쇠에 들어가 목록이 바뀌면 다시 만든다) · 아니면 ''
//   muteTerms(s, pron)             → 찾을 표기 목록 = 적은 말 + 번역 이름 다리(원문 ↔ 한국어 · 가나) · 목소리 별명 · 발음 사전 뒤 표기 · 앞뒤 문장부호 뺀 꼴
//                                    (읽는 글이 원문이든 번역문이든, 목록을 어느 쪽 말로 적었든 찾는다 — 짝이 없는 말은 적힌 그대로만)
//   찾기는 대소문자 · 전각/반각(NFKC) · 사이 빈칸 수를 무시하고, 글 속에 들어 있으면 그 부분만 (「세라피나가」의 「세라피나」 — 조사는 남는다)
import { decodeAudio, encodeWav } from './loudness.js';
import { log } from './log.js';
import { nameAliases } from '../../../name-aliases.js';   // 번역 애드온의 이름 다리 (없으면 빈 목록)

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
    // 1.0.0: 「드림주, ドリムジュ」처럼 한 줄에 쉼표로 적어도 따로따로 — 전엔 쉼표째 한 말로 봐서 「드림주 씨」를 못 찾아 음소거가 안 됐어요(사용자 제보). 쉼표가 든 말 자체는 받지 않아요
    for (const raw of src.split(/\r?\n|[,，、]/)) {
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
/** 견주기용 접기: NFKC(전각 · 반각) + 소문자 */
const foldStr = (s) => String(s ?? '').normalize('NFKC').toLowerCase();
const foldKey = (s) => foldStr(s).replace(/\s+/g, ' ').trim();
/** 글을 글자마다 접고, 접은 글자 → 원래 글자 번호 표 (접으면 길이가 바뀌는 글자도 원래 자리로 돌아간다) */
function foldMap(t) {
    let folded = '';
    const from = [];
    for (let i = 0; i < t.length;) {
        const n = t.codePointAt(i) > 0xffff ? 2 : 1;
        const f = foldStr(t.slice(i, i + n));
        for (let k = 0; k < f.length; k++) from.push(i);
        folded += f;
        i += n;
    }
    return { folded, from };
}
const reMemo = new Map();
function wordRe(w) {
    let re = reMemo.get(w);
    if (re === undefined) {
        const parts = foldStr(w).trim().split(/\s+/).filter(Boolean).map(escapeRe);
        re = parts.length ? new RegExp(parts.join('\\s+'), 'gu') : null;   // 사이 빈칸은 몇 칸이든
        if (reMemo.size > 400) reMemo.clear();
        reMemo.set(w, re);
    }
    if (re) re.lastIndex = 0;
    return re;
}
/** 글자 번호 구간 (겹치거나 맞닿으면 합침 · 긴 말부터 — '민수' 와 '민수야' 가 같이 있어도 한 구간). 대소문자 · 전각/반각 · 사이 빈칸 수 무시 */
export function findSpans(text, words) {
    const t = String(text || '');
    const out = [];
    if (!t || !words?.length) return out;
    const { folded, from } = foldMap(t);
    for (const w of [...words].sort((a, b) => b.length - a.length)) {
        const re = wordRe(w);
        if (!re) continue;
        let m;
        while ((m = re.exec(folded))) {
            if (!m[0].length) { re.lastIndex++; continue; }
            const last = from[m.index + m[0].length - 1];
            out.push({ start: from[m.index], end: last + (t.codePointAt(last) > 0xffff ? 2 : 1) });
        }
    }
    return mergeSpans(out);
}
const EDGE_PUNCT = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;
const NAMES_KEY = Symbol.for('blue-lemonade.names');   // name-aliases.js 와 같은 열쇠 — 다리가 바뀌면 목록을 다시 만든다
let termsMemo = { k: null, bridge: undefined, list: [] };
/** 목소리 이름 · 별명 서명 (설정 창에서 별명을 고치면 같은 배열이 바뀌므로 내용으로 견준다) */
const voicesSig = (voices) => (Array.isArray(voices) ? voices : []).map(v => [v?.name, ...(Array.isArray(v?.aliases) ? v.aliases : [])].join('\u0002')).join('\u0003');
/**
 * 찾을 표기 목록 (적은 차례 그대로 + 더한 표기). 적은 말마다:
 *   앞뒤 문장부호를 뺀 꼴 · 번역 애드온 이름 다리의 같은 인물 표기(Seraphina ↔ 세라피나 ↔ セラフィナ) · 목소리 이름/별명 묶음 ·
 *   그 표기들에 발음 사전을 건 꼴 (읽는 글은 발음 사전 뒤라서).
 * pron = 발음 사전 함수 (player.js applyPron — 없으면 건너뜀). 사전에 짝이 없는 말은 적힌 그대로만 (새 번역 요청은 하지 않는다)
 */
export function muteTerms(s, pron = null) {
    const words = muteWords(s?.mute_words);
    if (!words.length) return words;
    const bridge = globalThis[NAMES_KEY], voices = s?.voices;
    const k = `${s.mute_words}\u0001${typeof pron === 'function' ? String(s.pron_dict || '') : ''}\u0001${voicesSig(voices)}`;
    if (termsMemo.k === k && termsMemo.bridge === bridge) return termsMemo.list;
    const seen = new Set(), list = [];
    const add = (w) => { const t = String(w ?? '').trim().slice(0, MAX_WORD), f = foldKey(t); if (t && f && !seen.has(f)) { seen.add(f); list.push(t); } };
    const groups = [];
    for (const v of Array.isArray(voices) ? voices : []) {
        const g = [v?.name, ...(Array.isArray(v?.aliases) ? v.aliases : [])].map(x => String(x ?? '').trim()).filter(Boolean);
        if (g.length > 1) groups.push(g.map(n => [n, foldKey(n)]));
    }
    for (const w of words) {
        const forms = [w];
        const bare = w.replace(EDGE_PUNCT, '');
        if (bare && bare !== w) forms.push(bare);
        const alias = () => { for (const f of forms.slice()) for (const a of nameAliases(f)) if (!forms.includes(a)) forms.push(a); };
        alias();
        const keys = new Set(forms.map(foldKey));
        for (const g of groups) if (g.some(([, fk]) => keys.has(fk))) for (const [n] of g) if (!forms.includes(n)) forms.push(n);
        alias();
        if (typeof pron === 'function') for (const f of forms.slice()) { let p = ''; try { p = String(pron(f) ?? '').trim(); } catch { p = ''; } if (p && p !== f) forms.push(p); }
        for (const f of forms) add(f);
    }
    termsMemo = { k, bridge, list };
    return list;
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
/** 이 글에 소리 음소거가 걸리나 → 찾을 표기 목록(muteTerms)의 서명 ('' = 안 걸림 · text 모드 · 목록 없음) */
export function muteSig(text, s, pron = null) {
    if (!s || s.mute_mode === 'text') return '';
    const words = muteTerms(s, pron);
    if (!words.length || !hasMuteWord(text, words)) return '';
    return 'm' + hashOf(words.join('\n'));
}
