// 6.3.x 이름의 다른 표기 (영 · 한 · 일) — 번역 애드온이 내놓는 이름 다리(globalThis[Symbol.for('blue-lemonade.names')])에서.
// 다리가 없거나(번역 애드온 끔 · 용어집 끔) 모르는 이름이면 빈 목록 — 쓰는 쪽은 예전과 같다. 순수 함수 (시험: tools/tests/names-jp.mjs)
const KEY = Symbol.for('blue-lemonade.names');

/** 이름의 다른 표기 (자기 자신 빼고) */
export function nameAliases(name) {
    const api = globalThis[KEY];
    if (!api || api.version !== 1 || typeof api.aliasesOf !== 'function') return [];
    let out = [];
    try { out = api.aliasesOf(String(name ?? '')); } catch { out = []; }
    return Array.isArray(out) ? out.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
}

/** 이름 목록 + 이름마다 다른 표기 — 적은 목록은 적은 그대로(빈칸만 뺌 · 6.3.8 과 같다), 더하는 표기만 대소문자 무시 중복 없이 */
export function withNameAliases(names) {
    const out = (Array.isArray(names) ? names : []).map(n => String(n ?? '').trim()).filter(Boolean);
    const seen = new Set(out.map(s => s.toLowerCase()));
    for (const n of [...out]) for (const a of nameAliases(n)) { const k = a.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(a); } }
    return out;
}
