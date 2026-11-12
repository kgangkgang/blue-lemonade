// 1.1.4 유휴 폴링 하나로: 과일 계열 세 모듈(상태창 한글 src/scripts/fruit-status.js · 상태창 글자 src/fruit-type-runtime.js · 글자 바로가기 src/fruit-type-shortcuts.js)이
//   저마다 1.5초 타이머를 걸고 같은 「채팅 뿌리 · iframe 문서 서명」을 따로 계산했어요(쉬는 동안에도 1.5초마다 타이머 셋 · 서명 계산 셋).
//   이제 창 · 문서마다 타이머는 하나, 그 박자의 서명도 한 번만 계산해 구독한 모듈이 같이 써요. 화면이 가려진 동안은 박자를 건너뛰고(그리기 예약 rAF 도 어차피 멈춰요),
//   다시 보이면 바로 한 번 돌아요 — 알아채는 때는 예전(다시 보인 뒤 첫 프레임)과 같아요.
//   쓰는 법:
//     const poll = framePoll(doc, host);
//     const off = poll.every(() => { if (poll.sig() !== lastSig) schedule(); });            // 박자마다(1.5초)
//     const off = poll.every(() => { … poll.sig(true) … }, { counts: true });                 // iframe 문서 안 요소 수까지 보는 서명을 쓰는 구독
//     lastSig = poll.sig();   // 박자 밖에서 부르면 그때 새로 계산해요(훑은 뒤 기준값)
//     off();                  // 마지막 구독이 끊기면 타이머도 내려요(폴은 남아 다음 구독 때 다시 걸어요)
//   서명: 채팅 뿌리(#chat) 와 그 아래 iframe 문서(3겹까지)의 정체 번호를 문서 순서로 이은 글. counts 면 iframe 문서마다 요소 수가 뒤따라요(iframe 안은 채팅 감시가 못 봐서).
//   8.2.2 · 8.2.6 그대로: iframe · 요소는 살아 있는 목록(getElementsByTagName)으로 — DOM 이 그대로면 거의 공짜예요. 목록은 뿌리 · 문서가 바뀌면 함께 버려져요(WeakMap).
export const FRAME_POLL_MS = 1500;
const polls = new WeakMap();   // 창(host) → WeakMap(문서 → 폴)

function makePoll(doc, host) {
    const ids = new WeakMap(); let nextId = 1;
    const idOf = o => { if (!o) return 0; let i = ids.get(o); if (!i) ids.set(o, i = nextId++); return i; };
    const frameLists = new WeakMap();
    const framesOf = scope => { if (typeof scope.getElementsByTagName !== 'function') return scope.querySelectorAll('iframe'); let list = frameLists.get(scope); if (!list) { list = scope.getElementsByTagName('iframe'); frameLists.set(scope, list); } return list; };
    const allLists = new WeakMap();
    const countOf = d => { if (!d) return 0; if (typeof d.getElementsByTagName !== 'function') return d.querySelectorAll?.('*').length || 0; let list = allLists.get(d); if (!list) { list = d.getElementsByTagName('*'); allLists.set(d, list); } return list.length; };
    // 한 번 훑어 두 서명을 같이 내요: plain(정체 번호만) · counts(요소 수 포함). counts 를 안 쓰면 요소 수는 세지 않아요
    const walkSig = withCounts => {
        const plain = [], full = withCounts ? [] : null;
        const walk = (scope, depth) => {
            const id = idOf(scope); plain.push(id); full?.push(id);
            if (!scope || depth > 3) return;
            for (const f of framesOf(scope)) {
                let d = null; try { d = f.contentDocument; } catch { /* 다른 출처 */ }
                const did = idOf(d); plain.push(did);
                if (full) { full.push(did); full.push(countOf(d)); }
                if (d?.body) walk(d.body, depth + 1);
            }
        };
        walk(doc.querySelector('#chat'), 0);
        return { plain: plain.join(','), counts: full ? full.join(',') : null };
    };
    const subs = new Set();
    let timer = 0, memo = null, walks = 0, ticks = 0, bound = false;
    const sig = (withCounts = false) => {
        if (memo) {   // 박자 안: 그 박자에 한 번 계산한 것을 같이 써요
            if (withCounts ? memo.counts != null : memo.plain != null) return withCounts ? memo.counts : memo.plain;
            walks++; const s = walkSig(withCounts); memo.plain = s.plain; if (withCounts) memo.counts = s.counts;
            return withCounts ? memo.counts : memo.plain;
        }
        walks++; const s = walkSig(withCounts);
        return withCounts ? s.counts : s.plain;
    };
    const tick = () => {
        if (doc.hidden === true) return;   // 가려진 동안은 쉬어요 — 다시 보이면 onVisible 이 바로 한 번 돌려요
        ticks++;
        memo = { plain: null, counts: null };
        try {
            if ([...subs].some(s => s.counts)) { walks++; const s = walkSig(true); memo.plain = s.plain; memo.counts = s.counts; }
            for (const s of [...subs]) { if (!subs.has(s)) continue; try { s.fn(); } catch (error) { console.warn('[Blue Lemonade] 채팅 틀 폴링 구독 오류', error); } }
        } finally { memo = null; }
    };
    const onVisible = () => { if (doc.hidden !== true && subs.size) tick(); };
    const bind = on => {
        if (on === bound || typeof doc.addEventListener !== 'function') return;
        bound = on;
        if (on) doc.addEventListener('visibilitychange', onVisible); else doc.removeEventListener('visibilitychange', onVisible);
    };
    return {
        sig,
        every(fn, { counts = false } = {}) {
            const s = { fn, counts: !!counts };
            subs.add(s);
            if (!timer) { timer = host.setInterval(tick, FRAME_POLL_MS); bind(true); }
            return () => {
                if (!subs.delete(s) || subs.size) return;
                host.clearInterval(timer); timer = 0; bind(false);
            };
        },
        /** 진단 · 시험용: 진짜 타이머 수(0 또는 1) · 구독 수 · 박자 수 · 서명 계산 수 */
        stats: () => ({ timers: timer ? 1 : 0, subscribers: subs.size, ticks, walks }),
    };
}

/** 그 창 · 문서의 폴(하나) — 없으면 만들어요. 창 · 문서가 사라지면 함께 버려져요(WeakMap) */
export function framePoll(doc, host) {
    let byDoc = polls.get(host); if (!byDoc) polls.set(host, byDoc = new WeakMap());
    let poll = byDoc.get(doc);
    if (!poll) byDoc.set(doc, poll = makePoll(doc, host));
    return poll;
}
