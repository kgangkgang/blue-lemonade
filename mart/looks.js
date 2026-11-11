// 11-12 추천 스타일 여섯 벌(설계 4-3 — 첫 안 · 실제 틀에 입혀 보고 다듬어요). 스타일 = 틀과 따로인 한 벌: 글 모양(look) + 움직임(motion) + 모양(shape — 띠 진하기 · 모서리 · 이름표).
//   모양 값은 그 틀이 못 받으면(능력표) 거는 쪽이 건너뛰어요 — 값은 스타일에 그대로 남아요.
export const LOOKS = Object.freeze([
    { id: 'plain', label: '틀 그대로', look: null, motion: { text: 'm', prop: 'm' }, shape: null },
    { id: 'clear', label: '또렷하게', look: { type: { weight: 500 }, dialogue: { weight: 650 }, profile: { nameWeight: 800 } }, motion: { text: 'm', prop: 'm' }, shape: { bandAlpha: 28 } },
    { id: 'calm', label: '잔잔하게', look: { type: { lineHeight: 1.9 } }, motion: { text: 's', prop: 's' }, shape: { bandAlpha: 12 } },
    { id: 'big', label: '큼직하게', look: { type: { sizeStep: 2, lineHeight: 1.9, para: 1.1 } }, motion: { text: 'm', prop: 'm' }, shape: null },
    { id: 'book', label: '책처럼', look: { fonts: { text: 'serif' }, type: { align: 'justify-word', indent: true }, dialogue: { style: 'plain' } }, motion: { text: 'm', prop: 'm' }, shape: { nameTag: 'line' } },
    { id: 'light', label: '가볍게', look: { fonts: { text: 'gothic' }, type: { indent: false, para: 0.6 }, dialogue: { style: 'full' } }, motion: { text: 'm', prop: 'm' }, shape: { radius: 16, nameTag: 'pill' } },
]);
const sorted = v => (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v);
export const sameLook = (a, b) => JSON.stringify(sorted(a || null)) === JSON.stringify(sorted(b || null));
