// 6.4.2 번역문에 원문 글자가 남은 줄 고르기 — 가나(예전 linesWithKana 와 같다) + 원문에 있던 한자 덩이. 고른 줄은 index.js 가 한 요청으로 다시 번역한다.
// 6.4.2 v2 — 다시 온 줄은 지킨 자리 밖의 덩이만 보고, 20줄은 가나 줄부터, 읽기 괄호 · 작은따옴표 · 한국어 원문의 한자는 빼고, 이름은 원어 발음으로.
// 6.4.2 v3 — 원래 줄에 가나가 있었으면 다시 온 줄은 6.4.1 처럼 가나만 본다 · 태그 안 · 인라인 코드 · 맨 URL · 루비(<rt>) · 《》 읽기는 고르지 않는다.
// 6.4.3 한자 v4 — 지킴 자리를 좁힌다: 맨 URL 은 빈칸 · 괄호 · 따옴표와 「문장부호 + 비ASCII」 앞에서 끝, 태그는 이름 + 속성 꼴만(<System: …> 은 글),
//   HTML 주석은 둔다 · 루비 <rb>…</rb> · 대문자 <RT> 도 읽기 · 《한글》 읽기는 바로 붙은 것만 (띄어 쓴 《책 이름》은 읽기가 아니다).
// 6.4.4 한자 v5 — 맨 URL 의 「:」는 뒤가 빈칸 · 닫는 괄호 · 따옴표 · 꺾쇠 · 낫표 · 전각 문장부호일 때만 끝으로 본다 (v4 회귀:
//   위키 이름공간 https://ja.wikipedia.org/wiki/特別:検索 · Category:室長 의 「:」에서 URL 이 끊겨 경로 속 한자를 남김으로 골랐다).
// 6.4.4 영어 v5 — 글 전체가 한국어 번역문(한글 > 가나 + 한자)일 때만 영어 남김을 본다 · 원문은 한 번만 쪼개 말마다 한 번만 판정한다.
// 6.4.3 + 원문 영어 서술에서 온 흔한 영어 낱말(Now · Well · Then …)이나 여는 말(And then · Of course …)이 한글 줄의 문장 첫머리에 그대로 남은 것 (예: 「Now, 미나는 창가에 섰다」).
//   원문에서 그 말이 든 줄이 모두 영어가 주된 글일 때만 — 일본어 · 한국어 원문 줄에 일부러 쓴 영어(「Yes, マイロード」)는 그대로 둔다.
// 6.4.3 영어 v4 — 한자 v4 위 · 「한글이 주된 줄」 셈에서 맨 URL · 인라인 코드 글자를 뺀다 (「자료는 https://… 에 있다. Then 미나는」 의 Then 을 놓치던 것).
// 순수 함수 (시험: tools/tests/translator-leftover.mjs). 예: 원문 「室長」 → 번역 「실장 室長님」 의 室長 를 한 번 더 보낸다.
const KANA = /[ぁ-ゖァ-ヺ]/;
const HAN = /\p{Script=Han}/u;
const HAN_RUN = /\p{Script=Han}{2,}/gu;
const HAN_ANY = /\p{Script=Han}+/gu;   // 2.9.4 한글 낱말 한가운데 낀 한자 (한 글자도)
const HANGUL = /[가-힣]/;
const LATIN = /[A-Za-z]/;
const count = (s, re) => (String(s).match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
const MAX_LINES = 20, MAX_LINE = 1200;

/** 다시 보낼 때의 머리말 — 한자 줄이 섞이면 이것, 가나만이면 index.js 의 예전 머리말 그대로 (v2: 이름은 한자음이 아니라 원어 발음 — 高橋 를 「고교」로 읽지 않게) */
export const LEFTOVER_FIX_NOTE = '[The numbered lines below are from a Korean translation but still contain Japanese or Chinese text (kana or kanji) copied from the original. Translate those parts fully into Korean (Japanese names in their Japanese pronunciation written in Hangul, Chinese names in their usual Korean form; follow the glossary), keep the numbering and everything else unchanged, one line per number.]\n';
/** 6.4.3 영어 낱말이 남은 줄이 섞이면 이 머리말 */
export const LEFTOVER_EN_NOTE = '[The numbered lines below are from a Korean translation but still contain words copied untranslated from the original (Japanese kana, kanji or English words such as Now, Well, Then). Translate those parts fully into Korean (Japanese names in their Japanese pronunciation written in Hangul, Chinese names in their usual Korean form; follow the glossary), keep the numbering and everything else unchanged, one line per number.]\n';

// 한글이 없는 괄호 · 따옴표 안 = 일부러 둔 원문 표기 (괄호 병기 「실장(室長)」 · 「室長」이라고 적힌 명패 · 『天地』 · v2 작은따옴표 '室長') — 한글 대사가 든 「…」 는 빼지 않는다
const WRAPS = [/[(（]([^()（）\n]*)[)）]/g, /「([^「」\n]*)」/g, /『([^『』\n]*)』/g, /"([^"\n]*)"/g, /“([^“”\n]*)”/g, /‘([^‘’\n]*)’/g, /'([^'\n]*)'/g, /《([^《》\n]*)》/g, /〈([^〈〉\n]*)〉/g, /【([^【】\n]*)】/g];
// v3 글이 아닌 자리 — 태그 안(따옴표 없는 속성 title=室長 도) · 인라인 코드 `室長` · 맨 URL 은 한글이 있어도 통째로 둔다 (고르면 링크 · 코드 · 속성이 바뀐다)
// v4 좁힘: 태그는 이름 + 속성 꼴만 (<System: 室長…> · <Chapter 3: …> · x<y … y>z 는 글) · HTML 주석 · 맨 URL 은 빈칸 · 괄호 · 꺾쇠 · 따옴표 · 낫표에서,
//   그리고 문장부호 바로 뒤가 ASCII 가 아니면 거기서 끝 (https://example.com,室長님 · …/a.室長 · …/a」室長 의 室長 는 글). 경로 안 한자(/資料室/a.png)는 그대로 둔다
const RAW = [/<!--.*?-->/g, /<\/?[A-Za-z][\w-]*(?:\s+[\w:.-]+(?:=(?:"[^"\n]*"|'[^'\n]*'|[^\s"'<>]+))?)*\s*\/?>/g, /`[^`\n]*`/g,
    /https?:\/\/(?:[^\s<>"'`「」『』()（）\[\].,;:!?。、，．！？]|[.,;!?](?=[\x21-\x7E])|:(?=[^\s<>"'`「」『』()（）\[\]。、，．！？]))+/g];   // v5 「:」 뒤가 글이면 URL 안 (위키 이름공간)
function keptSpans(line) {
    const spans = [];
    for (const re of WRAPS) for (const m of line.matchAll(re)) if (!HANGUL.test(m[1])) spans.push([m.index, m.index + m[0].length]);
    for (const re of RAW) for (const m of line.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
    return spans;
}
// v2 바로 뒤 괄호에 한글 읽기만 있으면 일부러 둔 표기 (四面楚歌(사면초가) · 天野(아마노)) · v3 《한글》 · 루비 <rt>한글</rt> (앞의 <rp> 괄호도) 도 읽기
// v4 루비의 </rb> 뒤 · 대문자 태그(<RT>)도 · 《한글》 은 바로 붙은 것만 (「室長 《밤의 노래》」 의 띄어 쓴 책 이름은 읽기가 아니다)
const READING_AFTER = /^(?:\s*(?:<\/rb>)?\s*(?:[(（][가-힣\s·]+[)）]|(?:<rp>[^<\n]*<\/rp>)?<rt\b[^<>\n]*>[가-힣\s·]+<\/rt>)|《[가-힣\s·]+》)/i;
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
    // 2.9.4 한글 낱말 한가운데 낀 한자 (앞뒤가 모두 한글 · 한 글자라도 · 원문에 없어도): 「특注품」(特注品) — 낱말 안의 한자는 일부러 쓴 표기가 아니다.
    //   한자 뒤에 조사만 붙은 것(會議에 · 室은)은 한자 섞어 쓰기일 수 있어 예전처럼 둔다(6.4.2). 한국어 원문 줄에 그대로 있던 한자 · 용어집 표기 · 일부러 둔 자리는 뺀다
    for (const m of s.matchAll(HAN_ANY)) {
        const run = m[0], from = m.index, to = m.index + run.length;
        if (!HANGUL.test(s[from - 1] ?? '')) continue;
        // 2.9.9 한글 낱말 끝에 붙은 한자 (「그 변顔 사진」 ← 変顔 — 뒤가 띄어쓰기 · 문장 부호): 원문의 일본어 · 중국어 줄에 그대로 있던 한자만 (낱말 안에 낀 것은 원문에 없어도)
        if (!HANGUL.test(s[to] ?? '') && (!src.includes(run) || !fromForeign(run, src))) continue;
        if (runs.includes(run) || runs.some(r => r.includes(run))) continue;
        if (src.includes(run) && !fromForeign(run, src)) continue;
        if (keep.some(k => String(k).includes(run))) continue;
        if (keptAt(s, from, to, spans)) continue;
        runs.push(run);
    }
    return runs;
}

// 6.4.3 문장 첫머리에 남기 쉬운 흔한 영어 낱말 — 이음말 · 때 · 순서 · 태도 부사 · 느낌말 · 대답 · 문장을 여는 대명사 · 한정사 (첫 글자만 대문자인 꼴)
//   v3 + 여는 말의 첫 낱말 A · An · With · Without · Moments (A moment later, · With a sigh, · Moments later,)
const EN_WORDS = new Set(`And But Or Nor So Yet Then Still Though Although Because Since While When Whenever If Unless Once After Before Until As
Now Well Meanwhile Suddenly Finally However Instead Besides Anyway Anyways Anyhow Indeed Perhaps Maybe Actually Honestly Clearly Obviously Apparently
Eventually Later Soon Again First Firstly Second Next Last Lastly Afterward Afterwards Also Even Just Only Already Slowly Quietly Gently Carefully
Instantly Immediately Abruptly Thus Therefore Hence Otherwise Moreover Furthermore Nevertheless Nonetheless Regardless Sometimes Often Usually Always
Never Somehow Here There Today Tonight Tomorrow Yesterday Outside Inside Nearby Together Alone Right Sure Okay Alright Fine Good Great
Oh Ah Ahh Aha Eh Hm Hmm Huh Hey Hi Hello Yes Yeah Yep No Nope Nah Wow Whoa Ugh Uh Um Er Please Sorry Thanks Wait Look Listen Ha Haha Heh Tch Shh Ow Ouch
The This That These Those It He She They We You His Her Their Its My Your Our Some Every Each A An With Without Moments`.split(/\s+/).filter(Boolean));
// 첫 낱말이 목록 밖인 여는 말 (두 · 세 낱말, 뒤에 쉼표)
const EN_PHRASES = new Set(['Of course', 'At last', 'At first', 'At once', 'At least', 'In fact', 'In the end', 'In any case', 'For now', 'For a moment', 'For a while', 'By then', 'By the way', 'Not yet', 'All right', 'No way']);
// 문장 첫머리: 줄 처음 · 문장 끝(. ! ? … 。 」 』 ” " ' ) ]) 뒤 빈칸 · 여는 따옴표 · 괄호 바로 뒤 · 줄임표 · 대시 바로 뒤 (마크다운 * _ ~ 는 건너뛴다)
const EN_START = String.raw`(?:^|[.!?…。」』”"')\]]\s+|[「『“"'(\[]\s*|(?:…|\.{3}|—|–|--)\s*)[*_~]*`;
// 한 낱말: 뒤에 쉼표 · 한글 · 「. ! ?」 + 한글 · v3 줄임표(… · ..) + 한글 (낱말 뒤 마크다운 닫힘 * _ ~ 는 건너뛴다)
const EN_ONE = new RegExp(EN_START + String.raw`([A-Z][a-z]+)(?=[*_~]*(?:\s*,|\s*[.!?]+\s+[*_~]*[가-힣]|\s*(?:…+|\.{2,})\s*[*_~]*[가-힣]|\s+[*_~]*[가-힣]))`, 'g');
// 여는 말 (두 · 세 낱말, 뒤 낱말은 소문자 · v3 첫 낱말은 A 처럼 한 글자도): 뒤에 쉼표
const EN_MANY = new RegExp(EN_START + String.raw`([A-Z][a-z]*(?:\s+[a-z]+){1,2})(?=[*_~]*\s*,)`, 'g');
// 2.6.3 문장 가운데 남은 소문자 영어 (사용자 10-16 「홈 row 위에서」 ← 원문 「over the home row」): 앞이 한글(띄어쓰기 하나까지), 뒤가 한글(조사 · 다음 낱말) —
//       한두 낱말 · 두 글자 이상 · 단위 · 흔한 약어는 뺀다. 원문의 영어 위주 줄에 있는 말일 때만 (fromEnglish 와 같은 규칙).
const EN_MID = /(?<=[가-힣][*_~]*\s?)([a-z]{2,}(?:\s+[a-z]{2,})?)(?=[*_~]*\s?[가-힣])/g;
const EN_MID_SKIP = new Set('km cm mm kg mg ml px pt vs etc am pm kb mb gb tb fps bpm rpm cc mph kph'.split(' '));
const bare = line => String(line ?? '').replace(/<[^>]*>/g, '').replace(/\[\[\/?__VAR_\d+__\]\]/g, '');   // 태그 · 자리표시자 글자는 세지 않는다
const fold = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const wordRe = (phrase, flags = 'i') => new RegExp(`\\b${String(phrase).trim().split(/\s+/).join('\\s+')}\\b`, flags);
const englishLine = b => count(b, LATIN) > count(b, KANA) + count(b, HAN) + count(b, HANGUL);
/**
 * 원문에서 그 말이 든 줄이 영어가 주된 줄(라틴 글자 > 가나 + 한자 + 한글)뿐인가 — 영어 원문에서 온 낱말만.
 * v3: 그 말이 영어 위주가 아닌 원문 줄(일본어 「」 대사 · 한국어 줄)에도 있으면 보내지 않는다 — 영어 서술 + 일본어 대사 원문에서 대사 속에 일부러 쓴 영어(「Yes, マイロード」)
 */
// 6.4.4 영어 v5 같은 원문은 한 번만 쪼개(줄마다 bare · 영어 위주 판정) 말마다 한 번만 본다 — v4 는 남은 말마다 원문 전체를 다시 쪼개고 훑어
//   긴 답에서 줄 수 × 원문 크기로 늘었다 (300줄 × 300줄 181 ms). 마지막 원문 하나만 들고 있는다 (지난 답의 원문을 쌓아 두지 않게)
let feSource = null, feLines = [], feMemo = new Map();
const fromEnglish = (phrase, source) => {
    const src = String(source ?? '');
    if (src !== feSource) { feSource = src; feLines = src.split('\n').map(bare).map(b => [b, englishLine(b)]); feMemo = new Map(); }
    if (feMemo.has(phrase)) return feMemo.get(phrase);
    const re = wordRe(phrase);
    const lines = feLines.filter(([b]) => re.test(b));
    const yes = lines.some(([, en]) => en) && lines.every(([, en]) => en);
    feMemo.set(phrase, yes);
    return yes;
};

/**
 * 6.4.3 한 줄에 남은 원문 영어 낱말 · 여는 말 — 한글이 주된 줄(태그 밖 글자 · 찾은 말을 뺀 나머지로 셈) · 문장 첫머리 · 흔한 낱말(EN_WORDS로 시작) 또는 여는 말(EN_PHRASES) ·
 * 원문의 영어가 주된 줄에만 그 말이 있는 것. 한글 없는 괄호 · 따옴표 안(「Now, listen.」이라고) · 이름(names — 용어집 표기 · 내 캐릭터 · 지금 캐릭터) ·
 * 대문자 약어(OK · H.A.L.O — 꼴이 달라 안 걸린다)는 뺀다.
 */
export function leftoverEnglish(line, source, names = []) {
    const s = bare(line), src = String(source ?? '');
    if (!src || !LATIN.test(s) || !HANGUL.test(s)) return [];
    const spans = keptSpans(s);
    const skip = new Set((Array.isArray(names) ? names : []).map(fold).filter(Boolean));
    const words = [];
    for (const re of [EN_MANY, EN_ONE]) {
        for (const m of s.matchAll(re)) {
            const phrase = m[1], first = phrase.split(/\s+/)[0];
            const from = m.index + m[0].length - phrase.length, to = from + phrase.length;
            if (!(EN_WORDS.has(first) || EN_PHRASES.has(phrase))) continue;
            if (skip.has(fold(phrase)) || skip.has(fold(first))) continue;
            if (spans.some(([a, b]) => a <= from && to <= b)) continue;
            if (words.some(w => w.startsWith(phrase + ' ') || w === phrase)) continue;   // 여는 말 안의 첫 낱말은 따로 안 센다
            if (!fromEnglish(phrase, src)) continue;
            words.push(phrase);
        }
    }
    for (const m of s.matchAll(EN_MID)) {   // 2.6.3 문장 가운데
        const phrase = m[1], from = m.index, to = from + phrase.length;
        if (EN_MID_SKIP.has(phrase) || skip.has(fold(phrase))) continue;
        if (!wordRe(phrase).test(String(line))) continue;   // 태그를 걷어 낸 자리에서 붙어 생긴 말(x<y … y>z → xz)은 아니다
        if (spans.some(([a, b]) => a <= from && to <= b)) continue;
        if (words.some(w => w === phrase || w.includes(phrase))) continue;
        if (!fromEnglish(phrase, src)) continue;
        words.push(phrase);
    }
    // 한글이 주된 줄인가 — 찾은 남김 말을 뺀 나머지로 센다 (짧은 줄의 「Just then, 문이 열렸다」 는 잡고, 영어 위주 줄 · 트래커는 그대로 뺀다)
    let rest = s.replace(/`[^`\n]*`/g, '').replace(/https?:\/\/(?:[^\s<>"'`「」『』()（）\[\].,;:!?。、，．！？]|[.,;!?](?=[\x21-\x7E])|:(?=[^\s<>"'`「」『』()（）\[\]。、，．！？]))+/g, '');   // v4 맨 URL · 인라인 코드 글자는 세지 않는다 (지킴 자리와 같은 꼴 · 태그는 bare 가 이미 뺐다)
    for (const w of words) rest = rest.replace(wordRe(w, 'gi'), '');
    return count(rest, HANGUL) > count(rest, LATIN) ? words : [];
}
const isEnglish = run => /^[A-Za-z]+(?:\s+[a-z]+)*$/.test(run);

/**
 * 다시 보낼 줄 [index, line, runs]. 가나 줄은 예전 linesWithKana 와 같은 규칙(글 전체가 한글이 주된 글 · 가나가 든 줄),
 * 한자 줄은 글 전체가 한글이 주된 글이고 leftoverHan 이 덩이를 찾은 줄, 6.4.3 영어 줄은 글에 한글이 있고 leftoverEnglish 가 찾은 줄(그 줄이 한글이 주된 줄인지는 거기서).
 * 최대 MAX_LINES 줄 — 가나 줄을 6.4.1 차례대로 먼저, 남는 자리에 한자 줄, 그다음 영어만 남은 줄 (뒤 갈래가 많아도 앞 갈래가 밀리지 않게) · 줄 길이 MAX_LINE 이하.
 * source 가 없으면(입력 번역 · 원문 모름) 예전처럼 가나만. english = false 면 영어 낱말은 보지 않는다 (문단 캐시 판정 — index.js).
 */
export function linesToFix(text, source = '', keep = [], names = [], { english = true } = {}) {
    const s = String(text ?? '');
    const hangul = count(s, HANGUL), kana = count(s, KANA), han = count(s, HAN), latin = count(bare(s), LATIN);
    const kanaOn = kana > 0 && hangul > kana;
    const hanOn = Boolean(source) && han > 0 && hangul > han + kana;
    const enOn = english && Boolean(source) && latin > 0 && hangul > kana + han;   // 6.4.4 영어 v5 글 전체가 한국어 번역문일 때만 (가나 · 한자가 더 많은 글은 6.4.1 · 6.4.2 처럼 손대지 않는다)   // 한글이 주된 줄인지는 줄마다 (남김 말을 뺀 나머지로) — 짧은 번역문도
    if (!kanaOn && !hanOn && !enOn) return [];
    const rows = [];
    s.split('\n').forEach((line, index) => {
        if (line.trim().length > MAX_LINE) return;
        const hanRuns = hanOn ? leftoverHan(line, source, keep) : [];
        const enRuns = enOn ? leftoverEnglish(line, source, names) : [];
        const kanaHit = kanaOn && KANA.test(line);
        if (kanaHit || hanRuns.length || enRuns.length) rows.push({ index, line, runs: [...hanRuns, ...enRuns], rank: kanaHit ? 0 : hanRuns.length ? 1 : 2 });
    });
    const picked = [];
    for (const rank of [0, 1, 2]) picked.push(...rows.filter(row => row.rank === rank).slice(0, MAX_LINES - picked.length));
    return picked.sort((a, b) => a.index - b.index).map(row => [row.index, row.line, row.runs]);
}

/** 머리말: 영어 낱말 줄이 있으면 LEFTOVER_EN_NOTE, 한자 줄이 있으면 LEFTOVER_FIX_NOTE, 아니면 가나 머리말(kanaNote) 그대로 */
export const fixNoteFor = (lines, kanaNote) => (lines.some(row => row[2]?.some(isEnglish)) ? LEFTOVER_EN_NOTE : lines.some(row => row[2]?.length) ? LEFTOVER_FIX_NOTE : kanaNote);

/** 그 줄에 덩이 · 영어 말이 일부러 둔 자리 밖에 남았나 */
const freeRun = (s, run, spans) => {
    if (isEnglish(run)) {
        for (const m of s.matchAll(wordRe(run, 'gi'))) if (!keptAt(s, m.index, m.index + m[0].length, spans)) return true;
        return false;
    }
    for (let at = s.indexOf(run); at >= 0; at = s.indexOf(run, at + 1)) if (!keptAt(s, at, at + run.length, spans)) return true;
    return false;
};
/**
 * 다시 번역해 온 줄이 아직 고칠 것을 들고 있나 — 가나가 남았거나(6.4.1 그대로) 그 줄의 한자 덩이 · 영어 말(낱말 경계)이 일부러 둔 자리 밖에 그대로.
 * v2: 괄호 병기 · 한글 없는 따옴표 · 읽기 괄호 안의 같은 말은 세지 않는다 (제대로 고쳐 온 줄 · 같이 고친 가나를 버리지 않게)
 * v3: line = 보낸 원래 줄. 가나가 있던 줄은 6.4.1 처럼 가나만 본다 — 가나만 고치고 한자 · 영어 말을 둔 답도 받는다 (원래 줄보다 나빠지지 않고,
 *     남은 한자는 linesToFix 가 계속 잡아 문단 캐시에도 안 들어간다). 가나가 없던 줄은 v2 그대로
 */
export const stillLeftover = (candidate, runs = [], line = '') => {
    const s = String(candidate ?? '');
    if (KANA.test(s)) return true;
    if (KANA.test(String(line ?? ''))) return false;
    const spans = keptSpans(s);
    return runs.some(run => freeRun(s, run, spans));
};
