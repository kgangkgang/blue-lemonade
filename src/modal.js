import { fixToastrForDialogs } from '../../../../popup.js';

/** Keep notifications in the modal top layer, and recover them before removal. */
export function showThemeModal(dialog) {
    // Capture runs before the existing close handlers that remove the dialog.
    const closed = () => {
        const container = dialog.querySelector('#toast-container');
        if (container) document.body.append(container);
        fixToastrForDialogs();
    };
    dialog.addEventListener('close', closed, {capture:true, once:true});
    // 7.0.2 실리태번은 html 의 touchstart · mousedown 으로 「서랍 밖을 눌렀다」를 보고 열린 서랍(확장 서랍 등)을 닫는다.
    // 테마 창은 body 에 붙어 서랍 밖으로 보이므로, 서랍 안 애드온에서 연 창(고르기 창 · 사용방법 · 효과음 보관함 · 대본 편집)을 누르면 뒤 서랍이 닫혔다 → 창 밖으로 올리지 않는다.
    // 테마의 문서 쪽 누름 처리(selects.js)는 capture 단계라 영향 없음. 바깥(backdrop)을 눌러 닫는 처리는 click 이라 그대로
    if (!dialog._blDrawerGuard) {
        dialog._blDrawerGuard = true;
        for (const type of ['touchstart', 'mousedown']) dialog.addEventListener(type, event => event.stopPropagation(), {passive:true});
    }
    try { dialog.showModal(); }
    catch (error) { dialog.removeEventListener('close',closed,true); throw error; }
    fixToastrForDialogs();
}
