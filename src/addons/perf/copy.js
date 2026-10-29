// 8.2.7 폰 예측점검(hunt-mobile): 글 복사. http:// 로 연 폰(LAN 접속)은 보안 컨텍스트가 아니라 navigator.clipboard 가 없어요 —
//   요청 기록 · 로드 시간 「복사」가 늘 「복사하지 못했어요」로 끝났어요. 그때는 옛 복사 명령(execCommand)으로 대신해요.
//   글 칸은 열린 창(dialog) 안에 붙여요: showModal 창이 떠 있으면 창 밖(body)은 inert 라 골라지지 않아 빈 글만 복사돼요(에셋 · 도우미 복사와 같은 방식).
/** 복사했으면 true */
export async function copyPlain(text, doc = document, nav = globalThis.navigator) {
    try { if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(text); return true; } } catch { /* 아래 옛 방식 */ }
    const back = doc.activeElement;
    const host = back?.closest?.('dialog[open]') || [...doc.querySelectorAll('dialog[open]')].pop() || doc.body;
    const area = doc.createElement('textarea');
    area.value = text; area.readOnly = true;
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    host.append(area);
    let ok = false;
    try {
        area.focus?.({ preventScroll: true });
        area.select(); area.setSelectionRange?.(0, area.value.length);   // iOS 는 readOnly 칸에서 select() 만으로 안 골라질 때가 있어요
        ok = doc.execCommand('copy') === true;
    } catch { ok = false; }
    finally { area.remove(); if (back?.isConnected) back.focus?.({ preventScroll: true }); }
    return ok;
}
