export function installedTouchMode(win) {
    return win.navigator.maxTouchPoints > 0 && win.matchMedia('(pointer: coarse)').matches
        && (win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true);
}

export let appearance = null;
export function installAppearance(module) { appearance = module; }
export const layoutMergeView = s => appearance?.layoutMergeView(s) || Object.assign(value => value, { settle() {} });
