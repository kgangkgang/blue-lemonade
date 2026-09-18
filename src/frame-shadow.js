// Filter the composed photo + ornament alpha, not its rectangular canvas.
// A shared filter per owner supports spread without making a filter per message.
import { hasDecor } from './decor.js';
let signature = '';
export function syncFrameShadows(settings) {
    const owners = ['image', 'profile', 'userProfile'];
    const config = owners.map(owner => {
        const p = settings[owner];
        return settings.enabled && p?.edgeShadow && hasDecor(p.decor) && (owner === 'image' || p.mode === 'banner')
            ? [owner, p.edgeShadowColor, p.edgeShadowAlpha, p.edgeShadowX, p.edgeShadowY, p.edgeShadowBlur, p.edgeShadowSpread] : [owner];
    });
    const next = JSON.stringify(config);
    if (signature === next) return;
    signature = next;
    let svg = document.getElementById('bl-frame-shadow-filters');
    const active = config.filter(p => p.length > 1);
    if (active.length && !svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'bl-frame-shadow-filters'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
        svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden';
        document.body.append(svg);
    }
    if (svg) {
        if (!active.length) svg.remove();
        else svg.innerHTML = '<defs>' + active.map(([owner, color, alpha, x, y, blur, spread]) =>
            `<filter id="bl-art-shadow-${owner}" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB">
            <feMorphology in="SourceAlpha" operator="${spread < 0 ? 'erode' : 'dilate'}" radius="${Math.abs(spread)}" result="expanded"/>
            <feGaussianBlur in="expanded" stdDeviation="${blur / 2}" result="soft"/>
            <feOffset in="soft" dx="${x}" dy="${y}" result="offset"/>
            <feFlood flood-color="${color}" flood-opacity="${alpha / 100}"/>
            <feComposite in2="offset" operator="in"/>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`).join('') + '</defs>';
    }
    for (const [owner, ...values] of config) document.documentElement.style.setProperty(`--bl-art-shadow-${owner}`, values.length ? `url("#bl-art-shadow-${owner}")` : 'none');
}
