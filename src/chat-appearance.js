import './palette-data.js';
import { installAppearance } from './device-layouts.js';
import * as gradients from './gradients.js';
import * as decor from './decor.js';
import * as device from './device-layout-options.js';
import { tidyFrameLibrary } from './frame-library.js';
import { frameVars } from './frames.js';
import { syncProfile } from './profile.js';
import { syncProfileClip } from './profile-clip.js';
import { syncFrameShadows } from './frame-shadow.js';
import { invalidateSettings } from './settings.js';
const { decorVars } = decor;
export function profileVars(p, pal, user = false) {
    const vars = Object.assign(frameVars(p, 'profile', pal.accent), decorVars(p.decor, 'profile', p.radius), {
        '--bl-name-size': `${p.nameSize}px`, '--bl-name-weight': String(p.nameWeight), '--bl-name-spacing': `${p.nameSpacing / 100}em`,
        '--bl-name-height': String(p.nameHeight), '--bl-name-color': p.nameAuto ? pal.text : p.nameColor,
        '--bl-name-align': p.nameAlign, '--bl-name-justify': p.nameAlign === 'left' ? 'start' : p.nameAlign === 'right' ? 'end' : 'center',
        '--bl-meta-leading': p.nameAlign === 'left' ? '0px' : '1fr', '--bl-meta-trailing': p.nameAlign === 'right' ? '0px' : '1fr',
        '--bl-name-style': p.nameItalic ? 'italic' : 'normal', '--bl-name-decoration': p.nameUnderline ? 'underline' : 'none',
        '--bl-header-gap': `${p.headerGap}px`, '--bl-meta-size': `${p.metaSize}px`, '--bl-meta-opacity': String(p.metaOpacity / 100), '--bl-button-gap': `${p.buttonGap}px`,
        '--bl-name-outline': `${p.nameOutline}px ${p.nameOutlineColor}`,
        '--bl-name-shadow': p.nameShadow ? `0 ${p.nameShadowY}px ${p.nameShadowBlur}px rgba(0,0,0,${p.nameShadowAlpha / 100})` : 'none',
        '--bl-profile-width': `${p.width}%`, '--bl-profile-height': p.sizing === 'screen' ? `${p.screenHeight}svh` : `${p.height}px`,
        '--bl-profile-max-height': `${p.maxHeight}svh`,
        '--bl-profile-crop': `inset(${(100 - p.visibleHeight) * p.positionY / 100}% 0 ${(100 - p.visibleHeight) * (100 - p.positionY) / 100}% 0)`,
        '--bl-profile-fit': p.fit, '--bl-profile-position': `${p.positionX}% ${p.positionY}%`,
        '--bl-profile-radius': `${p.radius}px`, '--bl-profile-gap': `${p.gap}px`,
        '--bl-profile-blur': `${p.blur}px`, '--bl-profile-opacity': String(p.opacity / 100),
        '--bl-profile-fade-y': `${p.fadeY}%`, '--bl-profile-fade-x': `${p.fadeX}%`,
    });
    return user ? Object.fromEntries(Object.entries(vars).map(([key, value]) => [key.replace('--bl-', '--bl-user-'), value])) : vars;
}


const api = { ...gradients, ...decor, ...device, tidyFrameLibrary, profileVars, syncProfile, syncProfileClip, syncFrameShadows };
installAppearance(api);
invalidateSettings();
let sheet;
export function syncAppearanceSheet(on) {
    if (on && !sheet) {
        sheet = document.createElement('link');
        sheet.rel = 'stylesheet'; sheet.id = 'bl-chat-appearance';
        sheet.href = new URL('./chat-appearance.css', import.meta.url).href;
        document.head.appendChild(sheet);
    }
    if (sheet) sheet.disabled = !on;
}
export function bindDeviceChanges(hooks) {
    if (bindDeviceChanges.bound) return;
    bindDeviceChanges.bound = true;
    globalThis.matchMedia?.(device.DEVICE_QUERY)?.addEventListener?.('change', () => {
        invalidateSettings(); window.dispatchEvent(new Event('bl:device-layout'));
        hooks.applyAll?.(); hooks.refreshPanels?.();
    });
}
export { api };
