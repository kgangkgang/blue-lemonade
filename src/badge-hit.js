// 5.3.7 서랍 머리의 버전 알약: 알약 글자 위를 누른 것만 알약(공지 · 사용방법)으로 친다.
// 폰에서 머리 가운데쯤을 누르면 알약 테두리가 걸려 서랍 대신 공지가 열렸다 — 글자 밖 누름은 막지 않고 서랍 펴기로 흘려보낸다.
// 키보드(Enter · Space)와 서랍 머리 밖의 알약은 예전 그대로.
const PAD = 2;
export function badgeTextHit(event, badge = event?.currentTarget) {
    if (!badge?.closest?.('.inline-drawer-toggle')) return true;
    if (event.type !== 'click' || !event.detail || !Number.isFinite(event.clientX)) return true;
    const range = (badge.ownerDocument || document).createRange();
    range.selectNodeContents(badge);
    for (const r of range.getClientRects()) {
        if (event.clientX >= r.left - PAD && event.clientX <= r.right + PAD && event.clientY >= r.top - PAD && event.clientY <= r.bottom + PAD) return true;
    }
    return false;
}
