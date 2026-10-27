// 3.1.4 이야기 속 알림 줄 (10-27 제보 「이런 진짜 RP 문구들은 번역해 줘야지」): 본문 한 줄을 통째로 차지한 괄호 줄 —
//   【 DRAW — DOUBLE KNOCKOUT 】 · [ SYSTEM ALERT: … ] · [Text from Gabriel] 같은 게임 판정 · 시스템 메시지 · 간판 · 문자 메시지.
//   모델이 화면 UI 글로 보고 영어 그대로 돌려주는 일이 있어(대문자 · 괄호) ① 이런 줄이 있는 요청에만 「이것도 이야기라 번역」 한 줄을 붙이고
//   ② 그래도 원문 그대로 온 줄은 남은 원문 다시 번역(leftover-fix.js)이 한 번 더 보낸다 · 그 문단은 문단 캐시에 넣지 않는다.
// 경계 — 번역하지 않는 것:
//   · 보호 블록(사용자 「보호할 텍스트」 · 프리셋 생각 · 숨김 주석 · 상태 카드 …)은 이 판정보다 먼저 [[__VAR_n__]] 로 가려져 여기 오지 않는다.
//   · 코드 울타리(``` · ~~~) 안 줄 · 자리표시자 · 태그 · 코드 글자({ } < > = \ ` $ | :: => -> // · 밑줄 이름 · 함수 꼴)가 든 줄.
//   · 링크 [글](주소) · 각주 [^1] · 번호 표시 [3] · 【3】 · 체크 [ ] [x] · 낱말 하나뿐인 표지([OOC] · [Image] · [CHAP]).
//   · 이미 한글 · 가나 · 한자가 든 줄(번역됐거나 원래 다른 말).
// 순수 함수 (시험: tools/tests/translator-rp-lines.mjs).

/** 요청에 붙이는 한 줄 — 방향(한↔영)과 무관한 말로 */
export const NOTICE_NOTE = '[Bracketed lines such as 【 … 】 or [ … ] are part of the story (on-screen notices, game results, system messages, signs, text messages): translate their words too, keeping the brackets, markup and numbers.]';
/** 그래도 원문 그대로 온 줄을 다시 보낼 때의 머리말 */
export const NOTICE_FIX_NOTE = '[The numbered lines below are from a Korean translation but were left untranslated: in-story notices, system messages, signs or game results in brackets, or words copied from the original. Translate their words fully into Korean, keep the brackets, markup, numbers and numbering unchanged, one line per number.]\n';

/** 지시문이 한국어로 옮기라는 것인가 — 「into Korean」 · 「into natural, fluent Korean」 · 「한국어로」 (「from Korean into English」 는 아님) */
export const NOTICE_KOREAN_TARGET = /\b(?:to|into)\b[^.\n]{0,40}?\bkorean\b|한국어로|한글로/i;

const PAIRS ={ '【': '】', '〖': '〗', '〔': '〕', '［': '］', '[': ']' };
// 줄 앞뒤의 꾸밈: 묶음 요청의 문단 표시 ⟦n⟧ · 인용 > · 굵게 · 기울임 · 취소선 기호 · 꾸밈 태그(<span …> · <b> · <center> …)
const LEAD = /^(?:⟦\d+⟧|[ \t]|>|[*_~]{1,3}|<[a-z][\w-]*(?:\s[^<>]*)?>)*/i;
const MAX_INNER = 160;   // 괄호 속 긴 글(지시 · 안내 문장 — 다시 번역 머리말 같은)은 알림이 아니다
const TAIL = /(?:[ \t]|[*_~]{1,3}|<\/[a-z][\w-]*\s*>)*$/i;
const CODEISH = /[{}<>=\\`$|]|::|=>|->|\/\/|\[\[|__|\w_\w|\b[a-z]+[A-Z]\w*\(|\w\(\)|^\s*\^|^\s*[xX ]?\s*$/;
const FOREIGN = /[\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const WORD = /[A-Za-z][A-Za-z'’]+/g;

/** 한 줄이 이야기 속 알림 줄이면 괄호 안 글(앞뒤 빈칸 뺌), 아니면 null */
export function noticeInner(line) {
    const s = String(line ?? '');
    if (!s.trim() || s.length > 400) return null;
    const lead = LEAD.exec(s)[0], tail = TAIL.exec(s.slice(lead.length))[0];
    const core = s.slice(lead.length, s.length - tail.length);
    const open = core[0], close = PAIRS[open];
    if (!close || core.at(-1) !== close || core.length < 4) return null;
    const inner = core.slice(1, -1).trim();
    // 안에 같은 괄호가 또 열리면(【A】 글 【B】) 한 줄 알림이 아니다
    if (!inner || inner.length > MAX_INNER || inner.includes(open) || inner.includes(close)) return null;
    if (FOREIGN.test(inner) || CODEISH.test(inner) || /^\d+$/.test(inner) || /^(?:https?|ftp):/i.test(inner)) return null;
    const words = inner.match(WORD) || [];
    if (words.length < 2) return null;
    const latin = (inner.match(/[A-Za-z]/g) || []).length, letters = (inner.match(/[\p{L}\p{N}]/gu) || []).length;
    return latin >= 4 && latin >= letters * 0.6 ? inner : null;
}

const key = inner => String(inner).normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

/** 글의 줄 가운데 알림 줄 [{ index, line, inner }] — 코드 울타리 안 줄은 뺀다 */
export function noticeLines(text) {
    const out = [];
    let fence = null;
    String(text ?? '').split('\n').forEach((line, index) => {
        const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
        if (mark) { if (!fence) fence = mark[1][0]; else if (mark[1][0] === fence) fence = null; return; }
        if (fence) return;
        const inner = noticeInner(line);
        if (inner !== null) out.push({ index, line, inner });
    });
    return out;
}
export const hasNoticeLines = text => noticeLines(text).length > 0;

/**
 * 번역문의 i 번째 줄이 원문의 알림 줄을 번역하지 않고 그대로 둔 것인가 — 그 줄도 알림 줄이고(한글 없음) 괄호 안 글이 원문 알림 줄 하나와 같다.
 * sourceKeys: noticeKeys(원문) — 같은 원문을 줄마다 다시 쪼개지 않게
 */
export const noticeKeys = source => new Set(noticeLines(source).map(row => key(row.inner)));
export function untranslatedNotice(line, sourceKeys) {
    if (!sourceKeys?.size) return null;
    const inner = noticeInner(line);
    return inner !== null && sourceKeys.has(key(inner)) ? inner : null;
}
/** 다시 번역해 온 줄이 아직 원문 그대로인가 — 보낸 줄이 알림 줄이었으면 답에 한글이 없을 때 */
export const noticeStillLeft = (candidate, line) => noticeInner(line) !== null && !/\p{Script=Hangul}/u.test(String(candidate ?? ''));
