// close-ink(테마 census-rules/close-ink.mjs 사본 · 10-31 결정 · 철칙 §2): 닫기 ✕ 는 한 모양 — 상자 없음 · 같은 그림(선 그림 마스크 16) · 같은 잉크. 칸 크기 · 모서리는 빼고 견줘요.
//   장바구니 줄의 「빼기」 ✕(.x.quiet)도 같은 그림이어야 해요(색만 보조색).
import { oneSig, ex } from './ui-parts-lib.mjs';
export const id = 'close-ink';
export const title = '닫기 ✕ 모양 하나(마스크 16 · 상자 없음)';
export function afterAll({ variants }) {
    const c = variants.filter(v => v.ours && v.kind === 'close');
    const shape = v => v.sig.replace(/^\d+×\d+ · /, '').replace(/모서리 [^ ]+ · /, '').replace(/(그림 \S+ [\d.]+px) .*$/, '$1');
    const out = oneSig(c, shape, '닫기 ✕');
    for (const v of c) {
        if (!/면 투명/.test(v.sig) || !/선 없음/.test(v.sig)) out.push({ key: `box|${shape(v)}`, msg: `닫기 ✕ 에 면 · 선 상자 · ${v.sig} · ${ex(v)}` });
        if (!/그림 mask::(before|after) 16px/.test(v.sig)) out.push({ key: `glyph|${shape(v)}`, msg: `닫기 ✕ 그림이 선 그림 마스크 16 이 아님 · ${v.sig} · ${ex(v)}` });
    }
    return out;
}
