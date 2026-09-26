// 눈 아이콘 길게 누르기: 꺼내기(꺼낸 눈이면 넣기) · 접기(접힌 글이면 펼치기) 두 줄을 띄운다.
// mes-pins.js 가 눈(.mes_hide · .mes_unhide)을 길게 누를 때만 불러온다 — 시작할 때 읽는 파일이 아니다.
//
// 접기 = 실리태번 눈과 같은 숨기기(is_system) + 보이는 글을 제목 없는 접기 칸 <details><summary></summary> 로 감싸기.
// 번역문(extra.display_text)이 있으면 번역문만 감싸고 본문(mes)은 그대로 둔다 — 본문이 바뀌면 번역기가 원문이 바뀐 줄
// 알고(original_text_hash) 스와이프로 돌아올 때 번역문을 지운다. 번역문이 없으면 본문을 감싼다.
// 이벤트(MESSAGE_UPDATED · MESSAGE_EDITED)는 쏘지 않는다: 실리태번 기본 번역 확장은 그 이벤트에 display_text 를 지우고,
// 내장 번역기도 원문 비교를 다시 한다. 다시 그리기는 updateMessageBlock, 저장은 hideChatMessageRange 가 한 번 한다.

// 감싸는 틀: 빈 줄을 두어야 첫 문단부터 <p> 로 그려진다 (한 줄 틀은 첫 문단이 <br> 붙은 맨 글자로 남았다)
const HEAD = '<details><summary></summary>\n\n', TAIL = '\n\n</details>';
const OPEN = /^\s*<details\s*>\s*<summary\s*>\s*<\/summary\s*>/i;
const CLOSE = /<\/details\s*>\s*$/i;

export const wrapFold = (text) => HEAD + String(text ?? '') + TAIL;

/** 통째로 감싼 빈 제목 접기 칸이면 안쪽 글, 아니면 null. 손으로 감싼 한 줄 틀도 알아본다 —
 *  첫 <details> 의 짝이 맨 끝 </details> 여야 한다 (제목 있는 카드 · 클래스 달린 번역기 칸은 아님) */
export function unwrapFold(text) {
    const s = String(text ?? '');
    // 우리가 쓴 틀 그대로면 짝 세기 전에 바로 — 안쪽에 닫히지 않은 <details>(끊긴 답의 상태창 · 코드 속 태그)가 있으면
    // 짝 세기가 실패해 접힌 글을 못 알아보고 한 겹 더 감쌌다 (검증에서 확인)
    if (s.startsWith(HEAD) && s.endsWith(TAIL) && s.length >= HEAD.length + TAIL.length) return s.slice(HEAD.length, s.length - TAIL.length);
    const head = s.match(OPEN), tail = s.match(CLOSE);
    if (!head || !tail) return null;
    let depth = 0, end = -1;
    for (const m of s.matchAll(/<(\/?)details\b[^>]*>/gi)) {
        depth += m[1] ? -1 : 1;
        if (depth === 0) { end = m.index; break; }
    }
    if (end !== tail.index) return null;
    return s.slice(head[0].length, tail.index).replace(/^[ \t]*\r?\n/, '').replace(/\r?\n[ \t]*$/, '');
}

/** 화면에 보이는 글이 번역문인가 (실리태번이 그리는 것과 같게: display_text ?? mes) */
const translated = (message) => message?.extra?.display_text != null;

export function isFolded(message) {
    return unwrapFold(translated(message) ? message.extra.display_text : message?.mes) !== null;
}

/** 글만 바꾼다 (저장 · 다시 그리기는 부른 쪽). 번역문이 있으면 번역문과 '원문 보기' 때 치워 둔 번역문, 없으면 본문 */
export function rewriteFold(message, fold) {
    const extra = message.extra;
    const slots = translated(message) ? [[extra, 'display_text'], [extra, 'original_translation_backup']] : [[message, 'mes']];
    for (const [owner, key] of slots) {
        if (typeof owner[key] !== 'string') continue;
        const inner = unwrapFold(owner[key]);
        if (fold && inner === null) owner[key] = wrapFold(owner[key]);
        else if (!fold && inner !== null) owner[key] = inner;
    }
    // 펼칠 때: 번역하기 전에 접어 둔 본문(우리 틀 그대로)도 벗긴다 — 번역문만 보고 풀면 본문에 틀이 남아 숨김을 풀었을 때 프롬프트로 갔다
    if (!fold && translated(message) && typeof message.mes === 'string' && message.mes.startsWith(HEAD) && message.mes.endsWith(TAIL)) {
        message.mes = message.mes.slice(HEAD.length, message.mes.length - TAIL.length);
    }
}

/** 지금 그 메시지를 다시 그리면 안 되는 때: 답이 들어오는 마지막 메시지 · 고치는 중인 메시지 */
function busyMessage(mes, id, ctx) {
    if (document.body.dataset.generating === 'true' && id >= (ctx.chat?.length || 0) - 1) return true;
    return !!mes.querySelector('.edit_textarea');
}

let running = false;
async function applyFold(target, fold) {
    if (running) return;
    running = true;
    try {
        // 실리태번 본체 함수: 숨기기(chats.js) · 스와이프 사본 맞추기(script.js). 이미 읽힌 모듈이라 바로 온다
        const [core, chats] = await Promise.all([
            import('../../../../../script.js').catch(() => null),
            import('../../../../chats.js').catch(() => null),
        ]);
        const ctx = SillyTavern.getContext();
        const id = Number(target.mes.getAttribute('mesid'));
        const message = ctx.chat?.[id];
        // 고르는 사이 채팅 · 메시지가 바뀌었으면 아무것도 안 한다
        if (!target.mes.isConnected || message !== target.message || ctx.getCurrentChatId?.() !== target.chatId || busyMessage(target.mes, id, ctx)) return;
        // 접기 전에 이미 숨긴 메시지(일부러 숨긴 글 · 시스템 메모)면 펼쳐도 숨긴 채로 둔다
        message.extra ??= {};
        const keepHidden = fold ? false : !!message.extra.bl_fold_was_hidden;
        if (fold) { if (message.is_system) message.extra.bl_fold_was_hidden = true; }
        else delete message.extra.bl_fold_was_hidden;
        rewriteFold(message, fold);
        // 스와이프 사본도 같이 — 안 하면 옆 스와이프에 갔다 오면 감싸기 전 글이 돌아온다
        try { core?.syncMesToSwipe?.(id); } catch (error) { console.warn('[Blue Lemonade] 접기: 스와이프 사본', error); }
        ctx.updateMessageBlock(id, message);
        if (keepHidden) {
            await ctx.saveChat(); // 숨김은 그대로 · 글만 풀었으니 저장만
        } else if (typeof chats?.hideChatMessageRange === 'function') {
            await chats.hideChatMessageRange(id, id, !fold);
        } else {
            // 실리태번 모듈을 못 읽은 경우: 눈 버튼이 하는 일을 그대로
            message.is_system = fold;
            target.mes.setAttribute('is_system', String(fold));
            ctx.swipe?.refresh?.();
            await ctx.saveChat();
        }
    } catch (error) {
        console.warn('[Blue Lemonade] 접기', error);
        globalThis.toastr?.warning(fold ? '접지 못했어요' : '펼치지 못했어요', 'Blue Lemonade');
    } finally {
        running = false;
    }
}

// ── 고르기 창 ── 고르기 목록 팝업(selects.js)과 같은 모양(.salty-pick-float). ··· 메뉴가 최상위 층(popover)에 떠 있으므로
// 이 창도 popover 로 띄워야 메뉴 위에 보인다 (z-index 로는 최상위 층을 못 넘는다)
let current = null;

function viewport() {
    const vv = window.visualViewport;
    if (vv && vv.height > 0) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

// 자리: 누른 버튼 바로 위(손가락에 안 가리게), 위가 모자라면 아래. 좌우는 버튼 가운데에 맞추고 화면 안으로
function place(box, anchor) {
    const r = anchor.getBoundingClientRect();
    const v = viewport();
    const gap = 8, edge = 8;
    const w = box.offsetWidth, h = box.offsetHeight;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, v.x + edge), v.x + v.w - w - edge);
    const up = r.top - gap - h >= v.y + edge;
    const top = Math.min(Math.max(up ? r.top - gap - h : r.bottom + gap, v.y + edge), Math.max(v.y + edge, v.y + v.h - edge - h));
    box.classList.toggle('up', up);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
}

export function closeEyeChoice() {
    if (!current) return;
    const { layer, off } = current;
    current = null;
    off();
    try { if (layer.matches(':popover-open')) layer.hidePopover(); } catch { /* popover 를 모르는 브라우저 */ }
    layer.remove();
}

// 누름 하나에 딸린 click 을 한 번 삼킨다 — 창을 띄운 길게 누르기를 뗄 때 · 바깥을 눌러 닫을 때.
// 손가락을 떼는 자리에는 이제 창(층)이 있어 그 click 이 '··· 메뉴 밖 click' 으로 보여 메뉴가 닫혔다 (lite.js 가
// 문서 click 을 먼저 봄 → mes-pins.js 의 막기보다 앞). 그래서 window 에서 먼저 막는다.
// 다음 누름 · 키가 시작되면 그 click 은 이미 왔거나 오지 않는다 — 그때 푼다 (폰은 길게 누른 뒤 click 을 건너뛰기도 함).
// 스크립트가 부른 click(.click() · jQuery trigger)은 손이 한 것이 아니므로 건드리지 않는다
function swallowNextClick(ms) {
    const eat = (event) => { if (!event.isTrusted) return; event.preventDefault(); event.stopPropagation(); done(); };
    const done = () => {
        clearTimeout(timer);
        window.removeEventListener('click', eat, true);
        window.removeEventListener('pointerdown', done, true);
        window.removeEventListener('keydown', done, true);
    };
    const timer = setTimeout(done, ms);
    window.addEventListener('click', eat, true);
    window.addEventListener('pointerdown', done, true);
    window.addEventListener('keydown', done, true);
}

/** mes-pins.js 가 눈을 길게 누르면 부른다. pin = 기존 꺼내기 · 넣기 (togglePin) */
export function openEyeChoice(button, pin) {
    closeEyeChoice();
    const mes = button.closest('.mes');
    const ctx = SillyTavern.getContext();
    const id = Number(mes?.getAttribute('mesid'));
    const message = mes ? ctx.chat?.[id] : null;
    const folded = !!message && isFolded(message);
    const target = { mes, message, chatId: ctx.getCurrentChatId?.() };
    const layer = document.createElement('div');
    layer.className = 'salty-pick-layer bl-eye-layer';
    // 화면 전체를 덮는 투명 층 (selects.js 와 같은 까닭으로 크기는 화면 단위로 직접). popover 의 기본 모양(테두리 · 바탕 · 여백)은 지운다
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh;margin:0;padding:0;border:0;overflow:visible;max-width:none;max-height:none;background:transparent;color:inherit';
    layer.innerHTML = `<div class="salty-pick salty-pick-float bl-eye-pick" role="menu"><div class="salty-pick-rows">
        <button type="button" role="menuitem" data-act="pin"><span>${button.classList.contains('bl-pinned') ? '넣기' : '꺼내기'}</span></button>
        <button type="button" role="menuitem" data-act="fold"${!message || busyMessage(mes, id, ctx) ? ' disabled' : ''}><span>${folded ? '펼치기' : '접기'}</span></button>
    </div></div>`;
    const box = layer.firstElementChild;
    // 바깥(투명 층)을 누르면 닫힘
    layer.addEventListener('pointerdown', (event) => {
        if (event.target !== layer) return;
        event.preventDefault();
        closeEyeChoice();
        swallowNextClick(1000);
    });
    // 층 안의 누름은 문서로 올려 보내지 않는다 — 실리태번이 html 의 touchstart · mousedown 으로 열린 서랍을 닫는다
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) layer.addEventListener(type, (event) => event.stopPropagation());
    // 고른 click 은 문서까지 올려 보낸다 — 실리태번이 '메뉴 밖 click' 으로 열린 ··· 메뉴를 닫는다 (늘 펼침 모드는 그대로)
    layer.addEventListener('click', (event) => {
        const btn = event.target.closest?.('button[data-act]');
        if (!btn || btn.disabled) { event.stopPropagation(); return; }
        closeEyeChoice();
        if (btn.dataset.act === 'pin') pin();
        else applyFold(target, !folded);
    });
    const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeEyeChoice(); } };
    // 폰을 돌리면(너비가 바뀌면) 닫는다 — 높이만 바뀌는 건(주소창 · 자판) 자리만 다시
    const width = window.innerWidth;
    const onResize = () => { if (window.innerWidth !== width || !button.isConnected) closeEyeChoice(); else place(box, button); };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    current = { layer, off: () => { document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); } };
    // 아직 누르고 있는 손가락(마우스)을 뗄 때의 click — 창 위에 떨어져 뒤의 ··· 메뉴를 닫지 않게
    swallowNextClick(1500);
    document.body.append(layer);
    if (typeof layer.showPopover === 'function') {
        try { layer.setAttribute('popover', 'manual'); layer.showPopover(); } catch { layer.removeAttribute('popover'); }
    }
    place(box, button);
}
