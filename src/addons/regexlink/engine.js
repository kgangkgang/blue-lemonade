// 프롬프트 연동 정규식 — 순수 계산부 (브라우저 · 테스트 공용, DOM 없음)
//
// 정규식 이름 · 내용에서 모듈 태그(@Momentum Engine · ! Scene Plan ! · Thinking (Fallback) …)를 뽑고,
// 프롬프트 이름(없으면 별칭 → 내용)에서 그 모듈의 주인 프롬프트를 찾는다. 주인이 전부 꺼져 있으면 정규식도 끈다.
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

export const keyOf = text => String(text || '').toLowerCase().replace(/[^a-z0-9가-힣 ]+/g, ' ').split(/\s+/).filter(w => w && !NOISE.has(w)).join(' ');

/** 정규식 하나의 모듈 키들 (이름 우선, 없으면 찾기 · 바꾸기 글) */
export function modulesOf(script) {
    const pick = (text) => [...new Set((String(text || '').match(TAG_RE) || []).map(keyOf).filter(Boolean))];
    const fromName = pick(script.scriptName);
    if (fromName.length) return fromName;
    return pick(`${script.findRegex || ''} ${script.replaceString || ''}`);
}

/** 프롬프트 이름을 견줄 수 있게: 「 」 | ! ⚠️ ❗ 와 괄호 안을 뗀다 */
export const promptKey = name => keyOf(String(name || '').replace(/\([^)]*\)/g, ' ').replace(/[「」|!⚠️❗{}]/g, ' '));

/**
 * 모듈 키 → 주인 프롬프트 식별자들. 이름에 키가 들어 있는 프롬프트, 없으면 별칭 이름, 그것도 없으면 내용에 @키 가 든 프롬프트(6개 이하일 때만).
 * @param {{identifier:string,name:string,content?:string,marker?:boolean}[]} prompts
 * @returns {Map<string,string[]>}
 */
export function ownersFor(keys, prompts, aliases = ALIASES) {
    const list = prompts.filter(p => p && !p.marker && p.identifier);
    const byName = (needle) => list.filter(p => promptKey(p.name).includes(needle)).map(p => p.identifier);
    const out = new Map();
    for (const key of keys) {
        let owners = byName(key);
        if (!owners.length) for (const alias of aliases[key] || []) owners.push(...byName(alias));
        owners = [...new Set(owners)];
        if (!owners.length) {
            const needle = `@${key}`;
            const byContent = list.filter(p => keyOf(String(p.content || '').replace(/@/g, ' @')).includes(key) && String(p.content || '').toLowerCase().includes(needle.replace(/ /g, ' '))).map(p => p.identifier);
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
 * @returns {{id:string,name:string,keys:string[],owners:string[],linked:boolean,reason:string,want:boolean|null}[]} want: true=켜기 · false=끄기 · null=손대지 않음
 */
export function plan({ scripts, prompts, enabled, origin = {}, overrides = {}, recentHas = () => false }) {
    const keys = [...new Set(scripts.flatMap(modulesOf))];
    const owners = ownersFor(keys, prompts);
    return scripts.map(script => {
        const id = script.id;
        const mine = modulesOf(script);
        const base = origin[id] ?? !!script.disabled; // 원래 상태 (사용자가 손으로 꺼 둔 것은 존중)
        const row = { id, name: script.scriptName, keys: mine, owners: [], linked: false, reason: '', want: null };
        if (mine.length && mine.some(k => overrides[k] === 'on')) return { ...row, linked: true, reason: '늘 켜기', want: true };
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

/** 메시지 글에 모듈 태그가 있나 (대소문자 무시, @ 있든 없든) */
export function textHasModule(text, keys) {
    const low = String(text || '').toLowerCase();
    return keys.some(k => low.includes(`@${k}`) || low.includes(`! ${k} !`) || (k === 'thinking' && low.includes('<thinking')));
}
