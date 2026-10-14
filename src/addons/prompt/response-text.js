import { responseError } from './request-errors.js';

// ST preserves Claude content alongside its first-block-only choices wrapper.
// Read the visible answer blocks, never thinking, tool calls, or their metadata.
function partsText(value, separator = '') {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(part => {
        if (typeof part === 'string') return part;
        if (!part || part.thought || (part.type && !['text', 'output_text'].includes(part.type))) return '';
        return typeof part.text === 'string' ? part.text : '';
    }).filter(Boolean).join(separator);
    if (value && Array.isArray(value.parts)) return partsText(value.parts, separator);
    return '';
}

export function completionText(data) {
    if (typeof data === 'string') return data.trim();
    if (data?.error) throw responseError(data);
    const candidates = [
        partsText(data?.content, '\n\n'),
        // Match ST's Google wrapper: visible parts are separate paragraphs.
        // Joining without a separator can merge numbered translation titles.
        partsText(data?.responseContent, '\n\n'),
        partsText(data?.candidates?.[0]?.content, '\n\n'),
        partsText(data?.choices?.[0]?.message?.content),
        partsText(data?.choices?.[0]?.text),
        partsText(data?.message?.content),
        partsText(data?.results?.[0]?.text),
        partsText(data?.response),
        partsText(data?.text),
        partsText(data?.output),
        partsText(data?.[0]?.content),
    ];
    const answer = candidates.find(text => text.trim());
    const reason = String(data?.stop_reason || data?.choices?.[0]?.finish_reason || data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || '');
    if (data?.choices?.[0]?.message?.refusal || /^(refusal|content_filter|safety|blocked|prohibited_content)$/i.test(reason)) {
        throw Object.assign(new Error(answer
            ? '내용 차단으로 번역이 중간에 멈췄어요. 불완전한 결과는 저장하지 않았어요.'
            : '내용 차단으로 번역문이 오지 않았어요.'), { blocked: true, refused: true });
    }
    if (/^(max_tokens|length|max_output_tokens)$/i.test(reason)) {
        throw new Error((answer
            ? '출력 한도에 도달해 번역문이 중간에 끊겼어요. 잘린 결과는 저장하지 않았어요. '
            : '출력 한도에 도달해 번역문이 오지 않았어요. ') + '응답 길이를 늘리거나 항목을 나눠 주세요.');
    }
    if (answer) return answer.trim();
    return '';
}
