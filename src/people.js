// 6.9.5 인물표 — 이름 다리(globalThis[Symbol.for('blue-lemonade.names')])의 people 칸. 한 사람의 다른 표기 · 이 채팅의 대사 색 · TTS 목소리를 한 번에 준다.
//   const people = globalThis[Symbol.for('blue-lemonade.names')]?.people;   // 없으면 옛 테마 (이름 다리 자체는 그대로 version: 1)
//   if (people?.version === 1) {
//       people.get('Mina')  → { name: 'Mina', names: ['Mina', '미나', 'ミナ'], color: '#7aa2f7' | null, voice: { uid, name, provider, lang } | null } · 모르면 null
//       people.list()       → 이 채팅에서 색이나 목소리를 아는 사람들 (같은 사람은 한 번, 차례: 정해 둔 것 → 많이 나온 것)
//       people.onChange(fn) → unsubscribe   (document 'bl:people-changed', detail = people — 이름 다리 · 색 · 목소리가 바뀌면 한 번에 모아서)
//   }
// 표기(names)는 이름 다리(번역 용어집의 이름 짝)와 공급자가 아는 별명을 합친 것이다. 색 · 목소리는 공급자(지금은 TTS 애드온)가 준다 —
//   TTS 가 꺼져 있으면 color · voice 는 null. 돌려준 객체는 얼려 있다(고쳐도 원본은 그대로). 순수 모듈 (시험: tools/tests/people.mjs)
export const PEOPLE_VERSION = 1;
export const PEOPLE_EVENT = 'bl:people-changed';
const NAMES_KEY = Symbol.for('blue-lemonade.names');   // names-bridge.js 와 같은 열쇠 (서로 부르지 않게 여기서도 만든다)
const NAMES_EVENT = 'bl:names-changed';

const fold = s => String(s ?? '').normalize('NFKC').trim().toLowerCase().replace(/[\s\-‐‑–—_·・]+/g, ' ');
const sources = new Map();   // id → { person(names) → { names?, color?, voice? } | null, names() → string[], stamp?() → 값 | 배열 }
let host = globalThis, doc = () => globalThis.document, timer = 0, listening = false;

// 7.2.8 get() 기억: 다른 확장이 이름마다 부른다(채팅 열기 · 답마다 수백 번). 같은 판 안에서는 같은 이름에 같은 (얼린) 객체를 돌려준다.
//   판이 바뀌는 것: invalidatePeople()(peopleChanged() 도 바로 부른다 — 알림은 120ms 뒤라도 기억은 그 자리에서 비운다) ·
//   이름 다리 객체 · 공급자 목록 · 공급자마다 stamp() 값(채팅 · 페르소나 · 설정 객체처럼 알림 없이 바뀌는 것).
//   stamp() 가 없는 공급자가 하나라도 있으면 기억하지 않는다(예전처럼 부를 때마다 묻는다)
const MEMO_MAX = 600;
let stamp = 0, memoOn = true, memoKeys = null;
const memo = new Map();
/** 기억을 비운다 (알림 없이) — 인물표에 닿는 것을 바꾼 곳이 바로 부른다 */
export function invalidatePeople() { stamp++; memo.clear(); memoKeys = null; }
/** 지금 판 번호 — 다른 모듈이 자기 기억(TTS 별명표)을 같은 때에 비우려고 본다 */
export function peopleStamp() { return stamp; }
/** 기억을 쓰는가 (시험이 끄고 견준다) */
export const peopleMemoOn = () => memoOn;
/** 시험용: 기억 끄고 켜기 */
export function _setPeopleMemoForTest(on) { memoOn = !!on; invalidatePeople(); }

/** 시험용: 전역 · 문서를 바꿔 끼운다 */
export function _setPeopleHostForTest(next = globalThis, nextDoc = () => globalThis.document) { host = next; doc = nextDoc; listening = false; invalidatePeople(); }

function bridge() {
    const api = host[NAMES_KEY];
    return api && typeof api === 'object' && api.version === 1 ? api : null;
}
function aliasesOf(name) {
    try { const out = bridge()?.aliasesOf?.(name); return Array.isArray(out) ? out.filter(x => typeof x === 'string' && x.trim()) : []; } catch { return []; }
}
const color = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null;
function voice(v) {
    if (!v || typeof v !== 'object' || typeof v.uid !== 'string' || !v.uid) return null;
    return Object.freeze({ uid: v.uid, name: String(v.name ?? ''), provider: String(v.provider ?? ''), lang: String(v.lang ?? '') });
}
function addNames(list, more) {
    const seen = new Set(list.map(fold));
    for (const raw of more) {
        const n = String(raw ?? '').trim(), k = fold(n);
        if (n && k && !seen.has(k)) { seen.add(k); list.push(n); }
    }
    return list;
}

const sameKeys = (a, b) => a && a.length === b.length && a.every((x, i) => Array.isArray(x) ? Array.isArray(b[i]) && x.length === b[i].length && x.every((y, j) => Object.is(y, b[i][j])) : Object.is(x, b[i]));
/** 지금 기억이 맞는 판인지 — 아니면 비운다. 기억할 수 없으면 false */
function memoReady() {
    if (!memoOn) return false;
    const keys = [stamp, host[NAMES_KEY]];
    for (const source of sources.values()) {
        if (typeof source.stamp !== 'function') return false;
        let k;
        try { k = source.stamp(); } catch { return false; }
        keys.push(Array.isArray(k) ? k.slice() : k);
    }
    if (!sameKeys(memoKeys, keys)) { memo.clear(); memoKeys = keys; }
    return true;
}
function get(name) {
    const n = String(name ?? '').trim();
    if (!n) return null;
    const useMemo = memoReady();
    if (useMemo && memo.has(n)) return memo.get(n);
    const out = lookup(n);
    if (useMemo) { if (memo.size >= MEMO_MAX) memo.clear(); memo.set(n, out); }
    return out;
}
function lookup(n) {
    const names = addNames([n], aliasesOf(n));
    let c = null, v = null;
    for (const source of sources.values()) {
        let part = null;
        try { part = source.person?.(names.slice()); } catch (error) { console.warn('[Blue Lemonade] 인물표', error); }
        if (!part || typeof part !== 'object') continue;
        if (Array.isArray(part.names)) addNames(names, part.names);
        c ??= color(part.color);
        v ??= voice(part.voice);
    }
    if (names.length === 1 && !c && !v) return null;
    return Object.freeze({ name: n, names: Object.freeze(names), color: c, voice: v });
}
function list() {
    const out = [], taken = new Set();
    for (const source of sources.values()) {
        let names = [];
        try { names = source.names?.() || []; } catch (error) { console.warn('[Blue Lemonade] 인물표', error); }
        for (const name of Array.isArray(names) ? names : []) {
            if (taken.has(fold(name))) continue;
            const person = get(name);
            if (!person || (!person.color && !person.voice)) continue;
            for (const other of person.names) taken.add(fold(other));
            out.push(person);
        }
    }
    return Object.freeze(out);
}
function onChange(fn) {
    const d = doc();
    if (!d || typeof d.addEventListener !== 'function' || typeof fn !== 'function') return () => {};
    const handler = event => fn(event?.detail ?? people);
    d.addEventListener(PEOPLE_EVENT, handler);
    return () => d.removeEventListener(PEOPLE_EVENT, handler);
}
export const people = Object.freeze({ version: PEOPLE_VERSION, get, list, onChange });

/** 무엇이 바뀌었을 때 (공급자 · 이름 다리) — 짧게 모아 한 번 알린다 (타이머만 — 숨은 탭에서도) */
export function peopleChanged() {
    invalidatePeople();
    if (timer) return;
    timer = setTimeout(() => {
        timer = 0;
        try {
            const d = doc();
            if (d && typeof d.dispatchEvent === 'function' && typeof CustomEvent === 'function') d.dispatchEvent(new CustomEvent(PEOPLE_EVENT, { detail: people }));
        } catch (error) { console.warn('[Blue Lemonade] 인물표 알림', error); }
    }, 120);
}
function listenNames() {
    if (listening) return;
    const d = doc();
    if (!d || typeof d.addEventListener !== 'function') return;
    listening = true;
    d.addEventListener(NAMES_EVENT, peopleChanged);
}

/** 번역 애드온이 이름 다리를 아직 안 냈으면(꺼짐 · 늦게 켬) 짝 없는 다리를 세워 people 를 단다 — 번역 애드온이 짝을 내면 그 다리로 바뀐다 */
function ensureBridge() {
    if (host[NAMES_KEY]) return;
    const api = {
        version: 1, pairs: Object.freeze([]), aliasesOf: () => [], groups: () => [], people,
        onChange(fn) {
            const d = doc();
            if (!d || typeof d.addEventListener !== 'function' || typeof fn !== 'function') return () => {};
            const handler = event => fn(event?.detail ?? host[NAMES_KEY]);
            d.addEventListener(NAMES_EVENT, handler);
            return () => d.removeEventListener(NAMES_EVENT, handler);
        },
    };
    Object.defineProperty(api, 'signature', { value: '', enumerable: false });   // 번역 애드온의 publishNames 가 같은 짝(없음)이면 이 다리를 그대로 쓴다
    host[NAMES_KEY] = Object.freeze(api);
}

/** 공급자 등록 — source = { person(names: string[]) → { names?, color?, voice? } | null, names() → string[] }. 되돌려 주는 함수로 뺀다 */
export function registerPeopleSource(id, source) {
    if (!id || !source || typeof source !== 'object') return () => {};
    sources.set(String(id), source);
    invalidatePeople();
    ensureBridge();
    listenNames();
    peopleChanged();
    return () => { if (sources.get(String(id)) === source) { sources.delete(String(id)); invalidatePeople(); peopleChanged(); } };
}
