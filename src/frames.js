// 에셋·프로필 공통 테두리. DOM을 추가하지 않고 CSS 변수만 만든다.
export const FRAME_DEFAULTS = {
    edge: 'none', edgeAuto: true, edgeColor: '#91a5ba', edgeThick: 0.75, edgeAlpha: 35,
    edgeStyle: 'solid', edgeGap: 0, edgeGlow: 16, edgeGlowAlpha: 14,
    edgeSecondGap: 3, edgeSecondAlpha: 18,
    edgeShadow: false, edgeShadowColor: '#000000', edgeShadowAlpha: 14,
    edgeShadowX: 0, edgeShadowY: 8, edgeShadowBlur: 24, edgeShadowSpread: -6,
    edgeSideTop: true, edgeSideRight: true, edgeSideBottom: true, edgeSideLeft: true,
};
export const FRAME_RANGE = {
    edgeThick: [0, 8], edgeAlpha: [0, 100], edgeGap: [0, 32], edgeGlow: [0, 64], edgeGlowAlpha: [0, 100],
    edgeSecondGap: [1, 16], edgeSecondAlpha: [0, 100], edgeShadowAlpha: [0, 100],
    edgeShadowX: [-40, 40], edgeShadowY: [-40, 40], edgeShadowBlur: [0, 80], edgeShadowSpread: [-24, 24],
};
export function tidyFrame(o) {
    for (const [key, def] of Object.entries(FRAME_DEFAULTS)) {
        if (o[key] === undefined) o[key] = def;
        if (typeof def === 'boolean') o[key] = o[key] === true || o[key] === 'true';
    }
    for (const [key, [min, max]] of Object.entries(FRAME_RANGE)) {
        const n = Number(o[key]);
        o[key] = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : FRAME_DEFAULTS[key];
    }
    for (const key of ['edgeColor', 'edgeShadowColor']) if (!/^#[a-f\d]{6}$/i.test(o[key])) o[key] = FRAME_DEFAULTS[key];
    if (!['none', 'line', 'inset', 'glow', 'prism'].includes(o.edge)) o.edge = 'none';
    if (!['solid', 'dashed', 'dotted'].includes(o.edgeStyle)) o.edgeStyle = 'solid';
}
const mix = (color, alpha) => `color-mix(in srgb, ${color} ${alpha}%, transparent)`;
export function frameVars(o, prefix, accent) {
    const ink = o.edgeAuto ? accent : o.edgeColor;
    const shown = o.edge !== 'none';
    const all = ['Top', 'Right', 'Bottom', 'Left'].every(k => o[`edgeSide${k}`]);
    const shadows = [];
    if (shown && o.edge === 'glow' && all && o.edgeGlow > 0) shadows.push(`0 0 ${o.edgeGlow}px ${mix(ink, o.edgeGlowAlpha)}`);
    if (o.edgeShadow) shadows.push(`${o.edgeShadowX}px ${o.edgeShadowY}px ${o.edgeShadowBlur}px ${o.edgeShadowSpread}px ${mix(o.edgeShadowColor, o.edgeShadowAlpha)}`);
    const vars = {
        color: mix(ink, o.edgeAlpha), style: o.edgeStyle, gap: `${o.edgeGap}px`, shadow: shadows.join(', ') || 'none',
        outline: shown && all && ['inset', 'prism'].includes(o.edge) ? `${o.edgeThick}px ${o.edgeStyle} ${mix(ink, o.edge === 'prism' ? o.edgeSecondAlpha : o.edgeAlpha)}` : 'none',
        offset: o.edge === 'prism' ? `${o.edgeSecondGap}px` : `${-(o.edgeGap + o.edgeThick + 3)}px`,
    };
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) vars[side.toLowerCase()] = `${shown && o.edge !== 'inset' && o[`edgeSide${side}`] ? o.edgeThick : 0}px`;
    // 일부 면만 고르면 border를 쓰고, 전체 안쪽 선은 outline으로 그린다.
    if (shown && o.edge === 'inset' && !all) for (const side of ['Top', 'Right', 'Bottom', 'Left']) vars[side.toLowerCase()] = `${o[`edgeSide${side}`] ? o.edgeThick : 0}px`;
    return Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--bl-${prefix}-frame-${k}`, v]));
}
