// 6.3.5 이름 다리 — 번역 용어집의 「이름 짝」을 다른 애드온 · 확장이 쓰게 전역으로 내놓는다 (TTS 화자 별명 · 그림 확장의 인물 별명이 같은 표를 본다)
//   globalThis[Symbol.for('blue-lemonade.names')] = Object.freeze({
//       version: 1,
//       pairs: [{ src, dst, scope }],       // 지금 캐릭터(또는 그룹)의 용어집 + 전체 용어집에서 (번역과 같은 범위 · 채팅을 바꾸면 다시) — 원문 표기 → 번역 표기, 표기마다 하나, 같은 짝은 한 번 · scope = 'global' 또는 캐릭터 키
//       aliasesOf(name) → string[],         // 그 이름과 같은 인물로 묶인 다른 표기들 (대소문자 · 앞뒤 공백 무시, 사이 공백 · 하이픈 · 가운뎃점은 한 칸으로 보고 견줌, 자기 자신 제외, 모르면 [])
//       groups() → string[][],              // 묶음 전부
//       onChange(fn) → unsubscribe,         // 바뀔 때 (document 의 'bl:names-changed' CustomEvent, detail = 새 객체)
//       people: { version: 1, get(name), list(), onChange(fn) },   // 6.9.5 인물표 — 표기 · 대사 색 · TTS 목소리를 한 번에 (src/people.js, 다리가 바뀌어도 같은 객체)
//   })
// 이름꼴만 고른다: 1~12자 · 글자(어느 문자든)와 사이 공백만(문장 부호 · 숫자 없음) · 라틴 글자로 시작하면 첫 글자 대문자. 용어집의 "A, B" 표기는 따로 센다.
// 쓰는 쪽 규칙: 사용자가 직접 넣은 별명 · 연결이 늘 먼저, 다리는 비어 있는 자리만 채운다. 순수 함수 (시험: tools/tests/names-bridge.mjs)
import { people } from '../../people.js';
export const NAMES_KEY = Symbol.for('blue-lemonade.names');
export const NAMES_EVENT = 'bl:names-changed';
const MAX_LEN = 12;
const NAME_RE = /^\p{L}[\p{L}\p{M}]*(?: [\p{L}\p{M}]+)*$/u;

export function nameFold(text) {
    return String(text ?? '').normalize('NFKC').trim().toLowerCase().replace(/[\s\-‐‑–—_·・]+/g, ' ');   // 6.3.x NFKC: 반각 가나 = 전각
}

export function isNameLike(text) {
    const t = String(text ?? '').normalize('NFKC').trim().replace(/[・·]/g, ' ').replace(/\s+/g, ' ');   // 6.3.x 가운뎃점 이름(ローワン・ベルク)도 이름꼴
    if (!t || t.length > MAX_LEN || !NAME_RE.test(t)) return false;
    return !/^\p{Script=Latin}/u.test(t) || /^\p{Lu}/u.test(t);
}

/** "Corvin, コルヴィン" → ['Corvin', 'コルヴィン'] (쉼표 · 전각 쉼표, 같은 표기는 한 번) */
export function nameForms(text) {
    const seen = new Set(), out = [];
    for (const part of String(text ?? '').split(/[,，]/)) {
        const t = part.normalize('NFC').trim().replace(/\s+/g, ' ');   // 표시 표기는 적힌 그대로 — 표준 표기(NFKC) 짝은 buildNames 가 더한다
        const k = nameFold(t);
        if (!t || !k || seen.has(k)) continue;
        seen.add(k); out.push(t);
    }
    return out;
}

/** 용어집 항목 [{ src, dst, scope }] → 이름 짝 (양쪽 다 이름꼴인 표기끼리, 같은 짝은 한 번, 같은 표기끼리는 짝이 아니다) */
export function namePairs(entries) {
    const seen = new Set(), out = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
        if (!entry || typeof entry.src !== 'string' || typeof entry.dst !== 'string') continue;
        const srcs = nameForms(entry.src).filter(isNameLike), dsts = nameForms(entry.dst).filter(isNameLike);
        if (!srcs.length || !dsts.length) continue;
        const scope = entry.scope === 'global' ? 'global' : String(entry.scope ?? '');
        for (const src of srcs) for (const dst of dsts) {
            const k = `${nameFold(src)}\u0001${nameFold(dst)}`;
            if (nameFold(src) === nameFold(dst) || seen.has(k)) continue;
            seen.add(k); out.push({ src, dst, scope });
        }
    }
    return out;
}

/** 짝을 묶음으로 (같은 표기를 거쳐 이어지면 한 인물) → 다리 객체 */
export function buildNames(pairs, { doc = () => globalThis.document } = {}) {
    const list = (Array.isArray(pairs) ? pairs : []).map(p => ({ src: String(p.src), dst: String(p.dst), scope: typeof p.scope === 'string' ? p.scope : '' }));
    // 6.3.x 반각 가나 · 전각 라틴으로 적힌 짝은 표준 표기(NFKC) 짝도 — 원문이 어느 폭으로 적혀도 찾게 (그런 짝이 없으면 목록은 그대로)
    const std = s => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
    for (const p of list.slice()) { const s2 = std(p.src), d2 = std(p.dst); if ((s2 !== p.src || d2 !== p.dst) && s2 && d2) list.push({ src: s2, dst: d2, scope: p.scope }); }
    const parent = new Map(), display = new Map();
    const find = k => { let r = k; while (parent.get(r) !== r) r = parent.get(r); let c = k; while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
    const add = name => { const k = nameFold(name); if (!parent.has(k)) { parent.set(k, k); display.set(k, [name]); } else if (!display.get(k).includes(name)) display.get(k).push(name); return k; };
    for (const { src, dst } of list) { const a = add(src), b = add(dst); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); }
    const members = new Map();
    for (const k of parent.keys()) { const r = find(k); if (!members.has(r)) members.set(r, []); members.get(r).push(...display.get(k)); }
    const api = {
        version: 1,
        pairs: Object.freeze(list.map(p => Object.freeze({ ...p }))),
        aliasesOf(name) {
            const k = nameFold(name);
            if (!k || !parent.has(k)) return [];
            return members.get(find(k)).filter(n => nameFold(n) !== k);
        },
        groups() { return [...members.values()].map(g => g.slice()); },
        people,   // 6.9.5 인물표 (version 이 1 인 다리는 그대로 — 이 칸을 모르는 쪽은 지나친다)
        onChange(fn) {
            const d = doc();
            if (!d || typeof d.addEventListener !== 'function' || typeof fn !== 'function') return () => {};
            const handler = event => fn(event?.detail ?? globalThis[NAMES_KEY]);
            d.addEventListener(NAMES_EVENT, handler);
            return () => d.removeEventListener(NAMES_EVENT, handler);
        },
    };
    // 서명 = 원래 표기 + 범위 — 범위만 바뀌거나(다른 캐릭터의 같은 짝) 대소문자만 고쳐도 새 객체 · 알림 (pairs 의 scope · 표기가 낡지 않게)
    Object.defineProperty(api, 'signature', { value: list.map(p => `${p.src}\u0001${p.dst}\u0001${p.scope}`).sort().join('\n'), enumerable: false });
    return Object.freeze(api);
}

/** 용어집 항목으로 전역 다리를 (다시) 내놓는다 — 짝이 그대로면 같은 객체를 돌려주고 이벤트도 없다 */
export function publishNames(entries, { host = globalThis, doc = () => globalThis.document } = {}) {
    const api = buildNames(namePairs(entries), { doc });
    const previous = host[NAMES_KEY];
    if (previous && previous.version === 1 && previous.signature === api.signature) return previous;
    host[NAMES_KEY] = api;
    try {
        const d = doc();
        if (d && typeof d.dispatchEvent === 'function' && typeof CustomEvent === 'function') d.dispatchEvent(new CustomEvent(NAMES_EVENT, { detail: api }));
    } catch (error) { console.warn('[LLM Translator] 이름 다리 알림 실패', error); }
    return api;
}
