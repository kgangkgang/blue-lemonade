// 6.3.6 효과음 낱말 붙이기 (막대 요술봉 › 효과음 낱말) — 순수 함수. 화면 · 저장은 player.js.
// 듣던 대사와 그 앞뒤 지문에서 낱말 칩을 뽑고, 내 효과음의 낱말 목록(sfx.custom[].words)에 하나 붙이기 · 빼기를 계산한다.
// 낱말 찾기(sfx-library matchSfx)는 띄어쓰기로 나눈 낱말의 「앞부분」을 맞추므로, 한국어 칩은 흔한 조사를 떼어 줄기만 둔다
// (「총성이」 → 「총성」 이면 총성을 · 총성이 · 총성과 모두 맞는다). 띄어쓰기 없는 일본어 · 중국어는 Intl.Segmenter 로 낱말을 나눈다.

export const WORD_MIN = 2;          // 한 글자 칩은 거의 아무 데나 맞는다
export const WORD_MAX = 20;
export const CHIP_LIMIT = 40;

// 떼어도 되는 조사 (긴 것 먼저). 「이 · 가 · 도 · 만」은 낱말 끝 글자와 겹치는 일이 많아(고양이 · 누가 · 포도) 떼지 않는다
const KO_PARTICLES = ['에서부터', '으로부터', '에게서', '한테서', '에서', '에게', '한테', '으로', '까지', '부터', '처럼', '보다', '만큼', '이랑', '하고', '조차', '마저',
    '을', '를', '은', '는', '에', '의', '와', '과', '로'];
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL = /\p{Script=Hangul}/u;
const ONLY_KANA_SHORT = /^[\p{Script=Hiragana}ー]{1,3}$/u;   // て · が · から · ている 같은 토막

/** 낱말 비교용 (낱말 찾기와 같은 접기: NFKC · 소문자 · 앞뒤 공백) */
export function wordFold(word) {
    return String(word ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 문장 부호 · 기호를 뺀 토막. 한국어는 조사를 한 번 뗀다 (남는 것이 두 글자 이상일 때만) */
export function cleanToken(token) {
    let t = String(token ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}\p{M}]/gu, '');
    if (!t || /^\p{N}+$/u.test(t)) return '';
    if (HANGUL.test(t)) {
        for (const p of KO_PARTICLES) {
            if (t.length - p.length >= WORD_MIN && t.endsWith(p)) { t = t.slice(0, -p.length); break; }
        }
    }
    return t;
}

function defaultSegmenter() {
    try { return typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'word' }) : null; }
    catch { return null; }
}

/** 한 글을 토막으로: 띄어쓰기 없는 한자 · 가나 덩이는 낱말 단위로 더 나눈다 */
export function tokensOf(text, segmenter = defaultSegmenter()) {
    const out = [];
    for (const piece of String(text ?? '').split(/\s+/)) {
        if (!piece) continue;
        if (CJK.test(piece) && !HANGUL.test(piece) && segmenter) {
            for (const part of segmenter.segment(piece)) if (part.isWordLike !== false) out.push(part.segment);
        } else out.push(piece);
    }
    return out;
}

/**
 * 칩 낱말: 여러 글(앞 지문 · 대사 · 뒤 지문 순)에서 나온 순서대로, 같은 낱말은 한 번, 2~20글자, 숫자 · 짧은 가나 토막 뺌, 최대 limit 개
 */
export function chipWords(texts, { limit = CHIP_LIMIT, segmenter } = {}) {
    const seg = segmenter === undefined ? defaultSegmenter() : segmenter;
    const seen = new Set(), out = [];
    for (const text of Array.isArray(texts) ? texts : [texts]) {
        for (const token of tokensOf(text, seg)) {
            const w = cleanToken(token);
            if (w.length < WORD_MIN || w.length > WORD_MAX || ONLY_KANA_SHORT.test(w)) continue;
            const k = wordFold(w);
            if (seen.has(k)) continue;
            seen.add(k); out.push(w);
            if (out.length >= limit) return out;
        }
    }
    return out;
}

/** 내 효과음 낱말 목록에 하나 붙이기 → { ok, words } 또는 { ok: false, why: 'empty' | 'dup' | 'full' } (limit = SFX_LIMITS.words) */
export function addWord(words, word, limit = 32) {
    const list = Array.isArray(words) ? words.map(String) : [];
    const w = String(word ?? '').trim();
    if (!w) return { ok: false, why: 'empty' };
    if (list.some(x => wordFold(x) === wordFold(w))) return { ok: false, why: 'dup' };
    if (list.length >= limit) return { ok: false, why: 'full' };
    return { ok: true, words: [...list, w] };
}

/** 붙였던 낱말 빼기 (되돌리기) — 같은 접기로 */
export function removeWord(words, word) {
    const k = wordFold(word);
    return (Array.isArray(words) ? words.map(String) : []).filter(x => wordFold(x) !== k);
}
