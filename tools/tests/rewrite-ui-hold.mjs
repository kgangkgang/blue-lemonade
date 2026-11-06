// 브라우저·통신 없이 실제 잠금 모듈의 소유권, 복원, 동시 실행을 확인해요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRewriteUiHold, REWRITE_ACTION_SELECTOR } from '../../src/addons/rewrite/ui-hold.js';

function element(initial = {}) {
    const values = new Map(Object.entries(initial).map(([k, v]) => [k, [v, '']]));
    return { style: {
        getPropertyValue: key => values.get(key)?.[0] ?? '',
        getPropertyPriority: key => values.get(key)?.[1] ?? '',
        setProperty: (key, value, priority = '') => values.set(key, [value, priority]),
        removeProperty: key => values.delete(key),
    } };
}
function harness({ send = false, generating } = {}) {
    const controls = [element(), element({ visibility: 'collapse' })], stop = element({ display: 'none' });
    const state = { send, writes: 0, hidden: 0, shown: 0 };
    const dataset = new Proxy({ generating }, {
        set() { throw Error('body에 쓰면 안 돼요'); }, deleteProperty() { throw Error('body에서 지우면 안 돼요'); },
    });
    const doc = { body: { dataset }, querySelectorAll(selector) {
        assert.equal(selector, REWRITE_ACTION_SELECTOR);
        assert.equal(state.send, true, '조작부를 건드리기 전에 전송부터 막아요');
        return controls;
    }, getElementById: id => id === 'mes_stop' ? stop : null };
    const acquire = createRewriteUiHold({ document: doc,
        getSendLocked: () => state.send, setSendLocked: value => { state.send = value; state.writes++; },
        hideSwipes: () => { state.hidden++; }, showSwipes: () => { state.shown++; },
    });
    return { acquire, controls, stop, state, doc };
}
let passed = 0;
function check(name, run) { run(); passed++; console.log(`통과 ${passed}: ${name}`); }
check('전송 차단과 조작부 숨김을 즉시 적용하고 기존 값을 복원해요', () => {
    const h = harness(), release = h.acquire();
    assert.equal(h.state.send, true);
    for (const el of h.controls) assert.equal(el.style.getPropertyValue('visibility'), 'hidden');
    assert.equal(h.stop.style.getPropertyValue('display'), 'flex');
    release();
    assert.equal(h.state.send, false);
    assert.equal(h.controls[0].style.getPropertyValue('visibility'), '');
    assert.equal(h.controls[1].style.getPropertyValue('visibility'), 'collapse');
    assert.equal(h.stop.style.getPropertyValue('display'), 'none');
    assert.equal(h.stop.style.getPropertyPriority('display'), '');
});
for (const order of [[0, 1], [1, 0]]) check(`겹친 검사 해제 순서 ${order.join(' → ')}에서도 마지막까지 잠가요`, () => {
    const h = harness(), release = [h.acquire(), h.acquire()];
    assert.equal(h.state.hidden, 1);
    release[order[0]](); assert.equal(h.state.send, true); assert.equal(h.state.shown, 0);
    release[order[1]](); assert.equal(h.state.send, false); assert.equal(h.state.shown, 1);
    release[0](); release[1](); assert.equal(h.state.shown, 1);
    h.acquire()(); assert.equal(h.state.shown, 2, '다음 답에서도 다시 잠글 수 있어요');
});
for (const before of [{ send: true }, { generating: 'true' }, { send: true, generating: 'true' }]) {
    check(`본체가 잠근 상태 ${JSON.stringify(before)}는 바꾸지 않아요`, () => {
        const h = harness(before); h.acquire()();
        assert.equal(h.state.writes, 0); assert.equal(h.state.hidden, 0); assert.equal(h.state.shown, 0);
        assert.equal(h.stop.style.getPropertyValue('display'), 'none');
    });
}
check('다른 확장이 검사 중 바꾼 스타일은 그대로 남겨요', () => {
    const h = harness(), release = h.acquire();
    h.stop.style.setProperty('display', 'grid');
    h.controls[0].style.setProperty('visibility', 'visible', 'important');
    release();
    assert.equal(h.stop.style.getPropertyValue('display'), 'grid');
    assert.equal(h.controls[0].style.getPropertyValue('visibility'), 'visible');
});
check('그 사이 본체가 새 생성 잠금을 잡았으면 풀지 않아요', () => {
    const h = harness(), release = h.acquire(); h.doc.body = { dataset: { generating: 'true' } };
    release(); assert.equal(h.state.send, true); assert.equal(h.state.shown, 0);
    assert.equal(h.controls[0].style.getPropertyValue('visibility'), '');
});
check('조작부가 없는 화면에서도 잠금과 해제가 끝나요', () => {
    const h = harness(); h.doc.querySelectorAll = () => []; h.doc.getElementById = () => null;
    h.acquire()(); assert.equal(h.state.send, false); assert.equal(h.state.shown, 1);
});
check('초기화 오류 뒤 잠금이 남지 않고 다음 검사가 가능해요', () => {
    const h = harness(), query = h.doc.querySelectorAll;
    h.doc.querySelectorAll = () => { throw Error('시험 오류'); };
    assert.throws(h.acquire, /시험 오류/); assert.equal(h.state.send, false);
    h.doc.querySelectorAll = query;
    const release = h.acquire(); assert.equal(h.state.send, true); release(); assert.equal(h.state.send, false);
});
check('실제 연결에서 멈춤·채팅 이동 차단·리스너 해제가 이어져요', () => {
    const h = harness(), clicks = new Set(), stops = new Set();
    let stateHolds = 0;
    const box = {
        document: h.doc, createRewriteUiHold, REWRITE_ACTION_SELECTOR,
        get is_send_press() { return h.state.send; },
        setSendButtonState: value => { h.state.send = value; },
        hideSwipeButtons() { h.state.hidden++; }, showSwipeButtons() { h.state.shown++; },
        holdGenerationState() { stateHolds++; return () => { stateHolds--; }; },
        event_types: { GENERATION_STOPPED: 'stop' },
        eventSource: { on: (_type, fn) => stops.add(fn), removeListener: (_type, fn) => stops.delete(fn) },
        window: { addEventListener: (_type, fn) => clicks.add(fn), removeEventListener: (_type, fn) => clicks.delete(fn) },
        chatSwitchTarget: target => target?.chat, toastr: { info() {} },
    };
    const source = fs.readFileSync(new URL('../../src/addons/rewrite/reroll.js', import.meta.url), 'utf8');
    const start = source.indexOf('let acquireUiHold;'), end = source.indexOf('/** Runs `task`', start);
    assert.ok(start >= 0 && end > start);
    vm.runInNewContext(source.slice(start, end).replace('export function', 'function'), box);
    const controller = new AbortController(), release = box.holdGeneration(controller);
    assert.equal(stateHolds, 1); assert.equal(h.state.send, true);
    for (const stop of stops) stop('다른 헬퍼'); assert.equal(controller.signal.aborted, false);
    let prevented = 0;
    for (const click of clicks) click({ target: { chat: true }, preventDefault() { prevented++; }, stopImmediatePropagation() {} });
    for (const click of clicks) click({ target: { closest: selector => selector === REWRITE_ACTION_SELECTOR }, preventDefault() { prevented++; }, stopImmediatePropagation() {} });
    assert.equal(prevented, 2);
    for (const stop of stops) stop(); assert.equal(controller.signal.aborted, true);
    assert.equal(h.state.send, true, '멈춤 뒤에도 작업 정리가 끝나기 전에는 전송을 못 해요');
    release(); release();
    assert.equal(stateHolds, 0); assert.equal(h.state.send, false);
    assert.equal(clicks.size, 0); assert.equal(stops.size, 0);
});
console.log(`다시 쓰기 조작부 잠금 ${passed}개를 통과했어요.`);
