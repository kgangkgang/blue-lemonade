// Only geometry varies by device. Palette, fonts and effects remain shared.
export const DEVICE_QUERY = '(max-width: 760px), (pointer: coarse)';
export const deviceKind = () => globalThis.matchMedia?.(DEVICE_QUERY).matches ? 'mobile' : 'pc';
export const LAYOUT_PATHS = [
    ...['size','dialogueSize','uiSize','codeSize','lineHeight','letterSpacing','para','measure','gutter','indent','align'].map(k => `type.${k}`),
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
        for (const key of ['pc','mobile']) { const merged=structuredClone(initial); restore(merged,d[key]); d[key]=merged; }
        restore(s, d[device]);
    }
    sessions.set(s, {device, on:true});
}
export function saveDeviceLayout(s) {
    const active = sessions.get(s);
    if (s.deviceLayouts?.on && active?.on) s.deviceLayouts[active.device] = capture(s);
}
