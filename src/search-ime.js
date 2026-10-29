// 검색 IME 디바운스 (8.2.2 뒤 · 성능): 검색 칸에 한글을 조합하는 동안은 검색을 미루고, 조합이 끝난 뒤 300ms 동안 입력이 없을 때 한 번만 검색이 돈다.
// 왜 (실리태번 1.19 기준): initCharacterSearch() 가 jQuery 로 input 핸들러(300ms 디바운스 → entitiesFilter → 목록 전체 다시 그리기)를 건다. 한글은 자모마다
//   input 이 오니 「ㅎ」「하」에서 손이 잠깐 멈추면 그 조각으로 검색이 돌아 캐릭터가 수백이면 폰이 멈칫한다.
//   (8.2.7 search-ime-more) 다른 큰 목록 검색 칸도 같아요 — 월드인포(#world_info_search, 300ms 디바운스 → worldInfoFilter → 편집기 다시 그리기 · 항목 1000개 쪽에서
//   한 번 3.3초) · 페르소나(#persona_search_bar → personasFilter) · 채팅 파일(#select_chat_search → 서버 /api/chats/search) · 그룹 멤버 추가 · 지금 멤버
//   (#rm_group_filter · #rm_group_members_filter — 디바운스 없이 글자마다 groupCandidatesFilter · groupMembersFilter). FIELDS 의 칸을 모두 같은 규칙으로 맡아요.
// 어떻게: 실리태번 핸들러는 떼지 않는다. 입력칸의 부모(#form_character_search_form)에 캡처 단계 input 리스너를 건다 — 조상의 캡처 리스너는 등록 순서와 상관없이
//   대상 요소의 리스너보다 먼저 돌므로(같은 요소에 캡처로 걸면 브라우저 · 등록 순서에 따라 뒤에 돌 수 있다) stopImmediatePropagation 으로 실리태번까지 가지 않게 멈춘다.
//   조합 중(compositionstart~compositionend · isComposing)엔 모두 멈추고, 조합이 끝나거나 조합이 아닌 입력이면 300ms 뒤 우리가 input 이벤트를 한 번 다시 보낸다
//   (8.2.4 검토) 한글 IME 는 마지막 음절을 다음 글자 · 스페이스 · 칸 밖 누름 전까지 조합 중으로 둔다 — 조합 중에도 손이 COMPOSING_DELAY 동안 멈추면
//   지금 값으로 한 번 보낸다(전에는 「하나」를 치고 기다려도 목록이 안 바뀌었다). 그 뒤 compositionend 는 새 입력이 없으면 다시 보내지 않는다
//   (passing 표시로 그 한 번만 통과 → 실리태번 디바운스가 받아 검색). jQuery .trigger('input')(검색 지우기 · 태그 필터)은 네이티브 이벤트가 아니라 여기 안 걸려 바로 처리된다.
//   끄면 리스너를 떼고, 멈춰 둔 입력이 있으면 그 자리에서 한 번 보내 검색이 사라지지 않게 한다.
//   (8.2.7) 칸마다 따로 기다려요(한 칸의 타이머가 다른 칸 값을 덮지 않게). 보내는 값은 늘 그때 칸의 값이라 붙여넣기 · 지우기 · 조합 취소도 마지막 값으로 찾아요.
//   Enter(조합 중이 아닐 때)는 기다리지 않고 바로 보내요. 실리태번이 디바운스 없이 바로 거르는 칸(hold 0 — 그룹 멤버)은 조합이 아닌 입력(영문 · 지우기 · 붙여넣기)을
//   예전처럼 그대로 보내고 조합 중 입력만 모아요. 칸을 떼거나 칸이 바뀌면(다른 요소) 멈춰 둔 입력을 먼저 보내요.
// 바이바이가 켜져 있으면 캐릭터 검색 칸만 쉰다(바이바이는 캐릭터 검색만 같은 일을 한다 — features.js restingFor · skip). 설정: 채팅 › 화면 › 가볍게
//   「검색은 글자 조합이 끝난 뒤」 (chat.searchIme, 기본 켬)
export const DELAY = 300;
export const COMPOSING_DELAY = 700;   // 조합 중 손이 멈춘 뒤 — 자모 하나하나에는 찾지 않게 DELAY 보다 길게
export const INPUT_ID = 'character_search_bar';
/** 맡는 칸 → 조합이 아닌 입력을 모으는 시간(ms). 0 이면 조합이 아닌 입력은 그대로 실리태번에 (실리태번이 디바운스 없이 거르는 칸) */
export const FIELDS = { [INPUT_ID]: DELAY, world_info_search: DELAY, persona_search_bar: DELAY, select_chat_search: DELAY, rm_group_filter: 0, rm_group_members_filter: 0 };
let on = false, passing = false;
const fields = new Map();   // 입력칸 요소 → { id, el, hold, composing, timer, dirty }
const hosts = new Set();    // 캡처 리스너를 건 부모

function mine(e) { return on ? fields.get(e.target) : undefined; }
function schedule(f, ms) { clearTimeout(f.timer); f.timer = setTimeout(() => send(f), ms); }
function onInput(e) {
    const f = mine(e);
    if (!f || passing) return;
    const composingNow = f.composing || e.isComposing;
    if (!f.hold && !composingNow) { clearTimeout(f.timer); f.timer = 0; f.dirty = false; return; }   // 바로 거르는 칸의 조합 아닌 입력 — 실리태번이 지금 값을 받는다
    e.stopImmediatePropagation();
    f.dirty = true;
    schedule(f, composingNow ? COMPOSING_DELAY : f.hold);   // 조합 중이면 더 길게 기다린다 — 끝나면 compositionend 가 DELAY 로 다시 잰다
}
function onCompositionStart(e) { const f = mine(e); if (!f) return; f.composing = true; clearTimeout(f.timer); f.timer = 0; }
// 조합 중 타이머가 이미 지금 값을 보냈으면(dirty 아님) 같은 검색을 또 하지 않는다. 브라우저에 따라 마지막 input 이 compositionend 뒤에 와도 그 input 이 잰다
function onCompositionEnd(e) { const f = mine(e); if (!f) return; f.composing = false; if (f.dirty) schedule(f, DELAY); }
// Enter 는 「지금 찾아」 — 조합을 끝내는 Enter(isComposing)는 compositionend 가 맡고, 그 뒤 브라우저가 한 번 더 보내는 Enter 에서 바로 보내요
function onKeyDown(e) { const f = mine(e); if (f && e.key === 'Enter' && !e.isComposing && !f.composing) send(f); }
function send(f) {
    clearTimeout(f.timer); f.timer = 0;
    if (!f.dirty) return false;
    f.dirty = false; passing = true;
    try { f.el.dispatchEvent(new Event('input', { bubbles: true })); } finally { passing = false; }
    return true;
}
/** 멈춰 둔 입력을 지금 한 번 실리태번에 보낸다(id 를 주면 그 칸만). 돌려주는 값: 보냈는지 */
export function flush(id) {
    let sent = false;
    for (const f of [...fields.values()]) if (!id || f.id === id) sent = send(f) || sent;
    return sent;
}
const EVENTS = [['input', onInput], ['compositionstart', onCompositionStart], ['compositionend', onCompositionEnd], ['keydown', onKeyDown]];
const hostOf = el => el.parentElement || document;

/** @param {boolean} enabled @param {{ skip?: string[] }} [opts] skip = 맡지 않을 칸 id (다른 확장이 같은 일을 하는 칸) */
export function syncSearchIme(enabled, { skip = [] } = {}) {
    on = !!enabled;
    const want = new Map();
    if (on) for (const [id, hold] of Object.entries(FIELDS)) {
        if (skip.includes(id)) continue;
        const el = document.getElementById(id);   // 아직 없으면 다음 설정 적용 때 다시 (모두 index.html 에 고정된 칸이라 보통 바로 있다)
        if (el) want.set(el, { id, hold });
    }
    for (const [el, f] of [...fields]) if (want.get(el)?.id !== f.id) { send(f); fields.delete(el); }   // 떼는 칸에 멈춰 둔 입력은 지금 보낸다
    for (const [el, { id, hold }] of want) if (!fields.has(el)) fields.set(el, { id, el, hold, composing: false, timer: 0, dirty: false });
    const need = new Set([...fields.keys()].map(hostOf));
    for (const h of [...hosts]) if (!need.has(h)) { for (const [type, fn] of EVENTS) h.removeEventListener(type, fn, true); hosts.delete(h); }
    for (const h of need) if (!hosts.has(h)) { for (const [type, fn] of EVENTS) h.addEventListener(type, fn, true); hosts.add(h); }
}

/** 시험용 */
export const _forTest = {
    state: (id = INPUT_ID) => {
        const f = [...fields.values()].find(x => x.id === id);
        return { on, bound: !!f && hosts.has(hostOf(f.el)), composing: !!f?.composing, dirty: !!f?.dirty, waiting: !!f?.timer };
    },
    hosts: () => hosts.size,
};
