// 1.9.x 미트볼 「화면만 번역」에서 닫힌 고르개(<select>)의 고른 값 글 — 그 확장의 화면 번역은 <option> 글을 건너뛰어서, 펼친 목록(테마가 그리는 목록 팝업 · 그 확장 화면 안이라 번역됨)은
//   한국어인데 닫힌 고르개는 저장값 그대로 영어였어요(퀘스트 「완료 판정」 능력치 「Charm +2」). 값(value 속성)이 따로 있는 option 의 보이는 글만 그 확장 사전(trString)으로 바꿔요.
//   AI 요청 0(이미 있는 사전만) · 값 · 저장 자료는 그대로 · 화면만 번역이 꺼지면 원래 글로 되돌려요. 그 확장이 고르개를 다시 그리면(값 바꿈 · 탭 바꿈 · 창 다시 열기) 다시 적어요.
const SCOPE = 'dialog.ss-dlg select, .ss-root select, #ss-hud select';
const LATIN = /[A-Za-z]{2,}/;
const srcOf = new WeakMap();   // option → { src: 원래 글, out: 바꿔 적은 글 }

/** 순수에 가까움: root 아래 그 확장 고르개의 option 글을 trs(글) 로. on=false 면 되돌려요. 바꾼 수를 돌려줘요 */
export function trOptions(root, trs, on = true) {
    let n = 0;
    for (const sel of root?.querySelectorAll?.(SCOPE) || []) {
        for (const opt of sel.options || []) {
            if (!opt.hasAttribute?.('value')) continue;   // 값이 글에서 나오는 option 은 글을 바꾸면 값이 바뀌어요
            const now = opt.textContent;
            const was = srcOf.get(opt);
            const src = was && was.out === now ? was.src : now;
            let out = src;
            if (on && LATIN.test(src)) { try { out = String(trs(src) ?? src); } catch { out = src; } }
            if (out !== src) srcOf.set(opt, { src, out }); else if (was) srcOf.delete(opt);
            if (out !== now) { opt.textContent = out; n++; }
        }
    }
    return n;
}

/** 그 확장 화면에서 누름 · 값 바꿈 뒤(그 확장이 다시 그린 다음) 다시 적는 고리 — 감시자를 새로 걸지 않아요 */
export function watchSelectTr(doc, { trs, on, timer = globalThis.setTimeout } = {}) {
    if (!doc?.addEventListener || typeof trs !== 'function') return () => 0;
    const run = () => { try { return trOptions(doc, trs, typeof on === 'function' ? !!on() : true); } catch { return 0; } };
    let pending = 0;
    const soon = () => { if (pending) return; pending = 1; timer(() => { pending = 0; run(); }, 80); timer(run, 500); };
    const mine = e => { const t = e?.target; return !!t?.closest?.('dialog.ss-dlg, .ss-root, #ss-hud, #ss-settings'); };
    doc.addEventListener('click', e => { if (mine(e)) soon(); }, true);
    doc.addEventListener('change', e => { if (mine(e)) soon(); }, true);
    return Object.assign(run, { soon });
}

/** 1.9.x 환영 화면 표식 — 열린 채팅이 없으면 body 에 bl-mb-welcome(그 확장이 환영 메시지에 다는 앞 채팅 칩을 CSS 가 가려요 · src/ext-status.css). 채팅이 바뀔 때만 불러요 */
export function markWelcome(doc, chatId) {
    const welcome = chatId === undefined || chatId === null || chatId === '';
    try { doc?.body?.classList?.toggle('bl-mb-welcome', welcome); } catch { /* 표식 없이 */ }
    return welcome;
}
