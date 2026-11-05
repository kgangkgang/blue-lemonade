// selected-sig(테마 census-rules/selected-sig.mjs 사본 · 10-31 결정): 고른 항목 표시는 하나 — 옅은 면(--pick-face) + 색 글자 + 650(+ 칩 · 세그는 체크). 꽉 찬 강조 면 없음.
//   칩 · 세그의 「고름」 서명 하나, 탭의 「고름」 서명 하나(높이 · 가로 여백 · 글자 크기 · 모서리 · 선은 빼고 견줘요 — 그건 크기표 · 변형 검사 몫).
import { ex, oneSig } from './ui-parts-lib.mjs';
export const id = 'selected-sig';
export const title = '고른 항목 표시 하나(옅은 면 + 색 글자 + 650)';
const strip = s => String(s).replace(/높이 \d+ · /, '').replace(/가로여백 \d+ · /, '').replace(/글자 [\d.]+\//, '글자 ').replace(/모서리 [^ ]+ · /, '').replace(/선 [^·]+ · /, '');
export function afterAll({ variants }) {
    const out = [];
    const picked = variants.filter(v => v.ours && (v.kind === 'seg' || v.kind === 'chip') && /\(고름\)/.test(v.sig));
    for (const v of picked) {
        if (/면 (ink|blue|text|blue-strong)(@[\d.]+)? ·/.test(v.sig)) out.push({ key: `full|${strip(v.sig)}`, msg: `고른 칸이 꽉 찬 강조 면 · ${ex(v)}` });
        else if (!/\/650 /.test(v.sig)) out.push({ key: `weight|${strip(v.sig)}`, msg: `고른 칸 굵기가 650 아님 · ${ex(v)}` });
        else if (!/면 pick-face/.test(v.sig)) out.push({ key: `face|${strip(v.sig)}`, msg: `고른 칸 면이 --pick-face 가 아님 · ${ex(v)}` });
    }
    out.push(...oneSig(picked, v => strip(v.sig), '고른 칸 모양').map(x => ({ ...x, key: 'pick|' + x.key })));
    const tabs = variants.filter(v => v.ours && v.kind === 'tab' && /\(고름\)/.test(v.sig));
    for (const v of tabs) if (/면 (ink|blue|text|blue-strong)(@[\d.]+)? ·/.test(v.sig)) out.push({ key: `tabfull|${strip(v.sig)}`, msg: `고른 탭이 꽉 찬 강조 면 · ${ex(v)}` });
    out.push(...oneSig(tabs, v => strip(v.sig), '고른 탭 모양').map(x => ({ ...x, key: 'tab|' + x.key })));
    // 켬 상태 글자 단추(담김 · 내 로그 켬)도 같은 표시
    for (const v of variants.filter(v => v.ours && v.kind === 'button' && /\(켬\)/.test(v.sig))) {
        if (!/면 pick-face/.test(v.sig) || !/\/650 /.test(v.sig)) out.push({ key: `btn-on|${strip(v.sig)}`, msg: `켬 상태 단추가 고른 표시(옅은 면 + 650)가 아님 · ${v.sig} · ${ex(v)}` });
    }
    return out;
}
