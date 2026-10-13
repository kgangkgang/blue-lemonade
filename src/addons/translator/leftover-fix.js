// 6.4.2 번역문에 원문 글자가 남은 줄 고르기 — 가나(예전 linesWithKana 와 같다) + 원문에 있던 한자 덩이. 고른 줄은 index.js 가 한 요청으로 다시 번역한다.
// 6.4.2 v2 — 다시 온 줄은 지킨 자리 밖의 덩이만 보고, 20줄은 가나 줄부터, 읽기 괄호 · 작은따옴표 · 한국어 원문의 한자는 빼고, 이름은 원어 발음으로.
// 6.4.2 v3 — 원래 줄에 가나가 있었으면 다시 온 줄은 6.4.1 처럼 가나만 본다 · 태그 안 · 인라인 코드 · 맨 URL · 루비(<rt>) · 《》 읽기는 고르지 않는다.
// 순수 함수 (시험: tools/tests/translator-leftover.mjs). 예: 원문 「室長」 → 번역 「실장 室長님」 의 室長 를 한 번 더 보낸다.
const KANA = /[ぁ-ゖァ-ヺ]/;
const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}{2,}/gu;
const HANGUL = /[가-힣]/;
const count = (s, re) => (String(s).match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
const MAX_LINES = 20, MAX_LINE = 1200;

/** 다시 보낼 때의 머리말 — 한자 줄이 섞이면 이것, 가나만이면 index.js 의 예전 머리말 그대로 (v2: 이름은 한자음이 아니라 원어 발음 — 高橋 를 「고교」로 읽지 않게) */
export const LEFTOVER_FIX_NOTE = '[The numbered lines below are from a Korean translation but still contain Japanese or Chinese text (kana or kanji) copied from the original. Translate those parts fully into Korean (Japanese names in their Japanese pronunciation written in Hangul, Chinese names in their usual Korean form; follow the glossary), keep the numbering and everything else unchanged, one line per number.]\n';

// 한글이 없는 괄호 · 따옴표 안 = 일부러 둔 원문 표기 (괄호 병기 「실장(室長)」 · 「室長」이라고 적힌 명패 · 『天地』 · v2 작은따옴표 '室長') — 한글 대사가 든 「…」 는 빼지 않는다
const WRAPS = [/[(（]([^()（）\n]*)[)）]/g, /「([^「」\n]*)」/g, /『([^『』\n]*)』/g, /"([^"\n]*)"/g, /“([^“”\n]*)”/g, /‘([^‘’\n]*)’/g, /'([^'\n]*)'/g, /《([^《》\n]*)》/g, /〈([^〈〉\n]*)〉/g, /【([^【】\n]*)】/g];
// v3 글이 아닌 자리 — 태그 안(따옴표 없는 속성 title=室長 도) · 인라인 코드 `室長` · 맨 URL 은 한글이 있어도 통째로 둔다 (고르면 링크 · 코드 · 속성이 바뀐다)
const RAW = [/<\/?[A-Za-z][^<>\n]*>/g, /`[^`\n]*`/g, /https?:\/\/\S+/g];
function keptSpans(line) {
    const spans = [];
    for (const re of WRAPS) for (const m of line.matchAll(re)) if (!HANGUL.test(m[1])) spans.push([m.index, m.index + m[0].length]);
    for (const re of RAW) for (const m of line.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
    return spans;
}
// v2 바로 뒤 괄호에 한글 읽기만 있으면 일부러 둔 표기 (四面楚歌(사면초가) · 天野(아마노)) · v3 《한글》 · 루비 <rt>한글</rt> (앞의 <rp> 괄호도) 도 읽기
const READING_AFTER = /^\s*(?:[(（][가-힣\s·]+[)）]|《[가-힣\s·]+》|(?:<rp>[^<\n]*<\/rp>)?<rt\b[^<>\n]*>[가-힣\s·]+<\/rt>)/;
/** 그 자리의 덩이가 일부러 둔 것인가 — 한글 없는 괄호 · 따옴표 안 · 글이 아닌 자리 안이거나 바로 뒤에 한글 읽기 */
const keptAt = (s, from, to, spans) => spans.some(([a, b]) => a <= from && to <= b) || READING_AFTER.test(s.slice(to));
/** v2 원문에서 그 덩이가 든 줄 가운데 일본어 · 중국어 줄(한글이 주된 줄이 아닌)이 있나 — 한국어 원문에 원래 있던 한자는 남김이 아니다 */
const fromForeign = (run, source) => String(source ?? '').split('\n').some(line => line.includes(run) && count(line, HANGUL) <= count(line, HAN) + count(line, KANA));

/** 한 줄에 남은 원문 한자 덩이 (2자 이상 · 한자만). 한글이 주된 줄 · 원문(일본어 · 중국어 줄)에 그대로 있던 덩이만 · 일부러 둔 자리 · 용어집 번역 표기(keep)는 뺀다 */
export function leftoverHan(line, source, keep = []) {
    const s = String(line ?? ''), src = String(source ?? '');
    if (!src || !HAN.test(s)) return [];
    if (count(s, HANGUL) <= count(s, HAN) + count(s, KANA)) return [];
    const spans = keptSpans(s);
    const runs = [];
    for (const m of s.matchAll(HAN_RUN)) {
        const run = m[0], from = m.index, to = m.index + run.length;
        if (!src.includes(run) || !fromForeign(run, src)) continue;
        if (keep.some(k => String(k).includes(run))) continue;
        if (keptAt(s, from, to, spans)) continue;
        if (!runs.includes(run)) runs.push(run);
    }
    return runs;
}

/**
 * 다시 보낼 줄 [index, line, runs]. 가나 줄은 예전 linesWithKana 와 같은 규칙(글 전체가 한글이 주된 글 · 가나가 든 줄),
 * 한자 줄은 글 전체가 한글이 주된 글이고 leftoverHan 이 덩이를 찾은 줄. 최대 MAX_LINES 줄 — v2 가나 줄을 6.4.1 차례대로 먼저 채우고 남는 자리에 한자 줄
 * (한자 줄이 많아도 6.4.1 이 고치던 가나 줄이 밀리지 않게) · 줄 길이 MAX_LINE 이하. source 가 없으면(입력 번역 · 원문 모름) 예전처럼 가나만.
 */
export function linesToFix(text, source = '', keep = []) {
    const s = String(text ?? '');
    const hangul = count(s, HANGUL), kana = count(s, KANA), han = count(s, HAN);
    const kanaOn = kana > 0 && hangul > kana;
    const hanOn = Boolean(source) && han > 0 && hangul > han + kana;
    if (!kanaOn && !hanOn) return [];
    const rows = [];
    s.split('\n').forEach((line, index) => {
        if (line.trim().length > MAX_LINE) return;
        const runs = hanOn ? leftoverHan(line, source, keep) : [];
        const kanaHit = kanaOn && KANA.test(line);
        if (kanaHit || runs.length) rows.push({ index, line, runs, kanaHit });
    });
    const kanaRows = rows.filter(row => row.kanaHit).slice(0, MAX_LINES);
    const hanRows = rows.filter(row => !row.kanaHit).slice(0, MAX_LINES - kanaRows.length);
    return [...kanaRows, ...hanRows].sort((a, b) => a.index - b.index).map(row => [row.index, row.line, row.runs]);
}

/** 머리말: 한자 줄이 하나라도 있으면 LEFTOVER_FIX_NOTE, 아니면 가나 머리말(kanaNote) 그대로 */
export const fixNoteFor = (lines, kanaNote) => (lines.some(row => row[2]?.length) ? LEFTOVER_FIX_NOTE : kanaNote);

/** 그 줄에 덩이가 일부러 둔 자리 밖에 남았나 */
const freeRun = (s, run, spans) => {
    for (let at = s.indexOf(run); at >= 0; at = s.indexOf(run, at + 1)) if (!keptAt(s, at, at + run.length, spans)) return true;
    return false;
};
/**
 * 다시 번역해 온 줄이 아직 고칠 것을 들고 있나 — 가나가 남았거나(6.4.1 그대로) 그 줄의 한자 덩이가 일부러 둔 자리 밖에 그대로.
 * v2: 괄호 병기 · 한글 없는 따옴표 · 읽기 괄호 안의 같은 덩이는 세지 않는다 (제대로 고쳐 온 줄 · 같이 고친 가나를 버리지 않게)
 * v3: line = 보낸 원래 줄. 가나가 있던 줄은 6.4.1 처럼 가나만 본다 — 가나만 고치고 한자를 둔 답도 받는다 (원래 줄보다 나빠지지 않고,
 *     남은 한자는 linesToFix 가 계속 잡아 문단 캐시에도 안 들어간다). 한자만 있던 줄은 v2 그대로
 */
export const stillLeftover = (candidate, runs = [], line = '') => {
    const s = String(candidate ?? '');
    if (KANA.test(s)) return true;
    if (KANA.test(String(line ?? ''))) return false;
    const spans = keptSpans(s);
    return runs.some(run => freeRun(s, run, spans));
};
