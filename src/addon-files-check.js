// 애드온의 코드와 스타일이 같은 판인지 확인한다 (공용).
//
// 예전에는 도구마다 시작 3초 뒤에 한 번 보고 곧바로 '파일이 섞였어요'를 띄웠다. 폰에서 테마를 다시 깐 직후에는 스타일이 덜 받아졌거나
// 브라우저가 쓰다 만 파일을 쥐고 있을 뿐인데도 경고가 도구 수만큼 줄줄이 떴다. 이제는
//   1) 값이 맞을 때까지 몇 번 기다려 보고  2) 그래도 다르면 스타일 파일을 새 주소로 한 번 다시 받아 끼우고(애드온 폴더마다 한 번)
//   3) 그러고도 다를 때만, 페이지에 한 번만 알린다.
const reloads = new Map();
let warned = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// 4.8.3: 시작 직후의 getComputedStyle 은 밀린 스타일 계산을 그 자리에서 돌린다 — 도구 여섯이 저마다 하면 부팅 0.3s@4x.
// 브라우저가 한가할 때(그 프레임의 계산이 끝난 뒤) 읽으면 공짜에 가깝고, 여섯이 같은 한가한 틈에 몰려 한 번만 계산된다.
const idle = () => new Promise(resolve => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => resolve(), { timeout: 4000 }) : setTimeout(resolve, 1000)));
// 경량화(10-16): 로딩 화면 동안에는 읽지 않는다 — 부팅 중엔 한가한 틈이 안 와서(4초 시간 초과) 도구 열세 개가 저마다 문서 전체 스타일 계산을 강제했다
// (폰 리그 4배 부팅 2.6초). 앱이 준비된 뒤부터 예전처럼 한가한 틈에 잰다 (확인은 진단용이라 몇 초 늦어도 같다)
let ready = null;
const appReady = () => ready ||= new Promise(resolve => {
    if (typeof document?.getElementById !== 'function' || !document.getElementById('loader')) return resolve();   // 문서가 없거나(검사 · 다른 환경) 로딩 화면이 없으면 바로
    try { const { eventSource, event_types } = SillyTavern.getContext(); eventSource.once(event_types.APP_READY, () => resolve()); } catch { return resolve(); }
    setTimeout(resolve, 60000); // 준비 신호를 놓쳐도 1분 뒤에는 잰다
});

function read(name, selector) {
    const element = selector ? document.querySelector(selector) : document.documentElement;
    if (!element) return null; // 볼 칸이 아직 없다 — 다르다고 치지 않는다
    return getComputedStyle(element).getPropertyValue(name).trim().replace(/["']/g, '');
}

function reloadStyle(folder) {
    if (!reloads.has(folder)) reloads.set(folder, (async () => {
        const old = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href.includes(`/addons/${folder}/style.css`));
        if (!old) return false;
        const url = new URL(old.href);
        url.searchParams.set('r', Date.now().toString(36));
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url.href;
        const ok = await new Promise(resolve => {
            const timer = setTimeout(() => resolve(false), 15000);
            link.onload = () => { clearTimeout(timer); resolve(true); };
            link.onerror = () => { clearTimeout(timer); resolve(false); };
            old.after(link); // 같은 자리 — 규칙 순서가 그대로다
        });
        if (ok) old.remove(); else link.remove();
        return ok;
    })());
    return reloads.get(folder);
}

/**
 * @param {{folder:string,name:string,version:string,title:string,selector?:string}} options
 *   folder = src/addons 아래 폴더, name = 스타일에 적힌 버전 변수, selector = 그 변수가 :root 가 아닌 칸에 있을 때
 */
export async function verifyAddonCss({ folder, name, version, title, selector }) {
    const ok = () => { const value = read(name, selector); return value === null || value === version; };
    await appReady();
    for (let i = 0; i < 4; i++) { await idle(); if (ok()) return true; await wait(3000); }
    const reloaded = await reloadStyle(folder);
    for (let i = 0; i < 3; i++) { await wait(i ? 3000 : 300); await idle(); if (ok()) return true; }
    const seen = read(name, selector);
    console.warn(`[Blue Lemonade] ${title}: 코드 ${version}, 스타일 ${seen || '없음'} (다시 받기 ${reloaded ? '함' : '실패'})`);
    // 8.2.0 값이 비었으면 옛 파일이 아니라 아직 안 불러왔거나 나중에 불러오는 스타일이에요 — 느린 폰 · 무거운 시험 환경에서 「스타일 없음」 오탐 알림이 떴어요. 판이 실제로 다를 때만 알려요
    if (!seen) return false;
    if (!warned && typeof toastr !== 'undefined') {
        warned = true;
        toastr.warning(`${title} 스타일 파일이 코드와 달라요 (코드 ${version}, 스타일 ${read(name, selector) || '없음'}). 최신 버전으로 업데이트한 뒤 새로고침해 주세요. 계속 뜨면 이 경고의 코드·스타일 버전을 알려 주세요.`, 'Blue Lemonade', { timeOut: 15000 });
    }
    return false;
}
