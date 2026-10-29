// Only geometry varies by device. Palette, fonts and effects remain shared.
export const DEVICE_QUERY = '(max-width: 760px), (pointer: coarse)';
export const deviceKind = () => globalThis.matchMedia?.(DEVICE_QUERY).matches ? 'mobile' : 'pc';
// 홈 화면에 깐 터치 앱(PWA)인지 — 당겨 새로고침(pull-to-refresh.js)은 이때만 쓰므로, 그 밖에서는 시작할 때 그 파일을 받지 않게 판정만 여기 둔다
export function installedTouchMode(win) {
    return win.navigator.maxTouchPoints > 0 && win.matchMedia('(pointer: coarse)').matches
        && (win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true);
}
export const LAYOUT_PATHS = [
    ...['size','dialogueSize','uiSize','codeSize','lineHeight','letterSpacing','para','measure','gutter','indent','align'].map(k => `type.${k}`),
    'markdown.size', 'markdown.space', 'chat.personaTall',
    ...['hrWidth','hrSpace','quotePadding','listIndent','tablePadding','underlineOffset'].map(key => `markdown.${key}`),
    'em.size', 'strong.size', 'dialogue.letterSpacing', 'em.letterSpacing', 'strong.letterSpacing', 'code.letterSpacing', 'chat.userSize',
    ...['profile','userProfile'].flatMap(p => ['mode','layout','sizing','screenHeight','maxHeight','visibleHeight','width','height','gap','headerLayout','headerGap','nameSize','metaSize'].map(k => `${p}.${k}`)),
];
const sessions = new WeakMap();
const read = (s, path) => path.split('.').reduce((o,k) => o?.[k], s);
const capture = s => { const out = {}; for (const p of LAYOUT_PATHS) {const [a,b]=p.split('.'); (out[a]??={})[b]=read(s,p);} return out; };
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function restore(s, values) {
    for (const path of LAYOUT_PATHS) {
        const value = read(values,path), current = read(s,path);
        if (value === undefined || !(value === null || ['string','number','boolean'].includes(typeof value))) continue;
        if (current !== null && value !== null && typeof value !== typeof current) continue;
        if (typeof value === 'number' && !Number.isFinite(value)) continue;
        const [a,b] = path.split('.'); s[a][b] = value;
    }
}
export function syncDeviceLayout(s, device = deviceKind()) {
    if (!object(s.deviceLayouts)) s.deviceLayouts = {on:false, pc:{}, mobile:{}};
    const d = s.deviceLayouts, previous = sessions.get(s);
    d.on = d.on === true;
    for (const key of ['pc','mobile']) if (!object(d[key])) d[key] = {};
    if (!d.on) { sessions.set(s, {device, on:false}); return; }
    if (!previous?.on || previous.device !== device) {
        if (previous?.on) d[previous.device] = capture(s);
        const initial = capture(s);
        if (previous && !previous.on && previous.device === device) d[device] = structuredClone(initial);
        for (const key of ['pc','mobile']) { const merged=structuredClone(initial); restore(merged,d[key]); d[key]=merged; }
        restore(s, d[device]);
    }
    sessions.set(s, {device, on:true});
}
export function saveDeviceLayout(s) {
    const active = sessions.get(s);
    if (s.deviceLayouts?.on && active?.on) s.deviceLayouts[active.device] = capture(s);
}
// 세 갈래 합치기(settings-sync.js) 앞에 불러요. 기기별 배치를 쓰면 위 칸의 배치 값은 「그 값을 저장한 기기」 것이라 기기끼리 견주면 안 돼요 —
// 견주면 다른 기기 글자 크기를 「서버가 바꾼 값」으로 받아, 다음 저장이 그 값을 이 기기 배치에 담았어요(폰 ↔ PC 를 오가면 이 기기 배치가 사라짐).
// 이 기기 배치 칸을 지금 위 칸으로 맞춘 뒤, 견줄 쪽(서버 · 마지막으로 맞춘 값)의 위 칸을 그쪽에 담긴 「이 기기 배치」로 바꿔 보는 함수를 돌려줘요.
// 합친 뒤 view.settle(): 이 탭은 꺼 둔 채였는데 다른 기기가 켰으면, 이 기기 배치를 새로 불러온 것처럼 다시 입혀요
// (그대로 두면 「이 탭에서 방금 켬」으로 보고 위 칸 = 다른 기기 값을 이 기기 배치로 담았어요).
export function layoutMergeView(local) {
    const active = sessions.get(local), wasOn = object(local) && local.deviceLayouts?.on === true;
    const settle = () => { if (!wasOn && object(local) && local.deviceLayouts?.on === true) sessions.delete(local); };
    if (!object(local) || !local.deviceLayouts?.on || !active?.on) return Object.assign(other => other, { settle });
    saveDeviceLayout(local);
    return Object.assign(other => {
        if (!object(other) || other.deviceLayouts?.on !== true) return other;
        const mine = other.deviceLayouts[active.device];
        if (!object(mine) || !Object.keys(mine).length) return other;   // 그쪽이 이 기기 배치를 비웠음(테마 모습 초기화) → 위 칸 그대로 견줘 처음 값을 받아요
        const out = structuredClone(other);
        for (const path of LAYOUT_PATHS) {
            const [a, b] = path.split('.');
            if (!object(out[a])) continue;
            const value = read(mine, path);
            out[a][b] = structuredClone(value !== undefined ? value : read(local, path));   // 그쪽이 이 기기 값을 모르면 이 탭 값 = 바꾼 것 없음
        }
        return out;
    }, { settle });
}
