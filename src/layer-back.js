// 1.6.1 공용 「창 겹 쌓기」 — 열린 창을 겹으로 쌓아 두고, 폰의 뒤로 가기(브라우저 기록 · 안드로이드 뒤로 단추) 한 번에 맨 위 겹 하나만 닫아요.
//   테마 어디서든 쓸 수 있는 작은 부품이에요(DOM · 실리태번을 몰라요 — 닫는 법은 겹을 올리는 쪽이 줘요). 첫 손님은 미트볼 창(src/mb-back.js).
//   원리: 겹 하나 = 브라우저 기록 한 칸(주소는 안 바꿔요 · 기록 상태에 깊이만 적어요). 「기록에 적힌 깊이」 와 「열려 있는 겹 수」 를 늘 같게 맞춰요.
//     · 뒤로 가기 → 기록 깊이가 겹 수보다 작아짐 → 모자란 만큼 맨 위 겹부터 닫아요.
//     · ✕ 로 닫음(done) → 겹 수가 기록 깊이보다 작아짐 → 남는 칸만큼 기록을 스스로 뒤로 물려요(다음 뒤로 가기가 헛돌지 않게).
//     · 새로 고침 · 앞으로 가기로 「겹 없는데 깊이만 남은 칸」 에 서 있으면 → 같은 규칙으로 스스로 물러나요.
//     · 닫으려던 겹이 안 닫혔으면(위에 다른 창이 있어 그것부터 닫은 때) 겹은 그대로 두고 기록 한 칸을 다시 채워요.
//   기록을 스스로 움직이는 동안(travel)에는 새로 움직이지 않고, 그 이동이 끝난 신호(popstate)에서 다시 맞춰요 — 연달아 닫아도 한 칸씩 더 물러나지 않아요.
//   스스로 물린 이동의 신호에서는 겹을 닫지 않아요 — 창을 닫자마자 다른 창을 여는 흐름(알림을 눌러 그 탭으로 가기)에서 새 창이 닫히지 않게.
//   실리태번은 기록을 쓰지 않아요(주소 그대로 · 페이지를 떠나지 않으니 떠남 경고도 안 떠요). 남이 적어 둔 기록 상태는 그대로 두고 깊이 칸 하나만 더해요.
//   1.7.6 스스로 물린 이동의 신호는 다른 듣는 곳에 넘기지 않아요(잡는 단계에서 먼저 받아 거기서 멈춰요) — 미트볼 상태창 2.9.0 이 「뒤로 가기로 창 닫기」를 스스로 갖게 되면서,
//     미트볼 창 위에서 테마 겹(고르기 목록 · 확인 · 입력 창 · 색 고르기)을 닫을 때 테마가 제 칸을 물린 신호를 그 확장이 사용자의 뒤로 가기로 읽어 미트볼 창까지 닫았어요
//     (11-18 사용자 「상태창 만들기 누르고 뭐 조금 조작만 하면 꺼지더라」).
//     사용자가 누른 뒤로 가기도 테마 겹이 그 한 번을 썼으면(맨 위 칸이 테마 칸이었어요) 넘기지 않아요 — 미트볼 창 위의 고르기 목록에서 뒤로 가기 한 번에 목록과 미트볼 창이 같이 닫혔어요.
//     테마 겹이 없거나 맨 위 칸이 남의 칸이면(테마가 닫을 게 없으면) 그대로 넘겨요.
//   시험: tools/tests/layer-back.mjs
export const DEPTH_KEY = 'blLayer';

/** 겹 관리자를 하나 만들어요(시험은 가짜 창으로 · 실제는 아래 layers()). */
export function createLayers(win = globalThis) {
    const stack = [];
    let travel = false, wired = false;
    const hist = () => win.history;
    const depth = () => { try { const n = Number(hist()?.state?.[DEPTH_KEY]); return Number.isInteger(n) && n > 0 ? n : 0; } catch { return 0; } };
    const push = n => { try { const old = hist().state; hist().pushState({ ...(old && typeof old === 'object' ? old : {}), [DEPTH_KEY]: n }, ''); return true; } catch { return false; } };
    /** 기록 깊이를 겹 수에 맞춰요: 남으면 물러나고(비동기 · 한 번에 하나) 모자라면 채워요 */
    function settle() {
        if (travel) return;
        const have = depth(), want = stack.length;
        if (have > want) { travel = true; try { hist().go(want - have); } catch { travel = false; } }
        else for (let n = have + 1; n <= want; n++) if (!push(n)) break;
    }
    const aliveOf = layer => { try { return layer.alive() !== false; } catch { return true; } };
    function onPop(event) {
        const mine = travel; travel = false;
        const have = depth();
        if (mine || stack.length > have) { try { event?.stopImmediatePropagation?.(); } catch { /* 옛 엔진 — 그대로 */ } }   // 1.7.6 테마가 스스로 물린 이동 · 테마 겹이 쓴 뒤로 가기는 남(다른 확장의 뒤로 가기 듣는 곳)에게 안 보여요
        let want = mine ? 0 : stack.length - have;   // 닫아 달라는 겹 수
        while (want > 0 && stack.length) {                 // 뒤로 가기: 맨 위 겹부터
            const layer = stack[stack.length - 1];
            // 버그 사냥 9b: 벌써 사라진 겹(창이 닫히지 않고 떼어졌는데 알림이 안 온 것)은 세지 않고 치워요 — 전엔 그 겹이 뒤로 가기 한 번을 먹어 아무것도 안 닫혔어요
            if (layer.alive && !aliveOf(layer)) { layer.gone = true; stack.pop(); continue; }
            want--;
            let closed = true;
            try { closed = layer.close() !== false; } catch { closed = true; }
            if (!closed) break;                       // 안 닫힘(위의 다른 창을 먼저 닫았어요) — 겹은 그대로, 아래 settle 이 기록 한 칸을 다시 채워요
            if (stack[stack.length - 1] === layer) { layer.gone = true; stack.pop(); }   // close 안에서 done 을 불렀으면 이미 빠졌어요
        }
        settle();
    }
    function wire() {
        if (wired || typeof win.addEventListener !== 'function') return;
        wired = true;
        win.addEventListener('popstate', onPop, true);   // 잡는 단계: 창이 과녁인 사건이라 나중에 걸려도 다른 듣는 곳보다 먼저 불려요
        settle();                                     // 새로 고친 뒤 깊이만 남은 칸에 서 있으면 물러나요
    }
    return {
        /** 겹을 올려요. close(): 그 창을 닫아요 — 못 닫았으면 false 를 돌려줘요. 돌려주는 done(): 다른 길(✕ · 바깥 누름)로 닫혔을 때 불러요.
         *  alive()(고를 수 있어요): 그 창이 아직 있나 — false 면 뒤로 가기 때 그 겹은 세지 않고 치워요(버그 사냥 9b) */
        open(close, alive = null) {
            if (typeof close !== 'function' || !hist()?.pushState) return () => {};
            wire();
            const layer = { close, alive: typeof alive === 'function' ? alive : null, gone: false };
            stack.push(layer);
            settle();
            return () => { if (layer.gone) return; layer.gone = true; const i = stack.indexOf(layer); if (i >= 0) stack.splice(i, 1); settle(); };
        },
        /** 새로 고친 뒤 남은 깊이를 치울 수 있게 듣기만 시작해요(겹이 없어도) */
        start() { if (hist()?.pushState) wire(); },
        get size() { return stack.length; },
    };
}
let shared = null;
// 1.9.2 화면 빚: 「하나」 는 문서에 하나예요 — 이 모듈이 두 번 읽히면(묶음 조각 · src 와 dist 를 같이 부름) 겹 관리자가 둘이 되어,
//   나중 것이 처음 이어질 때(wire 의 settle) 앞 것이 쌓은 기록 칸을 「겹 없는데 깊이만 남은 칸」 으로 읽고 물렸고, 그 신호에서 앞 것이 방금 연 창을 닫았어요
//   (화면 검사 「여는 함수 · 메모 그래프 — 새로 뜬 창이 없어요」 · 1.6.9 부터). 문서 전역 열쇠 하나에 두고 같이 써요.
const SHARED_KEY = Symbol.for('blue-lemonade.layer-back');
/** 테마가 같이 쓰는 겹 관리자 하나 */
export const layers = () => (shared ||= (globalThis[SHARED_KEY] ||= createLayers(globalThis)));
