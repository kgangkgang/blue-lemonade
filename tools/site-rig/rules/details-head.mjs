// details-head(테마 census-rules/details-head.mjs 사본 · 10-31 결정): 접힘 머리(「자세히」 · 세부 칩 접기 ▾ · summary)는 높이 36 이상(아이콘만이면 34) · 화살표 한 방식(선 그림 ⌄ 마스크 14 · 보조색) · 글자 크기 · 굵기 하나.
import { num, ex, oneSig } from './ui-parts-lib.mjs';
export const id = 'details-head';
export const title = '접힘 머리 하나(⌄ 마스크 14 · 36)';
export function afterAll({ variants }) {
    const d = variants.filter(v => v.ours && v.kind === 'details'), out = [];
    out.push(...oneSig(d, v => /화살표 (.+)$/.exec(v.sig)?.[1]?.replace(/ (muted|ink|text)(@[\d.]+)?$/, ''), '접힘 화살표 방식').map(x => ({ ...x, key: 'arrow|' + x.key })));
    out.push(...oneSig(d.filter(v => !/글자 0\//.test(v.sig)), v => /글자 ([\d.]+\/\d+)/.exec(v.sig)?.[1], '접힘 머리 글자').map(x => ({ ...x, key: 'type|' + x.key })));
    for (const v of d) {
        const h = num(v.sig, /높이 (\d+)/); if (h && h[0] < 33) out.push({ key: `h|${h[0]}`, msg: `접힘 머리 높이 ${h[0]}(기준 36 · 아이콘만 34) · ${ex(v)}` });
        if (!/화살표 mask 14px/.test(v.sig)) out.push({ key: `glyph|${/화살표 (.+)$/.exec(v.sig)?.[1]}`, msg: `접힘 화살표가 선 그림 마스크 14 가 아님 · ${v.sig} · ${ex(v)}` });
    }
    return out;
}
