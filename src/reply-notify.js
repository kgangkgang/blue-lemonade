// 답 완료 알림 (4.8.7): 다른 앱을 보고 있을 때 답이 끝나면 폰 알림 · 진동으로 알려 준다. 켜 두었을 때만 불러온다 (features.js).
//
// 안드로이드 크롬은 페이지에서 바로 `new Notification()` 을 못 쓴다(서비스 워커가 있어야 함). 실리태번에는 서비스 워커가 없으니
// 테마 폴더의 notify-sw.js 를 이 폴더 범위로 등록해 registration.showNotification 으로 띄운다 — 페이지를 가로채지 않는 범위라
// 실리태번 요청에는 손대지 않는다. 알림을 누르면 워커가 실리태번 창을 앞으로 가져온다 (notify-sw.js).
// 화면을 보고 있으면(visible) 알리지 않는다. 답이 끝난 뒤 번역 등 뒷일은 기다리지 않는다 — 글이 도착한 순간이 알림의 뜻이다.
let on = false, bound = false, registration = null, registering = null, offs = [];
let lastShown = 0;

// 워커는 src/ 에 둔다 — 패키저가 테마 루트의 추가 js 는 싣지 않는다 (index.js 만). 범위도 src/ 라 실리태번 페이지는 제어하지 않는다.
function swUrl() { return new URL('./notify-sw.js', import.meta.url); }
function scope() { return new URL('./', import.meta.url).pathname; }

async function ensureWorker() {
    if (registration) return registration;
    if (!('serviceWorker' in navigator)) return null;
    // navigator.serviceWorker.ready 는 '이 페이지를 제어하는' 워커만 기다린다 — 우리 워커는 테마 폴더 범위라 영원히 안 풀린다. 등록 결과의 워커가 활성될 때까지 직접 본다.
    registering ??= navigator.serviceWorker.register(swUrl().pathname, { scope: scope() })
        .then(async (reg) => {
            for (let i = 0; i < 100 && !reg.active; i++) await new Promise(r => setTimeout(r, 50));
            registration = reg;
            return reg;
        })
        .catch((error) => { console.info('[Blue Lemonade] 알림 워커를 등록하지 못했어요', error?.message || error); registering = null; return null; });
    return registering;
}

/**
 * 설정에서 켤 때: panel.js 가 누르는 순간(사용자 동작 안에서) Notification.requestPermission() 을 먼저 부르고 그 결과를 넘긴다 —
 * 이 모듈을 동적으로 불러온 뒤에 물으면 폰 크롬이 조용한 알림으로 낮추거나 무시한다. 허용됐으면 워커를 준비한다.
 * @param {NotificationPermission | 'unsupported'} state
 */
export async function afterPermission(state) {
    if (state === 'unsupported') { toastr.warning('이 브라우저는 알림을 지원하지 않아요', 'Blue Lemonade'); return false; }
    if (state !== 'granted') { toastr.warning('알림이 허용되지 않았어요. 브라우저의 사이트 설정에서 알림을 허용한 뒤 다시 켜 주세요', 'Blue Lemonade'); return false; }
    const reg = await ensureWorker();
    if (!reg) toastr.info('알림 워커를 못 만들어 페이지 알림으로 대신해요 (일부 폰은 안 뜰 수 있어요)', 'Blue Lemonade');
    return true;
}

function replyPreview() {
    try {
        const chat = SillyTavern.getContext().chat;
        const last = chat?.at?.(-1);
        if (!last || last.is_user) return { title: '답이 도착했어요', body: '' };
        const text = String(last.mes || '').replace(/<[^>]+>/g, ' ').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
        return { title: `${last.name || '답'} · 답이 도착했어요`, body: text.slice(0, 120) };
    } catch { return { title: '답이 도착했어요', body: '' }; }
}

async function notify() {
    if (!on || document.visibilityState === 'visible') return;
    if (Date.now() - lastShown < 3000) return; // 끝 이벤트가 겹쳐 두 번 오는 것
    lastShown = Date.now();
    const { title, body } = replyPreview();
    const options = { body, tag: 'bl-reply', renotify: true, silent: false, vibrate: [90, 50, 90], icon: '/img/apple-icon-114x114.png', data: { url: location.href } };
    try {
        const reg = await ensureWorker();
        if (reg?.showNotification) { await reg.showNotification(title, options); return; }
        if ('Notification' in window && Notification.permission === 'granted') new Notification(title, options);
    } catch (error) { console.info('[Blue Lemonade] 알림을 띄우지 못했어요', error?.message || error); }
    try { navigator.vibrate?.([90, 50, 90]); } catch { /* 진동이 없는 기기 */ }
}

export function syncReplyNotify(enabled) {
    on = !!enabled;
    if (!on) return;
    if ('Notification' in window && Notification.permission === 'granted') ensureWorker();
    if (bound) return;
    bound = true;
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        const listen = (name, fn) => { if (event_types[name]) { eventSource.on(event_types[name], fn); offs.push(() => eventSource.removeListener?.(event_types[name], fn)); } };
        // 프롬프트 관리자의 토큰 세기(dryRun) · 사칭 · 조용한 생성은 답이 아니다
        let real = false;
        listen('GENERATION_STARTED', (type, _params, dryRun) => { real = !dryRun && !['quiet', 'impersonate'].includes(type); });
        listen('GENERATION_ENDED', () => { if (real) { real = false; notify(); } });
    } catch { /* 이벤트를 못 걸면 알림도 없다 */ }
}

export const replyNotifySupported = () => 'Notification' in window;
