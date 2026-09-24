// Pure helpers shared by translation and diagnostic tools.
export const IDS = ['conflicts', 'retranslate'];
export const LABELS = { conflicts: '확장 충돌 진단', retranslate: '선택 부분 재번역' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const norm = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
export function jsonAnswer(raw) {
    const text = String(raw ?? '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(text); } catch { throw Error('AI 답변 형식을 읽지 못했어요. 기존 내용은 유지돼요.'); }
}
// Return offsets into the original string, never offsets into a normalized copy.
export function uniqueSpan(text, excerpt) {
    text = String(text ?? ''); const key = norm(excerpt);
    if (!key) return null;
    let normalized = '', offsets = [];
    for (let i = 0; i < text.length; i++) {
        if (/\s/u.test(text[i])) { if (normalized.endsWith(' ')) continue; normalized += ' '; }
        else normalized += text[i];
        offsets.push(i);
    }
    const start = normalized.indexOf(key);
    if (start < 0 || normalized.indexOf(key, start + 1) >= 0) return null;
    return { start: offsets[start], end: offsets[start + key.length - 1] + 1 };
}
export function validateAlignment(data, source) {
    if (data?.uncertain !== false || typeof data.source !== 'string' || !data.source.trim()) throw Error('선택한 번역문의 원문을 확실히 찾지 못했어요. 문단 전체를 선택해 주세요.');
    const span = uniqueSpan(source, data.source);
    if (!span) throw Error('원문이 없거나 여러 곳에 반복돼요. 다른 문단과 함께 선택해 주세요.');
    return source.slice(span.start, span.end);
}
export function paragraphSpan(text, selected) {
    const found = uniqueSpan(text, selected);
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
export const DUPLICATES = { order: 'panel-order', perf: 'perf-assist', words: 'word-replace', models: 'model-register', rewrite: 'ban-word-rewrite', bookmarks: 'chat-bookmarks' };
export function knownConflicts(names, disabled, addons) {
    const active = new Set(names.filter(n => !disabled.includes(n)).map(n => n.replace(/^third-party\//, '')));
    return Object.entries(DUPLICATES).filter(([id, name]) => addons[id] && active.has(name)).map(([id, name]) => ({ code: 'duplicate-' + id, level: '확인됨', text: `${name}: 내장 기능과 별도 확장이 함께 켜져 있어요. 내장 기능은 대기할 수 있어요.` }));
}
