// icon-btn-size(테마 census-rules/icon-btn-size.mjs 사본 · 10-31 결정 크기표): 아이콘만 단추는 34×34(±1) · 면 없음 · 잉크 12~16.5(이모지 16 · 선 그림 마스크 16 · 꺾쇠 14).
//   켬 상태(aria-pressed — 서명 「(켬)」)는 공용 고른 면(--pick-face)을 허용해요. 사이트엔 도구 줄 예외가 없어요.
import { num, ex } from './ui-parts-lib.mjs';
export const id = 'icon-btn-size';
export const title = '아이콘만 단추 크기표(34 · 면 없음 · 잉크 12.5~16)';
const where = v => ex(v).split(' · ').at(-1).slice(-40);
export function afterAll({ variants }) {
    const out = [];
    for (const v of variants.filter(v => v.ours && v.kind === 'iconbtn')) {
        const wh = num(v.sig, /^(\d+)×(\d+)/), ink = num(v.sig, /그림 \S+ ([\d.]+)px/);
        if (wh && (Math.abs(wh[0] - 34) > 1 || Math.abs(wh[1] - 34) > 1)) out.push({ key: `size|${wh.join('x')}|${where(v)}`, msg: `아이콘만 단추 ${wh.join('×')}(기준 34×34) · ${ex(v)}` });
        const pickFace = /\(켬\)/.test(v.sig) && /면 pick-face(@[\d.]+)? ·/.test(v.sig);
        if (!/면 투명/.test(v.sig) && !pickFace) out.push({ key: `face|${where(v)}`, msg: `아이콘만 단추에 면 · ${v.sig} · ${ex(v)}` });
        if (!/선 없음/.test(v.sig)) out.push({ key: `line|${where(v)}`, msg: `아이콘만 단추에 선 · ${v.sig} · ${ex(v)}` });
        if (ink && (ink[0] < 12 || ink[0] > 16.5)) out.push({ key: `ink|${ink[0]}|${where(v)}`, msg: `아이콘 잉크 ${ink[0]}px(기준 12.5~16) · ${ex(v)}` });
    }
    return out;
}
