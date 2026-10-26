// 8.0.6 보이는 본문의 태그 속성(style · class · 색 · 주소 …)은 번역 요청에 보내지 않는다.
//   <span style="color:#e06c75">「…」</span> → <span a1>「…」</span> 로 보내고, 받은 답의 <span a1> 을 원래 태그로 되돌린다.
//   태그 자체(문장 안 어디서 열고 닫는지)는 모델이 알아야 해서 남기고, 사람이 읽지 않는 속성 글자만 뺀다.
//   같은 속성은 같은 이름(a1)이라 대사색처럼 되풀이되는 태그가 짧아진다. 번역에 도움이 되는 속성(character · title · alt …)이 있는 태그는 그대로.
//   모델이 이름(a1)을 빠뜨린 맨 태그 <span> 은, 원문에 그 이름의 맨 태그가 없을 때만 빠진 이름을 차례대로 채운다 — 못 채우면 맨 태그 그대로(색만 빠짐).
//   실리태번 모듈을 import 하지 않아요 (node 시험: tools/tests/translator-preset-compat.mjs).
const OPEN = /<([A-Za-z][\w:-]*)((?:\s+(?:[^\s<>"'=/]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s<>"']+))?)+)\s*(\/?)>/g;
const KEEP_ATTR = /(?:^|\s)(?:character|name|title|alt|aria-label|placeholder|label|value|summary|lang)\s*=/i;
const ALIAS = /<([A-Za-z][\w:-]*)\s+a(\d+)\s*(\/?)>/g;
const MIN_SAVING = 4;

/** 보낼 글 → { text, changed, restore(답), aliases } */
export function compactTags(text) {
    const source = String(text ?? '');
    const same = { text: source, changed: false, restore: answer => String(answer ?? ''), aliases: 0 };
    if (!source.includes('<') || new RegExp(ALIAS.source).test(source)) return same;   // 원문에 이미 a1 꼴 태그가 있으면 손대지 않는다
    const list = [], byKey = new Map();
    const out = source.replace(OPEN, (tag, name, attrs, self) => {
        if (KEEP_ATTR.test(attrs) || attrs.trim().length < MIN_SAVING) return tag;
        const key = name.toLowerCase() + '\u0000' + attrs.trim();
        let n = byKey.get(key);
        if (n === undefined) { list.push({ name: name.toLowerCase(), tag }); n = list.length; byKey.set(key, n); }
        return `<${name} a${n}${self ? ' /' : ''}>`;
    });
    if (!list.length || out.length >= source.length) return same;
    const bareCount = (value, name) => (String(value).match(new RegExp(`<${name}\\s*>`, 'gi')) || []).length;
    const aliasOrder = name => [...out.matchAll(new RegExp(ALIAS.source, 'g'))].filter(m => m[1].toLowerCase() === name).map(m => Number(m[2]));
    const restore = answer => {
        let value = String(answer ?? '');
        const seen = new Map();
        value = value.replace(new RegExp(ALIAS.source, 'g'), (m, name, n) => {
            const item = list[Number(n) - 1];
            if (!item) return m;
            seen.set(item.name, [...(seen.get(item.name) || []), Number(n)]);
            return item.name === name.toLowerCase() ? item.tag : item.tag.replace(/^<[A-Za-z][\w:-]*/, `<${name}`);
        });
        // 모델이 a1 을 빠뜨린 맨 태그: 원문(보낸 글)에 같은 이름의 맨 태그가 없을 때만, 빠진 이름을 원문 차례대로
        for (const name of new Set(list.map(item => item.name))) {
            if (bareCount(out, name) || !bareCount(value, name)) continue;
            const missing = [...aliasOrder(name)];
            for (const n of seen.get(name) || []) { const at = missing.indexOf(n); if (at >= 0) missing.splice(at, 1); }
            value = value.replace(new RegExp(`<${name}\\s*>`, 'gi'), m => (missing.length ? list[missing.shift() - 1].tag : m));
        }
        return value;
    };
    return { text: out, changed: true, restore, aliases: list.length };
}
