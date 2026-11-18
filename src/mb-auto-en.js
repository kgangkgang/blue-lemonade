// 1.6.6 미트볼 「한국어로 저장된 칸을 영어 저장으로 바꾸기」 를 묻지 않고 바로 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   사용자(11-17): 「미트볼 이 팝업 좀 안 뜨게 해 줘. 자동으로 항상 네 상태로」
//   그 확장(2.8.0 src/translate.js convertToEnglish)은 바꾸기 전에 늘 SillyTavern.getContext().Popup.show.confirm(제목, 글)로 물어요 — 묻지 않는 설정 · 내보낸 함수가 없어요
//   (설정 칸 단추 · 「상태창 전체 번역」 · 채팅을 열 때 뜨는 「여기를 누르면 영어 저장으로 바꿔요」 알림, 세 길 모두 같은 창이에요).
//   하는 일: getContext 가 돌려준 문맥 객체(부를 때마다 새로 만들어요)의 Popup 만 얹은 객체로 바꿔요. 그 창 — 제목 「미트볼 상태창」 + 글이 「한국어로 저장된 N칸을 영어 저장으로 바꿔요」 로
//   시작하고 /ss-undo 를 말하는 것 — 일 때만 창을 띄우지 않고 「네」(AFFIRMATIVE)를 돌려주고, 바꾸는 중이라는 알림 한 줄을 띄워요(1.7.4 날짜 고리 · 한 번만 규칙은 아래 decide).
//   다른 창 · 다른 확장 · 실리태번 공용 Popup 은 그대로예요(공용 객체는 고치지 않아요). 창 다음부터는 그 확장이 똑같이 돌아요 —
//   다시 누르면 멈추기 · 번역 모델 횟수 · 칸마다 「되돌리기」(/ss-undo)는 그 확장 것 그대로예요.
//   설정: 테마 설정 「미트볼 영어 저장 전환 바로 하기」(chat.mbAutoEn · 기본 켬) → src/apply.js 가 body 표식 data-bl-mb-auto-en="on|off" — 끄면 예전처럼 물어요(누를 때마다 표식을 봐요).
//   감시자 · 타이머 없음. getContext 감싸개는 한 번만 걸고 걷지 않아요(끈 동안에는 받은 그대로 넘겨요). 시험: tools/tests/mb-auto-en.mjs

const MARK = Symbol.for('blue-lemonade.mb-auto-en.v1');
import { upHas } from './mb-upstream.js';
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

/*
 * 1.7.4 날짜 고리 끊기(11-17 「눈 감겼는데 호감도 안 내려가는데??」):
 *   그 확장(2.8.0 · 2.9 준비 갈래 같음)은 영어 저장 모드에서도 날짜를 「Year 101년 April 4일 (Fri)」 처럼 「년 · 월 · 일」 로 찍고(util.js dateStr),
 *   생활 기록이 그 날짜를 관계 칸에 넣어요 → 관계 칸이 「한국어로 저장된 칸」 → 바꾸기를 누르면 관계 칸이 통째로 저장돼(set rel) 그 뒤 감긴 답 · 지운 답이 숫자에서 안 빠져요.
 *   그래서 ① 바꿀 칸이 관계뿐이고 그 한국어가 날짜 꼴뿐이면 자동으로 「네」 하지 않아요(「아니오」 — 그 확장이 그만둬요 · 알림 한 줄)
 *   ② 같은 채팅에서 같은 칸 · 같은 한국어는 한 번만 자동 「네」 — 또 물으면 원작 창 그대로(사용자가 골라요). 기억은 테마 쪽(이 모듈 · 세션)에만.
 *   칸을 못 읽으면(그 확장 모듈을 못 받음) 예전처럼 「네」.
 */
const HANGUL = /[가-힣]/;
/** 원작 날짜 꼴만 한국어인 글인가: 숫자 뒤 「년 · 월 · 일」 · 괄호 속 한 글자 요일을 빼면 한글이 안 남아요 */
export const dateOnly = text => { const s = String(text ?? ''); return HANGUL.test(s) && !HANGUL.test(s.replace(/\d+\s*[년월일]/g, '').replace(/\(\s*[월화수목금토일]\s*\)/g, '')); };
const hashOf = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
/** panels: [{ id, texts(한글 든 글) }] 또는 null(모름) → { act: 'yes' | 'skip' | 'ask' } — 'yes' 일 때 seen 에 적어요 */
export function decide(panels, seen, chat = '') {
    if (!Array.isArray(panels) || !panels.length) return { act: 'yes' };
    const real = panels.filter(p => !(p?.id === 'rel' && Array.isArray(p.texts) && p.texts.length && p.texts.every(dateOnly)));
    if (!real.length) return { act: 'skip' };
    const keys = real.map(p => `${chat}|${p.id}|${hashOf((p.texts || []).join('\u0001'))}`);
    if (keys.every(k => seen.has(k))) return { act: 'ask' };
    for (const k of keys) seen.add(k);
    return { act: 'yes' };
}
export const skipText = () => '관계 칸의 한국어가 날짜(「…년 … 일」)뿐이라 영어 저장으로 바꾸지 않았어요 — 바꾸면 관계 칸이 통째로 저장돼, 그 뒤 눈 감긴 답 · 지운 답이 애정 · 우정에서 안 빠져요.';
const defaultSkip = text => { try { globalThis.toastr?.info?.(text, TITLE, { timeOut: 9000 }); } catch { /* 알림 없이 */ } };
/** 그 확장이 바꿀 칸(koPanels)과 칸마다 한글 든 글 — 못 읽으면 null */
async function defaultPanels(doc = globalThis.document) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || '')));
        if (!tag) return null;
        const [tr, core] = await Promise.all(['./src/translate.js', './src/core.js'].map(f => import(new URL(f, tag.src).href)));
        const st = core?.app?.current?.state; if (!st || typeof tr?.koPanels !== 'function') return null;
        return tr.koPanels().map(id => {
            const texts = []; const walk = o => { if (typeof o === 'string') { if (HANGUL.test(o)) texts.push(o); } else if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k]); };
            walk(id === 'core' ? st.core : st.data?.[id]);
            return { id, texts };
        });
    } catch { return null; }
}
const defaultChatKey = host => () => { try { return String(host()?.getContext?.()?.getCurrentChatId?.() ?? ''); } catch { return ''; } };
const SEEN = new Set();   // 세션 동안만(채팅 메타에 안 적어요)

/** 그 확장이 받는 Popup — 원래 클래스를 감싼 Proxy(만들기 · 다른 static 은 그대로), show 만 confirm 을 얹은 객체(나머지 창 종류는 원래 것) */
function makeDresser({ on, notify, skipNote = defaultSkip, panels = async () => null, chatKey = () => '', seen = SEEN }) {
    const facades = new WeakMap(), proxies = new WeakMap();
    const facadeOf = (show, yes, no) => {
        let facade = facades.get(show);
        if (facade) return facade;
        facade = Object.create(show, { confirm: { configurable: true, writable: true, value: function blMbAutoEnConfirm(header, text, ...rest) {
            let hit = null;
            try { hit = on() ? matchAsk(header, text) : null; } catch { hit = null; }
            if (!hit) return show.confirm(header, text, ...rest);
            return (async () => {
                let ps = null; try { ps = await panels(); } catch { ps = null; }
                let chat = ''; try { chat = String(chatKey() ?? ''); } catch { /* 이름 없이 */ }
                const { act } = decide(ps, seen, chat);
                if (act === 'skip') { try { skipNote(skipText()); } catch { /* 알림만 */ } return no; }
                if (act === 'ask') return show.confirm(header, text, ...rest);
                try { notify(hit); } catch { /* 알림만 */ }
                return yes;
            })();
        } } });
        facades.set(show, facade);
        return facade;
    };
    return c => {
        const P = c?.Popup;
        if (!P || (typeof P !== 'function' && typeof P !== 'object') || P[MARK]) return;
        if (!P.show || typeof P.show.confirm !== 'function') return;
        const yes = c.POPUP_RESULT?.AFFIRMATIVE ?? 1, no = c.POPUP_RESULT?.NEGATIVE ?? 0;
        let proxy = proxies.get(P);
        if (!proxy) {
            proxy = new Proxy(P, { get(target, key) {
                if (key === MARK) return true;
                const value = Reflect.get(target, key, target);
                return key === 'show' && value && typeof value.confirm === 'function' ? facadeOf(value, yes, no) : value;
            } });
            proxies.set(P, proxy);
        }
        c.Popup = proxy;
    };
}

let installed = false;
/** 한 번만 걸어요. 시험은 host(가짜 SillyTavern) · doc(표식을 읽을 문서) · notify(알림)를 넣어요 */
export function startMbAutoEn({ host = () => globalThis.SillyTavern, doc = globalThis.document, notify = defaultNotify, skipNote = defaultSkip, panels = () => defaultPanels(doc), chatKey = defaultChatKey(host), force = false } = {}) {
    if (installed && !force) return false;
    const holder = host();
    if (!holder || typeof holder.getContext !== 'function') return false;
    if (holder.getContext[MARK]) return false;
    const on = () => doc?.body?.getAttribute?.('data-bl-mb-auto-en') === 'on' && !upHas('autoen');   // 미트볼 2.9.1 은 「바꾸기 전에 묻기」(trConvertAsk)를 스스로 가져요 — 그 판에서는 원작 설정에 맡기고 창을 가로채지 않아요(테마 값은 한 번 옮겨요 · src/mb-upstream.js)
    const dress = makeDresser({ on, notify, skipNote, panels, chatKey });
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
