// 모델 등록 1.1.6 — 「새 모델을 추가할까요?」에 넣을 이름 고르기 (화면 · 실리태번 없이 시험하려고 offer.js 에서 갈라 둠)
// 실리태번이 목록을 받아 오지 않고 index.html 의 고정 목록을 쓰는 공급자만 묻는다.
// 목록을 받아 오는 공급자(OpenRouter 등)는 받은 목록이 이미 그 계정의 최신이라, 거기 없는 이름은 끝난 모델일 수 있다.
export const FIXED_SOURCES = Object.freeze(['openai', 'claude', 'makersuite', 'vertexai', 'cohere', 'zai']);

/**
 * 실리태번 index.html 을 기본 목록 읽기용으로 파싱하기 전에 <audio> · <video> 여는 태그를 뺀다 (perf-heap 10-30).
 * DOMParser 문서 안의 미디어 요소(#audio_message_sound)는 RemotePlayback 이 「할 일 남음」으로 남아 파싱한 문서 전체(노드 약 1.75만)를
 * 세션 내내 붙잡았다. select · option 은 미디어 태그 안에 없으니 읽는 목록은 같다 (닫는 태그만 남으면 파서가 버린다).
 */
export const withoutMedia = html => String(html ?? '').replace(/<(?:audio|video)\b[^>]*>/gi, '');

const clean = list => (Array.isArray(list) ? list : []).map(item => String(item ?? '').trim()).filter(Boolean);

/**
 * 아직 안 물어본 새 모델 (공급자 표 순서 · 그 안은 테마가 아는 순서 = 새것 먼저).
 * 메뉴를 못 읽은 공급자(page 가 비었음)는 묻지 않는다 — 실리태번 메뉴에 이미 있는 것을 새 모델로 잘못 보일 수 있다.
 * @param {{ id: string, label: string }[]} sources
 * @param {(id: string) => { known?: string[], page?: string[], registered?: string[], offered?: string[] }} read
 * @returns {{ source: string, label: string, models: string[] }[]}
 */
export function pickNew(sources, read) {
    const out = [];
    for (const { id, label } of sources ?? []) {
        if (!FIXED_SOURCES.includes(id)) continue;
        const { known, page, registered, offered } = read(id) ?? {};
        const shown = clean(page);
        if (!shown.length) continue;
        const have = new Set([...shown, ...clean(registered), ...clean(offered)]);
        const models = [...new Set(clean(known))].filter(model => !have.has(model));
        if (models.length) out.push({ source: id, label: String(label ?? id), models });
    }
    return out;
}

/** 물어본 이름을 offered 에 더한 새 객체 (추가 · 안 함 · 닫기 모두 — 같은 이름은 다시 묻지 않는다) */
export function withOffered(offered, groups) {
    const next = offered && typeof offered === 'object' && !Array.isArray(offered) ? { ...offered } : {};
    for (const { source, models } of groups ?? []) next[source] = [...new Set([...clean(next[source]), ...clean(models)])];
    return next;
}

/**
 * 1.1.7 한 공급자 정리. native = 실리태번 기본 목록(index.html 원본), pruned = 전에 그 때문에 뺀 이름.
 * 기본 목록에서 다시 빠진 뺀 이름은 등록 끝으로 되돌리고(back), 기본 목록에 있는 등록은 뺀다(gone). memo = 다음에 적어 둘 뺀 이름.
 * 기본 목록을 못 읽었으면(native 없음 · 비었음) 아무것도 바꾸지 않는다.
 */
export function pruneStep(registered, native, pruned) {
    const list = clean(registered), before = clean(pruned);
    if (!native || !native.size) return { keep: list, gone: [], back: [], memo: before };
    const back = [...new Set(before.filter(model => !native.has(model) && !list.includes(model)))];
    const all = [...new Set([...list, ...back])];
    const gone = all.filter(model => native.has(model));
    const memo = [...new Set([...before, ...gone])].filter(model => native.has(model));
    return { keep: all.filter(model => !native.has(model)), gone, back, memo };
}

/** 고른 새 모델을 등록 목록 끝에 (이미 있는 이름은 그대로 한 번) */
export function withAdded(registered, models) {
    return [...new Set([...clean(registered), ...clean(models)])];
}
