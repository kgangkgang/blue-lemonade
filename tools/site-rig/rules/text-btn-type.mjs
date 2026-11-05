// text-btn-type(테마 census-rules/text-btn-type.mjs 사본 · 10-31 결정): 글자 단추 글자 = 조작 글자 한 단계(사이트 --ts-ctl 14) · 굵기 400(주요 650) 둘만.
//   탭 · 칩 · 세그 · 접힘 머리는 다른 종류로 모여서 여기 안 와요. 지니 답 카드 · 큰 카드형 누름은 수집기가 단추로 세지 않아요.
import { ex } from './ui-parts-lib.mjs';
export const id = 'text-btn-type';
export const title = '글자 단추 글자 한 단계(14 · 400/650)';
let CTL = null;
export async function perScreen({ ev }) {
    if (CTL == null) CTL = await ev(`(()=>{const p=document.createElement('span');p.style.cssText='position:absolute;visibility:hidden;font-size:var(--ts-ctl,14px)';document.body.appendChild(p);const v=Math.round(parseFloat(getComputedStyle(p).fontSize)*2)/2;p.remove();return v})()`).catch(() => 14);
    return [];
}
const where = v => ex(v).split(' · ').at(-1).slice(-40);
export function afterAll({ variants }) {
    const out = [];
    for (const v of variants.filter(v => v.ours && v.kind === 'button')) {
        const m = /글자 ([\d.]+)\/(\d+)/.exec(v.sig); if (!m) continue;
        const fs = Number(m[1]), fw = Number(m[2]);
        if (CTL && Math.abs(fs - CTL) > 0.5) out.push({ key: `size|${fs}|${where(v)}`, msg: `글자 단추 글자 ${fs}(기준 ${CTL}) · ${ex(v)}` });
        if (![400, 650].includes(fw)) out.push({ key: `weight|${fw}|${where(v)}`, msg: `글자 단추 굵기 ${fw}(400 · 650) · ${ex(v)}` });
        const h = Number(/높이 (\d+)/.exec(v.sig)?.[1]);
        if (h && Math.abs(h - 36) > 1) out.push({ key: `height|${h}|${where(v)}`, msg: `글자 단추 높이 ${h}(기준 36) · ${ex(v)}` });
        if (/\(담기\)/.test(v.sig) && !/\(켬\)/.test(v.sig) && fw !== 650) out.push({ key: `pick|${fw}|${where(v)}`, msg: `담기 단추 굵기 ${fw}(기준 650) · ${ex(v)}` });
        if (/\(주요\)/.test(v.sig) && fw !== 650) out.push({ key: `primary|${fw}|${where(v)}`, msg: `주요 단추 굵기 ${fw}(기준 650) · ${ex(v)}` });
    }
    return out;
}
