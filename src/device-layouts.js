// 홈 화면에 깐 터치 앱(PWA)인지 — 당겨 새로고침(pull-to-refresh.js)은 이때만 쓰므로, 그 밖에서는 시작할 때 그 파일을 받지 않게 판정만 여기 둔다
export function installedTouchMode(win) {
    return win.navigator.maxTouchPoints > 0 && win.matchMedia('(pointer: coarse)').matches
        && (win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true);
}

export let appearance = null;
export function installAppearance(module) { appearance = module; }
export const layoutMergeView = s => appearance?.layoutMergeView(s) || Object.assign(value => value, { settle() {} });
