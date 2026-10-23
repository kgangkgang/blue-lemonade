// 7.7.9 안내 팝업 지킴이 — 테마가 여는 「닫기」 하나짜리 안내 창(공지 · 도움말 · 요청 로그 · 모델 등록 …)에 실리태번 판에 따라 「취소」가 같이 뜨고,
// 그 취소 때문에 danger.js 가 확인 창으로 보고 「닫기」를 빨갛게 칠하던 문제(사용자 폰 ST 10-23, 7.7.8 설치 뒤 사진).
// 실리태번 popup.js 의 TEXT 형식은 cancelButton 이 없으면 취소를 숨기지만, 폰에 깔린 다른 판(옛 callPopup 호환 경로)은 그 옵션을 무시했다.
// 그래서 옵션에 기대지 않고: (1) 테마가 연 안내 창은 onOpen 에서 취소 단추를 직접 숨기고 bl-info-dialog 를 붙인다(hardenInfoPopup),
// (2) 전역 감시: 새로 뜬 dialog.popup 의 확인 글자가 「닫기」인데 취소가 보이면(입력칸 없음) 같은 처리 — 호출 경로를 못 고친 판에서도 「닫기」 하나.
// (3) 확인 단추에는 bl-info-ok 를 붙여 03-menus 가 테마 포인트 색을 !important 로 고정한다(실리태번 기본 crimson 이 안 보이게).
// 또 시작 때 실리태번 판(/version)을 콘솔에 한 번 남겨 다음에 사용자 폰 ST 판을 알 수 있게 한다.
const INFO_OK = /^(닫기|확인|close|ok|okay)$/i;
let observer = null, logged = false;

function visible(el) { return !!el && el.style.display !== 'none' && !el.hidden && el.getClientRects().length > 0; }

/** 안내 창으로 굳히기: 취소 숨김 · 확인 단추 테마 색 · 클래스. popup 은 실리태번 Popup 인스턴스이거나 dialog 요소 */
export function hardenInfoPopup(popup) {
    const dlg = popup?.dlg || (popup instanceof Element ? popup : null) || document.querySelector('dialog.popup[open]:last-of-type');
    if (!dlg) return null;
    dlg.classList.add('bl-info-dialog'); dlg.classList.remove('salty-danger-confirm');
    for (const cancel of dlg.querySelectorAll('.popup-button-cancel')) { cancel.style.display = 'none'; cancel.hidden = true; cancel.setAttribute('aria-hidden', 'true'); cancel.tabIndex = -1; }
    for (const ok of dlg.querySelectorAll('.popup-button-ok')) { ok.classList.add('bl-info-ok'); ok.classList.remove('redWarningBG'); }
    // 판에 따라 show() 뒤에 단추를 다시 그리는 경우 — 잠깐 지켜보고 한 번 더
    const again = new MutationObserver(() => { for (const c of dlg.querySelectorAll('.popup-button-cancel')) if (visible(c)) { c.style.display = 'none'; c.hidden = true; } });
    again.observe(dlg, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    setTimeout(() => again.disconnect(), 2000);
    return dlg;
}

function check(dlg, tries = 0) {
    if (!(dlg instanceof Element) || !dlg.matches('dialog.popup') || dlg.classList.contains('bl-info-dialog')) return;
    // 7.8.0: 실리태번은 dialog 를 붙인 뒤 showModal 한다 — 붙는 순간엔 단추 상자가 없어 「안 보임」으로 보고 지나치던 것. 열릴 때까지 몇 프레임 기다린다
    if (!dlg.open) { if (tries < 30) requestAnimationFrame(() => check(dlg, tries + 1)); return; }
    const ok = dlg.querySelector('.popup-button-ok'), cancel = dlg.querySelector('.popup-button-cancel');
    if (!ok || !cancel || !visible(cancel)) return;
    if (!INFO_OK.test((ok.textContent || '').trim())) return;
    if (dlg.querySelector('.popup-input:not([style*="display: none"]), textarea, input[type="text"], input[type="checkbox"], input[type="radio"], select')) return; // 묻는 창은 그대로
    hardenInfoPopup(dlg);
}

export function startPopupGuard() {
    globalThis.BlueLemonadeHardenPopup = hardenInfoPopup;
    if (observer) return;
    observer = new MutationObserver(records => {
        for (const r of records) for (const node of r.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches('dialog.popup')) queueMicrotask(() => check(node));
            else for (const d of node.querySelectorAll?.('dialog.popup') || []) queueMicrotask(() => check(d));
        }
    });
    observer.observe(document.body, { childList: true, subtree: false });
    if (!logged) {
        logged = true;
        fetch('/version').then(r => r.ok ? r.json() : null).then(v => { if (v) { globalThis.BlueLemonadeHost = v; console.info('[Blue Lemonade] SillyTavern', v.pkgVersion || '?', v.gitBranch || '', String(v.gitRevision || '').slice(0, 7)); } }).catch(() => {});
    }
}
