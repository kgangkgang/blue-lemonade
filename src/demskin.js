// 데우스 카드 스킨 (3.1.0) — 모양은 css/30-dem-skin.css. 여기는 폰 접기의 누름만 받는다.
//  · 트래커(한 줄 요약)를 누르면 펼치고, 다시 누르면 접는다.
//  · 처음부터 펼쳐져 오는 카드(선택지 · 상태)는 CSS 가 제목 줄만 보여 준다 → 제목을 누르면 브라우저 기본(닫기) 대신 내용을 보이고,
//    한 번 더 누르면 평소처럼 닫는다. 처음에 닫혀 오는 카드(장면 계획 등)는 열 때 표시를 붙여 둔다.
// 메시지를 다시 그리면(스트리밍 · 번역 · 수정) 표시가 사라져 다시 접힌다 — 매 걸음 DOM 을 지켜보지 않는다(비용 0).
const mq = window.matchMedia('(max-width: 1000px)');
let bound = false;

function folding() {
    return mq.matches && document.body.classList.contains('salty-dem-fold');
}

function onClick(event) {
    if (!folding()) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.mes_text')) return;
    const summary = target.closest('summary');
    if (summary?.parentElement?.matches('details.custom-dem-card')) {
        const card = summary.parentElement;
        if (!card.open) {
            card.classList.add('bl-dem-shown');
        } else if (card.classList.contains('bl-dem-shown')) {
            card.classList.remove('bl-dem-shown');
        } else {
            event.preventDefault();
            card.classList.add('bl-dem-shown');
        }
        return;
    }
    if (target.closest('a, button, summary, input')) return;
    const track = target.closest('.custom-dem-track, .custom-dem-track-recovery');
    if (track) track.classList.toggle('bl-dem-shown');
}

/** apply.js(features.js) 가 설정이 바뀔 때마다 부른다 — 모양은 body 클래스(apply.js)가 켜고 끄고, 여기는 누름만 */
export function syncDemSkin(on, chat = {}) {
    const want = !!on && chat.demFold !== false;
    if (want && !bound) {
        document.addEventListener('click', onClick);
        bound = true;
    } else if (!want && bound) {
        document.removeEventListener('click', onClick);
        bound = false;
    }
}
