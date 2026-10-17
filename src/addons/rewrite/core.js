// Pure logic with no SillyTavern imports, so it can be tested in Node.

const FORMAT_MARKS = ['*', '"', '“', '”', '<', '>'];
const LETTER = '[\\p{L}\\p{N}_]';
// `…` in a word: up to this many describing words may sit in between (pointed … ears → "pointed celestial ears").
// Function words are not allowed there, so the verb in "pointed at his ears" never bridges the gap.
const GAP_MAX_WORDS = 3;
const GAP_STOP_WORDS = 'at|to|the|a|an|his|her|their|its|my|your|our|of|in|on|with|and|or|toward|towards|into|out|up|down|for|from|as|by|that|this';
const GAP_WORD = `(?!(?:${GAP_STOP_WORDS})\\b)[\\p{L}\\p{N}_'’-]+`;
// 한 줄 안의 공백만: 빈 줄을 건너 "pointed\n\nEars ringing"처럼 다른 문단의 단어끼리 이어 붙이면 안 된다.
const SPACE = '[^\\S\\r\\n]+';
// 쉼표는 꾸미는 말 앞에만 ("pointed, elven ears"). 마지막 단어 바로 앞의 쉼표는 절이 끊긴 것이라
// "She pointed, ears burning"이나 "a pointed hat, ears poking out"은 안 걸린다.
const GAP = `(?:,?${SPACE}${GAP_WORD}){0,${GAP_MAX_WORDS}}?${SPACE}`;

// Sentence end: terminal punctuation plus closing quotes/brackets/markdown marks; skips Mr. Dr. etc.
const SENTENCE_END = String.raw`(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr))[.!?…。！？]+["'”’」』)\]*_~]*`;
const BOUNDARY_BEFORE = new RegExp(`${SENTENCE_END}[ \\t]+|\\n`, 'g');
const BOUNDARY_AFTER = new RegExp(`${SENTENCE_END}(?=\\s|$)|\\n`);

export function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a word list: comma- or line-separated words, or a whole line wrapped in /.../ as a raw regex.
 * @param {string} text
 * @returns {({word: string} | {regex: string})[]}
 */
export function parseEntries(text) {
    const entries = [];
    for (const line of String(text ?? '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^\/.+\/$/.test(trimmed)) {
            entries.push({ regex: trimmed.slice(1, -1) });
            continue;
        }
        for (const part of trimmed.split(',')) {
            const word = part.trim().replace(/\s+/g, ' ');
            if (word) entries.push({ word });
        }
    }
    return entries;
}

/**
 * `*` = any letters, space = any whitespace within the line, `-` = optional hyphen or space, `'` = optional apostrophe,
 * `…` (or `...`) = up to three words in between.
 * Latin words match whole words only; other scripts (Korean, Japanese) match anywhere so particles still match.
 */
export function wordToPattern(word) {
    const { behind, body, ahead } = wordParts(word);
    return `${behind ? `(?<!${LETTER})` : ''}${body}${ahead ? `(?!${LETTER})` : ''}`;
}

function wordParts(word) {
    let source = '';
    for (const char of word.replace(/\s*(?:\.{3}|…)\s*/g, '…')) {
        if (char === '*') source += `${LETTER}*`;
        else if (char === '…') source += GAP;
        else if (char === ' ') source += SPACE;
        else if (char === '-') source += '(?:-|[^\\S\\r\\n])?';
        else if (char === '\'' || char === '’') source += '[\'’]?';
        else source += escapeRegex(char);
    }
    return { behind: /^[A-Za-z0-9]/.test(word), body: source, ahead: /[A-Za-z0-9*]$/.test(word) };
}

/**
 * 낱말 목록 → 하나의 정규식 본문. 1.7.4: 앞뒤 글자 검사가 같은 낱말이 이어지면 검사를 한 번만 적는다
 * (`(?<!L)a(?!L)|(?<!L)b(?!L)` → `(?<!L)(?:a|b)(?!L)`). 대안을 앞에서부터 차례로 시도하는 순서가 그대로라 찾는 결과는 같다.
 * 왜: 대소문자 무시 + 유니코드(`giu`)에서 `[\p{L}\p{N}_]` 한 번마다 브라우저가 모든 글자의 대소문자 짝을 계산해서,
 * 규칙 정규식을 새로 만드는 데(가비지 수집이 컴파일된 정규식을 버린 뒤 — 거의 매 답변) 4배 느린 CPU 에서 200ms 가 들었다.
 * 그게 답변이 끝나는 순간의 긴 멈춤에 그대로 더해졌다.
 */
export function joinWordPatterns(words) {
    const parts = words.map(wordParts);
    const out = [];
    for (let i = 0; i < parts.length;) {
        let j = i + 1;
        while (j < parts.length && parts[j].behind === parts[i].behind && parts[j].ahead === parts[i].ahead) j++;
        const body = j - i === 1 ? parts[i].body : `(?:${parts.slice(i, j).map(part => part.body).join('|')})`;
        out.push(`${parts[i].behind ? `(?<!${LETTER})` : ''}${body}${parts[i].ahead ? `(?!${LETTER})` : ''}`);
        i = j;
    }
    return out.join('|');
}

export function compileRule(rule) {
    const words = [];
    const regexes = [];
    const errors = [];
    for (const entry of parseEntries(rule.words)) {
        if ('word' in entry) {
            words.push(entry.word);
            continue;
        }
        try {
            regexes.push(new RegExp(entry.regex, 'giu'));
        } catch {
            try {
                regexes.push(new RegExp(entry.regex, 'gi'));
            } catch (error) {
                errors.push(`/${entry.regex}/: ${error.message}`);
            }
        }
    }
    if (words.length > 0) {
        regexes.unshift(new RegExp(joinWordPatterns(words), 'giu'));
    }
    return { rule, regexes, errors };
}

export function ruleLabel(rule) {
    const description = String(rule.description ?? '').trim();
    if (description) return description;
    const words = parseEntries(rule.words).filter(entry => 'word' in entry).map(entry => entry.word).slice(0, 8);
    return words.length > 0 ? `${rule.name} (${words.join(', ')})` : rule.name;
}

function sentenceStart(text, index) {
    let start = 0;
    for (const match of text.slice(0, index).matchAll(BOUNDARY_BEFORE)) {
        start = match.index + match[0].length;
    }
    return start;
}

function sentenceEnd(text, index) {
    const match = BOUNDARY_AFTER.exec(text.slice(index));
    if (!match) return text.length;
    return index + match.index + (match[0] === '\n' ? 0 : match[0].length);
}

// 줄바꿈을 품은 매치는 문단 두 개에 걸친 우연이다: 기본 규칙의 /정규식/ 줄은 \s+ 라서 빈 줄도 건너뛴다.
// 이런 매치를 문장으로 잡으면 AI가 두 문단을 한 문장으로 합쳐 버릴 수 있다.
function countable(matched) {
    return Boolean(matched) && !/[\r\n]/.test(matched);
}

// A rule with `near` words only counts a match that belongs to one of them. Either a near word sits within
// NEAR_WORDS right before the match (her dark eyes / Mina's long white hair), or (1.7.9) the sentence names
// one anywhere and nobody else owns the trait within OWNER_WORDS on either side: "Golden-silver hair spilled
// over her shoulders" counts, "his red eyes settled on her" and "the black hair above his temples" do not.
// 6.4.x 소유 판단 v5 (일본어 · 한국어 · 6.4.x 검토 합침):
//  · 첫째 판단: 그 사람 이름이 바로 앞 띄어쓰기 낱말 NEAR_WORDS 개 안에 있으면 (예전 창 그대로 — 띄어쓰기 없는 덩이는 덩이 전체가 한 낱말)
//    그 사람 것. 다만 가장 가까운 그 이름과 고칠 말 사이의 소유 표시가 고칠 말에 닿으면 남의 것 ("Mina watched his red eyes" · 「미나는 렉스의 붉은 눈을」)
//  · 소유 표시 = his · its · X's · 그의 · 彼の · 彼らの (영어 's 축약 · him · 그를 · 彼を 같은 목적어 · 주어는 아니다). 영어 their · theirs 는 첫째 판단에서
//    보지 않는다 — 'She closed her eyes, their black lashes trembling.' 의 their 는 그 사람의 눈을 가리킨다 (its 는 사람 몸이 아니고, 彼らの 는 여럿이다)
//    + 「알려진 다른 인물 이름(+님 · 씨 · さん · 様 …) + 의 / の」. 다른 인물은 activateRules 가 넘긴 otherNames
//    (이름 다리 · 예외 인물 · 지금 채팅의 캐릭터 · 페르소나 — 그 사람의 묶음은 뺀다). 아무 낱말+의 / の 는 보지 않는다 (자신의 · 특유의 · 위의 · 自分の · その · 目の前).
//  · 닿는다 = 사이가 띄어쓰기 낱말 하나 이하(띄어쓰기 없는 가나 · 한자는 4글자 이하)이고, 조사로 끝나는 낱말(품에서 · 어깨에 · 손을) ·
//    を · に · で … · 쉼표 · 마침표 · 비유(のような · の様な · の如き · のごとき)가 끼지 않을 때 — 「렉스의 방 앞에서 하얀 머리를」 · 「人形のような白い肌」은 그 사람 것
//  · 표시 속의 그 사람 이름: 표시의 이름 부분이 그 사람이면 그 사람 것(Mina's), 남의 표시 안에 든 그 사람 이름 자리(「レックス君の」 속 君)와
//    다른 인물 이름 바로 뒤의 호칭 자리(「レックス君が」 · 「렉스 씨가」 속 君 · 씨 — near 목록에 호칭 낱말이 있을 때)는 그 사람으로 세지 않는다
//  · 둘째 판단(문장 어딘가의 그 사람)은 예전 그대로(앞뒤 OWNER_WORDS 낱말에 his · him · 그를 · 彼 … 가 없을 때) + 고칠 말에 닿는 다른 인물 소유가 없을 때
//    — 두 판단 모두 예전 판단의 부분집합이라 예전보다 더 잡는 일은 없다 (빼기만. 띄어쓰기 없이 여러 글자가 붙은 글은 이름 경계가 달라 드물게 예외)
//  · 분절하지 않아 한자 · 가타카나 이름이 쪼개지지 않고, 이름 · 표시 · 띄어쓰기 낱말 자리는 문장마다 한 번만 찾는다(memo).
//    「닿는다」는 사이가 REACH_CHARS 글자 안일 때만 따진다 — 매치마다 앞선 모든 표시의 사이를 잘라 보지 않게 (닿는 사이는 낱말 하나 · 4글자라 결과는 같다)
const NEAR_WORDS = 3;
const OWNER_WORDS = 4;
const OTHER_OWNER = /(?<![\p{L}\p{N}_])(?:he|his|him|himself|their|theirs|its|[\p{L}]+['’]s|[\p{L}]+s['’])(?![\p{L}\p{N}_])|그(?:의|가|는|를|도|에게)(?=\s)|彼(?!女)|他/iu;
const OTHER_OWNER_ALL = new RegExp(OTHER_OWNER.source, 'giu');
const OTHER_POSSESSIVE_ALL = /(?<![\p{L}\p{N}_])(?:his|its|(?!(?:it|that|there|here|what|who|he|she|let|where|how|when)['’]s(?![\p{L}]))[\p{L}]+['’]s|[\p{L}]+s['’])(?![\p{L}\p{N}_])|그의(?=\s)|彼(?:ら)?の/giu;
const KO_CASE_END = /(?:에서|에게|한테|께서|께|에|을|를|으로|로|와|과|하고|이랑|랑|도|만|까지|부터|처럼|보다|이|가)$/u;
const JA_PARTICLE = /[をにでへがはと]|から|まで|より/u;
const JA_LIKENESS = /^(?:よう|様[なにだで]|如|ごと)/u;
const GAP_STOP = /[,，、;；:：—–.。!！?？…]/u;
const CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const POSSESSIVE_GAP_CHARS = 4;
const REACH_CHARS = 64;
const HONORIFIC_KO = '(?:[^\\S\\r\\n]?(?:님|씨|양|군|선배|선생님|선생|언니|오빠|누나|형))?';
const HONORIFIC_JA = '(?:さん|様|さま|ちゃん|くん|君|殿|氏|先輩|先生)?';
const HONORIFIC_WORDS = new Set(['님', '씨', '양', '군', '선배', '선생님', '선생', '언니', '오빠', '누나', '형', 'さん', '様', 'さま', 'ちゃん', 'くん', '君', '殿', '氏', '先輩', '先生']);

/** 띄어쓰기 낱말 자리들 [{ start, end }] (문장마다 한 번) */
const tokenSpans = text => [...text.matchAll(/\S+/g)].map(match => ({ start: match.index, end: match.index + match[0].length }));
/** at 앞 띄어쓰기 낱말 n 개의 시작 — 예전 text.slice(0, at).trim().split(/\s+/).slice(-n) 창 (at 이 낱말 가운데면 그 앞부분이 한 낱말) */
function windowStart(tokens, at, n) {
    let lo = 0, hi = tokens.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tokens[mid].start < at) lo = mid + 1; else hi = mid; }
    return lo === 0 ? at : tokens[Math.max(0, lo - n)].start;
}
/** at 뒤 띄어쓰기 낱말 n 개의 끝 — 예전 text.slice(at).trim().split(/\s+/).slice(0, n) 창 */
function windowEnd(tokens, at, n) {
    let lo = 0, hi = tokens.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tokens[mid].end <= at) lo = mid + 1; else hi = mid; }
    return lo === tokens.length ? at : tokens[Math.min(tokens.length - 1, lo + n - 1)].end;
}
/** 시험용: 글 text 의 자리 at 앞 before 낱말 · 뒤 after 낱말 창 { start, end } */
export function wordWindow(text, at, before, after) {
    const tokens = tokenSpans(String(text ?? ''));
    return { start: windowStart(tokens, at, before), end: windowEnd(tokens, at, after) };
}

const possessiveCache = new Map();
/** 다른 인물 이름 + 호칭 + 의 / の (영문 이름의 's 는 OTHER_OWNER 가 이미 본다) */
function possessiveRegex(names) {
    const list = [...new Set((Array.isArray(names) ? names : []).map(name => String(name ?? '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    const key = list.join('\u0001');
    if (!key) return null;
    if (possessiveCache.has(key)) return possessiveCache.get(key);
    const parts = list.map(name => {
        const guard = /^[\x20-\x7E]+$/.test(name) ? '(?<![A-Za-z0-9_])'
            : new RegExp(HANGUL, 'u').test(name[0]) ? `(?<!${HANGUL})` : new RegExp(KANA, 'u').test(name[0]) ? `(?<!${KANA})` : '';
        return `${guard}${escapeRegex(name)}(?:${HONORIFIC_KO}의|${HONORIFIC_JA}[^\\S\\r\\n]?の)`;
    });
    const regex = new RegExp(parts.join('|'), 'giu');
    possessiveCache.set(key, regex);
    if (possessiveCache.size > 32) possessiveCache.delete(possessiveCache.keys().next().value);
    return regex;
}
/** 소유 표시 뒤 · 고칠 말 앞 사이(between)를 건너 소유가 고칠 말에 닿는가 */
function possessiveReaches(between) {
    // 소유 바로 뒤의 쉼표 · 가운뎃점은 이어진다 (「レックスの、赤い瞳」) — 사이에 낀 쉼표 · 마침표는 다른 마디 ("his hand, red eyes")
    const gap = between.replace(/^[\s、，,・]+/u, '').replace(/・/g, ' ').replace(/\s+/g, ' ').trim();
    if (!gap) return true;
    if (GAP_STOP.test(gap) || JA_LIKENESS.test(gap)) return false;   // 「レックスのような赤い瞳」은 비유 — 그 사람의 눈
    if (!gap.includes(' ') && CJK_TEXT.test(gap)) return gap.length <= POSSESSIVE_GAP_CHARS && !JA_PARTICLE.test(gap);
    return !gap.includes(' ') && !KO_CASE_END.test(gap);   // 「렉스의 품에서 붉은 눈을」은 렉스의 눈이 아니다
}
/** 한 문장의 사실들 (문장마다 한 번): 그 사람 이름 자리 · 띄어쓰기 낱말 · 남의 표시 자리 */
function ownership(sentence, nearNames, otherNames) {
    const all = nameHits(sentence, nearNames);
    if (!all.length) return { near: all, tokens: [], pronouns: [], owners: [], possessives: [] };
    // 표시의 이름 부분이 그 사람이면 그 사람 것 (Mina's) — 그 사람 이름이 표시 첫머리에서 시작할 때만
    const hers = mark => all.some(hit => hit.start === mark.start && hit.end <= mark.end);
    const spans = regex => [...sentence.matchAll(regex)].map(match => ({ start: match.index, end: match.index + match[0].length })).filter(mark => !hers(mark));
    const possessive = possessiveRegex(otherNames);
    const pronouns = spans(OTHER_OWNER_ALL), owners = spans(OTHER_POSSESSIVE_ALL), possessives = possessive ? spans(possessive) : [];
    // 남의 표시 안에 든 그 사람 이름 자리(「レックス君の」 속 君) · 다른 인물 이름 바로 뒤의 호칭 자리(「レックス君が」 · 「렉스 씨가」)는 그 사람이 아니다
    const marks = [...owners, ...possessives];
    const others = (Array.isArray(otherNames) ? otherNames : []).map(name => String(name ?? '').trim()).filter(Boolean);
    const longest = others.reduce((max, name) => Math.max(max, name.length), 0);
    const titleOfOther = hit => HONORIFIC_WORDS.has(sentence.slice(hit.start, hit.end))
        && others.some(name => sentence.slice(Math.max(0, hit.start - longest - 1), hit.start).replace(/[^\S\n]$/, '').endsWith(name));
    const near = all.filter(hit => !marks.some(mark => mark.start < hit.end && hit.start < mark.end) && !titleOfOther(hit));
    return { near, tokens: tokenSpans(sentence), pronouns, owners, possessives };
}

function ownedByNear(sentence, index, length, nearNames, otherNames = [], memo = null, key = '') {
    if (!nearNames?.length) return true;
    let facts = memo?.get(key);
    if (!facts) {
        facts = ownership(sentence, nearNames, otherNames);
        memo?.set(key, facts);
    }
    const { near, tokens, pronouns, owners, possessives } = facts;
    if (!near.length) return false;
    const end = index + length;
    const reaches = mark => mark.end <= index && index - mark.end <= REACH_CHARS && possessiveReaches(sentence.slice(mark.end, index));
    // 1) 그 사람 이름이 바로 앞 띄어쓰기 낱말 NEAR_WORDS 개 안에 — 가장 가까운 그 이름과 고칠 말 사이의 소유 표시가 고칠 말에 닿으면 남의 것
    const from = windowStart(tokens, index, NEAR_WORDS);
    let last = null;
    for (const hit of near) if (hit.start >= from && hit.end <= index && (!last || hit.end > last.end)) last = hit;
    if (last) return !owners.some(mark => mark.start >= last.end && reaches(mark)) && !possessives.some(mark => mark.start >= last.end && reaches(mark));
    // 2) 문장 어딘가에 그 사람 — 고칠 말 앞뒤 OWNER_WORDS 낱말 안에 남의 표시가 없고, 고칠 말에 닿는 다른 인물 소유가 없으면 그 사람 것
    const before = windowStart(tokens, index, OWNER_WORDS);
    const after = windowEnd(tokens, end, OWNER_WORDS);
    if (pronouns.some(mark => (mark.start >= before && mark.end <= index) || (mark.start >= end && mark.end <= after))) return false;
    return !possessives.some(reaches);
}

// 찾기에서 빼는 부분: 코드(```…``` · `…`) · 태그와 그 속성(<span class="gold">) · 주소(…/gold-rimmed.png). 원문 마크업 위에서 찾다 보니
// 이런 곳의 낱말까지 문장으로 잡혀 AI 가 고친 글이 마크업 안에 끼워졌다. 같은 길이의 공백으로 바꿔(줄바꿈은 남긴다) 위치는 그대로 두므로
// 결과 span 은 원문을 그대로 가리키고, message.mes 는 받아들인 span 밖에서는 손대지 않는다.
// 6.1.8 그림 자리(그림 확장의 슬롯 <span class="autopic-image-slot" data-autopic-slot="…">[AutoPic 이미지]</span>)는 요소 통째로 —
//   태그만 가리면 안 글자 「[AutoPic 이미지]」가 남아 규칙(이미지 · autopic) · 반복 감지에 문장으로 잡혔고, 문장 가운데 자리는 고칠 범위에 끼어
//   AI 가 번호나 글자를 바꾸면 그림 확장이 그 자리를 못 찾아 그림을 잃었다. 첫 글자를 줄바꿈으로 가려 문단 경계처럼 — 어떤 범위도 자리를 건너지 않는다.
//   TTS 의 text.js SLOT_RE 와 같은 식 (tools/tests/rewrite-tts-slots.mjs 가 맞춰 본다). 번호 없는 껍데기(그림 확장이 지우는 것)도 같이 가린다.
//   6.1.9 캐릭터 에셋의 빈 자리(<span class="bl-asset-slot" data-asset-slot="…"></span>, 답장 뒤 다른 모델이 고르기)도 같은 그림 자리다.
//   2.1.7 「이 채팅의 에셋 그림 떼기」가 남기는 위치 표시(<span class="bl-asset-gone" data-asset-was="…"></span>)도 — 고쳐 쓴 뒤에도 그 자리에 남게.
export const SLOT_RE = /<span\b[^>]*\b(?:data-(?:autopic|asset)-slot="[^"]*"|data-asset-was="[^"]*"|class="[^"]*\b(?:autopic-image-slot|bl-asset-slot|bl-asset-gone)\b[^"]*")[^>]*>[^<]*<\/span>/g;
const blankAll = part => part.replace(/[^\n]/g, ' ');
const blankAsBreak = part => '\n' + blankAll(part.slice(1));
const PROTECTED = [
    [/```[\s\S]*?```/g, blankAll],
    [/`[^`\n]*`/g, blankAll],
    [SLOT_RE, blankAsBreak],
    [/<\/?[A-Za-z][^<>]*>/g, blankAll],
    [/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`)]+/gi, blankAll],
];

/** Blanks code, tags and URLs with same-length spaces (newlines kept) so match indices still point into the original text. A picture slot becomes a line break. */
export function maskProtected(text) {
    let masked = text;
    for (const [regex, mask] of PROTECTED) masked = masked.replace(regex, mask);
    return masked;
}

/** 글 속 그림 자리 요소들 (차례대로) */
export function slotElements(text) {
    return String(text ?? '').match(SLOT_RE) || [];
}

/** AI 에게 맥락으로 보내는 글에서 그림 자리를 뺀다 (자리만 남은 빈 줄은 하나로) */
export function stripSlots(text) {
    return String(text ?? '').replace(SLOT_RE, '').replace(/\n{3,}/g, '\n\n');
}

const isSlotLine = line => line.trim() !== '' && line.replace(SLOT_RE, '').trim() === '';
const isFlexLine = line => line.trim() === '' || isSlotLine(line);

/**
 * 6.1.8 다시 쓰는 사이에 그림 자리 줄만 더해지거나 빠졌으면, 고친 글(replacement)에 같은 자리로 다시 끼운다.
 * original = 고치기 전 글, current = 지금 글, replacement = original 을 고친 글 (checkRewrite 가 줄 수를 지키므로 줄마다 짝이 맞다).
 * 자리 줄 · 빈 줄 말고 다른 줄이 바뀌었거나, 그림 자리가 하나도 안 바뀌었으면 null (예전처럼 버린다).
 * @returns {string|null}
 */
export function rebaseSlotLines(original, current, replacement) {
    if (typeof original !== 'string' || typeof current !== 'string' || typeof replacement !== 'string') return null;
    if (current === original) return replacement;
    const O = original.split('\n'), C = current.split('\n'), R = replacement.split('\n');
    if (R.length !== O.length) return null;
    const out = [];
    let i = 0, j = 0, slots = 0;
    while (i < O.length || j < C.length) {
        if (i < O.length && j < C.length && O[i] === C[j]) { out.push(R[i]); i++; j++; continue; }
        if (j < C.length && isFlexLine(C[j])) { if (isSlotLine(C[j])) slots++; out.push(C[j]); j++; continue; }
        // 빠진 줄: 빈 줄 · 자리 줄은 고칠 범위에 든 적이 없어 고친 글에서도 그대로다
        if (i < O.length && isFlexLine(O[i]) && R[i] === O[i]) { if (isSlotLine(O[i])) slots++; i++; continue; }
        return null;
    }
    return slots > 0 ? out.join('\n') : null;
}

/**
 * 6.5.3 다시 쓰는 사이에 다른 주체(프리셋의 헬퍼 스크립트가 머리의 생각 블록을 떼어 냄 · 그림 자리 넣기)가 글을 바꿨어도, 지금 글의 보이는 부분(visibleNow)이
 * 고치기 시작할 때의 보이는 글(visible)과 같거나 자리 줄만 다르면 고친 글(fixed)을 지금 글에 다시 끼운다. 그 밖에는 null (예전처럼 버린다).
 * currentMes = 지금 글(mes) · visibleNow = 지금 글에서 생각 블록을 뺀 것 (reroll.js visibleText) · visible · fixed = rewriteText 에 준 글과 받은 글.
 * @returns {string|null}
 */
export function reanchorRewrite(currentMes, visibleNow, visible, fixed) {
    if ([currentMes, visibleNow, visible, fixed].some(value => typeof value !== 'string') || !visibleNow) return null;
    const at = currentMes.lastIndexOf(visibleNow);
    if (at < 0) return null;
    const fixedNow = visibleNow === visible ? fixed : rebaseSlotLines(visible, visibleNow, fixed);
    if (fixedNow === null) return null;
    return currentMes.slice(0, at) + fixedNow + currentMes.slice(at + visibleNow.length);
}

/**
 * Returns the sentences containing banned words, without surrounding whitespace or * / _ marks
 * so a rewrite can never unbalance italics. A rule with `nearNames` only counts matches that are theirs (ownedByNear).
 * Matching runs on the masked text (maskProtected); the returned spans slice the original.
 */
export function findSpans(text, compiled) {
    const hits = [];
    const masked = maskProtected(text);
    for (const { rule, regexes } of compiled) {
        const memo = new Map();   // 6.4.x 문장마다 한 번: 그 사람 이름 · 남의 소유 자리 (ownedByNear)
        for (const regex of regexes) {
            for (const match of masked.matchAll(regex)) {
                if (!countable(match[0])) continue;
                const matchEnd = match.index + match[0].length;
                let start = sentenceStart(masked, match.index);
                let end = sentenceEnd(masked, matchEnd);
                if (!ownedByNear(masked.slice(start, end), match.index - start, match[0].length, rule.nearNames, rule.otherNames, memo, `${start}:${end}`)) continue;
                while (start < match.index && /[\s*_]/.test(masked[start])) start++;
                while (end > matchEnd && /[\s*_]/.test(masked[end - 1])) end--;
                hits.push({ start, end, rule });
            }
        }
    }

    hits.sort((a, b) => a.start - b.start);
    const spans = [];
    for (const hit of hits) {
        const last = spans[spans.length - 1];
        if (last && hit.start < last.end) {
            last.end = Math.max(last.end, hit.end);
            if (!last.rules.includes(hit.rule)) last.rules.push(hit.rule);
        } else {
            spans.push({ start: hit.start, end: hit.end, rules: [hit.rule] });
        }
    }
    return spans.map(span => ({ ...span, text: text.slice(span.start, span.end) }));
}

// ── 1.9.2 반복 감지 ─────────────────────────────────────────
// 최근 답들과 거의 같은 문장이 또 나오면 그 문장만 '반복 표현' 규칙으로 잡아 다시 쓰게 한다.
// 비교는 문자 3-gram 자카드 유사도(한국어·영어 공통, 어순이 조금 바뀌어도 잡힘). 짧은 문장은 우연히 같기 쉬워 minLength 아래는 안 본다.
export const REPEAT_RULE = Object.freeze({ id: 'repeat', name: '반복 표현', repeat: true, description: 'wording repeated almost verbatim from an earlier reply' });

// \ub9c8\uce68\ud45c \ub4a4\uc758 \ub2eb\ub294 \ub530\uc634\ud45c \u00b7 \uad04\ud638 \u00b7 \uae30\uc6b8\uc784 \ud45c\uc2dc(* _)\uae4c\uc9c0 \ud55c \ubb38\uc7a5\uc73c\ub85c (SENTENCE_END \uc640 \uac19\uc740 \uae00\uc790\ub4e4)
const SENTENCE = /[^\n]+?(?:[.!?\u2026\u3002\uff01\uff1f]+["'\u201d\u2019\u300d\u300f)\]*_~]*(?=\s|$)|(?=\n|$))/g;
/** 문장 조각 [{start, end, text}] — findSpans 처럼 앞뒤 공백 · * _ 는 뺀다 (기울임 짝이 안 깨지게) */
export function splitSentences(text) {
    const source = String(text ?? '');
    const out = [];
    for (const match of source.matchAll(SENTENCE)) {
        let start = match.index;
        let end = start + match[0].length;
        while (start < end && /[\s*_]/.test(source[start])) start++;
        while (end > start && /[\s*_]/.test(source[end - 1])) end--;
        if (end > start) out.push({ start, end, text: source.slice(start, end) });
    }
    return out;
}

export function normalizeSentence(text) {
    return String(text ?? '').toLowerCase().normalize('NFKC')
        .replace(/[*_"\u201c\u201d'\u2018\u2019\u00ab\u00bb\u300c\u300d\u300e\u300f()\[\]{}<>.,!?\u2026;:~\-\u2014\u2013\u3001\u3002\uff01\uff1f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shingles(normalized, size = 3) {
    const set = new Set();
    for (let i = 0; i + size <= normalized.length; i++) set.add(normalized.slice(i, i + size));
    return set;
}

/** 두 (정규화한) 문장의 3-gram 자카드 유사도 0~1. 한쪽이 다른 쪽을 통째로 품으면 1. */
export function similarity(a, b) {
    const x = normalizeSentence(a), y = normalizeSentence(b);
    if (!x || !y) return 0;
    if (x === y || x.includes(y) || y.includes(x)) return 1;
    const sa = shingles(x), sb = shingles(y);
    if (sa.size === 0 || sb.size === 0) return 0;
    let both = 0;
    for (const s of sa) if (sb.has(s)) both++;
    return both / (sa.size + sb.size - both);
}

/**
 * @param {string} text 이번 답
 * @param {(string|{mes:string})[]} previous 최근 답들 (메시지 객체는 같은 글의 분석 결과를 재사용)
 * @param {{threshold?: number, minLength?: number}} [options] threshold 0~1, minLength 정규화한 글자 수
 * @returns {{start:number,end:number,text:string,rules:object[],repeatOf:string,score:number}[]}
 */
const repeatCache = new WeakMap();
let repeatSources = new Set();
// 2026-10-06 반복 감지도 findSpans 처럼 코드 · 태그 · 주소를 가리고 나눈다 — 상태창 · 선택지 마크업이 '반복'으로 잡혀 AI 가 고쳐 썼다.
// 비교(norm)는 가린 글로, 조각 글(text)은 원문에서 자른다 (같은 길이로 가리므로 위치는 그대로)
function repeatSentencesOf(raw) {
    const source = String(raw ?? '');
    return splitSentences(maskProtected(source)).map(sentence => ({ start: sentence.start, end: sentence.end, text: source.slice(sentence.start, sentence.end), norm: normalizeSentence(sentence.text) }));
}
export function findRepeats(text, previous, { threshold = 0.6, minLength = 14 } = {}) {
    const sources = new Set(previous.filter(reply => reply && typeof reply === 'object'));
    for (const reply of repeatSources) if (!sources.has(reply)) repeatCache.delete(reply);
    repeatSources = sources; // Keep analysis for the active lookback only, not every loaded reply.
    const earlier = [];
    for (const reply of previous) {
        const object = reply && typeof reply === 'object', text = object ? String(reply.mes ?? '') : reply;
        let cached = object ? repeatCache.get(reply) : null;
        if (!cached || cached.text !== text) {
            cached = { text, sentences: repeatSentencesOf(text).map(({ text, norm }) => ({ text, norm, sh: shingles(norm) })) };
            if (object) repeatCache.set(reply, cached);
        }
        for (const sentence of cached.sentences) if (sentence.norm.length >= minLength) earlier.push(sentence);
    }
    if (earlier.length === 0) return [];
    const spans = [];
    for (const sentence of repeatSentencesOf(text)) {
        const norm = sentence.norm;
        if (norm.length < minLength) continue;
        const sh = shingles(norm);
        let best = null;
        let bestScore = 0;
        for (const prev of earlier) {
            let score;
            if (norm === prev.norm || norm.includes(prev.norm) || prev.norm.includes(norm)) score = 1;
            else {
                let both = 0;
                for (const s of sh) if (prev.sh.has(s)) both++;
                score = both / (sh.size + prev.sh.size - both);
            }
            if (score > bestScore) { bestScore = score; best = prev; }
        }
        if (best && bestScore >= threshold) {
            spans.push({ start: sentence.start, end: sentence.end, text: sentence.text, rules: [REPEAT_RULE], repeatOf: best.text, score: bestScore, repeatThreshold: threshold });
        }
    }
    return spans;
}

/** 금지 묘사 조각과 반복 조각을 자리 순으로 합친다 (겹치면 하나로, 규칙은 모두) */
export function mergeSpans(text, ...lists) {
    const all = lists.flat().slice().sort((a, b) => a.start - b.start);
    const merged = [];
    for (const span of all) {
        const last = merged[merged.length - 1];
        if (last && span.start < last.end) {
            last.end = Math.max(last.end, span.end);
            for (const rule of span.rules) if (!last.rules.includes(rule)) last.rules.push(rule);
            if (span.repeatOf && !last.repeatOf) { last.repeatOf = span.repeatOf; last.repeatThreshold = span.repeatThreshold; }
        } else {
            merged.push({ ...span, rules: [...span.rules] });
        }
    }
    return merged.map(span => ({ ...span, text: text.slice(span.start, span.end) }));
}

export function splitNames(text) {
    return String(text ?? '').split(/[,\n]/).map(name => name.trim()).filter(Boolean);
}

// 한글 이름 뒤에 붙어도 이름으로 보는 꼬리 (앞쪽은 엄격히 한글이 아니어야 하고, 뒤쪽은 넓게 받는다):
// ① 조사 · 호칭 · 서술격 · 어미에 쓰이는 글자만 이어지다 한글이 아닌 글자(공백 · 문장부호 · 끝)에서 끝나거나
//    (렉스가 · 렉스에게서 · 코르빈이었다 · 미나였겠지만요 · 코르빈하고 · 렉스님이셨어요)
// ② 낱말 첫머리로는 안 쓰이는 조사·어미로 시작하면 뒤는 무엇이 와도 이름으로 본다 (미나였거든 · 렉스한테로).
// 미나리(리) · 렉스턴(턴) · 미나토(토) · 코르빈스(스)처럼 이 글자가 아닌 것이 끼면 더 긴 낱말이다. ①에 '리 · 턴 · 토 · 스' 같은
// 글자를 넣으면 그 낱말들이 이름으로 걸리니 넣지 않는다.
const KO_TAIL = '[이가은는을를의에게서한테와과랑하도만께야아여로으써처럼같보다까지부터님씨쨩짱양나요라고든조차마저뿐밖였었겠인일입습니까잖네군죠냐며면란래데예구거걸건쪽더러어지시셨신세대큼]';
const KO_LEAD = '(?:였|이었|이였|겠|이겠|하고|한테|에게|께서|님|씨|처럼|보다|까지|부터|조차|마저|이라|이잖|잖|이셨|이시|이신|입니|인데|인지|인가|일까|일지)';
const HANGUL = '[가-힣]';
const KANA = '[\\p{Script=Katakana}ー]';

/** 이름 하나를 찾는 정규식 { source, flags } — mentions 와 6.4.x nameHits(자리)가 같이 쓴다 */
function namePattern(name) {
    if (/^[\x20-\x7E]+$/.test(name)) {
        return { source: `(?<![A-Za-z0-9_])${escapeRegex(name)}(?![A-Za-z0-9_])`, flags: 'i' };
    }
    // 짧은 이름이 다른 낱말 속에서 걸리지 않게: 한글로 시작하면 앞이 한글이 아니고(티렉스 · 세미나 · 스코르빈),
    // 한글로 끝나면 뒤에 조사·어미만 온다 (KO_TAIL · KO_LEAD). 가타카나 이름은 앞뒤가 가타카나가 아니어야 한다 (セミナー).
    const first = name[0];
    const last = name[name.length - 1];
    const before = new RegExp(HANGUL, 'u').test(first) ? `(?<!${HANGUL})` : new RegExp(KANA, 'u').test(first) ? `(?<!${KANA})` : '';
    const after = new RegExp(HANGUL, 'u').test(last) ? `(?=${KO_LEAD}|${KO_TAIL}{0,10}(?!${HANGUL}))` : new RegExp(KANA, 'u').test(last) ? `(?!${KANA})` : '';
    if (!before && !after) return { source: escapeRegex(name), flags: '' };
    return { source: `${before}${escapeRegex(name)}${after}`, flags: 'u' };
}

export function mentions(text, name) {
    const { source, flags } = namePattern(name);
    return new RegExp(source, flags).test(text);
}

const hitCache = new Map();
/** 6.4.x 글 속 이름 자리들 [{ start, end }] (mentions 와 같은 경계) */
function nameHits(text, names) {
    const out = [];
    for (const name of Array.isArray(names) ? names : []) {
        if (!name) continue;
        let regex = hitCache.get(name);
        if (!regex) {
            const { source, flags } = namePattern(name);
            regex = new RegExp(source, `${flags}g`);
            hitCache.set(name, regex);
            if (hitCache.size > 256) hitCache.delete(hitCache.keys().next().value);
        }
        for (const match of text.matchAll(regex)) out.push({ start: match.index, end: match.index + match[0].length });
    }
    return out;
}

export function findActiveExceptions(recentText, exceptions) {
    return exceptions.filter(exception =>
        exception.enabled !== false && splitNames(exception.names).some(name => mentions(recentText, name)),
    );
}

/**
 * Drops rules limited to characters (`onlyFor`) who are not in the recent text, and resolves the names of the
 * remaining rules: `scopeNames` (so the prompt can say whose trait it is) and `nearNames` (words that must sit
 * right before a match, see findSpans).
 * @param {ReturnType<typeof compileRule>[]} compiled
 * @param {string} recentText
 * @param {(names: string) => string[]} [resolveNames] e.g. expands {{user}} before splitting
 * @param {string[][]} [people] 6.4.x 알려진 인물들 (한 사람의 표기 묶음) — near 규칙의 「남의 소유」 이름(otherNames)이 된다 (그 사람의 묶음은 뺀다)
 */
export function activateRules(compiled, recentText, resolveNames = splitNames, people = []) {
    return compiled.flatMap((entry) => {
        const scopeNames = resolveNames(String(entry.rule.onlyFor ?? ''));
        const nearNames = resolveNames(String(entry.rule.near ?? ''));
        if (scopeNames.length === 0 && nearNames.length === 0) return [entry];
        if (scopeNames.length > 0 && !scopeNames.some(name => mentions(recentText, name))) return [];
        const otherNames = nearNames.length > 0 ? othersOf(people, nearNames) : [];
        return [{ ...entry, rule: { ...entry.rule, scopeNames, nearNames, otherNames } }];
    });
}

const foldName = name => String(name ?? '').trim().toLowerCase().replace(/\s+/g, '');
/** 6.4.x people [[한 사람의 표기들], …] → near 가 아닌 사람들의 이름 (그 사람(near 와 같은 표기)이 든 묶음은 통째로 · 중복 · 빈 것 뺌) */
export function othersOf(people, nearNames) {
    const near = new Set((Array.isArray(nearNames) ? nearNames : []).map(foldName).filter(Boolean));
    const out = new Map();
    for (const group of Array.isArray(people) ? people : []) {
        const names = (Array.isArray(group) ? group : [group]).map(name => String(name ?? '').trim()).filter(Boolean);
        if (!names.length || names.some(name => near.has(foldName(name)))) continue;
        for (const name of names) if (!out.has(foldName(name))) out.set(foldName(name), name);
    }
    return [...out.values()];
}

/**
 * Marks spans the LLM may legitimately leave alone: a rule allowed for an active exception character, or a rule
 * limited to certain characters (someone else in the sentence may really have the trait).
 */
export function prepareSpans(spans, exceptions) {
    const allowed = new Set(exceptions.flatMap(exception => exception.allow ?? []));
    for (const span of spans) {
        // 규칙마다 따로 기억한다: 한 문장에 예외 규칙이 하나 섞였다고 같은 문장의 다른 금지 묘사까지 남겨도 되는 건 아니다.
        span.exemptRules = span.rules.filter(rule => allowed.has(rule.id) || (rule.scopeNames?.length ?? 0) > 0);
        span.exempt = span.exemptRules.length > 0;
        span.fullyExempt = span.rules.every(rule => allowed.has(rule.id));
    }
    return spans;
}

function ruleLine(rule) {
    if (rule.repeat) return '- repeated wording: the sentence repeats an earlier reply almost word for word. Keep its meaning, tone and length, but say it with fresh wording, imagery and sentence structure.';
    const names = rule.scopeNames ?? [];
    if (names.length === 0) return `- ${ruleLabel(rule)}`;
    return `- ${ruleLabel(rule)} (only for ${names.join(' / ')}: other characters may really have this, so remove it only where it is given to ${names[0]})`;
}

export function buildPrompt(text, spans, retry, exceptions) {
    const rules = [...new Set(spans.flatMap(span => span.rules))];
    const relevant = exceptions
        .map(exception => ({
            names: splitNames(exception.names),
            rules: rules.filter(rule => (exception.allow ?? []).includes(rule.id)),
        }))
        .filter(exception => exception.names.length > 0 && exception.rules.length > 0);

    const system = [
        'You are a careful copy editor for an ongoing roleplay story.',
        'Some sentences in the latest reply contain details that must not appear: appearance details a character does not have, or banned wording such as a particular laugh. Rewrite only the tagged sentences so those details are gone.',
        '',
        'Details that must not appear:',
        ...rules.map(ruleLine),
    ];
    if (relevant.length > 0) {
        system.push(
            '',
            'Exceptions: these characters really have the traits listed. Keep those details where they belong to them, and remove them only where they are given to someone else.',
            ...relevant.map(exception => `- ${exception.names.join(' / ')}: ${exception.rules.map(ruleLabel).join('; ')}`),
        );
    }
    system.push(
        '',
        'Rules:',
        '1. Remove the detail completely. Do not add any other appearance detail (no new accessories, hair, skin, scars, or clothing).',
        '2. If an action depends on it (pushing up glasses, stroking a beard, leaning on a cane), replace it with a different small gesture that fits the moment, such as rubbing the back of the neck or drumming fingers. If the banned item is a laugh or interjection, swap it for a different laugh or reaction that fits the speaker, or drop it — keep the rest of the line and its language as they are.',
        '3. Keep everything else the same: meaning, tense, point of view, names, dialogue, and every formatting mark (asterisks, quotation marks, brackets, HTML tags).',
        '4. Never leave a sentence empty.',
        '5. Return a tagged sentence unchanged if it matched only by coincidence (drinking glasses, candy canes, tan-colored clothing), if the detail belongs to an exception character, or if a detail marked "only for" belongs to a different character.',
        ...(spans.some(span => span.repeatOf) ? ['6. For a sentence tagged as repeated wording, remove nothing: rephrase it so it no longer echoes the earlier sentence given for it (different verbs, images and rhythm), keeping meaning, speaker and length.'] : []),
        `${spans.some(span => span.repeatOf) ? 7 : 6}. Reply with only the tags, in order, one per line, and nothing else, like: <s1>rewritten sentence</s1>`,
    );
    if (retry) {
        system.push(
            '',
            'Your previous answer was rejected: a tag was missing, a banned detail was left in, or formatting marks changed. Fix that this time.',
        );
    }

    const user = [
        'Latest reply, for context:',
        '<reply>',
        stripSlots(text),   // 6.1.8 그림 자리는 맥락이 아니다 (토큰만 들고 AI 가 마크업을 본다)
        '</reply>',
        '',
        'Tagged sentences to rewrite:',
        ...spans.map((span, i) => `<s${i + 1}>${span.text}</s${i + 1}>`),
    ];
    if (spans.some(span => span.repeatOf)) {
        user.push('', 'Earlier sentences the tagged ones repeat (do not reuse their wording):');
        spans.forEach((span, i) => { if (span.repeatOf) user.push(`<r${i + 1}>${span.repeatOf}</r${i + 1}>`); });
    }
    return [
        { role: 'system', content: system.join('\n') },
        { role: 'user', content: user.join('\n') },
    ];
}

export function parseRewrites(raw, count) {
    const rewrites = new Array(count);
    for (const match of String(raw).matchAll(/<s(\d+)>([\s\S]*?)<\/s\1>/g)) {
        const i = Number(match[1]) - 1;
        if (i >= 0 && i < count) rewrites[i] = match[2];
    }
    return rewrites;
}

function countMatches(text, compiled) {
    let count = 0;
    const masked = maskProtected(text);
    for (const { regexes } of compiled) {
        for (const regex of regexes) {
            for (const match of masked.matchAll(regex)) {
                if (countable(match[0])) count++;
            }
        }
    }
    return count;
}

function countOf(text, mark) {
    return text.split(mark).length - 1;
}

export function checkRewrite(span, rewrite, compiled) {
    if (rewrite === undefined) return 'missing';
    const text = rewrite.trim();
    if (!text) return 'empty';
    if (text === span.text) return span.repeatOf ? 'banned' : 'kept';
    if (text.length > span.text.length * 2 + 80) return 'too-long';
    // 6.1.8 그림 자리는 글자 하나 다르지 않게 (번호 · 안 글자가 바뀌면 그림 확장이 그 자리를 못 찾아 그림을 잃는다). 없던 자리를 만들어도 안 된다.
    const slotsBefore = slotElements(span.text), slotsAfter = slotElements(text);
    if (slotsBefore.length !== slotsAfter.length || slotsBefore.some((slot, i) => slot !== slotsAfter[i])) return 'format';
    if (FORMAT_MARKS.some(mark => countOf(text, mark) !== countOf(span.text, mark))) return 'format';
    // 줄 수가 달라지면 문단을 합치거나 쪼갠 것이다.
    if (countOf(text, '\n') !== countOf(span.text, '\n')) return 'format';
    // An exception character (or, under a limited rule, another character) may legitimately keep the detail.
    // 그 예외는 규칙 단위다: 예외 규칙은 세지 않고, 문장에 예외 아닌 규칙이 하나라도 있으면 나머지 금지 묘사가 줄어야 한다.
    const exempt = span.exemptRules ?? [];
    if (span.rules.some(rule => !rule.repeat && !exempt.includes(rule))) {
        const counted = compiled.filter(entry => !exempt.includes(entry.rule));
        if (countMatches(text, counted) >= countMatches(span.text, counted)) return 'banned';
    } else if (span.repeatOf) {
        // A repeat-only rewrite must not introduce a new banned detail.
        const counted = compiled.filter(entry => !entry.rule.repeat && !exempt.includes(entry.rule));
        if (countMatches(text, counted) > countMatches(span.text, counted)) return 'banned';
    }
    // 1.9.2 반복 표현: 고친 글이 여전히 이전 문장(또는 원문)과 거의 같으면 안 고친 것
    if (span.repeatOf && (similarity(text, span.repeatOf) >= (span.repeatThreshold ?? 0.6) || similarity(text, span.text) >= 0.85)) return 'banned';
    return 'ok';
}

/**
 * @param {object} options
 * @param {string} options.text Full message text
 * @param {object[]} options.spans From findSpans, after prepareSpans
 * @param {object[]} options.exceptions Active exceptions
 * @param {object[]} options.compiled Compiled rules
 * @param {(messages: {role: string, content: string}[]) => Promise<string>} options.generate
 * @param {number} [options.maxAttempts]
 * @param {(verdict: string, original: string, rewrite?: string) => void} [options.log]
 */
export async function rewriteText({ text, spans, exceptions, compiled, generate, maxAttempts = 2, log = () => {} }) {
    const results = new Array(spans.length).fill(null);
    let pending = spans.map((span, i) => i);
    let error = null;

    for (let attempt = 0; attempt < maxAttempts && pending.length > 0; attempt++) {
        const batch = pending.map(i => spans[i]);
        let raw;
        try {
            raw = await generate(buildPrompt(text, batch, attempt > 0, exceptions));
        } catch (caught) {
            error = caught;
            break;
        }

        const rewrites = parseRewrites(raw, batch.length);
        const retry = [];
        batch.forEach((span, j) => {
            const verdict = checkRewrite(span, rewrites[j], compiled);
            log(verdict, span.text, rewrites[j]);
            if (verdict === 'ok') {
                results[pending[j]] = rewrites[j].trim();
            } else if (verdict !== 'kept') {
                retry.push(pending[j]);
            }
        });
        pending = retry;
    }

    let output = text;
    for (let i = spans.length - 1; i >= 0; i--) {
        if (results[i] !== null) {
            output = output.slice(0, spans[i].start) + results[i] + output.slice(spans[i].end);
        }
    }
    return {
        text: output,
        fixed: results.filter(result => result !== null).length,
        failed: pending.length,
        error,
    };
}

// ── Reply start check (Scene Plan reroll) ─────────────

// Whitespace, BOM and zero-width characters a model may emit before its first tag.
const INVISIBLE_START = /^[\s\uFEFF\u200B-\u200D\u2060]+/;

/**
 * Compiles a pattern list: comma- or line-separated plain texts (case-insensitive; `anchored` pins them to the
 * start of the text) or whole lines wrapped in /.../ as raw regexes, anchored however the writer wrote them.
 * @param {string} text
 * @param {{anchored?: boolean}} [options]
 * @returns {{regexes: RegExp[], errors: string[]}}
 */
export function compilePattern(text, { anchored = false } = {}) {
    const regexes = [];
    const errors = [];
    const tags = [];
    for (const entry of parseEntries(text)) {
        if ('word' in entry) {
            const source = escapeRegex(entry.word).replace(/ /g, '\\s+');
            regexes.push(new RegExp(anchored ? `^${source}` : source, 'i'));
            const tag = entry.word.match(OPENING_TAG);
            if (tag && !tags.some(known => known.name === tag[1].toLowerCase())) tags.push(tagPair(tag[1]));
            continue;
        }
        try {
            regexes.push(new RegExp(entry.regex, 'iu'));
        } catch {
            try {
                regexes.push(new RegExp(entry.regex, 'i'));
            } catch (error) {
                errors.push(`/${entry.regex}/: ${error.message}`);
            }
        }
    }
    return { regexes, errors, tags };
}

// A plain entry that is an opening tag (`<scene_plan` or `<scene_plan>`) also tells how its block ends.
const OPENING_TAG = /^<([a-z][\w.:-]*)>?$/i;

function tagPair(name) {
    const escaped = escapeRegex(name);
    return {
        name: name.toLowerCase(),
        // Not followed by more name characters, so <scene_plan> never matches <scene_planner>.
        open: new RegExp(`<${escaped}(?![\\w.:-])`, 'i'),
        close: new RegExp(`</${escaped}\\s*>`, 'i'),
    };
}

function testAny(text, regexes) {
    return regexes.some(regex => {
        regex.lastIndex = 0;
        return regex.test(text);
    });
}

/** True when the reply, ignoring leading whitespace, starts with one of the compiled start patterns. */
export function matchesStart(text, compiled) {
    return testAny(String(text ?? '').replace(INVISIBLE_START, ''), compiled.regexes);
}

/**
 * Judges a reply against the start patterns.
 * 'missing': it doesn't start with any of them.
 * 'cut': a block opened by an opening-tag entry (<scene_plan …) is never closed, or only tags follow the closed
 * blocks — the reply stopped inside the plan or right after it.
 * 'ok': otherwise. Regex and non-tag entries only check the start.
 * @returns {'ok' | 'missing' | 'cut'}
 */
export function checkReplyStart(text, compiled) {
    const body = String(text ?? '').replace(INVISIBLE_START, '');
    if (!testAny(body, compiled.regexes)) return 'missing';
    let end = -1;
    for (const tag of compiled.tags ?? []) {
        const open = tag.open.exec(body);
        if (!open) continue;
        const close = tag.close.exec(body.slice(open.index));
        if (!close) return 'cut';
        end = Math.max(end, open.index + close.index + close[0].length);
    }
    if (end >= 0 && !body.slice(end).replace(/<[^>]*>/g, '').trim()) return 'cut';
    return 'ok';
}

/** Text of a chat-completion message: a plain string or the text parts of a multimodal array. */
export function messageText(message) {
    const content = message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => (typeof part === 'string' ? part : part?.text ?? '')).join('\n');
    }
    return '';
}

/** True when any prompt message contains a marker; an empty marker list means "always". */
export function promptHasMarker(messages, compiled) {
    if (compiled.regexes.length === 0) return true;
    return (messages ?? []).some(message => testAny(messageText(message), compiled.regexes));
}

/**
 * Calls generate until accept passes, at most maxAttempts times. A thrown error (API error, timeout) counts as a
 * failed attempt and is kept for reporting; only an error for which isFatal returns true ends the loop early.
 * @template T
 * @param {object} options
 * @param {(attempt: number) => Promise<T>} options.generate
 * @param {(result: T) => boolean} options.accept
 * @param {number} [options.maxAttempts]
 * @param {(error: Error) => boolean} [options.isFatal] e.g. "the user pressed Stop"
 * @param {(attempt: number) => void} [options.onAttempt] Called before each attempt (1-based)
 * @param {(verdict: string, result?: T) => void} [options.log]
 * @returns {Promise<{result: T | null, attempts: number, error: Error | null}>}
 */
export async function rerollUntil({ generate, accept, maxAttempts = 2, isFatal = () => false, onAttempt = () => {}, log = () => {} }) {
    let attempts = 0;
    let error = null;
    while (attempts < maxAttempts) {
        attempts++;
        onAttempt(attempts);
        let result;
        try {
            result = await generate(attempts);
        } catch (caught) {
            error = caught;
            log('error', caught);
            if (isFatal(caught)) break;
            continue;
        }
        if (accept(result)) {
            log('ok', result);
            return { result, attempts, error: null };
        }
        log('rejected', result);
    }
    return { result: null, attempts, error };
}
