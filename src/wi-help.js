// 월드인포 설정 「?」 도움말 (6.1.5). 전역 설정 칸과 항목 틀(#entry_edit_template)에 작은 ? 단추를 한 번 붙인다.
// 항목은 실리태번이 그 틀을 복제해 그리므로 틀에 한 번 붙이면 모든 항목에 생기고, 항목마다 JS 가 돌지 않는다.
// ? 는 <label> · 펼치기 머리줄 안에 있으므로 누름은 window 캡처 단계에서 가로채 체크박스 · 펼치기로 번지지 않게 한다.
import { openHelpSheet } from './help-sheet.js';
import { WI_HELP, GLOBAL_ANCHORS, ENTRY_ANCHORS } from './wi-help-data.js';

let started = false;

function makeButton(id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bl-wi-help';
    button.dataset.blWiHelp = id;
    button.setAttribute('aria-label', `${WI_HELP[id].title} 도움말`);
    button.textContent = '?';
    return button;
}

/** root 안의 붙일 곳마다 ? 를 하나씩 (이미 있으면 건너뜀). 붙인 개수 */
export function placeHelpButtons(root, anchors) {
    if (!root) return 0;
    let placed = 0;
    for (const [selector, id, how] of anchors) {
        if (!WI_HELP[id]) continue;
        let target;
        try { target = root.querySelector(selector); } catch { continue; }
        if (!target) continue;   // 실리태번 판이 바뀌어 그 칸이 없으면 조용히 건너뜀
        const holder = how === 'append' ? target : target.parentElement;
        if (holder?.querySelector(`:scope > .bl-wi-help[data-bl-wi-help="${id}"]`)) continue;
        if (how === 'append') {
            // 실리태번 번역(한국어 UI 등)은 새로 붙은 [data-i18n] 칸의 textContent 를 다시 써서 안에 넣은 ? 를 지운다 → 글자 키를 안쪽 span 으로 옮긴다
            const key = target.getAttribute('data-i18n');
            if (key && !key.includes('[')) {
                const label = document.createElement('span');
                label.setAttribute('data-i18n', key);
                label.append(...target.childNodes);
                // 지우면 실리태번 i18n 관찰자가 속성이 사라진 것도 알려 와 getAttribute → null.split 로 터진다 (페이지를 열 때마다 오류 한 줄) → 빈 값으로 둔다
                target.setAttribute('data-i18n', '');
                target.append(label);
            }
            target.append(makeButton(id));
        } else target.after(makeButton(id));
        placed++;
    }
    return placed;
}

export function openWorldInfoHelp(id) {
    return openHelpSheet(WI_HELP[id]);
}

function onPress(event) {
    const button = event.target instanceof Element ? event.target.closest('.bl-wi-help') : null;
    if (!button) return;
    // <label> 안이면 체크박스가 바뀌고, 항목 머리줄이면 펼쳐지므로 여기서 멈춘다.
    // 기본 동작은 click 에서만 막는다 — touchstart 를 막으면 폰에서 click 자체가 안 온다
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.type !== 'click') return;
    event.preventDefault();
    openWorldInfoHelp(button.dataset.blWiHelp);
}

export function startWorldInfoHelp() {
    if (started) return;
    started = true;
    const place = () => {
        placeHelpButtons(document.getElementById('WorldInfo') || document.body, GLOBAL_ANCHORS);
        const template = document.getElementById('entry_edit_template');
        placeHelpButtons(template, ENTRY_ANCHORS);
        // 이미 그려져 있던 항목(시작할 때 월드인포 창이 열려 있던 경우)에도 한 번
        for (const entry of document.querySelectorAll('#world_popup_entries_list .world_entry')) placeHelpButtons(entry, ENTRY_ANCHORS.map(([s, id, how]) => [s.replace(/^\.world_entry(?:_edit)? /, ''), id, how]));
    };
    place();
    // 끌어 옮기기(정렬)가 누름을 잡기 전에 막는다 — click 은 열기, 나머지는 번짐만 막기
    for (const type of ['click', 'mousedown', 'pointerdown', 'touchstart']) window.addEventListener(type, onPress, { capture: true, passive: type !== 'click' });
}
