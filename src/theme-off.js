// 1.0.0 사용 모드 되살림: 테마가 빠진 모드(확장만 · 테마 끔)에서만 쓸모 있는 셋을 시작 그래프 밖에 모았어요 — index.js 가 쉬는 틈에 받아요.
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';
import { forcedThemeGuard } from './forced-theme-guard.js';
import { watchDom } from './dom-watch.js';
let started = false;
export function startThemeOff() {
    if (started) return; started = true;
    // 7.2.1 확장만 · 테마 끔: 실리태번 판이 반투명 + 흐림 꺼짐이면 서랍 글자가 채팅 위에 겹친다 — 그때만 같은 색을 불투명하게 (st-solid.js, 테마가 켜지면 스스로 뗀다)
    import('./st-solid.js').then(m => m.startStSolid()).catch(error => console.warn('[Blue Lemonade] 실리태번 판 불투명', error));
    // 7.2.4 테마가 빠진 모드에서 바깥 확장이 body.salty 를 붙이면 바로 뗀다 — 테마 변수 없이 테마 규칙만 걸려 채팅 · 서랍 배경이 사라졌다 (usage-mode.js forcedThemeGuard · 공용 감시 허브 구독)
    const guard = forcedThemeGuard({ themeOn: () => themeEnabled(getSettings()), warn: message => console.warn('[Blue Lemonade]', message) });
    guard(document.body.classList);
    watchDom(document.body, { attributes: ['class'], name: '테마 클래스 지킴이' }, () => guard(document.body.classList));
    // 5.5.6: 테마가 빠져 있는데 '실리태번 설정 맞추기' 값이 실리태번에 남아 있으면 한 번 알린다 — 누르면 되돌리기 (sttheme.js)
    if (!themeEnabled(getSettings())) {
        const notice = () => setTimeout(() => import('./sttheme.js').then(m => m.noticeRestoreIfNeeded()).catch(error => console.warn('[Blue Lemonade] 실리태번 설정 되돌리기 알림', error)), 2500);
        try {
            const { eventSource, event_types } = SillyTavern.getContext();
            if (document.getElementById('loader')) eventSource.once(event_types.APP_READY, notice); else notice();
        } catch { notice(); }
    }
}
