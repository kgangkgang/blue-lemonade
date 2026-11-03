// 9.0.7 내장 스크립트의 되풀이 일(setInterval)을 진짜 타이머 하나로 모아요.
//   예전에는 스크립트마다 숨은 iframe 안에서 제 setInterval 을 돌렸어요(데우스 빠른 설정 0.5초 · 과일의 마음 1.5초 — 폰 4배 측정 45회 371ms).
//   이제 일은 여기 목록에만 적히고, 진짜 setInterval 은 늘 하나(가장 짧은 간격)예요. 그 박자마다 때가 된 일만 돌아요.
//   화면이 가려지면(visibilitychange) 타이머를 내려요. 손을 안 댄 지 IDLE_MS 가 지나도 내려요 — 다시 보이거나 손을 대면 밀린 일을 한 번 돌리고 이어 가요.
export const IDLE_MS = 60000;
const MIN_MS = 50;
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
const tasks = new Map();
let seq = 0, timer = 0, period = 0, lastInput = Date.now(), bound = false, ticks = 0, runs = 0;
const now = () => Date.now();
const hidden = () => typeof document !== 'undefined' && document.hidden === true;
const idle = () => now() - lastInput > IDLE_MS;

function run(task) {
    runs++;
    try { task.fn(); } catch (error) { task.onError?.(error); }
}
function tick() {
    ticks++;
    if (hidden() || idle()) { arm(); return; }
    const at = now();
    // 박자가 조금 늦게 와도(브라우저가 타이머를 미룸) 그 박자에 같이 돌려요 — 5ms 여유
    for (const task of [...tasks.values()]) if (tasks.has(task.id) && task.due <= at + 5) { task.due = at + task.ms; run(task); }
}
/** 진짜 타이머를 지금 할 일에 맞춰요: 일이 없거나 · 가려졌거나 · 쉬는 중이면 내리고, 아니면 가장 짧은 간격으로 하나 */
function arm() {
    const want = tasks.size && !hidden() && !idle() ? Math.min(...[...tasks.values()].map(task => task.ms)) : 0;
    if (want === period && (want ? timer : !timer)) return;
    if (timer) clearInterval(timer);
    timer = want ? setInterval(tick, want) : 0;
    period = want;
}
/** 다시 보이거나 손을 댔을 때: 멈춰 있었으면 밀린 일을 바로 한 번 돌리고 타이머를 다시 걸어요 */
function wake() {
    const was = !timer;
    arm();
    if (was && timer) tick();
}
function onInput() {
    const sleeping = idle();
    lastInput = now();
    if (sleeping) wake();
}
function onVisibility() { if (!hidden()) lastInput = now(); wake(); }
function bind(on) {
    if (on === bound || typeof window === 'undefined' || typeof document === 'undefined') return;
    bound = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    for (const type of INPUT_EVENTS) window[method](type, onInput, { capture: true, passive: true });
    document[method]('visibilitychange', onVisibility);
}

/** setInterval 대신: fn 을 ms 마다(가려짐 · 쉼에는 멈춤). 돌려주는 번호로 cancel */
export function every(fn, ms, { owner = '', onError } = {}) {
    const id = ++seq, gap = Math.max(MIN_MS, Number(ms) || 0);
    tasks.set(id, { id, fn, ms: gap, due: now() + gap, owner, onError });
    bind(true);
    arm();
    return id;
}
export function cancel(id) {
    if (!tasks.delete(id)) return false;
    arm();
    if (!tasks.size) bind(false);
    return true;
}
/** 진단 · 시험용: 진짜 타이머 수(0 또는 1) · 간격 · 일 목록 */
export function schedulerStats() {
    const owners = {};
    for (const task of tasks.values()) owners[task.owner] = (owners[task.owner] || 0) + 1;
    return { intervals: timer ? 1 : 0, period, tasks: tasks.size, owners, ticks, runs, paused: !!tasks.size && !timer };
}
/** 시험용: 상태를 처음으로 */
export function resetScheduler() {
    for (const id of [...tasks.keys()]) cancel(id);
    lastInput = now(); ticks = 0; runs = 0;
}
