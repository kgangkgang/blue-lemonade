// 1.0.5 용어집 공용 — 실시간 번역기(index.js · shell.js)와 한글화 패널(prompt/glossary.js)이 같은 항목 · 같은 차례 · 같은 지시 꼴을 써요.
// 11-06 제보: 한글화 패널로 월드인포를 옮기니 인물 이름이 용어집과 다른 표기가 됐어요. 패널 요청에 용어집이 없었어요.
// 실리태번 없이 돌아가는 순수 함수만 둬요(tools/tests/prompt-glossary.mjs · translator-group-glossary.mjs 가 그대로 불러요).
import { glossaryFold, glossaryAlternatives, glossaryLines, glossaryLinesFor } from './glossary-match.js';

/** 번역기 설정 자리(extension_settings[...]) — 용어집 항목(glossary_entries) · 켜기(glossary_enabled)가 여기 있어요 */
export const GLOSSARY_SETTINGS_KEY = 'llm-translator-custom';
/** 한 요청에 넣는 용어집 줄 상한 — 넘으면 긴 표기부터 남겨요(glossaryLines) */
export const GLOSSARY_MAX_LINES = 60;

/** 지금 열린 캐릭터(또는 그룹)의 용어집 범위 키. 아무것도 안 열려 있으면 null */
export function glossaryScopeKeyOf(ctx) {
    if (ctx?.groupId) return `group:${ctx.groupId}`;
    const avatar = ctx?.characters?.[ctx.characterId]?.avatar;
    return avatar ? String(avatar) : null;
}

/** [2.7.4] 번역에 쓰는 범위들 — 이기는 차례. 캐릭터 채팅은 [그 캐릭터], 그룹 채팅은 [그룹, 멤버 캐릭터…(group.members 차례)]. 전체(global)는 pickGlossaryEntries 가 맨 뒤에 붙여요 */
export function glossaryScopeKeysOf(ctx) {
    const own = glossaryScopeKeyOf(ctx);
    if (!own) return [];
    if (!ctx?.groupId) return [own];
    const group = (ctx.groups || []).find(item => item && item.id === ctx.groupId);
    const members = (Array.isArray(group?.members) ? group.members : []).map(String).filter(member => member && member !== 'global');
    return [own, ...members.filter((member, index) => members.indexOf(member) === index)];
}

/**
 * 범위 차례대로 항목을 골라요: 이 채팅 항목(chatEntries) → 범위들(scopes 차례) → 전체(global).
 * 표기가 하나라도 겹치면 먼저 온 쪽이 이겨요([1.8.12] 찾기와 같은 정규화 glossaryFold 로 견줘요).
 */
export function pickGlossaryEntries(entries, scopes = [], chatEntries = []) {
    const list = Array.isArray(entries) ? entries : [];
    const keys = Array.isArray(scopes) ? scopes : scopes ? [scopes] : [];
    const chosen = [];
    const claimed = new Set();
    const take = entry => {
        if (!entry?.src || !entry?.dst) return;
        const forms = glossaryAlternatives(entry.src).map(glossaryFold).filter(Boolean);
        if (!forms.length || forms.some(form => claimed.has(form))) return;
        for (const form of forms) claimed.add(form);
        chosen.push(entry);
    };
    for (const entry of chatEntries || []) take(entry);
    for (const key of keys) { if (key === 'global') continue; for (const entry of list) if (entry?.scope === key) take(entry); }
    for (const entry of list) if (entry?.scope === 'global') take(entry);
    return chosen;
}

/** 지시 한 줄. 번역 칸이 한국어라 한국어로 옮길 때만 조사 문구를 붙여요(번역기 채팅 번역과 글자 그대로 같아요) */
export function glossaryRule(hasChoice, target = 'ko') {
    const keep = target === 'ko' ? 'keep the given spelling; Korean particles may attach naturally' : 'keep the given spelling';
    return hasChoice
        ? `Render these terms exactly as given below (${keep}). Where several options are separated by " / ", pick the one that fits the context and use only options from the list:`
        : `Render these terms exactly as given below (${keep}):`;
}

/** [Glossary] 블록 글. 줄이 없으면 '' (요청이 예전과 글자 그대로 같아요) */
export function glossaryBlockText(lines, hasChoice, target = 'ko') {
    if (!lines?.length) return '';
    return `[Glossary]\n${glossaryRule(hasChoice, target)}\n` + lines.join('\n');
}

/**
 * 이 글에 실제로 나온 항목만 블록으로 → { block, lines, dropped }. 용어집이 길어도 나온 낱말만 들어가요(토큰 아낌).
 * target: 'ko'(번역 칸 그대로) · 'ja' · 'en' · 'zh'(원문 칸에 그 언어로 적은 표기만 — glossaryLinesFor). 그 밖(직접 입력 언어 등)은 넣지 않아요.
 */
export function glossaryPromptBlock(entries, text, { reverse = false, target = 'ko', maxLines = GLOSSARY_MAX_LINES } = {}) {
    if (!target || !Array.isArray(entries) || !entries.length || !String(text ?? '').trim()) return { block: '', lines: [], dropped: 0 };
    const { lines, hasChoice, dropped = 0 } = target === 'ko'
        ? glossaryLines(entries, text, { reverse, maxLines })
        : glossaryLinesFor(entries, text, target, { maxLines });
    return { block: glossaryBlockText(lines, hasChoice, target), lines, dropped };
}
