// 1.6.6 미트볼 「한국어로 저장된 칸을 영어 저장으로 바꾸기」 를 묻지 않고 바로 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   사용자(11-17): 「미트볼 이 팝업 좀 안 뜨게 해 줘. 자동으로 항상 네 상태로」
//   그 확장(2.8.0 src/translate.js convertToEnglish)은 바꾸기 전에 늘 SillyTavern.getContext().Popup.show.confirm(제목, 글)로 물어요 — 묻지 않는 설정 · 내보낸 함수가 없어요
//   (설정 칸 단추 · 「상태창 전체 번역」 · 채팅을 열 때 뜨는 「여기를 누르면 영어 저장으로 바꿔요」 알림, 세 길 모두 같은 창이에요).
//   하는 일: getContext 가 돌려준 문맥 객체(부를 때마다 새로 만들어요)의 Popup 만 얹은 객체로 바꿔요. 그 창 — 제목 「미트볼 상태창」 + 글이 「한국어로 저장된 N칸을 영어 저장으로 바꿔요」 로
//   시작하고 /ss-undo 를 말하는 것 — 일 때만 창을 띄우지 않고 「네」(AFFIRMATIVE)를 돌려주고, 바꾸는 중이라는 알림 한 줄을 띄워요.
//   다른 창 · 다른 확장 · 실리태번 공용 Popup 은 그대로예요(공용 객체는 고치지 않아요). 창 다음부터는 그 확장이 똑같이 돌아요 —
//   다시 누르면 멈추기 · 번역 모델 횟수 · 칸마다 「되돌리기」(/ss-undo)는 그 확장 것 그대로예요.
//   설정: 테마 설정 「미트볼 영어 저장 전환 바로 하기」(chat.mbAutoEn · 기본 켬) → src/apply.js 가 body 표식 data-bl-mb-auto-en="on|off" — 끄면 예전처럼 물어요(누를 때마다 표식을 봐요).
//   감시자 · 타이머 없음. getContext 감싸개는 한 번만 걸고 걷지 않아요(끈 동안에는 받은 그대로 넘겨요). 시험: tools/tests/mb-auto-en.mjs

const MARK = Symbol.for('blue-lemonade.mb-auto-en.v1');
export const TITLE = '미트볼 상태창';
const HEAD = /^\s*한국어로 저장된 (\d+)칸을 영어 저장으로 바꿔요(?:\s*\((.*?)\)\.?\s*(?:<br\s*\/?>|$))?/;
const unescape = text => String(text || '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').trim();

/** 그 창인가 → { count, who } 또는 null. 제목 · 첫 문장 · 되돌리기 안내가 모두 맞을 때만 */
export function matchAsk(header, text) {
    if (header !== TITLE || typeof text !== 'string' || !text.includes('ss-undo')) return null;
    const m = HEAD.exec(text);
    if (!m) return null;
    return { count: Number(m[1]), who: unescape(m[2]).slice(0, 60) };
}
/** 바로 할 때 띄우는 알림 한 줄 */
export function noticeText({ count, who } = {}) {
    return `한국어로 저장된 ${count}칸을 영어 저장으로 바꾸는 중이에요${who ? ` (${who})` : ''}. 멈추려면 그 단추를 한 번 더 누르고, 되돌리기는 칸마다 /ss-undo 예요.`;
}
const defaultNotify = hit => { try { globalThis.toastr?.info?.(noticeText(hit), TITLE, { timeOut: 7000 }); } catch { /* 알림 없이 */ } };

/** 그 확장이 받는 Popup — 원래 클래스를 감싼 Proxy(만들기 · 다른 static 은 그대로), show 만 confirm 을 얹은 객체(나머지 창 종류는 원래 것) */
function makeDresser({ on, notify }) {
    const facades = new WeakMap(), proxies = new WeakMap();
    const facadeOf = (show, yes) => {
        let facade = facades.get(show);
        if (facade) return facade;
        facade = Object.create(show, { confirm: { configurable: true, writable: true, value: function blMbAutoEnConfirm(header, text, ...rest) {
            let hit = null;
            try { hit = on() ? matchAsk(header, text) : null; } catch { hit = null; }
            if (!hit) return show.confirm(header, text, ...rest);
            try { notify(hit); } catch { /* 알림만 */ }
            return Promise.resolve(yes);
        } } });
        facades.set(show, facade);
        return facade;
    };
    return c => {
        const P = c?.Popup;
        if (!P || (typeof P !== 'function' && typeof P !== 'object') || P[MARK]) return;
        if (!P.show || typeof P.show.confirm !== 'function') return;
        const yes = c.POPUP_RESULT?.AFFIRMATIVE ?? 1;
        let proxy = proxies.get(P);
        if (!proxy) {
            proxy = new Proxy(P, { get(target, key) {
                if (key === MARK) return true;
                const value = Reflect.get(target, key, target);
                return key === 'show' && value && typeof value.confirm === 'function' ? facadeOf(value, yes) : value;
            } });
            proxies.set(P, proxy);
        }
        c.Popup = proxy;
    };
}

let installed = false;
/** 한 번만 걸어요. 시험은 host(가짜 SillyTavern) · doc(표식을 읽을 문서) · notify(알림)를 넣어요 */
export function startMbAutoEn({ host = () => globalThis.SillyTavern, doc = globalThis.document, notify = defaultNotify, force = false } = {}) {
    if (installed && !force) return false;
    const holder = host();
    if (!holder || typeof holder.getContext !== 'function') return false;
    if (holder.getContext[MARK]) return false;
    const on = () => doc?.body?.getAttribute?.('data-bl-mb-auto-en') === 'on';
    const dress = makeDresser({ on, notify });
    const inner = holder.getContext;
    const outer = function (...args) {
        const c = inner.apply(this, args);
        if (c && on()) { try { dress(c); } catch { /* 받은 그대로 */ } }
        return c;
    };
    // 이름은 안쪽 함수 것 그대로 — 성능 보조 애드온 · 기능 다리(src/ext-bridge.js)의 감싸개와 겹쳐도 되게(그쪽이 이름으로 「이미 감쌌나」를 봐요)
    try { Object.defineProperty(outer, 'name', { value: inner.name, configurable: true }); } catch { /* 이름 없이 */ }
    outer[MARK] = true;
    holder.getContext = outer;
    installed = true;
    return true;
}
