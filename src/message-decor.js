// 9.0.4 메시지 꾸미기 한 함수(decorateMessage): 채팅 메시지(#chat .mes)를 꾸미는 모듈(조판 · 글자색 맞춤 · 아이콘 단추 표식 · 데우스 하늘 · 데우스 감정 대사)이
//   저마다 #chat 을 subtree 로 보던 감시자 다섯을, 실리태번 메시지 이벤트 + #chat 자식 목록 구독 하나(공용 감시 허브)로 모아요.
//   decorateMessage(mes) 가 등록된 꾸미기를 차례로 한 번씩 불러요(구조를 바꾸는 것 → 조판 → 색 → 표식 순서).
// 언제 꾸미나
//   · 이벤트(다음 프레임): CHARACTER_MESSAGE_RENDERED · USER_MESSAGE_RENDERED · MESSAGE_UPDATED · MESSAGE_SWIPED · MESSAGE_EDITED · MESSAGE_FILE_EMBEDDED ·
//     MESSAGE_REASONING_EDITED(인자 = 메시지 번호) → 그 메시지. CHAT_CHANGED → 채팅 전체. MORE_MESSAGES_LOADED → 새로 붙은 메시지.
//     실리태번 1.19 는 메시지를 다 그린 뒤 같은 작업 안에서 이 이벤트를 내요(script.js updateMessageBlock · addOneMessage · printMessages 뒤 CHAT_CHANGED).
//   · 이벤트가 없는 변화(번역이 본문을 갈아 끼움 · 편집칸 열기 · 다른 확장이 고침 · 채팅 열기 중 붙은 메시지): #chat 자식 목록(childList · subtree) 구독 하나가
//     바뀐 메시지를 적어 두고, 꾸미기마다 정한 조용한 시간(settle — 조판 120ms · 색/데우스 400ms, 예전 각자의 묶음 시간) 뒤에 그 메시지만.
//   · 답이 오는 동안(body[data-generating])은 이벤트 밖 변화를 미뤘다가 끝나면 한 번에(예전 조판 · 색 · 데우스가 각자 하던 것). live 꾸미기(표식)만 바로.
//   · 번역 진행 표시(.llmt-progress) 안의 1초마다 바뀌는 글은 메시지 변화로 치지 않아요(조판 · 색이 하던 거르기).
//   · 한 번 꾸민 뒤 그 꾸미기가 만든 변화는 이 구독만 버려요(off.quiet — 예전 각자의 takeRecords). 다른 감시(네모 단추 · 에셋 · 애드온)는 그대로 봐요.
// 쓰는 법: const off = addMessageDecorator('조판', list => typesetRoots(list), { settle: 120, kinds: ['event', 'chat', 'dom'], order: 20 });
import { watchDom } from './dom-watch.js';

const ALL = ['event', 'chat', 'dom'];
const EVENT_IDS = ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_FILE_EMBEDDED', 'MESSAGE_REASONING_EDITED'];
const decorators = [];
let started = null;   // { chat, off, offGen, events: [[name, fn]] }
let frame = 0, frameTimer = 0;
const queued = new Map();   // mes → 'event' | 'chat' (다음 프레임)
let chatAll = false;

const generating = () => document.body?.dataset?.generating === 'true';
const NOWHERE = Object.freeze({ skip: false, mes: null });
/**
 * 1.2.1 기록 묶음 하나를 나눠 받는 동안 「번역 진행 표시(.llmt-progress) 안인가 · 어느 메시지(.mes) 안인가」를 요소마다 한 번만 정해요.
 *   예전에는 기록마다 closest 를 두 번(진행 표시 · 메시지) 해서, 같은 요소 · 같은 조상을 기록 수만큼 다시 올라갔어요(300개 열기 · 폰 4배 기록 8천여 개 × 구독 둘).
 *   조상을 한 번 올라가며 지나간 조상의 답도 적어 두니 답은 closest 두 번과 같아요(quirks 문서는 class 대소문자를 안 가려 예전처럼 closest).
 *   묶음 안에서만 쓰고 버려요 — 콜백 사이에 DOM 이 바뀌어도 옛 답이 남지 않게. 시험 tools/tests/record-place-memo.mjs
 * @returns {(el: Element|null|undefined) => { skip: boolean, mes: Element|null }}
 */
export function recordPlaceMemo() {
    const memo = new Map();
    const quirks = typeof document !== 'undefined' && !!document?.compatMode && document.compatMode !== 'CSS1Compat';
    const place = el => {
        if (!el || el.nodeType !== 1) return NOWHERE;
        let v = memo.get(el);
        if (v) return v;
        if (quirks || !el.classList) v = { skip: !!el.closest?.('.llmt-progress'), mes: el.closest?.('.mes') || null };
        else {
            const up = place(el.parentElement);
            const mine = el.classList.contains('mes');
            v = { skip: up.skip || el.classList.contains('llmt-progress'), mes: mine ? el : up.mes };
        }
        memo.set(el, v);
        return v;
    };
    return place;
}

/**
 * 메시지 꾸미기를 등록해요. 돌려주는 값은 끊는 함수예요.
 * @param {string} name
 * @param {(list: Element[], kind: 'event'|'chat'|'dom') => void} fn  붙어 있는 .mes 목록
 * @param {{ settle?: number, kinds?: string[], live?: boolean, order?: number, filter?: (r: MutationRecord) => boolean, enabled?: () => boolean }} [opts]
 *   settle: 이벤트 밖 변화 뒤 조용히 기다릴 ms(0 = 다음 프레임) · kinds: 받을 때(event · chat · dom) · live: 답이 오는 동안에도 바로 ·
 *   order: 부르는 차례(작을수록 먼저) · filter: 이벤트 밖 변화 가운데 이 꾸미기가 볼 기록 · enabled: 꺼져 있으면 건너뜀
 */
export function addMessageDecorator(name, fn, { settle = 0, kinds = ALL, live = false, order = 50, filter = null, enabled = null } = {}) {
    const d = { name, fn, settle, kinds: new Set(kinds), live, order, filter, enabled, pending: new Set(), timer: 0, raf: 0, calls: 0, ms: 0 };
    decorators.push(d);
    decorators.sort((a, b) => a.order - b.order);
    start();
    return () => {
        const i = decorators.indexOf(d);
        if (i < 0) return;
        decorators.splice(i, 1);
        clearTimeout(d.timer); if (d.raf) cancelAnimationFrame(d.raf); d.pending.clear();
        if (!decorators.length) stop();
    };
}

/** 메시지 하나를 지금 꾸며요(등록된 꾸미기 전부 · 차례대로) */
export function decorateMessage(mes, kind = 'event') { decorateMessages([mes], kind); }

/** 메시지 여러 개를 지금 꾸며요 — 꾸미기마다 한 번씩 목록째(읽기 묶음 → 쓰기 묶음은 각 꾸미기 안에서) */
export function decorateMessages(list, kind = 'event', only = null) {
    const all = [...new Set(list)].filter(mes => mes?.isConnected);
    if (!all.length) return;
    started?.off.flush?.();   // 꾸미기 전까지 쌓인 남의 변화는 먼저 받아 두고(아래 quiet 가 버리지 않게)
    for (const d of only || decorators) {
        if (!d.kinds.has(kind)) continue;
        // 이벤트로 꾸민 메시지는 기다리던 이벤트 밖 변화에서 빼요(지금 모습을 이미 꾸몄어요)
        for (const mes of all) d.pending.delete(mes);
        if (d.enabled && !d.enabled()) continue;
        const t = performance.now();
        try { d.fn(all, kind); } catch (error) { console.warn('[Blue Lemonade] 메시지 꾸미기 오류', d.name, error); }
        d.calls++; d.ms += performance.now() - t;
    }
    started?.off.quiet();   // 꾸미기가 만든 변화는 이 구독만 버려요
}

function queue(mes, kind) {
    if (!mes) return;
    if (queued.get(mes) !== 'chat') queued.set(mes, kind);
    later();
}
function later() {
    if (frame || frameTimer) return;
    if (typeof requestAnimationFrame === 'function' && !document.hidden) frame = requestAnimationFrame(flushQueued);
    else frameTimer = setTimeout(flushQueued, 16);
}
function flushQueued() {
    if (frame) cancelAnimationFrame(frame);
    if (frameTimer) clearTimeout(frameTimer);
    frame = 0; frameTimer = 0;
    const chat = started?.chat;
    if (!chat) return;
    if (chatAll) {
        chatAll = false; queued.clear();
        decorateMessages([...chat.getElementsByClassName('mes')], 'chat');
        return;
    }
    const byKind = { event: [], chat: [] };
    for (const [mes, kind] of queued) byKind[kind].push(mes);
    queued.clear();
    if (byKind.chat.length) decorateMessages(byKind.chat, 'chat');
    if (byKind.event.length) decorateMessages(byKind.event, 'event');
}

// 이벤트 밖 변화: 꾸미기마다 조용한 시간 뒤(답이 오는 동안은 끝날 때까지 미룸)
// settle 0 = 다음 프레임(그리기 전 — 표식이 한 프레임도 늦지 않게), 숨은 탭은 타이머
function settleLater(d) {
    clearTimeout(d.timer); if (d.raf) cancelAnimationFrame(d.raf); d.raf = 0;
    if (d.settle > 0 || document.hidden || typeof requestAnimationFrame !== 'function') d.timer = setTimeout(() => settle(d), d.settle);
    else { d.timer = -1; d.raf = requestAnimationFrame(() => settle(d)); }
}
function settle(d) {
    d.timer = 0; d.raf = 0;
    if (!d.pending.size) return;
    if (!d.live && generating()) return;   // 끝나면(data-generating 이 빠지면) 다시 불러요
    const list = [...d.pending]; d.pending.clear();
    decorateMessages(list, 'dom', [d]);
}
function onRecords(records) {
    const place = recordPlaceMemo();
    const gen = generating();
    const touched = new Set();
    for (const r of records) {
        const at = place(r.target?.nodeType === 1 ? r.target : r.target?.parentElement);
        if (at.skip) continue;   // 번역 진행 표시의 초 · 문단 수 글
        const mes = at.mes;
        const hits = [];
        if (mes) hits.push(mes);
        else for (const n of r.addedNodes || []) {
            if (n.nodeType !== 1) continue;
            if (n.classList?.contains('mes')) hits.push(n);
            else for (const m of n.getElementsByClassName?.('mes') || []) hits.push(m);
        }
        if (!hits.length) continue;
        for (const d of decorators) {
            if (!d.kinds.has('dom') || (d.filter && !d.filter(r))) continue;
            for (const m of hits) d.pending.add(m);
            touched.add(d);
        }
    }
    for (const d of touched) {
        if (!d.live && gen) continue;   // 답이 끝나면(offGen) 다시
        if (d.settle > 0 || !d.timer) settleLater(d);   // 조용한 시간은 변화마다 뒤로 밀고, 다음 프레임 것은 한 번만
    }
}

function start() {
    if (started) return;
    const chat = typeof document === 'undefined' ? null : document.getElementById?.('chat');
    if (!chat) return;
    started = { chat, events: [] };
    started.off = watchDom(chat, { childList: true, subtree: true, name: '메시지 꾸미기 (이벤트 밖 변화)' }, onRecords);
    // 답이 끝나면(body[data-generating] 이 빠지면) 미뤄 둔 이벤트 밖 변화를 꾸며요
    started.offGen = watchDom(document.body, { attributes: ['data-generating'], name: '메시지 꾸미기 (답 끝)' }, () => {
        if (generating()) return;
        for (const d of decorators) if (d.pending.size && !d.timer) settleLater(d);
    });
    try {
        const { eventSource, event_types: t } = SillyTavern.getContext();
        const on = (name, fn) => { if (!name) return; eventSource.on(name, fn); started.events.push([name, fn]); };
        const one = id => {
            const n = Number(id);
            if (!Number.isInteger(n)) { chatAll = true; later(); return; }
            queue(chat.querySelector(`.mes[mesid="${n}"]`), 'event');
        };
        for (const key of EVENT_IDS) on(t[key], one);
        on(t.CHAT_CHANGED, () => { chatAll = true; later(); });
        // 더 불러오기: 그사이 붙은 메시지(이벤트 밖 변화로 적어 둔 것)를 기다리지 않고 다음 프레임에
        on(t.MORE_MESSAGES_LOADED, () => { for (const d of decorators) for (const mes of d.pending) queue(mes, 'event'); });
    } catch { /* 실리태번 문맥이 없으면(시험) 이벤트 밖 변화만 */ }
}
function stop() {
    if (!started) return;
    started.off(); started.offGen();
    try { const { eventSource } = SillyTavern.getContext(); for (const [name, fn] of started.events) eventSource.removeListener(name, fn); } catch { /* 없음 */ }
    started = null; queued.clear(); chatAll = false;
    if (frame) cancelAnimationFrame(frame); if (frameTimer) clearTimeout(frameTimer); frame = 0; frameTimer = 0;
}

/** 진단 · 시험용 */
export function messageDecorStats() {
    return { started: !!started, decorators: decorators.map(d => ({ name: d.name, calls: d.calls, ms: Math.round(d.ms * 10) / 10, pending: d.pending.size, settle: d.settle, live: d.live })) };
}
// 1.1.4 측정 도구가 묶음(dist) 밖에서 꾸미기별 횟수 · 시간 · 미룬 메시지 수를 읽는 길: globalThis[Symbol.for('blue-lemonade.diag.v1')].decor()
try { (globalThis[Symbol.for('blue-lemonade.diag.v1')] ??= {}).decor = () => messageDecorStats(); } catch { /* 진단용 — 못 걸어도 동작은 같아요 */ }
