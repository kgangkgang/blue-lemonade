// [2.3.0] TTS 듣는 언어 (테마 5.8.2 · TTS 1.4.4) — TTS 가 읽을 줄을 고른 언어로 옮기는 요청의 순수 함수 (프롬프트 · 번호 묶음 · 답 읽기)
// 채팅 번역 프롬프트(목표 언어 한국어 · 사용자가 고친 것)와 규칙 프롬프트는 건드리지도 쓰지도 않는다 — 목표 언어는 TTS 가 넘긴다.
// 묶음 모양은 채팅 번역의 번호 글(⟦n⟧ 로 시작 · 빈 줄로 나눔)과 같다. JSON 으로 감싸면 모델 · 중계 필터가 데이터 작업으로 보고
// 거절이 늘었다 (5.1.4 — 다시 JSON 으로 가지 않는다). 답 읽기: 채팅 번역의 엄격한 읽기가 맞으면 그것, 아니면 번호가 확실한 줄만 받고
// 빠진 줄은 null (부르는 쪽이 한 번 더 · 원문). 번호가 한 칸 밀렸을 수 있으면 아무 줄도 받지 않는다 (엉뚱한 줄을 읽고 캐시에 남기지 않게).
// 시험: tools/tests/translator-speech.mjs

import { parseBatchResult, cleanParagraphEcho } from './translation-segments.js';   // 채팅 번역의 번호 묶음 읽기 (엄격 · 원문 되풀이 걷기)

export const SPEECH_LANGS = Object.freeze({ ko: 'Korean', ja: 'Japanese', en: 'English', zh: 'Chinese' });
export const SPEECH_TAG = '[Text-to-speech translation]';
const STYLE = Object.freeze({
    ko: 'Write natural spoken Korean in Hangul (no Hanja, no romanization).',
    ja: 'Write natural spoken Japanese with kanji and kana (no furigana, no romanization).',
    en: 'Write natural spoken English.',
    zh: 'Write natural spoken Mandarin Chinese in Simplified characters (no pinyin).',
});

/** 지시문 (본문 앞). count = 줄 수 (2 이상이면 번호 규칙), glossary = [Glossary] 블록 또는 '' */
export function speechPrompt(target, { count = 1, glossary = '' } = {}) {
    const lang = SPEECH_LANGS[target];
    if (!lang) throw new Error(`듣는 언어를 알 수 없어요: ${target}`);
    const many = count > 1;
    const rules = [
        SPEECH_TAG,
        `Translate the ${many ? 'numbered lines' : 'line'} below into ${lang}. ${many ? 'They are lines' : 'It is a line'} from a roleplay story and will be read aloud by a voice engine.`,
        `- ${STYLE[target]}`,
        '- Keep each speaker\'s tone, register, emotion and way of addressing others. Keep names consistent.',
        `- Output only the ${lang} words to be spoken: no notes, explanations, romanization, or quotation marks the source does not have.`,
        `- If a line is already in ${lang}, repeat it unchanged.`,
    ];
    if (many) rules.push('- Every line starts with a marker like ⟦2⟧. Start each translated line with the same marker. Do not merge, split, reorder, add or drop lines.');
    let out = rules.join('\n');
    if (glossary) out += `\n\n${glossary}`;
    return out;
}

/** 한 줄로 (읽을 글이라 줄바꿈은 빈칸) */
export const speechLine = (text) => String(text ?? '').replace(/\s*\n+\s*/g, ' ').trim();

/** 본문: 한 줄이면 그대로, 여럿이면 ⟦0⟧ … 빈 줄 ⟦1⟧ … */
export function speechPayload(lines) {
    const list = (lines || []).map(speechLine);
    return list.length === 1 ? list[0] : list.map((t, i) => `⟦${i}⟧ ${t}`).join('\n\n');
}

// 줄 머리 번호: ⟦3⟧ · ⟦3] (망가진 닫음) · 【3】 · [3] — 앞에 굵게 · 인용 기호가 붙어도.
// 답에 ⟦ 가 있으면 ⟦ 표시만 번호로 본다 (본문의 [3] · 【3】 을 번호로 오해하지 않게 — 채팅 번역 parseBatchResult 와 같은 규칙)
const MARK_LOOSE = /^\s*(?:[*_>]+\s*)?⟦\s*(\d+)\s*[⟧\]]\s*[:.)]?\s*/;
const MARK_OTHER = /^\s*(?:[*_>]+\s*)?(?:【\s*(\d+)\s*】|\[\s*(\d+)\s*\])\s*[:.)]?\s*/;
// 한 줄에 붙어 온 다음 번호 ("⟦0⟧ あ ⟦1⟧ い") — 줄을 나눠 읽는다 (전엔 '⟦1⟧ い' 가 0번 줄 소리에 섞이고 1번은 빠졌다)
const INLINE_MARK = /([^\n])[ \t]*(⟦[ \t]*\d+[ \t]*⟧)/g;
const QUOTE_PAIRS = [['「', '」'], ['『', '』'], ['"', '"'], ['“', '”'], ['\'', '\''], ['‘', '’'], ['«', '»']];

/** 모델이 원문에 없는 따옴표로 감쌌으면 벗긴다 (소리에는 상관없지만 재생 막대 글이 깔끔하게) */
export function unwrapQuotes(out, source = '') {
    let t = String(out ?? '').trim();
    const src = String(source ?? '').trim();
    for (const [a, b] of QUOTE_PAIRS) {
        if (t.length > 2 && t.startsWith(a) && t.endsWith(b) && !(src.startsWith(a) && src.endsWith(b))) { t = t.slice(a.length, -b.length).trim(); break; }
    }
    return t;
}

// 원문 되풀이: "Hello there. → こんにちは。" · "Hello there.\n->\n\nこんにちは。" (채팅 번역 5.4.1 에서 본 모양). 채팅 번역의 걷기는
// 12글자 넘는 문단만 보므로 짧은 대사 줄은 여기서 — 앞머리가 원문 글자 그대로이고 화살표나 줄바꿈이 이어지면 그 뒤만.
const ECHO_SPLIT = /\n|[ \t]*(?:-{1,2}>|=>|→|⇒|⟶|➔|➜)/g;
const ECHO_LEAD = /^\s*(?:(?:-{1,2}>|=>|→|⇒|⟶|➔|➜)\s*)?/;
const letters = (t) => String(t ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
/** 원문을 베끼고 화살표 · 줄바꿈 뒤에 번역을 붙인 답 → 번역만 ('' = 원문 + 화살표뿐). 해당 없으면 그대로 */
export function cutEchoLine(body, source) {
    const b = String(body ?? ''), src = letters(source);
    if (!src) return b;
    for (const m of b.matchAll(ECHO_SPLIT)) {
        const head = letters(b.slice(0, m.index));
        if (head.length > src.length) break;
        if (head === src) return b.slice(m.index).replace(ECHO_LEAD, '').trim();
    }
    return b;
}

/**
 * 번호 묶음 답 → 줄마다 글 또는 null (못 찾음 · 빈 글 · 같은 번호 두 번이면 처음 것).
 * 1) 채팅 번역의 엄격한 읽기(parseBatchResult — 망가진 표시 · 원문 되풀이(원문 → 번역) · 꼬리 메모 · 1부터 매긴 답)가 맞으면 그것.
 * 2) 아니면 너그럽게: 번호를 찾은 줄만 받되, 번호가 어느 줄인지 확실할 때만 — 0부터(모두 0..count-1) 또는 1부터(0 없음 · count 있음 · 모두 1..count).
 *    그 밖(1부터 매기고 하나 빠짐 · 줄을 나눠 번호가 늘어남 · 0번 없음)은 한 칸 밀렸는지 몰라 모두 null (부르는 쪽이 한 번 더 · 원문) —
 *    엉뚱한 줄의 번역을 읽고 캐시에 남기는 것보다 낫다. <think> · 코드 울타리 · 첫 번호 앞의 머리말 · 번호 없는 빈 줄 뒤 메모는 버린다.
 */
export function parseSpeechBatch(raw, count, sources = []) {
    const n = Math.max(0, Number(count) || 0);
    const text = String(raw ?? '').replace(/\r\n?/g, '\n').replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^\s*```[a-z]*[ \t]*\n|\n[ \t]*```\s*$/g, '').replace(INLINE_MARK, '$1\n$2');
    const one = (body, i) => {
        const t = cutEchoLine(body, sources[i]).replace(/\s+/g, ' ').trim();
        return t ? unwrapQuotes(t, sources[i]) || null : null;
    };
    try {
        const strict = parseBatchResult(text, n, {}, sources.length ? sources : undefined);
        return Array.from({ length: n }, (_, i) => one(strict[i], i));
    } catch { /* 너그럽게 */ }
    const mark = text.includes('⟦') ? MARK_LOOSE : MARK_OTHER;
    const found = new Map();
    let id = null, buf = [];
    const flush = () => {
        if (id === null) return;
        const body = buf.join('\n').trim();
        if (body && !found.has(id)) found.set(id, body);
        id = null;
        buf = [];
    };
    for (const line of text.split('\n')) {
        const m = mark.exec(line);
        if (m) { flush(); id = Number(m[1] ?? m[2]); buf = [line.slice(m[0].length)]; continue; }
        if (id === null) continue;
        if (line.trim()) buf.push(line);
        else flush();   // 빈 줄: 이 줄은 끝 (번호 없이 이어지는 글은 메모)
    }
    flush();
    const keys = [...found.keys()];
    const zero = found.has(0) && keys.every(k => k >= 0 && k < n);
    const oneBased = !found.has(0) && n > 0 && found.has(n) && keys.every(k => k >= 1 && k <= n);
    if (!zero && !oneBased) return Array.from({ length: n }, () => null);
    return Array.from({ length: n }, (_, i) => {
        const body = found.get(oneBased ? i + 1 : i);
        if (!body) return null;
        const clean = sources[i] != null ? cleanParagraphEcho(body, sources[i]) : body;   // 원문 → 번역 이면 번역만, 원문을 길게 베꼈으면 null
        return one(clean, i);
    });
}
