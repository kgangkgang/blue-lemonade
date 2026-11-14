// 1.4.8 opt: 애드온이 :root 에 쓰는 색 변수(전개 지시 --jj-* · 북마크 --cg-*)를 시작 덮개 아래에서 지난번 값으로 먼저 써 둬요.
//   사용자 정의 속성은 상속돼서 :root 인라인 값이 하나만 바뀌어도 문서 전체를 다시 계산해요. 애드온은 덮개가 걷힌 뒤(3층) 하나씩 시작하니
//   두 애드온이 각각 문서 전체 재계산을 한 번씩 더 일으켰어요(폰 리그 추적: 요소 435 · 436 · 덮개 뒤).
//   덮개 아래 첫 그리기는 어차피 문서 전체를 계산하므로 거기에 같이 실어 보내고, 애드온이 같은 값을 쓰면 건너뛰어요(setRootVar).
//   값이 달라졌으면(테마 색을 바꿈 · 다른 기기) 예전처럼 그때 써요 — 마지막 모습은 늘 애드온이 계산한 값이에요.
//   이 변수들을 읽는 것은 그 애드온이 붙이는 단추 · 아이콘 · 창뿐이라(애드온이 시작하기 전엔 화면에 없어요) 먼저 쓴 값이 보이는 곳이 없어요.
const KEY = 'bl-root-var-seed';
const PREFIXES = ['--jj-', '--cg-'];
let cache = null;
const ok = name => PREFIXES.some(prefix => name.startsWith(prefix));
function read() {
    if (cache) return cache;
    try { const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}'); cache = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; }
    catch { cache = {}; }
    return cache;
}
let timer = 0;
function save() {
    if (timer) return;
    timer = setTimeout(() => { timer = 0; try { globalThis.localStorage?.setItem(KEY, JSON.stringify(cache || {})); } catch { /* 사생활 모드 · 꽉 참 */ } }, 1000);
}
/** 시작 덮개 아래(1층)에서 한 번 — 지난번 값을 :root 에. 이미 값이 있으면 그대로 */
export function seedRootVars(root = globalThis.document?.documentElement) {
    if (!root) return 0;
    let n = 0;
    for (const [name, value] of Object.entries(read())) {
        if (!ok(name) || typeof value !== 'string' || !value || root.style.getPropertyValue(name)) continue;
        root.style.setProperty(name, value); n++;
    }
    return n;
}
/** :root 변수 쓰기 — 값이 같으면 쓰지 않아요(다시 계산 없음). value 가 비면 지워요 */
export function setRootVar(name, value, root = globalThis.document?.documentElement) {
    if (!root) return false;
    const next = value == null ? '' : String(value);
    const store = read();
    if (ok(name) && (store[name] ?? '') !== next) { if (next) store[name] = next; else delete store[name]; save(); }
    if (root.style.getPropertyValue(name) === next) return false;
    if (next) root.style.setProperty(name, next); else root.style.removeProperty(name);
    return true;
}
