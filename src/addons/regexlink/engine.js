// 프롬프트 연동 정규식 — 순수 계산부 (브라우저 · 테스트 공용, DOM 없음)
//
// 정규식 이름 · 내용에서 모듈 태그(@Momentum Engine · ! Scene Plan ! · Thinking (Fallback) …)를 뽑고,
// 프롬프트 이름(없으면 별칭 → 내용)에서 그 모듈의 주인 프롬프트를 찾는다. 주인이 전부 꺼져 있으면 정규식도 끈다.
// 1.0.8 과일 꼴(이름에 한자 · [9] 번호) 정규식은 이름의 @뒤가 지은이 표시라 모듈이 아니다 — 찾기 글의 첫 출력 태그(<status_bar> · <branches> · ◸ …)가 모듈이고,
// 그 태그를 내라고 적은 프롬프트(내용에 그 태그)가 주인이다. 프롬프트로 보낼 글을 고치는 정리 정규식(MoM必选 …)은 모듈과 상관없이 늘 그대로 둔다.
// 태그가 없거나 주인을 못 찾은 정규식은 손대지 않는다 (틀리면 켜 두는 쪽이 안전).

/** 태그에서 빼는 꾸밈말 — "@Status UI - Collapsed" 와 "@Status" 는 같은 모듈 */
const NOISE = new Set(['ui', 'primary', 'fallback', 'footer', 'labels', 'label', 'route', 'routes', 'recovery', 'layout', 'row', 'rows', 'wrapper', 'legacy', 'convert', 'older', 'render', 'remove', 'redact', 'hide', 'show', 'seal', 'normalize', 'from', 'context', 'as', 'font', 'unselected', 'tag', 'sort']);
/** 프리셋마다 이름이 다른 모듈 (데우스: 정규식은 @CYOA, 프롬프트는 「 Choices List 」) */
export const ALIASES = {
    'cyoa': ['choices list', 'choices'],
    'tracker': ['time window', 'exact time', 'tracker'],
    'true thoughts': ['visible', 'hidden', 'true thoughts'],
    'thinking': ['thinking'],
    'scene plan': ['scene plan'],
};
const TAG_RE = /@[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*){0,3}|! [A-Z][A-Za-z ]{1,30}? !|Thinking \(Fallback\)|Expressive Dialogue|True Thoughts|Scene Plan/g;
/** 과일(MoM) 꼴 이름: 한자가 들었거나 [9] · [13.5] 번호가 붙은 것 (DEM 꼴 이름에는 둘 다 없다) */
const FRUIT_NAME = /\p{Script=Han}|\[\d+(?:\.\d+)?\]/u;
/** 꼭 켜는 정규식 표시 (과일: MoM必选) */
const ALWAYS_NAME = /必选|必开|필수/;
/** 찾기 글의 여는 태그 — 정규식 문법의 (?<이름> · \k<이름> 은 태그가 아니다 */
const OPEN_TAG_RE = /(?<!\(\?|\\k)<\\?\/?([\p{L}_][\p{L}\p{N}_-]*)/u;

export const keyOf = text => String(text || '').toLowerCase().replace(/[^a-z0-9가-힣 ]+/g, ' ').split(/\s+/).filter(w => w && !NOISE.has(w)).join(' ');

const fruitNamed = script => FRUIT_NAME.test(String(script.scriptName || ''));
/** 늘 그대로 둘 과일 정리 정규식: 이름에 必选 이 있거나 프롬프트로 보낼 글을 고치는 것 (켜 둔 모듈과 상관없이 필요하다) */
export const alwaysNeeded = script => fruitNamed(script) && (!!script.promptOnly || ALWAYS_NAME.test(String(script.scriptName || '')));

/** 찾기 글의 출력 표시: 첫 여는 태그 '<status_bar>'(소문자) · 없으면 ASCII 밖 첫 기호 글자('◸') · 둘 다 없으면 '' */
export function markOf(find) {
    const text = String(find || '');
    const tag = text.match(OPEN_TAG_RE);
    if (tag) return `<${tag[1].toLowerCase()}>`;
    return text.match(/(?![\x00-\x7f])[\p{So}\p{Sm}]/u)?.[0] || ''; // ◸ 는 Sm · 정규식 문법의 + | < > 는 ASCII 라 빠진다
}
/** 출력 표시 키인가 (DEM 꼴 키는 keyOf 를 거쳐 영문 · 숫자 · 한글 · 공백뿐) */
const isMark = key => !/^[a-z0-9가-힣 ]+$/.test(key);

/** 정규식 하나의 모듈 키들 (이름 우선, 없으면 찾기 · 바꾸기 글. 과일 꼴은 찾기 글의 출력 표시 하나) */
export function modulesOf(script) {
    if (fruitNamed(script)) {
        if (alwaysNeeded(script)) return [];
        const mark = markOf(script.findRegex);
        return mark ? [mark] : [];
    }
    const pick = (text) => [...new Set((String(text || '').match(TAG_RE) || []).map(keyOf).filter(Boolean))];
    const fromName = pick(script.scriptName);
    if (fromName.length) return fromName;
    return pick(`${script.findRegex || ''} ${script.replaceString || ''}`);
}

/** 키(낱말을 공백 하나로 이은 것) 안에 needle 이 낱말째로 들었나 — "roadmap" 에는 "map" 이 없다 */
const hasWords = (hay, needle) => ` ${hay} `.includes(` ${needle} `);
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = new Map();
const cachedRe = (source, flags = '') => {
    const id = `${flags}/${source}`;
    let pattern = patterns.get(id);
    if (!pattern) {
        pattern = new RegExp(source, flags);
        if (patterns.size >= 256) patterns.delete(patterns.keys().next().value);
        patterns.set(id, pattern);
    }
    return pattern;
};
/** 소문자 글에 @키 태그가 있나 (뒤에 글자가 이어지면 다른 낱말: @map ≠ @mapping) */
const tagIn = (low, key) => cachedRe(`@${escapeRe(key).replace(/ /g, '\\s+')}(?![a-z0-9])`).test(low);
/** 소문자 글에 출력 표시가 있나: '<x>' 는 여는 태그 <x (뒤에 이름 글자가 이어지면 다른 태그: <status ≠ <status_bar), 기호는 그대로 */
const markIn = (low, mark) => mark[0] === '<' ? cachedRe(`${escapeRe(mark.slice(0, -1))}(?![\\p{L}\\p{N}_-])`, 'u').test(low) : low.includes(mark);

/** 프롬프트 이름을 견줄 수 있게: 「 」 | ! ⚠️ ❗ 와 괄호 안을 뗀다 */
export const promptKey = name => keyOf(String(name || '').replace(/\([^)]*\)/g, ' ').replace(/[「」|!⚠️❗{}]/g, ' '));

/**
 * 모듈 키 → 주인 프롬프트 식별자들. 이름에 키가 들어 있는 프롬프트, 없으면 별칭 이름, 그것도 없으면 내용에 @키 가 든 프롬프트(6개 이하일 때만).
 * 출력 표시 키(과일)는 내용에 그 태그 · 기호가 든 프롬프트 (6개 이하일 때만 — 더 많으면 흔한 태그라 짝으로 보지 않는다).
 * @param {{identifier:string,name:string,content?:string,marker?:boolean}[]} prompts
 * @returns {Map<string,string[]>}
 */
export function ownersFor(keys, prompts, aliases = ALIASES) {
    const list = prompts.filter(p => p && !p.marker && p.identifier);
    // 낱말 단위로 견준다: @Map 이 "Roadmap" 에 걸리면 안 된다
    const byName = (needle) => list.filter(p => hasWords(promptKey(p.name), needle)).map(p => p.identifier);
    const lowered = new Map();
    const lowOf = p => { let low = lowered.get(p); if (low === undefined) { low = String(p.content || '').toLowerCase(); lowered.set(p, low); } return low; };
    const out = new Map();
    for (const key of keys) {
        if (isMark(key)) {
            const owners = list.filter(p => markIn(lowOf(p), key)).map(p => p.identifier);
            out.set(key, owners.length <= 6 ? [...new Set(owners)] : []);
            continue;
        }
        let owners = byName(key);
        if (!owners.length) for (const alias of aliases[key] || []) owners.push(...byName(alias));
        owners = [...new Set(owners)];
        if (!owners.length) {
            const byContent = list.filter(p => hasWords(keyOf(String(p.content || '').replace(/@/g, ' @')), key) && tagIn(String(p.content || '').toLowerCase(), key)).map(p => p.identifier);
            if (byContent.length && byContent.length <= 6) owners = byContent;
        }
        out.set(key, owners);
    }
    return out;
}

/**
 * 정규식마다 원하는 켜짐 상태를 정한다.
 * @param {object} args
 * @param {any[]} args.scripts 정규식 목록 (id · scriptName · findRegex · replaceString · disabled)
 * @param {any[]} args.prompts 프롬프트 목록
 * @param {Set<string>} args.enabled 켜진 프롬프트 식별자
 * @param {Record<string,boolean>} args.origin 정규식 id → 원래 disabled
 * @param {Record<string,'auto'|'on'|'off'>} args.overrides 모듈 키 → 사용자 지정 (늘 켜기 · 늘 끄기)
 * @param {(keys:string[])=>boolean} [args.recentHas] 최근 메시지에 그 모듈 태그가 있으면 true (표시 정규식은 켜 둔다)
 * @returns {{id:string,name:string,keys:string[],owners:string[],linked:boolean,reason:string,want:boolean|null}[]} want: true=켜기 · false=끄기 · null=손대지 않음 ('늘 필요' 포함)
 */
export function plan({ scripts, prompts, enabled, origin = {}, overrides = {}, recentHas = () => false }) {
    const keys = [...new Set(scripts.flatMap(modulesOf))];
    const owners = ownersFor(keys, prompts);
    return scripts.map(script => {
        const id = script.id;
        const mine = modulesOf(script);
        const base = origin[id] ?? !!script.disabled; // 원래 상태 (사용자가 손으로 꺼 둔 것은 존중)
        const row = { id, name: script.scriptName, keys: mine, owners: [], linked: false, reason: '', want: null };
        if (alwaysNeeded(script)) return { ...row, reason: '늘 필요' };
        if (mine.length && mine.some(k => overrides[k] === 'on')) return { ...row, linked: true, reason: base ? '원래 꺼 둔 것' : '늘 켜기', want: !base };
        if (mine.length && mine.every(k => overrides[k] === 'off')) return { ...row, linked: true, reason: '늘 끄기', want: false };
        const ownerIds = [...new Set(mine.filter(k => overrides[k] !== 'off').flatMap(k => owners.get(k) || []))];
        row.owners = ownerIds;
        if (!mine.length) return { ...row, reason: '모듈 태그 없음' };
        if (!ownerIds.length) return { ...row, reason: '짝 프롬프트 없음' };
        row.linked = true;
        if (base) return { ...row, reason: '원래 꺼 둔 것', want: false };
        const anyOn = ownerIds.some(p => enabled.has(p));
        if (anyOn) return { ...row, reason: '프롬프트 켜짐', want: true };
        if (recentHas(mine)) return { ...row, reason: '최근 메시지에 있음', want: true };
        return { ...row, reason: '프롬프트 꺼짐', want: false };
    });
}

/** 메시지 글에 모듈 태그가 있나 (대소문자 무시, @ 있든 없든 · 과일은 <태그> · 기호) */
export function textHasModule(text, keys) {
    return textHasModuleLow(String(text || '').toLowerCase(), keys);
}
export function textHasModuleLow(low, keys) {
    return keys.some(k => isMark(k) ? markIn(low, k) : (tagIn(low, k) || low.includes(`! ${k} !`) || (k === 'thinking' && low.includes('<thinking'))));
}
