// 최적화 3차: 번역 단추 여섯 개를 실리태번 메시지 틀(#message_template)에도 넣어 둬요 — 새로 그리는 메시지가 틀째 복제해 와서, 메시지마다 붙이는 일이 없어져요.
//   예전에는 메시지가 #chat 에 붙을 때마다(감시 콜백) 단추 여섯 개를 그 메시지에 끼웠어요. 붙은 뒤에 끼우는 요소는 하나하나가 변경 기록이라
//   실리태번 keyboard.js(요소마다 선택자 30여 개로 그 아래를 훑음) · a11y.js 와 테마 감시들이 메시지마다 여섯 번씩 더 돌았어요
//   (리그 · 채팅 300 열기: 붙은 요소 기록 3,657개 중 1,800개가 이 단추 · keyboard.js 콜백 순정 60 → 127ms). 틀에 있으면 메시지와 함께 한 번에 붙어요.
//   같은 길을 테마의 「대사만 보기」(src/dialogue-only.js) · 「연필 옆 지우기」(src/quick/mes-delete.js) · 실리태번 내장 확장들이 써요.
// 끝 모습을 예전과 같게:
//   · 자리: 예전에는 감시 콜백이 도는 그때 메뉴(.extraMesButtons) 맨 앞에 여섯 개를 차례대로 끼웠어요. 틀에서 온 메시지도 같은 콜백에서 여섯 개가 맨 앞 · 그 차례인지 보고,
//     아니면(다른 확장이 틀 맨 앞에 제 단추를 넣었거나, 먼저 돈 다른 감시가 앞에 끼웠을 때) 그 여섯 개를 맨 앞으로 옮겨요 — 콜백 차례가 같으니 끝 차례도 같아요.
//   · 숨김 설정: 틀 안 단추도 updateButtonVisibility(문서 전체)가 같이 맞춰요.
//   · 틀이 없거나(옛 실리태번 · 흉내 문서) 틀을 안 거친 메시지는 예전처럼 그 메시지에 끼워요(createTranslateButtons).
//   · 다른 감시가 먼저 돌며 메뉴 맨 앞에 제 단추를 끼우는 경우(읽기 · 대본 단추 — src/addons/tts): 예전 끝 차례는 [번역 여섯][그 단추][원래 단추]였어요(번역 쪽이 나중에 맨 앞에 끼웠으니).
//     그 감시가 pendingTail 로 「틀에서 온 번역 단추가 아직 자리 확인 전」인지 물어, 그렇다면 여섯 개 바로 뒤에 끼워요 — 끝 차례가 같고 옮길 일이 없어요(전역 다리 TEMPLATED).
//     번역 쪽이 먼저 돈 뒤면(자리 확인 끝) 예전처럼 맨 앞에 끼워요.
// 껍데기(shell.js)와 본체(index.js)가 같이 써요 — 「이미 자리 잡은 메시지」 기억(settled)도 하나예요.
const NAMES = ['mes_legacy_translate', 'mes_llm_translate', 'mes_toggle_original', 'mes_edit_translation', 'mes_paragraph_correction', 'mes_delete_translation'];
const settled = new WeakSet();

/** 메시지 틀의 메뉴에 단추가 없으면 넣어요(fragment = 숨김 설정대로 만든 여섯 개 조각을 돌려주는 함수). 넣었으면 true */
export function ensureTemplateButtons(fragment, doc = globalThis.document) {
    let extra = null;
    try { extra = doc?.querySelector?.('#message_template .mes .mes_buttons > .extraMesButtons') ?? null; } catch { extra = null; }
    if (!extra || extra.querySelector(':scope > .mes_llm_translate')) return false;
    extra.prepend(fragment());
    return true;
}

/** 메뉴(extra)의 맨 앞 여섯 개가 번역 단추 제 차례인가 — 그렇다면 여섯째 단추, 아니면 null */
function frontTail(extra) {
    const kids = extra?.children;
    if (!kids || kids.length < NAMES.length) return null;
    for (let i = 0; i < NAMES.length; i++) if (!kids[i].classList.contains(NAMES[i])) return null;
    return kids[NAMES.length - 1];
}
/**
 * 틀에서 번역 단추째 복제돼 왔고 번역 쪽 감시가 아직 자리를 확인하지 않은 메시지면, 메뉴 맨 앞 여섯 개의 마지막 단추를 돌려줘요(그 뒤에 끼우면 예전 끝 차례와 같아요).
 * 이미 확인한 메시지 · 번역 단추가 맨 앞 여섯 개가 아닌 메시지 · 번역 단추가 없는 메시지는 null(예전처럼 맨 앞에 끼워요).
 */
export function pendingTail(mes, extra = mes?.querySelector?.('.extraMesButtons')) {
    if (!mes || typeof mes !== 'object' || settled.has(mes)) return null;
    return frontTail(extra);
}
// 다른 애드온(읽기 단추)이 번역 애드온 파일을 직접 가져오지 않고 묻는 다리 — 번역 애드온이 꺼져 있으면 자리도 없어요(그때는 틀에 번역 단추도 없어요)
export const TEMPLATED = Symbol.for('blue-lemonade.translator.templated');
try { globalThis[TEMPLATED] = Object.freeze({ pendingTail }); } catch { /* 얼린 전역 */ }

/** 이 메시지에 단추를 직접 끼웠을 때 — 다시 자리를 보지 않게 적어 둬요 */
export function markSettled(mes) { if (mes && typeof mes === 'object') settled.add(mes); }

/**
 * 단추를 이미 달고 붙은 메시지(틀에서 복제)를 처음 볼 때: 여섯 개가 메뉴 맨 앞 · 제 차례가 아니면 맨 앞으로 옮겨요.
 * 돌려줌: 처음 본 메시지이고 메뉴에 여섯 개가 다 있으면 true(본체가 번역 점검 표시를 칠할 때) — 이미 본 메시지 · 단추가 메뉴 밖으로 나간(꺼내 둔) 메시지는 false
 */
export function settleTemplated(mes) {
    if (!mes || typeof mes !== 'object' || settled.has(mes)) return false;
    settled.add(mes);
    const extra = mes.querySelector?.('.extraMesButtons');
    if (!extra) return false;
    if (frontTail(extra)) return true;
    const six = NAMES.map(name => extra.querySelector(`:scope > .${name}`));
    if (!six.every(Boolean)) return false;
    extra.prepend(...six);
    return true;
}
