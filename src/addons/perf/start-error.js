// Fixed diagnostics only: never show exception text, URLs or saved settings.
const phases = { ENTRY: '시작 파일', HUB: '설정 화면', SETTINGS: '저장된 설정', HOST: '실리태번 연결', TOOL: '도구', PANEL: '도구 설정' };
const kinds = { FETCH: '파일을 불러오지 못했어요', EXPORT: '필요한 기능을 찾지 못했어요', INIT: '초기화하지 못했어요' };

export function perfStartError(phase, error) {
    if (!Object.hasOwn(phases, phase)) phase = 'ENTRY';
    const message = typeof error?.message === 'string' ? error.message : '';
    const kind = /does not provide an export|doesn't provide an export|export .* not found/i.test(message) ? 'EXPORT'
        : /failed to fetch|fetch.*module|importing a module script|loading.*module|module.*failed to load/i.test(message) ? 'FETCH' : 'INIT';
    return Object.assign(new Error(`${phases[phase]}: ${kinds[kind]} [PERF-${phase}-${kind}]`), { perfPhase: phase, perfKind: kind });
}

export function perfErrorText(error, phase = 'ENTRY') {
    // Reconstruct even tagged errors; an arbitrary .message is never trusted.
    if (Object.hasOwn(phases, error?.perfPhase) && Object.hasOwn(kinds, error?.perfKind)) {
        return `${phases[error.perfPhase]}: ${kinds[error.perfKind]} [PERF-${error.perfPhase}-${error.perfKind}]`;
    }
    return perfStartError(phase, error).message;
}
