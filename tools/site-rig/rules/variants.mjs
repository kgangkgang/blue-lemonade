// 부품마다 변형 1(테마 census/rules/variants.mjs 사본 · 10-31 결정): 같은 종류 부품의 모양 서명이 둘 이상이면 서명마다 위반 하나 — 상태(켬 · 끔 · 체크 · 고름 · 비활성)는 빼고 견줘요.
//   사이트 몫: ① 글자 단추는 주요(잉크 채움 · 650)와 보조(면 + 1px 선 · 400) 두 무리 — 무리 안에서 하나 ② 아이콘만 단추는 그림(이모지 · 마스크 · 크기)은 빼고 상자만 견줘요(잉크는 icon-btn-size 몫)
//   ③ 견주는 종류: 단추 · 아이콘 단추 · 닫기 · 칩 · 세그 · 탭 · 접힘 · 꼬리표 · 입력칸 · 고르기 · 체크박스 · 배지(창 · 카드 · 제목 · 슬라이더는 역할마다 달라 안 봐요)
export const id = 'variant';
export const title = '부품마다 변형 1';
const KINDS = new Set(['button', 'iconbtn', 'close', 'chip', 'seg', 'tab', 'details', 'pill', 'text', 'select', 'checkbox', 'badge', 'color']);
const STATE = /\((켬|끔|체크|빈칸|고름|안고름)\)| · 비활성|(^|\s)(고름|안고름)(\s|$)/g;
export const norm = (kind, sig) => {
    let s = String(sig).replace(STATE, ' ');
    if (kind === 'iconbtn' || kind === 'close') s = s.replace(/ · 그림 .*$/, '').replace(/^\d+×\d+ · /, '');
    if (kind === 'details') s = s.replace(/높이 \d+ · /, '').replace(/글자 [\d.]+\/\d+ · /, '');   // 접힘 머리 높이(36 · 아이콘만 34) · 글자는 details-head 몫
    s = s.replace(/가로여백 \d+ · /, '');   // 가로 여백은 칸 너비 맞춤(카드 3칸 · 바닥 줄)이라 모양 서명에서 빼요
    return s.replace(/\s+/g, ' ').trim();
};
export function afterAll({ variants }) {
    const by = new Map();
    for (const v of variants) {
        if (!v.ours || !KINDS.has(v.kind)) continue;
        if (/\((켬|고름|체크)\)/.test(v.sig)) continue;   // 켬 · 고름 상태 모양은 고른 표시 하나(selected-sig) 몫이에요 — 여기선 평소 모양만 견줘요
        const group = v.kind + (v.kind === 'button' && /\(담기\)/.test(v.sig) ? '/담기' : v.kind === 'button' && /\(주요\)/.test(v.sig) ? '/주요' : '');
        const s = norm(v.kind, v.sig);
        (by.get(group) || by.set(group, new Map()).get(group)).set(s, [...((by.get(group).get(s)) || []), v]);
    }
    const out = [];
    for (const [kind, m] of by) {
        if (m.size < 2) continue;
        const sorted = [...m].sort((a, b) => b[1].reduce((n, v) => n + v.count, 0) - a[1].reduce((n, v) => n + v.count, 0));
        for (const [sig, vs] of sorted.slice(1)) {
            const n = vs.reduce((a, v) => a + v.count, 0), where = [...new Set(vs.flatMap(v => v.where))].slice(0, 4).join(' / ');
            out.push({ key: `${kind}|${sig}`, msg: `${kind} 변형 ${m.size}개 중 다수 「${sorted[0][0]}」 와 다른 「${sig}」 ×${n} · ${where} · ${(vs[0].examples || [])[0]?.path?.slice(-60) || ''}` });
        }
    }
    return out;
}
