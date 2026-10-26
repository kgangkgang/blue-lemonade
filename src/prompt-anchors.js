// 8.0.7 프롬프트 자리 맞추기 — 실리태번 연결부. 규칙 · 순서는 prompt-anchors-core.js 에 있다.
// 작가 노트(an-anchor.js)와 전개 지시(addons/direction)가 registerAnchorSource 로 글을 내고, 여기서 한 번만 본체에 끼어든다.
import { eventSource, event_types } from '../../../../../script.js';
import { Message, ChatCompletion, promptManager } from '../../../../openai.js';
import { Handlebars } from '../../../../../lib.js';
import { ANCHORS, isAnchor, storyStringHas, markerEnabled, createAnchorEngine, patchChatCompletion } from './prompt-anchors-core.js';

export { ANCHORS, isAnchor };
export const ANCHOR_LABEL = Object.freeze({ persona: '페르소나 위치', char: '캐릭터 설명 위치' });
export const ANCHOR_HINT = Object.freeze({ persona: '페르소나 설명 바로 위', char: '캐릭터 설명 바로 위' });

const ctx = () => SillyTavern.getContext();
const api = () => (ctx().mainApi === 'openai' ? 'openai' : 'text');

/** 그 자리에 붙일 수 있는가 — 채팅 완성은 프롬프트 관리자 표식이 켜져 있어야, 텍스트 완성은 스토리 문자열에 그 칸이 있어야 */
export function anchorAvailable(anchor, which = api()) {
    if (!isAnchor(anchor)) return false;
    if (which === 'openai') return markerEnabled(promptManager, anchor);
    return storyStringHas(ctx().powerUserSettings?.context?.story_string, anchor);
}

const engine = createAnchorEngine({
    api,
    available: anchorAvailable,
    storyString: () => ctx().powerUserSettings?.context?.story_string,
    createMessage: (role, content, identifier) => Message.createAsync(role, content, identifier),
});

/** 원천 등록: collect({ api, anchor, type, dryRun }) → [{ anchor, text, role, identifier }] (text 는 매크로까지 바꾼 최종 글) */
export function registerAnchorSource(id, order, collect) {
    startPromptAnchors();
    return engine.register(id, order, collect);
}

/** 시험 · 진단: 마지막 조립에서 실제로 넣은 것 */
export const lastPlaced = () => engine.placed();
export const currentGeneration = () => engine.generation();

let started = false;
export function startPromptAnchors() {
    if (started) return;
    started = true;
    try { patchChatCompletion(engine, Message, ChatCompletion); } catch (error) { console.warn('[Blue Lemonade] 채팅 완성 자리 맞추기를 준비하지 못했어요', error); }
    try { if (Handlebars && typeof Handlebars.compile === 'function') Handlebars.compile = engine.wrapCompile(Handlebars.compile); } catch (error) { console.warn('[Blue Lemonade] 스토리 문자열 자리 맞추기를 준비하지 못했어요', error); }
    // 생성 시작(dry run 포함 — 프롬프트 관리자 토큰 수도 같은 자리로 센다): 지난 조립의 남은 메시지를 비우고 종류를 받아 둔다
    eventSource.on(event_types.GENERATION_STARTED, (type, _params, dryRun) => engine.track(type, dryRun));
}
