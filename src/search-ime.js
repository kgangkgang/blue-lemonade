// 캐릭터 검색 IME 디바운스 (8.2.2 뒤 · 성능): #character_search_bar 에 한글을 조합하는 동안은 검색을 미루고, 조합이 끝난 뒤 300ms 동안 입력이 없을 때 한 번만 검색이 돈다.
// 왜 (실리태번 1.19 기준): initCharacterSearch() 가 jQuery 로 input 핸들러(300ms 디바운스 → entitiesFilter → 목록 전체 다시 그리기)를 건다. 한글은 자모마다
//   input 이 오니 「ㅎ」「하」에서 손이 잠깐 멈추면 그 조각으로 검색이 돌아 캐릭터가 수백이면 폰이 멈칫한다.
// 어떻게: 실리태번 핸들러는 떼지 않는다. 입력칸의 부모(#form_character_search_form)에 캡처 단계 input 리스너를 건다 — 조상의 캡처 리스너는 등록 순서와 상관없이
//   대상 요소의 리스너보다 먼저 돌므로(같은 요소에 캡처로 걸면 브라우저 · 등록 순서에 따라 뒤에 돌 수 있다) stopImmediatePropagation 으로 실리태번까지 가지 않게 멈춘다.
//   조합 중(compositionstart~compositionend · isComposing)엔 모두 멈추고, 조합이 끝나거나 조합이 아닌 입력이면 300ms 뒤 우리가 input 이벤트를 한 번 다시 보낸다
//   (passing 표시로 그 한 번만 통과 → 실리태번 디바운스가 받아 검색). jQuery .trigger('input')(검색 지우기 · 태그 필터)은 네이티브 이벤트가 아니라 여기 안 걸려 바로 처리된다.
//   끄면 리스너를 떼고, 멈춰 둔 입력이 있으면 그 자리에서 한 번 보내 검색이 사라지지 않게 한다.
// 바이바이가 켜져 있으면 쉰다(같은 기능이 있다 — features.js restingFor). 설정: 채팅 › 화면 › 가볍게 「검색은 글자 조합이 끝난 뒤」 (chat.searchIme, 기본 켬)
export const DELAY = 300;
export const INPUT_ID = 'character_search_bar';
let on = false, input = null, host = null, composing = false, timer = 0, passing = false, dirty = false;

function mine(e) { return on && !!input && e.target === input; }
function schedule() { clearTimeout(timer); timer = setTimeout(flush, DELAY); }
function onInput(e) {
    if (!mine(e) || passing) return;
    e.stopImmediatePropagation();
    dirty = true;
    if (composing || e.isComposing) return;   // 조합 중 — 끝날 때 잰다
    schedule();
}
function onCompositionStart(e) { if (!mine(e)) return; composing = true; clearTimeout(timer); timer = 0; }
function onCompositionEnd(e) { if (!mine(e)) return; composing = false; dirty = true; schedule(); }
/** 멈춰 둔 입력을 지금 한 번 실리태번에 보낸다. 돌려주는 값: 보냈는지 */
export function flush() {
    clearTimeout(timer); timer = 0;
    if (!dirty || !input) return false;
    dirty = false; passing = true;
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } finally { passing = false; }
    return true;
}
function unbind() {
    if (!host) return;
    host.removeEventListener('input', onInput, true);
    host.removeEventListener('compositionstart', onCompositionStart, true);
    host.removeEventListener('compositionend', onCompositionEnd, true);
    host = null;
}

export function syncSearchIme(enabled) {
    on = !!enabled;
    if (!on) { flush(); unbind(); composing = false; input = null; return; }
    const el = document.getElementById(INPUT_ID);
    if (!el) { unbind(); input = null; return; }   // 아직 없으면 다음 설정 적용 때 다시 (index.html 에 고정된 칸이라 보통 바로 있다)
    const next = el.parentElement || document;
    if (el === input && next === host) return;
    unbind();
    input = el; host = next;
    host.addEventListener('input', onInput, true);
    host.addEventListener('compositionstart', onCompositionStart, true);
    host.addEventListener('compositionend', onCompositionEnd, true);
}

/** 시험용 */
export const _forTest = { state: () => ({ on, bound: !!host, composing, dirty, waiting: !!timer }) };
