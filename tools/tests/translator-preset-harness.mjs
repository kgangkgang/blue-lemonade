// 시험 도우미 (시험 아님): 번역기 translate() 를 실제 index.js 에서 잘라 가짜 번역 API 로 돌린다.
//   root = 테마 사본 (다른 판과 견줄 때 그 판의 src/addons/translator 를 읽는다). 유료 호출 없음 — callLLMAPI 가 가짜.
//   가짜 번역은 글자 덩이(라틴 · 가나 · 한자)만 정해진 한글로 바꾸고 태그 · 자리표시 · ⟦n⟧ 표시 · 숫자 · 기호는 그대로 둔다.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SYL = '가나다라마바사아자차카타파하';
/** 가짜 번역의 낱말 하나 → 한글 (같은 낱말은 늘 같은 결과 — 시험이 같은 함수로 기대값을 만든다) */
export const fakeWord = word => [...word].slice(0, 3).map(c => SYL[c.codePointAt(0) % SYL.length]).join('');
const KEEP = /(<[^<>]*>|\[\[__[A-Z]+_\d+__\]\]|⟦\d+⟧|&#?\w+;)/;
/** 가짜 번역: 지킬 조각은 그대로, 나머지 글의 글자 덩이만 바꾼다 */
export function fakeTranslate(text) {
    return String(text).split(KEEP).map((part, i) => i % 2 ? part : part.replace(/[A-Za-z぀-ヿ一-鿿]+/g, fakeWord)).join('');
}

/** 요청 본문에서 사람이 읽는 글 · 태그 · 자리표시 글자 수를 나눠 센다 */
export function measureBody(body) {
    const text = String(body ?? '').replace(/^\[Keep every 「」[^\n]*\]\n\n/, '');   // 대사 괄호 안내 한 줄은 지시문이라 본문에서 뺀다
    const tags = (text.match(/<[^<>]*>/g) || []).join('');
    const holders = (text.match(/\[\[__[A-Z]+_\d+__\]\]/g) || []).join('');
    const marks = (text.match(/⟦\d+⟧/g) || []).join('');
    return { chars: text.length, html: tags.length, placeholders: holders.length, markers: marks.length };
}

export async function loadTranslator(root, { prompt = 'Translate the following text into Korean.' } = {}) {
    const dir = path.join(path.resolve(root), 'src/addons/translator');
    const imp = file => import(pathToFileURL(path.join(dir, file)));
    const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
    const card = await imp('display-cards.js'), auto = await imp('context-auto.js'), cardValueModule = await imp('card-values.js');
    const seg = await imp('translation-segments.js'), resume = await imp('translation-resume.js');
    const keep = await imp('korean-keep.js'), chatTerms = await imp('chat-glossary.js'), speech = await imp('style-profile.js');
    const promptCache = await import(pathToFileURL(path.join(path.resolve(root), 'src/prompt-cache.js')));
    const target = /\nconst KOREAN_TARGET = (\/.+\/i);/.exec(source)?.[1];
    const extra = {};
    for (const file of ['hidden-blocks.js', 'tag-compact.js', 'rp-lines.js']) if (fs.existsSync(path.join(dir, file))) Object.assign(extra, await imp(file));
    const cut = name => { const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re); if (start < 0) return null; return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, ''); };
    const events = [], ctx = { chatMetadata: {} };
    const S = { llm_prompt_chat: prompt, glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'folded', prompt_cache: false };
    const box = new Map();
    const env = {
        ...keep, KOREAN_TARGET: new Function(`return ${target};`)(), chatGlossarySignature: chatTerms.chatGlossarySignature, chatTermCachePolicy: chatTerms.createChatTermCachePolicy(),
        styleProfileBlock: speech.styleProfileBlock, styleProfileSignature: speech.styleProfileSignature, withPromptCache: promptCache.withPromptCache, pureMacros: promptCache.pureMacros,
        ...card, ...seg, ...resume, ...auto, ...extra, cardValues: o => cardValueModule.cardValues({ ...o, storage: { getItem: k => box.get(k) ?? null, setItem: (k, v) => box.set(k, String(v)) } }),
        getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ctx, guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '',
        watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null, querySelector: () => null },
        BLOCKED_CHUNK_MARK: 'failed', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x, buildGlossaryBlock: () => '',
        checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, failMarkOf: () => 'failed', splitForChunks: () => [], CHUNK_TARGET: 100000,
        looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
        tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [], dropDanglingOpenQuote: x => x,
        runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {}, log() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
        correctBackticks: x => x, window: {}, toastr: {}, FOLD_MARKUP: /llm-translator-details|class="(?:translated|original)_text|llmt-para-gap/,
    };
    // 한 줄짜리 최상위 상수(BRACKET_NOTE · MARK_TAIL …)는 index.js 에서 그대로 읽는다
    for (const m of source.matchAll(/\nconst ([A-Z][A-Z0-9_]+) = ((?:'[^'\n]*'|\/[^\n]+\/[a-z]*|\d+))\s*;/g)) if (!(m[1] in env)) { try { env[m[1]] = new Function(`return ${m[2]};`)(); } catch { /* 건너뜀 */ } }
    const install = name => { const chunk = cut(name); if (!chunk) return env[name]; env[name] = new Function('env', `with(env){return (${chunk});}`)(env); return env[name]; };
    for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders', 'dropStrayWords',
        'dropLeftoverPlaceholders', 'repairTagPairs', 'tidyGlossaryOutput', 'liveChatPrompt', 'translate', 'applyIsolation', 'processTranslationText', 'analyzeStructure', 'extractPureText', 'renderTranslation',
        'renderAllInOne', 'renderInterleaved', 'createDetailsTag', 'restoreContent']) install(name);
    let reply = fakeTranslate;
    /** 프롬프트에서 본문만 (지시문 · 묶음 머리말 뺌) */
    const bodyOf = full => { let body = String(full); const head = `${prompt}\n\n`; if (body.startsWith(head)) body = body.slice(head.length); return body.replace(seg.BATCH_HEADER, ''); };
    env.callLLMAPI = async full => { const body = bodyOf(full); events.push(body); return reply(body); };
    return {
        env, S, events, seg, card,
        setReply(fn) { reply = fn || fakeTranslate; },
        async translate(text, options = {}) { return env.translate(text, { segmentCache: true, ...options }); },
        display(original, translated) { return env.processTranslationText(original, translated); },
        async reset() { events.length = 0; box.clear(); cardValueModule.forgetCardValueMemory?.(); await seg.clearSegmentCache(); await resume.clearCheckpoints?.(); },
    };
}

/** 실리태번처럼 표시용 정규식(markdownOnly · AI 출력)을 차례로 적용한다 — $n · $<name> · {{match}} 만 (시험 고정물 규칙용) */
export function applyDisplayRegexes(text, scripts) {
    let out = String(text ?? '');
    for (const script of scripts) {
        const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(script.find);
        const re = new RegExp(m[1], m[2]);
        out = out.replace(re, (...args) => {
            const groups = typeof args.at(-1) === 'object' ? args.at(-1) : null, list = args.slice(1, groups ? -3 : -2);
            return script.replace.replace(/\{\{match\}\}/g, args[0]).replace(/\$(\d+)|\$<(\w+)>/g, (_, n, name) => name ? (groups?.[name] ?? '') : (list[Number(n) - 1] ?? ''));
        });
    }
    return out;
}
