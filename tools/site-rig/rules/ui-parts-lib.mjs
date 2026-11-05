// 공용 부품 규칙(census-rules/ui-*.mjs) 도우미 — 10-31 UI 전수조사 뒤 사용자 결정(디자인 철칙 끝 「10-31 UI 전수조사 뒤 정한 것」 · 테마 css/88-ui-parts.css)
//   ui-census 가 모은 변형(variants: { kind, sig, count, where, ours, examples[{ where, path, text }] })에서 역할별 서명을 읽어요.
export const num = (s, re) => { const m = re.exec(String(s)); return m ? m.slice(1).map(Number) : null; };
export const ours = (variants, kind) => variants.filter(v => v.ours && v.kind === kind);
export const ex = v => { const e = (v.examples || []).find(x => x.ours) || (v.examples || [])[0] || {}; return `${(v.where || []).slice(0, 3).join(' / ')} · ${String(e.path || '').slice(-70)}${e.text ? ` 「${e.text}」` : ''}`; };
export const lastTag = v => String(((v.examples || [])[0] || {}).path || '').split(' > ').at(-1) || '';
/** 같은 역할 서명이 둘 이상이면 다수 말고 나머지마다 위반 하나 */
export function oneSig(list, f, label) {
    const m = new Map();
    for (const v of list) { const s = f(v); if (s == null) continue; const a = m.get(s) || []; a.push(v); m.set(s, a); }
    if (m.size < 2) return [];
    const sorted = [...m].sort((a, b) => b[1].reduce((n, v) => n + v.count, 0) - a[1].reduce((n, v) => n + v.count, 0));
    return sorted.slice(1).map(([sig, vs]) => ({ key: sig, msg: `${label} ${m.size}가지 — 다수 「${sorted[0][0]}」 와 다른 「${sig}」 ×${vs.reduce((n, v) => n + v.count, 0)} · ${ex(vs[0])}` }));
}
