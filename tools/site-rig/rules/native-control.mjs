// native-control(테마 census-rules/native-control.mjs 사본 · 10-31 결정): 보이는 체크박스 · 라디오는 브라우저 기본 모양(appearance auto)이 아니라 우리 모양(1px 선 · 모서리 4 · 켬 = 강조색 면 + ㄴ자 체크) · 고르기 상자는 ▾ 화살표가 있어야 해요.
import { ex } from './ui-parts-lib.mjs';
export const id = 'native-control';
export const title = '브라우저 기본 조작 없음(체크 · 라디오 · 고르기 ▾)';
export function afterAll({ variants }) {
    const out = [];
    for (const v of variants.filter(v => v.ours && (v.kind === 'radio' || v.kind === 'checkbox') && /appearance auto/.test(v.sig))) out.push({ key: `${v.kind}|${v.sig.replace(/\((고름|빈칸|체크)\)/, '')}`, msg: `기본 ${v.kind === 'radio' ? '라디오' : '체크박스'} · ${ex(v)}` });
    for (const v of variants.filter(v => v.ours && v.kind === 'select' && !/▾있음/.test(v.sig))) out.push({ key: `select|${v.sig}`, msg: `고르기 상자 ${/기본▾/.test(v.sig) ? '기본 화살표' : '화살표 없음'} · ${ex(v)}` });
    return out;
}
