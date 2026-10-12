// 큰 숫자를 쉼표로 묶어 보여 주는 헬퍼. 프롬프트 목록의 토큰 수(src/promptlist.js)와 숫자 칸 표시(src/numcomma.js)에 쓴다.
//
// 4.5.1: 입력 칸 배경에 SVG 로 쉼표 숫자를 그려 주던 '큰 숫자는 쉼표로' 표시를 걷어냈다.
// 끌 수 있는 설정이 하나도 없는데 문서 전체를 characterData 까지 지켜보며 서랍이 열려 있는 동안
// 1.5 초마다 다시 재던 자리였고, 2.9.2 · 3.6.1 · 4.1.2 에서 세 번 느려짐을 만든 곳이다.
// 값을 바꾸지 않고 보여 주기만 하는 꾸밈이라 값어치보다 비용이 컸다.
// 5.3.7: 숫자 칸 쉼표 표시를 다시 들였다 — 문서 관찰자 · 타이머 없이, 끌 수 있게 (src/numcomma.js, 채팅 › 화면 '큰 숫자는 쉼표로').
export function groupedNumber(value) {
    const raw = String(value).trim();
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return raw;
    const [whole, fraction] = raw.split('.');
    if (whole.replace(/^[+-]/, '').length < 4) return raw;
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}

// 6.1.6 좁은 숫자 칸에 맞추기 (src/numcomma.js render): 실리태번 슬라이더 옆 숫자 칸(60px 안팎)은 5자리 '12,345' 는 들어가도
// 6자리 '128,000' 은 넘쳐서, 예전엔 그리지 않고 원래 글자로 두었다 — 쉼표가 사라진 것처럼 보였다 (사용자 제보).
// 순서: 그대로 들어가면 그대로 → 스핀 단추 자리까지 쓰면 들어가면 그 폭(wide) → 그래도 넘치면 글자를 줄여 칸에 맞춘다(한도 72%) →
// 그보다 더 줄여야 하면 예전처럼 원래 글자. 0.5px 는 반올림 여유.
export const NUMBER_FIT_MIN = 0.72;
// shrinkRoom: 줄여 그릴 때 쓸 수 있는 폭 (가운데 정렬 칸은 스핀 자리를 숨기면 칸 전체에 가운데로 그리므로 더 넓다 — 없으면 inner + spin)
export function fitNumberText(width, inner, spin = 0, min = NUMBER_FIT_MIN, shrinkRoom = null) {
    const w = Number(width) || 0, room = Number(inner) || 0, extra = Math.max(0, Number(spin) || 0);
    if (!(w > 0)) return null;
    if (w <= room + 0.5) return { scale: 1, wide: false };
    if (extra > 0 && w <= room + extra + 0.5) return { scale: 1, wide: true };
    const avail = Math.max(room + extra, Number(shrinkRoom) || 0);
    const scale = Math.floor(((avail - 0.5) / w) * 1000) / 1000;
    return scale >= min ? { scale, wide: extra > 0 } : null;
}
/** canvas 글꼴 글자('italic 400 16px Pretendard')의 크기만 줄인다. 크기를 못 찾으면 null */
export function scaledFont(font, fontSize, scale) {
    const size = String(fontSize || '').trim();
    const px = parseFloat(size);
    if (!(px > 0) || !String(font).includes(size)) return null;
    return String(font).replace(size, `${Math.round(px * scale * 100) / 100}px`);
}
