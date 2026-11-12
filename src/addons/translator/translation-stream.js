// 2.6.2 묶음 번역 흘려받기 (「71개 중 1」처럼 진행이 보이게): 실리태번 서버가 공급자의 SSE 를 그대로
// 넘겨주니 그걸 읽어 글만 모으고, 다 오면 실리태번이 흘려받기 없이(stream:false) 줬을 답과 같은 꼴로 돌려준다 —
// 번역기의 답 읽기(끝난 까닭 · 차단 · 빈 답 · 생각만 온 답, extractTranslationResult)를 그대로 지나서 같은 답이면 번역문이 바이트까지 같다.
// 실리태번이 감쌀 때 버리는 것(Claude 의 stop_reason · Gemini 의 finishReason)은 여기서도 버린다 (지금과 같은 판정).
// 못 읽으면(끊김 · 오류 이벤트 · 모르는 꼴 · 끝 표시 없음) streamFailed — 부르는 쪽이 예전 요청(stream:false)으로 다시 보낸다.
// 묶음 번역을 처음 흘려받을 때만 불러온다 (index.js streamedReply).

// 실리태번 getStreamingReply 가 choices[0].delta.content 로 읽는 공급자 (나머지는 흘려받지 않고 예전처럼)
const OPENAI_LIKE = new Set(['openai', 'openrouter', 'deepseek', 'custom', 'mistralai', 'groq', 'xai', 'aimlapi', 'electronhub', 'chutes', 'nanogpt',
    'fireworks', 'moonshot', 'siliconflow', 'cometapi', 'zai', 'pollinations', 'workers_ai', 'azure_openai']);
/** 실리태번 chat_completion_source → 읽는 법 ('' = 흘려받지 않음) */
export function streamFamily(source) {
    const s = String(source ?? '').toLowerCase();
    if (s === 'claude') return 'claude';
    if (s === 'makersuite' || s === 'vertexai') return 'gemini';
    if (s === 'cohere') return 'cohere';
    return OPENAI_LIKE.has(s) ? 'openai' : '';
}

/** 흘려받다 실패 — 예전 요청으로. unsupported = 이 연결은 흘려받기를 못 하는 듯 (1.0.1: 곧장 끄지 않는다 — 부르는 쪽이 두 번 거듭될 때만 이 세션 동안 끈다) */
export function streamFailed(why, unsupported = false) {
    return Object.assign(new Error(`흘려받기 실패: ${why}`), { streamFailed: true, unsupported, why });
}

const textOf = parts => (Array.isArray(parts) ? parts.filter(p => !p?.type || p.type === 'text').map(p => p?.text ?? '').join('') : typeof parts === 'string' ? parts : '');

/** SSE 이벤트 하나(JSON)를 모은다. 알아본 꼴이면 true — 모르는 꼴은 false 로 지나간다(실패가 아님). 생각 중이면 state.thinking */
function take(json, state) {
    const { family } = state;
    if (family === 'claude') {
        if (json?.type === 'error') { state.error = json.error ?? json; return true; }
        if (json?.type === 'content_block_start') {
            const block = { ...json.content_block };
            state.blocks[json.index ?? state.blocks.length] = block;
            if (/thinking/.test(String(block.type ?? ''))) state.thinking = true;   // thinking · redacted_thinking (adaptive 생각은 글 없이 서명만 오기도 한다)
            return true;
        }
        if (json?.type === 'content_block_delta') {
            // 1.0.1 글 · 생각 델타만 칸을 만든다 — 시작 없이 온 다른 델타(signature_delta · 새 델타)가 빈 「글」 칸을 만들지 않게. 모르는 델타는 그냥 지나간다
            const delta = json.delta ?? {}, kind = delta.type === 'text_delta' ? 'text' : /^(?:thinking|signature)_delta$/.test(String(delta.type)) ? 'thinking' : '';
            const block = state.blocks[json.index] ?? (kind ? (state.blocks[json.index] = { type: kind }) : null);
            if (delta.type === 'text_delta') { if (block) block.text = (block.text ?? '') + (delta.text ?? ''); state.text += delta.text ?? ''; }
            else if (delta.type === 'thinking_delta') { if (block) block.thinking = (block.thinking ?? '') + (delta.thinking ?? ''); state.thinking = true; }
            else if (kind === 'thinking') state.thinking = true;
            return true;
        }
        if (json?.type === 'message_stop') { state.done = true; return true; }
        return ['message_start', 'message_delta', 'content_block_stop', 'ping'].includes(json?.type);
    }
    if (family === 'gemini') {
        if (json?.error) { state.error = json.error; return true; }
        if (!json?.candidates && !json?.promptFeedback) return false;
        if (json.promptFeedback?.blockReason) { state.blockReason = String(json.promptFeedback.blockReason); state.done = true; }
        const candidate = json.candidates?.[0];
        if (Array.isArray(json.candidates) && json.candidates.length) state.candidates = true;
        for (const part of candidate?.content?.parts ?? []) {
            if (part?.thought) { state.thinking = true; continue; }
            if (typeof part?.text === 'string') state.text += part.text;
        }
        if (candidate?.finishReason) state.done = true;
        return true;
    }
    if (family === 'cohere') {
        if (json?.type === 'content-delta') { state.text += json.delta?.message?.content?.text ?? ''; return true; }
        if (json?.type === 'message-end') { state.finish = json.delta?.finish_reason ?? null; state.done = true; return true; }
        if (json?.error || json?.type === 'error') { state.error = json.error ?? json; return true; }
        return /^(?:message|content|tool|citation)-/.test(String(json?.type ?? ''));
    }
    // OpenAI 꼴 (실리태번 일반 경로 · 중계)
    if (json?.error) { state.error = json.error; return true; }
    const choice = json?.choices?.[0];
    if (!choice) return Array.isArray(json?.choices);
    const piece = choice.delta ? choice.delta.content : choice.message?.content ?? choice.text;
    if (choice.delta && (choice.delta.reasoning_content || choice.delta.reasoning || choice.delta.reasoning_details?.length)) state.thinking = true;   // 중계 · DeepSeek · OpenRouter 의 생각 글
    state.text += textOf(piece);
    if (choice.finish_reason) { state.finish = choice.finish_reason; state.done = true; }
    return true;
}

/** 실리태번이 stream:false 로 줬을 꼴 (src/endpoints/backends/chat-completions.js 의 감싸기와 같게) */
function replyOf(state, source) {
    if (state.family === 'claude') {
        const content = state.blocks.filter(Boolean);
        return { choices: [{ message: { content: content[0]?.text || '' } }], content };
    }
    if (state.family === 'gemini') {
        const apiName = source === 'vertexai' ? 'Google Vertex AI' : 'Google AI Studio';
        if (!state.candidates) return { error: { message: `${apiName} API returned no candidate${state.blockReason ? `\nPrompt was blocked due to : ${state.blockReason}` : ''}` } };
        if (!state.text) return { error: { message: `${apiName} Candidate text empty` } };
        return { choices: [{ message: { content: state.text } }] };
    }
    if (state.family === 'cohere') return { message: { role: 'assistant', content: [{ type: 'text', text: state.text }] }, finish_reason: state.finish };
    return { choices: [{ index: 0, message: { role: 'assistant', content: state.text }, finish_reason: state.finish ?? null }] };
}

/**
 * 응답 본문을 읽는다 (response.ok 일 때). 돌려줌: { data } = 실리태번이 stream:false 로 줬을 꼴 · { raw } = 흘려받기 대신 통째로 온 본문(서버가 stream 을 무시함).
 * onText(지금까지 모인 글) — 글이 는 네트워크 조각마다 한 번 (부르는 쪽이 문단이 닫혔을 때만 일한다).
 * 1.0.1 onThinking() — 글이 오기 전에 모델이 생각하는 표시(생각 칸 · 생각 글)가 처음 왔을 때 한 번 (진행 표시의 「생각 중 n초」).
 */
export async function readStream(response, { family, source, onText, onThinking }) {
    const reader = response?.body?.getReader?.();
    if (!reader) throw streamFailed('본문이 없어요', true);
    const decoder = new TextDecoder();
    const state = { family, text: '', blocks: [], done: false, finish: null, error: null, candidates: false, blockReason: '', known: 0, junk: 0, thinking: false };
    let mode = null, buffer = '', whole = '', told = false;
    const event = block => {
        const data = block.split(/\r\n|\r|\n/).filter(line => line.startsWith('data:')).map(line => line.slice(line.startsWith('data: ') ? 6 : 5)).join('\n');
        if (!data.trim()) return;
        if (data.trim() === '[DONE]') { state.done = true; return; }
        let json;
        // 1.0.1 JSON 이 아닌 조각(중계의 keep-alive 글 등) 하나로 흘려받기 전체를 버리지 않는다 — 건너뛰고, 끝까지 알아본 조각이 없을 때만 실패
        try { json = JSON.parse(data); } catch { state.junk++; return; }
        if (take(json, state)) state.known++;
        if (state.error) throw streamFailed(`오류 이벤트 (${String(state.error?.message ?? state.error?.type ?? '').slice(0, 80)})`);
    };
    try {
        for (;;) {
            const { done, value } = await reader.read();
            let chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
            if (mode !== 'sse') {
                // 첫 글자로 가른다: SSE(data: · event: · :) 가 아니면 통째로 온 본문 (실리태번은 흘려받기 답에 Content-Type 을 붙이지 않는다)
                whole += chunk;
                // 1.1.3 첫 조각이 「da」 처럼 이름 중간에서 끊겨 오면 통짜로 굳어 SSE 전체를 { raw } 로 돌려줬다 — 이름의 앞부분뿐이면 다음 조각까지 기다린다
                const head = whole.trimStart();
                mode ??= !head ? null
                    : /^(?:data|event|id|retry)[ \t]*:|^:/.test(head) ? 'sse'
                    : !done && /^(?:d(?:a(?:t(?:a)?)?)?|e(?:v(?:e(?:n(?:t)?)?)?)?|id?|r(?:e(?:t(?:r(?:y)?)?)?)?)[ \t]*$/.test(head) ? null
                    : 'raw';
                if (mode === 'raw' && done) return { raw: whole };
                if (mode !== 'sse') { if (done) break; continue; }
                chunk = whole; whole = '';
            }
            const before = state.text.length;
            buffer += chunk;
            for (let cut = /\r\n\r\n|\n\n|\r\r/.exec(buffer); cut; cut = /\r\n\r\n|\n\n|\r\r/.exec(buffer)) {
                event(buffer.slice(0, cut.index));
                buffer = buffer.slice(cut.index + cut[0].length);
            }
            if (done) { event(buffer); break; }
            if (state.thinking && !told && !state.text) { told = true; try { onThinking?.(); } catch { /* 보여 주기는 받기를 막지 않는다 */ } }
            if (state.text.length > before) try { onText?.(state.text); } catch { /* 보여 주기는 받기를 막지 않는다 */ }
        }
    } catch (error) {
        reader.cancel?.().catch?.(() => {});
        throw error;
    }
    if (mode === null) throw streamFailed('빈 답');
    if (!state.known) throw streamFailed(state.junk ? '읽을 수 없는 조각뿐이에요' : '알아볼 수 있는 조각이 없어요', true);
    if (!state.done) throw streamFailed('끝 표시 없이 끊겼어요');
    return { data: replyOf(state, source) };
}
