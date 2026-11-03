// 메시지 버튼 고정의 이름표 규칙 (9.0.9 통합에서 mes-pins.js 에서 뗐어요)
// 설정 정리(settings.js tidyPins)는 시작할 때(1층) 돌아요 — 예전엔 이 함수 하나 때문에 mes-pins.js 와 그 감시 허브(dom-watch.js)까지 시작 그래프에 끌려왔어요.
// 버튼을 옮기는 본체(mes-pins.js)는 features.js 가 첫 프레임 뒤(2층)에 받아요.
export const GENERIC = /^(mes_button|interactable|menu_button|fa|fa-.+|bl-.+|salty-.+)$/;
// 실리태번이 상태에 따라 둘 중 하나만 보여 주는 짝 — 앞의 것을 고르면 뒤의 것도 같이 옮긴다
export const PAIRS = { mes_hide: ['mes_unhide'], mes_media_gallery: ['mes_media_list'] };
export const PAIRED = new Set(Object.values(PAIRS).flat());
export const PIN_LIMIT = 12;
// 1.0.0 후보: 고정해 둔 단추가 지금 채팅에서 안 잡힐 때(그 확장이 아직 안 붙였거나 꺼짐) 고르기 목록에 쓸 이름 · 아이콘 — 열쇠 이름(mes_legacy_translate) · ? 아이콘이 그대로 보이지 않게.
//   테마가 메시지 메뉴에 넣는 단추만 적어요. 다른 확장 단추는 본 적 있는 이름을 기억해 두고(mes-pins.js), 그것도 없으면 「다른 확장 단추」예요.
export const KNOWN_PINS = {
    mes_legacy_translate: ['fa-solid fa-brain', 'LLM 번역 (기존)'],
    mes_llm_translate: ['fa-solid fa-right-left', 'LLM 번역/전환'],
    mes_toggle_original: ['fa-solid fa-magnifying-glass', '원문/번역 전환'],
    mes_edit_translation: ['fa-solid fa-pen-to-square', '번역문 수정'],
    mes_paragraph_correction: ['fa-solid fa-wrench', '문단 수 교정'],
    mes_delete_translation: ['fa-solid fa-trash', '번역문 삭제'],
    lv_play: ['fa-solid fa-volume-high', '읽기'],
    lv_script: ['fa-solid fa-file-audio', '소리 대본 편집'],
    mes_dialogue_only: ['fa-solid fa-comments', '대사만 보기'],
};

export function tidyPins(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const key of list) {
        if (typeof key !== 'string' || !/^[A-Za-z_][\w-]{0,63}$/.test(key) || GENERIC.test(key) || PAIRED.has(key) || out.includes(key)) continue;
        out.push(key);
        if (out.length >= PIN_LIMIT) break;
    }
    return out;
}
