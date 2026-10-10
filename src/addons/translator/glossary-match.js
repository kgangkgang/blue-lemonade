// [2.2.9] 용어집 찾기 — 원문에 나온 항목만 골라 프롬프트 줄로 만든다. index.js 에서 떼어 낸 순수 함수 (실리태번 없이 tools/tests/translator-glossary.mjs 가 부른다)
// 2.2.9 새 것: 가타카나 표기 흔들림. 모델이 같은 이름을 アデルスタイン · アデルシュタイン 처럼 그때그때 다르게 적는데 용어집에는 한 표기만 있어서,
// 다른 표기가 나오면 그 줄이 빠지고 그 안에 든 짧은 말(アデル → 아델)만 들어가 「아델슈타인」으로 옮겨졌다 (2026-10-08 사용자 제보).

/**
 * [1.8.1] 찾기용 정규화: 소문자로, 하이픈·밑줄·가운뎃점·연속 공백은 한 칸으로.
 * "Heaven And Low-world Office" 와 "Heaven And Low world Office" 를 같은 말로 본다. 프롬프트에는 사용자가 적은 형태가 들어간다.
 */
export function glossaryFold(text) {
    return String(text ?? '').toLowerCase().replace(/[\s\-‐‑–—_·・]+/g, ' ').trim();
}

/**
 * [1.8.12] 정규화한 원문 안에 이 말이 "낱말로" 들어 있나.
 * 알파벳·숫자로 시작하거나 끝나는 말은 앞뒤가 알파벳·숫자가 아니어야 한다 ("Adel" 이 "Adelstein" 에 걸리지 않게).
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
// 다른 이름을 하나로 보지 않게 (ガブリエル ≠ ガブリエラ — 글자가 다르면 그대로 다름):
//  - 원문의 가타카나 덩어리(가운뎃점 · 같은 줄의 공백으로 이어진 낱말 1~4개)가 '통째로' 같을 때만. 덩어리 일부는 보지 않는다.
//    줄바꿈은 잇지 않는다 (목록의 「・アデル ⏎ ・シュタイン」 두 줄이 한 이름이 되고 프롬프트 줄 안에 줄바꿈이 들어갔다 — 5.7.3 검토)
//  - 용어집에 한 낱말로 적은 이름은 원문에서도 한 낱말일 때만 (アデル・シュタイン 두 사람을 アデルスタイン 으로 보지 않게)
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

/** 표기 차이를 지운 열쇠: アデルシュタイン → アデルスタイン, ルシファー → ルシファ, ヴァレンティン → バレンテイン (ヴ · 작은 모음 · シュ 는 5글자 이상만) */
export function kanaVariantKey(text) {
    const light = String(text ?? '').normalize('NFKC').replace(/[\sー\-‐‑–—_·・゠=]/g, '');
    const heavy = light
        .replace(/ヴァ/g, 'バ').replace(/ヴィ/g, 'ビ').replace(/ヴェ/g, 'ベ').replace(/ヴォ/g, 'ボ').replace(/ヴ/g, 'ブ')
        .replace(/シュ/g, 'ス')
        .replace(/[ァィゥェォヵヶ]/g, ch => SMALL_VOWEL[ch]);
    return heavy.length >= KANA_HEAVY_MIN ? heavy : light;
}

const kanaWords = text => [...String(text ?? '').matchAll(KANA_WORD)].length;

/** 용어집 「번역문에서 뽑기」 의 이미 있는 항목 견주기용: 가타카나 이름이면 표기 흔들림 열쇠 (아니면 '') — アデルシュタイン 은 アデルスタイン 항목과 같은 것으로 */
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
    const haystack = glossaryFold(text);
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
    if (!reverse) addKanaVariants(hits, text);
    return hits.filter(hit => hit.matched.length);
}

/**
 * 프롬프트 줄: "원문 표기 → 번역" (번역 칸에 쉼표로 여러 개면 " / " 로 — hasChoice).
 * [1.8.2] 번역 칸에 쉼표로 여러 개를 적으면 (길드, 조합, 상인회) 모델이 맥락에 맞게 하나를 고른다
 * [1.8.3] 원문 칸도 쉼표로 여러 표기를 받는다 (Guild, Merchant Guild). 원문에 실제로 나온 표기만 줄에 적는다.
 */
export function glossaryLines(entries, text, { reverse = false, maxLines = 60 } = {}) {
    const haystack = glossaryFold(text);
    const hits = glossaryHits(entries, text, { reverse });
    // [1.8.12] 더 긴 말 안에 든 짧은 말은 뺀다. 예전에는 "Adelstein" 한 줄과 "Adel" 한 줄이 함께 들어가
    // 같은 자리를 두 가지로 옮기라고 지시했다. 한글처럼 띄어쓰기로 자를 수 없는 말도 이걸로 걸러진다.
    // [2.1.3] 긴 말 밖에서도 따로 나오면 남긴다 — "庁長室 … 庁長" 에서 庁長 줄이 빠져 짧은 말을 제멋대로 옮겼다.
    // [2.2.9] 표기 흔들림으로 찾은 긴 이름(アデルシュタイン)도 여기 들어가 그 안의 アデル 줄을 뺀다
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
//    (Adelstein, アデルスタイン → 아델스타인 · 일본어로 들으면 「Adelstein → アデルスタイン」). 그 언어 표기가 없는 항목은 넣지 않는다.
//    원문이 한국어(번역문 · 내 글)여도 번역 칸(아델스타인)으로 찾아 「아델스타인 → アデルスタイン」.
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
