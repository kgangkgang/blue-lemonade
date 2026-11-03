// 단독 확장 → 테마 내장 표 (순수 모듈 · 시험 tools/tests/private-addons.mjs)
// 왜: 단독 확장으로 쓰던 것을 src/addons/<폴더>/ 로 들여올 때 쓰는 틀이다. 1.0.0 공개판에는 들여온 것이 없어 표가 비어 있다
//   (따로 깔던 개인 확장은 모두 자기 폴더에서 단독으로 돌고, 테마는 그 폴더를 충돌로 보지 않는다).
//   들여올 때는 폴더 이름 · 설정 키 · chat_metadata · 서버 파일 이름 · Symbol 창구는 그대로 두므로 이전할 자료가 없다. 각 확장의 index.js 가 그대로 진입이고,
//   테마 카드(addons.js)는 켜고 끄기 · 지연 로딩 · 옛 단독 폴더 대기(conflict) · 「옛 단독 확장 끄기」 · 세부 설정 열기(bridge.js)만 맡는다.
// embedded: 이 판에 실제로 실린 것 — addons.js 가 names · icons · startOne · 시작 순서 · 카드에 쓴다.
//   단독으로 남은 확장은 이 표에 넣지 않는다 — 테마는 그 폴더를 충돌로 보지 않고, 단독 확장은 자기 폴더에서 스스로 돈다.
// folders: 실리태번 third-party/<폴더> 의 옛 단독 폴더 이름(판 번호가 붙은 xxx-1.4.1 꼴은 extension-folder.js folderBase 로 같은 것으로 본다).
// version: 업데이트 탭 · 진단 파일이 판을 읽는 파일(addon-versions.js — 앞 4KB 의 VERSION = 값, .json 이면 "version").
// css: 자기 스타일 파일 이름(없으면 style.css) — addons.js stylesheet() 가 <link> 로 단다.
//   꼴: '<id>': Object.freeze({ label, icon: 'fa-…', version: '<id>/<판 파일>', folders: Object.freeze(['<옛 폴더>']), embedded: true })
export const PRIVATE_ADDONS = Object.freeze({});
/** 이 판에 실린 개인 확장 id (addons.js 의 켜고 끄기 · 시작 순서 · 「옛 단독 확장 끄기」 대상) */
export const EMBEDDED_PRIVATE = Object.freeze(Object.keys(PRIVATE_ADDONS).filter(id => PRIVATE_ADDONS[id].embedded));
/** id → 옛 단독 폴더 이름들 (extension-folder.js DUPLICATES 에 합쳐진다) */
export const PRIVATE_DUPLICATES = Object.freeze(Object.fromEntries(Object.entries(PRIVATE_ADDONS).map(([id, p]) => [id, [...p.folders]])));
/** 설정 플래그 기본값(전부 꺼짐 — 옛 폴더가 켜져 있던 것은 addons.js 가 한 번 켠다 · ADDON_CARRY) */
export const PRIVATE_FLAGS = Object.freeze(Object.fromEntries(EMBEDDED_PRIVATE.map(id => [id, false])));
/** 한 번만 하는 플래그 이어받기 단계 — 새 확장이 실리는 판마다 1 올리면 그 확장도 「옛 폴더 켜짐 → 플래그 켬」을 한 번 겪는다 (settings.addonCarry) */
export const ADDON_CARRY = 4;   // 지난 판들에서 이미 4 단계까지 올렸어요 — 새 확장이 실릴 때만 올려요
// ── 생성 전 훅 창구 — manifest.json generate_interceptor(blueLemonadeGenerate). 실리태번은 manifest 마다 interceptor 하나를 loading_order 차례로 부른다.
//   내장 애드온은 globalThis[Symbol.for(블루레몬에이드 generate)] Set 에 (chat, contextSize, abort, type) 함수를 넣으면 차례로 불린다. 훅이 없으면 하는 일이 없다.
export const GENERATE_HOOKS = Symbol.for('blue-lemonade.generate');
//   9.0.2 before: 훅을 부르기 전에 기다릴 약속(index.js — 애드온 본체가 3층에 붙기 전 첫 생성이면 3층을 당겨 붙을 때까지 · 늦어도 몇 초)
export function installGenerateInterceptor(target = globalThis, { before = null } = {}) {
    const hooks = target[GENERATE_HOOKS] instanceof Set ? target[GENERATE_HOOKS] : (target[GENERATE_HOOKS] = new Set());
    if (typeof target.blueLemonadeGenerate !== 'function') {
        target.blueLemonadeGenerate = async (chat, contextSize, abort, type) => {
            if (before) { try { await before(); } catch (error) { console.warn('[Blue Lemonade] 생성 전 훅 기다리기', error); } }
            for (const fn of [...hooks]) {
                try { await fn(chat, contextSize, abort, type); } catch (error) { console.error('[Blue Lemonade] 생성 전 훅', error); }
            }
        };
    }
    return hooks;
}
