// 6.5.2 다시 그린 메시지를 실리태번 헬퍼(JS-Slash-Runner)에 알리기.
// 테마가 updateMessageBlock 으로 메시지 본문(.mes_text)을 다시 그리면(번역이 붙을 때 · 원문 보기 · 번역문 수정 · 다시 쓰기 ·
// 북마크 고치기 · 단어 치환 · 접기 · 에셋 자리) 헬퍼가 코드 블록을 iframe 으로 바꿔 둔 것이 사라지고 원시 ```html 코드가 보였다
// (사용자: 번역이 끝나면 새로고침해야 상태 카드가 제대로 보였다).
//   - 실리태번 1.19 의 updateMessageBlock 은 이벤트를 내지 않는다 (script.js updateMessageBlock).
//   - 헬퍼 4.11.3 의 iframe 런타임(store/iframe_runtimes/message.ts)은 CHARACTER_MESSAGE_RENDERED · USER_MESSAGE_RENDERED ·
//     MESSAGE_UPDATED · MESSAGE_SWIPED 가 그 번호로 올 때만 그 메시지를 버리고 다시 훑는다. 그 밖에는 「이미 그린 메시지」로 기억해 건너뛴다.
// 고르는 이벤트 = MESSAGE_UPDATED — 실리태번이 편집을 끝내고 다시 그린 뒤 내는 것과 같다 ('본문 표시가 바뀌었다').
//   - CHARACTER_MESSAGE_RENDERED 는 '새 답' — 번역기 자동 번역 · TTS 자동 읽기 · 에셋 고르기 · 다른 확장 등이 또 돈다.
//   - MESSAGE_SWIPED 는 번역기 · 에셋이 '다른 글'로 본다. MESSAGE_EDITED 는 '원문이 바뀜' — 번역기 guards.messageChanged · TTS 분석 버림 · 벡터 · 로그확률.
//   - MESSAGE_UPDATED 를 듣는 쪽은 글 해시를 다시 보거나(TTS 분석 · 미리 만들기 · 다시 쓰기 감시) 꾸밈을 다시 거는 것(북마크 · 날씨 · 핀 · 카드 잉크 ·
//     에셋 pass · Mermaid · 헬퍼 매크로/코드 접기)뿐이고, 번역기 handleMessageEdit 만 글이 그대로여도 다시 그린다 → 그쪽은 isRerenderNotify
//     로 우리 알림이면 건너뛴다 (안 그러면 다시 그리기 ↔ 알림이 돈다).
// 안 보내는 때: 헬퍼가 없거나 렌더를 껐을 때 · 스트리밍 렌더 모드(기본 꺼짐 · 경고창을 거쳐야 켜짐 — 그 모드는 MESSAGE_EDITED 만 듣는다) ·
//   화면에 없는 메시지 · 편집 창이 열린 메시지 · 본문에 헬퍼가 그릴 코드 블록(html>/<head>/<body 가 든 <pre>)이 없거나 이미 헬퍼 틀(.TH-render)
//   안에 있을 때 · 같은 메시지의 알림이 도는 중(중첩) · 실리태번 기본 번역 확장이 켜져 있고 번역문(display_text)이 있을 때
//   (그 확장은 MESSAGE_UPDATED 에 번역문을 지우거나 제 번역으로 덮어쓴다 — 그때는 전처럼 코드로 남는다).
// 실리태번 모듈을 import 하지 않는다 (SillyTavern.getContext() 만) — node 로 시험한다 (tools/tests/rerender-notify.mjs).

const FRONTEND_MARKS = ['html>', '<head>', '<body'];   // 헬퍼 util/is_frontend.ts 와 같은 규칙

/** 헬퍼가 iframe 으로 그리는 코드인가 (헬퍼 isFrontend 와 같은 판단) */
export function isFrontendCode(text) {
    const s = typeof text === 'string' ? text : String(text ?? '');
    return FRONTEND_MARKS.some(mark => s.includes(mark));
}

/** 이 메시지 요소(.mes)의 본문에 헬퍼가 그릴 <pre> 가 헬퍼 틀(.TH-render) 없이 남아 있나 */
export function needsHelperRender(mes) {
    if (!mes || typeof mes.querySelectorAll !== 'function') return false;
    for (const pre of mes.querySelectorAll('.mes_text pre')) {
        if (!isFrontendCode(pre.textContent)) continue;
        const parent = pre.parentElement;
        if (!parent || !parent.classList || !parent.classList.contains('TH-render')) return true;
    }
    return false;
}

/**
 * 헬퍼 렌더 상태: 'none'(헬퍼 없음) · 'off'(렌더 끔) · 'streaming'(스트리밍 렌더 — MESSAGE_UPDATED 를 안 듣는다) · 'iframe'.
 * 헬퍼 4.x 는 설정을 extension_settings.tavern_helper 에 둔다 (type/settings.ts setting_field). 4.0 전 TavernHelper 블록은 render_enabled 꼴.
 */
export function helperRenderMode({ settings, present }) {
    if (!present) return 'none';
    const render = settings?.tavern_helper?.render;
    if (render && typeof render === 'object') {
        if (render.enabled === false) return 'off';
        if (render.allow_streaming === true) return 'streaming';
        return 'iframe';
    }
    const legacy = settings?.TavernHelper?.render;
    if (legacy && typeof legacy === 'object' && legacy.render_enabled === false) return 'off';
    return 'iframe';
}

/**
 * 실리태번 기본 번역 확장이 이 MESSAGE_UPDATED 에 끼어드나 — 켜져 있으면 번역문(display_text)이 있는 메시지의 번역문을 지우거나 제 번역으로 덮어쓰고,
 * 자동 번역 모드면 번역문이 없는 메시지도 제 공급자로 번역해 붙인다 (public/scripts/extensions/translate/index.js translateMessageEdit).
 */
export function builtinTranslateInterferes(settings, message) {
    const disabled = settings?.disabledExtensions;
    if (Array.isArray(disabled) && disabled.includes('translate')) return false;
    if (message?.extra?.display_text) return true;
    const mode = settings?.translate?.auto_mode;
    return typeof mode === 'string' && mode !== '' && mode !== 'none';
}

/**
 * 알림기 — 의존성을 넣어 만든다 (시험용). getContext() 는 실리태번의 것(eventSource · event_types/eventTypes · extensionSettings · chat).
 * notify(id, { element }) → Promise<boolean>: MESSAGE_UPDATED 를 보냈으면(모든 청취자가 끝난 뒤) true, 보낼 이유가 없거나 못 보냈으면 false.
 */
export function createRerenderNotifier({ getContext, document: doc, helperPresent, log } = {}) {
    const active = new Set();
    const report = typeof log === 'function' ? log : (...args) => { try { console.debug('[Blue Lemonade] 다시 그리기 알림', ...args); } catch { /* 없음 */ } };
    async function notify(messageId, { element = null } = {}) {
        const id = Number(messageId);
        if (!Number.isInteger(id) || id < 0) return false;
        let ctx;
        try { ctx = typeof getContext === 'function' ? getContext() : null; } catch { ctx = null; }
        const source = ctx?.eventSource, type = (ctx?.eventTypes ?? ctx?.event_types)?.MESSAGE_UPDATED;
        if (!source || typeof source.emit !== 'function' || !type) return false;
        let present = false;
        try { present = !!helperPresent?.(); } catch { present = false; }
        if (helperRenderMode({ settings: ctx.extensionSettings, present }) !== 'iframe') return false;
        const mes = element ?? (typeof doc?.querySelector === 'function' ? doc.querySelector(`#chat .mes[mesid="${id}"]`) : null);
        if (!mes || typeof mes.querySelector !== 'function' || mes.querySelector('.edit_textarea, #curEditTextarea')) return false;
        if (!needsHelperRender(mes)) return false;
        if (builtinTranslateInterferes(ctx.extensionSettings, ctx.chat?.[id])) return false;
        if (active.has(id)) return false;   // 이 알림이 부른 청취자가 같은 메시지를 또 그려 다시 부른 것 — 돌지 않게
        active.add(id);
        try { await source.emit(type, id); return true; }
        catch (error) { report(error); return false; }
        finally { active.delete(id); }
    }
    /** 6.9.7 이 메시지에 알림을 보내면 helper 가 다시 그릴 환경인가 (helper iframe 렌더 · 기본 번역 확장이 안 끼어듦) — 본문 조건(그릴 코드 · 편집 창)은 빼고.
     *  번역기 끝 그림이 상태창 틀을 새 코드 블록으로 바꿀지 정할 때 (바꿨는데 알림이 못 가면 틀 대신 날 코드가 남는다) */
    function ready(messageId) {
        let ctx;
        try { ctx = typeof getContext === 'function' ? getContext() : null; } catch { ctx = null; }
        if (typeof ctx?.eventSource?.emit !== 'function' || !(ctx?.eventTypes ?? ctx?.event_types)?.MESSAGE_UPDATED) return false;
        let present = false;
        try { present = !!helperPresent?.(); } catch { present = false; }
        // 6.9.8 같은 메시지의 알림이 아직 도는 동안(active)은 거짓 — 그때 끝 그림이 틀을 날 코드로 바꾸면 notify 가 중첩이라 false 로 끝나 날 코드가 남는다 (review697)
        return helperRenderMode({ settings: ctx.extensionSettings, present }) === 'iframe' && !builtinTranslateInterferes(ctx.extensionSettings, ctx.chat?.[Number(messageId)]) && !active.has(Number(messageId));
    }
    return { notify, ready, isNotifying: id => active.has(Number(id)), active };
}

let shared = null;
function instance() {
    return shared ??= createRerenderNotifier({
        getContext: () => globalThis.SillyTavern?.getContext?.(),
        document: globalThis.document,
        helperPresent: () => (!!globalThis.TavernHelper && typeof globalThis.TavernHelper === 'object') || !!globalThis.document?.getElementById?.('tavern_helper'),
    });
}

/** 테마가 메시지 본문을 다시 그린 뒤 부른다. element = 그 .mes 요소(이미 찾았으면) */
export const notifyRerender = (messageId, options) => instance().notify(messageId, options);
/** 6.9.7 알림을 보내면 helper 가 이 메시지를 다시 그릴 환경인가 (번역기 끝 그림이 상태창 틀을 바꿀지) */
export const canNotifyRerender = messageId => instance().ready(messageId);
/** 지금 도는 MESSAGE_UPDATED 가 이 알림기가 보낸 것인가 (번역기 handleMessageEdit 이 건너뛰는 근거) */
export const isRerenderNotify = messageId => instance().isNotifying(messageId);
