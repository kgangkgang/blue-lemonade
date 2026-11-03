// 9.0.2 부팅 3층: 1층(정적 import)은 설정 · CSS 변수 · 글꼴 · 핵심 배치 · 요청 훅만, 2층은 첫 프레임 뒤(덮개 아래), 3층은 덮개가 걷힌 뒤 유휴(처음 쓰면 kickIdle 로 당김).
//   늦게 붙은 리스너가 놓친 CHAT_CHANGED 는 withReplay() 가 지금 채팅으로 한 번 불러요(APP_READY 는 실리태번이 늦은 리스너에도 바로 불러요).
import { afterBoot } from './boot-gate.js';

const ctx = () => { try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; } };
export const layerLog = [];   // 시험 · 진단: [층, 이름, performance.now()]
const now = () => { try { return performance.now(); } catch { return 0; } };
const note = (layer, name) => { layerLog.push([layer, name, now()]); };

// ── 2층 ──
let frameResolve;
/** 첫 프레임 뒤에 풀리는 약속 — 2층 모듈의 동적 import 는 이것을 기다려요 */
export const frameReady = new Promise(resolve => { frameResolve = resolve; });
let frameArmed = false;
function armFrame() {
    if (frameArmed) return;
    frameArmed = true;
    let done = false;
    const go = () => { if (done) return; done = true; clearTimeout(timer); setTimeout(() => { note(2, 'frame'); frameResolve(); }, 0); };
    // 숨은 탭(폰에서 앱을 바꿈)에서는 rAF 가 오지 않아요 — 그때는 시간으로
    const timer = setTimeout(go, 150);
    try { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go); } catch { /* rAF 없음 */ }
}
/** 2층: 첫 프레임 뒤에 fn (같은 프레임에 모아 차례로) */
export function afterFirstFrame(fn) {
    armFrame();
    return frameReady.then(() => fn());
}

// ── 3층 ──
const idleTasks = [];
let idleState = 'waiting', idleResolve;
/** 3층 일이 다 시작되고(애드온은 시작이 끝나고) 풀리는 약속 */
export const idleReady = new Promise(resolve => { idleResolve = resolve; });
/** 3층에 일 하나 — [이름, 함수(약속을 돌려도 됨)] */
export function whenIdle(name, task) {
    if (idleState === 'done') { runOne(name, task); return; }
    idleTasks.push([name, task]);
}
function runOne(name, task) {
    note(3, name);
    try { return Promise.resolve(task()).catch(error => console.warn(`[Blue Lemonade] 시작하지 못했어요(${name})`, error)); }
    catch (error) { console.error(`[Blue Lemonade] 시작하지 못했어요(${name})`, error); return Promise.resolve(); }
}
async function runIdle(reason) {
    if (idleState !== 'waiting' && idleState !== 'scheduled') return idleReady;
    idleState = 'running';
    note(3, `start:${reason}`);
    await frameReady;
    // 하나씩 시작하고 사이사이 한 박자 쉬어요 — 시작 묶음이 한 덩어리로 화면을 잡지 않게
    // 1.0.0: 일이 끝나길 기다리는 사이 새로 맡긴 일(성능 보조 시작이 늦어 뒤늦게 온 애드온 본체 시작)도 놓치지 않아요 — 예전에는 표에 남은 채 영영 돌지 않을 수 있었어요
    do {
        const jobs = [];
        while (idleTasks.length) {
            const [name, task] = idleTasks.shift();
            jobs.push(runOne(name, task));
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        await Promise.allSettled(jobs);
    } while (idleTasks.length);
    idleState = 'done';
    note(3, 'done');
    idleResolve();
    return idleReady;
}
/** 3층을 예약해요 — 덮개가 걷힌 뒤 브라우저가 한가할 때(늦어도 timeout) */
export function scheduleIdle({ timeout = 2500 } = {}) {
    if (idleState !== 'waiting') return;
    idleState = 'scheduled';
    armFrame();
    frameReady.then(() => afterBoot(() => {
        const run = () => { runIdle('idle'); };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout });
        else setTimeout(run, 300);
    }));
}
/** 3층을 지금 당겨요(처음 쓸 때) — 이미 돌았으면 그 약속 그대로 */
export function kickIdle(reason = 'kick') {
    if (idleState === 'done' || idleState === 'running') return idleReady;
    return runIdle(reason);
}

// ── 2층 기능 모듈 받기를 셈해요 (features.js · apply.js 가 첫 프레임 뒤에 받는 모듈) — 2층 다시 알림 창이 그 시작까지 덮게 ──
const tracked = new Set();
/** 첫 프레임 뒤 받는 모듈 약속을 맡겨요 — lateSettled() 가 다 끝날 때까지 기다려요 */
export function trackLate(promise) {
    const job = Promise.resolve(promise).catch(() => {}).finally(() => tracked.delete(job));
    tracked.add(job);
    return promise;
}
/** 맡긴 받기가 다 끝나고(그 사이 새로 맡긴 것까지) 받은 뒤 부르는 시작 함수(then)까지 돈 다음에 풀려요 */
export async function lateSettled() {
    for (let i = 0; i < 20 && tracked.size; i++) await Promise.allSettled([...tracked]);
    await new Promise(resolve => setTimeout(resolve, 0));
}

// ── 문(처음 쓸 때): drawer 서랍 · ✦ 메뉴 · 설정 창 / input 입력칸 / press 어디든 처음 누름
const gateFiredSet = new Set(), gateWaiters = new Map();   // 문 이름 → Map(열쇠 → 함수)
export const gateFired = name => gateFiredSet.has(name);
export function onGate(name, fn, key = null) {
    if (gateFiredSet.has(name)) { fn(); return; }
    let waiters = gateWaiters.get(name);
    if (!waiters) gateWaiters.set(name, waiters = new Map());
    waiters.set(key ?? Symbol('문'), fn);
}
/** cascade: false = press 문은 열지 않아요(쉴 때 서랍 모듈만 미리 시작 — 누름 문은 사람이 처음 누를 때 그대로) */
export function fireGate(name, { cascade = true } = {}) {
    if (gateFiredSet.has(name)) { if (cascade && name !== 'press') fireGate('press'); return false; }
    gateFiredSet.add(name);
    const waiters = gateWaiters.get(name); gateWaiters.delete(name);
    layerLog.push([3, `문:${name}`, waiters ? waiters.size : 0]);
    for (const fn of waiters ? [...waiters.values()] : []) { try { fn(); } catch (error) { console.warn(`[Blue Lemonade] 문(${name})`, error); } }
    if (cascade && name !== 'press') fireGate('press');
    return true;
}

// ── 늦게 붙은 리스너에 지금 채팅으로 한 번 ──
const REPLAY = ['CHAT_CHANGED'];
function listeners(es, type) {
    const list = es?.events?.[type];
    return Array.isArray(list) ? list : [];
}
const replayed = new WeakSet();   // 층이 겹쳐 끝나도 한 리스너에 한 번만
const isOnceWrapper = fn => fn?.name === 'g';   // 실리태번 eventSource.once 의 감싸개 — 「다음 사건 한 번」이라 지금 상태로 부르지 않아요
/**
 * batch() 동안 새로 걸린 CHAT_CHANGED 리스너를, 채팅이 열려 있으면 지금 채팅 id 로 한 번 불러요.
 * batch 도중 진짜 CHAT_CHANGED 가 오면 그때 걸려 있던 리스너는 이미 받았으니 다시 부르지 않아요.
 */
export async function withReplay(name, batch) {
    const c = ctx(), es = c?.eventSource, types = c?.eventTypes ?? c?.event_types ?? {};
    const before = new Map(), served = new Map(), marks = [];
    for (const key of REPLAY) {
        const type = types[key];
        if (!type) continue;
        before.set(key, new Set(listeners(es, type)));
        served.set(key, new Set());
        const mark = () => { for (const fn of listeners(es, type)) served.get(key).add(fn); };
        mark.blLayerMark = true;   // 층 표시 리스너 — 다시 알리지 않아요
        try { es?.on?.(type, mark); marks.push([type, mark]); } catch { /* 흉내 eventSource */ }
    }
    try { return await batch(); }
    finally {
        for (const [type, mark] of marks) try { es?.removeListener?.(type, mark); } catch { /* 그대로 */ }
        const chatId = (() => { try { return c?.getCurrentChatId?.() ?? c?.chatId; } catch { return c?.chatId; } })();
        if (chatId !== undefined && chatId !== null && chatId !== '') {
            for (const [key, seen] of before) {
                const type = types[key];
                const fresh = listeners(es, type).filter(fn => !seen.has(fn) && !served.get(key).has(fn) && !replayed.has(fn) && !isOnceWrapper(fn) && !fn.blLayerMark && !marks.some(([, m]) => m === fn));
                for (const fn of fresh) replayed.add(fn);   // 부르기 전에 모두 표시 — 다른 층이 기다리는 사이 끝나도 같은 리스너를 또 고르지 않게
                for (const fn of fresh) {
                    note('replay', `${name}:${key}`);
                    try { await fn.call(es, chatId); } catch (error) { console.warn(`[Blue Lemonade] 늦게 붙은 모듈에 지금 채팅 알리기(${name})`, error); }
                }
            }
        }
    }
}
