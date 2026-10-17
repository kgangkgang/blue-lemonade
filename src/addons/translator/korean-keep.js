// 2.7.9 이미 한국어인 부분은 번역 요청에 보내지 않는다 (설정 「이미 한국어인 부분은 보내지 않기」, 한국어로 옮길 때만).
//   영어 서술 + 한국어 대사처럼 섞인 답에서 한국어 문단 · 한국어 대사를 [[__VAR_n__]] 자리표시자로 가려 보내고, 번역 뒤 글자 그대로 되돌린다.
//   토큰이 줄고, 잘 쓴 한국어를 모델이 다시 쓰지 않는다. 판정은 보수적으로 — 애매하면 예전처럼 보낸다:
//   · 한글이 글자의 80% 이상(KOREAN_SHARE — 자동 번역 건너뛰기와 같은 기준) · 가나가 하나라도 있으면 아님(일본어) ·
//     소문자로 시작하는 라틴 낱말이 있으면 아님(「정말 cool 하다」 — 대문자로 시작하는 이름 · 숫자 · 숫자에 붙은 단위 190cm 는 괜찮다)
//   · 문단: 빈 줄로 나눈 문단이 통째로 한국어면 문단째 · 대사: 섞인 문단 안의 「」『』"" “” ‘’ '' 속이 한국어면 속만 (괄호는 남겨 문장 구조를 보인다)
//   · 짧은 대사(글자 KEEP_MIN 미만)는 자리표시자가 더 길어 그대로 보낸다
export const KOREAN_SHARE = 0.8;
export const KEEP_MIN = 4;

const PLACEHOLDER = /\[\[__VAR_\d+__\]\]/g;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const QUOTES = [/「([^「」\n]+)」/g, /『([^『』\n]+)』/g, /“([^“”\n]+)”/g, /‘([^‘’\n]+)’/g, /"([^"\n]+)"/g, /(?<![\p{L}\p{N}])'([^'\n]+)'(?![A-Za-z])/gu];

/** 글자만 남긴 것 (태그 · 주소 · 자리표시자 빼고) */
const lettersOf = text => String(text ?? '').replace(/<[^<>]*>/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(PLACEHOLDER, ' ');

/** 이미 한국어인 글인지 — 한글 80% 이상 · 가나 없음 · 소문자로 시작하는 라틴 낱말 없음 · 한글 KEEP_MIN 자 이상 */
export function isKorean(text, min = KEEP_MIN) {
    const body = lettersOf(text);
    if (KANA.test(body) || /(?:^|[^A-Za-z0-9])[a-z]/.test(body)) return false;
    const hangul = (body.match(/\p{Script=Hangul}/gu) || []).length;
    const letters = (body.replace(/(?<![A-Za-z])[A-Z][A-Za-z'’-]*/g, ' ').match(/\p{L}/gu) || []).length;   // 대문자로 시작하는 이름은 비율에서 뺀다
    return hangul >= min && hangul / letters >= KOREAN_SHARE;
}

/**
 * 한국어 문단 · 대사를 reserve(글) 가 돌려준 자리표시자로 바꾼다. reserve 는 보호 블록 목록에 글을 넣고 [[__VAR_n__]] 을 돌려준다.
 * @returns {{ text: string, paragraphs: number, quotes: number, blocks: string[] }}
 */
export function keepKorean(text, reserve) {
    const blocks = [];
    const keep = value => { blocks.push(value); return reserve(value); };
    let paragraphs = 0, quotes = 0;
    const parts = String(text ?? '').split(/(\n[\t ]*\n\s*)/);
    for (let i = 0; i < parts.length; i += 2) {
        const [, head, core, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(parts[i]);
        if (!core) continue;
        if (isKorean(core)) { parts[i] = head + keep(core) + tail; paragraphs++; continue; }
        let body = core;
        for (const quote of QUOTES) {
            body = body.replace(quote, (match, inner) => {
                if (!isKorean(inner)) return match;
                quotes++;
                const at = match.indexOf(inner);
                return match.slice(0, at) + keep(inner) + match.slice(at + inner.length);
            });
        }
        parts[i] = head + body + tail;
    }
    return { text: parts.join(''), paragraphs, quotes, blocks };
}

/** 대략의 토큰 수 (보고용 어림 — 한글 1자 ≈ 1토큰, 그 밖은 4자 ≈ 1토큰) */
export function roughTokens(text) {
    const value = String(text ?? '');
    const hangul = (value.match(/\p{Script=Hangul}/gu) || []).length;
    return Math.round(hangul + (value.length - hangul) / 4);
}
