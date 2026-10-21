// Validate the complete file before any cache entry is changed.
export function validateTranslationMemory(data, kind) {
    if (!data || data.type !== 'prompt-panel-tm' || !Array.isArray(data.entries)) throw new Error('번역 메모리 파일 형식이 아닙니다');
    const names = { preset: '프리셋', wi: '월드인포', char: '봇카드', persona: '페르소나' };
    const kindName = value => Object.hasOwn(names, value) ? names[value] : '다른 자료';
    if (data.kind && data.kind !== kind) throw new Error(`${kindName(data.kind)} 번역 메모리입니다 (지금 탭은 ${kindName(kind)})`);
    const fields = [['name', '제목'], ['content', '원문'], ['nameTranslated', '번역 제목'], ['contentTranslated', '번역문']];
    for (const [index, entry] of data.entries.entries()) {
        if (entry == null) continue; // Older hand-edited files may contain empty rows.
        if (typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${index + 1}번째 번역 메모리 항목의 형식이 잘못됐어요.`);
        for (const [key, label] of fields) {
            if (entry[key] != null && typeof entry[key] !== 'string') throw new Error(`${index + 1}번째 항목의 ${label}은 글자여야 해요. 파일을 확인해 주세요.`);
        }
        if (entry.id != null && !['string', 'number'].includes(typeof entry.id)) throw new Error(`${index + 1}번째 항목의 ID 형식이 잘못됐어요.`);
    }
    return data;
}
