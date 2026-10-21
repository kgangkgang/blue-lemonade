import { translatorNoteRanges } from './translation-notes.js';
// 2.6.0 번역 점검 (사용자 요청 10-15): 저장된 번역문을 원문과 문단마다 견줘, 오늘 실제로 난 문제(초안 · 혼잣말 누출 2.5.0, 숨김 주석 깨짐 ·
//   번역 끊김 2.5.1, 대사 괄호 빠짐 2.5.2 …)가 남은 문단을 고른다. 새 판정을 만들지 않고 번역할 때 쓰는 검사 함수를 그대로 다시 쓴다 —
//   번역 경로가 이미 고쳐 그리는 것(빠진 괄호 · 깨진 주석 가리기)은 고친 뒤에도 남는 것만 본다. 오탐이 적은 쪽으로:
//   원문과 문단 수가 같을 때만 문단끼리 견주는 검사(끊김 · 괄호 · 원문 그대로)를 하고, 다르면 메시지에 「문단 수 다름」 알림만 단다
//   (문단이 많이 사라졌을 때만 의심 — 그때는 빠진 자리도 찾는다).
// 문단은 번역기가 나누는 것과 같게: 빈 줄로 나누되 숨김 주석 · 코드 블록 · 보호 블록(번역에 안 보내는 것) 안의 빈 줄에서는 나누지 않는다.
// 순수 함수 (시험: tools/tests/translator-check.mjs). check-view.js 가 그릴 때 표시를 달고(markParagraphs), index.js 가 문단을 갈아 끼운다(replaceParagraph).
import { HTML_COMMENT, openCommentAt, looksCutShort, stripDraftLeaks, stripPlanningNotes, removeSourceEcho, echoesSource, restoreDialogueBrackets } from './translation-segments.js';
import { withoutDisplayCards } from './display-cards.js';

const BLANK = /\n[\t ]*\n(?:[\t ]*\n)*/g;
const FENCES = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const FAIL_MARK = /^\[[^\n\]]*원문 그대로\]/;   // 차단 · 실패 표시 (index.js failMarkOf — 「[… — 원문 그대로]」 줄 + 원문 문단)
const global = re => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
const normal = text => String(text ?? '').replace(/\r\n?/g, '\n');
const fenceOpen = text => (String(text).match(/```|~~~/g) || []).length % 2 === 1;

/** 닫힌 숨김 주석 — 다음 <!-- 를 넘지 않는 것만 (닫는 짝을 잃은 <!-- 가 뒤 주석의 --> 까지 문단 여럿을 삼키지 않게) */
const CLOSED_COMMENT = /<!--(?:(?!<!--)[\s\S])*?-->/g;
/** 나누지 않을 자리 [시작, 끝) — 숨김 주석 · 코드 블록 · 보호 블록 (보호 규칙의 주석 규칙도 닫힌 것만) */
function keptRanges(text, protect) {
    const ranges = translatorNoteRanges(text).map(r => [Math.max(0,r.attachStart-1),r.end]);
    for (const re of [CLOSED_COMMENT, FENCES, ...(protect || []).map(rule => (rule instanceof RegExp && rule.source === HTML_COMMENT.source ? CLOSED_COMMENT : rule))]) {
        if (!(re instanceof RegExp)) continue;
        for (const m of text.matchAll(global(re))) if (m[0].length) ranges.push([m.index, m.index + m[0].length]);
    }
    return ranges;
}
/** 글 → 문단 [{ start, end, body }] (빈 문단은 뺀다). protect: 번역에 안 보내는 블록 정규식 (그 안의 빈 줄에서는 나누지 않는다) */
export function paragraphSlices(text, protect = []) {
    const value = normal(text), ranges = keptRanges(value, protect), out = [];
    const inside = at => ranges.some(([a, b]) => a < at && at < b);
    let start = 0;
    const push = end => { const body = value.slice(start, end); if (body.trim()) out.push({ start, end, body }); };
    for (const m of value.matchAll(BLANK)) {
        if (inside(m.index)) continue;
        push(m.index);
        start = m.index + m[0].length;
    }
    push(value.length);
    return out;
}

// ── 글자 무게 · 글자 갈래 (translation-segments.js 와 같은 셈) ──
const letters = text => String(text ?? '').replace(HTML_COMMENT, '').replace(/<[^>]*>|\[\[__VAR_\d+__\]\]/g, '');
const keyOf = text => letters(text).normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
const SCRIPTS = [['hangul', /\p{Script=Hangul}/gu], ['cjk', /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu], ['latin', /\p{Script=Latin}/gu], ['cyrillic', /\p{Script=Cyrillic}/gu]];
function scriptOf(text) {
    let best = '', most = 0;
    for (const [name, pattern] of SCRIPTS) { const n = (String(text).match(pattern) || []).length; if (n > most) { best = name; most = n; } }
    return best;
}
const weightOf = text => {
    const plain = letters(text), latin = (plain.match(/\p{Script=Latin}/gu) || []).length, all = (plain.match(/[\p{L}\p{N}]/gu) || []).length;
    return all - latin + latin * 0.4;
};
/** 대사 수: 줄 전체(태그 · 꾸밈표 * _ 를 빼고)가 「…」 · 『…』 이거나, 색 span 안이 통째 「…」 · 『…』 인 곳 (숨김 주석은 빼고).
 *  서술 · 속마음 속의 인용 「…」 이나 대사 속 『』 를 '' 로 옮긴 것은 세지 않는다 (번역 관례 — 실제 채팅에서 오탐이었다) */
const SPAN_DIALOGUE = /<span\b[^<>]*>\s*[「『][^<>]*[」』]\s*<\/span>/gi;
const dialogueUnits = text => String(text ?? '').replace(HTML_COMMENT, '').split('\n').reduce((n, line) =>
    n + (/^[\s*_]*[「『][\s\S]*[」』][\s*_]*$/.test(line.replace(/<[^>]*>/g, '')) ? 1 : (line.match(SPAN_DIALOGUE) || []).length), 0);
/** 보호 블록을 걷은 글 (원문 그대로인 게 당연한 자리) */
const unprotected = (text, protect) => (protect || []).reduce((value, re) => (re instanceof RegExp ? value.replace(global(re), '') : value), String(text ?? ''));
/** 문단 뼈대: 태그 이름 차례 · 숨김 주석 · 대사인가 (문단 수가 다를 때 짝 찾기) */
const skeleton = body => {
    const tags = (String(body).match(/<!--|<\/?[a-z][\w:-]*/gi) || []).map(tag => tag.toLowerCase()).join(' ');
    return `${tags}|${dialogueUnits(body) > 0 ? 'q' : ''}`;
};

/** 이유 코드 → 한 줄 설명 (화면 문구) */
export const CHECK_REASONS = Object.freeze({
    blocked: '번역이 막혀 이 문단은 원문 그대로 남았어요.',
    comment: '숨김 주석이 깨졌어요. 화면에서는 가려 두었어요.',
    leak: '번역 모델의 초안이나 혼잣말이 섞인 것 같아요.',
    echo: '원문 문장이 번역문에 그대로 섞여 있어요.',
    cut: '번역이 중간에 끊긴 것 같아요. 원문보다 많이 짧아요.',
    brackets: '대사 괄호(「」)가 원문보다 적어요.',
    same: '번역되지 않고 원문 그대로예요.',
    gap: '이 문단 뒤에 있어야 할 원문 문단이 번역에서 빠진 것 같아요.',
    lost: '이 메시지는 원문보다 문단이 많이 적은데, 어디가 빠졌는지는 확실하지 않아요.',
});
/** 메시지 단위: lost 는 의심(문단이 많이 사라짐), count 는 알림만(문단 한두 개를 합치거나 나눈 번역은 흔하다) */
export const MESSAGE_REASONS = Object.freeze({
    lost: (src, out) => `원문 문단 ${src}개 중 번역은 ${out}개뿐이에요. 중간이 빠졌을 수 있어요.`,
    count: (src, out) => `문단 수가 원문(${src})과 번역(${out})이 달라 문단끼리 견주는 점검은 일부만 했어요.`,
    comments: '숨김 주석이 원문보다 적어요.',
});
/** 문단이 많이 사라졌나 — 3개 이상이면서 원문의 90% 이하 (저장된 번역 461개에서 1~6개 차이는 모델이 문단을 합치거나 나눈 것뿐이었다) */
const lostParagraphs = (src, out) => src - out >= 3 && out <= src * 0.9;

/**
 * 번역 문단 → 원문 문단 짝 (없으면 -1). 문단 수가 같으면 차례대로. 다르면 뼈대(태그 · 주석 · 대사)가 같은 문단끼리 차례를 지켜 맞춘다 (편집 거리).
 * sure[i]: 그 짝을 믿어도 되나 — 뼈대가 같고 앞이나 뒤 문단도 바로 이웃 짝일 때 (문단 하나만 다시 번역해도 될 때)
 */
export function alignParagraphs(sParas, oParas) {
    const n = sParas.length, m = oParas.length;
    if (n === m) return { map: oParas.map((_, i) => i), sure: oParas.map(() => true) };
    const sk = sParas.map(p => skeleton(p.body)), ok = oParas.map(p => skeleton(p.body));
    const sw = sParas.map(p => weightOf(p.body)), ow = oParas.map(p => weightOf(p.body));
    // 뼈대가 같으면 더하고, 글자 무게가 비슷하면(번역 전후 0.7~1.5배쯤) 조금 더, 제자리에서 멀수록 아주 조금 덜 — 같은 꼴 문단이 되풀이될 때 엉뚱하게 밀려 맞지 않게
    const score = (i, j) => {
        if (sk[i] !== ok[j]) return -2;
        const ratio = (ow[j] + 1) / (sw[i] + 1), near = Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(3));
        return (sk[i] === '|' ? 1 : 3) + near * 0.5 - Math.abs(i - j) * 0.001;
    };
    const GAP = -1, dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    for (let i = 1; i <= n; i++) dp[i][0] = i * GAP;
    for (let j = 1; j <= m; j++) dp[0][j] = j * GAP;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = Math.max(dp[i - 1][j - 1] + score(i - 1, j - 1), dp[i - 1][j] + GAP, dp[i][j - 1] + GAP);
    const map = new Array(m).fill(-1);
    for (let i = n, j = m; i > 0 && j > 0;) {
        if (dp[i][j] === dp[i - 1][j - 1] + score(i - 1, j - 1)) { map[j - 1] = i - 1; i--; j--; }
        else if (dp[i][j] === dp[i - 1][j] + GAP) i--;
        else j--;
    }
    const sure = map.map((s, j) => s >= 0 && sk[s] === ok[j] && ((j === 0 ? s === 0 : map[j - 1] === s - 1) || (j === m - 1 ? s === n - 1 : map[j + 1] === s + 1)));
    return { map, sure };
}

/**
 * 저장된 번역문을 원문과 견준다 → { aligned, sourceCount, count, paragraphs: [{ index, reasons: [코드…], source, sure, missing? }], message: [코드…], flagged, warn }.
 * paragraphs[].source: 짝 원문 문단 번호 (-1 = 못 찾음) · sure: 그 짝을 믿어도 되나 · missing: [from, to] 이 문단 뒤에 빠진 원문 문단 (gap).
 * warn: 의심 문단이 있거나 문단 · 주석이 사라졌다 (번역 단추의 메시지 상태). options.protect — 번역에 안 보내는 블록 정규식들 (번역기 getCombinedRegexes).
 * 원문 · 번역이 비었거나 같은 글이면 점검하지 않는다 (null).
 */
export function checkTranslation(source, translation, { protect = [] } = {}) {
    const src = normal(source), out = normal(translation);
    if (!src.trim() || !out.trim() || src === out) return null;
    const sParas = paragraphSlices(src, protect), oParas = paragraphSlices(out, protect);
    const aligned = sParas.length === oParas.length;
    let target;   // 번역문의 주된 글자 갈래 — 「원문 그대로」를 볼 때만 한 번 센다
    const paragraphs = [], message = [];
    if (!aligned) message.push(lostParagraphs(sParas.length, oParas.length) ? 'lost' : 'count');
    const commentCount = text => (text.match(HTML_COMMENT) || []).length;
    if (commentCount(out) < commentCount(src)) message.push('comments');
    // 초안 · 혼잣말 · 지어낸 감싸개 · 작업 메모 · 원문 되풀이는 번역할 때의 마지막 그물과 같이 글 전체로 걷어 보고, 걷혀서 바뀐 문단을 고른다
    //   (문단 하나만 보면 짧은 초안 줄은 영어 꼬리가 더 길어 「번역문이 로마자 글」로 보여 놓쳤다)
    const changedBy = cleaned => {
        if (cleaned === out) return null;
        const kept = new Set(paragraphSlices(cleaned, protect).map(p => p.body.trim()));
        return new Set(oParas.map((p, i) => (kept.has(p.body.trim()) ? -1 : i)).filter(i => i >= 0));
    };
    const leaked = changedBy(leakFree(src, out));
    const echoed = changedBy(echoFree(src, out));
    let pairs = null;
    oParas.forEach(({ body }, index) => {
        const reasons = [], add = code => { if (!reasons.includes(code)) reasons.push(code); };
        const srcBody = aligned ? sParas[index].body : null;
        if (FAIL_MARK.test(body.trim())) add('blocked');
        else {
            // 숨김 주석: 닫히지 않은 <!-- · 여는 짝 없이 문단 끝에 홀로 남은 -->
            if (openCommentAt(body) >= 0 || (/-->[\t ]*$/.test(body) && !body.includes('<!--'))) add('comment');
            if (leaked?.has(index)) add('leak');
            if (echoed?.has(index) || (srcBody && echoesSource(body, srcBody))) add('echo');   // 원문+화살표+번역 · 원문 문단을 길게 베껴 품음
            if (srcBody !== null) {
                if (looksCutShort(srcBody, body)) add('cut');
                // 빠진 괄호는 그릴 때 되살린다 (2.5.2) — 되살린 뒤에도 원문보다 대사가 적을 때만
                if (dialogueUnits(restoreDialogueBrackets(srcBody, body)) < dialogueUnits(srcBody)) add('brackets');
                // 원문 그대로: 보호 블록 · 상태 카드를 걷고도 글자가 넉넉하고, 원문 갈래가 번역문 갈래와 다른데 글자가 같다
                //   (먼저 맨 글자끼리 견줘 거의 다른 문단은 건너뛴다 — 문단마다 상태 카드를 다시 읽으면 긴 답에서 느렸다)
                const rawSrc = letters(srcBody).replace(/\s+/g, ''), rawOut = letters(body).replace(/\s+/g, '');
                if (rawSrc && (rawSrc.includes(rawOut) || rawOut.includes(rawSrc))) {
                    target ??= scriptOf(keyOf(unprotected(withoutDisplayCards(out), protect)));
                    const bare = unprotected(withoutDisplayCards(srcBody), protect);
                    if (weightOf(bare) >= 12 && target && scriptOf(keyOf(bare)) !== target && keyOf(unprotected(withoutDisplayCards(body), protect)) === keyOf(bare)) add('same');
                }
            }
        }
        if (!reasons.length) return;
        pairs ??= alignParagraphs(sParas, oParas);
        paragraphs.push({ index, reasons, source: pairs.map[index], sure: pairs.sure[index] });
    });
    // 문단이 많이 사라졌으면(2.5.1 끊긴 덩이) 빠진 자리: 짝을 믿을 수 있는 이웃 번역 문단 사이에서 원문 문단이 2개 이상 건너뛴 곳 (끝자리 포함)
    if (message.includes('lost')) {
        pairs ??= alignParagraphs(sParas, oParas);
        const { map, sure } = pairs;
        map.forEach((s, j) => {
            const last = j === map.length - 1, next = last ? sParas.length : map[j + 1];
            if (s < 0 || !sure[j] || next < 0 || (!last && !sure[j + 1]) || next - s - 1 < 2) return;
            let row = paragraphs.find(p => p.index === j);
            if (!row) { row = { index: j, reasons: [], source: s, sure: true }; paragraphs.push(row); }
            row.reasons.push('gap');
            row.missing = [s + 1, next - 1];
        });
        // 빠진 자리를 못 찾았으면 마지막 문단에 메시지 단위 표시 하나 (누를 곳이 있어야 메시지 다시 번역을 고를 수 있다)
        if (!paragraphs.some(p => p.reasons.includes('gap'))) {
            const last = oParas.length - 1;
            let row = paragraphs.find(p => p.index === last);
            if (!row) { row = { index: last, reasons: [], source: map[last], sure: false }; paragraphs.push(row); }
            row.reasons.push('lost');
        }
        paragraphs.sort((a, b) => a.index - b.index);
    }
    return { aligned, sourceCount: sParas.length, count: oParas.length, paragraphs, message, flagged: paragraphs.length,
        warn: paragraphs.length > 0 || message.includes('lost') || message.includes('comments') };
}

/**
 * 숨김 주석을 자리표시자로 가린 채 fn(가린 원문, 가린 번역문) → 되돌린 글. 번역할 때처럼 주석을 가리고 견준다 —
 * 가리지 않으면 빈 줄을 품은 주석의 뒷조각(「…输出结果) -->」)이 원문 문단과 같아 원문 되풀이로 보여 지워졌다 (번역문 문단이 하나 많을 때)
 */
function withCommentsHidden(src, out, fn) {
    const found = [], hide = text => text.replace(CLOSED_COMMENT, comment => { found.push(comment); return `[[__VAR_${9000 + found.length - 1}__]]`; });
    const maskedSrc = hide(src), maskedOut = hide(out);
    return fn(maskedSrc, maskedOut).replace(/\[\[__VAR_(\d+)__\]\]/g, (token, n) => (Number(n) >= 9000 && found[n - 9000] !== undefined ? found[n - 9000] : token));
}
const leakFree = (src, out) => withCommentsHidden(src, out, (s, o) => stripPlanningNotes(stripDraftLeaks(o, s), s));
const echoFree = (src, out) => withCommentsHidden(src, out, (s, o) => removeSourceEcho(s, o));
/** 걷어 낼 수 있는 것(초안 · 혼잣말 · 감싸개 · 원문 되풀이)을 걷은 번역문 — 번역할 때의 마지막 그물과 같은 함수. 걷을 게 없으면 같은 글 */
export function cleanLeaks(source, translation) {
    const src = normal(source), out = normal(translation);
    const cleaned = leakFree(src, echoFree(src, out));
    return cleaned === out ? String(translation ?? '') : cleaned;
}

/** 글의 i 번째 문단 */
export function paragraphAt(text, index, protect = []) {
    return paragraphSlices(text, protect)[index]?.body ?? null;
}
/** 글의 from ~ to 번째 문단을 사이 빈 줄째 그대로 (없으면 null) */
export function paragraphRange(text, from, to, protect = []) {
    const value = normal(text), slices = paragraphSlices(value, protect);
    if (!slices[from] || !slices[to] || to < from) return null;
    return value.slice(slices[from].start, slices[to].end).replace(/^\s+|\s+$/g, '');
}
const INLINE = new Set(['span', 'font', 'q', 'b', 'i', 'strong', 'em', 'u', 's', 'del', 'small', 'mark', 'code', 'a', 'p']);
/** 문단(들)만 따로 번역해도 모양이 안 깨지나 — 글 속 꾸밈 태그 짝이 그 안에서 맞고, 닫히지 않은 주석 · 코드 울타리가 없다
 *  (앞 문단에서 연 <span> 을 이 문단에서 닫으면 따로 번역한 답이 짝을 제멋대로 맞춰 앞뒤 모양이 깨진다) */
export function standaloneParagraphs(text) {
    const value = String(text ?? '');
    if (!value.trim() || openCommentAt(value) >= 0 || fenceOpen(value)) return false;
    const stack = [];
    for (const m of value.replace(HTML_COMMENT, '').matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
        const tag = m[2].toLowerCase();
        if (!INLINE.has(tag) || /\/\s*>$/.test(m[0])) continue;
        if (m[1]) { if (stack.pop() !== tag) return false; } else stack.push(tag);
    }
    return stack.length === 0;
}
/** 번역문의 i 번째 문단을 갈아 끼운 글 (앞뒤 구분 빈 줄 · 다른 문단은 한 글자도 안 바꾼다). 문단이 없으면 null.
 *  한 문단 자리라 답 속 빈 줄은 줄바꿈 하나로 (문단 수가 늘면 뒤 문단 짝이 밀린다) */
export function replaceParagraph(text, index, replacement, protect = []) {
    const value = normal(text), slice = paragraphSlices(value, protect)[index];
    if (!slice) return null;
    const lead = /^\s*/.exec(slice.body)[0], trail = /\s*$/.exec(slice.body)[0];
    const body = normal(replacement).replace(/^\s+|\s+$/g, '').replace(/\n[\t ]*\n(?:[\t ]*\n)*/g, '\n');
    if (!body) return null;
    return value.slice(0, slice.start) + lead + body + trail + value.slice(slice.end);
}
/** 번역문의 i 번째 문단 뒤에 문단(들)을 빈 줄 하나를 두고 넣은 글 (빠진 문단 채우기). 문단이 없거나 넣을 글이 비면 null */
export function insertAfterParagraph(text, index, insertion, protect = []) {
    const value = normal(text), slice = paragraphSlices(value, protect)[index];
    const body = normal(insertion).replace(/^\s+|\s+$/g, '');
    if (!slice || !body) return null;
    const end = slice.start + slice.body.replace(/\s+$/, '').length;
    return `${value.slice(0, end)}\n\n${body}${value.slice(end)}`;
}
/**
 * 고른 문단 끝에 표시 글자를 넣은 글 (그릴 때만 — 저장 글은 그대로). mark(index) → 넣을 글.
 * 닫히지 않은 <!-- 가 있는 문단은 그 앞에 (그릴 때 주석 자리부터 가린다 — hideOpenComments). 화면에 안 보이는 문단(주석으로 여는 · 홀로 남은 --> ·
 * 주석뿐인 · 닫히지 않은 코드 울타리)이면 그 앞의 보이는 문단 끝에 — 표시가 가려지거나 코드 속 글자가 되지 않게.
 */
export function markParagraphs(text, indices, mark, protect = []) {
    const value = normal(text), slices = paragraphSlices(value, protect), at = new Map();
    /** 그 문단에서 표시가 보일 자리 (없으면 null): 끝 · 닫히지 않은 <!-- 앞 — 홀로 남은 --> 문단 · 주석으로 여는 문단 · 주석뿐인 문단은 화면에 안 보인다 */
    const anchorOf = slice => {
        if (fenceOpen(slice.body) || (/-->[\t ]*$/.test(slice.body) && !slice.body.includes('<!--'))) return null;
        // 문단 끝에 줄을 따로 차지한 닫는 태그(「…」</span>⏎</content>)는 건너 그 앞 글 끝에 — 뒤에 두면 표시가 새 줄에 혼자 놓인다
        const open = openCommentAt(slice.body), head = (open >= 0 ? slice.body.slice(0, open) : slice.body).replace(/\s+$/, '').replace(/(?:\n[\t ]*<\/[A-Za-z][\w:-]*\s*>[\t ]*)+$/, '');
        return letters(head).trim() ? slice.start + head.length : null;   // 주석 · 태그뿐인 문단(</content> 같은)은 글이 없다 — 표시가 혼자 한 줄을 차지한다
    };
    for (const index of new Set(indices || [])) {
        if (!slices[index]) continue;
        let pos = null;
        for (let k = index; k >= 0 && pos === null; k--) pos = anchorOf(slices[k]);   // 안 보이는 문단이면 앞의 보이는 문단 끝에
        if (pos !== null) at.set(pos, (at.get(pos) || '') + mark(index));
    }
    if (!at.size) return value;
    let result = '', last = 0;
    for (const pos of [...at.keys()].sort((a, b) => a - b)) { result += value.slice(last, pos) + at.get(pos); last = pos; }
    return result + value.slice(last);
}
