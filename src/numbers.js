// 큰 숫자를 쉼표로 묶어 보여 주는 헬퍼. 프롬프트 목록의 토큰 수에 쓴다(src/promptlist.js).
//
// 4.5.1: 입력 칸 배경에 SVG 로 쉼표 숫자를 그려 주던 '큰 숫자는 쉼표로' 표시를 걷어냈다.
// 끌 수 있는 설정이 하나도 없는데 문서 전체를 characterData 까지 지켜보며 서랍이 열려 있는 동안
// 1.5 초마다 다시 재던 자리였고, 2.9.2 · 3.6.1 · 4.1.2 에서 세 번 느려짐을 만든 곳이다.
// 값을 바꾸지 않고 보여 주기만 하는 꾸밈이라 값어치보다 비용이 컸다.
export function groupedNumber(value) {
    const raw = String(value).trim();
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return raw;
    const [whole, fraction] = raw.split('.');
    if (whole.replace(/^[+-]/, '').length < 4) return raw;
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
}
