// Pure helpers shared by translation and diagnostic tools.
export const IDS = ['retranslate'];
export const LABELS = { retranslate: '선택 부분 재번역' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const norm = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
export function jsonAnswer(raw) {
    const text = String(raw ?? '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(text); } catch { throw Error('AI 답변 형식을 읽지 못했어요. 기존 내용은 유지돼요.'); }
}
// Return offsets into the original string, never offsets into a normalized copy.
export function uniqueSpan(text, excerpt, markers = new Set()) {
    text = String(text ?? ''); const key = norm(excerpt);
    if (!key) return null;
    let normalized = '', offsets = [];
    for (let i = 0; i < text.length; i++) {
        if (markers.has(i)) continue;
        if (/\s/u.test(text[i])) { if (normalized.endsWith(' ')) continue; normalized += ' '; }
        else normalized += text[i];
        offsets.push(i);
    }
    const start = normalized.indexOf(key);
    if (start < 0 || normalized.indexOf(key, start + 1) >= 0) return null;
    return { start: offsets[start], end: offsets[start + key.length - 1] + 1 };
}

export function paragraphSpan(text, selected) {
    // The selection comes from rendered text, while the cache retains inline Markdown.
    // Ignore paired delimiters only; literal unmatched punctuation keeps its meaning.
    const markers = new Set();
    const scan = (part, base = 0) => {
        for (const match of part.matchAll(/(\*{1,3}|_{1,3}|~~|`+)(?=\S)([\s\S]*?\S)\1/g)) {
            const start = base + match.index, width = match[1].length;
            for (let i = 0; i < width; i++) { markers.add(start + i); markers.add(start + match[0].length - width + i); }
            scan(match[2], start + width);
        }
    };
    scan(text);
    const found = uniqueSpan(text, selected) ?? uniqueSpan(text, selected, markers);
    if (!found) return null;
    const breaks = [...text.matchAll(/\n\s*\n/g)];
    const before = breaks.filter(m => m.index + m[0].length <= found.start).at(-1);
    return { start: before ? before.index + before[0].length : 0,
        end: breaks.find(m => m.index >= found.end)?.index ?? text.length };
}
export function alignedParagraphs(data, blocks) {
    const ids = data?.ids;
    if (data?.uncertain !== false || !Array.isArray(ids) || !ids.length || ids.some((id,i) => !Number.isInteger(id) || id < 0 || id >= blocks.length || (i && id !== ids[i-1]+1))) throw Error('대응 원문이 불확실해요. 기존 번역은 유지돼요.');
    return ids.map(id => blocks[id]).join('\n\n');
}
export function replaceSpan(text, span, replacement) {
    if (!span || span.start < 0 || span.end <= span.start || span.end > text.length || !replacement.trim()) throw Error('교체할 범위를 확인할 수 없어요.');
    return text.slice(0, span.start) + replacement + text.slice(span.end);
}
