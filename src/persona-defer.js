// 입력 중 목록 갱신 미루기 (10-29 perf-persona · 커뮤니티 제보 「모바일 기준 유저 페르소나 편집하는데 많이 버벅거림 · 300챗 장기 챗」)
//
// 왜: 페르소나 설명 칸에 글자를 칠 때마다 실리태번 personas.js 의 onPersonaDescriptionInput 이
//   (1) power_user 에 설명을 적고 (2) 토큰 수 세기(1초 디바운스) (3) 목록 카드의 .ch_description 글을 다시 쓰고 (4) 저장(디바운스) (5) PERSONA_UPDATED 를 알린다.
//   (3) 의 글 노드가 빠지고 들어오면 실리태번 본체 CSS 의 body:has(...) 때문에 Blink 가 body 아래 전체의 :has 무효화를 다시 매겨
//   긴 채팅(300)에서는 글자마다 요소 1만 4천 개가 다시 계산된다(PC 글자당 120ms 남짓 · 폰 CPU 4배는 0.4~0.5초).
// 어떻게: 그 핸들러 하나만 감싸서, 연속 입력 중에는 미루고 마지막 글자 뒤 DELAY ms 에 한 번 돌린다.
//   다른 리스너(테마 · 다른 확장)의 input 은 그대로 글자마다 받는다 — jQuery 가 들고 있는 그 핸들러 자리만 바꾼다(guid 를 옮겨 .off() 도 그대로 맞는다).
//   떠나는 순간에는 기다리지 않고 바로 돌린다: 칸이 포커스를 잃을 때 · 다른 곳을 누를 때(다른 페르소나 고르기 · 서랍 닫기 단추 · 창 닫기 단추) ·
//   서랍이 닫힐 때(openDrawer 가 빠짐) · 창(dialog)이 닫힐 때 · 다른 키(Esc 등) · 생성 시작 · 페이지를 떠날 때(beforeunload · pagehide · 화면이 가려짐).
//   그래서 저장 · 프롬프트에 들어가는 값은 빠지지 않는다.
// 한글 조합: 조합(compositionstart ~ compositionend) 중에는 타이머로 끼어들지 않는다 — 조합이 끝나고 DELAY 뒤에 돈다(전개 지시 direction/typing.js 와 같은 방식).
//   떠나는 순간의 즉시 실행도 입력칸의 글 · 선택 · 포커스는 건드리지 않는다(실리태번 데이터 · 목록 글 · 저장만 — 원래 글자마다 하던 일).
// 실리태번 판이 바뀌어 핸들러 모양이 다르면(jQuery 가 없음 · 그 이름의 input 핸들러가 없음) 아무것도 하지 않고 콘솔에 한 줄만 남긴다.
// 설정: 채팅 › 화면 「입력 중 목록 갱신 미루기」(chat.personaDefer · 기본 켬).
export const DELAY = 400;                               // 폰 타자 사이(200~300ms)보다 길게 — 치는 동안 글자마다 한 번씩 돌지 않게
export const HANDLER = 'onPersonaDescriptionInput';
export const FIELD_ID = 'persona_description';
export const DRAWER_ID = 'PersonaManagement';          // (review-persona) openDrawer 가 붙는 실제 서랍 .drawer-content(#persona-management-button 안) — 안쪽 칸 #persona-management-block 은 class 가 바뀌지 않아 닫힘을 못 봤다
const TAG = '[Blue Lemonade]';

/**
 * 미루기 핵심 (순수 — tools/tests/persona-defer.mjs 가 가짜 타이머로 본다)
 * @param {object} env
 * @param {(self: any, args: any[]) => void} env.run 원래 핸들러 실행
 * @param {number} [env.delay]
 * @param {(fn: () => void, ms: number) => any} [env.setTimer]
 * @param {(id: any) => void} [env.clearTimer]
 * @param {() => any} [env.owner] 지금 페르소나(미룬 사이 다른 페르소나로 바뀌었으면 타이머 실행은 버린다 — 칸 글이 이미 새 페르소나의 것)
 */
export function createDeferrer(env) {
    const delay = Number.isFinite(env.delay) ? env.delay : DELAY;
    const setTimer = env.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = env.clearTimer || (id => clearTimeout(id));
    const owner = env.owner || (() => null);
    let composing = false, timer = null, pending = null, runs = 0, deferred = 0;

    function clear() { if (timer !== null) { clearTimer(timer); timer = null; } }
    function fire(reason) {
        clear();
        const job = pending; pending = null;
        if (!job) return false;
        if (reason === 'timer' && job.owner !== owner()) return false;   // 미룬 사이 페르소나가 바뀜 — 칸 글은 새 페르소나 것이라 돌릴 일이 없다
        runs++;
        env.run(job.self, job.args);
        return true;
    }
    function arm() {
        clear();
        if (composing || !pending) return;
        timer = setTimer(() => { timer = null; if (composing) return; fire('timer'); }, delay);
    }
    return {
        /** 감싼 핸들러가 부른다: 이번 호출을 미룬다 */
        input(self, args, event) {
            deferred++;
            // 주인은 이번 입력 때의 페르소나 — 실리태번은 칸 글을 바꾼 그 자리에서 페르소나도 바꾸니, 이번 입력의 칸 글은 지금 페르소나 것이다.
            //   (review-persona) 예전에는 첫 입력 때 주인을 붙들어, 미룬 사이 다른 길로 바뀐 새 페르소나에 이어 친 글까지 타이머가 버렸다.
            pending = { self, args, owner: owner() };
            // 조합 상태는 input 이벤트의 isComposing 도 따른다: 조합 중 input 은 true, 조합이 끝난 뒤의 input 은 false.
            //   리그(CDP imeSetComposition → insertText 확정)에서는 compositionend 가 오지 않아 조합 중으로 남은 채 타이머가 영영 돌지 않았다.
            const c = typeof event?.isComposing === 'boolean' ? event.isComposing : event?.originalEvent?.isComposing;
            if (c === true) composing = true; else if (c === false) composing = false;
            arm();
        },
        compositionStart() { composing = true; clear(); },
        compositionEnd() { composing = false; arm(); },
        /** 떠나는 순간: 기다리지 않고 바로(조합 중이어도 — 입력칸은 건드리지 않는다) */
        flush(reason = 'flush') { return fire(reason); },
        /** 끌 때: 미룬 것이 있으면 바로 돌리고 멈춘다 */
        stop() { fire('stop'); composing = false; },
        pending: () => !!pending,
        composing: () => composing,
        stats: () => ({ runs, deferred, pending: !!pending, composing }),
    };
}

/** jQuery 가 #persona_description 에 들고 있는 실리태번 input 핸들러 자리(handleObj)를 찾는다 — 없으면 null */
export function findHandleObj($, field) {
    let list = null;
    try { list = $?._data?.(field, 'events')?.input; } catch { list = null; }
    if (!Array.isArray(list)) return null;
    return list.find(h => h && !h.selector && typeof h.handler === 'function' && (h.handler.name === HANDLER || h.handler.__blPersonaDeferOrig?.name === HANDLER)) || null;
}

/**
 * 감싸고 즉시 실행 경로를 건다. 돌려주는 값: { ok, reason?, uninstall, core } — 핸들러가 없으면 ok:false 이고 아무것도 걸지 않는다.
 * @param {object} deps { $, document, window, eventSource?, eventTypes?, owner?, delay?, setTimer?, clearTimer?, log? }
 */
export function installPersonaDefer(deps) {
    const doc = deps.document, win = deps.window, log = deps.log || ((...a) => console.info(...a));
    const field = doc?.getElementById?.(FIELD_ID);
    if (!field) return { ok: false, reason: 'no-field', uninstall() {} };
    const handleObj = findHandleObj(deps.$, field);
    if (!handleObj) { log(`${TAG} 페르소나 설명 입력 미루기: 실리태번 입력 처리 모양이 달라 쉬어요(원래대로 글자마다 갱신)`); return { ok: false, reason: 'no-handler', uninstall() {} }; }
    if (handleObj.handler.__blPersonaDeferOrig) return { ok: false, reason: 'already', uninstall() {} };

    const orig = handleObj.handler;
    const core = createDeferrer({ run: (self, args) => orig.apply(self, args), delay: deps.delay, setTimer: deps.setTimer, clearTimer: deps.clearTimer, owner: deps.owner });
    const wrapper = function (event) { core.input(this, Array.from(arguments), event); };
    wrapper.guid = orig.guid;                      // jQuery .off('input', onPersonaDescriptionInput) 가 guid 로 맞춘다
    wrapper.__blPersonaDeferOrig = orig;
    handleObj.handler = wrapper;

    const offs = [];
    const on = (target, type, fn, opts) => { if (!target?.addEventListener) return; target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
    const outside = t => t !== field && !(field.contains && t && field.contains(t));
    const flush = reason => { if (core.pending()) core.flush(reason); };
    // 조합 상태는 문서 어디서든(실리태번 「크게 편집」 창의 칸이 원래 칸에 input 을 trigger 하는 경우도 있다)
    on(doc, 'compositionstart', () => core.compositionStart(), true);
    on(doc, 'compositionend', () => core.compositionEnd(), true);
    // 떠나는 순간 — 캡처 단계라 실리태번 클릭 처리(페르소나 고르기 · 서랍 토글 · 창 닫기)보다 먼저 돈다
    on(field, 'blur', () => flush('blur'));
    on(doc, 'click', e => { if (outside(e.target)) flush('click'); }, true);
    on(doc, 'keydown', e => { if (outside(e.target) || e.key === 'Escape') flush('key'); }, true);
    on(doc, 'close', () => flush('dialog'), true);   // <dialog> 닫힘(버블은 안 하지만 캡처는 문서를 지난다)
    on(win, 'beforeunload', () => flush('unload'));
    on(win, 'pagehide', () => flush('unload'));
    on(doc, 'visibilitychange', () => { if (doc.visibilityState === 'hidden') flush('hidden'); });
    // 서랍이 코드로 닫혀도(바깥 누름 · 다른 서랍 열기) — openDrawer 가 빠지는 순간
    const drawer = doc.getElementById?.(DRAWER_ID) || doc.querySelector?.('#persona-management-button .drawer-content');   // 실리태번 isPersonaPanelOpen 과 같은 자리
    if (drawer && typeof deps.MutationObserver === 'function') {
        let open = !!drawer.classList?.contains('openDrawer');
        const mo = new deps.MutationObserver(() => { const now = !!drawer.classList?.contains('openDrawer'); if (open && !now) flush('drawer'); open = now; });
        mo.observe(drawer, { attributes: true, attributeFilter: ['class'] });
        offs.push(() => mo.disconnect());
    }
    // 생성 시작(프롬프트를 만들기 전) — 미룬 값이 프롬프트에 들어가게
    const es = deps.eventSource, ev = deps.eventTypes?.GENERATION_STARTED;
    if (es?.on && ev) {
        const fn = () => flush('generate');
        es.on(ev, fn);
        offs.push(() => (es.removeListener || es.off)?.call(es, ev, fn));
    }
    return {
        ok: true, core,
        uninstall() {
            core.stop();
            for (const off of offs.splice(0)) { try { off(); } catch { } }
            if (handleObj.handler === wrapper) handleObj.handler = orig;
        },
    };
}

// ---------------------------------------------------------------- 연결 (features.js)
let installed = null, tries = 0, retry = null, personas = null, gaveUp = false;
async function ownerFn() {
    if (!personas) { try { personas = await import('../../../../personas.js'); } catch { personas = {}; } }
    return () => personas?.user_avatar ?? null;
}
let chain = Promise.resolve();
/** 설정 적용(applyAll)이 잇달아 불러도 한 줄로 — 겹쳐 두 번 감싸지 않게 */
export function syncPersonaDefer(enabled) {
    chain = chain.then(() => doSync(enabled)).catch(() => false);
    return chain;
}
async function doSync(enabled) {
    clearTimeout(retry); retry = null;
    if (!enabled) { installed?.uninstall(); installed = null; tries = 0; gaveUp = false; return false; }
    if (installed?.ok) return true;
    if (gaveUp) return false;   // 모양이 달라 쉬기로 했으면 설정이 다시 적용될 때마다 콘솔을 채우지 않는다
    const $ = globalThis.jQuery || globalThis.$;
    const field = document.getElementById(FIELD_ID);
    // 실리태번이 initPersonas 로 핸들러를 걸기 전이면 조금 뒤 다시(최대 몇 번) — 그래도 없으면 install 이 한 줄 남기고 쉰다
    if (!field || !findHandleObj($, field)) {
        if (++tries < 6) { retry = setTimeout(() => { syncPersonaDefer(true); }, 2000 * tries); return false; }
    }
    let ctx = null; try { ctx = globalThis.SillyTavern?.getContext?.(); } catch { ctx = null; }
    installed = installPersonaDefer({ $, document, window, MutationObserver: globalThis.MutationObserver, eventSource: ctx?.eventSource, eventTypes: ctx?.eventTypes || ctx?.event_types, owner: await ownerFn() });
    if (!installed.ok) { installed = null; gaveUp = true; }
    return !!installed;
}

export const _test = { state: () => ({ installed: !!installed, stats: installed?.core?.stats?.() ?? null }) };
