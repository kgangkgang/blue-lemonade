// 6.3.x 이름의 다른 표기 (영 · 한 · 일) — 번역 애드온이 내놓는 이름 다리(globalThis[Symbol.for('blue-lemonade.names')])에서.
// 다리가 없거나(번역 애드온 끔 · 용어집 끔) 모르는 이름이면 빈 목록 — 쓰는 쪽은 예전과 같다. 순수 함수 (시험: tools/tests/names-jp.mjs)
// 1.5.9 다리에 인물표(people · src/people.js)가 달려 있으면 그 사람의 표기도 더해요 — 용어집 이름 짝 다음에 TTS 별명 · 프리셋 색 표의 별칭(「영문 / 한글 / 일문」).
//   용어집에 짝을 안 적어도 프리셋 · TTS 에 정해 둔 표기를 찾기 · 가리기 · 에셋 이름 풀이가 같이 알아요. 한 글자 표기(별명 「벨」 등)는 더하지 않아요 —
//   가리기 · 음소거가 다른 낱말 속 글자까지 지우지 않게. 용어집 이름 짝은 예전 그대로 전부.
const KEY = Symbol.for('blue-lemonade.names');
const fold = s => String(s ?? '').normalize('NFKC').trim().toLowerCase().replace(/[\s\-‐‑–—_·・]+/g, ' ');

/** 이름의 다른 표기 (자기 자신 빼고) */
export function nameAliases(name) {
    const api = globalThis[KEY];
    if (!api || api.version !== 1 || typeof api.aliasesOf !== 'function') return [];
    let out = [];
    try { out = api.aliasesOf(String(name ?? '')); } catch { out = []; }
    out = Array.isArray(out) ? out.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
    const people = api.people;
    if (people?.version !== 1 || typeof people.get !== 'function') return out;
    let more = [];
    try { more = people.get(String(name ?? ''))?.names || []; } catch { more = []; }
    const seen = new Set([fold(name), ...out.map(fold)]);
    for (const raw of Array.isArray(more) ? more : []) {
        const n = typeof raw === 'string' ? raw.trim() : '', k = fold(n);
        if (!k || seen.has(k) || [...n].length < 2) continue;
        seen.add(k); out.push(n);
    }
    return out;
}

// 버그 사냥 2: 가릴 이름 찾기 틀(로그 복사 · 채팅 캡처가 같이 써요). 로마자로 시작 · 끝나는 이름은 그쪽 끝을 낱말 경계로 —
//   「Eve」 가 Every · evening · never 속에서 걸려 ○○ry · ○○ning · n○○r 이 됐어요. 한글 조사(Eve와) · 끝 s(Eves) · 's 는 그대로 걸려요.
//   한글 · 가나 이름은 예전처럼 어디서든(조사가 붙어요).
const LATIN = /\p{Script=Latin}|\p{N}/u;
const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 가릴 이름 목록 → 찾기 정규식(gi · 긴 이름 먼저) — 이름이 없으면 null */
export function namePattern(names) {
    const list = [...new Set((Array.isArray(names) ? names : []).map(n => String(n ?? '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    if (!list.length) return null;
    return new RegExp(list.map((n) => {
        const chars = [...n];
        const head = LATIN.test(chars[0]) ? '(?<![\\p{Script=Latin}\\p{N}])' : '';
        const tail = LATIN.test(chars.at(-1)) ? '(?=s?(?![\\p{Script=Latin}\\p{N}]))' : '';
        return head + escapeRe(n) + tail;
    }).join('|'), 'giu');
}

/** 이름 목록 + 이름마다 다른 표기 — 적은 목록은 적은 그대로(빈칸만 뺌 · 6.3.8 과 같다), 더하는 표기만 대소문자 무시 중복 없이 */
export function withNameAliases(names) {
    const out = (Array.isArray(names) ? names : []).map(n => String(n ?? '').trim()).filter(Boolean);
    const seen = new Set(out.map(s => s.toLowerCase()));
    for (const n of [...out]) for (const a of nameAliases(n)) { const k = a.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(a); } }
    return out;
}
