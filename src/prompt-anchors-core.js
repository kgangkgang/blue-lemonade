// 8.0.6 프롬프트 자리 맞추기(공용 틀) — 작가 노트 · 전개 지시 줄을 페르소나 설명 / 캐릭터 설명 「바로 위」에 붙여 보낸다.
// 실리태번 본체는 확장 글을 메인 프롬프트 앞 · 뒤 · 채팅 안에만 넣을 수 있어서, 조립 단계 두 곳에 얇게 끼어든다.
//   채팅 완성: 프롬프트 관리자의 표식 묶음(personaDescription · charDescription)을 조립하는 순간 그 묶음 맨 앞에 메시지로 넣는다
//              → 실제 요청 · 프롬프트 관리자 토큰 수(그 표식 줄) · 프롬프트 보기에 같은 자리로 보인다. 설명이 비어 있어도 표식 자리에 들어간다.
//   텍스트 완성: 스토리 문자열을 그리는 순간 {{persona}} · {{description}} 값 앞에 붙인다(설명이 비어 있으면 그 자리에 글만).
// 같은 자리에 여럿이면 순서 = 원천 순서(작가 노트 10 → 전개 지시 20, 전개 지시 안은 항상 지시 → 켠 프롬프트(목록 순서) → 전개 지시) → 그 뒤 원래 설명.
// 이 파일은 실리태번을 불러오지 않는다(시험에서 그대로 쓴다). 실제 연결은 prompt-anchors.js.

export const ANCHORS = Object.freeze({
    persona: Object.freeze({ cc: 'personaDescription', tc: 'persona' }),
    char: Object.freeze({ cc: 'charDescription', tc: 'description' }),
});
export const ANCHOR_IDS = Object.freeze(Object.keys(ANCHORS));
export const isAnchor = value => Object.hasOwn(ANCHORS, value);
const CC_TO_ANCHOR = Object.freeze(Object.fromEntries(ANCHOR_IDS.map(id => [ANCHORS[id].cc, id])));
const ROLES = new Set(['system', 'user', 'assistant']);
export const EXTRA = Symbol.for('bl.anchorExtra');   // 표식 메시지에 달아 두는 「바로 위에 넣을 메시지」

/** 스토리 문자열 틀에 그 자리({{persona}} · {{description}})가 있는가 — 없으면 붙일 곳이 없다(원래 자리로 돌아간다) */
export function storyStringHas(template, anchor) {
    const field = ANCHORS[anchor]?.tc;
    if (!field || typeof template !== 'string') return false;
    return new RegExp(`\\{\\{\\s*${field}\\s*\\}\\}`).test(template);
}

/** 채팅 완성: 지금 캐릭터의 프롬프트 순서에 그 표식이 켜져 있는가 (꺼져 있으면 본체가 그 묶음을 조립하지 않는다) */
export function markerEnabled(promptManager, anchor) {
    const identifier = ANCHORS[anchor]?.cc;
    if (!identifier || !promptManager?.activeCharacter) return false;
    try {
        const entry = promptManager.getPromptOrderEntry?.(promptManager.activeCharacter, identifier);
        return !!entry && entry.enabled !== false;
    } catch {
        return false;
    }
}

/** 텍스트 완성 스토리 문자열 값 하나에 붙이기: 글들 → 원래 값 (빈 값이면 글만) */
export function joinAbove(texts, original) {
    const list = texts.map(text => String(text ?? '').trim()).filter(Boolean);
    if (!list.length) return original;
    const base = String(original ?? '');
    return base.trim() ? `${list.join('\n')}\n${base}` : list.join('\n');
}

/**
 * deps:
 *   api()                  'openai' | 그 밖(텍스트 완성)
 *   available(anchor, api) 그 자리에 붙일 수 있는가 (표식 켜짐 · 스토리 문자열 자리 있음)
 *   storyString()          지금 스토리 문자열 틀 (Handlebars.compile 에 들어오는 글과 견준다)
 *   createMessage(role, content, identifier) → Promise<Message>   (채팅 완성 메시지 · 토큰 수 포함)
 */
export function createAnchorEngine(deps) {
    const sources = [];
    let generation = { type: 'normal', dryRun: false };
    let placedLog = [];          // 마지막 조립에서 실제로 넣은 것 (시험 · 진단)

    function register(id, order, collect) {
        const index = sources.findIndex(source => source.id === id);
        const source = { id, order: Number(order) || 0, collect };
        if (index >= 0) sources[index] = source; else sources.push(source);
        sources.sort((a, b) => a.order - b.order);
        return () => { const at = sources.indexOf(source); if (at >= 0) sources.splice(at, 1); };
    }

    function track(type, dryRun) {
        generation = { type: dryRun ? 'normal' : (typeof type === 'string' ? type : 'normal'), dryRun: !!dryRun };
        placedLog = [];
    }

    /** 원천을 순서대로 돌며 그 자리에 들어갈 글 [{ source, text, role }] */
    function entriesFor(anchor, api = deps.api()) {
        if (!isAnchor(anchor) || !deps.available(anchor, api)) return [];
        const out = [];
        for (const source of sources) {
            let list = [];
            try { list = source.collect({ api, anchor, type: generation.type, dryRun: generation.dryRun }) || []; } catch (error) { console.warn(`[Blue Lemonade] 프롬프트 자리(${source.id})를 준비하지 못했어요`, error); }
            for (const item of list) {
                if (!item || item.anchor !== anchor) continue;
                const text = typeof item.text === 'string' ? item.text.trim() : '';
                if (!text) continue;
                out.push({ source: source.id, text, role: ROLES.has(item.role) ? item.role : 'system', identifier: item.identifier || `bl_anchor_${source.id}` });
            }
        }
        return out;
    }

    /** 채팅 완성: 본체가 표식 프롬프트로 메시지를 만들 때(Message.fromPromptAsync) 같이 넣을 메시지를 미리 만든다 → 그 메시지 객체에 달아 둔다
     *  (전역 보관 없이 메시지에 붙여서, dry run 과 본 요청이 겹쳐도 서로의 것을 가져가지 않는다) */
    async function prepareMarker(identifier) {
        const anchor = CC_TO_ANCHOR[identifier];
        if (!anchor) return null;
        const list = entriesFor(anchor, 'openai');
        if (!list.length) return null;
        const messages = [];
        for (const entry of list) messages.push(await deps.createMessage(entry.role, entry.text, entry.identifier));
        return { anchor, list, messages };
    }

    /** 채팅 완성: 본체가 그 표식 묶음을 조립(ChatCompletion.add)하기 직전 — 표식 메시지 바로 앞에 넣는다 */
    function fillCollection(collection) {
        const items = collection?.collection;
        if (!Array.isArray(items)) return false;
        const at = items.findIndex(item => item && item[EXTRA]);
        if (at < 0) return false;
        const ready = items[at][EXTRA];
        delete items[at][EXTRA];
        items.splice(at, 0, ...ready.messages);
        placedLog.push(...ready.list.map(entry => ({ api: 'openai', anchor: ready.anchor, source: entry.source, role: entry.role, text: entry.text })));
        return true;
    }

    /** 텍스트 완성: 스토리 문자열 값에 붙인다. 본체 Generate 의 값 모양(anchorBefore · mesExamplesRaw 가 있음)일 때만 */
    function storyParams(params) {
        if (!params || typeof params !== 'object' || !('anchorBefore' in params) || !('mesExamplesRaw' in params)) return params;
        let next = params;
        for (const anchor of ANCHOR_IDS) {
            const list = entriesFor(anchor, deps.api());
            if (!list.length) continue;
            const field = ANCHORS[anchor].tc;
            if (next === params) next = { ...params };
            next[field] = joinAbove(list.map(entry => entry.text), params[field]);
            placedLog.push(...list.map(entry => ({ api: 'text', anchor, source: entry.source, role: entry.role, text: entry.text })));
        }
        return next;
    }

    /** Handlebars.compile 감싸기: 스토리 문자열 틀(noEscape)일 때만 값을 바꿔 그린다 */
    function wrapCompile(compile) {
        if (compile?.__blAnchors) return compile;
        const wrapped = function (input, options) {
            const template = compile.call(this, input, options);
            let story = null;
            try { story = deps.storyString(); } catch { story = null; }
            if (typeof input !== 'string' || !options?.noEscape || input !== story || typeof template !== 'function') return template;
            return function (context, runtime) { return template.call(this, storyParams(context), runtime); };
        };
        wrapped.__blAnchors = true;
        wrapped.__blOriginal = compile;
        return wrapped;
    }

    return {
        register, track, entriesFor, prepareMarker, fillCollection, storyParams, wrapCompile,
        placed: () => placedLog.slice(),
        generation: () => ({ ...generation }),
    };
}

/** 채팅 완성 두 곳 감싸기(Message.fromPromptAsync · ChatCompletion.prototype.add). 이미 감쌌으면 그대로 */
export function patchChatCompletion(engine, Message, ChatCompletion) {
    if (Message && typeof Message.fromPromptAsync === 'function' && !Message.fromPromptAsync.__blAnchors) {
        const original = Message.fromPromptAsync;
        const wrapped = async function (prompt) {
            const message = await original.call(this, prompt);
            if (prompt && message && CC_TO_ANCHOR[prompt.identifier]) {
                try {
                    const ready = await engine.prepareMarker(prompt.identifier);
                    if (ready) Object.defineProperty(message, EXTRA, { value: ready, configurable: true, enumerable: false });
                } catch (error) { console.warn('[Blue Lemonade] 프롬프트 자리 메시지를 만들지 못했어요', error); }
            }
            return message;
        };
        wrapped.__blAnchors = true;
        wrapped.__blOriginal = original;
        Message.fromPromptAsync = wrapped;
    }
    const proto = ChatCompletion?.prototype;
    if (proto && typeof proto.add === 'function' && !proto.add.__blAnchors) {
        const original = proto.add;
        const wrapped = function (collection, position = null) {
            try { engine.fillCollection(collection); } catch (error) { console.warn('[Blue Lemonade] 프롬프트 자리에 넣지 못했어요', error); }
            return original.call(this, collection, position);
        };
        wrapped.__blAnchors = true;
        wrapped.__blOriginal = original;
        proto.add = wrapped;
    }
}
