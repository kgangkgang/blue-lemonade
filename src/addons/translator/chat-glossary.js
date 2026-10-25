// Explicit corrections belong to one chat's metadata, never global settings.
import { glossaryFold, glossaryAlternatives, glossaryOccursIn } from './glossary-match.js';
import { styleProfileSignature } from './style-profile.js';
export const CHAT_GLOSSARY_KEY = 'llmt_chat_glossary_v1';
export const CHAT_GLOSSARY_LIMIT = 100;
const term = value => typeof value === 'string' && value.trim() && value.length <= 100 && !/[\r\n<>*_`~\[\]{}\\\u0000-\u001f]/.test(value);
const sourceText = value => glossaryFold(String(value ?? '').replace(/<\/?[A-Za-z][^<>]*>|<!--[\s\S]*?-->/g,' '));
export function chatGlossaryEntries(metadata) {
    const entries = metadata?.[CHAT_GLOSSARY_KEY];
    if (!Array.isArray(entries)) return [];
    return entries.slice(0, CHAT_GLOSSARY_LIMIT).filter(e => e && term(e.src) && term(e.dst) && glossaryAlternatives(e.src).length === 1)
        .map(e => ({ id: String(e.id ?? e.src), scope: 'chat', src: e.src, dst: e.dst }));
}
export function chatGlossarySignature(metadata) { const terms=chatGlossaryEntries(metadata).map(({src,dst})=>[src,dst]),styles=styleProfileSignature(metadata);return styles.length?[...terms,['speech-preferences-v2',styles]]:terms; }
// Once a loaded chat starts a scoped translation, later rule deletion cannot
// make its in-flight result eligible for the legacy source-only global cache.
// Weak ownership has no persistent setting or unbounded source-text collection.
export function createChatTermCachePolicy() {
    const scoped = new WeakSet();
    return {
        mark(metadata) { if (metadata && chatGlossarySignature(metadata).length) scoped.add(metadata); },
        blocked(metadata) { return !!metadata && (scoped.has(metadata) || chatGlossarySignature(metadata).length > 0); },
    };
}
export function proposeChatTerm(entries, selected, source) {
    const matches = entries.filter(e => glossaryAlternatives(e.dst).some(v => v === selected.trim()))
        .flatMap(e => glossaryAlternatives(e.src)).filter(v => glossaryOccursIn(sourceText(source), v));
    const unique = [...new Set(matches)];
    return unique.length === 1 ? unique[0] : '';
}
export function planChatTerm(metadata, source, src, dst) {
    src = String(src ?? '').trim(); dst = String(dst ?? '').trim();
    if (!term(src) || !term(dst) || glossaryAlternatives(src).length !== 1 || glossaryAlternatives(dst).length !== 1) throw Error('원문 표기와 새 표기는 각각 한 가지씩, 100자 안으로 적어 주세요.');
    if (!glossaryOccursIn(sourceText(source), src)) throw Error('이 답변의 원문에서 그 표기를 찾지 못했어요. 원문을 확인해 주세요.');
    const entries = chatGlossaryEntries(metadata), key = glossaryFold(src);
    const kept = entries.filter(e => glossaryFold(e.src) !== key);
    if (kept.length >= CHAT_GLOSSARY_LIMIT) throw Error('이 채팅에 기억한 표기가 100개예요. 필요 없는 표기를 먼저 지워 주세요.');
    return [...kept, {id: key, scope: 'chat', src, dst}];
}
