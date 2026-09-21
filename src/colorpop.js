// 색 칸 갈고리 (3.5.0) — 실리태번 · 확장의 색 칸(toolcool-color-picker · input[type=color])을 누르면
// 원래 팝업(toolcool 은 칸 옆 고정 위치라 폰에서 화면 밖으로 잘림 · OS 색 창) 대신 테마 색 고르기(colorpick.js)를 띄운다.
// 고른 색은 원래 칸에 넣고 이벤트를 쏘아 실리태번 핸들러가 그대로 돈다:
//   toolcool — picker.color = 값 → 부품이 change(detail.rgba) 를 쏨 · input[type=color] — value + input, 닫을 때 change.
// 테마 설정 창 안의 색 칸은 늘, 밖은 chat.colorPop 이 켜져 있을 때만 (끄면 원래 팝업).
import { getSettings } from './settings.js';

let picker = null; // colorpick.js (처음 누를 때 불러옴)

function target(e) {
    if (!document.body.classList.contains('salty')) return null;
    const el = e.target;
    if (!(el instanceof Element)) return null;
    const tc = el.closest('toolcool-color-picker');
    const native = !tc && el.matches('input[type="color"]') ? el : null;
    const found = tc || native;
    if (!found || found.disabled || found.closest('.bl-cp-layer')) return null;
    if (!found.closest('.salty-panel') && getSettings().chat?.colorPop === false) return null;
    return found;
}

async function open(el) {
    picker ||= await import('./colorpick.js');
    if (el.tagName === 'TOOLCOOL-COLOR-PICKER') {
        picker.openColorPick({
            anchor: el,
            value: el.rgba || el.getAttribute('color') || '#000000',
            alpha: true,
            onInput: (css) => {
                el._armed = true; // 설정 창 색 칸은 사용자가 만진 뒤의 change 만 저장 (panel.js)
                el.color = css;
            },
        });
        return;
    }
    picker.openColorPick({
        anchor: el,
        value: el.value || '#000000',
        alpha: false,
        onInput: (css) => {
            el.value = css.slice(0, 7).toLowerCase();
            el.dispatchEvent(new Event('input', { bubbles: true }));
        },
        onClose: (changed) => {
            if (changed) el.dispatchEvent(new Event('change', { bubbles: true }));
        },
    });
}

export function startColorPop() {
    // toolcool 은 속 단추의 click 에서 팝업을 토글하고, OS 색 창도 click 에서 열린다 → 문서 캡처 단계에서 막으면 둘 다 안 열림
    document.addEventListener('click', (e) => {
        const el = target(e);
        if (el) {
            e.preventDefault();
            e.stopPropagation();
            open(el).catch((error) => console.warn('[블루 레몬에이드] 색 고르기를 못 띄움', error));
            return;
        }
        // 연 직후 · 바깥을 눌러 닫은 직후의 click 은 삼킨다 (뒤 단추가 눌리거나 실리태번이 서랍을 닫지 않게)
        if (picker?.colorPickPhantom(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // 키보드(Enter · Space)도 click 으로 들어온다. 뒤가 굴러가면 칸과 떨어지니 닫음 (연 직후는 봐줌 — 폰 주소창 · 부드러운 스크롤)
    document.addEventListener('scroll', (e) => {
        if (!picker?.isColorPickOpen() || (e.target instanceof Element && e.target.closest('.bl-cp-layer')) || picker.colorPickAge() <= 700) return;
        // 4.1.2: 색 코드 칸을 누르면 폰은 자판을 올리면서 그 칸이 보이게 뒤 화면을 굴린다 — 그 스크롤에 창이 꺼져 코드를 칠 수 없었다 (사용자 제보).
        // 코드 칸에 글을 치는 중이면 닫지 않고 자리만 다시 잡는다.
        if (document.activeElement instanceof Element && document.activeElement.closest('.bl-cp-layer input')) { picker.repositionColorPick(); return; }
        picker.closeColorPick();
    }, true);
}
