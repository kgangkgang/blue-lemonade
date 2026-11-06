// 1.0.5 한글화 패널 번역 요청에 실시간 번역기 용어집을 넣어요 — 같은 항목 · 같은 차례 · 같은 [Glossary] 지시 꼴(translator/glossary-prompt.js).
// 11-06 제보: 한글화 패널로 월드인포를 옮기니 인물 이름이 용어집과 다른 표기로 옮겨졌어요. 용어집(그 캐릭터 범위)에는
// 정한 표기가 있었지만 패널 요청에는 용어집이 아예 없었어요.
// 어느 범위를 쓰나:
//  - 봇카드 탭(pt-char::아바타): 그 카드 범위 + 전체
//  - 월드인포 탭(pt-wi::이름): 그 월드를 쓰는 카드(카드의 기본 월드 · 추가 월드) 범위 + 전체
//  - 그 밖(프리셋 · 페르소나 · 정규식 이름 · 다른 확장이 맡긴 글) 또는 이어진 카드가 없을 때: 실시간 번역기와 같은 범위(이 채팅 항목 · 지금 캐릭터/그룹 · 전체)
// 이번 글에 실제로 나온 낱말만 넣어요(용어집이 길어도 토큰이 늘지 않아요). 용어집이 비었거나 꺼져 있으면 '' — 요청이 예전과 글자 그대로 같아요.
// 실리태번 없이 돌아가는 순수 함수예요(tools/tests/prompt-glossary.mjs).
import { chatGlossaryEntries } from '../translator/chat-glossary.js';
import { glossaryScopeKeysOf, pickGlossaryEntries, glossaryPromptBlock } from '../translator/glossary-prompt.js';

/** 패널 언어 값(Korean · Japanese · English · Chinese (Simplified) …) → 용어집 갈래. 모르는 언어(직접 입력 등)는 '' = 용어집 안 넣음 */
export function panelLangCode(lang) {
    const v = String(lang ?? '').trim().toLowerCase();
    if (/^(?:korean|한국어|ko(?:-kr)?)$/.test(v)) return 'ko';
    if (/^(?:japanese|日本語|일본어|ja(?:-jp)?)$/.test(v)) return 'ja';
    if (/^(?:english|영어|en(?:-[a-z]+)?)$/.test(v)) return 'en';
    if (/^(?:chinese\b|中文|简体|繁體|중국어|zh\b)/.test(v)) return 'zh';
    return '';
}

const avatarStem = avatar => String(avatar ?? '').replace(/\.[^./\\]+$/, '');

/**
 * 패널 이름표(ns) → { scopes, chat }. chat 이 true 면 이 채팅 항목도 써요(실시간 번역기와 같은 범위).
 * characters: 실리태번 캐릭터 목록(얕은 것도 data.extensions.world 는 있어요) · charLore: world_info.charLore(추가 월드 — name 은 아바타에서 확장자를 뺀 것)
 */
export function panelGlossaryScopes(ns, { ctx = null, characters = [], charLore = [] } = {}) {
    const key = String(ns ?? '');
    const own = [];
    const add = avatar => { const a = String(avatar ?? ''); if (a && !own.includes(a)) own.push(a); };
    if (key.startsWith('pt-char::')) {
        const avatar = key.slice('pt-char::'.length);
        if (avatar && !avatar.startsWith('_idx')) add(avatar);
    } else if (key.startsWith('pt-wi::')) {
        const world = key.slice('pt-wi::'.length);
        const list = Array.isArray(characters) ? characters : [];
        if (world) {
            for (const c of list) if (c?.avatar && (c?.data?.extensions?.world ?? '') === world) add(c.avatar);
            for (const lore of Array.isArray(charLore) ? charLore : []) {
                if (!Array.isArray(lore?.extraBooks) || !lore.extraBooks.includes(world)) continue;
                const hit = list.find(c => c?.avatar && avatarStem(c.avatar) === String(lore.name ?? ''));
                if (hit) add(hit.avatar);
            }
        }
    }
    if (own.length) return { scopes: own, chat: false };
    return { scopes: glossaryScopeKeysOf(ctx), chat: true };
}

/**
 * 한 요청에 넣을 [Glossary] 블록(없으면 '').
 * settings: extension_settings['llm-translator-custom'] (glossary_entries · glossary_enabled) · text: 이번에 보내는 원문 · lang: 이번 요청의 목표 언어
 */
export function panelGlossaryBlock(settings, text, { ns = '', lang = 'Korean', ctx = null, characters = [], charLore = [] } = {}) {
    if (!settings || settings.glossary_enabled === false) return '';
    const entries = Array.isArray(settings.glossary_entries) ? settings.glossary_entries : [];
    if (!entries.length || !String(text ?? '').trim()) return '';
    const target = panelLangCode(lang);
    if (!target) return '';
    const { scopes, chat } = panelGlossaryScopes(ns, { ctx, characters, charLore });
    const picked = pickGlossaryEntries(entries, scopes, chat ? chatGlossaryEntries(ctx?.chatMetadata) : []);
    return glossaryPromptBlock(picked, text, { target }).block;
}
