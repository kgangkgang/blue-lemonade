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
const NEAR_WORDS = 3;
const OWNER_WORDS = 4;
const OTHER_OWNER = /(?<![\p{L}\p{N}_])(?:he|his|him|himself|their|theirs|its|[\p{L}]+['’]s|[\p{L}]+s['’])(?![\p{L}\p{N}_])|그(?:의|가|는|를|도|에게)(?=\s)|彼(?!女)|他/iu;

function ownedByNear(sentence, index, length, nearNames) {
    if (!nearNames?.length) return true;
    const before = sentence.slice(0, index).trim().split(/\s+/);
    if (nearNames.some(name => mentions(before.slice(-NEAR_WORDS).join(' '), name))) return true;
    if (!nearNames.some(name => mentions(sentence, name))) return false;
    const after = sentence.slice(index + length).trim().split(/\s+/).slice(0, OWNER_WORDS).join(' ');
    // A near name with 's is a possessive too, but it is hers.
    const around = [before.slice(-OWNER_WORDS).join(' '), after].map(part =>
        nearNames.reduce((rest, name) => rest.split(new RegExp(escapeRegex(name) + "['’]s", 'giu')).join(' '), part));
    return !around.some(part => OTHER_OWNER.test(part));
}

/**
 * Returns the sentences containing banned words, without surrounding whitespace or * / _ marks
 * so a rewrite can never unbalance italics. A rule with `nearNames` only counts matches that are theirs (ownedByNear).
 */
export function findSpans(text, compiled) {
    const hits = [];
    for (const { rule, regexes } of compiled) {
        for (const regex of regexes) {
            for (const match of text.matchAll(regex)) {
                if (!countable(match[0])) continue;
                const matchEnd = match.index + match[0].length;
                let start = sentenceStart(text, match.index);
                let end = sentenceEnd(text, matchEnd);
                if (!ownedByNear(text.slice(start, end), match.index - start, match[0].length, rule.nearNames)) continue;
                while (start < match.index && /[\s*_]/.test(text[start])) start++;
                while (end > matchEnd && /[\s*_]/.test(text[end - 1])) end--;
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

export function splitNames(text) {
    return String(text ?? '').split(/[,\n]/).map(name => name.trim()).filter(Boolean);
}

export function mentions(text, name) {
    if (/^[\x20-\x7E]+$/.test(name)) {
        return new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(name)}(?![A-Za-z0-9_])`, 'i').test(text);
    }
    return text.includes(name);
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
 */
export function activateRules(compiled, recentText, resolveNames = splitNames) {
    return compiled.flatMap((entry) => {
        const scopeNames = resolveNames(String(entry.rule.onlyFor ?? ''));
        const nearNames = resolveNames(String(entry.rule.near ?? ''));
        if (scopeNames.length === 0 && nearNames.length === 0) return [entry];
        if (scopeNames.length > 0 && !scopeNames.some(name => mentions(recentText, name))) return [];
        return [{ ...entry, rule: { ...entry.rule, scopeNames, nearNames } }];
    });
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
        '6. Reply with only the tags, in order, one per line, and nothing else, like: <s1>rewritten sentence</s1>',
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
        text,
        '</reply>',
        '',
        'Tagged sentences to rewrite:',
        ...spans.map((span, i) => `<s${i + 1}>${span.text}</s${i + 1}>`),
    ];
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
    for (const { regexes } of compiled) {
        for (const regex of regexes) {
            for (const match of text.matchAll(regex)) {
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
    if (text === span.text) return 'kept';
    if (text.length > span.text.length * 2 + 80) return 'too-long';
    if (FORMAT_MARKS.some(mark => countOf(text, mark) !== countOf(span.text, mark))) return 'format';
    // 줄 수가 달라지면 문단을 합치거나 쪼갠 것이다.
    if (countOf(text, '\n') !== countOf(span.text, '\n')) return 'format';
    // An exception character (or, under a limited rule, another character) may legitimately keep the detail.
    // 그 예외는 규칙 단위다: 예외 규칙은 세지 않고, 문장에 예외 아닌 규칙이 하나라도 있으면 나머지 금지 묘사가 줄어야 한다.
    const exempt = span.exemptRules ?? [];
    if (span.rules.some(rule => !exempt.includes(rule))) {
        const counted = compiled.filter(entry => !exempt.includes(entry.rule));
        if (countMatches(text, counted) >= countMatches(span.text, counted)) return 'banned';
    }
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
