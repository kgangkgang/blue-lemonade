// heading-scale(테마 census-rules/heading-scale.mjs 사본 · 10-31 결정 · 철칙 §14 글자 단계 4개): 절 · 묶음 제목(받는 법 h2 · 액자 방 h3)은 16/650, 창 제목(시트 · 장바구니 · 액자 방 · 시식)은 20/650.
//   쪽 제목(마트 h1 · 홈 절 h2 · 지니 h1 · 첫 화면 h1)은 사이트 제목 단계라 빼요.
import { ex } from './ui-parts-lib.mjs';
export const id = 'heading-scale';
export const title = '제목 크기 · 굵기 단계(16/650 · 20/650)';
const HEAD = /mart-head|section-head|gn-head|hero|^h1|> h1|install|gallery-heading|fresh h2|\.top /;
export function afterAll({ variants }) {
    const out = [];
    for (const v of variants.filter(v => v.ours && v.kind === 'heading')) {
        if ((v.examples || []).some(e => HEAD.test(e.path))) continue;
        const m = /글자 ([\d.]+)\/(\d+)/.exec(v.sig); if (!m) continue;
        const fs = Number(m[1]), fw = Number(m[2]);
        if (!((Math.abs(fs - 16) <= 0.5 || Math.abs(fs - 20) <= 0.5) && fw === 650)) out.push({ key: `${m[1]}/${m[2]}|${ex(v).split(' · ').at(-1).slice(-40)}`, msg: `제목 ${fs}/${fw}(기준 16/650 · 20/650) · ${ex(v)}` });
    }
    return out;
}
