// [2.2.9] 용어집 찾기 — 원문에 나온 항목만 골라 프롬프트 줄로 만든다. index.js 에서 떼어 낸 순수 함수 (실리태번 없이 tools/tests/translator-glossary.mjs 가 부른다)
// 2.2.9 새 것: 가타카나 표기 흔들림. 모델이 같은 이름을 クラインスタイン · クラインシュタイン 처럼 그때그때 다르게 적는데 용어집에는 한 표기만 있어서,
// 다른 표기가 나오면 그 줄이 빠지고 그 안에 든 짧은 말(クライン → 클라인)만 들어가 「클라인슈타인」으로 옮겨졌다 (2026-10-08 사용자 제보).

/**
 * [1.8.1] 찾기용 정규화: 소문자로, 하이픈·밑줄·가운뎃점·연속 공백은 한 칸으로.
 * "Sky Tower And River-side Office" 와 "Sky Tower And River side Office" 를 같은 말로 본다. 프롬프트에는 사용자가 적은 형태가 들어간다.
 */
export function glossaryFold(text) {
    return String(text ?? '').toLowerCase().replace(/[\s\-‐‑–—_·・]+/g, ' ').trim();
}

/** 6.4.0 찾기 전에 태그를 뺀다 — 속성 글자(style="…" 의 따옴표 · alt 의 이름)가 용어집에 걸리지 않게. 프롬프트에 들어가는 원문은 그대로 */
const withoutTags = text => String(text ?? '').replace(/<\/?[A-Za-z][^<>]*>|<!--[\s\S]*?-->/g, ' ');

/**
 * [1.8.12] 정규화한 원문 안에 이 말이 "낱말로" 들어 있나.
 * 알파벳·숫자로 시작하거나 끝나는 말은 앞뒤가 알파벳·숫자가 아니어야 한다 ("Klein" 이 "Kleinstein" 에 걸리지 않게).
 * 한자·가나·한글에는 낱말 경계가 없으니 예전처럼 그냥 들어 있으면 맞는 것으로 본다.
 */
export function glossaryOccursIn(haystack, probe) {
    const folded = glossaryFold(probe);
    if (!folded) return false;
    const isWordChar = ch => !!ch && /[a-z0-9]/.test(ch);
    const needsLeft = isWordChar(folded[0]);
    const needsRight = isWordChar(folded[folded.length - 1]);
    if (!needsLeft && !needsRight) return haystack.includes(folded);
    let from = 0;
    for (;;) {
        const at = haystack.indexOf(folded, from);
        if (at < 0) return false;
        const before = at > 0 ? haystack[at - 1] : '';
        const after = haystack[at + folded.length] ?? '';
        if ((!needsLeft || !isWordChar(before)) && (!needsRight || !isWordChar(after))) return true;
        from = at + 1;
    }
}

/** "길드, 조합, 상인회" → ['길드', '조합', '상인회'] (쉼표·전각 쉼표 기준) */
export function glossaryAlternatives(dst) {
    const options = String(dst ?? '').split(/[,，]/).map(part => part.trim()).filter(Boolean);
    return options.length ? options : [String(dst ?? '').trim()];
}

// ── [2.2.9] 가타카나 표기 흔들림 ──────────────────────────────────────────────
// 흔한 표기 차이만 지운 열쇠로 견준다: 장음(ー) 있고 없음 · 가운뎃점/= 띄움 · ヴ행 ↔ バ행 · シュ ↔ ス(シュタイン/スタイン) · 작은 모음(ウィ/ウイ).
// 다른 이름을 하나로 보지 않게 (ダニエル ≠ ダニエラ — 글자가 다르면 그대로 다름):
//  - 원문의 가타카나 덩어리(가운뎃점 · 같은 줄의 공백으로 이어진 낱말 1~4개)가 '통째로' 같을 때만. 덩어리 일부는 보지 않는다.
//    줄바꿈은 잇지 않는다 (목록의 「・クライン ⏎ ・シュタイン」 두 줄이 한 이름이 되고 프롬프트 줄 안에 줄바꿈이 들어갔다 — 5.7.3 검토)
//  - 용어집에 한 낱말로 적은 이름은 원문에서도 한 낱말일 때만 (クライン・シュタイン 두 사람을 クラインスタイン 으로 보지 않게)
//  - 열쇠가 4글자 이상인 표기만 (リル · リール 처럼 짧은 말은 장음 하나로 다른 말이 된다)
//  - ヴ · 작은 모음 · シュ 접기는 접은 열쇠가 5글자 이상일 때만 — 짧은 말은 흔한 낱말과 겹친다
//    (ウエスト 허리 ↔ ウェスト 이름, ブラッド 피 ↔ ヴラッド, バレット 총알 ↔ ヴァレット, スナイダー ↔ シュナイダー — 5.7.3 검토)
//  - 원문의 그 표기가 어느 항목에 글자 그대로 적혀 있으면 그 항목 것 (シュナイダー · スナイダー 가 따로 있으면 섞지 않음)
//  - 두 항목이 같은 덩어리를 원하면 어느 쪽에도 넣지 않는다
const KATA = '\\u30A1-\\u30FA\\u30FC\\u30FD\\u30FE\\u31F0-\\u31FF\\uFF66-\\uFF9F';
const SEP = '\\u0020\\u00A0\\u3000\\u30A0\\u30FB\\uFF65=\\uFF1D';
const KANA_PHRASE = new RegExp(`[${KATA}]+(?:[${SEP}]+[${KATA}]+)*`, 'g');
const KANA_WORD = new RegExp(`[${KATA}]+`, 'g');
const KANA_FORM = new RegExp(`^[${KATA}](?:[${KATA}${SEP}]*[${KATA}])?$`);
const KANA_MIN = 4;
const KANA_HEAVY_MIN = 5;
const KANA_SPAN_WORDS = 4;
const SMALL_VOWEL = { 'ァ': 'ア', 'ィ': 'イ', 'ゥ': 'ウ', 'ェ': 'エ', 'ォ': 'オ', 'ヵ': 'カ', 'ヶ': 'ケ' };

/** 표기 차이를 지운 열쇠: クラインシュタイン → クラインスタイン, ミラー → ミラ, ヴァレンティン → バレンテイン (ヴ · 작은 모음 · シュ 는 5글자 이상만) */
export function kanaVariantKey(text) {
    const light = String(text ?? '').normalize('NFKC').replace(/[\sー\-‐‑–—_·・゠=]/g, '');
    const heavy = light
        .replace(/ヴァ/g, 'バ').replace(/ヴィ/g, 'ビ').replace(/ヴェ/g, 'ベ').replace(/ヴォ/g, 'ボ').replace(/ヴ/g, 'ブ')
        .replace(/シュ/g, 'ス')
        .replace(/[ァィゥェォヵヶ]/g, ch => SMALL_VOWEL[ch]);
    return heavy.length >= KANA_HEAVY_MIN ? heavy : light;
}

const kanaWords = text => [...String(text ?? '').matchAll(KANA_WORD)].length;

/** 용어집 「번역문에서 뽑기」 의 이미 있는 항목 견주기용: 가타카나 이름이면 표기 흔들림 열쇠 (아니면 '') — クラインシュタイン 은 クラインスタイン 항목과 같은 것으로 */
export function kanaDuplicateKey(form) {
    const probe = String(form ?? '').trim();
    if (!KANA_FORM.test(probe)) return '';
    const key = kanaVariantKey(probe);
    return key.length >= KANA_MIN ? `\u0000kana:${key}` : '';
}

/** 원문의 가타카나 덩어리마다 같은 줄의 낱말 1~4개 묶음 — [{ text: 원문 그대로의 표기, key, words }] */
function kanaSpans(text) {
    const out = [];
    const seen = new Set();
    for (const phrase of String(text ?? '').matchAll(KANA_PHRASE)) {
        const words = [...phrase[0].matchAll(KANA_WORD)];
        for (let i = 0; i < words.length; i++) {
            for (let j = i; j < Math.min(words.length, i + KANA_SPAN_WORDS); j++) {
                const spelling = phrase[0].slice(words[i].index, words[j].index + words[j][0].length);
                if (seen.has(spelling)) continue;
                seen.add(spelling);
                const key = kanaVariantKey(spelling);
                if (key.length >= KANA_MIN) out.push({ text: spelling, key, words: j - i + 1 });
            }
        }
    }
    return out;
}

/** 원문에 글자 그대로는 없지만 표기만 다른 가타카나 이름을 그 항목의 matched · variants 에 더한다 (정방향 번역만) */
function addKanaVariants(hits, text) {
    const spans = kanaSpans(text);
    if (!spans.length) return;
    const written = new Set(hits.flatMap(hit => hit.probes.map(glossaryFold)));
    const claims = new Map();
    for (const hit of hits) {
        const keys = new Map();   // 열쇠 → 그 표기의 낱말 수 (원문 덩어리는 그보다 많은 낱말로 쪼개져 있으면 안 됨)
        for (const probe of hit.probes) {
            if (!KANA_FORM.test(String(probe).trim())) continue;
            const key = kanaVariantKey(probe);
            if (key.length >= KANA_MIN) keys.set(key, Math.max(keys.get(key) || 0, kanaWords(probe)));
        }
        if (!keys.size) continue;
        for (const span of spans) {
            if (!keys.has(span.key) || span.words > keys.get(span.key)) continue;
            const folded = glossaryFold(span.text);
            if (written.has(folded) || hit.matched.some(form => glossaryFold(form) === folded)) continue;
            if (!claims.has(span.text)) claims.set(span.text, new Set());
            claims.get(span.text).add(hit);
        }
    }
    for (const [spelling, owners] of claims) {
        if (owners.size !== 1) continue;
        const [hit] = owners;
        hit.matched.push(spelling);
        hit.variants.push(spelling);
    }
}

/**
 * 원문에 나오는 항목. reverse: 한국어 → 외국어(보내기·입력 번역)라 dst 로 찾는다.
 * 돌려주는 것: [{ entry, sources, targets, matched(원문에 나온 표기), variants(그중 표기 흔들림으로 찾은 것) }]
 */
export function glossaryHits(entries, text, { reverse = false } = {}) {
    const haystack = glossaryFold(withoutTags(text));
    if (!haystack) return [];
    const hits = [];
    for (const entry of entries || []) {
        if (!entry?.src || !entry?.dst) continue;
        const sources = glossaryAlternatives(entry.src);
        const targets = glossaryAlternatives(entry.dst);
        const probes = reverse ? targets : sources;
        const matched = probes.filter(probe => glossaryOccursIn(haystack, probe));
        hits.push({ entry, sources, targets, probes, matched, variants: [] });
    }
    if (!reverse) addKanaVariants(hits, withoutTags(text));
    return hits.filter(hit => hit.matched.length);
}

/**
 * 프롬프트 줄: "원문 표기 → 번역" (번역 칸에 쉼표로 여러 개면 " / " 로 — hasChoice).
 * [1.8.2] 번역 칸에 쉼표로 여러 개를 적으면 (길드, 조합, 상인회) 모델이 맥락에 맞게 하나를 고른다
 * [1.8.3] 원문 칸도 쉼표로 여러 표기를 받는다 (Guild, Merchant Guild). 원문에 실제로 나온 표기만 줄에 적는다.
 */
export function glossaryLines(entries, text, { reverse = false, maxLines = 60 } = {}) {
    const haystack = glossaryFold(withoutTags(text));
    const hits = glossaryHits(entries, text, { reverse });
    // [1.8.12] 더 긴 말 안에 든 짧은 말은 뺀다. 예전에는 "Kleinstein" 한 줄과 "Klein" 한 줄이 함께 들어가
    // 같은 자리를 두 가지로 옮기라고 지시했다. 한글처럼 띄어쓰기로 자를 수 없는 말도 이걸로 걸러진다.
    // [2.1.3] 긴 말 밖에서도 따로 나오면 남긴다 — "庁長室 … 庁長" 에서 庁長 줄이 빠져 짧은 말을 제멋대로 옮겼다.
    // [2.2.9] 표기 흔들림으로 찾은 긴 이름(クラインシュタイン)도 여기 들어가 그 안의 クライン 줄을 뺀다
    const longest = hits.flatMap(hit => hit.matched.map(glossaryFold)).sort((a, b) => b.length - a.length);
    const lines = [];
    let hasChoice = false;
    for (const hit of hits) {
        if (lines.length >= maxLines) break;
        const covered = hit.matched.every((form) => {
            const folded = glossaryFold(form);
            const containing = longest.filter(other => other.length > folded.length && other.includes(folded)); // 긴 것부터
            if (!containing.length) return false;
            let rest = haystack;
            for (const other of containing) rest = rest.split(other).join('\u0000');
            return !glossaryOccursIn(rest, form);
        });
        if (covered) continue;
        const from = hit.matched.join(' / ');
        const to = (reverse ? hit.sources : hit.targets);
        if (to.length > 1) hasChoice = true;
        lines.push(`${from} → ${to.join(' / ')}`);
    }
    return { lines, hasChoice };
}

/** 문단 캐시 서명에 붙일 표시: 표기 흔들림으로 찾은 이름이 있으면 '표기>항목' 목록, 없으면 '' (예전 캐시 키 그대로) */
export function glossaryVariantTag(entries, text) {
    return glossaryHits(entries, text).flatMap(hit => hit.variants.map(spelling => `${spelling}>${hit.entry.id ?? hit.entry.src}`)).sort().join('|');
}

// ── [2.3.0] TTS 듣는 언어 (테마 5.8.2 · TTS 1.4.4) ─────────────────────────────────
// TTS 가 읽을 줄을 고른 언어(ko · ja · en · zh)로 옮길 때 붙이는 용어집 줄. 채팅 번역(한국어)용 줄과 따로 만든다:
//  - ko: 채팅 번역과 같은 줄 (원문 표기 → 번역 칸) — glossaryLines 그대로
//  - 그 밖: 번역 칸은 한국어라 쓸 수 없고, 원문 칸에 그 언어 글자로 적은 표기가 있으면 그것을 쓰라고 한다
//    (Kleinstein, クラインスタイン → 클라인스타인 · 일본어로 들으면 「Kleinstein → クラインスタイン」). 그 언어 표기가 없는 항목은 넣지 않는다.
//    원문이 한국어(번역문 · 내 글)여도 번역 칸(클라인스타인)으로 찾아 「클라인스타인 → クラインスタイン」.
/** 표기 하나의 글자 갈래: 'ko' (한글) · 'ja' (가나가 있음) · 'han' (한자만 — 일본어 · 중국어 둘 다) · 'en' (라틴) · '' */
export function formScript(form) {
    const s = String(form ?? '');
    if (/[\uac00-\ud7a3\u3130-\u318f]/.test(s)) return 'ko';
    if (/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/.test(s)) return 'ja';
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(s)) return 'han';
    if (/[A-Za-z\u00c0-\u024f]/.test(s)) return 'en';
    return '';
}
const formFits = (form, target) => { const k = formScript(form); return k === target || (k === 'han' && (target === 'ja' || target === 'zh')); };
/** 목표 언어용 용어집 줄 → { lines, hasChoice } (glossaryLines 와 같은 모양) */
export function glossaryLinesFor(entries, text, target, { maxLines = 60 } = {}) {
    if (target === 'ko') return glossaryLines(entries, text, { maxLines });
    const lines = [];
    const seen = new Set();
    let hasChoice = false;
    for (const reverse of [false, true]) {
        for (const hit of glossaryHits(entries, text, { reverse })) {
            if (lines.length >= maxLines) break;
            const matched = new Set(hit.matched.map(glossaryFold));
            const forms = hit.sources.filter(form => formFits(form, target) && !matched.has(glossaryFold(form)));
            if (!forms.length) continue;
            const line = `${hit.matched.join(' / ')} → ${forms.join(' / ')}`;
            if (seen.has(line)) continue;
            seen.add(line);
            if (forms.length > 1) hasChoice = true;
            lines.push(line);
        }
    }
    return { lines, hasChoice };
}

// ── 6.4.0 번역문 마무리 (번역기 2.4.2) ─────────────────────────────────────────────
// 사용자 10-14 제보: Claude Haiku 5.5 가 용어집 줄(영문 이름 → 한글 이름)을 받고도 문단 묶음 하나에서 영문 이름 그대로 남겼고,
// 속마음 줄 끝에 원문에 없는 여는 꺽쇠 「 하나를 붙였다. 프롬프트로는 100% 안 막혀 저장 전에 · 저장된 번역을 보여 줄 때 정리한다.
// 이름 지키기는 「내 캐릭터 · 지금 캐릭터」 이름 항목만 — 일반 낱말 항목은 영어로 둔 외침 · 괄호 병기를 망가뜨려서 (독립 검증) 손대지 않는다.
// 2.6.7 원문 칸에 라틴 이름꼴과 가타카나 표기가 같이 있는 항목(Corvin, コルヴィン → 코르빈)도 이름 — 음역이라 일반 낱말이 아니다.
//   여러 인물이 든 카드(카드 이름 ≠ 인물 이름) · 메신저 이름표(**Corvin:** `…`)에서 영어로 남던 것 (사용자 10-16). Hell · Nectar 같은 항목은 그대로 대상 아님.
const HANGUL_ALL = /[가-힣]/g;
const LATIN_ALL = /[A-Za-z]/g;
/** 라틴 이름꼴: 대문자로 시작하는 낱말(들) — Mina · Mina Park */
const LATIN_NAME = /^[A-Z][A-Za-z'’]*(?:[ -][A-Za-z][A-Za-z'’]*)*$/;
/** 태그 · 자리표시자는 건드리지 않는다 (나눈 조각의 홀수 칸) */
const PROTECTED_PARTS = /(<[^<>]*>|\[\[\/?__VAR_\d+__\]\])/;
/** 2.6.7 가타카나 표기 (가운뎃점 · 빈칸으로 이은 것, 반각 포함) */
const KATAKANA_FORM = /^[\u30A0-\u30FF\uFF65-\uFF9F]+(?:[ ・·][\u30A0-\u30FF\uFF65-\uFF9F]+)*$/;
/** 2.6.7 원문 칸에 라틴 이름꼴 + 가타카나 표기가 같이 있으면 음역 이름 */
export const transliteratedName = sources => sources.some(form => KATAKANA_FORM.test(String(form).trim())) && sources.some(form => LATIN_NAME.test(String(form).trim()));
const escapePattern = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 받침 있음 / 없음 짝 (긴 것부터) · 그 뒤에 붙어도 되는 말 — 꼬리 앞부분만 떼어 맞추고, 나머지가 이 목록에 없으면(과장님 · 나리 · 라인) 조사가 아니라 그대로 둔다
const PARTICLE_PAIRS = [
    ['이에요', '예요', ['']], ['이었', '였', ['다', '어', '어요', '고', '는데', '던', '지', '을', '습니다']], ['이랑', '랑', ['', '은', '도', '의', '만']],
    ['으로', '로', ['', '서', '써', '부터', '도', '는', '만', '서는', '서도', '의']], ['이라', '라', ['', '고', '는', '서', '도', '면']], ['이나', '나', ['']],
    ['이든', '든', ['', '지']], ['이며', '며', ['']], ['이야', '야', ['']],
    ['은', '는', ['']], ['을', '를', ['']], ['과', '와', ['', '의', '는', '도', '만']], ['이', '가', ['']],
];

/** 받침에 맞는 조사 (조사가 아니거나 짝이 없는 말은 그대로): particleFor('코르빈', '가') → '이', particleFor('미나', '으로서') → '로서' */
export function particleFor(word, tail) {
    const code = String(word ?? '').slice(-1).charCodeAt(0) - 0xac00;
    if (!(code >= 0 && code < 11172) || !tail) return tail;
    const final = code % 28;
    for (const [withFinal, withoutFinal, follows] of PARTICLE_PAIRS) {
        const head = tail.startsWith(withFinal) ? withFinal : tail.startsWith(withoutFinal) ? withoutFinal : '';
        if (!head) continue;
        const rest = tail.slice(head.length);
        if (!follows.includes(rest)) return tail;
        if (withFinal === '으로') return (final && final !== 8 ? '으로' : '로') + rest;   // ㄹ 받침은 「로」
        return (final ? withFinal : withoutFinal) + rest;
    }
    return tail;
}

const fold = text => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * 정방향 한국어 번역에서, 원문에 나온 「내 캐릭터 · 지금 캐릭터」 이름 항목의 라틴 표기를 모델이 그대로 남겼으면 번역 칸 한글로 바꾼다.
 * names = 그 이름들(페르소나 이름 · 캐릭터 이름). 항목의 번역 칸이나 원문 칸이 이 이름이면 대상.
 * 2.6.7 원문 칸에 가타카나 표기가 같이 적힌 음역 이름 항목(transliteratedName)은 names 밖이어도 대상. 둘 다 아니면 아무것도 안 한다.
 * 한글이 주된 줄만 · 태그와 자리표시자 밖 · 파일 이름 · 주소 속은 빼고 · 「번역(원문)」 괄호 병기와 뒤에 영어 낱말이 이어지는 자리(영어로 둔 말)도 뺀다.
 * 그 표기를 품은 더 긴 용어집 표기 자리는 건드리지 않는다. 바로 붙은 조사는 받침에 맞추고, 's 는 「의」로.
 */
export function enforceGlossaryNames(entries, source, output, { names = [] } = {}) {
    const out = String(output ?? '');
    const wanted = new Set((names || []).map(fold).filter(Boolean));
    if (!out) return out;
    const lower = out.toLowerCase();
    const swaps = [];
    for (const entry of entries || []) {
        if (!entry?.src || !entry?.dst) continue;
        const targets = glossaryAlternatives(entry.dst);
        const sources = glossaryAlternatives(entry.src);
        if (targets.length !== 1 || !/[가-힣]/.test(targets[0]) || /[A-Za-z]/.test(targets[0])) continue;
        if (!wanted.has(fold(targets[0])) && !sources.some(form => wanted.has(fold(form))) && !transliteratedName(sources)) continue;
        for (const form of sources) {
            const spelled = String(form).trim();
            if (LATIN_NAME.test(spelled) && lower.includes(spelled.toLowerCase())) swaps.push({ form: spelled, dst: targets[0] });
        }
    }
    if (!swaps.length) return out;
    const haystack = glossaryFold(withoutTags(source));
    const live = swaps.filter(({ form }) => glossaryOccursIn(haystack, form));
    if (!live.length) return out;
    live.sort((a, b) => b.form.length - a.form.length);
    // 더 긴 용어집 표기(그 이름을 품은 것) — 그 자리는 그대로 둔다
    const longer = (entries || []).flatMap(entry => glossaryAlternatives(entry?.src)).map(form => String(form).trim())
        .filter(form => /[A-Za-z]/.test(form) && live.some(swap => form.length > swap.form.length && form.toLowerCase().includes(swap.form.toLowerCase())))
        .sort((a, b) => b.length - a.length);
    const patterns = live.map(({ form, dst }) => ({
        dst,
        // 's 뒤에 영어 낱말이 이어지면(Mina's Notebook) 소유격이 아니라 영어로 둔 말 — 이름만 잡는 쪽으로 되돌아가도 뒤의 ' + 라틴 글자에서 막힌다
        // 6.4.1 뒤의 ' 는 라틴 글자나 「공백 + 영어 낱말」이 이어질 때만 막는다 — 작은따옴표로 감싼 이름(‘Mina’라고)은 바꾸고, ‘Mina’ Diaries 는 그대로
        pattern: new RegExp(`(?<![A-Za-z0-9_./\\\\-])${escapePattern(form).replace(/[ -]+/g, '[ \\t\\-]+')}(?:(['’]s(?![ \\t]+[A-Za-z]))|([\\uac00-\\ud7a3]+))?(?![A-Za-z0-9_/\\\\-]|\\.[A-Za-z0-9]|[ \\t]+[A-Za-z]|['’](?=[A-Za-z]|[ \\t]+[A-Za-z]))`, 'gi'),
    }));
    const guards = longer.map(form => new RegExp(escapePattern(form).replace(/[ -]+/g, '[ \\t\\-]+'), 'gi'));
    return out.split('\n').map((line) => {
        const parts = line.split(PROTECTED_PARTS);
        const plain = parts.filter((part, index) => index % 2 === 0).join(' ');
        if ((plain.match(HANGUL_ALL) || []).length <= (plain.match(LATIN_ALL) || []).length) return line;
        return parts.map((part, index) => {
            if (index % 2) return part;
            const kept = [];
            let text = part;
            for (const guard of guards) text = text.replace(guard, whole => `\u0000${kept.push(whole) - 1}\u0000`);
            for (const { dst, pattern } of patterns) {
                text = text.replace(pattern, (whole, possessive, tail, offset, all) => {
                    const before = all.slice(Math.max(0, offset - dst.length - 3), offset);
                    const after = all.slice(offset + whole.length, offset + whole.length + dst.length + 3);
                    // 괄호 병기 (미나(Mina) · 미나 (Mina) · 미나（Mina） · Mina(미나)) · 앞이 영어 낱말이면 영어로 둔 말 ("Welcome aboard, Mina!")
                    if (new RegExp(`${escapePattern(dst)}[ \\t]*[(（]$`).test(before) || new RegExp(`^[ \\t]*[(（]${escapePattern(dst)}`).test(after)) return whole;
                    // 6.4.1 이름에 한글 조사나 's 가 붙었으면 한국어 문장 속 이름 — 앞이 영어여도 바꾼다 (OK, Mina가 · Mina, Corvin이)
                    if (!tail && !possessive && /[A-Za-z][,.!?]?[ \t]+$/.test(all.slice(Math.max(0, offset - 3), offset))) return whole;
                    if (possessive) return `${dst}의`;
                    // 6.4.1 받침 있는 이름 + 단독 「야」: 뒤가 , ! ~ 면 부르는 말 → 「아」(Corvin야, → 코르빈아,) · 아니면 서술 → 「이야」(particleFor)
                    const calling = tail === '야' && particleFor(dst, '가') === '이' && /^[ \t]*[,!~]/.test(after);
                    return dst + (tail ? (calling ? '아' : particleFor(dst, tail)) : '');
                });
            }
            return text.replace(/\u0000(\d+)\u0000/g, (whole, at) => kept[Number(at)]);
        }).join('');
    }).join('\n');
}

/**
 * 원문의 「」 짝이 맞는데 번역문에만 여는 「 가 하나 더 있고, 그것이 줄 끝(닫는 태그 · 자리표시자 앞)에 홀로 있으면 지운다.
 * 원문에도 줄 끝에 여는 「가 있으면(「 ⏎ … 」 대사) 건드리지 않는다. 여러 줄에 걸친 대사는 번역문 짝이 맞아 그대로다.
 */
export function dropDanglingOpenQuote(output, source) {
    const out = String(output ?? '');
    const src = String(source ?? '');
    const count = (text, mark) => text.split(mark).length - 1;
    if (count(src, '「') !== count(src, '」') || count(out, '「') !== count(out, '」') + 1) return out;
    const lineEnd = /「(?=[ \t]*(?:(?:<\/[^<>]+>|\[\[\/__VAR_\d+__\]\])[ \t]*)*(?:\r?\n|$))/g;
    if (lineEnd.test(src)) return out;
    lineEnd.lastIndex = 0;
    const lone = [...out.matchAll(lineEnd)];
    if (lone.length !== 1) return out;
    return out.slice(0, lone[0].index) + out.slice(lone[0].index + 1);
}
