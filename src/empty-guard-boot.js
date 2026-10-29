// 8.2.6 빈 채팅 덮어쓰기 막기 — 성능 보조를 켜지 않아도 (설정 채팅 › 기타 「빈 채팅 덮어쓰기 막기」 chat.emptyGuard · 기본 켬)
//
// 7.3.1 부터 성능 보조 › 저장 정리(src/addons/perf/savededupe.js) 안에만 있던 보호를 떼어, 성능 보조를 켜지 않은 사람에게도 건다.
// 판정 · 알림 문구 · 409 응답 · 사건 걸기는 전부 emptyguard.js 것을 그대로 부른다 (여기에 베낀 규칙은 없다).
//
// 둘이 겹치지 않게 — 표식 하나(emptyguard.js guardSlot: owner 'boot' | 'perf')
//   - 성능 보조 + 저장 정리가 이 페이지에서 시작할 차례면(설정으로 안다) 그 시작이 끝날 때까지 기다렸다가, 그쪽이 맡았으면(owner 'perf') 아무것도 안 한다.
//     먼저 감싸지 않는 까닭: 성능 보조의 「큰 저장은 워커로」 감싸개(perfassist.js)가 이 감싸개 바깥에 놓이면 큰 저장이 여기를 지나지 않는다.
//     성능 보조가 실패했거나 · 저장 정리만 꺼 두었거나 · 옛 단독 확장이 대신 돌면 그때 여기서 설치한다 (옛 단독 저장 정리에 막기가 있으면 그쪽에 맡긴다).
//   - 이미 여기서 설치한 뒤 저장 정리가 시작하면(표식을 'perf' 로 바꾸고 이 판정의 기억을 넘겨받는다) 이 감싸개 · 사건은 그 자리에서 그냥 지나간다.
//   - 성능 보조를 켜고 끄는 것은 원래 「새로고침해서 적용」이다 — 새로 고친 뒤 위 규칙대로 한쪽만 선다.
// 비용: fetch 감싸개는 POST 이고 주소에 /api/chats/ 가 있을 때만 주소를 풀어 본다. 흔한 저장(지금 채팅에 메시지가 있음)은 본문을 읽지 않고 동기로 지나간다.
import { createEmptyGuard, createSaveFailMute, guardSlot, guardWanted, guardResponse, notifyBlocked, notifySuspect, createServerCount, bindGuardEvents, quickLiveFrom, bodyKey, savePathOf } from './addons/perf/emptyguard.js';
import { addonsEnabled } from './usage-mode.js';

const TAG = '[Blue Lemonade]';
/** 성능 보조 시작을 이보다 오래 기다리지 않는다 — 그 뒤에 저장 정리가 서면 표식으로 넘겨받는다 */
export const PERF_WAIT_MS = 20000;

/** 이 페이지에서 성능 보조의 저장 정리가 시작할 차례인가 (addons.js startAddons · perf/start.js 와 같은 조건 — 실패 · 옛 단독 확장은 시작한 뒤 표식으로 안다) */
export function perfWillGuard(s) {
    return !!s && addonsEnabled(s) && !!s.addons?.perf && s.addonUI?.perfLoad?.dedupe !== false;
}

/**
 * 감싸개 · 사건을 건다. 이미 성능 보조가 맡았으면 null.
 * env: win(fetch 를 가진 창) · doc · origin · live() · serverCount(key) · ext()(extension_settings) · toast()(toastr) · eventSource · eventTypes · [root](표식 자리, 기본 globalThis)
 */
export function installEmptyGuardBoot(env) {
    const slot = guardSlot(env.root ?? globalThis);
    if (slot.owner === 'perf') return null;
    if (slot.owner === 'boot' && slot.boot) return slot.boot;
    let on = true;
    const mute = slot.mute ??= createSaveFailMute();
    const guard = createEmptyGuard({
        live: env.live,
        serverCount: env.serverCount,
        enabled: () => on && guardWanted(env.ext()),
        onBlock: (info) => {
            console.warn(`${TAG} 메시지가 있던 채팅을 빈 채팅으로 덮는 저장을 막았어요`, info);
            notifyBlocked(env.toast(), mute);
        },
        onSuspect: (info) => {
            console.warn(`${TAG} 채팅을 열었는데 메시지가 없어요 (전에 ${info.had}개) — 다시 열 때까지 이 채팅 저장을 막아요`, info);
            notifySuspect(env.toast());
        },
    });
    const mine = () => on && slot.owner === 'boot' && slot.guard === guard;
    const native = env.win.fetch;
    env.win.fetch = function blEmptyGuardFetch(input, init) {
        if (mine()) {
            try {
                const path = savePathOf(input, init, env.origin);
                if (path) {
                    const pre = guard.precheck(path, init?.body, bodyKey(path, init?.body));
                    if (pre) {
                        const self = this;
                        return pre.then(
                            result => (result?.block ? guardResponse(result) : native.call(self, input, init)),
                            () => native.call(self, input, init),
                        );
                    }
                }
            } catch (error) {
                console.warn(`${TAG} 빈 채팅 막기가 저장 요청을 살피지 못했어요`, error);
            }
        }
        return native.call(this, input, init);
    };
    try {
        bindGuardEvents({ guard: () => guard, eventSource: env.eventSource, eventTypes: env.eventTypes, doc: env.doc, chatLength: () => env.live()?.length ?? 0, active: mine });
    } catch (error) {
        console.info(`${TAG} 빈 채팅 막기 사건을 걸지 못했어요`, error);
    }
    slot.owner = 'boot';
    slot.guard = guard;
    const handle = {
        guard,
        wrapper: env.win.fetch,
        /** 설정을 끄면 감싸개 · 사건이 그냥 지나간다. 다시 켜면 기억을 비우고 새로 센다 (꺼 둔 동안 지운 것을 「있던 메시지」로 오해하지 않게) */
        setOn(value) {
            const next = !!value;
            if (next && !on) { guard.debug.known.clear(); guard.debug.cleared.clear(); guard.debug.suspect.clear(); }
            on = next;
        },
        get on() { return on; },
    };
    slot.boot = handle;
    return handle;
}

// ── 실제 실리태번에서 (features.js syncFeatures 가 설정이 바뀔 때마다 부른다) ──────────────

let handle = null, starting = null, wanted = false;

async function start() {
    const [{ getSettings }, script, groupChats, extensions] = await Promise.all([
        import('./settings.js'),
        import('../../../../../script.js'),
        import('../../../../group-chats.js'),
        import('../../../../extensions.js'),
    ]);
    if (perfWillGuard(getSettings())) {
        const { perfStarted } = await import('./addons.js');
        await Promise.race([perfStarted, new Promise(resolve => setTimeout(resolve, PERF_WAIT_MS))]);
    }
    if (guardSlot().owner === 'perf') return;               // 성능 보조 › 저장 정리가 맡았다
    if (globalThis.SaveDedupe?.emptyGuard) return;          // 옛 단독 저장 정리 확장(1.1.6 이상)이 같은 막기를 이미 건다
    const context = () => globalThis.SillyTavern?.getContext?.() ?? null;
    handle = installEmptyGuardBoot({
        win: window,
        doc: document,
        origin: location.origin,
        live: () => quickLiveFrom(script, groupChats, context),
        serverCount: createServerCount({
            fetcher: (url, init) => window.fetch(url, init),
            headers: () => (typeof script.getRequestHeaders === 'function' ? script.getRequestHeaders() : { 'Content-Type': 'application/json' }),
            selectedGroup: () => groupChats.selected_group,
        }),
        ext: () => extensions.extension_settings,
        toast: () => globalThis.toastr,
        eventSource: script.eventSource,
        eventTypes: script.event_types,
    });
    handle?.setOn(wanted);
}

/** 켜고 끄기 — 켤 때 처음 한 번 설치한다. 꺼 두면 파일도 받지 않는다(features.js) · 설치한 뒤 끄면 그냥 지나간다 */
export function syncEmptyGuard(want) {
    wanted = !!want;
    if (handle) { handle.setOn(wanted); return; }
    if (!wanted || starting) return;
    starting = start().catch((error) => {
        starting = null;
        console.warn(`${TAG} 빈 채팅 막기를 시작하지 못했어요`, error);
    });
}

/** 콘솔 · 검사용 */
export const emptyGuardBootState = () => ({ owner: guardSlot().owner, installed: !!handle, on: handle?.on ?? false, stats: handle ? { ...handle.guard.stats } : null });
